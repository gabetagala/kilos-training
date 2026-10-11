import { describe, expect, it } from 'vitest';
import {
  applyPhase,
  BLOCK_WEEKS,
  isEmomDay,
  blockState,
  currentWeek,
  DELOAD_CHECKPOINTS,
  isDeloadCheckpoint,
  isTestWeek,
  mondayOf,
  phaseOf,
  phaseSwaps,
  applyAmber,
  applyFormats,
  applyPieceFormat,
  applyShort,
  applyTired,
  descendingReps,
  formatsFor,
  heavyReps,
  pieceFormatFor,
  OPEN_PACE_BANNED,
  TEST_WEEKS,
  testsForWeek,
  weekStart,
} from '../../src/workout/block.js';
import {
  BENCHMARK_SESSIONS,
  DENSITY40_SESSIONS,
  getProgramSession,
  PROGRAM_EXERCISES,
} from '../../src/workout/program.js';
import {
  buildStepQueue,
  estimateSessionSecs,
  getRehabSession,
  sessionBlocks,
  sessionOverview,
} from '../../src/workout/rehab.js';

const MON = '2026-08-10T00:00:00.000Z'; // a Monday

describe('block weeks', () => {
  it('counts weeks from the block start, Monday-anchored', () => {
    expect(currentWeek(MON, new Date('2026-08-10T09:00:00'))).toBe(1);
    expect(currentWeek(MON, new Date('2026-08-16T23:00:00'))).toBe(1); // Sunday
    expect(currentWeek(MON, new Date('2026-08-17T06:00:00'))).toBe(2);
    expect(currentWeek(MON, new Date('2026-10-26T06:00:00'))).toBe(12);
  });

  it('handles a mid-week start by snapping to that week Monday', () => {
    // starting on a Wednesday still makes that whole week week 1
    expect(currentWeek('2026-08-12T00:00:00.000Z', new Date('2026-08-10T08:00:00'))).toBe(1);
    expect(currentWeek('2026-08-12T00:00:00.000Z', new Date('2026-08-17T08:00:00'))).toBe(2);
  });

  it('returns null before the block starts and keeps counting after it ends', () => {
    expect(currentWeek(null)).toBeNull();
    expect(currentWeek(MON, new Date('2026-08-01'))).toBeNull();
    // past 12 it must NOT wrap — a long block shouldn't silently reset progress
    expect(currentWeek(MON, new Date('2026-11-09'))).toBe(14);
  });

  it('mondayOf and weekStart agree', () => {
    expect(mondayOf(new Date('2026-08-15')).getDay()).toBe(1);
    expect(weekStart(MON, 1).toDateString()).toBe(mondayOf(new Date(MON)).toDateString());
    expect(weekStart(MON, 5).getDay()).toBe(1);
  });
});

