import { describe, expect, it } from 'vitest';
import {
  buildStepQueue,
  estimateSessionMins,
  getRehabSession,
  nextWorkLabel,
  REHAB_EXERCISES,
  REHAB_SESSIONS,
  sessionBlocks,
  sessionOverview,
  sessionSetTotal,
  sessionVariantCount,
  tempoStateAt,
  variantLabel,
} from '../../src/workout/rehab.js';
import {
  DENSITY40_SESSIONS,
  getProgramSession,
  PROGRAM_EXERCISES,
} from '../../src/workout/program.js';
import { PROGRAM_DEMOS, REHAB_DEMOS } from '../../src/workout/rehabDemos.js';

describe('rehab program data', () => {
  it('every block (all rotations) references a known exercise with a demo', () => {
    const exercises = { ...REHAB_EXERCISES, ...PROGRAM_EXERCISES };
    const demos = { ...REHAB_DEMOS, ...PROGRAM_DEMOS };
    for (const session of REHAB_SESSIONS) {
      for (const block of session.blocks) {
        // a null rotation spec = the block sits out that variant
        for (const spec of (block.rotate || [block]).filter(Boolean)) {
          const ids = spec.members ? spec.members.map((m) => m.ex) : [spec.ex];
          for (const id of ids) {
            expect(exercises[id], `exercise ${id}`).toBeTruthy();
            expect(demos[id], `demo ${id}`).toBeTruthy();
          }
        }
      }
    }
  });

  it('is the 10-minute core only: opener, mobility, Big 3 — nothing else', () => {
    expect(REHAB_SESSIONS.map((s) => s.id)).toEqual([
      'daily',
      'open-up',
      'engine',
      'power',
    ]);
    const daily = getRehabSession('daily');
    // TRIMMED 2026-08-07: glutes/hinge/stretches moved out (see rehab.js).
    expect(sessionBlocks(daily, 0).map((b) => b.ex)).toEqual([
      'cat-camel',
      't-spine-reach',
      'mcgill-curlup',
      'side-plank',
      'bird-dog',
    ]);
    // one fixed session — no A/B variant left to track
    expect(sessionVariantCount(daily)).toBe(1);
    expect(variantLabel(daily, 1)).toBeNull();
    expect(getRehabSession('hinge')).toBeNull();
  });

  it('holds the 10-minute promise — the whole reason it was trimmed', () => {
    expect(estimateSessionMins(getRehabSession('daily'))).toBeLessThanOrEqual(
      11,
    );
  });

  it('the displaced work survives at a real dose, just not daily', () => {
    // stretches + glute bridges: Sunday's easy day, and d40-b1 (leg day)
    const openUp = getRehabSession('open-up');
    expect(openUp.blocks.map((b) => b.ex)).toEqual([
      'single-leg-bridge',
      'hamstring-stretch',
      'hip-flexor-stretch',
    ]);
    // the hinge kept its 3×/week dose — now inside the lift halves
    const hingeHalves = DENSITY40_SESSIONS.filter((s) =>
      s.blocks.some((b) => b.ex === 'rdl'),
    ).map((s) => s.id);
    expect(hingeHalves).toEqual(['d40-a1', 'd40-b2', 'd40-c1']);
  });

  it('doses the McGill Big 3 as straight sets of short 10s holds', () => {
    const daily = getRehabSession('daily');
    const curl = daily.blocks.find((b) => b.ex === 'mcgill-curlup');
    // flattened 2026-08: even sets, short holds — never longer holds
    expect(new Set(curl.repScheme).size).toBe(1);
    expect(curl.holdSecs).toBeGreaterThanOrEqual(8);
    expect(curl.holdSecs).toBeLessThanOrEqual(10);
    expect(curl.restSecs).toBeGreaterThanOrEqual(20); // McGill's 20–30s band
    for (const ex of ['side-plank', 'bird-dog']) {
      const b = daily.blocks.find((x) => x.ex === ex);
      expect(b.mode).toBe('reps');
      expect(b.perSide).toBe(true);
      expect(new Set(b.repScheme).size).toBe(1);
      expect(b.holdSecs).toBeLessThanOrEqual(10);
    }
  });

  it('makes the single-leg bridge continuous tempo, one side at a time', () => {
    const slb = getRehabSession('open-up').blocks.find(
      (b) => b.ex === 'single-leg-bridge',
    );
    expect(slb.mode).toBe('tempo');
    expect(slb.perSide).toBe(true);
    expect(slb.reps).toBe(8); // one leg carries double — not the two-leg 10
    expect(slb.tempo.map(([l]) => l)).toEqual(['LIFT', 'SQUEEZE', 'LOWER']);
  });

  it('opens with breath-paced cat-camel cycles, not a hang', () => {
    const opener = sessionBlocks(getRehabSession('daily'), 0)[0];
    expect(opener.ex).toBe('cat-camel');
    expect(opener.mode).toBe('tempo');
    expect(opener.reps).toBeGreaterThanOrEqual(5); // McGill: 5–8 easy cycles
    expect(opener.reps).toBeLessThanOrEqual(8);
    expect(opener.tempo.map(([l]) => l)).toEqual(['ROUND', 'ARCH']);
    // retired moves keep defs + demos so old paused sessions still restore
    expect(REHAB_EXERCISES['dead-hang']).toBeTruthy();
    expect(REHAB_DEMOS['dead-hang']).toBeTruthy();
    expect(REHAB_EXERCISES['glute-kickback']).toBeTruthy();
  });
});

