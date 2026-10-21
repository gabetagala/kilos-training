// Tomato Cam VIEW (parent unit) — the monitor.
// Opens straight into the muted live picture; one tap for sound.
//
// This app makes no sound and raises no alarm. There is no cry chime, no
// watchdog siren, no arming step — deliberately, so there is nothing to set
// up and nothing to forget. The screen still says plainly what it knows, so
// a glance tells you whether you are looking at a live room or a dead link;
// it just will not wake you to say it. Neither phone ever makes a noise.
import { formatCode, normalizeCode } from './crypto.js';
import { isConfigured, openSignal } from './signal.js';
import { wireFooter } from './build.js';
import { keepAwake } from './wake.js';

const $ = (id) => document.getElementById(id);
// Same as the cam phone: the status table is gone. The calls stay because
// they are the clearest record of what the machine thinks is happening, and
// the headline on the video is what a person actually reads. They simply have
// nowhere to paint now.
function set(id, text, tone = '') {
  const el = $(id);
  if (!el) return;
  el.textContent = text;
  el.className = tone;
}


let pc = null;
let signal = null;
let live = false; // the session is up — never meant 'alerts armed'
let armAt = 0;
let sigReady = false;
let unmuted = false;
let iceQueue = [];
let lastBeaconRx = 0;
let gen = 0; // peer generation — guards awaits against a superseding offer
let prev = { frames: 0, bytes: 0 };
let connectedAt = 0;
let monitoring = true;
let camEnded = false;
let zenTimer = null;
let maxLevelSincePoll = 0;
const history = []; // {t, lvl} every 2s, capped at 30 min
const health = { peer: false, frames: false, beacon: false };

boot();

function boot() {
  wireFooter();

  if (!isConfigured) {
    $('cfg').hidden = false;
    return;
  }

  wireGate();
  $('changecode').onclick = () => {
    localStorage.removeItem('bantay-pair2');
    location.reload();
  };

  const stored = localStorage.getItem('bantay-pair2');
  if (stored?.length === 6) start(stored);
  else $('gate').hidden = false;
}

function wireGate() {
  const boxes = [...document.querySelectorAll('#codeboxes span')];
  const input = $('codein');
  input.addEventListener('input', () => {
    const v = normalizeCode(input.value).slice(0, 6);
    input.value = v;
    boxes.forEach((b, i) => {
      b.textContent = v[i] ?? '';
      b.classList.toggle('filled', i < v.length);
    });
    if (v.length === 6) {
      localStorage.setItem('bantay-pair2', v);
      input.blur(); // dismiss the numpad before the view appears
      $('gate').hidden = true;
      window.scrollTo({ top: 0 });
      start(v); // straight into the full-screen view, already dialing
    }
  });
  $('codeboxes').addEventListener('click', () => input.focus());
}

async function start(code) {
  $('app').hidden = false;
  $('pairedas').textContent = formatCode(code);

  keepAwake((held, why) => {
    set('s-wake', held ? 'will stay on' : `AT RISK (${why})`, held ? 'ok' : 'bad');
  });

  signal = await openSignal(code, onSignal, (status) => {
    sigReady = status === 'SUBSCRIBED';
    set('s-sig', sigReady ? 'ready' : status.toLowerCase(), sigReady ? 'ok' : '');
    if (sigReady && !health.peer && monitoring) call(); // dial as soon as the line opens
  });

  live = true;
  armAt = Date.now();

  $('unmute').onclick = unmute;
  $('soundbtn').onclick = () => (unmuted ? mute() : unmute());
  $('recallbtn').onclick = call;
  $('pausebtn').onclick = toggleMonitoring;
  wireNightstand();
  wireFit();
  wirePip();
  wireZen();


  setInterval(renderBeaconAge, 500);
  setInterval(pollStats, 1000); // 1s — detection lag eats the D12 budget
  setInterval(pushHistory, 2000);
  setInterval(renderUptime, 1000);
  setInterval(renderClock, 1000);
  // Self-healing by default: keep dialing while there's no live peer.
  setInterval(() => {
    if (live && monitoring && !health.peer && sigReady) call();
  }, 8000);
  headline();
}

