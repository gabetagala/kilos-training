// Standing audit of BLOCK-01 against Gabe's stated goals and restrictions.
//
//   node scripts/verify-program.mjs
//
// Exits non-zero if anything fails, so it can gate a deploy. Every check runs
// across ALL 12 weeks, ALL phases, ALL finisher variants and ALL piece formats
// — because a rule that only holds in week 1 isn't a rule.
//
// The restrictions come from CLAUDE.md, TRAINING.md's IRON RULES, and the
// spine-safety research recorded in BLOCK-01.md §7.

import {
  BENCHMARK_SESSIONS,
  DENSITY40_SESSIONS,
  PROGRAM_EXERCISES,
  WEEK_PLAN,
  getProgramSession,
} from '../src/workout/program.js';
import {
  BLOCK_WEEKS,
  OPEN_PACE_BANNED,
  PIECE_FORMATS,
  RAMP_WEEKS,
  applyFormats,
  applyPhase,
  applyAmber,
  applyTired,
  applyNoFolds,
  applyUnchecked,
  hasDose,
  applyRamp,
  applyShort,
  rotationWeek,
  descendingReps,
  HEAVY_EXTRA_SECS,
  heavyEligible,
  heavyReps,
  formatsFor,
  phaseOf,
  phaseSwaps,
  testsForWeek,
} from '../src/workout/block.js';
import {
  EXPECTED_LOW,
  HYPERTROPHY_EXEMPT,
  MEV,
  MUSCLE_MAP as MAP,
  OPTIONAL_SESSIONS as OPTIONAL,
  TARGETS,
  WASTEFUL,
} from '../src/workout/volume.js';
import {
  REHAB_EXERCISES,
  REHAB_SESSIONS,
  buildStepQueue,
  estimateSessionMins,
  estimateSessionSecs,
  tempoSecsPerRep,
  getRehabSession,
  sessionVariantCount,
} from '../src/workout/rehab.js';
import { REPS_FIRST } from '../src/workout/progression.js';

const results = [];
const check = (area, name, pass, detail = '') =>
  results.push({ area, name, pass, detail });

// Every (week → session → fully-resolved queue) the athlete can actually meet.
//
// THE VARIANT MODEL MUST MATCH THE RUNTIME (2026-08-11): 'daily' rotates
// CALENDAR-PINNED, one variant per rehab day — the k-th rehab day of week w
// (Tue→Thu→Sat→Sun) serves variant (w−1)·4+k, exactly what rehabVariantIdx
// computes in main.js. The first draft of this audit gave all four rehab days
// of a week the SAME variant and judged weeks that can never occur — a
// four-Popeye week read forearms at 40 sets and failed a program whose real
// weeks serve each topper exactly once.
// Sunday left the map 2026-08-16: it serves the 'sunday' rest session (and
// the optional 'wod'), both of which ride the generic w−1 variant path.
const REHAB_DAY_SLOT = { 2: 0, 4: 1, 6: 2 }; // getDay() → k
// THE CAP HOLDS WHILE HE PROGRESSES (round-4 coach QA): reps-first lifts climb
// to +3 before the load moves, so every day is timed with them at +2.
const estMinsExact = (s, v) => {
  let extra = 0;
  for (const st of buildStepQueue(s, {}, v)) {
    if (st.kind !== 'work' || st.secs != null || !st.repTempo) continue;
    if (!REPS_FIRST.has(st.exId)) continue;
    const sides = /\/(side|leg|arm)/.test(String(st.reps ?? '')) ? 2 : 1;
    extra += 2 * sides * tempoSecsPerRep(st.repTempo);
  }
  return (estimateSessionSecs(s, v) + extra) / 60;
};
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
          // rehab steps by phase too (round 3: the back extension progresses)
          s = applyPhase(getRehabSession(item.session || 'daily'), ph);
          if (s && sessionVariantCount(s) > 1) {
            v =
              s.id === 'daily'
                ? (w - 1) * 4 + (REHAB_DAY_SLOT[d] ?? 0)
                : w - 1;
          }
        }
        if (!s) continue;
        yield { w, d, s, q: buildStepQueue(s, sw, v) };
      }
    }
  }
  yield* rampQueues();
  yield* shortQueues();
  yield* amberQueues();
  yield* amberQueues(applyTired, 'TIRED');
}

// THE AMBER DAY (2026-10-10): the session served when the morning back check
// says "stiffer than usual" or he slept under five hours. Audited by every
// RESTRICTION like the ramp and the short day; a string `w` keeps it out of
// the weekly volume GOALS (an amber day is a deliberate dip).
function* amberQueues(dose = applyAmber, tag = 'AMBER') {
  for (let week = 1; week <= BLOCK_WEEKS; week++) {
    const ph = phaseOf(week);
    const sw = phaseSwaps(ph);
    for (let d = 0; d < 7; d++) {
      for (const item of WEEK_PLAN[d]) {
        let s = null;
        let v = 0;
        if (item.type === 'lift') {
          s = dose(
            applyFormats(applyPhase(getProgramSession(item.session), ph), week),
          );
          v = sessionVariantCount(s) > 1 ? week - 1 : 0;
        } else if (item.type === 'rehab') {
          const base = applyPhase(getRehabSession(item.session || 'daily'), ph);
          s = base && dose(base);
          if (s && sessionVariantCount(s) > 1) {
            v =
              s.id === 'daily'
                ? (week - 1) * 4 + (REHAB_DAY_SLOT[d] ?? 0)
                : week - 1;
          }
        }
        if (!s) continue;
        yield { w: `${tag}·wk${week}`, d, s, v, q: buildStepQueue(s, sw, v) };
      }
    }
  }
}

// THE SHORT DAY (2026-09-23): the ~15-minute version of any day, chosen on
// the day. Audited by every RESTRICTION above — it is a real session he will
// really run, on the nights the baby wins. Like the ramp it carries a string
// `w`, so the GOALS checks (which walk numeric weeks) skip it: a short day is
// a deliberate dip under MEV, taken instead of skipping.
function* shortQueues() {
  for (let week = 1; week <= BLOCK_WEEKS; week++) {
    const ph = phaseOf(week);
    const sw = phaseSwaps(ph);
    for (let d = 0; d < 7; d++) {
      for (const item of WEEK_PLAN[d]) {
        let s = null;
        let v = 0;
        if (item.type === 'lift') {
          s = applyShort(
            applyFormats(applyPhase(getProgramSession(item.session), ph), week),
          );
          v = sessionVariantCount(s) > 1 ? week - 1 : 0;
        } else if (item.type === 'rehab') {
          const base = applyPhase(getRehabSession(item.session || 'daily'), ph);
          s = base && applyShort(base);
          if (s && sessionVariantCount(s) > 1) {
            v =
              s.id === 'daily'
                ? (week - 1) * 4 + (REHAB_DAY_SLOT[d] ?? 0)
                : week - 1;
          }
        }
        if (!s) continue;
        yield { w: `SHORT·wk${week}`, d, s, v, q: buildStepQueue(s, sw, v) };
      }
    }
  }
}

// THE RAMP (2026-09-21): a restarted block's easy weeks, audited by every
// RESTRICTION above like any other week — a rule that only holds inside the
// block isn't a rule. Ramp weeks carry a string `w` ('R1·wk11'), so the
// GOALS checks, which walk numeric weeks 1–12, skip them: the ramp is below
// MEV on purpose and is not a week of the block. Every (raw week × ramp
// level) the runtime can meet is covered: raw weeks −2..0 (a Fri–Sun restart
// has three) at both levels, each with the rotation column it really reads.
function* rampQueues() {
  for (let raw = -RAMP_WEEKS; raw <= 0; raw++) {
    const rw = rotationWeek(raw);
    for (let r = 1; r <= RAMP_WEEKS; r++) {
      const w = `R${r}·wk${rw}`;
      for (let d = 0; d < 7; d++) {
        for (const item of WEEK_PLAN[d]) {
          let s = null;
          let v = 0;
          if (item.type === 'lift') {
            s = applyRamp(applyPhase(getProgramSession(item.session), 1), r);
            v = sessionVariantCount(s) > 1 ? rw - 1 : 0;
          } else if (item.type === 'rehab') {
            const base = getRehabSession(item.session || 'daily');
            s = base && applyRamp(base, r);
            if (s && sessionVariantCount(s) > 1) {
              v =
                s.id === 'daily'
                  ? (rw - 1) * 4 + (REHAB_DAY_SLOT[d] ?? 0)
                  : rw - 1;
            }
          }
          if (!s) continue;
          yield { w, d, s, q: buildStepQueue(s, {}, v), ramp: r };
        }
      }
    }
  }
}

