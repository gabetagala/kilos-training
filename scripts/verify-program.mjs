// Standing audit of BLOCK-01 against Gabe's stated goals and restrictions.
//
//   node scripts/verify-program.mjs
//
// Exits non-zero if anything fails, so it can gate a deploy. Every check runs
// across ALL 12 weeks, ALL phases, ALL finisher variants and ALL piece formats
// — because a rule that only holds in week 1 isn't a rule.
//
// The restrictions come from CLAUDE.md, TRAINING.md's IRON RULES, and the
// spine-safety research recorded in BLOCK-01.md §7.

import {
  BENCHMARK_SESSIONS,
  DENSITY40_SESSIONS,
  PROGRAM_EXERCISES,
  WEEK_PLAN,
  getProgramSession,
} from '../src/workout/program.js';
import {
  BLOCK_WEEKS,
  OPEN_PACE_BANNED,
  applyFormats,
  applyPhase,
  phaseOf,
  phaseSwaps,
  testsForWeek,
} from '../src/workout/block.js';
import {
  REHAB_EXERCISES,
  buildStepQueue,
  estimateSessionMins,
  getRehabSession,
  sessionVariantCount,
} from '../src/workout/rehab.js';

const results = [];
const check = (area, name, pass, detail = '') =>
  results.push({ area, name, pass, detail });

// Every (week → session → fully-resolved queue) the athlete can actually meet.
function* allQueues() {
  for (let w = 1; w <= BLOCK_WEEKS; w++) {
    const ph = phaseOf(w);
    const sw = phaseSwaps(ph);
    for (const item of WEEK_PLAN.flat()) {
      let s = null;
      if (item.type === 'lift') {
        s = applyFormats(applyPhase(getProgramSession(item.session), ph), w);
      } else if (item.type === 'rehab') {
        s = getRehabSession(item.session || 'daily');
      }
      if (!s) continue;
      const v = sessionVariantCount(s) > 1 ? w - 1 : 0;
      yield { w, s, q: buildStepQueue(s, sw, v) };
    }
  }
}

// ── RESTRICTIONS ────────────────────────────────────────────────────────────

// The movements that are contraindicated outright for lumbar DDD: loaded or
// dynamic spinal flexion, every one of which gets worse with fatigue.
const NEVER = [
  'thruster', 'wall-ball', 'ghd', 'sit-up', 'toes-to-bar', 'burpee',
  'kipping', 'snatch', 'power-clean', 'row-erg', 'rower', 'box-jump',
  'good-morning', 'russian-twist',
];
{
  const known = { ...PROGRAM_EXERCISES, ...REHAB_EXERCISES };
  const hits = Object.keys(known).filter((id) =>
    NEVER.some((bad) => id.includes(bad)),
  );
  check(
    'RESTRICTIONS',
    'no contraindicated movement exists in the program at all',
    hits.length === 0,
    hits.join(', '),
  );
}

// Fatigue converts a neutral-spine movement into a flexed one — measurably,
// involuntarily, at loads well below maximal. So the spine-loaded lifts never
// go on a clock, in any format, in any week.
const SPINE_LOADED = [
  'rdl', 'front-squat', 'rfe-split-squat', 'floor-press', 'pull-up',
  'db-split-squat', 'incline-db-press', 'db-floor-press',
];
{
  const bad = [];
  for (const { w, s, q } of allQueues()) {
    for (const st of q) {
      const onClock = st.emom || st.amrap || st.piece;
      if (onClock && SPINE_LOADED.includes(st.exId)) {
        bad.push(`wk${w} ${s.id} ${st.exId}`);
      }
    }
  }
  check(
    'RESTRICTIONS',
    'no spine-loaded lift is ever put on a clock',
    bad.length === 0,
    bad.slice(0, 3).join(', '),
  );
}

// A self-paced clock removes the rest floor that makes EMOM the safe default.
{
  const bad = [];
  for (let w = 1; w <= BLOCK_WEEKS; w++) {
    for (const s of DENSITY40_SESSIONS) {
      const shaped = applyFormats(applyPhase(s, phaseOf(w)), w);
      for (const b of shaped.blocks) {
        if (b.mode !== 'fortime') continue;
        for (const m of b.members || []) {
          if (OPEN_PACE_BANNED.includes(m.ex)) bad.push(`wk${w} ${s.id} ${m.ex}`);
        }
      }
    }
  }
  check(
    'RESTRICTIONS',
    'self-paced pieces never contain a movement that needs forced rest',
    bad.length === 0,
    bad.slice(0, 3).join(', '),
  );
}

