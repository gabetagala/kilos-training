import { describe, expect, it } from 'vitest';
import {
  applyRamp,
  applyShort,
  SHORT,
} from '../../src/workout/block.js';
import { DENSITY40_SESSIONS } from '../../src/workout/program.js';
import {
  buildStepQueue,
  estimateSessionMins,
  getRehabSession,
  REHAB_SESSIONS,
} from '../../src/workout/rehab.js';

const blocksOf = (s) => s.blocks.flatMap((b) => b.rotate || [b]);
const holds = (s) => blocksOf(s).filter((b) => b.mode === 'hold');

describe('the short lift day', () => {
  it('is one trip through the piece and two anchor sets', () => {
    for (const base of DENSITY40_SESSIONS) {
      const s = applyShort(base);
      const anchor = blocksOf(s).find((b) => b.anchor);
      expect(anchor.rounds).toBe((anchor.warmupRounds || 0) + SHORT.anchorSets);
      for (const p of blocksOf(s).filter((b) => !b.anchor)) {
        expect(p.rounds).toBe(1);
        expect(p.mode).toBe('emom');
        expect(p.formats).toBeUndefined();
      }
    }
  });

  it('lands every lift day between 10 and 20 minutes', () => {
    for (const base of DENSITY40_SESSIONS) {
      for (let v = 0; v < 4; v++) {
        const mins = estimateSessionMins(applyShort(base), v);
        expect(mins).toBeGreaterThanOrEqual(10);
        expect(mins).toBeLessThanOrEqual(20);
      }
    }
  });
});

describe('the short rehab day', () => {
  const daily = getRehabSession('daily');

  it('halves the long holds and never the McGill core cap', () => {
    const short = applyShort(daily);
    for (const b of holds(daily)) {
      const match = holds(short).find((x) => x.ex === b.ex);
      if (!match) continue; // the supporting cast is dropped entirely
      expect(match.holdSecs).toBe(Math.max(60, Math.round(b.holdSecs / 2 / 10) * 10));
    }
    // the caps are mode 'reps' at 10s protocol holds — untouched
    const caps = blocksOf(short).filter((b) => b.mode === 'reps');
    expect(caps.length).toBeGreaterThan(0);
    for (const c of caps) expect(c.holdSecs).toBe(10);
  });

  it('drops the supporting cast and the scored finisher, keeps the favorites', () => {
    const short = applyShort(daily);
    expect(short.blocks.some((b) => b.cast || b.finisher)).toBe(false);
    for (let v = 0; v < 16; v++) {
      const q = buildStepQueue(short, {}, v);
      expect(q.some((st) => st.piece)).toBe(false); // no finisher
      const ids = new Set(q.map((st) => st.exId));
      for (const ex of ['t-spine-reach', 'back-extension', 'elephant-walk']) {
        expect(ids.has(ex)).toBe(true);
      }
    }
  });

  it('is about a quarter of an hour, not a token', () => {
    for (const id of ['daily', 'sunday']) {
      for (let v = 0; v < 8; v++) {
        const mins = estimateSessionMins(applyShort(getRehabSession(id)), v);
        expect(mins).toBeGreaterThanOrEqual(10);
        expect(mins).toBeLessThanOrEqual(20);
      }
    }
  });
});

describe('applyShort is safe to re-apply', () => {
  it('is idempotent — a restore never halves a hold twice', () => {
    for (const s of [...DENSITY40_SESSIONS, ...REHAB_SESSIONS]) {
      const once = applyShort(s);
      expect(applyShort(once)).toBe(once);
      expect(applyShort(applyShort(s))).toEqual(once);
    }
  });

  it('composes with a ramp week without double-cutting', () => {
    for (const s of DENSITY40_SESSIONS) {
      const a = applyShort(applyRamp(s, 1));
      const b = applyShort(s);
      const rounds = (x) => blocksOf(x).map((v) => v.rounds);
      expect(rounds(a)).toEqual(rounds(b));
    }
  });

  it('leaves a session with nothing to cut alone', () => {
    const reset = getRehabSession('reset');
    expect(applyShort(reset).blocks).toEqual(reset.blocks);
  });
});
