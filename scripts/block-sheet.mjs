// Generates the BLOCK-01 at-a-glance sheet (HTML + CSV) from the LIVE program
// data, so it can never drift from what the app actually serves.
//
//   node scripts/block-sheet.mjs [YYYY-MM-DD] [outDir]
//
// Defaults: next Monday, ~/Downloads.
//
// Everything here is DERIVED, never retyped: the volume steps, the rotation
// and the test calendar all come from src/workout/block.js and the session
// data; the muscle map comes from src/workout/volume.js — the SAME map the
// verifier audits against, so the sheet can never drift from the audit.
//
// Volume is counted FRACTIONALLY (direct set 1.0, indirect 0.5) per Pelland
// et al. 2025 — the same accounting BLOCK-01.md is audited against.

import { writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  BENCHMARK_SESSIONS,
  WEEK_PLAN,
  getProgramSession,
} from '../src/workout/program.js';
import {
  BLOCK_WEEKS,
  PHASE_NAMES,
  applyFormats,
  applyPhase,
  isDeloadCheckpoint,
  phaseOf,
  phaseSwaps,
  testsForWeek,
} from '../src/workout/block.js';
import {
  EXPECTED_LOW,
  HYPERTROPHY_EXEMPT,
  MEV,
  MUSCLE_MAP as MAP,
  OPTIONAL_SESSIONS,
  WASTEFUL,
} from '../src/workout/volume.js';
import {
  buildStepQueue,
  estimateSessionSecs,
  getRehabSession,
  sessionOverview,
  sessionVariantCount,
} from '../src/workout/rehab.js';

// Pelland efficiency tiers for hypertrophy (smallest detectable effect 2.05%).
const tier = (v) =>
  v < MEV ? 'under' : v <= 10 ? 'high' : v <= 18 ? 'mid' : v < WASTEFUL ? 'low' : 'waste';

const MUSCLES = [
  ['lats', 'Lats'],
  ['sidedelt', 'Side delt'],
  ['chest', 'Chest'],
  ['upperback', 'Upper back'],
  ['quads', 'Quads'],
  ['glutes', 'Glutes'],
  ['hams', 'Hams'],
  ['biceps', 'Biceps'],
  ['triceps', 'Triceps'],
  ['reardelt', 'Rear delt'],
  ['forearm', 'Forearm'],
  ['obliques', 'Obliques'],
  ['frontdelt', 'Front delt'],
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Rotation is anchored to the BLOCK WEEK (main.js does the same), so this
// sheet stays correct even if a week gets missed.
const variantFor = (session, week) =>
  sessionVariantCount(session) > 1 ? week - 1 : 0;

// Everything a day serves, split the way the session is actually structured:
// PART A is the quality work off the clock and PART B is the piece(s) on it.
// (There is no finisher any more — the last round of every piece carries the
// empty-the-tank note instead of a second clock.)
function dayPlan(sessionId, week, isRehabSession = false) {
  const phase = phaseOf(week);
  const base = isRehabSession
    ? getRehabSession(sessionId)
    : getProgramSession(sessionId);
  const s = applyFormats(applyPhase(base, phase), week);
  const v = variantFor(s, week);
  const rows = sessionOverview(s, phaseSwaps(phase), v);
  return {
    name: s.name,
    focus: (s.freq || '').split('·')[1]?.trim() || '',
    mins: Math.round(estimateSessionSecs(s, v) / 60),
    partA: rows.filter((r) => !r.piece),
    partB: rows.filter((r) => r.piece),
  };
}

// The volume table is the FLOOR — required days only, matching the verifier.
// Sunday's optional extras (Open Up, The Long Way) are shown on the day rows
// but never counted here, because counting them describes a week he might
// not train.
function weekVolume(week) {
  const phase = phaseOf(week);
  const swaps = phaseSwaps(phase);
  const tot = {};
  const add = (steps) => {
    for (const st of steps) {
      if (st.kind !== 'work' || !st.countsAsSet || st.phase === 'RAMP') continue;
      for (const [m, f] of Object.entries(MAP[st.exId] || {})) {
        tot[m] = (tot[m] || 0) + f;
      }
    }
  };
  for (const item of WEEK_PLAN.flat()) {
    if (item.type === 'lift') {
      const s = applyFormats(applyPhase(getProgramSession(item.session), phase), week);
      add(buildStepQueue(s, swaps, variantFor(s, week)));
    } else if (
      item.type === 'rehab' &&
      item.session &&
      !OPTIONAL_SESSIONS.has(item.session) &&
      !HYPERTROPHY_EXEMPT.has(item.session)
    ) {
      add(buildStepQueue(getRehabSession(item.session), swaps));
    }
  }
  return tot;
}

const mondayOf = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
};
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtDate = (d) => `${d.getDate()} ${MONTHS[d.getMonth()]}`;

