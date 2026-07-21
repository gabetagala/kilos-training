import { describe, expect, it } from 'vitest';
import {
  allRepsMet,
  bestE1RM,
  estimate1RM,
  repTargetTop,
  suggestNextWeight,
} from '../../src/workout/progression.js';

describe('suggestNextWeight', () => {
  it('returns null when there is no prior session', () => {
    expect(suggestNextWeight(null, '5')).toBeNull();
    expect(suggestNextWeight([], '5')).toBeNull();
  });

  it('returns null when no set had a positive weight (bodyweight)', () => {
    expect(suggestNextWeight([{ weight: '0', reps: '10' }], '10')).toBeNull();
  });

  it('adds 2.5kg when every set met the rep target', () => {
    const last = [
      { weight: '60', reps: '5' },
      { weight: '60', reps: '5' },
    ];
    expect(suggestNextWeight(last, '5')).toBe(62.5);
  });

  it('holds the weight when any set fell short of target reps', () => {
    const last = [
      { weight: '60', reps: '5' },
      { weight: '60', reps: '3' },
    ];
    expect(suggestNextWeight(last, '5')).toBe(60);
  });

  it('treats a blank reps entry as "met" (counts toward progression)', () => {
    expect(suggestNextWeight([{ weight: '60', reps: '' }], '5')).toBe(62.5);
  });

  it('uses the top set as the base and rounds to the nearest 0.5kg', () => {
    const last = [
      { weight: '61.25', reps: '5' },
      { weight: '50', reps: '5' },
    ];
    // top 61.25 + 2.5 = 63.75 → round to 0.5 → 64
    expect(suggestNextWeight(last, '5')).toBe(64);
  });

  it('defaults the rep target to 8 when not given', () => {
    expect(suggestNextWeight([{ weight: '60', reps: '7' }], undefined)).toBe(60);
    expect(suggestNextWeight([{ weight: '60', reps: '8' }], undefined)).toBe(
      62.5,
    );
  });
});

describe('allRepsMet', () => {
  it('is false with no prior session', () => {
    expect(allRepsMet([], '5')).toBe(false);
    expect(allRepsMet(null, '5')).toBe(false);
  });

  it('is true only when every set hit the target', () => {
    expect(allRepsMet([{ reps: '5' }, { reps: '6' }], '5')).toBe(true);
    expect(allRepsMet([{ reps: '5' }, { reps: '4' }], '5')).toBe(false);
  });

  it('counts a blank reps entry as met', () => {
    expect(allRepsMet([{ reps: '' }], '5')).toBe(true);
  });
});

describe('estimate1RM', () => {
  it('returns the exact weight for a true single', () => {
    expect(estimate1RM('100', '1')).toBe(100);
  });

  it('applies the Epley formula for multi-rep sets (rounded to 0.5)', () => {
    // 100 * (1 + 5/30) = 116.666… → 116.5
    expect(estimate1RM('100', '5')).toBe(116.5);
    // 60 * (1 + 10/30) = 80
    expect(estimate1RM('60', '10')).toBe(80);
  });

  it('accepts numbers as well as strings', () => {
    expect(estimate1RM(100, 5)).toBe(116.5);
  });

  it('returns null for junk input (no weight or no reps)', () => {
    expect(estimate1RM('0', '5')).toBeNull();
    expect(estimate1RM('100', '0')).toBeNull();
    expect(estimate1RM('', '')).toBeNull();
    expect(estimate1RM(undefined, undefined)).toBeNull();
  });
});

describe('bestE1RM', () => {
  it('returns the highest estimated 1RM across logs', () => {
    const logs = [
      { weight: '100', reps: '5' }, // 116.5
      { weight: '120', reps: '1' }, // 120
      { weight: '90', reps: '8' }, // 114
    ];
    expect(bestE1RM(logs)).toBe(120);
  });

  it('ignores logs with no usable numbers', () => {
    expect(bestE1RM([{ weight: '', reps: '' }, { weight: '80', reps: '3' }])).toBe(
      88,
    );
  });

  it('returns null when nothing qualifies', () => {
    expect(bestE1RM([])).toBeNull();
    expect(bestE1RM(null)).toBeNull();
    expect(bestE1RM([{ weight: '0', reps: '0' }])).toBeNull();
  });
});

describe('repTargetTop — range prescriptions gate on the TOP', () => {
  it('parses the upper bound of a range', () => {
    expect(repTargetTop('5–8')).toBe(8);
    expect(repTargetTop('8–12/side')).toBe(12);
    expect(repTargetTop('12-15')).toBe(15);
  });

  it('passes plain numbers through and nulls junk', () => {
    expect(repTargetTop('8')).toBe(8);
    expect(repTargetTop(8)).toBe(8);
    expect(repTargetTop('')).toBeNull();
    expect(repTargetTop(undefined)).toBeNull();
  });

  it('suggestNextWeight only escalates at the top of the range', () => {
    const bottomOnly = [
      { weight: '60', reps: '5' },
      { weight: '60', reps: '5' },
    ];
    const topHit = [
      { weight: '60', reps: '8' },
      { weight: '60', reps: '8' },
    ];
    expect(suggestNextWeight(bottomOnly, '5–8')).toBe(60);
    expect(suggestNextWeight(topHit, '5–8')).toBe(62.5);
  });

  it('legacy range-string reps ("5–8" stored as reps) never auto-escalate', () => {
    const legacy = [{ weight: '60', reps: '5–8' }];
    expect(suggestNextWeight(legacy, '5–8')).toBe(60);
    expect(allRepsMet(legacy, '5–8')).toBe(false);
  });
});