describe('buildStepQueue', () => {
  const daily = buildStepQueue(getRehabSession('daily'));
  const openUp = buildStepQueue(getRehabSession('open-up'));

  it('starts every exercise with a prep step', () => {
    for (const q of [daily, openUp]) {
      let ex = null;
      for (const step of q) {
        if (step.exId !== ex) {
          expect(step.kind).toBe('prep');
          ex = step.exId;
        }
      }
      expect(q[0].kind).toBe('prep');
    }
  });

  it('never ends a session (or an exercise) on a rest step', () => {
    for (const q of [daily, openUp]) {
      expect(q[q.length - 1].kind).toBe('work');
      q.forEach((step, i) => {
        const next = q[i + 1];
        if (next?.kind === 'prep') expect(step.kind).toBe('work');
      });
    }
  });

  it('expands the curl-up into 4-4 timed holds with re-braces', () => {
    const curls = daily.filter((s) => s.exId === 'mcgill-curlup');
    const work = curls.filter((s) => s.kind === 'work');
    expect(work).toHaveLength(8); // 4 + 4
    expect(work.every((s) => s.secs === 10)).toBe(true);
    expect(work.filter((s) => s.countsAsSet)).toHaveLength(2);
    expect(work.map((s) => s.rep)).toEqual([1, 2, 3, 4, 1, 2, 3, 4]);
    // re-braces only within a set: 3 + 3
    expect(curls.filter((s) => s.phase === 'BREATHE')).toHaveLength(6);
  });

  it('runs each plank set on the left then the right', () => {
    const planks = daily.filter(
      (s) => s.exId === 'side-plank' && s.kind === 'work',
    );
    expect(planks.map((s) => s.side)).toEqual([
      ...Array(3).fill('LEFT'),
      ...Array(3).fill('RIGHT'),
      ...Array(3).fill('LEFT'),
      ...Array(3).fill('RIGHT'),
    ]);
  });

  it('builds the single-leg bridge as continuous tempo steps, left then right', () => {
    const slb = openUp.filter(
      (s) => s.exId === 'single-leg-bridge' && s.kind === 'work',
    );
    expect(slb.map((s) => s.side)).toEqual(['LEFT', 'RIGHT', 'LEFT', 'RIGHT']);
    for (const b of slb) {
      expect(b.secs).toBe(40); // 8 reps × 5s tempo (2s eccentric)
      expect(b.tempo.reps).toBe(8);
      expect(b.tempo.secsPerRep).toBe(5);
    }
  });

  it('makes the RDL sets manual with weight logging, wherever they live', () => {
    const q = buildStepQueue(getProgramSession('d40-b2'));
    const rdls = q.filter((s) => s.exId === 'rdl' && s.kind === 'work');
    expect(rdls).toHaveLength(3);
    for (const s of rdls) {
      expect(s.manual).toBe(true);
      expect(s.logWeight).toBe(true);
      expect(s.secs).toBeNull();
      expect(s.reps).toBe(8);
    }
  });

  it('the daily protocol carries no barbell and no filler', () => {
    expect(daily.some((s) => s.exId === 'rdl')).toBe(false);
    // opener → mobility → the Big 3, and it ends there
    expect([...new Set(daily.map((s) => s.exId))]).toEqual([
      'cat-camel',
      't-spine-reach',
      'mcgill-curlup',
      'side-plank',
      'bird-dog',
    ]);
  });

  it('counts logical sets per side', () => {
    // catcamel 1 + tspine 1×2 + curl 2 + (plank, bird) à 2×2 = 13
    expect(sessionSetTotal(getRehabSession('daily'))).toBe(13);
    // open-up: (bridge, ham, hip) à 2×2 = 12
    expect(sessionSetTotal(getRehabSession('open-up'))).toBe(12);
  });

  it('every timed step has positive seconds', () => {
    for (const q of [daily, openUp]) {
      for (const s of q) {
        if (!s.manual) expect(s.secs).toBeGreaterThan(0);
      }
    }
  });
});