describe('phases', () => {
  it('splits 12 weeks into three 4-week phases', () => {
    expect([1, 2, 3, 4].map(phaseOf)).toEqual([1, 1, 1, 1]);
    expect([5, 6, 7, 8].map(phaseOf)).toEqual([2, 2, 2, 2]);
    expect([9, 10, 11, 12].map(phaseOf)).toEqual([3, 3, 3, 3]);
  });

  it('phase 1 changes nothing — it is the program as written', () => {
    expect(phaseSwaps(1)).toEqual({});
    for (const s of DENSITY40_SESSIONS) expect(applyPhase(s, 1)).toBe(s);
  });

  // Rotation is only safe because it never touches what's being measured.
  it('never rotates the three anchors', () => {
    // the FIXED anchors since 2026-10-10 (main.js ANCHOR_IDS)
    const ANCHORS = ['pull-up-bw', 'front-squat', 'incline-db-press'];
    for (const p of [1, 2, 3]) {
      for (const from of Object.keys(phaseSwaps(p))) {
        expect(ANCHORS, `phase ${p} swaps ${from}`).not.toContain(from);
      }
    }
  });

  it('only ever swaps to an alternate the slot actually sanctioned', () => {
    // a phase must not be able to smuggle in an exercise the program didn't
    // allow for that slot — the swap layer enforces it, this proves the maps
    // are consistent with it
    for (const p of [2, 3]) {
      for (const [from, to] of Object.entries(phaseSwaps(p))) {
        expect(PROGRAM_EXERCISES[to], `${to} is not a known exercise`).toBeTruthy();
        const usedSomewhere = DENSITY40_SESSIONS.some((s) =>
          JSON.stringify(s).includes(`"${from}"`),
        );
        expect(usedSomewhere, `${from} isn't in any session`).toBe(true);
      }
    }
  });

  // The step is a fifth ANCHOR set (2026-08-10) — see block.js for why it moved
  // off the quartets. The anchor rotates, so the assertion has to hold for
  // every variant, not just the one week 1 happens to serve.
  // The anchor is its own named piece on a 3-minute clock now, so its sets are
  // its rounds — and reading them by piece name keeps a quartet that happens to
  // serve the same movement out of the count.
  // Round 3: the pair (laterals in the anchor's rest) rides the same piece
  // and counts as its own set — it is not an anchor set, so it is read apart.
  const anchorQueue = (id, phase, variant) =>
    buildStepQueue(applyPhase(getProgramSession(id), phase), {}, variant).filter(
      (s) => s.piece === 'The Anchor' && s.countsAsSet,
    );
  const anchorSets = (id, phase, variant) =>
    anchorQueue(id, phase, variant).filter((s) => !s.pair).length;
  const pairSets = (id, phase, variant) =>
    anchorQueue(id, phase, variant).filter((s) => s.pair).length;

  // The anchor ROUND steps are retired (2026-08-11, EMOM40): a fifth round
  // costs minutes the 40-cap doesn't have. Phases must leave the anchors
  // alone — progression there is load and reps, not clock length.
  // Round 2 (2026-10-10): Friday's incline press runs 1 build + 3 working
  // sets — its own count, but still one a phase never moves.
  // Round 3: Monday's pull-ups run FIVE working sets (no build round), and
  // Monday and Friday carry a lateral-raise PAIR on every working round —
  // one pair per working set, none on Wednesday's squat.
  it('phases leave the anchor round-counts alone, in every variant', () => {
    const SETS = { 'd40-a1': 5, 'd40-b1': 4, 'd40-c1': 3 };
    const PAIRS = { 'd40-a1': 5, 'd40-b1': 0, 'd40-c1': 3 };
    for (const [id, n] of Object.entries(SETS)) {
      for (const v of [0, 1, 2, 3]) {
        for (const ph of [1, 2, 3]) {
          expect(anchorSets(id, ph, v), `${id} p${ph} v${v}`).toBe(n);
          expect(pairSets(id, ph, v), `${id} pair p${ph} v${v}`).toBe(PAIRS[id]);
        }
      }
    }
  });

  // Friday's strict pull-ups used to step by PHASE (4 → 5 → 6, `phaseReps`).
  // Round 2 (2026-10-10) moved them onto the WEEKLY ladder (`weekReps`,
  // 4,4,5,5,6,6,7,7,7,7,8,8) — a rep under Monday's — so a phase no longer
  // touches any session. The fixed count still can't decay into warm-up grade:
  // the week steps it instead, with the set count unchanged.
  // Round 5: the one lift-day phase step is Friday's JUMPS — skater bounds
  // 3 → 4 a side from phase 2, broad jumps 3 → 4 in phase 3 — same rounds,
  // same sets. Monday and Wednesday are untouched by any phase.
  it('phases step only Friday\'s jumps — Monday and Wednesday are untouched', () => {
    for (const id of ['d40-a1', 'd40-b1']) {
      const s = getProgramSession(id);
      for (const p of [1, 2, 3]) expect(applyPhase(s, p), `${id} p${p}`).toBe(s);
    }
    const fri = getProgramSession('d40-c1');
    expect(applyPhase(fri, 1)).toBe(fri);
    const jumps = (p) => applyPhase(fri, p).blocks.find((b) => b.name === 'Jumps');
    expect(jumps(2).members.map((m) => m.reps)).toEqual(['3', '4/side']);
    expect(jumps(3).members.map((m) => m.reps)).toEqual(['4', '4/side']);
    // same rounds and sets, still pinned (never descended or maxed)
    for (const p of [2, 3]) {
      expect(jumps(p).rounds).toBe(3);
      expect(jumps(p).members.every((m) => m.fixedReps)).toBe(true);
      const q = buildStepQueue(applyPhase(fri, p)).filter((st) => st.piece === 'Jumps');
      expect(q, `p${p}`).toHaveLength(6);
    }
    // the broad jump says to ease into it
    expect(fri.blocks.find((b) => b.name === 'Jumps').members[0].note).toMatch(
      /Weeks 1–2 at about 80%/,
    );
  });

  // PHASE FIRST, DOSE SECOND (round 5): the player re-applies the phase to a
  // session the preview already dosed — that must never undo the dose
  it('applyPhase is a no-op on an already-dosed session', () => {
    const daily = getRehabSession('daily');
    const fri = getProgramSession('d40-c1');
    for (const dosed of [
      applyShort(daily),
      applyAmber(daily),
      applyTired(daily),
      applyShort(fri),
      applyTired(fri),
    ]) {
      for (const p of [2, 3]) expect(applyPhase(dosed, p), `${dosed.dose} p${p}`).toBe(dosed);
    }
    // the right order still phases first, then doses
    const right = applyShort(applyPhase(daily, 3));
    const thuHold = buildStepQueue(right, {}, 1).find(
      (st) => st.exId === 'back-extension' && st.kind === 'work',
    );
    expect(thuHold.secs).toBe(40);
  });

  it('steps the Friday pull-ups by week (4,4,5,5,6,6,7,7,7,7,8,8), sets unchanged', () => {
    const pulls = (w) =>
      buildStepQueue(applyFormats(applyPhase(getProgramSession('d40-c1'), phaseOf(w)), w)).filter(
        (s) => s.exId === 'pull-up-bw' && !s.anchor && s.countsAsSet,
      );
    const reps = Array.from({ length: 12 }, (_, i) => pulls(i + 1)[0].reps);
    expect(reps).toEqual(['4', '4', '5', '5', '6', '6', '7', '7', '7', '7', '8', '8']);
    for (let w = 1; w <= 12; w++) {
      const p = pulls(w);
      expect(p, `wk${w}`).toHaveLength(3);
      expect(new Set(p.map((x) => x.reps)).size, `wk${w}`).toBe(1);
    }
  });

  it('the phaseReps mechanism still steps a member that declares it', () => {
    const s = {
      id: 'x',
      blocks: [
        {
          mode: 'circuit',
          rounds: 3,
          members: [
            { ex: 'pull-up-bw', reps: '4', phaseReps: { 2: '5', 3: '6' } },
            { ex: 'push-up', reps: '10' },
          ],
        },
      ],
    };
    expect(applyPhase(s, 1)).toBe(s);
    expect(applyPhase(s, 2).blocks[0].members[0].reps).toBe('5');
    expect(applyPhase(s, 3).blocks[0].members[0].reps).toBe('6');
    // idempotent, and the other member is left alone
    expect(applyPhase(applyPhase(s, 3), 3).blocks[0].members[0].reps).toBe('6');
    expect(applyPhase(s, 3).blocks[0].members[1].reps).toBe('10');
    expect(applyPhase(s, 3).blocks[0].rounds).toBe(3);
  });

  // ROUND 4: Back & Hips stops being identical in weeks 1 and 12 — the back
  // extension steps by PHASE: Thursday's hold 30 → 35 → 40 s, Saturday's
  // reps 12 → 14 → 15. Round 5: the McGill primer too, one more 10 s hold
  // from phase 2 (4/3/3 → 5/4/4), never a longer hold. Absolute targets.
  it('steps the back extension by phase: Thu hold 30/35/40 s, Sat reps 12/14/15', () => {
    const daily = getRehabSession('daily');
    expect(applyPhase(daily, 1)).toBe(daily);
    const ext = (s, v) =>
      buildStepQueue(s, {}, v).filter((st) => st.exId === 'back-extension' && st.kind === 'work');
    for (const [ph, hold, reps] of [
      [1, 30, 12],
      [2, 35, 14],
      [3, 40, 15],
    ]) {
      const s = applyPhase(daily, ph);
      expect(applyPhase(s, ph).blocks, `p${ph}`).toEqual(s.blocks);
      for (let w = 0; w < 4; w++) {
        const thu = ext(s, w * 4 + 1);
        expect(thu.map((st) => st.secs), `p${ph} thu`).toEqual([hold, hold, hold]);
        const sat = ext(s, w * 4 + 2);
        expect(sat.map((st) => st.tempo.reps), `p${ph} sat`).toEqual([reps, reps, reps]);
      }
      // the step never leaks its own spec into the served block
      expect(ext(s, 1).every((st) => st.countsAsSet)).toBe(true);
      // the Big 3 primer
      const big3 = sessionBlocks(s, 0).filter((b) => b.mode === 'reps');
      expect(big3.map((b) => [b.ex, b.repScheme[0]]), `p${ph}`).toEqual(
        ph === 1
          ? [['mcgill-curlup', 4], ['side-plank', 3], ['bird-dog', 3]]
          : ph === 2
            ? [['mcgill-curlup', 5], ['side-plank', 4], ['bird-dog', 4]]
            : // 45-min round: phase 3 adds one more hold
              [['mcgill-curlup', 6], ['side-plank', 5], ['bird-dog', 5]],
      );
      for (const b of big3) expect(b.holdSecs).toBe(10);
    }
  });

  it('applyPhase is safe on every session and benchmark', () => {
    for (const s of [...DENSITY40_SESSIONS, ...BENCHMARK_SESSIONS]) {
      for (const p of [1, 2, 3]) {
        const out = applyPhase(s, p);
        expect(out.blocks.length, `${s.id} p${p}`).toBe(s.blocks.length);
        expect(() => buildStepQueue(out)).not.toThrow();
      }
    }
  });
});