function toggleMonitoring() {
  monitoring = !monitoring;
  $('pausebtn').textContent = monitoring ? 'Pause monitoring' : 'Resume monitoring';
  if (monitoring) {
    call();
  }
  headline();
}

function wireNightstand() {
  $('nsbtn').onclick = () => $('nightstand').classList.add('on');
  $('nightstand').onclick = () => $('nightstand').classList.remove('on');
}

function wireFit() {
  let cover = true;
  $('fitbtn').onclick = () => {
    cover = !cover;
    $('remote').style.objectFit = cover ? 'cover' : 'contain';
    $('fitbtn').classList.toggle('on', !cover);
  };
}

// Picture-in-Picture — FaceTime-style floating video while using other
// apps. Best-effort: if iOS later reclaims the backgrounded tab, PiP dies
// with it, so the overnight setup still assumes a dedicated screen.
function wirePip() {
  const v = $('remote');
  const btn = $('pipbtn');
  const webkitPiP = typeof v.webkitSetPresentationMode === 'function';
  if (!webkitPiP && !document.pictureInPictureEnabled) return; // stays hidden
  btn.hidden = false;
  try {
    v.autoPictureInPicture = true; // float automatically on app switch
  } catch {
    /* hint only */
  }
  btn.onclick = async () => {
    try {
      if (webkitPiP) {
        const inPiP = v.webkitPresentationMode === 'picture-in-picture';
        v.webkitSetPresentationMode(inPiP ? 'inline' : 'picture-in-picture');
      } else if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await v.requestPictureInPicture();
      }
    } catch {
      set('s-stream', 'floating video not available yet — try once video is playing', 'bad');
    }
  };
}

// Chrome fades off the video after a calm 6s; any tap brings it back.
// Trouble always forces it visible (headline()).
function wireZen() {
  $('stage').addEventListener('click', (e) => {
    if (e.target.closest('button')) return;
    if ($('stage').classList.contains('zen')) showChrome();
    else $('stage').classList.add('zen');
  });
  scheduleZen();
}

function showChrome() {
  $('stage').classList.remove('zen');
  scheduleZen();
}

function scheduleZen() {
  clearTimeout(zenTimer);
  zenTimer = setTimeout(() => {
    if (health.peer && health.frames && health.beacon) $('stage').classList.add('zen');
  }, 6000);
}

function call() {
  set('s-peer', 'calling…');
  signal.send('call', {});
}

async function onSignal(event, payload) {
  if (!live) return;
  try {
    if (event === 'offer') {
      if (!monitoring) return; // paused — don't answer
      await answer(payload.sdp);
    } else if (event === 'ice' && payload.candidate) {
      if (pc?.remoteDescription) await addIce(payload.candidate);
      else iceQueue.push(payload.candidate);
    } else if (event === 'beacon') {
        // Received and ignored. The cam still broadcasts this dead-man
        // beacon every 15s, but only the alarm ever read it — it was how
        // the viewer told "cam died" from "LAN path broke" in order to say
        // which. Nothing asks that question now.
    } else if (event === 'bye') {
      // Deliberate End session on the cam — pause WITHOUT alarming.
      camEnded = true;
      stopPeer();
      health.peer = false;
      health.frames = false;
      health.beacon = false;
      $('remote').srcObject = null; // black, not a misleading frozen frame
      set('s-peer', 'ended by the cam');
      if (monitoring) toggleMonitoring();
      headline();
    } else if (event === 'hello') {
      // Cam is streaming again — wake up and reconnect.
      camEnded = false;
      if (!monitoring) toggleMonitoring();
    }
  } catch (err) {
    set('s-peer', `signal err: ${err.message}`, 'bad');
  }
}

