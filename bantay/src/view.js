// Bantay VIEW (parent unit).
// Opens straight into the muted live picture (muted autoplay needs no
// gesture); the one tap that matters is "Tap for sound". No alarm yet:
// this renders the truth the M2 watchdog will alarm on (SCOPE §4.2).
import { formatCode, normalizeCode } from './crypto.js';
import { isConfigured, openSignal } from './signal.js';
import { initUpdate } from './update.js';
import { keepAwake } from './wake.js';

const $ = (id) => document.getElementById(id);
function set(id, text, tone = '') {
  const el = $(id);
  el.textContent = text;
  el.className = tone;
}

let pc = null;
let signal = null;
let armed = false;
let armAt = 0;
let sigReady = false;
let unmuted = false;
let iceQueue = [];
let lastBeaconRx = 0;
let gen = 0; // peer generation — guards awaits against a superseding offer
let prev = { frames: 0, bytes: 0 };
let connectedAt = 0;
let zenTimer = null;
const health = { peer: false, frames: false, beacon: false };

boot();

function boot() {
  initUpdate($('update'), $('version'));

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
      $('gate').hidden = true;
      input.blur();
      start(v);
    }
  });
  $('codeboxes').addEventListener('click', () => input.focus());
}

async function start(code) {
  $('app').hidden = false;
  $('pairedas').textContent = formatCode(code);

  keepAwake((held, why) =>
    set('s-wake', held ? 'will stay on' : `AT RISK (${why})`, held ? 'ok' : 'bad'),
  );

  signal = await openSignal(code, onSignal, (status) => {
    sigReady = status === 'SUBSCRIBED';
    set('s-sig', sigReady ? 'ready' : status.toLowerCase(), sigReady ? 'ok' : '');
    if (sigReady && !health.peer) call(); // dial the moment the line is open
  });

  armed = true;
  armAt = Date.now();

  $('unmute').onclick = unmute;
  $('soundbtn').onclick = () => (unmuted ? mute() : unmute());
  $('recallbtn').onclick = call;
  wireFit();
  wirePip();
  wireZen();

  setInterval(renderBeaconAge, 500);
  setInterval(pollStats, 2000);
  setInterval(renderUptime, 1000);
  // Self-healing by default: keep dialing while there's no live peer.
  setInterval(() => {
    if (armed && !health.peer && sigReady) call();
  }, 8000);
  headline();
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
    v.autoPictureInPicture = true; // float automatically on app switch, like FaceTime
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
  if (!armed) return;
  try {
    if (event === 'offer') {
      await answer(payload.sdp);
    } else if (event === 'ice' && payload.candidate) {
      if (pc?.remoteDescription) await addIce(payload.candidate);
      else iceQueue.push(payload.candidate);
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
    set(
      's-camstate',
      `${b.visible ? 'screen on' : 'SCREEN HIDDEN'} · ${b.wake ? 'staying awake' : 'MAY SLEEP'}`,
      b.visible && b.wake ? 'ok' : 'bad',
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

// The M2 watchdog's primary net, rendered as visible truth for now:
// frames delta 0 while bytes flow = frozen decode; both 0 = network death.
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
    if (df > 0) set('s-stream', `flowing · ${Math.round(db / 1024 / 2)} kB/s`, 'ok');
    else if (db > 0) set('s-stream', 'FROZEN — data arrives, no new frames', 'bad');
    else set('s-stream', 'NO DATA', 'bad');
    headline();
  } catch {
    /* stats fields are optional on WebKit — never let the poller throw */
  }
}

function headline() {
  const h = $('headline');
  const sub = $('subline');
  const dot = $('dot');
  const put = (dotCls, title, detail) => {
    dot.className = `dot ${dotCls}`;
    h.textContent = title;
    sub.textContent = detail;
    sub.hidden = !detail;
    if (dotCls !== 'well') showChrome(); // trouble is never hidden
  };
  if (!armed) put('idle', 'Connecting…', 'Opening a line to the nursery.');
  else if (!health.peer && Date.now() - armAt > 8000 && sigReady)
    put('warn', 'Baby phone not answering', 'Open Bantay on the phone in the nursery.');
  else if (!health.peer) put('idle', 'Connecting…', 'Opening a line to the nursery.');
  else if (health.frames && health.beacon) put('well', 'All is well', '');
  else if (!health.frames) put('warn', 'Video has stalled', 'Reconnecting — check the baby phone if this stays red.');
  else put('warn', 'Lost touch with the baby phone', 'Reconnecting — check the baby phone if this stays red.');
}
