// ─────────────────────────────────────────────────────────────────────────────
// KILOS TRAINING  –  data.js
// Exercise database + Shuffle plans grounded in peer-reviewed hypertrophy
// research (Schoenfeld 2010, 2017; Nippard/RP Strength programming principles;
// Contreras et al. EMG studies; Krieger 2010 meta-analysis on volume; Ogborn &
// Schoenfeld 2014 on fibre-type considerations; Pedrosa et al. 2022 on
// lengthened-partial superiority for hypertrophy).
// ─────────────────────────────────────────────────────────────────────────────

// ─── Exercise Database (~60 exercises) ───────────────────────────────────────
// defaultReps is the midpoint of the evidence-based rep range for that
// movement type (compounds 5-8, accessories 10-12, isolations 12-15).
// defaultRest is in seconds (compounds 150-180s, accessories 90-120s,
// isolations 60-90s) per Schoenfeld et al. 2016 rest-interval meta-analysis.

// feel: 'heavy' | 'moderate' | 'light'
// heavy   → compounds, drive progressive overload, RPE 8-9
// moderate → accessory compounds, controlled full-ROM, RPE 7-8
// light   → isolations, squeeze/contraction focus, slow eccentric, RPE 6-7
export const EXERCISES_DB = [
  // ── CHEST ──────────────────────────────────────────────────────────────────
  { name: 'Barbell Bench Press',        group: 'Chest',     feel: 'heavy',    defaultSets: 4, defaultReps: '6',  defaultRest: 150 },
  { name: 'Incline Barbell Press',      group: 'Chest',     feel: 'heavy',    defaultSets: 3, defaultReps: '8',  defaultRest: 150 },
  { name: 'Incline Dumbbell Press',     group: 'Chest',     feel: 'moderate', defaultSets: 3, defaultReps: '10', defaultRest: 120 },
  { name: 'Low-to-High Cable Fly',      group: 'Chest',     feel: 'light',    defaultSets: 3, defaultReps: '13', defaultRest: 75  },
  { name: 'Pec Deck Machine Fly',       group: 'Chest',     feel: 'light',    defaultSets: 3, defaultReps: '13', defaultRest: 60  },
  { name: 'Cable Crossover',            group: 'Chest',     feel: 'light',    defaultSets: 3, defaultReps: '13', defaultRest: 60  },
  { name: 'Dips (Chest)',               group: 'Chest',     feel: 'moderate', defaultSets: 3, defaultReps: '10', defaultRest: 90  },
  { name: 'Dumbbell Fly',               group: 'Chest',     feel: 'light',    defaultSets: 3, defaultReps: '13', defaultRest: 60  },
  { name: 'Push-Up',                    group: 'Chest',     feel: 'moderate', defaultSets: 3, defaultReps: '15', defaultRest: 60  },
  { name: 'Diamond Push-Up',            group: 'Chest',     feel: 'moderate', defaultSets: 3, defaultReps: '12', defaultRest: 60  },

  // ── BACK ───────────────────────────────────────────────────────────────────
  { name: 'Conventional Deadlift',      group: 'Back',      feel: 'heavy',    defaultSets: 3, defaultReps: '5',  defaultRest: 180 },
  { name: 'Weighted Pull-Up',           group: 'Back',      feel: 'heavy',    defaultSets: 4, defaultReps: '6',  defaultRest: 150 },
  { name: 'Barbell Row (Overhand)',      group: 'Back',      feel: 'heavy',    defaultSets: 4, defaultReps: '8',  defaultRest: 150 },
  { name: 'Chest-Supported Row',        group: 'Back',      feel: 'moderate', defaultSets: 3, defaultReps: '10', defaultRest: 120 },
  { name: 'Lat Pulldown (Wide Grip)',   group: 'Back',      feel: 'moderate', defaultSets: 3, defaultReps: '10', defaultRest: 90  },
  { name: 'Cable Row (Neutral Grip)',   group: 'Back',      feel: 'moderate', defaultSets: 3, defaultReps: '12', defaultRest: 90  },
  { name: 'Single-Arm Dumbbell Row',    group: 'Back',      feel: 'moderate', defaultSets: 3, defaultReps: '10', defaultRest: 75  },
  { name: 'Straight-Arm Pulldown',      group: 'Back',      feel: 'light',    defaultSets: 3, defaultReps: '13', defaultRest: 60  },
  { name: 'Face Pull',                  group: 'Back',      feel: 'light',    defaultSets: 3, defaultReps: '15', defaultRest: 60  },
  { name: 'Inverted Row',               group: 'Back',      feel: 'moderate', defaultSets: 3, defaultReps: '12', defaultRest: 75  },
  { name: 'Dumbbell Pullover',          group: 'Back',      feel: 'moderate', defaultSets: 3, defaultReps: '12', defaultRest: 60  },

  // ── SHOULDERS ──────────────────────────────────────────────────────────────
  { name: 'Barbell Overhead Press',     group: 'Shoulders', feel: 'heavy',    defaultSets: 4, defaultReps: '6',  defaultRest: 150 },
  { name: 'Dumbbell Overhead Press',    group: 'Shoulders', feel: 'moderate', defaultSets: 3, defaultReps: '10', defaultRest: 120 },
  { name: 'Arnold Press',               group: 'Shoulders', feel: 'moderate', defaultSets: 3, defaultReps: '10', defaultRest: 90  },
  { name: 'Cable Lateral Raise',        group: 'Shoulders', feel: 'light',    defaultSets: 4, defaultReps: '15', defaultRest: 60  },
  { name: 'Dumbbell Lateral Raise',     group: 'Shoulders', feel: 'light',    defaultSets: 4, defaultReps: '15', defaultRest: 60  },
  { name: 'Rear Delt Fly (Cable)',      group: 'Shoulders', feel: 'light',    defaultSets: 3, defaultReps: '15', defaultRest: 60  },
  { name: 'Rear Delt Fly (Dumbbell)',   group: 'Shoulders', feel: 'light',    defaultSets: 3, defaultReps: '15', defaultRest: 60  },
  { name: 'Upright Row (Cable)',        group: 'Shoulders', feel: 'light',    defaultSets: 3, defaultReps: '12', defaultRest: 75  },
  { name: 'Pike Push-Up',               group: 'Shoulders', feel: 'moderate', defaultSets: 3, defaultReps: '12', defaultRest: 60  },
  { name: 'Landmine Press',             group: 'Shoulders', feel: 'moderate', defaultSets: 3, defaultReps: '10', defaultRest: 90  },

  // ── BICEPS ─────────────────────────────────────────────────────────────────
  { name: 'Barbell Curl',               group: 'Biceps',    feel: 'moderate', defaultSets: 3, defaultReps: '10', defaultRest: 90  },
  { name: 'Incline Dumbbell Curl',      group: 'Biceps',    feel: 'light',    defaultSets: 3, defaultReps: '12', defaultRest: 75  },
  { name: 'Cable Curl (Low Pulley)',    group: 'Biceps',    feel: 'light',    defaultSets: 3, defaultReps: '13', defaultRest: 60  },
  { name: 'Hammer Curl',                group: 'Biceps',    feel: 'light',    defaultSets: 3, defaultReps: '12', defaultRest: 60  },
  { name: 'Spider Curl',                group: 'Biceps',    feel: 'light',    defaultSets: 3, defaultReps: '12', defaultRest: 60  },
  { name: 'Preacher Curl (EZ Bar)',     group: 'Biceps',    feel: 'moderate', defaultSets: 3, defaultReps: '10', defaultRest: 75  },
  { name: 'Chin-Up',                    group: 'Biceps',    feel: 'moderate', defaultSets: 3, defaultReps: '8',  defaultRest: 90  },

  // ── TRICEPS ────────────────────────────────────────────────────────────────
  { name: 'Close-Grip Bench Press',     group: 'Triceps',   feel: 'heavy',    defaultSets: 3, defaultReps: '8',  defaultRest: 120 },
  { name: 'Overhead Tricep Extension',  group: 'Triceps',   feel: 'moderate', defaultSets: 3, defaultReps: '12', defaultRest: 75  },
  { name: 'EZ Bar Skull Crusher',       group: 'Triceps',   feel: 'moderate', defaultSets: 3, defaultReps: '10', defaultRest: 75  },
  { name: 'Cable Tricep Pushdown',      group: 'Triceps',   feel: 'light',    defaultSets: 3, defaultReps: '13', defaultRest: 60  },
  { name: 'Single-Arm Cable Extension', group: 'Triceps',   feel: 'light',    defaultSets: 3, defaultReps: '13', defaultRest: 60  },
  { name: 'Tricep Dips (Bench)',        group: 'Triceps',   feel: 'moderate', defaultSets: 3, defaultReps: '12', defaultRest: 75  },

  // ── LEGS ───────────────────────────────────────────────────────────────────
  { name: 'Barbell Back Squat',         group: 'Legs',      feel: 'heavy',    defaultSets: 4, defaultReps: '6',  defaultRest: 180 },
  { name: 'Romanian Deadlift',          group: 'Legs',      feel: 'heavy',    defaultSets: 4, defaultReps: '10', defaultRest: 150 },
  { name: 'Leg Press',                  group: 'Legs',      feel: 'moderate', defaultSets: 3, defaultReps: '12', defaultRest: 120 },
  { name: 'Hack Squat',                 group: 'Legs',      feel: 'moderate', defaultSets: 3, defaultReps: '10', defaultRest: 120 },
  { name: 'Bulgarian Split Squat',      group: 'Legs',      feel: 'moderate', defaultSets: 3, defaultReps: '10', defaultRest: 120 },
  { name: 'Nordic Hamstring Curl',      group: 'Legs',      feel: 'moderate', defaultSets: 3, defaultReps: '6',  defaultRest: 120 },
  { name: 'Lying Leg Curl',             group: 'Legs',      feel: 'light',    defaultSets: 3, defaultReps: '12', defaultRest: 75  },
  { name: 'Leg Extension',              group: 'Legs',      feel: 'light',    defaultSets: 3, defaultReps: '13', defaultRest: 60  },
  { name: 'Hip Thrust (Barbell)',       group: 'Legs',      feel: 'moderate', defaultSets: 3, defaultReps: '12', defaultRest: 90  },
  { name: 'Walking Lunge',              group: 'Legs',      feel: 'moderate', defaultSets: 3, defaultReps: '12', defaultRest: 90  },
  { name: 'Seated Calf Raise',          group: 'Legs',      feel: 'light',    defaultSets: 4, defaultReps: '15', defaultRest: 60  },
  { name: 'Standing Calf Raise',        group: 'Legs',      feel: 'light',    defaultSets: 4, defaultReps: '12', defaultRest: 60  },
  // ── Substitute exercises (no machine required) ───────────────────────────
  { name: 'Goblet Squat',               group: 'Legs',      feel: 'moderate', defaultSets: 3, defaultReps: '12', defaultRest: 90  },
  { name: 'Box Squat',                  group: 'Legs',      feel: 'moderate', defaultSets: 3, defaultReps: '8',  defaultRest: 120 },
  { name: 'Step-Up',                    group: 'Legs',      feel: 'moderate', defaultSets: 3, defaultReps: '12', defaultRest: 75  },
  { name: 'Dumbbell Leg Curl',          group: 'Legs',      feel: 'light',    defaultSets: 3, defaultReps: '12', defaultRest: 60  },
  { name: 'Single-Leg Calf Raise',      group: 'Legs',      feel: 'light',    defaultSets: 3, defaultReps: '15', defaultRest: 45  },
  { name: 'Reverse Lunge',              group: 'Legs',      feel: 'moderate', defaultSets: 3, defaultReps: '12', defaultRest: 75  },
  { name: 'Glute Bridge',               group: 'Legs',      feel: 'moderate', defaultSets: 3, defaultReps: '15', defaultRest: 60  },

  // ── CORE ───────────────────────────────────────────────────────────────────
  { name: 'Cable Crunch',               group: 'Core',      feel: 'moderate', defaultSets: 3, defaultReps: '15', defaultRest: 60  },
  { name: 'Hanging Leg Raise',          group: 'Core',      feel: 'moderate', defaultSets: 3, defaultReps: '12', defaultRest: 75  },
  { name: 'Ab Wheel Rollout',           group: 'Core',      feel: 'moderate', defaultSets: 3, defaultReps: '10', defaultRest: 75  },
  { name: 'Decline Sit-Up',            group: 'Core',      feel: 'light',    defaultSets: 3, defaultReps: '15', defaultRest: 60  },
  { name: 'Pallof Press',               group: 'Core',      feel: 'light',    defaultSets: 3, defaultReps: '12', defaultRest: 60  },
  { name: 'Dead Bug',                   group: 'Core',      feel: 'light',    defaultSets: 3, defaultReps: '10', defaultRest: 60  },
  { name: 'Plank',                      group: 'Core',      feel: 'light',    defaultSets: 3, defaultReps: '45s', defaultRest: 60 },
  { name: 'Side Plank',                 group: 'Core',      feel: 'light',    defaultSets: 3, defaultReps: '30s', defaultRest: 45 },
  { name: 'Dragon Flag',                group: 'Core',      feel: 'moderate', defaultSets: 3, defaultReps: '6',  defaultRest: 90  },
  { name: 'Lying Leg Raise',            group: 'Core',      feel: 'light',    defaultSets: 3, defaultReps: '12', defaultRest: 60  },

  // ── OLYMPIC LIFTING ────────────────────────────────────────────────────────
  // All Olympic lifts default to low reps (1-3) with long rest — technical
  // skill work, not metabolic conditioning. Rest 3-5 min between heavy sets.
  // Olympic lifts: no feel/RPE category — loading is % of 1RM, not RPE-based.
  // The feel badge and warmup block are intentionally disabled for these.
  // Reps are the standard technique/strength-skill defaults; rest is long
  // because full recovery between singles/doubles is essential for bar speed.
  { name: 'Power Snatch',               group: 'Olympic',   defaultSets: 5, defaultReps: '3',  defaultRest: 240 },
  { name: 'Full Snatch',                group: 'Olympic',   defaultSets: 5, defaultReps: '2',  defaultRest: 240 },
  { name: 'Snatch Pull',                group: 'Olympic',   defaultSets: 4, defaultReps: '3',  defaultRest: 210 },
  { name: 'Snatch Balance',             group: 'Olympic',   defaultSets: 4, defaultReps: '3',  defaultRest: 180 },
  { name: 'Hang Power Snatch',          group: 'Olympic',   defaultSets: 4, defaultReps: '3',  defaultRest: 180 },
  { name: 'Overhead Squat',             group: 'Olympic',   defaultSets: 4, defaultReps: '3',  defaultRest: 180 },
  { name: 'Power Clean',                group: 'Olympic',   defaultSets: 5, defaultReps: '3',  defaultRest: 240 },
  { name: 'Squat Clean',                group: 'Olympic',   defaultSets: 5, defaultReps: '2',  defaultRest: 240 },
  { name: 'Clean & Jerk',               group: 'Olympic',   defaultSets: 5, defaultReps: '2',  defaultRest: 240 },
  { name: 'Power Clean & Jerk',         group: 'Olympic',   defaultSets: 4, defaultReps: '3',  defaultRest: 210 },
  { name: 'Hang Power Clean',           group: 'Olympic',   defaultSets: 4, defaultReps: '3',  defaultRest: 180 },
  { name: 'Clean Pull',                 group: 'Olympic',   defaultSets: 4, defaultReps: '3',  defaultRest: 210 },
  { name: 'Front Squat',                group: 'Olympic',   defaultSets: 4, defaultReps: '4',  defaultRest: 210 },
  { name: 'Push Press',                 group: 'Olympic',   defaultSets: 4, defaultReps: '5',  defaultRest: 180 },
  { name: 'Push Jerk',                  group: 'Olympic',   defaultSets: 4, defaultReps: '3',  defaultRest: 180 },
  { name: 'Split Jerk',                 group: 'Olympic',   defaultSets: 4, defaultReps: '3',  defaultRest: 180 },

  // CrossFit / gymnastics: no feel category — scaling is Rx/Scaled, not RPE.
  { name: 'Thruster',                   group: 'CrossFit',  defaultSets: 4, defaultReps: '5',  defaultRest: 120 },
  { name: 'Kettlebell Swing',           group: 'CrossFit',  defaultSets: 3, defaultReps: '15', defaultRest: 60  },
  { name: 'Box Jump',                   group: 'CrossFit',  defaultSets: 4, defaultReps: '10', defaultRest: 90  },
  { name: 'Burpee',                     group: 'CrossFit',  defaultSets: 3, defaultReps: '15', defaultRest: 60  },
  { name: 'Wall Ball',                  group: 'CrossFit',  defaultSets: 3, defaultReps: '20', defaultRest: 75  },
  { name: 'Double Under',               group: 'CrossFit',  defaultSets: 3, defaultReps: '50', defaultRest: 60  },
  { name: 'Air Squat',                  group: 'CrossFit',  defaultSets: 3, defaultReps: '20', defaultRest: 45  },
  { name: 'Toes-to-Bar',                group: 'CrossFit',  defaultSets: 3, defaultReps: '10', defaultRest: 75  },
  { name: 'Kipping Pull-Up',            group: 'CrossFit',  defaultSets: 3, defaultReps: '10', defaultRest: 75  },
  { name: 'Ring Dip',                   group: 'CrossFit',  defaultSets: 3, defaultReps: '8',  defaultRest: 90  },
  { name: 'Muscle-Up (Ring)',           group: 'CrossFit',  defaultSets: 3, defaultReps: '3',  defaultRest: 120 },
  { name: 'Muscle-Up (Bar)',            group: 'CrossFit',  defaultSets: 3, defaultReps: '3',  defaultRest: 120 },
  { name: 'Handstand Push-Up',          group: 'CrossFit',  defaultSets: 3, defaultReps: '8',  defaultRest: 90  },
  { name: 'Handstand Walk',             group: 'CrossFit',  defaultSets: 3, defaultReps: '10m', defaultRest: 90 },
  { name: 'Rope Climb',                 group: 'CrossFit',  defaultSets: 3, defaultReps: '3',  defaultRest: 120 },
  { name: 'GHD Sit-Up',                 group: 'CrossFit',  defaultSets: 3, defaultReps: '15', defaultRest: 60  },
  { name: 'Pistol Squat',               group: 'CrossFit',  defaultSets: 3, defaultReps: '8',  defaultRest: 90  },
  { name: 'Dumbbell Snatch',            group: 'CrossFit',  defaultSets: 4, defaultReps: '6',  defaultRest: 90  },

];

