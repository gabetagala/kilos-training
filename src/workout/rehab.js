import {
  BRIDGE_BLOCK,
  POWER_BLOCKS,
  PROGRAM_EXERCISES,
  STRETCH_BLOCKS,
} from './program.js';
import { createStepEngine } from './stepEngine.js';

// Rehab program + guided-session step engine — pure, no DOM, no storage.
// Unit-tested in tests/unit/rehab.test.js.
//
// The program is Gabe's DDD back protocol, dosed per the published protocols
// (researched 2026-07 — see PROTOCOL notes on each block).
//
// ── BACK & HIPS + TOPPER (2026-08-11) ───────────────────────────────────────
// The daily session is the DISTILLATE of the Movementgems [Lower Back & Hips]
// Home Program (2026-08-10) — rebuilt a day later at his call because 48
// minutes of holds was a session he'd quit. Six fixed blocks he loves and the
// biggest levers (thoracic, back-extension, hip IR, couch, elephant walk,
// seated good morning), ONE rotating supporting-cast slot (8-deep — the other
// seven source movements, each ~once per two weeks), then a 12-minute topper
// EMOM (4-deep pool, axially quiet, ends on core). ~25 min of holds + 12 of
// topper; runs Tue/Thu/Sat, calendar-pinned — Sunday is the REST DAY since
// 2026-08-16 (holds only, its old mini-WOD column opt-in as 'wod'). Stated
// plainly: the
// supporting cast went from 4×/wk to ~0.5×/wk — a real dose cut, traded
// knowingly for a session he'll do forever. The long-set mechanism is
// untouched: durations were never trimmed, movements were.
//
// The method (2026-10-10, physio QA — one philosophy, not two): work hard
// enough to feel the muscle, never into pain, and stop a set the moment form
// slips — McGill's "never grind the spine to fatigue" wins over the source
// PDF's 10/10 burn. Progress on ENDURANCE, not load: all the reps clean, then
// take the next step on that movement's ladder (`scale`).
// Back Extension wants a Roman chair; floor-lying isometrics are the stated
// regression until one exists.
//
// The old 10-minute McGill core survives as its own session ('reset') for a
// day the long program will not happen, and so paused sessions and history
// still resolve. Everything below about the trim describes THAT session.
//
// TRIMMED 2026-08-07 to the 10-minute core. It had grown to 18:55 (A) /
// 23:50 (B) — against a doc that claimed 15 — and stacked on top of a ~30-min
// lift it made his Wednesday 52 minutes. He asked for 10 max. Nothing was
// cut on medical grounds; three blocks moved to where they belong, in the
// same commit that split D40 into six half-sessions (see program.js):
//   - Static stretches → post-lift cool-down on the leg days. Cold static
//     stretching before training transiently blunts force output; warm
//     tissue after the session is the correct slot. Re-dosed 7×→3×/week —
//     "more adds little" was already the note here.
//   - Single-leg bridge → the leg halves as glute prep. An activation drill
//     doesn't need 7×/week next to 10+ weekly sets of squat/split/hinge.
//     Re-dosed 7×→2×/week.
//   - RDL → the three accessory halves (A2/B2/C2). It is a barbell lift with
//     90s rests; it never belonged inside a warm-up. Dose UNCHANGED at
//     3×/week — that was the evidence dose and it still is. Bonus: heavy
//     axial days and light hinge days now alternate across the week.
// What's left is the daily non-negotiable: one fixed 10-minute session, the
// same every single day, no A/B variant to track.
//
// - Cat-camel: 6 slow unloaded cycles as the opener — McGill's own warm-up.
//   (Dead hangs opened the session until 2026-08 — hanging never clicked for
//   him. The def and demo stay only so an old paused session still restores.)
// - McGill Big 3: 8–10s isometric holds, ~3s re-brace between holds, 20–30s
//   rest between sets, per side for side plank/bird dog. FLATTENED 2026-08-02
//   from McGill's descending pyramids (5-3-1 etc.) to straight sets — the
//   ladders bored him and ate time, and the medicine is the short holds and
//   never grinding to fatigue, not the ladder shape. Progress by adding a
//   rep per set, never hold length. (Squat University's McGill write-up;
//   backfitpro.) These stay untouched: the repetition IS the protocol.
//
// VARIETY: a block may be a rotation wrapper { rotate: [specA, specB, …] }.
// The daily session uses TWO (2026-08-11): the supporting-cast slot and the
// topper pool, both calendar-pinned via rehabVariantIdx in main.js — the k-th
// rehab day of block week w serves variant (w−1)·4+k, so a full week always
// serves each topper exactly once and the printed sheet can never drift.
//
// A session is a list of BLOCKS; buildStepQueue() expands blocks into a flat
// queue of STEPS the player walks through one at a time:
//   { kind: 'prep'|'work'|'rest', exId, secs, phase, meta, side, manual,
//     logWeight, tempo, countsAsSet }
// Block modes:
//   hold  — one timed hold per set (hang, side plank, stretches)
//   reps  — one timed hold PER REP with a short re-brace between (McGill),
//           reps per set via repScheme, per side optional
//   tempo — one continuous timed set; the player derives the live rep count
//           and sub-phase (LIFT/SQUEEZE/LOWER) from step.tempo
//   lift  — self-paced barbell set, athlete taps done, logs weight
// - secs: countdown length; null ⇒ manual step (user taps "Set done").
// - countsAsSet: marks the step that completes one logical set (per side).

