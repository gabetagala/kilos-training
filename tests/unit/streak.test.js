import { describe, expect, it } from 'vitest';
import { currentStreak } from '../../src/workout/streak.js';

// Fixed "now" so tests are deterministic. May 31 2026, local midnight.
const NOW = new Date(2026, 4, 31);
const dayAgo = (n) => new Date(2026, 4, 31 - n);
const hist = (...offsets) => offsets.map((n) => ({ date: dayAgo(n) }));

describe('currentStreak', () => {
  it('is 0 with no history', () => {
    expect(currentStreak([], NOW)).toBe(0);
    expect(currentStreak(undefined, NOW)).toBe(0);
  });

  it('counts today as 1', () => {
    expect(currentStreak(hist(0), NOW)).toBe(1);
  });

  it('counts consecutive days', () => {
    expect(currentStreak(hist(0, 1, 2), NOW)).toBe(3);
  });

  it('does not break when today has no workout yet', () => {
    // trained yesterday only — streak survives until today is truly missed
    expect(currentStreak(hist(1, 2), NOW)).toBe(2);
  });

  it('allows one grace miss', () => {
    // today + 2-days-ago, yesterday skipped → grace covers it
    expect(currentStreak(hist(0, 2), NOW)).toBe(2);
  });

  it('breaks on a second consecutive miss', () => {
    // today, then miss, miss, then 3-days-ago → grace used once, then break
    expect(currentStreak(hist(0, 3), NOW)).toBe(1);
  });

  it('counts an unbroken 8-day run', () => {
    expect(currentStreak(hist(0, 1, 2, 3, 4, 5, 6, 7), NOW)).toBe(8);
  });

  it('earns the grace back every 7 trained days (two misses survive when 7+ apart)', () => {
    // miss at day 3 and day 10; grace resets at the 7th trained day, so both
    // misses are absorbed → 12 trained days counted.
    const offsets = [0, 1, 2, 4, 5, 6, 7, 8, 9, 11, 12, 13];
    expect(currentStreak(hist(...offsets), NOW)).toBe(12);
  });
});