// ── RESTRICTIONS ────────────────────────────────────────────────────────────

// The movements that are contraindicated outright for lumbar DDD: loaded or
// dynamic spinal flexion, every one of which gets worse with fatigue.
const NEVER = [
  'thruster', 'wall-ball', 'ghd', 'sit-up', 'toes-to-bar', 'burpee',
  'kipping', 'snatch', 'power-clean', 'row-erg', 'rower', 'box-jump',
  'good-morning', 'russian-twist',
];
// The documented carve-outs. An allowlist rather than a softened pattern so
// the ban itself stays intact and each exception stays greppable: a barbell
// snatch, a loaded good morning, or anything else matching NEVER is still a
// build failure.
//
// db-hang-snatch (2026-08-10): a HANG variant with a single light DB. The
// hinge stops above the knee, the spine stays neutral, and it is in
// OPEN_PACE_BANNED so it can never run on a self-paced clock.
// seated-good-morning (2026-08-11): the NEVER entry bans the LOADED barbell
// good morning — a fatigue-loaded hinge. This is its opposite: an UNLOADED
// seated stretch whose entire cue is "fold at the hips, never the back",
// held, never repped under load. Delete either line to restore the full ban.
const NEVER_ALLOW = new Set(['db-hang-snatch', 'seated-good-morning']);
{
  const known = { ...PROGRAM_EXERCISES, ...REHAB_EXERCISES };
  const hits = Object.keys(known).filter(
    (id) => !NEVER_ALLOW.has(id) && NEVER.some((bad) => id.includes(bad)),
  );
  check(
    'RESTRICTIONS',
    'no contraindicated movement exists in the program at all',
    hits.length === 0,
    hits.join(', '),
  );
}

// Fatigue converts a neutral-spine movement into a flexed one — measurably,
// involuntarily, at loads well below maximal. So the spine-loaded lifts never
// go on a clock, in any format, in any week.
const SPINE_LOADED = [
  'rdl', 'front-squat', 'rfe-split-squat', 'floor-press', 'pull-up',
  'db-split-squat', 'incline-db-press', 'db-floor-press',
  // 2026-10-10 (physio QA): load held in front of the spine is spine load
  'db-front-rack-lunge',
];
// The loaded ballistics — explosive DB lifts. Never on a Back & Hips day, at
// most one loaded-ballistic-or-heavy-hinge family per lift day (physio QA).
const EXPLOSIVE = ['db-push-press', 'db-hang-snatch', 'db-hang-clean-press'];
// REFINED 2026-08-10, when the whole session became one clock. The old rule
// was "spine-loaded work is never on a clock", and it was a proxy for the
// thing actually being protected: HURRY. What converts a neutral spine into a
// flexed one is running out of interval and rushing the last reps — so the
// real rule is a REST FLOOR, and a clock enforces one better than self-paced
// rests do, because a clock does not negotiate on a day you feel strong.
//
// So: spine-loaded work may run on an interval of 2:00 or longer (the set
// takes ~30s, the rest is the remainder — over TRAINING.md IRON RULE 2's
// floor), and may NEVER run on a one-minute interval, an AMRAP, or a
// self-paced for-time clock, all of which are unbounded pace by construction.
// MEASURED AS A REAL GAP, not as the interval length. In a multi-station EMOM a
// movement's rest is `interval × stations`, not `interval` — an RDL sitting in
// a five-station cycle comes round every five minutes even though the clock
// ticks every sixty seconds. Checking the interval would have banned exactly
// the structure that gives the hinge the MOST rest it has ever had.
//
// The floor is start-to-start: 2:30 between the starts of consecutive sets
// guarantees 2:00+ of actual rest for a set that takes 30 seconds, which is
// TRAINING.md IRON RULE 2. Open pace is still out entirely — an AMRAP or a
// self-paced for-time clock has no floor by construction.
const MIN_SPINE_CYCLE = 150;
const MANUAL_EST = 35;
{
  const bad = [];
  for (const { w, s, q } of allQueues()) {
    const lastStart = new Map();
    let t = 0;
    for (const st of q) {
      const dur = st.secs ?? MANUAL_EST;
      const spine =
        st.kind === 'work' &&
        SPINE_LOADED.includes(st.exId) &&
        st.phase !== 'RAMP';
      if (spine) {
        if (st.amrap || (st.piece && !st.emom)) {
          bad.push(`wk${w} ${s.id} ${st.exId} open pace`);
        }
        const prev = lastStart.get(st.exId);
        if (prev != null && t - prev < MIN_SPINE_CYCLE) {
          bad.push(`wk${w} ${s.id} ${st.exId} ${t - prev}s apart`);
        }
        lastStart.set(st.exId, t);
      }
      t += dur;
    }
  }
  check(
    'RESTRICTIONS',
    'spine-loaded sets never come round faster than 2:30 apart',
    bad.length === 0,
    bad.slice(0, 3).join(', '),
  );
}

// A self-paced clock removes the rest floor that makes EMOM the safe default.
{
  const bad = [];
  for (let w = 1; w <= BLOCK_WEEKS; w++) {
    for (const s of DENSITY40_SESSIONS) {
      const shaped = applyFormats(applyPhase(s, phaseOf(w)), w);
      // THROUGH THE POOLS, AND EVERY OPEN MODE (2026-10-09): lift days now
      // carry a scored finisher pool and supersets that go for time, so a
      // top-level-only, fortime-only walk would pass vacuously.
      for (const b of shaped.blocks.flatMap((x) => x.rotate || [x])) {
        if (!['fortime', 'amrap'].includes(b?.mode)) continue;
        for (const m of (b.members || []).flatMap((x) => [x, ...(x.alts || [])])) {
          if (OPEN_PACE_BANNED.includes(m.ex) || SPINE_LOADED.includes(m.ex))
            bad.push(`wk${w} ${s.id} ${b.name} ${m.ex}`);
        }
      }
    }
  }
  check(
    'RESTRICTIONS',
    'self-paced pieces never contain a movement that needs forced rest',
    bad.length === 0,
    bad.slice(0, 3).join(', '),
  );
}

// The anchors are found by their `anchor: true` flag, not by name. They rotate
// now (2026-08-10), so a hardcoded name list would have quietly stopped
// checking three weeks out of four — the exact failure a rotating program
// invites.
const anchorSpecs = () =>
  DENSITY40_SESSIONS.flatMap((s) =>
    s.blocks.flatMap((b) =>
      (b.rotate || [b]).filter((x) => x?.anchor).map((x) => ({ s, b: x })),
    ),
  );
// …plus each anchor's amber-day swap (front squat → DB split squat)
const ANCHOR_IDS = new Set(
  anchorSpecs().flatMap(({ b }) =>
    [b.members[0].ex, b.members[0].amberEx].filter(Boolean),
  ),
);

// One spine-relevant heavy lift per session, FIRST, on its own, long rests.
{
  const bad = [];
  for (const { w, s, q } of allQueues()) {
    if (!s.id.startsWith('d40')) continue;
    const anchorSteps = q.filter(
      (st) => ANCHOR_IDS.has(st.exId) && st.countsAsSet && st.piece === 'The Anchor',
    );
    if (!anchorSteps.length) {
      bad.push(`wk${w} ${s.id}: no anchor`);
      continue;
    }
    if (new Set(anchorSteps.map((st) => st.exId)).size > 1) {
      bad.push(`wk${w} ${s.id}: more than one anchor`);
    }
    const firstAnchor = q.indexOf(anchorSteps[0]);
    // Only the ramp and the un-loaded ballistic primer may precede the anchor.
    // The rule's intent is that the anchor meets a fresh body — the primer is
    // 2×15s of hops and 3 jumps, deliberately stopped while still springy, and
    // it belongs in front of the heavy lift, not behind it.
    // …and, since 2026-10-10, the one loaded ballistic: power runs BEFORE
    // the heavy lift on purpose (both reviews — fresh legs, crisp reps)
    const before = q
      .slice(0, firstAnchor)
      .filter(
        (st) =>
          st.countsAsSet && st.logWeight === true && !EXPLOSIVE.includes(st.exId),
      );
    if (before.length)
      bad.push(`wk${w} ${s.id}: ${before.length} loaded sets before the anchor`);
  }
  check(
    'RESTRICTIONS',
    'one anchor per session, first, and never supersetted',
    bad.length === 0,
    bad.slice(0, 3).join('; '),
  );
}

