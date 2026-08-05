// HOTMUM — Season 01 :: Sam's Toned Christmas.
// Pure data + pure helpers. No DOM, no storage, no network.
// Unit-tested in tests/unit/hotmum.test.js.
//
// THE ONE RULE (hotmum/PLAN.md §2.1): a set is a COUNTDOWN, not a count.
// Every working set is a tempo set — set length = reps × secs-per-rep — and
// the coach speaks the tempo and says the rep number out loud. Sam moves with
// the voice; the set ends when it ends. She never counts.
//
// WHY TEMPO AND NOT LOAD: she owns fixed 10/15/20 lb dumbbells, so 15 → 20 lb
// is a 33% jump — far too big to be the next step on a lunge. Time under
// tension is the only fine-grained progression lever available, which is why
// the season progresses tempo → reps → sets → load, load LAST (§2.0.1).
//
// PHASE LABELS ARE A CLOSED SET, defined in cues.js: UP, DOWN, SQUEEZE, HOLD,
// OUT, BACK. They are the words Alice actually owns as clips, and they're
// chosen to match the movement — on a squat you go DOWN and UP, not "lower"
// and "lift" (which is what the shared tempoCues.js would have said). A label
// outside the set is silent rather than mispronounced, and a test walks every
// pattern to catch one.
//
// Blocks match the engine schema in src/workout/rehab.js:
//   tempo — one continuous timed set; reps derived from the tempo pattern
//   hold  — one timed hold per set (planks, carries)
//   reps  — one timed hold PER REP with a re-brace between (bird dog)
// plus `dose` (which cut of the session a block belongs to) and `load`,
// which are HOTMUM's own additions.

// ─── Tempo patterns ──────────────────────────────────────────────────────────
// Named so the intent survives: eccentric-led on the hinges and squats,
// squeeze-led on the glutes, lower-led on the light isolation work where the
// only way to make 10 lb hard is to refuse to drop it.

const ECCENTRIC = [
  ['DOWN', 3],
  ['HOLD', 1],
  ['UP', 1],
]; // 5s — RDL, goblet squat, floor press
const ECCENTRIC_SHORT = [
  ['DOWN', 2],
  ['HOLD', 1],
  ['UP', 1],
]; // 4s — lunges, where balance caps how slow she can go
const SQUEEZE = [
  ['UP', 1],
  ['SQUEEZE', 2],
  ['DOWN', 2],
]; // 5s — hip thrust, calf raise
const SQUEEZE_FAST = [
  ['UP', 1],
  ['SQUEEZE', 1],
  ['DOWN', 1],
]; // 3s — bridge burnout
const HANG = [
  ['UP', 1],
  ['HOLD', 1],
  ['DOWN', 3],
]; // 5s — lateral raise, rear delt fly
const PULL = [
  ['UP', 1],
  ['SQUEEZE', 1],
  ['DOWN', 3],
]; // 5s — rows, curls
const PRESS = [
  ['UP', 1],
  ['DOWN', 3],
]; // 4s — shoulder press
const EXTEND = [
  ['DOWN', 3],
  ['UP', 1],
]; // 4s — overhead tricep extension
const STEP = [
  ['UP', 1],
  ['DOWN', 2],
]; // 3s — step-ups; slower gets wobbly
const REACH = [
  ['OUT', 2],
  ['HOLD', 1],
  ['BACK', 2],
]; // 5s — dead bug, heel slide (OUT = limbs away, BACK = return)
const WARM = [
  ['DOWN', 2],
  ['UP', 1],
]; // 3s — warm-up squat
const WARM_BRIDGE = [
  ['UP', 1],
  ['SQUEEZE', 1],
  ['DOWN', 2],
]; // 4s

// ─── Exercises ───────────────────────────────────────────────────────────────
// `feel` / `avoid` / `cue` / `why` follow the KILOS convention (src/workout/
// rehab.js) — they're what the player shows and what the coach voice reads.
// `breathe: true` marks the loaded moves where the exhale cue fires on the
// UP beat: a long tempo set holds intra-abdominal pressure longer than fast
// reps do, which matters more postpartum (PLAN.md §2.8).

