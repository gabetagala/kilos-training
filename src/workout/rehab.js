// Rehab program + guided-session step engine — pure, no DOM, no storage.
// Unit-tested in tests/unit/rehab.test.js.
//
// The program is Gabe's DDD back protocol, dosed per the published protocols
// (researched 2026-07 — see PROTOCOL notes on each block):
// - McGill Big 3: 8–10s isometric holds in a DESCENDING PYRAMID (5-3-1 to
//   start; progress by adding reps, never hold length), ~3s re-brace between
//   holds, 20–30s rest between sets, pyramid per side for side plank/bird dog.
//   (Squat University's McGill write-up; backfitpro.)
// - Dead hang: 15–30s hangs × 3–4 sets, accumulate 60–90s/day, real rest
//   between hangs.
// - Glute bridge: CONTINUOUS tempo reps — lift 1s, squeeze 2s at top, lower
//   1s; 10 reps × 2 sets. Not hold-and-reset.
// - RDL: self-paced light sets, slow eccentric, hinge quality over load.
// - Static stretches: 30s holds × 2/side (evidence sweet spot; more adds little).
//
// A session is a list of BLOCKS; buildStepQueue() expands blocks into a flat
// queue of STEPS the player walks through one at a time:
//   { kind: 'prep'|'work'|'rest', exId, secs, phase, meta, side, manual,
//     logWeight, tempo, countsAsSet }
// Block modes:
//   hold  — one timed hold per set (hang, side plank, stretches)
//   reps  — one timed hold PER REP with a short re-brace between (McGill),
//           reps per set via repScheme (descending pyramid), per side optional
//   tempo — one continuous timed set; the player derives the live rep count
//           and sub-phase (LIFT/SQUEEZE/LOWER) from step.tempo
//   lift  — self-paced barbell set, athlete taps done, logs weight
// - secs: countdown length; null ⇒ manual step (user taps "Set done").
// - countsAsSet: marks the step that completes one logical set (per side).

export const REHAB_EXERCISES = {
  'dead-hang': {
    name: 'Dead Hang',
    cue: 'Grip the bar, feet off the floor, let everything go loose. Slow breaths.',
    why: 'Decompression — the "opened up" feeling in the lower back.',
    yt: 'dead hang lower back decompression',
  },
  'mcgill-curlup': {
    name: 'McGill Curl-Up',
    cue: 'Hands under the low back, one knee bent. Lift head + shoulders barely off the floor — the spine never bends.',
    why: 'Front-side stiffness without spine flexion.',
    yt: 'mcgill curl up form',
  },
  'side-plank': {
    name: 'Side Plank',
    cue: 'Elbow under shoulder, hips tall. One straight line from ear to ankle.',
    why: 'Side-core stiffness with near-zero disc load.',
    yt: 'side plank mcgill big 3',
  },
  'bird-dog': {
    name: 'Bird Dog',
    cue: 'Opposite arm + leg out. Reach long, not high — hips stay square, spine stays still.',
    why: 'Back-side stiffness while the limbs move around a quiet spine.',
    yt: 'bird dog exercise mcgill',
  },
  'glute-bridge': {
    name: 'Glute Bridge',
    cue: 'Drive through the heels — up, squeeze two seconds, lower slow. Ribs down.',
    why: 'Wakes up glutes that under-fire, so the low back stops compensating.',
    yt: 'glute bridge form',
  },
  rdl: {
    name: 'Romanian Deadlift',
    // Standing + loaded is the one place the leg-length difference matters —
    // train with the same correction you walk with.
    cue: 'Shoe lift on. Soft knees, hips straight back, bar close — three seconds down, flat back.',
    why: 'Retrains the hip hinge so the hips lift, not the spine.',
    yt: 'romanian deadlift form',
  },
  'single-leg-bridge': {
    name: 'Single-Leg Bridge',
    cue: 'One foot down, other leg straight and in line with your body. Drive through the heel — hips stay level.',
    why: 'Each hip works alone — the strong side can’t cover for the weak one.',
    yt: 'single leg glute bridge form',
  },
  'hamstring-stretch': {
    name: 'Hamstring Stretch',
    cue: 'On your back, one leg up, hands behind the thigh. Gentle pull — breathe into it.',
    why: 'Tight hamstrings drag the pelvis and load the low back.',
    yt: 'lying hamstring stretch',
  },
  'hip-flexor-stretch': {
    name: 'Hip Flexor Stretch',
    cue: 'Half-kneeling, tuck the tail, shift hips forward. Stretch in the front of the rear hip.',
    why: 'Tight hip flexors tilt the pelvis and cramp the hinge.',
    yt: 'half kneeling hip flexor stretch',
  },
};