async function answer(sdp) {
  const g = ++gen;
  stopPeer();
  pc = new RTCPeerConnection({ iceServers: [] }); // host-only (D4)
  pc.ontrack = (e) => attach(e.streams[0]);
  pc.ondatachannel = (e) => {
    e.channel.onmessage = onBeacon;
  };
  pc.onicecandidate = (e) => {
    if (e.candidate) signal.send('ice', { candidate: e.candidate.toJSON() });
  };
  pc.onconnectionstatechange = () => {
    health.peer = pc.connectionState === 'connected';
    if (health.peer && !connectedAt) connectedAt = Date.now();
    if (!health.peer) connectedAt = 0;
    set('s-peer', pc.connectionState, health.peer ? 'ok' : '');
    headline();
  };

  await pc.setRemoteDescription(sdp);
  if (g !== gen) return; // superseded mid-await by a newer offer
  const localAnswer = await pc.createAnswer();
  if (g !== gen) return;
  await pc.setLocalDescription(localAnswer);
  if (g !== gen) return;
  signal.send('answer', { sdp: pc.localDescription.toJSON() });
  while (iceQueue.length) await addIce(iceQueue.shift());
}

function stopPeer() {
  iceQueue = [];
  prev = { frames: 0, bytes: 0 };
  connectedAt = 0;
  if (pc) {
    pc.onicecandidate = null;
    pc.onconnectionstatechange = null;
    pc.ontrack = null;
    pc.close();
    pc = null;
  }
}

async function addIce(candidate) {
  try {
    await pc.addIceCandidate(candidate);
  } catch {
    // Stale candidate from a torn-down generation — harmless.
  }
}

// Always the SAME <video> element — swapping elements would re-trigger
// autoplay policy without a gesture (SCOPE §4.2).
function attach(remoteStream) {
  const v = $('remote');
  if (v.srcObject !== remoteStream) v.srcObject = remoteStream;
  v.muted = !unmuted;
  v.play().catch(() => {
    if (unmuted) {
      // Unmuted resume was blocked (reload/reconnect edge) — fall back to
      // muted picture and ask for one tap rather than sit black.
      mute();
    }
  });
  if (!unmuted) $('unmute').hidden = false;
}

function unmute() {
  const v = $('remote');
  unmuted = true;
  v.muted = false;
  v.play().catch(() => {
    unmuted = false;
    v.muted = true;
  });
  $('unmute').hidden = true;
  $('soundbtn').classList.add('on');
}

function mute() {
  unmuted = false;
  const v = $('remote');
  v.muted = true;
  v.play().catch(() => {});
  $('unmute').hidden = false;
  $('soundbtn').classList.remove('on');
}

function onBeacon(e) {
  lastBeaconRx = Date.now();
  try {
    const b = JSON.parse(e.data);
    const pct = Math.min(100, b.level * 300);
    $('meterfill').style.width = `${pct}%`;
    $('chipfill').style.width = `${pct}%`;
    $('nsmeterfill').style.width = `${pct}%`;
    maxLevelSincePoll = Math.max(maxLevelSincePoll, b.level);
    // silently rescale with the cam's mic-boost setting.
    const boostNote = b.boost === false ? ' · MIC BOOST ASLEEP' : '';
    set(
      's-camstate',
      `${b.visible ? 'screen on' : 'SCREEN HIDDEN'} · ${b.wake ? 'staying awake' : 'MAY SLEEP'}${boostNote}`,
      b.visible && b.wake && b.boost !== false ? 'ok' : 'bad',
    );
  } catch {
    /* malformed beacon — ignore */
  }
}

function renderBeaconAge() {
  if (!lastBeaconRx) {
    health.beacon = false;
    set('s-beacon', '—');
    return;
  }
  const age = (Date.now() - lastBeaconRx) / 1000;
  health.beacon = age < 3;
  if (health.beacon) set('s-beacon', 'steady', 'ok');
  else set('s-beacon', `quiet for ${age.toFixed(0)}s`, 'bad');
  headline();
}