export const REHAB_EXERCISES = {
  'dead-hang': {
    name: 'Dead Hang',
    feel: 'A long, opening stretch down the spine',
    avoid: 'Shrugging — let the shoulders unpack',
    cue: 'Grip the bar, feet off the floor, let everything go loose. Slow breaths.',
    why: 'Decompression — the "opened up" feeling in the lower back.',
    yt: 'dead hang lower back decompression',
  },
  'cat-camel': {
    name: 'Cat-Camel',
    feel: 'The spine moving through easy range, segment by segment',
    avoid: 'Pushing either end — this is motion, not a stretch',
    cue: 'On all fours. Exhale, round the back up to the ceiling; inhale, let it dip. Slow and easy — no forcing.',
    why: 'McGill’s warm-up: gentle unloaded motion that greases the spine before bracing it.',
    yt: 'cat camel exercise mcgill',
  },
  't-spine-reach': {
    name: 'T-Spine Reach',
    feel: 'The mid-back opening as the chest turns',
    avoid: 'Twisting from the low back — hips stay square',
    cue: 'On all fours. Sweep one arm up to the ceiling, eyes following the hand, and finish each reach with the chest open. Slow — turn from the mid-back.',
    why: 'The mid-back the baby-carry posture stiffens. Carrying: a carrier with a hip belt, baby close, switch sides often.',
    yt: 'quadruped thoracic rotation',
  },
  'mcgill-curlup': {
    name: 'McGill Curl-Up',
    feel: 'Front abs bracing — neck stays easy',
    avoid: 'Chin tucking, spine bending to lift',
    cue: 'Hands under the low back, one knee bent. Lift head + shoulders barely off the floor — the spine never bends.',
    why: 'Front-side stiffness without spine flexion.',
    scale:
      'Harder: elbows hovering → hands off the floor → pre-tense the abs hard before each lift',
    yt: 'mcgill curl up form',
  },
  'side-plank': {
    name: 'Side Plank',
    feel: 'The side of your waist holding you up',
    avoid: 'Hips sagging toward the floor',
    cue: 'Elbow under shoulder, hips tall. One straight line from ear to ankle.',
    why: 'Side-core stiffness with near-zero disc load.',
    scale:
      'Easier: from the knees · Harder: feet stacked → top leg raised → weighted vest',
    yt: 'side plank mcgill big 3',
  },
  'bird-dog': {
    name: 'Bird Dog',
    feel: 'Glute + upper back, belly braced',
    avoid: 'Hips rotating as the leg reaches',
    cue: 'Opposite arm + leg out. Reach long, not high — hips stay square, spine stays still.',
    why: 'Back-side stiffness while the limbs move around a quiet spine.',
    scale:
      'Easier: leg only · Harder: slow square with hand + foot → wrist/ankle weights',
    yt: 'bird dog exercise mcgill',
  },
  'glute-bridge': {
    name: 'Glute Bridge',
    feel: 'Glutes lifting, hamstrings helping',
    avoid: 'Low back arching at the top',
    cue: 'Drive through the heels — up, squeeze two seconds, lower slow. Ribs down.',
    why: 'Wakes up glutes that under-fire, so the low back stops compensating.',
    yt: 'glute bridge form',
  },
  rdl: {
    name: 'Romanian Deadlift',
    feel: 'Hamstrings loading as hips go back',
    avoid: 'Bar drifting away, back rounding',
    repTempo: [
      ['DOWN', 3],
      ['UP', 1],
    ],
    // No shoe lift (2026-10-10): imaging puts the true leg-length difference
    // at 0.4 cm, and he was cleared to wean off the 1.5 cm insole — under a
    // loaded bar it over-corrected the pelvis the other way.
    cue: 'Unrack at the pins, never off the floor. Soft knees, hips straight back, bar close — down only until the hamstrings stop the hips, three seconds, flat back.',
    why: 'Retrains the hip hinge so the hips lift, not the spine.',
    yt: 'romanian deadlift form',
  },
  'glute-kickback': {
    name: 'Glute Kickback',
    feel: 'The working-side glute doing the lift',
    avoid: 'Low back arching as the leg lifts',
    cue: 'On all fours, spine quiet. Drive the heel back and up — squeeze at the top, lower slow.',
    why: 'One glute at a time — activation you can actually feel.',
    yt: 'quadruped glute kickback form',
  },
  'single-leg-bridge': {
    name: 'Single-Leg Bridge',
    feel: 'The down-leg glute working alone',
    avoid: 'Pelvis tipping — hips stay level',
    cue: 'One foot down, other leg straight and in line with your body. Drive through the heel — hips stay level.',
    why: 'Each hip works alone — the strong side can’t cover for the weak one.',
    yt: 'single leg glute bridge form',
  },
  'pogo-hop': {
    name: 'Pogo Hop',
    feel: 'Ankles like springs — bounce, don’t squat',
    avoid: 'Heels slamming down, knees folding',
    cue: 'Tall and braced. Quick low bounces off the balls of the feet — short ground contact, like the floor is hot.',
    why: 'Rebuilds elastic spring — the first athletic quality to fade and the safest to bring back.',
    yt: 'pogo hops plyometric',
  },
  'broad-jump': {
    name: 'Broad Jump',
    feel: 'Hips launching, landing soft and stuck',
    avoid: 'Loud landings, knees caving, rushed reps',
    cue: 'Swing the arms, jump FAR, land in a quiet half-squat, chest up, and stick it. Full reset between jumps.',
    why: 'Hip power with a controlled landing — catch-a-toddler strength.',
    yt: 'standing broad jump technique',
  },
  'power-pushup': {
    name: 'Explosive Push-Up',
    feel: 'Hands throwing the floor away',
    avoid: 'Sagging hips, grinding slow reps',
    cue: 'Braced plank, lower under control, then EXPLODE — hands leave the floor if they can. Stop when the pop fades.',
    why: 'Upper-body speed to match the pressing strength.',
    yt: 'explosive push up plyometric',
  },
  'hamstring-stretch': {
    name: 'Hamstring Stretch',
    feel: 'A soft pull down the back of the thigh',
    avoid: 'Yanking — pain means too far',
    cue: 'On your back, one leg up, hands behind the thigh. Gentle pull — breathe into it.',
    why: 'Tight hamstrings drag the pelvis and load the low back.',
    how: 'Just breathe — a soft pull, never pain. The timer does the counting.',
    yt: 'lying hamstring stretch',
  },
  'hip-flexor-stretch': {
    name: 'Hip Flexor Stretch',
    feel: 'Stretch across the front of the rear hip',
    avoid: 'Arching the low back to fake range',
    cue: 'Half-kneeling, tuck the tail, shift hips forward. Stretch in the front of the rear hip.',
    why: 'Tight hip flexors tilt the pelvis and cramp the hinge.',
    how: 'Just breathe — tail tucked, a soft stretch. The timer does the counting.',
    yt: 'half kneeling hip flexor stretch',
  },

  // ── Lower Back & Hips (Movementgems) ──────────────────────────────────────
  // The twelve movements of the home program, in program order. Every one is
  // ONE long set — 2 minutes a side, or 4 minutes straight. `scale` carries the
  // published regression → progression ladder, because on this program the
  // ladder IS the programming: you stay on a level until you can hold the full
  // duration unbroken, then you move up and start over.
  'hip-internal-rotation': {
    name: 'Hip Internal Rotation',
    feel: 'A deep burn on the outside and front of the working hip',
    avoid: 'Leaning back or letting the low back round to lift higher',
    cue: 'Sit tall, knees bent, feet wide. Drop one knee inward, then lift that foot off the floor — small lifts, the hip does all of it.',
    why: 'The rotation a hip loses first. Without it the spine turns instead.',
    scale: 'Easier: body weight · Harder: ankle weight',
    how: 'Follow the count: lift, squeeze two, lower. Form slips = pause, then pick the count back up.',
    yt: 'seated hip internal rotation lift off',
  },
  'hip-airplane': {
    name: 'Hip Airplane',
    feel: 'The standing glute fighting to control the turn',
    avoid: 'Twisting from the low back, or hopping to save your balance',
    cue: 'Stand on one leg, hinge over, back leg long behind you. Rotate the pelvis open, then closed — slow, the standing hip steers.',
    why: 'Teaches the hip to rotate under load so the low back stops doing it.',
    scale:
      'Easier: body weight, less bend · Harder: ankle weight, more bend over',
    how: 'Follow the count: three seconds open, three closed. Lose balance = touch down, reset, carry on.',
    yt: 'hip airplane exercise',
  },
  'side-hip-abduction': {
    name: 'Side Hip Abduction',
    feel: 'Burn on the outside of the top hip',
    avoid: 'Rolling the hips back, or leading with the toes',
    cue: 'Lie on your side, body in one line. Lift the top leg up and slightly back, toes level. No rolling.',
    why: 'Glute-med endurance — the muscle that keeps the pelvis level every step you take.',
    scale: 'Easier: body weight · Harder: ankle weight',
    how: 'Follow the count: two up, two down. Form slips = break, then back on.',
    yt: 'side lying hip abduction form',
  },
  'side-hip-adduction': {
    name: 'Side Hip Adduction',
    feel: 'Inner thigh of the bottom leg, burning',
    avoid: 'Rolling backward — stay stacked',
    cue: 'Same side-lying stack. Cross the top leg over in front, then lift the BOTTOM leg off the floor and keep it there.',
    why: 'Adductors hold up more of the pelvis than anyone trains — weak ones surface as groin and SI pain.',
    scale: 'Easier: body weight · Harder: ankle weight',
    how: 'One long hold, bottom leg up. When it gives: rest a breath, lift again — time up is the score.',
    yt: 'side lying hip adduction exercise',
  },
  'hip-flexor-lift': {
    name: 'Hip Flexor Lift',
    feel: 'The front of the hip working hard — the muscle, never pain',
    avoid: 'Leaning back to buy height',
    cue: 'Sit on the floor, legs long, sit tall. Lift one straight leg as high as it will go and hold it there — hands off it.',
    why: 'Trains the hip flexor short and strong so it stops yanking the pelvis into a tilt.',
    scale: 'Easier: body weight · Harder: ankle weight',
    how: 'Lift and hold it there. When the leg drops: shake out, lift again. The clock keeps score.',
    yt: 'seated straight leg hip flexor lift',
  },
  'ql-plank': {
    name: 'QL Plank',
    feel: 'The side of the low back and the top of the hip',
    avoid: 'Hips sagging, or the bottom shoulder collapsing',
    cue: 'On your side, elbow under the shoulder, legs stacked. Drive the hips high and hold — the work belongs in the side of your waist.',
    why: 'The QL hikes the hip. Even and strong on both sides, the pelvis stops sitting crooked.',
    scale: 'Easier: body weight · Harder: weighted vest',
    how: 'One hold, hips high. Break when you must, get straight back up — total hold time is the set.',
    yt: 'QL plank exercise',
  },
  plank: {
    name: 'Plank',
    feel: 'The whole front holding one straight line',
    avoid: 'Hips sagging, or piking up to rest',
    cue: 'Elbows under shoulders, ribs down, glutes on. One line from ear to ankle. Break when you must, then get straight back on.',
    why: 'Front-core endurance — the thing that stops the spine borrowing range under load.',
    scale: 'Easier: body weight · Harder: weighted vest',
    how: 'One hold. Break when you must, get straight back on — total time under tension is the set.',
    yt: 'plank form',
  },
  // ANTI-ROTATION (2026-10-10, his "something core focused" + coach/physio
  // QA: every core move was an endurance hold, nothing resisted rotation)
  'pallof-press': {
    name: 'Pallof Press',
    feel: 'The whole trunk refusing to turn toward the band',
    avoid: 'Twisting, leaning away, or shrugging',
    cue: 'Band or cable at chest height, side-on, feet hip-width, knees soft. Press straight out, hold three seconds without turning, bring it back.',
    why: 'Anti-rotation — the core holding the spine still while the arms work, which is what lifting a baby out of a cot asks of it.',
    scale:
      'Easier: stand closer to the anchor · Harder: step further away, or half-kneeling',
    how: 'Eight a side. The band is the load knob — step out until the hold is hard but you never turn.',
    yt: 'pallof press form',
  },
  'back-extension': {
    name: 'Back Extension',
    feel: 'Low back and glutes working together, all the way through',
    avoid: 'Hyperextending past straight at the top',
    cue: 'Hinge at the hips with a long spine, lift to straight — never past it. The set ends at the first rep your low back rounds.',
    why: 'The single biggest lever on a back that hurts: extensors with real endurance.',
    scale:
      'Easier: isometric hold · Harder: reps → + vest → single-leg hold → single-leg reps',
    how: 'Every set stops a couple of reps short. No chair? Hips on the bench end, ankles under the bar on the safety pins.',
    yt: 'roman chair back extension form',
  },
  'wall-groin-stretch': {
    name: 'Wall Groin Stretch',
    feel: 'A long, slow opening through both inner thighs',
    avoid: 'Bouncing or forcing — let gravity do the work',
    cue: 'On your back, hips close to the wall, legs straight up. Let them fall wide and breathe. Four minutes, no pushing.',
    why: 'Four unhurried minutes is what actually changes adductor length. Thirty seconds never did.',
    scale:
      'Easier: hips further from the wall · Harder: hips closer, legs lower',
    how: 'No work at all — let gravity take the legs and breathe until the beep.',
    yt: 'wall straddle groin stretch',
  },
  '90-90-pushup': {
    name: '90/90 Push Up',
    feel: 'Deep in the front hip as you come up over it',
    avoid: 'Letting the back knee flare open or the spine round',
    cue: 'Sit in 90/90, both shins square. Push the floor away and come up tall over the front hip, then sit back down. Slow both ways.',
    why: 'Strength at end-range rotation — the hip position everyone stretches and nobody trains.',
    scale: 'Easier: two hands down · Harder: one hand, then none',
    how: 'Follow the count: three up, three down. Form slips = breathe, resume.',
    yt: '90 90 hip lift off push up',
  },
  'couch-stretch': {
    name: 'Couch Stretch',
    feel: 'Front of the rear hip and quad, long and hot',
    avoid: 'Arching the low back to fake depth',
    cue: 'Back foot up the wall or couch, front foot planted. Tuck the tail, squeeze the back glute, then come tall.',
    why: 'Unwinds the hip flexor a day of sitting shortens — the one the pelvis pays for.',
    scale:
      'Easier: hold a counter · Harder: hands off, glute squeezed, lunge forward with a neutral pelvis',
    how: 'No reps — sink in, squeeze the back glute, breathe slow. Easy effort, never a strain.',
    yt: 'couch stretch form',
  },
  'elephant-walk': {
    name: 'Elephant Walk',
    feel: 'Hamstrings taking turns, one long pull at a time',
    avoid:
      'Rounding the low back to reach the floor — raise your hands instead',
    cue: 'Hinge over, hands on the box (the floor only if it’s easy), legs near-straight. Bend one knee and straighten the other, then swap. Within an hour of waking? Skip it today.',
    why: 'Hamstring length earned through movement — the hips do the folding, the spine stays long.',
    scale:
      'Easier: hands on a higher surface · Harder: hands a little lower — only while the back stays long',
    how: 'One rep = one leg bends, then the other. Follow the count — no burn to chase.',
    yt: 'elephant walk hamstring exercise',
  },
  // Added 2026-08-11 at his ask — his favorite feel from the source coach's
  // library, and it wasn't among the twelve extracted movements. Kept because
  // it TEACHES the exact pattern his lifting depends on: fold at the hips,
  // never the back.
  'seated-good-morning': {
    name: 'Seated Good Morning',
    feel: 'Hamstrings and glutes lengthening while the back stays long',
    avoid: 'Rounding forward to get lower — depth comes from the hips only',
    cue: 'Sit on the bench, feet planted wide, arms crossed on your chest. Hinge forward from the hips with a LONG spine to where the stretch bites, and breathe there. Stop the moment the back wants to round. Within an hour of waking? Skip it today.',
    why: 'The hip hinge, learned unloaded — the pattern every lift in this program depends on, stretched into the hamstrings from a supported seat.',
    scale:
      'Easier: hands on thighs, smaller fold · Harder: a longer, slower breath in the same fold — never deeper',
    how: 'Fold to where the stretch bites and breathe there. No reps, no pushing.',
    yt: 'seated good morning stretch',
  },
};

