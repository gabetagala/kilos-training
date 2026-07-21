import { describe, expect, it } from 'vitest';
import { EXERCISES_DB, MUSCLES } from '../../src/data.js';
import { PROGRAM_EXERCISES } from '../../src/workout/program.js';
import { REHAB_EXERCISES } from '../../src/workout/rehab.js';
import {
  loggedExercisesOf,
  resolveMuscleGroup,
} from '../../src/workout/muscles.js';

describe('resolveMuscleGroup', () => {
  it('every program exercise resolves to a DISPLAYED group', () => {
    for (const ex of Object.values(PROGRAM_EXERCISES)) {
      const g = resolveMuscleGroup(ex.name, EXERCISES_DB);
      expect(g, ex.name).toBeTruthy();
      expect(MUSCLES, `${ex.name} → ${g}`).toContain(g);
    }
  });

  it('every rehab exercise resolves to a DISPLAYED group', () => {
    for (const ex of Object.values(REHAB_EXERCISES)) {
      const g = resolveMuscleGroup(ex.name, EXERCISES_DB);
      expect(g, ex.name).toBeTruthy();
      expect(MUSCLES, `${ex.name} → ${g}`).toContain(g);
    }
  });

  it('exact DB names keep their group; unknowns return null', () => {
    expect(resolveMuscleGroup('Barbell Bench Press', EXERCISES_DB)).toBe(
      'Chest',
    );
    expect(resolveMuscleGroup('Underwater Basket Press', EXERCISES_DB)).toBe(
      null,
    );
  });
});

describe('loggedExercisesOf', () => {
  it('strength counts everything; rehab only logged exercises; CF nothing', () => {
    const strength = {
      type: 'strength',
      exercises: [{ name: 'Front Squat', logs: [] }],
    };
    const rehab = {
      type: 'rehab',
      exercises: [
        { name: 'Romanian Deadlift', logs: [{ weight: 70, reps: 8 }] },
        { name: 'Side Plank', logs: [] },
      ],
    };
    const cf = { type: 'amrap', exercises: [{ name: 'X', logs: [{}] }] };
    expect(loggedExercisesOf(strength)).toHaveLength(1);
    expect(loggedExercisesOf(rehab).map((e) => e.name)).toEqual([
      'Romanian Deadlift',
    ]);
    expect(loggedExercisesOf(cf)).toHaveLength(0);
  });
});
