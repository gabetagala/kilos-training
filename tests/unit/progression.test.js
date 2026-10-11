import { describe, expect, it } from 'vitest';
import {
  allRepsMet,
  bestE1RM,
  estimate1RM,
  REPS_FIRST,
  repTargetTop,
  suggestNextWeight,
  suggestRepsFirst,
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

// ── Estimated session energy (2026-08-12) ───────────────────────────────────
import { estimateKcal, parseDurationMins } from '../../src/workout/progression.js';

describe('estimateKcal', () => {
  it('parses both duration formats', () => {
    expect(parseDurationMins('40:20')).toBeCloseTo(40.33, 1);
    expect(parseDurationMins('26 min')).toBe(26);
    expect(parseDurationMins(null)).toBe(0);
  });

  it('rates an EMOM40 day above straight sets above a rehab day', () => {
    const at = (type, programId, duration) =>
      estimateKcal({ type, programId, duration }, 78);
    const emom = at('strength', 'd40-a1', '40:00');
    const classic = at('strength', null, '40:00');
    const rehab = at('rehab', null, '38:00');
    expect(emom).toBeGreaterThan(classic);
    expect(classic).toBeGreaterThan(rehab);
    // 6.0 METs × 78kg × 2/3h = 312
    expect(emom).toBe(312);
  });

  it('caps salvaged wall-clock durations so the estimate stays honest', () => {
    // the interrupted entry that carried 237 minutes of pause
    const k = estimateKcal(
      { type: 'strength', programId: 'd40-c1', duration: '237:37' },
      78,
    );
    expect(k).toBeLessThanOrEqual(Math.round(6 * 78 * 1.25));
  });

  it('returns null with nothing to go on', () => {
    expect(estimateKcal({ type: 'strength', duration: null }, 78)).toBeNull();
  });
});

// REPS FIRST, THEN LOAD (2026-10-10, coach QA): on an 8 kg lateral raise a
// +2.5 kg jump is +31% — the target fails, then oscillates. The small lifts
// earn reps at the same weight first, up to three over the prescription.
describe('suggestRepsFirst', () => {
  const sets = (weight, ...reps) => reps.map((r) => ({ weight, reps: String(r) }));

  it('returns null with no history, and with nothing loaded', () => {
    expect(suggestRepsFirst(null, '12')).toBeNull();
    expect(suggestRepsFirst([], '12')).toBeNull();
    expect(suggestRepsFirst(sets('0', 12, 12), '12')).toBeNull();
  });

  it('asks for one more rep than the weakest set, at the same weight', () => {
    expect(suggestRepsFirst(sets('8', 12, 12, 12), '12')).toEqual({ weight: 8, reps: 13 });
    // the WEAKEST set sets the bar — not the best one
    expect(suggestRepsFirst(sets('8', 14, 13, 13), '12')).toEqual({ weight: 8, reps: 14 });
    expect(suggestRepsFirst(sets('8', 14, 14, 14), '12')).toEqual({ weight: 8, reps: 15 });
  });

  it('adds 2.5 kg and resets the reps once every set reached target + 3', () => {
    expect(suggestRepsFirst(sets('8', 15, 15, 16), '12')).toEqual({
      weight: 10.5,
      reps: null, // null = back to the prescription as written
    });
    // the heaviest set is the base for the jump
    expect(
      suggestRepsFirst([{ weight: '8', reps: '15' }, { weight: '9', reps: '15' }], '12'),
    ).toEqual({ weight: 11.5, reps: null });
  });

  it('holds weight and prescription while short of the target', () => {
    expect(suggestRepsFirst(sets('8', 12, 11, 10), '12')).toEqual({ weight: 8, reps: null });
  });

  it('reads the number out of a suffixed prescription, defaulting to 10', () => {
    expect(suggestRepsFirst(sets('6', 10, 10), '10/side')).toEqual({ weight: 6, reps: 11 });
    expect(suggestRepsFirst(sets('6', 12, 12), null)).toEqual({ weight: 6, reps: 13 });
    expect(suggestRepsFirst(sets('6', 13, 13), null)).toEqual({ weight: 8.5, reps: null });
    expect(suggestRepsFirst(sets('6', 10), null)).toEqual({ weight: 6, reps: 11 });
  });

  it('with no reps logged, keeps the weight and the prescription', () => {
    expect(suggestRepsFirst([{ weight: '8' }], '12')).toEqual({ weight: 8, reps: null });
  });

  it('is reserved for the small lifts and the DB press anchor; the rest load first', () => {
    for (const ex of [
      'db-lateral-raise',
      'supinated-curl',
      'lying-db-extension',
      'incline-y-raise',
      'db-calf-raise',
      // the press anchor too (round 2, coach QA): +2.5 kg per DB on a 22.5 kg
      // dumbbell is +11% — it earns 8 → 11 reps first, then loads
      'incline-db-press',
      // round 3: Tuesday's DB bench press — a DB press, same reason
      'db-bench-press',
      // round 4: the split squats — a 2.5 kg step per DB is a big jump on a
      // unilateral lift; they earn reps first
      'db-split-squat',
      'rfe-split-squat',
      // no sliders: the cable leg curl earns reps first too
      'cable-leg-curl',
    ]) {
      expect(REPS_FIRST.has(ex), ex).toBe(true);
    }
    // the barbell and bodyweight anchors and the hinge still load first
    for (const ex of ['front-squat', 'pull-up-bw', 'rdl', 'lat-pulldown']) {
      expect(REPS_FIRST.has(ex), ex).toBe(false);
    }
  });
});
