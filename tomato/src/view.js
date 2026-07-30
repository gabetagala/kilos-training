// Tomato Cam VIEW (parent unit) — the monitor.
// Opens straight into the muted live picture; one tap for sound. The
// watchdog + alarm (SCOPE §4.2) live here: trouble chirps at ~5s and
// sirens at ~15s (clocked from actual stream death) until dismissed.
// Gentle alarms escalate to Loud after 45s unanswered. The cam phone
// NEVER makes a sound.
import { alarmSound } from './alarm.js';
import { formatCode, normalizeCode } from './crypto.js';
import { isConfigured, openSignal } from './signal.js';
import { initUpdate } from './update.js';
import { keepAwake } from './wake.js';
import { startWatchdog } from './watchdog.js';

const $ = (id) => document.getElementById(id);
function set(id, text, tone = '') {
  const el = $(id);
  el.textContent = text;
  el.className = tone;
}

const NOISE_THRESHOLDS = { low: 0.2, med: 0.12, high: 0.06 };
const CRY_COOLDOWN_MS = 30000;
const ESCALATE_AFTER_MS = 45000; // gentle alarm unanswered → loud

let pc = null;
let signal = null;
let armed = false;
let armAt = 0;
let sigReady = false;
let unmuted = false;
let iceQueue = [];
let lastBeaconRx = 0;
let lastCloudBeacon = 0;
let lastFramesOkAt = 0;
let gen = 0; // peer generation — guards awaits against a superseding offer
let prev = { frames: 0, bytes: 0 };
let connectedAt = 0;
let everConnected = false;
let monitoring = true;
let zenTimer = null;
let wd = null;
let wdState = 'ok';
let wdSnoozeUntil = 0;
let escalated = false;
let gapNoticeUntil = 0;
let noiseSetting = localStorage.getItem('bantay-noise') || 'med';
let alarmStyle = localStorage.getItem('bantay-alarmstyle') || 'gentle';
let recentLevels = [];
let maxLevelSincePoll = 0;
let lastCryAt = 0;
let cryUntil = 0;
const history = []; // {t, lvl, cry} every 2s, capped at 30 min
const health = { peer: false, frames: false, beacon: false };

boot();

function boot() {
  initUpdate($('update'), $('version'));
  alarmSound.init();

  if (!isConfigured) {
    $('cfg').hidden = false;
    return;
  }

  // Every tap is a chance to (re)arm and to revive a suspended context
  // after an iOS interruption. pointerup/click carry user activation on
  // touch (pointerdown alone may not).
  for (const evt of ['pointerup', 'click', 'pointerdown']) {
    document.addEventListener(evt, () => alarmSound.poke().then(renderArmState), {
      passive: true,
    });
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      alarmSound.poke().then(renderArmState);
    }
  });

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

  keepAwake((held, why) => {
    set('s-wake', held ? 'will stay on' : `AT RISK (${why})`, held ? 'ok' : 'bad');
    // Seconds of runway before the screen actually sleeps — use them.
    if (!held && why === 'released' && everConnected) alarmSound.chirp();
  });

  signal = await openSignal(code, onSignal, (status) => {
    sigReady = status === 'SUBSCRIBED';
    set('s-sig', sigReady ? 'ready' : status.toLowerCase(), sigReady ? 'ok' : '');
    if (sigReady && !health.peer && monitoring) call(); // dial as soon as the line opens
  });

  armed = true;
  armAt = Date.now();

  $('unmute').onclick = unmute;
  $('soundbtn').onclick = () => (unmuted ? mute() : unmute());
  $('recallbtn').onclick = call;
  $('testbtn').onclick = () => alarmSound.test(2500);
  $('pausebtn').onclick = toggleMonitoring;
  $('armov').addEventListener('pointerup', () => {
    alarmSound.bless().then(renderArmState);
  });
  alarmSound.setStyle(alarmStyle);
  wireAlarmStyle();
  wireNoise();
  wireNightstand();
  wireFit();
  wirePip();
  wireZen();
  renderArmState();

  wd = startWatchdog({
    isHealthy: () => health.peer && health.frames && health.beacon,
    everConnected: () => everConnected && monitoring,
    lastGoodAt: () => Math.max(lastBeaconRx, lastFramesOkAt),
    sound: alarmSound,
    onRender: renderWatchdog,
    onGap: (gap) => {
      // Timers were frozen (backgrounded tab / PiP) — say so and re-check.
      gapNoticeUntil = Date.now() + 8000;
      if (everConnected && monitoring) alarmSound.chirp();
      headline();
    },
  });
  $('alarmov').addEventListener('click', (e) => {
    if (e.target.closest('#alarmstop')) return;
    wd.dismiss();
  });
  $('alarmstop').onclick = () => {
    if (monitoring) toggleMonitoring();
  };

  setInterval(renderBeaconAge, 500);
  setInterval(pollStats, 1000); // 1s — detection lag eats the D12 budget
  setInterval(pushHistory, 2000);
  setInterval(renderUptime, 1000);
  setInterval(renderClock, 1000);
  // Self-healing by default: keep dialing while there's no live peer.
  setInterval(() => {
    if (armed && monitoring && !health.peer && sigReady) call();
  }, 8000);
  headline();
}

