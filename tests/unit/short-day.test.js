import { describe, expect, it } from 'vitest';
import {
  applyAmber,
  applyFormats,
  applyUnchecked,
  doseParts,
  hasDose,
  applyNoFolds,
  applyPhase,
  applyRamp,
  hasMorningWork,
  applyShort,
  applyTired,
  SHORT,
} from '../../src/workout/block.js';
import {
  DENSITY40_SESSIONS,
  getProgramSession,
} from '../../src/workout/program.js';
import {
  buildStepQueue,
  estimateSessionMins,
  getRehabSession,
  REHAB_SESSIONS,
  sessionBlocks,
} from '../../src/workout/rehab.js';

// a null rotation spec = the slot sits that day out (Thursday has no back
// extension, Tue/Thu no supporting move) — skip it
const blocksOf = (s) =>
  s.blocks.flatMap((b) => b.rotate || [b]).filter(Boolean);
const holds = (s) => blocksOf(s).filter((b) => b.mode === 'hold');

describe('the short lift day', () => {
  // Warm-up, two anchor sets, one trip through every piece. The primer and
  // the scored finisher go first; the warm-up stays — a short day after a bad
  // night is exactly the day not to start cold.
  it('is the warm-up, two anchor sets and one trip through each piece', () => {
    for (const base of DENSITY40_SESSIONS) {
      const s = applyShort(base);
      const anchor = blocksOf(s).find((b) => b.anchor);
      expect(anchor.rounds).toBe((anchor.warmupRounds || 0) + SHORT.anchorSets);
      const pieces = blocksOf(s).filter((b) => b?.isPiece);
      expect(pieces.length).toBeGreaterThan(0);
      for (const p of pieces) {
        expect(p.rounds).toBe(1);
        expect(p.formats).toBeUndefined();
      }
      expect(blocksOf(s).some((b) => b?.warmup)).toBe(true);
      expect(s.blocks.some((b) => b.prime || b.finisher)).toBe(false);
    }
  });

  // a bad night (or a deload) is no day for a heavy week, a max set or
  // anything ballistic — on any week of the block (round 3: ballistic
  // MEMBERS go too, so the warm-up's power rehearsal never survives — the
  // light hang power clean / hang snatch since 2026-10-20)
  it('serves nothing ballistic, heavy or maxed, in any week', () => {
    for (const base of DENSITY40_SESSIONS) {
      for (let w = 1; w <= 12; w++) {
        const short = applyShort(applyFormats(base, w));
        for (const b of blocksOf(short)) {
          expect(b.ballistic, `${base.id} wk${w} ${b.name}`).toBeFalsy();
          for (const m of b.members || []) {
            const at = `${base.id} wk${w} ${b.name} ${m.ex}`;
            expect(m.ballistic, at).toBeFalsy();
            expect(m.heavy, at).toBeUndefined();
            expect(m.lastRoundNote, at).toBeUndefined();
            expect(m.note || '', at).not.toMatch(/Heavy week/);
          }
        }
        for (let v = 0; v < 4; v++) {
          const q = buildStepQueue(short, {}, v);
          for (const ex of [
            'db-hang-clean',
            'db-hang-snatch',
            'db-push-press',
            'pogo-hop',
            'broad-jump',
            'skater-bound',
          ]) {
            expect(q.some((st) => st.exId === ex), `${base.id} wk${w} v${v} ${ex}`).toBe(false);
          }
          expect(
            q.some((st) => /HEAVY|MAX SET/.test(st.meta || '') || st.maxSet),
            `${base.id} wk${w} v${v}`,
          ).toBe(false);
        }
      }
    }
    // concrete: Monday week 4 runs Hinge & Calf HEAVY (7/leg) — short undoes it
    const hc = blocksOf(applyShort(applyFormats(getProgramSession('d40-a1'), 4))).find(
      (b) => b.name === 'Hinge & Calf',
    );
    expect(hc.members.find((m) => m.ex === 'db-calf-raise').reps).toBe('10/leg');
  });

  it('lands every lift day between 10 and 20 minutes', () => {
    for (const base of DENSITY40_SESSIONS) {
      for (let v = 0; v < 4; v++) {
        const mins = estimateSessionMins(applyShort(base), v);
        expect(mins).toBeGreaterThanOrEqual(10);
        expect(mins).toBeLessThanOrEqual(20);
      }
    }
  });
});

