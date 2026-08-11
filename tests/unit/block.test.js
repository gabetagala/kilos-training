import { describe, expect, it } from 'vitest';
import {
  applyPhase,
  BLOCK_WEEKS,
  blockState,
  currentWeek,
  DELOAD_CHECKPOINTS,
  isDeloadCheckpoint,
  isTestWeek,
  mondayOf,
  phaseOf,
  phaseSwaps,
  applyFormats,
  applyPieceFormat,
  descendingReps,
  formatsFor,
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
import { buildStepQueue } from '../../src/workout/rehab.js';

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
    const ANCHORS = ['pull-up', 'front-squat', 'floor-press'];
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
  const anchorSets = (id, phase, variant) =>
    buildStepQueue(applyPhase(getProgramSession(id), phase), {}, variant).filter(
      (s) => s.piece === 'The Anchor' && s.countsAsSet,
    ).length;

  it('phase 2 steps the pull anchor 4 → 5 rounds, in every variant', () => {
    for (const v of [0, 1, 2, 3]) {
      expect(anchorSets('d40-a1', 1, v), `v${v}`).toBe(4);
      expect(anchorSets('d40-a1', 2, v), `v${v}`).toBe(5);
    }
  });

  it('phase 3 steps the squat anchor 4 → 5 rounds, in every variant', () => {
    for (const v of [0, 1, 2, 3]) {
      expect(anchorSets('d40-b1', 1, v), `v${v}`).toBe(4);
      expect(anchorSets('d40-b1', 2, v), `v${v}`).toBe(4); // phase 3 only
      expect(anchorSets('d40-b1', 3, v), `v${v}`).toBe(5);
    }
  });

  // Friday's strict-pull-up station steps REPS with the phases (3 → 4 → 5):
  // the Monday anchor drives pull-up strength up all block, and a fixed 3
  // would decay into warm-up grade while still counting as full lat sets.
  it('phases step the Friday pull-up station 3 → 4 → 5 reps, sets unchanged', () => {
    for (const v of [0, 1, 2, 3]) {
      for (const [phase, reps] of [
        [1, '3'],
        [2, '4'],
        [3, '5'],
      ]) {
        const q = buildStepQueue(
          applyPhase(getProgramSession('d40-c1'), phase),
          {},
          v,
        );
        const pulls = q.filter(
          (s) => s.exId === 'pull-up-bw' && s.piece && s.countsAsSet,
        );
        expect(pulls, `p${phase} v${v}`).toHaveLength(4);
        for (const s of pulls) expect(s.reps, `p${phase} v${v}`).toBe(reps);
      }
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
describe('format rotation', () => {
  // Every quartet lives inside a `{ rotate: [...] }` pool now, so a piece is
  // found by walking the pool. `variant` picks which week's shape to inspect.
  const pieceIn = (id, name, variant = 0) =>
    getProgramSession(id)
      .blocks.flatMap((b) => b.rotate || [b])
      .filter((b) => b?.name === name)[variant];

  it('rotates a piece through its declared formats, week by week', () => {
    // The Gate's rear-delt variant is band pull-aparts — light, upright, and
    // failing at the muscle — so it is one of the pieces that may run open-pace.
    // Consolidating the day into ONE piece (2026-08-10) put the hinge inside
    // it, and the hinge is spine-loaded — so every piece now runs on forced
    // rest, and the rotation is EMOM → EMOM ↓ → EMOM. That is the honest
    // consequence of the merge, not an oversight: a self-paced clock has no
    // rest floor, and the hinge needs one.
    const gate = pieceIn('d40-c1', 'The Gate', 0);
    expect(gate.formats).toEqual(['emom', 'emom-desc']);
    expect(formatsFor(gate)).toEqual(['emom', 'emom-desc']);
    expect([1, 2, 3].map((w) => pieceFormatFor(gate, w))).toEqual([
      'emom',
      'emom-desc',
      'emom',
    ]);
  });

  // The safety gate. for-time removes the rest floor that makes EMOM the
  // default here, and fatigue is what turns a hinged row or a one-hand carry
  // into lumbar flexion — so those pieces can only ever run on forced rest.
  it('filters self-paced formats off pieces that need forced rest', () => {
    // Every piece declares forced-rest formats only, and the gate holds even if
    // one ever declared fortime: the banned movement filters it back out.
    const forge = pieceIn('d40-b1', 'The Forge'); // 1-arm row + hang snatch
    expect(formatsFor(forge)).not.toContain('fortime');
    expect(
      formatsFor({ ...forge, formats: ['emom', 'fortime'] }),
    ).not.toContain('fortime');
    const gate = pieceIn('d40-c1', 'The Gate'); // carries the hinge
    expect(
      formatsFor({ ...gate, formats: ['emom', 'fortime'] }),
    ).not.toContain('fortime');
  });

  it('no self-paced piece ever contains a banned movement, in any week', () => {
    for (const s of DENSITY40_SESSIONS) {
      for (let w = 1; w <= 12; w++) {
        const shaped = applyFormats(applyPhase(s, phaseOf(w)), w);
        for (const b of shaped.blocks) {
          if (b.mode !== 'fortime') continue;
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
    const gate = pieceIn('d40-c1', 'The Gate');
    const desc = applyPieceFormat(gate, 'emom-desc');
    const q = buildStepQueue({ id: 'x', blocks: [desc] });
    const lats = q.filter((s) => s.exId === 'db-lateral-raise' && s.countsAsSet);
    expect(lats).toHaveLength(4); // unchanged — 4 rounds
    expect(lats.map((s) => s.reps)).toEqual(['13', '12', '11', '10']);
    // the movements whose dose is quality- or symptom-capped never descend
    const rdl = q.filter((s) => s.exId === 'rdl' && s.countsAsSet);
    expect(rdl.map((s) => s.reps)).toEqual(['8', '8', '8', '8']);
  });

  it('leaves pieces with no declared formats completely alone', () => {
    // The stretches and the ramp declare no formats, so applyFormats must not
    // touch them — it only rewrites blocks that opted in.
    const s = getProgramSession('d40-b1');
    const inert = { ...s, blocks: s.blocks.filter((b) => !b.rotate) };
    for (let w = 1; w <= 12; w++) {
      expect(applyFormats(inert, w)).toEqual(inert);
    }
  });
});