function toggleMonitoring() {
  monitoring = !monitoring;
  $('pausebtn').textContent = monitoring ? 'Pause monitoring' : 'Resume monitoring';
  if (monitoring) {
    everConnected = false; // re-arm on the next successful connection
    call();
  }
  headline();
}

function renderArmState() {
  const isArmed = alarmSound.isArmed();
  const card = $('alertscard');
  card.classList.toggle('armed', isArmed);
  card.classList.toggle('unarmed', !isArmed);
  $('armlbl').textContent = isArmed ? 'Alerts armed' : 'Alerts are off';
  $('armhint').textContent = isArmed
    ? 'Keep media volume up — the alarm is only as loud as your volume.'
    : 'Tap anywhere once to arm them.';
  $('testbtn').hidden = !isArmed;
  // The arm overlay is the un-missable version of the same fact — shown
  // after unattended reloads until one tap re-blesses the audio (§4.3.5).
  $('armov').classList.toggle('on', !isArmed && armed);
  $('nshint').textContent = isArmed
    ? 'Sound stays on · alarm armed · tap to exit'
    : 'ALERTS NOT ARMED — tap once';
}

function wireAlarmStyle() {
  for (const btn of document.querySelectorAll('#styleseg button')) {
    if (btn.dataset.s === alarmStyle) btn.classList.add('on');
    btn.onclick = () => {
      for (const b of document.querySelectorAll('#styleseg button')) b.classList.remove('on');
      btn.classList.add('on');
      alarmStyle = btn.dataset.s;
      localStorage.setItem('bantay-alarmstyle', alarmStyle);
      escalated = false;
      alarmSound.setStyle(alarmStyle);
    };
  }
}