// Cat-camel cycle: exhale into the round, inhale into the arch — breath-paced.
const CATCAMEL_TEMPO = [
  ['ROUND', 3],
  ['ARCH', 3],
];

// T-spine reach: slow sweep up, controlled return — rotation, not a fling.
const TSPINE_TEMPO = [
  ['REACH', 3],
  ['RETURN', 2],
];

// One long set per movement: 2 minutes a side, or 4 minutes straight. That
// duration is the whole prescription — see the LOWER BACK & HIPS note in the
// file header. `hold` mode is just "one timed set"; the phase label says what
// kind of minute it is (WORK = burn to failure and back, HOLD = isometric,
// BREATHE = a stretch you are not fighting).
const MINS = (n) => n * 60;

// ── REPS, NOT A CLOCK, FOR ANYTHING THAT MOVES (2026-09-27, his ask) ────────
// "It's time bound, which makes it very hard to see if I'm doing it
// correctly." The dynamic movements now run as COUNTED tempo sets — the
// player shows the rep number and the phase, and ticks the cadence — sized
// so each lands near its old duration: the dose stayed, the guesswork left.
// What stays on a clock is what doesn't move: the stretches (BREATHE) and
// the true isometrics (plank, QL plank, hip-flexor lift, adduction hold).
// The method: feel the muscle, never the pain, pause mid-set when form slips —
// and the progression trigger reads the same: all the reps clean, then take
// the next step on that movement's ladder.
const LIFT_SQUEEZE_LOWER = (lift, squeeze, lower) => [
  ['LIFT', lift],
  ['SQUEEZE', squeeze],
  ['LOWER', lower],
];
const repped = (
  ex,
  reps,
  tempo,
  { perSide = false, switchSecs = 15 } = {},
) => ({
  ex,
  mode: 'tempo',
  sets: 1,
  reps,
  tempo,
  ...(perSide ? { perSide: true, switchSecs } : {}),
});
// Per-side blocks: 2 minutes each side, a real changeover between them (some
// of these need you to get up and reset the whole position, not just roll over).
const perSide = (ex, phase, switchSecs = 15) => ({
  ex,
  mode: 'hold',
  sets: 1,
  holdSecs: MINS(2),
  perSide: true,
  switchSecs,
  phase,
});

