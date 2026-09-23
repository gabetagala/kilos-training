#!/usr/bin/env node
// ─── Brian coach-clip generator (ElevenLabs) ─────────────────────────────────
// The player's coach voice is ElevenLabs premade "Brian" — every spoken word
// must come from the same voice (iOS silences the speechSynthesis fallback
// mid-session, so a phrase without a clip is effectively mute on iPhone).
// This script generates any missing coach lines as Brian clips and installs
// them in public/voice/<slug>.m4a, matched to the existing pack's profile:
// hard-trimmed (no lead silence, ~30ms tail), peak-normalized to 0.89,
// AAC 48kHz mono via macOS afconvert (no ffmpeg dependency).
//
// Phrase list = every word src/workout/announce.js can put in a cue (exercise
// names, the numbers 1–50, the units) + the milestone pushes + every line in
// src/workout/formCues.js. scripts/verify-voice.mjs proves the pack covers
// the program; this script is how a miss gets filled. Identical texts are
// generated once and copied to each slug, saving credits.
//
// Usage:
//   node scripts/generate-voice.mjs [--only slug[,slug]] [--force] [--dry-run]
//   ELEVENLABS_API_KEY from env or .env.local (gitignored).

import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HOTMUM_EXERCISES } from '../src/hotmum/program.js';
import { NUM_SLUGS, SEC_SLUGS } from '../src/hotmum/cues.js';
import { numberSlug } from '../src/workout/announce.js';
import { FORM_CUES } from '../src/workout/formCues.js';
import { PROGRAM_EXERCISES } from '../src/workout/program.js';
import { REHAB_EXERCISES } from '../src/workout/rehab.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PACKS = {
  kilos: { voice: 'brian', dir: 'voice' },
  hotmum: { voice: 'alice', dir: 'voice-hotmum' },
};
const WORK = join(tmpdir(), 'kilos-voice-gen');
mkdirSync(WORK, { recursive: true });

// ElevenLabs premade voices — global ids, identical for every account.
// Both are DEFAULT voices, so they work on the free plan; the British
// "library" voices (Dorothy, Charlotte) return 402 without a paid plan.
const VOICES = {
  brian: 'nPczCjzI2devNBz1zQrb', // KILOS — Gabe's coach
  alice: 'Xb7hH8MSUJpSbSDYk0k2', // HOTMUM — Sam's coach, British, composed
};
const MODEL = 'eleven_multilingual_v2';
const TARGET_PEAK = 0.89; // matches the measured existing pack
const TAIL_PAD_S = 0.03;
// ── THE RAMBLE GUARD (2026-09-23, his report: "lateral raise and band pull
// aparts has like a garbled shin na rsoun de asroyn") ───────────────────────
// Asked for a single word, a TTS model sometimes answers with the word, a
// pause, and then invented speech — "Twelve" came back 2.13s long with a
// second utterance glued on. Nobody listens to 244 clips, so it shipped, and
// the player faithfully played the ramble mid-set. Two defences, because
// either alone leaks: CUT the clip at the first real gap when the phrase is
// short enough to be gapless, and REJECT a take that is still far longer
// than its words justify, trying again for a clean one.
const GAP_CUT_S = 0.18; // a pause this long inside a short phrase is a tell
const GAP_CUT_MAX_CHARS = 16; // "Forty-seven" yes, a coaching sentence no
const TAKES = 3;
// What the words should take to say, generously: a lead-in plus per-character
// time. Only wrong by a factor, which is all the guard needs.
const expectedSecs = (text) => 0.25 + 0.085 * text.length;

// ── the phrase list ──────────────────────────────────────────────────────────
const MILESTONES = {
  'last-three': 'Last three',
  'last-one': 'Last one',
  'last-set': 'Last set',
  halfway: 'Halfway',
  // The spoken prescription (2026-08-12): "ten reps — go". Numbers the
  // program prescribes that the original packs lacked, plus the connectors.
  reps: 'Reps',
  twelve: 'Twelve',
  fourteen: 'Fourteen',
  fifteen: 'Fifteen',
  twenty: 'Twenty',
  seconds: 'Seconds',
  forty: 'Forty',
  'forty-five': 'Forty-five',
  'each-side': 'Each side',
};
// Exercise names as SPOKEN: "DB" is "dumbbell" out loud, "&" is "and",
// "90/90" is "ninety-ninety", and "QL" gets spelled.
const speakName = (name) =>
  name
    .replace(/\bDB\b/g, 'Dumbbell')
    .replace(/&/g, 'and')
    .replace(/90\/90/g, 'Ninety-ninety')
    .replace(/\bQL\b/g, 'Q-L');
function kilosPhrases() {
  const out = { ...MILESTONES };
  // one … fifty: rep counts (a death-by ladder climbs to 46), seconds, and
  // the hold-set positions — every number announce.js can resolve to a slug
  for (let n = 1; n <= 50; n++) {
    const w = numberSlug(n);
    out[w] = w[0].toUpperCase() + w.slice(1);
  }
  out.length = 'length';
  out.lengths = 'lengths';
  for (const [id, ex] of Object.entries({
    ...REHAB_EXERCISES,
    ...PROGRAM_EXERCISES,
  })) {
    out[`name-${id}`] = speakName(ex.name);
  }
  for (const cues of Object.values(FORM_CUES)) {
    for (const { slug, text } of cues) out[slug] = text;
  }
  return out;
}

