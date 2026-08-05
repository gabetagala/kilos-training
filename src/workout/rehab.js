import { PROGRAM_EXERCISES } from './program.js';
import { createStepEngine } from './stepEngine.js';

// Rehab program + guided-session step engine — pure, no DOM, no storage.
// Unit-tested in tests/unit/rehab.test.js.
//
// The program is Gabe's DDD back protocol, dosed per the published protocols
// (researched 2026-07 — see PROTOCOL notes on each block). ONE session now:
// the old separate Hinge Day folded into the daily 2026-08 — one thing to
// do, the loaded hinge rotates in every other run.
// - Cat-camel: 6 slow unloaded cycles as the opener — McGill's own warm-up.
//   (Dead hangs opened the session until 2026-08 — hanging never clicked for
//   him. The def and demo stay only so an old paused session still restores.)
// - McGill Big 3: 8–10s isometric holds, ~3s re-brace between holds, 20–30s
//   rest between sets, per side for side plank/bird dog. FLATTENED 2026-08-02
//   from McGill's descending pyramids (5-3-1 etc.) to straight sets — the
//   ladders bored him and ate time, and the medicine is the short holds and
//   never grinding to fatigue, not the ladder shape. Progress by adding a
//   rep per set, never hold length. (Squat University's McGill write-up;
//   backfitpro.)
// - Glute work: CONTINUOUS tempo reps — lift 1s, squeeze 2s at top, lower
//   2s. Single-leg bridges, one side at a time (kickbacks tried 2026-07,
//   dropped 2026-08: same-position single-leg bridges activate better for
//   him, and each hip works alone so the strong side can't cover).
// - RDL: self-paced light sets, slow eccentric, hinge quality over load.
// - Static stretches: 30s holds × 2/side (evidence sweet spot; more adds little).
//
// VARIETY: a block may be a rotation wrapper { rotate: [specA, specB, …] } —
// the app advances the active spec once per completed run of the session
// (A/B days). A spec may be null: that variant simply skips the block. The
// McGill Big 3 stay fixed on purpose (the repetition IS the protocol —
// grooving the same motor pattern daily); only the hinge slot rotates.
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

// Tempo pattern for the glute bridge: [label, seconds] per sub-phase.
const BRIDGE_TEMPO = [
  ['LIFT', 1],
  ['SQUEEZE', 2],
  ['LOWER', 2], // the eccentric is the point — 1s read as a drop, not a lower
];

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
    blurb:
      'Wake the spine, brace it, open it. The barbell joins every other run.',
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
      // PROTOCOL: continuous tempo reps — 1s up, 2s squeeze, 2s down, one
      // side at a time. Single-leg bridges replaced kickbacks 2026-08: same
      // position as a bridge, but each hip lifts alone — the activation he
      // actually feels, and the strong side can't cover for the weak one.
      // 8/side (not the two-leg 10): one leg carries double the load.
      {
        ex: 'single-leg-bridge',
        mode: 'tempo',
        sets: 2,
        reps: 8,
        tempo: BRIDGE_TEMPO,
        perSide: true,
        switchSecs: 8,
        restSecs: 25,
      },
      // THE HINGE SLOT — the old Hinge Day, folded in 2026-08 so there is
      // exactly one thing to do. When it's on, it's RDLs — his call
      // (suitcase carries tried 2026-08, cut the same week). It sits out
      // every other run: daily loaded hinging gives the back no recovery
      // day, and every other run at near-daily cadence ≈ 3×/week — the
      // evidence dose. A days go straight from bridges to the stretches.
      {
        rotate: [
          null, // A — recovery run, barbell-free
          {
            ex: 'rdl',
            mode: 'lift',
            sets: 3,
            reps: 8,
            restSecs: 90,
            note: 'Add load only if the last hinge day stayed quiet.',
          },
        ],
      },
      // The close he'd do extra of — both stretches, every run.
      {
        ex: 'hamstring-stretch',
        mode: 'hold',
        sets: 2,
        holdSecs: 30,
        perSide: true,
        switchSecs: 8,
        restSecs: 10,
      },
      {
        ex: 'hip-flexor-stretch',
        mode: 'hold',
        sets: 2,
        holdSecs: 30,
        perSide: true,
        switchSecs: 8,
        restSecs: 10,
      },
    ],
  },
  {
    id: 'power',
    name: 'Power Primer',
    freq: '2× a week',
    blurb:
      'The fast stuff on the days you don’t lift: bounce, leap, throw the floor away. Quiet-back days only — every rep crisp, stop while springy.',
    // POWER REINTRODUCTION (2026-08-03): the athletic layer his goals were
    // missing — power fades ~2× faster than strength with age, and none of
    // it lives in D40 or the rehab. Doses are deliberately tiny (quality
    // over quantity; ballistic work is never tempo-guided and never taken
    // near fatigue). Scheduled on REHAB-ONLY days (Tue/Thu — his call
    // 2026-08-04), right after the daily rehab warms him up. DDD gate:
    // symptom-free days only. Upgrade path when gear arrives: med-ball
    // rotational throws → this session; KB swings → the hinge slot, both
    // only after a quiet month.
    blocks: [
      // Elasticity first — short ground contact, spine tall.
      {
        ex: 'pogo-hop',
        mode: 'hold',
        phase: 'BOUNCE',
        sets: 2,
        holdSecs: 15,
        restSecs: 40,
      },
      // Hip power — jump far, land stuck and silent.
      {
        mode: 'circuit',
        rounds: 3,
        restSecs: 60,
        members: [{ ex: 'broad-jump', reps: '3', logWeight: false }],
      },
      // Upper-body speed — the set ends when the pop fades.
      {
        mode: 'circuit',
        rounds: 3,
        restSecs: 60,
        members: [{ ex: 'power-pushup', reps: '3–5', logWeight: false }],
      },
    ],
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
