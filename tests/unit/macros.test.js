import { describe, expect, it } from 'vitest';
import {
  ACTIVITY,
  bmrMifflinStJeor,
  macroPlan,
  safeMaxRateKg,
  tdee,
  weeksToGoal,
} from '../../src/nutrition/macros.js';

describe('bmrMifflinStJeor', () => {
  it('computes the male formula', () => {
    // 10*80 + 6.25*180 - 5*30 + 5 = 800 + 1125 - 150 + 5 = 1780
    expect(bmrMifflinStJeor({ weightKg: 80, heightCm: 180, age: 30, sex: 'male' })).toBe(1780);
  });
  it('computes the female formula', () => {
    // 10*60 + 6.25*165 - 5*30 - 161 = 600 + 1031.25 - 150 - 161 = 1320.25 → 1320
    expect(bmrMifflinStJeor({ weightKg: 60, heightCm: 165, age: 30, sex: 'female' })).toBe(1320);
  });
  it('returns null on junk input', () => {
    expect(bmrMifflinStJeor({ weightKg: 0, heightCm: 180, age: 30 })).toBeNull();
    expect(bmrMifflinStJeor({})).toBeNull();
  });
});

describe('tdee', () => {
  it('multiplies BMR by the activity factor', () => {
    // BMR 1780 × 1.55 (moderate) = 2759
    expect(tdee({ weightKg: 80, heightCm: 180, age: 30, sex: 'male', activity: 'moderate' })).toBe(2759);
  });
  it('falls back to moderate for an unknown activity', () => {
    const a = tdee({ weightKg: 80, heightCm: 180, age: 30, sex: 'male', activity: 'bogus' });
    const b = tdee({ weightKg: 80, heightCm: 180, age: 30, sex: 'male', activity: 'moderate' });
    expect(a).toBe(b);
  });
  it('has the conventional multipliers', () => {
    expect(ACTIVITY.sedentary).toBe(1.2);
    expect(ACTIVITY.extra).toBe(1.9);
  });
});

describe('safeMaxRateKg', () => {
  it('is 1% of bodyweight, capped at 1 kg/week', () => {
    expect(safeMaxRateKg(70)).toBe(0.7);
    expect(safeMaxRateKg(120)).toBe(1); // 1.2 capped to 1
  });
});

describe('macroPlan', () => {
  const base = { weightKg: 80, heightCm: 180, age: 30, sex: 'male', activity: 'moderate' };

  it('maintenance = TDEE, no deficit', () => {
    const p = macroPlan({ ...base, goal: 'maintain' });
    expect(p.calories).toBe(p.maintenance);
    expect(p.dailyDelta).toBe(0);
    expect(p.rateKg).toBe(0);
  });

  it('applies the safe deficit for a loss goal (0.5 kg/wk ≈ −550/day)', () => {
    const p = macroPlan({ ...base, goal: 'lose', requestedRateKg: 0.5 });
    expect(p.dailyDelta).toBe(-550); // 0.5*7700/7
    expect(p.calories).toBe(p.maintenance - 550);
  });

  it('caps an unsafe requested rate to the safe max', () => {
    const p = macroPlan({ ...base, goal: 'lose', requestedRateKg: 2 });
    expect(p.cappedForSafety).toBe(true);
    expect(p.rateKg).toBeLessThanOrEqual(p.safeMaxRateKg);
  });

  it('caps the deficit at the calorie/BMR floor rather than starving', () => {
    // Tiny sedentary person: a 1 kg/wk deficit would blow past the floor.
    const p = macroPlan({
      weightKg: 45, heightCm: 150, age: 30, sex: 'female', activity: 'sedentary',
      goal: 'lose', requestedRateKg: 1,
    });
    expect(p.cappedByFloor).toBe(true);
    expect(p.calories).toBeGreaterThanOrEqual(Math.max(1200, p.bmr));
  });

  it('produces protein-forward macros that roughly sum to the calorie target', () => {
    const p = macroPlan({ ...base, goal: 'lose', requestedRateKg: 0.5 });
    expect(p.protein).toBe(160); // 80 × 2.0 g/kg in a deficit
    const kcal = p.protein * 4 + p.fat * 9 + p.carbs * 4;
    expect(Math.abs(kcal - p.calories)).toBeLessThanOrEqual(8); // rounding slack
  });

  it('returns null on junk input', () => {
    expect(macroPlan({ weightKg: 0 })).toBeNull();
  });
});

describe('weeksToGoal', () => {
  it('rounds up whole weeks at the given rate', () => {
    expect(weeksToGoal(80, 75, 0.5)).toBe(10); // 5 kg / 0.5
    expect(weeksToGoal(80, 76, 0.7)).toBe(6); // 4 / 0.7 = 5.7 → 6
  });
  it('is 0 when already at goal, null on junk', () => {
    expect(weeksToGoal(80, 80, 0.5)).toBe(0);
    expect(weeksToGoal(80, 75, 0)).toBeNull();
  });
});
