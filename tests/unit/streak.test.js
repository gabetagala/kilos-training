import { describe, expect, it } from 'vitest';
import { currentStreak, longestStreak } from '../../src/workout/streak.js';

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

describe('longestStreak', () => {
  it('is 0 with no history', () => {
    expect(longestStreak([])).toBe(0);
  });

  it('finds a past run longer than the current streak', () => {
    // current streak is just today (1); a 4-day run sits 10–13 days back
    expect(longestStreak(hist(0, 10, 11, 12, 13))).toBe(4);
  });

  it('equals the current streak when the best run is ongoing', () => {
    expect(longestStreak(hist(0, 1, 2, 4, 5, 6, 7, 8, 9, 11, 12, 13))).toBe(12);
  });
});

// TWO REAL REST DAYS (2026-11-10): Thursday and Sunday are planned off. NOW
// (31 May 2026) is a Sunday, so dayAgo(3) and dayAgo(10) are Thursdays and
// dayAgo(7) the Sunday before.
describe('planned rest days', () => {
  const REST = [0, 4]; // Sun, Thu — REST_WEEKDAYS
  // Mon–Wed + Fri–Sat, two weeks running
  const twoWeeks = hist(1, 2, 4, 5, 6, 8, 9, 11, 12, 13);

  it('walk straight past a rest day — no grace spent, no day added', () => {
    expect(currentStreak(twoWeeks, NOW, REST)).toBe(10);
    // without them, the second rest day in a week broke every streak
    expect(currentStreak(twoWeeks, NOW)).toBe(5);
  });

  it('still count a day trained on a rest day', () => {
    expect(currentStreak(hist(1, 2, 3, 4), NOW, REST)).toBe(4);
  });

  it('never cover a missed training day — that still spends the grace', () => {
    // Saturday missed (grace), Friday, Thursday rests, Wednesday, then a
    // missed Tuesday breaks it
    expect(currentStreak(hist(2, 4), NOW, REST)).toBe(2);
  });

  it('reach the longest streak too', () => {
    expect(longestStreak(twoWeeks, REST)).toBe(10);
    expect(longestStreak(twoWeeks)).toBe(5);
  });
});