describe('the short rehab day', () => {
  const daily = getRehabSession('daily');

  // 2026-10-20: the brace is the core holds (hollow hold, side plank, bird
  // dog as straight holds) — and like the McGill primer before them they are
  // never scaled: a short day keeps every set and every second of them
  it('halves the long holds and never the core holds', () => {
    const CORE = ['hollow-hold', 'side-plank', 'bird-dog'];
    for (const ph of [1, 2, 3]) {
      const full = applyPhase(daily, ph);
      const short = applyShort(full);
      const halved = new Set();
      const kept = new Set();
      for (let v = 0; v < 48; v++) {
        // never served: k=3 (no fourth Back & Hips day) and, since
        // 2026-11-10, k=1 — Thursday is a rest day
        if (v % 4 === 3 || v % 4 === 1) continue;
        const shortHolds = sessionBlocks(short, v).filter((b) => b.mode === 'hold');
        for (const b of sessionBlocks(full, v).filter((x) => x.mode === 'hold')) {
          const match = shortHolds.find((x) => x.ex === b.ex);
          if (!match) continue; // the supporting cast and the carries are dropped
          const at = `p${ph} v${v} ${b.ex}`;
          if (CORE.includes(b.ex)) {
            // every set, every second — even Tuesday's 45 s side plank
            expect([match.sets, match.holdSecs], at).toEqual([b.sets, b.holdSecs]);
            kept.add(b.ex);
          } else if (b.holdSecs >= SHORT.holdFloorSecs) {
            expect(match.holdSecs, at).toBe(Math.max(60, Math.round(b.holdSecs / 2 / 10) * 10));
            halved.add(b.ex);
          } else {
            // a short hold is the protocol — the hip IR's two 45 s holds a
            // side (2026-10-21) are served as written
            expect([match.sets, match.holdSecs], at).toEqual([b.sets, b.holdSecs]);
            expect(b.ex, at).toBe('hip-internal-rotation');
            kept.add(b.ex);
          }
        }
      }
      // the couch stretch (1:00 a side — the floor) and the seated good
      // morning (1:30 → 1:00) are the long holds
      expect([...halved].sort(), `p${ph}`).toEqual(['couch-stretch', 'seated-good-morning']);
      expect([...kept].sort(), `p${ph}`).toEqual(['bird-dog', 'hip-internal-rotation', 'hollow-hold', 'side-plank']);
    }
    // the core holds keep their places, Tue / Sat
    const short = applyShort(daily);
    for (const v of [0, 2]) {
      const core = (s) => sessionBlocks(s, v).filter((b) => CORE.includes(b.ex));
      expect(core(short).map((b) => b.ex), `v${v}`).toEqual(CORE);
      expect(core(short), `v${v}`).toEqual(core(daily));
    }
    // and no McGill rep-holds come back on a short day
    for (const v of [0, 2]) {
      expect(sessionBlocks(short, v).some((b) => b.mode === 'reps'), `v${v}`).toBe(false);
    }
  });

  // Round 3 (plan QA): a short day keeps ONE round of the `shortKeep` pump
  // — Tuesday's Arms & Delts (Thursday's Row & Raise left with Thursday on
  // 2026-11-10) — so the triangle stays alive through the newborn weeks.
  // Everything else day-specific goes.
  it('drops the supporting cast and the finishers, keeps one round of the shortKeep pump', () => {
    const short = applyShort(daily);
    expect(short.blocks.some((b) => b.cast)).toBe(false);
    const fin = short.blocks.filter((b) => b.finisher);
    expect(fin).toHaveLength(1);
    expect(fin[0].shortKeep).toBe(true);
    // Arms & Delts is four moves since the laterals moved in (2026-11-10)
    const KEEP = { 0: ['Arms & Delts', 4], 2: null };
    for (let w = 0; w < 4; w++) {
      for (const k of [0, 2]) {
        const v = w * 4 + k;
        const q = buildStepQueue(short, {}, v);
        // no scored finisher, no carry, no other pump
        expect(q.some((st) => st.piece), `v${v}`).toBe(false);
        const labels = [...new Set(q.map((st) => st.blockLabel).filter(Boolean))];
        if (KEEP[k]) {
          const [name, moves] = KEEP[k];
          expect(labels, `v${v}`).toEqual([name]);
          const sets = q.filter((st) => st.blockLabel === name && st.kind === 'work');
          // exactly one round: one set of each move
          expect(sets, `v${v}`).toHaveLength(moves);
          for (const st of sets) {
            expect(st.meta, `v${v}`).toMatch(/^1–2 LEFT · ROUND 1 OF 1/);
            expect(st.heavy, `v${v}`).toBeUndefined();
          }
        } else {
          expect(labels, `v${v}`).toEqual([]);
        }
        expect(q.some((st) => st.exId === 'farmer-carry'), `v${v}`).toBe(false);
        expect(q.some((st) => st.exId === 'hammer-curl'), `v${v}`).toBe(false);
        expect(q.some((st) => st.exId === 'db-calf-raise'), `v${v}`).toBe(false);
        // the extras sit out: the Pallof press and the leg raises are `cast`
        expect(q.some((st) => st.exId === 'pallof-press'), `v${v}`).toBe(false);
        expect(q.some((st) => st.exId === 'lying-leg-raise'), `v${v}`).toBe(false);
        const ids = new Set(q.map((st) => st.exId));
        for (const ex of ['t-spine-reach', 'hollow-hold', 'side-plank', 'bird-dog', 'elephant-walk']) {
          expect(ids.has(ex), `v${v} ${ex}`).toBe(true);
        }
        // the back extension keeps its Saturday on a short day too
        expect(ids.has('back-extension'), `v${v}`).toBe(k === 2);
      }
    }
  });

  it('is about a quarter of an hour, not a token', () => {
    // every SERVED variant: Tue/Sat on the daily (k = 1 and 3 are never
    // served since 2026-11-10 — rehabVariantIdx maps every weekday to 0 or
    // 2), both Easy Back variants. ≤22, the verifier's band: the lateral
    // raise that joined Tuesday's kept round (2026-11-10) costs a minute.
    const SERVED = { daily: [0, 2, 4, 6, 44, 46], sunday: [0, 1] };
    for (const [id, vs] of Object.entries(SERVED)) {
      for (const v of vs) {
        const mins = estimateSessionMins(applyShort(getRehabSession(id)), v);
        expect(mins).toBeGreaterThanOrEqual(10);
        expect(mins).toBeLessThanOrEqual(22);
      }
    }
  });
});

describe('applyShort is safe to re-apply', () => {
  it('is idempotent — a restore never halves a hold twice', () => {
    for (const s of [...DENSITY40_SESSIONS, ...REHAB_SESSIONS]) {
      const once = applyShort(s);
      expect(applyShort(once)).toBe(once);
      expect(applyShort(applyShort(s))).toEqual(once);
    }
  });

  it('composes with a ramp week without double-cutting', () => {
    for (const s of DENSITY40_SESSIONS) {
      const a = applyShort(applyRamp(s, 1));
      const b = applyShort(s);
      const rounds = (x) => blocksOf(x).map((v) => v.rounds);
      expect(rounds(a)).toEqual(rounds(b));
    }
  });

  it('leaves a session with nothing to cut alone', () => {
    const reset = getRehabSession('reset');
    expect(applyShort(reset).blocks).toEqual(reset.blocks);
  });
});

