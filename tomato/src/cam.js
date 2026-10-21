// Tomato Cam, baby unit.
// Crash-only shape: load → capture → wait for 'call' → offer. Every 'call'
// tears down the old peer and builds a fresh one, so a viewer reload
// recovers by simply calling again (SCOPE §4.3).
//
// The page is looked at once, while the phone is propped up, so everything it
// has to say sits on the preview: the code until a phone connects, then one
// line saying it worked, then black. It never dims while you still need the
// code, and once dimmed it stays dark even if the viewer drops, because a
// screen lighting up at 3am is its own way of waking the baby.
import { buildAudio } from './audio.js';
import { genCode } from './crypto.js';
import { isConfigured, openSignal } from './signal.js';
import { keepAwake } from './wake.js';

// 16:9 so the picture fills both phone screens; 540p@15 keeps the encode
// cool enough for all-night duty (SCOPE D3 — updated from 480p 4:3).
const VIDEO = {
  width: { ideal: 960 },
  height: { ideal: 540 },
  frameRate: { ideal: 15, max: 15 },
  facingMode: { ideal: 'environment' },
};
// noiseSuppression/echoCancellation off so faint baby sounds aren't gated
// away; AGC on so they're audible (SCOPE §4.1).
const AUDIO = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: true,
};
// Enough to hear breathing across a room without amplifying the aircon.
const BOOST = 2.5;
const DIM_AFTER = 30000;

const $ = (id) => document.getElementById(id);

let stream = null;
let audioChain = null;
let pc = null;
let dc = null;
let videoSender = null;
let signal = null;
let beaconTimer = null;
let wakeHeld = false;
let wakeWhy = '';
let iceQueue = [];
let pendingCall = false;
let lastCallAt = 0;
let recovering = false;
let stopped = false; // deliberate end (tab closed) — no auto-restart, no recover
let gen = 0; // peer generation — guards awaits against a superseding 'call'
let camBlocked = false;
let viewerOn = false;
let dimTimer = null;
// NOTE: this page must NEVER emit sound — Gabe's rule: nothing may wake
// the baby. No Audio(), no oscillators, no alert tones. Ever.

init();

async function init() {
  // Pairing code: shown here, typed once on the viewer. There is deliberately
  // no "new code" button — one stray tap used to strand the viewer for the
  // night on a code that no longer existed.
  const code = localStorage.getItem('bantay-pair2') || genCode();
  localStorage.setItem('bantay-pair2', code);
  [...document.querySelectorAll('#codebits span')].forEach((b, i) => {
    b.textContent = code[i];
  });

  $('night').onclick = undim;
  document.body.addEventListener('pointerdown', () => {
    if (!$('night').classList.contains('on')) scheduleDim();
    // A tap is also what iOS wants before it will keep the screen on or run
    // the mic boost; both retry on pointerdown, so re-render once they have.
    setTimeout(render, 400);
  });

  // Closing the tab IS ending the session. Saying goodbye on the way out means
  // the viewer shows "closed" (and stays quiet) rather than chiming about a
  // phone that was put away on purpose. pagehide, not unload — iOS ignores
  // unload. `persisted` means bfcache, i.e. maybe back in seconds: leave it.
  addEventListener('pagehide', (e) => {
    if (e.persisted) return;
    if (!stopped) endSession();
  });
  addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    undim();
    if (stopped || !stream) {
      stopped = false;
      startCapture();
    }
  });

  // Locking the phone or switching apps is NOT closing the tab: iOS just
  // freezes the page and the camera dies with it. Tell the viewer while we
  // still can, so it can say "went to sleep" instead of guessing. Best-effort:
  // the data channel is on the LAN and usually gets out before the freeze.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'hidden' || stopped) return;
    try {
      if (dc?.readyState === 'open') dc.send(JSON.stringify({ sleep: true }));
    } catch {
      /* the broadcast below is the second chance */
    }
    signal?.send('sleep', {});
  });

  keepAwake((held, why) => {
    wakeHeld = held;
    wakeWhy = why || '';
    render();
  });

  if (!isConfigured) {
    $('cfg').hidden = false;
  } else {
    signal = await openSignal(code, onSignal, () => {});
  }

  // M0 learning goal: does capture start with ZERO taps on this iOS version?
  // (Per-site Camera/Mic = Allow should make this succeed — SCOPE §7.)
  const auto = await startCapture();
  $('start').onclick = async () => {
    stopped = false;
    await startCapture();
  };
  if (!auto) render();

  // If the boost engine stays suspended while streaming, swap the sender
  // to the raw mic so audio keeps flowing (silent-boost failure net).
  let suspendedSince = 0;
  setInterval(() => {
    if (!pc || !audioChain) return;
    if (audioChain.running()) {
      suspendedSince = 0;
      return;
    }
    if (!suspendedSince) suspendedSince = Date.now();
    if (Date.now() - suspendedSince > 10000) {
      suspendedSince = 0;
      try {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'audio');
        const raw = stream?.getAudioTracks()[0];
        if (sender && raw && sender.track !== raw) sender.replaceTrack(raw);
      } catch {
        /* next interval retries */
      }
    }
  }, 2000);
  setInterval(render, 2000); // catches the boost engine waking up on its own
}

