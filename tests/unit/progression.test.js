import { describe, expect, it } from 'vitest';
import { allRepsMet, suggestNextWeight } from '../../src/workout/progression.js';

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