// ── THE AMBER DAY (2026-10-10, physio QA) ───────────────────────────────────
// The morning back check said "stiffer than usual", or he slept under five
// hours. Not a rest day — a lighter one: the short dose, nothing ballistic,
// no prime, no finisher or pump, and the anchor swaps to its back-friendlier
// version where it declares one (front squat → DB split squat).
describe('the amber day', () => {
  it('drops the ballistic piece and the finisher, keeps the work', () => {
    const wed = getProgramSession('d40-b1');
    const amber = applyAmber(wed);
    expect(amber.dose).toBe('amber');
    const names = blocksOf(amber).map((b) => b.name);
    expect(names).not.toContain('Power');
    expect(amber.blocks.some((b) => b.ballistic || b.prime || b.finisher)).toBe(false);
    for (let v = 0; v < 4; v++) {
      const q = buildStepQueue(amber, {}, v);
      for (const ex of ['db-hang-clean', 'db-push-press']) {
        // the Power EMOM is gone, and so is the warm-up's light hang power
        // clean (ballistic too)
        expect(q.some((st) => st.exId === ex && st.kind === 'work'), `v${v} ${ex}`).toBe(false);
      }
      expect(q.some((st) => st.piece && /^Tabata/.test(st.piece)), `v${v}`).toBe(false);
    }
    // the warm-up, the anchor and the superset stay — on the short dose
    expect(blocksOf(amber).some((b) => b.warmup)).toBe(true);
    expect(names).toContain('Split Squat & Curl');
    expect(blocksOf(amber).find((b) => b.name === 'Split Squat & Curl').rounds).toBe(
      SHORT.pieceRounds,
    );
  });

  // a swapped-in move never carries the old move's cue: "elbows high" on a
  // box squat, or "rear foot on the box" on a glute bridge, is a lie
  it('a swapped move gets its own cue, never the old one', () => {
    const members = (id) =>
      blocksOf(applyAmber(getProgramSession(id))).flatMap((b) => b.members || [b]);
    for (const id of ['d40-a1', 'd40-b1', 'd40-c1']) {
      for (const m of members(id).filter((m) => m.ex === 'glute-bridge')) {
        expect(m.note, id).toMatch(/squeeze/i);
      }
    }
    const box = members('d40-b1').find((m) => m.ex === 'box-squat');
    expect(box.note).not.toMatch(/bar|elbows/i);
    const split = members('d40-b1').find((m) => m.anchor || m.ex === 'db-split-squat');
    expect(split.note || '').not.toMatch(/rack|elbows/i);
  });

  it('swaps the anchor to its amberEx, with its own reps', () => {
    const anchorOf = (s) => blocksOf(s).find((b) => b.anchor);
    const wed = anchorOf(applyAmber(getProgramSession('d40-b1')));
    expect(wed.members[0].ex).toBe('db-split-squat');
    expect(wed.members[0].reps).toBe('6/leg');
    // the swap is the whole member — no amber fields leak into the queue
    expect(wed.members[0].amberEx).toBeUndefined();
    expect(wed.rounds).toBe((wed.warmupRounds || 0) + SHORT.anchorSets);
    const q = buildStepQueue(applyAmber(getProgramSession('d40-b1')));
    const sets = q.filter((st) => st.piece === 'The Anchor' && st.countsAsSet);
    expect(sets.map((st) => st.exId)).toEqual(['db-split-squat', 'db-split-squat']);
    expect(q.some((st) => st.exId === 'front-squat' && st.piece === 'The Anchor')).toBe(
      false,
    );
    // an anchor with no amberEx is served as written (Mon pull-up, Fri press)
    expect(anchorOf(applyAmber(getProgramSession('d40-a1'))).members[0].ex).toBe(
      'pull-up-bw',
    );
    expect(anchorOf(applyAmber(getProgramSession('d40-c1'))).members[0].ex).toBe(
      'incline-db-press',
    );
  });

  it('drops a prime block too, wherever one is declared', () => {
    const s = {
      id: 'x',
      blocks: [
        { prime: true, mode: 'emom', name: 'Prime', rounds: 2, members: [{ ex: 'pogo-hop', secs: 15 }] },
        { ex: 'cat-camel', mode: 'tempo', sets: 1, reps: 6, tempo: [['ROUND', 3]] },
      ],
    };
    expect(applyAmber(s).blocks.map((b) => b.ex ?? b.name)).toEqual(['cat-camel']);
  });

  it('is idempotent, and composes with an already-short session', () => {
    for (const s of [...DENSITY40_SESSIONS, ...REHAB_SESSIONS]) {
      const once = applyAmber(s);
      expect(applyAmber(once), s.id).toBe(once);
      // short first, then amber: the holds are never halved twice
      expect(applyAmber(applyShort(s)).blocks, s.id).toEqual(once.blocks);
    }
  });

  it('is shorter than the full day, and no longer than the short one', () => {
    for (const base of DENSITY40_SESSIONS) {
      for (let v = 0; v < 4; v++) {
        const full = estimateSessionMins(base, v);
        const amber = estimateSessionMins(applyAmber(base), v);
        expect(amber, `${base.id} v${v}`).toBeLessThan(full);
        expect(amber, `${base.id} v${v}`).toBeLessThanOrEqual(
          estimateSessionMins(applyShort(base), v),
        );
      }
    }
    // Back & Hips (round 3): the core work, ONE round of the shortKeep pump
    // (supported or lying — a stiff back tolerates it), no scored finisher,
    // and NO folds — a stiff back skips the held forward flexion outright
    const daily = getRehabSession('daily');
    const KEEP = { 0: 'Arms & Delts', 2: null };
    for (const k of [0, 2]) {
      const q = buildStepQueue(applyAmber(daily), {}, k);
      expect(q.some((st) => st.piece), `k${k}`).toBe(false);
      const labels = [...new Set(q.map((st) => st.blockLabel).filter(Boolean))];
      expect(labels, `k${k}`).toEqual(KEEP[k] ? [KEEP[k]] : []);
      for (const st of q.filter((x) => x.blockLabel && x.kind === 'work')) {
        expect(st.meta, `k${k}`).toMatch(/ROUND 1 OF 1/);
      }
      // the hollow hold is swapped for the McGill curl-up (below)
      expect(q.some((st) => st.exId === 'mcgill-curlup'), `k${k}`).toBe(true);
      for (const ex of ['elephant-walk', 'seated-good-morning']) {
        expect(q.some((st) => st.exId === ex), `k${k} ${ex}`).toBe(false);
      }
      expect(estimateSessionMins(applyAmber(daily), k)).toBeLessThan(
        estimateSessionMins(daily, k),
      );
    }
    expect(applyAmber(daily).blocks.some((b) => b.fold)).toBe(false);
    // Sunday too: the folds sit out on an amber morning
    const sun = applyAmber(getRehabSession('sunday'));
    expect(sun.blocks.some((b) => b.fold)).toBe(false);
    expect(
      buildStepQueue(sun).some((st) => ['elephant-walk', 'seated-good-morning'].includes(st.exId)),
    ).toBe(false);
  });

  // 2026-10-20: a stiff morning eases every core hold to its McGill
  // 10-second version (`amberBlock`) — the curl-up for the hollow hold (two
  // sets on Tuesday, one elsewhere), three re-braced holds a side for the
  // side plank and the bird dog — and the extras (Pallof, leg raises) sit
  // out with the short dose
  it('eases every core hold to its McGill 10-second version', () => {
    const CURL = { 0: [4, 3] }; // Tuesday; every other day one set of 4
    for (const id of ['daily', 'sunday']) {
      const amber = applyAmber(getRehabSession(id));
      for (const v of id === 'daily' ? [0, 2] : [0, 1]) {
        const q = buildStepQueue(amber, {}, v);
        const at = `${id} v${v}`;
        expect(q.some((st) => st.exId === 'hollow-hold'), at).toBe(false);
        const work = (ex) => q.filter((st) => st.exId === ex && st.kind === 'work');
        // the curl-up: 10 s holds, one counted set per set, 3 s re-braces
        const scheme = (id === 'daily' && CURL[v]) || [4];
        expect(work('mcgill-curlup').map((st) => [st.secs, st.rep]), at).toEqual(
          scheme.flatMap((n) => Array.from({ length: n }, (_, i) => [10, i + 1])),
        );
        expect(work('mcgill-curlup').filter((st) => st.countsAsSet), at).toHaveLength(scheme.length);
        expect(
          q.filter((st) => st.exId === 'mcgill-curlup' && st.phase === 'BREATHE').map((st) => st.secs),
          at,
        ).toEqual(scheme.flatMap((n) => Array(n - 1).fill(3)));
        // the side plank and bird dog: three 10 s holds a side, left then right
        for (const ex of ['side-plank', 'bird-dog']) {
          expect(work(ex).map((st) => [st.secs, st.side]), `${at} ${ex}`).toEqual([
            ...Array(3).fill([10, 'LEFT']),
            ...Array(3).fill([10, 'RIGHT']),
          ]);
          expect(work(ex).filter((st) => st.countsAsSet), `${at} ${ex}`).toHaveLength(2);
        }
        // same places as the holds they replace: front, side, back
        const ids = sessionBlocks(amber, v).map((b) => b.ex ?? b.name);
        expect(ids.indexOf('mcgill-curlup'), at).toBeLessThan(ids.indexOf('side-plank'));
        expect(ids.indexOf('side-plank'), at).toBeLessThan(ids.indexOf('bird-dog'));
        expect(sessionBlocks(amber, v).filter((b) => b.mode === 'hold' && b.phase === 'HOLD' && ['side-plank', 'bird-dog'].includes(b.ex)), at).toEqual([]);
        for (const ex of ['pallof-press', 'lying-leg-raise']) {
          expect(q.some((st) => st.exId === ex), `${at} ${ex}`).toBe(false);
        }
      }
    }
  });

  // the swap drops the OLD move's note and warm-up note, and serves the
  // amber move's own note when it has one (round 3)
  it('a swapped anchor drops the old note and warm-up note for its amberNote', () => {
    const wed = blocksOf(applyAmber(getProgramSession('d40-b1'))).find((b) => b.anchor);
    const m = wed.members[0];
    expect(m.ex).toBe('db-split-squat');
    expect(m.note).toMatch(/^DBs at your sides, an easy weight/);
    expect(m.warmupNote).toBeUndefined();
    const q = buildStepQueue(applyAmber(getProgramSession('d40-b1')));
    for (const st of q.filter((x) => x.piece === 'The Anchor')) {
      expect(st.cueNote || '', st.meta).not.toMatch(/Build round|front|rack/i);
    }
  });
});