// ── Build the model ─────────────────────────────────────────────────────────
const startArg = process.argv[2];
const outDir = process.argv[3] || join(homedir(), 'Downloads');
const start = mondayOf(startArg ? new Date(startArg) : new Date());
if (!startArg) start.setDate(start.getDate() + 7); // next Monday

const weeks = [];
for (let w = 1; w <= BLOCK_WEEKS; w++) {
  const monday = new Date(start);
  monday.setDate(start.getDate() + (w - 1) * 7);
  const days = [];
  for (const offset of [1, 2, 3, 4, 5, 6, 0]) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + ((offset + 6) % 7));
    const items = WEEK_PLAN[offset];
    const lift = items.find((i) => i.type === 'lift');
    if (lift) {
      // A lift day is a lift day. Nothing is stacked on it any more, so its
      // minutes are its own — adding the rehab here overstated every one.
      days.push({ day: DAY_NAMES[offset], date: d, ...dayPlan(lift.session, w) });
    } else {
      // A rehab day: the 48-minute back program. Sunday additionally offers
      // Open Up and The Long Way, both explicitly optional.
      const p = dayPlan('daily', w, true);
      const extras = items
        .filter((i) => i.type === 'rehab' && i.session)
        .map((i) => dayPlan(i.session, w, true));
      days.push({
        day: DAY_NAMES[offset],
        date: d,
        ...p,
        focus: extras.length ? 'the back program + the easy day' : 'the back program',
        partB: extras.map((e) => ({
          title: `${e.name} — optional`,
          detail: `${e.mins} min`,
          members: e.partA.map((r) => ({ name: r.title, detail: r.detail })),
        })),
      });
    }
  }
  weeks.push({ w, monday, days, vol: weekVolume(w), tests: testsForWeek(w) });
}

const testName = (id) => BENCHMARK_SESSIONS.find((b) => b.id === id)?.name || id;
const movesOf = (row) =>
  (row.members || []).map((m) => `${m.name}${m.detail ? ` ${m.detail}` : ''}`).join(' · ');

// ── CSV ─────────────────────────────────────────────────────────────────────
const q = (s) => `"${String(s).replace(/"/g, '""')}"`;
const csv = [];
csv.push(q('KILOS — BLOCK 01 · 12 weeks · Armored V-Taper'));
csv.push(q(`Starts ${fmtDate(start)} ${start.getFullYear()}. Mon/Wed/Fri lift — one continuous clock per day. The other four days are the 48-min Lower Back & Hips program. Nothing is stacked.`));
csv.push('');
csv.push(['Week', 'Phase', 'Day', 'Date', 'Session', 'Part A — quality', 'Part B — the piece', 'Min', 'Test'].map(q).join(','));
for (const wk of weeks) {
  for (const d of wk.days) {
    csv.push(
      [
        wk.w,
        PHASE_NAMES[phaseOf(wk.w)],
        d.day,
        fmtDate(d.date),
        d.name,
        d.partA.map((r) => `${r.title} ${r.detail}`).join(' | '),
        d.partB.map((r) => `${r.title} (${r.detail}): ${movesOf(r)}`).join(' | '),
        d.mins,
        d.day === 'Sun' && wk.tests.length ? wk.tests.map(testName).join(' + ') : '',
      ]
        .map(q)
        .join(','),
    );
  }
}
csv.push('');
csv.push(q('WEEKLY VOLUME — fractional sets (direct 1.0, indirect 0.5). MEV 4, wasteful 30+.'));
csv.push(['Week', 'Phase', ...MUSCLES.map(([, l]) => l), 'Verdict'].map(q).join(','));
for (const wk of weeks) {
  const bad = MUSCLES.filter(
    ([k]) => !EXPECTED_LOW.has(k) && ((wk.vol[k] || 0) < MEV || (wk.vol[k] || 0) >= WASTEFUL),
  );
  csv.push(
    [
      wk.w,
      PHASE_NAMES[phaseOf(wk.w)],
      ...MUSCLES.map(([k]) => Math.round((wk.vol[k] || 0) * 10) / 10),
      bad.length ? bad.map(([, l]) => l).join('; ') : 'all in range',
    ]
      .map(q)
      .join(','),
  );
}
writeFileSync(join(outDir, 'kilos-block-01.csv'), csv.join('\n'), 'utf8');

