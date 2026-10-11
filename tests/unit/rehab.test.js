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
import {
  applyAmber,
  applyFormats,
  applyPhase,
  applyPieceFormat,
  applyShort,
  OPEN_PACE_BANNED,
} from '../../src/workout/block.js';

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

  // the alias must sit BELOW band-pull-apart's own definition (it once
  // copied undefined)
  it('the Pallof press has a demo', () => {
    expect({ ...REHAB_DEMOS, ...PROGRAM_DEMOS }['pallof-press']).toBeTruthy();
  });

  // THE BACK & HIPS SHAPE (2026-10-10, physio + coach QA): OPEN → BRACE →
  // CONTRACT → the day's own work → FOLD. Round 3 (physio QA): the two folds
  // close EVERY session, after the carry and the finisher too — nothing loaded
  // or scored after held flexion. The calendar index is (w−1)·4 + k with
  // k = 0 Tue, 1 Thu, 2 Sat — so variant 0 is week 1 Tuesday.
  it('is Back & Hips: openers → McGill primer → back extension → the day → folds', () => {
    expect(REHAB_SESSIONS.map((s) => s.id)).toEqual([
      'daily',
      'sunday', // the rest day (2026-08-16): openers, primer, folds, one move
      'wod', // Sunday's old mini-WOD column, opt-in
      'reset',
      'open-up',
      'engine',
      'power',
    ]);
    const daily = getRehabSession('daily');
    const SHARED_OPEN = [
      't-spine-reach',
      'couch-stretch',
      'hip-internal-rotation',
      'mcgill-curlup',
      'side-plank',
      'bird-dog',
    ];
    const FOLDS = ['elephant-walk', 'seated-good-morning'];
    const day = (v) => sessionBlocks(daily, v).map((b) => b.ex ?? b.name);
    // Tuesday: NO back extension (2×/week, Thu + Sat since round 2 — never
    // the morning after Monday's RDL) — the Pallof press right after the
    // (two-set) Big 3, the arm pump and calves, then the folds
    expect(day(0)).toEqual([
      ...SHARED_OPEN,
      'pallof-press',
      'Arms',
      'Calves',
      ...FOLDS,
    ]);
    // Thursday: back extension (72 h after the hinge), row & raise, curl &
    // lateral, calves — then the folds
    expect(day(1)).toEqual([
      ...SHARED_OPEN,
      'back-extension',
      'Row & Raise',
      'Curl & Lateral',
      'Calves',
      ...FOLDS,
    ]);
    // Saturday (sprint round): the sprints right after the Big 3 — fresh,
    // before anything loads — then the back extension, the supporting move,
    // the farmer carry and the suitcase carry; the old scored finisher is gone
    // QA round: Saturday's couch stretch moves to just before the folds —
    // the hip-flexor stretch belongs after the sprints, not before them
    expect(day(2)).toEqual([
      ...SHARED_OPEN.filter((x) => x !== 'couch-stretch'),
      'Sprints: Starts',
      'back-extension',
      'side-hip-abduction',
      'farmer-carry',
      'suitcase-carry',
      'couch-stretch',
      ...FOLDS,
    ]);
    // the folds are flagged at the source — what an amber morning and the
    // morning rule ("up less than an hour") drop — and nothing else is
    expect(daily.blocks.slice(-2).map((b) => [b.ex, b.fold])).toEqual([
      ['elephant-walk', true],
      ['seated-good-morning', true],
    ]);
    expect(daily.blocks.filter((b) => b.fold)).toHaveLength(2);
    // 48 calendar-pinned variants (round 5): the whole 12-week block × the
    // k-stride of four, so a per-PHASE rotation can read the real week
    expect(sessionVariantCount(daily)).toBe(48);
    expect(getRehabSession('hinge')).toBeNull();
  });

  // The order IS the safety rule: held end-range flexion right before a
  // loaded extension set leaves the spine less protected (ligament creep),
  // so the folds always come AFTER the back extension — and since round 3
  // after every loaded and scored block — and the McGill primer always comes
  // before it.
  it('primes before it loads, and folds only after the work — every real day', () => {
    const daily = getRehabSession('daily');
    for (let w = 0; w < 4; w++) {
      for (const k of [0, 1, 2]) {
        const v = w * 4 + k;
        const ids = sessionBlocks(daily, v).map((b) => b.ex ?? b.name);
        const at = (ex) => ids.indexOf(ex);
        // openers before the Big 3 (Saturday's couch stretch waits for the
        // end of the day, right before the folds — QA round)
        const openers =
          k === 2
            ? ['t-spine-reach', 'hip-internal-rotation']
            : ['t-spine-reach', 'couch-stretch', 'hip-internal-rotation'];
        for (const o of openers) {
          expect(at(o), `v${v} ${o}`).toBeGreaterThanOrEqual(0);
          expect(at(o), `v${v} ${o}`).toBeLessThan(at('mcgill-curlup'));
        }
        if (k === 2) expect(at('couch-stretch'), `v${v}`).toBe(ids.length - 3);
        expect(ids.filter((x) => x === 'couch-stretch'), `v${v}`).toHaveLength(1);
        // the Big 3, once each, in McGill's order
        expect(at('mcgill-curlup')).toBeLessThan(at('side-plank'));
        expect(at('side-plank')).toBeLessThan(at('bird-dog'));
        for (const b of ['mcgill-curlup', 'side-plank', 'bird-dog']) {
          expect(ids.filter((x) => x === b), `v${v} ${b}`).toHaveLength(1);
        }
        const hasExt = at('back-extension') >= 0;
        // the back extension runs Thu + Sat only — 2×/week lets the
        // extensors recover (physio QA, major), and never the morning after
        // Monday's RDL (round 2)
        expect(hasExt, `v${v} back extension`).toBe(k !== 0);
        if (hasExt) {
          expect(at('bird-dog')).toBeLessThan(at('back-extension'));
          for (const f of ['elephant-walk', 'seated-good-morning']) {
            expect(at(f), `v${v} ${f}`).toBeGreaterThan(at('back-extension'));
          }
        }
        // the two folds close the day — the day's own work (pump, carry,
        // finisher) all comes before them (round-3 physio QA)
        expect(at('elephant-walk'), `v${v}`).toBe(ids.length - 2);
        expect(at('seated-good-morning'), `v${v}`).toBe(ids.length - 1);
      }
    }
  });

  // The Movementgems supporting cast on Saturday: since round 5, ONE move a
  // PHASE (four weeks running, so it can progress) — side-hip abduction,
  // then the QL plank, then the hip airplane; the 90/90 push-up is out. Two
  // alternate on Sunday. Plank and the wall groin stretch left with the
  // 2026-10-10 rework (the Big 3 primer carries the front-core work).
  it('the supporting cast is Saturday-only on the daily, one move a phase', () => {
    const daily = getRehabSession('daily');
    // the Saturday supporting-move slot (Tuesday's Pallof slot is `cast` too)
    const slot = daily.blocks.find(
      (b) => b.rotate && b.cast && b.rotate.some((v) => v?.ex === 'side-hip-abduction'),
    );
    expect(slot.rotate).toHaveLength(48);
    // Tue / Thu (and the unused k=3 column) sit the slot out
    slot.rotate.forEach((v, i) => {
      if (i % 4 !== 2) expect(v, `slot ${i}`).toBeNull();
    });
    const sat = Array.from({ length: 12 }, (_, w) => slot.rotate[w * 4 + 2].ex);
    expect(sat).toEqual([
      ...Array(4).fill('side-hip-abduction'),
      ...Array(4).fill('ql-plank'),
      ...Array(4).fill('hip-airplane'),
    ]);
    expect(sat).not.toContain('90-90-pushup');
    // and the calendar index reaches it: week w Saturday is (w − 1)·4 + 2
    const satCast = (week) =>
      sessionBlocks(daily, (week - 1) * 4 + 2).find((b) =>
        ['side-hip-abduction', 'hip-airplane', 'ql-plank', '90-90-pushup'].includes(b.ex),
      )?.ex;
    expect([1, 5, 9].map(satCast)).toEqual(['side-hip-abduction', 'ql-plank', 'hip-airplane']);
    // (45-min round: Sunday's Pallof is flagged `cast` too, so the rotating
    // supporting-move slot is the cast block that rotates)
    const sunday = getRehabSession('sunday');
    const sunCast = sunday.blocks.find((b) => b.cast && b.rotate);
    expect(sunCast.rotate.map((v) => v.ex)).toEqual([
      'hip-flexor-lift',
      'side-hip-adduction',
    ]);
  });

  it('doses the stretches as one long set, and breaks the burn-holds up', () => {
    // The positional stretches keep the one-long-set mechanism: the duration
    // IS the prescription. Couch 1:00 a side (round 5: was 1:30), seated
    // good morning 1:30 (round 4: was 2:00).
    const daily = getRehabSession('daily');
    for (let v = 0; v < 3; v++) {
      for (const b of sessionBlocks(daily, v)) {
        if (b.mode !== 'hold' || b.phase !== 'BREATHE') continue;
        expect(b.sets, b.ex).toBe(1);
        expect(b.holdSecs, b.ex).toBe(
          { 'couch-stretch': 60, 'seated-good-morning': 90 }[b.ex],
        );
      }
    }
    // physio QA: a 2-minute QL plank degrades into the low back sagging —
    // its phase (weeks 5–8) serves it as short crisp sets a side instead
    const ql = sessionBlocks(daily, 4 * 4 + 2).find((b) => b.ex === 'ql-plank');
    expect(ql).toMatchObject({ sets: 3, holdSecs: 20, perSide: true });
    // the openers (round 5): t-spine reach 10 a side, hip IR 10 a side
    const open = sessionBlocks(daily, 0).slice(0, 3);
    expect(open.map((b) => [b.ex, b.reps ?? b.holdSecs])).toEqual([
      ['t-spine-reach', 10],
      ['couch-stretch', 60],
      ['hip-internal-rotation', 10],
    ]);
    // Sunday's supporting moves too (round 2): short sets of 20 s a side,
    // not 2 minutes "close to cramping" in a long-sit
    for (const v of getRehabSession('sunday').blocks.find((b) => b.cast && b.rotate).rotate) {
      expect(v, v.ex).toMatchObject({ sets: 3, holdSecs: 20, perSide: true });
    }
  });

  // The day-specific work of Back & Hips: the lift days' isolation moved
  // here (coach QA) as spine-quiet pumps, and Saturday keeps the scored
  // engine finisher. Every block is flagged `finisher` so the short, amber
  // and ramp days drop it first — except the one `shortKeep` pump slot.
  it('Tue pumps arms + calves, Thu row & raise / curl & lateral / calves, Sat sprints + carries', () => {
    const daily = getRehabSession('daily');
    // the day's work, without the two folds that close it
    const work = (v) => sessionBlocks(daily, v).filter((b) => !b.fold);
    for (let w = 0; w < 4; w++) {
      // Tuesday: round 3 — a loadable chest press leads the arm pump
      const tue = work(w * 4).slice(-2);
      expect(tue.map((b) => b.name)).toEqual(['Arms', 'Calves']);
      // QA round: press, reverse curl (forearms + brachialis), extension
      expect(tue[0].members.map((m) => m.ex)).toEqual([
        'db-bench-press',
        'reverse-curl',
        'lying-db-extension',
      ]);
      // Thursday: the row pairs with the raise; the curl with the lateral
      const thu = work(w * 4 + 1).slice(-3);
      expect(thu.map((b) => b.name)).toEqual(['Row & Raise', 'Curl & Lateral', 'Calves']);
      expect(thu[0].members.map((m) => m.ex)).toEqual(['chest-supported-row', 'incline-y-raise']);
      expect(thu[1].members.map((m) => [m.ex, m.reps])).toEqual([
        ['hammer-curl', '10'],
        ['db-lateral-raise', '12'],
      ]);
      // Saturday: two farmer carries, then a suitcase carry a side (left
      // then right) close the day's work — then the couch stretch
      const sat = work(w * 4 + 2).slice(-3, -1);
      expect(work(w * 4 + 2).at(-1).ex).toBe('couch-stretch');
      expect(sat[0]).toMatchObject({ ex: 'farmer-carry', mode: 'hold', sets: 2, holdSecs: 40 });
      expect(sat[1]).toMatchObject({
        ex: 'suitcase-carry',
        mode: 'hold',
        sets: 1,
        holdSecs: 40,
        perSide: true,
      });
      const suit = buildStepQueue(daily, {}, w * 4 + 2).filter(
        (st) => st.exId === 'suitcase-carry' && st.kind === 'work',
      );
      expect(suit.map((st) => [st.side, st.secs])).toEqual([
        ['LEFT', 40],
        ['RIGHT', 40],
      ]);
    }
    // every pump is a real superset with timed rest. Tuesday's arm pump runs
    // FOUR rounds (it has the room since the back extension left Tuesday);
    // Thursday's curl & lateral runs four too (the triangle's side delts),
    // its calves two (the back extension moved there).
    // And no forced max-out every week — pumps run the lift days' "1–2 left",
    // so no member carries a LAST SET rep-out note.
    // 45-min round: Thursday's Curl & Lateral runs FIVE rounds (10 s
    // between), and the calves are three rounds on both days, 20 s rest
    const ROUNDS = {
      0: { Arms: 4, Calves: 3 },
      1: { 'Row & Raise': 3, 'Curl & Lateral': 5, Calves: 3 },
    };
    let pumps = 0;
    for (const [k, want] of Object.entries(ROUNDS)) {
      for (let w = 0; w < 4; w++) {
        for (const p of sessionBlocks(daily, w * 4 + Number(k)).filter(
          (b) => b.mode === 'circuit',
        )) {
          pumps += 1;
          expect(p.isPiece, p.name).toBe(true);
          expect(p.rounds, `k${k} ${p.name}`).toBe(want[p.name]);
          expect(p.restSecs, p.name).toBeGreaterThanOrEqual(p.name === 'Calves' ? 20 : 30);
          for (const m of p.members) expect(m.lastRoundNote, m.ex).toBeUndefined();
        }
      }
    }
    expect(pumps).toBe(4 * 5);
    // 15 s between moves (round 5), 40 s between rounds — every move in
    // these pumps is a different pair of DBs, set out beforehand
    expect(sessionBlocks(daily, 0).find((b) => b.name === 'Arms')).toMatchObject({
      betweenSecs: 15,
      restSecs: 40,
    });
    expect(sessionBlocks(daily, 1).find((b) => b.name === 'Row & Raise')).toMatchObject({
      betweenSecs: 15,
      restSecs: 40,
    });
    expect(sessionBlocks(daily, 1).find((b) => b.name === 'Curl & Lateral')).toMatchObject({
      betweenSecs: 10,
      restSecs: 40,
    });
    for (const k of [0, 1]) {
      expect(sessionBlocks(daily, k).find((b) => b.name === 'Calves').restSecs, `k${k}`).toBe(20);
    }
    // and the queue never says LAST SET on a pump
    for (const v of [0, 1]) {
      expect(
        buildStepQueue(daily, {}, v).some((st) => /LAST SET/.test(st.cueNote || '')),
        `v${v}`,
      ).toBe(false);
    }
    // a scored finisher keeps its score honest: death-by and rung ladders
    // carry their own prompt, and an EMOM finisher is a GAME (it escalates).
    // The three that left Saturday live on in the Bonus WOD now.
    const wodPool = getRehabSession('wod').blocks.flatMap((b) => b.rotate || [b]);
    for (const f of ['The Redline', 'Death by Step-Ups', 'The Climb'].map((n) =>
      wodPool.find((b) => b?.name === n),
    )) {
      if (/^Death by|The Climb/.test(f.name)) {
        expect(f.scorePrompt?.unit, f.name).toBeTruthy();
      }
      if (f.mode === 'emom') {
        expect(f.members.some((m) => m.repsPerRound), f.name).toBe(true);
      }
    }
    // and every day-specific block is droppable: flagged at the source.
    // The day's work sits between the back extension slot and Saturday's
    // couch-stretch slot (QA round), which stays on every dose — then the folds.
    const dayWork = daily.blocks.slice(-9, -3);
    const couchSlot = daily.blocks.at(-3);
    expect(couchSlot.rotate.map((x) => x?.ex ?? null).slice(0, 4)).toEqual([
      null,
      null,
      'couch-stretch',
      null,
    ]);
    expect(couchSlot.finisher || couchSlot.cast).toBeFalsy();
    expect(dayWork[0].cast).toBe(true);
    for (const b of dayWork.slice(1)) expect(b.finisher).toBe(true);
    // the Tue/Thu pumps are `pump` (a tired day keeps them); the carries
    // are not
    for (const b of dayWork.slice(1)) {
      const sat = b.rotate[2];
      expect(Boolean(b.pump), `pump slot serves Sat: ${Boolean(sat)}`).toBe(!sat);
    }
    // exactly one slot is `shortKeep` (a short or amber day keeps one round
    // of it): the Tue Arms / Thu Row & Raise slot — every move supported or
    // lying, so a stiff back tolerates it
    const keep = daily.blocks.filter((b) => b.shortKeep);
    expect(keep).toHaveLength(1);
    expect([keep[0].rotate[0].name, keep[0].rotate[1].name, keep[0].rotate[2]]).toEqual([
      'Arms',
      'Row & Raise',
      null,
    ]);
    expect(keep[0]).toMatchObject({ finisher: true, pump: true });
    // only Saturday's sprint slot is `conditioning` (and `ballistic`, so a
    // short, amber or tired day drops it) — and its steps say so
    const cond = daily.blocks.filter((b) => b.conditioning);
    expect(cond).toHaveLength(1);
    expect(cond[0]).toMatchObject({ finisher: true, conditioning: true, ballistic: true });
    expect(cond[0].rotate[2].name).toBe('Sprints: Starts');
    const satQ = buildStepQueue(daily, {}, 2);
    const sprints = satQ.filter((st) => st.piece === 'Sprints: Starts');
    expect(sprints.length).toBeGreaterThan(0);
    expect(sprints.every((st) => st.conditioning)).toBe(true);
    expect(satQ.filter((st) => st.exId === 'farmer-carry').some((st) => st.conditioning)).toBe(
      false,
    );
  });

  // AXIALLY QUIET, BY RULE: the Back & Hips days sit between the heavy ones.
  // No barbell, no pulley, no loaded ballistic anywhere in the day's work.
  it('the day-specific work never loads the spine', () => {
    const BANNED = [
      'rdl',
      'front-squat',
      'floor-press',
      'db-push-press',
      'db-hang-snatch',
      'db-hang-clean-press',
      'db-front-rack-lunge',
      'broad-jump',
    ];
    const daily = getRehabSession('daily');
    for (let v = 0; v < 48; v++) {
      for (const st of buildStepQueue(daily, {}, v)) {
        expect(BANNED, `v${v} ${st.exId}`).not.toContain(st.exId);
        expect(PROGRAM_EXERCISES[st.exId]?.pulley, `v${v} ${st.exId}`).toBeFalsy();
      }
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
    // The hinge went 3×/week → 2×/week (2026-08-10) → ONCE a week (round 2,
    // 2026-10-10, both final reviews): Monday, fresh, on its own load rule.
    // It still never shares a day with the axial anchor (the squat day), and
    // Friday's hinge slot became hamstring curls.
    const hasHinge = (s) =>
      s.blocks
        .flatMap((b) => b.rotate || [b])
        .some((b) => b?.ex === 'rdl' || (b?.members || []).some((m) => m.ex === 'rdl'));
    expect(DENSITY40_SESSIONS.filter(hasHinge).map((s) => s.id)).toEqual(['d40-a1']);
    expect(hasHinge(getProgramSession('d40-b1'))).toBe(false);
    expect(hasHinge(getProgramSession('d40-c1'))).toBe(false);
    for (const id of ['d40-b1', 'd40-c1']) {
      for (let v = 0; v < 4; v++) {
        expect(
          buildStepQueue(getProgramSession(id), {}, v).some((st) => st.exId === 'rdl'),
          `${id} v${v}`,
        ).toBe(false);
      }
    }
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
  // Thursday (no back extension, three pumps) and Saturday (cast, carry,
  // scored finisher) build different queues — check every real day
  const thu = buildStepQueue(getRehabSession('daily'), {}, 1);
  const sat = buildStepQueue(getRehabSession('daily'), {}, 2);
  const reset = buildStepQueue(getRehabSession('reset'));
  const openUp = buildStepQueue(getRehabSession('open-up'));

  it('starts every exercise with a prep step', () => {
    for (const q of [daily, thu, sat, reset, openUp]) {
      let ex = null;
      for (const step of q) {
        // piece minutes flow with no prep — the clock is the prep — and so
        // do a named superset's members (the pumps): the superset was
        // announced once, and a get-set between its moves would eat its rest
        if (step.emom || step.piece || step.blockLabel || step.kind === 'rest') {
          ex = step.exId;
          continue;
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
    for (const q of [daily, thu, sat, reset, openUp]) {
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
  // The hinge rides a superset now (2026-10-09) — Mon with the hammer curl,
  // Fri in the push/pull trio. The app holds the rest on a timer, so the
  // floor is enforced by the queue, not by how strong he feels.
  // Monday's heavier hinge day opens with one unlogged ramp set (2026-10-10,
  // physio QA: set 1 at working weight inside a superset had no ramp at all).
  // Round 2: Monday is the ONLY hinge day, and every working RDL says its
  // own effort target — "2–3 LEFT", more in reserve than the accessories'
  // "1–2 LEFT" (the member's `effort` rides the step meta).
  it('runs the hinge inside a superset, logged, ≥2:30 apart', () => {
    for (const [id, sets] of [['d40-a1', 3]]) {
      const q = buildStepQueue(getProgramSession(id));
      const rdls = q.filter(
        (s) => s.exId === 'rdl' && s.kind === 'work' && s.phase !== 'RAMP',
      );
      expect(rdls, id).toHaveLength(sets);
      for (const s of rdls) {
        expect(s.manual, id).toBe(true);
        expect(s.logWeight, id).toBe(true);
        expect(s.reps, id).toBe('8');
        expect(s.meta, id).toMatch(/^2–3 LEFT · ROUND \d OF 3 · 8 REPS$/);
      }
      // its superset partner keeps the default target
      const calves = q.filter((s) => s.exId === 'db-calf-raise' && s.countsAsSet);
      expect(calves).toHaveLength(3);
      for (const s of calves) expect(s.meta).toMatch(/^1–2 LEFT · /);
      const idx = rdls.map((r) => q.indexOf(r));
      for (let i = 1; i < idx.length; i++) {
        const gap = q
          .slice(idx[i - 1], idx[i])
          .reduce((a, st) => a + (st.secs ?? 35), 0);
        expect(gap, id).toBeGreaterThanOrEqual(150);
      }
    }
    // Monday's ramp: one unlogged set, before the first working hinge
    const mon = buildStepQueue(getProgramSession('d40-a1'));
    const ramp = mon.filter((s) => s.exId === 'rdl' && s.phase === 'RAMP');
    expect(ramp).toHaveLength(1);
    expect(ramp[0]).toMatchObject({ logWeight: false, countsAsSet: false });
    expect(mon.indexOf(ramp[0])).toBeLessThan(
      mon.findIndex((s) => s.exId === 'rdl' && s.countsAsSet),
    );
    // never on the squat day — and not on Friday any more either
    for (const id of ['d40-b1', 'd40-c1']) {
      expect(
        buildStepQueue(getProgramSession(id)).some((s) => s.exId === 'rdl'),
        id,
      ).toBe(false);
    }
  });

  it('the daily protocol carries no barbell and no filler', () => {
    for (const q of [daily, thu, sat]) {
      expect(q.some((s) => s.exId === 'rdl')).toBe(false);
    }
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
    // Tuesday: t-spine reach, couch stretch, hip IR, the two per-side
    // McGill primer moves (side plank, bird dog — two sets on Tuesday since
    // the sprint round, each set all-left then all-right) and the Pallof
    expect(Object.keys(bySide).sort()).toEqual(
      [
        't-spine-reach',
        'couch-stretch',
        'hip-internal-rotation',
        'side-plank',
        'bird-dog',
        'pallof-press',
      ].sort(),
    );
    // (45-min round: Tuesday's Pallof is two sets too)
    const SETS = { 'side-plank': 2, 'bird-dog': 2, 'pallof-press': 2 };
    for (const [ex, sides] of Object.entries(bySide)) {
      const runs = sides.filter((x, i) => x !== sides[i - 1]);
      expect(runs, ex).toEqual(
        Array(SETS[ex] || 1).fill(['LEFT', 'RIGHT']).flat(),
      );
      expect(sides.filter((x) => x === 'LEFT').length, ex).toBe(
        sides.filter((x) => x === 'RIGHT').length,
      );
    }
  });

  it('counts logical sets per side', () => {
    // Tuesday: tspine 2 + couch 2 + hipIR 2 + the TWO-set Big 3 (curl-up 2
    // + side plank 2 × 2 + bird dog 2 × 2) + Pallof 2 × 2 + elephant 1 +
    // seated-gm 1 = 22, NO back extension, then Arms 3 × 4 + Calves 1 × 3 = 37
    expect(sessionSetTotal(getRehabSession('daily'))).toBe(37);
    // Thursday: the 13 shared + back extension hold 3, then Row & Raise
    // 2 × 3 + Curl & Lateral 2 × 5 + Calves 1 × 3 = 35
    expect(sessionSetTotal(getRehabSession('daily'), 1)).toBe(35);
    // catcamel 1 + tspine 1×2 + curl 2 + (plank, bird) à 2×2 = 13
    expect(sessionSetTotal(getRehabSession('reset'))).toBe(13);
    // open-up: (bridge, ham, hip) à 2×2 = 12
    expect(sessionSetTotal(getRehabSession('open-up'))).toBe(12);
  });

  it('every timed step has positive seconds', () => {
    for (const q of [daily, thu, sat, reset, openUp]) {
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
    // Back & Hips (2026-10-10): ~16 min of openers, primer, back extension
    // and folds, then the day's own work — every real day (Tue/Thu/Sat, all
    // four weeks) lands 30–40 minutes, the same band as a lift day.
    for (let w = 0; w < 4; w++) {
      for (const k of [0, 1, 2]) {
        const d = estimateSessionMins(getRehabSession('daily'), w * 4 + k);
        expect(d, `w${w + 1} k${k}`).toBeGreaterThanOrEqual(30);
        expect(d, `w${w + 1} k${k}`).toBeLessThanOrEqual(40);
      }
    }
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

// The daily is CALENDAR-PINNED: the k-th rehab day of block week w serves
// variant (w−1)·4 + k (k = 0 Tue, 1 Thu, 2 Sat). Since 2026-10-10 the
// day-specific slots ride that index — Tue/Thu/Sat each get their own work,
// and Saturday's supporting move and scored finisher cycle by week. The other
// rehab sessions stay fixed — their repetition IS the medicine.
describe('rotation (the mechanism outlives the hinge)', () => {
  const daily = getRehabSession('daily');

  it('the daily rotates 48 calendar-pinned variants; the rest stay fixed', () => {
    expect(sessionVariantCount(daily)).toBe(48);
    // the Sunday pair is calendar-pinned too: the rest day alternates its
    // two supporting moves, the Bonus WOD cycles its seven WODs (sprint
    // round: Saturday's three scored finishers moved here)
    expect(sessionVariantCount(getRehabSession('sunday'))).toBe(2);
    expect(sessionVariantCount(getRehabSession('wod'))).toBe(7);
    for (const s of REHAB_SESSIONS) {
      if (['daily', 'sunday', 'wod'].includes(s.id)) continue;
      expect(sessionVariantCount(s), s.id).toBe(1);
      expect(variantLabel(s, 0), s.id).toBeNull();
    }
    // a week = Tue / Thu / Sat, each with its own day's work — and every
    // day closes on the same two folds (round 3)
    const dayWork = (v) => sessionBlocks(daily, v).filter((b) => !b.fold);
    const closers = [0, 1, 2].map((v) => dayWork(v).at(-1).name ?? dayWork(v).at(-1).ex);
    expect(closers).toEqual(['Calves', 'Calves', 'couch-stretch']);
    for (let v = 0; v < 48; v++) {
      expect(sessionBlocks(daily, v).at(-1).ex, `v${v}`).toBe('seated-good-morning');
    }
    // Saturday's sprints change every week: Starts, Speed, Repeats, Flying —
    // and phase 1 serves Speed again where Flying would be
    const sat = Array.from({ length: 12 }, (_, w) =>
      sessionBlocks(daily, w * 4 + 2).find((b) => /^Sprints/.test(b.name || ''))?.name,
    );
    expect(sat).toEqual(
      [
        'Starts', 'Speed', 'Repeats', 'Speed',
        'Starts', 'Speed', 'Repeats', 'Flying',
        'Starts', 'Speed', 'Repeats', 'Flying',
      ].map((n) => `Sprints: ${n}`),
    );
    // Tue and Thu are the same every week — the pumps progress reps-first,
    // which only works on a movement that comes back (the primer steps by
    // PHASE through applyPhase, never by variant)
    for (let w = 1; w < 12; w++) {
      expect(buildStepQueue(daily, {}, w * 4)).toEqual(buildStepQueue(daily, {}, 0));
      expect(buildStepQueue(daily, {}, w * 4 + 1)).toEqual(buildStepQueue(daily, {}, 1));
    }
    // four weeks on, Saturday serves the same sprint shape (one more rep from
    // phase 2) — and the next phase swaps its supporting move
    expect(buildStepQueue(daily, {}, 18)).not.toEqual(buildStepQueue(daily, {}, 2));
    const ids = (v) => sessionBlocks(daily, v).map((b) => b.ex ?? b.name);
    expect(ids(18).filter((x, i) => x !== ids(2)[i])).toEqual(['ql-plank']);
    // full repeat at the block's end
    expect(buildStepQueue(daily, {}, 48 + 2)).toEqual(buildStepQueue(daily, {}, 2));
  });

  // THE ANCHORS ARE FIXED (2026-10-10, coach QA — critical): a lift that
  // comes round once a month can't progress. Each lift day owns one anchor
  // for all twelve weeks. Round 3 (his "constantly varied" ask): the
  // warm-ups rotate weekly on every lift day, and Wednesday's Tabata still
  // rotates — nothing else does.
  it('the anchors are fixed; only the warm-ups and Wednesday\'s Tabata rotate', () => {
    const ANCHOR = { 'd40-a1': 'pull-up-bw', 'd40-b1': 'front-squat', 'd40-c1': 'incline-db-press' };
    expect(DENSITY40_SESSIONS.map((s) => sessionVariantCount(s))).toEqual([4, 4, 4]);
    for (const s of DENSITY40_SESSIONS) {
      const rotating = s.blocks.filter((b) => b.rotate);
      // the first block is always the warm-up pool
      expect(s.blocks[0].rotate, s.id).toHaveLength(4);
      // (the anchor is a one-spec pool — a wrapper, not a rotation)
      expect(
        rotating.every((b) => b === s.blocks[0] || b.finisher || b.rotate.length === 1),
        `${s.id}: only the warm-up and a finisher rotate`,
      ).toBe(true);
    }
    for (const s of DENSITY40_SESSIONS) {
      for (let v = 0; v < 12; v++) {
        // the anchor's own steps (the pair rides the piece but isn't the lift)
        const a = buildStepQueue(s, {}, v).filter(
          (st) => st.piece === 'The Anchor' && !st.pair,
        );
        expect(new Set(a.map((st) => st.exId)), `${s.id} v${v}`).toEqual(
          new Set([ANCHOR[s.id]]),
        );
      }
      expect(buildStepQueue(s, {}, 4), s.id).toEqual(buildStepQueue(s, {}, 0));
    }
    // 45-min round: Wednesday closes on a REAL metcon that changes every
    // week — an AMRAP, an EMOM, a for-time ladder, a Tabata
    const b1 = getProgramSession('d40-b1');
    const metcons = [0, 1, 2, 3].map((v) => sessionBlocks(b1, v).at(-1));
    expect(metcons.map((t) => [t.name, t.mode])).toEqual([
      ['Seven', 'amrap'],
      ['Every Minute', 'emom'],
      ['Ladder Down', 'fortime'],
      ['Tabata: Jumping Jacks', 'tabata'],
    ]);
    expect(metcons[0]).toMatchObject({ capSecs: 420 });
    expect(metcons[0].members.map((m) => [m.ex, m.reps])).toEqual([
      ['band-pull-apart', '10'],
      ['push-up', '8'],
      ['box-step-up', '12'],
    ]);
    expect(metcons[1]).toMatchObject({ rounds: 4 });
    expect(metcons[1].members.map((m) => [m.ex, m.reps])).toEqual([
      ['box-step-up', '14'],
      ['push-up', '10'],
    ]);
    expect(metcons[2].members.map((m) => [m.ex, m.repScheme])).toEqual([
      ['jumping-jack', [30, 20, 10]],
      ['box-step-up', [16, 12, 8]],
      ['push-up', [12, 8, 4]],
    ]);
    // nothing in it is spine-loaded or open-pace banned
    for (const t of metcons) {
      for (const m of t.members || [{ ex: t.ex }]) {
        expect(OPEN_PACE_BANNED, `${t.name} ${m.ex}`).not.toContain(m.ex);
      }
    }
    // the slot is conditioning, and its steps say so
    expect(b1.blocks.at(-1)).toMatchObject({ finisher: true, conditioning: true });
    for (let v = 0; v < 4; v++) {
      const st = buildStepQueue(b1, {}, v).filter((x) => x.piece === metcons[v].name);
      expect(st.length, `v${v}`).toBeGreaterThan(0);
      expect(st.every((x) => x.conditioning), `v${v}`).toBe(true);
    }
    // the AMRAP closes the session, as every AMRAP must
    const q0 = buildStepQueue(b1, {}, 0);
    expect(q0.at(-1)).toMatchObject({ amrap: true, piece: 'Seven', secs: 420 });
  });

  // THE WARM-UPS ROTATE (round 3): four per lift day, one per week (variant
  // = week − 1), the same job each time — a pulse raiser, the cat-camel, a
  // day prep, and the day's first pattern last.
  it('each lift day serves four distinct warm-ups, one per week, same job', () => {
    const WARM_LAST = {
      // Wednesday: the empty-bar front squat, then the springs
      'd40-b1': ['front-squat', 'pogo-hop'],
      // Friday: the springs (the jumps come next)
      'd40-c1': ['pogo-hop'],
    };
    for (const s of DENSITY40_SESSIONS) {
      const pool = s.blocks[0].rotate;
      const shapes = pool.map((w) => w.members.map((m) => m.ex).join(','));
      expect(new Set(shapes).size, s.id).toBe(4);
      for (const [i, w] of pool.entries()) {
        expect(w, `${s.id} wk${i + 1}`).toMatchObject({
          mode: 'circuit',
          warmup: true,
          rounds: 1,
          name: 'Warm-Up',
        });
        const ids = w.members.map((m) => m.ex);
        // a pulse raiser first, the cat-camel second
        expect(['jumping-jack', 'high-knees'], `${s.id} wk${i + 1}`).toContain(ids[0]);
        expect(ids[1], `${s.id} wk${i + 1}`).toBe('cat-camel');
        if (WARM_LAST[s.id]) {
          expect(ids.slice(-WARM_LAST[s.id].length), `${s.id} wk${i + 1}`).toEqual(
            WARM_LAST[s.id],
          );
        }
        // every warm-up move is timed, unlogged and never a set
        for (const m of w.members) {
          expect(m.secs, `${s.id} ${m.ex}`).toBeGreaterThan(0);
          expect(m.logWeight, `${s.id} ${m.ex}`).toBe(false);
          expect(m.countsAsSet, `${s.id} ${m.ex}`).toBe(false);
        }
        // the pogo is ballistic (amber / short / tired drop it); the empty
        // bar swaps to a box squat on an amber morning
        const pogo = w.members.find((m) => m.ex === 'pogo-hop');
        if (pogo) expect(pogo.ballistic).toBe(true);
        const bar = w.members.find((m) => m.ex === 'front-squat');
        if (bar) expect(bar.amberEx).toBe('box-squat');
      }
      // the variant IS the week: week w serves pool[w − 1], and the steps
      // still carry `warmup` and never count as a set
      for (let v = 0; v < 4; v++) {
        const q = buildStepQueue(s, {}, v);
        const warm = q.filter((st) => st.warmup && st.kind === 'work');
        expect(warm.map((st) => st.exId), `${s.id} v${v}`).toEqual(
          pool[v].members.map((m) => m.ex),
        );
        expect(warm.every((st) => st.countsAsSet === false && st.blockLabel === 'Warm-Up')).toBe(
          true,
        );
      }
    }
    // Monday has no springs at all
    for (const w of getProgramSession('d40-a1').blocks[0].rotate) {
      expect(w.members.some((m) => m.ballistic), 'Monday warm-up').toBe(false);
    }
  });

  // No two days share a shape: Monday closes on Wings (moved after the hinge
  // in round 2 — the RDL goes first, fresh), Wednesday on a metcon (week 1:
  // the seven-minute AMRAP), Friday on legs and back.
  it('each day closes on a different kind of block', () => {
    const lasts = DENSITY40_SESSIONS.map((s) => sessionBlocks(s, 0).at(-1));
    expect(lasts.map((b) => b.name)).toEqual([
      'Wings',
      'Seven',
      'Legs & Back',
    ]);
    expect(lasts.map((b) => b.mode)).toEqual(['circuit', 'amrap', 'circuit']);
    // the one conditioning finisher on a lift day is Wednesday's
    expect(DENSITY40_SESSIONS.map((s) => s.blocks.some((b) => b.finisher))).toEqual([
      false,
      true,
      false,
    ]);
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
    // a null day-slot sits the variant out, so the rows follow the blocks
    // that variant actually serves
    for (let v = 0; v < 3; v++) {
      expect(sessionOverview(daily, {}, v)).toHaveLength(sessionBlocks(daily, v).length);
    }
    const c1 = getProgramSession('d40-c1');
    const rows = sessionOverview(c1, {}, 0);
    expect(rows).toHaveLength(c1.blocks.length);
    // a named superset reads as a piece: its name, its format, its moves
    const legs = rows.find((r) => r.title === 'Legs & Back');
    expect(legs.piece).toBe(true);
    expect(legs.detail).toBe('SETS · 4 rounds'); // four rounds (45-min round)
    // no sliders (his kit): Legs & Back is the rear-foot split squat and the
    // lat pulldown, 20 s apart; the hamstring curl moved to the cable
    expect(legs.members.map((m) => m.name)).toEqual([
      'Rear-Foot-Elevated Split Squat',
      'Lat Pulldown',
    ]);
    expect(c1.blocks.flatMap((b) => b.rotate || [b]).find((b) => b?.name === 'Legs & Back').betweenSecs).toBe(20);
    // Friday's four blocks, in order, after the warm-up (round 2: the Jumps
    // EMOM before the press; round 4: the dips while fresh, then the legs)
    expect(rows.map((r) => r.title)).toEqual([
      'Warm-Up',
      'Jumps',
      'The Anchor',
      'Dips, Pull-Ups & Curls',
      'Legs & Back',
    ]);
    const dips = rows.find((r) => r.title === 'Dips, Pull-Ups & Curls');
    expect(dips.members.map((m) => m.name)).toEqual(['Ring Dip', 'Strict Pull-Up', 'Cable Leg Curl']);
    // the anchor's pair reads as its own member row
    const anchor = rows.find((r) => r.title === 'The Anchor');
    expect(anchor.members).toEqual([
      { name: '30° Incline DB Press', detail: '8' },
      { name: '+ DB Lateral Raise', detail: '12 in the rest' },
    ]);
    // …and Wednesday's squat has no pair
    const wedAnchor = sessionOverview(getProgramSession('d40-b1'), {}, 0).find(
      (r) => r.title === 'The Anchor',
    );
    expect(wedAnchor.members.map((m) => m.name)).toEqual(['Front Squat']);
    // the warm-up reads as minutes, not rounds
    expect(rows[0].detail).toMatch(/min · easy/);
  });
});

// THE HAMSTRING CURL MOVED TO THE CABLE (he has no sliders): Wednesday's
// superset curls 8/leg, Friday's giant set a pinned 6/leg (45 s rest). The
// ladder mechanism (ladderCap / ladderNext) stays for the pull-up anchor
// (cap 10); no leg-curl member carries one any more.
describe('the cable leg curl', () => {
  it('is served Wed 8/leg and Fri a pinned 6/leg; the slider is gone', () => {
    const curls = DENSITY40_SESSIONS.flatMap((s) =>
      s.blocks
        .flatMap((b) => b.rotate || [b])
        .filter((b) => b?.members)
        .flatMap((b) => b.members.filter((m) => m.ex === 'cable-leg-curl').map((m) => [s.id, b, m])),
    );
    expect(curls.map(([id, b, m]) => [id, b.name, m.reps, !!m.fixedReps])).toEqual([
      ['d40-b1', 'Split Squat & Curl', '10/leg', false], // 45-min round: 10/leg
      ['d40-c1', 'Dips, Pull-Ups & Curls', '6/leg', true],
    ]);
    expect(curls[1][1].restSecs).toBe(45);
    for (const [, , m] of curls) expect(m.ladderCap).toBeUndefined();
    expect(JSON.stringify(DENSITY40_SESSIONS)).not.toContain('slider-leg-curl');
    // the pull-up anchor keeps its ladder cap
    const pull = getProgramSession('d40-a1')
      .blocks.flatMap((b) => b.rotate || [b])
      .find((b) => b?.anchor).members[0];
    expect(pull.ladderCap).toBe(10);
  });

  it('is a cable move, paced, reps-first, credited to hamstrings', () => {
    const ex = PROGRAM_EXERCISES['cable-leg-curl'];
    expect(ex).toMatchObject({ name: 'Cable Leg Curl', pulley: true });
    expect(ex.repTempo).toEqual([
      ['CURL', 1],
      ['DOWN', 2],
    ]);
    expect(PROGRAM_DEMOS['cable-leg-curl']).toBeTruthy();
    // a loaded cable set carries the tempo guide in the queue
    const st = buildStepQueue(getProgramSession('d40-b1')).find(
      (x) => x.exId === 'cable-leg-curl' && x.kind === 'work',
    );
    expect(st.repTarget).toBe(10);
    expect(st.logWeight).toBe(true);
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

    const pull = anchorOf('d40-a1').filter((s) => !s.pair);
    expect(pull).toHaveLength(5); // five working rounds, no build (round 3)
    expect(pull.some((s) => s.phase === 'RAMP')).toBe(false);
    expect(pull.every((s) => s.exId === 'pull-up-bw')).toBe(true);
    // progression on a bodyweight anchor is REPS, never a weight PR
    expect(pull[0].logReps).toBe(true);

    // Wednesday's front squat and Friday's incline press: one build round
    // (~50% then ~70–75%) on a 2:30 clock (round 2 — a ~20 s set still
    // leaves 2:10, over the 2:00 floor) — four working squat sets, three
    // working presses
    for (const [id, working] of [
      ['d40-b1', 4],
      ['d40-c1', 3],
    ]) {
      const a = anchorOf(id).filter((s) => !s.pair);
      expect(a, id).toHaveLength(working + 1); // 1 to build
      const build = a.filter((s) => s.phase === 'RAMP');
      expect(build, id).toHaveLength(1);
      expect(build[0].secs, id).toBe(150); // same interval as the working sets
      expect(build[0].logWeight, id).toBe(false);
      expect(build[0].countsAsSet, id).toBe(false);
      expect(build[0].meta, id).toMatch(/WARM-UP/);
      const sets = a.filter((s) => s.phase !== 'RAMP');
      expect(sets, id).toHaveLength(working);
      for (const w of sets) expect(w.countsAsSet, id).toBe(true);
    }
    // Wednesday's squat runs every working set on the full 2:30
    for (const s of anchorOf('d40-b1')) expect(s.secs).toBe(150);
    // QA round: a working anchor set says SET n OF m — the build rounds are
    // not counted in it
    expect(anchorOf('d40-b1').map((s) => s.meta)).toEqual([
      'WARM-UP 1 OF 1 · BUILD',
      'SET 1 OF 4',
      'SET 2 OF 4',
      'SET 3 OF 4',
      'SET 4 OF 4',
    ]);
    expect(anchorOf('d40-a1').filter((s) => !s.pair).map((s) => s.meta)).toEqual(
      [1, 2, 3, 4, 5].map((n) => `SET ${n} OF 5`),
    );
  });

  // THE ANCHOR'S PAIR (round 3): a spine-quiet lateral raise rides each
  // WORKING interval of Monday's and Friday's anchor — set, pair, rest — on
  // the same clock. The anchor step shrinks to `pair.at`, the pair takes the
  // rest of the interval; never on a build round, never an anchor itself.
  it('the anchor pair rides each working interval on the same clock', () => {
    for (const [id, interval, at, working, build] of [
      ['d40-a1', 120, 40, 5, 0],
      ['d40-c1', 150, 50, 3, 1],
    ]) {
      const q = buildStepQueue(getProgramSession(id));
      const a = q.filter((s) => s.piece === 'The Anchor');
      expect(a, id).toHaveLength(build + working * 2);
      const pairs = a.filter((s) => s.pair);
      expect(pairs, id).toHaveLength(working);
      a.forEach((s, i) => {
        if (s.phase === 'RAMP') {
          // the build round keeps its full interval and has no pair after it
          expect(s.secs, id).toBe(interval);
          expect(a[i + 1]?.pair, id).toBeFalsy();
        } else if (!s.pair) {
          // a working set is followed straight by its pair; together they
          // fill exactly one interval
          const p = a[i + 1];
          expect(p?.pair, `${id} set ${i}`).toBe(true);
          expect(s.secs, id).toBe(at);
          expect(s.secs + p.secs, id).toBe(interval);
        }
      });
      for (const [r, p] of pairs.entries()) {
        expect(p, id).toMatchObject({
          exId: 'db-lateral-raise',
          kind: 'work',
          pair: true,
          build: true,
          emom: true,
          phase: 'PAIR',
          reps: '12',
          countsAsSet: true,
          logWeight: true,
          secs: interval - at,
        });
        expect(p.meta, id).toBe(`PAIR · ROUND ${build + r + 1} OF ${build + working}`);
        // never an anchor itself: no RIR prompt, no load gate
        expect(p.anchor, id).toBeFalsy();
        // a loaded DB move gets the rep counter
        expect(p.repTarget, id).toBe(12);
      }
      // the anchor's own steps are still the anchor — the pair never is
      expect(a.filter((s) => !s.pair).every((s) => s.anchor), id).toBe(true);
    }
    // Wednesday's front squat has no pair
    expect(
      buildStepQueue(getProgramSession('d40-b1')).some((s) => s.pair),
    ).toBe(false);
    // the pair is declared on the BLOCK, so an alt swap of the lift keeps it
    const swapped = buildStepQueue(getProgramSession('d40-a1'), {
      'pull-up-bw': 'lat-pulldown',
    });
    expect(swapped.filter((s) => s.pair)).toHaveLength(5);
  });

  // Power before the heavy lift (2026-10-10, both reviews): Wednesday's
  // Power EMOM — broad jumps + push press, fresh legs, real rest — before
  // the squat, and (round 2) Friday's own Jumps EMOM — broad jumps and
  // skater bounds, unloaded — before the press. Monday has none. The old
  // Prime blocks are gone; the hang snatch and the hang clean & press are no
  // longer served anywhere.
  it('jumps come before the anchor on Wed and Fri, never as volume', () => {
    const BALLISTIC = ['pogo-hop', 'broad-jump', 'power-pushup', 'skater-bound'];
    for (const id of ['d40-b1', 'd40-c1']) {
      for (let v = 0; v < 4; v++) {
        const q = buildStepQueue(getProgramSession(id), {}, v);
        const jumps = q.filter((s) => BALLISTIC.includes(s.exId) && s.kind === 'work');
        expect(jumps.length, `${id} v${v}`).toBeGreaterThan(0);
        const anchorAt = q.findIndex((s) => s.piece === 'The Anchor');
        for (const j of jumps) {
          expect(j.logWeight).not.toBe(true);
          expect(q.indexOf(j)).toBeLessThan(anchorAt);
        }
      }
    }
    // Wednesday: the jumps are the Power EMOM, flagged ballistic at the source
    const wed = getProgramSession('d40-b1');
    const power = wed.blocks.find((b) => b.name === 'Power');
    expect(power).toMatchObject({ mode: 'emom', ballistic: true, rounds: 3 });
    expect(power.members.map((m) => m.ex)).toEqual(['broad-jump', 'db-push-press']);
    expect(wed.blocks.indexOf(power)).toBeLessThan(wed.blocks.findIndex((b) => b.rotate?.[0]?.anchor));
    // Wednesday's warm-ups (all four, round 3) warm the springs: an easy pogo
    // member, flagged ballistic so an amber or tired morning drops it
    for (const wedWarm of wed.blocks[0].rotate) {
      expect(wedWarm.warmup).toBe(true);
      expect(wedWarm.members.find((m) => m.ex === 'pogo-hop')).toMatchObject({
        ballistic: true,
        countsAsSet: false,
      });
    }
    // Friday: the Jumps EMOM — unloaded, pinned, and flagged ballistic +
    // prime (a short day spends these minutes first). Round 3: three rounds
    // on a 45 s clock — +50% contacts in the same minutes
    const friS = getProgramSession('d40-c1');
    const jumpsBlock = friS.blocks.find((b) => b.name === 'Jumps');
    expect(jumpsBlock).toMatchObject({
      mode: 'emom',
      ballistic: true,
      prime: true,
      rounds: 3,
      intervalSecs: 45,
    });
    expect(jumpsBlock.members.map((m) => [m.ex, m.reps])).toEqual([
      ['broad-jump', '3'],
      ['skater-bound', '3/side'],
    ]);
    for (const m of jumpsBlock.members) {
      expect(m.fixedReps, m.ex).toBe(true);
      expect(m.logWeight, m.ex).toBe(false);
    }
    expect(friS.blocks.indexOf(jumpsBlock)).toBeLessThan(
      friS.blocks.findIndex((b) => b.rotate?.[0]?.anchor),
    );
    // Friday's warm-ups (round 3) all end on the springs — the jumps come next
    for (const w of friS.blocks[0].rotate) {
      expect(w.members.at(-1)).toMatchObject({ ex: 'pogo-hop', ballistic: true });
    }
    const fri = buildStepQueue(friS);
    const friJumps = fri.filter((s) => s.piece === 'Jumps');
    expect(friJumps).toHaveLength(6); // 2 stations × 3 rounds
    expect(friJumps.every((s) => s.logWeight === false && s.emom && s.secs === 45)).toBe(true);
    for (let v = 0; v < 4; v++) {
      const mon = buildStepQueue(getProgramSession('d40-a1'), {}, v);
      expect(mon.some((s) => BALLISTIC.includes(s.exId)), `mon v${v}`).toBe(false);
    }
    for (const s of DENSITY40_SESSIONS) {
      for (let v = 0; v < 4; v++) {
        const q = buildStepQueue(s, {}, v);
        expect(q.some((st) => st.piece === 'Prime'), `${s.id} v${v}`).toBe(false);
        expect(
          q.some((st) => ['db-hang-snatch', 'db-hang-clean-press'].includes(st.exId)),
          `${s.id} v${v}`,
        ).toBe(false);
      }
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

  // Every LOADED self-paced set carries the tempo guide — that is the rep
  // counter that makes a superset set countable. Bodyweight and band work
  // in the finishers is paced by the clock, and the ballistics are never
  // tempo-paced at all (speed work can't run to a metronome).
  it('every loaded self-paced set carries the tempo guide (the rep counter)', () => {
    for (const session of DENSITY40_SESSIONS) {
      for (let v = 0; v < 4; v++) {
        const manual = buildStepQueue(session, {}, v).filter(
          (s) => s.kind === 'work' && s.manual && s.logWeight === true,
        );
        expect(manual.length, session.id).toBeGreaterThan(0);
        for (const s of manual) {
          expect(s.repTempo, `${s.exId} repTempo`).toBeTruthy();
          expect(s.repTarget, `${s.exId} repTarget`).toBeGreaterThan(0);
        }
      }
    }
  });

  // One RAMP step per lift day: the anchor's build round on Wed and Fri; on
  // Monday the bodyweight pull-up has nothing to build to, and the one ramp
  // is the heavier hinge day's unlogged RDL set (2026-10-10).
  it('a build round can never become volume, on any day or variant', () => {
    for (const session of DENSITY40_SESSIONS) {
      for (let v = 0; v < sessionVariantCount(session); v++) {
        const build = buildStepQueue(session, {}, v).filter(
          (s) => s.phase === 'RAMP',
        );
        expect(build.length, session.id).toBe(1);
        expect(build[0].exId, session.id).toBe(
          { 'd40-a1': 'rdl', 'd40-b1': 'front-squat', 'd40-c1': 'incline-db-press' }[
            session.id
          ],
        );
        for (const r of build) {
          expect(r.logWeight, session.id).toBe(false);
          expect(r.countsAsSet, session.id).toBe(false);
        }
      }
    }
  });

  // THE CAP IS 45 MIN (his ask: "until 45 mins instead of sacrificing
  // load"): every lift day, every variant, lands 30–45 minutes.
  it('every lift day fits the 45-minute cap, on every variant', () => {
    for (const session of DENSITY40_SESSIONS) {
      for (let v = 0; v < sessionVariantCount(session); v++) {
        const mins = estimateSessionMins(session, v);
        expect(mins, `${session.id}/v${v}`).toBeGreaterThanOrEqual(30);
        expect(mins, `${session.id}/v${v}`).toBeLessThanOrEqual(45);
      }
    }
  });

  // ── Metcons (2026-08-07) ──────────────────────────────────────────────────
  // The accessory work is delivered as named pieces on a clock instead of
  // supersets with rest timers. These guard the two things that make that
  // safe: volume stays exactly auditable, and AMRAP never carries programmed
  // volume.
  // The one non-anchor EMOM left on a lift day is Wednesday's Power piece:
  // the broad jump and the push press stay on forced rest.
  it('an EMOM emits one interval step per minute, no preps mid-piece', () => {
    const q = buildStepQueue(getProgramSession('d40-b1'));
    const piece = q.filter((s) => s.piece === 'Power');
    expect(piece).toHaveLength(6); // 2 stations × 3 rounds
    for (const s of piece) {
      expect(s.kind).toBe('work');
      expect(s.secs).toBe(60);
      expect(s.emom).toBe(true);
      expect(s.manual).toBeUndefined(); // the clock runs it, not a tap
      expect(s.pieceFormat).toBe('EMOM 6');
    }
    expect(piece[0].meta).toBe('MIN 1 OF 6 · ROUND 1 OF 3');
    expect(piece.at(-1).meta).toBe('MIN 6 OF 6 · ROUND 3 OF 3');
    // a prep or a rest between minutes would silently eat one
    const first = q.indexOf(piece[0]);
    const last = q.indexOf(piece.at(-1));
    expect(q.slice(first, last + 1).every((s) => s.kind === 'work')).toBe(true);
  });

  it('EMOM minutes still log load, so progression survives the format', () => {
    const q = buildStepQueue(getProgramSession('d40-b1'));
    const power = q.filter((s) => s.piece === 'Power');
    const press = power.filter((s) => s.exId === 'db-push-press');
    expect(press).toHaveLength(3);
    for (const s of press) {
      expect(s.logWeight).toBe(true);
      expect(s.countsAsSet).toBe(true);
      expect(s.reps).toBe('4'); // fixed dose — never descended or maxed
    }
    // the broad jump is bodyweight: scored by intent, never by kilograms
    const jumps = power.filter((s) => s.exId === 'broad-jump');
    expect(jumps).toHaveLength(3);
    for (const s of jumps) expect(s.logWeight).toBe(false);
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
    expect(lift).toHaveLength(5); // five working sets, round 3
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
    expect(lift).toHaveLength(5);
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
    // superset members carry equipment fallbacks — same muscle job, so a
    // swap changes the implement, never the dose (Friday: RFE → DB split squat)
    const legs = buildStepQueue(getProgramSession('d40-c1'), {
      'rfe-split-squat': 'db-split-squat',
    });
    const split = legs.filter((s) => s.exId === 'db-split-squat' && s.countsAsSet);
    expect(split).toHaveLength(4); // Legs & Back is four rounds
    expect(split[0].logWeight).toBe(true); // a DB alt logs kilos
    expect(split[0].reps).toBe('8/leg');
    expect(legs.some((s) => s.exId === 'rfe-split-squat' && s.kind === 'work')).toBe(false);

    // and an unsanctioned swap is ignored even on a slot that does have alts
    const q = buildStepQueue(d40a, {
      'pull-up-bw': 'front-squat', // not in the anchor's alts
    });
    expect(q.filter((s) => s.exId === 'pull-up-bw').length).toBeGreaterThan(0);
    expect(q.some((s) => s.exId === 'front-squat')).toBe(false);
  });

  // The rule is read on Friday's Legs & Back, which goes HEAVY in week 2.
  it('a swapped alt serves its OWN heavy-week reps, never the primary\'s', () => {
    // QA round: Wings leads with the chest-supported row (ring-row alt)
    const a1 = getProgramSession('d40-a1');
    expect(
      a1.blocks.flatMap((b) => b.rotate || [b]).find((b) => b?.name === 'Wings').members[0],
    ).toMatchObject({ ex: 'chest-supported-row', reps: '10', alts: [{ ex: 'ring-row', reps: '10' }] });
    // the un-swapped pulldown runs heavy (~70% of 10) in Friday's week 2
    const row = buildStepQueue(applyFormats(getProgramSession('d40-c1'), 2), {}, 1).filter(
      (s) => s.exId === 'lat-pulldown' && s.countsAsSet,
    );
    expect(row.map((s) => s.reps)).toEqual(['7', '7', '7', '7']);
    // a loaded alt takes the heavy week by its OWN prescription
    const shaped = applyFormats(getProgramSession('d40-c1'), 2);
    const q = buildStepQueue(shaped, { 'rfe-split-squat': 'db-split-squat' }, 1);
    const split = q.filter((s) => s.exId === 'db-split-squat' && s.countsAsSet);
    expect(split).toHaveLength(4);
    for (const s of split) {
      expect(s.reps).toBe('6/leg'); // its own 8/leg × 0.7
      expect(s.heavy).toBe(true);
    }
  });

  // The ring row is bodyweight and rep-logged (`logReps` on the EXERCISE):
  // swapped into a heavy Wings it keeps its 10, never "HEAVY · 7" — the same
  // rule as the strict pull-up (bug found and fixed in round 6). Wings' own
  // heavy weeks land on Monday's EMOM days, so the format is applied directly.
  it('a bodyweight alt (ring row) never goes heavy', () => {
    const wings = getProgramSession('d40-a1')
      .blocks.flatMap((b) => b.rotate || [b])
      .find((b) => b?.name === 'Wings');
    const shaped = { id: 'x', blocks: [applyPieceFormat(wings, 'sets-heavy')] };
    const q = buildStepQueue(shaped, { 'chest-supported-row': 'ring-row' });
    const rows = q.filter((s) => s.exId === 'ring-row' && s.countsAsSet);
    expect(rows).toHaveLength(4); // Wings is four rounds
    for (const s of rows) {
      expect(s.reps).toBe('10');
      expect(s.heavy).toBeUndefined();
    }
  });

  it('a swapped alt carries its own flags (bodyweight never logs kilograms)', () => {
    // resolveSwap merges the WHOLE alt spec — logWeight:false on a push-up
    // fallback must reach the step, or the player logs phantom weight.
    // Friday's ring dip falls back to feet-elevated push-ups
    const c1 = getProgramSession('d40-c1');
    const q = buildStepQueue(c1, { 'ring-dip': 'elevated-pushup' }, 0);
    const pushups = q.filter(
      (s) => s.exId === 'elevated-pushup' && s.baseEx === 'ring-dip',
    );
    expect(pushups).toHaveLength(3);
    for (const s of pushups) {
      expect(s.logWeight).toBe(false);
      expect(s.reps).toBe('12'); // its own prescription, not the dip's 5
    }
  });

  it('sessionOverview reflects the chosen variants', () => {
    const rows = sessionOverview(d40a, { 'pull-up-bw': 'lat-pulldown' });
    const anchorRow = rows.find((r) => r.title === 'The Anchor');
    // the pull anchor is a two-minute lift — swapping the movement does not
    // change the slot's clock (five working rounds, round 3) — and the
    // block-level pair survives the swap
    expect(anchorRow.detail).toBe('E2M 10 · 5 rounds');
    expect(anchorRow.members.map((m) => m.name)).toEqual([
      'Lat Pulldown',
      '+ DB Lateral Raise',
    ]);
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

  it('carries the openers, the primer and the folds — nothing metcon-shaped', () => {
    for (const b of sunday.blocks) {
      for (const v of b.rotate || [b]) {
        expect(METCON.has(v?.mode), `${v?.name || v?.ex} is a metcon`).toBe(
          false,
        );
      }
    }
    // the same open → brace → fold shape as the daily, in the same order —
    // with NO back extension (2026-10-10, physio QA: 40 reps to a burn on
    // the rest day never let the extensors recover)
    // round 3: the folds close Sunday too, after the supporting move
    for (let v = 0; v < 2; v++) {
      const ids = sessionBlocks(sunday, v).map((b) => b.ex);
      expect(ids.slice(0, 6)).toEqual([
        't-spine-reach',
        'couch-stretch',
        'hip-internal-rotation',
        'mcgill-curlup',
        'side-plank',
        'bird-dog',
      ]);
      expect(ids.slice(-2)).toEqual(['elephant-walk', 'seated-good-morning']);
      // the Pallof press follows the two-set Big 3 (sprint round)
      expect(ids[6]).toBe('pallof-press');
      expect(ids).toHaveLength(10);
      expect(
        buildStepQueue(sunday, {}, v).some((st) => st.exId === 'back-extension'),
      ).toBe(false);
      // no clock, no score: nothing named as a piece or a superset
      expect(
        buildStepQueue(sunday, {}, v).some((st) => st.piece || st.blockLabel),
      ).toBe(false);
    }
    // well under a training day — the rest is the point
    for (let v = 0; v < 4; v++) {
      expect(estimateSessionMins(sunday, v)).toBeLessThan(30);
    }
  });

  it('serves one supporting move that alternates by week, before the folds', () => {
    // hip-flexor lift on odd block-weeks, side-hip adduction on even — the
    // two Movementgems moves Saturday's slot doesn't carry. Round 3: it sits
    // right before the two folds that close the day
    const cast = [...Array(4)].map((_, w) => sessionBlocks(sunday, w).at(-3).ex);
    expect(cast).toEqual([
      'hip-flexor-lift',
      'side-hip-adduction',
      'hip-flexor-lift',
      'side-hip-adduction',
    ]);
    // and it is flagged as the supporting cast, so a short Sunday drops it
    expect(sunday.blocks.at(-3).cast).toBe(true);
    expect(sunday.blocks.slice(-2).every((b) => b.fold)).toBe(true);
  });

  it('the Bonus WOD cycles seven Sunday WODs, opt-in', () => {
    // Crawl & Haul is out (bear crawls + a raced carry — his "regular
    // movements" ask + physio QA); The Porter's clocked carries replace it.
    // Sprint round: Saturday's scored finishers joined (The Sprint did not —
    // it is served nowhere now; the real sprints are Saturday's)
    const names = [...Array(7)].map(
      (_, w) => sessionBlocks(wod, w)[0].name,
    );
    expect(names).toEqual([
      'The Classic',
      'The Porter',
      'The Chase',
      'The Century',
      'The Redline',
      'Death by Step-Ups',
      'The Climb',
    ]);
    const served = REHAB_SESSIONS.flatMap((s) =>
      s.blocks.flatMap((b) => b.rotate || [b]).filter(Boolean).map((b) => b.name),
    );
    expect(served).not.toContain('The Sprint');
    // The Porter's carries run on an EMOM — a clock that rests them
    const porter = sessionBlocks(wod, 1)[0];
    expect(porter.mode).toBe('emom');
    // round 4: carries are not raced, so The Porter asks for no score
    expect(porter.scorePrompt).toBeUndefined();
  });

  it('Sunday in the week plan is the rest session plus optional extras only', () => {
    const sun = WEEK_PLAN[0];
    expect(sun.every((i) => i.type === 'rehab' && i.session)).toBe(true);
    expect(sun[0].session).toBe('sunday');
    // and no bare (full Back & Hips) rehab day lands on Sunday any more
    expect(sun.some((i) => !i.session)).toBe(false);
  });
});

// ── The work model rides the step (2026-08-16, his ask) ─────────────────────
// "Hard to know how many reps or when to start or stop" — long holds have no
// rep counter BY DESIGN (the duration is the prescription, breaks are part
// of the protocol), so every hold-mode movement must SAY its work model:
// reps or hold, the cadence, the break rule. The player renders ex.how
// under the clock; a hold without one regresses straight back to a silent
// countdown.
describe('hold-mode movements carry a work model', () => {
  // Saturday's suitcase-carry hold states its work model too (it was
  // silent when it landed in round 6 — found here, fixed in the source)
  it('the suitcase carry states its work model too', () => {
    const blocks = getRehabSession('daily').blocks.flatMap((b) => b.rotate || [b]);
    const suit = blocks.find((b) => b?.ex === 'suitcase-carry');
    expect(suit).toBeTruthy();
    expect(suit.how || PROGRAM_EXERCISES['suitcase-carry'].how).toBeTruthy();
  });

  it('every hold served by a rehab session has a how line', () => {
    for (const s of REHAB_SESSIONS) {
      for (const b of s.blocks) {
        for (const v of (b.rotate || [b]).filter(Boolean)) {
          if (v.mode !== 'hold' || v.members) continue;
          const ex = REHAB_EXERCISES[v.ex] || PROGRAM_EXERCISES[v.ex];
          // every hold — Saturday's farmer carry included (2026-10-10) —
          // states its work model, on the exercise or (since round 3) on the
          // block that serves it differently (the back-extension HOLD)
          const how = v.how || ex?.how;
          expect(how, `${s.id}: ${v.ex} needs a how line`).toBeTruthy();
          // one glanceable line, not an essay (round 6: the back-extension
          // line is 113 characters — the ceiling moved to 120, not further)
          expect(how.length, v.ex).toBeLessThanOrEqual(120);
        }
      }
    }
  });

  // round 6: the last fold sends him off safely — walk, gentle back-bends,
  // before lifting anything (the baby included)
  it('the seated good morning closes with the get-up rule', () => {
    const sgm = getRehabSession('daily').blocks.at(-1);
    expect(sgm.ex).toBe('seated-good-morning');
    expect(sgm.note).toMatch(/before you lift anything — the baby included/);
    const st = buildStepQueue(getRehabSession('daily'), {}, 0).at(-1);
    expect(st.cueNote).toBe(sgm.note);
  });

  it('the McGill core carries progression ladders like everything else', () => {
    for (const ex of ['mcgill-curlup', 'side-plank', 'bird-dog', 'plank']) {
      expect(REHAB_EXERCISES[ex].scale, ex).toBeTruthy();
    }
  });
});

// ── SATURDAY SPRINTS + MORE CORE (sprint round, his ask) ────────────────────
describe('Saturday sprints', () => {
  const daily = getRehabSession('daily');
  const sprintsOn = (week) =>
    sessionBlocks(daily, (week - 1) * 4 + 2).find((b) => /^Sprints/.test(b.name || ''));
  // [sprints, seconds, clock]
  const SHAPE = {
    Starts: [5, 4, 60],
    Speed: [4, 6, 70], // QA round: 70 s
    Repeats: [5, 5, 60],
    Flying: [3, 8, 90],
  };
  const ORDER = ['Starts', 'Speed', 'Repeats', 'Flying'];
  it('rotates weekly, Speed for Flying in phase 1, one more sprint from week 5', () => {
    for (let week = 1; week <= 12; week++) {
      let name = ORDER[(week - 1) % 4];
      if (week <= 4 && name === 'Flying') name = 'Speed';
      const [n, secs, clock] = SHAPE[name];
      const b = sprintsOn(week);
      expect(b, `wk${week}`).toMatchObject({
        mode: 'emom',
        name: `Sprints: ${name}`,
        formatLabel: 'SPRINTS',
        intervalSecs: clock,
        // QA round: three build rounds on a 90 s clock, a 30 s changeover
        warmupRounds: 3,
        warmupIntervalSecs: 90,
        changeoverSecs: 30,
        rounds: 3 + n + (week >= 5 ? 1 : 0),
      });
      expect(b.scorePrompt, `wk${week}`).toBeUndefined();
      expect(b.members).toHaveLength(1);
      const m = b.members[0];
      expect(m).toMatchObject({ ex: 'sprint', secs, logWeight: false });
      // the effort climbs by phase, never all-out — and Flying (top speed
      // from a running start) is capped at ~90% (QA round)
      const effort =
        week <= 4 ? /Effort ~80%\./ : week <= 8 || name === 'Flying' ? /Effort ~90%\./ : /Effort ~95%, never all-out\./;
      expect(m.note, `wk${week} ${name}`).toMatch(effort);
      // three build rounds: jog + drills, strides at 70 / 80 %, then one
      // stride at the day's effort (with the sore-hamstring rule)
      expect(m.warmupNotes).toHaveLength(3);
      expect(m.warmupNotes[0]).toMatch(/Jog/);
      expect(m.warmupNotes[1]).toMatch(/70%.*80%/);
      expect(m.warmupNotes[2]).toMatch(/hamstrings sore/i);
      // no room to run: high knees for the same seconds
      expect(m.alts).toEqual([{ ex: 'high-knees', secs, logWeight: false }]);
    }
  });

  it('sits right after the Big 3, Saturdays only, and runs on the clock', () => {
    for (let w = 0; w < 12; w++) {
      for (const k of [0, 1, 2]) {
        const ids = sessionBlocks(daily, w * 4 + k).map((b) => b.ex ?? b.name);
        const at = ids.findIndex((x) => /^Sprints/.test(x));
        if (k !== 2) {
          expect(at, `w${w} k${k}`).toBe(-1);
          continue;
        }
        expect(ids[at - 1], `w${w}`).toBe('bird-dog');
        expect(ids[at + 1], `w${w}`).toBe('back-extension');
      }
    }
    // week 1, Starts: two unlogged build minutes (each with its own note),
    // then five working minutes of 4 s inside a 60 s clock
    // three build rounds on 90 s, then five working minutes: 3 × 90 + 5 × 60
    // = 9.5 min on the wall clock
    const q = buildStepQueue(daily, {}, 2).filter((st) => st.piece === 'Sprints: Starts');
    expect(q).toHaveLength(8);
    const notes = sessionBlocks(daily, 2).find((b) => b.name === 'Sprints: Starts').members[0]
      .warmupNotes;
    for (const [i, st] of q.slice(0, 3).entries()) {
      expect(st).toMatchObject({ phase: 'RAMP', countsAsSet: false, logWeight: false, secs: 90 });
      expect(st.cueNote).toBe(notes[i]);
    }
    for (const st of q.slice(3)) {
      expect(st).toMatchObject({
        exId: 'sprint',
        secs: 60,
        workSecs: 4,
        emom: true,
        countsAsSet: true,
        logWeight: false,
        conditioning: true,
        pieceFormat: 'SPRINTS 10',
      });
    }
    // Speed runs its working sprints on a 70 s clock (the builds on 90)
    const speed = buildStepQueue(daily, {}, 6).filter((st) => st.piece === 'Sprints: Speed');
    expect(speed.filter((st) => st.phase !== 'RAMP').every((st) => st.secs === 70)).toBe(true);
    expect(speed.filter((st) => st.phase === 'RAMP').every((st) => st.secs === 90)).toBe(true);
    // swapped to high knees, the shape is identical
    const hk = buildStepQueue(daily, { sprint: 'high-knees' }, 2).filter(
      (st) => st.piece === 'Sprints: Starts',
    );
    expect(hk.map((st) => [st.exId, st.workSecs])).toEqual(q.map(() => ['high-knees', 4]));
  });

  it('the sprint is a full citizen: defined, open-pace banned, drawn, voiced, demoed', () => {
    const ex = PROGRAM_EXERCISES.sprint;
    expect(ex.name).toBe('Sprint');
    expect(ex.how).toMatch(/the next one starts on the clock/);
    expect(ex.scale).toMatch(/High knees/);
    expect(PROGRAM_DEMOS.sprint).toBeTruthy();
  });

  // MORE CORE: Tuesday (and Sunday) run the Big 3 twice, descending;
  // Thursday and Saturday keep one set. Phase 2+ adds one hold to the first
  // set only.
  it('serves the two-set Big 3 Tue/Sun, one set Thu/Sat, phase-stepped', () => {
    const big3 = (s, v) =>
      sessionBlocks(s, v)
        .filter((b) => b.mode === 'reps')
        .map((b) => [b.ex, b.repScheme]);
    // 45-min round: phase 3 adds one more hold again (singles 6/5/5,
    // doubles curl-up [6,3], side plank and bird dog [5,2])
    const X2 = {
      1: [['mcgill-curlup', [4, 3]], ['side-plank', [3, 2]], ['bird-dog', [3, 2]]],
      2: [['mcgill-curlup', [5, 3]], ['side-plank', [4, 2]], ['bird-dog', [4, 2]]],
      3: [['mcgill-curlup', [6, 3]], ['side-plank', [5, 2]], ['bird-dog', [5, 2]]],
    };
    const X1 = {
      1: [['mcgill-curlup', [4]], ['side-plank', [3]], ['bird-dog', [3]]],
      2: [['mcgill-curlup', [5]], ['side-plank', [4]], ['bird-dog', [4]]],
      3: [['mcgill-curlup', [6]], ['side-plank', [5]], ['bird-dog', [5]]],
    };
    for (const [ph, key] of [[1, 1], [2, 2], [3, 3]]) {
      const s = applyPhase(daily, ph);
      for (let w = 0; w < 12; w++) {
        expect(big3(s, w * 4), `p${ph} tue`).toEqual(X2[key]);
        expect(big3(s, w * 4 + 1), `p${ph} thu`).toEqual(X1[key]);
        expect(big3(s, w * 4 + 2), `p${ph} sat`).toEqual(X1[key]);
      }
      const sun = applyPhase(getRehabSession('sunday'), ph);
      for (const v of [0, 1]) expect(big3(sun, v), `p${ph} sun`).toEqual(X2[key]);
    }
    for (const b of sessionBlocks(daily, 0).filter((x) => x.mode === 'reps')) {
      expect(b.holdSecs).toBe(10);
      expect(b.resetSecs).toBe(3);
    }
  });

  // the Pallof press: anti-rotation, a press-hold-back tempo per side —
  // two sets of 8 Tuesday and Sunday (10 in phase 3); flagged `cast`, so a
  // short or amber day drops it (45-min round)
  it('serves the Pallof press Tuesday and Sunday (2 × 8, 10 in phase 3), cast', () => {
    const pallof = (s, v) => sessionBlocks(s, v).find((b) => b.ex === 'pallof-press');
    for (let w = 0; w < 12; w++) {
      expect(pallof(daily, w * 4)).toMatchObject({ mode: 'tempo', sets: 2, reps: 8, perSide: true });
      expect(pallof(daily, w * 4 + 1)).toBeUndefined();
      expect(pallof(daily, w * 4 + 2)).toBeUndefined();
    }
    expect(pallof(daily, 0).tempo).toEqual([
      ['PRESS', 1],
      ['HOLD', 3],
      ['BACK', 1],
    ]);
    const sun = getRehabSession('sunday');
    for (const [ph, reps] of [[1, 8], [2, 8], [3, 10]]) {
      expect(pallof(applyPhase(sun, ph), 0), `p${ph}`).toMatchObject({ sets: 2, reps, perSide: true });
      // Tuesday steps by phase too (QA round)
      expect(pallof(applyPhase(daily, ph), 0), `tue p${ph}`).toMatchObject({ sets: 2, reps });
    }
    expect(REHAB_EXERCISES['pallof-press'] || PROGRAM_EXERCISES['pallof-press']).toBeTruthy();
  });

  // QA round: carries progress by LOAD, not time — 40 s every phase, and
  // the farmer note says when to go heavier. The back extension pays its
  // changeover.
  it('the carries stay 40 s and progress by load; the back extension has a changeover', () => {
    for (const ph of [1, 2, 3]) {
      const s = applyPhase(daily, ph);
      for (const ex of ['farmer-carry', 'suitcase-carry']) {
        const b = sessionBlocks(s, 2).find((x) => x.ex === ex);
        expect(b.holdSecs, `p${ph} ${ex}`).toBe(40);
        expect(b.phaseHoldSecs, `p${ph} ${ex}`).toBeUndefined();
      }
    }
    expect(sessionBlocks(daily, 2).find((b) => b.ex === 'farmer-carry').note).toMatch(/Heavier DBs/);
    expect(sessionBlocks(daily, 2).find((b) => b.ex === 'back-extension').changeoverSecs).toBe(30);
  });
});

// SUSPECTED BUG (reported, QA round): the sprints' build rounds run on a
// 90 s clock (`warmupIntervalSecs`), and the PLAYER's header counts them —
// "SPRINTS 10" (3 × 90 + 5 × 60 = 9.5 min) — but sessionOverview still sizes
// the piece at rounds × interval, "SPRINTS 8". The engine's own rule is that
// the overview minutes must match the step label.
describe('overview minutes match the player clock', () => {
  it('the sprints row counts the 90 s build rounds', () => {
    const daily = getRehabSession('daily');
    const row = sessionOverview(daily, {}, 2).find((r) => /^Sprints/.test(r.title));
    const step = buildStepQueue(daily, {}, 2).find((st) => /^Sprints/.test(st.piece || ''));
    expect(step.pieceFormat).toBe('SPRINTS 10');
    expect(row.detail).toMatch(/^SPRINTS 10 · /);
  });
});

// the Pallof is `cast` (45-min round): a short or amber day spends its
// minutes elsewhere, a full day keeps both sets
describe('the Pallof press on a lighter day', () => {
  const has = (x, v) => buildStepQueue(x, {}, v).some((st) => st.exId === 'pallof-press');
  it('Sunday: dropped by the short and amber doses, kept on a full day', () => {
    const s = getRehabSession('sunday');
    expect(has(s, 0)).toBe(true);
    expect(has(applyShort(s), 0)).toBe(false);
    expect(has(applyAmber(s), 0)).toBe(false);
  });

  // the slot carries `cast` (the dose filters read slot flags)
  it('Tuesday: dropped by the short and amber doses too', () => {
    const d = getRehabSession('daily');
    expect(has(d, 0)).toBe(true);
    expect(has(applyShort(d), 0)).toBe(false);
    expect(has(applyAmber(d), 0)).toBe(false);
  });
});