// Rest between anchor sets — TRAINING.md IRON RULE 2 says >= 2:00.
{
  const bad = [];
  for (const { s, b } of anchorSpecs()) {
    // The interval IS the rest now. IRON RULE 2's 2:00 floor is about
    // SPINE-LOADED work — a ~30s set inside a 3:00 interval leaves ~2:30 —
    // so those need E3M. A bodyweight pull-up or a stacked-spine push press
    // is not on that list and clears at E2M, which is the whole point of
    // letting the interval follow the movement.
    //
    // ALTS TOO (2026-08-10): the athlete's swap choices persist across weeks,
    // so every lift the slot could legally serve must clear the floor at the
    // block's interval — an E2M anchor with a SPINE_LOADED alt would run that
    // lift at 120s forever after one tap.
    const m0 = b.members?.[0] || {};
    for (const cand of [m0, ...(m0.alts || [])]) {
      // 2:30 for spine-loaded lifts (2026-10-10, coach QA — 3:00 cost minutes
      // the day didn't have): a set of ≤30 s still leaves IRON RULE 2's 2:00
      const floor = SPINE_LOADED.includes(cand.ex) ? 150 : 120;
      if ((b.intervalSecs ?? 0) < floor) {
        bad.push(`${s.id} ${cand.ex} ${b.intervalSecs}s (needs ${floor}s)`);
      }
    }
    if ((b.members || []).length !== 1) {
      bad.push(`${s.id} anchor has ${(b.members || []).length} members`);
    }
  }
  check('RESTRICTIONS', 'the anchor (and every alt) rests long enough, and is never supersetted', bad.length === 0, bad.join(', '));
}

// Asymmetry rule: the right (smaller) side leads. There are no `side:` members
// left — per-side rep work ("6/side") alternates inside the athlete's own
// minute — so the rule now lives in the NOTE on timed unilateral work, and
// this asserts the note actually says it, reaching through the rotate pools
// (the old version scanned raw blocks and passed vacuously).
{
  const UNILATERAL_TIMED = new Set(['suitcase-carry', 'farmer-carry-1arm']);
  const bad = [];
  // BOTH programs (2026-08-15): The Porter put the first unilateral timed
  // carry into a rehab session, which this walk never covered — the right
  // (smaller) side leads everywhere, whether within a set or by minutes.
  for (const s of [...DENSITY40_SESSIONS, ...REHAB_SESSIONS]) {
    for (const b of s.blocks) {
      for (const v of b.rotate || [b]) {
        const members = v?.members || [];
        for (const m of members) {
          if (!UNILATERAL_TIMED.has(m.ex)) continue;
          const perMinute = members.some((x) =>
            /left hand this minute/i.test(x.note || ''),
          );
          if (perMinute) {
            // minute-per-hand structure: the RIGHT minute must come first
            const iR = members.findIndex((x) =>
              /right hand this minute/i.test(x.note || ''),
            );
            const iL = members.findIndex((x) =>
              /left hand this minute/i.test(x.note || ''),
            );
            if (iR === -1 || (iL !== -1 && iR > iL)) {
              bad.push(`${s.id} ${m.ex} left hand leads`);
            }
          } else if (!/right side first/i.test(m.note || '')) {
            bad.push(`${s.id} ${m.ex} has no right-side-first note`);
          }
        }
      }
    }
  }
  check('RESTRICTIONS', 'timed unilateral work names the right side first', bad.length === 0, bad.slice(0, 3).join(', '));
}

// EVERY REP STATION FITS ITS MINUTE (2026-08-10). Four stations used to
// consume 100% of their interval at their own prescribed tempo — a rush by
// construction, and hurry is the exact thing the forced-rest format exists to
// prevent. Budget: prescribed reps × tempo ≤ 75% of the interval (leaves ~15s
// to get there and breathe), and the DESCENDING top round ≤ interval − 10s.
// Per-side prescriptions count both sides. Alts are checked FLAT at their own
// reps — that is what the engine serves after a swap. Members without a
// repTempo (ballistics, bodyweight push-ups, timed work) are paced by feel or
// by `secs`, which gets the same 75% budget.
{
  // The SAME merged table the player engine is built from (rehab.js) — the
  // RDL's tempo lives in REHAB_EXERCISES, and reading only PROGRAM_EXERCISES
  // silently exempted the one spine-loaded piece station from this budget.
  const KNOWN_EXERCISES = { ...REHAB_EXERCISES, ...PROGRAM_EXERCISES };
  const tempoOf = (ex) =>
    (KNOWN_EXERCISES[ex]?.repTempo || []).reduce((a, [, s]) => a + s, 0);
  const totalReps = (repsStr) => {
    const n = Number.parseInt(String(repsStr).match(/\d+/)?.[0] ?? '', 10);
    if (!n) return null;
    return /\/(side|leg|arm)/.test(String(repsStr)) ? n * 2 : n;
  };
  const bad = [];
  for (const s of [...DENSITY40_SESSIONS, ...REHAB_SESSIONS]) {
    for (const b of s.blocks) {
      for (const v of b.rotate || [b]) {
        if (v?.mode !== 'emom') continue;
        const interval = v.intervalSecs ?? 60;
        const desc = (v.formats || []).includes('emom-desc');
        const heavy = (v.formats || []).includes('emom-heavy');
        for (const m of v.members || []) {
          if (m.secs != null && m.secs > interval * 0.75) {
            bad.push(`${s.id} ${v.name} ${m.ex} ${m.secs}s work in ${interval}s`);
          }
          for (const cand of [m, ...(m.alts || [])]) {
            const tempo = tempoOf(cand.ex);
            // death-by ladders END at failure by design — the top rung is
            // SUPPOSED to fight the minute, so the 75% budget doesn't apply
            if (cand.repsPerRound) continue;
            const reps = totalReps(cand.reps);
            if (!tempo || !reps) continue;
            if (reps * tempo > interval * 0.75) {
              bad.push(`${s.id} ${v.name} ${cand.ex} ${reps * tempo}s of work in ${interval}s`);
            }
            // the heavy week: fewer reps, each a second slower on the way
            // down — the same 75% budget at (tempo + 1)s a rep
            if (heavy && heavyEligible(cand)) {
              const hr = totalReps(heavyReps(cand.reps));
              if (hr && hr * (tempo + HEAVY_EXTRA_SECS) > interval * 0.75) {
                bad.push(`${s.id} ${v.name} ${cand.ex} heavy ${hr * (tempo + HEAVY_EXTRA_SECS)}s in ${interval}s`);
              }
            }
            // the descending top only ever applies to the primary member —
            // a swapped-in alt runs flat (resolveSwap drops repsPerRound)
            if (cand === m && desc && !m.fixedReps) {
              const ladder = descendingReps(m.reps, v.rounds);
              const top = ladder ? totalReps(ladder[0]) : null;
              if (top && top * tempo > interval - 10) {
                bad.push(`${s.id} ${v.name} ${m.ex} desc top ${top * tempo}s in ${interval}s`);
              }
            }
          }
        }
      }
    }
  }
  check('RESTRICTIONS', 'every station fits inside its minute, descending and heavy weeks included', bad.length === 0, bad.slice(0, 3).join(', '));
}

