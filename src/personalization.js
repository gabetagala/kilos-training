// ─────────────────────────────────────────────────────────────────────────────
// KILOS TRAINING — personalization.js
// Equipment tiers tuned for the Philippine gym landscape + global injury subs.
// Research: Schoenfeld 2010/2016, Calatayud et al. 2015, Speirs et al. 2016,
// Andersen et al. 2010, Kibler et al. AJSM, McGill 2007, JOSPT consensus.
// ─────────────────────────────────────────────────────────────────────────────

const _get = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
const _set = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

// ─── EQUIPMENT TIERS ─────────────────────────────────────────────────────────
// ph-local is the silent default — the baseline for Filipino gym-goers.
// It makes NO assumptions about what a local gym has or doesn't have.
// In resolveExercise(), ph-local is treated identically to full-gym:
//   every exercise passes through unchanged.
//
// Substitutions only kick in when the user explicitly picks a restricted tier:
//   home-dumbbells, barbell-rack, bands, or bodyweight.
// Injury substitutions always take priority regardless of tier.

export const EQUIPMENT_TIERS = [
  { id: 'full-gym',       label: 'Full Gym',         description: 'All machines · Fitness First, UFC Gym, Kerry Sports' },
  { id: 'home-dumbbells', label: 'Home + Dumbbells', description: 'Dumbbells, bench, optional pull-up bar' },
  { id: 'barbell-rack',   label: 'Barbell + Rack',   description: 'Home power rack, no cables or machines' },
  { id: 'bands',          label: 'Resistance Bands', description: 'Bands and door anchor only' },
  { id: 'bodyweight',     label: 'Bodyweight',       description: 'No equipment · parks, hotels, home' },
];

