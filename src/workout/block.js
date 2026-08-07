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
const PHASE_SWAPS = {
  1: {},
  2: {
    'db-lateral-raise': 'cable-lateral-raise',
    'cable-row-1arm': 'chest-supported-row',
    'hammer-curl': 'supinated-curl',
    'supinated-curl': 'hammer-curl',
    'rope-pushdown': 'overhead-triceps',
    'band-fly': 'cable-fly-low',
  },
  3: {
    // NO lateral-raise swap here, deliberately. Mapping db-lateral-raise →
    // band-lateral-raise collided with "Popeye", which already carries a band
    // lateral as a separate member: the piece served the same movement twice
    // per round, dropped the only LOADED (weight-logged) side-delt movement
    // for the last third of the block, and left the "drop the weight ~30%"
    // cue pointing at a band. Side delts are a stated V-taper priority, so
    // phase 3 keeps the DB version. The rotation is still DB → cable → DB.
    'hammer-curl': 'reverse-curl',
    'supinated-curl': 'reverse-curl',
  },
};

export const phaseSwaps = (phase) => ({ ...(PHASE_SWAPS[phase] || {}) });

// ── Phase volume steps ──────────────────────────────────────────────────────
// The audit in BLOCK-01.md §1 found exactly two gaps for a V-taper: lats and
// quads both at 7 fractional sets, the modest end of the productive range.
// These close them, and nothing else changes.
//
// Set progression is the least-evidenced part of the plan — Enes 2024, the only
// direct 12-week test, found stepped increases neutral for hypertrophy and
// better for strength. So the steps are deliberately small and targeted.
const LAT_STEP_MEMBER = {
  ex: 'lat-pulldown',
  reps: '8–12',
};

/**
 * Apply a phase's volume step to a session. Returns the session unchanged
 * when the phase doesn't touch it, so callers can apply it unconditionally.
 */
export function applyPhase(session, phase) {
  if (!session || phase < 2) return session;

  // Phase 2+ — lats 7 → 10. A third movement in "The Spread" (the Monday
  // piece), which is where a pulldown belongs anyway.
  if (session.id === 'd40-a1') {
    return {
      ...session,
      blocks: session.blocks.map((b) => {
        if (b.mode !== 'emom' || b.name !== 'The Spread') return b;
        // IDEMPOTENT: the player applies the phase to a session the session
        // list may already have phased. Adding the member twice would double
        // the lat step and desync the printed plan.
        if (b.members.some((m) => m.ex === LAT_STEP_MEMBER.ex)) return b;
        return { ...b, members: [...b.members, LAT_STEP_MEMBER] };
      }),
    };
  }

  // Phase 3 — quads 7 → 9. Two more split-squat sets rather than a new
  // movement: it's the slot already carrying the single-leg quad work, and
  // adding sets keeps the load history continuous.
  if (phase >= 3 && session.id === 'd40-b1') {
    return {
      ...session,
      blocks: session.blocks.map((b) =>
        b.ex === 'rfe-split-squat' && b.mode === 'lift'
          ? { ...b, sets: 5 }
          : b,
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
];

/** Formats this piece may legally rotate through, safety applied. */
export function formatsFor(block) {
  const declared = block.formats?.length ? block.formats : ['emom'];
  const members = block.members || [];
  const openOk = !members.some((m) => OPEN_PACE_BANNED.includes(m.ex));
  return declared.filter(
    (f) => PIECE_FORMATS[f] && (PIECE_FORMATS[f].pace === 'forced' || openOk),
  );
}

// Rep ranges are strings ("12–20", "8–12/side"). Pull the numbers out so a
// descending scheme can walk from the top of the range to the bottom.
const repBounds = (reps) => {
  const n = String(reps ?? '').match(/\d+/g);
  if (!n) return null;
  const lo = Number.parseInt(n[0], 10);
  const hi = Number.parseInt(n[n.length - 1], 10);
  return hi > lo ? [lo, hi] : [lo, lo];
};

/** Reps for each round of a descending scheme: top of range down to bottom. */
export function descendingReps(reps, rounds) {
  const b = repBounds(reps);
  if (!b || rounds < 2) return null;
  const [lo, hi] = b;
  if (hi === lo) return null;
  return Array.from({ length: rounds }, (_, i) =>
    Math.round(hi - ((hi - lo) * i) / (rounds - 1)),
  );
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
        const per = m.secs ? null : descendingReps(m.reps, block.rounds);
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

/** Apply the week's format to every piece in a session. */
export function applyFormats(session, week) {
  if (!session?.blocks || week == null) return session;
  return {
    ...session,
    blocks: session.blocks.map((b) =>
      b.formats?.length ? applyPieceFormat(b, pieceFormatFor(b, week)) : b,
    ),
  };
}

/**
 * Everything the app needs to serve a day correctly, from one date.
 * `null` week (no block started) resolves to phase 1 and no tests, so the
 * program still runs — a block is an overlay on the week, not a gate on it.
 */
export function blockState(startISO, now = new Date()) {
  const week = currentWeek(startISO, now);
  const clamped = week == null ? null : Math.min(week, BLOCK_WEEKS);
  const phase = clamped == null ? 1 : phaseOf(clamped);
  return {
    week,
    weekInBlock: clamped,
    phase,
    phaseName: PHASE_NAMES[phase],
    swaps: phaseSwaps(phase),
    tests: clamped == null ? [] : testsForWeek(clamped),
    deloadCheckpoint: clamped != null && isDeloadCheckpoint(clamped),
    complete: week != null && week > BLOCK_WEEKS,
  };
}