// HOTMUM speaks a smaller, tighter set: the tempo beat words and rep numbers
// (src/workout/tempoCues.js decides which fires when), the step transitions the
// player emits, and one clip per exercise so a prep step announces what's next.
function hotmumPhrases() {
  const out = {
    'get-set': 'Get set',
    go: 'Go',
    rest: 'Rest',
    breathe: 'Breathe',
    'switch-sides': 'Switch sides',
    // Movement words, chosen to match what the body does: you go DOWN and UP
    // in a squat, OUT and BACK in a dead bug (src/hotmum/cues.js).
    up: 'Up',
    down: 'Down',
    out: 'Out',
    back: 'Back',
    squeeze: 'Squeeze',
    hold: 'Hold',
    lift: 'Lift',
    lower: 'Lower',
    'last-three': 'Last three',
    'last-one': 'Last one',
    'session-complete': 'Session complete. Nice work.',
  };
  // one … TWENTY — the rep number is the only thing spoken during a set now
  // (src/hotmum/cues.js), and her sets run to twenty reps.
  const nums = NUM_SLUGS.filter(Boolean);
  for (const n of nums) out[n] = n[0].toUpperCase() + n.slice(1);
  // "Six reps." / "Thirty seconds." — a set is announced as a sentence now
  // (src/hotmum/cues.js setAnnounce), so the units and the hold lengths need
  // clips of their own.
  for (const w of Object.values(SEC_SLUGS)) {
    out[w] = w[0].toUpperCase() + w.slice(1);
  }
  // Lowercase on purpose: these two land mid-sentence ("Six reps."), and the
  // capitalised form reads to the model as the start of one.
  out.reps = 'reps';
  out.seconds = 'seconds';
  for (const [id, ex] of Object.entries(HOTMUM_EXERCISES)) out[`name-${id}`] = ex.name;
  return out;
}

// ── args ─────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : d;
};
const ONLY = opt('only', '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const FORCE = flag('force');
const DRY = flag('dry-run');
const PACK = opt('pack', 'kilos');
if (!PACKS[PACK]) {
  console.error(`Unknown --pack ${PACK}. Try: ${Object.keys(PACKS).join(', ')}`);
  process.exit(1);
}
const VOICE_NAME = PACKS[PACK].voice;
const VOICE_ID = VOICES[VOICE_NAME];
const OUT_DIR = join(ROOT, 'public', PACKS[PACK].dir);
mkdirSync(OUT_DIR, { recursive: true });
const PHRASES = PACK === 'hotmum' ? hotmumPhrases() : kilosPhrases();

function apiKey() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY;
  const envFile = join(ROOT, '.env.local');
  if (existsSync(envFile)) {
    const m = readFileSync(envFile, 'utf8').match(/^ELEVENLABS_API_KEY=(.+)$/m);
    if (m) return m[1].trim();
  }
  return null;
}

// Em dashes are typography, not speech — read them as a short comma pause.
const speechText = (t) => t.replace(/\s*—\s*/g, ', ').replace(/\s+/g, ' ');

async function ttsMp3(key, text) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: speechText(text),
          model_id: MODEL,
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      },
    );
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    console.warn(
      `  ⚠ HTTP ${res.status} (attempt ${attempt}): ${(await res.text()).slice(0, 160)}`,
    );
    if (res.status === 401 || res.status === 403) break;
    if (attempt < 3) await new Promise((r) => setTimeout(r, attempt * 3000));
  }
  return null;
}

// ── wav-level processing: trim to signal, peak-normalize, re-encode ──────────
// CoreAudio wavs are NOT canonical 44-byte-header files (afconvert adds an
// FLLR padding chunk), so walk the RIFF chunks to find the real data range
// and write a fresh canonical header on the way out.
function findChunk(b, id) {
  let off = 12;
  while (off + 8 <= b.length) {
    const cid = b.toString('ascii', off, off + 4);
    const size = b.readUInt32LE(off + 4);
    if (cid === id) return b.subarray(off + 8, off + 8 + size);
    off += 8 + size + (size & 1);
  }
  return null;
}
function canonicalWav(pcm) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write('WAVE', 8);
  h.write('fmt ', 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); // PCM
  h.writeUInt16LE(1, 22); // mono
  h.writeUInt32LE(48000, 24);
  h.writeUInt32LE(48000 * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}