describe('player helpers', () => {
  it('nextWorkLabel points rests at the next thing to do', () => {
    const daily = buildStepQueue(getRehabSession('daily'));
    expect(nextWorkLabel(daily, -1)).toBe('Cat-Camel');
    expect(nextWorkLabel(daily, daily.length - 1)).toBe('FINISH');
    const switchIdx = daily.findIndex((s) => s.phase === 'SWITCH SIDES');
    expect(nextWorkLabel(daily, switchIdx)).toBe('T-Spine Reach · RIGHT');
  });

  it('tempoStateAt tracks rep count and sub-phase through a bridge set', () => {
    const tempo = {
      reps: 10,
      secsPerRep: 4,
      pattern: [
        ['LIFT', 1],
        ['SQUEEZE', 2],
        ['LOWER', 1],
      ],
    };
    expect(tempoStateAt(tempo, 0)).toMatchObject({ rep: 1, label: 'LIFT' });
    expect(tempoStateAt(tempo, 1500)).toMatchObject({ rep: 1, label: 'SQUEEZE' });
    expect(tempoStateAt(tempo, 3500)).toMatchObject({ rep: 1, label: 'LOWER' });
    expect(tempoStateAt(tempo, 4000)).toMatchObject({ rep: 2, label: 'LIFT' });
    expect(tempoStateAt(tempo, 39999)).toMatchObject({ rep: 10, label: 'LOWER' });
    // never overruns the final rep even past the end
    expect(tempoStateAt(tempo, 999999).rep).toBe(10);
  });

  it('the daily protocol and the easy day land in believable bands', () => {
    const d = estimateSessionMins(getRehabSession('daily'));
    expect(d).toBeGreaterThanOrEqual(8);
    expect(d).toBeLessThanOrEqual(11); // the 10-minute promise
    const o = estimateSessionMins(getRehabSession('open-up'));
    expect(o).toBeGreaterThanOrEqual(6);
    expect(o).toBeLessThanOrEqual(12);
  });
});

describe('power primer', () => {
  const power = getRehabSession('power');
  const q = buildStepQueue(power);

  it('is a fixed session — no rotation, no day label', () => {
    expect(sessionVariantCount(power)).toBe(1);
    expect(variantLabel(power, 3)).toBeNull();
    expect(buildStepQueue(power, {}, 5)).toEqual(q);
  });

  it('bounces, then jumps, then explosive push-ups — ballistic, never tempo-paced', () => {
    const workIds = [
      ...new Set(q.filter((s) => s.kind === 'work').map((s) => s.exId)),
    ];
    expect(workIds).toEqual(['pogo-hop', 'broad-jump', 'power-pushup']);
    for (const s of q.filter((s) => s.manual)) {
      expect(s.repTempo).toBeUndefined(); // speed work is never slow-paced
      expect(s.logWeight).toBe(false); // bodyweight — nothing to log
    }
    const pogo = q.filter((s) => s.exId === 'pogo-hop' && s.kind === 'work');
    expect(pogo).toHaveLength(2);
    expect(pogo.every((s) => s.phase === 'BOUNCE' && s.secs === 15)).toBe(true);
  });

  it('stays a primer: tiny contact counts, well under lifting length', () => {
    expect(sessionSetTotal(power)).toBe(8); // 2 pogo + 3 jumps + 3 push-ups
    expect(estimateSessionMins(power)).toBeLessThanOrEqual(12);
  });
});