// ── THE FINISHERS ───────────────────────────────────────────────────────────
// 2026-08-14: the strict topper EMOMs (a fourth lift day in disguise) became
// four metcon-shaped finishers. 2026-08-15: the pool grew to SIXTEEN — see
// the block below, which is the live spec. AXIALLY QUIET by rule
// (verifier-enforced, all modes): bands, light DBs, bodyweight — the barbell
// and the pulley stay untouched, because these days sit between the heavy
// ones on purpose. Core rides the McGill primer mid-session (2026-10-10),
// at protocol dose — never a plank minute squeezed into an EMOM.
// SIXTEEN, striding the four weekday slots (2026-08-15, his ask: "fresh and
// fun all the time" + "CrossFit level fun" + his old competitors-camp
// formats). index % 4 keeps each weekday's LEANING — Tue pump/carries,
// Thu arms/grip, Sat engine, Sun mini-WOD — while the pool cycles FOUR:
// a full repeat only every four weeks, and when one returns its LAST score
// is on the card waiting to be beaten.
//
// Shapes come from the researched canon (the formats people demonstrably
// love): for-time chases, Annie's descending mercy-ladder, death-by ladders
// that end themselves, Tabata's worst-round rule, Cindy's triplet, carry
// gauntlets (McGill treats loaded carries as DDD therapy, not a workaround).
// Safety lines from the same research: ballistics and skater bounds live
// only on forced-rest clocks, DBs come off the BENCH (the pickup is the
// hazard, not the press), bear-crawl turns are stop-plant-turn.
const TOPPERS = [
  // ── week A ────────────────────────────────────────────────────────────
  {
    mode: 'fortime',
    name: 'The Pump',
    rounds: 3,
    note: 'No prescribed rest — move when the burn lets you. Score = time.',
    members: [
      { ex: 'band-lateral-raise', reps: '12', logWeight: false },
      { ex: 'hammer-curl', reps: '10' },
      { ex: 'band-pull-apart', reps: '14', logWeight: false },
    ],
  },
  {
    mode: 'emom',
    name: 'The Arm Farm',
    formatLabel: 'EMOM',
    rounds: 5,
    note: 'Odd minutes curls, even minutes diamond push-ups. Curl load is the score — nudge it up when it stops burning.',
    members: [
      { ex: 'supinated-curl', reps: '10' },
      // NOT overhead-triceps or pushdowns: both are CABLE moves, and the
      // pulley stays untouched on rehab days (verifier-enforced). Diamond
      // push-ups are the triceps minute — his pick (2026-08-15), strict,
      // no equipment, sag-gated like every push-up here.
      { ex: 'diamond-pushup', reps: '10', logWeight: false },
    ],
  },
  {
    mode: 'tabata',
    name: 'The Redline',
    // pogo was here and it was a husk: ballistics can't be scored at
    // fatigue, and an unscored 4-minute hop is nobody's engine day. High
    // knees fail at hip flexors and lungs — max effort is SAFE there, so
    // this is the scored top-HR test he actually asked for.
    ex: 'high-knees',
    note: 'All eight rounds at max effort — your score is your worst round. Count knee drives on one side.',
  },
  {
    mode: 'amrap',
    name: 'The Classic',
    capSecs: 9 * 60,
    note: 'Strict pull-ups, always. Steady rounds beat a hot start. Score = rounds.',
    members: [
      { ex: 'pull-up-bw', reps: '3', logWeight: false },
      { ex: 'push-up', reps: '6', logWeight: false },
      { ex: 'box-step-up', reps: '9', logWeight: false },
    ],
  },
  // ── week B ────────────────────────────────────────────────────────────
  {
    mode: 'fortime',
    name: 'The Downhill',
    note: 'Every round is smaller than the last — it only gets easier. Score = time.',
    members: [
      { ex: 'band-pull-apart', repScheme: [40, 30, 20, 10], logWeight: false },
      {
        ex: 'push-up',
        repScheme: [16, 12, 8, 4],
        logWeight: false,
        // the alt declares its OWN scheme: resolveSwap strips movement
        // fields an alt doesn't define, so a bare alt would serve
        // 'undefined reps' and prompt for kilograms on a push-up
        alts: [
          {
            ex: 'elevated-pushup',
            repScheme: [16, 12, 8, 4],
            logWeight: false,
          },
        ],
      },
    ],
  },
  // the light wrist pair shares one dial (TRAINING.md's own pairing)
  {
    mode: 'fortime',
    name: 'The Popeye',
    rounds: 3,
    note: 'Grip grinder — smooth reps beat fast ones. Score = time.',
    members: [
      { ex: 'wrist-curl', reps: '20', logWeight: false },
      { ex: 'reverse-wrist-curl', reps: '20', logWeight: false },
      { ex: 'reverse-curl', reps: '10' },
    ],
  },
  {
    mode: 'emom',
    name: 'Death by Step-Ups',
    formatLabel: 'EMOM',
    rounds: 10,
    note: 'Two more every minute until a minute beats you. When it does, tap CLOCK BEAT ME — score = last full minute.',
    bail: 'CLOCK BEAT ME',
    scorePrompt: {
      title: 'DEATH BY STEP-UPS — LAST FULL MINUTE',
      sub: 'The last minute you finished the count inside. The clock won after that.',
      unit: 'minutes',
      labelPrefix: 'min',
      def: 7,
      min: 0,
      max: 10,
    },
    members: [
      {
        ex: 'box-step-up',
        reps: '4',
        repsPerRound: ['4', '6', '8', '10', '12', '14', '16', '18', '20', '22'],
        logWeight: false,
      },
    ],
  },
  // ── week C ────────────────────────────────────────────────────────────
  {
    mode: 'emom',
    name: 'The Porter',
    formatLabel: 'EMOM',
    rounds: 2,
    // UNSCORED (round-3 physio QA): a raced carry is a raced pickup — the
    // program's own open-pace rule. Steady walking, no number to chase.
    note: 'Forty seconds loaded at a steady walk, twenty to breathe. DBs come off the BENCH. No score — tall and steady wins.',
    // one hand per suitcase minute — the right (smaller) side leads, same
    // asymmetry rule as the lift days; no impossible mid-minute switch cue
    members: [
      { ex: 'farmer-carry', secs: 40, phase: 'GO' },
      {
        ex: 'suitcase-carry',
        secs: 40,
        phase: 'GO',
        note: 'RIGHT hand this minute.',
      },
      { ex: 'farmer-carry', secs: 40, phase: 'GO' },
      {
        ex: 'suitcase-carry',
        secs: 40,
        phase: 'GO',
        note: 'LEFT hand this minute.',
      },
    ],
  },
  {
    mode: 'emom',
    name: 'Death by Pull-Aparts',
    formatLabel: 'EMOM',
    rounds: 10,
    // WAS Death by Curls (2026-08-16 QA): its week already ran biceps at 26
    // fractional sets — the hottest number in the program — while rear delts
    // sat at 6, the thinnest slice of "3-D shoulders". Same death-by game,
    // same benign failure, the dose moved to the muscle that needed it.
    // The top rungs (40+ band reps in a minute) genuinely race the clock.
    note: 'Four more every minute until a minute beats you — then tap CLOCK BEAT ME. Arms long, blades squeezed; the band is the load knob.',
    bail: 'CLOCK BEAT ME',
    scorePrompt: {
      title: 'DEATH BY PULL-APARTS — LAST FULL MINUTE',
      sub: 'The last minute you finished the count inside. The clock won after that.',
      unit: 'minutes',
      labelPrefix: 'min',
      def: 7,
      min: 0,
      max: 10,
    },
    members: [
      {
        ex: 'band-pull-apart',
        reps: '10',
        logWeight: false,
        repsPerRound: [
          '10',
          '14',
          '18',
          '22',
          '26',
          '30',
          '34',
          '38',
          '42',
          '46',
        ],
      },
    ],
  },
  {
    mode: 'fortime',
    name: 'The Sprint',
    // skater tabata was the other unscored husk. This is Annie's downhill
    // shape as pure engine: both movements open-pace legal, the clock is
    // the score, and every round is smaller than the last.
    note: 'Every round shrinks — empty the tank on the way down. Score = time.',
    members: [
      { ex: 'jumping-jack', repScheme: [40, 30, 20, 10], logWeight: false },
      { ex: 'box-step-up', repScheme: [16, 12, 8, 4], logWeight: false },
    ],
  },
  {
    mode: 'amrap',
    name: 'The Chase',
    capSecs: 9 * 60,
    note: 'Steady climb, no sprint-and-die. Score = rounds — beat last time.',
    members: [
      { ex: 'jumping-jack', reps: '20', logWeight: false },
      { ex: 'reverse-lunge', reps: '10', logWeight: false },
      { ex: 'push-up', reps: '8', logWeight: false },
    ],
  },
  // ── week D (2026-08-15) — lifted from his OWN old competitors-camp sheet:
  // the formats he already loved, re-armed with legal movements ──────────
  {
    mode: 'amrap',
    name: 'The Test',
    capSecs: 5 * 60,
    note: 'Max STRICT pull-ups in five minutes — break early, break often. Note the number.',
    scorePrompt: {
      title: 'THE TEST — STRICT PULL-UPS',
      sub: 'Total strict reps across the five minutes.',
      unit: 'reps',
      def: 15,
      min: 0,
      max: 99,
    },
    members: [{ ex: 'pull-up-bw', reps: 'max', logWeight: false }],
  },
  {
    mode: 'amrap',
    name: 'The Climb',
    capSecs: 8 * 60,
    note: 'Rung 1 is 2 of each, rung 2 is 4 — add two every rung until the clock ends it. Score = highest full rung.',
    scorePrompt: {
      title: 'THE CLIMB — HIGHEST RUNG',
      sub: 'The last rung you completed in full before the clock.',
      unit: 'rung',
      labelPrefix: 'rung',
      def: 6,
      min: 1,
      max: 20,
    },
    members: [
      { ex: 'box-step-up', reps: '2-4-6…', logWeight: false },
      { ex: 'push-up', reps: '2-4-6…', logWeight: false },
    ],
  },
  {
    mode: 'fortime',
    name: 'The Century',
    rounds: 1,
    note: 'One hundred reps, one pile, any breaks you need. Score = time.',
    members: [
      { ex: 'jumping-jack', reps: '30', logWeight: false },
      { ex: 'box-step-up', reps: '25', logWeight: false },
      { ex: 'band-pull-apart', reps: '25', logWeight: false },
      { ex: 'push-up', reps: '20', logWeight: false },
    ],
  },
];

