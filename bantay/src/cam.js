// Bantay CAM (baby unit).
// Crash-only shape: load → capture → wait for 'call' → offer. Every 'call'
// tears down the old peer and builds a fresh one, so a viewer reload
// recovers by simply calling again (SCOPE §4.3).
import { buildAudio } from './audio.js';
import { formatCode, genCode } from './crypto.js';
import { isConfigured, openSignal } from './signal.js';
import { initUpdate } from './update.js';
import { keepAwake } from './wake.js';

const VIDEO = {
  width: { ideal: 640 },
  height: { ideal: 480 },
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
function set(id, text, tone = '') {
  const el = $(id);
  el.textContent = text;
  el.className = tone;
}

let stream = null;
let audioChain = null;
let pc = null;
let dc = null;
let signal = null;
let beaconTimer = null;
let wakeHeld = false;
let iceQueue = [];
let pendingCall = false;
let lastCallAt = 0;
let gen = 0; // peer generation — guards awaits against a superseding 'call'
const bootedAt = Date.now();

init();

async function init() {
  // Pairing code: shown here, typed once on the viewer.
  const code = localStorage.getItem('bantay-pair') || genCode();
  localStorage.setItem('bantay-pair', code);
  $('code').textContent = formatCode(code);
  $('newcode').onclick = () => {
    localStorage.setItem('bantay-pair', genCode());
    location.reload();
  };

  initUpdate($('update'), $('version'));

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

  initBoost();

  // M0 learning goal: does capture start with ZERO taps on this iOS version?
  // (Per-site Camera/Mic = Allow should make this succeed — SCOPE §7.)
  const auto = await startCapture('zero-tap');
  if (!auto) {
    const btn = $('start');
    btn.hidden = false;
    btn.onclick = async () => {
      if (await startCapture('tapped')) btn.hidden = true;
    };
  }
}

function initBoost() {
  const saved = localStorage.getItem('bantay-boost') || '2.5';
  for (const btn of document.querySelectorAll('#boostseg button')) {
    if (btn.dataset.g === saved) btn.classList.add('on');
    btn.onclick = () => {
      for (const b of document.querySelectorAll('#boostseg button')) b.classList.remove('on');
      btn.classList.add('on');
      localStorage.setItem('bantay-boost', btn.dataset.g);
      audioChain?.setGain(Number(btn.dataset.g));
    };
  }
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
  audioChain.setGain(Number(localStorage.getItem('bantay-boost') || '2.5'));
  set('s-cam', `watching (${how})`, 'ok');
  for (const track of stream.getTracks()) {
    // iOS mutes/ends tracks with no unmute API (calls, Siri, route changes).
    // M0 shows the truth; M1 adds silent re-acquisition (SCOPE §4.3.1).
    track.addEventListener('ended', () => set('s-cam', `${track.kind} ENDED`, 'bad'));
    track.addEventListener('mute', () => set('s-cam', `${track.kind} muted by iOS`, 'bad'));
    track.addEventListener('unmute', () => set('s-cam', `watching (${how})`, 'ok'));
  }
  if (pendingCall) {
    // A viewer called while capture was still starting — offer now.
    pendingCall = false;
    startPeer();
  }
  return true;
}

async function onSignal(event, payload) {
  try {
    if (event === 'call') {
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
    params.encodings[0].maxBitrate = 400_000;
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