// ── THE SHORT LIFT DAY, round 2: Friday's Jumps EMOM is a prime ─────────────
describe('the short Friday', () => {
  it('drops the Jumps EMOM first and keeps the press and both supersets', () => {
    const fri = getProgramSession('d40-c1');
    expect(fri.blocks.find((b) => b.name === 'Jumps')).toMatchObject({ prime: true, ballistic: true });
    const short = applyShort(fri);
    const names = blocksOf(short).map((b) => b.name);
    expect(names).not.toContain('Jumps');
    // four rotating warm-ups (round 3), then the press, the dips (fresh,
    // round 4) and the legs
    expect(names).toEqual([
      'Warm-Up',
      'Warm-Up',
      'Warm-Up',
      'Warm-Up',
      'The Anchor',
      'Dips, Pull-Ups & Calves',
      'Legs & Back',
    ]);
    // every warm-up loses its springs (the pogo and the easy broad jumps),
    // keeps the rest of its shape
    const fullWarm = fri.blocks[0].rotate;
    short.blocks[0].rotate.forEach((w, i) => {
      expect(fullWarm[i].members.slice(-2).map((m) => m.ex)).toEqual(['pogo-hop', 'broad-jump']);
      expect(w.members.map((m) => m.ex)).toEqual(
        fullWarm[i].members.filter((m) => !m.ballistic).map((m) => m.ex),
      );
    });
    for (let v = 0; v < 4; v++) {
      const q = buildStepQueue(short, {}, v);
      for (const ex of ['broad-jump', 'skater-bound', 'pogo-hop']) {
        expect(q.some((st) => st.exId === ex), `v${v} ${ex}`).toBe(false);
      }
    }
  });
});

// ── THE AMBER DAY, round 2 (2026-10-10): every spine-unfriendly movement
// swaps through `amberEx`, the back extension becomes a short hold
// (`amberBlock`), the RDL ramp goes (`amberDrop`), the warm-up's ballistic
// power rehearsal goes, and a heavy week is undone back to the reps it
// replaced.
describe('the amber day, round 2', () => {
  const allMembers = (s) => blocksOf(s).flatMap((b) => b.members || []);
  const exIds = (s) => new Set([...blocksOf(s).map((b) => b.ex), ...allMembers(s).map((m) => m.ex)]);

  it('Monday: the RDL becomes a glute bridge and its ramp is dropped', () => {
    const amber = applyAmber(getProgramSession('d40-a1'));
    expect(exIds(amber).has('rdl')).toBe(false);
    expect(blocksOf(amber).some((b) => b.mode === 'ramp')).toBe(false);
    const hc = blocksOf(amber).find((b) => b.name === 'Hinge & Calf');
    const bridge = hc.members[0];
    expect(bridge).toMatchObject({ ex: 'glute-bridge', reps: '12' });
    // the hinge's pinned dose and its effort target don't follow the swap
    expect(bridge.fixedReps).toBeUndefined();
    expect(bridge.effort).toBeUndefined();
    expect(bridge.amberEx).toBeUndefined();
    const q = buildStepQueue(amber);
    expect(q.some((st) => st.exId === 'rdl')).toBe(false);
    expect(q.filter((st) => st.exId === 'glute-bridge' && st.countsAsSet)).toHaveLength(
      SHORT.pieceRounds,
    );
    for (const st of q.filter((x) => x.exId === 'glute-bridge' && x.kind === 'work')) {
      expect(st.meta).toMatch(/^1–2 LEFT/);
    }
  });

  it('Wednesday: front squat → DB split squat on the anchor, split squats → glute bridge, box-squat warm-up, no hang clean', () => {
    const amber = applyAmber(getProgramSession('d40-b1'));
    const anchor = blocksOf(amber).find((b) => b.anchor);
    expect(anchor.members[0]).toMatchObject({ ex: 'db-split-squat', reps: '6/leg' });
    const ss = blocksOf(amber).find((b) => b.name === 'Split Squat & Curl');
    expect(ss.members.map((m) => [m.ex, m.reps])).toEqual([
      ['glute-bridge', '12'],
      ['cable-leg-curl', '10/leg'], // 45-min round: 10/leg
    ]);
    // every one of the four rotating warm-ups (round 3)
    const warms = blocksOf(amber).filter((b) => b.warmup);
    expect(warms).toHaveLength(4);
    for (const warm of warms) {
      const warmIds = warm.members.map((m) => m.ex);
      expect(warmIds).toContain('box-squat');
      expect(warmIds).not.toContain('front-squat');
      expect(warmIds).not.toContain('db-hang-clean');
      expect(warm.members.some((m) => m.ballistic)).toBe(false);
      // the box squat speaks for itself, never the bar's cue
      expect(warm.members.find((m) => m.ex === 'box-squat').note).toMatch(/box/i);
    }
    // nothing loaded on the front rack anywhere, nothing ballistic
    const ids = exIds(amber);
    for (const ex of ['front-squat', 'db-hang-clean', 'db-push-press']) {
      expect(ids.has(ex), ex).toBe(false);
    }
  });

  // round 5: Friday's legs stay legs on a stiff morning — the rear-foot
  // split squat becomes a both-feet DB split squat, shorter range, not a bridge
  it('Friday: the rear-foot split squat becomes an easy DB split squat on Legs & Back; no Power', () => {
    const amber = applyAmber(getProgramSession('d40-c1'));
    const legs = blocksOf(amber).find((b) => b.name === 'Legs & Back');
    expect(legs.members[0]).toMatchObject({ ex: 'db-split-squat', reps: '8/leg' });
    expect(legs.members[0].note).toMatch(/^Both feet on the floor, a shorter range, 3–4 reps left/);
    expect(legs.members.map((m) => m.ex)).toEqual(['db-split-squat', 'lat-pulldown']);
    // the swap drops the slot's alts — an amber morning can't swap back to a
    // split squat through the chooser
    expect(legs.members[0].alts).toBeUndefined();
    expect(blocksOf(amber).some((b) => b.name === 'Power')).toBe(false);
    expect(exIds(amber).has('db-hang-snatch')).toBe(false);
    expect(exIds(amber).has('rfe-split-squat')).toBe(false);
  });

  it('no amber field leaks into any served session', () => {
    for (const s of [...DENSITY40_SESSIONS, ...REHAB_SESSIONS]) {
      const amber = applyAmber(s);
      for (const b of blocksOf(amber)) {
        for (const x of [b, ...(b.members || [])]) {
          for (const k of ['amberEx', 'amberReps', 'amberBlock', 'amberDrop']) {
            expect(x[k], `${s.id} ${x.ex || x.name} ${k}`).toBeUndefined();
          }
        }
      }
    }
  });

  it('undoes a heavy week: the original reps and note come back', () => {
    for (const base of DENSITY40_SESSIONS) {
      for (let w = 1; w <= 12; w++) {
        const shaped = applyFormats(base, w);
        const heavies = allMembers(shaped).filter((m) => m.heavy);
        const amber = applyAmber(shaped);
        for (const m of allMembers(amber)) {
          expect(m.heavy, `${base.id} wk${w} ${m.ex}`).toBeUndefined();
          expect(m.baseReps, `${base.id} wk${w} ${m.ex}`).toBeUndefined();
          expect(m.lastRoundNote, `${base.id} wk${w} ${m.ex}`).toBeUndefined();
          expect(m.note || '', `${base.id} wk${w} ${m.ex}`).not.toMatch(/Heavy week/);
        }
        for (const h of heavies) {
          if (h.amberEx) continue; // swapped out entirely
          const back = allMembers(amber).find((m) => m.ex === h.ex);
          if (!back) continue;
          expect(back.reps, `${base.id} wk${w} ${h.ex}`).toBe(h.baseReps);
        }
      }
    }
    // the concrete case: Monday week 4 runs Hinge & Calf HEAVY (10/leg → 7/leg)
    const hc = (s) => blocksOf(s).find((b) => b.name === 'Hinge & Calf');
    const heavy = applyFormats(getProgramSession('d40-a1'), 4);
    expect(hc(heavy).members.find((m) => m.ex === 'db-calf-raise').reps).toBe('7/leg');
    expect(hc(applyAmber(heavy)).members.find((m) => m.ex === 'db-calf-raise').reps).toBe(
      '10/leg',
    );
    expect(hc(applyAmber(heavy)).formatLabel).toBe('SETS');
  });

  it('Back & Hips: the back extension becomes 3 × 20 s holds on Saturday only', () => {
    const amber = applyAmber(getRehabSession('daily'));
    for (let w = 0; w < 4; w++) {
      for (const k of [0, 2]) {
        const v = w * 4 + k;
        const q = buildStepQueue(amber, {}, v);
        const ext = q.filter((st) => st.exId === 'back-extension' && st.kind === 'work');
        if (k === 0) {
          expect(ext, `v${v}`).toHaveLength(0);
          continue;
        }
        expect(ext, `v${v}`).toHaveLength(3);
        for (const st of ext) {
          expect(st.secs, `v${v}`).toBe(20);
          expect(st.tempo, `v${v}`).toBeUndefined(); // a hold, not reps
        }
      }
    }
    const sat = blocksOf(amber).find((b) => b.ex === 'back-extension');
    expect(sat).toMatchObject({ mode: 'hold', sets: 3, holdSecs: 20 });
  });
});