// ─── Coaches Data ─────────────────────────────────────────────────────────────
// Local coaches first. Each coach has a specialty string and an array of
// workouts. CF workouts carry a `type` field:
//   'emom'    → Every Minute on the Minute (intervalSecs + rounds)
//   'amrap'   → As Many Rounds as Possible (timeCap in minutes)
//   'rounds'  → Rounds for Time (rounds, stopwatch)
//   'fortime' → For Time (optional sets scheme, stopwatch)
// Strength workouts keep the original `exercises` format.
export const COACHES_DATA = [
  {
    id: 'cilyn',
    name: 'Coach Cilyn',
    specialty: 'CrossFit · Olympic Lifting',
    workouts: [
      // ── Classic WODs ────────────────────────────────────────────────────────
      {
        name: 'CINDY',
        type: 'amrap',
        timeCap: 20,
        badge: 'AMRAP',
        description: 'AMRAP 20 MIN',
        movements: [
          { name: 'Pull-up',   reps: 5  },
          { name: 'Push-up',   reps: 10 },
          { name: 'Air Squat', reps: 15 },
        ],
      },
      {
        name: 'HELEN',
        type: 'rounds',
        rounds: 3,
        badge: 'RFT',
        description: '3 ROUNDS FOR TIME',
        movements: [
          { name: '400m Run',                reps: 1,  unit: 'run'  },
          { name: 'Kettlebell Swing (24kg)',  reps: 21, unit: 'reps' },
          { name: 'Pull-up',                 reps: 12, unit: 'reps' },
        ],
      },
      {
        name: 'FRAN',
        type: 'fortime',
        badge: 'FOR TIME',
        description: 'FOR TIME — 21-15-9',
        sets: [21, 15, 9],
        movements: [
          { name: 'Thruster (43/29kg)' },
          { name: 'Pull-up'            },
        ],
      },
      {
        name: 'DEATH BY BURPEE',
        type: 'emom',
        rounds: 10,
        intervalSecs: 60,
        badge: 'EMOM',
        description: 'EMOM × 10',
        movements: [
          { name: 'Burpee', note: '1 rep, add 1 each round' },
        ],
      },
      // ── Olympic Lifting WODs ─────────────────────────────────────────────
      {
        name: 'SNATCH COMPLEX',
        type: 'emom',
        rounds: 10,
        intervalSecs: 90,
        badge: 'EMOM',
        description: 'EMOM 90s × 10',
        movements: [
          { name: 'Hang Power Snatch', reps: 2, note: '@ 70% 1RM' },
          { name: 'Overhead Squat',    reps: 2 },
        ],
      },
      {
        name: 'CLEAN & JERK LADDER',
        type: 'rounds',
        rounds: 5,
        badge: 'RFT',
        description: '5 ROUNDS FOR TIME',
        movements: [
          { name: 'Power Clean', reps: 3,  unit: 'reps' },
          { name: 'Push Jerk',   reps: 3,  unit: 'reps' },
          { name: 'Box Jump',    reps: 6,  unit: 'reps' },
          { name: 'Ring Dip',    reps: 10, unit: 'reps' },
        ],
      },
      {
        name: 'BARBELL CHIPPER',
        type: 'fortime',
        badge: 'FOR TIME',
        description: 'FOR TIME',
        sets: null,
        movements: [
          { name: 'Power Snatch (60/40kg)',  reps: 30 },
          { name: 'Power Clean (80/55kg)',   reps: 20 },
          { name: 'Clean & Jerk (100/70kg)', reps: 10 },
        ],
      },
    ],
  },
];

