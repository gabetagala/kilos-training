import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ART_MANIFEST } from '../../scripts/art-manifest.mjs';
import { EXERCISES_DB, MUSCLES } from '../../src/data.js';
import { PROGRAM_EXERCISES } from '../../src/workout/program.js';
import { REHAB_EXERCISES } from '../../src/workout/rehab.js';
import { PROGRAM_DEMOS } from '../../src/workout/rehabDemos.js';
import { EXPECTED_LOW, MUSCLE_MAP, TARGETS } from '../../src/workout/volume.js';
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

// ── The 2026-10-10 rework's four new movements ──────────────────────────────
// Each one has to be a FULL citizen the day it ships: a definition with a
// rep tempo, a muscle group for the history screens, a volume credit for the
// weekly audit, a demo, generated art and a spoken name. Missing any one of
// them is a silent gap (raw id on screen, zero credit, a blank demo, silence).
describe('new movements (2026-10-10)', () => {
  const NEW = {
    'db-calf-raise': { group: 'Legs', credit: 'calves' },
    'slider-leg-curl': { group: 'Legs', credit: 'hams' }, // defined, no longer served
    'cable-leg-curl': { group: 'Legs', credit: 'hams' }, // the curl, on the cable
    'lying-db-extension': { group: 'Triceps', credit: 'triceps' },
    'incline-y-raise': { group: 'Shoulders', credit: 'upperback' },
    // round 3: Tuesday's loadable chest press
    'db-bench-press': { group: 'Chest', credit: 'chest' },
  };
  const root = new URL('../../', import.meta.url);

  for (const [id, { group, credit }] of Object.entries(NEW)) {
    it(`${id} is defined, grouped, credited, demoed, drawn and voiced`, () => {
      const ex = PROGRAM_EXERCISES[id];
      expect(ex?.name, id).toBeTruthy();
      expect(ex.cue && ex.why && ex.feel && ex.avoid, id).toBeTruthy();
      expect(ex.repTempo?.length, `${id} tempo`).toBeGreaterThan(0);
      expect(resolveMuscleGroup(ex.name, EXERCISES_DB), id).toBe(group);
      expect(MUSCLE_MAP[id]?.[credit], `${id} → ${credit}`).toBe(1);
      expect(PROGRAM_DEMOS[id], `${id} demo`).toBeTruthy();
      expect(ART_MANIFEST[id], `${id} art prompt`).toBeTruthy();
      for (const pose of ['a', 'b']) {
        expect(
          existsSync(new URL(`public/rehab/${id}-${pose}.webp`, root)),
          `${id}-${pose}.webp`,
        ).toBe(true);
      }
      expect(existsSync(new URL(`public/voice/name-${id}.m4a`, root)), `${id} voice`).toBe(
        true,
      );
    });
  }

  it('the two leg gaps they close carry a weekly target', () => {
    // calves had no work at all; hamstrings had only the RDL (coach QA)
    expect(TARGETS.calves).toBe(8);
    expect(TARGETS.hams).toBe(8);
  });

  // round 3: the triangle's floors rose — lats with Monday's five pull-up
  // sets, chest with Tuesday's bench press, side delts with the anchor pairs
  // sprint round: the sprint is a full citizen — Legs on the history
  // screens, NO volume credit (it is speed work, not a hypertrophy set),
  // drawn, voiced and demoed
  it('the sprint is grouped, uncredited, drawn and voiced', () => {
    const ex = PROGRAM_EXERCISES.sprint;
    expect(resolveMuscleGroup(ex.name, EXERCISES_DB)).toBe('Legs');
    expect(MUSCLE_MAP.sprint).toEqual({});
    expect(PROGRAM_DEMOS.sprint).toBeTruthy();
    expect(ART_MANIFEST.sprint).toBeTruthy();
    const root = new URL('../../', import.meta.url);
    for (const pose of ['a', 'b']) {
      expect(existsSync(new URL(`public/rehab/sprint-${pose}.webp`, root)), pose).toBe(true);
    }
    expect(existsSync(new URL('public/voice/name-sprint.m4a', root))).toBe(true);
  });

  // round 6: the obliques' real dose is the daily side-core medicine the
  // tally excludes, so a low tally there is expected, not a gap
  it('the obliques join the front delts as expected-low', () => {
    expect([...EXPECTED_LOW].sort()).toEqual(['frontdelt', 'obliques']);
  });

  it('the triangle carries its round-3 floors', () => {
    expect(TARGETS.lats).toBe(11);
    expect(TARGETS.chest).toBe(12);
    expect(TARGETS.sidedelt).toBe(12);
  });
});