// ── THE McGILL PRIMER ───────────────────────────────────────────────────────
// 2026-10-10 (physio QA): the Big 3 moved from the END of the session — where
// bracing was practised tired, after the finisher — to the MIDDLE, right
// before the back extension: one set of each at its own protocol (10 s holds,
// 3 s re-brace), every Back & Hips day and Sunday. It primes; it doesn't cap.
const CORE_CAP = (ex, extra = {}) => ({
  ex,
  mode: 'reps',
  repScheme: [4],
  holdSecs: 10,
  resetSecs: 3,
  restSecs: 15,
  ...extra,
});
// The primer PROGRESSES (round-4 physio QA: 4/3/3 for twelve weeks is a
// third of McGill's usual dose) — one more 10-second hold from phase 2,
// never longer holds: 4/3/3 → 5/4/4 → 6/5/5 (the 45-minute cap, 2026-10-11).
const BIG3 = [
  CORE_CAP('mcgill-curlup', { phaseRepScheme: { 2: [5], 3: [6] } }),
  CORE_CAP('side-plank', {
    repScheme: [3],
    phaseRepScheme: { 2: [4], 3: [5] },
    perSide: true,
    switchSecs: 8,
  }),
  CORE_CAP('bird-dog', {
    repScheme: [3],
    phaseRepScheme: { 2: [4], 3: [5] },
    perSide: true,
    switchSecs: 8,
  }),
];

// THE CORE DAYS (2026-10-10, his ask: "we do need something core focused";
// round-5 physio QA: one set was a third of McGill's dose). Tue, Sat and Sun
// run the primer TWICE, McGill's descending way — a full set, then a shorter
// one — with the same 10-second holds, never longer ones. Thursday keeps one
// set: its back-extension hold is that day's core work, and its minutes are
// spoken for.
const BIG3_X2 = [
  CORE_CAP('mcgill-curlup', {
    repScheme: [4, 3],
    phaseRepScheme: { 2: [5, 3], 3: [6, 3] },
  }),
  CORE_CAP('side-plank', {
    repScheme: [3, 2],
    phaseRepScheme: { 2: [4, 2], 3: [5, 2] },
    perSide: true,
    switchSecs: 8,
  }),
  CORE_CAP('bird-dog', {
    repScheme: [3, 2],
    phaseRepScheme: { 2: [4, 2], 3: [5, 2] },
    perSide: true,
    switchSecs: 8,
  }),
];

// SATURDAY'S SPRINTS (2026-10-10, his ask: "conditioning — weekly sprints";
// shaped by the sprint QA). Every Saturday after the openers and the primer:
// a REAL sprint warm-up (drills, then strides at 70% and 80%), then short
// sprints on a clock long enough to walk back. Four formats rotate weekly
// (constantly varied, like the rest of his week); Flying — the highest
// hamstring demand — waits for phase 2. Progression is INTENSITY first
// (~80% → ~90% → ~95%, never all-out) plus one rep from phase 2. `ballistic`
// + `finisher`: a stiff, short-night, short or ramp morning skips it.
// No room to run → high knees in place, same seconds.
const SPRINT_FORMATS = [
  // name, sprints, seconds, clock, note
  ['Starts', 5, 4, 60, 'Split stance, four quick seconds (~20 m).'],
  ['Speed', 4, 6, 70, 'Build two seconds, then run tall.'],
  ['Repeats', 5, 5, 60, 'The last rep as fast as the first.'],
  ['Flying', 3, 8, 90, 'Jog in, build four seconds, four fast.'],
];
const SPRINT_EFFORT = ['~80%', '~90%', '~95%, never all-out'];
const SPRINTS = (w) => {
  const phase = w < 4 ? 1 : w < 8 ? 2 : 3;
  // phase 1 swaps Flying for a second Speed week
  const k = w % 4 === 3 && phase === 1 ? 1 : w % 4;
  const [name, base, secs, clock, how] = SPRINT_FORMATS[k];
  const n = base + (phase >= 2 ? 1 : 0);
  // Flying — the highest hamstring demand — never above ~90%
  const effort = name === 'Flying' ? '~90%' : SPRINT_EFFORT[phase - 1];
  return {
    mode: 'emom',
    name: `Sprints: ${name}`,
    formatLabel: 'SPRINTS',
    intervalSecs: clock,
    // three warm-up rounds on a 90 s clock: jog + drills, strides, one at
    // today's effort (round-6 QA: two thin rounds didn't prep 95%)
    warmupRounds: 3,
    warmupIntervalSecs: 90,
    rounds: 3 + n,
    changeoverSecs: 30, // shoes on, out the door
    members: [
      {
        ex: 'sprint',
        secs,
        phase: 'SPRINT',
        logWeight: false,
        warmupNotes: [
          'Jog easy, then leg swings and A-skips — ten each leg.',
          'Strides: one at 70%, walk back, one at 80%.',
          `One stride at ${effort}. Friday’s hamstrings sore? Keep today at ~80%.`,
        ],
        note: `${how} Effort ${effort}. Walk back.`,
        alts: [{ ex: 'high-knees', secs, logWeight: false }],
      },
    ],
  };
};