// ─── Legacy Legends Data (kept for reference) ─────────────────────────────────
export const LEGENDS_DATA = [
  {
    id: 'arnold', name: 'Arnold Schwarzenegger', era: 'Golden Era · 1966–1980',
    workouts: [
      {
        name: "Arnold's Blueprint — Push", badge: 'VOLUME',
        exercises: [
          { name: 'Barbell Bench Press', sets: 5, reps: '6-10', rest: 90 },
          { name: 'Incline Dumbbell Press', sets: 5, reps: '6-10', rest: 90 },
          { name: 'Cable Crossover', sets: 4, reps: '10-12', rest: 60 },
          { name: 'Arnold Press', sets: 4, reps: '8-10', rest: 75 },
          { name: 'Dumbbell Lateral Raise', sets: 4, reps: '10-12', rest: 45 },
        ],
      },
      {
        name: "Arnold's Blueprint — Pull", badge: 'STRENGTH',
        exercises: [
          { name: 'Weighted Pull-Up', sets: 5, reps: '8-10', rest: 90 },
          { name: 'Barbell Row (Overhand)', sets: 5, reps: '6-8', rest: 90 },
          { name: 'Lat Pulldown (Wide Grip)', sets: 4, reps: '10-12', rest: 75 },
          { name: 'Barbell Curl', sets: 5, reps: '8-10', rest: 75 },
          { name: 'Incline Dumbbell Curl', sets: 4, reps: '10-12', rest: 60 },
        ],
      },
      {
        name: "Arnold's Blueprint — Legs", badge: 'MASS',
        exercises: [
          { name: 'Barbell Back Squat', sets: 5, reps: '8-10', rest: 120 },
          { name: 'Leg Press', sets: 4, reps: '10-12', rest: 90 },
          { name: 'Lying Leg Curl', sets: 4, reps: '10-12', rest: 60 },
          { name: 'Standing Calf Raise', sets: 6, reps: '15', rest: 45 },
        ],
      },
    ],
  },
  {
    id: 'ronnie', name: 'Ronnie Coleman', era: 'Mass Monster · 1992–2007',
    workouts: [
      {
        name: "Ronnie's Back Attack", badge: 'POWER',
        exercises: [
          { name: 'Conventional Deadlift', sets: 5, reps: '6-8', rest: 180 },
          { name: 'Barbell Row (Overhand)', sets: 5, reps: '8', rest: 120 },
          { name: 'Weighted Pull-Up', sets: 4, reps: 'max', rest: 90 },
          { name: 'Cable Row (Neutral Grip)', sets: 4, reps: '10-12', rest: 75 },
          { name: 'Lat Pulldown (Wide Grip)', sets: 4, reps: '10-12', rest: 75 },
        ],
      },
      {
        name: "Ronnie's Leg Day", badge: 'LEGENDARY',
        exercises: [
          { name: 'Barbell Back Squat', sets: 6, reps: '10-15', rest: 180 },
          { name: 'Hack Squat', sets: 4, reps: '10', rest: 120 },
          { name: 'Leg Press', sets: 4, reps: '12', rest: 90 },
          { name: 'Romanian Deadlift', sets: 4, reps: '10', rest: 90 },
          { name: 'Lying Leg Curl', sets: 4, reps: '12', rest: 60 },
          { name: 'Standing Calf Raise', sets: 6, reps: '15', rest: 45 },
        ],
      },
    ],
  },
  {
    id: 'cbum', name: 'Chris Bumstead', era: 'Classic Physique · 2017–Present',
    workouts: [
      {
        name: 'CBum Chest & Shoulders', badge: 'AESTHETIC',
        exercises: [
          { name: 'Incline Dumbbell Press', sets: 4, reps: '10-12', rest: 90 },
          { name: 'Barbell Bench Press', sets: 4, reps: '8-10', rest: 90 },
          { name: 'Pec Deck Machine Fly', sets: 3, reps: '12-15', rest: 60 },
          { name: 'Barbell Overhead Press', sets: 4, reps: '10-12', rest: 75 },
          { name: 'Cable Lateral Raise', sets: 5, reps: '15', rest: 45 },
        ],
      },
      {
        name: 'CBum Back & Biceps', badge: 'CLASSIC',
        exercises: [
          { name: 'Weighted Pull-Up', sets: 4, reps: '10', rest: 90 },
          { name: 'Barbell Row (Overhand)', sets: 4, reps: '8-10', rest: 90 },
          { name: 'Lat Pulldown (Wide Grip)', sets: 3, reps: '12', rest: 75 },
          { name: 'Single-Arm Dumbbell Row', sets: 3, reps: '12', rest: 60 },
          { name: 'Barbell Curl', sets: 4, reps: '10-12', rest: 60 },
          { name: 'Hammer Curl', sets: 3, reps: '12', rest: 45 },
        ],
      },
    ],
  },
  {
    id: 'goggins', name: 'David Goggins', era: 'Endurance · Navy SEAL',
    workouts: [
      {
        name: "Goggins 40% Rule Circuit", badge: 'MENTAL',
        exercises: [
          { name: 'Weighted Pull-Up', sets: 5, reps: 'max', rest: 60 },
          { name: 'Push-Up', sets: 5, reps: 'max', rest: 60 },
          { name: 'Barbell Back Squat', sets: 5, reps: '20', rest: 60 },
          { name: 'Ab Wheel Rollout', sets: 5, reps: '15', rest: 45 },
          { name: 'Hanging Leg Raise', sets: 5, reps: '15', rest: 45 },
        ],
      },
    ],
  },
  {
    id: 'nippard', name: 'Jeff Nippard', era: 'Science-Based · 2010–Present',
    workouts: [
      {
        name: 'Nippard Upper A', badge: 'SCIENCE',
        exercises: [
          { name: 'Barbell Bench Press', sets: 4, reps: '6-8', rest: 120 },
          { name: 'Barbell Row (Overhand)', sets: 4, reps: '6-8', rest: 120 },
          { name: 'Barbell Overhead Press', sets: 3, reps: '8-10', rest: 90 },
          { name: 'Lat Pulldown (Wide Grip)', sets: 3, reps: '10-12', rest: 75 },
          { name: 'Cable Lateral Raise', sets: 4, reps: '15-20', rest: 45 },
          { name: 'Barbell Curl', sets: 3, reps: '10-12', rest: 60 },
          { name: 'Cable Tricep Pushdown', sets: 3, reps: '12-15', rest: 60 },
        ],
      },
      {
        name: 'Nippard Lower A', badge: 'SCIENCE',
        exercises: [
          { name: 'Barbell Back Squat', sets: 4, reps: '6-8', rest: 150 },
          { name: 'Romanian Deadlift', sets: 3, reps: '8-10', rest: 90 },
          { name: 'Leg Press', sets: 3, reps: '10-12', rest: 75 },
          { name: 'Lying Leg Curl', sets: 3, reps: '12-15', rest: 60 },
          { name: 'Seated Calf Raise', sets: 4, reps: '15-20', rest: 45 },
        ],
      },
    ],
  },
  {
    id: 'zyzz', name: 'Zyzz', era: 'Aesthetic Era · 2008–2011',
    workouts: [
      {
        name: 'Zyzz Aesthetics Program', badge: 'AESTHETIC',
        exercises: [
          { name: 'Incline Dumbbell Press', sets: 4, reps: '10', rest: 75 },
          { name: 'Cable Crossover', sets: 4, reps: '12', rest: 60 },
          { name: 'Barbell Overhead Press', sets: 4, reps: '10', rest: 75 },
          { name: 'Dumbbell Lateral Raise', sets: 4, reps: '15', rest: 45 },
          { name: 'Cable Tricep Pushdown', sets: 3, reps: '12', rest: 60 },
          { name: 'Barbell Curl', sets: 3, reps: '10', rest: 60 },
          { name: 'Hammer Curl', sets: 3, reps: '12', rest: 45 },
        ],
      },
    ],
  },
];

