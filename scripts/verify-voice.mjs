// Standing audit of the coach's voice: every cue the player can speak, in
// either coach level, across every reachable session queue, must have a clip
// in public/voice/. iOS throttles speechSynthesis mid-session, so a cue with
// no clip is a cue that never lands on the iPhone — "sometimes it doesn't say
// the workout" (2026-09-16).
//
//   node scripts/verify-voice.mjs
//
// Exits non-zero on any miss. Fix = `node scripts/generate-voice.mjs`, which
// ships the missing phrase in the same voice as the rest of the pack.

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TTS_ONLY, announceCue } from '../src/workout/announce.js';
import {
  BLOCK_WEEKS,
  applyFormats,
  applyPhase,
  phaseOf,
  phaseSwaps,
} from '../src/workout/block.js';
import { FORM_CUES } from '../src/workout/formCues.js';
import {
  BENCHMARK_SESSIONS,
  PROGRAM_EXERCISES,
  WEEK_PLAN,
  getProgramSession,
} from '../src/workout/program.js';
import {
  REHAB_EXERCISES,
  REHAB_SESSIONS,
  buildStepQueue,
  getRehabSession,
  nextWorkLabel,
  sessionVariantCount,
} from '../src/workout/rehab.js';
import { NUM_SLUGS } from '../src/workout/tempoCues.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const EXERCISES = { ...REHAB_EXERCISES, ...PROGRAM_EXERCISES };
const CLIPS = new Set(
  readdirSync(join(ROOT, 'public', 'voice')).map((f) =>
    f.replace(/\.[^.]+$/, ''),
  ),
);

// Same enumeration as verify-program.mjs: the calendar-pinned rehab variant
// model must match rehabVariantIdx in main.js.
const REHAB_DAY_SLOT = { 2: 0, 4: 1, 6: 2 };
function* allQueues() {
  for (let w = 1; w <= BLOCK_WEEKS; w++) {
    const ph = phaseOf(w);
    const sw = phaseSwaps(ph);
    for (let d = 0; d < 7; d++) {
      for (const item of WEEK_PLAN[d]) {
        let s = null;
        let v = 0;
        if (item.type === 'lift') {
          s = applyFormats(applyPhase(getProgramSession(item.session), ph), w);
          v = sessionVariantCount(s) > 1 ? w - 1 : 0;
        } else if (item.type === 'rehab') {
          s = getRehabSession(item.session || 'daily');
          if (s && sessionVariantCount(s) > 1) {
            v =
              s.id === 'daily'
                ? (w - 1) * 4 + (REHAB_DAY_SLOT[d] ?? 0)
                : w - 1;
          }
        }
        if (!s) continue;
        yield { label: `week ${w} day ${d} ${s.id} v${v}`, q: buildStepQueue(s, sw, v) };
      }
    }
  }
  for (const b of BENCHMARK_SESSIONS) {
    yield { label: `benchmark ${b.id}`, q: buildStepQueue(b, {}, 0) };
  }
  for (const s of REHAB_SESSIONS) {
    for (let v = 0; v < Math.max(1, sessionVariantCount(s)); v++) {
      yield { label: `${s.id} v${v}`, q: buildStepQueue(s, {}, v) };
    }
  }
}

// The words the tick loop and coach lines speak outside announceCue.
const STATIC = [
  'go',
  'hold',
  'rest',
  'lift',
  'squeeze',
  'lower',
  'last-three',
  'last-one',
  'halfway',
  'session-complete',
  ...NUM_SLUGS.slice(1), // 'zero' is index padding — never a beat
];

const missing = new Map(); // slug → { n, where: Set }
const miss = (slug, where) => {
  const e = missing.get(slug) || { n: 0, where: new Set() };
  e.n += 1;
  if (e.where.size < 3) e.where.add(where);
  missing.set(slug, e);
};
for (const slug of STATIC) if (!CLIPS.has(slug)) miss(slug, 'tick loop');
for (const cues of Object.values(FORM_CUES)) {
  for (const c of cues) if (!CLIPS.has(c.slug)) miss(c.slug, 'form cue');
}