export const HOTMUM_EXERCISES = {
  // — warm-up —
  'bw-squat': {
    name: 'Bodyweight Squat',
    feel: 'Hips and knees waking up together',
    avoid: 'Rushing — this is a rehearsal, not a set',
    cue: 'Feet shoulder-width, sit down between your hips. Easy and smooth.',
    why: 'Grooves the squat pattern before there’s a dumbbell in your hands.',
    yt: 'bodyweight squat form',
  },
  'glute-bridge': {
    name: 'Glute Bridge',
    feel: 'Glutes switching on, not hamstrings cramping',
    avoid: 'Arching the low back to get higher',
    cue: 'Heels close, ribs down, push the floor away and squeeze at the top.',
    why: 'Wakes the glutes so they lead the hinge work instead of the back.',
    yt: 'glute bridge form',
  },
  'bird-dog': {
    name: 'Bird Dog',
    feel: 'Everything still except the arm and leg',
    avoid: 'Hips rocking — a glass of water could sit on your back',
    cue: 'On all fours. Reach one arm and the opposite leg long, hold, come back.',
    why: 'Teaches the core to hold still while the limbs move — the exact skill lifting needs.',
    yt: 'bird dog exercise form',
  },
  'hip-circles': {
    name: 'Hip Circles',
    feel: 'The hip joint moving freely through its range',
    avoid: 'Forcing the end range',
    cue: 'Big slow circles, both directions. Loose.',
    why: 'Two minutes of hip mobility buys a better squat depth for free.',
    yt: 'hip circles warm up',
  },

  // — lower —
  rdl: {
    name: 'Romanian Deadlift',
    feel: 'A long stretch up the back of the thighs',
    avoid: 'Rounding the back, or squatting it down',
    cue: 'Soft knees. Push the hips BACK, dumbbells close to the legs. Stand tall and squeeze.',
    why: 'The hamstring-and-glute builder — and the best shape-changer in the whole plan.',
    yt: 'dumbbell romanian deadlift form',
    repTempo: ECCENTRIC,
    breathe: true,
  },
  lunge: {
    name: 'Lunge',
    feel: 'Front-leg glute and quad carrying it',
    avoid: 'Front knee caving in; leaning over the front thigh',
    cue: 'Step out, drop the back knee straight down, push through the front heel.',
    why: 'One leg at a time — the strong side can’t cover for the weak one.',
    yt: 'dumbbell lunge form',
    repTempo: ECCENTRIC_SHORT,
    breathe: true,
  },
  'reverse-lunge': {
    name: 'Reverse Lunge',
    feel: 'Same as a lunge, easier on the front knee',
    avoid: 'Landing hard on the back foot',
    cue: 'Step BACK, drop the knee, drive through the front heel to stand.',
    why: 'Kinder to the knees than stepping forward, and easier to balance postpartum.',
    yt: 'dumbbell reverse lunge form',
    repTempo: ECCENTRIC_SHORT,
    breathe: true,
  },
  'hip-thrust': {
    name: 'Hip Thrust',
    feel: 'Glutes, and only glutes, at the top',
    avoid: 'Ribs flaring; pushing through the toes',
    cue: 'Shoulders on the couch, dumbbell across the hips. Chin tucked, drive up, squeeze hard.',
    why: 'The single best glute-builder available with dumbbells.',
    yt: 'dumbbell hip thrust form',
    repTempo: SQUEEZE,
    breathe: true,
  },
  'goblet-squat': {
    name: 'Goblet Squat',
    feel: 'Quads and glutes, chest staying tall',
    avoid: 'Heels lifting; chest dropping forward',
    cue: 'Dumbbell at your chest, elbows in. Sit down between the hips, drive up.',
    why: 'The dumbbell held high keeps the torso upright — a squat your back likes.',
    yt: 'goblet squat form',
    repTempo: ECCENTRIC,
    breathe: true,
  },
  'step-up': {
    name: 'Step-Up',
    feel: 'The working leg doing all of it',
    avoid: 'Pushing off the bottom foot to cheat the rep',
    cue: 'Whole foot on the step. Stand up through THAT heel, lower slowly.',
    why: 'Single-leg strength plus balance — carrying a baby up stairs, basically.',
    yt: 'dumbbell step up form',
    repTempo: STEP,
    breathe: true,
  },
  'calf-raise': {
    name: 'Standing Calf Raise',
    feel: 'A hard squeeze at the very top',
    avoid: 'Bouncing at the bottom',
    cue: 'Up onto the toes as high as you can, hold, lower all the way down.',
    why: 'Calves respond to slow squeezes far more than to heavy weight.',
    yt: 'standing calf raise form',
    repTempo: SQUEEZE,
  },
  'glute-bridge-burnout': {
    name: 'Glute Bridge Burnout',
    feel: 'A deep burn in the glutes by rep twelve',
    avoid: 'Letting the hips sag between reps',
    cue: 'Continuous. Up, squeeze, down — don’t rest on the floor.',
    why: 'The finisher: chases blood into the glutes when they’re already tired.',
    yt: 'glute bridge burnout',
    repTempo: SQUEEZE_FAST,
  },

  // — upper —
  'shoulder-press': {
    name: 'Shoulder Press',
    feel: 'Shoulders pressing, ribs staying down',
    avoid: 'Arching the low back to get the weight up',
    cue: 'Dumbbells at shoulder height. Press up, lower SLOWLY back to the start.',
    why: 'Builds the round shoulder line that makes the waist look smaller.',
    yt: 'dumbbell shoulder press form',
    repTempo: PRESS,
    breathe: true,
  },
  'one-arm-row': {
    name: 'One-Arm Row',
    feel: 'The back pulling, not the arm',
    avoid: 'Twisting the torso to yank it up',
    cue: 'Hand and knee on the couch. Pull the dumbbell to your hip, squeeze, lower slowly.',
    why: 'Upper back — the posture muscles that carrying a baby all day steals.',
    yt: 'one arm dumbbell row form',
    repTempo: PULL,
    breathe: true,
  },
  'floor-press': {
    name: 'Floor Chest Press',
    feel: 'Chest and triceps, upper arms resting at the bottom',
    avoid: 'Bouncing the elbows off the floor',
    cue: 'On your back, knees bent. Lower until the upper arms touch, pause, press.',
    why: 'The floor caps the range — a chest press that’s kind to postpartum shoulders.',
    yt: 'dumbbell floor press form',
    repTempo: ECCENTRIC,
    breathe: true,
  },
  'lateral-raise': {
    name: 'Lateral Raise',
    feel: 'Side of the shoulder burning by rep eight',
    avoid: 'Swinging; shrugging the traps up',
    cue: 'Soft elbows, lift out to shoulder height, hold, lower on a three-count.',
    why: 'Shoulder width is the fastest visual change in the whole plan.',
    yt: 'dumbbell lateral raise form',
    repTempo: HANG,
  },
  'rear-delt-fly': {
    name: 'Rear Delt Fly',
    feel: 'Back of the shoulders and between the blades',
    avoid: 'Turning it into a row',
    cue: 'Hinge forward, soft elbows, open out wide like a wingspan. Slow back.',
    why: 'The rear shoulder — what actually pulls the posture upright.',
    yt: 'rear delt fly form',
    repTempo: HANG,
  },
  'bicep-curl': {
    name: 'Bicep Curl',
    feel: 'Biceps, elbows pinned to your sides',
    avoid: 'Rocking back to swing it up',
    cue: 'Curl up, squeeze at the top, lower on a three-count.',
    why: 'Arms. No further justification needed.',
    yt: 'dumbbell bicep curl form',
    repTempo: PULL,
  },
  'tricep-ext': {
    name: 'Overhead Tricep Extension',
    feel: 'A stretch down the back of the arm',
    avoid: 'Elbows flaring wide; ribs flaring up',
    cue: 'One dumbbell in both hands, overhead. Lower slowly behind the head, press up.',
    why: 'The back of the arm is two-thirds of its size — this is the toning move.',
    yt: 'overhead tricep extension form',
    repTempo: EXTEND,
  },
  'farmer-carry': {
    name: 'Farmer Carry',
    feel: 'Grip, shoulders and the whole core holding you tall',
    avoid: 'Leaning back; shoulders creeping up',
    cue: 'A dumbbell in each hand, stand tall, walk. Breathe normally.',
    why: 'Total-body bracing — and the most directly useful strength there is.',
    yt: 'farmer carry form',
  },

  // — core —
  'side-plank': {
    name: 'Side Plank',
    feel: 'The side of your waist holding you up',
    avoid: 'Hips sagging toward the floor',
    cue: 'Elbow under the shoulder, knees or feet stacked. Lift the hips, hold, breathe.',
    why: 'Trains the waist without a single crunch — the postpartum-safe option.',
    yt: 'side plank form',
  },
  'dead-bug': {
    name: 'Dead Bug',
    feel: 'Low back pressed flat the whole time',
    avoid: 'The back arching off the floor as the leg lowers',
    cue: 'On your back, arms and knees up. Reach one arm and the opposite leg away, slowly back.',
    why: 'The core’s real job — resisting movement, not making it.',
    yt: 'dead bug exercise form',
    repTempo: REACH,
  },
  'heel-slide': {
    name: 'Heel Slide',
    feel: 'Deep core working as the leg straightens',
    avoid: 'Letting the back lift off the floor',
    cue: 'On your back, knees bent. Slide one heel out until it’s nearly straight, slide it back.',
    why: 'The gentlest deep-core progression — the one to start from postpartum.',
    yt: 'heel slide core exercise',
    repTempo: REACH,
  },
};