// The daily rehab lost its only rotation when the hinge moved into the lift
// halves (2026-08-07). The MECHANISM is still live — HOTMUM uses it — so these
// guard that every session is now fixed, and that a stale saved variant index
// from a paused pre-split run can't build a different queue.
describe('rotation (the mechanism outlives the hinge)', () => {
  const daily = getRehabSession('daily');

  it('the rehab protocol is fixed — the repetition IS the medicine', () => {
    for (const s of REHAB_SESSIONS) {
      expect(sessionVariantCount(s), s.id).toBe(1);
      expect(variantLabel(s, 0), s.id).toBeNull();
    }
  });

  // The halves that carry a FINISHER rotate through its pool — one per
  // completed run, so at a run a week it's a different finisher every week.
  it('the finisher days rotate through the whole pool and wrap', () => {
    const withFinisher = DENSITY40_SESSIONS.filter(
      (s) => sessionVariantCount(s) > 1,
    );
    expect(withFinisher.map((s) => s.id)).toEqual([
      'd40-a1',
      'd40-b2',
      'd40-c1',
      'd40-c2',
    ]);
    for (const s of withFinisher) {
      const n = sessionVariantCount(s);
      expect(n, s.id).toBe(6);
      const names = [...Array(n)].map(
        (_, v) => sessionBlocks(s, v).at(-1).name,
      );
      expect(new Set(names).size, `${s.id} repeats a finisher`).toBe(n);
      // wraps cleanly — variant n is variant 0 again
      expect(buildStepQueue(s, {}, n)).toEqual(buildStepQueue(s, {}, 0));
    }
  });

  it('each finisher day starts on a different one — no shared Mondays', () => {
    const firsts = DENSITY40_SESSIONS.filter(
      (s) => sessionVariantCount(s) > 1,
    ).map((s) => sessionBlocks(s, 0).at(-1).name);
    expect(new Set(firsts).size).toBe(firsts.length);
  });

  it('a variant index is always deterministic — a refresh rebuilds the same queue', () => {
    // the crash-safety guarantee: the same variant must always yield the same
    // queue, however large the completed-run count has grown
    for (const s of [daily, getProgramSession('d40-a1')]) {
      expect(buildStepQueue(s, {}, 3)).toEqual(buildStepQueue(s, {}, 3));
      const n = sessionVariantCount(s);
      expect(buildStepQueue(s, {}, n * 4)).toEqual(buildStepQueue(s, {}, 0));
    }
  });

  it('sessionOverview lists one row per block', () => {
    expect(sessionOverview(daily, {}, 0)).toHaveLength(daily.blocks.length);
    const b2 = getProgramSession('d40-b2');
    const rows = sessionOverview(b2, {}, 0);
    expect(rows[0].title).toBe('Romanian Deadlift');
    expect(rows[0].detail).toBe('3 × 8');
    expect(rows[0].note).toMatch(/quiet/i);
  });
});