// ANTI-ROTATION (his "something core focused"): Sunday 2 × 8 a side with a
// three-second hold (ten a side in phase 3); Tuesday one set of 8 — its
// minutes already hold two McGill sets.
const PALLOF = {
  // a short / amber day keeps the McGill primer and lets this sit out
  cast: true,
  ex: 'pallof-press',
  mode: 'tempo',
  sets: 2,
  reps: 8,
  phaseBlockReps: { 3: 10 },
  perSide: true,
  switchSecs: 8,
  restSecs: 20,
  tempo: [
    ['PRESS', 1],
    ['HOLD', 3],
    ['BACK', 1],
  ],
};

// ── THE BACK & HIPS SHAPE (2026-10-10, his ask + physio QA) ─────────────────
// OPEN → BRACE → CONTRACT → FOLD. The hip and thoracic openers first (his
// "openings before contraction"), the McGill primer, the back extension —
// then the two forward folds LAST: held end-range flexion right before a
// loaded extension set leaves the spine temporarily less protected (ligament
// creep), so the folds come after the work, never before it.
// MORNING RULE: within an hour of waking the discs are fully hydrated and
// bending stress peaks — on those mornings, skip the two folds.
// Saturday's couch stretch moves to the END (round-6 physio QA): a minute of
// static hip-flexor stretch is the wrong thing right before sprints
const COUCH = { ...perSide('couch-stretch', 'BREATHE', 20), holdSecs: 60 };
const OPENERS = [
  // his thoracic ask — 10 slow reaches a side, finishing each one with the
  // chest open: the mid-back that hurts carrying the baby
  {
    ex: 't-spine-reach',
    mode: 'tempo',
    sets: 1,
    reps: 10,
    perSide: true,
    tempo: TSPINE_TEMPO,
  },
  // 60 s a side (round 4): the standard dose, and the minute it frees pays
  // for the McGill primer's progression
  COUCH,
  repped('hip-internal-rotation', 10, LIFT_SQUEEZE_LOWER(1, 2, 1), {
    perSide: true,
  }),
];
// `fold: true` — what an amber morning and the morning rule ("up less than
// an hour") drop. They close EVERY session, after the carry and the finisher
// too (round-3 physio QA): nothing loaded or scored after held flexion.
const CLOSERS = [
  {
    ...repped('elephant-walk', 24, [
      ['LEFT', 2],
      ['RIGHT', 2],
    ]),
    fold: true,
  },
  {
    ex: 'seated-good-morning',
    mode: 'hold',
    sets: 1,
    // 90 s (round-3 physio QA): the last thing before he picks up the baby
    // should not be two minutes of end-range seated flexion
    holdSecs: 90,
    phase: 'BREATHE',
    fold: true,
    // the last word of every session (round-5 physio QA): after held flexion
    // the ligaments need a few minutes before anything gets lifted
    note: 'Then stand, walk a minute and do a few gentle standing back-bends before you lift anything — the baby included.',
  },
];

// BACK EXTENSIONS 2×/WEEK (physio QA, major): 40 reps to a burn four days a
// week — rest day included — never let the extensors recover. Now Thu + Sat:
// never the morning after the RDL (Thursday is 72 h after Monday's hinge).
// THURSDAY HOLDS, SATURDAY REPS (2026-10-10, round-3 physio QA): Thursday is
// 24 h after Wednesday's front squat, so it gets the isometric — extensor
// endurance without another round of loaded flexion-extension. Saturday, 72 h
// after the squat and a day after Friday's split squats (no hinge, no axial
// bar), gets the reps at ~RPE 7. Both progress by phase. An amber morning
// holds on either day, shorter.
const EXT_HOLD = {
  cue: 'Hips on the bench end, ankles pinned, lift to straight and STAY there — glutes tight, ribs down, breathe. Never past straight.',
  how: 'No reps — hold level with the floor for the clock. Shaking is fine; the low back rounding ends the set.',
};
const BACK_EXTENSION_HOLD = (holdSecs, sets = 3) => ({
  ex: 'back-extension',
  mode: 'hold',
  sets,
  holdSecs,
  restSecs: 30,
  phase: 'HOLD',
  ...EXT_HOLD,
});
const BACK_EXTENSION = {
  ex: 'back-extension',
  mode: 'tempo',
  sets: 3,
  reps: 12,
  // it progresses (round-3 physio QA): 12 → 14 → 15 by phase
  phaseBlockReps: { 2: 14, 3: 15 },
  tempo: LIFT_SQUEEZE_LOWER(2, 1, 2),
  restSecs: 45,
  amberBlock: BACK_EXTENSION_HOLD(20),
  changeoverSecs: 30, // Saturday: back inside from the sprints
  // the morning rule holds instead of repping (round-5 physio QA: 3 × 12–15
  // from a hinged bottom is the bend the rule exists to avoid)
  morning: true,
};
const BACK_EXTENSION_THU = {
  ...BACK_EXTENSION_HOLD(30),
  // the hold grows by phase: 30 → 35 → 40 s
  phaseHoldSecs: { 2: 35, 3: 40 },
  amberBlock: BACK_EXTENSION_HOLD(20),
};

// A slot that serves different things on different rehab days. The calendar
// index is (w−1)·4 + k (Tue k=0, Thu 1, Sat 2), so position i of a 48-deep
// pool is day i%4 of week ⌊i/4⌋+1. `days` maps k → a block, or a function of
// the week index for things that rotate; a missing day sits the slot out.
// 48 deep = the whole 12-week block (round-4 coach QA: at 16 deep the pool
// wrapped every four weeks, so a per-PHASE rotation always read week 0–3)
const byDay = (days) =>
  Array.from({ length: 48 }, (_, i) => {
    const v = days[i % 4];
    return typeof v === 'function' ? v(i >> 2) : (v ?? null);
  });

// THE PUMPS (coach QA): the lift days' isolation work moved here — curls,
// triceps, rows, delts, calves — real sets, spine-quiet, chest-supported or
// lying wherever a back could get involved. No rep-out here: every round
// stops one or two reps short.
// No forced max-out every week (coach QA): pumps run the same "1–2 left"
// effort as the lift days' supersets; the lift days carry the rep-out weeks.
const PUMP = (name, members, opts = {}) => ({
  mode: 'circuit',
  name,
  isPiece: true,
  rounds: 3,
  betweenSecs: 10,
  restSecs: 40,
  formatLabel: 'SETS',
  ...opts,
  members,
});
const CALVES = PUMP(
  'Calves',
  [
    {
      ex: 'db-calf-raise',
      reps: '10/leg',
      note: 'One leg at a time, the DB in the same-side hand.',
    },
  ],
  { restSecs: 20 },
);