function renderUptime() {
  if (!connectedAt) {
    $('livechip').classList.remove('on');
    $('livetime').textContent = '—';
    return;
  }
  $('livechip').classList.add('on');
  const s = Math.floor((Date.now() - connectedAt) / 1000);
  const h = Math.floor(s / 3600);
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  $('livetime').textContent = `${h}:${m}:${ss}`;
}

function renderClock() {
  const d = new Date();
  $('nsclock').textContent = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// The watchdog's primary net: frames delta 0 while bytes flow = frozen
// decode; both 0 = network death. 1s cadence keeps D12 honest.
async function pollStats() {
  if (!pc) return;
  try {
    const stats = await pc.getStats();
    let frames = 0;
    let bytes = 0;
    stats.forEach((r) => {
      if (r.type === 'inbound-rtp' && r.kind === 'video') {
        frames = r.framesDecoded ?? 0;
        bytes = r.bytesReceived ?? 0;
      }
    });
    const df = frames - prev.frames;
    const db = bytes - prev.bytes;
    prev = { frames, bytes };
    health.frames = df > 0;
    if (df > 0) {
      set('s-stream', `flowing · ${Math.round(db / 1024)} kB/s`, 'ok');
    } else if (db > 0) set('s-stream', 'FROZEN — data arrives, no new frames', 'bad');
    else set('s-stream', 'NO DATA', 'bad');
    headline();
  } catch {
    /* stats fields are optional on WebKit — never let the poller throw */
  }
}

function pushHistory() {
  history.push({ t: Date.now(), lvl: maxLevelSincePoll });
  maxLevelSincePoll = 0;
  if (history.length > 900) history.shift();
  drawHistory();
}

// Canvas cannot read a CSS variable, so the token has to be resolved through
// the cascade by hand. Cached: this page is pinned to .night, so the answer
// never changes within a session.
let bar = '';
function barColour() {
  if (!bar) {
    bar = getComputedStyle(document.documentElement).getPropertyValue('--green-2').trim() || '#6fa97f';
  }
  return bar;
}

function drawHistory() {
  const c = $('history');
  const dpr = window.devicePixelRatio || 1;
  const w = c.clientWidth;
  if (!w) return;
  if (c.width !== w * dpr) {
    c.width = w * dpr;
    c.height = 64 * dpr;
  }
  const g = c.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, 64);
  const n = history.length;
  const step = w / 900;
  for (let i = 0; i < n; i++) {
    const h = Math.min(1, history[i].lvl * 3) * 56;
    const x = w - (n - i) * step;
    g.fillStyle = barColour();
    g.fillRect(x, 60 - h, Math.max(1, step - 0.5), h + 2);
  }
}

function headline() {
  const put = (dotCls, title, detail) => {
    $('dot').className = `dot ${dotCls}`;
    $('headline').textContent = title;
    $('subline').textContent = detail;
    $('subline').hidden = !detail;
    $('nsdot').className = `dot ${dotCls}`;
    $('nsstatus').textContent = title;
    if (dotCls !== 'well') showChrome(); // trouble is never hidden
  };
  const healthy = health.peer && health.frames && health.beacon;
  if (!live) {
    put('idle', 'Connecting…', 'Opening a line to the nursery.');
  } else if (!monitoring) {
    if (camEnded)
      put('idle', 'Baby phone ended the session', 'It reconnects by itself when the cam starts again.');
    else put('idle', 'Monitoring paused', 'Tap Resume monitoring when the cam is back.');
  } else if (healthy) {
    put('well', 'All is well', '');
  } else if (!health.peer && Date.now() - armAt > 8000 && sigReady) {
    put('warn', 'Baby phone not answering', 'Open Tomato Cam on the phone in the nursery.');
  } else if (!health.peer) {
    put('idle', 'Connecting…', 'Opening a line to the nursery.');
  } else if (!health.frames) {
    put('warn', 'Video has stalled', 'Reconnecting — check the baby phone if this stays red.');
  } else {
    put('warn', 'Lost touch with the baby phone', 'Reconnecting — check the baby phone if this stays red.');
  }
}