describe('tests and deload checkpoints', () => {
  it('schedules the hard tests far enough apart to beat their own noise', () => {
    // Fight Gone Bad's SEM is 6% — the only published noise floor for a metcon.
    // The maximal tests need 6+ weeks between them; the submaximal one is
    // clean enough to run monthly.
    expect(testsForWeek(1)).toContain('bm-three');
    expect(testsForWeek(6)).toContain('bm-three');
    expect(testsForWeek(12)).toContain('bm-three');
    const three = Object.entries(TEST_WEEKS)
      .filter(([, ids]) => ids.includes('bm-three'))
      .map(([w]) => Number(w));
    // The DIAGNOSTIC comparison is week 1 vs week 12 — eleven weeks, far
    // beyond any plausible noise floor. The week-6 retest sits 5 weeks in,
    // which is deliberately a MOTIVATIONAL read, not a diagnostic one: at a
    // metcon's ~5-10% measurement error, five weeks of trained progress may
    // not clear it. That's why the app gates the delta on the noise band
    // rather than reporting every change as progress.
    expect(three.at(-1) - three[0]).toBeGreaterThanOrEqual(11);
    for (let i = 1; i < three.length; i++) {
      expect(three[i] - three[i - 1]).toBeGreaterThanOrEqual(5);
    }
    // the cheap one runs every 4 weeks
    expect(
      Object.entries(TEST_WEEKS)
        .filter(([, ids]) => ids.includes('bm-control'))
        .map(([w]) => Number(w)),
    ).toEqual([1, 4, 8, 12]);
  });

  it('every scheduled test id is a real benchmark', () => {
    const ids = new Set(BENCHMARK_SESSIONS.map((b) => b.id));
    for (const list of Object.values(TEST_WEEKS)) {
      for (const id of list) expect(ids.has(id), id).toBe(true);
    }
  });

  it('puts a checkpoint at each phase boundary, and it is only a question', () => {
    expect(DELOAD_CHECKPOINTS).toEqual([4, 8]);
    expect(isDeloadCheckpoint(4)).toBe(true);
    expect(isDeloadCheckpoint(8)).toBe(true);
    expect(isDeloadCheckpoint(5)).toBe(false);
    // deliberately NOT week 12 — the block ends with a test, not a taper
    expect(isDeloadCheckpoint(12)).toBe(false);
  });

  it('flags test weeks', () => {
    expect([1, 4, 6, 8, 12].every(isTestWeek)).toBe(true);
    expect([2, 3, 5, 7, 9, 10, 11].some(isTestWeek)).toBe(false);
  });
});

describe('blockState', () => {
  it('resolves everything the app needs from one date', () => {
    const s = blockState(MON, new Date('2026-09-09')); // week 5
    expect(s.week).toBe(5);
    expect(s.phase).toBe(2);
    expect(s.phaseName).toBe('PRESS');
    // PHASE_SWAPS retired 2026-08-10 — weekly rotation superseded it, so a
    // phase carries no swaps of its own; the channel is the athlete's now
    expect(s.swaps).toEqual({});
    expect(s.tests).toEqual([]);
    expect(s.deloadCheckpoint).toBe(false);
    expect(s.complete).toBe(false);
  });

  it('still runs the program when no block has started', () => {
    // a block is an overlay on the week, never a gate on training
    const s = blockState(null);
    expect(s.week).toBeNull();
    expect(s.phase).toBe(1);
    expect(s.swaps).toEqual({});
    expect(s.tests).toEqual([]);
  });

  it('marks the block complete past week 12 without breaking', () => {
    const s = blockState(MON, new Date('2026-11-09'));
    expect(s.complete).toBe(true);
    expect(s.weekInBlock).toBe(BLOCK_WEEKS); // clamped for display
    expect(s.phase).toBe(3);
  });
});

// ── Format rotation ─────────────────────────────────────────────────────────
// The one kind of week-to-week variety that is free: same movements, same
// sets, different delivery. These guard the two properties that make it free
// — the set count never moves, and a self-paced clock never reaches a
// movement that degrades dangerously without one.
// THE EFFORT TARGET (2026-10-10, coach QA): every working superset set says
// how hard to go, right under the movement name — 1–2 reps left, HEAVY on a
// heavy week, MAX SET on the last round of a rep-out. Warm-ups say nothing.
describe('the effort target on every set', () => {
  const metas = (id, week, ex) =>
    buildStepQueue(applyFormats(getProgramSession(id), week), {}, week - 1)
      .filter((s) => s.exId === ex && s.kind === 'work')
      .map((s) => s.meta);
  // QA round: Wings is the chest-supported row, the elevated push-up and the
  // band pull-apart; the row carries the loaded target. Wings is 4 rounds.
  it('plain weeks ask for 1–2 reps left, every round', () => {
    const m = metas('d40-a1', 1, 'chest-supported-row');
    expect(m).toHaveLength(4); // Wings is 4 rounds (45-min round)
    for (const x of m) expect(x).toMatch(/^1–2 LEFT · ROUND/);
  });
  it('a heavy week says HEAVY too', () => {
    // Friday's Legs & Back goes heavy in week 2 (Monday is that week's EMOM
    // day, so Wings runs as an EMOM instead) — read on its lat pulldown
    const m = metas('d40-c1', 2, 'lat-pulldown');
    expect(m).toHaveLength(4); // Legs & Back is 4 rounds
    for (const x of m) expect(x).toMatch(/^HEAVY · 1–2 LEFT · ROUND/);
  });
  it('the last round of a rep-out week says MAX SET, the rest 1–2 LEFT', () => {
    // Wings rep-out week: the row is banned from it (hinged + loaded), so
    // the push-up takes the max set
    const m = metas('d40-a1', 3, 'elevated-pushup');
    for (const x of metas('d40-a1', 3, 'chest-supported-row')) expect(x).not.toMatch(/MAX SET/);
    expect(m.at(-1)).toMatch(/^MAX SET · ROUND 4 OF 4/);
    for (const x of m.slice(0, -1)) expect(x).toMatch(/^1–2 LEFT/);
  });
  it('the anchor pair says PAIR, never an effort target of its own', () => {
    for (const w of [1, 2, 3]) {
      const m = metas('d40-a1', w, 'db-lateral-raise');
      expect(m, `wk${w}`).toHaveLength(5);
      m.forEach((x, i) => expect(x, `wk${w}`).toBe(`PAIR · ROUND ${i + 1} OF 5`));
    }
  });
  // round 4: HEAVY leads only on a member the week made heavier — the pinned
  // RDL and the bodyweight curl never say HEAVY
  it('HEAVY rides only the members a heavy week actually changed', () => {
    // Monday week 4: Hinge & Calf runs HEAVY
    const q = buildStepQueue(applyFormats(getProgramSession('d40-a1'), 4), {}, 3);
    const work = (ex) => q.filter((s) => s.exId === ex && s.kind === 'work' && s.blockLabel === 'Hinge & Calf');
    expect(work('rdl')).toHaveLength(3);
    for (const s of work('rdl')) {
      expect(s.meta).toMatch(/^2–3 LEFT · ROUND/);
      expect(s.meta).not.toMatch(/HEAVY/);
    }
    for (const s of work('db-calf-raise')) expect(s.meta).toMatch(/^HEAVY · 1–2 LEFT · ROUND/);
    // the cable leg curl: HEAVY exactly when the week made it heavy — and
    // Friday's pinned curl never
    for (let w = 2; w <= 12; w++) {
      for (const id of ['d40-b1', 'd40-c1']) {
        const wq = buildStepQueue(applyFormats(getProgramSession(id), w), {}, (w - 1) % 4);
        for (const s of wq.filter((x) => x.exId === 'cable-leg-curl' && x.kind === 'work')) {
          // a superset set says it in its meta; an EMOM-day minute in the
          // piece's header (EMOM · HEAVY)
          const said = s.emom ? /HEAVY/.test(s.pieceFormat) : /HEAVY/.test(s.meta);
          expect(said, `${id} wk${w}`).toBe(!!s.heavy);
          if (id === 'd40-c1') expect(s.heavy, `${id} wk${w}`).toBeFalsy();
        }
      }
    }
  });
  it('warm-up moves carry no effort target', () => {
    const q = buildStepQueue(getProgramSession('d40-a1'));
    for (const s of q.filter((x) => x.warmup)) {
      expect(s.meta).not.toMatch(/LEFT|MAX SET|HEAVY/);
    }
  });
});