function trimAndLevel(wavIn, wavOut, { cutAtGap = false } = {}) {
  const b = readFileSync(wavIn);
  const data = findChunk(b, 'data');
  if (!data) return null;
  const n = data.length >> 1;
  const gapSamples = Math.round(GAP_CUT_S * 48000);
  let peak = 0;
  let first = -1;
  let last = -1;
  let firstRunEnd = -1; // last loud sample before the first real gap
  let quiet = 0;
  for (let i = 0; i < n; i++) {
    const v = Math.abs(data.readInt16LE(i * 2)) / 32768;
    if (v > peak) peak = v;
    if (v > 0.012) {
      if (first < 0) first = i;
      last = i;
      quiet = 0;
    } else if (first >= 0) {
      quiet += 1;
      if (firstRunEnd < 0 && quiet >= gapSamples) firstRunEnd = last;
    }
  }
  if (first < 0 || peak === 0) return null; // silence — API returned junk
  const end = cutAtGap && firstRunEnd > 0 ? firstRunEnd : last;
  const tail = Math.min(n, end + Math.round(TAIL_PAD_S * 48000));
  const gain = TARGET_PEAK / peak;
  const outN = tail - first;
  const cut = end < last; // a ramble was trimmed off the back
  const pcm = Buffer.alloc(outN * 2);
  for (let i = 0; i < outN; i++) {
    const v = data.readInt16LE((first + i) * 2) * gain;
    pcm.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(v))), i * 2);
  }
  writeFileSync(wavOut, canonicalWav(pcm));
  return { seconds: outN / 48000, peakBefore: peak, cut };
}

const afconvert = (...a) => execFileSync('afconvert', a, { stdio: 'pipe' });

async function generateSlug(key, slug, mp3, text) {
  const mp3Path = join(WORK, `${slug}.mp3`);
  const rawWav = join(WORK, `${slug}.raw.wav`);
  const cutWav = join(WORK, `${slug}.cut.wav`);
  writeFileSync(mp3Path, mp3);
  afconvert(mp3Path, '-f', 'WAVE', '-d', 'LEI16@48000', '-c', '1', rawWav);
  const info = trimAndLevel(rawWav, cutWav, {
    cutAtGap: (text || '').length <= GAP_CUT_MAX_CHARS,
  });
  if (!info) return null;
  const outPath = join(OUT_DIR, `${slug}.m4a`);
  afconvert(cutWav, '-f', 'm4af', '-d', 'aac', '-b', '64000', outPath);
  return info;
}

// ── main ─────────────────────────────────────────────────────────────────────
const targets = Object.keys(PHRASES).filter((slug) => {
  if (ONLY.length) return ONLY.includes(slug);
  return FORCE || !existsSync(join(OUT_DIR, `${slug}.m4a`));
});
if (!targets.length) {
  console.log('Nothing to generate — every phrase has a clip. (--force to redo)');
  process.exit(0);
}
console.log(
  `${DRY ? '[dry-run] would generate' : 'Generating'} ${targets.length} ${VOICE_NAME} clip(s) → public/${PACKS[PACK].dir}/:`,
);
for (const slug of targets) console.log(`  ${slug} — “${PHRASES[slug]}”`);
if (DRY) process.exit(0);

const key = apiKey();
if (!key) {
  console.error('No ELEVENLABS_API_KEY (env or .env.local).');
  process.exit(1);
}

// generate each unique text once; copy to duplicate slugs
const byText = new Map(); // speech text → first generated slug
const failures = [];
for (const slug of targets) {
  const text = speechText(PHRASES[slug]);
  const doneSlug = byText.get(text);
  if (doneSlug && existsSync(join(OUT_DIR, `${doneSlug}.m4a`))) {
    copyFileSync(join(OUT_DIR, `${doneSlug}.m4a`), join(OUT_DIR, `${slug}.m4a`));
    console.log(`  = ${slug}.m4a (copy of ${doneSlug})`);
    continue;
  }
  // Up to TAKES attempts, keeping the first take whose length the words
  // justify. A model that rambles once usually behaves on the next roll, and
  // the cut above handles the rest.
  const budget = expectedSecs(text);
  let info = null;
  let note = '';
  for (let take = 1; take <= TAKES; take++) {
    const mp3 = await ttsMp3(key, PHRASES[slug]);
    if (!mp3) continue;
    const got = await generateSlug(key, slug, mp3, text);
    if (!got) continue;
    if (!info || got.seconds < info.seconds) info = got;
    if (got.seconds <= budget) break;
    note = ` — take ${take} ran ${got.seconds.toFixed(2)}s vs ~${budget.toFixed(2)}s`;
    if (take < TAKES) console.warn(`  ↻ ${slug}${note}, retrying`);
  }
  if (!info) {
    failures.push(slug);
    console.warn(`  ✗ ${slug} — no usable take`);
    continue;
  }
  if (info.seconds > budget * 1.6) {
    failures.push(slug);
    console.warn(
      `  ✗ ${slug} — every take rambled (${info.seconds.toFixed(2)}s vs ~${budget.toFixed(2)}s); clip left in place for a human ear`,
    );
    continue;
  }
  byText.set(text, slug);
  console.log(
    `  ✓ ${slug}.m4a (${info.seconds.toFixed(2)}s${info.cut ? ', ramble cut' : ''})`,
  );
}

if (failures.length) {
  console.warn(`\nFailed: ${failures.join(', ')}`);
  process.exitCode = 1;
} else {
  console.log(`\nAll clips installed in public/${PACKS[PACK].dir}/.`);
}