// ── What the screen says ──────────────────────────────────────────────────
// One function owns the panel so the states can never disagree with each
// other. In priority order: no camera, then no phone yet (show the code),
// then connected. "Tap once" rides along whenever iOS is still waiting for a
// touch before it will keep the screen on.
function render() {
  const needsTap = (!wakeHeld && wakeWhy !== 'unsupported') || (audioChain && !audioChain.running());
  const tip = $('p-tip');
  const msg = $('p-msg');
  $('start').hidden = !camBlocked;

  if (camBlocked) {
    $('p-code').hidden = true;
    show(msg, 'The camera is off. Tap Start camera.', 'warn');
    undim();
    return;
  }
  if (!viewerOn) {
    $('p-code').hidden = false;
    msg.hidden = true;
    tip.textContent = needsTap
      ? 'Tap the screen once so it stays awake.'
      : 'Keep this phone plugged in, and set Auto-Lock to Never.';
    tip.className = needsTap ? 'ptip warn' : 'ptip';
    return;
  }
  $('p-code').hidden = true;
  if (needsTap) show(msg, 'Tap the screen once so it stays awake.', 'warn');
  else show(msg, 'Connected to your phone', 'ok');
  // Still dims when iOS is refusing to keep the screen on (Low Power Mode):
  // a bright screen in a dark nursery is worse, and the dim screen carries
  // the same request in the dimmest type it has.
  $('nighttext').innerHTML = needsTap ? 'Tap to keep this screen awake' : 'Tomato Cam is on<br />Tap to check';
  if (!dimTimer && !$('night').classList.contains('on')) scheduleDim();
}

function show(el, text, tone) {
  el.hidden = false;
  el.textContent = text;
  el.className = tone;
}

// Dims only once a phone is watching, so never over the code you still need.
function scheduleDim() {
  clearTimeout(dimTimer);
  dimTimer = setTimeout(() => {
    dimTimer = null;
    if (viewerOn && !camBlocked) $('night').classList.add('on');
  }, DIM_AFTER);
}

function undim() {
  $('night').classList.remove('on');
  scheduleDim();
}

// ── Capture ───────────────────────────────────────────────────────────────
async function startCapture() {
  if (stream) return true; // double-tap guard — one capture, one chain
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: VIDEO, audio: AUDIO });
  } catch {
    camBlocked = true;
    render();
    return false;
  }
  camBlocked = false;
  $('preview').srcObject = stream;
  audioChain = buildAudio(stream, (level) => {
    $('meterfill').style.width = `${Math.min(100, level * 300)}%`;
  });
  audioChain.setGain(BOOST);
  for (const track of stream.getTracks()) {
    // iOS mutes/ends tracks with no unmute API (calls, Siri, route
    // changes). Zero-tap recovery: re-acquire while the per-site grant is
    // warm, then re-offer so the viewer picks up the new tracks (§4.3.1).
    // Every handler bails if the track was replaced by a newer capture —
    // stale timers must never tear down a healthy stream.
    const current = () => stream?.getTracks().includes(track);
    track.addEventListener('ended', () => {
      if (current()) recover();
    });
    track.addEventListener('mute', () => {
      if (!current()) return;
      setTimeout(() => {
        if (current() && track.muted && track.readyState === 'live') recover();
      }, 5000);
    });
  }
  signal?.send('hello', {}); // tells a viewer that saw 'bye' the cam is back
  if (pendingCall) {
    // A viewer called while capture was still starting — offer now.
    pendingCall = false;
    startPeer();
  }
  render();
  return true;
}

function endSession() {
  stopped = true;
  try {
    if (dc?.readyState === 'open') dc.send(JSON.stringify({ bye: true }));
  } catch {
    /* the sealed broadcast below is the reliable path */
  }
  signal?.send('bye', {});
  stopPeer();
  const old = stream;
  stream = null; // null first so track handlers see themselves as replaced
  audioChain?.dispose();
  audioChain = null;
  for (const t of old?.getTracks() ?? []) t.stop();
  $('preview').srcObject = null;
  camBlocked = true; // the Start camera button is the way back
  render();
}

// Crash-only self-heal: drop everything media, re-acquire, re-offer.
async function recover() {
  if (recovering || stopped) return;
  recovering = true;
  try {
    for (const t of stream?.getTracks() ?? []) t.stop();
  } catch {
    /* already dead */
  }
  audioChain?.dispose();
  audioChain = null;
  stream = null;
  const ok = await startCapture();
  recovering = false;
  if (ok) {
    startPeer(); // fresh offer; the viewer answers automatically
  } else {
    // Never one-shot: iOS often refuses getUserMedia right after a capture
    // failure (camera still held). Keep retrying; the button is offered too.
    setTimeout(() => recover(), 5000);
  }
}