describe('format rotation', () => {
  // Every quartet lives inside a `{ rotate: [...] }` pool now, so a piece is
  // found by walking the pool. `variant` picks which week's shape to inspect.
  const pieceIn = (id, name, variant = 0) =>
    getProgramSession(id)
      .blocks.flatMap((b) => b.rotate || [b])
      .filter((b) => b?.name === name)[variant];

  it('rotates a piece through its declared formats, week by week', () => {
    // Wings (Mon): SETS → HEAVY → LAST SET MAX, round again. Hypertrophy work
    // is never rushed, so it never goes FOR TIME (2026-10-10, coach QA).
    // The delivery changes; the exercises never do (his rule).
    const wings = pieceIn('d40-a1', 'Wings');
    const all = ['sets', 'sets-heavy', 'sets-repout'];
    expect(wings.formats).toEqual(all);
    expect(formatsFor(wings)).toEqual(all);
    expect([1, 2, 3, 4].map((w) => pieceFormatFor(wings, w))).toEqual([
      ...all,
      'sets',
    ]);
    // `formatOffset` staggers the day's second block, so Monday never goes
    // heavy (or rep-out) on both supersets at once — and week 1 is plain
    const hinge = pieceIn('d40-a1', 'Hinge & Calf');
    expect([1, 2, 3, 4].map((w) => pieceFormatFor(hinge, w))).toEqual([
      'sets',
      'sets-repout',
      'sets',
      'sets-heavy',
    ]);
    for (let w = 2; w <= 12; w++) {
      const a = pieceFormatFor(wings, w);
      const b = pieceFormatFor(hinge, w);
      expect(a === b && a !== 'sets', `wk${w} both ${a}`).toBe(false);
    }
  });

  // WEEK 1 IS PLAIN (2026-10-10, physio QA): nothing is met for the first
  // time in a HEAVY or LAST-SET-MAX week — first exposure is technique load.
  it('week 1 serves plain SETS on every format-rotating piece, whatever the offset', () => {
    let pieces = 0;
    for (const s of DENSITY40_SESSIONS) {
      for (const b of s.blocks.flatMap((x) => x.rotate || [x])) {
        if (!b?.formats?.length) continue;
        pieces += 1;
        expect(pieceFormatFor(b, 1), `${s.id}/${b.name}`).toBe('sets');
        // the session the player builds in week 1 carries no format label,
        // no heavy rewrite and no rep-out note
        const shaped = applyFormats(s, 1)
          .blocks.flatMap((x) => x.rotate || [x])
          .find((x) => x?.name === b.name);
        expect(shaped.formatLabel, `${s.id}/${b.name}`).toBe('SETS');
        for (const m of shaped.members) {
          expect(m.heavy, `${s.id}/${b.name}/${m.ex}`).toBeUndefined();
          expect(m.lastRoundNote, `${s.id}/${b.name}/${m.ex}`).toBeUndefined();
        }
      }
    }
    // Wings, Hinge & Calf, Split Squat & Curl, Dips Pull-Ups & Curls, Legs & Back
    expect(pieces).toBe(5);
  });

  it('a heavy week keeps every set and only lightens loadable reps', () => {
    // Monday's Hinge & Calf: the hinge is a pinned 8 (symptom-gated), the
    // calf raise is loadable
    const hc = pieceIn('d40-a1', 'Hinge & Calf');
    const heavy = applyPieceFormat(hc, 'sets-heavy');
    expect(heavy.rounds).toBe(hc.rounds);
    expect(heavy.members.map((m) => m.ex)).toEqual(hc.members.map((m) => m.ex));
    for (const [i, m] of heavy.members.entries()) {
      const was = hc.members[i];
      if (m.heavy) {
        expect(Number.parseInt(m.reps, 10)).toBeLessThan(
          Number.parseInt(was.reps, 10),
        );
      } else {
        expect(m.reps).toBe(was.reps); // the pinned hinge, bands, bodyweight
      }
    }
    expect(heavy.members.find((m) => m.ex === 'rdl').heavy).toBeUndefined();
    // 10/leg × 0.7 — the per-leg suffix survives
    expect(heavy.members.find((m) => m.ex === 'db-calf-raise').reps).toBe('7/leg');
    // the push press is driven, never a slow-lowered heavy set — and the
    // broad jump is bodyweight
    const power = getProgramSession('d40-b1').blocks.find((b) => b.name === 'Power');
    const hp = applyPieceFormat(power, 'emom-heavy');
    for (const m of hp.members) {
      expect(m.heavy, m.ex).toBeUndefined();
      expect(m.reps, m.ex).toBe(power.members.find((x) => x.ex === m.ex).reps);
    }
    // the hamstring curl is on the cable now (no sliders): Wednesday's 8/leg
    // is loadable and goes heavy (10/leg → 7/leg); Friday's pinned 6/leg never does
    const wedCurl = applyPieceFormat(pieceIn('d40-b1', 'Split Squat & Curl'), 'sets-heavy')
      .members.find((m) => m.ex === 'cable-leg-curl');
    expect(wedCurl).toMatchObject({ reps: '7/leg', heavy: true }); // 10/leg × 0.7
    const friCurl = pieceIn('d40-c1', 'Dips, Pull-Ups & Curls').members.find(
      (m) => m.ex === 'cable-leg-curl',
    );
    expect(friCurl).toMatchObject({ reps: '6/leg', fixedReps: true });
    // the slider curl is served nowhere any more
    expect(JSON.stringify(DENSITY40_SESSIONS)).not.toContain('slider-leg-curl');
    // the heavy note says what to do (round 4): fewer reps, heavier only
    // when the app says TARGET, slow on the way down
    expect(heavy.members.find((m) => m.ex === 'db-calf-raise').note).toBe(
      'Heavy week — fewer reps; go heavier when the app says TARGET. Slow on the way down.',
    );
    expect(heavyReps('6/side')).toBe('4/side');
    expect(heavyReps('3')).toBeNull();
  });

  // The safety gate. for-time removes the rest floor that makes EMOM the
  // default here, and fatigue is what turns a hinged row or a raced carry
  // into lumbar flexion — so those pieces can only ever run on forced rest.
  it('filters self-paced formats off pieces that need forced rest', () => {
    // The gate holds even if a piece ever declared fortime: a banned
    // movement filters it back out.
    const power = getProgramSession('d40-b1').blocks.find((b) => b.name === 'Power');
    expect(formatsFor(power)).not.toContain('fortime');
    expect(
      formatsFor({ ...power, formats: ['emom', 'fortime'] }),
    ).not.toContain('fortime');
    const legs = pieceIn('d40-c1', 'Legs & Back'); // the chest-supported row
    expect(
      formatsFor({ ...legs, formats: ['sets', 'fortime'] }),
    ).not.toContain('fortime');
    const hinge = pieceIn('d40-a1', 'Hinge & Calf'); // the RDL
    expect(
      formatsFor({ ...hinge, formats: ['sets', 'fortime'] }),
    ).not.toContain('fortime');
    // the front squat (Wednesday's anchor) — the one axial lift in the week
    const squat = getProgramSession('d40-b1')
      .blocks.flatMap((b) => b.rotate || [b])
      .find((b) => b?.anchor);
    expect(squat.members[0].ex).toBe('front-squat');
    expect(
      formatsFor({ ...squat, formats: ['sets', 'fortime'] }),
    ).not.toContain('fortime');
    // Friday's ring dips fail at the shoulder — banned too
    const dpc = pieceIn('d40-c1', 'Dips, Pull-Ups & Curls');
    expect(
      formatsFor({ ...dpc, formats: ['sets', 'fortime'] }),
    ).not.toContain('fortime');
    // 2026-10-10 (physio QA): a raced two-hand carry is still a raced pickup
    expect(OPEN_PACE_BANNED).toContain('farmer-carry');
    // round 4: the loaded DB split squat joins its rear-foot cousin
    expect(OPEN_PACE_BANNED).toContain('db-split-squat');
    expect(OPEN_PACE_BANNED).toContain('rfe-split-squat');
    // sprint round: a sprint lives only on a forced-rest clock
    expect(OPEN_PACE_BANNED).toContain('sprint');
    expect(
      formatsFor({ members: [{ ex: 'sprint', secs: 6 }], formats: ['emom', 'fortime'] }),
    ).toEqual(['emom']);
    expect(
      formatsFor({
        members: [{ ex: 'farmer-carry', secs: 40 }],
        formats: ['emom', 'fortime'],
      }),
    ).toEqual(['emom']);
    // and no lift-day piece declares FOR TIME at all any more
    for (const s of DENSITY40_SESSIONS) {
      for (const b of s.blocks.flatMap((x) => x.rotate || [x])) {
        expect(b?.formats || [], `${s.id}/${b?.name}`).not.toContain('fortime');
      }
    }
  });

  it('no self-paced piece ever contains a banned movement, in any week', () => {
    for (const s of DENSITY40_SESSIONS) {
      for (let w = 1; w <= 12; w++) {
        const shaped = applyFormats(applyPhase(s, phaseOf(w)), w);
        for (const b of shaped.blocks.flatMap((x) => x.rotate || [x])) {
          if (!['fortime', 'amrap'].includes(b?.mode)) continue;
          for (const m of b.members || []) {
            expect(OPEN_PACE_BANNED, `${s.id} wk${w} ${m.ex}`).not.toContain(m.ex);
          }
        }
      }
    }
  });

  // THE INVARIANT. If this breaks, format rotation stops being free and
  // starts silently rewriting the athlete's weekly dose.
  it('every format delivers the SAME number of sets per movement', () => {
    for (const s of DENSITY40_SESSIONS) {
      for (const b of s.blocks.flatMap((x) => x.rotate || [x])) {
        if (!b?.formats?.length) continue;
        const counts = formatsFor(b).map((f) => {
          const q = buildStepQueue({ ...s, blocks: [applyPieceFormat(b, f)] });
          const t = {};
          for (const st of q) {
            if (st.kind === 'work' && st.countsAsSet) t[st.exId] = (t[st.exId] || 0) + 1;
          }
          return JSON.stringify(t);
        });
        expect(new Set(counts).size, `${s.id}/${b.name} set counts differ by format`).toBe(1);
      }
    }
  });

  // Every slot prescribes ONE number now (2026-08-10), and the descent is
  // CENTERED on it: a straight fall from N delivered 19–30% fewer reps than
  // N-every-round, invisibly to any set-counting audit. Odd round-counts are
  // volume-exact; even ones land within two reps.
  it('a descending scheme is centered on the number, one rep per round', () => {
    expect(descendingReps('10', 5)).toEqual(['12', '11', '10', '9', '8']);
    expect(descendingReps('20', 3)).toEqual(['21', '20', '19']);
    // the per-side suffix survives, or the player would lose which side it is
    expect(descendingReps('10/side', 3)).toEqual(['11/side', '10/side', '9/side']);
    // a prescription smaller than the round count stays flat — a 5-rep opener
    // on a 3-rep prescription is a different workout, not a variation
    expect(descendingReps('3', 5)).toBeNull();
    expect(descendingReps('20', 1)).toBeNull();
  });

  it('descending reps reach the queue, still as the same set count', () => {
    // No lift-day piece declares EMOM ↓ since the 2026-10-10 rework, but the
    // mechanism stays proven: an EMOM piece with a loaded station and a timed
    // carry, as the old Forge was
    const piece = {
      mode: 'emom',
      name: 'X',
      rounds: 4,
      members: [
        { ex: 'db-front-rack-lunge', reps: '8' },
        { ex: 'suitcase-carry', secs: 45 },
      ],
    };
    const desc = applyPieceFormat(piece, 'emom-desc');
    const q = buildStepQueue({ id: 'x', blocks: [desc] });
    const lunge = q.filter((s) => s.exId === 'db-front-rack-lunge' && s.countsAsSet);
    expect(lunge).toHaveLength(4); // unchanged — 4 rounds
    expect(lunge.map((s) => s.reps)).toEqual(['9', '8', '7', '6']);
    // timed work never descends
    const carry = q.filter((s) => s.exId === 'suitcase-carry' && s.countsAsSet);
    expect(carry.every((s) => s.workSecs === 45)).toBe(true);
    // and a fixed-dose piece (Wednesday's Power: max-intent jumps, the push
    // press) never descends either — its dose is quality-capped
    const power = getProgramSession('d40-b1').blocks.find((b) => b.name === 'Power');
    for (const m of applyPieceFormat(power, 'emom-desc').members) {
      expect(m.repsPerRound, m.ex).toBeUndefined();
    }
  });

  // THE REP-OUT WEEK only ever asks a SAFE movement to go near failure: the
  // pinned hinge, timed work and anything on the open-pace ban keep their
  // number, because a rep-out is the closest thing to an open clock a
  // giant set has.
  // a rep-out week nobody in the piece may take is a label, not a format
  // (round 4): formatsFor drops it
  it('formatsFor drops LAST SET MAX when no member could take it', () => {
    const banned = {
      formats: ['sets', 'sets-heavy', 'sets-repout'],
      members: [
        { ex: 'rfe-split-squat', reps: '8/leg' },
        { ex: 'chest-supported-row', reps: '10' },
      ],
    };
    expect(formatsFor(banned)).toEqual(['sets', 'sets-heavy']);
    // a pinned or timed member can't take it either
    expect(
      formatsFor({
        formats: ['sets', 'sets-repout'],
        members: [{ ex: 'push-up', reps: '10', fixedReps: true }, { ex: 'plank', secs: 30 }],
      }),
    ).toEqual(['sets']);
    // one safe member keeps it
    expect(
      formatsFor({ ...banned, members: [...banned.members, { ex: 'cable-leg-curl', reps: '8/leg' }] }),
    ).toEqual(['sets', 'sets-heavy', 'sets-repout']);
    // and every real piece that declares it still has someone to take it
    for (const s of DENSITY40_SESSIONS) {
      for (const b of s.blocks.flatMap((x) => x.rotate || [x])) {
        if (!b?.formats?.includes('sets-repout')) continue;
        expect(formatsFor(b), `${s.id}/${b.name}`).toContain('sets-repout');
      }
    }
  });

  it('the rep-out week only reaches movements that fail safely', () => {
    const hinge = applyPieceFormat(pieceIn('d40-a1', 'Hinge & Calf'), 'sets-repout');
    expect(hinge.members.find((m) => m.ex === 'rdl').lastRoundNote).toBeUndefined();
    expect(hinge.members.find((m) => m.ex === 'db-calf-raise').lastRoundNote).toMatch(/LAST SET/);
    // Legs & Back is the rear-foot split squat and the lat pulldown — only the
    // pulldown reps out
    const legs = applyPieceFormat(pieceIn('d40-c1', 'Legs & Back'), 'sets-repout');
    expect(legs.members.map((m) => m.ex)).toEqual(['rfe-split-squat', 'lat-pulldown']);
    expect(legs.members.find((m) => m.ex === 'rfe-split-squat').lastRoundNote).toBeUndefined();
    expect(legs.members.find((m) => m.ex === 'lat-pulldown').lastRoundNote).toMatch(/LAST SET/);
    // Friday's Dips, Pull-Ups & Curls: the ring dip fails at the shoulder
    // (banned), the cable curl is pinned (fixedReps) — only the pull-up reps out
    const dpc = applyPieceFormat(pieceIn('d40-c1', 'Dips, Pull-Ups & Curls'), 'sets-repout');
    expect(dpc.members.map((m) => m.ex)).toEqual(['ring-dip', 'pull-up-bw', 'cable-leg-curl']);
    expect(dpc.members.find((m) => m.ex === 'ring-dip').lastRoundNote).toBeUndefined();
    expect(dpc.members.find((m) => m.ex === 'cable-leg-curl').lastRoundNote).toBeUndefined();
    expect(dpc.members.find((m) => m.ex === 'pull-up-bw').lastRoundNote).toMatch(/LAST SET/);
    expect(dpc.members.some((m) => m.ex === 'rdl')).toBe(false);
    // Wednesday: the DB split squat is banned now (round 4), the curl reps out
    const ss = applyPieceFormat(pieceIn('d40-b1', 'Split Squat & Curl'), 'sets-repout');
    expect(ss.members.find((m) => m.ex === 'db-split-squat').lastRoundNote).toBeUndefined();
    expect(ss.members.find((m) => m.ex === 'cable-leg-curl').lastRoundNote).toMatch(/LAST SET/);
    // and it reaches the queue on the last round only
    const q = buildStepQueue({ id: 'x', blocks: [hinge] });
    const calves = q.filter((s) => s.exId === 'db-calf-raise' && s.countsAsSet);
    expect(calves.map((s) => /LAST SET/.test(s.cueNote || ''))).toEqual([
      false,
      false,
      true,
    ]);
  });

  // THE SUPERSET TARGET (2026-10-09): superset sets earn a load target and
  // log real reps, read against the last session of the SAME week type —
  // which only works if the step says what it is.
  it('superset sets are tagged for targets, heavy weeks say so', () => {
    const a1 = getProgramSession('d40-a1');
    const sets = buildStepQueue(applyFormats(a1, 1), {}, 0); // Wings: SETS
    // Wings' loaded row
    const lat = (q) => q.filter((s) => s.exId === 'chest-supported-row' && s.countsAsSet);
    expect(lat(sets)).toHaveLength(4);
    expect(lat(sets).every((s) => s.build && !s.heavy)).toBe(true);
    // the heavy week, read on Friday's Legs & Back pulldown (week 2)
    const heavy = buildStepQueue(applyFormats(getProgramSession('d40-c1'), 2), {}, 1);
    const row = heavy.filter((s) => s.exId === 'lat-pulldown' && s.countsAsSet);
    expect(row).toHaveLength(4);
    expect(row.every((s) => s.build && s.heavy)).toBe(true);
    expect(row[0].reps).toBe('7'); // 10 × 0.7
    // Friday's pinned cable curl never goes heavy
    for (const s of heavy.filter((x) => x.exId === 'cable-leg-curl' && x.kind === 'work')) {
      expect(s.heavy, s.exId).toBeUndefined();
    }
    // the warm-up is never a working set
    const warm = sets.filter((s) => s.warmup && s.kind === 'work');
    expect(warm.length).toBeGreaterThan(0);
    expect(warm.every((s) => !s.build && s.countsAsSet === false)).toBe(true);
    // a rep-out week is still a target week — the last round just keeps going
    // (read on the push-up — the banned row never reps out)
    const ro = buildStepQueue(applyFormats(a1, 3), {}, 0); // Wings: LAST SET MAX
    const roLat = ro.filter((s) => s.exId === 'elevated-pushup' && s.countsAsSet);
    expect(roLat.every((s) => s.build && !s.heavy)).toBe(true);
    expect(roLat.map((s) => /LAST SET/.test(s.cueNote || ''))).toEqual([
      false,
      false,
      false,
      true,
    ]);
    // and the last round says MAX SET — the estimate budgets it longer
    expect(roLat.map((s) => !!s.maxSet)).toEqual([false, false, false, true]);
  });

  // HONEST MINUTES (2026-10-09): a paced set is estimated at its own tempo,
  // so a slow-eccentric superset can't hide behind a flat 35 seconds.
  it('session estimates count a paced set at its own tempo', () => {
    const one = (ex, reps) =>
      estimateSessionSecs({
        id: 'x',
        blocks: [{ mode: 'circuit', rounds: 1, members: [{ ex, reps }] }],
      });
    // pulldown: 10 reps × 4s + 10s around the set (+ the 10s get-set)
    expect(one('lat-pulldown', '10')).toBe(10 + 50);
    // a band pull-apart at 3s a rep: 15 × 3 + 10
    expect(one('band-pull-apart', '15')).toBe(10 + 55);
    // anything unpaced keeps the 35s floor
    expect(one('push-up', '15')).toBe(10 + 35);
  });

  // THE MAX SET IS BUDGETED (round 3, coach QA): the rep-out week's last
  // round runs past the number, so the estimate pays ~5 more reps for a
  // paced set and 15 s more for an unpaced one.
  it('session estimates budget a MAX SET past its prescription', () => {
    const one = (ex, reps, lastRoundNote) =>
      estimateSessionSecs({
        id: 'x',
        blocks: [
          {
            mode: 'circuit',
            isPiece: true,
            rounds: 1,
            members: [{ ex, reps, ...(lastRoundNote ? { lastRoundNote } : {}) }],
          },
        ],
      });
    const NOTE = 'LAST SET — keep going.';
    // pulldown (4 s a rep): (10 + 5) × 4 + 10
    expect(one('lat-pulldown', '10', NOTE) - one('lat-pulldown', '10')).toBe(5 * 4);
    // an unpaced push-up: the 35 s floor + 15
    expect(one('push-up', '15', NOTE) - one('push-up', '15')).toBe(15);
    // and the whole rep-out week costs more than the plain one on Monday
    const a1 = getProgramSession('d40-a1');
    expect(estimateSessionSecs(applyFormats(a1, 3), 2)).toBeGreaterThan(
      estimateSessionSecs(applyFormats(a1, 1), 2),
    );
  });

  // EVERY BLOCK THAT CHANGES STATION COSTS REAL TIME (2026-10-10): the walk,
  // the re-plate, the re-pin. `changeoverSecs` lands on the block's first
  // step and the estimate counts it — a "39-minute" day that runs 46 is the
  // one that gets skipped.
  it('session estimates count each block\'s changeover', () => {
    const block = { mode: 'circuit', rounds: 1, members: [{ ex: 'push-up', reps: '15' }] };
    const base = estimateSessionSecs({ id: 'x', blocks: [block] });
    const withCo = estimateSessionSecs({
      id: 'x',
      blocks: [{ ...block, changeoverSecs: 45 }],
    });
    expect(withCo - base).toBe(45);
    // it rides the block's first step only, never every round
    const q = buildStepQueue({
      id: 'x',
      blocks: [{ ...block, rounds: 3, changeoverSecs: 45 }],
    });
    expect(q.filter((st) => st.changeover)).toHaveLength(1);
    expect(q[0].changeover).toBe(45);
    // the real days declare them: the anchor's bar-loading minute, every
    // superset's walk, Wednesday's Power set-up, Monday's RDL ramp
    for (const s of DENSITY40_SESSIONS) {
      const q2 = buildStepQueue(s);
      const total = q2.reduce((t, st) => t + (st.changeover || 0), 0);
      expect(total, s.id).toBeGreaterThanOrEqual(60 + 45);
    }
    const mon = buildStepQueue(getProgramSession('d40-a1'));
    const rampStep = mon.find((st) => st.phase === 'RAMP');
    const rampFirst = mon[mon.findIndex((st) => st.bi === rampStep.bi)];
    expect(rampFirst.changeover).toBe(45);
  });

  // The mechanism, should a piece ever declare FOR TIME again — Wings itself
  // never does (coach QA: hypertrophy work is never rushed).
  it('a superset going FOR TIME keeps its rounds and members', () => {
    const wings = pieceIn('d40-a1', 'Wings');
    const ft = applyPieceFormat(wings, 'fortime');
    expect(ft.mode).toBe('fortime');
    const q = buildStepQueue({ id: 'x', blocks: [ft] });
    expect(q.filter((s) => s.countsAsSet)).toHaveLength(12); // 3 members × 4 rounds
    expect(q.every((s) => s.kind !== 'rest')).toBe(true); // no prescribed rest
    expect(q.find((s) => s.kind === 'work').piece).toBe('Wings');
  });

  it('leaves pieces with no declared formats completely alone', () => {
    // The stretches and the ramp declare no formats, so applyFormats must not
    // touch them — it only rewrites blocks that opted in.
    const s = getProgramSession('d40-b1');
    const inert = {
      ...s,
      blocks: s.blocks.filter((b) => !b.rotate && !b.formats),
    };
    for (let w = 1; w <= 12; w++) {
      expect(applyFormats(inert, w)).toEqual(inert);
    }
  });
});

