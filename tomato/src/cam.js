// Bantay CAM (baby unit).
// Crash-only shape: load → capture → wait for 'call' → offer. Every 'call'
// tears down the old peer and builds a fresh one, so a viewer reload
// recovers by simply calling again (SCOPE §4.3).
import { buildAudio } from './audio.js';
import { genCode } from './crypto.js';
import { isConfigured, openSignal } from './signal.js';
import { wireFooter } from './build.js';
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

const $ = (id) => document.getElementById(id);
// The status table is gone — this page is meant to be looked at once, while
// you prop the phone up, and never again. The calls stay because they are the
// clearest record of what the machine thinks is happening; they simply have
// nowhere to paint now.
function set(id, text, tone = '') {
  const el = $(id);
  if (!el) return;
  el.textContent = text;
  el.className = tone;
}

let stream = null;
let audioChain = null;
// Enough to hear breathing across a room without amplifying the aircon.
// Was a three-way picker; nobody was ever going to change it mid-night.
const BOOST = 2.5;
let pc = null;
let dc = null;
let signal = null;
let beaconTimer = null;
let wakeHeld = false;
let iceQueue = [];
let pendingCall = false;
let lastCallAt = 0;
let recovering = false;
let stopped = false; // deliberate end (tab closed) — no auto-restart, no recover
let gen = 0; // peer generation — guards awaits against a superseding 'call'
const bootedAt = Date.now();
// NOTE: this page must NEVER emit sound — Gabe's rule: nothing may wake
// the baby. No Audio(), no oscillators, no alert tones. Ever.

init();

