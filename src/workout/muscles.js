// Exercise-name → displayed muscle group resolution — pure, no DOM.
// The Home muscle-status row, Quick Start chips, and the rest-day suggestion
// all resolve through HERE, so an exercise the DB doesn't know by exact name
// (the whole guided program, for a start) still lands in a displayed group.

// Explicit map for every program.js / rehab.js exercise name. Kept by hand:
// these names are ours, so exactness is cheap and unambiguous.
export const MUSCLE_ALIASES = {
  // program.js — Density 40
  'Weighted Pull-Up': 'Back',
  'Strict Pull-Up': 'Back',
  'Lat Pulldown': 'Back',
  '1-Arm Cable Row': 'Back',
  'Chest-Supported DB Row': 'Back',
  'Rope Face Pull': 'Shoulders',
  'Band Pull-Apart': 'Shoulders',
  'DB Lateral Raise': 'Shoulders',
  'Cable Lateral Raise': 'Shoulders',
  'Band Lateral Raise': 'Shoulders',
  'Front Squat': 'Legs',
  'Heavy DB Split Squat': 'Legs',
  'Rear-Foot-Elevated Split Squat': 'Legs',
  'Barbell Floor Press': 'Chest',
  'DB Floor Press': 'Chest',
  '30° Incline DB Press': 'Chest',
  'Feet-Elevated Push-Up': 'Chest',
  'Low-to-High Band Fly': 'Chest',
  '1-Arm Low-Cable Fly': 'Chest',
  'Rope Pushdown': 'Triceps',
  'Overhead Rope Extension': 'Triceps',
  'DB Hammer Curl': 'Biceps',
  'DB Supinated Curl': 'Biceps',
  'DB Reverse Curl': 'Biceps',
  'DB Wrist Curl': 'Biceps',
  'Reverse Wrist Curl': 'Biceps',
  'Suitcase Carry': 'Core',
  'Farmer Carry': 'Core',
  // rehab.js
  'Romanian Deadlift': 'Legs',
  'Glute Bridge': 'Legs',
  'Single-Leg Bridge': 'Legs',
  'Dead Hang': 'Back',
  'McGill Curl-Up': 'Core',
  'Side Plank': 'Core',
  'Bird Dog': 'Core',
  'Hamstring Stretch': 'Legs',
  'Hip Flexor Stretch': 'Legs',
};

const norm = (s) =>
  String(s)
    .toLowerCase()
    .replace(/\bdb\b/g, 'dumbbell')
    .replace(/\bbb\b/g, 'barbell')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

// Resolve to a displayed group or null. `db` is EXERCISES_DB.
export function resolveMuscleGroup(exName, db) {
  if (!exName) return null;
  if (MUSCLE_ALIASES[exName]) return MUSCLE_ALIASES[exName];
  const exact = db.find((e) => e.name === exName);
  if (exact?.group) return exact.group;
  const n = norm(exName);
  const fuzzy = db.find((e) => norm(e.name) === n);
  if (fuzzy?.group) return fuzzy.group;
  // Olympic/compound groups fold into their dominant displayed group.
  const aliasFuzzy = Object.keys(MUSCLE_ALIASES).find((k) => norm(k) === n);
  if (aliasFuzzy) return MUSCLE_ALIASES[aliasFuzzy];
  return null;
}

// Which history entries count for muscle recency: strength always; rehab only
// through its LOGGED exercises (the RDL — timed holds don't claim a group).
export function loggedExercisesOf(entry) {
  if (!entry?.exercises) return [];
  if (entry.type === 'strength') return entry.exercises;
  if (entry.type === 'rehab') {
    return entry.exercises.filter((ex) => ex.logs?.length);
  }
  return [];
}