// ── THE TIRED DAY (2026-10-10, physio QA; real since round 4) ───────────────
// Under five hours of sleep, a fine back: the SHAPE stays (every block, the
// exercises, the anchor's sets), one round lighter on every piece and pump
// and a rep further from failure; what goes is impact and maxing — ballistic
// and prime blocks, ballistic members, finishers, the heavy week, the rep-out.
describe('the tired day', () => {
  const allMembers = (s) => blocksOf(s).flatMap((b) => b.members || []);

  it('keeps every block, one round lighter and a rep further from failure', () => {
    for (const base of DENSITY40_SESSIONS) {
      const tired = applyTired(base);
      expect(tired.dose).toBe('tired');
      for (const b of blocksOf(tired)) {
        const was = blocksOf(base).find((x) => x.name === b.name && x.ex === b.ex);
        const at = `${base.id} ${b.name || b.ex}`;
        if (b.isPiece && !b.warmup && !b.anchor) {
          // one round off every working piece, never below one
          expect(b.rounds, at).toBe(Math.max(1, was.rounds - 1));
          for (const m of b.members) {
            expect(m.effort, `${at} ${m.ex}`).toBe(
              /2–3/.test(was.members.find((x) => x.ex === m.ex)?.effort || '')
                ? '3–4 LEFT'
                : '2–3 LEFT',
            );
          }
        } else if (!b.anchor) {
          expect(b.rounds, at).toBe(was.rounds);
        }
      }
      // round 5: the anchor drops ONE working set (never below its build
      // rounds + 2) — still more than the short day's two
      const anchor = blocksOf(tired).find((b) => b.anchor);
      const full = blocksOf(base).find((b) => b.anchor);
      expect(anchor.rounds, base.id).toBe(
        Math.max((full.warmupRounds || 0) + 2, full.rounds - 1),
      );
      expect(anchor.warmupRounds, base.id).toBe(full.warmupRounds);
    }
    // the hinge (and its ramp) stays on a tired Monday — the back is fine —
    // one round lighter, and the RDL a rep further back: 3–4 LEFT
    const mon = buildStepQueue(applyTired(getProgramSession('d40-a1')));
    const rdl = mon.filter((st) => st.exId === 'rdl' && st.countsAsSet);
    expect(rdl).toHaveLength(2);
    for (const st of rdl) expect(st.meta).toMatch(/^3–4 LEFT · ROUND/);
    for (const st of mon.filter((x) => x.exId === 'lat-pulldown' && x.kind === 'work')) {
      expect(st.meta).toMatch(/^2–3 LEFT · ROUND \d OF 2/);
    }
    // the pull-up anchor runs three of its four sets, each with its pair
    expect(mon.filter((st) => st.exId === 'pull-up-bw' && st.anchor && st.countsAsSet)).toHaveLength(3);
    expect(mon.filter((st) => st.pair)).toHaveLength(3);
    // it is genuinely lighter
    expect(estimateSessionMins(applyTired(getProgramSession('d40-a1')))).toBeLessThan(
      estimateSessionMins(getProgramSession('d40-a1')),
    );
    expect(mon.some((st) => st.exId === 'rdl' && st.phase === 'RAMP')).toBe(true);
  });

  it('drops ballistic and prime blocks, ballistic members and finishers', () => {
    const wed = applyTired(getProgramSession('d40-b1'));
    const names = blocksOf(wed).map((b) => b.name);
    expect(names).not.toContain('Power');
    expect(wed.blocks.some((b) => b.ballistic || b.prime || b.finisher)).toBe(false);
    for (let v = 0; v < 4; v++) {
      const q = buildStepQueue(wed, {}, v);
      for (const ex of ['db-hang-clean', 'db-push-press']) {
        expect(q.some((st) => st.exId === ex), `v${v} ${ex}`).toBe(false);
      }
      expect(q.some((st) => st.piece && /^Tabata/.test(st.piece)), `v${v}`).toBe(false);
      // the squat stays, not swapped — one working set lighter (round 5):
      // two of its three since the three-set cap (2026-11-10)
      expect(
        q.filter((st) => st.piece === 'The Anchor' && st.countsAsSet).map((st) => st.exId),
      ).toEqual(['front-squat', 'front-squat']);
    }
    // the empty-bar warm-up stays as written — no amber swap on a tired day
    expect(blocksOf(wed).find((b) => b.warmup).members.map((m) => m.ex)).toContain(
      'front-squat',
    );
    const fri = applyTired(getProgramSession('d40-c1'));
    expect(blocksOf(fri).some((b) => b.name === 'Power')).toBe(false);
    for (let v = 0; v < 4; v++) {
      expect(buildStepQueue(fri, {}, v).some((st) => st.exId === 'db-hang-snatch'), `fri v${v}`).toBe(
        false,
      );
    }
    for (const m of allMembers(wed).concat(allMembers(fri))) {
      expect(m.ballistic, m.ex).toBeUndefined();
    }
  });

  it('undoes the heavy week and removes the rep-out note', () => {
    for (const base of DENSITY40_SESSIONS) {
      for (let w = 1; w <= 12; w++) {
        const shaped = applyFormats(base, w);
        const tired = applyTired(shaped);
        for (const m of allMembers(tired)) {
          expect(m.heavy, `${base.id} wk${w} ${m.ex}`).toBeUndefined();
          expect(m.lastRoundNote, `${base.id} wk${w} ${m.ex}`).toBeUndefined();
        }
        for (const b of blocksOf(tired).filter((x) => x.isPiece && !x.anchor)) {
          // an EMOM-day piece keeps saying EMOM (QA round); the rest are SETS
          expect(b.formatLabel, `${base.id} wk${w} ${b.name}`).toBe(
            b.mode === 'emom' ? 'EMOM' : 'SETS',
          );
          expect(b.formats).toBeUndefined();
        }
        // the queue never asks for HEAVY or a MAX SET
        for (const st of buildStepQueue(tired)) {
          expect(st.meta || '', `${base.id} wk${w}`).not.toMatch(/HEAVY|MAX SET/);
          expect(st.cueNote || '', `${base.id} wk${w}`).not.toMatch(/LAST SET|Heavy week/);
        }
      }
    }
    // concrete: Monday week 4 Hinge & Calf is HEAVY → back to 10/leg
    const hc = (s) => blocksOf(s).find((b) => b.name === 'Hinge & Calf');
    const tired = applyTired(applyFormats(getProgramSession('d40-a1'), 4));
    const calf = hc(tired).members.find((m) => m.ex === 'db-calf-raise');
    expect(calf.reps).toBe('10/leg');
    expect(calf.note).toBe('One leg at a time, the DB in the same-side hand.');
    expect(hc(tired).rounds).toBe(2); // one round lighter
  });

  // 2026-10-20: the extras sit out too — the Pallof press, the leg raises
  // and Saturday's supporting move (`cast`): with Tuesday's calves gone, a
  // tired Tuesday that kept them was barely lighter than a full one
  it('on Back & Hips: the holds and pumps stay; the extras, carry and score go', () => {
    const daily = getRehabSession('daily');
    const tired = applyTired(daily);
    // the pump IS Tuesday's volume — a short night keeps it (Thursday's
    // three pumps left with Thursday on 2026-11-10)
    const labels = (k) =>
      new Set(buildStepQueue(tired, {}, k).map((st) => st.blockLabel).filter(Boolean));
    expect([...labels(0)]).toEqual(['Arms & Delts']);
    // one round lighter (round 4): Arms & Delts 3 → 2
    const sets = (k, n) =>
      buildStepQueue(tired, {}, k).filter((st) => st.blockLabel === n && st.countsAsSet).length;
    // five moves × two rounds — a tired day keeps the pull-aparts (only a
    // short or amber day drops them)
    expect(sets(0, 'Arms & Delts')).toBe(10);
    // …a rep further from failure
    for (const st of buildStepQueue(tired, {}, 0).filter((x) => x.blockLabel && x.kind === 'work')) {
      expect(st.meta).toMatch(/^2–3 LEFT · ROUND/);
    }
    // and a tired Tuesday is genuinely lighter: a round off the arms, and
    // the Pallof press and the leg raises sit out (~24 vs ~34 min)
    expect(estimateSessionMins(tired, 0)).toBeLessThanOrEqual(estimateSessionMins(daily, 0) - 8);
    expect(labels(2).size).toBe(0);
    for (const k of [0, 2]) {
      const q = buildStepQueue(tired, {}, k);
      // the openers, the core holds as written and the folds all stay
      for (const ex of ['t-spine-reach', 'hollow-hold', 'side-plank', 'bird-dog', 'seated-good-morning']) {
        expect(q.some((st) => st.exId === ex), `k${k} ${ex}`).toBe(true);
      }
      for (const ex of ['hollow-hold', 'side-plank', 'bird-dog']) {
        const secs = (s) =>
          buildStepQueue(s, {}, k)
            .filter((st) => st.exId === ex && st.kind === 'work')
            .map((st) => st.secs);
        expect(secs(tired), `k${k} ${ex}`).toEqual(secs(daily));
      }
      // the extras go: Pallof (Tue), leg raises (Tue + Sat), supporting move (Sat)
      for (const ex of ['pallof-press', 'lying-leg-raise', 'side-hip-abduction']) {
        expect(q.some((st) => st.exId === ex), `k${k} ${ex}`).toBe(false);
      }
      // the back extension is served as written (reps, not the amber hold)
      const ext = q.filter((st) => st.exId === 'back-extension' && st.kind === 'work');
      expect(ext.length, `k${k}`).toBe(k === 2 ? 3 : 0);
    }
    expect(tired.blocks.some((b) => b.cast)).toBe(false);
    // the non-pump `finisher` slots go — Saturday's carry sits in one, and
    // the scored finisher (conditioning) too
    const sat = buildStepQueue(tired, {}, 2);
    expect(sat.some((st) => st.exId === 'farmer-carry')).toBe(false);
    expect(sat.some((st) => st.piece || st.conditioning)).toBe(false);
    // a tired back is a fine back: the folds stay
    expect(sat.some((st) => st.exId === 'elephant-walk')).toBe(true);
    // Sunday's extras go the same way: the Pallof press and the supporting
    // move; the core holds and the folds stay
    const sun = buildStepQueue(applyTired(getRehabSession('sunday')), {}, 0);
    for (const ex of ['pallof-press', 'hip-flexor-lift']) {
      expect(sun.some((st) => st.exId === ex), `sun ${ex}`).toBe(false);
    }
    for (const ex of ['hollow-hold', 'side-plank', 'bird-dog', 'elephant-walk']) {
      expect(sun.some((st) => st.exId === ex), `sun ${ex}`).toBe(true);
    }
  });

  // the `cast` filter is generic: any extra a tired day meets sits out, on
  // any session — even one with no other dosing to do
  it('drops every cast block, wherever one is declared', () => {
    const s = {
      id: 'x',
      blocks: [
        { ex: 'cat-camel', mode: 'tempo', sets: 1, reps: 6, tempo: [['ROUND', 3]] },
        { cast: true, ex: 'pallof-press', mode: 'tempo', sets: 2, reps: 8, tempo: [['PRESS', 1]] },
        { cast: true, rotate: [{ ex: 'lying-leg-raise', mode: 'lift', sets: 3, reps: '10' }, null] },
      ],
    };
    expect(applyTired(s).blocks.map((b) => b.ex)).toEqual(['cat-camel']);
  });

  it('is idempotent', () => {
    for (const s of [...DENSITY40_SESSIONS, ...REHAB_SESSIONS]) {
      const once = applyTired(s);
      expect(applyTired(once), s.id).toBe(once);
      const shaped = applyTired(applyFormats(s, 4));
      expect(applyTired(shaped), s.id).toBe(shaped);
    }
  });
});