function wireNoise() {
  for (const btn of document.querySelectorAll('#noiseseg button')) {
    if (btn.dataset.n === noiseSetting) btn.classList.add('on');
    btn.onclick = () => {
      for (const b of document.querySelectorAll('#noiseseg button')) b.classList.remove('on');
      btn.classList.add('on');
      noiseSetting = btn.dataset.n;
      localStorage.setItem('bantay-noise', noiseSetting);
    };
  }
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
  if (!armed) return;
  try {
    if (event === 'offer') {
      if (!monitoring) return; // paused — don't answer
      await answer(payload.sdp);
    } else if (event === 'ice' && payload.candidate) {
      if (pc?.remoteDescription) await addIce(payload.candidate);
      else iceQueue.push(payload.candidate);
    } else if (event === 'beacon') {
      lastCloudBeacon = Date.now(); // cam is alive, whatever the P2P path says
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
    if (health.peer) everConnected = true;
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
    // Cry detection uses the pre-boost level so sensitivity doesn't
    // silently rescale with the cam's mic-boost setting.
    evalCry(b.raw ?? b.level);
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

// Cry alert: sustained sound above the chosen sensitivity → gentle chime
// (viewer-side only, of course) with a 30s cooldown.
function evalCry(level) {
  if (noiseSetting === 'off') return;
  const thr = NOISE_THRESHOLDS[noiseSetting] ?? 0.12;
  recentLevels.push(level);
  if (recentLevels.length > 5) recentLevels.shift();
  const loud = recentLevels.filter((l) => l >= thr).length;
  if (loud >= 3 && Date.now() - lastCryAt > CRY_COOLDOWN_MS) {
    lastCryAt = Date.now();
    cryUntil = Date.now() + 6000;
    recentLevels = [];
    alarmSound.chime();
    const idx = history.length - 1;
    if (idx >= 0) history[idx].cry = true;
    showChrome();
    headline();
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
      lastFramesOkAt = Date.now();
      set('s-stream', `flowing · ${Math.round(db / 1024)} kB/s`, 'ok');
    } else if (db > 0) set('s-stream', 'FROZEN — data arrives, no new frames', 'bad');
    else set('s-stream', 'NO DATA', 'bad');
    headline();
  } catch {
    /* stats fields are optional on WebKit — never let the poller throw */
  }
}

function pushHistory() {
  history.push({ t: Date.now(), lvl: maxLevelSincePoll, cry: false });
  maxLevelSincePoll = 0;
  if (history.length > 900) history.shift();
  drawHistory();
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
    g.fillStyle = history[i].cry ? '#E23A1E' : '#3A7D44';
    g.fillRect(x, 60 - h, Math.max(1, step - 0.5), h + 2);
  }
}

function reasonText() {
  const cloudFresh = lastCloudBeacon && Date.now() - lastCloudBeacon < 40000;
  if (!sigReady && !health.peer) return 'Internet is down — can’t reach the baby phone.';
  if (!health.peer && cloudFresh) return 'Home Wi-Fi problem — the baby phone is alive but unreachable.';
  if (!health.peer) return 'The baby phone stopped — go check it.';
  if (!health.frames) return 'The video froze.';
  return 'Lost the sound of the room.';
}

function renderWatchdog(state, unhealthySince, snoozeUntil) {
  wdState = state;
  wdSnoozeUntil = snoozeUntil;
  const ov = $('alarmov');
  if (state === 'alarming') {
    // Gentle alarms that go unanswered become loud — calm, not riskier.
    // Siren starts ~15s after death; +45s unanswered = escalate at ~60s.
    if (!escalated && alarmStyle === 'gentle' && Date.now() - unhealthySince > 15000 + ESCALATE_AFTER_MS) {
      escalated = true;
      alarmSound.setStyle('loud');
    }
    $('alarmwhy').textContent = reasonText();
    ov.classList.toggle('loud', alarmStyle === 'loud' || escalated);
    ov.classList.add('on');
  } else {
    ov.classList.remove('on');
    if (escalated && state === 'ok') {
      escalated = false;
      alarmSound.setStyle(alarmStyle);
    }
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
  if (!armed) {
    put('idle', 'Connecting…', 'Opening a line to the nursery.');
  } else if (!monitoring) {
    put('idle', 'Monitoring paused', 'Tap Resume monitoring when the cam is back.');
  } else if (wdState === 'snoozed') {
    const left = Math.max(0, Math.ceil((wdSnoozeUntil - Date.now()) / 1000));
    put('warn', 'Alarm silenced', `Re-alerts in ${left}s if still down.`);
  } else if (healthy) {
    if (Date.now() < cryUntil) put('well', 'Sound in the nursery', 'The room is loud right now.');
    else if (Date.now() < gapNoticeUntil)
      put('well', 'All is well', 'Monitoring paused briefly while the app was in the background.');
    else put('well', 'All is well', '');
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
