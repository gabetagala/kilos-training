import { describe, expect, it } from 'vitest';
import {
  buildStepQueue,
  estimateSessionMins,
  estimateSessionSecs,
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
  REST_WEEKDAYS,
  WEEK_PLAN,
} from '../../src/workout/program.js';
import { OPTIONAL_SESSIONS } from '../../src/workout/volume.js';
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
  // 2026-10-20 (his ask): the brace is the CORE HOLDS now — the hollow hold,
  // side plank and bird dog as straight holds — not the McGill Big 3's
  // chopped 10 s holds; and leg raises join Tuesday and Saturday.
  it('is Back & Hips: openers → core holds → back extension → the day → folds', () => {
    expect(REHAB_SESSIONS.map((s) => s.id)).toEqual([
      'daily',
      'sunday', // Easy Back — Thursday's optional (2026-11-10; was Sunday's rest day)
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
      'hollow-hold',
      'side-plank',
      'bird-dog',
    ];
    const FOLDS = ['elephant-walk', 'seated-good-morning'];
    const day = (v) => sessionBlocks(daily, v).map((b) => b.ex ?? b.name);
    // Tuesday: NO back extension (never the morning after Monday's RDL) —
    // the Pallof press right after the core holds, the arm-and-delt pump,
    // then the leg raises, then the folds
    expect(day(0)).toEqual([
      ...SHARED_OPEN,
      'pallof-press',
      'Arms & Delts',
      'lying-leg-raise',
      ...FOLDS,
    ]);
    // Thursday is a rest day since 2026-11-10: the k=1 column serves no
    // day's work at all — only the shared skeleton every slot carries
    expect(day(1)).toEqual([
      't-spine-reach',
      'hip-internal-rotation',
      ...FOLDS,
    ]);
    // Saturday (sprint round): the sprints right after the core holds (a
    // short primer on Saturday) — fresh, before anything loads — then the
    // back extension, the supporting
    // move, the farmer carry and the suitcase carry, then the leg raises; the
    // old scored finisher is gone. QA round: Saturday's couch stretch moves
    // to just before the folds — the hip-flexor stretch belongs after the
    // sprints, not before them
    expect(day(2)).toEqual([
      ...SHARED_OPEN.filter((x) => x !== 'couch-stretch'),
      'Sprints: Starts',
      'back-extension',
      'side-hip-abduction',
      'farmer-carry',
      'suitcase-carry',
      'lying-leg-raise',
      'couch-stretch',
      ...FOLDS,
    ]);
    // the McGill Big 3 left Back & Hips (2026-10-20): no 10 s rep-holds on
    // any day of the block — the red-day Daily Reset keeps them
    for (let v = 0; v < 48; v++) {
      expect(
        sessionBlocks(daily, v).some((b) => b.mode === 'reps' || b.ex === 'mcgill-curlup'),
        `v${v}`,
      ).toBe(false);
    }
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
  // after every loaded and scored block — and the core holds (the brace,
  // since 2026-10-20) always come before it.
  it('primes before it loads, and folds only after the work — every real day', () => {
    const daily = getRehabSession('daily');
    for (let w = 0; w < 4; w++) {
      for (const k of [0, 2]) {
        const v = w * 4 + k;
        const ids = sessionBlocks(daily, v).map((b) => b.ex ?? b.name);
        const at = (ex) => ids.indexOf(ex);
        // openers before the core holds (Saturday's couch stretch waits for
        // the end of the day, right before the folds — QA round)
        const openers =
          k === 2
            ? ['t-spine-reach', 'hip-internal-rotation']
            : ['t-spine-reach', 'couch-stretch', 'hip-internal-rotation'];
        for (const o of openers) {
          expect(at(o), `v${v} ${o}`).toBeGreaterThanOrEqual(0);
          expect(at(o), `v${v} ${o}`).toBeLessThan(at('hollow-hold'));
        }
        if (k === 2) expect(at('couch-stretch'), `v${v}`).toBe(ids.length - 3);
        expect(ids.filter((x) => x === 'couch-stretch'), `v${v}`).toHaveLength(1);
        // the core holds, once each: front, side, back
        expect(at('hollow-hold')).toBeLessThan(at('side-plank'));
        expect(at('side-plank')).toBeLessThan(at('bird-dog'));
        for (const b of ['hollow-hold', 'side-plank', 'bird-dog']) {
          expect(ids.filter((x) => x === b), `v${v} ${b}`).toHaveLength(1);
        }
        // the leg raises (Tue + Sat) come after the day's loaded work —
        // never before the back extension — and before the folds
        expect(at('lying-leg-raise'), `v${v}`).toBeGreaterThan(at('bird-dog'));
        expect(at('lying-leg-raise'), `v${v}`).toBeGreaterThan(at('back-extension'));
        expect(at('lying-leg-raise'), `v${v}`).toBeLessThan(at('elephant-walk'));
        const hasExt = at('back-extension') >= 0;
        // the back extension runs Saturday only since Thursday became a rest
        // day (2026-11-10) — never the morning after Monday's RDL (round 2)
        expect(hasExt, `v${v} back extension`).toBe(k === 2);
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
    // the openers (round 5): t-spine reach 10 a side; hip IR since
    // 2026-10-21 two 45 s holds a side (ankle up, then knee up), no reps
    const open = sessionBlocks(daily, 0).slice(0, 3);
    expect(open.map((b) => [b.ex, b.reps ?? b.holdSecs])).toEqual([
      ['t-spine-reach', 10],
      ['couch-stretch', 60],
      ['hip-internal-rotation', 45],
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
  // 2026-10-20: the leg raises close Tuesday's and Saturday's work.
  // 2026-11-10: Thursday is a rest day — its laterals moved into Tuesday's
  // pump, its calves to Friday's lift day, its rows and curls left.
  it('Tue pumps arms + delts + leg raises, Sat sprints + carries + leg raises, Thu rests', () => {
    const daily = getRehabSession('daily');
    // the day's work, without the two folds that close it
    const work = (v) => sessionBlocks(daily, v).filter((b) => !b.fold);
    for (let w = 0; w < 4; w++) {
      // Tuesday: round 3 — a loadable chest press leads the arm pump; the
      // leg raises close the day's work, and no calves
      const tue = work(w * 4).slice(-2);
      expect(tue.map((b) => b.name ?? b.ex)).toEqual(['Arms & Delts', 'lying-leg-raise']);
      expect(work(w * 4).some((b) => b.name === 'Calves'), `w${w} tue`).toBe(false);
      // QA round: press, reverse curl (forearms + brachialis), triceps — the
      // lying DB extension (the rope pushdown 2026-10-21 to 2026-11-03) —
      // and Thursday's delt work last (2026-11-10): the lateral raise, then
      // the band pull-apart for the rear delts — a short day drops it
      expect(tue[0].members.map((m) => [m.ex, m.reps])).toEqual([
        ['db-bench-press', '10'],
        ['reverse-curl', '10'],
        ['lying-db-extension', '10'],
        ['db-lateral-raise', '12'],
        ['band-pull-apart', '15'],
      ]);
      expect(tue[0].members.filter((m) => m.shortDrop).map((m) => m.ex)).toEqual([
        'band-pull-apart',
      ]);
      // Thursday: no pump, no circuit — a rest day
      expect(work(w * 4 + 1).some((b) => b.mode === 'circuit'), `w${w} thu`).toBe(false);
      // Saturday: two farmer carries, then a suitcase carry a side (left
      // then right), then the leg raises — then the couch stretch
      const sat = work(w * 4 + 2).slice(-4, -2);
      expect(work(w * 4 + 2).at(-2).ex).toBe('lying-leg-raise');
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
    // every pump is a real superset with timed rest. Tuesday's runs THREE
    // rounds (the three-set cap, 2026-11-10 — was four), the only pump left.
    // And no forced max-out every week — pumps run the lift days' "1–2 left",
    // so no member carries a LAST SET rep-out note.
    const ROUNDS = {
      0: { 'Arms & Delts': 3 },
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
    expect(pumps).toBe(4);
    // 15 s between moves (round 5), 40 s between rounds — every move in
    // these pumps is a different pair of DBs, set out beforehand
    expect(sessionBlocks(daily, 0).find((b) => b.name === 'Arms & Delts')).toMatchObject({
      betweenSecs: 15,
      restSecs: 40,
    });
    // no calves on Back & Hips at all since 2026-11-10 (Mon + Fri lift days)
    expect(daily.blocks.some((b) => b.rotate?.some((x) => x?.name === 'Calves'))).toBe(false);
    // and the queue never says LAST SET on a pump
    for (const v of [0]) {
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
    // The day's work sits between the back extension slot and the leg-raise
    // slot (2026-10-20), then Saturday's couch-stretch slot (QA round), which
    // stays on every dose — then the folds. (Four slots since 2026-11-10:
    // the supporting move, Tuesday's pump, the two carries — Thursday's
    // curl-and-lateral and calves slots left with Thursday.)
    const dayWork = daily.blocks.slice(-8, -4);
    // the leg raises: Tue + Sat, an extra (`cast`) — never a finisher or a
    // pump, so a short, amber or tired day lets them sit out
    const legRaiseSlot = daily.blocks.at(-4);
    expect(legRaiseSlot.rotate.map((x) => x?.ex ?? null).slice(0, 4)).toEqual([
      'lying-leg-raise',
      null,
      'lying-leg-raise',
      null,
    ]);
    expect(legRaiseSlot.cast).toBe(true);
    // a flexed-pelvis move: the morning rule ("up under 1 hr") sits it out
    expect(legRaiseSlot.morning).toBe(true);
    expect(legRaiseSlot.amberBlock).toBeUndefined();
    expect(legRaiseSlot.finisher || legRaiseSlot.pump).toBeFalsy();
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
    // Tuesday's pump is `pump` (a tired day keeps it); the carries are not
    for (const b of dayWork.slice(1)) {
      const sat = b.rotate[2];
      expect(Boolean(b.pump), `pump slot serves Sat: ${Boolean(sat)}`).toBe(!sat);
    }
    // exactly one slot is `shortKeep` (a short or amber day keeps one round
    // of it): Tuesday's Arms & Delts — every move supported or standing
    // light, so a stiff back tolerates it
    const keep = daily.blocks.filter((b) => b.shortKeep);
    expect(keep).toHaveLength(1);
    expect([keep[0].rotate[0].name, keep[0].rotate[1], keep[0].rotate[2]]).toEqual([
      'Arms & Delts',
      null,
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
      'db-hang-clean',
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
    // Tuesday: t-spine reach, couch stretch, hip IR, the two per-side core
    // holds (side plank, bird dog — two sets on Tuesday, each set left then
    // right) and the Pallof. The hollow hold and the leg raises are both
    // sides at once.
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
    // Tuesday: tspine 2 + couch 2 + hipIR 4 (two holds a side since
    // 2026-10-21) + the full core holds (hollow 3 + side plank 2 × 2 + bird
    // dog 2 × 2) + Pallof 2 × 2 + elephant 1 + seated-gm 1 = 25, NO back
    // extension, then Arms & Delts 5 × 3 + leg raises 3 (no calves) = 43
    expect(sessionSetTotal(getRehabSession('daily'))).toBe(43);
    // Thursday (k=1) is a rest day since 2026-11-10: only the skeleton every
    // slot carries — tspine 2 + hipIR 4 + elephant 1 + seated-gm 1 = 8
    expect(sessionSetTotal(getRehabSession('daily'), 1)).toBe(8);
    // Saturday: tspine 2 + hipIR 4 + the primer holds 5 = 11, five working
    // sprints (the three build rounds never count), back extension 3,
    // side-hip abduction 2, farmer 2, suitcase 2, leg raises 3, couch 2,
    // elephant 1, seated-gm 1 = 32
    expect(sessionSetTotal(getRehabSession('daily'), 2)).toBe(32);
    // Easy Back (Thursday's optional, was Sunday's): openers 8 + one set of
    // each hold (hollow 1 + side plank 2 + bird dog 2) + Pallof 2 × 2 + the
    // supporting move 3 × 2 + elephant 1 + seated-gm 1 = 25
    expect(sessionSetTotal(getRehabSession('sunday'))).toBe(25);
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
    // and folds, then the day's own work — every real day (Tue/Sat since
    // 2026-11-10, all four weeks) lands 30–45 minutes, the same band as a
    // lift day (the 45:00 cap since 2026-10-09).
    for (let w = 0; w < 4; w++) {
      for (const k of [0, 2]) {
        const d = estimateSessionMins(getRehabSession('daily'), w * 4 + k);
        expect(d, `w${w + 1} k${k}`).toBeGreaterThanOrEqual(30);
        expect(d, `w${w + 1} k${k}`).toBeLessThanOrEqual(45);
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
    // a week = Tue / Sat (Thursday rests since 2026-11-10), each with its own
    // day's work — and every day closes on the same two folds (round 3).
    // Tuesday's work ends on the leg raises, Saturday's on the couch stretch
    const dayWork = (v) => sessionBlocks(daily, v).filter((b) => !b.fold);
    const closers = [0, 2].map((v) => dayWork(v).at(-1).name ?? dayWork(v).at(-1).ex);
    expect(closers).toEqual(['lying-leg-raise', 'couch-stretch']);
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
    // Tuesday is the same every week — the pumps progress reps-first,
    // which only works on a movement that comes back (the primer steps by
    // PHASE through applyPhase, never by variant)
    for (let w = 1; w < 12; w++) {
      expect(buildStepQueue(daily, {}, w * 4)).toEqual(buildStepQueue(daily, {}, 0));
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
    // 2026-10-20: ring rows, not push-ups — Mon, Tue and Fri already press,
    // so the metcon stays full-body without a fourth pressing day
    expect(metcons[0]).toMatchObject({ capSecs: 420 });
    expect(metcons[0].members.map((m) => [m.ex, m.reps])).toEqual([
      ['band-pull-apart', '10'],
      ['ring-row', '8'],
      ['box-step-up', '12'],
    ]);
    expect(metcons[1]).toMatchObject({ rounds: 4 });
    expect(metcons[1].members.map((m) => [m.ex, m.reps])).toEqual([
      ['box-step-up', '14'],
      ['ring-row', '10'],
    ]);
    expect(metcons[1].note).toMatch(/even minutes ring rows/);
    expect(metcons[2].members.map((m) => [m.ex, m.repScheme])).toEqual([
      ['jumping-jack', [30, 20, 10]],
      ['box-step-up', [16, 12, 8]],
      ['ring-row', [12, 8, 4]],
    ]);
    // no push-up anywhere in the metcon pool, and its rows log no kilos
    for (const t of metcons) {
      for (const m of t.members || [{ ex: t.ex }]) {
        expect(m.ex, t.name).not.toBe('push-up');
        if (m.ex === 'ring-row') expect(m.logWeight, t.name).toBe(false);
      }
    }
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
    // Wednesday's warm-up ends on a light rehearsal of the power clean
    // (2026-10-20: its jumps left, so its pogo hops did too); Friday's still
    // ends on the springs (it kept its jumps, 2026-11-03)
    const WARM_LAST = {
      // Wednesday: the empty-bar front squat, then the hang power clean
      'd40-b1': ['front-squat', 'db-hang-clean'],
      // Friday: the springs, then two easy broad jumps (the max ones next)
      'd40-c1': ['pogo-hop', 'broad-jump'],
    };
    const REHEARSAL = { 'd40-b1': 'db-hang-clean' };
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
        // every warm-up move is timed OR counted (2026-11-03: a count is
        // the number, then Done — never "five reps" on a clock), unlogged and
        // never a set; a note that names a count is a counted move
        for (const m of w.members) {
          if (m.secs) {
            expect(m.reps, `${s.id} ${m.ex}`).toBeUndefined();
          } else {
            expect(m.reps, `${s.id} ${m.ex}`).toMatch(/^\d+(\/side)?$/);
            expect(m.estSecs, `${s.id} ${m.ex}`).toBeGreaterThan(0);
          }
          expect(m.logWeight, `${s.id} ${m.ex}`).toBe(false);
          expect(m.countsAsSet, `${s.id} ${m.ex}`).toBe(false);
          if (/\b(five|eight|ten|two) (easy|slow)\b/i.test(m.note || '')) {
            expect(m.reps, `${s.id} ${m.ex} counted`).toBeDefined();
          }
          // "a side" on one clock never said when to switch: a per-side hold
          // is two timers, LEFT then RIGHT
          if (m.secs && /a side/i.test(m.note || '')) {
            throw new Error(`${s.id} ${m.ex}: a per-side note on one timer`);
          }
        }
        // the clean rehearsal, the pogo and the easy broad jumps are
        // ballistic (amber / short / tired / unchecked drop them); the clean
        // is light — five easy reps; the springs are Friday's alone. The
        // empty bar swaps to a box squat on an amber morning
        for (const ex of ['pogo-hop', 'broad-jump']) {
          const j = w.members.find((m) => m.ex === ex);
          expect(!!j, `${s.id} wk${i + 1} ${ex}`).toBe(s.id === 'd40-c1');
          if (j) expect(j.ballistic).toBe(true);
        }
        if (REHEARSAL[s.id]) {
          const r = w.members.find((m) => m.ex === REHEARSAL[s.id]);
          expect(r, `${s.id} wk${i + 1}`).toMatchObject({ ballistic: true, reps: '5' });
          expect(r.note, `${s.id} wk${i + 1}`).toMatch(/easy reps/);
        }
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
    // Monday has no power rehearsal — nothing ballistic at all
    for (const w of getProgramSession('d40-a1').blocks[0].rotate) {
      expect(w.members.some((m) => m.ballistic), 'Monday warm-up').toBe(false);
    }
    // the player: a counted move is YOUR PACE with its number and a Done, no
    // clock, its estimate the old timer's; the side plank is a timer a side
    // with a switch between (Wednesday, week 4)
    const wed4 = buildStepQueue(getProgramSession('d40-b1'), {}, 3).filter(
      (st) => st.blockLabel === 'Warm-Up',
    );
    const bar = wed4.find((st) => st.exId === 'front-squat' && st.kind === 'work');
    expect(bar).toMatchObject({ manual: true, secs: null, phase: 'YOUR PACE', reps: '5', estSecs: 40, logWeight: false, countsAsSet: false, warmup: true });
    const plank = wed4.filter((st) => st.exId === 'side-plank');
    expect(plank.map((st) => [st.kind, st.phase, st.side ?? null, st.secs])).toEqual([
      ['work', 'HOLD', 'LEFT', 15],
      ['rest', 'SWITCH SIDES', null, 5],
      ['work', 'HOLD', 'RIGHT', 15],
      // …then the usual short rest before the empty-bar squat
      ['rest', 'REST', null, 5],
    ]);
    expect(plank[1].meta).toBe('RIGHT NEXT');
  });

  // No two days share a shape: Monday closes on Wings (moved after the hinge
  // in round 2 — the RDL goes first, fresh), Wednesday on a metcon (week 1:
  // the seven-minute AMRAP), Friday on the dips, pull-ups and calves (the
  // legs moved up behind the press, 2026-11-10 — big compounds first).
  it('each day closes on a different kind of block', () => {
    const lasts = DENSITY40_SESSIONS.map((s) => sessionBlocks(s, 0).at(-1));
    expect(lasts.map((b) => b.name)).toEqual([
      'Wings',
      'Seven',
      'Dips, Pull-Ups & Calves',
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
    expect(legs.detail).toBe('SETS · 3 rounds'); // the three-set cap (2026-11-10)
    // no sliders (his kit): Legs & Back is the rear-foot split squat and the
    // lat pulldown, 20 s apart; the hamstring curl moved to the cable
    expect(legs.members.map((m) => m.name)).toEqual([
      'Rear-Foot-Elevated Split Squat',
      'Lat Pulldown',
    ]);
    expect(c1.blocks.flatMap((b) => b.rotate || [b]).find((b) => b?.name === 'Legs & Back').betweenSecs).toBe(20);
    // Friday's four blocks, in order, after the warm-up (round 2: the Jumps
    // EMOM before the press; 2026-11-10, his call: the legs straight after
    // the press while there's energy, then the dips, pull-ups and calves)
    expect(rows.map((r) => r.title)).toEqual([
      'Warm-Up',
      'Jumps',
      'The Anchor',
      'Legs & Back',
      'Dips, Pull-Ups & Calves',
    ]);
    const jumps = rows.find((r) => r.title === 'Jumps');
    expect(jumps.members).toEqual([
      { name: 'Broad Jump', detail: '3' },
      { name: 'Skater Bound', detail: '3/side' },
    ]);
    const dips = rows.find((r) => r.title === 'Dips, Pull-Ups & Calves');
    expect(dips.members.map((m) => m.name)).toEqual(['Ring Dip', 'Strict Pull-Up', 'DB Calf Raise']);
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
// superset curls 10/leg. Friday's pinned 6/leg gave its seat to the calves on
// 2026-11-10 (Thursday's calf day became a rest day). The ladder mechanism
// (ladderCap / ladderNext) stays for the pull-up anchor (cap 10); no
// leg-curl member carries one any more.
describe('the cable leg curl', () => {
  it('is served Wednesday only, 10/leg; the slider is gone', () => {
    const curls = DENSITY40_SESSIONS.flatMap((s) =>
      s.blocks
        .flatMap((b) => b.rotate || [b])
        .filter((b) => b?.members)
        .flatMap((b) => b.members.filter((m) => m.ex === 'cable-leg-curl').map((m) => [s.id, b, m])),
    );
    expect(curls.map(([id, b, m]) => [id, b.name, m.reps, !!m.fixedReps])).toEqual([
      ['d40-b1', 'Split Squat & Curl', '10/leg', false], // 45-min round: 10/leg
    ]);
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
    expect(pull).toHaveLength(4); // four working rounds, no build (2026-11-10; was five)
    expect(pull.some((s) => s.phase === 'RAMP')).toBe(false);
    expect(pull.every((s) => s.exId === 'pull-up-bw')).toBe(true);
    // progression on a bodyweight anchor is REPS, never a weight PR
    expect(pull[0].logReps).toBe(true);

    // Wednesday's front squat and Friday's incline press: one build round
    // (~50% then ~70–75%) on a 2:30 clock (round 2 — a ~20 s set still
    // leaves 2:10, over the 2:00 floor) — three working sets each since the
    // three-set cap (2026-11-10; the squat was four)
    for (const [id, working] of [
      ['d40-b1', 3],
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
      'SET 1 OF 3',
      'SET 2 OF 3',
      'SET 3 OF 3',
    ]);
    expect(anchorOf('d40-a1').filter((s) => !s.pair).map((s) => s.meta)).toEqual(
      [1, 2, 3, 4].map((n) => `SET ${n} OF 4`),
    );
  });

  // THE ANCHOR'S PAIR (round 3): a spine-quiet lateral raise rides each
  // WORKING interval of Monday's and Friday's anchor — set, pair, rest — on
  // the same clock. The anchor step shrinks to `pair.at`, the pair takes the
  // rest of the interval; never on a build round, never an anchor itself.
  it('the anchor pair rides each working interval on the same clock', () => {
    for (const [id, interval, at, working, build] of [
      ['d40-a1', 120, 40, 4, 0],
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
    expect(swapped.filter((s) => s.pair)).toHaveLength(4);
  });

  // Power before the heavy lift (2026-10-10, both reviews): Wednesday's
  // Power EMOM before the squat, Friday's Jumps EMOM before the press, fresh,
  // on a forced-rest clock. Monday has none. The old Prime blocks are gone.
  // 2026-10-20 (his call): Wednesday's power is the DB hang power clean +
  // push press (the clean & press capped the clean at what he can press).
  // 2026-11-03 (his call, "actually pretty fun"): Friday keeps its broad
  // jumps and skater bounds.
  it('power comes before the anchor on Wed and Fri: DB lifts Wednesday, jumps Friday', () => {
    const WORK = {
      'd40-b1': { piece: 'Power', ex: ['db-hang-clean', 'db-push-press'], secs: 60 },
      'd40-c1': { piece: 'Jumps', ex: ['broad-jump', 'skater-bound'], secs: 45 },
    };
    for (const [id, want] of Object.entries(WORK)) {
      for (let v = 0; v < 4; v++) {
        const q = buildStepQueue(getProgramSession(id), {}, v);
        // the working power minutes (the warm-up's rehearsal and pogo aside)
        const power = q.filter((s) => want.ex.includes(s.exId) && s.kind === 'work' && !s.warmup);
        expect(power.length, `${id} v${v}`).toBeGreaterThan(0);
        const anchorAt = q.findIndex((s) => s.piece === 'The Anchor');
        for (const p of power) {
          expect(q.indexOf(p), `${id} v${v}`).toBeLessThan(anchorAt);
          // forced rest: each set owns its interval, never an open pace
          expect(p, `${id} v${v} ${p.exId}`).toMatchObject({ piece: want.piece, emom: true, secs: want.secs });
          expect(p.amrap, `${id} v${v}`).toBeFalsy();
        }
      }
    }
    // Wednesday: the Power EMOM, flagged ballistic at the source — the hang
    // power clean then the push press, triples pinned, heavier doubles in
    // phase 3
    const wed = getProgramSession('d40-b1');
    const power = wed.blocks.find((b) => b.name === 'Power');
    expect(power).toMatchObject({ mode: 'emom', ballistic: true, rounds: 3 });
    expect(power.members.map((m) => [m.ex, m.reps, m.phaseReps])).toEqual([
      ['db-hang-clean', '3', { 3: '2' }],
      ['db-push-press', '3', { 3: '2' }],
    ]);
    for (const m of power.members) expect(m.fixedReps, m.ex).toBe(true);
    expect(power.members[0].note).toMatch(/From the hang, above the knee/);
    expect(power.members[0].note).toMatch(/Heavier than your press/);
    expect(wed.blocks.indexOf(power)).toBeLessThan(wed.blocks.findIndex((b) => b.rotate?.[0]?.anchor));
    expect(wed.blocks.some((b) => b.name === 'Jumps')).toBe(false);
    // Wednesday's warm-ups (all four) end on a light hang power clean,
    // flagged ballistic so an amber or tired morning drops it
    for (const wedWarm of wed.blocks[0].rotate) {
      expect(wedWarm.warmup).toBe(true);
      expect(wedWarm.members.at(-1)).toMatchObject({
        ex: 'db-hang-clean',
        ballistic: true,
        countsAsSet: false,
        logWeight: false,
      });
    }
    // Friday: the Jumps EMOM — unloaded, pinned, and flagged ballistic +
    // prime (a short day spends these minutes first). Round 3: three rounds
    // on a 45 s clock — +50% contacts in the same minutes
    const friS = getProgramSession('d40-c1');
    expect(friS.blocks.some((b) => b.name === 'Power')).toBe(false);
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
    // Friday's warm-ups all end on the springs and two easy broad jumps —
    // the max ones come next
    for (const w of friS.blocks[0].rotate) {
      expect(w.members.slice(-2)).toMatchObject([
        { ex: 'pogo-hop', ballistic: true, secs: 20 },
        { ex: 'broad-jump', ballistic: true, reps: '2' },
      ]);
    }
    const friJumps = buildStepQueue(friS).filter((s) => s.piece === 'Jumps');
    expect(friJumps).toHaveLength(6); // 2 stations × 3 rounds
    expect(friJumps.every((s) => s.logWeight === false)).toBe(true);
    // Monday has no power work; no lift day serves the snatch or the clean
    // & press
    for (let v = 0; v < 4; v++) {
      const mon = buildStepQueue(getProgramSession('d40-a1'), {}, v);
      expect(mon.some((s) => s.ballistic), `mon v${v}`).toBe(false);
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
    // the hang power clean is open-pace banned and never goes heavy, like
    // the snatch: a forced-rest clock and pinned reps only
    expect(OPEN_PACE_BANNED).toContain('db-hang-clean');
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
  // Wednesday's Power piece: the hang power clean and the push press stay
  // on forced rest (the broad jump left it on 2026-10-20).
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
      expect(s.reps).toBe('3'); // fixed dose — never descended or maxed
    }
    // the hang power clean is a loaded DB lift (it replaced the bodyweight
    // broad jump, 2026-10-20): it logs its kilos too, at a fixed 3
    const cleans = power.filter((s) => s.exId === 'db-hang-clean');
    expect(cleans).toHaveLength(3);
    for (const s of cleans) {
      expect(s.logWeight).toBe(true);
      expect(s.countsAsSet).toBe(true);
      expect(s.reps).toBe('3');
    }
    expect(power.some((s) => s.exId === 'broad-jump')).toBe(false);
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
    expect(lift).toHaveLength(4); // four working sets (2026-11-10; was five)
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
    // superset members carry equipment fallbacks — same muscle job, so a
    // swap changes the implement, never the dose (Friday: RFE → DB split squat)
    const legs = buildStepQueue(getProgramSession('d40-c1'), {
      'rfe-split-squat': 'db-split-squat',
    });
    const split = legs.filter((s) => s.exId === 'db-split-squat' && s.countsAsSet);
    expect(split).toHaveLength(3); // Legs & Back is three rounds
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
    expect(row.map((s) => s.reps)).toEqual(['7', '7', '7']);
    // a loaded alt takes the heavy week by its OWN prescription
    const shaped = applyFormats(getProgramSession('d40-c1'), 2);
    const q = buildStepQueue(shaped, { 'rfe-split-squat': 'db-split-squat' }, 1);
    const split = q.filter((s) => s.exId === 'db-split-squat' && s.countsAsSet);
    expect(split).toHaveLength(3);
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
    expect(rows).toHaveLength(3); // Wings is three rounds
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
    // change the slot's clock (four working rounds since 2026-11-10) — and
    // the block-level pair survives the swap
    expect(anchorRow.detail).toBe('E2M 8 · 4 rounds');
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

  it('carries the openers, the core holds and the folds — nothing metcon-shaped', () => {
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
        'hollow-hold',
        'side-plank',
        'bird-dog',
      ]);
      expect(ids.slice(-2)).toEqual(['elephant-walk', 'seated-good-morning']);
      // the Pallof press follows the core holds (one set of each, Thursday's
      // version — Sunday is the rest day, a day after Saturday)
      expect(ids[6]).toBe('pallof-press');
      // no McGill 10 s rep-holds on Sunday either (2026-10-20), no leg raises
      expect(ids).not.toContain('mcgill-curlup');
      expect(ids).not.toContain('lying-leg-raise');
      expect(sessionBlocks(sunday, v).some((b) => b.mode === 'reps')).toBe(false);
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

  // TWO REAL REST DAYS (2026-11-10, his call): Sunday is a walk and nothing
  // else; Thursday is a walk with the Easy Back one tap away, opt-in
  it('Thursday and Sunday are a walk — Thursday\'s Easy Back optional', () => {
    expect(WEEK_PLAN[0]).toEqual([{ type: 'walk' }]);
    expect(WEEK_PLAN[4]).toEqual([{ type: 'walk' }, { type: 'rehab', session: 'sunday' }]);
    expect(OPTIONAL_SESSIONS.has('sunday')).toBe(true);
    expect(getRehabSession('sunday').name).toBe('Easy Back');
    expect(REST_WEEKDAYS).toEqual([0, 4]);
    // the training days: lifts Mon/Wed/Fri, Back & Hips Tue/Sat
    expect(WEEK_PLAN.map((d) => d.map((i) => i.session || i.type).join('+'))).toEqual([
      'walk',
      'd40-a1',
      'rehab',
      'd40-b1',
      'walk+sunday',
      'd40-c1',
      'rehab',
    ]);
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

  // 2026-10-20 (his ask): the elephant walk is the number, no count — 24 in
  // total at his own pace, then Done. No tempo ticking, no weight dial; it
  // brings its own time estimate (no rep tempo to size it from).
  it('the elephant walk is 24 at your own pace, no count, no dial', () => {
    for (const id of ['daily', 'sunday']) {
      const s = getRehabSession(id);
      const ew = s.blocks.find((b) => b.ex === 'elephant-walk');
      expect(ew, id).toMatchObject({
        mode: 'lift',
        sets: 1,
        reps: '24',
        logWeight: false,
        restSecs: 0,
        fold: true,
        estSecs: 100,
      });
      expect(ew.note, id).toMatch(/^Twenty-four: .*Your pace\.$/);
      expect(ew.tempo, id).toBeUndefined();
      for (const v of [0, 1, 2]) {
        const steps = buildStepQueue(s, {}, v).filter(
          (st) => st.exId === 'elephant-walk' && st.kind === 'work',
        );
        expect(steps, `${id} v${v}`).toHaveLength(1);
        expect(steps[0], `${id} v${v}`).toMatchObject({
          manual: true,
          logWeight: false,
          phase: 'YOUR PACE',
          reps: '24',
          meta: 'SET 1 OF 1 · 24 REPS',
          cueNote: ew.note,
          estSecs: 100,
          countsAsSet: true,
        });
        expect(steps[0].secs, `${id} v${v}`).toBeNull();
        expect(steps[0].tempo, `${id} v${v}`).toBeUndefined();
      }
    }
    // the estimate is what the session clock counts: 100 s, not the 35 s
    // default a self-paced set with no rep tempo gets
    const est = (extra) =>
      estimateSessionSecs({
        id: 'x',
        blocks: [{ ex: 'elephant-walk', mode: 'lift', sets: 1, reps: '24', logWeight: false, ...extra }],
      });
    expect(est({ estSecs: 100 }) - est({})).toBe(100 - 35);
    expect(REHAB_EXERCISES['elephant-walk'].how).toMatch(/Your pace, no count to follow/);
  });

  // the step engine's self-paced `lift` sets (2026-10-20): `logWeight: false`
  // on the block reaches every step, and the block's note rides each set as
  // its cue — the last set's own note wins on the last set
  it('a lift block honours logWeight: false and carries its note on every set', () => {
    const lift = (extra) => ({
      id: 'x',
      blocks: [{ ex: 'lying-leg-raise', mode: 'lift', sets: 3, reps: '10', restSecs: 30, ...extra }],
    });
    const work = (s) => buildStepQueue(s).filter((st) => st.kind === 'work');
    // a lift logs weight unless the block says otherwise
    expect(work(lift({})).map((st) => st.logWeight)).toEqual([true, true, true]);
    expect(work(lift({})).map((st) => st.cueNote)).toEqual([undefined, undefined, undefined]);
    expect(work(lift({ logWeight: false })).map((st) => st.logWeight)).toEqual([false, false, false]);
    expect(work(lift({ note: 'n' })).map((st) => st.cueNote)).toEqual(['n', 'n', 'n']);
    expect(work(lift({ note: 'n' })).every((st) => st.blockNote === 'n')).toBe(true);
    expect(work(lift({ note: 'n', lastSetNote: 'last' })).map((st) => st.cueNote)).toEqual([
      'n',
      'n',
      'last',
    ]);
    expect(work(lift({ lastSetNote: 'last' })).map((st) => st.cueNote)).toEqual([
      undefined,
      undefined,
      'last',
    ]);
  });

  it('the McGill core carries progression ladders like everything else', () => {
    for (const ex of [
      'mcgill-curlup',
      'side-plank',
      'bird-dog',
      'plank',
      'hollow-hold',
      'lying-leg-raise',
    ]) {
      expect(REHAB_EXERCISES[ex].scale, ex).toBeTruthy();
    }
  });

  // 2026-10-20: the side plank and bird dog are straight holds on Back &
  // Hips now, so they say so — and the two new core moves come with the
  // full coaching card, each how line one glanceable line
  it('the core holds and the leg raise state their work model', () => {
    for (const ex of ['hollow-hold', 'side-plank', 'bird-dog', 'lying-leg-raise']) {
      const def = REHAB_EXERCISES[ex];
      expect(def.name && def.cue && def.why && def.feel && def.avoid && def.yt, ex).toBeTruthy();
      expect(def.how, ex).toBeTruthy();
      expect(def.how.length, ex).toBeLessThanOrEqual(120);
    }
    for (const ex of ['hollow-hold', 'side-plank', 'bird-dog']) {
      expect(REHAB_EXERCISES[ex].how, ex).toMatch(/hold/i);
    }
    // the hollow hold's escape hatch: the low back lifts → bend the knees
    expect(REHAB_EXERCISES['hollow-hold'].how).toMatch(/low back lifts, bend the knees/);
    expect(REHAB_EXERCISES['lying-leg-raise'].how).toMatch(/low back would lift/);
    expect(REHAB_EXERCISES['hollow-hold'].name).toBe('Hollow Hold');
    expect(REHAB_EXERCISES['lying-leg-raise'].name).toBe('Lying Leg Raise');
  });

  // the hip IR as HOLDS (2026-10-21, his ask: "so it's a better hit"): 45 s
  // with the ankle up, then 45 s with the knee up too, straight through on
  // the left, one switch, then the right. Same every phase and every day it
  // is served, Sunday too.
  it('the hip internal rotation is ankle up 45 s then knee up 45 s, a side at a time', () => {
    const hir = REHAB_EXERCISES['hip-internal-rotation'];
    expect(hir.cue).toMatch(/lift the ankle off the floor\. Hold\. Then lift the knee too/);
    expect(hir.how).toMatch(/Ankle up for the clock, then the knee up too, no rest between/);
    expect(hir.scale).toMatch(/^Easier: lower the knee and keep the ankle up/);
    const daily = getRehabSession('daily');
    for (const ph of [1, 2, 3]) {
      for (const id of ['daily', 'sunday']) {
        const s = applyPhase(getRehabSession(id), ph);
        for (const v of id === 'daily' ? [0, 1, 2] : [0, 1]) {
          const q = buildStepQueue(s, {}, v);
          const at = `p${ph} ${id} v${v}`;
          const work = q.filter((st) => st.exId === 'hip-internal-rotation' && st.kind === 'work');
          expect(
            work.map((st) => [st.side, st.secs, st.setNum, st.cueNote.split(':')[0]]),
            at,
          ).toEqual([
            ['LEFT', 45, 1, 'Ankle up'],
            ['LEFT', 45, 2, 'Knee up too'],
            ['RIGHT', 45, 1, 'Ankle up'],
            ['RIGHT', 45, 2, 'Knee up too'],
          ]);
          // no tempo, and the only break is the one switch of sides
          expect(work.every((st) => !st.tempo), at).toBe(true);
          const first = q.indexOf(work[0]);
          const last = q.indexOf(work.at(-1));
          const between = q.slice(first, last + 1).filter((st) => st.kind === 'rest');
          expect(between.map((st) => [st.phase, st.secs]), at).toEqual([['SWITCH SIDES', 15]]);
        }
      }
    }
    // the phase step is absolute, and leaves no spec behind
    const p3 = applyPhase(daily, 3);
    expect(applyPhase(p3, 3).blocks).toEqual(p3.blocks);
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

  it('sits right after the core holds, Saturdays only, and runs on the clock', () => {
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

  // MORE CORE, HELD STRAIGHT (2026-10-20, his ask: "longer holds instead of
  // chopped", the hollow hold in for the curl-up, "harder"). Three tiers:
  // Tuesday the full version (3 hollow holds, 2 side planks and 2 bird dogs
  // a side; 30 s from week 1 since 2026-10-21, his ask, so only the side
  // plank's clock still grows); the Easy Back (Thursday's optional since
  // 2026-11-10, was Sunday's) one set of each; Saturday a short primer
  // before the sprints. Back & Hips serves nothing on Thursday any more. They get harder by POSITION
  // (the note names the variation) more than by the clock, which caps at 30 s
  // (hollow, bird dog) and 45 s (side plank).
  it('serves the full core holds Tue, one set in the Easy Back, a primer Sat — harder by position', () => {
    const CORE = ['hollow-hold', 'side-plank', 'bird-dog'];
    const core = (s, v) =>
      sessionBlocks(s, v)
        .filter((b) => CORE.includes(b.ex))
        .map((b) => [b.ex, b.sets, b.holdSecs]);
    // [exercise, sets, seconds per hold (a side)]
    const FULL = {
      1: [['hollow-hold', 3, 30], ['side-plank', 2, 30], ['bird-dog', 2, 30]],
      2: [['hollow-hold', 3, 30], ['side-plank', 2, 40], ['bird-dog', 2, 30]],
      3: [['hollow-hold', 3, 30], ['side-plank', 2, 45], ['bird-dog', 2, 30]],
    };
    const LONG = [['hollow-hold', 1, 30], ['side-plank', 1, 45], ['bird-dog', 1, 30]];
    const PRIMER = [['hollow-hold', 1, 15], ['side-plank', 1, 20], ['bird-dog', 1, 15]];
    // the position each phase asks for, read off the hold's note
    const NOTES = {
      'hollow-hold': {
        1: 'Knees bent, arms by your sides.',
        2: 'Legs straighter now: as straight as the low back stays flat.',
        3: 'Legs straight, arms overhead.',
      },
      'side-plank': { 1: 'Feet staggered, hips tall.', 2: 'Feet stacked.', 3: 'Feet stacked, top leg raised.' },
      'bird-dog': {
        1: 'Reach long and hold still.',
        2: /three small squares/,
        3: /Slower squares/,
      },
    };
    const sunday = getRehabSession('sunday');
    for (const ph of [1, 2, 3]) {
      const s = applyPhase(daily, ph);
      const sun = applyPhase(sunday, ph);
      for (let w = 0; w < 12; w++) {
        expect(core(s, w * 4), `p${ph} tue`).toEqual(FULL[ph]);
        expect(core(s, w * 4 + 1), `p${ph} thu`).toEqual([]);
        expect(core(s, w * 4 + 2), `p${ph} sat`).toEqual(PRIMER);
      }
      for (const v of [0, 1]) expect(core(sun, v), `p${ph} sun`).toEqual(LONG);
      // Tuesday and the Easy Back name the phase's position; Saturday's
      // primer keeps its own note — switch the trunk on, don't tire it
      for (const [at, x, v] of [['tue', s, 0], ['sun', sun, 0]]) {
        for (const b of sessionBlocks(x, v).filter((y) => CORE.includes(y.ex))) {
          const want = NOTES[b.ex][ph];
          if (want instanceof RegExp) expect(b.note, `p${ph} ${at} ${b.ex}`).toMatch(want);
          else expect(b.note, `p${ph} ${at} ${b.ex}`).toBe(want);
        }
      }
      for (const b of sessionBlocks(s, 2).filter((y) => CORE.includes(y.ex))) {
        expect(b.note, `p${ph} sat ${b.ex}`).toMatch(/^A primer: switch the trunk on, don’t tire it/);
      }
      // idempotent: the target is absolute
      expect(applyPhase(s, ph).blocks, `p${ph}`).toEqual(s.blocks);
      // the clock never runs past its cap, on any day, in any phase
      const CAP = { 'hollow-hold': 30, 'bird-dog': 30, 'side-plank': 45 };
      for (let v = 0; v < 48; v++) {
        for (const [ex, , secs] of core(s, v)) expect(secs, `p${ph} v${v} ${ex}`).toBeLessThanOrEqual(CAP[ex]);
      }
    }
    // straight holds, not McGill's rep-holds: one timed HOLD per set (a
    // side), no re-brace steps; the two per-side holds switch sides
    for (const v of [0, 1, 2]) {
      for (const b of sessionBlocks(daily, v).filter((x) => CORE.includes(x.ex))) {
        expect(b, `v${v} ${b.ex}`).toMatchObject({ mode: 'hold', phase: 'HOLD' });
        expect(b.repScheme, `v${v} ${b.ex}`).toBeUndefined();
        expect(b.resetSecs, `v${v} ${b.ex}`).toBeUndefined();
        expect(Boolean(b.perSide), `v${v} ${b.ex}`).toBe(b.ex !== 'hollow-hold');
      }
    }
    // Tuesday's queue: 3 × 30 s hollow, 2 × (L + R) 30 s side plank, 2 ×
    // (L + R) 30 s bird dog — every hold one counted set
    const tue = buildStepQueue(daily, {}, 0);
    const holds = (ex) => tue.filter((st) => st.exId === ex && st.kind === 'work');
    expect(holds('hollow-hold').map((st) => [st.secs, st.side])).toEqual([
      [30, null],
      [30, null],
      [30, null],
    ]);
    expect(holds('side-plank').map((st) => [st.secs, st.side])).toEqual([
      [30, 'LEFT'],
      [30, 'RIGHT'],
      [30, 'LEFT'],
      [30, 'RIGHT'],
    ]);
    expect(holds('bird-dog').map((st) => [st.secs, st.side])).toEqual([
      [30, 'LEFT'],
      [30, 'RIGHT'],
      [30, 'LEFT'],
      [30, 'RIGHT'],
    ]);
    for (const ex of CORE) {
      expect(holds(ex).every((st) => st.phase === 'HOLD' && st.countsAsSet), ex).toBe(true);
      expect(tue.some((st) => st.exId === ex && st.phase === 'BREATHE'), ex).toBe(false);
    }
    // the side plank switches in 8 s, the bird dog in 5
    const sw = (ex) => tue.filter((st) => st.exId === ex && st.phase === 'SWITCH SIDES');
    expect(sw('side-plank').map((st) => st.secs)).toEqual([8, 8]);
    expect(sw('bird-dog').map((st) => st.secs)).toEqual([5, 5]);
    // a stiff morning eases every hold to its McGill 10-second version
    // (`amberBlock`): the curl-up for the hollow hold — two sets on Tuesday,
    // one elsewhere — and three re-braced holds a side for the other two.
    // Only the hollow hold (the one with the low back flattened) is a
    // `morning` move too.
    const AMBER = {
      0: { 'hollow-hold': ['mcgill-curlup', [4, 3]], 'side-plank': ['side-plank', [3]], 'bird-dog': ['bird-dog', [3]] },
      1: { 'hollow-hold': ['mcgill-curlup', [4]], 'side-plank': ['side-plank', [3]], 'bird-dog': ['bird-dog', [3]] },
    };
    for (const [id, v, key] of [['daily', 0, 0], ['daily', 1, 1], ['daily', 2, 1], ['sunday', 0, 1]]) {
      for (const b of sessionBlocks(getRehabSession(id), v).filter((x) => CORE.includes(x.ex))) {
        const [ex, scheme] = AMBER[key][b.ex];
        expect(b.amberBlock, `${id} v${v} ${b.ex}`).toMatchObject({
          ex,
          mode: 'reps',
          repScheme: scheme,
          holdSecs: 10,
          resetSecs: 3,
        });
        expect(Boolean(b.amberBlock.perSide), `${id} v${v} ${b.ex}`).toBe(b.ex !== 'hollow-hold');
        expect(Boolean(b.morning), `${id} v${v} ${b.ex}`).toBe(b.ex === 'hollow-hold');
      }
    }
  });

  // LEG RAISES (2026-10-20, his ask; the cable crunch left out for the
  // disc): Tuesday and Saturday, 3 × 10, 12 from phase 2 and never past it —
  // harder by straightening the legs, three seconds down. Self-paced, no
  // kilos to log: the number, the rep counter and a Done
  it('serves the leg raises Tue and Sat, 3 × 10 → 12, legs straighter by phase, unweighted', () => {
    const lr = (s, v) => sessionBlocks(s, v).find((b) => b.ex === 'lying-leg-raise');
    const NOTE = {
      1: 'Knees bent, three seconds down.',
      2: 'Legs straighter now, three seconds down.',
      3: 'Legs straight, three seconds down, stopping before the tailbone lifts.',
    };
    for (const [ph, reps] of [[1, '10'], [2, '12'], [3, '12']]) {
      const s = applyPhase(daily, ph);
      for (let w = 0; w < 12; w++) {
        for (const k of [0, 2]) {
          expect(lr(s, w * 4 + k), `p${ph} w${w} k${k}`).toMatchObject({
            mode: 'lift',
            sets: 3,
            reps,
            note: NOTE[ph],
            logWeight: false,
            restSecs: 30,
          });
        }
        expect(lr(s, w * 4 + 1), `p${ph} w${w} thu`).toBeUndefined();
      }
    }
    expect(lr(getRehabSession('sunday'), 0)).toBeUndefined();
    // the exercise carries the rep counter: one up, three down
    expect(REHAB_EXERCISES['lying-leg-raise'].repTempo).toEqual([
      ['UP', 1],
      ['DOWN', 3],
    ]);
    for (const v of [0, 2]) {
      const q = buildStepQueue(daily, {}, v).filter(
        (st) => st.exId === 'lying-leg-raise' && st.kind === 'work',
      );
      expect(q, `v${v}`).toHaveLength(3);
      for (const [i, st] of q.entries()) {
        expect(st, `v${v}`).toMatchObject({
          manual: true,
          logWeight: false,
          phase: 'YOUR PACE',
          reps: '10',
          repTarget: 10,
          countsAsSet: true,
          cueNote: NOTE[1],
          meta: `SET ${i + 1} OF 3 · 10 REPS`,
        });
        expect(st.secs).toBeNull();
      }
      // 30 s between sets, no rest after the last
      const rests = buildStepQueue(daily, {}, v).filter(
        (st) => st.exId === 'lying-leg-raise' && st.kind === 'rest',
      );
      expect(rests.map((st) => st.secs), `v${v}`).toEqual([30, 30]);
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