// ─── Season ──────────────────────────────────────────────────────────────────
// The program has a DEADLINE, and the deadline is the motivation mechanic:
// a countdown to a fixed date pushes without punishing a missed day, which
// is why HOTMUM has no streaks anywhere (PLAN.md §2.0).

export const SEASON = {
  id: 'toned-christmas',
  label: 'SEASON 01',
  name: 'Sam’s Toned Christmas',
  startDate: '2026-08-11', // first Tuesday
  endDate: '2026-12-25',
  weeks: 20,
  // Load moves LAST: with fixed dumbbells it's the bluntest lever she has.
  blocks: [
    {
      weeks: [1, 4],
      name: 'GROOVE',
      blurb: 'The plan as written. Learn the tempos.',
    },
    {
      weeks: [5, 8],
      name: 'EXTEND',
      blurb: 'Same tempo, more reps. A 50s set becomes 60s.',
      addReps: 2,
    },
    {
      weeks: [9, 12],
      name: 'SLOW',
      blurb: 'Longer eccentric, reps back down.',
      addEccentric: 1,
    },
    {
      weeks: [13, 16],
      name: 'LOAD',
      blurb: '15 → 20 lb on the big three. Reps drop to 8.',
      addReps: -2,
      loadUp: ['rdl', 'hip-thrust', 'goblet-squat'],
    },
    {
      weeks: [17, 20],
      name: 'PEAK',
      blurb: 'Best tempo, best load, one more set on the opener.',
      addSets: 1,
    },
  ],
};