// ── THE WEEKLY REP STEP (2026-10-10, coach QA) ──────────────────────────────
// "The pull-up anchor never progresses." Single numbers, as he asked — the
// app steps them by block week (`weekReps`, `weekNotes`), he never reads a
// range.
describe('weekly rep steps', () => {
  // the anchor's own sets — the pair rides the same piece and is read apart
  const anchorSets = (week) =>
    buildStepQueue(applyFormats(getProgramSession('d40-a1'), week)).filter(
      (s) => s.piece === 'The Anchor' && s.countsAsSet && !s.pair,
    );

  it('steps Monday\'s pull-up anchor 5,5,6,6,7,7,8,8 then 5,6,7,8 with a pack', () => {
    const reps = Array.from({ length: 12 }, (_, i) => anchorSets(i + 1)[0].reps);
    expect(reps).toEqual(['5', '5', '6', '6', '7', '7', '8', '8', '5', '6', '7', '8']);
    // every set of the week serves the same number — five of them, always
    // (round 3: five working sets, no build round for a bodyweight pull)
    for (let w = 1; w <= 12; w++) {
      const sets = anchorSets(w);
      expect(sets, `wk${w}`).toHaveLength(5);
      expect(new Set(sets.map((s) => s.reps)).size, `wk${w}`).toBe(1);
    }
  });

  // Round 3 (coach QA): the pack is EARNED — weeks 9–12 make it conditional
  // on owning every 8 in week 8, with bodyweight 8s as the honest fallback.
  it('weeks 9–12 carry the conditional pack note; weeks 1–8 keep the strict cue', () => {
    for (let w = 1; w <= 12; w++) {
      const note = anchorSets(w)[0].cueNote;
      if (w === 9) {
        expect(note, `wk${w}`).toMatch(/^Owned every 8 in week 8\? Pack on, 2\.5 kg/);
        expect(note, `wk${w}`).toMatch(/If not, bodyweight/);
      } else if (w >= 10) {
        expect(note, `wk${w}`).toMatch(/Pack on if you earned it — or bodyweight/);
      } else {
        // round 5: the note asks for the honest log the earned ladder reads
        expect(note, `wk${w}`).toMatch(
          /^Strict, dead-hang, zero swing\. Stop two short of failure and log every rep/,
        );
      }
    }
    // week 9 is the reset — it SAYS the reps drop back to 5
    expect(anchorSets(9)[0].cueNote).toMatch(/back to 5/);
  });

  it('steps Friday\'s ring dips by week, inside the superset, sets unchanged', () => {
    const dips = (w) =>
      buildStepQueue(applyFormats(getProgramSession('d40-c1'), w)).filter(
        (s) => s.exId === 'ring-dip' && s.countsAsSet,
      );
    const reps = Array.from({ length: 12 }, (_, i) => dips(i + 1)[0].reps);
    expect(reps).toEqual(['5', '5', '6', '6', '6', '7', '7', '7', '8', '8', '8', '8']);
    for (let w = 1; w <= 12; w++) expect(dips(w), `wk${w}`).toHaveLength(3);
  });

  it('wraps past week 12 and leaves members without weekReps alone', () => {
    const at = (w) => anchorSets(w)[0].reps;
    expect(at(13)).toBe(at(1));
    expect(at(14)).toBe(at(2));
    // the Wings pulldown has no weekReps — every week serves its own 10
    // (or its heavy-week 7), never a stepped number
    for (const w of [1, 3, 4]) {
      const pd = buildStepQueue(applyFormats(getProgramSession('d40-a1'), w)).filter(
        (s) => s.exId === 'lat-pulldown' && s.countsAsSet,
      );
      expect(pd.every((s) => s.reps === '10'), `wk${w}`).toBe(true);
    }
  });
});