// One spine-relevant heavy lift per session, FIRST, straight sets, long rests.
{
  const ANCHORS = ['pull-up', 'front-squat', 'floor-press'];
  const bad = [];
  for (const { w, s, q } of allQueues()) {
    if (!s.id.startsWith('d40')) continue;
    const anchorSteps = q.filter(
      (st) => ANCHORS.includes(st.exId) && st.countsAsSet,
    );
    if (!anchorSteps.length) continue;
    if (new Set(anchorSteps.map((st) => st.exId)).size > 1) {
      bad.push(`wk${w} ${s.id}: more than one anchor`);
    }
    const firstWork = q.findIndex((st) => st.kind === 'work');
    const firstAnchor = q.indexOf(anchorSteps[0]);
    // only the ramp may precede the anchor
    const before = q.slice(firstWork, firstAnchor).filter((st) => st.countsAsSet);
    if (before.length) bad.push(`wk${w} ${s.id}: ${before.length} sets before the anchor`);
    if (anchorSteps.some((st) => st.piece || st.emom)) {
      bad.push(`wk${w} ${s.id}: anchor on a clock`);
    }
  }
  check(
    'RESTRICTIONS',
    'one anchor per session, first, and never supersetted',
    bad.length === 0,
    bad.slice(0, 3).join('; '),
  );
}

// Rest between anchor sets — TRAINING.md IRON RULE 2 says >= 2:00.
{
  const bad = [];
  for (const s of DENSITY40_SESSIONS) {
    for (const b of s.blocks) {
      if (b.mode !== 'lift') continue;
      if (!['pull-up', 'front-squat', 'floor-press'].includes(b.ex)) continue;
      if ((b.restSecs ?? 0) < 120) bad.push(`${s.id} ${b.ex} ${b.restSecs}s`);
    }
  }
  check('RESTRICTIONS', 'anchors rest at least 2:00 between sets', bad.length === 0, bad.join(', '));
}

// Asymmetry rule: the right (smaller) side always leads.
{
  const bad = [];
  for (const { w, s, q } of allQueues()) {
    const seen = new Map();
    for (const st of q) {
      if (!st.side || st.kind !== 'work') continue;
      if (!seen.has(st.exId)) seen.set(st.exId, st.side);
    }
    for (const [ex, side] of seen) {
      // LEFT-first is only allowed where the block declares no explicit side
      // (the engine's default per-side order); anything the program names a
      // side for must start RIGHT.
      const named = DENSITY40_SESSIONS.flatMap((x) => x.blocks).some((b) =>
        (b.members || []).some((m) => m.ex === ex && m.side),
      );
      if (named && side !== 'RIGHT') bad.push(`wk${w} ${s.id} ${ex} starts ${side}`);
    }
  }
  check('RESTRICTIONS', 'named unilateral work starts on the right side', bad.length === 0, bad.slice(0, 3).join(', '));
}

// Session length — his stated ceiling.
{
  const rehabMins = estimateSessionMins(getRehabSession('daily'));
  let longest = 0;
  let where = '';
  for (let w = 1; w <= BLOCK_WEEKS; w++) {
    for (const item of WEEK_PLAN.flat()) {
      if (item.type !== 'lift') continue;
      const s = applyFormats(applyPhase(getProgramSession(item.session), phaseOf(w)), w);
      const mins = estimateSessionMins(s, sessionVariantCount(s) > 1 ? w - 1 : 0) + rehabMins;
      if (mins > longest) {
        longest = mins;
        where = `wk${w} ${s.name}`;
      }
    }
  }
  check('RESTRICTIONS', 'no day exceeds the 45-minute ceiling', longest <= 45, `longest ${longest} min (${where})`);
  check('RESTRICTIONS', 'the daily rehab stays at 10 minutes', rehabMins <= 11, `${rehabMins} min, identical every day`);
}

