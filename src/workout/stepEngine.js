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
//   emom    — members alternate on a fixed interval clock (see METCONS below)
//   fortime — fixed rounds, no prescribed rest, one running clock
//   amrap   — a single capped window, movements listed, score = rounds
// - secs: countdown length; null ⇒ manual step (user taps "Set done").
// - countsAsSet: marks the step that completes one logical set (per side).
//
// ── METCONS (added 2026-08-07) ──────────────────────────────────────────────
// A superset is a checklist; a metcon is a workout. Same movements, same
// volume — but one name, one clock, one score. These three modes exist so the
// accessory work can be delivered as a PIECE instead of a to-do list.
//
// FORMAT CHOICE IS A SAFETY AND ACCOUNTING DECISION, not a flavor:
//   emom    — reps × rounds are FIXED, so weekly volume is still exactly
//             auditable, and rest is FORCED (finish the reps, rest the
//             remainder of the interval). That rest floor is why EMOM is the
//             default here: the clock caps the pace instead of fatigue
//             deciding it, which matters on a DDD spine.
//   fortime — volume fixed, but pace is unbounded and form degrades as the
//             clock runs. Bodyweight/band movements only; never loaded
//             unilateral or hinge work.
//   amrap   — volume is "whatever you managed", so it can NEVER carry
//             programmed volume. Finishers only.
// Blocks carry `name` (the piece's name — it's a workout, it gets one) and
// EMOM steps carry `emom: true` so the player can run a clock AND log a load
// on the same step.

/**
 * Build an engine bound to one exercise dictionary.
 * @param exercises map of exercise id → { name, repTempo?, logReps?, … }
 */