const DAY_MS = 86400000;
const asDate = (d) => (d instanceof Date ? d : new Date(`${d}T00:00:00`));

/** Whole days from `today` to Christmas. Never negative. */
export const daysToGo = (today = new Date()) =>
  Math.max(0, Math.ceil((asDate(SEASON.endDate) - asDate(today)) / DAY_MS));

/** 1-based season week, clamped to the season's length. */
export function seasonWeek(today = new Date()) {
  const elapsed = Math.floor(
    (asDate(today) - asDate(SEASON.startDate)) / DAY_MS,
  );
  return Math.min(SEASON.weeks, Math.max(1, Math.floor(elapsed / 7) + 1));
}

/** The four-week block a given season week falls in. */
export const blockForWeek = (week) =>
  SEASON.blocks.find((b) => week >= b.weeks[0] && week <= b.weeks[1]) ||
  SEASON.blocks[SEASON.blocks.length - 1];

// ─── The week ────────────────────────────────────────────────────────────────
// Three sessions, four walks — something every day. The walks are what make
// HOTMUM a daily open instead of a thrice-weekly one, and they're the one
// thing that stays possible on no sleep.

export const WALK = {
  id: 'walk',
  name: 'Walk',
  mins: 30,
  blurb:
    'Outside, the treadmill, or laps at the mall — it all counts. Stroller included.',
};

