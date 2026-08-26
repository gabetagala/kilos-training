// HOTMUM — Season 01 :: 100 Days of Showing Up.
// Pure data + pure helpers. No DOM, no storage, no network.
// Unit-tested in tests/unit/hotmum.test.js.
//
// THE ONE RULE (hotmum/PLAN.md §2.1): a set is WORK AND REST, with a rep
// target inside it. "Six reps. Thirty seconds." The clock runs, she paces
// herself, and when it ends it ends. Nothing calls the beat.
//
// WHY TIME AND NOT LOAD: she owns fixed 10/15/20 lb dumbbells, so 15 → 20 lb
// is a 33% jump — far too big to be the next step on a split squat. Time under
// tension is the only fine-grained progression lever available, which is why
// the season progresses pace → reps → sets → load, load LAST (§2.0.1).
//
// ─── THE KNEE DOCTRINE (§2.9) — read before changing any lower-body block ───
//
// Sam's knees are the binding constraint on this program. The instinct is
// "more single-leg work", and that is only half right: a deep lunge or a
// tall step-up puts MORE stress through one kneecap than a shallow squat
// spreads across two. What actually protects a cranky knee, in order:
//
//   1. CAP THE DEPTH, KEEP THE PACE. Load through a knee climbs steeply past
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
// PHASE is the word the player prints while she's working, and it has to
// match what the body is actually doing. It's declared on every block, never
// inherited: the engine defaults an unset one to 'HOLD', which is right for a
// wall sit and wrong for arm circles — four mobility drills sat there telling
// her to HOLD a movement whose whole point is that it keeps moving.
//   WORK   — reps against a clock
//   HOLD   — isometric: the wall sit, the suitcase hold
//   CARRY  — the farmer carry
//   LOOSEN — warm-up mobility that never stops moving
export const PHASES = ['WORK', 'HOLD', 'CARRY', 'LOOSEN'];

// Blocks match the engine schema in src/workout/rehab.js. Everything here is
// `hold` — one timed interval per set — because that is now what a set IS: a
// stretch of work with a rep target in it. HOTMUM's own additions on top:
//   reps + secsPerRep — the target and the pace; holdSecs is their product
//   part             — which section of the session the block belongs to
//   load, kneeSwap   — the weight, and the easy-knee alternative

// ─── How long a rep takes ────────────────────────────────────────────────────
// THE PACING IS A DOSE, NOT A DRILL (rewritten 2026-08-22). This used to be a
// per-rep beat pattern — `[['DOWN',3],['HOLD',1],['UP',1]]` — that the app
// called out phase by phase while the canvas pulsed along with it.
//
// That went in stages: the coach stopped saying the phase, then stopped
// counting, then the screen stopped counting. What was left was an app still
// computing a beat nobody was being guided through — a metronome playing to an
// empty room. So the pattern collapses to the only number that ever mattered:
// SECONDS PER REP.
//
// A block now reads "6 reps in 30 seconds". She's told both, the clock runs,
// and she paces herself. Time under tension survives intact — it's still the
// progression lever (§2.0.1), because with fixed 10/15/20 lb dumbbells it's
// the only fine-grained one there is. What's gone is the pretence of coaching
// every rep.

const SLOW = 5; // hinges, squats, rows, raises — the eccentric-led work
const STEADY = 4; // supported lunges, presses, the knee block
const QUICK = 3; // standing core, warm-up reps

