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
  TARGETS,
  WASTEFUL,
} from '../src/workout/volume.js';
import {
  REHAB_EXERCISES,
  REHAB_SESSIONS,
  buildStepQueue,
  estimateSessionMins,
  getRehabSession,
  sessionVariantCount,
} from '../src/workout/rehab.js';

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
        yield { w, d, s, q: buildStepQueue(s, sw, v) };
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
          if (SPINE_LOADED.includes(m.ex)) bad.push(`${s.id} ${v.name} ${m.ex} spine-loaded`);
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
          mins += estimateSessionMins(s, sessionVariantCount(s) > 1 ? w - 1 : 0);
        } else if (item.type === 'rehab' && !item.session) {
          hasRehab = true;
          // the day's REAL variant — toppers differ slightly in length
          mins += estimateSessionMins(
            getRehabSession('daily'),
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
            mins += estimateSessionMins(
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
  // EMOM40 (2026-08-11): the promise is 40:00 of CLOCK work; the ceiling is
  // 41 to absorb the two 10-second get-set steps the wall clock also spends.
  check(
    'RESTRICTIONS',
    'every day fits the EMOM40 promise (40:00 clock, ceiling 41 with preps)',
    longest <= 41,
    `longest ${longest} min (${where})`,
  );
  // The floor, not a band. A for-time week is legitimately shorter than an
  // EMOM week — same sets, no forced rest, you just move faster — so pinning
  // the SPREAD would punish exactly the format variety this program wants.
  // What actually matters is that no required day shrinks into a token effort.
  check(
    'RESTRICTIONS',
    'no required training day shrinks below 30 minutes (Sunday rests)',
    shortest >= 30,
    `${shortest}–${longest} min`,
  );
  check(
    'RESTRICTIONS',
    'the rehab day never stacks on a lift day',
    stacked.length === 0,
    stacked.slice(0, 3).join(', '),
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

const weekVol = [];
for (let w = 1; w <= BLOCK_WEEKS; w++) {
  const t = {};
  for (const { w: ww, s, q } of allQueues()) {
    if (ww !== w || HYPERTROPHY_EXEMPT.has(s.id) || OPTIONAL.has(s.id)) continue;
    for (const st of q) {
      if (distillateSkip(s, st)) continue;
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
      if (
        q.some(
          (st) =>
            BALLISTIC.includes(st.exId) ||
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
  check('VARIETY', 'the named-piece pool covers a month on every day', fins.size >= 24 && fmts.size >= 3, `${fins.size} named pieces · ${fmts.size} formats`);
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
