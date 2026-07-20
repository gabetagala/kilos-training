import { describe, expect, it } from 'vitest';
import {
  buildStepQueue,
  estimateSessionMins,
  getRehabSession,
  nextWorkLabel,
  REHAB_EXERCISES,
  REHAB_SESSIONS,
  sessionSetTotal,
  tempoStateAt,
} from '../../src/workout/rehab.js';
import {
  DENSITY40_SESSIONS,
  getProgramSession,
  PROGRAM_EXERCISES,
} from '../../src/workout/program.js';
import { PROGRAM_DEMOS, REHAB_DEMOS } from '../../src/workout/rehabDemos.js';

describe('rehab program data', () => {
  it('every block references a known exercise, and every exercise has a demo', () => {
    for (const session of REHAB_SESSIONS) {
      for (const block of session.blocks) {
        expect(REHAB_EXERCISES[block.ex], `exercise ${block.ex}`).toBeTruthy();
        expect(REHAB_DEMOS[block.ex], `demo ${block.ex}`).toBeTruthy();
      }
    }
  });

  it('covers the full protocol: decompression, McGill Big 3, glutes, hinge, mobility', () => {
    const daily = getRehabSession('daily');
    expect(daily.blocks.map((b) => b.ex)).toEqual([
      'dead-hang',
      'mcgill-curlup',
      'side-plank',
      'bird-dog',
      'glute-bridge',
    ]);
    const hinge = getRehabSession('hinge');
    expect(hinge.blocks[0].ex).toBe('rdl');
  });

  it('doses the McGill Big 3 as descending-pyramid 10s holds (protocol)', () => {
    const daily = getRehabSession('daily');
    const curl = daily.blocks.find((b) => b.ex === 'mcgill-curlup');
    expect(curl.repScheme[0]).toBeGreaterThan(curl.repScheme.at(-1));
    expect(curl.holdSecs).toBeGreaterThanOrEqual(8);
    expect(curl.holdSecs).toBeLessThanOrEqual(10);
    for (const ex of ['side-plank', 'bird-dog']) {
      const b = daily.blocks.find((x) => x.ex === ex);
      expect(b.mode).toBe('reps');
      expect(b.perSide).toBe(true);
      expect(b.repScheme[0]).toBeGreaterThan(b.repScheme.at(-1));
    }
  });

  it('makes the glute bridge continuous tempo, not hold-and-reset', () => {
    const bridge = getRehabSession('daily').blocks.find(
      (b) => b.ex === 'glute-bridge',
    );
    expect(bridge.mode).toBe('tempo');
    expect(bridge.tempo.map(([l]) => l)).toEqual(['LIFT', 'SQUEEZE', 'LOWER']);
  });

  it('accumulates 60–90s of daily dead-hang time (protocol)', () => {
    const hang = getRehabSession('daily').blocks.find(
      (b) => b.ex === 'dead-hang',
    );
    const total = hang.sets * hang.holdSecs;
    expect(total).toBeGreaterThanOrEqual(60);
    expect(total).toBeLessThanOrEqual(90);
  });
});