async function init() {
  // Pairing code: shown here, typed once on the viewer.
  const code = localStorage.getItem('bantay-pair2') || genCode();
  localStorage.setItem('bantay-pair2', code);
  [...document.querySelectorAll('#codebits span')].forEach((b, i) => {
    b.textContent = code[i];
  });
  $('newcode').onclick = () => {
    localStorage.setItem('bantay-pair2', genCode());
    location.reload();
  };

  // The screen dims itself. A phone propped in a cot-side chair should not
  // need anyone to remember a button, and a lit screen in a dark room is the
  // whole reason this mode exists. Capture keeps running underneath; a tap
  // brings the screen back and restarts the clock.
  const DIM_AFTER = 30000;
  let dimTimer = null;
  const dim = () => $('night').classList.add('on');
  const undim = () => {
    $('night').classList.remove('on');
    clearTimeout(dimTimer);
    dimTimer = setTimeout(dim, DIM_AFTER);
  };
  $('night').onclick = undim;
  document.body.addEventListener('pointerdown', () => {
    if (!$('night').classList.contains('on')) undim();
  });
  undim();

  // Closing the tab IS ending the session now that the button is gone. Saying
  // goodbye on the way out means the viewer shows "ended" rather than sitting
  // on a frozen frame wondering. pagehide, not unload — iOS ignores unload.
  //
  // But `persisted` has to be checked or this is a trap: tapping the masthead
  // to glance at the hub fires pagehide too, and ending the session there would
  // silently kill the monitor for the night. A persisted hide means the page is
  // going into the back/forward cache and may well be back in seconds, so it is
  // left running.
  addEventListener('pagehide', (e) => {
    if (e.persisted) return;
    if (!stopped) endSession();
  });

  // Coming back from the bfcache restores this module's state verbatim, so a
  // session that DID end stays ended and the page looks alive but is not.
  // Restart it rather than leaving a dead preview behind the dim overlay.
  addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    undim();
    if (stopped || !stream) {
      stopped = false;
      startCapture('restored');
    }
  });

  wireFooter();

  keepAwake((held, why) => {
    wakeHeld = held;
    set('s-wake', held ? 'will stay on' : `AT RISK (${why})`, held ? 'ok' : 'bad');
  });

  setInterval(() => {
    const s = Math.floor((Date.now() - bootedAt) / 1000);
    set('s-up', `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);
  }, 1000);

  if (!isConfigured) {
    $('cfg').hidden = false;
    set('s-sig', 'app config missing', 'bad');
  } else {
    signal = await openSignal(code, onSignal, (status) =>
      set('s-sig', status === 'SUBSCRIBED' ? 'ready' : status.toLowerCase(), status === 'SUBSCRIBED' ? 'ok' : ''),
    );
  }


  // Cloud dead-man beacon: lets the viewer tell "baby phone died" apart
  // from "home Wi-Fi broke" (SCOPE §4.2). Sealed like everything else.
  setInterval(() => {
    signal?.send('beacon', { ts: Date.now(), up: Date.now() - bootedAt });
  }, 15000);

  // M0 learning goal: does capture start with ZERO taps on this iOS version?
  // (Per-site Camera/Mic = Allow should make this succeed — SCOPE §7.)
  const auto = await startCapture('zero-tap');
  const btn = $('start');
  btn.onclick = async () => {
    stopped = false;
    if (await startCapture('tapped')) {
      btn.hidden = true;
    }
  };
  if (!auto) btn.hidden = false;

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
        if (sender && raw && sender.track !== raw) {
          sender.replaceTrack(raw);
          set('s-boost', 'engine asleep — sent raw mic instead', 'bad');
        }
      } catch {
        /* next interval retries */
      }
    }
  }, 2000);
}

async function startCapture(how) {
  if (stream) return true; // double-tap guard — one capture, one chain
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: VIDEO, audio: AUDIO });
  } catch (err) {
    set('s-cam', `blocked: ${err.name}`, 'bad');
    return false;
  }
  $('preview').srcObject = stream;
  audioChain = buildAudio(stream, (level) => {
    $('meterfill').style.width = `${Math.min(100, level * 300)}%`;
  });
  audioChain.setGain(BOOST);
  set('s-cam', `watching (${how})`, 'ok');
  for (const track of stream.getTracks()) {
    // iOS mutes/ends tracks with no unmute API (calls, Siri, route
    // changes). Zero-tap recovery: re-acquire while the per-site grant is
    // warm, then re-offer so the viewer picks up the new tracks (§4.3.1).
    // Every handler bails if the track was replaced by a newer capture —
    // stale timers must never tear down a healthy stream.
    const current = () => stream?.getTracks().includes(track);
    track.addEventListener('ended', () => {
      if (current()) recover(`${track.kind} ended`);
    });
    track.addEventListener('mute', () => {
      if (!current()) return;
      set('s-cam', `${track.kind} muted by iOS`, 'bad');
      setTimeout(() => {
        if (current() && track.muted && track.readyState === 'live')
          recover(`${track.kind} stayed muted`);
      }, 5000);
    });
    track.addEventListener('unmute', () => {
      if (current()) set('s-cam', `watching (${how})`, 'ok');
    });
  }
  signal?.send('hello', {}); // wakes a paused viewer — it auto-resumes
  if (pendingCall) {
    // A viewer called while capture was still starting — offer now.
    pendingCall = false;
    startPeer();
  }
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
  set('s-cam', 'ended — tap Start camera to stream again', 'bad');
  set('s-peer', 'ended');
  $('start').hidden = false;
}

// Crash-only self-heal: drop everything media, re-acquire, re-offer.
async function recover(why) {
  if (recovering || stopped) return;
  recovering = true;
  set('s-cam', `restarting camera (${why})…`, 'bad');
  try {
    for (const t of stream?.getTracks() ?? []) t.stop();
  } catch {
    /* already dead */
  }
  audioChain?.dispose();
  audioChain = null;
  stream = null;
  const ok = await startCapture('auto-recover');
  recovering = false;
  if (ok) {
    startPeer(); // fresh offer; the viewer answers automatically
  } else {
    // Never one-shot: iOS often refuses getUserMedia right after a capture
    // failure (camera still held). Keep retrying; offer the button too.
    set('s-cam', 'camera unavailable — retrying in 5s', 'bad');
    $('start').hidden = false;
    setTimeout(() => recover('retry'), 5000);
  }
}

async function onSignal(event, payload) {
  try {
    if (event === 'call') {
      if (stopped) {
        signal?.send('bye', {}); // still off — remind the viewer not to alarm
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
  } catch (err) {
    set('s-peer', `signal err: ${err.message}`, 'bad');
  }
}

async function startPeer() {
  if (!stream) {
    pendingCall = true; // offer as soon as capture lands (startCapture drains this)
    set('s-peer', 'camera not ready yet', 'bad');
    return;
  }
  const g = ++gen;
  stopPeer();
  pc = new RTCPeerConnection({ iceServers: [] }); // host-only: LAN or nothing (D4)

  // Boosted audio when the audio engine is awake; raw mic otherwise.
  const useBoost = audioChain?.running();
  pc.addTrack(stream.getVideoTracks()[0], stream);
  pc.addTrack(useBoost ? audioChain.boostedTrack() : stream.getAudioTracks()[0], stream);
  set('s-boost', useBoost ? 'on' : 'off — tap this screen, then Reconnect on your phone', useBoost ? 'ok' : 'bad');
  preferH264(pc);

  dc = pc.createDataChannel('beacon');
  dc.onopen = startBeacon;
  dc.onclose = stopBeacon; // display only — onclose is untrustworthy (SCOPE §4.2)

  pc.onicecandidate = (e) => {
    if (e.candidate) signal.send('ice', { candidate: e.candidate.toJSON() });
  };
  pc.onconnectionstatechange = () =>
    set('s-peer', pc.connectionState, pc.connectionState === 'connected' ? 'ok' : '');

  const offer = await pc.createOffer();
  if (g !== gen) return; // superseded by a newer 'call'
  await pc.setLocalDescription(offer);
  if (g !== gen) return;
  signal.send('offer', { sdp: pc.localDescription.toJSON() });
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
// constraints (SCOPE §4.1). Verified empirically via outbound-rtp in soaks.
function capBitrate() {
  try {
    const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
    const params = sender.getParameters();
    if (!params.encodings?.length) params.encodings = [{}];
    params.encodings[0].maxBitrate = 600_000;
    params.degradationPreference = 'maintain-framerate';
    sender.setParameters(params).catch(() => {});
  } catch {
    /* best-effort */
  }
}

function startBeacon() {
  stopBeacon();
  beaconTimer = setInterval(() => {
    if (dc?.readyState !== 'open') return;
    dc.send(
      JSON.stringify({
        ts: Date.now(),
        level: audioChain?.level ?? 0,
        raw: audioChain?.rawLevel ?? 0,
        boost: audioChain?.running() ?? false,
        wake: wakeHeld,
        visible: document.visibilityState === 'visible',
      }),
    );
  }, 1000);
  set('s-beacon', 'sending', 'ok');
}

function stopBeacon() {
  if (beaconTimer) clearInterval(beaconTimer);
  beaconTimer = null;
  set('s-beacon', 'stopped', 'bad');
}