// ONE PULLEY, ONE ATTACHMENT (2026-08-11, his gym). The cable stack and the
// pulldown share the rack — a single pulling station. A 60-second window
// cannot absorb an attachment change, so per piece AT MOST ONE station may
// touch the pulley — counting alts, because a persisted swap must never force
// a second station onto it — and that station's rig is set before the clock
// starts. The pull-up bar stays clear for a dead hang with an attachment
// rigged — CONFIRMED on his actual rack (Gabe, 2026-08-11) — so pull-ups
// never count against the pulley budget.
//
// Membership comes from the `pulley: true` tag on the exercise defs, with the
// rig names here; the completeness cross-check below makes a missing tag or a
// missing rig entry a build failure — the same drift-guard pattern as the
// volume map, and for the same reason: an untagged cable exercise would slide
// past this rule unseen.
const CABLE_SETUP = {
  'lat-pulldown': 'high bar + seat',
  'face-pull': 'high rope',
  'rope-pushdown': 'high rope',
  'overhead-triceps': 'low rope',
  'cable-row-1arm': 'low handle',
  'cable-lateral-raise': 'low handle',
  'cable-fly-low': 'low handle',
  'cable-leg-curl': 'low ankle strap',
};
{
  const bad = [];
  const tagged = Object.entries(PROGRAM_EXERCISES)
    .filter(([, e]) => e.pulley)
    .map(([id]) => id);
  for (const id of tagged) {
    if (!CABLE_SETUP[id]) bad.push(`${id} tagged pulley but has no rig entry`);
  }
  for (const id of Object.keys(CABLE_SETUP)) {
    if (!PROGRAM_EXERCISES[id]?.pulley) bad.push(`${id} has a rig entry but no pulley tag`);
  }
  for (const s of [...DENSITY40_SESSIONS, ...BENCHMARK_SESSIONS, ...REHAB_SESSIONS]) {
    let anchorRig = null;
    let pieceRig = null;
    for (const b of s.blocks) {
      for (const v of b.rotate || [b]) {
        if (!v?.members) continue;
        const rigs = new Set(
          v.members
            .flatMap((m) => [m, ...(m.alts || [])])
            .map((c) => CABLE_SETUP[c.ex])
            .filter(Boolean),
        );
        // an anchor is one station and re-rigging BETWEEN blocks (its own
        // clock) costs nothing — but if BOTH the anchor and the piece want
        // the pulley on the same day, their rigs must match, or the piece's
        // pre-set rig gets torn down by the anchor that runs first
        if (v.members.length < 2) {
          for (const r of rigs) anchorRig = r;
          continue;
        }
        const pulley = v.members.filter((m) =>
          [m, ...(m.alts || [])].some((c) => CABLE_SETUP[c.ex]),
        );
        if (pulley.length > 1) {
          bad.push(`${s.id} ${v.name}: ${pulley.length} pulley stations`);
        }
        for (const r of rigs) pieceRig = r;
      }
    }
    if (anchorRig && pieceRig && anchorRig !== pieceRig) {
      bad.push(`${s.id}: anchor rig (${anchorRig}) ≠ piece rig (${pieceRig})`);
    }
  }
  check('RESTRICTIONS', 'each piece touches the pulley at most once, rig set before the clock', bad.length === 0, bad.slice(0, 3).join(', '));
}

// ONE BIG SPINE EVENT PER LIFT DAY (2026-10-10, physio QA): at most one family
// of {heavy hinge, loaded ballistic} per lift day — Monday hinges, Wednesday
// jumps and presses, Friday hinges light. Unloaded jumps are not a family.
{
  const bad = [];
  for (const { w, s, q } of allQueues()) {
    if (!s.id.startsWith('d40')) continue;
    const fams = new Set();
    for (const st of q) {
      if (st.kind !== 'work' || st.phase === 'RAMP') continue;
      if (st.exId === 'rdl') fams.add('hinge');
      if (EXPLOSIVE.includes(st.exId)) fams.add('ballistic');
    }
    if (fams.size > 1) bad.push(`${w} ${s.id}: ${[...fams].join(' + ')}`);
    // and one front-rack exercise at most — the rack loads a sore mid-back
    const racks = new Set(
      q
        .filter((st) => st.kind === 'work' && st.countsAsSet && st.phase !== 'RAMP')
        .map((st) => st.exId)
        .filter((id) => ['front-squat', 'db-front-rack-lunge'].includes(id)),
    );
    if (racks.size > 1) bad.push(`${w} ${s.id}: two front-rack exercises`);
  }
  check('RESTRICTIONS', 'at most one heavy-hinge OR loaded-ballistic family per lift day', bad.length === 0, bad.slice(0, 3).join(', '));
}

// THE AMBER DAY IS ACTUALLY LIGHTER: no ballistic, no finisher or pump, no
// format that pushes effort, and it is shorter than the full day.
{
  const bad = [];
  const JUMPS = ['broad-jump', 'pogo-hop', 'power-pushup', 'skater-bound'];
  // amber also never serves the movements a stiff back won't like (round 2)
  // round 4 (physio): the floor-level DB split squat is light on the disc and
  // stays on an amber day (at most once — the anchor swap OR Friday's legs);
  // the axial, front-rack and rear-foot-elevated work never does
  const AMBER_NEVER = ['rdl', 'db-front-rack-lunge', 'front-squat', 'rfe-split-squat'];
  for (const [gen, strict] of [
    [amberQueues(), true],
    [amberQueues(applyTired, 'TIRED'), false],
  ]) {
    for (const { w, s, q } of gen) {
      if (OPTIONAL.has(s.id)) continue; // never opens the bonus WOD
      const splitBlocks = new Set(
        q.filter((st) => st.kind === 'work' && st.exId === 'db-split-squat').map((st) => st.bi),
      );
      if (strict && splitBlocks.size > 1) bad.push(`${w} ${s.id} two split-squat blocks`);
      for (const st of q) {
        if (st.kind !== 'work') continue;
        if (EXPLOSIVE.includes(st.exId) || JUMPS.includes(st.exId) || st.amrap || st.bail || String(st.pieceFormat || '').startsWith('TABATA'))
          bad.push(`${w} ${s.id} ${st.exId}`);
        if (st.heavy || /MAX SET|HEAVY/.test(String(st.meta || '')) || /LAST SET|Heavy week/.test(String(st.cueNote || '')))
          bad.push(`${w} ${s.id} ${st.exId} effort format`);
        if (!strict) continue;
        // the anchor's own amber swap is the split squat — that one is allowed
        if (AMBER_NEVER.includes(st.exId) && !st.anchor && st.phase !== 'RAMP')
          bad.push(`${w} ${s.id} ${st.exId} on a stiff-back day`);
        if (st.exId === 'back-extension' && st.tempo)
          bad.push(`${w} ${s.id} repped back extension on a stiff-back day`);
      }
    }
  }
  check('RESTRICTIONS', 'amber and tired days serve nothing ballistic, scored or maxed — amber nothing spine-heavy', bad.length === 0, bad.slice(0, 3).join(', '));
}

// REHAB DAYS ARE AXIALLY QUIET (2026-08-11; widened 2026-08-14). The
// finishers exist to make the light days fun, not to sneak load onto the
// spine between the heavy days: no SPINE_LOADED movement, no pulley exercise
// (the rack stays untouched), in any rehab session's metcon-shaped block —
// EVERY mode (emom, fortime, tabata, amrap, circuit), members or alts, and
// tabata's single `ex` counts too. The old version keyed on mode === 'emom'
// only, which would have silently guarded nothing once the toppers became
// finishers.
{
  const bad = [];
  const METCON_MODES = new Set(['emom', 'fortime', 'tabata', 'amrap', 'circuit']);
  for (const s of REHAB_SESSIONS) {
    for (const b of s.blocks) {
      for (const v of b.rotate || [b]) {
        if (!METCON_MODES.has(v?.mode)) continue;
        const pool = [
          ...(v.members || []),
          ...(v.ex ? [{ ex: v.ex, alts: v.alts }] : []),
        ].flatMap((x) => [x, ...(x.alts || [])]);
        for (const m of pool) {
          if (SPINE_LOADED.includes(m.ex) || EXPLOSIVE.includes(m.ex))
            bad.push(`${s.id} ${v.name} ${m.ex} spine-loaded or explosive`);
          if (CABLE_SETUP[m.ex]) bad.push(`${s.id} ${v.name} ${m.ex} touches the pulley`);
        }
      }
    }
  }
  check('RESTRICTIONS', 'rehab-day finishers are axially quiet — no spine load, no pulley, any mode', bad.length === 0, bad.slice(0, 3).join(', '));
}

// NATIVELY OPEN-PACE BLOCKS obey the open-pace ban (2026-08-14). The two
// existing open-pace checks guard the FORMAT-ROTATION path (declared
// `formats`, lift days) — a rehab finisher shipping mode:'fortime' or
// mode:'amrap' directly never touches formatsFor, so without this check the
// ban would pass vacuously: put suitcase-carry in The Pump and nothing fails.
{
  const bad = [];
  const OPEN_MODES = new Set(['fortime', 'amrap']);
  for (const s of REHAB_SESSIONS) {
    for (const b of s.blocks) {
      for (const v of b.rotate || [b]) {
        if (!OPEN_MODES.has(v?.mode)) continue;
        const pool = [
          ...(v.members || []),
          ...(v.ex ? [{ ex: v.ex, alts: v.alts }] : []),
        ].flatMap((x) => [x, ...(x.alts || [])]);
        for (const m of pool) {
          if (OPEN_PACE_BANNED.includes(m.ex)) bad.push(`${s.id} ${v.name} ${m.ex}`);
        }
      }
    }
  }
  check('RESTRICTIONS', 'natively open-pace blocks never serve a pace-banned movement', bad.length === 0, bad.slice(0, 3).join(', '));
}