// Saturday's supporting move — the Movementgems cast, four of them, one a
// week. Long burn-holds are broken into short sets (physio QA: a 2-minute QL
// plank degrades into the low back sagging).
// ONE PER PHASE, four weeks each (round-4 QA: three phases serve three
// moves — the 90-90 push-up left the pool rather than never being served).
// Phase 1 stays the side-lying abduction; the QL plank — the one aimed at the
// pelvis and the curves — gets phase 2; the hip airplane phase 3.
const SAT_CAST = [
  repped(
    'side-hip-abduction',
    25,
    [
      ['LIFT', 2],
      ['LOWER', 2],
    ],
    { perSide: true, switchSecs: 12 },
  ),
  {
    ex: 'ql-plank',
    mode: 'hold',
    sets: 3,
    holdSecs: 20,
    perSide: true,
    switchSecs: 8,
    restSecs: 10,
    phase: 'HOLD',
  },
  repped(
    'hip-airplane',
    15,
    [
      ['OPEN', 3],
      ['CLOSE', 3],
    ],
    { perSide: true, switchSecs: 20 },
  ),
];
const topper = (name) => TOPPERS.find((t) => t.name === name);
// Sunday's optional WOD — the bear-crawl / raced-carry piece
// is out (his "regular movements" ask + physio QA); The Porter replaces it
const SUNDAY_WODS = [
  'The Classic',
  'The Porter',
  'The Chase',
  'The Century',
  // Saturday's old scored finishers live here now (2026-10-10): the sprints
  // took Saturday, and these are too good to lose. Opt-in, Good mornings only.
  'The Redline',
  'Death by Step-Ups',
  'The Climb',
].map(topper);
// short sets, not 2 minutes "close to cramping" in a long-sit (physio QA)
const SUNDAY_CAST = ['hip-flexor-lift', 'side-hip-adduction'].map((ex) => ({
  ex,
  mode: 'hold',
  sets: 3,
  holdSecs: 20,
  perSide: true,
  switchSecs: 8,
  restSecs: 10,
  phase: 'WORK',
}));

