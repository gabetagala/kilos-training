import { describe, expect, it } from 'vitest';
import {
  applyRamp,
  BLOCK_WEEKS,
  blockState,
  newerBlock,
  RAMP,
  RAMP_REST_SECS,
  RAMP_WEEKS,
  rampWeek,
  rawWeek,
  restartStartISO,
  rotationWeek,
} from '../../src/workout/block.js';
import {
  DENSITY40_SESSIONS,
  getProgramSession,
} from '../../src/workout/program.js';
import { rampWeight } from '../../src/workout/progression.js';
import { buildStepQueue, getRehabSession, sessionBlocks } from '../../src/workout/rehab.js';

// Restart on Monday 21 Sep 2026 → ramp weeks 21 Sep + 28 Sep, week 1 on 5 Oct
const RESTART_MON = new Date('2026-09-21T08:00:00');
const START = restartStartISO(RESTART_MON);

const blocksOf = (s) => s.blocks.flatMap((b) => b.rotate || [b]);
const workSets = (q) => q.filter((st) => st.kind === 'work' && st.countsAsSet);

describe('restart dates', () => {
  it('a Mon–Thu restart puts week 1 two Mondays out', () => {
    expect(new Date(START).getDate()).toBe(5);
    expect(new Date(START).getMonth()).toBe(9); // October
    const thu = restartStartISO(new Date('2026-09-24T20:00:00'));
    expect(thu).toBe(START);
  });

  it('a Fri–Sun restart buys one more week, so ramp 1 has real days in it', () => {
    const sun = restartStartISO(new Date('2026-09-27T10:00:00'));
    expect(new Date(sun).getDate()).toBe(12);
    // the leftover Sunday and the next full week are both ramp week 1
    expect(rampWeek(sun, RAMP_WEEKS, new Date('2026-09-27T10:00:00'))).toBe(1);
    expect(rampWeek(sun, RAMP_WEEKS, new Date('2026-09-29T10:00:00'))).toBe(1);
    expect(rampWeek(sun, RAMP_WEEKS, new Date('2026-10-06T10:00:00'))).toBe(2);
  });
});

describe('ramp weeks', () => {
  it('runs ramp 1 → ramp 2 → week 1 of the block', () => {
    expect(rampWeek(START, 2, new Date('2026-09-21T09:00:00'))).toBe(1);
    expect(rampWeek(START, 2, new Date('2026-09-27T21:00:00'))).toBe(1);
    expect(rampWeek(START, 2, new Date('2026-09-28T06:00:00'))).toBe(2);
    expect(rampWeek(START, 2, new Date('2026-10-05T06:00:00'))).toBe(null);
    expect(blockState(START, new Date('2026-10-05T06:00:00'), 2).week).toBe(1);
  });

  it('a block started without a ramp keeps its old pre-start terms', () => {
    expect(rampWeek(START, 0, new Date('2026-09-22T09:00:00'))).toBe(null);
    const b = blockState(START, new Date('2026-09-22T09:00:00'));
    expect(b.ramp).toBe(null);
    expect(b.rotWeek).toBe(null);
  });

  it('blockState: no tests, no deload, no week number inside the ramp', () => {
    const b = blockState(START, new Date('2026-09-23T09:00:00'), 2);
    expect(b).toMatchObject({
      week: null,
      ramp: 1,
      phase: 1,
      phaseName: 'RAMP',
      tests: [],
      deloadCheckpoint: false,
    });
  });

  it('ramp weeks read the week-11/12 rotation columns, never a negative index', () => {
    expect(rawWeek(START, new Date('2026-09-22T09:00:00'))).toBe(-1);
    expect(blockState(START, new Date('2026-09-22T09:00:00'), 2).rotWeek).toBe(11);
    expect(blockState(START, new Date('2026-09-29T09:00:00'), 2).rotWeek).toBe(12);
    expect(rotationWeek(-2)).toBe(BLOCK_WEEKS - 2);
    expect(rotationWeek(3)).toBe(3);
  });
});