// OPEN PACE IS UNREACHABLE for any slot that could serve a banned movement —
// including via a persisted swap. This is the property that makes the
// db-hang-snatch carve-out from the NEVER list safe: its EMOM-only claim is
// enforced by formatsFor, and this proves formatsFor actually enforces it
// (the list guarded nothing while no piece declared an open format).
{
  const bad = [];
  for (const s of [...DENSITY40_SESSIONS, ...REHAB_SESSIONS]) {
    for (const b of s.blocks) {
      for (const v of b.rotate || [b]) {
        if (!v?.members) continue;
        const pool = v.members.flatMap((m) => [m, ...(m.alts || [])]);
        const hasBanned = pool.some((m) => OPEN_PACE_BANNED.includes(m.ex));
        if (!hasBanned) continue;
        const open = formatsFor(v).filter((f) => PIECE_FORMATS[f].pace === 'open');
        if (open.length) bad.push(`${s.id} ${v.name}: ${open.join(',')} reachable`);
      }
    }
  }
  check('RESTRICTIONS', 'open-pace formats are unreachable wherever a banned movement could serve', bad.length === 0, bad.slice(0, 3).join(', '));
}

// Session length. The old ceiling was 45 minutes and it covered rehab + lift
// stacked on the same day. Nothing stacks any more (2026-08-10): a lift day is
// a lift, a rehab day is the Back & Hips distillate + topper, and the ceiling is
// about the SHAPE of the week — every required day lands in one band, so no
// day is the one he starts skipping. Sunday's Open Up and The Long Way are
// explicitly optional extras and are not counted.
{
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  let longest = 0;
  let shortest = Infinity;
  let where = '';
  const stacked = [];
  for (let w = 1; w <= BLOCK_WEEKS; w++) {
    WEEK_PLAN.forEach((day, d) => {
      let mins = 0;
      let hasLift = false;
      let hasRehab = false;
      for (const item of day) {
        if (item.type === 'lift') {
          hasLift = true;
          const s = applyFormats(
            applyPhase(getProgramSession(item.session), phaseOf(w)),
            w,
          );
          mins += estMinsExact(s, sessionVariantCount(s) > 1 ? w - 1 : 0);
        } else if (item.type === 'rehab' && !item.session) {
          hasRehab = true;
          // the day's REAL variant — toppers differ slightly in length
          mins += estMinsExact(
            applyPhase(getRehabSession('daily'), phaseOf(w)),
            (w - 1) * 4 + (REHAB_DAY_SLOT[d] ?? 0),
          );
        } else if (
          item.type === 'rehab' &&
          item.session &&
          !OPTIONAL.has(item.session)
        ) {
          // Sunday's required rest session — counted against the 40-minute
          // ceiling like any other day, exempt only from the 30-minute floor
          // below (being short is its whole job since 2026-08-16)
          hasRehab = true;
          const s = getRehabSession(item.session);
          if (s) {
            mins += estMinsExact(
              s,
              sessionVariantCount(s) > 1 ? w - 1 : 0,
            );
          }
        }
      }
      if (hasLift && hasRehab) stacked.push(`wk${w} ${DAYS[d]}`);
      if (!mins) return;
      if (mins > longest) {
        longest = mins;
        where = `wk${w} ${DAYS[d]}`;
      }
      // Sunday is exempt from the floor: it is the REST day (2026-08-16),
      // and a short Sunday is the promise kept, not a day gone token.
      if (d !== 0) shortest = Math.min(shortest, mins);
    });
  }
  // THE CAP, UNROUNDED — 45 minutes since 2026-10-11 (his call: "until 45
  // instead of sacrificing load"). Round-3 coach QA: the old ceiling was a
  // rounded 41, and Friday passed at 40.3. The estimate now counts the
  // changeovers, the get-set steps and the rep-out sets — so 40.0 means 40.0.
  check(
    'RESTRICTIONS',
    'every day fits 45:00 — unrounded, changeovers, max sets and reps-first at +2',
    longest <= 45,
    `longest ${longest.toFixed(1)} min (${where})`,
  );
  // The floor, not a band. A for-time week is legitimately shorter than an
  // EMOM week — same sets, no forced rest, you just move faster — so pinning
  // the SPREAD would punish exactly the format variety this program wants.
  // What actually matters is that no required day shrinks into a token effort.
  check(
    'RESTRICTIONS',
    'no required training day shrinks below 30 minutes (Sunday rests)',
    shortest >= 30,
    `${shortest.toFixed(1)}–${longest.toFixed(1)} min`,
  );
  check(
    'RESTRICTIONS',
    'the rehab day never stacks on a lift day',
    stacked.length === 0,
    stacked.slice(0, 3).join(', '),
  );
}

// ── ROUND 3 (2026-10-10, independent coach + physio QA) ────────────────────
// A bad night or a deload week is no day for impact or maxing: the SHORT dose
// (which the deload and the comeback lead with) serves nothing ballistic, no
// heavy-week sets and no max set.
{
  const JUMPY = new Set(['broad-jump', 'skater-bound', 'pogo-hop', ...EXPLOSIVE]);
  const bad = [];
  for (const { w, s, q } of shortQueues()) {
    for (const st of q) {
      if (st.kind !== 'work') continue;
      if (JUMPY.has(st.exId) || st.heavy || /MAX SET|LAST SET/.test(`${st.meta} ${st.cueNote || ''}`)) {
        bad.push(`${w} ${s.id} ${st.exId}`);
      }
    }
  }
  check(
    'RESTRICTIONS',
    'short / deload days serve nothing ballistic, heavy or maxed',
    bad.length === 0,
    bad.slice(0, 4).join(' · ') || 'clean',
  );
}
// THE FOLDS CLOSE THE DAY: nothing loaded or scored after held flexion —
// once a fold has run, only folds follow (every dose, every day).
{
  const FOLDS = new Set(['elephant-walk', 'seated-good-morning']);
  const bad = [];
  for (const { w, s, q } of allQueues()) {
    let folded = false;
    for (const st of q) {
      if (st.kind !== 'work') continue;
      if (FOLDS.has(st.exId)) folded = true;
      else if (folded) {
        bad.push(`${w} ${s.id} ${st.exId}`);
        break;
      }
    }
  }
  check(
    'RESTRICTIONS',
    'the forward folds close every session — nothing after them',
    bad.length === 0,
    bad.slice(0, 4).join(' · ') || 'clean',
  );
}
// THE ANCHOR'S PAIR: only on a lift that doesn't load the spine, only a
// spine-quiet move, and real rest left before the next heavy set.
{
  const AXIAL = new Set([
    'rdl',
    'front-squat',
    'rfe-split-squat',
    'db-split-squat',
    'db-front-rack-lunge',
  ]);
  const bad = [];
  for (const sess of DENSITY40_SESSIONS) {
    for (const b of sess.blocks) {
      for (const v of b.rotate || [b]) {
        if (!v?.pair) continue;
        const lift = v.members[0].ex;
        const iv = v.intervalSecs ?? 60;
        const rest = iv - (v.pair.at ?? 45) - (parseInt(v.pair.reps, 10) || 0) * 3;
        // axial or hinge load — the press stays eligible: its pair leaves
        // real rest (checked below), and nothing in a lateral rushes it
        if (AXIAL.has(lift)) bad.push(`${sess.id} pair on ${lift}`);
        if (SPINE_LOADED.includes(v.pair.ex) || EXPLOSIVE.includes(v.pair.ex))
          bad.push(`${sess.id} ${v.pair.ex} loads the spine`);
        if (rest < 40) bad.push(`${sess.id} ${v.pair.ex} leaves ${rest}s`);
      }
    }
  }
  check(
    'RESTRICTIONS',
    'anchor pairs: spine-quiet lift, spine-quiet pair, real rest left',
    bad.length === 0,
    bad.join(' · ') || 'clean',
  );
}

// THE WARM-UPS ROTATE (round 3, his ask): every lift day meets four different
// warm-ups across a month, each under four minutes.
{
  const bad = [];
  for (const sess of DENSITY40_SESSIONS) {
    const seen = new Set();
    for (let w = 1; w <= 4; w++) {
      const q = buildStepQueue(applyFormats(sess, w), {}, w - 1);
      const warm = q.filter((st) => st.warmup);
      const secs = warm.reduce((n, st) => n + (st.secs || 0), 0);
      if (!warm.length || secs > 240) bad.push(`${sess.id} wk${w} ${secs}s`);
      seen.add(warm.filter((st) => st.kind === 'work').map((st) => st.exId).join(','));
    }
    if (seen.size < 4) bad.push(`${sess.id} only ${seen.size} different`);
  }
  check(
    'VARIETY',
    'four different warm-ups per lift day, each under four minutes',
    bad.length === 0,
    bad.join(' · ') || 'clean',
  );
}