export const WEEK = [
  { day: 'MON', kind: 'walk' },
  { day: 'TUE', kind: 'session', id: 'lower-a' },
  { day: 'WED', kind: 'walk' },
  { day: 'THU', kind: 'session', id: 'upper' },
  { day: 'FRI', kind: 'walk' },
  { day: 'SAT', kind: 'session', id: 'lower-b' },
  { day: 'SUN', kind: 'walk' },
];

// ─── Doses ───────────────────────────────────────────────────────────────────
// Same program, three exits. She never has to choose between all of it and
// nothing — the failure mode that actually kills consistency (PLAN.md §2.7).

export const DOSES = {
  full: { label: 'FULL', includes: ['warmup', 'main', 'finisher', 'core'] },
  short: { label: 'SHORT', includes: ['warmup', 'main'] },
  core: { label: 'CORE', includes: ['core'] },
};

// ─── Warm-up (opens every session) ───────────────────────────────────────────

const WARMUP = [
  {
    ex: 'bw-squat',
    mode: 'tempo',
    dose: 'warmup',
    sets: 1,
    reps: 10,
    tempo: WARM,
  },
  {
    ex: 'glute-bridge',
    mode: 'tempo',
    dose: 'warmup',
    sets: 1,
    reps: 10,
    tempo: WARM_BRIDGE,
  },
  {
    ex: 'bird-dog',
    mode: 'reps',
    dose: 'warmup',
    sets: 1,
    reps: 5,
    holdSecs: 8,
    resetSecs: 3,
    perSide: true,
    switchSecs: 8,
  },
  { ex: 'hip-circles', mode: 'hold', dose: 'warmup', sets: 1, holdSecs: 30 },
];

// ─── Sessions ────────────────────────────────────────────────────────────────

