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
// VARIETY: a block may be a rotation wrapper { rotate: [specA, specB, …] } —
// the app advances the active spec once per completed run of the session.
// A spec may be null: that variant simply skips the block. The daily session
// no longer uses one (the hinge slot was its only rotation); the mechanism
// stays for HOTMUM and future use.
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
    yt: 'mcgill curl up form',
  },
  'side-plank': {
    name: 'Side Plank',
    feel: 'The side of your waist holding you up',
    avoid: 'Hips sagging toward the floor',
    cue: 'Elbow under shoulder, hips tall. One straight line from ear to ankle.',
    why: 'Side-core stiffness with near-zero disc load.',
    yt: 'side plank mcgill big 3',
  },
  'bird-dog': {
    name: 'Bird Dog',
    feel: 'Glute + upper back, belly braced',
    avoid: 'Hips rotating as the leg reaches',
    cue: 'Opposite arm + leg out. Reach long, not high — hips stay square, spine stays still.',
    why: 'Back-side stiffness while the limbs move around a quiet spine.',
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
    yt: 'lying hamstring stretch',
  },
  'hip-flexor-stretch': {
    name: 'Hip Flexor Stretch',
    feel: 'Stretch across the front of the rear hip',
    avoid: 'Arching the low back to fake range',
    cue: 'Half-kneeling, tuck the tail, shift hips forward. Stretch in the front of the rear hip.',
    why: 'Tight hip flexors tilt the pelvis and cramp the hinge.',
    yt: 'half kneeling hip flexor stretch',
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

export const REHAB_SESSIONS = [
  {
    id: 'daily',
    name: 'Daily Reset',
    freq: 'Every day',
    blurb: 'Wake the spine, then brace it. Ten minutes, the same every day.',
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
    // NO LONGER ITS OWN DAY (2026-08-07, his call). POWER_BLOCKS now open
    // d40-a2 (Tue) and d40-c2 (Sat) — both anchor-free and axially quiet, so
    // it still lands fresh. This standalone session stays so history entries
    // and any paused run with rehabId 'power' still resolve, and so the
    // primer is runnable on its own if he ever wants it off-schedule. It
    // shares POWER_BLOCKS with the halves — one definition, one dose.
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
