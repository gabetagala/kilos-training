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

export const REHAB_SESSIONS = [
  {
    id: 'daily',
    name: 'Daily Reset',
    freq: 'Every day',
    blurb:
      'Wake the spine, brace it, open it. The barbell joins every other run.',
    blocks: [
      // Opener — McGill's warm-up. Slow breath-paced cycles, nothing forced.
      { ex: 'cat-camel', mode: 'tempo', sets: 1, reps: 6, tempo: CATCAMEL_TEMPO },
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
];

export const getRehabSession = (id) =>
  REHAB_SESSIONS.find((s) => s.id === id) || null;

// ── Rotation: which flavor of a session runs this time ──────────────────────
// `variant` is a monotonically increasing count (the app passes how many
// times the session has been completed), so consecutive runs alternate but
// any single run is deterministic — a mid-session refresh rebuilds the same
// queue. Variant 0 always resolves to the first spec: the canonical A day.
const rotateSpec = (block, variant) =>
  block.rotate ? block.rotate[variant % block.rotate.length] : block;

// The session's concrete blocks for a given variant. A null spec in a
// rotation pool means the block sits out that variant entirely.
export const sessionBlocks = (session, variant = 0) =>
  session.blocks.map((b) => rotateSpec(b, variant)).filter(Boolean);

// How many day-flavors the session cycles through (1 = fixed session).
export const sessionVariantCount = (session) =>
  session.blocks.reduce((n, b) => Math.max(n, b.rotate?.length || 1), 1);

// 'A' / 'B' / … for rotating sessions, null for fixed ones.
export const variantLabel = (session, variant) => {
  const n = sessionVariantCount(session);
  return n > 1 ? String.fromCharCode(65 + (variant % n)) : null;
};

const PREP_SECS = 10;
const SIDES = ['LEFT', 'RIGHT'];

// Seconds assumed for one manual (self-paced) lift set, for duration estimates.
const MANUAL_SET_EST_SECS = 35;

export const tempoSecsPerRep = (tempo) =>
  tempo.reduce((sum, [, secs]) => sum + secs, 0);

const blockScheme = (block) =>
  block.repScheme || Array(block.sets || 1).fill(block.reps || 1);

// Tempo-guide metadata for self-paced sets: the exercise's rep tempo plus a
// rep target (upper bound of the range) the audio guide paces toward.
const guideFor = (exId, reps) => {
  const ex = REHAB_EXERCISES[exId] || PROGRAM_EXERCISES[exId];
  if (!ex?.repTempo) return {};
  const nums = String(reps ?? '').match(/\d+/g);
  const target = nums ? parseInt(nums[nums.length - 1], 10) : 0;
  return target > 0 ? { repTempo: ex.repTempo, repTarget: target } : {};
};

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
    holdSet: true,
    setNum: setIdx + 1,
    setTotal: totalSets,
    kind: 'work',
    exId: block.ex,
    secs: block.holdSecs,
    phase: block.phase || 'HOLD', // carries say CARRY, not HOLD
    meta: setMeta,
    side,
    countsAsSet: true,
  });
}

// Resolve a block/member against the athlete's swap choices: `swaps` maps the
// ORIGINAL slot exercise → the chosen alternate's id. Only ids listed in the
// slot's `alts` are honored, so a stale swap can never smuggle in an exercise
// the program didn't sanction for that slot.
function resolveSwap(spec, swaps) {
  const chosen = spec.alts && swaps?.[spec.ex];
  if (!chosen || chosen === spec.ex) return spec;
  const alt = spec.alts.find((a) => a.ex === chosen);
  if (!alt) return spec;
  return { ...spec, ex: alt.ex, reps: alt.reps || spec.reps };
}

