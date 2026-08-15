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
  BENCHMARK_SESSIONS,
  DENSITY40_SESSIONS,
  getProgramSession,
  PROGRAM_EXERCISES,
  WEEK_PLAN,
} from '../../src/workout/program.js';
import { PROGRAM_DEMOS, REHAB_DEMOS } from '../../src/workout/rehabDemos.js';
import { applyFormats } from '../../src/workout/block.js';

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

  it('is the distillate + finisher + core cap (2026-08-14), favorites fixed', () => {
    expect(REHAB_SESSIONS.map((s) => s.id)).toEqual([
      'daily',
      'sunday', // the rest day (2026-08-16): the holds, nothing else
      'wod', // Sunday's old mini-WOD column, opt-in
      'reset',
      'open-up',
      'engine',
      'power',
    ]);
    const daily = getRehabSession('daily');
    // v0: six fixed blocks (his favorites + the biggest levers), one rotating
    // supporting-cast slot, the finisher, then the McGill core cap
    expect(sessionBlocks(daily, 0).map((b) => b.ex ?? b.name)).toEqual([
      't-spine-reach',
      'back-extension',
      'hip-internal-rotation',
      'couch-stretch',
      'elephant-walk',
      'seated-good-morning',
      'ql-plank',
      'The Pump',
      'mcgill-curlup',
    ]);
    // 16 calendar-pinned variants: the finisher pool is 16-deep (2026-08-15,
    // "fresh all the time" + his old competitors-camp formats), the support
    // slot 8, the core caps 4 — stride-4 keeps each weekday's family while
    // cycling FOUR variants per slot; full repeat every four weeks
    expect(sessionVariantCount(daily)).toBe(16);
    expect(getRehabSession('hinge')).toBeNull();
  });

  it('every supporting-cast movement survives in the rotating slot', () => {
    const daily = getRehabSession('daily');
    const slot = daily.blocks.find(
      (b) => b.rotate && b.rotate.every((v) => v.mode === 'hold'),
    );
    expect(slot.rotate.map((v) => v.ex).sort()).toEqual(
      [
        'ql-plank',
        'side-hip-abduction',
        '90-90-pushup',
        'hip-flexor-lift',
        'hip-airplane',
        'plank',
        'wall-groin-stretch',
        'side-hip-adduction',
      ].sort(),
    );
  });

  it('doses every HOLD as one long set — the long-set mechanism is untouched', () => {
    // The duration IS the prescription on the holds. The distillate cut
    // MOVEMENTS from the day (2026-08-11), never durations.
    for (const b of sessionBlocks(getRehabSession('daily'), 0)) {
      if (b.mode !== 'hold') continue; // the tempo opener + topper EMOM
      expect(b.sets, b.ex).toBe(1);
      // the seated good morning is a 2:00 stretch by design, not a 4:00
      // endurance hold — everything else keeps the source doses
      const straightSecs = b.ex === 'seated-good-morning' ? 120 : 240;
      expect(b.holdSecs, b.ex).toBe(b.perSide ? 120 : straightSecs);
    }
  });

  it('the finishers are metcon-shaped and every day ends on the core cap', () => {
    const daily = getRehabSession('daily');
    // the finisher pool: four days, four distinct deliveries — pump for time,
    // grip for time, a Tabata redline, an AMRAP climb (2026-08-14, his call)
    const finishers = daily.blocks.find(
      (b) => b.rotate && b.rotate.some((v) => v.name),
    );
    expect(finishers.rotate.map((v) => [v.name, v.mode])).toEqual([
      ['The Pump', 'fortime'],
      ['The Arm Farm', 'emom'],
      ['The Redline', 'tabata'],
      ['The Classic', 'amrap'],
      ['The Downhill', 'fortime'],
      ['The Popeye', 'fortime'],
      ['Death by Step-Ups', 'emom'],
      ['Crawl & Haul', 'fortime'],
      ['The Porter', 'emom'],
      ['Death by Pull-Aparts', 'emom'],
      ['The Sprint', 'fortime'],
      ['The Chase', 'amrap'],
      ['The Complex', 'emom'],
      ['The Test', 'amrap'],
      ['The Climb', 'amrap'],
      ['The Century', 'fortime'],
    ]);
    // stride-4 keeps each weekday's family: Tue pump, Thu arms, Sat engine,
    // Sun WOD — and every self-terminating or self-counted format carries
    // its own score prompt so "beat last time" is never an empty promise
    for (const f of finishers.rotate) {
      if (/^Death by|The Porter/.test(f.name)) {
        expect(f.scorePrompt, f.name).toBeTruthy();
        expect(f.scorePrompt.unit, f.name).toBeTruthy();
      }
    }
    // EMOMs returned only as GAMES (death-by ladders, the carry gauntlet,
    // the load-scored arm farm) — never as the flat station cadence that
    // felt like a fourth lift day: every EMOM here escalates, alternates,
    // or scores something
    for (const f of finishers.rotate.filter((v) => v.mode === 'emom')) {
      const escalates = (f.members || []).some((m) => m.repsPerRound);
      const alternates = (f.members || []).length > 1;
      // a single-member EMOM earns its place when the movement itself is a
      // multi-part flow (the hang clean & press complex)
      const flows = (f.members || []).some(
        (m) => m.ex === 'db-hang-clean-press',
      );
      expect(escalates || alternates || flows, f.name).toBe(true);
    }
    // the session's LAST block is the core cap: McGill protocol (short 10s
    // holds), one movement per day, in every variant
    const cap = daily.blocks.at(-1);
    const MCGILL = new Set(['mcgill-curlup', 'side-plank', 'bird-dog', 'plank']);
    expect(cap.rotate).toHaveLength(16); // Latin square — every weekday cycles all four
    for (const c of cap.rotate) {
      expect(MCGILL.has(c.ex), `${c.ex} is McGill core`).toBe(true);
      expect(c.mode, c.ex).toBe('reps');
      expect(c.holdSecs, c.ex).toBe(10);
    }
  });

  it('the 10-minute McGill core survives as its own short-day session', () => {
    const reset = getRehabSession('reset');
    expect(sessionBlocks(reset, 0).map((b) => b.ex)).toEqual([
      'cat-camel',
      't-spine-reach',
      'mcgill-curlup',
      'side-plank',
      'bird-dog',
    ]);
    expect(estimateSessionMins(reset)).toBeLessThanOrEqual(11);
  });

  it('the displaced work survives at a real dose, just not daily', () => {
    // stretches + glute bridges: Sunday's easy day, and d40-b1 (leg day)
    const openUp = getRehabSession('open-up');
    expect(openUp.blocks.map((b) => b.ex)).toEqual([
      'single-leg-bridge',
      'hamstring-stretch',
      'hip-flexor-stretch',
    ]);
    // The hinge went 3×/week → 2×/week with the three-day week (2026-08-10).
    // It rides the two non-squat days: the rule is that it never shares a day
    // with the axial anchor, and the squat day is that day in every variant.
    const hasHinge = (s) =>
      s.blocks
        .flatMap((b) => b.rotate || [b])
        .some((b) => (b?.members || []).some((m) => m.ex === 'rdl'));
    expect(DENSITY40_SESSIONS.filter(hasHinge).map((s) => s.id)).toEqual([
      'd40-a1',
      'd40-c1',
    ]);
    expect(hasHinge(getProgramSession('d40-b1'))).toBe(false);
  });

  it('doses the McGill Big 3 as straight sets of short 10s holds', () => {
    const daily = getRehabSession('reset');
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
    const opener = sessionBlocks(getRehabSession('reset'), 0)[0];
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
  const reset = buildStepQueue(getRehabSession('reset'));
  const openUp = buildStepQueue(getRehabSession('open-up'));

  it('starts every exercise with a prep step', () => {
    for (const q of [daily, reset, openUp]) {
      let ex = null;
      for (const step of q) {
        if (step.emom || step.piece || step.kind === 'rest') {
          ex = step.exId;
          continue; // piece minutes flow with no prep — the clock is the prep
        }
        if (step.exId !== ex) {
          expect(step.kind).toBe('prep');
          ex = step.exId;
        }
      }
      expect(q[0].kind).toBe('prep');
    }
  });

  it('never ends a session (or an exercise) on a rest step', () => {
    for (const q of [daily, reset, openUp]) {
      expect(q[q.length - 1].kind).toBe('work');
      q.forEach((step, i) => {
        const next = q[i + 1];
        if (next?.kind === 'prep') expect(step.kind).toBe('work');
      });
    }
  });

  it('expands the curl-up into 4-4 timed holds with re-braces', () => {
    const curls = reset.filter((s) => s.exId === 'mcgill-curlup');
    const work = curls.filter((s) => s.kind === 'work');
    expect(work).toHaveLength(8); // 4 + 4
    expect(work.every((s) => s.secs === 10)).toBe(true);
    expect(work.filter((s) => s.countsAsSet)).toHaveLength(2);
    expect(work.map((s) => s.rep)).toEqual([1, 2, 3, 4, 1, 2, 3, 4]);
    // re-braces only within a set: 3 + 3
    expect(curls.filter((s) => s.phase === 'BREATHE')).toHaveLength(6);
  });

  it('runs each plank set on the left then the right', () => {
    const planks = reset.filter(
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

  // The hinge is a STATION in the day's one big piece now (2026-08-10). Its
  // rest is the length of the cycle, not the length of the interval — which is
  // the most rest it has ever had.
  it('runs the hinge as a station, logged, one set per trip round', () => {
    const q = buildStepQueue(getProgramSession('d40-c1'));
    const rdls = q.filter((s) => s.exId === 'rdl' && s.kind === 'work');
    expect(rdls).toHaveLength(4); // one per round
    for (const s of rdls) {
      expect(s.emom).toBe(true);
      expect(s.logWeight).toBe(true);
      expect(s.secs).toBe(60);
      expect(s.reps).toBe('8');
      expect(s.piece).toBe('The Gate');
    }
    // and they land at least 2:30 apart — the actual floor
    const idx = rdls.map((r) => q.indexOf(r));
    for (let i = 1; i < idx.length; i++) {
      const gap = q
        .slice(idx[i - 1], idx[i])
        .reduce((a, st) => a + (st.secs ?? 35), 0);
      expect(gap).toBeGreaterThanOrEqual(150);
    }
  });

  it('the daily protocol carries no barbell and no filler', () => {
    expect(daily.some((s) => s.exId === 'rdl')).toBe(false);
    // opener → mobility → the Big 3, and it ends there
    expect([...new Set(reset.map((s) => s.exId))]).toEqual([
      'cat-camel',
      't-spine-reach',
      'mcgill-curlup',
      'side-plank',
      'bird-dog',
    ]);
  });

  it('gives every per-side movement a left and a right, in that order', () => {
    const bySide = {};
    for (const s of daily.filter((s) => s.kind === 'work' && s.side)) {
      (bySide[s.exId] ??= []).push(s.side);
    }
    // v0: t-spine reach, hip internal rotation, couch stretch, QL plank
    expect(Object.keys(bySide)).toHaveLength(4);
    for (const [ex, sides] of Object.entries(bySide)) {
      expect(sides, ex).toEqual(['LEFT', 'RIGHT']);
    }
  });

  it('counts logical sets per side', () => {
    // v0 daily: tspine 2 + backext 1 + hipIR 2 + couch 2 + elephant 1 +
    // seated-gm 1 + ql-plank 2 + The Pump 3 movements × 3 rounds +
    // core cap (mcgill-curlup) 2 straight sets = 22
    expect(sessionSetTotal(getRehabSession('daily'))).toBe(22);
    // catcamel 1 + tspine 1×2 + curl 2 + (plank, bird) à 2×2 = 13
    expect(sessionSetTotal(getRehabSession('reset'))).toBe(13);
    // open-up: (bridge, ham, hip) à 2×2 = 12
    expect(sessionSetTotal(getRehabSession('open-up'))).toBe(12);
  });

  it('every timed step has positive seconds', () => {
    for (const q of [daily, reset, openUp]) {
      for (const s of q) {
        if (!s.manual) expect(s.secs).toBeGreaterThan(0);
      }
    }
  });
});

describe('player helpers', () => {
  it('nextWorkLabel points rests at the next thing to do', () => {
    const reset = buildStepQueue(getRehabSession('reset'));
    expect(nextWorkLabel(reset, -1)).toBe('Cat-Camel');
    expect(nextWorkLabel(reset, reset.length - 1)).toBe('FINISH');
    const switchIdx = reset.findIndex((s) => s.phase === 'SWITCH SIDES');
    expect(nextWorkLabel(reset, switchIdx)).toBe('T-Spine Reach · RIGHT');

    const daily = buildStepQueue(getRehabSession('daily'));
    expect(nextWorkLabel(daily, -1)).toBe('T-Spine Reach · LEFT');
    const sw = daily.findIndex((s) => s.phase === 'SWITCH SIDES');
    expect(nextWorkLabel(daily, sw)).toBe('T-Spine Reach · RIGHT');
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
    // 48 min of work + prep and side changeovers. Anything under 48 means a
    // duration got trimmed; much over means the changeovers have crept.
    // EMOM40 (2026-08-11): ~25 min of holds + the 12-min topper
    const d = estimateSessionMins(getRehabSession('daily'));
    expect(d).toBeGreaterThanOrEqual(33);
    expect(d).toBeLessThanOrEqual(40);
    const r = estimateSessionMins(getRehabSession('reset'));
    expect(r).toBeGreaterThanOrEqual(8);
    expect(r).toBeLessThanOrEqual(11); // the 10-minute promise
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
    for (const s of q.filter((s) => s.kind === 'work')) {
      expect(s.repTempo).toBeUndefined(); // speed work is never slow-paced
      expect(s.logWeight).toBe(false); // bodyweight — nothing to log
      expect(s.piece).toBe('The Spring');
    }
    // one minute each, twice through: the interval is what keeps every rep
    // crisp, which is this block's whole rule
    const pogo = q.filter((s) => s.exId === 'pogo-hop' && s.kind === 'work');
    expect(pogo).toHaveLength(2);
    expect(pogo.every((s) => s.phase === 'BOUNCE' && s.workSecs === 15)).toBe(true);
  });

  it('stays a primer: tiny contact counts, well under lifting length', () => {
    expect(sessionSetTotal(power)).toBe(6); // 3 stations × 2 rounds
    expect(estimateSessionMins(power)).toBeLessThanOrEqual(12);
  });
});

// The daily ROTATES again since 2026-08-11: an 8-deep supporting-cast slot
// and a 4-deep topper pool, calendar-pinned so a full week serves each topper
// exactly once. The other rehab sessions stay fixed — their repetition IS
// the medicine.
describe('rotation (the mechanism outlives the hinge)', () => {
  const daily = getRehabSession('daily');

  it('the daily rotates 16 calendar-pinned variants; the rest stay fixed', () => {
    expect(sessionVariantCount(daily)).toBe(16);
    // the Sunday pair (2026-08-16) is calendar-pinned too: the rest day
    // cycles its supporting-cast/core columns, the Bonus WOD its four WODs
    expect(sessionVariantCount(getRehabSession('sunday'))).toBe(4);
    expect(sessionVariantCount(getRehabSession('wod'))).toBe(4);
    for (const s of REHAB_SESSIONS) {
      if (['daily', 'sunday', 'wod'].includes(s.id)) continue;
      expect(sessionVariantCount(s), s.id).toBe(1);
      expect(variantLabel(s, 0), s.id).toBeNull();
    }
    // a week = 4 rehab days = each finisher once; the slot cycles at 8.
    // The finisher is the second-to-last block — the core cap closes the day.
    const finishers = [...Array(4)].map(
      (_, v) => sessionBlocks(daily, v).at(-2).name,
    );
    expect(finishers).toEqual([
      'The Pump',
      'The Arm Farm',
      'The Redline',
      'The Classic',
    ]);
    // week 2 serves the NEXT four — fresh finishers, same weekday families
    expect(sessionBlocks(daily, 4).at(-2).name).toBe('The Downhill');
    expect(sessionBlocks(daily, 8).at(-2).name).toBe('The Porter');
    expect(sessionBlocks(daily, 12).at(-2).name).toBe('The Complex');
    // full repeat at four weeks
    expect(sessionBlocks(daily, 16).at(-2).name).toBe('The Pump');
    // the core cap is weekday-pinned too: curl-up Tue, side plank Thu,
    // bird-dog Sat, plank Sun — McGill's set, one per day
    const caps = [...Array(4)].map(
      (_, v) => sessionBlocks(daily, v).at(-1).ex,
    );
    expect(caps).toEqual(['mcgill-curlup', 'side-plank', 'bird-dog', 'plank']);
    // …and the cap ROTATES by week (Latin square): Saturday is not
    // bird-dog forever — week 2's Saturday serves the plank
    expect(sessionBlocks(daily, 6).at(-1).ex).toBe('plank');
    expect(sessionBlocks(daily, 10).at(-1).ex).toBe('mcgill-curlup');
  });

  // The halves that carry a FINISHER rotate through its pool — one per
  // completed run, so at a run a week it's a different finisher every week.
  it('the finisher days rotate through the whole pool and wrap', () => {
    const withFinisher = DENSITY40_SESSIONS.filter(
      (s) => sessionVariantCount(s) > 1,
    );
    // All three days rotate now — every slot is a pool (2026-08-10), so the
    // variant count is the finisher pool's six, the deepest one in the session.
    expect(withFinisher.map((s) => s.id)).toEqual([
      'd40-a1',
      'd40-b1',
      'd40-c1',
    ]);
    for (const s of withFinisher) {
      const n = sessionVariantCount(s);
      // Every pool is four deep now, so the whole session cycles monthly.
      expect(n, s.id).toBe(4);
      const names = [...Array(n)].map((_, v) => sessionBlocks(s, v).at(-1).name);
      // EVERY PIECE HAS ITS OWN NAME — a different set of movements is a
      // different workout, so four weeks means four names on every day.
      expect(new Set(names).size, `${s.id} reuses a name`).toBe(n);
      // every pool is four deep, so the session repeats exactly monthly
      expect(buildStepQueue(s, {}, n)).toEqual(buildStepQueue(s, {}, 0));
    }
  });

  it('each finisher day starts on a different one — no shared Mondays', () => {
    const firsts = DENSITY40_SESSIONS.map((s) => sessionBlocks(s, 0).at(-1).name);
    expect(firsts).toEqual(['The Spread', 'The Forge', 'The Gate']);
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
    const c1 = getProgramSession('d40-c1');
    const rows = sessionOverview(c1, {}, 0);
    expect(rows).toHaveLength(c1.blocks.length);
    const piece = rows.find((r) => r.title === 'The Gate');
    // WALL CLOCK: 24 work minutes + 3 × 20s breathers = 25. The label must
    // match what the clock actually runs.
    expect(piece.detail).toBe('EMOM 25 · 4 rounds');
    // power opens the cycle, then the hinge — the whole day is in here,
    // weighted to the triangle, and touching the pulley exactly once
    // (the triceps rope; lats are strict pull-ups on the fixed bar)
    expect(piece.members.map((m) => m.name)).toEqual([
      'Broad Jump',
      'Romanian Deadlift',
      'Low-to-High Band Fly',
      'Strict Pull-Up',
      'DB Lateral Raise',
      'Overhead Rope Extension',
    ]);
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

  // THE WARM-UP IS ON THE ANCHOR'S CLOCK (2026-08-10). There is no tap-through
  // ramp — the heavy block opens with build rounds at the same E3M interval, so
  // a lift day starts one timer instead of a ramp and then a timer. How many
  // build rounds is per-lift: one while he is lifting light, and NONE for
  // bodyweight pull-ups, which have nothing to build up to.
  it('the anchor builds on its own clock, and pull-ups skip it entirely', () => {
    const anchorOf = (id) =>
      buildStepQueue(getProgramSession(id)).filter(
        (s) => s.piece === 'The Anchor',
      );

    const pull = anchorOf('d40-a1');
    expect(pull).toHaveLength(4); // four working rounds, no build
    expect(pull.some((s) => s.phase === 'RAMP')).toBe(false);
    expect(pull.every((s) => s.exId === 'pull-up-bw')).toBe(true);
    // progression on a bodyweight anchor is REPS, never a weight PR
    expect(pull[0].logReps).toBe(true);

    for (const id of ['d40-b1', 'd40-c1']) {
      const a = anchorOf(id);
      expect(a, id).toHaveLength(5); // 1 to build, 4 for real
      const build = a.filter((s) => s.phase === 'RAMP');
      expect(build, id).toHaveLength(1);
      expect(build[0].secs, id).toBe(180); // same interval as the working sets
      expect(build[0].logWeight, id).toBe(false);
      expect(build[0].countsAsSet, id).toBe(false);
      expect(build[0].meta, id).toMatch(/WARM-UP/);
      const working = a.filter((s) => s.phase !== 'RAMP');
      expect(working, id).toHaveLength(4);
      for (const w of working) expect(w.countsAsSet, id).toBe(true);
    }
  });

  it('the ballistic work rides the cycle, one crisp effort per round', () => {
    // the power primer is the surviving circuit — the accessory supersets all
    // became EMOM pieces on 2026-08-07
    const q = buildStepQueue(getProgramSession('d40-a1'));
    // The ballistic work is a STATION in the piece now (2026-08-10) — the day
    // is one tap, one heavy clock and one piece, with nothing else timed.
    const pogos = q.filter((s) => s.exId === 'pogo-hop' && s.kind === 'work');
    expect(pogos).toHaveLength(4); // one per round — EMOM40 runs 4 trips
    for (const j of pogos) {
      expect(j.emom).toBe(true);
      expect(j.piece).toBe('The Spread');
      expect(j.logWeight).toBe(false); // ballistic work is never logged
      expect(j.workSecs).toBe(15); // 15s of the minute; the rest is recovery
    }
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
  it('a build round can never become volume, on any day or variant', () => {
    for (const session of DENSITY40_SESSIONS) {
      for (let v = 0; v < sessionVariantCount(session); v++) {
        const build = buildStepQueue(session, {}, v).filter(
          (s) => s.phase === 'RAMP',
        );
        // zero on the bodyweight pull day, one everywhere else
        expect(build.length, session.id).toBe(session.id === 'd40-a1' ? 0 : 1);
        for (const r of build) {
          expect(r.logWeight, session.id).toBe(false);
          expect(r.countsAsSet, session.id).toBe(false);
        }
      }
    }
  });

  // EMOM40 (2026-08-11): every lift day fits the 40-minute promise — 40:00
  // of clock work, ceiling 41 to absorb the two 10-second get-sets. The DB
  // anchor weeks run shorter (E2M anchor), floor 30.
  it('every lift day fits the EMOM40 band, on every variant', () => {
    for (const session of DENSITY40_SESSIONS) {
      for (let v = 0; v < sessionVariantCount(session); v++) {
        const mins = estimateSessionMins(session, v);
        expect(mins, `${session.id}/v${v}`).toBeGreaterThanOrEqual(30);
        expect(mins, `${session.id}/v${v}`).toBeLessThanOrEqual(41);
      }
    }
  });

  // ── Metcons (2026-08-07) ──────────────────────────────────────────────────
  // The accessory work is delivered as named pieces on a clock instead of
  // supersets with rest timers. These guard the two things that make that
  // safe: volume stays exactly auditable, and AMRAP never carries programmed
  // volume.
  it('an EMOM emits one interval step per minute, no preps mid-piece', () => {
    const q = buildStepQueue(getProgramSession('d40-c1'));
    const piece = q.filter((s) => s.piece === 'The Gate');
    expect(piece).toHaveLength(24); // 6 stations × 4 rounds (EMOM40)
    for (const s of piece) {
      expect(s.kind).toBe('work');
      expect(s.secs).toBe(60);
      expect(s.emom).toBe(true);
      expect(s.manual).toBeUndefined(); // the clock runs it, not a tap
      // label = wall clock (24 work minutes + 3 × 20s breathers = 25)
      expect(s.pieceFormat).toBe('EMOM 25');
    }
    expect(piece.map((s) => s.meta)[0]).toBe('MIN 1 OF 24 · ROUND 1 OF 4');
    expect(piece.map((s) => s.meta)[23]).toBe('MIN 24 OF 24 · ROUND 4 OF 4');
    // a prep between minutes would silently eat one
    const first = q.indexOf(piece[0]);
    const last = q.indexOf(piece.at(-1));
    expect(q.slice(first, last).some((s) => s.kind === 'prep')).toBe(false);
    // ── the breather (2026-08-11) ──
    // The full rest minute died for the 40-minute cap; b1/c1 keep a 20-second
    // breather between trips because their clock had exactly that much room.
    const rests = q.slice(first, last).filter((s) => s.kind === 'rest');
    expect(rests).toHaveLength(3); // 4 rounds → 3 breathers, none after the last
    for (const r of rests) expect(r.secs).toBe(20);
    expect(q[last].kind).toBe('work'); // never ends on a rest
  });

  it('EMOM minutes still log load, so progression survives the format', () => {
    const q = buildStepQueue(getProgramSession('d40-b1'));
    const vice = q.filter((s) => s.piece === 'The Forge');
    const pushdowns = vice.filter((s) => s.exId === 'rope-pushdown');
    expect(pushdowns).toHaveLength(4);
    for (const s of pushdowns) {
      expect(s.logWeight).toBe(true);
      expect(s.countsAsSet).toBe(true);
      expect(s.repTempo).toBeTruthy(); // the rep counter still guides
    }
    // the carry is timed but still LOGS — load + time like any lift
    // (the crawl moved to the rehab-day toppers, 2026-08-11)
    const carry = vice.find((s) => s.exId === 'suitcase-carry');
    expect(carry.logWeight).toBe(true);
    expect(carry.workSecs).toBe(45);
  });

  // THE RULE THAT MUST NOT BREAK: a format whose volume is "whatever you
  // managed" can never carry a muscle's programmed dose. So every AMRAP in
  // the program has to be the LAST thing in its session — a finisher, never
  // a block that something graded depends on.
  // The lift days carry no AMRAP any more — consolidating each day into one
  // piece removed the separate finisher block (2026-08-10). The rule still
  // matters wherever an AMRAP DOES live, which is now the benchmarks: its
  // volume is "whatever you managed", so it can never carry a programmed dose.
  it('AMRAP is always a capped test, never programmed volume', () => {
    let found = 0;
    for (const s of [...DENSITY40_SESSIONS, ...BENCHMARK_SESSIONS]) {
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

  it('spine-loaded work is never on an unbounded clock, in any variant', () => {
    const SPINE_LOADED = [
      'rdl',
      'front-squat',
      'rfe-split-squat',
      'floor-press',
      'pull-up',
    ];
    for (const s of DENSITY40_SESSIONS) {
      for (let v = 0; v < sessionVariantCount(s); v++) {
        for (const st of buildStepQueue(s, {}, v)) {
          if (st.kind !== 'work' || !SPINE_LOADED.includes(st.exId)) continue;
          if (st.phase === 'RAMP') continue;
          // unbounded pace is out entirely; a clock is fine at 2:00+
          expect(st.amrap, `${s.id}/v${v}/${st.exId} amrap`).toBeFalsy();
          expect(
            st.piece && !st.emom,
            `${s.id}/v${v}/${st.exId} open pace`,
          ).toBeFalsy();
        }
      }
    }
  });

  // THE RULE THAT REPLACED "never on a clock" (2026-08-10). What breaks form is
  // HURRY, not the existence of a timer — so spine-loaded work gets a rest
  // FLOOR, measured as the REAL GAP between consecutive sets. In a multi-station
  // cycle that gap is `interval × stations`, so the hinge sitting inside the
  // piece gets MORE rest than the 90s straight sets it replaced.
  it('spine-loaded sets never come round faster than 2:30 apart', () => {
    const SPINE_LOADED = ['rdl', 'front-squat', 'rfe-split-squat', 'floor-press', 'pull-up'];
    // …and a sanctioned swap can never smuggle a spine-loaded lift onto a
    // shorter clock than the slot was designed for
    for (const s of DENSITY40_SESSIONS) {
      for (let v = 0; v < sessionVariantCount(s); v++) {
        const lastStart = new Map();
        let t = 0;
        for (const st of buildStepQueue(s, {}, v)) {
          // the warm-up ramp is off the clock on purpose: load changes between
          // ramp sets and that needs self-pacing
          const isSpine =
            st.kind === 'work' &&
            SPINE_LOADED.includes(st.exId) &&
            st.phase !== 'RAMP';
          if (isSpine) {
            const prev = lastStart.get(st.exId);
            if (prev != null) {
              expect(t - prev, `${s.id}/v${v}/${st.exId}`).toBeGreaterThanOrEqual(150);
            }
            lastStart.set(st.exId, t);
          }
          t += st.secs ?? 35;
        }
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

  // The 45-minute ceiling used to cover rehab + lift TOGETHER. It can't any
  // more: the daily rehab became the 48-minute Lower Back & Hips program on
  // 2026-08-10 — his call, made knowing the source doses it 3×/week. The
  // ceiling's real job was keeping the LIFT half short, so that is what it
  // guards now; the day's true total is asserted separately, on purpose, so
  // the cost of the decision stays visible instead of quietly deleted.
  const worstLift = () =>
    Math.max(
      ...DENSITY40_SESSIONS.flatMap((s) =>
        Array.from({ length: sessionVariantCount(s) }, (_, v) =>
          estimateSessionMins(s, v),
        ),
      ),
    );

  // THE WEEK HAS ONE SHAPE (2026-08-10). The old 45-minute ceiling covered
  // rehab + lift stacked on one day. Nothing stacks now: Mon/Wed/Fri are lifts
  // and the other four days are the 48-minute back program, so what matters is
  // that no day is the outlier he starts skipping.
  it('every lift day lands in the same band as a rehab day', () => {
    const rehab = estimateSessionMins(getRehabSession('daily'));
    for (const session of DENSITY40_SESSIONS) {
      for (let v = 0; v < sessionVariantCount(session); v++) {
        const mins = estimateSessionMins(session, v);
        expect(Math.abs(mins - rehab), `${session.id}/v${v}`).toBeLessThanOrEqual(
          12,
        );
      }
    }
  });

  it('the rehab never has to share a day with a lift', () => {
    for (const day of WEEK_PLAN) {
      const hasLift = day.some((i) => i.type === 'lift');
      const hasRehab = day.some((i) => i.type === 'rehab' && !i.session);
      expect(hasLift && hasRehab).toBe(false);
    }
    // and the short McGill fallback is still there for a day that goes sideways
    expect(estimateSessionMins(getRehabSession('reset'))).toBeLessThanOrEqual(11);
  });
});

describe('exercise swaps (sanctioned alternates)', () => {
  const d40a = getProgramSession('d40-a1');
  const d40b = getProgramSession('d40-b1');

  it('unswapped queue is unchanged and carries swap metadata', () => {
    const q = buildStepQueue(d40a);
    const lift = q.filter((s) => s.exId === 'pull-up-bw' && s.countsAsSet);
    expect(lift).toHaveLength(4);
    expect(lift[0].baseEx).toBe('pull-up-bw');
    expect(lift[0].altSpecs.map((a) => a.ex)).toEqual([
      'pull-up-bw',
      'lat-pulldown',
    ]);
    expect(lift[0].logReps).toBe(true); // bodyweight logs reps, not kilos
  });

  it('swapping the bodyweight anchor to a pulldown flips it back to load', () => {
    const q = buildStepQueue(d40a, { 'pull-up-bw': 'lat-pulldown' });
    const lift = q.filter(
      (s) => s.exId === 'lat-pulldown' && s.piece === 'The Anchor',
    );
    expect(lift).toHaveLength(4);
    expect(lift[0].logReps).toBeUndefined(); // a loaded slot logs kilos again
    // the alt carries its OWN prescription — a pulldown is not a pull-up
    expect(lift[0].reps).toBe('8');
    // queue shape is swap-independent (the player relies on this)
    expect(q).toHaveLength(buildStepQueue(d40a).length);
  });

  it('an alt overrides the slot prescription (front squat → DB split squat)', () => {
    const q = buildStepQueue(d40b, { 'front-squat': 'db-split-squat' });
    const lift = q.filter((s) => s.exId === 'db-split-squat' && s.countsAsSet);
    expect(lift[0].reps).toBe('6/leg');
    expect(lift[0].logReps).toBeUndefined();
  });

  it('piece stations swap to sanctioned alts; unsanctioned swaps are ignored', () => {
    // REVERSED 2026-08-10 (same day it was removed): quartet stations carry
    // alts again — as EQUIPMENT fallbacks, because a multi-station EMOM is the
    // format least tolerant of a taken machine and the stations had no exit.
    // The earlier worry ("an ad-hoc swap fights the four-week pool") is
    // answered by the alt POOLS: every alt serves the same muscle job at
    // budgeted reps, so a swap changes the implement, never the dose.
    const arms = buildStepQueue(getProgramSession('d40-b1'), {
      'supinated-curl': 'reverse-curl',
    });
    expect(arms.some((s) => s.exId === 'reverse-curl' && s.countsAsSet)).toBe(
      true,
    );

    // and an unsanctioned swap is ignored even on a slot that does have alts
    const q = buildStepQueue(d40a, {
      'pull-up-bw': 'front-squat', // not in the anchor's alts
    });
    expect(q.filter((s) => s.exId === 'pull-up-bw').length).toBeGreaterThan(0);
    expect(q.some((s) => s.exId === 'front-squat')).toBe(false);
  });

  it('a swapped alt runs FLAT at its own reps on descending weeks', () => {
    // The desc rep ladder is computed from the PRIMARY's prescription before
    // swaps resolve; serving it to an alt would prescribe 12,11,10,… strict
    // pull-ups onto a 3-rep fallback. resolveSwap drops the ladder instead.
    const a1 = getProgramSession('d40-a1');
    const shaped = applyFormats(a1, 2); // week 2 = emom-desc
    const q = buildStepQueue(shaped, { 'lat-pulldown': 'pull-up-bw' });
    const pulls = q.filter(
      (s) => s.exId === 'pull-up-bw' && s.piece !== 'The Anchor' && s.countsAsSet,
    );
    expect(pulls.length).toBeGreaterThan(0);
    for (const s of pulls) expect(s.reps).toBe('3');
    // …and the un-swapped station still descends (R=4 → centered on 10)
    const unswapped = buildStepQueue(shaped, {});
    const pd = unswapped.filter(
      (s) => s.exId === 'lat-pulldown' && s.piece && s.countsAsSet,
    );
    expect(pd.map((s) => s.reps)).toEqual(['11', '10', '9', '8']);
  });

  it('a swapped alt carries its own flags (bodyweight never logs kilograms)', () => {
    // resolveSwap merges the WHOLE alt spec — logWeight:false on a push-up
    // fallback must reach the step, or the player logs phantom weight.
    const c1 = getProgramSession('d40-c1');
    const q = buildStepQueue(c1, { 'band-fly': 'push-up' }, 0);
    const pushups = q.filter(
      (s) => s.exId === 'push-up' && s.baseEx === 'band-fly',
    );
    expect(pushups.length).toBeGreaterThan(0);
    for (const s of pushups) expect(s.logWeight).toBe(false);
  });

  it('sessionOverview reflects the chosen variants', () => {
    const rows = sessionOverview(d40a, { 'pull-up-bw': 'lat-pulldown' });
    const anchorRow = rows.find((r) => r.title === 'The Anchor');
    // the pull anchor is a two-minute lift — swapping the movement does not
    // change the slot's clock
    expect(anchorRow.detail).toBe('E2M 8 · 4 rounds');
    expect(anchorRow.members[0].name).toBe('Lat Pulldown');
  });
});

// ── The Sunday split (2026-08-16, his ask: "rest days on Sundays") ──────────
// Sunday used to be the fourth full rehab day, and the finisher stride made
// it the HARDEST one — its column of the pool was all mini-WODs. Now the
// required Sunday session is medicine only; the WODs are opt-in.
describe('the Sunday rest day', () => {
  const sunday = getRehabSession('sunday');
  const wod = getRehabSession('wod');
  const METCON = new Set(['emom', 'fortime', 'tabata', 'amrap', 'circuit']);

  it('carries the distillate holds and nothing metcon-shaped', () => {
    for (const b of sunday.blocks) {
      for (const v of b.rotate || [b]) {
        expect(METCON.has(v?.mode), `${v?.name || v?.ex} is a metcon`).toBe(
          false,
        );
      }
    }
    // same six fixed holds as the daily, in the same order
    expect(sunday.blocks.slice(0, 6).map((b) => b.ex)).toEqual([
      't-spine-reach',
      'back-extension',
      'hip-internal-rotation',
      'couch-stretch',
      'elephant-walk',
      'seated-good-morning',
    ]);
    // well under a training day — the rest is the point
    for (let v = 0; v < 4; v++) {
      expect(estimateSessionMins(sunday, v)).toBeLessThan(30);
    }
  });

  it('serves exactly what the pre-split Sunday column served', () => {
    // supporting cast: old (w−1)·4+3 mod 8 only ever hit indices 3 and 7 —
    // hip-flexor-lift on odd block-weeks, side-hip-adduction on even
    const cast = [...Array(4)].map((_, w) => sessionBlocks(sunday, w)[6].ex);
    expect(cast).toEqual([
      'hip-flexor-lift',
      'side-hip-adduction',
      'hip-flexor-lift',
      'side-hip-adduction',
    ]);
    // core cap: the Latin square's k=3 stripe
    const caps = [...Array(4)].map((_, w) => sessionBlocks(sunday, w).at(-1).ex);
    expect(caps).toEqual(['plank', 'mcgill-curlup', 'side-plank', 'bird-dog']);
  });

  it('the Bonus WOD cycles the four Sunday mini-WODs, opt-in', () => {
    const names = [...Array(4)].map(
      (_, w) => sessionBlocks(wod, w)[0].name,
    );
    expect(names).toEqual([
      'The Classic',
      'Crawl & Haul',
      'The Chase',
      'The Century',
    ]);
  });

  it('Sunday in the week plan is the rest session plus optional extras only', () => {
    const sun = WEEK_PLAN[0];
    expect(sun.every((i) => i.type === 'rehab' && i.session)).toBe(true);
    expect(sun[0].session).toBe('sunday');
    // and no bare (full Back & Hips) rehab day lands on Sunday any more
    expect(sun.some((i) => !i.session)).toBe(false);
  });
});
