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
// The method, from the PDF, and it governs everything below:
//   - Every exercise except the stretches chases a 10/10 BURN and 0/10 PAIN.
//     Never work through pain — find today's pain-free level instead.
//   - Breaking mid-set at a true 10/10 burn is expected. Rest, then continue.
//   - The progression trigger is ENDURANCE, not load: hold the full duration
//     unbroken, then take the next step on that movement's ladder and start
//     over. Ladders live on each exercise as `scale`.
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
    cue: 'On all fours. Sweep one arm up to the ceiling, eyes following the hand. Slow — turn from the mid-back.',
    why: 'Restores the mid-back rotation the baby-carry posture steals — stiff there, and the low back and shoulders pay.',
    yt: 'quadruped thoracic rotation',
  },
  'mcgill-curlup': {
    name: 'McGill Curl-Up',
    feel: 'Front abs bracing — neck stays easy',
    avoid: 'Chin tucking, spine bending to lift',
    cue: 'Hands under the low back, one knee bent. Lift head + shoulders barely off the floor — the spine never bends.',
    why: 'Front-side stiffness without spine flexion.',
    scale: 'Harder: elbows hovering → hands off the floor → pre-tense the abs hard before each lift',
    yt: 'mcgill curl up form',
  },
  'side-plank': {
    name: 'Side Plank',
    feel: 'The side of your waist holding you up',
    avoid: 'Hips sagging toward the floor',
    cue: 'Elbow under shoulder, hips tall. One straight line from ear to ankle.',
    why: 'Side-core stiffness with near-zero disc load.',
    scale: 'Easier: from the knees · Harder: feet stacked → top leg raised → weighted vest',
    yt: 'side plank mcgill big 3',
  },
  'bird-dog': {
    name: 'Bird Dog',
    feel: 'Glute + upper back, belly braced',
    avoid: 'Hips rotating as the leg reaches',
    cue: 'Opposite arm + leg out. Reach long, not high — hips stay square, spine stays still.',
    why: 'Back-side stiffness while the limbs move around a quiet spine.',
    scale: 'Easier: leg only · Harder: slow square with hand + foot → wrist/ankle weights',
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
    // Standing + loaded is the one place the leg-length difference matters —
    // train with the same correction you walk with.
    cue: 'Shoe lift on. Soft knees, hips straight back, bar close — three seconds down, flat back.',
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
    cue: 'Swing the arms, jump FAR, land in a quiet half-squat and stick it. Full reset between jumps.',
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
    how: 'Small lifts, one after another — no counting, the clock is the set. 10/10 burn = pause, resume.',
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
    how: 'Slow turns — open, then closed, no counting. Keep moving until the beep.',
    yt: 'hip airplane exercise',
  },
  'side-hip-abduction': {
    name: 'Side Hip Abduction',
    feel: 'Burn on the outside of the top hip',
    avoid: 'Rolling the hips back, or leading with the toes',
    cue: 'Lie on your side, body in one line. Lift the top leg up and slightly back, toes level. No rolling.',
    why: 'Glute-med endurance — the muscle that keeps the pelvis level every step you take.',
    scale: 'Easier: body weight · Harder: ankle weight',
    how: 'Steady lifts, ~2s up, ~2s down — no target. Break at a true 10/10 burn, then back on.',
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
    feel: 'The front of the hip close to cramping — that is the point',
    avoid: 'Leaning back to buy height',
    cue: 'Sit on the floor, legs long, sit tall. Lift one straight leg as high as it will go and hold it there — hands off it.',
    why: 'Trains the hip flexor short and strong so it stops yanking the pelvis into a tilt.',
    scale: 'Easier: body weight · Harder: ankle weight, or swap in an L-sit',
    how: 'Lift and hold it there. When the leg drops: shake out, lift again. The clock keeps score.',
    yt: 'seated straight leg hip flexor lift',
  },
  'ql-plank': {
    name: 'QL Plank',
    feel: 'The side of the low back and the top of the hip',
    avoid: 'Hips sagging, or the bottom shoulder collapsing',
    cue: 'On your side, elbow under the shoulder, legs stacked. Drive the hips high and hold — the burn belongs in the side of your low back.',
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
    why: 'Four minutes of front-core endurance — the thing that stops the spine borrowing range under load.',
    scale: 'Easier: body weight · Harder: weighted vest',
    how: 'One hold. Break when you must, get straight back on — total time under tension is the set.',
    yt: 'plank form',
  },
  'back-extension': {
    name: 'Back Extension',
    feel: 'Low back and glutes working together, all the way through',
    avoid: 'Hyperextending past straight at the top',
    cue: 'Hips at the pad, spine long. Lower under control, lift to straight — never past it. No chair? Hips on the bench end, ankles hooked under the low-racked bar. Simplest: lie face down and hold.',
    why: 'The single biggest lever on a back that hurts: extensors with real endurance.',
    scale:
      'Easier: isometric hold · Harder: reps → + vest → single-leg hold → single-leg reps',
    how: 'Slow reps, ~3s each, no target — the clock is the set. At a 10/10 burn: breathe, then back on.',
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
    how: 'Slow reps, ~3s up, ~3s down — no target, the clock is the set. 10/10 burn = breathe, resume.',
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
    how: 'No reps — sink in, squeeze the back glute, breathe slow. Effort 0/10.',
    yt: 'couch stretch form',
  },
  'elephant-walk': {
    name: 'Elephant Walk',
    feel: 'Hamstrings taking turns, one long pull at a time',
    avoid:
      'Rounding the low back to reach the floor — raise your hands instead',
    cue: 'Hinge over, hands on the floor or a box, legs near-straight. Bend one knee and straighten the other, then swap. Keep walking.',
    why: 'Hamstring length earned through movement, without one second of spinal flexion.',
    scale:
      'Easier: hands on a higher surface · Harder: hands lower, then floor',
    how: 'Keep walking the whole time, one leg then the other. Nothing to count, no burn to chase.',
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
    cue: 'Sit on the bench, feet planted wide, arms crossed on your chest. Hinge forward from the hips with a LONG spine to where the stretch bites, and breathe there. Stop the moment the back wants to round.',
    why: 'The hip hinge, learned unloaded — the pattern every lift in this program depends on, stretched into the hamstrings from a dead-safe seat.',
    scale:
      'Easier: hands on thighs, smaller fold · Harder: deeper fold, arms crossed',
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

const straight = (ex, phase) => ({
  ex,
  mode: 'hold',
  sets: 1,
  holdSecs: MINS(4),
  phase,
});

// ── THE FINISHERS ───────────────────────────────────────────────────────────
// 2026-08-14: the strict topper EMOMs (a fourth lift day in disguise) became
// four metcon-shaped finishers. 2026-08-15: the pool grew to SIXTEEN — see
// the block below, which is the live spec. AXIALLY QUIET by rule
// (verifier-enforced, all modes): bands, light DBs, bodyweight — the barbell
// and the pulley stay untouched, because these days sit between the heavy
// ones on purpose. Core rides the McGill core cap that CLOSES every rehab
// day, at protocol dose — never a plank minute squeezed into an EMOM.
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
          { ex: 'elevated-pushup', repScheme: [16, 12, 8, 4], logWeight: false },
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
  {
    mode: 'fortime',
    name: 'Crawl & Haul',
    rounds: 6,
    note: 'Crawl a length, carry back. At each wall: stop, plant, TURN — never twist through it. Score = time.',
    members: [
      { ex: 'bear-crawl', reps: '1 length', logWeight: false },
      { ex: 'farmer-carry', reps: '1 length' },
    ],
  },
  // ── week C ────────────────────────────────────────────────────────────
  {
    mode: 'emom',
    name: 'The Porter',
    formatLabel: 'EMOM',
    rounds: 2,
    note: 'Forty seconds loaded, twenty to breathe. DBs come off the BENCH. Score = total garage lengths.',
    scorePrompt: {
      title: 'THE PORTER — GARAGE LENGTHS',
      sub: 'Total lengths carried across all eight minutes.',
      unit: 'lengths',
      def: 16,
      min: 0,
      max: 60,
    },
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
        repsPerRound: ['10', '14', '18', '22', '26', '30', '34', '38', '42', '46'],
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
    mode: 'emom',
    name: 'The Complex',
    formatLabel: 'EMOM',
    rounds: 4,
    // Alternating minutes since the 2026-08-16 QA: eight straight minutes of
    // a ballistic flow was the grindiest EMOM in the pool, and its week ran
    // rear delts at 7 — the band minute keeps every complex minute crisp AND
    // feeds the 3-D shoulder. Same eight-minute clock: 4 rounds × 2 members.
    note: 'Odd minutes one flow, never set down: hang clean, ride, press — the load is the score. Even minutes, pull the band apart and breathe.',
    members: [
      { ex: 'db-hang-clean-press', reps: '6' },
      { ex: 'band-pull-apart', reps: '14', logWeight: false },
    ],
  },
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

// ── THE CORE CAP ────────────────────────────────────────────────────────────
// Every rehab day ends here: the McGill work at its own protocol (straight
// sets of 10s holds, 3s re-brace — same dosing as the Daily Reset), one
// movement per day, calendar-pinned. This replaces the core minute the old
// topper EMOMs carried, with better quality per rep.
const CORE_CAP = (ex, extra = {}) => ({
  ex,
  mode: 'reps',
  repScheme: [4, 4],
  holdSecs: 10,
  resetSecs: 3,
  restSecs: 20,
  ...extra,
});

const CAP_CURL = () => CORE_CAP('mcgill-curlup');
const CAP_SIDE = () =>
  CORE_CAP('side-plank', { repScheme: [3, 3], perSide: true, switchSecs: 8 });
const CAP_BIRD = () =>
  CORE_CAP('bird-dog', { repScheme: [3, 3], perSide: true, switchSecs: 8 });
const CAP_PLANK = () => CORE_CAP('plank');
// A 16-slot Latin square, aligned with the finisher pool's stride: every
// weekday cycles through ALL FOUR McGill moves across the month instead of
// serving the same one forever ("pogo hops and bird dog" — his 2026-08-15
// review of a Saturday that never changed its cap).
// Since the Sunday split (2026-08-16) the 'daily' session only ever serves
// the k∈{0,1,2} columns of this square — the k=3 column moved to the
// 'sunday' session below, extracted so the month's coverage is unchanged.
const CORE_CAPS = [
  CAP_CURL(), CAP_SIDE(), CAP_BIRD(), CAP_PLANK(),
  CAP_SIDE(), CAP_BIRD(), CAP_PLANK(), CAP_CURL(),
  CAP_BIRD(), CAP_PLANK(), CAP_CURL(), CAP_SIDE(),
  CAP_PLANK(), CAP_CURL(), CAP_SIDE(), CAP_BIRD(),
];

// ── THE SUNDAY SPLIT (2026-08-16, his ask: "rest days on Sundays") ──────────
// Sunday used to be the FOURTH full rehab day — and the finisher stride made
// it the hardest one: its column of the pool was all mini-WODs. His QA ask
// was explicit, so the day split in two:
//   'sunday' — the same holds, NOTHING else. Medicine, not training: no
//              finisher, no clock to race, no score. The back program keeps
//              its four weekly exposures (the dose that wins the argument);
//              the training week is genuinely six days.
//   'wod'    — Sunday's old mini-WOD column, now OPT-IN (audited as optional,
//              same as Open Up and The Long Way). Feeling fresh is the only
//              reason to open it.
// The stride math is untouched for Tue/Thu/Sat: 'daily' keeps its 16-deep
// pool and (w−1)·4+k indexing with k∈{0,1,2}, which never lands on the
// k≡3 (mod 4) entries — those four live in SUNDAY_WODS.
const SUNDAY_WODS = [3, 7, 11, 15].map((i) => TOPPERS[i]);

// Sunday's columns of the two 'daily' rotations, extracted verbatim so the
// calendar-pinned month serves exactly what it served before the split:
// supporting cast (w−1)·4+3 mod 8 only ever hit indices 3 and 7, and the
// core-cap column is the Latin square's k=3 stripe.
const SUNDAY_CAST = [
  perSide('hip-flexor-lift', 'WORK'),
  perSide('side-hip-adduction', 'WORK', 12),
];
const SUNDAY_CAPS = [CAP_PLANK(), CAP_CURL(), CAP_SIDE(), CAP_BIRD()];

// The distillate holds, shared by 'daily' and 'sunday' — six fixed blocks,
// defined once so the dose can never drift between the two sessions.
const DISTILLATE_BLOCKS = [
  // his thoracic ask — 12 slow reaches a side is a real two minutes
  {
    ex: 't-spine-reach',
    mode: 'tempo',
    sets: 1,
    reps: 12,
    perSide: true,
    tempo: TSPINE_TEMPO,
  },
  straight('back-extension', 'WORK'),
  perSide('hip-internal-rotation', 'WORK'),
  perSide('couch-stretch', 'BREATHE', 20),
  straight('elephant-walk', 'WORK'),
  {
    ex: 'seated-good-morning',
    mode: 'hold',
    sets: 1,
    holdSecs: MINS(2),
    phase: 'BREATHE',
  },
];

export const REHAB_SESSIONS = [
  {
    // REBUILT 2026-08-11 (his call): the 48-minute twelve-movement program
    // became a ~25-minute DISTILLATE of the pieces he loves and the levers
    // that matter most, plus the topper. What stays daily (4×/wk): thoracic
    // rotation, back-extension endurance, hip internal rotation, the couch
    // stretch, the elephant walk, and the seated good morning. The other
    // SEVEN source movements share one rotating slot — each comes up about
    // once every two weeks instead of four times a week. Stated plainly:
    // that is a real dose cut to the supporting cast, traded for a session
    // he'll actually do forever. The long-hold mechanism is untouched — one
    // unbroken set per movement, burn to 10/10, pain at 0/10.
    id: 'daily',
    name: 'Back & Hips',
    freq: 'Tue · Thu · Sat',
    blurb:
      'The holds that matter, ~25 minutes — then a finisher from a sixteen-deep rotation: for time, death-by, Tabata, AMRAP — and the core cap to close. On the holds: 10/10 burn, 0/10 pain; unbroken means take the next progression.',
    blocks: [
      ...DISTILLATE_BLOCKS,
      // the supporting cast, one per day, rotating — nothing dies, everything
      // thins: ~1 exposure per two weeks each. Sunday's two columns (indices
      // 3 and 7) still live here so paused pre-split sessions restore, but
      // the Tue/Thu/Sat stride never reaches them — SUNDAY_CAST serves them.
      {
        rotate: [
          perSide('ql-plank', 'HOLD', 12),
          perSide('side-hip-abduction', 'WORK', 12),
          perSide('90-90-pushup', 'WORK', 20),
          perSide('hip-flexor-lift', 'WORK'),
          perSide('hip-airplane', 'WORK', 20),
          straight('plank', 'HOLD'),
          straight('wall-groin-stretch', 'BREATHE'),
          perSide('side-hip-adduction', 'WORK', 12),
        ],
      },
      { rotate: TOPPERS },
      { rotate: CORE_CAPS },
    ],
  },
  {
    // THE REST DAY (2026-08-16, his ask). The same medicine 'daily' opens
    // with — and then it ends. No finisher, no clock to race, no score to
    // beat: the one day of the week that asks nothing of him but breathing.
    // The back program keeps its 4×/week dose; the TRAINING week is six days.
    id: 'sunday',
    name: 'Rest Day',
    freq: 'Sun',
    blurb:
      'The holds and nothing else — no finisher, no clock, no score. Medicine, not training. Feeling fresh? The Bonus WOD is one tap away, and skipping it costs nothing.',
    blocks: [
      ...DISTILLATE_BLOCKS,
      { rotate: SUNDAY_CAST },
      { rotate: SUNDAY_CAPS },
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
      'The Classic, Crawl & Haul, The Chase, The Century — one per week, only if you want it. Beat last month’s score or just move.',
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
