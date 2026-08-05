// The guided-session step engine — pure, no DOM, no storage, no data.
//
// EXTRACTED from rehab.js (2026-08-05) so more than one program can drive it:
// Gabe's rehab + Density 40, and HOTMUM's Season 01. The engine used to reach
// straight into REHAB_EXERCISES / PROGRAM_EXERCISES for names and rep tempos,
// which meant a second program either forked it or showed raw exercise ids.
// Now the exercise dictionary is injected and the engine knows nothing about
// whose program it's running.
//
// Behaviour is UNCHANGED — this is a move, not a redesign. rehab.js re-exports
// every name it exported before, so no caller had to change, and
// tests/unit/rehab.test.js proves it.
//
// Usage:
//   const engine = createStepEngine({ ...MY_EXERCISES });
//   const queue  = engine.buildStepQueue(session);
//
// A session is a list of BLOCKS; buildStepQueue() expands blocks into a flat
// queue of STEPS the player walks through one at a time:
//   { kind: 'prep'|'work'|'rest', exId, secs, phase, meta, side, manual,
//     logWeight, tempo, countsAsSet }
// Block modes:
//   hold    — one timed hold per set (hang, side plank, stretches, carries)
//   reps    — one timed hold PER REP with a short re-brace between (McGill)
//   tempo   — one continuous timed set; the player derives the live rep count
//             and sub-phase (LIFT/SQUEEZE/LOWER) from step.tempo
//   lift    — self-paced barbell set, athlete taps done, logs weight
//   ramp    — unlogged self-paced warm-up sets before a heavy lift
//   circuit — members alternate for N rounds (density formats)
// - secs: countdown length; null ⇒ manual step (user taps "Set done").
// - countsAsSet: marks the step that completes one logical set (per side).

/**
 * Build an engine bound to one exercise dictionary.
 * @param exercises map of exercise id → { name, repTempo?, logReps?, … }
 */
export function createStepEngine(exercises = {}) {
  const exDef = (exId) => exercises[exId];
  // ── Rotation: which flavor of a session runs this time ──────────────────────
  // `variant` is a monotonically increasing count (the app passes how many
  // times the session has been completed), so consecutive runs alternate but
  // any single run is deterministic — a mid-session refresh rebuilds the same
  // queue. Variant 0 always resolves to the first spec: the canonical A day.
  const rotateSpec = (block, variant) =>
    block.rotate ? block.rotate[variant % block.rotate.length] : block;

  // The session's concrete blocks for a given variant. A null spec in a
  // rotation pool means the block sits out that variant entirely.
  const sessionBlocks = (session, variant = 0) =>
    session.blocks.map((b) => rotateSpec(b, variant)).filter(Boolean);

  // How many day-flavors the session cycles through (1 = fixed session).
  const sessionVariantCount = (session) =>
    session.blocks.reduce((n, b) => Math.max(n, b.rotate?.length || 1), 1);

  // 'A' / 'B' / … for rotating sessions, null for fixed ones.
  const variantLabel = (session, variant) => {
    const n = sessionVariantCount(session);
    return n > 1 ? String.fromCharCode(65 + (variant % n)) : null;
  };

  const PREP_SECS = 10;
  const SIDES = ['LEFT', 'RIGHT'];

  // Seconds assumed for one manual (self-paced) lift set, for duration estimates.
  const MANUAL_SET_EST_SECS = 35;

  const tempoSecsPerRep = (tempo) =>
    tempo.reduce((sum, [, secs]) => sum + secs, 0);

  const blockScheme = (block) =>
    block.repScheme || Array(block.sets || 1).fill(block.reps || 1);

  // Tempo-guide metadata for self-paced sets: the exercise's rep tempo plus a
  // rep target (upper bound of the range) the audio guide paces toward.
  const guideFor = (exId, reps) => {
    const ex = exDef(exId);
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

  const repLogged = (exId) => (exDef(exId)?.logReps ? { logReps: true } : {});

  function buildStepQueue(session, swaps = {}, variant = 0) {
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
                // circuit members get the same tempo guide + live rep counter
                // as main lifts — supersets are where counting is hardest
                ...guideFor(r.ex, r.reps),
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
            restStep(
              block.ex,
              block.restSecs,
              'REST',
              `SET ${setIdx + 2} NEXT`,
            ),
          );
        }
      }
      tagBlock();
    }
    return steps;
  }

  // Human overview of a session, one row per block — for the in-player peek.
  function sessionOverview(session, swaps = {}, variant = 0) {
    const name = (exId) => exDef(exId)?.name || exId;
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
          .map((r, i) =>
            block.members[i]?.secs ? `${block.members[i].secs}s` : r.reps,
          )
          .join(' · ');
        return {
          title: members.join(' + '),
          detail: `${block.rounds} rounds · ${bits}`,
          rounds: block.rounds,
          members: rm.map((r, i) => ({
            name: name(r.ex),
            detail: block.members[i]?.secs
              ? `${block.members[i].secs}s`
              : r.reps,
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

  // What the athlete should read during a rest/prep step: the next thing to do.
  function nextWorkLabel(queue, idx) {
    for (let i = idx + 1; i < queue.length; i++) {
      if (queue[i].kind !== 'work') continue;
      const s = queue[i];
      const name = exDef(s.exId)?.name || s.exId;
      return s.side ? `${name} · ${s.side}` : name;
    }
    return 'FINISH';
  }

  // Live sub-state of a tempo step at `elapsedMs`: current rep and sub-phase
  // label (LIFT / SQUEEZE / LOWER). Pure so it's testable.
  function tempoStateAt(tempo, elapsedMs) {
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

  function sessionSetTotal(session, variant = 0) {
    return buildStepQueue(session, {}, variant).filter((s) => s.countsAsSet)
      .length;
  }

  function estimateSessionSecs(session, variant = 0) {
    return buildStepQueue(session, {}, variant).reduce(
      (sum, s) => sum + (s.secs ?? MANUAL_SET_EST_SECS),
      0,
    );
  }

  function estimateSessionMins(session, variant = 0) {
    return Math.max(1, Math.round(estimateSessionSecs(session, variant) / 60));
  }

  return {
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
  };
}
