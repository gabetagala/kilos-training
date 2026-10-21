// Tomato Cam, parent unit.
// Opens straight into the muted live picture; one tap for sound, one tap for
// Audio only (black screen, sound keeps playing, video off on both phones).
//
// It makes exactly one sound of its own: a soft two-note chime, on THIS phone
// only, when a baby phone that was connected stops sending. Never when the cam
// was closed on purpose (it says goodbye first), never before the first
// connection, and calm about repeating: 5s in, again at a minute, then every
// five minutes. The baby phone itself never makes a sound.
import { formatCode, normalizeCode } from './crypto.js';
import { isConfigured, openSignal } from './signal.js';
import { keepAwake } from './wake.js';

const $ = (id) => document.getElementById(id);

const FIND_FOR = 10000; // never connected for this long → say why
const CHIME_AT = [5000, 60000]; // first chimes, measured from going down
const CHIME_EVERY = 300000; // after that
const GRACE_ON_RETURN = 12000; // this phone was locked; let it reconnect first

let pc = null;
let dc = null;
let signal = null;
let code = '';
let live = false;
let startedAt = 0;
let sigReady = false;
let unmuted = false;
let audioOnly = false;
let iceQueue = [];
let lastBeaconRx = 0;
let gen = 0; // peer generation — guards awaits against a superseding offer
let prev = { frames: 0, packets: 0 };
let connectedAt = 0;
let everConnected = false;
let camEnded = false; // the cam said goodbye: closed on purpose
let camAsleep = false; // the cam said it was going into the background
let zenTimer = null;
let downSince = 0;
let chimes = 0;
let graceUntil = 0;
let actx = null;
const health = { peer: false, media: false, beacon: false };

boot();

function boot() {
  if (!isConfigured) {
    $('cfg').hidden = false;
    return;
  }
  wireGate();
  $('changecode').onclick = forgetCode;
  $('fixcode').onclick = forgetCode;

  const stored = localStorage.getItem('bantay-pair2');
  if (stored?.length === 6) start(stored);
  else $('gate').hidden = false;
}

function forgetCode() {
  localStorage.removeItem('bantay-pair2');
  location.reload();
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

async function start(c) {
  code = c;
  startedAt = Date.now();
  $('app').hidden = false;
  $('pairedas').textContent = formatCode(c);

  keepAwake(() => {});
  // The first touch anywhere is what iOS needs before the chime can play.
  document.addEventListener('pointerdown', unlockChime, { passive: true });
  // Back from the bfcache (e.g. tapped the masthead, then Back): the peer is
  // long dead, so start clean rather than resurrect a half-alive page.
  addEventListener('pageshow', (e) => {
    if (e.persisted) location.reload();
  });
  // This phone was locked or in another app. Its own connection probably died
  // with it, so give it a moment to redial before deciding the cam is gone.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    graceUntil = Date.now() + GRACE_ON_RETURN;
    if (!health.peer && sigReady) call();
  });

  signal = await openSignal(c, onSignal, (status) => {
    sigReady = status === 'SUBSCRIBED';
    if (sigReady && !health.peer) call(); // dial as soon as the line opens
    headline();
  });
  live = true;

  $('soundbtn').onclick = () => (unmuted ? mute() : unmute());
  $('audiobtn').onclick = enterAudioOnly;
  $('videobtn').onclick = exitAudioOnly;
  wireFit();
  wirePip();
  wireZen();

  setInterval(renderBeaconAge, 500);
  setInterval(pollStats, 1000);
  setInterval(renderUptime, 1000);
  setInterval(renderClock, 1000);
  setInterval(checkChime, 1000);
  // Self-healing: keep dialing while there's no live peer. A cam that was
  // closed answers with 'bye', so this stays quiet; one that comes back with
  // its 'hello' lost still gets found within 8s.
  setInterval(() => {
    if (live && !health.peer && sigReady) call();
  }, 8000);
  renderClock();
  headline();
}

// ── Sound ─────────────────────────────────────────────────────────────────
// 'playback' tells iOS this page is like music: it plays through the silent
// switch, and it is iOS's best reason to keep the page going when you leave
// Safari or lock the phone. Set once sound is wanted, not before, so opening
// the monitor muted never interrupts a podcast.
function wantPlayback() {
  try {
    if (navigator.audioSession) navigator.audioSession.type = 'playback';
  } catch {
    /* older iOS: no Audio Session API */
  }
  if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: 'Tomato Cam',
        artist: 'Listening to the nursery',
        artwork: [{ src: '/tomatito-icon-512.png', sizes: '512x512', type: 'image/png' }],
      });
    } catch {
      /* lock-screen label is a nicety */
    }
  }
}

function unmute() {
  wantPlayback();
  const v = $('remote');
  unmuted = true;
  v.muted = false;
  v.play().catch(() => {
    unmuted = false;
    v.muted = true;
    paintSound();
  });
  paintSound();
}