// THE TIRED DAY IS REAL, THE RAMP KEEPS THE PUMPS (round-3 QA): a short
// night takes at least 10% off every lift and Tue/Thu day; a ramp week's
// Back & Hips still serves its pumps.
{
  const bad = [];
  for (const sess of DENSITY40_SESSIONS) {
    for (let w = 1; w <= BLOCK_WEEKS; w++) {
      const s = applyFormats(applyPhase(sess, phaseOf(w)), w);
      const full = estimateSessionSecs(s, w - 1);
      const tired = estimateSessionSecs(applyTired(s), w - 1);
      if (tired > full * 0.9) bad.push(`${sess.id} wk${w} ${Math.round((tired / full) * 100)}%`);
    }
  }
  const daily = getRehabSession('daily');
  for (const k of [0, 1]) {
    const full = estimateSessionSecs(daily, k);
    const tired = estimateSessionSecs(applyTired(daily), k);
    if (tired > full * 0.9) bad.push(`daily k${k} ${Math.round((tired / full) * 100)}%`);
    for (const r of [1, 2]) {
      const q = buildStepQueue(applyRamp(daily, r), {}, k);
      if (!q.some((st) => st.blockLabel && st.kind === 'work')) bad.push(`ramp${r} k${k} has no pump`);
    }
  }
  check(
    'RESTRICTIONS',
    'a tired day is ≥10% lighter; a ramp week keeps the pumps',
    bad.length === 0,
    bad.slice(0, 4).join(' · ') || 'clean',
  );
}

// EVERY POOL MEMBER IS SERVED (round-4 QA: a per-phase index into a 16-deep
// pool always read weeks 0–3, and three Saturday moves were dead data).
{
  const served = new Map();
  for (const { w, s, q } of allQueues()) {
    if (typeof w !== 'number') continue;
    const set = served.get(s.id) || new Set();
    for (const st of q) {
      for (const k of [st.piece, st.blockLabel, st.exId]) if (k) set.add(k);
    }
    served.set(s.id, set);
  }
  const dead = [];
  for (const [id, set] of served) {
    const sess = getRehabSession(id) || getProgramSession(id);
    for (const b of sess?.blocks || []) {
      for (const v of b.rotate || []) {
        if (!v) continue;
        const key = v.name || v.ex;
        if (key && !set.has(key)) dead.push(`${id}: ${key}`);
      }
    }
  }
  check(
    'VARIETY',
    'every rotation member is served at least once in 12 weeks',
    dead.length === 0,
    [...new Set(dead)].slice(0, 5).join(' · ') || 'clean',
  );
}

// EVERY DOSE COMBINATION RESTORES (round-6 app QA: a short night on a short
// day saved dose 'tired', lost the 'short', and a refresh retired the run).
// The player rebuilds a run from its SAVED dose string on top of the phased
// session — that rebuild must equal the live queue, step for step, for every
// combination the preview can serve.
{
  const STEPS = { short: applyShort, amber: applyAmber, tired: applyTired, unchecked: applyUnchecked };
  const redose = (s, dose, noFolds) => {
    const d = ['short', 'amber', 'tired', 'unchecked']
      .filter((p) => hasDose(dose, p))
      .reduce((acc, p) => STEPS[p](acc), s);
    return noFolds ? applyNoFolds(d) : d;
  };
  const LIVE = [
    ['short', (s) => applyShort(s)],
    ['amber', (s) => applyAmber(s)],
    ['tired', (s) => applyTired(s)],
    ['short+tired', (s) => applyTired(applyShort(s))],
    ['unchecked', (s) => applyUnchecked(s)],
    ['short+unchecked', (s) => applyUnchecked(applyShort(s))],
  ];
  const sig = (q) => q.map((st) => `${st.exId}|${st.secs}|${st.reps}|${st.kind}`).join(',');
  const bad = [];
  for (const w of [1, 5, 9]) {
    const ph = phaseOf(w);
    const sessions = [
      ...DENSITY40_SESSIONS.map((x) => [applyFormats(applyPhase(x, ph), w), w - 1]),
      ...['daily', 'sunday'].map((id) => [applyPhase(getRehabSession(id), ph), id === 'daily' ? (w - 1) * 4 + 2 : w - 1]),
    ];
    for (const [base, v] of sessions) {
      for (const [name, fn] of LIVE) {
        for (const noFolds of [false, true]) {
          const live = noFolds ? applyNoFolds(fn(base)) : fn(base);
          // the player re-applies the phase (a no-op once dosed) and the dose
          const again = redose(applyPhase(live, ph), live.dose, noFolds);
          const restored = redose(base, live.dose, noFolds);
          if (sig(buildStepQueue(again, {}, v)) !== sig(buildStepQueue(live, {}, v)) ||
              sig(buildStepQueue(restored, {}, v)) !== sig(buildStepQueue(live, {}, v)))
            bad.push(`wk${w} ${base.id} ${name}${noFolds ? '+early' : ''}`);
        }
      }
    }
  }
  check(
    'RESTRICTIONS',
    'every dose combination restores to the exact live queue',
    bad.length === 0,
    bad.slice(0, 4).join(' · ') || 'clean',
  );
}

// ONE ENGINE MOVEMENT ONCE A WEEK: the scored finishers never repeat a
// movement inside the same week (Wednesday's Tabata vs Saturday's finisher).
{
  const dup = [];
  for (let w = 1; w <= BLOCK_WEEKS; w++) {
    const seen = new Map();
    for (const { w: ww, d, q } of allQueues()) {
      if (ww !== w) continue;
      for (const st of q) {
        if (!st.conditioning || st.kind !== 'work') continue;
        const prev = seen.get(st.exId);
        if (prev != null && prev !== d) dup.push(`wk${w} ${st.exId}`);
        seen.set(st.exId, d);
      }
    }
  }
  check(
    'VARIETY',
    'no finisher movement repeats inside a week',
    dup.length === 0,
    [...new Set(dup)].slice(0, 4).join(' · ') || 'clean',
  );
}

// ── SUNDAY IS A REST DAY (2026-08-16, his ask) ──────────────────────────────
// The properties that make it real rather than polite: Sunday's only
// required session is the all-medicine 'sunday' (holds + the McGill cap —
// no metcon-shaped block, nothing scored), everything else on the day is
// audited as optional, and the medicine stays under half an hour.
{
  const sunday = WEEK_PLAN[0];
  const required = sunday.filter(
    (i) => !(i.type === 'rehab' && OPTIONAL.has(i.session)),
  );
  const restOk =
    required.length === 1 &&
    required[0].type === 'rehab' &&
    required[0].session === 'sunday';
  const rest = getRehabSession('sunday');
  const METCON = new Set(['emom', 'fortime', 'tabata', 'amrap', 'circuit']);
  const noMetcon =
    !!rest &&
    rest.blocks.every((b) =>
      (b.rotate || [b]).every((v) => !METCON.has(v?.mode)),
    );
  let restMins = 0;
  for (let w = 1; w <= BLOCK_WEEKS; w++) {
    restMins = Math.max(restMins, rest ? estimateSessionMins(rest, w - 1) : 99);
  }
  check(
    'GOALS',
    'Sunday is a rest day — medicine only, the WOD is opt-in, under 30 min',
    restOk && noMetcon && OPTIONAL.has('wod') && restMins < 30,
    `required: ${required.map((i) => i.session).join('+') || 'none'} · ${restMins} min`,
  );
}

// ── GOALS ───────────────────────────────────────────────────────────────────
// The fractional muscle map, the MEV/wasteful bands, and the exempt/optional
// session sets all live in src/workout/volume.js — ONE copy, shared with
// scripts/block-sheet.mjs, because the sheet's private copy drifted (it was
// missing the ballistic movements) and quietly under-reported chest.