export const HOTMUM_SESSIONS = [
  {
    id: 'lower-a',
    name: 'Lower A',
    day: 'TUE',
    blurb: 'Hinge, lunge, thrust, squat — then shoulders and core.',
    blocks: [
      ...WARMUP,
      {
        ex: 'rdl',
        mode: 'tempo',
        dose: 'main',
        sets: 3,
        reps: 10,
        tempo: ECCENTRIC,
        restSecs: 60,
        load: { lb: 15, each: true },
      },
      {
        ex: 'lunge',
        mode: 'tempo',
        dose: 'main',
        sets: 3,
        reps: 10,
        tempo: ECCENTRIC_SHORT,
        perSide: true,
        switchSecs: 10,
        restSecs: 60,
        load: { lb: 15, each: true },
      },
      {
        ex: 'hip-thrust',
        mode: 'tempo',
        dose: 'main',
        sets: 3,
        reps: 10,
        tempo: SQUEEZE,
        restSecs: 60,
        load: { lb: 20 },
      },
      {
        ex: 'goblet-squat',
        mode: 'tempo',
        dose: 'main',
        sets: 3,
        reps: 10,
        tempo: ECCENTRIC,
        restSecs: 60,
        load: { lb: 15 },
      },
      {
        ex: 'calf-raise',
        mode: 'tempo',
        dose: 'main',
        sets: 2,
        reps: 15,
        tempo: SQUEEZE,
        restSecs: 45,
        load: 'BW',
      },
      {
        ex: 'lateral-raise',
        mode: 'tempo',
        dose: 'finisher',
        sets: 2,
        reps: 15,
        tempo: HANG,
        restSecs: 45,
        load: { lb: 10, each: true },
      },
      {
        ex: 'rear-delt-fly',
        mode: 'tempo',
        dose: 'finisher',
        sets: 2,
        reps: 15,
        tempo: HANG,
        restSecs: 45,
        load: { lb: 10, each: true },
      },
      {
        ex: 'side-plank',
        mode: 'hold',
        dose: 'core',
        sets: 2,
        holdSecs: 30,
        perSide: true,
        switchSecs: 10,
        restSecs: 30,
        load: 'BW',
      },
      {
        ex: 'dead-bug',
        mode: 'tempo',
        dose: 'core',
        sets: 2,
        reps: 10,
        tempo: REACH,
        restSecs: 40,
        load: 'BW',
      },
    ],
  },

  {
    id: 'upper',
    name: 'Upper',
    day: 'THU',
    blurb: 'Press, row, press — arms, carry, core.',
    blocks: [
      ...WARMUP,
      {
        ex: 'shoulder-press',
        mode: 'tempo',
        dose: 'main',
        sets: 3,
        reps: 10,
        tempo: PRESS,
        restSecs: 60,
        load: { lb: 15, each: true },
      },
      {
        ex: 'one-arm-row',
        mode: 'tempo',
        dose: 'main',
        sets: 3,
        reps: 10,
        tempo: PULL,
        perSide: true,
        switchSecs: 10,
        restSecs: 60,
        load: { lb: 15 },
      },
      {
        ex: 'floor-press',
        mode: 'tempo',
        dose: 'main',
        sets: 3,
        reps: 10,
        tempo: ECCENTRIC,
        restSecs: 60,
        load: { lb: 15, each: true },
      },
      {
        ex: 'lateral-raise',
        mode: 'tempo',
        dose: 'main',
        sets: 3,
        reps: 12,
        tempo: HANG,
        restSecs: 45,
        load: { lb: 10, each: true },
      },
      {
        ex: 'bicep-curl',
        mode: 'tempo',
        dose: 'finisher',
        sets: 3,
        reps: 12,
        tempo: PULL,
        restSecs: 45,
        load: { lb: 10, each: true },
      },
      {
        ex: 'tricep-ext',
        mode: 'tempo',
        dose: 'finisher',
        sets: 3,
        reps: 12,
        tempo: EXTEND,
        restSecs: 45,
        load: { lb: 15 },
      },
      {
        ex: 'farmer-carry',
        mode: 'hold',
        dose: 'finisher',
        phase: 'CARRY',
        sets: 3,
        holdSecs: 40,
        restSecs: 60,
        load: { lb: 20, each: true },
      },
      {
        ex: 'bird-dog',
        mode: 'reps',
        dose: 'core',
        sets: 2,
        reps: 5,
        holdSecs: 8,
        resetSecs: 3,
        perSide: true,
        switchSecs: 10,
        restSecs: 30,
        load: 'BW',
      },
      {
        ex: 'side-plank',
        mode: 'hold',
        dose: 'core',
        sets: 2,
        holdSecs: 30,
        perSide: true,
        switchSecs: 10,
        restSecs: 30,
        load: 'BW',
      },
    ],
  },

  {
    id: 'lower-b',
    name: 'Lower B',
    day: 'SAT',
    blurb: 'Thrust-led. Four sets on the opener, burnout to close.',
    blocks: [
      ...WARMUP,
      {
        ex: 'hip-thrust',
        mode: 'tempo',
        dose: 'main',
        sets: 4,
        reps: 10,
        tempo: SQUEEZE,
        restSecs: 60,
        load: { lb: 20 },
      },
      {
        ex: 'reverse-lunge',
        mode: 'tempo',
        dose: 'main',
        sets: 3,
        reps: 10,
        tempo: ECCENTRIC_SHORT,
        perSide: true,
        switchSecs: 10,
        restSecs: 60,
        load: { lb: 15, each: true },
      },
      {
        ex: 'goblet-squat',
        mode: 'tempo',
        dose: 'main',
        sets: 3,
        reps: 10,
        tempo: ECCENTRIC,
        restSecs: 60,
        load: { lb: 15 },
      },
      {
        ex: 'step-up',
        mode: 'tempo',
        dose: 'main',
        sets: 3,
        reps: 10,
        tempo: STEP,
        perSide: true,
        switchSecs: 10,
        restSecs: 60,
        load: { lb: 15, each: true },
      },
      {
        ex: 'glute-bridge-burnout',
        mode: 'tempo',
        dose: 'main',
        sets: 2,
        reps: 20,
        tempo: SQUEEZE_FAST,
        restSecs: 45,
        load: 'BW',
      },
      {
        ex: 'shoulder-press',
        mode: 'tempo',
        dose: 'finisher',
        sets: 2,
        reps: 12,
        tempo: PRESS,
        restSecs: 45,
        load: { lb: 10, each: true },
      },
      {
        ex: 'one-arm-row',
        mode: 'tempo',
        dose: 'finisher',
        sets: 2,
        reps: 12,
        tempo: PULL,
        perSide: true,
        switchSecs: 10,
        restSecs: 45,
        load: { lb: 15 },
      },
      {
        ex: 'heel-slide',
        mode: 'tempo',
        dose: 'core',
        sets: 2,
        reps: 10,
        tempo: REACH,
        restSecs: 40,
        load: 'BW',
      },
      {
        ex: 'dead-bug',
        mode: 'tempo',
        dose: 'core',
        sets: 2,
        reps: 10,
        tempo: REACH,
        restSecs: 40,
        load: 'BW',
      },
    ],
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

export const getSession = (id) =>
  HOTMUM_SESSIONS.find((s) => s.id === id) || null;

/** Seconds for one rep of a tempo pattern. */
export const tempoSecs = (tempo) => tempo.reduce((n, [, s]) => n + s, 0);

/** Human tempo notation — [['DOWN',3],['HOLD',1],['UP',1]] → "3-1-1". */
export const tempoLabel = (tempo) => tempo.map(([, s]) => s).join('-');

/** A session cut down to one dose. Returns a session, not just blocks. */
export function sessionAtDose(session, dose = 'full') {
  const includes = (DOSES[dose] || DOSES.full).includes;
  return {
    ...session,
    blocks: session.blocks.filter((b) => includes.includes(b.dose)),
  };
}

/** Seconds of WORK in a block — no rests, no prep. */
export function blockWorkSecs(block) {
  const sides = block.perSide ? 2 : 1;
  const sets = block.sets || 1;
  if (block.mode === 'tempo')
    return sets * sides * block.reps * tempoSecs(block.tempo);
  if (block.mode === 'reps') return sets * sides * block.reps * block.holdSecs;
  return sets * sides * block.holdSecs; // hold
}

/**
 * Rough wall-clock for a session at a given dose: work + rests + side
 * switches + the engine's 10s prep before each new exercise.
 */
export function estimateSecs(session, dose = 'full') {
  const blocks = sessionAtDose(session, dose).blocks;
  return blocks.reduce((total, block) => {
    const sets = block.sets || 1;
    const sides = block.perSide ? 2 : 1;
    const rest = (block.restSecs || 0) * (sets - 1);
    const switches = (block.switchSecs || 0) * (sides - 1) * sets;
    const reset =
      block.mode === 'reps'
        ? (block.resetSecs || 0) * (block.reps - 1) * sets * sides
        : 0;
    return total + 10 + blockWorkSecs(block) + rest + switches + reset;
  }, 0);
}

export const estimateMins = (session, dose = 'full') =>
  Math.round(estimateSecs(session, dose) / 60);

/** Total logical sets in a session — what the finish card counts. */
export const setTotal = (session, dose = 'full') =>
  sessionAtDose(session, dose).blocks.reduce(
    (n, b) => n + (b.sets || 1) * (b.perSide ? 2 : 1),
    0,
  );

/** Seconds under tension across a session — the number tempo training earns. */
export const timeUnderTension = (session, dose = 'full') =>
  sessionAtDose(session, dose).blocks.reduce((n, b) => n + blockWorkSecs(b), 0);

/** "15 lb × 2" / "20 lb" / "Bodyweight" */
export function loadLabel(load) {
  if (!load || load === 'BW') return 'Bodyweight';
  return `${load.lb} lb${load.each ? ' × 2' : ''}`;
}