describe('applyRamp', () => {
  // Pieces lose rounds off the TOP (ramp 1: two short, ramp 2: one short),
  // never below one; EMOM pieces get the rest minute back and run plain;
  // supersets keep their own timed rests. No piece keeps a format, a
  // rep-out note or a descending ladder — nothing scored, nothing self-paced.
  it('cuts piece rounds, gives back the rest, drops every format', () => {
    for (const r of [1, 2]) {
      for (const base of DENSITY40_SESSIONS) {
        const s = applyRamp(base, r);
        expect(s.ramp).toBe(r);
        const pieces = blocksOf(s).filter((b) => b?.isPiece);
        expect(pieces.length).toBeGreaterThan(0);
        for (const p of pieces) {
          const full = blocksOf(base).find((b) => b?.name === p.name);
          expect(p.rounds).toBe(
            Math.max(1, Math.min(RAMP[r].pieceRounds, full.rounds - (3 - r))),
          );
          expect(p.rounds).toBeLessThan(full.rounds);
          if (p.mode === 'emom') expect(p.roundRestSecs).toBe(RAMP_REST_SECS);
          else expect(p.mode).toBe('circuit');
          expect(p.formats).toBeUndefined();
          for (const m of p.members) {
            expect(m.lastRoundNote).toBeUndefined();
            expect(m.repsPerRound).toBeUndefined();
          }
        }
      }
    }
  });

  it('drops one anchor set in ramp 1, keeps any build rounds', () => {
    const base = getProgramSession('d40-b1');
    const anchor = (s) => blocksOf(s).find((b) => b.anchor);
    const full = anchor(base);
    expect(anchor(applyRamp(base, 1)).rounds).toBe(full.rounds - 1);
    expect(anchor(applyRamp(base, 2)).rounds).toBe(full.rounds);
    expect(anchor(applyRamp(base, 1)).warmupRounds).toBe(full.warmupRounds);
  });

  it('every ramp day is lighter than the full day, and ramp 1 is lighter than ramp 2', () => {
    for (const base of DENSITY40_SESSIONS) {
      for (let v = 0; v < 4; v++) {
        const n = (s) => workSets(buildStepQueue(s, {}, v)).length;
        expect(n(applyRamp(base, 1))).toBeLessThan(n(applyRamp(base, 2)));
        expect(n(applyRamp(base, 2))).toBeLessThan(n(base));
      }
    }
  });

  // No scores in the ramp: a score set while detrained becomes the last he
  // races for a month — so Saturday's scored finisher and the carry go. The
  // PUMPS STAY (round 4: a ramp Back & Hips day had less arm work than a
  // short day), shaped down like any piece: rounds off the top, relative.
  it('the daily loses its scored finisher and carry, keeps the pumps shaped down', () => {
    const daily = getRehabSession('daily');
    const ramped = applyRamp(daily, 1);
    const finishers = daily.blocks.filter((b) => b.finisher);
    // pump A, farmer carry, suitcase carry (round 6), curl & lateral, the
    // scored finisher, calves
    expect(finishers).toHaveLength(6);
    const pumps = finishers.filter((b) => b.pump);
    expect(pumps).toHaveLength(3);
    expect(ramped.blocks.length).toBe(daily.blocks.length - (finishers.length - pumps.length));
    expect(ramped.blocks.filter((b) => b.finisher).every((b) => b.pump)).toBe(true);
    // Tue Arms 4 · Calves 3; Thu Row & Raise 3 · Curl & Lateral 5 · Calves 3
    // (45-min round); ramp 1 is two rounds short (capped at 2), ramp 2 one
    // short (capped at 3)
    const ROUNDS = {
      1: { 0: { Arms: 2, Calves: 1 }, 1: { 'Row & Raise': 1, 'Curl & Lateral': 2, Calves: 1 } },
      2: { 0: { Arms: 3, Calves: 2 }, 1: { 'Row & Raise': 2, 'Curl & Lateral': 3, Calves: 2 } },
    };
    for (const ramp of [1, 2]) {
      for (const k of [0, 1]) {
        const blocks = sessionBlocks(applyRamp(daily, ramp), k).filter((b) => b.mode === 'circuit');
        const got = Object.fromEntries(blocks.map((b) => [b.name, b.rounds]));
        expect(got, `ramp ${ramp} k${k}`).toEqual(ROUNDS[ramp][k]);
        // a ramp pump never runs a format or a max set
        for (const b of blocks) {
          expect(b.formats, b.name).toBeUndefined();
          for (const m of b.members) expect(m.lastRoundNote, m.ex).toBeUndefined();
        }
      }
    }
    for (let w = 0; w < 4; w++) {
      for (const k of [0, 1, 2]) {
        const v = w * 4 + k;
        const q = buildStepQueue(ramped, {}, v);
        // nothing scored, no carry — only the pumps carry a block label
        expect(q.some((st) => st.piece), `v${v}`).toBe(false);
        expect(q.some((st) => st.exId === 'farmer-carry'), `v${v}`).toBe(false);
        expect(q.some((st) => st.exId === 'suitcase-carry'), `v${v}`).toBe(false);
        const labels = [...new Set(q.map((st) => st.blockLabel).filter(Boolean))];
        expect(labels, `v${v}`).toEqual(
          [['Arms', 'Calves'], ['Row & Raise', 'Curl & Lateral', 'Calves'], []][k],
        );
        const ids = new Set(q.map((st) => st.exId));
        for (const ex of [
          't-spine-reach',
          'couch-stretch',
          'hip-internal-rotation',
          'mcgill-curlup',
          'side-plank',
          'bird-dog',
          'elephant-walk',
          'seated-good-morning',
        ]) {
          expect(ids.has(ex), `v${v} ${ex}`).toBe(true);
        }
        // the back extension stays on its Thu/Sat days — a ramp is lighter,
        // never a different day
        expect(ids.has('back-extension'), `v${v}`).toBe(k !== 0);
      }
    }
  });

  it('leaves sessions with nothing to ramp untouched in shape', () => {
    const sunday = getRehabSession('sunday');
    expect(applyRamp(sunday, 1).blocks).toEqual(sunday.blocks);
    expect(applyRamp(sunday, null)).toBe(sunday);
  });
});

describe('ramp load target', () => {
  it('eases ~10% under the last weight, on a loadable 2.5', () => {
    expect(rampWeight([{ weight: '80', reps: '5' }])).toBe(72.5);
    expect(rampWeight([{ weight: 60 }, { weight: 62.5 }])).toBe(57.5);
    expect(rampWeight([{ weight: 1 }])).toBe(null); // nothing loadable under it
    expect(rampWeight([{ weight: 0 }])).toBe(null);
    expect(rampWeight(null)).toBe(null);
  });
});

describe('restart sync', () => {
  const a = { start: '2026-08-10T00:00:00.000Z', setAt: '2026-08-07T10:00:00Z', ramp: 0 };
  const b = { start: START, setAt: '2026-09-21T08:00:00Z', ramp: 2 };
  it('the newest restart wins, whichever side it is on', () => {
    expect(newerBlock(a, b)).toBe(b);
    expect(newerBlock(b, a)).toBe(b);
  });
  it('is null-safe', () => {
    expect(newerBlock(null, b)).toBe(b);
    expect(newerBlock(b, null)).toBe(b);
    expect(newerBlock(null, null)).toBe(null);
  });
});