// ─── Shuffle Plans ─────────────────────────────────────────────────────────────
// Volume anchored to RP Strength MEV–MAV ranges (10-20 sets/muscle/week).
// A single shuffle session contributes 12-20 working sets, appropriate for
// one dedicated muscle-group day per week.
// rep field = midpoint of the evidence-based range for that movement type.
// rest in seconds per Schoenfeld et al. 2016 (longer rest → more total volume).

export const SHUFFLE_PLANS = {
  // ── CHEST ──────────────────────────────────────────────────────────────────
  // Research basis: Incline press > flat for upper-pec EMG (Glass & Armstrong
  // 1997); low-to-high cable fly maximises stretch at long muscle length —
  // Pedrosa et al. 2022 showed lengthened-partial training produces superior
  // hypertrophy; pec deck peak contraction complements the stretch stimulus;
  // dips add weighted compound volume with a strong lower-chest stretch.
  'Chest': [
    { name: 'Barbell Bench Press',    sets: 4, reps: '6',  rest: 150 },
    { name: 'Incline Dumbbell Press', sets: 3, reps: '10', rest: 120 },
    { name: 'Low-to-High Cable Fly',  sets: 3, reps: '13', rest: 75  },
    { name: 'Pec Deck Machine Fly',   sets: 3, reps: '13', rest: 60  },
    { name: 'Dips (Chest)',           sets: 3, reps: '10', rest: 90  },
  ],

  // ── BACK ───────────────────────────────────────────────────────────────────
  // Research basis: Weighted pull-ups produce highest lat EMG (Youdas et al.
  // 2010); chest-supported row removes lumbar fatigue so back musculature is
  // the true limiter (Schoenfeld 2017); lat pulldown reinforces vertical-pull
  // lat development; straight-arm pulldown isolates lat at stretched position;
  // face pull targets oft-neglected rear delt and external rotators critical
  // for shoulder health (Reinold et al. 2009).
  'Back': [
    { name: 'Weighted Pull-Up',         sets: 4, reps: '6',  rest: 150 },
    { name: 'Barbell Row (Overhand)',    sets: 4, reps: '8',  rest: 150 },
    { name: 'Chest-Supported Row',      sets: 3, reps: '10', rest: 90  },
    { name: 'Lat Pulldown (Wide Grip)', sets: 3, reps: '10', rest: 90  },
    { name: 'Straight-Arm Pulldown',    sets: 3, reps: '13', rest: 60  },
    { name: 'Face Pull',                sets: 3, reps: '15', rest: 60  },
  ],

  // ── SHOULDERS ──────────────────────────────────────────────────────────────
  // Research basis: Overhead press is the primary anterior/medial delt mass
  // builder (Saeterbakken et al. 2013); cable lateral raise maintains constant
  // tension vs dumbbell (peak torque shifts favour cable at abduction midpoint);
  // rear delt fly via cable targets posterior delt at a stretched position for
  // superior hypertrophy; upright row is a high-EMG medial delt movement when
  // performed with a wide grip and controlled tempo (Botton et al. 2013).
  // Upright Row removed — impingement risk, always deduped out anyway.
  // Arnold Press provides superior anterior + medial delt activation
  // with a full supination arc (Saeterbakken et al. 2013).
  // Dumbbell OHP removed — having Barbell OHP + DB OHP + Arnold Press in one session
  // is 10+ sets of overhead pressing before you touch a lateral raise. One heavy
  // compound + one moderate variation (Arnold's supination arc hits a different
  // motor pattern) is sufficient. Volume is now 3 compounds + 2 isolation movements.
  'Shoulders': [
    { name: 'Barbell Overhead Press',  sets: 4, reps: '6',  rest: 150 },
    { name: 'Arnold Press',            sets: 3, reps: '10', rest: 90  },
    { name: 'Cable Lateral Raise',     sets: 4, reps: '15', rest: 60  },
    { name: 'Rear Delt Fly (Cable)',   sets: 3, reps: '15', rest: 60  },
  ],

  // ── ARMS ───────────────────────────────────────────────────────────────────
  // Research basis (Biceps): Incline dumbbell curl stretches the long head of
  // the biceps at hip level — Pedrosa et al. 2022 long-length partial data
  // supports this as a hypertrophy priority; barbell curl loads the short head
  // optimally at 90° elbow flexion (highest torque); cable curl at low pulley
  // keeps tension through the full ROM.
  // Research basis (Triceps): Overhead tricep extension places the long head
  // in a maximally stretched position — Kassiano et al. 2023 confirmed long-
  // head hypertrophy superiority with overhead loading; close-grip bench is the
  // highest-load compound tricep movement; cable pushdown provides peak-
  // contraction isolation at the shortened position.
  'Arms': [
    { name: 'Barbell Curl',               sets: 3, reps: '10', rest: 90 },
    { name: 'Incline Dumbbell Curl',      sets: 3, reps: '12', rest: 75 },
    { name: 'Cable Curl (Low Pulley)',    sets: 3, reps: '13', rest: 60 },
    { name: 'Close-Grip Bench Press',     sets: 3, reps: '8',  rest: 120 },
    { name: 'Overhead Tricep Extension',  sets: 3, reps: '12', rest: 75 },
    { name: 'Cable Tricep Pushdown',      sets: 3, reps: '13', rest: 60 },
  ],

  // ── LEGS ───────────────────────────────────────────────────────────────────
  // Research basis: Back squat is the gold-standard quad + glute compound;
  // Romanian deadlift is the premier hamstring stretch exercise — Schoenfeld &
  // Contreras 2014 confirmed superior hamstring EMG vs leg curl; Bulgarian
  // split squat produces unilateral quad loading with significant hip-flexor
  // stretch (Speirs et al. 2016); lying leg curl hits hamstrings at shortened
  // position to complement RDL stretch stimulus; hip thrust produces the
  // highest glute EMG of any exercise tested (Contreras et al. 2015); leg
  // extension isolates terminal quad contraction to balance the posterior chain.
  'Legs': [
    { name: 'Barbell Back Squat',    sets: 4, reps: '6',  rest: 180 },
    { name: 'Romanian Deadlift',     sets: 4, reps: '10', rest: 150 },
    { name: 'Bulgarian Split Squat', sets: 3, reps: '10', rest: 120 },
    { name: 'Hip Thrust (Barbell)',  sets: 3, reps: '12', rest: 90  },
    { name: 'Lying Leg Curl',        sets: 3, reps: '12', rest: 75  },
    { name: 'Leg Extension',         sets: 3, reps: '13', rest: 60  },
  ],

  // ── CORE ───────────────────────────────────────────────────────────────────
  // Research basis: Cable crunch is the highest-EMG rectus abdominis exercise
  // (Escamilla et al. 2006) and allows progressive overload; hanging leg raise
  // loads the abs in a lengthened position (hip-flexion origin); ab wheel
  // rollout has among the highest rectus abdominis activation while training
  // anti-extension stability (Escamilla et al. 2010); Pallof press trains
  // anti-rotation — critical for spine stability and force transfer; dead bug
  // reinforces bracing patterns under controlled load.
  'Core': [
    { name: 'Cable Crunch',        sets: 4, reps: '15', rest: 60 },
    { name: 'Hanging Leg Raise',   sets: 3, reps: '12', rest: 75 },
    { name: 'Ab Wheel Rollout',    sets: 3, reps: '10', rest: 75 },
    { name: 'Pallof Press',        sets: 3, reps: '12', rest: 60 },
    { name: 'Dead Bug',            sets: 3, reps: '10', rest: 60 },
  ],

  // ── FULL BODY ──────────────────────────────────────────────────────────────
  // Research basis: This template follows a push / hinge / pull / press /
  // squat pattern covering all major movers in one session — supported by
  // Ralston et al. 2017 total-body vs split-routine equivalence for natural
  // lifters training ≤3×/week. Deadlift anchors posterior chain; bench and
  // overhead press cover horizontal + vertical push; weighted pull-up covers
  // vertical pull; back squat closes the session with quad + glute compound.
  // Sets are intentionally moderate (3) to manage fatigue across 5 movements.
  'Full Body': [
    { name: 'Conventional Deadlift',    sets: 3, reps: '5',  rest: 180 },
    { name: 'Barbell Bench Press',      sets: 3, reps: '8',  rest: 150 },
    { name: 'Weighted Pull-Up',         sets: 3, reps: '8',  rest: 150 },
    { name: 'Barbell Back Squat',       sets: 3, reps: '8',  rest: 150 },
    { name: 'Barbell Overhead Press',   sets: 3, reps: '8',  rest: 120 },
    { name: 'Romanian Deadlift',        sets: 2, reps: '10', rest: 120 },
  ],
};