function mute() {
  unmuted = false;
  const v = $('remote');
  v.muted = true;
  v.play().catch(() => {});
  paintSound();
}

function paintSound() {
  const b = $('soundbtn');
  b.classList.toggle('sound-on', unmuted);
  b.classList.toggle('call', !unmuted);
  $('soundlbl').textContent = unmuted ? 'Sound on' : 'Tap for sound';
}

// ── Audio only ────────────────────────────────────────────────────────────
function enterAudioOnly() {
  audioOnly = true;
  if (!unmuted) unmute(); // audio only with the sound off would be nothing
  sendMode();
  $('listen').classList.add('on');
  headline();
}

function exitAudioOnly() {
  audioOnly = false;
  sendMode();
  $('listen').classList.remove('on');
  showChrome();
  headline();
}

// Tells the cam whether to send video. Re-sent on every new connection, so a
// reconnect in the middle of the night stays audio only.
function sendMode() {
  try {
    if (dc?.readyState === 'open') dc.send(JSON.stringify({ video: !audioOnly }));
  } catch {
    /* next connection re-sends */
  }
}

// ── The chime ─────────────────────────────────────────────────────────────
function unlockChime() {
  if (!actx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    actx = new Ctx();
  }
  if (actx.state !== 'running') actx.resume().catch(() => {});
}

// Two soft sine notes, falling: a doorbell heard from the next room, not an
// alarm. Quiet on purpose — it only has to be noticed by someone nearby.
function chime() {
  if (!actx) return;
  if (actx.state !== 'running') actx.resume().catch(() => {});
  const t0 = actx.currentTime + 0.05;
  for (const [freq, dt] of [
    [659.25, 0],
    [523.25, 0.34],
  ]) {
    const osc = actx.createOscillator();
    const gain = actx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t0 + dt);
    gain.gain.exponentialRampToValueAtTime(0.2, t0 + dt + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + 0.9);
    osc.connect(gain).connect(actx.destination);
    osc.start(t0 + dt);
    osc.stop(t0 + dt + 1);
  }
}

function checkChime() {
  const healthy = health.peer && health.media && health.beacon;
  if (healthy || !everConnected || camEnded) {
    downSince = 0;
    chimes = 0;
    return;
  }
  if (Date.now() < graceUntil) return;
  if (!downSince) downSince = Date.now();
  const due = chimes < CHIME_AT.length ? CHIME_AT[chimes] : CHIME_AT.at(-1) + CHIME_EVERY * (chimes - CHIME_AT.length + 1);
  if (Date.now() - downSince >= due) {
    chimes++;
    chime();
  }
}

// ── Signalling + peer ─────────────────────────────────────────────────────
function call() {
  signal?.send('call', {});
}

async function onSignal(event, payload) {
  if (!live) return;
  try {
    if (event === 'offer') {
      camEnded = false;
      await answer(payload.sdp);
    } else if (event === 'ice' && payload.candidate) {
      if (pc?.remoteDescription) await addIce(payload.candidate);
      else iceQueue.push(payload.candidate);
    } else if (event === 'bye') {
      camClosed();
    } else if (event === 'hello') {
      camEnded = false;
      camAsleep = false;
      call();
    } else if (event === 'sleep') {
      camAsleep = true;
      headline();
    }
  } catch {
    /* a bad message never takes the page down; the redial loop recovers */
  }
}

// Closed on purpose: black, not a misleading frozen frame, and no chime.
function camClosed() {
  camEnded = true;
  stopPeer();
  health.peer = false;
  health.media = false;
  health.beacon = false;
  $('remote').srcObject = null;
  headline();
}

async function answer(sdp) {
  const g = ++gen;
  stopPeer();
  pc = new RTCPeerConnection({ iceServers: [] }); // host-only (D4)
  const peer = pc;
  pc.ontrack = (e) => attach(e.streams[0]);
  pc.ondatachannel = (e) => {
    dc = e.channel;
    dc.onmessage = onCamMessage;
    dc.onopen = sendMode;
    if (dc.readyState === 'open') sendMode();
  };
  pc.onicecandidate = (e) => {
    if (e.candidate) signal.send('ice', { candidate: e.candidate.toJSON() });
  };
  pc.onconnectionstatechange = () => {
    if (peer !== pc) return;
    health.peer = pc.connectionState === 'connected';
    if (health.peer) {
      everConnected = true;
      camEnded = false;
      if (!connectedAt) connectedAt = Date.now();
    } else {
      connectedAt = 0;
    }
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
  prev = { frames: 0, packets: 0 };
  connectedAt = 0;
  dc = null;
  if (pc) {
    pc.onicecandidate = null;
    pc.onconnectionstatechange = null;
    pc.ontrack = null;
    pc.ondatachannel = null;
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
    // Unmuted resume was blocked (reload/reconnect edge): fall back to the
    // muted picture and ask for one tap rather than sit black.
    if (unmuted) mute();
  });
}

