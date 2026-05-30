import { describe, expect, it } from 'vitest';
import { resolveExercise } from '../../src/personalization.js';

// resolveExercise(name, { equipmentTier, injuries }) is the core substitution
// logic: it swaps an exercise for one the athlete can actually do given their
// gym tier and any injuries. Injuries always win over equipment.

describe('resolveExercise — equipment tiers', () => {
  it('passes an exercise through unchanged on full-gym', () => {
    const r = resolveExercise('Barbell Bench Press', {
      equipmentTier: 'full-gym',
      injuries: [],
    });
    expect(r.name).toBe('Barbell Bench Press');
    expect(r.reason).toBe('none');
  });

  it('treats ph-local identically to full-gym (no assumptions = no subs)', () => {
    const r = resolveExercise('Barbell Bench Press', {
      equipmentTier: 'ph-local',
      injuries: [],
    });
    expect(r.name).toBe('Barbell Bench Press');
    expect(r.reason).toBe('none');
  });

  it('substitutes for a restricted tier (home-dumbbells)', () => {
    const r = resolveExercise('Barbell Bench Press', {
      equipmentTier: 'home-dumbbells',
      injuries: [],
    });
    expect(r.name).toBe('Incline Dumbbell Press');
    expect(r.reason).toBe('equipment');
    expect(r.original).toBe('Barbell Bench Press');
  });

  it('passes an unknown exercise through unchanged', () => {
    const r = resolveExercise('Totally Made Up Lift', {
      equipmentTier: 'bands',
      injuries: [],
    });
    expect(r.name).toBe('Totally Made Up Lift');
    expect(r.reason).toBe('none');
  });
});

describe('resolveExercise — injuries', () => {
  it('substitutes for an injury regardless of tier', () => {
    const r = resolveExercise('Conventional Deadlift', {
      equipmentTier: 'full-gym',
      injuries: ['lower-back'],
    });
    expect(r.name).toBe('Romanian Deadlift');
    expect(r.reason).toBe('injury');
    expect(r.injuryId).toBe('lower-back');
  });

  it('lets an injury win over an equipment substitution (priority)', () => {
    // Barbell Back Squat → knee injury sub is "Box Squat".
    const r = resolveExercise('Barbell Back Squat', {
      equipmentTier: 'bodyweight',
      injuries: ['knee'],
    });
    expect(r.reason).toBe('injury');
    expect(r.name).toBe('Box Squat');
  });
});

describe('resolveExercise — defensive', () => {
  it('handles a profile with no injuries key', () => {
    const r = resolveExercise('Barbell Bench Press', {
      equipmentTier: 'home-dumbbells',
    });
    expect(r.name).toBe('Incline Dumbbell Press');
    expect(r.reason).toBe('equipment');
  });
});