export const REHAB_SESSIONS = [
  {
    // REWORKED 2026-10-10 (physio + coach QA). Tue/Thu/Sat share the openers,
    // the McGill primer and the folds; the back extension runs Thu + Sat; the
    // day-specific work closes it: Tue core + arms + calves, Thu rows / delts
    // / calves, Sat sprints + supporting move + carries.
    // 2026-10-10 (his ask): Saturday's scored finisher became the sprints.
    id: 'daily',
    name: 'Back & Hips',
    freq: 'Tue · Thu · Sat',
    blurb:
      'Open up, brace, then work: hip and thoracic openers, the McGill Big 3 (twice on Tuesday, with the Pallof press), Saturday’s sprints, back extensions (Thu and Sat), then Tuesday’s arm pump, Thursday’s rows and delts, or Saturday’s carries — and the two forward folds last of all. Up less than an hour? The morning check skips the folds.',
    blocks: [
      // the openers, the couch stretch on Tue/Thu only (Saturday's waits
      // until after the sprints)
      OPENERS[0],
      { rotate: byDay({ 0: COUCH, 1: COUCH }) },
      OPENERS[2],
      // two McGill sets on Tuesday (+ the Pallof press); one on Thursday and
      // Saturday — Saturday's minutes go to a proper sprint warm-up
      ...BIG3.map((one, i) => ({
        rotate: byDay({ 0: BIG3_X2[i], 1: one, 2: one }),
      })),
      // Saturday's sprints: fresh, warm, before anything loads the back
      {
        finisher: true,
        conditioning: true,
        ballistic: true,
        rotate: byDay({ 2: (w) => SPRINTS(w) }),
      },
      {
        // the dose filters read the SLOT's flags, not the rotated spec's —
        // so `cast` lives here too, or a short Tuesday still served it
        cast: true,
        rotate: byDay({
          // two sets, ten a side in phase 3 (the 45-minute cap, 2026-10-11)
          0: PALLOF,
        }),
      },
      { rotate: byDay({ 1: BACK_EXTENSION_THU, 2: BACK_EXTENSION }) },
      // `cast` and `finisher` are what a SHORT / AMBER / RAMP day drops
      // first. `pump` marks the Tue/Thu volume a TIRED day keeps; the carry
      // and the sprints are not pumps, so a tired Saturday loses them.
      // one supporting move per PHASE, four weeks each (round-3 physio QA: a
      // weekly rotation met each move three times — too few to learn it)
      {
        cast: true,
        rotate: byDay({ 2: (w) => SAT_CAST[Math.floor(w / 4) % 3] }),
      },
      // `shortKeep`: a short or amber day keeps ONE round of this slot — every
      // move is supported or lying, so a stiff back tolerates it, and the
      // triangle stays alive through the newborn weeks (round-3 plan QA)
      {
        finisher: true,
        pump: true,
        shortKeep: true,
        rotate: byDay({
          // press BEFORE the extensions — tired triceps would cap the chest;
          // 15 s between: lay the next pair of DBs out before the first round
          0: PUMP(
            'Arms',
            [
              { ex: 'db-bench-press', reps: '10' },
              // reverse curl (round-6 coach QA): honest forearm work now the
              // wrist curl left — biceps still sit well over their floor
              { ex: 'reverse-curl', reps: '10' },
              { ex: 'lying-db-extension', reps: '10' },
              // the wrist curl left (2026-10-10): its four minutes pay for
              // Tuesday's second McGill set — forearms keep 10 from the
              // carries and hammer curls
            ],
            { rounds: 4, betweenSecs: 15 },
          ),
          // the row pairs with the raise, not the curl — a row already
          // works the biceps, so the curl gets fresh arms in the next pair
          1: PUMP(
            'Row & Raise',
            [
              {
                ex: 'chest-supported-row',
                reps: '10',
                alts: [{ ex: 'ring-row', reps: '10' }],
              },
              { ex: 'incline-y-raise', reps: '12' },
            ],
            { betweenSecs: 15 },
          ),
        }),
      },
      {
        finisher: true,
        rotate: byDay({
          2: {
            ex: 'farmer-carry',
            mode: 'hold',
            // two two-hand sets, then one suitcase set a side (round 5)
            sets: 2,
            holdSecs: 40,
            restSecs: 40,
            phase: 'CARRY',
            note: 'Short quick steps. Tall for all 40 s? Heavier DBs next time.',
          },
        }),
      },
      // ONE HAND, EACH SIDE (round-5 physio QA): with a double curve the
      // suitcase carry is the trunk's anti-lean training — McGill's own tool
      {
        finisher: true,
        rotate: byDay({
          2: {
            ex: 'suitcase-carry',
            mode: 'hold',
            sets: 1,
            holdSecs: 40,
            perSide: true,
            switchSecs: 30,
            restSecs: 40,
            phase: 'CARRY',
            note: 'Short quick steps; switch hands when the app says.',
          },
        }),
      },
      {
        finisher: true,
        pump: true,
        rotate: byDay({
          // four rounds: Thursday carries the side delts the triangle needs
          1: PUMP(
            'Curl & Lateral',
            [
              { ex: 'hammer-curl', reps: '10' },
              { ex: 'db-lateral-raise', reps: '12' },
            ],
            // five rounds (2026-10-11, the 45-minute cap): side delts off
            // their floor
            { rounds: 5, betweenSecs: 10 },
          ),
        }),
      },
      // Thursday's calves are two sets — the back extension moved there
      {
        finisher: true,
        pump: true,
        // three rounds both days again (2026-10-11, the 45-minute cap)
        rotate: byDay({ 0: CALVES, 1: CALVES }),
      },
      { rotate: byDay({ 2: COUCH }) },
      // the folds close the day — after every loaded and scored block
      ...CLOSERS,
    ],
  },
  {
    // THE REST DAY (2026-08-16, his ask; 2026-10-10 physio QA): genuinely
    // low-load now — the openers, the McGill primer, the folds and one
    // supporting move. No back extension, no clock, no score.
    id: 'sunday',
    name: 'Rest Day',
    freq: 'Sun',
    blurb:
      'Openers, the McGill Big 3 twice, the Pallof press, one easy extra and the forward folds — no back extensions, no clock, no score. Feeling fresh? The Bonus WOD is one tap away, and skipping it costs nothing.',
    blocks: [
      ...OPENERS,
      ...BIG3_X2,
      PALLOF,
      { rotate: SUNDAY_CAST, cast: true },
      ...CLOSERS,
    ],
  },
  {
    // Sunday's old mini-WOD column, opt-in. Audited as OPTIONAL — the weekly
    // volume floor is proven without it, so this is genuinely free fun, not
    // hidden homework.
    id: 'wod',
    name: 'The Bonus WOD',
    freq: 'Sun · optional',
    blurb:
      'Seven pieces in rotation — The Classic, The Porter, The Chase, The Century, The Redline, Death by Step-Ups, The Climb — one per week, only if you want it. Good mornings only.',
    blocks: [{ rotate: SUNDAY_WODS }],
  },
  {
    id: 'reset',
    name: 'Daily Reset',
    freq: 'Short days',
    blurb:
      'The ten-minute version. Wake the spine, then brace it — for a day the long program is not going to happen.',
    blocks: [
      // Opener — McGill's warm-up. Slow breath-paced cycles, nothing forced.
      {
        ex: 'cat-camel',
        mode: 'tempo',
        sets: 1,
        reps: 6,
        tempo: CATCAMEL_TEMPO,
      },
      // Mid-back mobility (added 2026-08-02): carrying the baby locks the
      // t-spine into flexion and his mid-back aches — restore rotation daily,
      // in the same all-fours position, before the bracing starts. The
      // postural-endurance side is covered 3×/wk by D40 (face pulls,
      // pull-aparts, rows, carries).
      {
        ex: 't-spine-reach',
        mode: 'tempo',
        sets: 1,
        reps: 4,
        tempo: TSPINE_TEMPO,
        perSide: true,
        switchSecs: 8,
      },
      // PROTOCOL: straight sets of 10s holds, 3s re-brace, rest at the
      // bottom of McGill's 20–30s band. Flattened from descending pyramids
      // 2026-08-02 (ladders bored him; the medicine is short crisp holds,
      // not the ladder shape). Progress by adding a rep per set (4-4 → 5-5),
      // never longer holds.
      {
        ex: 'mcgill-curlup',
        mode: 'reps',
        repScheme: [4, 4],
        holdSecs: 10,
        resetSecs: 3,
        restSecs: 20,
      },
      {
        ex: 'side-plank',
        mode: 'reps',
        repScheme: [3, 3],
        holdSecs: 10,
        resetSecs: 3,
        perSide: true,
        switchSecs: 8,
        restSecs: 20,
      },
      {
        ex: 'bird-dog',
        mode: 'reps',
        repScheme: [3, 3],
        holdSecs: 10,
        resetSecs: 3,
        perSide: true,
        switchSecs: 8,
        restSecs: 20,
      },
    ],
  },
  {
    id: 'open-up',
    name: 'Open Up',
    freq: 'Sun · the easy day',
    blurb:
      'Glutes awake, hamstrings and hip flexors long. Nothing hard — this is the day off that still counts.',
    // ADDED 2026-08-07 with the rehab trim. The glute bridges and the two
    // static stretches used to run EVERY day inside the rehab, which is where
    // a third of its length came from. They now land twice a week: once on
    // the leg half (d40-b1, warm and worked) and once here.
    //
    // Sunday was the only day light enough to take them — it was 10:12 of
    // rehab and two mark-done chips. With this it's ~19 min, still the
    // easiest day of the week by a wide margin, and it gives the week a real
    // low day instead of a blank one. Run it any other day too if the hips
    // feel tight; nothing here needs recovery.
    blocks: [BRIDGE_BLOCK, ...STRETCH_BLOCKS],
  },
  {
    id: 'engine',
    name: 'The Long Way',
    freq: 'Sun · steady, not hard',
    blurb:
      'Twelve minutes of easy, unbroken work. Conversational the whole way — if you are breathing hard you are doing it wrong.',
    // BUILT 2026-08-07. Sunday's engine slot had been a mark-done checkbox
    // since the beginning; this fills it. FIXED on purpose — no rotation pool,
    // no formats to learn. The week already carries all the variety it needs
    // (six sessions, six finishers, four metcon formats) and more would start
    // costing the progression tracking that rotation is known to blunt.
    //
    // Deliberately EASY. McGill's capacity model is sub-threshold bouts
    // repeated, not grinding: "if you will have pain on a 40-minute walk, just
    // walk 20 a couple of times per day." And concurrent-training interference
    // tracks DURATION harder than frequency (r up to -0.75 vs -0.35), so a
    // short steady piece costs the lifting nothing.
    //
    // Step-ups and carries only: both fail at the legs, lungs or grip with an
    // upright torso, so a Sunday that runs long can never turn into spinal
    // flexion. No rowing — the erg is the one "obviously safe" modality the
    // evidence contradicts here (~4.6x bodyweight compression at L4/L5, and
    // fatigue increases lumbar flexion at the catch).
    blocks: [
      {
        ex: 'box-step-up',
        mode: 'hold',
        sets: 2,
        holdSecs: 180,
        phase: 'STEADY',
        restSecs: 45,
        note: 'Easy pace, whole foot on the box, torso tall. You should be able to hold a conversation.',
      },
      {
        mode: 'circuit',
        rounds: 2,
        betweenSecs: 0,
        restSecs: 45,
        members: [{ ex: 'farmer-carry', secs: 60, phase: 'CARRY' }],
      },
    ],
  },
  {
    id: 'power',
    name: 'Power Primer',
    freq: 'Folded into Arms + Chest',
    blurb:
      'Bounce, leap, throw the floor away. Quiet-back days only — every rep crisp, stop while springy.',
    // POWER REINTRODUCTION (2026-08-03): the athletic layer his goals were
    // missing — power fades ~2× faster than strength with age, and none of
    // it lives in D40 or the rehab. Doses are deliberately tiny (quality
    // over quantity; ballistic work is never tempo-guided and never taken
    // near fatigue). DDD gate: symptom-free days only. Upgrade path when
    // gear arrives: med-ball rotational throws → here; KB swings → the hinge
    // slot, both only after a quiet month.
    //
    // NO LONGER ITS OWN DAY, and no longer shared with the lift days either
    // (2026-08-10): the full-body pieces now carry their own POWER() stations
    // inside the EMOM — a per-round micro-dose on a different clock, so the
    // doses are deliberately separate definitions now. This standalone
    // session stays so history entries and any paused run with rehabId
    // 'power' still resolve, and so the primer is runnable on its own if he
    // ever wants it off-schedule.
    blocks: POWER_BLOCKS,
  },
];

export const getRehabSession = (id) =>
  REHAB_SESSIONS.find((s) => s.id === id) || null;

// ─── The step engine ────────────────────────────────────────────────────────
// Lives in stepEngine.js so HOTMUM can drive it with its own exercises. Every
// name below was exported from this file before the 2026-08-05 extraction and
// still is — callers (src/main.js, the tests) were not touched.

const engine = createStepEngine({ ...REHAB_EXERCISES, ...PROGRAM_EXERCISES });

export const {
  sessionBlocks,
  sessionVariantCount,
  variantLabel,
  tempoSecsPerRep,
  buildStepQueue,
  sessionOverview,
  nextWorkLabel,
  tempoStateAt,
  sessionSetTotal,
  estimateSessionSecs,
  estimateSessionMins,
} = engine;
