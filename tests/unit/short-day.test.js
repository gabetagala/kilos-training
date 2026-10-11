import { describe, expect, it } from 'vitest';
import {
  applyAmber,
  applyFormats,
  applyUnchecked,
  doseParts,
  hasDose,
  applyNoFolds,
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
  // anything that leaves the floor — on any week of the block (round 3:
  // ballistic MEMBERS go too, so the warm-up's pogo never survives)
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
          for (const ex of ['pogo-hop', 'broad-jump', 'skater-bound', 'db-push-press']) {
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

  it('halves the long holds and never the McGill primer', () => {
    const short = applyShort(daily);
    const halved = new Set();
    let kept = 0;
    for (const b of holds(daily)) {
      const match = holds(short).find((x) => x.ex === b.ex);
      if (!match) continue; // the supporting cast and the carry are dropped
      if (b.holdSecs >= SHORT.holdFloorSecs) {
        expect(match.holdSecs, b.ex).toBe(
          Math.max(60, Math.round(b.holdSecs / 2 / 10) * 10),
        );
        halved.add(b.ex);
      } else {
        // a short hold is the protocol — Thursday's 30 s back-extension
        // hold (round 3) is served as written
        expect(match.holdSecs, b.ex).toBe(b.holdSecs);
        expect(b.ex).toBe('back-extension');
        kept += 1;
      }
    }
    // the couch stretch (1:00 a side — the floor) and the seated good morning
    // (1:30 → 1:00) are the long holds; the couch now sits in a per-day slot
    // (Saturday serves it just before the folds), so it appears once per day
    expect([...halved].sort()).toEqual(['couch-stretch', 'seated-good-morning']);
    // one per week of the Thursday column, all twelve (48-deep pool)
    expect(kept).toBe(12);
    // the Big 3 primer is mode 'reps' at 10s protocol holds — untouched:
    // half of a McGill hold is not a McGill hold (two sets Tue/Sat, one Thu)
    for (const v of [0, 1, 2]) {
      const primer = sessionBlocks(short, v).filter((b) => b.mode === 'reps');
      const full = sessionBlocks(daily, v).filter((b) => b.mode === 'reps');
      expect(primer.map((b) => b.ex), `v${v}`).toEqual(['mcgill-curlup', 'side-plank', 'bird-dog']);
      for (const [i, c] of primer.entries()) {
        expect(c.holdSecs).toBe(10);
        expect(c.repScheme, `v${v} ${c.ex}`).toEqual(full[i].repScheme);
      }
    }
  });

  // Round 3 (plan QA): a short day keeps ONE round of the `shortKeep` pump
  // — Tuesday's Arms, Thursday's Row & Raise — so the triangle stays alive
  // through the newborn weeks. Everything else day-specific goes.
  it('drops the supporting cast and the finishers, keeps one round of the shortKeep pump', () => {
    const short = applyShort(daily);
    expect(short.blocks.some((b) => b.cast)).toBe(false);
    const fin = short.blocks.filter((b) => b.finisher);
    expect(fin).toHaveLength(1);
    expect(fin[0].shortKeep).toBe(true);
    // Arms is three moves since the sprint round
    const KEEP = { 0: ['Arms', 3], 1: ['Row & Raise', 2], 2: null };
    for (let w = 0; w < 4; w++) {
      for (const k of [0, 1, 2]) {
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
        const ids = new Set(q.map((st) => st.exId));
        for (const ex of ['t-spine-reach', 'mcgill-curlup', 'elephant-walk']) {
          expect(ids.has(ex), `v${v} ${ex}`).toBe(true);
        }
        // the back extension keeps its Thu/Sat days on a short day too
        expect(ids.has('back-extension'), `v${v}`).toBe(k !== 0);
      }
    }
  });

  it('is about a quarter of an hour, not a token', () => {
    // every SERVED variant: Tue/Thu/Sat on the daily (k = 3 is never served
    // — rehabVariantIdx maps every weekday to 0, 1 or 2), both Sundays
    const SERVED = { daily: [0, 1, 2, 4, 5, 6, 44, 45, 46], sunday: [0, 1] };
    for (const [id, vs] of Object.entries(SERVED)) {
      for (const v of vs) {
        const mins = estimateSessionMins(applyShort(getRehabSession(id)), v);
        expect(mins).toBeGreaterThanOrEqual(10);
        expect(mins).toBeLessThanOrEqual(20);
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
      for (const ex of ['broad-jump', 'db-push-press']) {
        // the warm-up never had them; the Power EMOM is gone
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
    // Back & Hips (round 3): the primer, ONE round of the shortKeep pump
    // (supported or lying — a stiff back tolerates it), no scored finisher,
    // and NO folds — a stiff back skips the held forward flexion outright
    const daily = getRehabSession('daily');
    const KEEP = { 0: 'Arms', 1: 'Row & Raise', 2: null };
    for (const k of [0, 1, 2]) {
      const q = buildStepQueue(applyAmber(daily), {}, k);
      expect(q.some((st) => st.piece), `k${k}`).toBe(false);
      const labels = [...new Set(q.map((st) => st.blockLabel).filter(Boolean))];
      expect(labels, `k${k}`).toEqual(KEEP[k] ? [KEEP[k]] : []);
      for (const st of q.filter((x) => x.blockLabel && x.kind === 'work')) {
        expect(st.meta, `k${k}`).toMatch(/ROUND 1 OF 1/);
      }
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

// ── THE SHORT LIFT DAY, round 2: Friday's Jumps are a prime ────────────────
describe('the short Friday', () => {
  it('drops the Jumps EMOM first and keeps the press and both supersets', () => {
    const fri = getProgramSession('d40-c1');
    expect(fri.blocks.some((b) => b.name === 'Jumps')).toBe(true);
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
      'Dips, Pull-Ups & Curls',
      'Legs & Back',
    ]);
    // every warm-up loses its pogo, keeps the rest of its shape
    const fullWarm = fri.blocks[0].rotate;
    short.blocks[0].rotate.forEach((w, i) => {
      expect(w.members.map((m) => m.ex)).toEqual(
        fullWarm[i].members.filter((m) => m.ex !== 'pogo-hop').map((m) => m.ex),
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
// pogo goes, and a heavy week is undone back to the reps it replaced.
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

  it('Wednesday: front squat → DB split squat on the anchor, split squats → glute bridge, box-squat warm-up, no pogo', () => {
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
      expect(warmIds).not.toContain('pogo-hop');
      expect(warm.members.some((m) => m.ballistic)).toBe(false);
      // the box squat speaks for itself, never the bar's cue
      expect(warm.members.find((m) => m.ex === 'box-squat').note).toMatch(/box/i);
    }
    // nothing loaded on the front rack anywhere, nothing that leaves the floor
    const ids = exIds(amber);
    for (const ex of ['front-squat', 'pogo-hop', 'broad-jump', 'db-push-press']) {
      expect(ids.has(ex), ex).toBe(false);
    }
  });

  // round 5: Friday's legs stay legs on a stiff morning — the rear-foot
  // split squat becomes a both-feet DB split squat, shorter range, not a bridge
  it('Friday: the rear-foot split squat becomes an easy DB split squat on Legs & Back; no Jumps', () => {
    const amber = applyAmber(getProgramSession('d40-c1'));
    const legs = blocksOf(amber).find((b) => b.name === 'Legs & Back');
    expect(legs.members[0]).toMatchObject({ ex: 'db-split-squat', reps: '8/leg' });
    expect(legs.members[0].note).toMatch(/^Both feet on the floor, a shorter range, 3–4 reps left/);
    expect(legs.members.map((m) => m.ex)).toEqual(['db-split-squat', 'lat-pulldown']);
    // the swap drops the slot's alts — an amber morning can't swap back to a
    // split squat through the chooser
    expect(legs.members[0].alts).toBeUndefined();
    expect(blocksOf(amber).some((b) => b.name === 'Jumps')).toBe(false);
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

  it('Back & Hips: the back extension becomes 3 × 20 s holds on Thu and Sat only', () => {
    const amber = applyAmber(getRehabSession('daily'));
    for (let w = 0; w < 4; w++) {
      for (const k of [0, 1, 2]) {
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
    const thu = blocksOf(amber).find((b) => b.ex === 'back-extension');
    expect(thu).toMatchObject({ mode: 'hold', sets: 3, holdSecs: 20 });
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
    // the pull-up anchor runs four of its five sets, each with its pair
    expect(mon.filter((st) => st.exId === 'pull-up-bw' && st.anchor && st.countsAsSet)).toHaveLength(4);
    expect(mon.filter((st) => st.pair)).toHaveLength(4);
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
      for (const ex of ['pogo-hop', 'broad-jump', 'db-push-press']) {
        expect(q.some((st) => st.exId === ex), `v${v} ${ex}`).toBe(false);
      }
      expect(q.some((st) => st.piece && /^Tabata/.test(st.piece)), `v${v}`).toBe(false);
      // the squat stays, not swapped — one working set lighter (round 5)
      expect(
        q.filter((st) => st.piece === 'The Anchor' && st.countsAsSet).map((st) => st.exId),
      ).toEqual(['front-squat', 'front-squat', 'front-squat']);
    }
    // the empty-bar warm-up stays as written — no amber swap on a tired day
    expect(blocksOf(wed).find((b) => b.warmup).members.map((m) => m.ex)).toContain(
      'front-squat',
    );
    const fri = applyTired(getProgramSession('d40-c1'));
    expect(blocksOf(fri).some((b) => b.name === 'Jumps')).toBe(false);
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

  it('on Back & Hips: the holds, primer and pumps stay; the carry and score go', () => {
    const daily = getRehabSession('daily');
    const tired = applyTired(daily);
    // the pumps ARE Tuesday's and Thursday's volume — a short night keeps them
    const labels = (k) =>
      new Set(buildStepQueue(tired, {}, k).map((st) => st.blockLabel).filter(Boolean));
    expect([...labels(0)]).toEqual(expect.arrayContaining(['Arms', 'Calves']));
    // Thursday keeps all three pumps — Curl & Lateral included (round 3)
    expect([...labels(1)].sort()).toEqual(['Calves', 'Curl & Lateral', 'Row & Raise']);
    // every pump one round lighter (round 4): Arms 4 → 3, Calves 3 → 2,
    // Row & Raise 3 → 2, Curl & Lateral 5 → 4, Thursday's calves 3 → 2
    // (45-min round counts)
    const sets = (k, n) =>
      buildStepQueue(tired, {}, k).filter((st) => st.blockLabel === n && st.countsAsSet).length;
    expect(sets(0, 'Arms')).toBe(9); // three moves × three rounds
    expect(sets(0, 'Calves')).toBe(2);
    expect(sets(1, 'Row & Raise')).toBe(4);
    expect(sets(1, 'Curl & Lateral')).toBe(8);
    expect(sets(1, 'Calves')).toBe(2);
    // …a rep further from failure
    for (const st of buildStepQueue(tired, {}, 0).filter((x) => x.blockLabel && x.kind === 'work')) {
      expect(st.meta).toMatch(/^2–3 LEFT · ROUND/);
    }
    // and a tired Tuesday is genuinely shorter (~32 vs ~39 min)
    expect(estimateSessionMins(tired, 0)).toBeLessThanOrEqual(estimateSessionMins(daily, 0) - 5);
    expect(labels(2).size).toBe(0);
    for (const k of [0, 1, 2]) {
      const q = buildStepQueue(tired, {}, k);
      for (const ex of ['t-spine-reach', 'mcgill-curlup', 'seated-good-morning']) {
        expect(q.some((st) => st.exId === ex), `k${k} ${ex}`).toBe(true);
      }
      // the back extension is served as written (reps, not the amber hold)
      const ext = q.filter((st) => st.exId === 'back-extension' && st.kind === 'work');
      expect(ext.length, `k${k}`).toBe(k === 0 ? 0 : 3);
    }
    // the non-pump `finisher` slots go — Saturday's carry sits in one, and
    // the scored finisher (conditioning) too
    const sat = buildStepQueue(tired, {}, 2);
    expect(sat.some((st) => st.exId === 'farmer-carry')).toBe(false);
    expect(sat.some((st) => st.piece || st.conditioning)).toBe(false);
    // a tired back is a fine back: the folds stay
    expect(sat.some((st) => st.exId === 'elephant-walk')).toBe(true);
    // …but the supporting cast is not a finisher: Saturday keeps it
    expect(sat.some((st) => st.exId === 'side-hip-abduction')).toBe(true);
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
  // already a hold and stays as written.
  it('drops exactly the two folds, and holds Saturday\'s back extension', () => {
    for (const id of ['daily', 'sunday']) {
      const base = getRehabSession(id);
      const out = applyNoFolds(base);
      expect(out.blocks, id).toHaveLength(base.blocks.length - 2);
      expect(out.blocks.some((b) => b.fold), id).toBe(false);
      for (let v = 0; v < 4; v++) {
        const q = buildStepQueue(out, {}, v);
        for (const ex of FOLDS) expect(q.some((st) => st.exId === ex), `${id} v${v} ${ex}`).toBe(false);
        // the rest of the day is the same movements in the same order
        const full = buildStepQueue(base, {}, v).filter((st) => !FOLDS.includes(st.exId));
        expect(
          [...new Set(q.filter((st) => st.kind === 'work').map((st) => st.exId))],
        ).toEqual([...new Set(full.filter((st) => st.kind === 'work').map((st) => st.exId))]);
      }
    }
    const daily = getRehabSession('daily');
    const ext = (s, v) =>
      buildStepQueue(s, {}, v).filter((st) => st.exId === 'back-extension' && st.kind === 'work');
    const out = applyNoFolds(daily);
    for (let w = 0; w < 12; w++) {
      // Saturday: 3 × 12 reps → 3 × 20 s holds
      expect(ext(daily, w * 4 + 2).every((st) => st.tempo), `w${w} sat`).toBe(true);
      expect(ext(out, w * 4 + 2).map((st) => [st.secs, st.tempo]), `w${w} sat`).toEqual([
        [20, undefined],
        [20, undefined],
        [20, undefined],
      ]);
      // Thursday: unchanged
      expect(ext(out, w * 4 + 1)).toEqual(ext(daily, w * 4 + 1));
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
      expect(q.filter((st) => st.exId === 'pull-up-bw' && st.anchor && st.countsAsSet)).toHaveLength(5);
      expect(q.filter((st) => st.exId === 'chest-supported-row' && st.countsAsSet)).toHaveLength(4);
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

// ── THURSDAY HOLDS, SATURDAY REPS (round 3, physio QA) ──────────────────────
// Thursday is 24 h after Wednesday's front squat: an isometric hold, extensor
// endurance without another round of loaded flexion-extension. Saturday, two
// days clear of spinal loading, gets 3 × 12 tempo reps. An amber morning
// holds on either day, shorter.
describe('the back extension, by day', () => {
  const daily = getRehabSession('daily');
  const ext = (s, v) =>
    buildStepQueue(s, {}, v).filter((st) => st.exId === 'back-extension' && st.kind === 'work');

  it('Thursday is 3 × 30 s holds that speak for themselves', () => {
    for (let w = 0; w < 4; w++) {
      const thu = ext(daily, w * 4 + 1);
      expect(thu).toHaveLength(3);
      for (const st of thu) {
        expect(st).toMatchObject({ secs: 30, phase: 'HOLD', holdSet: true, countsAsSet: true });
        expect(st.tempo).toBeUndefined();
        // the block brings its own cue and how-line — never the rep-based ones
        expect(st.cue).toMatch(/STAY there/);
        expect(st.how).toMatch(/^No reps/);
      }
    }
  });

  it('Saturday is 3 × 12 tempo reps on the movement’s own cue', () => {
    for (let w = 0; w < 4; w++) {
      const sat = ext(daily, w * 4 + 2);
      expect(sat).toHaveLength(3);
      for (const st of sat) {
        expect(st.tempo.reps).toBe(12);
        expect(st.cue).toBeUndefined();
        expect(st.how).toBeUndefined();
      }
    }
    // Tuesday has none
    expect(ext(daily, 0)).toHaveLength(0);
  });

  it('an amber morning holds 3 × 20 s on both days, with the hold cue', () => {
    for (const v of [1, 2]) {
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
// sprints, no Tabata or scored finisher, no pogo — until he taps.
describe('applyUnchecked', () => {
  it('drops the jumps, Power, Tabata and the pogo on a lift day, keeps the work', () => {
    for (const s of DENSITY40_SESSIONS) {
      const u = applyUnchecked(s);
      expect(u.dose).toBe('unchecked');
      for (let v = 0; v < 4; v++) {
        const q = buildStepQueue(u, {}, v);
        for (const ex of ['pogo-hop', 'broad-jump', 'skater-bound', 'db-push-press']) {
          expect(q.some((st) => st.exId === ex), `${s.id} v${v} ${ex}`).toBe(false);
        }
        expect(q.some((st) => st.conditioning), `${s.id} v${v}`).toBe(false);
        expect(q.some((st) => st.piece === 'The Anchor'), `${s.id} v${v}`).toBe(true);
      }
      // the supersets keep their full shape
      const full = blocksOf(s).filter((b) => b.isPiece && b.mode === 'circuit');
      const kept = blocksOf(u).filter((b) => b.isPiece && b.mode === 'circuit');
      expect(kept.map((b) => [b.name, b.rounds]), s.id).toEqual(full.map((b) => [b.name, b.rounds]));
    }
  });

  it('drops Saturday\'s sprints, keeps the pumps, carries and the primer', () => {
    const daily = getRehabSession('daily');
    const u = applyUnchecked(daily);
    for (const v of [0, 1, 2]) {
      const q = buildStepQueue(u, {}, v);
      expect(q.some((st) => /^Sprints/.test(st.piece || '')), `v${v}`).toBe(false);
      expect(q.some((st) => st.exId === 'mcgill-curlup'), `v${v}`).toBe(true);
    }
    expect(buildStepQueue(u, {}, 2).some((st) => st.exId === 'farmer-carry')).toBe(true);
    expect(buildStepQueue(u, {}, 0).some((st) => st.blockLabel === 'Arms')).toBe(true);
  });
});