export const MUSCLES = ['Chest', 'Back', 'Legs', 'Shoulders', 'Biceps', 'Triceps', 'Core'];
export const MUSCLES_ALL = ['Chest', 'Back', 'Legs', 'Shoulders', 'Biceps', 'Triceps', 'Core', 'Olympic', 'CrossFit'];

// ─── Famous CrossFit WODs ──────────────────────────────────────────────────────
// Structure matches the cfData expected by beginCFWorkout().
export const FAMOUS_WODS = [
  // ── THE GIRLS ──────────────────────────────────────────────────────────────
  {
    name: 'FRAN', category: 'Girls',
    type: 'fortime', badge: 'FOR TIME', description: '21-15-9 FOR TIME',
    sets: [21, 15, 9],
    movements: [{ name: 'Thruster (42.5/30kg)' }, { name: 'Pull-Up' }],
  },
  {
    name: 'CINDY', category: 'Girls',
    type: 'amrap', badge: 'AMRAP', timeCap: 20, description: 'AMRAP 20 MIN',
    movements: [{ name: 'Pull-Up', reps: 5 }, { name: 'Push-Up', reps: 10 }, { name: 'Air Squat', reps: 15 }],
  },
  {
    name: 'HELEN', category: 'Girls',
    type: 'rounds', badge: 'RFT', rounds: 3, description: '3 ROUNDS FOR TIME',
    movements: [{ name: '400m Run', unit: 'run' }, { name: 'KB Swing (24/16kg)', reps: 21 }, { name: 'Pull-Up', reps: 12 }],
  },
  {
    name: 'GRACE', category: 'Girls',
    type: 'fortime', badge: 'FOR TIME', description: '30 REPS FOR TIME',
    movements: [{ name: 'Clean & Jerk (60/40kg)', reps: 30 }],
  },
  {
    name: 'ISABEL', category: 'Girls',
    type: 'fortime', badge: 'FOR TIME', description: '30 REPS FOR TIME',
    movements: [{ name: 'Snatch (60/40kg)', reps: 30 }],
  },
  {
    name: 'DIANE', category: 'Girls',
    type: 'fortime', badge: 'FOR TIME', description: '21-15-9 FOR TIME',
    sets: [21, 15, 9],
    movements: [{ name: 'Deadlift (102.5/70kg)' }, { name: 'Handstand Push-Up' }],
  },
  {
    name: 'ELIZABETH', category: 'Girls',
    type: 'fortime', badge: 'FOR TIME', description: '21-15-9 FOR TIME',
    sets: [21, 15, 9],
    movements: [{ name: 'Clean (60/40kg)' }, { name: 'Ring Dip' }],
  },
  {
    name: 'ANNIE', category: 'Girls',
    type: 'fortime', badge: 'FOR TIME', description: '50-40-30-20-10 FOR TIME',
    sets: [50, 40, 30, 20, 10],
    movements: [{ name: 'Double-Under' }, { name: 'Sit-Up' }],
  },
  {
    name: 'JACKIE', category: 'Girls',
    type: 'fortime', badge: 'FOR TIME', description: 'FOR TIME',
    movements: [{ name: '1000m Row' }, { name: 'Thruster (20/15kg)', reps: 50 }, { name: 'Pull-Up', reps: 30 }],
  },
  {
    name: 'CHELSEA', category: 'Girls',
    type: 'emom', badge: 'EMOM', rounds: 30, intervalSecs: 60, description: 'EMOM 30 MIN',
    movements: [{ name: 'Pull-Up', reps: 5 }, { name: 'Push-Up', reps: 10 }, { name: 'Air Squat', reps: 15 }],
  },
  // ── HERO WODS ──────────────────────────────────────────────────────────────
  {
    name: 'MURPH', category: 'Hero',
    type: 'fortime', badge: 'FOR TIME', description: 'FOR TIME (vest optional)',
    movements: [
      { name: '1 Mile Run', unit: 'run' }, { name: 'Pull-Up', reps: 100 },
      { name: 'Push-Up', reps: 200 }, { name: 'Air Squat', reps: 300 },
      { name: '1 Mile Run', unit: 'run' },
    ],
  },
  {
    name: 'DT', category: 'Hero',
    type: 'rounds', badge: 'RFT', rounds: 5, description: '5 ROUNDS FOR TIME',
    movements: [
      { name: 'Deadlift (70/47.5kg)', reps: 12 },
      { name: 'Hang Power Clean (70/47.5kg)', reps: 9 },
      { name: 'Push Jerk (70/47.5kg)', reps: 6 },
    ],
  },
  {
    name: 'RYAN', category: 'Hero',
    type: 'rounds', badge: 'RFT', rounds: 5, description: '5 ROUNDS FOR TIME',
    movements: [
      { name: 'Overhead Squat (61/43kg)', reps: 7 },
      { name: 'Pull-Up', reps: 12 },
      { name: 'Thruster (43/29kg)', reps: 7 },
    ],
  },
];
