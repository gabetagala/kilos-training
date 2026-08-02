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
          expect(exercises[spec.ex], `exercise ${spec.ex}`).toBeTruthy();
          expect(demos[spec.ex], `demo ${spec.ex}`).toBeTruthy();
        }
      }
    }
  });

  it('is ONE session covering the full protocol: opener, Big 3, glutes, hinge slot, stretches', () => {
    expect(REHAB_SESSIONS.map((s) => s.id)).toEqual(['daily']);
    const daily = getRehabSession('daily');
    // A day: barbell-free — the hinge slot sits out, straight to stretches
    expect(sessionBlocks(daily, 0).map((b) => b.ex)).toEqual([
      'cat-camel',
      'mcgill-curlup',
      'side-plank',
      'bird-dog',
      'single-leg-bridge',
      'hamstring-stretch',
      'hip-flexor-stretch',
    ]);
    // B day: the old Hinge Day folded in — RDLs, nothing to choose
    expect(sessionBlocks(daily, 1).map((b) => b.ex)[5]).toBe('rdl');
    expect(getRehabSession('hinge')).toBeNull();
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
    const slb = getRehabSession('daily').blocks.find(
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
  const daily = buildStepQueue(getRehabSession('daily')); // variant 0 = A day
  const dailyB = buildStepQueue(getRehabSession('daily'), {}, 1); // B = hinge day

  it('starts every exercise with a prep step', () => {
    for (const q of [daily, dailyB]) {
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
    for (const q of [daily, dailyB]) {
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
    const slb = daily.filter(
      (s) => s.exId === 'single-leg-bridge' && s.kind === 'work',
    );
    expect(slb.map((s) => s.side)).toEqual(['LEFT', 'RIGHT', 'LEFT', 'RIGHT']);
    for (const b of slb) {
      expect(b.secs).toBe(40); // 8 reps × 5s tempo (2s eccentric)
      expect(b.tempo.reps).toBe(8);
      expect(b.tempo.secsPerRep).toBe(5);
    }
  });

  it('makes B-day RDL sets manual with weight logging', () => {
    const rdls = dailyB.filter((s) => s.exId === 'rdl' && s.kind === 'work');
    expect(rdls).toHaveLength(3);
    for (const s of rdls) {
      expect(s.manual).toBe(true);
      expect(s.logWeight).toBe(true);
      expect(s.secs).toBeNull();
      expect(s.reps).toBe(8);
    }
  });

  it('A days skip the hinge slot entirely — no barbell, no filler', () => {
    expect(daily.some((s) => s.exId === 'rdl')).toBe(false);
    // bridges flow straight into the stretches
    const exOrder = [...new Set(daily.map((s) => s.exId))];
    expect(exOrder.indexOf('hamstring-stretch')).toBe(
      exOrder.indexOf('single-leg-bridge') + 1,
    );
  });

  it('counts logical sets per side', () => {
    // catcamel 1 + curl 2 + (plank, bird, bridge, ham, hip) à 2 sets × 2 sides = 23
    expect(sessionSetTotal(getRehabSession('daily'))).toBe(23);
    // B day adds 3 RDL sets = 26
    expect(sessionSetTotal(getRehabSession('daily'), 1)).toBe(26);
  });

  it('every timed step has positive seconds', () => {
    for (const q of [daily, dailyB]) {
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
    expect(nextWorkLabel(daily, switchIdx)).toBe('Side Plank · RIGHT');
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

  it('both day-flavors land in a believable duration band', () => {
    const a = estimateSessionMins(getRehabSession('daily'), 0);
    const b = estimateSessionMins(getRehabSession('daily'), 1);
    expect(a).toBeGreaterThanOrEqual(14);
    expect(a).toBeLessThanOrEqual(20); // barbell-free day stays snappy
    expect(b).toBeGreaterThanOrEqual(18);
    expect(b).toBeLessThanOrEqual(26);
  });
});

describe('rotation (A/B day flavors)', () => {
  const daily = getRehabSession('daily');

  it('cycles two flavors, labeled A and B, and repeats', () => {
    expect(sessionVariantCount(daily)).toBe(2);
    expect(['A', 'B', 'A', 'B'].map((_, i) => variantLabel(daily, i))).toEqual([
      'A',
      'B',
      'A',
      'B',
    ]);
  });

  it('fixed sessions rotate nothing and get no label', () => {
    const d40a = getProgramSession('d40-a');
    expect(sessionVariantCount(d40a)).toBe(1);
    expect(variantLabel(d40a, 0)).toBeNull();
    expect(buildStepQueue(d40a, {}, 3)).toEqual(buildStepQueue(d40a));
  });

  it('A rests the hinge, B loads it — and the cycle wraps around', () => {
    const ids = (v) =>
      buildStepQueue(daily, {}, v)
        .filter((s) => s.kind === 'work')
        .map((s) => s.exId);
    expect(ids(0)).not.toContain('rdl');
    expect(ids(1)).toContain('rdl');
    expect(ids(2)).toEqual(ids(0));
    expect(ids(3)).toEqual(ids(1));
  });

  it('default variant is 0 — old callers keep the canonical A day', () => {
    expect(buildStepQueue(daily)).toEqual(buildStepQueue(daily, {}, 0));
  });

  it('the fixed medicine never rotates: Big 3 identical on both days', () => {
    const fixed = (v) =>
      buildStepQueue(daily, {}, v).filter((s) =>
        ['cat-camel', 'mcgill-curlup', 'side-plank', 'bird-dog'].includes(
          s.exId,
        ),
      );
    expect(fixed(0)).toEqual(fixed(1));
  });

  it('sessionOverview reflects the rotation', () => {
    const rowsA = sessionOverview(daily, {}, 0);
    const rowsB = sessionOverview(daily, {}, 1);
    expect(rowsA).toHaveLength(7); // the skipped slot leaves no empty row
    expect(rowsA.some((r) => r.title === 'Romanian Deadlift')).toBe(false);
    expect(rowsB).toHaveLength(8);
    expect(rowsB[5].title).toBe('Romanian Deadlift');
    expect(rowsB[5].detail).toBe('3 × 8');
    expect(rowsB[5].note).toMatch(/quiet/i);
  });
});

describe('Density 40 program', () => {
  it('every block/member references a known exercise with a demo', () => {
    for (const session of DENSITY40_SESSIONS) {
      for (const block of session.blocks) {
        const ids = block.members ? block.members.map((m) => m.ex) : [block.ex];
        for (const id of ids) {
          expect(PROGRAM_EXERCISES[id], `exercise ${id}`).toBeTruthy();
          expect(PROGRAM_DEMOS[id], `demo ${id}`).toBeTruthy();
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
    const q = buildStepQueue(getProgramSession('d40-a'));
    expect(q[0].kind).toBe('prep');
    expect(q[0].exId).toBe('pull-up');
    expect(q[1].phase).toBe('RAMP');
    expect(q[1].logWeight).toBe(false);
    expect(q[1].countsAsSet).toBe(false);
    expect(q[2].phase).toBe('YOUR PACE'); // no second prep for the same exercise
    expect(q[2].logWeight).toBe(true);
  });

  it('supersets alternate members for the listed rounds with rests between', () => {
    const q = buildStepQueue(getProgramSession('d40-a'));
    const rows = q.filter((s) => s.exId === 'cable-row-1arm' && s.kind === 'work');
    const lats = q.filter((s) => s.exId === 'db-lateral-raise' && s.kind === 'work');
    expect(rows).toHaveLength(3);
    expect(lats).toHaveLength(3);
    expect(lats[2].cueNote).toMatch(/drop/i);
    const iRow = q.indexOf(rows[0]);
    expect(q[iRow + 1].kind).toBe('rest');
    expect(q[iRow + 2].exId).toBe('db-lateral-raise');
  });

  it('carries are timed steps with sides that flip the demo', () => {
    const q = buildStepQueue(getProgramSession('d40-a'));
    const carries = q.filter(
      (s) => s.exId === 'suitcase-carry' && s.kind === 'work',
    );
    expect(carries.filter((s) => s.side === 'RIGHT')).toHaveLength(2);
    expect(carries.filter((s) => s.side === 'LEFT')).toHaveLength(2);
    for (const c of carries) expect(c.secs).toBe(40);
  });

  it('every self-paced working set carries the tempo guide (the rep counter)', () => {
    for (const session of DENSITY40_SESSIONS) {
      const manual = buildStepQueue(session).filter(
        (s) => s.kind === 'work' && s.manual,
      );
      for (const s of manual) {
        if (s.phase === 'RAMP') continue; // the warm-up stays unpaced
        expect(s.repTempo, `${s.exId} repTempo`).toBeTruthy();
        expect(s.repTarget, `${s.exId} repTarget`).toBeGreaterThan(0);
      }
    }
  });

  it('exactly one RAMP step per session — working sets are never warm-ups', () => {
    for (const session of DENSITY40_SESSIONS) {
      const ramps = buildStepQueue(session).filter((s) => s.phase === 'RAMP');
      expect(ramps).toHaveLength(1);
      expect(ramps[0].logWeight).toBe(false);
    }
  });

  it('sessions land inside the 40-minute promise', () => {
    for (const session of DENSITY40_SESSIONS) {
      const mins = estimateSessionMins(session);
      expect(mins).toBeGreaterThanOrEqual(20);
      expect(mins).toBeLessThanOrEqual(40);
    }
  });
});

describe('exercise swaps (sanctioned alternates)', () => {
  const d40a = getProgramSession('d40-a');
  const d40b = getProgramSession('d40-b');

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
    const q = buildStepQueue(d40a, {
      'hammer-curl': 'reverse-curl',
      'db-lateral-raise': 'front-squat', // not in that slot's alts
    });
    expect(q.some((s) => s.exId === 'reverse-curl')).toBe(true);
    expect(q.some((s) => s.exId === 'hammer-curl')).toBe(false);
    expect(q.filter((s) => s.exId === 'db-lateral-raise').length).toBeGreaterThan(0);
  });

  it('sessionOverview reflects the chosen variants', () => {
    const rows = sessionOverview(d40a, { 'pull-up': 'lat-pulldown' });
    expect(rows[0].title).toContain('Lat Pulldown');
    expect(rows[1].title).toBe('Lat Pulldown');
    expect(rows[1].detail).toBe('4 × 8–10');
  });
});
