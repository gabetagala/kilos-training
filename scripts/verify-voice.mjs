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

import { readdirSync } from 'node:fs';
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

console.log(
  `verify-voice: ${queues} queues, ${cues} spoken cues, ${CLIPS.size} clips`,
);
if (!missing.size) {
  console.log('✓ every cue has a clip');
  process.exit(0);
}
console.log(`✗ ${missing.size} slug(s) with no clip:`);
for (const [slug, e] of [...missing].sort((a, b) => b[1].n - a[1].n)) {
  console.log(`  ${slug}  (${e.n}×)`);
  for (const w of e.where) console.log(`      ${w}`);
}
process.exit(1);