// ─── EQUIPMENT SUBSTITUTION MAP ───────────────────────────────────────────────
// ph-local entries are ignored at runtime (resolver aliases ph-local → full-gym).
// Subs here only apply to: home-dumbbells, barbell-rack, bands, bodyweight.
export const EQUIPMENT_SUBSTITUTIONS = {

  // ── CHEST ──────────────────────────────────────────────────────────────────
  'Barbell Bench Press': {
    'full-gym':       'Barbell Bench Press',
    'ph-local':       'Barbell Bench Press',
    'home-dumbbells': 'Incline Dumbbell Press',
    'barbell-rack':   'Barbell Bench Press',
    'bands':          'Band Chest Press',
    'bodyweight':     'Push-Up',
  },
  'Incline Barbell Press': {
    'full-gym':       'Incline Barbell Press',
    'ph-local':       'Incline Barbell Press',
    'home-dumbbells': 'Incline Dumbbell Press',
    'barbell-rack':   'Incline Barbell Press',
    'bands':          'Band Incline Press',
    'bodyweight':     'Decline Push-Up',
  },
  'Incline Dumbbell Press': {
    'full-gym':       'Incline Dumbbell Press',
    'ph-local':       'Incline Dumbbell Press',
    'home-dumbbells': 'Incline Dumbbell Press',
    'barbell-rack':   'Incline Barbell Press',
    'bands':          'Band Incline Press',
    'bodyweight':     'Decline Push-Up',
  },
  'Low-to-High Cable Fly': {
    'full-gym':       'Low-to-High Cable Fly',
    'ph-local':       'Low-to-High Cable Fly',   // AF functional trainer supports this angle
    'home-dumbbells': 'Dumbbell Fly',
    'barbell-rack':   'Dumbbell Fly',
    'bands':          'Band Fly',
    'bodyweight':     'Push-Up',
  },
  'Pec Deck Machine Fly': {
    'full-gym':       'Pec Deck Machine Fly',
    'ph-local':       'Dumbbell Fly',            // pec deck machine rare in local PH gyms
    'home-dumbbells': 'Dumbbell Fly',
    'barbell-rack':   'Dumbbell Fly',
    'bands':          'Band Fly',
    'bodyweight':     'Push-Up',
  },
  'Cable Crossover': {
    'full-gym':       'Cable Crossover',
    'ph-local':       'Dumbbell Fly',            // full crossover station rare
    'home-dumbbells': 'Dumbbell Fly',
    'barbell-rack':   'Dumbbell Fly',
    'bands':          'Band Fly',
    'bodyweight':     'Push-Up',
  },
  'Dips (Chest)': {
    'full-gym':       'Dips (Chest)',
    'ph-local':       'Dips (Chest)',
    'home-dumbbells': 'Dips (Chest)',
    'barbell-rack':   'Dips (Chest)',
    'bands':          'Diamond Push-Up',
    'bodyweight':     'Diamond Push-Up',
  },
  'Dumbbell Fly': {
    'full-gym':       'Dumbbell Fly',
    'ph-local':       'Dumbbell Fly',
    'home-dumbbells': 'Dumbbell Fly',
    'barbell-rack':   'Dumbbell Fly',
    'bands':          'Band Fly',
    'bodyweight':     'Push-Up',
  },
  'Push-Up':         { 'full-gym': 'Push-Up',        'ph-local': 'Push-Up',        'home-dumbbells': 'Push-Up',        'barbell-rack': 'Push-Up',        'bands': 'Push-Up',        'bodyweight': 'Push-Up'        },
  'Diamond Push-Up': { 'full-gym': 'Diamond Push-Up','ph-local': 'Diamond Push-Up','home-dumbbells': 'Diamond Push-Up','barbell-rack': 'Diamond Push-Up','bands': 'Diamond Push-Up','bodyweight': 'Diamond Push-Up' },

  // ── BACK ───────────────────────────────────────────────────────────────────
  'Conventional Deadlift': {
    'full-gym':       'Conventional Deadlift',
    'ph-local':       'Conventional Deadlift',
    'home-dumbbells': 'Romanian Deadlift',
    'barbell-rack':   'Conventional Deadlift',
    'bands':          'Band Hip Hinge',
    'bodyweight':     'Single-Leg Hip Hinge',
  },
  'Weighted Pull-Up': {
    'full-gym':       'Weighted Pull-Up',
    'ph-local':       'Weighted Pull-Up',
    'home-dumbbells': 'Weighted Pull-Up',
    'barbell-rack':   'Weighted Pull-Up',
    'bands':          'Band Pull-Down',
    'bodyweight':     'Inverted Row',
  },
  'Barbell Row (Overhand)': {
    'full-gym':       'Barbell Row (Overhand)',
    'ph-local':       'Barbell Row (Overhand)',
    'home-dumbbells': 'Single-Arm Dumbbell Row',
    'barbell-rack':   'Barbell Row (Overhand)',
    'bands':          'Band Row',
    'bodyweight':     'Inverted Row',
  },
  'Chest-Supported Row': {
    'full-gym':       'Chest-Supported Row',
    'ph-local':       'Single-Arm Dumbbell Row', // chest-supported machine uncommon in local PH
    'home-dumbbells': 'Single-Arm Dumbbell Row',
    'barbell-rack':   'Barbell Row (Overhand)',
    'bands':          'Band Row',
    'bodyweight':     'Inverted Row',
  },
  'Lat Pulldown (Wide Grip)': {
    'full-gym':       'Lat Pulldown (Wide Grip)',
    'ph-local':       'Lat Pulldown (Wide Grip)', // very common in PH gyms
    'home-dumbbells': 'Weighted Pull-Up',
    'barbell-rack':   'Weighted Pull-Up',
    'bands':          'Band Pull-Down',
    'bodyweight':     'Inverted Row',
  },
  'Cable Row (Neutral Grip)': {
    'full-gym':       'Cable Row (Neutral Grip)',
    'ph-local':       'Cable Row (Neutral Grip)', // basic cable station works
    'home-dumbbells': 'Single-Arm Dumbbell Row',
    'barbell-rack':   'Barbell Row (Overhand)',
    'bands':          'Band Seated Row',
    'bodyweight':     'Inverted Row',
  },
  'Single-Arm Dumbbell Row': {
    'full-gym':       'Single-Arm Dumbbell Row',
    'ph-local':       'Single-Arm Dumbbell Row',
    'home-dumbbells': 'Single-Arm Dumbbell Row',
    'barbell-rack':   'Single-Arm Dumbbell Row',
    'bands':          'Single-Arm Band Row',
    'bodyweight':     'Inverted Row',
  },
  'Straight-Arm Pulldown': {
    'full-gym':       'Straight-Arm Pulldown',
    'ph-local':       'Straight-Arm Pulldown',
    'home-dumbbells': 'Dumbbell Pullover',
    'barbell-rack':   'Dumbbell Pullover',
    'bands':          'Band Pullover',
    'bodyweight':     'Inverted Row',
  },
  'Face Pull': {
    'full-gym':       'Face Pull',
    'ph-local':       'Face Pull',               // cable station available
    'home-dumbbells': 'Rear Delt Fly (Dumbbell)',
    'barbell-rack':   'Rear Delt Fly (Dumbbell)',
    'bands':          'Band Face Pull',
    'bodyweight':     'Prone Y-T-W Raise',
  },
  'Inverted Row':    { 'full-gym': 'Inverted Row', 'ph-local': 'Inverted Row', 'home-dumbbells': 'Inverted Row', 'barbell-rack': 'Inverted Row', 'bands': 'Inverted Row', 'bodyweight': 'Inverted Row' },
  'Dumbbell Pullover': { 'full-gym': 'Dumbbell Pullover', 'ph-local': 'Dumbbell Pullover', 'home-dumbbells': 'Dumbbell Pullover', 'barbell-rack': 'Dumbbell Pullover', 'bands': 'Band Pullover', 'bodyweight': 'Inverted Row' },

  // ── SHOULDERS ──────────────────────────────────────────────────────────────
  'Barbell Overhead Press': {
    'full-gym':       'Barbell Overhead Press',
    'ph-local':       'Barbell Overhead Press',
    'home-dumbbells': 'Dumbbell Overhead Press',
    'barbell-rack':   'Barbell Overhead Press',
    'bands':          'Band Overhead Press',
    'bodyweight':     'Pike Push-Up',
  },
  'Dumbbell Overhead Press': {
    'full-gym':       'Dumbbell Overhead Press',
    'ph-local':       'Dumbbell Overhead Press',
    'home-dumbbells': 'Dumbbell Overhead Press',
    'barbell-rack':   'Barbell Overhead Press',
    'bands':          'Band Overhead Press',
    'bodyweight':     'Pike Push-Up',
  },
  'Arnold Press': {
    'full-gym':       'Arnold Press',
    'ph-local':       'Arnold Press',
    'home-dumbbells': 'Arnold Press',
    'barbell-rack':   'Dumbbell Overhead Press',
    'bands':          'Band Overhead Press',
    'bodyweight':     'Pike Push-Up',
  },
  'Cable Lateral Raise': {
    'full-gym':       'Cable Lateral Raise',
    'ph-local':       'Cable Lateral Raise',     // cable station available
    'home-dumbbells': 'Dumbbell Lateral Raise',
    'barbell-rack':   'Dumbbell Lateral Raise',
    'bands':          'Band Lateral Raise',
    'bodyweight':     'Wall Slide',
  },
  'Dumbbell Lateral Raise': {
    'full-gym':       'Dumbbell Lateral Raise',
    'ph-local':       'Dumbbell Lateral Raise',
    'home-dumbbells': 'Dumbbell Lateral Raise',
    'barbell-rack':   'Dumbbell Lateral Raise',
    'bands':          'Band Lateral Raise',
    'bodyweight':     'Wall Slide',
  },
  'Rear Delt Fly (Cable)': {
    'full-gym':       'Rear Delt Fly (Cable)',
    'ph-local':       'Rear Delt Fly (Cable)',
    'home-dumbbells': 'Rear Delt Fly (Dumbbell)',
    'barbell-rack':   'Rear Delt Fly (Dumbbell)',
    'bands':          'Band Face Pull',
    'bodyweight':     'Prone Y-T-W Raise',
  },
  'Rear Delt Fly (Dumbbell)': {
    'full-gym':       'Rear Delt Fly (Dumbbell)',
    'ph-local':       'Rear Delt Fly (Dumbbell)',
    'home-dumbbells': 'Rear Delt Fly (Dumbbell)',
    'barbell-rack':   'Rear Delt Fly (Dumbbell)',
    'bands':          'Band Face Pull',
    'bodyweight':     'Prone Y-T-W Raise',
  },
  // Upright Row: available at full-gym and ph-local (cable station present),
  // subbed everywhere else. Note: if shoulder injury is flagged, INJURY_SUBSTITUTIONS
  // takes priority and replaces it regardless of tier.
  'Upright Row (Cable)': {
    'full-gym':       'Upright Row (Cable)',
    'ph-local':       'Dumbbell Lateral Raise',  // basic cable station not ideal for this
    'home-dumbbells': 'Dumbbell Lateral Raise',
    'barbell-rack':   'Dumbbell Lateral Raise',
    'bands':          'Band Lateral Raise',
    'bodyweight':     'Wall Slide',
  },
  'Pike Push-Up': { 'full-gym': 'Pike Push-Up', 'ph-local': 'Pike Push-Up', 'home-dumbbells': 'Pike Push-Up', 'barbell-rack': 'Pike Push-Up', 'bands': 'Pike Push-Up', 'bodyweight': 'Pike Push-Up' },
  'Landmine Press': { 'full-gym': 'Landmine Press', 'ph-local': 'Landmine Press', 'home-dumbbells': 'Dumbbell Overhead Press', 'barbell-rack': 'Landmine Press', 'bands': 'Band Overhead Press', 'bodyweight': 'Pike Push-Up' },

  // ── BICEPS ─────────────────────────────────────────────────────────────────
  'Barbell Curl': {
    'full-gym':       'Barbell Curl',
    'ph-local':       'Barbell Curl',
    'home-dumbbells': 'Hammer Curl',
    'barbell-rack':   'Barbell Curl',
    'bands':          'Band Curl',
    'bodyweight':     'Chin-Up',
  },
  'Incline Dumbbell Curl': {
    'full-gym':       'Incline Dumbbell Curl',
    'ph-local':       'Incline Dumbbell Curl',
    'home-dumbbells': 'Incline Dumbbell Curl',
    'barbell-rack':   'Incline Dumbbell Curl',
    'bands':          'Band Curl',
    'bodyweight':     'Chin-Up',
  },
  'Cable Curl (Low Pulley)': {
    'full-gym':       'Cable Curl (Low Pulley)',
    'ph-local':       'Cable Curl (Low Pulley)',
    'home-dumbbells': 'Incline Dumbbell Curl',
    'barbell-rack':   'Barbell Curl',
    'bands':          'Band Curl',
    'bodyweight':     'Chin-Up',
  },
  'Hammer Curl':          { 'full-gym': 'Hammer Curl',          'ph-local': 'Hammer Curl',          'home-dumbbells': 'Hammer Curl',          'barbell-rack': 'Hammer Curl',       'bands': 'Band Hammer Curl', 'bodyweight': 'Chin-Up' },
  'Spider Curl':          { 'full-gym': 'Spider Curl',          'ph-local': 'Spider Curl',          'home-dumbbells': 'Incline Dumbbell Curl','barbell-rack': 'Spider Curl',       'bands': 'Band Curl',        'bodyweight': 'Chin-Up' },
  'Preacher Curl (EZ Bar)':{ 'full-gym': 'Preacher Curl (EZ Bar)','ph-local': 'Preacher Curl (EZ Bar)','home-dumbbells':'Incline Dumbbell Curl','barbell-rack':'Barbell Curl',      'bands': 'Band Curl',        'bodyweight': 'Chin-Up' },
  'Chin-Up':              { 'full-gym': 'Chin-Up',              'ph-local': 'Chin-Up',              'home-dumbbells': 'Chin-Up',              'barbell-rack': 'Chin-Up',           'bands': 'Band Curl',        'bodyweight': 'Chin-Up' },

  // ── TRICEPS ────────────────────────────────────────────────────────────────
  'Close-Grip Bench Press': {
    'full-gym':       'Close-Grip Bench Press',
    'ph-local':       'Close-Grip Bench Press',
    'home-dumbbells': 'Overhead Tricep Extension',
    'barbell-rack':   'Close-Grip Bench Press',
    'bands':          'Band Tricep Pushdown',
    'bodyweight':     'Diamond Push-Up',
  },
  'Overhead Tricep Extension': {
    'full-gym':       'Overhead Tricep Extension',
    'ph-local':       'Overhead Tricep Extension',
    'home-dumbbells': 'Overhead Tricep Extension',
    'barbell-rack':   'Overhead Tricep Extension',
    'bands':          'Band Overhead Tricep Extension',
    'bodyweight':     'Diamond Push-Up',
  },
  'EZ Bar Skull Crusher': {
    'full-gym':       'EZ Bar Skull Crusher',
    'ph-local':       'EZ Bar Skull Crusher',
    'home-dumbbells': 'Overhead Tricep Extension',
    'barbell-rack':   'EZ Bar Skull Crusher',
    'bands':          'Band Overhead Tricep Extension',
    'bodyweight':     'Diamond Push-Up',
  },
  'Cable Tricep Pushdown': {
    'full-gym':       'Cable Tricep Pushdown',
    'ph-local':       'Cable Tricep Pushdown',   // cable station available
    'home-dumbbells': 'Overhead Tricep Extension',
    'barbell-rack':   'EZ Bar Skull Crusher',
    'bands':          'Band Tricep Pushdown',
    'bodyweight':     'Diamond Push-Up',
  },
  'Single-Arm Cable Extension': {
    'full-gym':       'Single-Arm Cable Extension',
    'ph-local':       'Single-Arm Cable Extension',
    'home-dumbbells': 'Overhead Tricep Extension',
    'barbell-rack':   'Overhead Tricep Extension',
    'bands':          'Band Tricep Pushdown',
    'bodyweight':     'Diamond Push-Up',
  },
  'Tricep Dips (Bench)': { 'full-gym': 'Tricep Dips (Bench)', 'ph-local': 'Tricep Dips (Bench)', 'home-dumbbells': 'Tricep Dips (Bench)', 'barbell-rack': 'Tricep Dips (Bench)', 'bands': 'Diamond Push-Up', 'bodyweight': 'Diamond Push-Up' },

  // ── LEGS ───────────────────────────────────────────────────────────────────
  'Barbell Back Squat': {
    'full-gym':       'Barbell Back Squat',
    'ph-local':       'Barbell Back Squat',
    'home-dumbbells': 'Goblet Squat',
    'barbell-rack':   'Barbell Back Squat',
    'bands':          'Band Squat',
    'bodyweight':     'Bulgarian Split Squat',
  },
  'Romanian Deadlift': {
    'full-gym':       'Romanian Deadlift',
    'ph-local':       'Romanian Deadlift',
    'home-dumbbells': 'Romanian Deadlift',
    'barbell-rack':   'Romanian Deadlift',
    'bands':          'Band Romanian Deadlift',
    'bodyweight':     'Single-Leg Hip Hinge',
  },
  'Leg Press': {
    'full-gym':       'Leg Press',
    'ph-local':       'Leg Press',               // 45° sled leg press present at AF PH in almost every location
    'home-dumbbells': 'Goblet Squat',
    'barbell-rack':   'Barbell Back Squat',
    'bands':          'Band Squat',
    'bodyweight':     'Bulgarian Split Squat',
  },
  'Hack Squat': {
    'full-gym':       'Hack Squat',
    'ph-local':       'Bulgarian Split Squat',   // hack squat machine very rare in PH
    'home-dumbbells': 'Bulgarian Split Squat',
    'barbell-rack':   'Barbell Back Squat',
    'bands':          'Band Squat',
    'bodyweight':     'Bulgarian Split Squat',
  },
  'Bulgarian Split Squat': {
    'full-gym':       'Bulgarian Split Squat',
    'ph-local':       'Bulgarian Split Squat',
    'home-dumbbells': 'Bulgarian Split Squat',
    'barbell-rack':   'Bulgarian Split Squat',
    'bands':          'Band Reverse Lunge',
    'bodyweight':     'Bulgarian Split Squat',
  },
  'Nordic Hamstring Curl': {
    'full-gym':       'Nordic Hamstring Curl',
    'ph-local':       'Nordic Hamstring Curl',
    'home-dumbbells': 'Nordic Hamstring Curl',
    'barbell-rack':   'Nordic Hamstring Curl',
    'bands':          'Band Leg Curl',
    'bodyweight':     'Nordic Hamstring Curl',
  },
  'Lying Leg Curl': {
    'full-gym':       'Lying Leg Curl',
    'ph-local':       'Lying Leg Curl',          // leg extension/curl combo machine common at AF PH
    'home-dumbbells': 'Dumbbell Leg Curl',
    'barbell-rack':   'Dumbbell Leg Curl',
    'bands':          'Band Leg Curl',
    'bodyweight':     'Nordic Hamstring Curl',
  },
  'Leg Extension': {
    'full-gym':       'Leg Extension',
    'ph-local':       'Leg Extension',           // leg extension/curl combo machine common at AF PH
    'home-dumbbells': 'Bulgarian Split Squat',
    'barbell-rack':   'Bulgarian Split Squat',
    'bands':          'Band Leg Extension',
    'bodyweight':     'Step-Up',
  },
  'Hip Thrust (Barbell)': {
    'full-gym':       'Hip Thrust (Barbell)',
    'ph-local':       'Hip Thrust (Barbell)',
    'home-dumbbells': 'Hip Thrust (Barbell)',
    'barbell-rack':   'Hip Thrust (Barbell)',
    'bands':          'Glute Bridge',
    'bodyweight':     'Glute Bridge',
  },
  'Walking Lunge': {
    'full-gym':       'Walking Lunge',
    'ph-local':       'Walking Lunge',
    'home-dumbbells': 'Dumbbell Walking Lunge',
    'barbell-rack':   'Barbell Lunge',
    'bands':          'Band Reverse Lunge',
    'bodyweight':     'Bodyweight Lunge',
  },
  'Seated Calf Raise': {
    'full-gym':       'Seated Calf Raise',
    'ph-local':       'Standing Calf Raise',     // seated calf raise machine rare in PH
    'home-dumbbells': 'Single-Leg Calf Raise',
    'barbell-rack':   'Barbell Calf Raise',
    'bands':          'Band Calf Raise',
    'bodyweight':     'Single-Leg Calf Raise',
  },
  'Standing Calf Raise': {
    'full-gym':       'Standing Calf Raise',
    'ph-local':       'Standing Calf Raise',
    'home-dumbbells': 'Single-Leg Calf Raise',
    'barbell-rack':   'Barbell Calf Raise',
    'bands':          'Band Calf Raise',
    'bodyweight':     'Single-Leg Calf Raise',
  },
  'Goblet Squat':       { 'full-gym': 'Goblet Squat',  'ph-local': 'Goblet Squat',  'home-dumbbells': 'Goblet Squat',  'barbell-rack': 'Barbell Back Squat', 'bands': 'Band Squat',      'bodyweight': 'Bulgarian Split Squat' },
  'Box Squat':          { 'full-gym': 'Box Squat',     'ph-local': 'Box Squat',     'home-dumbbells': 'Goblet Squat',  'barbell-rack': 'Box Squat',          'bands': 'Band Squat',      'bodyweight': 'Step-Up'               },
  'Step-Up':            { 'full-gym': 'Step-Up',       'ph-local': 'Step-Up',       'home-dumbbells': 'Step-Up',       'barbell-rack': 'Step-Up',            'bands': 'Step-Up',         'bodyweight': 'Step-Up'               },
  'Dumbbell Leg Curl':  { 'full-gym': 'Dumbbell Leg Curl','ph-local':'Dumbbell Leg Curl','home-dumbbells':'Dumbbell Leg Curl','barbell-rack':'Dumbbell Leg Curl','bands':'Band Leg Curl',  'bodyweight': 'Nordic Hamstring Curl' },
  'Reverse Lunge':      { 'full-gym': 'Reverse Lunge', 'ph-local': 'Reverse Lunge', 'home-dumbbells': 'Reverse Lunge', 'barbell-rack': 'Reverse Lunge',      'bands': 'Band Reverse Lunge','bodyweight': 'Reverse Lunge'        },
  'Glute Bridge':       { 'full-gym': 'Glute Bridge',  'ph-local': 'Glute Bridge',  'home-dumbbells': 'Glute Bridge',  'barbell-rack': 'Glute Bridge',       'bands': 'Glute Bridge',    'bodyweight': 'Glute Bridge'          },
  'Single-Leg Calf Raise': { 'full-gym': 'Single-Leg Calf Raise','ph-local':'Single-Leg Calf Raise','home-dumbbells':'Single-Leg Calf Raise','barbell-rack':'Single-Leg Calf Raise','bands':'Single-Leg Calf Raise','bodyweight':'Single-Leg Calf Raise' },

  // ── CORE ───────────────────────────────────────────────────────────────────
  'Cable Crunch': {
    'full-gym':       'Cable Crunch',
    'ph-local':       'Cable Crunch',            // cable station available
    'home-dumbbells': 'Dead Bug',
    'barbell-rack':   'Dead Bug',
    'bands':          'Band Crunch',
    'bodyweight':     'Dead Bug',
  },
  'Hanging Leg Raise': {
    'full-gym':       'Hanging Leg Raise',
    'ph-local':       'Hanging Leg Raise',
    'home-dumbbells': 'Hanging Leg Raise',
    'barbell-rack':   'Hanging Leg Raise',
    'bands':          'Lying Leg Raise',
    'bodyweight':     'Lying Leg Raise',
  },
  'Ab Wheel Rollout': {
    'full-gym':       'Ab Wheel Rollout',
    'ph-local':       'Ab Wheel Rollout',
    'home-dumbbells': 'Ab Wheel Rollout',
    'barbell-rack':   'Barbell Rollout',
    'bands':          'Plank',
    'bodyweight':     'Plank',
  },
  'Decline Sit-Up': {
    'full-gym':       'Decline Sit-Up',
    'ph-local':       'Dead Bug',                // decline bench for abs uncommon in PH local gyms
    'home-dumbbells': 'Dead Bug',
    'barbell-rack':   'Dead Bug',
    'bands':          'Dead Bug',
    'bodyweight':     'Dead Bug',
  },
  'Pallof Press': {
    'full-gym':       'Pallof Press',
    'ph-local':       'Pallof Press',
    'home-dumbbells': 'Pallof Press',
    'barbell-rack':   'Pallof Press',
    'bands':          'Band Pallof Press',
    'bodyweight':     'Side Plank',
  },
  'Dead Bug':         { 'full-gym': 'Dead Bug',    'ph-local': 'Dead Bug',    'home-dumbbells': 'Dead Bug',    'barbell-rack': 'Dead Bug',    'bands': 'Dead Bug',    'bodyweight': 'Dead Bug'    },
  'Plank':            { 'full-gym': 'Plank',       'ph-local': 'Plank',       'home-dumbbells': 'Plank',       'barbell-rack': 'Plank',       'bands': 'Plank',       'bodyweight': 'Plank'       },
  'Side Plank':       { 'full-gym': 'Side Plank',  'ph-local': 'Side Plank',  'home-dumbbells': 'Side Plank',  'barbell-rack': 'Side Plank',  'bands': 'Side Plank',  'bodyweight': 'Side Plank'  },
  'Dragon Flag':      { 'full-gym': 'Dragon Flag', 'ph-local': 'Dragon Flag', 'home-dumbbells': 'Dragon Flag', 'barbell-rack': 'Dragon Flag', 'bands': 'Plank',       'bodyweight': 'Dragon Flag' },
  'Lying Leg Raise':  { 'full-gym': 'Lying Leg Raise','ph-local':'Lying Leg Raise','home-dumbbells':'Lying Leg Raise','barbell-rack':'Lying Leg Raise','bands':'Lying Leg Raise','bodyweight':'Lying Leg Raise' },
};

