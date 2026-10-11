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
// What a phase changes now (2026-10-10): only members that declare
// `phaseReps` — no session uses it today; the bodyweight ladders (Monday's
// pull-up anchor, Friday's pull-ups and ring dips) step by WEEK instead
// (`weekReps`, applied in applyFormats). Legs grow since 2026-10-10 — the old
// "quads at maintenance" note no longer holds.
/**
 * Apply a phase's step to a session. Returns the session unchanged when no
 * member declares `phaseReps`, so callers can apply it unconditionally.
 * IDEMPOTENT: the target is absolute.
 */
export function applyPhase(session, phase) {
  // PHASE FIRST, DOSE SECOND, and never the other way round (round-4 physio
  // QA): the player re-applies the phase to a session the preview already
  // dosed, and a short day's halved back extension came back at 14 reps
  if (!session?.blocks || phase < 2 || session.dose) return session;
  let touched = false;
  const step = (v) => {
    // a single-exercise block (the back extension) steps by phase too
    // (round-3 physio QA: Back & Hips was identical in weeks 1 and 12)
    if (
      v &&
      !v.members &&
      (v.phaseHoldSecs?.[phase] ||
        v.phaseBlockReps?.[phase] ||
        v.phaseRepScheme?.[phase])
    ) {
      touched = true;
      return {
        ...v,
        ...(v.phaseHoldSecs?.[phase]
          ? { holdSecs: v.phaseHoldSecs[phase] }
          : {}),
        ...(v.phaseBlockReps?.[phase] ? { reps: v.phaseBlockReps[phase] } : {}),
        ...(v.phaseRepScheme?.[phase]
          ? { repScheme: v.phaseRepScheme[phase] }
          : {}),
      };
    }
    if (!v?.members?.some((m) => m.phaseReps?.[phase])) return v;
    touched = true;
    return {
      ...v,
      members: v.members.map((m) =>
        m.phaseReps?.[phase] ? { ...m, reps: m.phaseReps[phase] } : m,
      ),
    };
  };
  const blocks = session.blocks.map((b) =>
    b.rotate ? { ...b, rotate: b.rotate.map(step) } : step(b),
  );
  return touched ? { ...session, blocks } : session;
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
  // THE HEAVY WEEK (2026-09-27, his ask: "vary it, but it should hit the
  // same"). Same exercises, same sets, same forced rest — fewer reps under
  // more load, three seconds down on every one. Growth tracks hard sets taken
  // near failure across a wide rep range, so the stimulus holds; what changes
  // is how the week feels. Only loadable stations change (see heavyReps).
  'emom-heavy': { id: 'emom-heavy', label: 'EMOM · HEAVY', pace: 'forced' },
  // Self-paced rounds against a running clock. NO forced rest, so this is
  // gated by the per-piece allowlist below.
  fortime: { id: 'fortime', label: 'FOR TIME', pace: 'open' },
  // ── SET formats (2026-10-09, his ask: "bored of EMOM… something where I
  // can put more effort or control"). Supersets and giant sets with REAL,
  // timed rest — the format where a set can actually be taken close to
  // failure, which an EMOM's 20-second gaps never allow. Same exercises,
  // same set count every week; the week only changes how the sets feel.
  // Control: the reps as written, 3 seconds down, rest on the timer.
  sets: { id: 'sets', label: 'SETS', pace: 'forced' },
  // Load: ~70% of the reps under more weight, three seconds down.
  'sets-heavy': { id: 'sets-heavy', label: 'HEAVY', pace: 'forced' },
  // Effort: the last round keeps going until one rep before form breaks.
  'sets-repout': { id: 'sets-repout', label: 'LAST SET MAX', pace: 'forced' },
};

const REPOUT_NOTE =
  'LAST SET — keep going past the number until one rep before your form breaks. Log what you got.';
// bands and bodyweight log nothing, so there is nothing to "log what you got"
const REPOUT_NOTE_UNLOGGED =
  'LAST SET — keep going past the number until one rep before your form breaks.';