// Tempo pattern for the glute bridge: [label, seconds] per sub-phase.
const BRIDGE_TEMPO = [
  ['LIFT', 1],
  ['SQUEEZE', 2],
  ['LOWER', 1],
];

export const REHAB_SESSIONS = [
  {
    id: 'daily',
    name: 'Daily Reset',
    freq: 'Every day',
    blurb: 'Decompress, then the McGill Big 3 and glutes. The non-negotiable.',
    blocks: [
      // PROTOCOL: 3 hangs of 25s = 75s total (60–90s band), real rest between.
      { ex: 'dead-hang', mode: 'hold', sets: 3, holdSecs: 25, restSecs: 45 },
      // PROTOCOL: McGill descending pyramid 5-3-1, 10s holds, 3s re-brace,
      // 25s between sets. Progress by ADDING REPS (6-4-2, 8-6-4), not longer holds.
      {
        ex: 'mcgill-curlup',
        mode: 'reps',
        repScheme: [5, 3, 1],
        holdSecs: 10,
        resetSecs: 3,
        restSecs: 25,
      },
      // PROTOCOL: pyramid per side, 10s holds. 3-2-1 to start; build toward 5-3-1.
      {
        ex: 'side-plank',
        mode: 'reps',
        repScheme: [3, 2, 1],
        holdSecs: 10,
        resetSecs: 3,
        perSide: true,
        switchSecs: 10,
        restSecs: 25,
      },
      {
        ex: 'bird-dog',
        mode: 'reps',
        repScheme: [3, 2, 1],
        holdSecs: 10,
        resetSecs: 3,
        perSide: true,
        switchSecs: 10,
        restSecs: 25,
      },
      // PROTOCOL: continuous tempo reps — 1s up, 2s squeeze, 1s down × 10.
      {
        ex: 'glute-bridge',
        mode: 'tempo',
        sets: 2,
        reps: 10,
        tempo: BRIDGE_TEMPO,
        restSecs: 30,
      },
    ],
  },
  {
    id: 'hinge',
    name: 'Hinge Day',
    freq: '3× a week',
    blurb:
      'Load the hinge, then open the tight bits. Add weight only if the back stayed quiet.',
    blocks: [
      { ex: 'rdl', mode: 'lift', sets: 3, reps: 8, restSecs: 90 },
      // PROTOCOL: per-side tempo bridges for the leg-length asymmetry — each
      // hip loads alone so the left can't compensate for the smaller right.
      {
        ex: 'single-leg-bridge',
        mode: 'tempo',
        sets: 2,
        reps: 6,
        tempo: BRIDGE_TEMPO,
        perSide: true,
        switchSecs: 10,
        restSecs: 30,
      },
      {
        ex: 'hamstring-stretch',
        mode: 'hold',
        sets: 2,
        holdSecs: 30,
        perSide: true,
        switchSecs: 10,
        restSecs: 15,
      },
      {
        ex: 'hip-flexor-stretch',
        mode: 'hold',
        sets: 2,
        holdSecs: 30,
        perSide: true,
        switchSecs: 10,
        restSecs: 15,
      },
    ],
  },
];

export const getRehabSession = (id) =>
  REHAB_SESSIONS.find((s) => s.id === id) || null;

const PREP_SECS = 10;
const SIDES = ['LEFT', 'RIGHT'];

// Seconds assumed for one manual (self-paced) lift set, for duration estimates.
const MANUAL_SET_EST_SECS = 35;

export const tempoSecsPerRep = (tempo) =>
  tempo.reduce((sum, [, secs]) => sum + secs, 0);

const blockScheme = (block) =>
  block.repScheme || Array(block.sets || 1).fill(block.reps || 1);

function prepStep(exId) {
  return {
    kind: 'prep',
    exId,
    secs: PREP_SECS,
    phase: 'GET SET',
    meta: 'UP NEXT',
  };
}

function restStep(exId, secs, phase, meta) {
  return { kind: 'rest', exId, secs, phase, meta };
}