// ── GOALS ───────────────────────────────────────────────────────────────────
const MAP = {
  'pull-up': { lats: 1, biceps: 0.5, forearm: 0.5 },
  'pull-up-bw': { lats: 1, biceps: 0.5, forearm: 0.5 },
  'lat-pulldown': { lats: 1, biceps: 0.5 },
  'cable-row-1arm': { upperback: 1, biceps: 0.5, reardelt: 0.5 },
  'chest-supported-row': { upperback: 1, biceps: 0.5, reardelt: 0.5 },
  'db-lateral-raise': { sidedelt: 1 },
  'band-lateral-raise': { sidedelt: 1 },
  'cable-lateral-raise': { sidedelt: 1 },
  'band-pull-apart': { reardelt: 1, upperback: 0.5 },
  'face-pull': { reardelt: 1, upperback: 0.5 },
  'floor-press': { chest: 1, triceps: 0.5, frontdelt: 0.5 },
  'elevated-pushup': { chest: 1, triceps: 0.5 },
  'push-up': { chest: 1, triceps: 0.5 },
  'band-fly': { chest: 1 },
  'cable-fly-low': { chest: 1 },
  'rope-pushdown': { triceps: 1 },
  'overhead-triceps': { triceps: 1 },
  'hammer-curl': { biceps: 1, forearm: 0.5 },
  'supinated-curl': { biceps: 1 },
  'reverse-curl': { biceps: 1, forearm: 0.5 },
  'front-squat': { quads: 1, glutes: 0.5 },
  'rfe-split-squat': { quads: 1, glutes: 1 },
  'box-squat': { quads: 1, glutes: 0.5 },
  'box-step-up': { quads: 1, glutes: 0.5 },
  rdl: { hams: 1, glutes: 1, upperback: 0.5 },
  'single-leg-bridge': { glutes: 1, hams: 0.5 },
  'suitcase-carry': { obliques: 1, forearm: 1, sidedelt: 0.5 },
  'farmer-carry': { forearm: 1, upperback: 0.5 },
  'wrist-curl': { forearm: 1 },
  'reverse-wrist-curl': { forearm: 1 },
  'side-plank': { obliques: 1 },
};
const MEV = 4;
const WASTEFUL = 30;
const EXPECTED_LOW = new Set(['frontdelt']);

// THE DAILY REHAB IS NOT HYPERTROPHY VOLUME, and counting it as such is a
// category error the first version of this audit made: it reported obliques at
// 42 sets/week and failed the program.
//
// The McGill Big 3 are 10-SECOND isometric holds, dosed 7x/week, explicitly
// never taken near fatigue — McGill's own rule is "keep the duration of
// isometric exercises under 10 seconds and build endurance with repetitions."
// That's a motor-control and endurance stimulus, not a growth one, and the
// fractional-set model (Pelland et al.) describes hypertrophy-directed working
// sets. Four 10s braces a day is medicine; it is not 28 sets of oblique work.
const HYPERTROPHY_EXEMPT = new Set(['daily']);