// ── HTML ────────────────────────────────────────────────────────────────────
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const cell = (k, v) => {
  const t = tier(v);
  const cls = EXPECTED_LOW.has(k)
    ? 'exp'
    : t === 'under' || t === 'waste'
      ? 'bad'
      : t === 'low'
        ? 'warn'
        : 'ok';
  return `<td class="n ${cls}">${Math.round(v * 10) / 10}</td>`;
};

const dayCell = (d) => `
  <td class="sess">
    <div class="sess-name">${esc(d.name)}<span class="sess-min">${d.mins} min</span></div>
    ${d.partA.length ? `<div class="part"><span class="tag">A</span>${d.partA.map((r) => `<span class="mv">${esc(r.title)} <b>${esc(r.detail)}</b></span>`).join('')}</div>` : ''}
    ${d.partB
      .map(
        (r) =>
          `<div class="part"><span class="tag tagb">B</span><span class="pc">${esc(r.title)} · ${esc(r.detail)}</span>${
            r.members?.length ? `<span class="mvs">${r.members.map((m) => `${esc(m.name)}${m.detail ? ` <b>${esc(m.detail)}</b>` : ''}`).join(' · ')}</span>` : ''
          }</div>`,
      )
      .join('')}
  </td>`;

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>KILOS · Block 01</title>
<style>
  :root{--ink:#191919;--mute:#6b6b6b;--line:#e4e4e4;--accent:#c8442a;--b:#2f6fb2}
  *{box-sizing:border-box}
  body{margin:0;padding:30px;font:13.5px/1.45 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:var(--ink);background:#fff}
  h1{font-size:22px;letter-spacing:.14em;margin:0 0 3px;text-transform:uppercase}
  h2{font-size:11.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--mute);margin:30px 0 9px;border-bottom:1px solid var(--line);padding-bottom:6px}
  .sub{color:var(--mute);margin:0 0 4px;font-size:13px}
  table{border-collapse:collapse;width:100%;font-size:12px}
  th,td{border:1px solid var(--line);padding:5px 7px;text-align:left;vertical-align:top}
  th{background:#f6f6f6;font-weight:600;font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:#444}
  td.n{text-align:right;font-variant-numeric:tabular-nums;width:46px}
  .ok{background:#eaf6ec}.warn{background:#fdf4e3}.bad{background:#fbe9e7;font-weight:700}.exp{background:#f4f4f4;color:var(--mute)}
  .wk{background:#efefef;font-weight:700;font-size:12px}
  .day{color:var(--mute);width:34px;font-weight:600}
  .dt{color:var(--mute);width:52px;font-size:11px}
  .sess-name{font-weight:700;margin-bottom:3px}
  .sess-min{float:right;color:var(--mute);font-weight:400;font-size:11px}
  .part{margin:2px 0 0;padding-left:20px;position:relative;line-height:1.5}
  .tag{position:absolute;left:0;top:1px;display:inline-block;width:15px;height:15px;line-height:15px;text-align:center;border-radius:3px;font-size:9.5px;font-weight:700;color:#fff;background:#777}
  .tagb{background:var(--b)}
  .mv{display:inline-block;margin-right:12px;color:#333}
  .mv b{font-weight:600;color:#000}
  .pc{font-weight:600;color:var(--b)}
  .mvs{display:block;color:#666;font-size:11px}
  .mvs b{color:#333}
  .test{color:var(--accent);font-weight:700}
  .legend{font-size:11px;color:var(--mute);margin-top:8px}
  .legend span{display:inline-block;margin-right:14px}
  .sw{display:inline-block;width:10px;height:10px;border:1px solid var(--line);vertical-align:-1px;margin-right:4px}
  .note{background:#f8f8f8;border-left:3px solid var(--accent);padding:10px 12px;margin:13px 0;font-size:12.5px;line-height:1.5}
  @media print{body{padding:0;font-size:10px}h2{margin-top:16px}.pb{page-break-before:always}}
</style></head><body>

<h1>Kilos · Block 01</h1>
<p class="sub"><strong>12 weeks · “Armored V-Taper”.</strong> ${fmtDate(start)} ${start.getFullYear()} → ${fmtDate(new Date(start.getTime() + 83 * 864e5))}.</p>
<p class="sub"><strong>Mon / Wed / Fri</strong> lift — full body, on a clock. <strong>Tue / Thu / Sat / Sun</strong> are the 48-minute Lower Back &amp; Hips program. Nothing is stacked on anything; times are all-in.</p>
<p class="sub">Each lift day is <strong>two clocks</strong>, read top to bottom. THE ANCHOR runs <strong>E2M or E3M</strong> (a heavy set per interval — the interval is the rest, and the build rounds ride the same clock); THE PIECE is <strong>one EMOM to the end</strong>: a minute per station, a minute off between trips, hinge and cardio inside it. Every slot rotates on a four-week cycle, so no session repeats inside a month, and every other week the piece runs its reps descending.</p>
<p class="legend" style="margin-top:10px">
<span><i class="tag" style="position:static">A</i> the rehab days — positional holds, no clock pressure</span>
<span><i class="tag tagb" style="position:static">B</i> on the clock — read top to bottom, it is one running session</span>
</p>

<h2>The 12 weeks — exact sessions</h2>
<table>
<tr><th>Day</th><th>Date</th><th>Session</th></tr>
${weeks
  .map(
    (wk) =>
      `<tr class="wk"><td colspan="3">WEEK ${wk.w} · ${PHASE_NAMES[phaseOf(wk.w)]} (phase ${phaseOf(wk.w)}) · w/c ${fmtDate(wk.monday)}${
        wk.tests.length ? ` · <span class="test">TEST WEEK: ${wk.tests.map(testName).join(' + ')}</span>` : ''
      }${isDeloadCheckpoint(wk.w) ? ' · <span class="test">DELOAD CHECKPOINT</span>' : ''}${
        wk.w === 5 ? ' · phase 2 begins: the pull anchor steps to 5 rounds' : ''
      }${wk.w === 9 ? ' · phase 3 begins: the squat anchor steps to 5 rounds' : ''}</td></tr>` +
      wk.days
        .map((d) => `<tr><td class="day">${d.day}</td><td class="dt">${fmtDate(d.date)}</td>${dayCell(d)}</tr>`)
        .join(''),
  )
  .join('')}
</table>

<h2 class="pb">Weekly volume — is it hitting the numbers?</h2>
<p class="sub">Fractional sets per week: a direct set counts 1.0, an indirect set 0.5
(Pelland et al. 2025, 67 studies). <strong>MEV = 4</strong> · efficient 5–18 ·
diminishing 19–29 · <strong>wasteful 30+</strong>.</p>
<table>
<tr><th>Wk</th><th>Phase</th>${MUSCLES.map(([, l]) => `<th>${l}</th>`).join('')}<th>Verdict</th></tr>
${weeks
  .map((wk) => {
    const bad = MUSCLES.filter(
      ([k]) => !EXPECTED_LOW.has(k) && ((wk.vol[k] || 0) < MEV || (wk.vol[k] || 0) >= WASTEFUL),
    );
    return `<tr><td class="n">${wk.w}</td><td>${PHASE_NAMES[phaseOf(wk.w)]}</td>${MUSCLES.map(([k]) => cell(k, wk.vol[k] || 0)).join('')}<td class="${bad.length ? 'bad' : 'ok'}">${bad.length ? bad.map(([, l]) => l).join(', ') : 'all in range'}</td></tr>`;
  })
  .join('')}
</table>
<p class="legend">
<span><i class="sw ok"></i>productive band</span>
<span><i class="sw warn"></i>19–29 · diminishing</span>
<span><i class="sw bad"></i>below MEV or wasteful</span>
<span><i class="sw exp"></i>low on purpose</span>
</p>

<div class="note">
<strong>Front delt sits low every week by design</strong> — its MEV is ~0 because every
press saturates it. It's the only muscle under MEV, and that's intentional.
<br><br>
<strong>Phase 2 (week 5) steps the pull anchor to 5 working rounds</strong> and
<strong>phase 3 (week 9) steps the squat anchor to 5</strong> — one more heavy interval,
nothing else changes. The app applies these automatically; you don't have to do anything.
<br><br>
<strong>The volume table is the floor</strong> — Sunday's optional Open Up and The Long Way
are listed on the day rows but never counted, so these numbers describe the week you'll
actually train, not the best case.
</div>

<div class="note">
<strong>Rotation is anchored to the block week, not to how many sessions you've
done</strong> — so a missed week can't desync this sheet from the app. Everything above is
generated from the live program data by <code>scripts/block-sheet.mjs</code>; rerun it
after any change and it's correct again.
</div>

</body></html>`;
writeFileSync(join(outDir, 'kilos-block-01.html'), html, 'utf8');

console.log(`Wrote:\n  ${join(outDir, 'kilos-block-01.html')}\n  ${join(outDir, 'kilos-block-01.csv')}`);
const w1 = weeks[0];
console.log(`\nWeek 1 Monday — ${w1.days[0].name}:`);
console.log(`  A: ${w1.days[0].partA.map((r) => `${r.title} ${r.detail}`).join(' | ')}`);
console.log(`  B: ${w1.days[0].partB.map((r) => `${r.title} (${r.detail}) ${movesOf(r)}`).join(' | ')}`);
