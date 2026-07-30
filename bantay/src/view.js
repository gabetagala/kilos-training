// Bantay VIEW (parent unit) — M0 spike.
// No alarm yet: M0 renders the raw truth the M2 watchdog will alarm on —
// framesDecoded deltas, beacon age, connection state (SCOPE §4.2).
import { isConfigured, openSignal } from './signal.js';
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
let unmuted = false;
let iceQueue = [];
let lastBeaconRx = 0;
let gen = 0; // peer generation — guards awaits against a superseding offer
let prev = { frames: 0, bytes: 0 };

init();

function init() {
  keepAwake((held, why) =>
    set('s-wake', held ? 'held' : `LOST (${why})`, held ? 'ok' : 'bad'),
  );

  if (!isConfigured) {
    $('cfg').hidden = false;
    set('s-sig', 'env vars missing', 'bad');
    return;
  }
  signal = openSignal(onSignal, (status) =>
    set('s-sig', status.toLowerCase(), status === 'SUBSCRIBED' ? 'ok' : ''),
  );

  $('startBtn').onclick = start;
  $('unmute').onclick = unmute;
  $('recall').onclick = call;

  setInterval(renderBeaconAge, 500);
  setInterval(pollStats, 2000);
}

function start() {
  armed = true;
  // Bless the media element + audio pipeline inside the one real gesture —
  // everything after this must survive without a fresh tap (SCOPE §4.2).
  $('remote').play().catch(() => {});
  $('startBtn').hidden = true;
  $('recall').hidden = false;
  call();
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
  pc.onconnectionstatechange = () =>
    set('s-peer', pc.connectionState, pc.connectionState === 'connected' ? 'ok' : '');

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
    // Stale candidate from a torn-down generation — harmless in M0.
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
      unmuted = false;
      v.muted = true;
      v.play().catch(() => {});
      $('unmute').hidden = false;
    }
  });
  if (!unmuted) $('unmute').hidden = false;
}

function unmute() {
  const v = $('remote');
  unmuted = true;
  v.muted = false;
  v.play().catch((err) => set('s-stream', `unmute failed: ${err.name}`, 'bad'));
  $('unmute').hidden = true;
}

function onBeacon(e) {
  lastBeaconRx = Date.now();
  try {
    const b = JSON.parse(e.data);
    $('meterfill').style.width = `${Math.min(100, b.level * 300)}%`;
    set(
      's-camstate',
      `${b.visible ? 'visible' : 'HIDDEN'} · wake ${b.wake ? 'held' : 'LOST'}`,
      b.visible && b.wake ? 'ok' : 'bad',
    );
  } catch {
    /* malformed beacon — ignore */
  }
}

function renderBeaconAge() {
  if (!lastBeaconRx) {
    set('s-beacon', '—');
    return;
  }
  const age = (Date.now() - lastBeaconRx) / 1000;
  if (age < 3) set('s-beacon', 'live (1 Hz)', 'ok');
  else set('s-beacon', `STALE ${age.toFixed(0)}s`, 'bad');
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
    if (df > 0) set('s-stream', `+${df} frames · +${Math.round(db / 1024)} kB / 2s`, 'ok');
    else if (db > 0) set('s-stream', 'FROZEN — bytes flow, no frames', 'bad');
    else set('s-stream', 'NO DATA', 'bad');
  } catch {
    /* stats fields are optional on WebKit — never let the poller throw */
  }
}