// ── Signalling + peer ─────────────────────────────────────────────────────
async function onSignal(event, payload) {
  try {
    if (event === 'call') {
      if (stopped) {
        signal?.send('bye', {}); // still off — keep the viewer quiet
        return;
      }
      if (Date.now() - lastCallAt < 1000) return; // viewer double-tap debounce
      lastCallAt = Date.now();
      await startPeer();
    } else if (event === 'answer' && pc) {
      const g = gen;
      await pc.setRemoteDescription(payload.sdp);
      if (g !== gen) return; // superseded mid-await by a newer 'call'
      await flushIce();
      if (g !== gen) return;
      capBitrate();
    } else if (event === 'ice' && payload.candidate) {
      if (pc?.remoteDescription) await addIce(payload.candidate);
      else iceQueue.push(payload.candidate);
    }
  } catch {
    /* a bad message never takes the page down; the viewer redials */
  }
}

async function startPeer() {
  if (!stream) {
    pendingCall = true; // offer as soon as capture lands (startCapture drains this)
    return;
  }
  const g = ++gen;
  stopPeer();
  pc = new RTCPeerConnection({ iceServers: [] }); // host-only: LAN or nothing (D4)

  // Boosted audio when the audio engine is awake; raw mic otherwise.
  const useBoost = audioChain?.running();
  videoSender = pc.addTrack(stream.getVideoTracks()[0], stream);
  pc.addTrack(useBoost ? audioChain.boostedTrack() : stream.getAudioTracks()[0], stream);
  preferH264(pc);

  dc = pc.createDataChannel('beacon');
  dc.onopen = startBeacon;
  dc.onclose = stopBeacon;
  // The viewer talks back on the same channel. Today it only ever says one
  // thing: "video on" or "video off" for Audio only. Off means nothing is
  // encoded or sent at all, which is what keeps this phone cool overnight.
  dc.onmessage = (e) => {
    try {
      const m = JSON.parse(e.data);
      if (typeof m.video === 'boolean') setVideo(m.video);
    } catch {
      /* malformed — ignore */
    }
  };

  const peer = pc;
  pc.onicecandidate = (e) => {
    if (e.candidate) signal.send('ice', { candidate: e.candidate.toJSON() });
  };
  pc.onconnectionstatechange = () => {
    if (peer !== pc) return;
    viewerOn = pc.connectionState === 'connected';
    render();
  };

  const offer = await pc.createOffer();
  if (g !== gen) return; // superseded by a newer 'call'
  await pc.setLocalDescription(offer);
  if (g !== gen) return;
  signal.send('offer', { sdp: pc.localDescription.toJSON() });
}

function setVideo(on) {
  const track = on ? stream?.getVideoTracks()[0] : null;
  videoSender?.replaceTrack(track ?? null).catch(() => {});
}

function stopPeer() {
  stopBeacon();
  iceQueue = [];
  if (pc) {
    pc.onicecandidate = null;
    pc.onconnectionstatechange = null;
    pc.close();
    pc = null;
    dc = null;
    videoSender = null;
  }
  if (viewerOn) {
    viewerOn = false;
    render();
  }
}

async function flushIce() {
  while (iceQueue.length) await addIce(iceQueue.shift());
}

async function addIce(candidate) {
  try {
    await pc.addIceCandidate(candidate);
  } catch {
    // Stale candidate from a torn-down generation — harmless.
  }
}

// Pin hardware-encoded H.264 (D3). Safari↔Safari negotiates it anyway;
// belt-and-braces, so every step is fallible on purpose.
function preferH264(peer) {
  try {
    const caps = RTCRtpSender.getCapabilities?.('video');
    const tx = peer.getTransceivers().find((t) => t.sender?.track?.kind === 'video');
    if (!caps || !tx?.setCodecPreferences) return;
    const h264 = caps.codecs.filter((c) => /h264/i.test(c.mimeType));
    const rest = caps.codecs.filter((c) => !/h264/i.test(c.mimeType));
    if (h264.length) tx.setCodecPreferences([...h264, ...rest]);
  } catch {
    /* preference only */
  }
}

// Best-effort on iOS — support unverified, real control is the gUM
// constraints (SCOPE §4.1).
function capBitrate() {
  try {
    const params = videoSender.getParameters();
    if (!params.encodings?.length) params.encodings = [{}];
    params.encodings[0].maxBitrate = 600_000;
    params.degradationPreference = 'maintain-framerate';
    videoSender.setParameters(params).catch(() => {});
  } catch {
    /* best-effort */
  }
}

// 1s heartbeat over the LAN data channel: the viewer's proof of life, and
// the sound level for its meter.
function startBeacon() {
  stopBeacon();
  beaconTimer = setInterval(() => {
    if (dc?.readyState !== 'open') return;
    dc.send(JSON.stringify({ ts: Date.now(), level: audioChain?.level ?? 0 }));
  }, 1000);
}

function stopBeacon() {
  if (beaconTimer) clearInterval(beaconTimer);
  beaconTimer = null;
}