describe('Density 40 program', () => {
  // The halves now carry blocks built from REHAB_EXERCISES too (the hinge,
  // the power primer, glute + stretch work), so both maps are in scope —
  // which is exactly what the shared step engine is built from.
  it('every block/member references a known exercise with a demo', () => {
    const exercises = { ...REHAB_EXERCISES, ...PROGRAM_EXERCISES };
    const demos = { ...REHAB_DEMOS, ...PROGRAM_DEMOS };
    for (const session of DENSITY40_SESSIONS) {
      for (const block of session.blocks) {
        // finisher slots are rotation pools — check every option in them
        for (const spec of (block.rotate || [block]).filter(Boolean)) {
          const ids = spec.members ? spec.members.map((m) => m.ex) : [spec.ex];
          for (const id of ids) {
            expect(exercises[id], `exercise ${id}`).toBeTruthy();
            expect(demos[id], `demo ${id}`).toBeTruthy();
          }
        }
      }
    }
  });

  it('builds every session queue without invalid steps', () => {
    for (const session of DENSITY40_SESSIONS) {
      const q = buildStepQueue(session);
      expect(q.length).toBeGreaterThan(10);
      expect(q[0].kind).toBe('prep');
      expect(q[q.length - 1].kind).toBe('work');
      for (const step of q) {
        if (!step.manual) expect(step.secs).toBeGreaterThan(0);
        expect(step.exId).toBeTruthy();
      }
    }
  });

  it('ramp sets are manual and unlogged, before the heavy lift, with one prep', () => {
    const q = buildStepQueue(getProgramSession('d40-a1'));
    expect(q[0].kind).toBe('prep');
    expect(q[0].exId).toBe('pull-up');
    expect(q[1].phase).toBe('RAMP');
    expect(q[1].logWeight).toBe(false);
    expect(q[1].countsAsSet).toBe(false);
    expect(q[2].phase).toBe('YOUR PACE'); // no second prep for the same exercise
    expect(q[2].logWeight).toBe(true);
  });

  it('supersets alternate members for the listed rounds with rests between', () => {
    // the power primer is the surviving circuit — the accessory supersets all
    // became EMOM pieces on 2026-08-07
    const q = buildStepQueue(getProgramSession('d40-a2'));
    const jumps = q.filter((s) => s.exId === 'broad-jump' && s.kind === 'work');
    expect(jumps).toHaveLength(3);
    const iJump = q.indexOf(jumps[0]);
    expect(q[iJump + 1].kind).toBe('rest');
    expect(q[iJump + 1].secs).toBe(60);
  });

  it('carries are timed steps with sides that flip the demo', () => {
    // per-side timed work now lives in the rehab sessions (the D40 suitcase
    // carry runs both sides inside one EMOM minute)
    const q = buildStepQueue(getRehabSession('open-up'));
    const holds = q.filter(
      (s) => s.exId === 'hamstring-stretch' && s.kind === 'work',
    );
    expect(holds.filter((s) => s.side === 'RIGHT')).toHaveLength(2);
    expect(holds.filter((s) => s.side === 'LEFT')).toHaveLength(2);
    for (const h of holds) expect(h.secs).toBe(30);
  });

  it('every self-paced working set carries the tempo guide (the rep counter)', () => {
    // …except the ballistic primer, which is deliberately never tempo-paced
    // (see the power-primer specs) — speed work can't be run to a metronome.
    const BALLISTIC = ['pogo-hop', 'broad-jump', 'power-pushup'];
    for (const session of DENSITY40_SESSIONS) {
      const manual = buildStepQueue(session).filter(
        (s) => s.kind === 'work' && s.manual,
      );
      for (const s of manual) {
        if (s.phase === 'RAMP') continue; // the warm-up stays unpaced
        if (BALLISTIC.includes(s.exId)) {
          expect(s.repTempo, `${s.exId} repTempo`).toBeUndefined();
          continue;
        }
        expect(s.repTempo, `${s.exId} repTempo`).toBeTruthy();
        expect(s.repTarget, `${s.exId} repTarget`).toBeGreaterThan(0);
      }
    }
  });

  // Post-split: only the three anchor halves ramp. The accessory halves open
  // on the power primer or the hinge, neither of which takes a warm-up set.
  it('only the anchor halves ramp, and never more than once', () => {
    const ramped = [];
    for (const session of DENSITY40_SESSIONS) {
      const ramps = buildStepQueue(session).filter((s) => s.phase === 'RAMP');
      expect(ramps.length, session.id).toBeLessThanOrEqual(1);
      if (ramps.length) {
        expect(ramps[0].logWeight).toBe(false);
        ramped.push(session.id);
      }
    }
    expect(ramped).toEqual(['d40-a1', 'd40-b1', 'd40-c1']);
  });

  // His stated ceiling is 45 min a day, all in. The estimate is deliberately
  // PESSIMISTIC for the ladder finishers — it counts their full queue ceiling,
  // but a death-by ends at failure, so a day reading 42 really runs ~35.
  it('no half runs long, on any finisher in the rotation', () => {
    for (const session of DENSITY40_SESSIONS) {
      for (let v = 0; v < sessionVariantCount(session); v++) {
        const mins = estimateSessionMins(session, v);
        expect(mins, `${session.id}/v${v}`).toBeGreaterThanOrEqual(15);
        expect(mins, `${session.id}/v${v}`).toBeLessThanOrEqual(33);
      }
    }
  });

  // ── Metcons (2026-08-07) ──────────────────────────────────────────────────
  // The accessory work is delivered as named pieces on a clock instead of
  // supersets with rest timers. These guard the two things that make that
  // safe: volume stays exactly auditable, and AMRAP never carries programmed
  // volume.
  it('an EMOM emits one interval step per minute, no preps mid-piece', () => {
    const q = buildStepQueue(getProgramSession('d40-b2'));
    const piece = q.filter((s) => s.piece === 'Popeye');
    expect(piece).toHaveLength(15); // 5 movements × 3 rounds
    for (const s of piece) {
      expect(s.kind).toBe('work');
      expect(s.secs).toBe(60);
      expect(s.emom).toBe(true);
      expect(s.manual).toBeUndefined(); // the clock runs it, not a tap
      expect(s.pieceFormat).toBe('EMOM 15');
    }
    expect(piece.map((s) => s.meta)[0]).toBe('MIN 1 OF 15 · ROUND 1 OF 3');
    expect(piece.map((s) => s.meta)[14]).toBe('MIN 15 OF 15 · ROUND 3 OF 3');
    // a prep between minutes would silently eat one
    const first = q.indexOf(piece[0]);
    expect(q.slice(first, first + 15).some((s) => s.kind === 'prep')).toBe(false);
    // and no rest steps — the rest lives inside the interval
    expect(q.slice(first, first + 15).some((s) => s.kind === 'rest')).toBe(false);
  });

  it('EMOM minutes still log load, so progression survives the format', () => {
    const q = buildStepQueue(getProgramSession('d40-a2'));
    const vice = q.filter((s) => s.piece === 'The Vice');
    const pushdowns = vice.filter((s) => s.exId === 'rope-pushdown');
    expect(pushdowns).toHaveLength(3);
    for (const s of pushdowns) {
      expect(s.logWeight).toBe(true);
      expect(s.countsAsSet).toBe(true);
      expect(s.repTempo).toBeTruthy(); // the rep counter still guides
    }
    // bodyweight members opt out of logging exactly as before
    expect(vice.find((s) => s.exId === 'reverse-wrist-curl').logWeight).toBe(false);
  });

  // THE RULE THAT MUST NOT BREAK: a format whose volume is "whatever you
  // managed" can never carry a muscle's programmed dose. So every AMRAP in
  // the program has to be the LAST thing in its session — a finisher, never
  // a block that something graded depends on.
  it('AMRAP is always a capped finisher, never programmed volume', () => {
    let found = 0;
    for (const s of DENSITY40_SESSIONS) {
      for (let v = 0; v < sessionVariantCount(s); v++) {
        const q = buildStepQueue(s, {}, v);
        q.forEach((st, i) => {
          if (!st.amrap) return;
          found += 1;
          expect(st.secs, `${s.id}/v${v}`).toBeGreaterThan(0);
          expect(st.logWeight, `${s.id}/v${v}`).toBe(false); // scored in rounds
          expect(st.amrapMembers.length).toBeGreaterThan(0);
          expect(i, `${s.id}/v${v}: AMRAP must close the session`).toBe(
            q.length - 1,
          );
        });
      }
    }
    expect(found).toBeGreaterThan(0);
  });

  it('finishers never sneak a spine-loaded movement onto a clock', () => {
    const CLOCK_BANNED = [
      'rdl',
      'front-squat',
      'rfe-split-squat',
      'floor-press',
      'pull-up',
    ];
    for (const s of DENSITY40_SESSIONS) {
      for (let v = 0; v < sessionVariantCount(s); v++) {
        for (const st of buildStepQueue(s, {}, v)) {
          if (!st.emom && !st.amrap && !st.piece) continue;
          expect(CLOCK_BANNED, `${s.id}/v${v}/${st.exId}`).not.toContain(
            st.exId,
          );
        }
      }
    }
  });

  it('the clock never gets loaded unilateral leg work or the hinge', () => {
    // fatigue is what breaks form, and form is what protects the disc — so
    // these stay on straight sets with real rests, whatever the day looks like
    const CLOCK_BANNED = ['rdl', 'front-squat', 'rfe-split-squat', 'floor-press', 'pull-up'];
    for (const s of DENSITY40_SESSIONS) {
      for (const st of buildStepQueue(s)) {
        if (!st.emom && !st.amrap) continue;
        expect(CLOCK_BANNED, `${s.id}/${st.exId}`).not.toContain(st.exId);
      }
    }
  });

  it('every piece has a name — it is a workout, not a block', () => {
    for (const s of DENSITY40_SESSIONS) {
      for (const st of buildStepQueue(s)) {
        if (st.emom || st.amrap) {
          expect(st.piece, `${s.id}/${st.exId}`).toBeTruthy();
          expect(st.pieceFormat, `${s.id}/${st.exId}`).toBeTruthy();
        }
      }
    }
  });

  it('the whole day fits inside the 45-minute ceiling, worst case', () => {
    const rehab = estimateSessionMins(getRehabSession('daily'));
    for (const session of DENSITY40_SESSIONS) {
      for (let v = 0; v < sessionVariantCount(session); v++) {
        expect(
          rehab + estimateSessionMins(session, v),
          `${session.id}/v${v}`,
        ).toBeLessThanOrEqual(45);
      }
    }
  });
});

