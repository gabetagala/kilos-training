import { describe, expect, it } from 'vitest';
import { mergeEnded, newerEnvelope } from '../../src/supabase.js';

// The handoff envelope is last-writer-wins: two devices cannot both be
// right about one running workout, so the newest save is the truth.
describe('newerEnvelope', () => {
  const a = { state: { sessionId: 'daily' }, deviceId: 'aa', updatedAt: 100 };
  const b = { state: null, deviceId: 'bb', updatedAt: 200 };

  it('picks the newer of two envelopes', () => {
    expect(newerEnvelope(a, b)).toBe(b);
    expect(newerEnvelope(b, a)).toBe(b);
  });

  it('a tombstone (state: null) wins on recency like any other write', () => {
    // finishing on the phone must beat an older laptop pause
    expect(newerEnvelope(a, b).state).toBeNull();
  });

  it('is null-safe in both directions', () => {
    expect(newerEnvelope(null, a)).toBe(a);
    expect(newerEnvelope(a, null)).toBe(a);
    expect(newerEnvelope(null, null)).toBeNull();
  });

  it('ties keep the first argument (local) — no churn on equal stamps', () => {
    const c = { ...a, updatedAt: 200 };
    expect(newerEnvelope(c, b)).toBe(c);
  });

  it("a tombstone for run R beats a LATER-stamped state save OF run R — device clocks skew, run identity doesn't", () => {
    const tomb = { state: null, runId: 'r1', deviceId: 'aa', updatedAt: 100 };
    const laterSave = {
      state: { sessionId: 'daily', runId: 'r1' },
      deviceId: 'bb',
      updatedAt: 999,
    };
    expect(newerEnvelope(tomb, laterSave)).toBe(tomb);
    expect(newerEnvelope(laterSave, tomb)).toBe(tomb);
  });

  it('a tombstone for a DIFFERENT run falls back to plain recency', () => {
    const tomb = { state: null, runId: 'r1', deviceId: 'aa', updatedAt: 100 };
    const otherRun = {
      state: { sessionId: 'daily', runId: 'r2' },
      deviceId: 'bb',
      updatedAt: 999,
    };
    expect(newerEnvelope(tomb, otherRun)).toBe(otherRun);
  });

  // 2026-09-27: "discard & start new" on the phone never reached the laptop —
  // the next run's first save overwrote the one-slot tombstone
  it('the ended list survives the next run overwriting the tombstone', () => {
    const phoneNewRun = {
      state: { sessionId: 'daily', runId: 'r2' },
      runId: 'r2',
      deviceId: 'phone',
      updatedAt: 200,
      ended: ['r1'],
    };
    const laptopStale = {
      state: { sessionId: 'daily', runId: 'r1' },
      runId: 'r1',
      deviceId: 'laptop',
      updatedAt: 900, // a later clock must not resurrect the discarded run
    };
    expect(newerEnvelope(laptopStale, phoneNewRun)).toBe(phoneNewRun);
    expect(newerEnvelope(phoneNewRun, laptopStale)).toBe(phoneNewRun);
  });

  it('merges both sides\' ended lists into the winner', () => {
    const a = { state: null, runId: 'r1', updatedAt: 100, ended: ['r0', 'r1'] };
    const b = {
      state: { runId: 'r3' },
      runId: 'r3',
      updatedAt: 300,
      ended: ['r2'],
    };
    const win = newerEnvelope(a, b);
    expect(win.state.runId).toBe('r3');
    expect(win.ended).toEqual(['r0', 'r1', 'r2']);
  });

  it('keeps the ended memory short', () => {
    const ids = Array.from({ length: 20 }, (_, i) => `r${i}`);
    expect(mergeEnded(ids)).toEqual(ids.slice(-12));
  });
});