// ── THE MORNING RULE (round 3, physio QA) ───────────────────────────────────
// Up less than an hour: the discs are fully hydrated and bending stress
// peaks, so the morning check's "UP UNDER 1 HR" drops the held forward folds
// — the only blocks flagged `fold` — and nothing else.
describe('applyNoFolds', () => {
  const FOLDS = ['elephant-walk', 'seated-good-morning'];
  // Round 6: on Saturday the morning rule also turns the back-extension
  // REPS into the amber 3 × 20 s hold (`morning` + amberBlock); Thursday is
  // already a hold and stays as written. 2026-10-20: the two flexed-pelvis
  // core moves follow the same rule — the hollow hold eases to its McGill
  // curl-up (`morning` + amberBlock), the leg raises sit out (`morning`, no
  // hold version). The side plank and bird dog stay as written.
  it('drops the two folds and the leg raises, eases the hollow hold, holds Saturday\'s back extension', () => {
    for (const id of ['daily', 'sunday']) {
      const base = getRehabSession(id);
      const out = applyNoFolds(base);
      // the two folds, and on the daily the leg-raise slot
      expect(out.blocks, id).toHaveLength(base.blocks.length - (id === 'daily' ? 3 : 2));
      expect(out.blocks.some((b) => b.fold), id).toBe(false);
      for (let v = 0; v < 4; v++) {
        const q = buildStepQueue(out, {}, v);
        for (const ex of [...FOLDS, 'lying-leg-raise', 'hollow-hold']) {
          expect(q.some((st) => st.exId === ex), `${id} v${v} ${ex}`).toBe(false);
        }
        // the rest of the day is the same movements in the same order, the
        // curl-up standing in for the hollow hold
        const full = buildStepQueue(base, {}, v)
          .filter((st) => st.kind === 'work' && !FOLDS.includes(st.exId) && st.exId !== 'lying-leg-raise')
          .map((st) => (st.exId === 'hollow-hold' ? 'mcgill-curlup' : st.exId));
        expect(
          [...new Set(q.filter((st) => st.kind === 'work').map((st) => st.exId))],
          `${id} v${v}`,
        ).toEqual([...new Set(full)]);
        // the side plank and bird dog keep their holds
        for (const ex of ['side-plank', 'bird-dog']) {
          const secs = (x) =>
            buildStepQueue(x, {}, v)
              .filter((st) => st.exId === ex && st.kind === 'work')
              .map((st) => st.secs);
          expect(secs(out), `${id} v${v} ${ex}`).toEqual(secs(base));
        }
      }
    }
    const daily = getRehabSession('daily');
    const ext = (s, v) =>
      buildStepQueue(s, {}, v).filter((st) => st.exId === 'back-extension' && st.kind === 'work');
    const out = applyNoFolds(daily);
    for (let w = 0; w < 12; w++) {
      // Saturday (reps since 2026-10-21; Thursday's left on 2026-11-10):
      // 3 × reps → 3 × 20 s holds — reps from a hinged bottom are the early bend
      for (const [k, day] of [[2, 'sat']]) {
        expect(ext(daily, w * 4 + k).every((st) => st.manual && st.reps), `w${w} ${day}`).toBe(true);
        expect(ext(out, w * 4 + k).map((st) => [st.secs, st.tempo]), `w${w} ${day}`).toEqual([
          [20, undefined],
          [20, undefined],
          [20, undefined],
        ]);
      }
    }
  });

  it('leaves a session with no morning work as the same object, and is idempotent', () => {
    // Wednesday and Friday have nothing that bends early in the day
    for (const id of ['d40-b1', 'd40-c1']) {
      const s = getProgramSession(id);
      expect(hasMorningWork(s), id).toBe(false);
      expect(applyNoFolds(s), id).toBe(s);
    }
    const reset = getRehabSession('reset');
    expect(hasMorningWork(reset)).toBe(false);
    expect(applyNoFolds(reset)).toBe(reset);
    for (const s of [getRehabSession('daily'), getRehabSession('sunday'), getProgramSession('d40-a1')]) {
      expect(hasMorningWork(s), s.id).toBe(true);
      const once = applyNoFolds(s);
      expect(hasMorningWork(once), s.id).toBe(false);
      expect(applyNoFolds(once), s.id).toBe(once);
    }
  });

  // ROUND 4: the morning rule reaches Monday — a loaded hinge in the first
  // waking hour is the week's riskiest bend, so the RDL bridges (the amber
  // swap) and its ramp drops. Everything else on Monday is untouched.
  it('on Monday: the RDL becomes a glute bridge and its ramp drops', () => {
    const mon = getProgramSession('d40-a1');
    const out = applyNoFolds(mon);
    const hc = blocksOf(out).find((b) => b.name === 'Hinge & Calf');
    expect(hc.members[0]).toMatchObject({ ex: 'glute-bridge', reps: '12' });
    expect(hc.members[0].note).toMatch(/squeeze/i);
    for (const k of ['morning', 'amberEx', 'fixedReps', 'effort']) {
      expect(hc.members[0][k], k).toBeUndefined();
    }
    expect(hc.members[1].ex).toBe('db-calf-raise');
    expect(blocksOf(out).some((b) => b.mode === 'ramp')).toBe(false);
    for (let v = 0; v < 4; v++) {
      const q = buildStepQueue(out, {}, v);
      expect(q.some((st) => st.exId === 'rdl'), `v${v}`).toBe(false);
      expect(q.filter((st) => st.exId === 'glute-bridge' && st.countsAsSet), `v${v}`).toHaveLength(3);
      // the anchor and Wings are as written
      expect(q.filter((st) => st.exId === 'pull-up-bw' && st.anchor && st.countsAsSet)).toHaveLength(4);
      expect(q.filter((st) => st.exId === 'chest-supported-row' && st.countsAsSet)).toHaveLength(3);
    }
  });

  it('composes with the short and tired days', () => {
    const daily = getRehabSession('daily');
    for (const dosed of [applyShort(daily), applyTired(daily)]) {
      const out = applyNoFolds(dosed);
      expect(out.dose).toBe(dosed.dose);
      expect(out.blocks.some((b) => b.fold)).toBe(false);
      expect(applyNoFolds(applyShort(applyNoFolds(daily))).blocks).toEqual(
        applyNoFolds(applyShort(daily)).blocks,
      );
    }
  });
});

