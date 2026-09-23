// BLOCK 01 — the 12-week training block. Pure, no DOM, no storage.
// Unit-tested in tests/unit/block.test.js. Full rationale in BLOCK-01.md.
//
// Everything in BLOCK-01.md used to be a document the athlete had to obey by
// hand: swap these accessories at week 5, add lat sets, run these tests, decide
// about a deload. This module is what makes the app know what week it is, so
// the program serves the right thing instead of serving week 1 forever.
//
// WHAT A PHASE IS, HONESTLY: three 4-week phases are an ORGANISING device, not
// a physiological mechanism — volume-equated meta-analysis puts periodized vs
// non-periodized hypertrophy at ES ~0.13, which is negligible. The phases earn
// their keep as clean windows for rotating accessories and stepping volume,
// not because 12 weeks of steady work would fail.

export const BLOCK_WEEKS = 12;

// Which benchmarks run in which week. Cadence is set by NOISE, not enthusiasm:
// Fight Gone Bad's SEM is 6% — the only published noise floor for a metcon —
// so a hard test needs 6+ weeks to beat measurement error, while the
// submaximal step test is cheap and clean enough to run monthly.
export const TEST_WEEKS = {
  1: ['bm-three', 'bm-descent', 'bm-control'],
  4: ['bm-control'],
  6: ['bm-three', 'bm-descent'],
  8: ['bm-control'],
  12: ['bm-three', 'bm-descent', 'bm-control'],
};

// A CHECKPOINT, NOT A DATE. Coleman et al. 2024 gave trained lifters a 1-week
// deload mid-program and it NEGATIVELY affected lower-body strength with no
// hypertrophy benefit. Bell et al. reframe the planned deload as a moment to
// decide, not a mandatory cut. So these weeks ask; they don't impose.
export const DELOAD_CHECKPOINTS = [4, 8];

export const PHASE_NAMES = { 1: 'BUILD', 2: 'PRESS', 3: 'PEAK' };

export const phaseOf = (week) => (week <= 4 ? 1 : week <= 8 ? 2 : 3);
export const isTestWeek = (week) => !!TEST_WEEKS[week];
export const testsForWeek = (week) => TEST_WEEKS[week] || [];
export const isDeloadCheckpoint = (week) => DELOAD_CHECKPOINTS.includes(week);

const DAY_MS = 86400000;