// A piece may only rotate through formats it declares. Anything self-paced
// requires every movement in the piece to fail somewhere that ISN'T the spine
// — because for-time removes the rest floor that makes EMOM safe here, and
// fatigue is what turns a hinged row or a one-hand carry into lumbar flexion.
export const OPEN_PACE_BANNED = [
  'cable-row-1arm', // hinged and loaded — degrades under an unpaced clock
  'chest-supported-row',
  'suitcase-carry', // one-hand carry is the MORE spine-expensive carry
  // 2026-10-10 (physio QA): a raced two-hand carry is still a raced pickup —
  // "the pickup is the hazard" — so carries run on a clock that rests them
  'farmer-carry',
  'overhead-triceps', // fatigue drives the lumbar arch the cue warns about
  'rdl',
  'front-squat',
  'rfe-split-squat',
  // every spine-loaded lift is off the open clock and off the rep-out
  // (round-3 physio QA: the RFE was banned, its DB cousin wasn't)
  'db-split-squat',
  'floor-press',
  'pull-up',
  'ring-dip', // fails at the shoulder — every dip stays strict (2026-10-09)
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
  // sprints (2026-10-10): top speed only on a clock that forces the walk back
  'sprint',
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
  // a rep-out week nobody in the piece may take is a label, not a format
  // (round-3 coach QA: Friday's Legs & Back said LAST SET MAX and did nothing)
  const repoutOk = members.some(
    (m) => !m.secs && !m.fixedReps && !OPEN_PACE_BANNED.includes(m.ex),
  );
  return declared.filter(
    (f) =>
      PIECE_FORMATS[f] &&
      (PIECE_FORMATS[f].pace === 'forced' || openOk) &&
      (f !== 'sets-repout' || repoutOk),
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

// Heavy-week reps: ~70% of the prescription, suffix kept ("6/side" → "4/side").
// 70%, not 75%, because every rep also gains a second on the way down — the
// verifier budgets heavy reps at (tempo + 1)s each against the same 75% of
// the minute. Small prescriptions (< 5) stay as written: dropping 3 to 2 is a
// token, not a heavy set.
export const HEAVY_EXTRA_SECS = 1;
export function heavyReps(reps) {
  const str = String(reps ?? '');
  const nums = str.match(/\d+/g);
  if (!nums) return null;
  const last = nums[nums.length - 1];
  const n = Number.parseInt(last, 10);
  if (n < 5) return null;
  const at = str.lastIndexOf(last);
  return `${str.slice(0, at)}${Math.round(n * 0.7)}${str.slice(at + last.length)}`;
}

// Which members a heavy week touches: something you can put more load on.
// Bands and bodyweight log no weight; timed work, the fixed-dose members
// (ballistics, the RDL hinge) and rep-logged bodyweight stay as written.
// The explosive DB lifts stay as written too: a push press is driven, not
// lowered for three seconds, and "heavier overhead" is not a lever this back
// program pulls.
// The strict pull-up too (2026-10-09): `logReps` lives on the exercise, not
// the slot, so a pulldown swapped to pull-ups looked loadable — and "fewer
// reps, more load" on a bar he can't yet load is just less work.
const HEAVY_EXCLUDED = [
  'db-push-press',
  'db-hang-clean-press',
  'db-hang-snatch',
  'pull-up-bw',
  // bodyweight, reps-logged — "fewer reps, more load" has no load to add
  'slider-leg-curl',
  // …and the ring row an athlete can swap in for a DB row (round-6 test QA)
  'ring-row',
];
export const heavyEligible = (m) =>
  !m.secs &&
  !m.fixedReps &&
  m.logWeight !== false &&
  !m.logReps &&
  !HEAVY_EXCLUDED.includes(m.ex);

/**
 * Rewrite a piece into the given format. Set count is never touched —
 * only how the sets are delivered.
 */
export function applyPieceFormat(block, formatId) {
  if (
    !block.members ||
    formatId === 'emom' ||
    formatId === 'sets' ||
    !PIECE_FORMATS[formatId]
  ) {
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
  if (formatId === 'emom-heavy' || formatId === 'sets-heavy') {
    return {
      ...block,
      formatLabel: PIECE_FORMATS[formatId].label,
      members: block.members.map((m) => {
        const reps = heavyEligible(m) ? heavyReps(m.reps) : null;
        return reps
          ? {
              ...m,
              // what the heavy week replaced — an amber or tired day puts it back
              baseReps: m.reps,
              ...(m.note ? { baseNote: m.note } : {}),
              reps,
              // an alt swapped in serves the heavy week too — same rule
              ...(m.alts
                ? {
                    alts: m.alts.map((a) => {
                      const r = heavyEligible(a) ? heavyReps(a.reps) : null;
                      // a bodyweight alt never inherits the slot's heavy flag
                      return r ? { ...a, reps: r } : { ...a, heavy: false };
                    }),
                  }
                : {}),
              heavy: true,
              // the load gate decides the weight (round-3 QA: the old "more
              // load than last time" contradicted a HOLD on a tired morning)
              note: 'Heavy week — fewer reps; go heavier when the app says TARGET. Slow on the way down.',
            }
          : m;
      }),
    };
  }
  if (formatId === 'sets-repout') {
    // Only members whose failure is SAFE take the rep-out: never a pinned
    // count (the hinge, the ballistics), never timed work. Same rule that
    // keeps them off an open clock — the last set of a giant set is the
    // closest thing to one this program serves.
    return {
      ...block,
      formatLabel: PIECE_FORMATS[formatId].label,
      members: block.members.map((m) =>
        m.secs || m.fixedReps || OPEN_PACE_BANNED.includes(m.ex)
          ? m
          : {
              ...m,
              lastRoundNote:
                m.logWeight === false ? REPOUT_NOTE_UNLOGGED : REPOUT_NOTE,
            },
      ),
    };
  }
  if (formatId === 'fortime') {
    // same rounds, same members — the clock just stops prescribing the rest
    return { ...block, mode: 'fortime', formatLabel: 'FOR TIME' };
  }
  return block;
}

/**
 * THE WEEKLY REP STEP (2026-10-10, coach QA: "the pull-up anchor never
 * progresses"). A member may carry `weekReps` (one prescription per block
 * week, wrapping) and `weekNotes` ({ week: note }). Single numbers, as he
 * asked — the app steps them, he never reads a range.
 */
function stepWeek(block, week) {
  if (!block?.members?.some((m) => m.weekReps)) return block;
  return {
    ...block,
    members: block.members.map((m) => {
      if (!m.weekReps) return m;
      const reps = m.weekReps[(week - 1) % m.weekReps.length];
      const note = m.weekNotes?.[week];
      return { ...m, reps, ...(note ? { note } : {}) };
    }),
  };
}

/**
 * Which format a piece runs in on a given block week. `formatOffset` staggers
 * two pieces on the same day so they don't change in lockstep — Monday's two
 * supersets never both go heavy the same week.
 */
export function pieceFormatFor(block, week) {
  const opts = formatsFor(block);
  if (opts.length < 2 || week == null) return opts[0] || 'emom';
  // WEEK 1 IS PLAIN (2026-10-10, physio QA): nothing is met for the first
  // time in a HEAVY or LAST-SET-MAX week — first exposure is technique load
  if (week === 1) return opts[0];
  return opts[(week - 1 + (block.formatOffset || 0)) % opts.length];
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
// THE EMOM DAY (2026-10-10, his ask: "a day in a week where it's still a
// full EMOM like before … constantly varied, as long as we hit everything").
// From week 2, one lift day a week runs every superset as an EMOM — same
// exercises, same sets, so every weekly target still holds; only the
// delivery changes. The day rotates Mon → Wed → Fri, so no two weeks share it.
// A minute that can't fit the work (a per-leg superset) runs on 90 s.
const EMOM_DAY_ORDER = ['d40-a1', 'd40-b1', 'd40-c1'];
export const isEmomDay = (sessionId, week) =>
  week != null && week >= 2 && EMOM_DAY_ORDER[(week - 2) % 3] === sessionId;
function emomShape(b) {
  if (!b?.isPiece || b.mode !== 'circuit' || b.warmup || !b.members) return b;
  const { formats, formatOffset, betweenSecs, restSecs, ...rest } = b;
  return {
    ...rest,
    mode: 'emom',
    formatLabel: 'EMOM',
    intervalSecs: 60,
    emomDay: true,
    members: b.members.map(({ lastRoundNote, ...m }) =>
      /\/(leg|side|arm)/.test(String(m.reps)) ? { ...m, intervalSecs: 90 } : m,
    ),
  };
}

export function applyFormats(session, week) {
  if (!session?.blocks || week == null) return session;
  const emom = isEmomDay(session.id, week);
  // the EMOM day keeps the piece's HEAVY week ("EMOM · HEAVY") — otherwise
  // the day's rotation landed on Wings' and the split squats' heavy weeks
  // every time and they never went heavy (round-7 test QA). A rep-out week
  // has no EMOM form (a max set doesn't fit a minute), so that one is plain.
  const emomPiece = (b) => {
    const heavy = pieceFormatFor(b, week) === 'sets-heavy';
    const shaped = emomShape(heavy ? applyPieceFormat(b, 'sets-heavy') : b);
    return heavy ? { ...shaped, formatLabel: 'EMOM · HEAVY' } : shaped;
  };
  const shape = (b) =>
    emom && b?.isPiece && b.mode === 'circuit' && !b.warmup
      ? stepWeek(emomPiece(b), week)
      : stepWeek(
          b?.formats?.length ? applyPieceFormat(b, pieceFormatFor(b, week)) : b,
          week,
        );
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
 * finisher and carry leave the session entirely; its pumps (`pump`) stay,
 * shaped down like any piece.
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
      const { formats, formatLabel, formatOffset, ...rest } = b;
      // Rounds come off the TOP, relative to the piece's own length: ramp 1
      // is two rounds short, ramp 2 one short (a 4-round EMOM lands on the
      // original 2 / 3). A 3-round giant set ramping to a fixed 3 would not
      // be a ramp at all.
      const rounds = Math.max(
        1,
        Math.min(r.pieceRounds, b.rounds - (RAMP_WEEKS + 1 - ramp)),
      );
      const members = b.members.map(
        ({ lastRoundNote, repsPerRound, ...m }) => ({
          ...m,
          note: m.note || RAMP_CUE,
        }),
      );
      // a superset keeps its own timed rests — it already has real air
      if (b.mode === 'circuit') return { ...rest, rounds, members };
      return {
        ...rest,
        mode: 'emom',
        rounds,
        roundRestSecs: RAMP_REST_SECS,
        members,
      };
    }
    return b;
  };
  return {
    ...session,
    ramp,
    blocks: session.blocks
      // the pumps stay, shaped down like every piece (round-3 coach QA: a
      // ramp Back & Hips day had less arm work than a short day)
      .filter((b) => !b.finisher || b.pump)
      .map((b) =>
        b.rotate ? { ...b, rotate: b.rotate.map(shape) } : shape(b),
      ),
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
// ── DOSES COMPOSE (2026-10-10, round-6 app QA: a short night on a short day
// saved dose 'tired', lost the 'short', and a refresh retired the run). A
// session's `dose` is now every dose applied, '+'-joined in the order they
// were applied ('short+tired'); every apply* checks its OWN part, so
// re-dosing a dosed session — the player and every restore path do — is a
// no-op, and the restored queue always matches the live one.
export const doseParts = (sessionOrDose) =>
  String(
    (typeof sessionOrDose === 'string' ? sessionOrDose : sessionOrDose?.dose) ||
      '',
  )
    .split('+')
    .filter(Boolean);
export const hasDose = (sessionOrDose, part) =>
  doseParts(sessionOrDose).includes(part);
const withDose = (session, part) =>
  [...doseParts(session).filter((p) => p !== part), part].join('+');

// ── THE UNCHECKED MORNING (round-6 physio QA) ───────────────────────────────
// Start without answering the back check and the riskiest work — the jumps,
// the sprints, the scored finishers — sits out until he taps. The volume
// stays: the lifts, the pumps, the medicine. Pure and idempotent.
export function applyUnchecked(session) {
  if (!session?.blocks || hasDose(session, 'unchecked')) return session;
  const shape = (b) =>
    b?.members ? { ...b, members: b.members.filter((m) => !m.ballistic) } : b;
  return {
    ...session,
    dose: withDose(session, 'unchecked'),
    blocks: session.blocks
      .filter((b) => !b.ballistic && !b.conditioning && !b.prime)
      .map((b) =>
        b.rotate ? { ...b, rotate: b.rotate.map(shape) } : shape(b),
      ),
  };
}

export const SHORT = { pieceRounds: 1, anchorSets: 2, holdFloorSecs: 60 };

/**
 * The ~15-minute version of a session. Pure, and IDEMPOTENT via `dose` —
 * halving an already-halved hold would quietly turn the medicine into a
 * token, and every restore path re-applies this to a rebuilt session.
 * Safe on top of a ramp week: the rounds are absolute, the finisher is
 * already gone, and the holds it halves are ones the ramp never touched.
 */
export function applyShort(session) {
  if (
    !session?.blocks ||
    hasDose(session, 'short') ||
    hasDose(session, 'amber')
  )
    return session;
  const shape = (b) => {
    if (!b) return b;
    if (b.anchor) {
      return { ...b, rounds: (b.warmupRounds || 0) + SHORT.anchorSets };
    }
    if (b.isPiece) {
      const { formats, formatLabel, formatOffset, roundRestSecs, ...rest } = b;
      return {
        ...rest,
        mode: b.mode === 'circuit' ? 'circuit' : 'emom',
        rounds: SHORT.pieceRounds,
        // a bad night (or a deload) is no day for a heavy week or a max set
        members: b.members
          .filter((m) => !m.ballistic)
          .map((m) => {
            const { lastRoundNote, repsPerRound, ...rest } = unHeavy(m);
            return rest;
          }),
      };
    }
    // the warm-up keeps its shape, minus anything ballistic (the pogo)
    if (b.members) {
      return { ...b, members: b.members.filter((m) => !m.ballistic) };
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
    dose: withDose(session, 'short'),
    blocks: session.blocks
      // the supporting cast, the scored finisher and the lift day's power
      // work (primer or EMOM — nothing ballistic after a bad night or in a
      // deload) are what a short day spends its minutes on first — all
      // flagged at the source. The warm-up STAYS: a short day after a
      // bad night is exactly the day not to start cold.
      .filter(
        (b) =>
          (!b.finisher || b.shortKeep) && !b.cast && !b.prime && !b.ballistic,
      )
      .map((b) =>
        b.rotate ? { ...b, rotate: b.rotate.map(shape) } : shape(b),
      ),
  };
}

// Undo a heavy week on one member: the reps and note it replaced come back.
function unHeavy(m) {
  if (!m?.heavy) return m;
  const { heavy, baseReps, baseNote, note, ...rest } = m;
  return {
    ...rest,
    reps: baseReps ?? rest.reps,
    ...(baseNote ? { note: baseNote } : {}),
  };
}

// Strip everything that pushes effort or impact, keep the shape. Shared by
// the amber and tired days.
function calmBlocks(blocks, swap) {
  const member = (m) => {
    const plain = unHeavy(m);
    const { lastRoundNote, ...rest } = plain;
    return swap ? swap(rest) : rest;
  };
  const shape = (b) => {
    if (!b) return b;
    if (swap && b.amberBlock) return b.amberBlock;
    if (!b.members) return swap ? swap(b) : b;
    const { formats, formatOffset, ...rest } = b;
    return {
      ...rest,
      // an EMOM-day piece stays an EMOM on a calm day — the label follows
      // the clock it actually runs on (round-6 QA)
      ...(b.isPiece
        ? { formatLabel: b.mode === 'emom' ? 'EMOM' : 'SETS' }
        : {}),
      members: b.members.filter((m) => !m.ballistic).map(member),
    };
  };
  return (
    blocks
      .filter((b) => !b.ballistic && !b.prime)
      // a tired day keeps the Tue/Thu pumps — they ARE that day's volume; only
      // the scored finishers and the carry go. (Amber arrives already short,
      // so its pumps are gone before this runs.)
      .filter((b) => !b.finisher || b.pump)
      .filter((b) => !(swap && b.amberDrop))
      .map((b) => (b.rotate ? { ...b, rotate: b.rotate.map(shape) } : shape(b)))
  );
}

// ── THE AMBER DAY — the back is talking (2026-10-10, physio + coach QA) ─────
// The morning check says "stiffer than usual". Not a rest day — a lighter
// one: the short dose; nothing ballistic or scored; no heavy week, no rep-out;
// and every movement that loads the spine in a way a stiff back won't like
// swaps (`amberEx`): the RDL and the split squats become glute bridges, the
// front squat a DB split squat, the empty-bar warm-up a box squat, the back
// extension a short hold (`amberBlock`), the RDL ramp goes (`amberDrop`),
// and the held forward folds go (`fold`).
// Loads ease in the player, from the last NON-eased session (main.js).
// Pure and IDEMPOTENT via `dose`, like applyShort.
export function applyAmber(session) {
  if (!session?.blocks || hasDose(session, 'amber')) return session;
  const base = hasDose(session, 'short') ? session : applyShort(session);
  const swap = (m) => {
    const { amberEx, amberReps, amberNote, amberBlock, amberDrop, ...rest } = m;
    if (!amberEx) return rest;
    // the old move's cue goes with it ("elbows high" on a box squat is a lie)
    const { alts, fixedReps, effort, note, warmupNote, ...plain } = rest;
    return {
      ...plain,
      ex: amberEx,
      reps: amberReps ?? plain.reps,
      ...(amberNote ? { note: amberNote } : {}),
    };
  };
  return {
    ...base,
    // amber implies the short day — it REPLACES 'short' in the label
    dose: withDose(
      {
        dose: doseParts(base)
          .filter((p) => p !== 'short')
          .join('+'),
      },
      'amber',
    ),
    // a stiff back skips the held forward folds outright (round-3 physio QA)
    blocks: calmBlocks(base.blocks, swap).filter((b) => !b.fold),
  };
}

// ── THE MORNING RULE (2026-10-10, round-3 physio QA) ─────────────────────────
// Within an hour of waking the discs are fully hydrated and bending stress
// peaks. The morning check's "UP < 1 HR" drops the held forward folds
// (`fold`) and, on a lift day, swaps the loaded hinge for its amber bridge
// and drops its ramp (`morning`). Pure and idempotent.
export const hasMorningWork = (session) =>
  !!session?.blocks?.some(
    (b) =>
      b.fold ||
      b.morning ||
      (b.rotate || [b]).some((v) => v?.members?.some((m) => m.morning)),
  );
export function applyNoFolds(session) {
  if (!hasMorningWork(session)) return session;
  const swap = (m) => {
    if (!m?.morning || !m.amberEx) return m;
    const {
      amberEx,
      amberReps,
      amberNote,
      morning,
      alts,
      fixedReps,
      effort,
      note,
      warmupNote,
      ...rest
    } = m;
    return {
      ...rest,
      ex: amberEx,
      reps: amberReps ?? rest.reps,
      ...(amberNote ? { note: amberNote } : {}),
    };
  };
  // a `morning` block with a hold version serves the hold (Saturday's back
  // extension); one without (the RDL ramp) just sits out
  const shape = (b) =>
    b?.morning && b.amberBlock
      ? b.amberBlock
      : b?.members
        ? { ...b, members: b.members.map(swap) }
        : b;
  return {
    ...session,
    blocks: session.blocks
      .filter((b) => !b.fold && !(b.morning && !b.amberBlock))
      .map((b) =>
        b.rotate ? { ...b, rotate: b.rotate.map(shape) } : shape(b),
      ),
  };
}

// ── THE TIRED DAY — a short night, a fine back (2026-10-10, physio QA) ───────
// Under five hours of sleep hurts repeated efforts and raises pain
// sensitivity, but nothing is wrong with the back. So the SHAPE stays — every
// block, the pumps included, one round lighter and a rep further from failure;
// what goes is impact and maxing: no jumps or push press, no scored finisher
// or carry, no heavy week, no rep-out. Loads hold (the load gate needs a Good morning).
export function applyTired(session) {
  if (!session?.blocks || hasDose(session, 'tired')) return session;
  // AND LIGHTER (round-3 QA, coach + physio: "slept under 5 h changed nothing
  // on Tue/Thu"): one round off every piece and pump (never below one), one
  // more rep in the tank on every working set, one set off the anchor.
  const easier = (e) => (/2–3/.test(e || '') ? '3–4 LEFT' : '2–3 LEFT');
  const shape = (b) => {
    // the anchor drops one working set too (round-4 coach QA: a short night
    // kept every axial set and cut the accessories — the wrong way round)
    if (b?.anchor) {
      const warm = b.warmupRounds || 0;
      return { ...b, rounds: Math.max(warm + 2, b.rounds - 1) };
    }
    if (!b?.isPiece || b.warmup) return b;
    return {
      ...b,
      rounds: Math.max(1, (b.rounds || 1) - 1),
      members: b.members.map((m) => ({ ...m, effort: easier(m.effort) })),
    };
  };
  return {
    ...session,
    dose: withDose(session, 'tired'),
    blocks: calmBlocks(session.blocks).map((b) =>
      b.rotate ? { ...b, rotate: b.rotate.map(shape) } : shape(b),
    ),
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