let queues = 0;
let cues = 0;
for (const { label, q } of allQueues()) {
  queues += 1;
  q.forEach((step, i) => {
    for (const minimal of [true, false]) {
      const cue = announceCue(q, i, {
        minimal,
        exercises: EXERCISES,
        nextWorkLabel,
      });
      if (!cue) continue;
      cues += 1;
      for (const p of cue.parts) {
        if (p === TTS_ONLY || !CLIPS.has(p)) {
          miss(
            p,
            `${label} #${i} ${step.kind}/${step.phase}/${step.exId} → "${cue.text}"`,
          );
        }
      }
    }
  });
}

// ── THE RAMBLE GUARD (2026-09-23) ──────────────────────────────────────────
// A clip can exist and still be wrong. Asked for "Twelve", the TTS came back
// with the word, a pause, and a second invented utterance — 2.13 seconds of
// it — and the player dutifully played the ramble mid-set ("lateral raise and
// band pull aparts has like a garbled shin na rsoun de asroyn"). Nobody ever
// listens to 244 clips, so the only defence that scales is arithmetic: a clip
// whose LENGTH its words cannot justify is a clip saying something else.
// Duration comes from the MP4 header (mvhd), parsed here so the check needs
// no ffmpeg and runs anywhere the rest of the gate runs.
function m4aSeconds(path) {
  const b = readFileSync(path);
  const i = b.indexOf('mvhd');
  if (i < 0) return null;
  const version = b[i + 4];
  const scale = version === 1 ? Number(b.readBigUInt64BE(i + 20)) : b.readUInt32BE(i + 16);
  const units = version === 1 ? Number(b.readBigUInt64BE(i + 28)) : b.readUInt32BE(i + 20);
  return scale > 0 ? units / scale : null;
}
// What a phrase should take to say: a lead-in plus per-character time. The
// bound is deliberately loose — this catches a clip that is DOUBLE its words,
// not one that is a little slow.
const SAY_BASE_S = 0.25;
const SAY_PER_CHAR_S = 0.085;
const RAMBLE_FACTOR = 1.9;
const speakName = (n) =>
  n.replace(/\bDB\b/g, 'Dumbbell').replace(/&/g, 'and')
    .replace(/90\/90/g, 'Ninety-ninety').replace(/\bQL\b/g, 'Q-L');
const CUE_TEXT = {};
for (const list of Object.values(FORM_CUES)) {
  for (const { slug, text } of list) CUE_TEXT[slug] = text;
}
const clipText = (slug) => {
  if (CUE_TEXT[slug]) return CUE_TEXT[slug];
  if (slug.startsWith('name-')) {
    const ex = EXERCISES[slug.slice(5)];
    return ex ? speakName(ex.name) : null;
  }
  return slug.replace(/-/g, ' ');
};
const rambling = [];
for (const f of readdirSync(join(ROOT, 'public', 'voice'))) {
  if (!f.endsWith('.m4a')) continue;
  const slug = f.replace(/\.[^.]+$/, '');
  const text = clipText(slug);
  if (!text) continue; // a clip for something no longer in the program
  const secs = m4aSeconds(join(ROOT, 'public', 'voice', f));
  if (secs == null) continue;
  const budget = (SAY_BASE_S + SAY_PER_CHAR_S * text.length) * RAMBLE_FACTOR;
  if (secs > budget) rambling.push({ slug, secs, budget, text });
}

console.log(
  `verify-voice: ${queues} queues, ${cues} spoken cues, ${CLIPS.size} clips`,
);
if (rambling.length) {
  console.log(`✗ ${rambling.length} clip(s) longer than their words justify:`);
  for (const r of rambling.sort((a, b) => b.secs / b.budget - a.secs / a.budget)) {
    console.log(
      `  ${r.slug}  ${r.secs.toFixed(2)}s vs ~${r.budget.toFixed(2)}s allowed — "${r.text}"`,
    );
  }
  console.log('  fix: node scripts/generate-voice.mjs --only <slug,…> --force');
  process.exitCode = 1;
}
if (!missing.size) {
  if (!rambling.length) console.log('✓ every cue has a clip, and every clip says its words');
  process.exit(rambling.length ? 1 : 0);
}
console.log(`✗ ${missing.size} slug(s) with no clip:`);
for (const [slug, e] of [...missing].sort((a, b) => b[1].n - a[1].n)) {
  console.log(`  ${slug}  (${e.n}×)`);
  for (const w of e.where) console.log(`      ${w}`);
}
process.exit(1);