// ── A NUMBER, NOT A CLOCK (2026-10-21, his call: "just tell me how many") ───
// Reps at your pace, no count and no clock: Saturday 3 × 12. Thursday's
// 3 × 10 left with Thursday (2026-11-10 — a rest day now). An amber morning
// still holds, shorter.
describe('the back extension, by day', () => {
  const daily = getRehabSession('daily');
  const ext = (s, v) =>
    buildStepQueue(s, {}, v).filter((st) => st.exId === 'back-extension' && st.kind === 'work');

  for (const [k, day, reps] of [[2, 'Saturday', '12']]) {
    it(`${day} is 3 × ${reps} at your pace on the movement’s own cue`, () => {
      for (let w = 0; w < 4; w++) {
        const sets = ext(daily, w * 4 + k);
        expect(sets).toHaveLength(3);
        for (const st of sets) {
          expect(st).toMatchObject({ reps, manual: true, secs: null, logWeight: false, countsAsSet: true });
          // no count to follow, no clock
          expect(st.tempo).toBeUndefined();
          expect(st.repTempo).toBeUndefined();
          expect(st.cueNote).toBe('Lift to straight, never past it. Your pace.');
          expect(st.cue).toBeUndefined();
          expect(st.how).toBeUndefined();
        }
      }
    });
  }

  it('Tuesday has no back extension — and nor does the rest-day column', () => {
    expect(ext(daily, 0)).toHaveLength(0);
    expect(ext(daily, 1)).toHaveLength(0);
  });

  it('an amber morning holds 3 × 20 s, with the hold cue', () => {
    for (const v of [2, 6]) {
      const a = ext(applyAmber(daily), v);
      expect(a.map((st) => st.secs), `v${v}`).toEqual([20, 20, 20]);
      for (const st of a) expect(st.how, `v${v}`).toMatch(/^No reps/);
    }
  });
});