// One set for a single side (or both-sides when side is null).
function pushSetWork(steps, block, setIdx, totalSets, side) {
  const sideSuffix = side ? ` · ${side}` : '';
  const setMeta = `SET ${setIdx + 1} OF ${totalSets}${sideSuffix}`;

  if (block.mode === 'reps') {
    const reps = blockScheme(block)[setIdx];
    for (let rep = 1; rep <= reps; rep++) {
      steps.push({
        kind: 'work',
        exId: block.ex,
        secs: block.holdSecs,
        phase: 'HOLD',
        meta: `REP ${rep} OF ${reps}${sideSuffix}`,
        side,
        rep,
        countsAsSet: rep === reps,
      });
      if (rep < reps && block.resetSecs) {
        steps.push(restStep(block.ex, block.resetSecs, 'BREATHE', setMeta));
      }
    }
    return;
  }

  if (block.mode === 'tempo') {
    const secsPerRep = tempoSecsPerRep(block.tempo);
    steps.push({
      kind: 'work',
      exId: block.ex,
      secs: block.reps * secsPerRep,
      phase: 'GO',
      meta: setMeta,
      side,
      tempo: { reps: block.reps, secsPerRep, pattern: block.tempo },
      countsAsSet: true,
    });
    return;
  }

  // hold
  steps.push({
    kind: 'work',
    exId: block.ex,
    secs: block.holdSecs,
    phase: 'HOLD',
    meta: setMeta,
    side,
    countsAsSet: true,
  });
}

export function buildStepQueue(session) {
  const steps = [];
  for (const block of session.blocks) {
    steps.push(prepStep(block.ex));

    if (block.mode === 'lift') {
      for (let set = 1; set <= block.sets; set++) {
        steps.push({
          kind: 'work',
          exId: block.ex,
          secs: null,
          manual: true,
          logWeight: true,
          phase: 'YOUR PACE',
          meta: `SET ${set} OF ${block.sets} · ${block.reps} REPS`,
          reps: block.reps,
          countsAsSet: true,
        });
        if (set < block.sets) {
          steps.push(
            restStep(block.ex, block.restSecs, 'REST', `SET ${set + 1} NEXT`),
          );
        }
      }
      continue;
    }

    const totalSets = blockScheme(block).length;
    const sides = block.perSide ? SIDES : [null];
    for (let setIdx = 0; setIdx < totalSets; setIdx++) {
      sides.forEach((side, si) => {
        pushSetWork(steps, block, setIdx, totalSets, side);
        if (si < sides.length - 1) {
          steps.push(
            restStep(
              block.ex,
              block.switchSecs || 10,
              'SWITCH SIDES',
              `${SIDES[si + 1]} NEXT`,
            ),
          );
        }
      });
      if (setIdx < totalSets - 1 && block.restSecs) {
        steps.push(
          restStep(block.ex, block.restSecs, 'REST', `SET ${setIdx + 2} NEXT`),
        );
      }
    }
  }
  return steps;
}

// What the athlete should read during a rest/prep step: the next thing to do.
export function nextWorkLabel(queue, idx) {
  for (let i = idx + 1; i < queue.length; i++) {
    if (queue[i].kind !== 'work') continue;
    const s = queue[i];
    const name = REHAB_EXERCISES[s.exId]?.name || s.exId;
    return s.side ? `${name} · ${s.side}` : name;
  }
  return 'FINISH';
}

// Live sub-state of a tempo step at `elapsedMs`: current rep and sub-phase
// label (LIFT / SQUEEZE / LOWER). Pure so it's testable.
export function tempoStateAt(tempo, elapsedMs) {
  const perRep = tempo.secsPerRep * 1000;
  const clamped = Math.max(0, Math.min(elapsedMs, tempo.reps * perRep - 1));
  const rep = Math.floor(clamped / perRep) + 1;
  let into = (clamped % perRep) / 1000;
  for (const [label, secs] of tempo.pattern) {
    if (into < secs) return { rep, label };
    into -= secs;
  }
  return { rep, label: tempo.pattern[tempo.pattern.length - 1][0] };
}

export function sessionSetTotal(session) {
  return buildStepQueue(session).filter((s) => s.countsAsSet).length;
}

export function estimateSessionSecs(session) {
  return buildStepQueue(session).reduce(
    (sum, s) => sum + (s.secs ?? MANUAL_SET_EST_SECS),
    0,
  );
}

export function estimateSessionMins(session) {
  return Math.max(1, Math.round(estimateSessionSecs(session) / 60));
}