// THE GUARD. Every movement the program actually serves must be attributed, or
// its volume vanishes from the audit and every band check below quietly lies.
// This is how db-split-squat, db-floor-press and incline-db-press went missing.
// THE DISTILLATE SKIP (2026-08-11): the 'daily' session counts for volume now
// — its topper EMOM is real hypertrophy work — but its long HOLDS stay
// medicine, not sets. The skip is scoped to (session === 'daily' AND the
// exercise is a rehab-dictionary movement): scoping by dictionary alone would
// erase the lift days' RDL and ballistics, whose definitions live in
// REHAB_EXERCISES too.
const distillateSkip = (s, st) => s.id === 'daily' && !!REHAB_EXERCISES[st.exId];
{
  const used = new Set();
  for (const { s, q } of allQueues()) {
    if (HYPERTROPHY_EXEMPT.has(s.id) || OPTIONAL.has(s.id)) continue;
    for (const st of q) {
      if (distillateSkip(s, st)) continue;
      if (st.kind === 'work' && st.countsAsSet && st.phase !== 'RAMP') {
        used.add(st.exId);
      }
    }
  }
  const unmapped = [...used].filter((id) => !MAP[id]).sort();
  check(
    'GOALS',
    'every movement the program serves is attributed in the volume map',
    unmapped.length === 0,
    unmapped.join(', '),
  );
}

// HONEST SET CREDIT (2026-10-10, coach QA): a 20-second Tabata round is not
// a hard set — eight of them count as four; a death-by ladder's minutes count
// as sets only up to five (past that it is conditioning, not hypertrophy).
const setCredit = (q) => {
  const ladderSeen = new Map();
  return (st) => {
    // a scored finisher is the engine, not a growth set (round-3 coach QA):
    // Saturday's step-ups and the Tabata squats used to fill the quad target
    if (st.conditioning) return 0;
    if (String(st.pieceFormat || '').startsWith('TABATA')) return 0.5;
    if (st.bail) {
      const n = (ladderSeen.get(st.piece) || 0) + 1;
      ladderSeen.set(st.piece, n);
      return n <= 5 ? 1 : 0;
    }
    return 1;
  };
};
const weekVol = [];
for (let w = 1; w <= BLOCK_WEEKS; w++) {
  const t = {};
  for (const { w: ww, s, q } of allQueues()) {
    if (ww !== w || HYPERTROPHY_EXEMPT.has(s.id) || OPTIONAL.has(s.id)) continue;
    const credit = setCredit(q);
    for (const st of q) {
      if (distillateSkip(s, st)) continue;
      if (st.kind !== 'work' || !st.countsAsSet || st.phase === 'RAMP') continue;
      const c = credit(st);
      for (const [m, f] of Object.entries(MAP[st.exId] || {})) t[m] = (t[m] || 0) + f * c;
    }
  }
  weekVol.push(t);
}
const muscles = [...new Set(weekVol.flatMap(Object.keys))];
{
  const under = [];
  const over = [];
  for (const m of muscles) {
    if (EXPECTED_LOW.has(m)) continue;
    weekVol.forEach((v, i) => {
      if ((v[m] || 0) < MEV) under.push(`${m} wk${i + 1}=${v[m] || 0}`);
      if ((v[m] || 0) >= WASTEFUL) over.push(`${m} wk${i + 1}=${v[m]}`);
    });
  }
  // muscles sitting EXACTLY at MEV pass, but with zero headroom — surfaced so
  // the knife edges stay visible instead of failing silently on the next tweak
  const edges = new Set();
  for (const m of muscles) {
    if (EXPECTED_LOW.has(m)) continue;
    weekVol.forEach((v) => {
      if ((v[m] || 0) === MEV) edges.add(m);
    });
  }
  check('GOALS', 'every muscle is above MEV in every one of the 12 weeks', under.length === 0, under.slice(0, 3).join(', ') || (edges.size ? `at exactly MEV (watch): ${[...edges].join(', ')}` : ''));
  check('GOALS', 'no muscle is pushed into the wasteful band', over.length === 0, over.slice(0, 3).join(', '));
}
{
  // THE HYPERTROPHY TARGETS (2026-08-16 QA). MEV keeps a muscle alive; it
  // does not grow one. "Every week hits the threshold for hypertrophy" is
  // his ask, so the muscles he is chasing carry a real weekly floor —
  // triangle at 10+, 3-D support at 7+ (TARGETS in volume.js). Without this
  // check the next EMOM40 trade could quietly park chest at 8 and the build
  // would stay green.
  const under = [];
  const edges = new Set();
  for (const [m, floor] of Object.entries(TARGETS)) {
    weekVol.forEach((v, i) => {
      if ((v[m] || 0) < floor) under.push(`${m} wk${i + 1}=${v[m] || 0}<${floor}`);
      if ((v[m] || 0) === floor) edges.add(m);
    });
  }
  check(
    'GOALS',
    'every priority muscle hits its hypertrophy target in every week',
    under.length === 0,
    under.slice(0, 3).join(', ') ||
      (edges.size ? `at exactly target (watch): ${[...edges].join(', ')}` : ''),
  );
}
{
  // LATS RISE BY REPS now (2026-08-11): the anchor round steps died with the
  // EMOM40 cap, so the phase progression is Friday's pull-up reps (3 → 4 → 5)
  // — invisible to a set count, real in the rep count.
  // The quads-rise check is RETIRED: his stated goal is legs at MAINTENANCE
  // ("more cuts" is a body-fat outcome), and a check demanding quad growth
  // contradicted the goal it claimed to guard.
  const latRepsByWeek = [];
  for (let w = 1; w <= BLOCK_WEEKS; w++) {
    let reps = 0;
    for (const { w: ww, s, q } of allQueues()) {
      if (ww !== w || OPTIONAL.has(s.id)) continue;
      for (const st of q) {
        if (st.kind !== 'work' || !st.countsAsSet || st.phase === 'RAMP') continue;
        if (distillateSkip(s, st)) continue;
        if ((MAP[st.exId]?.lats || 0) < 1) continue;
        const n = Number.parseInt(String(st.reps ?? '').match(/\d+/)?.[0] ?? '', 10);
        if (n) reps += /\/(side|leg|arm)/.test(String(st.reps)) ? n * 2 : n;
      }
    }
    latRepsByWeek.push(reps);
  }
  const avgR = (ws) => ws.reduce((a, i) => a + latRepsByWeek[i - 1], 0) / ws.length;
  const latsUp = avgR([9, 10, 11, 12]) > avgR([1, 2, 3, 4]);
  check('GOALS', 'weekly lat REPS rise across the block (the V-taper gap closes)', latsUp, `${avgR([1, 2, 3, 4]).toFixed(0)} → ${avgR([9, 10, 11, 12]).toFixed(0)} reps/wk`);
}
{
  // athletic / powerful — the primer must survive every week
  const perWeek = [];
  for (let w = 1; w <= BLOCK_WEEKS; w++) {
    let n = 0;
    for (const { w: ww, q } of allQueues()) {
      if (ww !== w) continue;
      const BALLISTIC = ['broad-jump', 'power-pushup', 'pogo-hop'];
      // working jump sets only — warm-up hops are not a power session
      if (
        q.some(
          (st) =>
            (BALLISTIC.includes(st.exId) && st.countsAsSet) ||
            (st.amrapMembers || []).some((m) => BALLISTIC.includes(m.ex)),
        )
      )
        n += 1;
    }
    perWeek.push(n);
  }
  // A FLOOR, not an exact count (2026-08-15): the primer must survive every
  // week on the lift days; The Spring (tabata pogo) adds a third, tabata-
  // gated ballistic exposure on its weeks, which the pace rules govern.
  check('GOALS', 'the power primer runs at least twice a week, every week', perWeek.every((n) => n >= 2), `sessions/wk: ${[...new Set(perWeek)].join(',')}`);
}
{
  const hasEngine = !!getRehabSession('engine');
  const tested = [1, 4, 6, 8, 12].every((w) => testsForWeek(w).length > 0);
  check('GOALS', 'a conditioning session exists and the block is tested', hasEngine && tested, `engine ${hasEngine ? 'yes' : 'no'}, tests wk 1/4/6/8/12`);
}
{
  // the tests must be safe to actually max on
  const SAFE = new Set(['box-step-up', 'box-squat', 'push-up', 'pull-up-bw', 'farmer-carry']);
  const bad = [];
  for (const b of BENCHMARK_SESSIONS) {
    for (const st of buildStepQueue(b)) if (!SAFE.has(st.exId)) bad.push(`${b.id}/${st.exId}`);
  }
  check('GOALS', 'every benchmark movement fails somewhere that is not the spine', bad.length === 0, bad.join(', '));
}

