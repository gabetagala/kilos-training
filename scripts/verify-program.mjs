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
  applyFormats,
  applyPhase,
  descendingReps,
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
  WASTEFUL,
} from '../src/workout/volume.js';
import {
  REHAB_EXERCISES,
  buildStepQueue,
  estimateSessionMins,
  getRehabSession,
  sessionVariantCount,
} from '../src/workout/rehab.js';

const results = [];
const check = (area, name, pass, detail = '') =>
  results.push({ area, name, pass, detail });

// Every (week → session → fully-resolved queue) the athlete can actually meet.
function* allQueues() {
  for (let w = 1; w <= BLOCK_WEEKS; w++) {
    const ph = phaseOf(w);
    const sw = phaseSwaps(ph);
    for (const item of WEEK_PLAN.flat()) {
      let s = null;
      if (item.type === 'lift') {
        s = applyFormats(applyPhase(getProgramSession(item.session), ph), w);
      } else if (item.type === 'rehab') {
        s = getRehabSession(item.session || 'daily');
      }
      if (!s) continue;
      const v = sessionVariantCount(s) > 1 ? w - 1 : 0;
      yield { w, s, q: buildStepQueue(s, sw, v) };
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
// The ONE documented carve-out, added 2026-08-10 with the CrossFit movements.
// It is an allowlist rather than a softened pattern so the ban itself stays
// intact and the exception stays greppable: a barbell snatch, a from-the-floor
// snatch, or anything else matching NEVER is still a build failure.
//
// Why this one is allowed: it is a HANG variant with a single light DB. The
// hinge stops above the knee, the spine stays neutral, and it is in
// OPEN_PACE_BANNED so it can never run on a self-paced clock. Delete this line
// and the movement to put the rule back exactly as it was.
const NEVER_ALLOW = new Set(['db-hang-snatch']);
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
];
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
      for (const b of shaped.blocks) {
        if (b.mode !== 'fortime') continue;
        for (const m of b.members || []) {
          if (OPEN_PACE_BANNED.includes(m.ex)) bad.push(`wk${w} ${s.id} ${m.ex}`);
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
const ANCHOR_IDS = new Set(anchorSpecs().map(({ b }) => b.members[0].ex));

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
    const before = q
      .slice(0, firstAnchor)
      .filter((st) => st.countsAsSet && st.logWeight === true);
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
      const floor = SPINE_LOADED.includes(cand.ex) ? 180 : 120;
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
  for (const s of DENSITY40_SESSIONS) {
    for (const b of s.blocks) {
      for (const v of b.rotate || [b]) {
        for (const m of v?.members || []) {
          if (!UNILATERAL_TIMED.has(m.ex)) continue;
          if (!/right side first/i.test(m.note || '')) {
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
  for (const s of DENSITY40_SESSIONS) {
    for (const b of s.blocks) {
      for (const v of b.rotate || [b]) {
        if (v?.mode !== 'emom') continue;
        const interval = v.intervalSecs ?? 60;
        const desc = (v.formats || []).includes('emom-desc');
        for (const m of v.members || []) {
          if (m.secs != null && m.secs > interval * 0.75) {
            bad.push(`${s.id} ${v.name} ${m.ex} ${m.secs}s work in ${interval}s`);
          }
          for (const cand of [m, ...(m.alts || [])]) {
            const tempo = tempoOf(cand.ex);
            const reps = totalReps(cand.reps);
            if (!tempo || !reps) continue;
            if (reps * tempo > interval * 0.75) {
              bad.push(`${s.id} ${v.name} ${cand.ex} ${reps * tempo}s of work in ${interval}s`);
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
  check('RESTRICTIONS', 'every station fits inside its minute, descending weeks included', bad.length === 0, bad.slice(0, 3).join(', '));
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
  for (const s of [...DENSITY40_SESSIONS, ...BENCHMARK_SESSIONS]) {
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

// OPEN PACE IS UNREACHABLE for any slot that could serve a banned movement —
// including via a persisted swap. This is the property that makes the
// db-hang-snatch carve-out from the NEVER list safe: its EMOM-only claim is
// enforced by formatsFor, and this proves formatsFor actually enforces it
// (the list guarded nothing while no piece declared an open format).
{
  const bad = [];
  for (const s of DENSITY40_SESSIONS) {
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
// a lift, a rehab day is the 48-minute back program, and the ceiling is now
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
          mins += estimateSessionMins(s, sessionVariantCount(s) > 1 ? w - 1 : 0);
        } else if (item.type === 'rehab' && !item.session) {
          hasRehab = true;
          mins += estimateSessionMins(getRehabSession('daily'));
        }
      }
      if (hasLift && hasRehab) stacked.push(`wk${w} ${DAYS[d]}`);
      if (!mins) return;
      if (mins > longest) {
        longest = mins;
        where = `wk${w} ${DAYS[d]}`;
      }
      shortest = Math.min(shortest, mins);
    });
  }
  // 58, and the estimate is deliberately PESSIMISTIC at the top end: a day
  // that peaks here is one carrying the death-by ladder, whose queue ceiling
  // is 10 minutes but which actually ends at failure — usually inside 5. The
  // honest read of a 57 is "about 52".
  check(
    'RESTRICTIONS',
    'no required day exceeds the 58-minute ceiling',
    longest <= 58,
    `longest ${longest} min (${where})`,
  );
  // The floor, not a band. A for-time week is legitimately shorter than an
  // EMOM week — same sets, no forced rest, you just move faster — so pinning
  // the SPREAD would punish exactly the format variety this program wants.
  // What actually matters is that no required day shrinks into a token effort.
  check(
    'RESTRICTIONS',
    'no required day shrinks below 35 minutes',
    shortest >= 35,
    `${shortest}–${longest} min`,
  );
  check(
    'RESTRICTIONS',
    'the 48-minute rehab never stacks on a lift day',
    stacked.length === 0,
    stacked.slice(0, 3).join(', '),
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
{
  const used = new Set();
  for (const { s, q } of allQueues()) {
    if (HYPERTROPHY_EXEMPT.has(s.id) || OPTIONAL.has(s.id)) continue;
    for (const st of q) {
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

const weekVol = [];
for (let w = 1; w <= BLOCK_WEEKS; w++) {
  const t = {};
  for (const { w: ww, s, q } of allQueues()) {
    if (ww !== w || HYPERTROPHY_EXEMPT.has(s.id) || OPTIONAL.has(s.id)) continue;
    for (const st of q) {
      if (st.kind !== 'work' || !st.countsAsSet || st.phase === 'RAMP') continue;
      for (const [m, f] of Object.entries(MAP[st.exId] || {})) t[m] = (t[m] || 0) + f;
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
  check('GOALS', 'every muscle is above MEV in every one of the 12 weeks', under.length === 0, under.slice(0, 3).join(', '));
  check('GOALS', 'no muscle is pushed into the wasteful band', over.length === 0, over.slice(0, 3).join(', '));
}
{
  const avg = (m, ws) => ws.reduce((a, i) => a + (weekVol[i - 1][m] || 0), 0) / ws.length;
  const p1 = [1, 2, 3, 4];
  const p3 = [9, 10, 11, 12];
  const latsUp = avg('lats', p3) > avg('lats', p1);
  const quadsUp = avg('quads', p3) > avg('quads', p1);
  check('GOALS', 'lats rise across the block (the V-taper gap closes)', latsUp, `${avg('lats', p1).toFixed(1)} → ${avg('lats', p3).toFixed(1)}`);
  check('GOALS', 'quads rise across the block (the other gap closes)', quadsUp, `${avg('quads', p1).toFixed(1)} → ${avg('quads', p3).toFixed(1)}`);
}
{
  // athletic / powerful — the primer must survive every week
  const perWeek = [];
  for (let w = 1; w <= BLOCK_WEEKS; w++) {
    let n = 0;
    for (const { w: ww, q } of allQueues()) {
      if (ww !== w) continue;
      if (q.some((st) => ['broad-jump', 'power-pushup', 'pogo-hop'].includes(st.exId))) n += 1;
    }
    perWeek.push(n);
  }
  check('GOALS', 'the power primer runs twice a week, every week', perWeek.every((n) => n === 2), `sessions/wk: ${[...new Set(perWeek)].join(',')}`);
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
  const sig = (w) => {
    const out = [];
    for (const { w: ww, q } of allQueues()) {
      if (ww !== w) continue;
      for (const st of q) {
        if (st.kind !== 'work') continue;
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
    if (sessionVariantCount(s) > 1) fins.add(q.at(-1).piece);
    for (const st of q) if (st.pieceFormat) fmts.add(st.pieceFormat.replace(/\d+/g, 'N'));
  }
  // Every piece is uniquely named — a different set of movements is a different
  // workout — so the pool should cover a full four-week rotation on all three
  // days: twelve names, none repeated.
  check('VARIETY', 'the named-piece pool covers a month on every day', fins.size >= 12 && fmts.size >= 3, `${fins.size} named pieces · ${fmts.size} formats`);
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
    : `\nALL ${results.length} CHECKS PASS — across 12 weeks, 3 phases, 12 named pieces and 2 formats.\n`,
);
process.exit(failed ? 1 : 0);
