import { describe, expect, it } from 'vitest';
import { newerEnvelope } from '../../src/supabase.js';

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
});