// "1 round", never "1 rounds" — a short day serves single rounds everywhere
const roundsWord = (n) => `${n} round${n === 1 ? '' : 's'}`;

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
  // A slot flagged `conditioning` (the scored finishers) passes the flag to
  // whatever it serves, so the steps can say they are engine work, not
  // hypertrophy sets (round-3 coach QA: honest leg volume).
  const sessionBlocks = (session, variant = 0) =>
    session.blocks
      .map((b) => {
        const r = rotateSpec(b, variant);
        return r && b.rotate && b.conditioning
          ? { ...r, conditioning: true }
          : r;
      })
      .filter(Boolean);

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
    // a block can speak for itself: its note rides under the cue, and a block
    // that serves a movement differently (the back extension as a HOLD) brings
    // its own cue and how-line instead of the movement's rep-based ones
    const own = {
      ...(block.note ? { cueNote: block.note } : {}),
      ...(block.cue ? { cue: block.cue } : {}),
      ...(block.how ? { how: block.how } : {}),
    };

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
          ...own,
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
        ...own,
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
      ...own,
    });
  }

  // Resolve a block/member against the athlete's swap choices: `swaps` maps the
  // ORIGINAL slot exercise → the chosen alternate's id. Only ids listed in the
  // slot's `alts` are honored, so a stale swap can never smuggle in an exercise
  // the program didn't sanction for that slot.
  // Fields that describe the MOVEMENT, not the slot. An alt only inherits the
  // slot's structural fields (phase, fixedReps, countsAsSet); anything
  // movement-specific either comes from the alt's own spec or not at all —
  // otherwise a band swapped in for a dumbbell renders "drop the weight ~30%",
  // a loaded lift inherits a band's logWeight:false and never logs, and a
  // 5-rep fallback runs the primary's 12-rep descending ladder.
  const MOVEMENT_FIELDS = [
    'note',
    'lastRoundNote',
    'warmupNote',
    'warmupReps',
    'logWeight',
    'secs',
    'repsPerRound',
    'repScheme',
  ];

  function resolveSwap(spec, swaps) {
    const chosen = spec.alts && swaps?.[spec.ex];
    if (!chosen || chosen === spec.ex) return spec;
    const alt = spec.alts.find((a) => a.ex === chosen);
    if (!alt) return spec;
    const merged = { ...spec, ...alt };
    for (const k of MOVEMENT_FIELDS) {
      if (!(k in alt)) delete merged[k];
    }
    return merged;
  }

  // Swap metadata carried onto manual work steps so the player can offer the
  // chooser: the slot's identity (baseEx) + every option with its rep range.
  function swapMeta(orig) {
    if (!orig.alts) return {};
    return {
      baseEx: orig.ex,
      // logWeight rides along so the player's in-place remap fallback can
      // keep a bodyweight alt from logging kilograms. Each option carries its
      // OWN flag (default: loggable) — never the primary's.
      altSpecs: [
        { ex: orig.ex, reps: orig.reps, logWeight: orig.logWeight ?? true },
        ...orig.alts.map((a) => ({
          ex: a.ex,
          reps: a.reps || orig.reps,
          logWeight: a.logWeight ?? true,
        })),
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
        for (let i = blockStart; i < steps.length; i++) {
          steps[i].bi = blockIdx;
          if (block.conditioning) steps[i].conditioning = true;
        }
        // the walk / re-plate / re-pin into this block, for honest estimates
        if (block.changeoverSecs && steps[blockStart]) {
          steps[blockStart].changeover = block.changeoverSecs;
        }
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
            // r is the resolved member — authoritative for data; m only names
            // the slot for the swap chooser
            const r = rm[mi];
            // THE EFFORT TARGET rides under the movement name (2026-10-10,
            // coach QA — a sleep-deprived lifter drifts to 4–5 in reserve):
            // a working set says "1–2 LEFT", a heavy week says so, and the
            // last round of a rep-out says MAX SET. Warm-ups say nothing.
            const working = block.isPiece && !block.warmup;
            const maxSet =
              round === block.rounds && /LAST SET/.test(r.lastRoundNote || '');
            const fmt = !working
              ? ''
              : maxSet
                ? 'MAX SET · '
                : // HEAVY only on a member the week actually made heavier —
                  // never the RDL or a bodyweight curl (round-3 QA, both)
                  `${r.heavy ? 'HEAVY · ' : ''}${r.effort || '1–2 LEFT'} · `;
            const meta = `${fmt}ROUND ${round} OF ${block.rounds}${r.reps ? ` · ${r.reps} REPS` : ''}`;
            if (r.secs) {
              steps.push({
                kind: 'work',
                exId: r.ex,
                secs: r.secs,
                phase: r.phase || 'HOLD',
                meta,
                side: r.side,
                cueNote: r.note,
                countsAsSet: r.countsAsSet !== false,
              });
            } else {
              steps.push({
                kind: 'work',
                exId: r.ex,
                secs: null,
                manual: true,
                logWeight: r.logWeight !== false,
                phase: 'YOUR PACE',
                meta,
                reps: r.reps,
                cueNote:
                  round === block.rounds ? r.lastRoundNote || r.note : r.note,
                countsAsSet: r.countsAsSet !== false,
                ...(maxSet ? { maxSet: true } : {}),
                // a superset's working set (2026-10-09): it logs the reps
                // ACTUALLY done and earns a load target, read against the
                // last session of the same week type (`heavy`)
                ...(block.isPiece && !block.warmup
                  ? { build: true, ...(r.heavy ? { heavy: true } : {}) }
                  : {}),
                // circuit members get the same tempo guide + live rep counter
                // as main lifts — supersets are where counting is hardest
                ...guideFor(r.ex, r.reps),
                ...swapMeta(m),
                ...repLogged(r.ex),
              });
            }
            const isLast =
              round === block.rounds && mi === block.members.length - 1;
            // the header names the block (2026-10-09) — "WINGS · HEAVY", not
            // the session name for twelve minutes of supersets
            const label = block.warmup ? 'Warm-Up' : block.name || null;
            if (label) {
              steps[steps.length - 1].blockLabel = label;
              if (block.warmup) steps[steps.length - 1].warmup = true;
            }
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
              if (label) steps[steps.length - 1].blockLabel = label;
            }
          });
        }
        // the get-set in front of the block names it too
        const opener = steps[blockStart];
        if (opener?.kind === 'prep' && steps[blockStart + 1]?.blockLabel) {
          opener.blockLabel = steps[blockStart + 1].blockLabel;
        }
        tagBlock();
        continue;
      }

      // EMOM: one step per interval. No prep steps between members — the clock
      // is continuous, and a 10s "GET SET" would silently eat a minute. The
      // work/rest split lives INSIDE the step: do the reps, rest what's left.
      if (block.mode === 'emom') {
        const rm = block.members.map((m) => resolveSwap(m, swaps));
        prepIfNew(rm[0].ex);
        const interval = block.intervalSecs ?? 60;
        const total = block.rounds * block.members.length;
        // The label is WALL CLOCK: work minutes plus the rest rounds between
        // trips. "EMOM 32" on a clock that runs 35 minutes was a lie the
        // athlete would catch by minute 33.
        // a member may bring its own clock (the EMOM day's per-leg minute)
        const roundSecs = rm.reduce(
          (n, r) => n + (r.intervalSecs ?? interval),
          0,
        );
        // warm-up rounds may run their own clock (the sprints' 90 s build)
        const warmN = block.warmupIntervalSecs ? block.warmupRounds || 0 : 0;
        const wallMins = Math.round(
          ((block.rounds - warmN) * roundSecs +
            warmN * rm.length * (block.warmupIntervalSecs || 0) +
            (block.roundRestSecs
              ? (block.rounds - 1) * block.roundRestSecs
              : 0)) /
            60,
        );
        let minute = 0;
        for (let round = 1; round <= block.rounds; round++) {
          block.members.forEach((m, mi) => {
            // r is the RESOLVED member (swap applied) and is authoritative for
            // everything the step serves — reps, flags, notes, timing. m keeps
            // only the slot's identity (swapMeta).
            const r = rm[mi];
            minute += 1;
            // Ladder ("death by"): reps climb by one each minute until the
            // athlete can't finish inside the interval. `rounds` is only a
            // ceiling for the queue — the real end is failure, which is the
            // score. Self-terminating, and the only failure mode is the clock.
            // A ladder climbs by one each minute; `repsPerRound` instead lets
            // a format prescribe an explicit rep per round (a descending
            // scheme, say). Either way the SET COUNT is untouched — which is
            // what makes rotating the format free.
            const ladderReps = r.ladderFrom
              ? String(r.ladderFrom + minute - 1)
              : r.repsPerRound
                ? String(r.repsPerRound[(round - 1) % r.repsPerRound.length])
                : null;
            // WARM-UP ROUNDS (2026-08-10): the first `warmupRounds` trips round
            // are the build-up, on the SAME clock as the working sets. That is
            // what makes a heavy block one timer instead of a tap-through ramp
            // followed by a timer. They are unlogged and they do not count as
            // sets, so they can never reach the volume audit or a PR.
            const warm = round <= (block.warmupRounds || 0);
            steps.push({
              kind: 'work',
              exId: r.ex,
              secs:
                warm && block.warmupIntervalSecs
                  ? block.warmupIntervalSecs
                  : (r.intervalSecs ?? interval),
              emom: true,
              // an EMOM-day set is a real superset set (round-6 coach QA:
              // logged as "eased", its heavy weeks never progressed): it
              // confirms its reps on the REPS DONE row, carries its heavy
              // flag, and earns a target like any other
              ...(block.emomDay && !warm
                ? { build: true, ...(r.heavy ? { heavy: true } : {}) }
                : {}),
              // the heavy slot — the one place load progression is suggested
              anchor: !!block.anchor,
              ladder: !!r.ladderFrom,
              // a death-by block offers an honest exit: the bail jumps past
              // the piece's remaining minutes WITHOUT counting them
              bail: block.bail || null,
              piece: block.name,
              // A ladder has no fixed length — its end is failure — so the
              // format line shows the rule, not a minute count.
              pieceFormat: r.ladderFrom
                ? `EMOM · +1 REP/MIN`
                : `${block.formatLabel || 'EMOM'} ${wallMins}`,
              logWeight: warm ? false : r.logWeight !== false,
              phase: warm ? 'RAMP' : r.phase || 'GO',
              meta: warm
                ? `WARM-UP ${round} OF ${block.warmupRounds} · BUILD`
                : r.ladderFrom
                  ? `MIN ${minute} · ${ladderReps} REPS`
                  : block.anchor
                    ? // the heavy lift counts its WORKING sets (round-6 app
                      // QA: "ROUND 2 OF 5" after one build round read wrong)
                      `SET ${round - (block.warmupRounds || 0)} OF ${block.rounds - (block.warmupRounds || 0)}`
                    : `MIN ${minute} OF ${total} · ROUND ${round} OF ${block.rounds}`,
              reps: warm ? r.warmupReps || 'build' : (ladderReps ?? r.reps),
              // timed members (carries) work part of the interval, not all of it
              workSecs: r.secs,
              side: r.side,
              // a per-round warm-up script (the sprint drills, then strides)
              cueNote: warm
                ? r.warmupNotes?.[round - 1] || r.warmupNote || r.note
                : round === block.rounds
                  ? r.lastRoundNote || r.note
                  : r.note,
              countsAsSet: warm ? false : r.countsAsSet !== false,
              ...(warm ? {} : guideFor(r.ex, ladderReps ?? r.reps)),
              ...swapMeta(m),
              ...(warm ? {} : repLogged(r.ex)),
            });
          });
          // THE ANCHOR'S PAIR (2026-10-10, round-3 coach + plan QA): a
          // spine-quiet move rides each WORKING interval of the heavy lift —
          // the set, then the pair, then the rest — so the triangle gets real
          // sets at zero minutes. Same clock: the anchor's step shrinks to
          // `pair.at` seconds and the pair takes the rest of the interval.
          // Never on a build round, never an anchor itself (no RIR, no gate).
          const warmRound = round <= (block.warmupRounds || 0);
          if (block.pair && !warmRound) {
            const pr = block.pair;
            const lead = steps[steps.length - 1];
            const at = Math.min(pr.at ?? 45, interval - 30);
            lead.secs = at;
            steps.push({
              kind: 'work',
              exId: pr.ex,
              secs: interval - at,
              emom: true,
              pair: true,
              build: true,
              piece: block.name,
              pieceFormat: lead.pieceFormat,
              phase: 'PAIR',
              meta: `PAIR · ROUND ${round} OF ${block.rounds}`,
              reps: pr.reps,
              cueNote: pr.note,
              logWeight: pr.logWeight !== false,
              countsAsSet: true,
              ...guideFor(pr.ex, pr.reps),
              ...repLogged(pr.ex),
            });
          }
          // A rest ROUND, not a rest between sets: `roundRestSecs` buys back
          // that much air before the next trip through the stations (a full
          // minute pre-EMOM40; 20 seconds where the 40-cap left headroom).
          if (block.roundRestSecs && round < block.rounds) {
            steps.push(
              restStep(
                rm[rm.length - 1].ex,
                block.roundRestSecs,
                'REST',
                `ROUND ${round + 1} OF ${block.rounds} NEXT`,
              ),
            );
          }
        }
        tagBlock();
        continue;
      }

      // FOR TIME: fixed rounds, self-paced, no prescribed rest. One clock runs
      // for the whole piece; the athlete taps through and the score is the
      // finish time. Bodyweight/band movements only (see the header note).
      if (block.mode === 'fortime') {
        const rm = block.members.map((m) => resolveSwap(m, swaps));
        prepIfNew(rm[0].ex);
        // `repScheme` gives descending couplets their shape: [21,15,9] means
        // round 1 is 21 of everything, round 2 is 15, round 3 is 9. Rounds are
        // inferred from the scheme's length when it's present — a per-member
        // scheme (m.repScheme) sets the round count the same way.
        const scheme = block.repScheme || null;
        const rounds = scheme
          ? scheme.length
          : block.members.reduce(
              (max, m) => Math.max(max, m.repScheme?.length ?? 0),
              0,
            ) || block.rounds;
        for (let round = 1; round <= rounds; round++) {
          const schemeReps = scheme ? String(scheme[round - 1]) : null;
          block.members.forEach((m, mi) => {
            // r resolved (swap applied) — authoritative for data, same as the
            // emom and circuit branches; m only names the slot for the chooser
            const r = rm[mi];
            // a member's OWN scheme wins (2026-08-15): descending-ladder
            // couplets pair unequal ladders — 40-30-20-10 pull-aparts against
            // 16-12-8-4 push-ups — which one shared block scheme can't say.
            // Read the RESOLVED member (r, not m) so an alt's scheme counts,
            // and fall back to the member's last rung on unequal lengths.
            const memberScheme = r.repScheme || null;
            const reps = memberScheme
              ? String(memberScheme[round - 1] ?? memberScheme.at(-1))
              : (schemeReps ?? r.reps);
            steps.push({
              kind: 'work',
              exId: r.ex,
              secs: r.secs ?? null,
              manual: !r.secs,
              piece: block.name,
              pieceFormat: scheme
                ? scheme.join('-')
                : `${rounds} ROUNDS FOR TIME`,
              logWeight: r.logWeight !== false,
              phase: r.secs ? r.phase || 'GO' : 'GO',
              meta: scheme
                ? `${schemeReps} REPS · SET ${round} OF ${rounds}`
                : `ROUND ${round} OF ${rounds}${reps ? ` · ${reps} REPS` : ''}`,
              reps,
              side: r.side,
              cueNote: round === rounds ? r.lastRoundNote || r.note : r.note,
              countsAsSet: r.countsAsSet !== false,
              ...guideFor(r.ex, reps),
              ...swapMeta(m),
              ...repLogged(r.ex),
            });
          });
        }
        tagBlock();
        continue;
      }

      // TABATA: 8 × (20s hard / 10s off) = 4 minutes, one movement. The
      // intervals are the whole prescription, so this is just an alternating
      // work/rest chain — but it gets its own mode because the rest is part of
      // the piece, not a gap between sets, and the score is the WORST round
      // (the honest one: your best round tells you nothing).
      if (block.mode === 'tabata') {
        const r = resolveSwap(block, swaps);
        prepIfNew(r.ex);
        const work = block.workSecs ?? 20;
        const off = block.restSecs ?? 10;
        const rounds = block.rounds ?? 8;
        for (let i = 1; i <= rounds; i++) {
          steps.push({
            kind: 'work',
            exId: r.ex,
            secs: work,
            piece: block.name,
            pieceFormat: `TABATA ${rounds}×${work}/${off}`,
            phase: block.phase || 'GO',
            meta: `ROUND ${i} OF ${rounds} · MAX REPS`,
            logWeight: false,
            cueNote: block.note,
            countsAsSet: true,
          });
          if (i < rounds) {
            steps.push(restStep(r.ex, off, 'REST', `ROUND ${i + 1} NEXT`));
          }
        }
        tagBlock();
        continue;
      }

      // AMRAP: a single capped window. The queue can't know how many rounds
      // you'll get, so this is ONE timed step with the movement list on it —
      // the athlete scores rounds at the end. FINISHERS ONLY: nothing that
      // carries programmed volume can live in a format whose volume is
      // whatever you happened to manage.
      if (block.mode === 'amrap') {
        const rm = block.members.map((m) => resolveSwap(m, swaps));
        prepIfNew(rm[0].ex);
        steps.push({
          kind: 'work',
          exId: rm[0].ex,
          secs: block.capSecs,
          amrap: true,
          piece: block.name,
          pieceFormat: `AMRAP ${Math.round(block.capSecs / 60)}`,
          logWeight: false,
          phase: block.phase || 'AMRAP',
          meta: `${Math.round(block.capSecs / 60)} MIN · SCORE = ROUNDS`,
          amrapMembers: rm.map((r, i) => ({
            ex: r.ex,
            reps: r.reps,
            secs: block.members[i]?.secs,
          })),
          blockNote: block.note,
          countsAsSet: true,
        });
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
      // A metcon is ONE row — the piece, its format, and the movement list.
      // Listing its minutes separately is exactly the checklist feel these
      // modes exist to remove.
      if (block.mode === 'emom' || block.mode === 'fortime') {
        const rm = block.members.map((m) => resolveSwap(m, swaps));
        const interval = block.intervalSecs ?? 60;
        // a fortime piece may be shaped by repScheme instead of `rounds`
        // (21-15-9), in which case the scheme's length IS the round count —
        // reading block.rounds there rendered "undefined rounds for time".
        // A per-member scheme (descending couplets) sets it the same way.
        const rounds =
          block.repScheme?.length ??
          block.members.find((m) => m.repScheme)?.repScheme.length ??
          block.rounds;
        // wall clock, rest rounds included — must match the step label
        const warmN = block.warmupIntervalSecs ? block.warmupRounds || 0 : 0;
        const mins = Math.round(
          ((rounds - warmN) *
            rm.reduce((n, r) => n + (r.intervalSecs ?? interval), 0) +
            // warm-up rounds on their own clock (the sprints' 90 s build) —
            // same sum as the step label, so preview and player agree
            warmN * rm.length * (block.warmupIntervalSecs || 0) +
            (block.roundRestSecs ? (rounds - 1) * block.roundRestSecs : 0)) /
            60,
        );
        const warmup = block.warmupRounds
          ? ` (${block.warmupRounds} to build)`
          : '';
        const pairRow = block.pair
          ? [
              {
                name: `+ ${name(block.pair.ex)}`,
                detail: `${block.pair.reps} in the rest`,
              },
            ]
          : [];
        return {
          title: block.name || 'The Piece',
          detail:
            block.mode === 'emom'
              ? `${block.formatLabel || 'EMOM'} ${mins} · ${roundsWord(rounds)}${warmup}`
              : block.repScheme
                ? `${block.repScheme.join('-')} for time`
                : `${roundsWord(rounds)} for time`,
          piece: true,
          format: block.mode.toUpperCase(),
          rounds,
          note: block.note,
          members: rm
            .map((r) => ({
              name: name(r.ex),
              // a per-side member would otherwise render as two identical rows;
              // details read the RESOLVED member so a swap shows its own numbers.
              // A ladder reads as a ladder: repScheme joins as 40-30-20-10, and
              // a rising repsPerRound as 4→22 — never its first rung alone.
              detail: `${
                r.repScheme
                  ? r.repScheme.join('-')
                  : r.repsPerRound
                    ? `${r.repsPerRound[0]}→${r.repsPerRound.at(-1)}`
                    : r.secs
                      ? `${r.secs}s`
                      : (r.reps ?? block.repScheme?.join('-') ?? '')
              }${r.side ? ` ${r.side.toLowerCase()}` : ''}`.trim(),
            }))
            .concat(pairRow),
        };
      }
      if (block.mode === 'tabata') {
        const r = resolveSwap(block, swaps);
        const work = block.workSecs ?? 20;
        const off = block.restSecs ?? 10;
        const rounds = block.rounds ?? 8;
        return {
          title: block.name || 'Tabata',
          detail: `${rounds} × ${work}s on / ${off}s off`,
          piece: true,
          format: 'TABATA',
          note: block.note,
          members: [{ name: name(r.ex), detail: 'max reps' }],
        };
      }
      if (block.mode === 'amrap') {
        const rm = block.members.map((m) => resolveSwap(m, swaps));
        return {
          title: block.name || 'Finisher',
          detail: `AMRAP ${Math.round(block.capSecs / 60)} · score = rounds`,
          piece: true,
          format: 'AMRAP',
          note: block.note,
          members: rm.map((r, i) => ({
            name: name(r.ex),
            detail: block.members[i]?.secs
              ? `${block.members[i].secs}s`
              : r.reps,
          })),
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
        // A NAMED circuit (2026-10-09: the lift days' warm-ups, supersets and
        // giant sets) reads as a piece — its name, its week's format, its
        // movement list — exactly like an EMOM or a for-time row.
        if (block.name) {
          return {
            title: block.name,
            detail: block.warmup
              ? `${Math.round(
                  block.members.reduce((t, m) => t + (m.secs || 35), 0) / 60,
                )} min · easy`
              : `${block.formatLabel || 'SETS'} · ${roundsWord(block.rounds)}`,
            piece: true,
            format: 'SETS',
            rounds: block.rounds,
            note: block.note,
            members: rm.map((r, i) => ({
              name: name(r.ex),
              detail: block.members[i]?.secs
                ? `${block.members[i].secs}s`
                : r.reps,
            })),
          };
        }
        return {
          title: members.join(' + '),
          detail: `${roundsWord(block.rounds)} · ${bits}`,
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
      // Long holds read as minutes, and a single set drops the "1 ×". The
      // Lower Back & Hips program is all one-set holds of 2 and 4 minutes, and
      // "1 × 240s" is a worse way to say "4 min" on a sheet you scan sweaty.
      const dur =
        block.holdSecs >= 90
          ? `${Math.round((block.holdSecs / 60) * 10) / 10} min`
          : `${block.holdSecs}s`;
      return {
        title: name(block.ex),
        detail:
          block.sets === 1 ? `${dur}${side}` : `${block.sets} × ${dur}${side}`,
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

  // A self-paced set takes as long as its reps at its own tempo, plus the
  // unrack / log / re-grip around it (2026-10-09). A flat 35s undercounted
  // every slow-eccentric superset — a "39-minute" day that runs 46 is the
  // one that gets skipped. 35s stays the floor for anything unpaced.
  const SET_OVERHEAD_SECS = 10;
  // A MAX SET runs past the prescription — budget ~5 more reps (round-3
  // coach QA: the rep-out week was the one the estimate never paid for).
  const MAX_SET_EXTRA_REPS = 5;
  function estStepSecs(s) {
    if (s.secs != null) return s.secs;
    if (s.repTempo && s.repTarget) {
      const sides = /\/(side|leg|arm)/.test(String(s.reps ?? '')) ? 2 : 1;
      const reps = s.repTarget + (s.maxSet ? MAX_SET_EXTRA_REPS : 0);
      return Math.max(
        MANUAL_SET_EST_SECS,
        reps * sides * tempoSecsPerRep(s.repTempo) + SET_OVERHEAD_SECS,
      );
    }
    return MANUAL_SET_EST_SECS + (s.maxSet ? 15 : 0);
  }

  function estimateSessionSecs(session, variant = 0) {
    return buildStepQueue(session, {}, variant).reduce(
      (sum, s) => sum + estStepSecs(s) + (s.changeover || 0),
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