// ── THE EMOM DAY (his ask: "a day in a week where it's still a full EMOM like
// before … constantly varied, as long as we hit everything") ───────────────
describe('the EMOM day', () => {
  it('from week 2, one lift day a week — Mon, Wed, Fri in turn', () => {
    const days = Array.from({ length: 12 }, (_, i) =>
      ['d40-a1', 'd40-b1', 'd40-c1'].filter((id) => isEmomDay(id, i + 1)),
    );
    expect(days[0]).toEqual([]); // week 1 is plain everywhere
    for (let w = 2; w <= 12; w++) {
      expect(days[w - 1], `wk${w}`).toEqual([['d40-a1', 'd40-b1', 'd40-c1'][(w - 2) % 3]]);
    }
    expect(isEmomDay('d40-a1', null)).toBe(false);
    expect(isEmomDay('daily', 2)).toBe(false);
  });

  it('runs every working superset as an EMOM — same exercises, same sets', () => {
    for (const [id, week] of [['d40-a1', 2], ['d40-b1', 3], ['d40-c1', 4]]) {
      const base = getProgramSession(id);
      const plain = applyFormats(base, 1);
      const emom = applyFormats(base, week);
      const pieces = (s) =>
        s.blocks.flatMap((b) => b.rotate || [b]).filter((b) => b?.isPiece && !b.warmup && !b.anchor);
      for (const b of pieces(emom).filter((x) => x.members && !x.ballistic)) {
        expect(b, `${id} ${b.name}`).toMatchObject({
          mode: 'emom',
          formatLabel: expect.stringMatching(/^EMOM( · HEAVY)?$/),
          intervalSecs: 60,
          emomDay: true,
        });
        for (const k of ['formats', 'formatOffset', 'restSecs', 'betweenSecs']) {
          expect(b[k], `${id} ${b.name} ${k}`).toBeUndefined();
        }
        for (const m of b.members) {
          expect(m.lastRoundNote, `${id} ${m.ex}`).toBeUndefined();
          // heavy only when the EMOM day lands on the piece's heavy week
          if (b.formatLabel === 'EMOM') expect(m.heavy, `${id} ${m.ex}`).toBeUndefined();
          // a per-leg / per-side minute gets 90 s, the rest the block's 60
          expect(m.intervalSecs, `${id} ${m.ex}`).toBe(
            /\/(leg|side|arm)/.test(String(m.reps)) ? 90 : undefined,
          );
        }
      }
      // the set count per movement is identical to the plain week
      const tally = (s) => {
        const t = {};
        for (const st of buildStepQueue(s, {}, week - 1)) {
          if (st.kind === 'work' && st.countsAsSet) t[st.exId] = (t[st.exId] || 0) + 1;
        }
        return t;
      };
      const t1 = tally(plain);
      const tw = tally(emom);
      for (const ex of Object.keys(t1).filter((x) => !['pull-up-bw', 'ring-dip'].includes(x))) {
        expect(tw[ex], `${id} ${ex}`).toBe(t1[ex]);
      }
      // the anchor and the warm-up are untouched
      const anchor = (s) => s.blocks.flatMap((b) => b.rotate || [b]).find((b) => b?.anchor);
      expect(anchor(emom).mode).toBe('emom');
      expect(anchor(emom).emomDay).toBeUndefined();
      // QA round: the EMOM day's sets are real working sets — tagged `build`
      // (they log the confirmed reps and earn targets), never "no yardstick"
      const q = buildStepQueue(emom, {}, week - 1);
      const ed = q.filter(
        (st) =>
          st.emom &&
          st.piece &&
          !st.anchor &&
          !st.pair &&
          st.countsAsSet &&
          pieces(emom).some((b) => b.emomDay && b.name === st.piece),
      );
      expect(ed.length, id).toBeGreaterThan(0);
      expect(ed.every((st) => st.build), id).toBe(true);
      expect(ed.some((st) => st.noYardstick), id).toBe(false);
    }
  });

  it('the per-leg minute is 90 s on the clock, the label and the overview', () => {
    // Wednesday week 3: Split Squat & Curl = 8/leg split squat (90 s) +
    // 8/leg cable curl (90 s), three rounds → 9 min
    const wed = applyFormats(getProgramSession('d40-b1'), 3);
    const q = buildStepQueue(wed, {}, 2).filter((st) => st.piece === 'Split Squat & Curl');
    expect(q.map((st) => st.secs)).toEqual([90, 90, 90, 90, 90, 90]);
    expect(q[0].pieceFormat).toMatch(/^EMOM( · HEAVY)? 9$/);
    const row = sessionOverview(wed, {}, 2).find((r) => r.title === 'Split Squat & Curl');
    expect(row.detail).toMatch(/^EMOM( · HEAVY)? 9 · 3 rounds/);
  });

  // the RDL keeps its rest floor on the EMOM day: start to start it comes
  // round after its own minute AND the calf raise's 90 s
  it('spine-loaded sets stay at least 2:30 apart on every EMOM day', () => {
    const SPINE = ['rdl', 'front-squat', 'rfe-split-squat', 'db-split-squat'];
    for (let week = 2; week <= 12; week++) {
      for (const s of DENSITY40_SESSIONS) {
        if (!isEmomDay(s.id, week)) continue;
        const last = new Map();
        let t = 0;
        for (const st of buildStepQueue(applyFormats(s, week), {}, week - 1)) {
          if (st.kind === 'work' && SPINE.includes(st.exId) && st.phase !== 'RAMP') {
            if (last.has(st.exId)) {
              expect(t - last.get(st.exId), `${s.id} wk${week} ${st.exId}`).toBeGreaterThanOrEqual(150);
            }
            last.set(st.exId, t);
          }
          t += st.secs ?? 35;
        }
      }
    }
  });
});

describe('the EMOM day keeps the heavy week', () => {
  // the rotation lands on Wings' and the split squats' heavy weeks — the
  // EMOM day must deliver them as EMOM · HEAVY, never silently drop them
  it('Wings (Mon wk 2) and Split Squat & Curl (Wed wk 3) go EMOM · HEAVY', () => {
    for (const [id, week, name] of [
      ['d40-a1', 2, 'Wings'],
      ['d40-b1', 3, 'Split Squat & Curl'],
    ]) {
      expect(isEmomDay(id, week)).toBe(true);
      const b = applyFormats(getProgramSession(id), week)
        .blocks.flatMap((x) => x.rotate || [x])
        .find((x) => x?.name === name);
      expect(b.mode).toBe('emom');
      expect(b.formatLabel).toBe('EMOM · HEAVY');
      expect(b.members.some((m) => m.heavy)).toBe(true);
    }
  });
});
