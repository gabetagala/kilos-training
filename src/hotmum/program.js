// HOTMUM — Season 01 :: 100 Days of Showing Up.
// Pure data + pure helpers. No DOM, no storage, no network.
// Unit-tested in tests/unit/hotmum.test.js.
//
// THE ONE RULE (hotmum/PLAN.md §2.1): a set is a COUNTDOWN, not a count.
// Every working set is a tempo set — set length = reps × secs-per-rep — and
// the coach speaks the tempo and says the rep number out loud. Sam moves with
// the voice; the set ends when it ends. She never counts.
//
// WHY TEMPO AND NOT LOAD: she owns fixed 10/15/20 lb dumbbells, so 15 → 20 lb
// is a 33% jump — far too big to be the next step on a split squat. Time under
// tension is the only fine-grained progression lever available, which is why
// the season progresses tempo → reps → sets → load, load LAST (§2.0.1).
//
// ─── THE KNEE DOCTRINE (§2.9) — read before changing any lower-body block ───
//
// Sam's knees are the binding constraint on this program. The instinct is
// "more single-leg work", and that is only half right: a deep lunge or a
// tall step-up puts MORE stress through one kneecap than a shallow squat
// spreads across two. What actually protects a cranky knee, in order:
//
//   1. CAP THE DEPTH, KEEP THE TEMPO. Load through a knee climbs steeply past
//      roughly a chair-height bend. Slow eccentrics are good for the joint;
//      slow eccentrics at the BOTTOM of a deep squat are the exact dose that
//      irritates it. So every squat pattern here has a physical depth stop —
//      a chair — rather than a cue to "go to a comfortable depth", which is
//      advice nobody follows on rep nine.
//   2. THE HIPS DO THE BUILDING. Hinges (RDL, sumo) and hip abduction carry
//      the muscle-building load. Strong glutes are the best-evidenced knee
//      intervention there is, and none of it bends the knee under load.
//   3. UNILATERAL LEADS — AND IT LEADS FROM THE HIP (revised 2026-08-20).
//      One leg at a time fixes the side-to-side asymmetry that carrying a baby
//      on one hip builds, and it's the priority, so it goes FIRST on the lower
//      day while she's freshest — balance degrades with fatigue, and a
//      single-leg movement done tired is a worse movement, not a harder one.
//      The catch is WHICH unilateral: the way to do more of it without
//      punishing a knee is to make the HIP work single-leg (single-leg RDL,
//      hip abduction, single-leg calf raise — each loads one leg hard and
//      bends the knee barely at all), not to make the knee work deeper.
//      Everything with a bend in it stays SUPPORTED — a hand on a chair takes
//      the balance demand off, so the knee isn't stabilising a wobble on top
//      of carrying the weight. Reverse, never forward.
//   4. ISOMETRICS ARE THE MEDICINE, NOT THE RISK. Wall sits and controlled
//      sit-to-stands are in the plan because holds at a tolerable angle
//      calm an angry knee down. They are the one place a "continuous" hold
//      is exactly right.
//
// And because none of that survives a genuinely bad day: every session has
// an EASY KNEE cut (`kneeSwap` below) that trades the knee-dominant blocks
// for hip-dominant ones. Her own rule — "reduce intensity if your knee is
// irritated" — is a feature, not a paragraph she is supposed to remember.
//
// ─── STANDING ONLY (§2.10) ───────────────────────────────────────────────────
// Her plan has no floor work in it, and that is deliberate: getting down and
// back up with a baby in the house is the tax that stops a session starting.
// So the core is standing (knee-to-elbow, suitcase hold, carries), not planks
// and dead bugs. Everything here can be done in shoes, next to a chair, with
// a baby monitor in view. Don't reintroduce floor work without asking her.
//
// Phase labels are a closed set, defined in cues.js: UP, DOWN, SQUEEZE, HOLD,
// OUT, BACK. They are the words Alice actually owns as clips, and they're
// chosen to match the movement — on a squat you go DOWN and UP, not "lower"
// and "lift" (which is what the shared tempoCues.js would have said). A label
// outside the set is silent rather than mispronounced, and a test walks every
// pattern to catch one.
//
// Blocks match the engine schema in src/workout/rehab.js:
//   tempo — one continuous timed set; reps derived from the tempo pattern
//   hold  — one timed hold per set (wall sits, carries, suitcase holds)
//   reps  — one timed hold PER REP with a re-brace between
// plus `dose` (which cut of the session a block belongs to), `load`, and
// `kneeSwap`, which are HOTMUM's own additions.

// ─── Tempo patterns ──────────────────────────────────────────────────────────
// Named so the intent survives: eccentric-led on the hinges and squats,
// squeeze-led on the glutes, lower-led on the light isolation work where the
// only way to make 10 lb hard is to refuse to drop it.