// ─── Exercises ───────────────────────────────────────────────────────────────
// `feel` / `avoid` / `cue` / `why` follow the KILOS convention (src/workout/
// rehab.js) — they're what the player shows under the illustration and what
// the movement card reads. `breathe: true` marks the loaded moves where the
// exhale cue fires on the effort: a slow set holds intra-abdominal pressure
// longer than fast reps do, which matters more postpartum (§2.8).
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
  },
  'goblet-squat': {
    name: 'Goblet Squat',
    feel: 'Quads and glutes, chest staying tall',
    avoid: 'Going below the chair; heels lifting; knees falling inward',
    cue: 'Chair behind you. Dumbbell at your chest, sit down until you brush it, stand up.',
    why: 'The dumbbell held high keeps the torso upright — a squat your back likes.',
    knee: 'The chair IS the depth limit. Touch it, don’t sit on it, never go past it.',
    yt: 'goblet squat to box form',
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
  },
  'hip-abduction': {
    name: 'Standing Hip Abduction',
    feel: 'The side of the standing hip AND the side of the lifting hip',
    avoid: 'Leaning away to get the leg higher; swinging it',
    cue: 'Hand on the chair, stand tall. Lift one leg straight out to the side, hold, lower slowly.',
    why: 'Glute medius — the muscle that stops the knee caving inward under load.',
    knee: 'Zero bend at the knee, and the single biggest thing you can do for it. Never skip this one.',
    yt: 'standing hip abduction form',
  },

  // — upper —
  'shoulder-press': {
    name: 'Shoulder Press',
    feel: 'Shoulders pressing, ribs staying down',
    avoid: 'Arching the low back to get the weight up',
    cue: 'Dumbbells at shoulder height. Press up, lower SLOWLY back to the start.',
    why: 'Builds the round shoulder line that makes the waist look smaller.',
    yt: 'dumbbell shoulder press form',
    breathe: true,
  },
  'one-arm-row': {
    name: 'One-Arm Row',
    feel: 'The back pulling, not the arm',
    avoid: 'Twisting the torso to yank it up',
    cue: 'Hand and knee on the couch. Pull the dumbbell to your hip, squeeze, lower slowly.',
    why: 'Upper back — the posture muscles that carrying a baby all day steals.',
    yt: 'one arm dumbbell row form',
    breathe: true,
  },
  'squeeze-press': {
    name: 'Standing Squeeze Press',
    feel: 'The middle of the chest, hard, the whole set',
    avoid: 'Letting the dumbbells drift apart',
    cue: 'Two dumbbells pressed together at your chest. Crush them together and press straight out.',
    why: 'A chest press with no bench: the squeeze is what makes 10 lb feel like far more.',
    yt: 'standing squeeze press form',
    breathe: true,
  },
  'lateral-raise': {
    name: 'Lateral Raise',
    feel: 'Side of the shoulder burning by rep eight',
    avoid: 'Swinging; shrugging the traps up',
    cue: 'Soft elbows, lift out to shoulder height, hold, lower on a three-count.',
    why: 'Shoulder width is the fastest visual change in the whole plan.',
    yt: 'dumbbell lateral raise form',
  },
  'rear-delt-fly': {
    name: 'Rear Delt Fly',
    feel: 'Back of the shoulders and between the blades',
    avoid: 'Turning it into a row',
    cue: 'Hinge forward, soft elbows, open out wide like a wingspan. Slow back.',
    why: 'The rear shoulder — what actually pulls the posture upright.',
    yt: 'rear delt fly form',
  },
  'bicep-curl': {
    name: 'Bicep Curl',
    feel: 'Biceps, elbows pinned to your sides',
    avoid: 'Rocking back to swing it up',
    cue: 'Curl up, squeeze at the top, lower on a three-count.',
    why: 'Arms. No further justification needed.',
    yt: 'dumbbell bicep curl form',
  },
  'tricep-ext': {
    name: 'Overhead Tricep Extension',
    feel: 'A stretch down the back of the arm',
    avoid: 'Elbows flaring wide; ribs flaring up',
    cue: 'One dumbbell in both hands, overhead. Lower slowly behind the head, press up.',
    why: 'The back of the arm is two-thirds of its size — this is the toning move.',
    yt: 'overhead tricep extension form',
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
  },
  'knee-drive': {
    name: 'Cross-Body Knee Drive',
    feel: 'The side of the waist, on a diagonal',
    avoid: 'Rushing it — this is a squeeze, not a march',
    cue: 'Drive one knee up and across toward the OPPOSITE elbow. Squeeze, lower, alternate.',
    why: 'The obliques on a diagonal — the athletic waist the plan is asking for.',
    knee: 'The lifted knee is unloaded; the standing leg stays tall. Both fine.',
    yt: 'cross body knee drive exercise',
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
// Christmas framing is GONE, not demoted: day 100 is the whole story. Don't
// reintroduce a second deadline — one finish line is the entire reason this
// mechanic works. (The dates live in SEASON below; don't restate them here,
// which is how this comment came to name the wrong day.)

export const SEASON = {
  id: 'hundred-days',
  label: 'SEASON 01',
  name: '100 Days of Showing Up',
  // Monday 24 Aug — her plan is written Monday-to-Sunday, so day 1 is a
  // Monday and every twenty-day block starts on one. Day 100 is Tue 1 Dec.
  startDate: '2026-08-24',
  endDate: '2026-12-01', // day 100 — derived, and a test proves it
  days: 100,
  // Five blocks of twenty days. Load moves LAST: with fixed dumbbells it's the
  // bluntest lever she has, so pace and reps get used up first.
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
      blurb: 'The plan as written. Learn the pace and the depth limits.',
    },
    {
      days: [21, 40],
      name: 'EXTEND',
      blurb: 'Same pace, two more reps a set, less standing about.',
      addReps: 2,
      lessRest: 10,
    },
    {
      days: [41, 60],
      name: 'SLOW',
      blurb: 'One second longer on every rep. Reps come back down.',
      addSecsPerRep: 1,
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
      blurb: 'Best pace, best load, one more set on the opener.',
      addReps: -2,
      addSecsPerRep: 1,
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

/**
 * Days left of the hundred. Derived from the day number rather than measured
 * to the end date, so the two can never disagree — before day 1 the raw
 * distance to 1 Dec is 101, which would have read "DAY 1 OF 100 · 101 LEFT".
 */
export const daysToGo = (today = new Date()) => SEASON.days - dayNumber(today);

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
// NOT A SCHEDULE, AND NOT A SCOREBOARD. Sam picks what she does each day in
// the app; WEEK is the recommended RHYTHM her plan is written around — Monday,
// Wednesday, Friday lifting with walks between, never two sessions back to
// back. The app used to render it as a weekly target ("SESSIONS 2/3, WALKS
// 1/4"), which is a streak wearing a different hat: it turns a rearranged week
// into a visible deficit. The hundred days already do the motivating.

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

// ─── The parts of a session ──────────────────────────────────────────────────
// A session runs WHOLE. There used to be three cuts of it — FULL / SHORT /
// MINI — with the app offering to extend after the main work, because the
// first draft measured 41–46 minutes and asking a mother to commit to that at
// minute zero was the wrong question (old §2.7).
//
// Her rewrite fixed that at the source: a session is thirty minutes now, and
// SHORT only saved about eight of them. A choice that small isn't a mercy,
// it's a decision to make before she's allowed to start — so it's gone, and
// GO just starts the session.
//
// `part` survives as the STRUCTURE of a session, which is still load-bearing:
// progression only ever touches `main` (§2.0.1), and the sheet labels each
// run of blocks with the session's own name for it.

export const PARTS = ['warmup', 'main', 'finisher', 'core'];

// ─── Warm-ups ────────────────────────────────────────────────────────────────
// Two of them now: the lower days warm the hips, knees and ankles; the upper
// day warms shoulders and the mid-back. Her plan writes them out separately
// and she's right — arm circles do nothing for a squat.

// Sized to her clock rather than to a guess: 0:00–5:00 on the lower days,
// 0:00–4:00 on the upper one. The first build came in a minute under both.
const WARMUP_LOWER = [
  {
    ex: 'bw-squat',
    mode: 'hold',
    part: 'warmup',
    sets: 1,
    reps: 16,
    secsPerRep: QUICK,
    holdSecs: 48,
    phase: 'WORK',
  },
  {
    ex: 'standing-hinge',
    mode: 'hold',
    part: 'warmup',
    sets: 1,
    reps: 16,
    secsPerRep: QUICK,
    holdSecs: 48,
    phase: 'WORK',
  },
  {
    ex: 'knee-lift',
    mode: 'hold',
    part: 'warmup',
    sets: 1,
    reps: 20,
    secsPerRep: QUICK,
    holdSecs: 60,
    phase: 'WORK',
  },
  {
    ex: 'hip-circles',
    mode: 'hold',
    part: 'warmup',
    sets: 1,
    holdSecs: 45,
    phase: 'LOOSEN',
  },
  {
    ex: 'calf-raise',
    mode: 'hold',
    part: 'warmup',
    sets: 1,
    reps: 16,
    secsPerRep: QUICK,
    holdSecs: 48,
    phase: 'WORK',
  },
];

const WARMUP_UPPER = [
  {
    ex: 'arm-circles',
    mode: 'hold',
    part: 'warmup',
    sets: 1,
    holdSecs: 50,
    phase: 'LOOSEN',
  },
  {
    ex: 'shoulder-rolls',
    mode: 'hold',
    part: 'warmup',
    sets: 1,
    holdSecs: 45,
    phase: 'LOOSEN',
  },
  {
    ex: 'torso-rotation',
    mode: 'hold',
    part: 'warmup',
    sets: 1,
    holdSecs: 45,
    phase: 'LOOSEN',
  },
  {
    ex: 'good-morning',
    mode: 'hold',
    part: 'warmup',
    sets: 1,
    reps: 20,
    secsPerRep: QUICK,
    holdSecs: 60,
    phase: 'WORK',
  },
];

// ─── Standing core (closes every session) ────────────────────────────────────

const CORE = [
  {
    ex: 'knee-to-elbow',
    mode: 'hold',
    part: 'core',
    sets: 1,
    reps: 20,
    secsPerRep: QUICK,
    holdSecs: 60,
    phase: 'WORK',
    restSecs: 30,
    load: 'BW',
  },
  {
    ex: 'suitcase-hold',
    mode: 'hold',
    part: 'core',
    phase: 'HOLD',
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
    // Her plan's own headings, verbatim — this is her session, and reading
    // the app should feel like reading the plan she wrote.
    parts: {
      warmup: 'WARM-UP',
      main: 'STRENGTH',
      finisher: 'KNEE STRENGTH',
      core: 'CORE',
    },
    rotate: ['finisher'],
    blocks: [
      ...WARMUP_LOWER,
      // UNILATERAL LEADS (§2.9 rule 3). The single-leg hinge opens the day:
      // it's the priority, it loads one leg hard, and it barely bends a knee.
      {
        ex: 'sl-rdl',
        mode: 'hold',
        part: 'main',
        sets: 3,
        reps: 6,
        secsPerRep: SLOW,
        holdSecs: 30,
        phase: 'WORK',
        perSide: true,
        switchSecs: 10,
        restSecs: 40,
        load: { lb: 15 },
      },
      {
        ex: 'reverse-lunge',
        mode: 'hold',
        part: 'main',
        sets: 2,
        reps: 6,
        secsPerRep: STEADY,
        holdSecs: 24,
        phase: 'WORK',
        perSide: true,
        switchSecs: 10,
        restSecs: 45,
        load: { lb: 15, each: true },
        kneeSwap: {
          ex: 'hip-abduction',
          secsPerRep: STEADY,
          perSide: true,
          switchSecs: 8,
          load: 'BW',
        },
      },
      // The bilateral anchor. Two legs still move the most total load, and
      // cutting them entirely would cost her the strength the plan is for.
      {
        ex: 'goblet-squat',
        mode: 'hold',
        part: 'main',
        sets: 3,
        reps: 8,
        secsPerRep: SLOW,
        holdSecs: 40,
        phase: 'WORK',
        restSecs: 40,
        load: { lb: 15 },
        kneeSwap: { ex: 'sit-to-stand', secsPerRep: STEADY, load: 'BW' },
      },
      {
        ex: 'sumo-squat',
        mode: 'hold',
        part: 'main',
        sets: 2,
        reps: 8,
        secsPerRep: SLOW,
        holdSecs: 40,
        phase: 'WORK',
        restSecs: 40,
        load: { lb: 20 },
        kneeSwap: {
          ex: 'sl-rdl',
          secsPerRep: SLOW,
          perSide: true,
          switchSecs: 10,
          load: { lb: 15 },
        },
      },
      {
        ex: 'sl-calf-raise',
        mode: 'hold',
        part: 'main',
        sets: 2,
        reps: 8,
        secsPerRep: SLOW,
        holdSecs: 40,
        phase: 'WORK',
        perSide: true,
        switchSecs: 8,
        restSecs: 40,
        load: 'BW',
      },
      // — knee strength: her 23:00–28:00 block —
      {
        ex: 'wall-sit',
        mode: 'hold',
        part: 'finisher',
        phase: 'HOLD',
        sets: 2,
        holdSecs: 30,
        restSecs: 30,
        load: 'BW',
      },
      {
        ex: 'sit-to-stand',
        mode: 'hold',
        part: 'finisher',
        sets: 2,
        reps: 8,
        secsPerRep: STEADY,
        holdSecs: 32,
        phase: 'WORK',
        restSecs: 30,
        load: 'BW',
      },
      {
        ex: 'hip-abduction',
        mode: 'hold',
        part: 'finisher',
        sets: 2,
        reps: 6,
        secsPerRep: STEADY,
        holdSecs: 24,
        phase: 'WORK',
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
    parts: {
      warmup: 'WARM-UP',
      main: 'UPPER BODY',
      finisher: 'ATHLETIC CORE + CARRY',
    },
    rotate: ['finisher'],
    blocks: [
      ...WARMUP_UPPER,
      {
        ex: 'shoulder-press',
        mode: 'hold',
        part: 'main',
        sets: 3,
        reps: 8,
        secsPerRep: STEADY,
        holdSecs: 32,
        phase: 'WORK',
        restSecs: 45,
        load: { lb: 15, each: true },
      },
      {
        ex: 'one-arm-row',
        mode: 'hold',
        part: 'main',
        sets: 2,
        reps: 8,
        secsPerRep: SLOW,
        holdSecs: 40,
        phase: 'WORK',
        perSide: true,
        switchSecs: 10,
        restSecs: 45,
        load: { lb: 15 },
      },
      {
        ex: 'squeeze-press',
        mode: 'hold',
        part: 'main',
        sets: 2,
        reps: 10,
        secsPerRep: SLOW,
        holdSecs: 50,
        phase: 'WORK',
        restSecs: 45,
        load: { lb: 10, each: true },
      },
      {
        ex: 'lateral-raise',
        mode: 'hold',
        part: 'main',
        sets: 2,
        reps: 12,
        secsPerRep: SLOW,
        holdSecs: 60,
        phase: 'WORK',
        restSecs: 40,
        load: { lb: 10, each: true },
      },
      {
        ex: 'rear-delt-fly',
        mode: 'hold',
        part: 'main',
        sets: 2,
        reps: 12,
        secsPerRep: SLOW,
        holdSecs: 60,
        phase: 'WORK',
        restSecs: 40,
        load: { lb: 10, each: true },
      },
      // Her 4:00–25:00 UPPER BODY block is seven movements and these are the
      // last two of them. They spent a while in the finisher, back when SHORT
      // existed and a curl was the most droppable thing in the session; with
      // one whole session there's nothing to drop them out of.
      {
        ex: 'bicep-curl',
        mode: 'hold',
        part: 'main',
        sets: 2,
        reps: 10,
        secsPerRep: SLOW,
        holdSecs: 50,
        phase: 'WORK',
        restSecs: 40,
        load: { lb: 10, each: true },
      },
      {
        ex: 'tricep-ext',
        mode: 'hold',
        part: 'main',
        sets: 2,
        reps: 10,
        secsPerRep: STEADY,
        holdSecs: 40,
        phase: 'WORK',
        restSecs: 40,
        load: { lb: 15 },
      },
      {
        ex: 'farmer-carry',
        mode: 'hold',
        part: 'finisher',
        phase: 'CARRY',
        sets: 2,
        holdSecs: 40,
        restSecs: 45,
        load: { lb: 20, each: true },
      },
      {
        ex: 'knee-drive',
        mode: 'hold',
        part: 'finisher',
        sets: 2,
        reps: 14,
        secsPerRep: QUICK,
        holdSecs: 42,
        phase: 'WORK',
        load: 'BW',
      },
      {
        ex: 'suitcase-hold',
        mode: 'hold',
        part: 'finisher',
        phase: 'HOLD',
        sets: 2,
        holdSecs: 25,
        perSide: true,
        switchSecs: 8,
        load: { lb: 20 },
      },
      // No CORE part on Wednesday: her 25:00–30:00 block IS the core, and the
      // suitcase hold is the third movement in the rotation above.
    ],
  },

  {
    id: 'full',
    name: 'Full Body',
    sub: 'Full Body + Knee',
    day: 'FRI',
    blurb:
      'One of everything, then the knee finisher. The week’s hardest thirty.',
    parts: {
      warmup: 'WARM-UP',
      main: 'FULL BODY',
      finisher: 'KNEE FINISHER',
      core: 'CORE',
    },
    rotate: ['finisher'],
    blocks: [
      {
        ex: 'bw-squat',
        mode: 'hold',
        part: 'warmup',
        sets: 1,
        reps: 16,
        secsPerRep: QUICK,
        holdSecs: 48,
        phase: 'WORK',
      },
      {
        ex: 'standing-hinge',
        mode: 'hold',
        part: 'warmup',
        sets: 1,
        reps: 16,
        secsPerRep: QUICK,
        holdSecs: 48,
        phase: 'WORK',
      },
      {
        ex: 'arm-circles',
        mode: 'hold',
        part: 'warmup',
        sets: 1,
        holdSecs: 45,
        phase: 'LOOSEN',
      },
      {
        ex: 'knee-lift',
        mode: 'hold',
        part: 'warmup',
        sets: 1,
        reps: 20,
        secsPerRep: QUICK,
        holdSecs: 60,
        phase: 'WORK',
      },
      {
        ex: 'calf-raise',
        mode: 'hold',
        part: 'warmup',
        sets: 1,
        reps: 16,
        secsPerRep: QUICK,
        holdSecs: 48,
        phase: 'WORK',
      },
      {
        ex: 'rdl',
        mode: 'hold',
        part: 'main',
        sets: 3,
        reps: 8,
        secsPerRep: SLOW,
        holdSecs: 40,
        phase: 'WORK',
        restSecs: 45,
        load: { lb: 15, each: true },
      },
      // Straight after the hinge, while balance is still good (§2.9 rule 3).
      {
        ex: 'reverse-lunge',
        mode: 'hold',
        part: 'main',
        sets: 2,
        reps: 6,
        secsPerRep: STEADY,
        holdSecs: 24,
        phase: 'WORK',
        perSide: true,
        switchSecs: 10,
        restSecs: 45,
        load: { lb: 15, each: true },
        kneeSwap: {
          ex: 'hip-abduction',
          secsPerRep: STEADY,
          perSide: true,
          switchSecs: 8,
          load: 'BW',
        },
      },
      {
        ex: 'goblet-squat',
        mode: 'hold',
        part: 'main',
        sets: 2,
        reps: 8,
        secsPerRep: SLOW,
        holdSecs: 40,
        phase: 'WORK',
        restSecs: 45,
        load: { lb: 15 },
        kneeSwap: { ex: 'sit-to-stand', secsPerRep: STEADY, load: 'BW' },
      },
      {
        ex: 'one-arm-row',
        mode: 'hold',
        part: 'main',
        sets: 2,
        reps: 8,
        secsPerRep: SLOW,
        holdSecs: 40,
        phase: 'WORK',
        perSide: true,
        switchSecs: 10,
        restSecs: 45,
        load: { lb: 15 },
      },
      {
        ex: 'squeeze-press',
        mode: 'hold',
        part: 'main',
        sets: 2,
        reps: 8,
        secsPerRep: SLOW,
        holdSecs: 40,
        phase: 'WORK',
        restSecs: 45,
        load: { lb: 10, each: true },
      },

      {
        ex: 'shoulder-press',
        mode: 'hold',
        part: 'main',
        sets: 2,
        reps: 8,
        secsPerRep: STEADY,
        holdSecs: 32,
        phase: 'WORK',
        restSecs: 45,
        load: { lb: 15, each: true },
      },
      // — knee finisher: her 23:00–28:00 block, calf-led —
      {
        ex: 'calf-raise',
        mode: 'hold',
        part: 'finisher',
        sets: 2,
        reps: 12,
        secsPerRep: SLOW,
        holdSecs: 60,
        phase: 'WORK',
        restSecs: 40,
        load: 'BW',
      },
      {
        ex: 'wall-sit',
        mode: 'hold',
        part: 'finisher',
        phase: 'HOLD',
        sets: 2,
        holdSecs: 30,
        restSecs: 30,
        load: 'BW',
      },
      {
        ex: 'sit-to-stand',
        mode: 'hold',
        part: 'finisher',
        sets: 2,
        reps: 8,
        secsPerRep: STEADY,
        holdSecs: 32,
        phase: 'WORK',
        restSecs: 30,
        load: 'BW',
      },
      ...CORE,
    ],
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

// The 2026-08-22 rewrite renamed the lower days. A live run from before it is
// dropped on restore (the schema guard in app.js), but HISTORY is forever —
// without this, her logged Lower A days render as an unnamed "Session".
const LEGACY_IDS = { 'lower-a': 'lower', 'lower-b': 'full' };

export const getSession = (id) =>
  HOTMUM_SESSIONS.find((s) => s.id === (LEGACY_IDS[id] || id)) || null;

/** "3 × 6 reps · 30s / side" — what a block asks for, in one line. */
export function blockDetail(block) {
  const side = block.perSide ? ' / side' : '';
  const dose = block.reps
    ? `${block.reps} reps · ${block.holdSecs}s`
    : `${block.holdSecs}s`;
  const sets = block.sets > 1 ? `${block.sets} × ` : '';
  return `${sets}${dose}${side}`;
}

// ─── Progression — the blocks actually do something ──────────────────────────
// Rewrites a session for the day she's on. Only `main` work progresses: the
// warm-up is a warm-up whatever week it is, and the knee block is deliberately
// FROZEN — a knee-strength dose that creeps upward every twenty days is how a
// knee protocol turns back into a knee problem.

function progressBlock(block, delta, isOpener) {
  if (block.part !== 'main') return block;
  const out = { ...block };
  if (delta.addReps && out.reps)
    out.reps = Math.max(5, out.reps + delta.addReps);
  if (delta.addSecsPerRep && out.secsPerRep)
    out.secsPerRep = out.secsPerRep + delta.addSecsPerRep;
  // The interval is reps × pace, always — recompute it rather than letting a
  // stored number drift out of step with the two things that define it.
  if (out.reps && out.secsPerRep) out.holdSecs = out.reps * out.secsPerRep;
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
  const openerIdx = session.blocks.findIndex((b) => b.part === 'main');
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
    blocks: session.blocks.map((b) => (b.kneeSwap ? swapped(b) : b)),
  };
}

/**
 * Merge a kneeSwap over its block — and then make the result make sense.
 *
 * A naive spread inherits whatever the ORIGINAL movement happened to carry,
 * which produced two silent bugs: swapping the (bilateral) sumo squat for a
 * single-leg RDL kept `perSide: false`, so she'd have done eight slow reps on
 * one leg and none on the other — on the day the app is telling her it's being
 * kinder. And swapping the goblet squat for a faster sit-to-stand kept the old
 * `holdSecs`, so the screen said "8 reps · 4s per rep" and then ran for 40
 * seconds instead of 32.
 *
 * So: per-side is declared by the SWAP, never inherited, and the interval is
 * recomputed from reps × pace — the same invariant progressBlock() maintains.
 */
function swapped(block) {
  const out = {
    ...block,
    perSide: false,
    switchSecs: 0,
    ...block.kneeSwap,
    swappedFrom: block.ex,
  };
  if (out.reps && out.secsPerRep) out.holdSecs = out.reps * out.secsPerRep;
  return out;
}

/** Everything the app has to do to a session before it plays. */
export function sessionForToday(session, { day, easyKnee = false } = {}) {
  if (!session) return null;
  const p = progress(session, day ?? dayNumber());
  return easyKnee ? kneeEasy(p) : p;
}

// ─── Length maths ────────────────────────────────────────────────────────────

/**
 * Seconds of WORK in a block — no rests, no prep.
 *
 * Every block is `hold` (one timed interval per set). This used to branch on
 * `tempo` and `reps` modes; the tempo branch called a `tempoSecs()` helper the
 * rewrite deleted, so it was a ReferenceError waiting for the first block that
 * set `mode: 'tempo'` again.
 */
export function blockWorkSecs(block) {
  const sides = block.perSide ? 2 : 1;
  return (block.sets || 1) * sides * block.holdSecs;
}

/**
 * Rough wall-clock for a session at a given dose: work + rests + side
 * switches + the engine's 10s prep before each new exercise.
 */
export function estimateSecs(session) {
  return session.blocks.reduce((total, block) => {
    const sets = block.sets || 1;
    const sides = block.perSide ? 2 : 1;
    const rest = (block.restSecs || 0) * (sets - 1);
    const switches = (block.switchSecs || 0) * (sides - 1) * sets;
    return total + 10 + blockWorkSecs(block) + rest + switches;
  }, 0);
}

export const estimateMins = (session) => Math.round(estimateSecs(session) / 60);

/** Total logical sets in a session — what the finish card counts. */
export const setTotal = (session) =>
  session.blocks.reduce((n, b) => n + (b.sets || 1) * (b.perSide ? 2 : 1), 0);

/** Seconds under tension across a session — the number tempo training earns. */
export const timeUnderTension = (session) =>
  session.blocks.reduce((n, b) => n + blockWorkSecs(b), 0);

// ─── Rotations ───────────────────────────────────────────────────────────────
// Her knee block says "Alternate: Wall Sit / Controlled Sit-to-Stand", and
// Wednesday says "Rotate through: Farmer Carry / Knee Drive / Suitcase Hold".
// The first build did those as straight sets — all of one, then all of the
// next — which is the same movements and the same volume arranged as a
// different exercise. A rotation gets its rest from CHANGING movement, so
// straight sets need rest periods bolted on and end up longer and easier.
//
// A part listed in `session.rotate` is interleaved for the player: three
// two-set blocks become A B C A B C, one set each, with no programmed rest —
// the ten-second change-over between movements is the rest. The SHEET still
// shows the un-interleaved list (2 × 30s each) so it reads like her plan.

export function expandRotations(session) {
  if (!session?.rotate?.length) return session;
  const blocks = [];
  for (const key of PARTS) {
    const part = session.blocks.filter((b) => b.part === key);
    if (!session.rotate.includes(key) || part.length < 2) {
      blocks.push(...part);
      continue;
    }
    const rounds = Math.max(...part.map((b) => b.sets || 1));
    for (let r = 0; r < rounds; r++) {
      for (const b of part) {
        if (r < (b.sets || 1)) blocks.push({ ...b, sets: 1, restSecs: 0 });
      }
    }
  }
  return { ...session, blocks };
}

/** The session as the PLAYER runs it — rotations interleaved. */
export const playable = (session) => expandRotations(session);

/** A session's blocks grouped into its named parts, in order. */
export function sessionParts(session) {
  return PARTS.map((key) => ({
    key,
    label: session.parts?.[key] || key.toUpperCase(),
    blocks: session.blocks.filter((b) => b.part === key),
  })).filter((p) => p.blocks.length);
}

/** "15 lb × 2" / "20 lb" / "Bodyweight" */
export function loadLabel(load) {
  if (!load || load === 'BW') return 'Bodyweight';
  return `${load.lb} lb${load.each ? ' × 2' : ''}`;
}