// ─── INJURY TYPES ─────────────────────────────────────────────────────────────
export const INJURY_TYPES = [
  { id: 'lower-back',  label: 'Lower Back',  description: 'Pain or tightness in the lumbar region' },
  { id: 'knee',        label: 'Knee Pain',   description: 'Anterior knee pain, tendinopathy, or meniscus issues' },
  { id: 'shoulder',    label: 'Shoulder',    description: 'Impingement, rotator cuff, or AC joint issues' },
  { id: 'wrist',       label: 'Wrist',       description: 'Wrist pain, tendinitis, or limited extension' },
  { id: 'elbow',       label: 'Elbow',       description: 'Tennis elbow, golfer\'s elbow, or joint pain' },
  { id: 'hip-flexor',  label: 'Hip Flexor',  description: 'Hip flexor tightness, strain, or anterior hip pain' },
  { id: 'neck',        label: 'Neck',        description: 'Cervical pain, tightness, or recent strain' },
];

// ─── INJURY SUBSTITUTIONS ─────────────────────────────────────────────────────
export const INJURY_SUBSTITUTIONS = {
  'lower-back': {
    substitute: {
      'Conventional Deadlift':  'Romanian Deadlift',
      'Barbell Row (Overhand)': 'Chest-Supported Row',
      'Barbell Back Squat':     'Goblet Squat',
      'Decline Sit-Up':         'Dead Bug',
      'Hanging Leg Raise':      'Lying Leg Raise',
      'Ab Wheel Rollout':       'Dead Bug',
    },
    notes: 'Keep spine neutral. Avoid loading under fatigue. Prioritise hip hinge over spinal extension.',
  },
  'knee': {
    substitute: {
      'Barbell Back Squat':    'Box Squat',
      'Hack Squat':            'Step-Up',
      'Leg Extension':         'Hip Thrust (Barbell)',
      'Walking Lunge':         'Romanian Deadlift',
      'Leg Press':             'Hip Thrust (Barbell)',
      'Bulgarian Split Squat': 'Step-Up',
    },
    notes: 'Limit knee flexion past 90° under load. Avoid valgus. Prioritise hip-dominant patterns.',
  },
  'shoulder': {
    substitute: {
      'Upright Row (Cable)':    'Dumbbell Lateral Raise',
      'Barbell Overhead Press': 'Landmine Press',
      'Arnold Press':           'Dumbbell Overhead Press',
      'Cable Lateral Raise':    'Rear Delt Fly (Dumbbell)',
      'Dumbbell Lateral Raise': 'Rear Delt Fly (Dumbbell)',
      'Incline Barbell Press':  'Incline Dumbbell Press',
    },
    notes: 'Avoid internal rotation under load above 90°. Add face pulls as therapeutic work.',
  },
  'wrist': {
    substitute: {
      'Barbell Bench Press':    'Incline Dumbbell Press',
      'Barbell Curl':           'Preacher Curl (EZ Bar)',
      'Barbell Overhead Press': 'Dumbbell Overhead Press',
      'Barbell Row (Overhand)': 'Single-Arm Dumbbell Row',
      'Close-Grip Bench Press': 'Overhead Tricep Extension',
    },
    notes: 'Prefer dumbbells (rotating grip) and EZ-bar over straight barbell.',
  },
  'elbow': {
    substitute: {
      'Barbell Curl':           'Hammer Curl',
      'Cable Tricep Pushdown':  'Overhead Tricep Extension',
      'EZ Bar Skull Crusher':   'Overhead Tricep Extension',
      'Weighted Pull-Up':       'Lat Pulldown (Wide Grip)',
      'Close-Grip Bench Press': 'Diamond Push-Up',
    },
    notes: 'Use neutral grip wherever possible. Reduce load, increase reps.',
  },
  'hip-flexor': {
    substitute: {
      'Walking Lunge':         'Romanian Deadlift',
      'Hanging Leg Raise':     'Lying Leg Raise',
      'Barbell Back Squat':    'Hip Thrust (Barbell)',
      'Bulgarian Split Squat': 'Romanian Deadlift',
    },
    notes: 'Prioritise posterior chain. Add hip flexor stretching between sets.',
  },
  'neck': {
    substitute: {
      'Upright Row (Cable)':    'Dumbbell Lateral Raise',
      'Barbell Overhead Press': 'Dumbbell Overhead Press',
    },
    notes: 'Avoid cervical compression. If pain is acute or radiating, consult a doctor first.',
  },
};