const ECCENTRIC = [
  ['DOWN', 3],
  ['HOLD', 1],
  ['UP', 1],
]; // 5s — RDL, goblet squat, sumo squat
const ECCENTRIC_SHORT = [
  ['DOWN', 2],
  ['HOLD', 1],
  ['UP', 1],
]; // 4s — supported lunges and sit-to-stands, where the chair sets the depth
const SQUEEZE = [
  ['UP', 1],
  ['SQUEEZE', 2],
  ['DOWN', 2],
]; // 5s — calf raise, squeeze press
const SQUEEZE_FAST = [
  ['UP', 1],
  ['SQUEEZE', 1],
  ['DOWN', 1],
]; // 3s — standing knee-to-elbow, knee drive
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
const ABDUCT = [
  ['OUT', 1],
  ['HOLD', 1],
  ['BACK', 2],
]; // 4s — standing hip abduction (OUT = leg away, BACK = return)
const WARM = [
  ['DOWN', 2],
  ['UP', 1],
]; // 3s — warm-up squat, hinge, good morning
const WARM_KNEE = [
  ['UP', 1],
  ['DOWN', 1],
]; // 2s — warm-up knee lifts
const WARM_CALF = [
  ['UP', 1],
  ['SQUEEZE', 1],
  ['DOWN', 1],
]; // 3s — warm-up calf raise

// ─── Exercises ───────────────────────────────────────────────────────────────
// `feel` / `avoid` / `cue` / `why` follow the KILOS convention (src/workout/
// rehab.js) — they're what the player shows under the illustration and what
// the movement card reads. `breathe: true` marks the loaded moves where the
// exhale cue fires on the UP beat: a long tempo set holds intra-abdominal
// pressure longer than fast reps do, which matters more postpartum (§2.8).
//
// `knee` is HOTMUM's own field: the one sentence about this movement and her
// knees. It renders in hot magenta under the demo on every knee-relevant
// move, because the rule she has to remember mid-set is the rule she'll only
// read if it's already on screen.