const weekVol = [];
for (let w = 1; w <= BLOCK_WEEKS; w++) {
  const t = {};
  for (const { w: ww, s, q } of allQueues()) {
    if (ww !== w || HYPERTROPHY_EXEMPT.has(s.id)) continue;
    for (const st of q) {
      if (st.kind !== 'work' || !st.countsAsSet || st.phase === 'RAMP') continue;
      for (const [m, f] of Object.entries(MAP[st.exId] || {})) t[m] = (t[m] || 0) + f;
    }
  }
  weekVol.push(t);
}
const muscles = [...new Set(weekVol.flatMap(Object.keys))];
{
  const under = [];
  const over = [];
  for (const m of muscles) {
    if (EXPECTED_LOW.has(m)) continue;
    weekVol.forEach((v, i) => {
      if ((v[m] || 0) < MEV) under.push(`${m} wk${i + 1}=${v[m] || 0}`);
      if ((v[m] || 0) >= WASTEFUL) over.push(`${m} wk${i + 1}=${v[m]}`);
    });
  }
  check('GOALS', 'every muscle is above MEV in every one of the 12 weeks', under.length === 0, under.slice(0, 3).join(', '));
  check('GOALS', 'no muscle is pushed into the wasteful band', over.length === 0, over.slice(0, 3).join(', '));
}
{
  const avg = (m, ws) => ws.reduce((a, i) => a + (weekVol[i - 1][m] || 0), 0) / ws.length;
  const p1 = [1, 2, 3, 4];
  const p3 = [9, 10, 11, 12];
  const latsUp = avg('lats', p3) > avg('lats', p1);
  const quadsUp = avg('quads', p3) > avg('quads', p1);
  check('GOALS', 'lats rise across the block (the V-taper gap closes)', latsUp, `${avg('lats', p1).toFixed(1)} → ${avg('lats', p3).toFixed(1)}`);
  check('GOALS', 'quads rise across the block (the other gap closes)', quadsUp, `${avg('quads', p1).toFixed(1)} → ${avg('quads', p3).toFixed(1)}`);
}
{
  // athletic / powerful — the primer must survive every week
  const perWeek = [];
  for (let w = 1; w <= BLOCK_WEEKS; w++) {
    let n = 0;
    for (const { w: ww, q } of allQueues()) {
      if (ww !== w) continue;
      if (q.some((st) => ['broad-jump', 'power-pushup', 'pogo-hop'].includes(st.exId))) n += 1;
    }
    perWeek.push(n);
  }
  check('GOALS', 'the power primer runs twice a week, every week', perWeek.every((n) => n === 2), `sessions/wk: ${[...new Set(perWeek)].join(',')}`);
}
{
  const hasEngine = !!getRehabSession('engine');
  const tested = [1, 4, 6, 8, 12].every((w) => testsForWeek(w).length > 0);
  check('GOALS', 'a conditioning session exists and the block is tested', hasEngine && tested, `engine ${hasEngine ? 'yes' : 'no'}, tests wk 1/4/6/8/12`);
}
{
  // the tests must be safe to actually max on
  const SAFE = new Set(['box-step-up', 'box-squat', 'push-up', 'pull-up-bw', 'farmer-carry']);
  const bad = [];
  for (const b of BENCHMARK_SESSIONS) {
    for (const st of buildStepQueue(b)) if (!SAFE.has(st.exId)) bad.push(`${b.id}/${st.exId}`);
  }
  check('GOALS', 'every benchmark movement fails somewhere that is not the spine', bad.length === 0, bad.join(', '));
}

// ── THE FUN PART ────────────────────────────────────────────────────────────
{
  const names = new Set();
  for (const item of WEEK_PLAN.flat()) {
    if (item.type === 'lift') names.add(getProgramSession(item.session).name);
  }
  check('VARIETY', 'six distinct sessions — no two days in a week repeat', names.size === 6, [...names].join(' · '));
}
{
  const sig = (w) => {
    const out = [];
    for (const { w: ww, q } of allQueues()) {
      if (ww !== w) continue;
      for (const st of q) {
        if (st.kind !== 'work') continue;
        out.push(`${st.exId}|${st.reps ?? st.secs}|${st.piece ?? ''}|${st.pieceFormat ?? ''}|${st.manual ? 'p' : 'c'}`);
      }
    }
    return out;
  };
  const sigs = [...Array(BLOCK_WEEKS)].map((_, i) => sig(i + 1));
  const pcts = [];
  for (let i = 1; i < sigs.length; i++) {
    const prev = new Set(sigs[i - 1]);
    pcts.push(sigs[i].filter((x) => !prev.has(x)).length / sigs[i].length);
  }
  const avg = Math.round((pcts.reduce((a, b) => a + b, 0) / pcts.length) * 100);
  check('VARIETY', 'every week feels meaningfully different from the last', avg >= 15, `${avg}% new week-to-week`);
}
{
  const fins = new Set();
  const fmts = new Set();
  for (const { s, q } of allQueues()) {
    if (sessionVariantCount(s) > 1) fins.add(q.at(-1).piece);
    for (const st of q) if (st.pieceFormat) fmts.add(st.pieceFormat.replace(/\d+/g, 'N'));
  }
  check('VARIETY', 'the finisher and format pools are genuinely deep', fins.size >= 5 && fmts.size >= 4, `${fins.size} finishers · ${fmts.size} formats`);
}

// ── Report ──────────────────────────────────────────────────────────────────
let failed = 0;
let area = '';
for (const r of results) {
  if (r.area !== area) {
    area = r.area;
    console.log(`\n${area}`);
  }
  if (!r.pass) failed += 1;
  console.log(`  ${r.pass ? '✓' : '✗ FAIL'}  ${r.name}${r.detail ? `\n         ${r.detail}` : ''}`);
}
console.log(
  failed
    ? `\n${failed} CHECK(S) FAILED\n`
    : `\nALL ${results.length} CHECKS PASS — across 12 weeks, 3 phases, 6 finishers and 3 formats.\n`,
);
process.exit(failed ? 1 : 0);