describe('buildStepQueue', () => {
  const daily = buildStepQueue(getRehabSession('daily'));
  const hinge = buildStepQueue(getRehabSession('hinge'));

  it('starts every exercise with a prep step', () => {
    for (const q of [daily, hinge]) {
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
    for (const q of [daily, hinge]) {
      expect(q[q.length - 1].kind).toBe('work');
      q.forEach((step, i) => {
        const next = q[i + 1];
        if (next?.kind === 'prep') expect(step.kind).toBe('work');
      });
    }
  });

  it('expands the curl-up pyramid into 5-3-1 timed holds with re-braces', () => {
    const curls = daily.filter((s) => s.exId === 'mcgill-curlup');
    const work = curls.filter((s) => s.kind === 'work');
    expect(work).toHaveLength(9); // 5 + 3 + 1
    expect(work.every((s) => s.secs === 10)).toBe(true);
    expect(work.filter((s) => s.countsAsSet)).toHaveLength(3);
    expect(work.map((s) => s.rep)).toEqual([1, 2, 3, 4, 5, 1, 2, 3, 1]);
    // re-braces only within a set: 4 + 2 + 0
    expect(curls.filter((s) => s.phase === 'BREATHE')).toHaveLength(6);
  });

  it('runs each pyramid set on the left then the right', () => {
    const planks = daily.filter(
      (s) => s.exId === 'side-plank' && s.kind === 'work',
    );
    expect(planks.map((s) => s.side)).toEqual([
      ...Array(3).fill('LEFT'),
      ...Array(3).fill('RIGHT'),
      ...Array(2).fill('LEFT'),
      ...Array(2).fill('RIGHT'),
      'LEFT',
      'RIGHT',
    ]);
  });

  it('builds the bridge as one continuous tempo step per set', () => {
    const bridges = daily.filter(
      (s) => s.exId === 'glute-bridge' && s.kind === 'work',
    );
    expect(bridges).toHaveLength(2);
    for (const b of bridges) {
      expect(b.secs).toBe(40); // 10 reps × 4s tempo
      expect(b.tempo.reps).toBe(10);
      expect(b.tempo.secsPerRep).toBe(4);
    }
  });

  it('makes lift sets manual with weight logging', () => {
    const rdls = hinge.filter((s) => s.exId === 'rdl' && s.kind === 'work');
    expect(rdls).toHaveLength(3);
    for (const s of rdls) {
      expect(s.manual).toBe(true);
      expect(s.logWeight).toBe(true);
      expect(s.secs).toBeNull();
      expect(s.reps).toBe(8);
    }
  });

  it('counts logical sets per side', () => {
    // hang 3 + curl 3 + plank 3×2 + bird 3×2 + bridge 2 = 20
    expect(sessionSetTotal(getRehabSession('daily'))).toBe(20);
    // rdl 3 + single-leg bridge 2×2 + hamstring 2×2 + hip flexor 2×2 = 15
    expect(sessionSetTotal(getRehabSession('hinge'))).toBe(15);
  });

  it('loads the single-leg bridge per side as continuous tempo sets', () => {
    const slb = hinge.filter(
      (s) => s.exId === 'single-leg-bridge' && s.kind === 'work',
    );
    expect(slb.map((s) => s.side)).toEqual(['LEFT', 'RIGHT', 'LEFT', 'RIGHT']);
    for (const s of slb) {
      expect(s.secs).toBe(24); // 6 reps × 4s tempo
      expect(s.tempo.reps).toBe(6);
    }
  });

  it('every timed step has positive seconds', () => {
    for (const q of [daily, hinge]) {
      for (const s of q) {
        if (!s.manual) expect(s.secs).toBeGreaterThan(0);
      }
    }
  });
});

describe('player helpers', () => {
  it('nextWorkLabel points rests at the next thing to do', () => {
    const daily = buildStepQueue(getRehabSession('daily'));
    expect(nextWorkLabel(daily, -1)).toBe('Dead Hang');
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
    expect(tempoStateAt(tempo, 0)).toEqual({ rep: 1, label: 'LIFT' });
    expect(tempoStateAt(tempo, 1500)).toEqual({ rep: 1, label: 'SQUEEZE' });
    expect(tempoStateAt(tempo, 3500)).toEqual({ rep: 1, label: 'LOWER' });
    expect(tempoStateAt(tempo, 4000)).toEqual({ rep: 2, label: 'LIFT' });
    expect(tempoStateAt(tempo, 39999)).toEqual({ rep: 10, label: 'LOWER' });
    // never overruns the final rep even past the end
    expect(tempoStateAt(tempo, 999999).rep).toBe(10);
  });

  it('sessions land in a believable duration band', () => {
    expect(estimateSessionMins(getRehabSession('daily'))).toBeGreaterThanOrEqual(12);
    expect(estimateSessionMins(getRehabSession('daily'))).toBeLessThanOrEqual(18);
    expect(estimateSessionMins(getRehabSession('hinge'))).toBeGreaterThanOrEqual(8);
    expect(estimateSessionMins(getRehabSession('hinge'))).toBeLessThanOrEqual(14);
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

  it('sessions land inside the 40-minute promise', () => {
    for (const session of DENSITY40_SESSIONS) {
      const mins = estimateSessionMins(session);
      expect(mins).toBeGreaterThanOrEqual(20);
      expect(mins).toBeLessThanOrEqual(40);
    }
  });
});