export const HOTMUM_EXERCISES = {
  // — warm-up —
  'bw-squat': {
    name: 'Bodyweight Squat',
    feel: 'Hips and knees waking up together',
    avoid: 'Rushing — this is a rehearsal, not a set',
    cue: 'Feet shoulder-width, sit down between your hips. Only as deep as feels easy.',
    why: 'Grooves the squat pattern before there’s a dumbbell in your hands.',
    knee: 'Warm-ups go half as deep as the working sets. Nothing to prove here.',
    yt: 'bodyweight squat form',
  },
  'standing-hinge': {
    name: 'Standing Hip Hinge',
    feel: 'A light stretch up the back of the thighs',
    avoid: 'Bending the knees to reach lower — this is hips, not knees',
    cue: 'Hands on your hips. Push the hips straight BACK, chest long, then stand tall.',
    why: 'Rehearses the RDL without load, so the first working rep isn’t the first rep.',
    yt: 'hip hinge drill',
  },
  'knee-lift': {
    name: 'Standing Knee Lift',
    feel: 'Hip flexors and the deep core switching on',
    avoid: 'Leaning back to swing the knee up',
    cue: 'Stand tall, lift one knee to hip height, place it down. Alternate, easy pace.',
    why: 'Wakes the hip and the standing leg together — a warm-up and a balance drill.',
    knee: 'Nothing bends under load here. This one is always safe.',
    yt: 'standing knee lift warm up',
  },
  'hip-circles': {
    name: 'Hip Circles',
    feel: 'The hip joint moving freely through its range',
    avoid: 'Forcing the end range',
    cue: 'Big slow circles, both directions. Loose.',
    why: 'Two minutes of hip mobility buys a better squat for free.',
    yt: 'hip circles warm up',
  },
  'arm-circles': {
    name: 'Arm Circles',
    feel: 'Shoulders loosening, blood moving',
    avoid: 'Big fast windmills — they wrench the shoulder cold',
    cue: 'Arms out to the sides. Small circles first, then bigger. Both directions.',
    why: 'The cheapest shoulder warm-up there is, and pressing wants one.',
    yt: 'arm circles warm up',
  },
  'shoulder-rolls': {
    name: 'Shoulder Rolls',
    feel: 'The tops of the shoulders unsticking',
    avoid: 'Shrugging up and holding there',
    cue: 'Roll the shoulders up, back and down. Slow, big, unhurried.',
    why: 'Undoes the forward-rounded posture a day of carrying a baby builds.',
    yt: 'shoulder rolls mobility',
  },
  'torso-rotation': {
    name: 'Standing Torso Rotation',
    feel: 'The waist turning, hips staying put',
    avoid: 'Whipping round — momentum, not control',
    cue: 'Arms folded at chest height. Turn slowly one way, then the other.',
    why: 'Opens the mid-back so the press goes overhead instead of forward.',
    yt: 'standing torso rotation warm up',
  },
  'good-morning': {
    name: 'Bodyweight Good Morning',
    feel: 'Hamstrings loading, back staying long',
    avoid: 'Rounding the upper back at the bottom',
    cue: 'Hands at your temples. Hinge forward to about half way, stand tall.',
    why: 'Warms the whole back line before the rows and presses ask for it.',
    yt: 'bodyweight good morning form',
  },

  // — lower —
  rdl: {
    name: 'Romanian Deadlift',
    feel: 'A long stretch up the back of the thighs',
    avoid: 'Rounding the back, or squatting it down',
    cue: 'Soft knees. Push the hips BACK, dumbbells close to the legs. Stand tall and squeeze.',
    why: 'The hamstring-and-glute builder — and the best shape-changer in the whole plan.',
    knee: 'The knee barely moves. This is the safest heavy thing you do.',
    yt: 'dumbbell romanian deadlift form',
    repTempo: ECCENTRIC,
    breathe: true,
  },
  'sl-rdl': {
    name: 'Single-Leg RDL',
    feel: 'One hamstring and glute taking all of it, hip square to the floor',
    avoid: 'Twisting open at the hip; rounding the back to reach lower',
    cue: 'One hand on the chair, dumbbell in the other. Push the free leg straight back as your chest comes down. Stand tall.',
    why: 'The most single-leg thing you can do — and it never bends the knee.',
    knee: 'Almost no bend at the knee, and one leg carries everything. The best knee-to-benefit trade in the plan.',
    yt: 'supported single leg romanian deadlift form',
    repTempo: ECCENTRIC,
    breathe: true,
  },
  'sl-calf-raise': {
    name: 'Single-Leg Calf Raise',
    feel: 'One calf doing all of it, hard, by rep six',
    avoid: 'Bouncing; leaning on the chair to take weight off the leg',
    cue: 'One hand on the chair for balance only. Up onto one toe as high as you can, hold, lower all the way down.',
    why: 'Double the load per calf with no extra dumbbells — and it exposes the weaker side.',
    knee: 'Standing knee soft but still. Nothing bends here.',
    yt: 'single leg calf raise form',
    repTempo: SQUEEZE,
  },
  'goblet-squat': {
    name: 'Goblet Squat',
    feel: 'Quads and glutes, chest staying tall',
    avoid: 'Going below the chair; heels lifting; knees falling inward',
    cue: 'Chair behind you. Dumbbell at your chest, sit down until you brush it, stand up.',
    why: 'The dumbbell held high keeps the torso upright — a squat your back likes.',
    knee: 'The chair IS the depth limit. Touch it, don’t sit on it, never go past it.',
    yt: 'goblet squat to box form',
    repTempo: ECCENTRIC,
    breathe: true,
  },
  'sumo-squat': {
    name: 'Sumo Squat',
    feel: 'Inner thighs and glutes, wide and open',
    avoid: 'Knees rolling in; dropping past a comfortable depth',
    cue: 'Feet wide, toes turned out. One dumbbell between your legs. Sit straight down, push the knees OUT.',
    why: 'The wide stance loads the glutes and inner thigh with far less bend at the knee.',
    knee: 'Wide and shallow. Driving the knees out is the whole point — it’s what stops them caving.',
    yt: 'dumbbell sumo squat form',
    repTempo: ECCENTRIC,
    breathe: true,
  },
  'reverse-lunge': {
    name: 'Supported Reverse Lunge',
    feel: 'Front-leg glute carrying it, balance taken care of',
    avoid:
      'Stepping forward; dropping the back knee hard; front knee sliding past the toes',
    cue: 'One hand on the chair. Step BACK, lower under control, drive through the front heel.',
    why: 'One leg at a time — the strong side can’t cover for the weak one.',
    knee: 'The hand on the chair is not optional: it takes the wobble off the knee. Step back, never forward.',
    yt: 'supported reverse lunge form',
    repTempo: ECCENTRIC_SHORT,
    breathe: true,
  },
  'calf-raise': {
    name: 'Standing Calf Raise',
    feel: 'A hard squeeze at the very top',
    avoid: 'Bouncing at the bottom',
    cue: 'Up onto the toes as high as you can, hold, lower all the way down.',
    why: 'Strong calves absorb load the knee would otherwise take — and they shape the lower leg.',
    knee: 'Knee-friendly and knee-protective. Calves are the shock absorber above the ankle.',
    yt: 'standing calf raise form',
    repTempo: SQUEEZE,
  },

  // — knee strength —
  'wall-sit': {
    name: 'Wall Sit',
    feel: 'Quads burning, everything else still',
    avoid: 'Sliding below a right angle at the knee',
    cue: 'Back flat on the wall, feet forward, slide down to about a chair height. Hold and breathe.',
    why: 'A held position builds the quad without a single rep of grinding through range.',
    knee: 'Thighs no lower than parallel. If it’s sharp, slide UP a few inches — higher is still working.',
    yt: 'wall sit form',
  },
  'sit-to-stand': {
    name: 'Controlled Sit-to-Stand',
    feel: 'Quads and glutes doing the standing, slowly',
    avoid: 'Dropping onto the chair; rocking forward to launch up',
    cue: 'Chair behind you. Lower slowly until you touch, stand back up without a bounce.',
    why: 'The most useful strength there is — and the chair caps the depth for you.',
    knee: 'The safest loaded knee bend in the plan: the chair stops you exactly where the knee likes it.',
    yt: 'sit to stand exercise form',
    repTempo: ECCENTRIC_SHORT,
  },
  'hip-abduction': {
    name: 'Standing Hip Abduction',
    feel: 'The side of the standing hip AND the side of the lifting hip',
    avoid: 'Leaning away to get the leg higher; swinging it',
    cue: 'Hand on the chair, stand tall. Lift one leg straight out to the side, hold, lower slowly.',
    why: 'Glute medius — the muscle that stops the knee caving inward under load.',
    knee: 'Zero bend at the knee, and the single biggest thing you can do for it. Never skip this one.',
    yt: 'standing hip abduction form',
    repTempo: ABDUCT,
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
  'squeeze-press': {
    name: 'Standing Squeeze Press',
    feel: 'The middle of the chest, hard, the whole set',
    avoid: 'Letting the dumbbells drift apart',
    cue: 'Two dumbbells pressed together at your chest. Crush them together and press straight out.',
    why: 'A chest press with no bench: the squeeze is what makes 10 lb feel like far more.',
    yt: 'standing squeeze press form',
    repTempo: SQUEEZE,
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

  // — standing core + carries —
  'farmer-carry': {
    name: 'Farmer Carry',
    feel: 'Grip, shoulders and the whole core holding you tall',
    avoid: 'Leaning back; shoulders creeping up',
    cue: 'A dumbbell in each hand, stand tall, walk. Breathe normally.',
    why: 'Total-body bracing — and the most directly useful strength there is.',
    knee: 'Walking with weight is fine. Short strides, quiet feet.',
    yt: 'farmer carry form',
  },
  'suitcase-hold': {
    name: 'Suitcase Hold',
    feel: 'The side of your waist fighting the tilt',
    avoid: 'Letting the weight pull you sideways',
    cue: 'One dumbbell in one hand, hanging. Stand dead straight and refuse to lean. Hold.',
    why: 'Trains the waist standing up — the postpartum-safe way to load the core.',
    yt: 'suitcase hold form',
  },
  'knee-to-elbow': {
    name: 'Standing Knee-to-Elbow',
    feel: 'The front of the abs crunching, standing up',
    avoid: 'Only moving the knee — the ribs come down to meet it',
    cue: 'Lift one knee and bring the SAME-side elbow down to meet it. Squeeze. Alternate.',
    why: 'A crunch with no floor and no neck strain — and it counts as movement, not a chore.',
    knee: 'Nothing loads the knee here. It’s a hip and ab move.',
    yt: 'standing knee to elbow crunch',
    repTempo: SQUEEZE_FAST,
  },
  'knee-drive': {
    name: 'Cross-Body Knee Drive',
    feel: 'The side of the waist, on a diagonal',
    avoid: 'Rushing it — this is a squeeze, not a march',
    cue: 'Drive one knee up and across toward the OPPOSITE elbow. Squeeze, lower, alternate.',
    why: 'The obliques on a diagonal — the athletic waist the plan is asking for.',
    knee: 'The lifted knee is unloaded; the standing leg stays tall. Both fine.',
    yt: 'cross body knee drive exercise',
    repTempo: SQUEEZE_FAST,
  },
};

// ─── Season ──────────────────────────────────────────────────────────────────
// 100 DAYS OF SHOWING UP. The deadline is the motivation mechanic: a countdown
// to a fixed day pushes without punishing a missed one, which is why HOTMUM
// has no streaks anywhere (PLAN.md §2.0).
//
// It used to count down to Christmas. Her rewritten plan counts 100 days
// instead, and the two never lined up — 20 Aug to Christmas is 128 days, so a
// "100 days" that was really 128 had a lie in it. The hundred won and the
// Christmas framing is GONE, not demoted: day 100 is Friday 27 Nov and that's
// the whole story. Don't reintroduce a second deadline — one finish line is
// the entire reason this mechanic works.

export const SEASON = {
  id: 'hundred-days',
  label: 'SEASON 01',
  name: '100 Days of Showing Up',
  startDate: '2026-08-20',
  endDate: '2026-11-27', // day 100 — derived, and a test proves it
  days: 100,
  // Five blocks of twenty days. Load moves LAST: with fixed dumbbells it's the
  // bluntest lever she has, so tempo and reps get used up first.
  //
  // These deltas are APPLIED, not decorative — `progress()` below rewrites the
  // session for the day she's on. The first version of this shipped as copy
  // only: the app promised "same tempo, more reps" on day 21 and then handed
  // her the identical session. A test now walks every block and checks the
  // work actually changed.
  blocks: [
    {
      days: [1, 20],
      name: 'GROOVE',
      blurb: 'The plan as written. Learn the tempos and the depth limits.',
    },
    {
      days: [21, 40],
      name: 'EXTEND',
      blurb: 'Same tempo, two more reps a set, less standing about.',
      addReps: 2,
      lessRest: 10,
    },
    {
      days: [41, 60],
      name: 'SLOW',
      blurb: 'One extra second on every lower. Reps come back down.',
      addEccentric: 1,
      addReps: -1,
    },
    {
      days: [61, 80],
      name: 'LOAD',
      blurb: '15 → 20 lb on the hinges and squats. Reps drop to eight.',
      addReps: -2,
      loadUp: ['rdl', 'sl-rdl', 'goblet-squat', 'sumo-squat'],
    },
    {
      days: [81, 100],
      name: 'PEAK',
      blurb: 'Best tempo, best load, one more set on the opener.',
      addReps: -2,
      addEccentric: 1,
      addSets: 1,
      lessRest: 10,
      loadUp: ['rdl', 'sl-rdl', 'goblet-squat', 'sumo-squat'],
    },
  ],
};

const DAY_MS = 86400000;
// Local midnight either way, so a countdown doesn't tick down mid-afternoon.
const asDate = (d) =>
  d instanceof Date
    ? new Date(d.getFullYear(), d.getMonth(), d.getDate())
    : new Date(`${d}T00:00:00`);

/** Whole days from `today` to the end of the 100. Never negative. */
export const daysToGo = (today = new Date()) =>
  Math.max(0, Math.ceil((asDate(SEASON.endDate) - asDate(today)) / DAY_MS));

/** Which of the 100 days it is, 1-based and clamped to both ends. */
export function dayNumber(today = new Date()) {
  const elapsed = Math.floor(
    (asDate(today) - asDate(SEASON.startDate)) / DAY_MS,
  );
  return Math.min(SEASON.days, Math.max(1, elapsed + 1));
}

/** The twenty-day block a given season day falls in. */
export const blockForDay = (day) =>
  SEASON.blocks.find((b) => day >= b.days[0] && day <= b.days[1]) ||
  SEASON.blocks[SEASON.blocks.length - 1];

// ─── The week ────────────────────────────────────────────────────────────────
// Three sessions, four walks — something every day. That's her 100-day rule
// verbatim: every day is thirty minutes of movement, and the walks are what
// make HOTMUM a daily open instead of a thrice-weekly one.
//
// NOT A SCHEDULE. Sam picks what she does each day in the app; WEEK is the
// recommended RHYTHM her plan is written around — Monday, Wednesday, Friday
// lifting with walks between, never two sessions back to back — and it's what
// the doses and the recovery assumptions are built on.

export const WEEKLY_TARGET = { sessions: 3, walks: 4 };

export const WEEK = [
  { day: 'MON', kind: 'session', id: 'lower' },
  { day: 'TUE', kind: 'walk' },
  { day: 'WED', kind: 'session', id: 'upper' },
  { day: 'THU', kind: 'walk' },
  { day: 'FRI', kind: 'session', id: 'full' },
  { day: 'SAT', kind: 'walk' },
  { day: 'SUN', kind: 'walk', move: 'easy-walk' },
];

// ─── The other thirty minutes ────────────────────────────────────────────────
// "Another movement" — what she taps when it's a lifting day and she isn't at
// home, or her knee has told her no. Every one of these counts as showing up:
// the 100 days are 100 days of MOVEMENT, not 100 days of dumbbells, and an
// app that only recognises its own sessions quietly teaches her that a day at
// her mum's was a failure.
//
// Deliberately no GPS, no map, no step count (PLAN.md §2.6). A countdown and
// a "log it" tap is the whole feature.

export const MOVEMENTS = [
  {
    id: 'walk',
    name: 'Walk',
    mins: 30,
    blurb:
      'Outside, the treadmill, or laps at the mall — it all counts. Stroller included.',
  },
  {
    id: 'easy-walk',
    name: 'Easy Walk',
    mins: 30,
    blurb: 'Sunday pace. Recovery, not a workout. Nothing to push.',
  },
  {
    id: 'yoga',
    name: 'Yoga',
    mins: 30,
    blurb: 'Any class, any app, any mat. Kind to a sore knee.',
  },
  {
    id: 'pilates',
    name: 'Pilates',
    mins: 30,
    blurb:
      'Mat or reformer. Core and control — it counts as a session’s worth.',
  },
  {
    id: 'stretch',
    name: 'Stretch & Mobility',
    mins: 15,
    blurb:
      'Fifteen minutes of unwinding. The lowest bar there is, and it still counts.',
  },
  {
    id: 'other',
    name: 'Something Else',
    mins: 30,
    blurb:
      'Swimming, dancing, cleaning the whole house. You moved for half an hour.',
  },
];

export const getMovement = (id) =>
  MOVEMENTS.find((m) => m.id === id) || MOVEMENTS[0];

/** The default walk, kept as its own export because the walk day is special. */
export const WALK = MOVEMENTS[0];

// ─── Doses ───────────────────────────────────────────────────────────────────
// Same program, three exits. She never has to choose between all of it and
// nothing — the failure mode that actually kills consistency (PLAN.md §2.7).
//
// MINI replaced the old CORE-only cut. Under the 30-minute rewrite the core
// block is two minutes long, which is not a session anyone opens an app for.
// The knee work plus the standing core is eight minutes and is, on a bad day,
// the single most useful thing she could do — so that's what the small door
// opens onto.

export const DOSES = {
  full: { label: 'FULL', includes: ['warmup', 'main', 'finisher', 'core'] },
  short: { label: 'SHORT', includes: ['warmup', 'main'] },
  mini: { label: 'MINI', includes: ['finisher', 'core'] },
};

// ─── Warm-ups ────────────────────────────────────────────────────────────────
// Two of them now: the lower days warm the hips, knees and ankles; the upper
// day warms shoulders and the mid-back. Her plan writes them out separately
// and she's right — arm circles do nothing for a squat.

const WARMUP_LOWER = [
  {
    ex: 'bw-squat',
    mode: 'tempo',
    dose: 'warmup',
    sets: 1,
    reps: 12,
    tempo: WARM,
  },
  {
    ex: 'standing-hinge',
    mode: 'tempo',
    dose: 'warmup',
    sets: 1,
    reps: 12,
    tempo: WARM,
  },
  {
    ex: 'knee-lift',
    mode: 'tempo',
    dose: 'warmup',
    sets: 1,
    reps: 20,
    tempo: WARM_KNEE,
  },
  { ex: 'hip-circles', mode: 'hold', dose: 'warmup', sets: 1, holdSecs: 30 },
  {
    ex: 'calf-raise',
    mode: 'tempo',
    dose: 'warmup',
    sets: 1,
    reps: 12,
    tempo: WARM_CALF,
  },
];

const WARMUP_UPPER = [
  { ex: 'arm-circles', mode: 'hold', dose: 'warmup', sets: 1, holdSecs: 40 },
  { ex: 'shoulder-rolls', mode: 'hold', dose: 'warmup', sets: 1, holdSecs: 30 },
  { ex: 'torso-rotation', mode: 'hold', dose: 'warmup', sets: 1, holdSecs: 30 },
  {
    ex: 'good-morning',
    mode: 'tempo',
    dose: 'warmup',
    sets: 1,
    reps: 12,
    tempo: WARM,
  },
];

// ─── Standing core (closes every session) ────────────────────────────────────

const CORE = [
  {
    ex: 'knee-to-elbow',
    mode: 'tempo',
    dose: 'core',
    sets: 1,
    reps: 20,
    tempo: SQUEEZE_FAST,
    restSecs: 30,
    load: 'BW',
  },
  {
    ex: 'suitcase-hold',
    mode: 'hold',
    dose: 'core',
    sets: 1,
    holdSecs: 30,
    perSide: true,
    switchSecs: 8,
    load: { lb: 20 },
  },
];

// ─── Sessions ────────────────────────────────────────────────────────────────
// MON / WED / FRI, exactly as she wrote them, with the knee doctrine applied
// to the movement selection (see the header). `stages` names what the app
// offers next when the main work is done — "Add the knee work?" on a lower
// day, "Add the carries?" on the upper one.

export const HOTMUM_SESSIONS = [
  {
    id: 'lower',
    name: 'Lower Body',
    sub: 'Lower + Knee',
    day: 'MON',
    blurb:
      'Single-leg first, then the squats — and the knee work that keeps it going.',
    stages: { finisher: 'KNEE STRENGTH', core: 'STANDING CORE' },
    blocks: [
      ...WARMUP_LOWER,
      // UNILATERAL LEADS (§2.9 rule 3). The single-leg hinge opens the day:
      // it's the priority, it loads one leg hard, and it barely bends a knee.
      {
        ex: 'sl-rdl',
        mode: 'tempo',
        dose: 'main',
        sets: 3,
        reps: 6,
        tempo: ECCENTRIC,
        perSide: true,
        switchSecs: 10,
        restSecs: 40,
        load: { lb: 15 },
      },
      {
        ex: 'reverse-lunge',
        mode: 'tempo',
        dose: 'main',
        sets: 2,
        reps: 6,
        tempo: ECCENTRIC_SHORT,
        perSide: true,
        switchSecs: 10,
        restSecs: 45,
        load: { lb: 15, each: true },
        kneeSwap: { ex: 'hip-abduction', tempo: ABDUCT, load: 'BW' },
      },
      // The bilateral anchor. Two legs still move the most total load, and
      // cutting them entirely would cost her the strength the plan is for.
      {
        ex: 'goblet-squat',
        mode: 'tempo',
        dose: 'main',
        sets: 3,
        reps: 8,
        tempo: ECCENTRIC,
        restSecs: 40,
        load: { lb: 15 },
        kneeSwap: { ex: 'sit-to-stand', tempo: ECCENTRIC_SHORT, load: 'BW' },
      },
      {
        ex: 'sumo-squat',
        mode: 'tempo',
        dose: 'main',
        sets: 2,
        reps: 8,
        tempo: ECCENTRIC,
        restSecs: 40,
        load: { lb: 20 },
        kneeSwap: { ex: 'sl-rdl', tempo: ECCENTRIC, load: { lb: 15 } },
      },
      {
        ex: 'sl-calf-raise',
        mode: 'tempo',
        dose: 'main',
        sets: 2,
        reps: 8,
        tempo: SQUEEZE,
        perSide: true,
        switchSecs: 8,
        restSecs: 40,
        load: 'BW',
      },
      // — knee strength: her 23:00–28:00 block —
      {
        ex: 'wall-sit',
        mode: 'hold',
        dose: 'finisher',
        phase: 'HOLD',
        sets: 2,
        holdSecs: 30,
        restSecs: 30,
        load: 'BW',
      },
      {
        ex: 'sit-to-stand',
        mode: 'tempo',
        dose: 'finisher',
        sets: 2,
        reps: 8,
        tempo: ECCENTRIC_SHORT,
        restSecs: 30,
        load: 'BW',
      },
      {
        ex: 'hip-abduction',
        mode: 'tempo',
        dose: 'finisher',
        sets: 2,
        reps: 6,
        tempo: ABDUCT,
        perSide: true,
        switchSecs: 8,
        restSecs: 30,
        load: 'BW',
      },
      ...CORE,
    ],
  },

  {
    id: 'upper',
    name: 'Upper Body',
    sub: 'Upper + Core',
    day: 'WED',
    blurb: 'Press, row, press — then arms, a carry, and the standing core.',
    stages: { finisher: 'ARMS + CARRY', core: 'STANDING CORE' },
    blocks: [
      ...WARMUP_UPPER,
      {
        ex: 'shoulder-press',
        mode: 'tempo',
        dose: 'main',
        sets: 3,
        reps: 8,
        tempo: PRESS,
        restSecs: 45,
        load: { lb: 15, each: true },
      },
      {
        ex: 'one-arm-row',
        mode: 'tempo',
        dose: 'main',
        sets: 2,
        reps: 8,
        tempo: PULL,
        perSide: true,
        switchSecs: 10,
        restSecs: 45,
        load: { lb: 15 },
      },
      {
        ex: 'squeeze-press',
        mode: 'tempo',
        dose: 'main',
        sets: 2,
        reps: 10,
        tempo: SQUEEZE,
        restSecs: 45,
        load: { lb: 10, each: true },
      },
      {
        ex: 'lateral-raise',
        mode: 'tempo',
        dose: 'main',
        sets: 2,
        reps: 10,
        tempo: HANG,
        restSecs: 40,
        load: { lb: 10, each: true },
      },
      {
        ex: 'rear-delt-fly',
        mode: 'tempo',
        dose: 'main',
        sets: 2,
        reps: 10,
        tempo: HANG,
        restSecs: 40,
        load: { lb: 10, each: true },
      },
      // — arms + the athletic carry: her 25:00–30:00 block, plus the arms
      //   she wrote into the main list. Arms move here because SHORT has to
      //   stay a real escape hatch, and a curl is the most droppable thing
      //   in the session.
      {
        ex: 'bicep-curl',
        mode: 'tempo',
        dose: 'finisher',
        sets: 2,
        reps: 10,
        tempo: PULL,
        restSecs: 40,
        load: { lb: 10, each: true },
      },
      {
        ex: 'tricep-ext',
        mode: 'tempo',
        dose: 'finisher',
        sets: 2,
        reps: 10,
        tempo: EXTEND,
        restSecs: 40,
        load: { lb: 15 },
      },
      {
        ex: 'farmer-carry',
        mode: 'hold',
        dose: 'finisher',
        phase: 'CARRY',
        sets: 2,
        holdSecs: 40,
        restSecs: 45,
        load: { lb: 20, each: true },
      },
      {
        ex: 'knee-drive',
        mode: 'tempo',
        dose: 'finisher',
        sets: 2,
        reps: 16,
        tempo: SQUEEZE_FAST,
        restSecs: 30,
        load: 'BW',
      },
      ...CORE,
    ],
  },

  {
    id: 'full',
    name: 'Full Body',
    sub: 'Full Body + Knee',
    day: 'FRI',
    blurb:
      'One of everything, then the knee finisher. The week’s hardest thirty.',
    stages: { finisher: 'KNEE FINISHER', core: 'STANDING CORE' },
    blocks: [
      {
        ex: 'bw-squat',
        mode: 'tempo',
        dose: 'warmup',
        sets: 1,
        reps: 12,
        tempo: WARM,
      },
      {
        ex: 'standing-hinge',
        mode: 'tempo',
        dose: 'warmup',
        sets: 1,
        reps: 12,
        tempo: WARM,
      },
      {
        ex: 'arm-circles',
        mode: 'hold',
        dose: 'warmup',
        sets: 1,
        holdSecs: 30,
      },
      {
        ex: 'knee-lift',
        mode: 'tempo',
        dose: 'warmup',
        sets: 1,
        reps: 20,
        tempo: WARM_KNEE,
      },
      {
        ex: 'calf-raise',
        mode: 'tempo',
        dose: 'warmup',
        sets: 1,
        reps: 12,
        tempo: WARM_CALF,
      },
      {
        ex: 'rdl',
        mode: 'tempo',
        dose: 'main',
        sets: 3,
        reps: 8,
        tempo: ECCENTRIC,
        restSecs: 45,
        load: { lb: 15, each: true },
      },
      // Straight after the hinge, while balance is still good (§2.9 rule 3).
      {
        ex: 'reverse-lunge',
        mode: 'tempo',
        dose: 'main',
        sets: 2,
        reps: 6,
        tempo: ECCENTRIC_SHORT,
        perSide: true,
        switchSecs: 10,
        restSecs: 45,
        load: { lb: 15, each: true },
        kneeSwap: { ex: 'hip-abduction', tempo: ABDUCT, load: 'BW' },
      },
      {
        ex: 'goblet-squat',
        mode: 'tempo',
        dose: 'main',
        sets: 2,
        reps: 8,
        tempo: ECCENTRIC,
        restSecs: 45,
        load: { lb: 15 },
        kneeSwap: { ex: 'sit-to-stand', tempo: ECCENTRIC_SHORT, load: 'BW' },
      },
      {
        ex: 'one-arm-row',
        mode: 'tempo',
        dose: 'main',
        sets: 2,
        reps: 8,
        tempo: PULL,
        perSide: true,
        switchSecs: 10,
        restSecs: 45,
        load: { lb: 15 },
      },
      {
        ex: 'squeeze-press',
        mode: 'tempo',
        dose: 'main',
        sets: 2,
        reps: 8,
        tempo: SQUEEZE,
        restSecs: 45,
        load: { lb: 10, each: true },
      },

      {
        ex: 'shoulder-press',
        mode: 'tempo',
        dose: 'main',
        sets: 2,
        reps: 8,
        tempo: PRESS,
        restSecs: 45,
        load: { lb: 15, each: true },
      },
      // — knee finisher: her 23:00–28:00 block, calf-led —
      {
        ex: 'calf-raise',
        mode: 'tempo',
        dose: 'finisher',
        sets: 2,
        reps: 12,
        tempo: SQUEEZE,
        restSecs: 40,
        load: 'BW',
      },
      {
        ex: 'wall-sit',
        mode: 'hold',
        dose: 'finisher',
        phase: 'HOLD',
        sets: 2,
        holdSecs: 30,
        restSecs: 30,
        load: 'BW',
      },
      {
        ex: 'sit-to-stand',
        mode: 'tempo',
        dose: 'finisher',
        sets: 2,
        reps: 8,
        tempo: ECCENTRIC_SHORT,
        restSecs: 30,
        load: 'BW',
      },
      ...CORE,
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

// ─── Progression — the blocks actually do something ──────────────────────────
// Rewrites a session for the day she's on. Only `main` work progresses: the
// warm-up is a warm-up whatever week it is, and the knee block is deliberately
// FROZEN — a knee-strength dose that creeps upward every twenty days is how a
// knee protocol turns back into a knee problem.

const withEccentric = (tempo, add) =>
  tempo.map(([label, secs]) => [label, label === 'DOWN' ? secs + add : secs]);

function progressBlock(block, delta, isOpener) {
  if (block.dose !== 'main') return block;
  const out = { ...block };
  if (delta.addReps && out.reps)
    out.reps = Math.max(5, out.reps + delta.addReps);
  if (delta.addEccentric && out.tempo)
    out.tempo = withEccentric(out.tempo, delta.addEccentric);
  if (delta.addSets && isOpener) out.sets = (out.sets || 1) + delta.addSets;
  if (delta.lessRest && out.restSecs)
    out.restSecs = Math.max(30, out.restSecs - delta.lessRest);
  // Only the fixed 20 lb step exists, and only where the jump is survivable.
  if (delta.loadUp?.includes(out.ex) && out.load?.lb === 15)
    out.load = { ...out.load, lb: 20 };
  return out;
}

/** The session as it should be run on a given day of the 100. */
export function progress(session, day = dayNumber()) {
  const delta = blockForDay(day);
  const openerIdx = session.blocks.findIndex((b) => b.dose === 'main');
  return {
    ...session,
    block: delta.name,
    blocks: session.blocks.map((b, i) =>
      progressBlock(b, delta, i === openerIdx),
    ),
  };
}

// ─── Easy knee ───────────────────────────────────────────────────────────────
// Her own KNEE RULE, made into a switch: "reduce intensity if your knee is
// irritated". Every knee-dominant main block carries a `kneeSwap` to a
// hip-dominant or depth-capped alternative, so a bad-knee day is still a
// session and not a skipped one.
//
// Note what does NOT change: the wall sit and the sit-to-stand stay. Holds at
// a tolerable angle are what settles an irritated knee down — they're the
// medicine in this session, not the risk.

export const hasKneeSwap = (session) => session.blocks.some((b) => b.kneeSwap);

export function kneeEasy(session) {
  return {
    ...session,
    easyKnee: true,
    blocks: session.blocks.map((b) =>
      b.kneeSwap ? { ...b, ...b.kneeSwap, swappedFrom: b.ex } : b,
    ),
  };
}

/** Everything the app has to do to a session before it plays. */
export function sessionForToday(session, { day, easyKnee = false } = {}) {
  if (!session) return null;
  const p = progress(session, day ?? dayNumber());
  return easyKnee ? kneeEasy(p) : p;
}

// ─── Length maths ────────────────────────────────────────────────────────────

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