// The cam's 1s heartbeat, plus the two things it may announce on the way out.
function onCamMessage(e) {
  let m;
  try {
    m = JSON.parse(e.data);
  } catch {
    return;
  }
  if (m.bye) return camClosed();
  if (m.sleep) {
    camAsleep = true;
    return headline();
  }
  lastBeaconRx = Date.now();
  camAsleep = false;
  const pct = `${Math.min(100, (m.level ?? 0) * 300)}%`;
  $('chipfill').style.width = pct;
  $('lsmeterfill').style.width = pct;
}

// ── Health ────────────────────────────────────────────────────────────────
function renderBeaconAge() {
  health.beacon = !!lastBeaconRx && Date.now() - lastBeaconRx < 3000;
  headline();
}

// Video mode: new frames decoded = alive. Audio only: no frames are sent at
// all, so the proof is audio packets arriving instead.
async function pollStats() {
  if (!pc) {
    health.media = false;
    return;
  }
  try {
    const stats = await pc.getStats();
    let frames = 0;
    let packets = 0;
    stats.forEach((r) => {
      if (r.type !== 'inbound-rtp') return;
      if (r.kind === 'video') frames = r.framesDecoded ?? 0;
      if (r.kind === 'audio') packets = r.packetsReceived ?? 0;
    });
    const df = frames - prev.frames;
    const dp = packets - prev.packets;
    prev = { frames, packets };
    health.media = audioOnly ? dp > 0 : df > 0;
    headline();
  } catch {
    /* stats fields are optional on WebKit — never let the poller throw */
  }
}

function renderUptime() {
  // Only says LIVE when it is: a grey "LIVE" over a black screen was a lie.
  $('livechip').hidden = !connectedAt;
  if (!connectedAt) return;
  $('livechip').classList.add('on');
  const s = Math.floor((Date.now() - connectedAt) / 1000);
  const h = Math.floor(s / 3600);
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  $('livetime').textContent = `${h}:${m}:${ss}`;
}

function renderClock() {
  const d = new Date();
  $('lsclock').textContent = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// One function decides what the screen says, so the picture, the Audio only
// screen and the chime can never disagree.
function headline() {
  const healthy = health.peer && health.media && health.beacon;
  let state;
  if (!live) state = ['idle', 'Connecting', 'Finding the baby phone.'];
  else if (camEnded) state = ['idle', 'Baby phone closed the cam', 'Open Tomato Cam on it to start again.'];
  else if (healthy) state = ['well', 'All is well', ''];
  else if (!everConnected) {
    const waited = Date.now() - startedAt > FIND_FOR;
    if (!waited) state = ['idle', 'Connecting', 'Finding the baby phone.'];
    else if (!sigReady) state = ['warn', "Can't connect", 'Check this phone is online.'];
    else state = ['warn', "Can't find the baby phone", `Check it shows ${formatCode(code).replace(' ', '\u00a0')}.`, true];
  } else if (camAsleep) state = ['warn', 'Baby phone went to sleep', 'Wake it and open Tomato Cam.'];
  // No heartbeat means the phone itself has gone quiet (dead, killed, off
  // Wi-Fi), whatever the connection still claims. Only a phone that IS still
  // talking but has stopped sending picture or sound gets the "froze" line.
  else if (!health.peer || !health.beacon) state = ['warn', 'Lost the baby phone', 'Trying again. Check it is on Wi-Fi.'];
  else state = ['warn', audioOnly ? 'Sound stopped coming through' : 'The picture froze', 'Trying again.'];

  const [tone, title, detail, offerFix] = state;
  $('dot').className = `dot ${tone}`;
  $('headline').textContent = title;
  $('subline').textContent = detail;
  $('subline').hidden = !detail;
  $('fixcode').hidden = !offerFix;
  $('lsdot').className = `dot ${tone}`;
  $('lsstatus').textContent = healthy ? 'Listening' : title;
  $('lssub').textContent = healthy ? '' : detail;
  if (tone !== 'well') showChrome(); // trouble is never hidden
}

// ── Picture chrome ────────────────────────────────────────────────────────
// Portrait cam: fill the screen. Landscape cam: show all of it, letterboxed,
// rather than crop the cot out of frame.
function wireFit() {
  const v = $('remote');
  const fit = () => {
    v.style.objectFit = v.videoWidth > v.videoHeight ? 'contain' : 'cover';
  };
  v.addEventListener('resize', fit);
  v.addEventListener('loadedmetadata', fit);
}

// Picture-in-Picture: the FaceTime-style floating video while you use other
// apps. Best-effort: if iOS reclaims the backgrounded tab, PiP dies with it.
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
      /* not available until video is playing */
    }
  };
}

// Chrome fades off the picture after a calm 6s; any tap brings it back.
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
    if (health.peer && health.media && health.beacon) $('stage').classList.add('zen');
  }, 6000);
}