// ─── PROFILE API ─────────────────────────────────────────────────────────────
export function getProfile() {
  return _get('userProfile') || {};
}

export function saveProfile(updates) {
  const profile = getProfile();
  _set('userProfile', { ...profile, ...updates });
}

export function getActiveProfile() {
  const profile = getProfile();
  // Session override: temporary tier set for this session only
  const override = profile.sessionOverrideTier;
  return {
    // Default to ph-local — the baseline for most Filipino gym-goers.
    // Only users who explicitly pick 'full-gym' (premium gym) get machine exercises.
    equipmentTier: override || profile.equipmentTier || 'ph-local',
    injuries:      profile.injuries || [],
    setupComplete: !!profile.setupComplete,
    isOverride:    !!override,
  };
}

// ─── EXERCISE RESOLVER ────────────────────────────────────────────────────────
export function resolveExercise(exerciseName, profile) {
  const { equipmentTier, injuries } = profile;

  // Injury override takes priority
  for (const injuryId of (injuries || [])) {
    const sub = INJURY_SUBSTITUTIONS[injuryId]?.substitute?.[exerciseName];
    if (sub) return { name: sub, original: exerciseName, reason: 'injury', injuryId };
  }

  // Equipment substitution
  // ph-local = no assumptions; pass through like full-gym.
  // Users who need subs pick home-dumbbells / bands / bodyweight explicitly.
  const effectiveTier = (equipmentTier === 'ph-local') ? 'full-gym' : equipmentTier;
  const tierMap = EQUIPMENT_SUBSTITUTIONS[exerciseName];
  if (tierMap) {
    const sub = tierMap[effectiveTier] || exerciseName;
    if (sub !== exerciseName) return { name: sub, original: exerciseName, reason: 'equipment', injuryId: null };
  }

  return { name: exerciseName, original: exerciseName, reason: 'none', injuryId: null };
}
