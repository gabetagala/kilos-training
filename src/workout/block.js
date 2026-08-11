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
// The audit in BLOCK-01.md §1 found exactly two gaps for a V-taper: lats and
// quads both at 7 fractional sets, the modest end of the productive range.
// These close them, and nothing else changes.
//
// Set progression is the least-evidenced part of the plan — Enes 2024, the only
// direct 12-week test, found stepped increases neutral for hypertrophy and
// better for strength. So the steps are deliberately small and targeted.
// REWRITTEN 2026-08-10 for the quartet sessions. The old steps bolted an extra
// member onto a named piece and added sets to a fixed split-squat block. Both
// assumed a block was a plain object; every varying slot is now a
// `{ rotate: [...] }` pool, so a step has to reach THROUGH the pool and land on
// all four variants — otherwise it silently applies in week 5 and vanishes in
// week 6, which is worse than not stepping at all.
//
// The step is a fifth WORKING anchor round — one more three-minute interval of
// real work. Build rounds are not touched: warming up more is not a volume step. Two reasons it lands there rather
// than on a quartet: a quartet round costs five minutes (four stations plus the
// rest minute) and would push the day past its ceiling, while an anchor set
// costs about two and a half; and the anchor is the one slot with a continuous
// load history, so adding sets there is the step whose effect is measurable.
// Set progression is the least-evidenced part of the plan — Enes 2024, the only
// direct 12-week test, found stepped increases neutral for hypertrophy and
// better for strength — so the step stays small and lands where strength lives.
// `working` is the target number of WORKING rounds — build rounds sit on top,
// and they differ per lift, so the step has to be expressed in the thing it
// actually means rather than in a total that would silently vary by day.
const steppedAnchor = (block, working) => {
  const bump = (spec) =>
    spec?.anchor
      ? // IDEMPOTENT: the player phases a session the session list may already
        // have phased, and a second bump would desync the printed plan.
        {
          ...spec,
          rounds: Math.max(spec.rounds, (spec.warmupRounds || 0) + working),
        }
      : spec;
  return block.rotate
    ? { ...block, rotate: block.rotate.map(bump) }
    : bump(block);
};

/**
 * Apply a phase's volume step to a session. Returns the session unchanged
 * when the phase doesn't touch it, so callers can apply it unconditionally.
 */
export function applyPhase(session, phase) {
  if (!session || phase < 2) return session;

  // Phase 2+ — the pull day's anchor goes to 5 sets. Every variant of that
  // slot is a vertical pull or a row, so this is the lat step.
  if (session.id === 'd40-a1') {
    return {
      ...session,
      blocks: session.blocks.map((b) => steppedAnchor(b, 5)),
    };
  }

  // Phase 3 — the squat day's anchor goes to 5 sets. Every variant of that
  // slot is a squat or a split squat, so this is the quad step.
  if (phase >= 3 && session.id === 'd40-b1') {
    return {
      ...session,
      blocks: session.blocks.map((b) => steppedAnchor(b, 5)),
    };
  }

  // Phase 2+ — Friday's strict-pull-up station steps 3 → 4 → 5 reps. The
  // Monday anchor drives his pull-up strength up all block; a fixed 3 would
  // decay into warm-up grade while the volume audit kept crediting full lat
  // sets. Reps, not rounds: the station's minute has room (5 reps ≈ 20s) and
  // the piece's length must not move. IDEMPOTENT: the target is absolute.
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