// Swap metadata carried onto manual work steps so the player can offer the
// chooser: the slot's identity (baseEx) + every option with its rep range.
function swapMeta(orig) {
  if (!orig.alts) return {};
  return {
    baseEx: orig.ex,
    altSpecs: [
      { ex: orig.ex, reps: orig.reps },
      ...orig.alts.map((a) => ({ ex: a.ex, reps: a.reps || orig.reps })),
    ],
  };
}

const exDef = (exId) => REHAB_EXERCISES[exId] || PROGRAM_EXERCISES[exId];
const repLogged = (exId) => (exDef(exId)?.logReps ? { logReps: true } : {});

export function buildStepQueue(session, swaps = {}, variant = 0) {
  const steps = [];
  const lastExId = () => steps[steps.length - 1]?.exId;
  const prepIfNew = (exId) => {
    if (exId !== lastExId()) steps.push(prepStep(exId));
  };

  for (const [blockIdx, block] of sessionBlocks(session, variant).entries()) {
    const blockStart = steps.length;
    const tagBlock = () => {
      for (let i = blockStart; i < steps.length; i++) steps[i].bi = blockIdx;
    };
    // Ramp: unlogged self-paced warm-up sets before a heavy lift.
    if (block.mode === 'ramp') {
      const r = resolveSwap(block, swaps);
      prepIfNew(r.ex);
      steps.push({
        kind: 'work',
        exId: r.ex,
        secs: null,
        manual: true,
        logWeight: false,
        phase: 'RAMP',
        meta: 'WARM-UP · NOT LOGGED',
        blockNote: block.note,
        countsAsSet: false,
        ...swapMeta(block),
      });
      tagBlock();
      continue;
    }

    // Circuit / superset: members alternate for N rounds, short rest between
    // moves, flowing straight into the next round (density formats).
    if (block.mode === 'circuit') {
      const rm = block.members.map((m) => resolveSwap(m, swaps));
      prepIfNew(rm[0].ex);
      const between = block.betweenSecs ?? 45;
      for (let round = 1; round <= block.rounds; round++) {
        block.members.forEach((m, mi) => {
          const r = rm[mi];
          const meta = `ROUND ${round} OF ${block.rounds}${r.reps ? ` · ${r.reps} REPS` : ''}`;
          if (m.secs) {
            steps.push({
              kind: 'work',
              exId: r.ex,
              secs: m.secs,
              phase: m.phase || 'HOLD',
              meta,
              side: m.side,
              cueNote: m.note,
              countsAsSet: m.countsAsSet !== false,
            });
          } else {
            steps.push({
              kind: 'work',
              exId: r.ex,
              secs: null,
              manual: true,
              logWeight: m.logWeight !== false,
              phase: 'YOUR PACE',
              meta,
              reps: r.reps,
              cueNote:
                round === block.rounds ? m.lastRoundNote || m.note : m.note,
              countsAsSet: m.countsAsSet !== false,
              ...swapMeta(m),
              ...repLogged(r.ex),
            });
          }
          const isLast =
            round === block.rounds && mi === block.members.length - 1;
          if (!isLast) {
            const secs =
              mi === block.members.length - 1
                ? (block.restSecs ?? between)
                : between;
            const nextMeta =
              mi === block.members.length - 1
                ? `ROUND ${round + 1} NEXT`
                : `ROUND ${round} OF ${block.rounds}`;
            steps.push(restStep(rm[mi].ex, secs, 'REST', nextMeta));
          }
        });
      }
      tagBlock();
      continue;
    }

    const rb = resolveSwap(block, swaps);
    prepIfNew(rb.ex);

    if (block.mode === 'lift') {
      for (let set = 1; set <= block.sets; set++) {
        steps.push({
          kind: 'work',
          exId: rb.ex,
          secs: null,
          manual: true,
          logWeight: true,
          phase: 'YOUR PACE',
          meta: `SET ${set} OF ${block.sets} · ${rb.reps} REPS`,
          reps: rb.reps,
          blockNote: block.note,
          cueNote: set === block.sets ? block.lastSetNote : undefined,
          countsAsSet: true,
          ...guideFor(rb.ex, rb.reps),
          ...swapMeta(block),
          ...repLogged(rb.ex),
        });
        if (set < block.sets) {
          steps.push(
            restStep(rb.ex, block.restSecs, 'REST', `SET ${set + 1} NEXT`),
          );
        }
      }
      tagBlock();
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
    tagBlock();
  }
  return steps;
}

// Human overview of a session, one row per block — for the in-player peek.
export function sessionOverview(session, swaps = {}, variant = 0) {
  const name = (exId) =>
    (REHAB_EXERCISES[exId] || PROGRAM_EXERCISES[exId])?.name || exId;
  return sessionBlocks(session, variant).map((block) => {
    if (block.mode === 'ramp') {
      return {
        title: `${name(resolveSwap(block, swaps).ex)} — warm-up ramp`,
        detail: 'not logged',
        note: block.note,
      };
    }
    if (block.mode === 'circuit') {
      const rm = block.members.map((m) => resolveSwap(m, swaps));
      const members = [...new Set(rm.map((r) => name(r.ex)))];
      const bits = rm
        .filter((r, i, arr) => arr.findIndex((x) => x.ex === r.ex) === i)
        .map((r, i) => (block.members[i]?.secs ? `${block.members[i].secs}s` : r.reps))
        .join(' · ');
      return {
        title: members.join(' + '),
        detail: `${block.rounds} rounds · ${bits}`,
        rounds: block.rounds,
        members: rm.map((r, i) => ({
          name: name(r.ex),
          detail: block.members[i]?.secs ? `${block.members[i].secs}s` : r.reps,
        })),
      };
    }
    const side = block.perSide ? ' / side' : '';
    if (block.mode === 'lift') {
      const r = resolveSwap(block, swaps);
      return {
        title: name(r.ex),
        detail: `${block.sets} × ${r.reps}`,
        note: block.note,
      };
    }
    if (block.mode === 'tempo') {
      return {
        title: name(block.ex),
        detail: `${block.sets} × ${block.reps} tempo${side}`,
      };
    }
    if (block.mode === 'reps') {
      const scheme = (block.repScheme || [block.reps]).join('-');
      return {
        title: name(block.ex),
        detail: `${scheme} × ${block.holdSecs}s holds${side}`,
      };
    }
    return {
      title: name(block.ex),
      detail: `${block.sets} × ${block.holdSecs}s${side}`,
    };
  });
}

import { PROGRAM_EXERCISES } from './program.js';

// What the athlete should read during a rest/prep step: the next thing to do.
export function nextWorkLabel(queue, idx) {
  for (let i = idx + 1; i < queue.length; i++) {
    if (queue[i].kind !== 'work') continue;
    const s = queue[i];
    const name =
      (REHAB_EXERCISES[s.exId] || PROGRAM_EXERCISES[s.exId])?.name || s.exId;
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
    if (into < secs)
      return {
        rep,
        label,
        phaseSec: Math.floor(into),
        phaseLen: secs,
        phaseProgress: into / secs,
      };
    into -= secs;
  }
  const [lastLabel, lastSecs] = tempo.pattern[tempo.pattern.length - 1];
  return {
    rep,
    label: lastLabel,
    phaseSec: lastSecs - 1,
    phaseLen: lastSecs,
    phaseProgress: 1,
  };
}

export function sessionSetTotal(session, variant = 0) {
  return buildStepQueue(session, {}, variant).filter((s) => s.countsAsSet)
    .length;
}

export function estimateSessionSecs(session, variant = 0) {
  return buildStepQueue(session, {}, variant).reduce(
    (sum, s) => sum + (s.secs ?? MANUAL_SET_EST_SECS),
    0,
  );
}

export function estimateSessionMins(session, variant = 0) {
  return Math.max(1, Math.round(estimateSessionSecs(session, variant) / 60));
}