// ── THE FUN PART ────────────────────────────────────────────────────────────
{
  const names = new Set();
  for (const item of WEEK_PLAN.flat()) {
    if (item.type === 'lift') names.add(getProgramSession(item.session).name);
  }
  check('VARIETY', 'three distinct lift days — no two repeat in a week', names.size === 3, [...names].join(' · '));
}
{
  // the back medicine is constant BY DESIGN (openers, the McGill primer —
  // doubled on core days since 2026-10-10 — and the folds): variety is
  // measured on the training around it, not on the medicine
  const MEDICINE = new Set([
    't-spine-reach',
    'couch-stretch',
    'hip-internal-rotation',
    'mcgill-curlup',
    'side-plank',
    'bird-dog',
    'elephant-walk',
    'seated-good-morning',
  ]);
  const sig = (w) => {
    const out = [];
    for (const { w: ww, q } of allQueues()) {
      if (ww !== w) continue;
      for (const st of q) {
        if (st.kind !== 'work' || MEDICINE.has(st.exId)) continue;
        out.push(`${st.exId}|${st.reps ?? st.secs}|${st.piece ?? ''}|${st.pieceFormat ?? ''}|${st.manual ? 'p' : 'c'}`);
      }
    }
    return out;
  };
  const sigs = [...Array(BLOCK_WEEKS)].map((_, i) => sig(i + 1));
  const pcts = [];
  for (let i = 1; i < sigs.length; i++) {
    const prev = new Set(sigs[i - 1]);
    pcts.push(sigs[i].filter((x) => !prev.has(x)).length / sigs[i].length);
  }
  const avg = Math.round((pcts.reduce((a, b) => a + b, 0) / pcts.length) * 100);
  check('VARIETY', 'every week feels meaningfully different from the last', avg >= 15, `${avg}% new week-to-week`);
}
{
  const fins = new Set();
  const fmts = new Set();
  for (const { s, q } of allQueues()) {
    // the day's finisher is the LAST piece-tagged step — the core cap that
    // now closes the rehab day carries no piece and must not count as one
    const fin = q.findLast((st) => st.piece)?.piece;
    if (sessionVariantCount(s) > 1 && fin) fins.add(fin);
    for (const st of q) if (st.pieceFormat) fmts.add(st.pieceFormat.replace(/\d+/g, 'N'));
  }
  // Every piece is uniquely named — a different set of movements is a different
  // workout — so the pool should cover a full four-week rotation on all three
  // days: twelve names, none repeated.
  // 12 lift pieces + 16 finishers (2026-08-15) — the floor tracks reality
  // so a silent pool shrink fails the build instead of passing at 12
  // The floor dropped 24 → 12 on 2026-10-10, deliberately: two of the three
  // weekly Back & Hips finishers became PUMPS of real sets (coach QA — "five
  // scored max efforts a week" for a sleep-deprived new dad), so the scored
  // pool is Wed's Tabata (4) + Sat's finisher (4) + Sunday's optional WOD (4).
  check('VARIETY', 'the named-piece pool covers a month on every day', fins.size >= 12 && fmts.size >= 3, `${fins.size} named pieces · ${fmts.size} formats`);
}

// ── THE RAMP (2026-09-21) ───────────────────────────────────────────────────
// What makes it a ramp and not just a short week: it CLIMBS (ramp 1 < ramp 2
// < the block's own day, on every lift day, in every rotation variant), and
// it asks for nothing scored or self-paced: no finisher, no for-time, no
// AMRAP, no death-by. The optional Bonus WOD stays opt-in and is not the
// ramp's ask.
{
  const bad = [];
  const seen = { 1: [], 2: [], full: [] };
  for (const s of DENSITY40_SESSIONS) {
    const base = applyPhase(s, 1);
    for (let v = 0; v < sessionVariantCount(base); v++) {
      const r1 = estimateSessionMins(applyRamp(base, 1), v);
      const r2 = estimateSessionMins(applyRamp(base, 2), v);
      const full = estimateSessionMins(applyFormats(base, v + 1), v);
      seen[1].push(r1);
      seen[2].push(r2);
      seen.full.push(full);
      if (!(r1 < r2 && r2 < full)) bad.push(`${s.id} v${v}: ${r1}/${r2}/${full} min`);
    }
  }
  const span = (a) => `${Math.min(...a)}–${Math.max(...a)}`;
  check(
    'RAMP',
    'the ramp climbs: ramp 1 < ramp 2 < the full day, on every lift day',
    bad.length === 0,
    bad.slice(0, 3).join(', ') ||
      `lift days: ramp 1 ${span(seen[1])} · ramp 2 ${span(seen[2])} · full ${span(seen.full)} min`,
  );
  const scored = [];
  for (const { w, s, q } of rampQueues()) {
    if (OPTIONAL.has(s.id)) continue;
    // on a rehab day only the finisher carries a piece name (the holds and
    // the core cap don't), and the scored EMOMs (The Arm Farm, The Porter,
    // The Complex) look like any other EMOM step, so ANY named piece there
    // is a finisher that leaked
    const rehabDay = !s.id.startsWith('d40');
    for (const st of q) {
      if (st.kind !== 'work') continue;
      if (
        st.amrap ||
        st.ladder ||
        st.bail ||
        (st.piece && !st.emom) ||
        (rehabDay && st.piece)
      ) {
        scored.push(`${w} ${s.id} ${st.piece || st.exId}`);
      }
    }
  }
  check(
    'RAMP',
    'the ramp serves nothing scored or self-paced',
    scored.length === 0,
    scored.slice(0, 3).join(', '),
  );
}

// ── THE SHORT DAY (2026-09-23) ──────────────────────────────────────────────
// Three properties make it worth having. It is SHORT (10–20 min — under the
// 20 he'd still skip after a bad night, over the 10 that is a token). It is
// still THAT DAY: the lift day keeps its anchor, the rehab day keeps all six
// fixed favorites, and both log under the same session id, so the calendar
// tick and the streak are honest. And it never touches the McGill core cap,
// whose 10-second holds at a 3-second re-brace ARE the protocol.
{
  // back-extension left the list 2026-10-10: it runs Tue + Sat only now
  // (physio QA), so it can't be a must-survive of every short day
  const FAVOURITES = [
    't-spine-reach',
    'hip-internal-rotation',
    'couch-stretch',
    'elephant-walk',
    'seated-good-morning',
  ];
  const bad = [];
  const capped = [];
  const thin = [];
  let lo = Infinity;
  let hi = 0;
  for (const { w, s, v, q } of shortQueues()) {
    if (OPTIONAL.has(s.id)) continue;
    const mins = estimateSessionMins(s, v);
    lo = Math.min(lo, mins);
    hi = Math.max(hi, mins);
    // ≤22 since the 45-minute cap (2026-10-11): phase 3's 6/5/5 McGill
    // primer is never scaled, and it alone pushes a short Tuesday past 20
    if (mins < 10 || mins > 22) bad.push(`${w} ${s.id} ${mins} min`);
    const ids = new Set(q.map((st) => st.exId));
    if (s.id.startsWith('d40')) {
      if (!q.some((st) => st.piece === 'The Anchor')) thin.push(`${w} ${s.id} no anchor`);
    } else if (s.id === 'daily' || s.id === 'sunday') {
      for (const ex of FAVOURITES) {
        if (!ids.has(ex)) thin.push(`${w} ${s.id} lost ${ex}`);
      }
    }
    // the core cap: 10s holds, never halved
    for (const b of s.blocks.flatMap((x) => x.rotate || [x])) {
      if (b?.mode === 'reps' && b.holdSecs !== 10) {
        capped.push(`${w} ${s.id} ${b.ex} ${b.holdSecs}s`);
      }
    }
  }
  check(
    'SHORT DAY',
    'every short day is 10–22 minutes — short enough to do, long enough to count',
    bad.length === 0,
    bad.slice(0, 3).join(', ') || `${lo}–${hi} min`,
  );
  check(
    'SHORT DAY',
    'a short day is still THAT day — the anchor stays, the six favourites stay',
    thin.length === 0,
    thin.slice(0, 3).join(', '),
  );
  check(
    'SHORT DAY',
    'the McGill core cap is never scaled',
    capped.length === 0,
    capped.slice(0, 3).join(', '),
  );
}

// ── Report ──────────────────────────────────────────────────────────────────
let failed = 0;
let area = '';
for (const r of results) {
  if (r.area !== area) {
    area = r.area;
    console.log(`\n${area}`);
  }
  if (!r.pass) failed += 1;
  console.log(`  ${r.pass ? '✓' : '✗ FAIL'}  ${r.name}${r.detail ? `\n         ${r.detail}` : ''}`);
}
console.log(
  failed
    ? `\n${failed} CHECK(S) FAILED\n`
    : `\nALL ${results.length} CHECKS PASS — across 12 weeks and 3 phases.\n`,
);
process.exit(failed ? 1 : 0);