/** Monday of the week containing `d` (weeks start Monday, like the app). */
export function mondayOf(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

/**
 * Which week of the block `now` falls in, 1-based.
 * Returns null when no block has started. Past week 12 it keeps counting —
 * the caller decides whether that means "block over" or "running long",
 * because a missed week shouldn't silently reset someone's progress.
 */
export function currentWeek(startISO, now = new Date()) {
  if (!startISO) return null;
  const start = mondayOf(new Date(startISO));
  const here = mondayOf(now);
  const weeks = Math.round((here - start) / (7 * DAY_MS));
  return weeks < 0 ? null : weeks + 1;
}

/** The Monday a given block week begins on. */
export function weekStart(startISO, week) {
  const d = mondayOf(new Date(startISO));
  d.setDate(d.getDate() + (week - 1) * 7);
  return d;
}

// ── Phase 2/3 accessory rotation ────────────────────────────────────────────
// Expressed as a SWAPS MAP rather than duplicated session data, because the
// swap mechanism already exists, is tested, and only honours alternates the
// program sanctioned for that slot — a phase can never smuggle in an exercise
// the slot didn't allow.
//
// Why rotate at all: Baz-Valle 2019 randomised exercise selection every single
// session for 8 weeks and found NO hypertrophy cost, but bench 1RM progressed
// +4.7% (fixed) vs +0.77% (varied). Rotation costs strength TRACKING, not
// muscle. And Fonseca 2014 found varied-exercise groups grew all four
// quadriceps heads where constant groups missed some. So: rotate what you
// don't measure, never rotate what you do. The three anchors never appear here.
// RETIRED 2026-08-10, deliberately empty. Phase-boundary accessory swaps made
// sense when sessions were fixed; every slot is now a 4-deep pool that rotates
// WEEKLY — strictly more variety than a swap at week 5 ever delivered. Worse,
// a swap keyed on one exercise only half-applied: 'db-lateral-raise → cable'
// hit the weeks the pool happened to serve the DB version and missed the rest,
// so a phase changed some weeks of a rotation and not others. The map's shape
// (and phaseSwaps()) survives because the same channel carries the athlete's
// own persisted swap choices — see getSwaps() in main.js.
const PHASE_SWAPS = { 1: {}, 2: {}, 3: {} };

export const phaseSwaps = (phase) => ({ ...(PHASE_SWAPS[phase] || {}) });

// ── Phase volume steps ──────────────────────────────────────────────────────
// MOSTLY RETIRED (2026-08-11, EMOM40). The old steps added a fifth anchor
// round at weeks 5/9 — minutes the 40-cap doesn't have. Set progression was
// always the least-evidenced part of the plan (Enes 2024: stepped increases
// neutral for hypertrophy, better for strength), so what survives is the one
// step that costs zero seconds: Friday's strict-pull-up reps, 3 → 4 → 5 —
// the lat step, delivered in reps. The quads gap is ACCEPTED at maintenance:
// his stated goal ("legs are already good; minimal") — a check demanding quad
// growth contradicted the goal it claimed to guard.
/**
 * Apply a phase's volume step to a session. Returns the session unchanged
 * when the phase doesn't touch it, so callers can apply it unconditionally.
 *
 * THE ANCHOR ROUND STEPS ARE RETIRED (2026-08-11, EMOM40): a fifth anchor
 * round costs 2-3 minutes and the 40-minute cap has none to give. Anchor
 * progression is load (+2.5 per exposure) and, on the pull day, reps —
 * neither needs a longer clock. The ONE surviving phase step costs zero
 * seconds: Friday's strict-pull-up station steps 3 → 4 → 5 reps, because the
 * Monday anchor drives his pull-up strength up all block and a fixed 3 would
 * decay into warm-up grade while the audit kept crediting full lat sets.
 * IDEMPOTENT: the target is absolute.
 */
export function applyPhase(session, phase) {
  if (!session || phase < 2) return session;

  if (session.id === 'd40-c1') {
    const reps = phase >= 3 ? '5' : '4';
    const step = (v) =>
      v?.members && v.members.length > 1
        ? {
            ...v,
            members: v.members.map((m) =>
              m.ex === 'pull-up-bw' ? { ...m, reps } : m,
            ),
          }
        : v;
    return {
      ...session,
      blocks: session.blocks.map((b) =>
        b.rotate ? { ...b, rotate: b.rotate.map(step) } : step(b),
      ),
    };
  }

  return session;
}

// ── Format rotation ─────────────────────────────────────────────────────────
// THE ONE KIND OF WEEK-TO-WEEK VARIETY THAT IS FREE.
//
// Changing the EXERCISE is expensive: Baz-Valle 2019 randomised selection every
// session and found no hypertrophy cost but bench 1RM progressing +4.7%
// (fixed) vs +0.77% (varied). Rotation costs you strength TRACKING.
//
// Changing the FORMAT costs nothing measurable. Same movement, same rounds,
// same members — so the set count per muscle is bit-identical and the load
// history stays continuous, because it's still the same exercise. All that
// changes is how the work is delivered, which is the part that felt stale.
//
// The invariant every format must preserve: rounds × members = the same
// number of sets per movement. tests/unit/block.test.js proves it.
export const PIECE_FORMATS = {
  // Forced rest — finish the reps, rest the remainder of the minute. The
  // default, and the only one allowed on movements that degrade dangerously.
  emom: { id: 'emom', label: 'EMOM', pace: 'forced' },
  // Same forced rest, but reps step DOWN as the piece goes on: hardest set
  // while freshest. Same number of sets.
  'emom-desc': { id: 'emom-desc', label: 'EMOM ↓', pace: 'forced' },
  // Self-paced rounds against a running clock. NO forced rest, so this is
  // gated by the per-piece allowlist below.
  fortime: { id: 'fortime', label: 'FOR TIME', pace: 'open' },
};

// A piece may only rotate through formats it declares. Anything self-paced
// requires every movement in the piece to fail somewhere that ISN'T the spine
// — because for-time removes the rest floor that makes EMOM safe here, and
// fatigue is what turns a hinged row or a one-hand carry into lumbar flexion.
export const OPEN_PACE_BANNED = [
  'cable-row-1arm', // hinged and loaded — degrades under an unpaced clock
  'chest-supported-row',
  'suitcase-carry', // one-hand carry is the MORE spine-expensive carry
  'overhead-triceps', // fatigue drives the lumbar arch the cue warns about
  'rdl',
  'front-squat',
  'rfe-split-squat',
  'floor-press',
  'pull-up',
  // Added 2026-08-10 with the CrossFit movements. All three are loaded and
  // overhead or unilateral; EMOM's forced rest is exactly what keeps them
  // honest, and an open clock is exactly what would not.
  'db-push-press',
  'db-hang-snatch', // the hang range only survives while the pace is capped
  'db-front-rack-lunge',
  // Added 2026-08-14 with the rehab finishers: the ballistics as a CLASS.
  // Their dose is quality-capped ("crisp reps, never near fatigue") and a
  // score-incentivized open clock is the exact opposite of that rule.
  'power-pushup',
  'broad-jump',
  'pogo-hop',
  // The hang clean & press rides the SAME carve-out terms as the hang
  // snatch (2026-08-15): above the knee, light DBs, and only where the
  // clock forces rest.
  'db-hang-clean-press',
  // Added 2026-08-15 (finisher research, McGill lens): lateral landings add
  // a shear/rotation component that degrades with fatigue — skater bounds
  // are 20-second-burst work, tabata/EMOM only, never an open grind.
  'skater-bound',
];

/** Formats this piece may legally rotate through, safety applied. */
export function formatsFor(block) {
  const declared = block.formats?.length ? block.formats : ['emom'];
  const members = block.members || [];
  // A banned ALT closes the door too: the athlete's swap choices persist
  // across weeks, so an open-pace week must be impossible for every movement
  // the slot could legally be serving, not just the one it serves by default.
  const pool = members.flatMap((m) => [m, ...(m.alts || [])]);
  const openOk = !pool.some((m) => OPEN_PACE_BANNED.includes(m.ex));
  return declared.filter(
    (f) => PIECE_FORMATS[f] && (PIECE_FORMATS[f].pace === 'forced' || openOk),
  );
}

// REP RANGES ARE GONE (2026-08-10, his call): every slot prescribes ONE number,
// because "8–12" makes you decide mid-set and the decision is always the low
// end. So a descending piece can no longer walk a range — it steps down one
// rep per round CENTERED ON the prescription: "10" over five rounds runs
// 12, 11, 10, 9, 8. Hardest set while freshest, same intent as before.
//
// Centered, not starting AT the number, because a descent from N delivers
// 19–30% fewer reps than N-every-round — a silent dose cut every other week
// that no set-counting audit could see. Centering keeps odd round-counts
// volume-EXACT and even ones within 2 reps. The top round is N + lead, which
// is why the verifier budgets every station's minute at the DESCENDING top,
// not just the prescription.
//
// The suffix is preserved, so "6/side" descends as "7/side, 6/side, 5/side".
// A member with `fixedReps: true` (the ballistic primer, the snatch, the
// hinge) never descends — its dose is quality- or symptom-capped, and
// "hardest set while freshest" is exactly the wrong idea there.
export function descendingReps(reps, rounds) {
  const str = String(reps ?? '');
  const nums = str.match(/\d+/g);
  if (!nums || rounds < 2) return null;
  const n = Number.parseInt(nums[nums.length - 1], 10);
  const at = str.lastIndexOf(nums[nums.length - 1]);
  const suffix = str.slice(at + nums[nums.length - 1].length);
  const lead = Math.floor((rounds - 1) / 2);
  const top = n + lead;
  // A prescription smaller than the round count can't fall one per round and
  // still look like the same workout — it runs flat instead.
  if (n < rounds || top - (rounds - 1) < 1) return null;
  return Array.from({ length: rounds }, (_, i) => `${top - i}${suffix}`);
}

/**
 * Rewrite a piece into the given format. Set count is never touched —
 * only how the sets are delivered.
 */
export function applyPieceFormat(block, formatId) {
  if (!block.members || formatId === 'emom' || !PIECE_FORMATS[formatId]) {
    return block;
  }
  if (formatId === 'emom-desc') {
    return {
      ...block,
      formatLabel: 'EMOM ↓',
      members: block.members.map((m) => {
        const per =
          m.secs || m.fixedReps ? null : descendingReps(m.reps, block.rounds);
        return per ? { ...m, repsPerRound: per } : m;
      }),
    };
  }
  if (formatId === 'fortime') {
    // same rounds, same members — the clock just stops prescribing the rest
    return { ...block, mode: 'fortime' };
  }
  return block;
}

/** Which format a piece runs in on a given block week. */
export function pieceFormatFor(block, week) {
  const opts = formatsFor(block);
  if (opts.length < 2 || week == null) return opts[0] || 'emom';
  return opts[(week - 1) % opts.length];
}

/**
 * Apply the week's format to every piece in a session.
 *
 * MUST REACH THROUGH `rotate` POOLS. Every quartet became a pool on 2026-08-10
 * and a pool wrapper carries no `formats` of its own, so a version of this that
 * only looked at the top-level block found nothing to rewrite and silently
 * served plain EMOM in all 12 weeks — with the safety tests still passing,
 * because "no self-paced piece contains a banned movement" is trivially true
 * when no piece is ever self-paced. Caught by an e2e that read the week-3
 * overview and found EMOM where FOR TIME should have been.
 */
export function applyFormats(session, week) {
  if (!session?.blocks || week == null) return session;
  const shape = (b) =>
    b?.formats?.length ? applyPieceFormat(b, pieceFormatFor(b, week)) : b;
  return {
    ...session,
    blocks: session.blocks.map((b) =>
      b.rotate ? { ...b, rotate: b.rotate.map(shape) } : shape(b),
    ),
  };
}

// ── THE RAMP — coming back after time off (2026-09-21, his ask) ─────────────
// Sick, then weeks of broken nights with a newborn: the block kept counting
// (week 7) while he trained a handful of times, and his first sessions back
// left him gassed. A restart puts TWO RAMP WEEKS in front of a fresh week 1.
//
// WHAT THE RAMP CUTS, AND WHY THAT AND NOT LOAD: a few weeks off costs
// conditioning well before it costs strength. Strength and muscle hold for
// ~3 weeks of no training (McMaster 2013; Ogasawara 2013 had 3-week breaks
// regain their ground within weeks), while VO2max and work capacity fall 4–14%
// in 2–4 weeks (Mujika & Padilla 2000). Sleep loss hits the same place:
// repeated-effort and endurance work suffer more than a single heavy set
// (Craven 2022). The gassing lives in the piece's density — 32 minutes
// straight, no rest minute — so the ramp cuts ROUNDS and gives back the REST
// MINUTE between trips. The anchor's long clock was never what gassed him.
// Its sets drop by one in ramp week 1, and the load target starts ~10% under
// his last (see rampWeight in progression.js).
//
//   ramp 1 — two trips through the piece, a rest minute between (~50%)
//   ramp 2 — three trips, same rest (~75%)
//   week 1 — the full block, forty minutes, and the week-1 tests
//
// NO SCORES IN THE RAMP. The rehab-day finishers exist to test his top heart
// rate, and a score set while detrained becomes the LAST he races for a month.
// So the ramp's rehab days are the holds and the core cap, and the benchmarks
// wait for week 1, when a baseline means something.
//
// WHY THE RAMP SITS BEFORE WEEK 1 AND NOT INSIDE IT: the 12-week block is the
// audited unit. Every week clears MEV, the 30-minute floor, and the week-1 vs
// week-12 test comparison. Putting half-rounds into weeks 1–2 would make all
// three untrue. In front of the block, the ramp is a separate overlay with its
// own checks in verify-program.mjs, and the block stays as designed.
export const RAMP_WEEKS = 2;
export const RAMP = {
  1: { pieceRounds: 2, anchorSets: 3 },
  2: { pieceRounds: 3, anchorSets: 4 },
};
// His original pre-EMOM40 spec: a full minute off between trips.
export const RAMP_REST_SECS = 60;

const RAMP_CUE = 'Ramp week — leave every station with something left.';

/**
 * Where a restarted block's week 1 begins: the Monday RAMP_WEEKS after this
 * one. A restart late in the week (Fri–Sun) buys one more week, so ramp week
 * 1 has real training days in it and doesn't end after a single rest day.
 */
export function restartStartISO(now = new Date()) {
  const late = [5, 6, 0].includes(new Date(now).getDay());
  const d = mondayOf(now);
  d.setDate(d.getDate() + (RAMP_WEEKS + (late ? 1 : 0)) * 7);
  return d.toISOString();
}

/**
 * The block week `now` falls in, WITHOUT currentWeek()'s null for "not
 * started": 0 is the week before week 1, -1 the one before that. Used by the
 * ramp, which is the only thing that lives before week 1.
 */
export function rawWeek(startISO, now = new Date()) {
  if (!startISO) return null;
  const weeks = Math.round(
    (mondayOf(now) - mondayOf(new Date(startISO))) / (7 * DAY_MS),
  );
  return weeks + 1;
}

/**
 * Which ramp week (1..rampLen) `now` falls in, or null. Only a block that was
 * started WITH a ramp has one: `rampLen` is 0 for the first-install block,
 * whose pre-start days keep their old "train whatever, nothing counts" terms.
 * A late-week restart puts ramp week 1 more than RAMP_WEEKS out, so it clamps.
 */
export function rampWeek(startISO, rampLen, now = new Date()) {
  if (!rampLen) return null;
  const w = rawWeek(startISO, now);
  if (w == null || w >= 1) return null;
  return Math.max(1, rampLen + w);
}

/**
 * The week the ROTATIONS read. Ramp weeks sit where weeks 11–12 of the
 * previous cycle would, so they serve pieces he won't meet again in week 1,
 * and every pool depth (4, 8, 16) divides the 12- and 48-step offsets, so the
 * rotation stays continuous across the join. Never negative — a negative
 * index is an undefined rotate slot.
 */
export const rotationWeek = (w) =>
  w == null ? null : w <= 0 ? w + BLOCK_WEEKS : w;

/**
 * Scale a session for a ramp week. Pure. Pieces (the blocks that declare
 * `formats` — only lift-day pieces do) lose rounds, gain the rest minute and
 * run as plain EMOM: no descending opener, no for-time week, nothing that
 * removes forced rest. The anchor drops a set in ramp 1. The daily's scored
 * finisher (`finisher: true`) leaves the session entirely.
 */
export function applyRamp(session, ramp) {
  const r = RAMP[ramp];
  if (!session?.blocks || !r) return session;
  const shape = (b) => {
    if (!b) return b;
    if (b.anchor) {
      return { ...b, rounds: (b.warmupRounds || 0) + r.anchorSets };
    }
    if (b.isPiece) {
      const { formats, formatLabel, ...rest } = b;
      return {
        ...rest,
        mode: 'emom',
        rounds: r.pieceRounds,
        roundRestSecs: RAMP_REST_SECS,
        members: b.members.map(({ lastRoundNote, repsPerRound, ...m }) => ({
          ...m,
          note: m.note || RAMP_CUE,
        })),
      };
    }
    return b;
  };
  return {
    ...session,
    ramp,
    blocks: session.blocks
      .filter((b) => !b.finisher)
      .map((b) => (b.rotate ? { ...b, rotate: b.rotate.map(shape) } : shape(b))),
  };
}

// ── THE SHORT DAY — for the nights the baby won (2026-09-23, his ask) ───────
// "A short version of each day for bad nights so I can still work out."
//
// The point is NEVER-MISS-TWICE, not a training effect. A session you skip
// costs more than a session you shrink: the streak, the habit, and the next
// day's decision. So every day has a ~15-minute version that still counts as
// that day — same movements, same order, same session id in history.
//
// It is also a defensible dose rather than a token: roughly a third of normal
// volume maintains strength and size for weeks in trained lifters (Bickel
// 2011; Spiering 2021 on maintenance dosing), and sleep loss hits repeated
// efforts hardest (Craven 2022) — which is exactly what gets cut here.
//
//   lift day  — anchor 2 sets, ONE trip through the piece (~13–16 min)
//   rehab day — the long holds at half duration, no supporting cast, no
//               finisher, and the McGill core cap UNTOUCHED (~14 min)
//
// THE CORE CAP IS NEVER SCALED: 10-second holds at a 3-second re-brace are
// the protocol, and half of a McGill hold is not a McGill hold. The halving
// is scoped to the LONG positional holds (60s+), which is where the minutes
// actually are — and where "break when you must" is already the rule.
export const SHORT = { pieceRounds: 1, anchorSets: 2, holdFloorSecs: 60 };

/**
 * The ~15-minute version of a session. Pure, and IDEMPOTENT via `dose` —
 * halving an already-halved hold would quietly turn the medicine into a
 * token, and every restore path re-applies this to a rebuilt session.
 * Safe on top of a ramp week: the rounds are absolute, the finisher is
 * already gone, and the holds it halves are ones the ramp never touched.
 */
export function applyShort(session) {
  if (!session?.blocks || session.dose === 'short') return session;
  const shape = (b) => {
    if (!b) return b;
    if (b.anchor) {
      return { ...b, rounds: (b.warmupRounds || 0) + SHORT.anchorSets };
    }
    if (b.isPiece) {
      const { formats, formatLabel, roundRestSecs, ...rest } = b;
      return {
        ...rest,
        mode: 'emom',
        rounds: SHORT.pieceRounds,
        members: b.members.map(({ lastRoundNote, repsPerRound, ...m }) => m),
      };
    }
    // the long positional holds — half the clock, never below a minute
    if (b.mode === 'hold' && b.holdSecs >= SHORT.holdFloorSecs) {
      return {
        ...b,
        holdSecs: Math.max(
          SHORT.holdFloorSecs,
          Math.round(b.holdSecs / 2 / 10) * 10,
        ),
      };
    }
    // the t-spine reach is repped, not held — halve the reps instead
    if (b.mode === 'tempo' && b.reps >= 8) {
      return { ...b, reps: Math.ceil(b.reps / 2) };
    }
    return b;
  };
  return {
    ...session,
    dose: 'short',
    blocks: session.blocks
      // the supporting cast and the scored finisher are what a short day
      // spends its minutes on first — both are flagged at the source
      .filter((b) => !b.finisher && !b.cast)
      .map((b) => (b.rotate ? { ...b, rotate: b.rotate.map(shape) } : shape(b))),
  };
}

/**
 * The newer of two synced block records ({ start, setAt, ramp }) — last
 * writer wins by when the restart was made, never by which start is later: a
 * fresh device's auto-seed is a later Monday and must not reset a running
 * block. Pure; null-safe.
 */
export function newerBlock(a, b) {
  if (!a?.start) return b?.start ? b : null;
  if (!b?.start) return a;
  return new Date(b.setAt) > new Date(a.setAt) ? b : a;
}

/**
 * Everything the app needs to serve a day correctly, from one date.
 * `null` week (no block started) resolves to phase 1 and no tests, so the
 * program still runs — a block is an overlay on the week, not a gate on it.
 * `rampLen` > 0 marks a block started WITH a ramp (a restart); inside its
 * ramp weeks `ramp` is 1..rampLen and the rotations read `rotWeek`.
 */
export function blockState(startISO, now = new Date(), rampLen = 0) {
  const week = currentWeek(startISO, now);
  const clamped = week == null ? null : Math.min(week, BLOCK_WEEKS);
  const phase = clamped == null ? 1 : phaseOf(clamped);
  const ramp = rampWeek(startISO, rampLen, now);
  return {
    week,
    weekInBlock: clamped,
    ramp,
    rotWeek: ramp ? rotationWeek(rawWeek(startISO, now)) : week,
    phase,
    phaseName: ramp ? 'RAMP' : PHASE_NAMES[phase],
    swaps: phaseSwaps(phase),
    tests: clamped == null ? [] : testsForWeek(clamped),
    deloadCheckpoint: clamped != null && isDeloadCheckpoint(clamped),
    complete: week != null && week > BLOCK_WEEKS,
  };
}