describe('exercise swaps (sanctioned alternates)', () => {
  const d40a = getProgramSession('d40-a1');
  const d40b = getProgramSession('d40-b1');

  it('unswapped queue is unchanged and carries swap metadata', () => {
    const q = buildStepQueue(d40a);
    const lift = q.filter((s) => s.exId === 'pull-up' && s.countsAsSet);
    expect(lift).toHaveLength(4);
    expect(lift[0].baseEx).toBe('pull-up');
    expect(lift[0].altSpecs.map((a) => a.ex)).toEqual([
      'pull-up',
      'pull-up-bw',
      'lat-pulldown',
    ]);
    expect(lift[0].logReps).toBeUndefined();
  });

  it('swapping pull-up → bodyweight flips the slot to rep logging', () => {
    const q = buildStepQueue(d40a, { 'pull-up': 'pull-up-bw' });
    expect(q.some((s) => s.exId === 'pull-up')).toBe(false);
    const lift = q.filter((s) => s.exId === 'pull-up-bw' && s.countsAsSet);
    expect(lift).toHaveLength(4);
    expect(lift[0].logReps).toBe(true);
    expect(lift[0].reps).toBe('5–8');
    // the ramp block swaps with its lift slot
    expect(q.find((s) => s.phase === 'RAMP').exId).toBe('pull-up-bw');
    // queue shape is variant-independent (the player relies on this)
    expect(q).toHaveLength(buildStepQueue(d40a).length);
  });

  it('alt rep ranges override the slot (front squat → DB split squat)', () => {
    const q = buildStepQueue(d40b, { 'front-squat': 'db-split-squat' });
    const lift = q.filter((s) => s.exId === 'db-split-squat' && s.countsAsSet);
    expect(lift[0].reps).toBe('6–8/leg');
    expect(lift[0].logReps).toBeUndefined();
  });

  it('circuit members swap too, and unsanctioned swaps are ignored', () => {
    // the arms circuit lives on the second half of the pull day post-split
    const arms = buildStepQueue(getProgramSession('d40-a2'), {
      'hammer-curl': 'reverse-curl',
    });
    expect(arms.some((s) => s.exId === 'reverse-curl')).toBe(true);
    expect(arms.some((s) => s.exId === 'hammer-curl')).toBe(false);

    const q = buildStepQueue(d40a, {
      'db-lateral-raise': 'front-squat', // not in that slot's alts
    });
    expect(q.filter((s) => s.exId === 'db-lateral-raise').length).toBeGreaterThan(0);
  });

  it('sessionOverview reflects the chosen variants', () => {
    const rows = sessionOverview(d40a, { 'pull-up': 'lat-pulldown' });
    expect(rows[0].title).toContain('Lat Pulldown');
    expect(rows[1].title).toBe('Lat Pulldown');
    expect(rows[1].detail).toBe('4 × 8–10');
  });
});
