// HOTMUM — Alice's voice, built for iOS.
//
// WHY THIS EXISTS. The first version used `new Audio(src)` per phrase. On a
// Mac that's fine; on an iPhone it clips and drops out, for three reasons:
//
//   1. Safari won't start media that isn't traced to a user gesture. The first
//      clip after a tap plays; the ones fired from a rAF loop a minute later
//      are throttled or silently refused.
//   2. Each `new Audio()` re-opens the file. The load latency lands mid-beat,
//      so the word arrives late or gets cut when the next beat interrupts it.
//   3. `pause()`-then-`play()` on a fresh element is exactly the sequence
//      Safari clips the head off.
//
// So: ONE AudioContext, unlocked by a real tap (the GO button), every clip
// decoded ONCE into a buffer, and playback via BufferSource — which starts
// sample-accurate, costs nothing, and is never subject to the autoplay gate
// after the context is running. Beats land on time and nothing gets cut.

const DIR = '/voice-hotmum/';

let ctx = null;
let gain = null;
let current = null;
let queued = null;
let unlocked = false;
const buffers = new Map(); // slug → AudioBuffer | null (null = known missing)

const Ctor = () => window.AudioContext || window.webkitAudioContext;

function context() {
  if (!ctx && Ctor()) {
    ctx = new (Ctor())();
    gain = ctx.createGain();
    gain.connect(ctx.destination);
  }
  return ctx;
}

/**
 * Call from a REAL user gesture (the GO/START tap). Resumes the context and
 * pushes a silent buffer through it, which is what actually flips Safari's
 * "this page may make noise" bit for the rest of the session.
 */
export async function unlock() {
  const c = context();
  if (!c) return false;
  try {
    if (c.state === 'suspended') await c.resume();
    if (!unlocked) {
      const s = c.createBufferSource();
      s.buffer = c.createBuffer(1, 1, 22050);
      s.connect(gain);
      s.start(0);
      unlocked = true;
    }
    return true;
  } catch {
    return false;
  }
}

/** iOS suspends the context whenever the app is backgrounded. */
export function resumeIfNeeded() {
  if (ctx?.state === 'suspended') ctx.resume().catch(() => {});
}

async function load(slug) {
  if (buffers.has(slug)) return buffers.get(slug);
  const c = context();
  if (!c) return null;
  try {
    const res = await fetch(`${DIR}${slug}.m4a`);
    if (!res.ok) throw new Error(String(res.status));
    const buf = await c.decodeAudioData(await res.arrayBuffer());
    buffers.set(slug, buf);
    return buf;
  } catch {
    buffers.set(slug, null); // remember the miss; never re-fetch
    return null;
  }
}

/**
 * Warm the cache before the work starts. Decoding mid-set is what makes a beat
 * arrive late, so a session pays that cost up front, in the prep step.
 */
export function preload(slugs) {
  for (const s of slugs) load(s);
}

function start(buf) {
  const c = context();
  if (!buf || !c) return;
  if (current) {
    try {
      current.stop();
    } catch {
      /* already ended */
    }
    current = null;
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  src.connect(gain);
  src.onended = () => {
    if (current === src) current = null;
    const next = queued;
    queued = null;
    if (next) speak(next);
  };
  src.start();
  current = src;
}

/** Say it now, cutting off whatever is mid-word. Beats are time-critical. */
export function speak(slug) {
  if (!slug) return;
  queued = null;
  const cached = buffers.get(slug);
  if (cached) return start(cached);
  if (cached === null && buffers.has(slug)) return; // known missing
  load(slug).then(start); // first time only — after this it's instant
}

/** Say it after the current clip — "get set" then the exercise name. */
export function speakAfter(slug) {
  if (!slug) return;
  if (current) queued = slug;
  else speak(slug);
}

/** A step change makes a pending phrase wrong, not late. */
export function hush() {
  queued = null;
}

export function setMuted(muted) {
  if (gain) gain.gain.value = muted ? 0 : 1;
}