// ── DOSES COMPOSE (QA round ★1) ─────────────────────────────────────────────
// A session's `dose` is the '+'-joined parts in apply order. Each apply* is
// a no-op when its own part is present, so a restore that re-applies the
// saved parts rebuilds the exact live queue — the old single-valued dose
// retired a short+tired run on reload.
describe('doses compose', () => {
  const wed = getProgramSession('d40-b1');
  const daily = getRehabSession('daily');
  it('joins the parts in apply order and reads them back', () => {
    const st = applyTired(applyShort(wed));
    expect(st.dose).toBe('short+tired');
    expect(doseParts(st)).toEqual(['short', 'tired']);
    expect(hasDose(st, 'short')).toBe(true);
    expect(hasDose(st, 'tired')).toBe(true);
    expect(hasDose(st, 'amber')).toBe(false);
    expect(doseParts(wed)).toEqual([]);
    expect(hasDose(wed, 'short')).toBe(false);
    // amber replaces short (it IS the short dose, lighter)
    expect(applyAmber(applyShort(wed)).dose).toBe('amber');
    expect(applyUnchecked(applyShort(wed)).dose).toBe('short+unchecked');
    expect(applyUnchecked(wed).dose).toBe('unchecked');
  });

  it('each part is idempotent — a re-apply never doubles a cut', () => {
    for (const s of [wed, daily, getProgramSession('d40-a1'), getProgramSession('d40-c1')]) {
      const st = applyTired(applyShort(s));
      expect(applyShort(st), s.id).toBe(st);
      expect(applyTired(st), s.id).toBe(st);
      const su = applyUnchecked(applyShort(s));
      expect(applyUnchecked(su), s.id).toBe(su);
      expect(applyShort(su), s.id).toBe(su);
      const am = applyAmber(s);
      expect(applyAmber(am), s.id).toBe(am);
    }
  });

  // what main.js dosed() does on a restore: every saved part, in the fixed
  // order short, amber, tired, unchecked (± the morning rule) → the same queue
  it('rebuilding from the saved parts gives the exact live queue', () => {
    const APPLY = { short: applyShort, amber: applyAmber, tired: applyTired, unchecked: applyUnchecked };
    const rebuild = (s, parts, noFolds) => {
      let d = s;
      for (const p of ['short', 'amber', 'tired', 'unchecked']) if (parts.includes(p)) d = APPLY[p](d);
      return noFolds ? applyNoFolds(d) : d;
    };
    const combos = [['short', 'tired'], ['short', 'unchecked'], ['tired'], ['unchecked'], ['amber'], ['short']];
    for (const s of [wed, daily, getProgramSession('d40-a1'), getProgramSession('d40-c1')]) {
      for (const parts of combos) {
        for (const noFolds of [false, true]) {
          let live = s;
          for (const p of parts) live = APPLY[p](live);
          if (noFolds) live = applyNoFolds(live);
          const again = rebuild(s, doseParts(live), noFolds);
          for (const v of [0, 1, 2]) {
            expect(buildStepQueue(again, {}, v), `${s.id} ${parts} nf${noFolds} v${v}`).toEqual(
              buildStepQueue(live, {}, v),
            );
          }
        }
      }
    }
  });
});

// ── THE UNCHECKED DAY (QA round ★2) ─────────────────────────────────────────
// No back answer yet: the session still runs, but nothing ballistic, no
// sprints, no Tabata or scored finisher, no power lifts or their warm-up
// rehearsal (the pogo until 2026-10-20) — until he taps.
describe('applyUnchecked', () => {
  it('drops both Power EMOMs, Tabata and the warm-up rehearsals on a lift day, keeps the work', () => {
    for (const s of DENSITY40_SESSIONS) {
      const u = applyUnchecked(s);
      expect(u.dose).toBe('unchecked');
      for (let v = 0; v < 4; v++) {
        const q = buildStepQueue(u, {}, v);
        for (const ex of ['db-hang-clean', 'db-hang-snatch', 'db-push-press']) {
          expect(q.some((st) => st.exId === ex), `${s.id} v${v} ${ex}`).toBe(false);
        }
        expect(q.some((st) => st.piece === 'Power'), `${s.id} v${v}`).toBe(false);
        expect(q.some((st) => st.conditioning), `${s.id} v${v}`).toBe(false);
        expect(q.some((st) => st.piece === 'The Anchor'), `${s.id} v${v}`).toBe(true);
      }
      // the supersets keep their full shape
      const full = blocksOf(s).filter((b) => b.isPiece && b.mode === 'circuit');
      const kept = blocksOf(u).filter((b) => b.isPiece && b.mode === 'circuit');
      expect(kept.map((b) => [b.name, b.rounds]), s.id).toEqual(full.map((b) => [b.name, b.rounds]));
    }
  });

  it('drops Saturday\'s sprints, keeps the pumps, carries, core holds and extras', () => {
    const daily = getRehabSession('daily');
    const u = applyUnchecked(daily);
    for (const v of [0, 2]) {
      const q = buildStepQueue(u, {}, v);
      expect(q.some((st) => /^Sprints/.test(st.piece || '')), `v${v}`).toBe(false);
      for (const ex of ['hollow-hold', 'side-plank', 'bird-dog']) {
        expect(q.some((st) => st.exId === ex), `v${v} ${ex}`).toBe(true);
      }
      // the leg raises are volume, not risk: Tue + Sat keep them
      expect(q.some((st) => st.exId === 'lying-leg-raise'), `v${v}`).toBe(true);
    }
    expect(buildStepQueue(u, {}, 2).some((st) => st.exId === 'farmer-carry')).toBe(true);
    expect(buildStepQueue(u, {}, 0).some((st) => st.blockLabel === 'Arms & Delts')).toBe(true);
    expect(buildStepQueue(u, {}, 0).some((st) => st.exId === 'pallof-press')).toBe(true);
  });
});
