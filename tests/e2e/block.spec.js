import { expect, test } from '@playwright/test';
import { checkInGood, dismissOnboarding } from './helpers.js';

// BLOCK 01 — the app knowing what week it is. Everything in BLOCK-01.md used
// to be a document you obeyed by hand; these guard that it now runs itself.

async function openProgram(page, { startWeeksAgo = 0, history = [] } = {}) {
  await page.addInitScript(
    ({ weeks, hist }) => {
      const m = new Date();
      m.setHours(0, 0, 0, 0);
      m.setDate(m.getDate() - ((m.getDay() + 6) % 7) - weeks * 7);
      localStorage.setItem('kilos-block-start', JSON.stringify(m.toISOString()));
      // mark the one-time v1->v2 start-date migration as already done, so it
      // can't move the date these tests deliberately set
      localStorage.setItem('kilos-block-seed-v2', 'true');
      // A block only counts as begun once something has been trained against
      // it — otherwise the app assumes the start date was never really used
      // and moves it to the next Monday. Seed one session on the start date.
      const seed = { name: 'Pull', type: 'strength', programId: 'd40-a1',
        date: new Date(m.getTime() + 36e5).toISOString(), duration: '30 min',
        totalWeight: 0, sets: 4, newPRs: [], exercises: [] };
      localStorage.setItem('workoutHistory', JSON.stringify(hist.length ? hist : [seed]));
    },
    { weeks: startWeeksAgo, hist: history },
  );
  await page.goto('/');
  await dismissOnboarding(page);
  await page.locator('.nav-btn[data-screen="train"]').click();
  await page.locator('#btn-rehab-open').click();
}

test('the app knows what week and phase it is in', async ({ page }) => {
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await openProgram(page, { startWeeksAgo: 0 });
  await expect(page.locator('.blk-name')).toContainText('WK 1/12');
  await expect(page.locator('.blk-phase')).toContainText('BUILD');
  await expect(page.locator('.blk-flag')).toContainText('TEST WEEK');
  console.log('WK1 BANNER:', (await page.locator('.blk').textContent())?.replace(/\s+/g, ' ').trim());
  expect(errors).toEqual([]);
});

test('week 6 is phase 2 and serves that week of the rotation', async ({ page }) => {
  await openProgram(page, { startWeeksAgo: 5 });
  await expect(page.locator('.blk-name')).toContainText('WK 6/12');
  await expect(page.locator('.blk-phase')).toContainText('PRESS');
  // Friday's bodyweight work steps in REPS by block WEEK: ring dips
  // (5,5,6,6,6,7… → week 6 = 7) and, since round 2, the strict pull-ups too
  // (4,4,5,5,6,6… → week 6 = 6) — same sets, more reps.
  await page.locator('[data-d40="d40-c1"]').click();
  await page.locator('#sp-start').click();
  await page.locator('#rp-overview-btn').click();
  const rows = (await page.locator('#rpo-list').textContent())?.replace(/\s+/g, ' ');
  console.log('WK6 c1 overview:', rows?.slice(0, 400));
  expect(rows).toMatch(/Ring Dip\s*7/);
  expect(rows).toMatch(/Strict Pull-Up\s*6/);
});

// The anchor round steps are RETIRED (2026-08-11, EMOM40) — the only phase
// step left is Friday's pull-up reps. These prove phases leave anchors alone.
// Round 3: Monday's pull-ups run FIVE working sets, a lateral raise in each rest.
test('phases leave the pull anchor at five working rounds (EMOM40)', async ({ page }) => {
  await openProgram(page, { startWeeksAgo: 5 });
  await page.locator('[data-d40="d40-a1"]').click();
  await page.locator('#sp-start').click();
  await page.locator('#rp-overview-btn').click();
  const rows = (await page.locator('#rpo-list').textContent())?.replace(/\s+/g, ' ');
  console.log('WK6 a1 overview:', rows?.slice(0, 220));
  // bodyweight pull-ups: two-minute clock, no build rounds — and the anchor
  // round steps are retired (EMOM40): five working rounds in every phase,
  // the pair listed under the lift
  expect(rows).toContain('E2M 10 · 5 rounds');
  expect(rows).toMatch(/Strict Pull-Up\s*\d+\s*\+ DB Lateral Raise\s*12 in the rest/);
  expect(rows).not.toContain('to build');
});

test('phases leave the squat anchor at five total rounds (EMOM40)', async ({ page }) => {
  await openProgram(page, { startWeeksAgo: 9 }); // week 10
  await expect(page.locator('.blk-phase')).toContainText('PEAK');
  await page.locator('[data-d40="d40-b1"]').click();
  await page.locator('#sp-start').click();
  await page.locator('#rp-overview-btn').click();
  const rows = (await page.locator('#rpo-list').textContent())?.replace(/\s+/g, ' ');
  console.log('WK10 b1 overview:', rows?.slice(0, 200));
  // the squat runs on a 2:30 clock since round 2 (a ~20 s set still leaves
  // 2:10, over the 2:00 floor): one build round + four working sets
  expect(rows).toContain('E2:30 13 · 5 rounds (1 to build)');
});

test('the deload checkpoint asks at week 4 and does not impose', async ({ page }) => {
  await openProgram(page, { startWeeksAgo: 3 });
  await expect(page.locator('.blk-name')).toContainText('WK 4/12');
  // it surfaces itself — a checkpoint you must remember to find isn't one
  await expect(page.locator('#deload-check')).toHaveClass(/open/, { timeout: 3000 });
  await expect(page.locator('#deload-check')).toContainText('twice running');
  await page.locator('#deload-no').click();
  await expect(page.locator('#deload-check')).not.toHaveClass(/open/);
});

test('the progress view shows anchor trends and gates them on the noise floor', async ({ page }) => {
  // the three FIXED anchors since 2026-10-10: strict pull-up (reps), front
  // squat and incline DB press (load)
  const mk = (weeksAgo, exName, weight, reps) => {
    const d = new Date();
    d.setDate(d.getDate() - weeksAgo * 7);
    return {
      name: 'Lift', type: 'strength', programId: 'd40-b1', date: d.toISOString(),
      duration: '40 min', totalWeight: 0, sets: 4, newPRs: [],
      exercises: [{ name: exName, logs: [{ weight, reps, done: true }] }],
    };
  };
  // +10kg over 5 weeks — comfortably past the ~5% a real 1RM change must
  // clear; the bodyweight anchor charts a (body + pack) e1RM since round 2,
  // so 5 → 8 strict reps reads as a real strength gain in kilos
  const jump = (weeksAgo, cm) => ({ ...mk(weeksAgo, 'Front Squat', 0, 0), exercises: [], broadJump: cm });
  await openProgram(page, {
    startWeeksAgo: 5,
    history: [
      mk(5, 'Front Squat', 60, 5),
      mk(0, 'Front Squat', 70, 5),
      mk(5, 'Strict Pull-Up', 0, 5),
      mk(0, 'Strict Pull-Up', 0, 8),
      jump(5, 200),
      jump(0, 215),
    ],
  });
  const bp = page.locator('#block-progress');
  await expect(bp).toContainText('Front Squat');
  await expect(bp).toContainText('Strict Pull-Up');
  await expect(bp).toContainText('30° Incline DB Press');
  const txt = (await bp.textContent())?.replace(/\s+/g, ' ');
  console.log('PROGRESS:', txt?.slice(0, 260));
  expect(txt).toMatch(/Front Squat.*\+[\d.]+(kg|lbs) since wk 1/);
  expect(txt).toMatch(/Strict Pull-Up\s*[\d.]+\s*(kg|lbs)\s*e1RM\s*\+[\d.]+(kg|lbs) since wk 1/);
  expect(txt).not.toContain('reps since wk');
  // the Broad Jump row: the best jump he reports after each Wednesday
  await expect(bp).toContainText('Broad Jump');
  expect(txt).toMatch(/Broad Jump\s*215\s*cm/);
  expect(txt).toContain('+15 cm since wk 1');
  // the press has nothing logged — it says so instead of a fake zero
  expect(txt).toMatch(/30° Incline DB Press\s*—\s*no sets logged yet/);
  await expect(bp.locator('.spark').first()).toBeVisible();
  // untested benchmarks say so rather than showing a fake zero
  expect(txt).toContain('not tested yet');
});

test('a tiny gain reads as flat, not as progress', async ({ page }) => {
  const mk = (weeksAgo, weight) => {
    const d = new Date();
    d.setDate(d.getDate() - weeksAgo * 7);
    return {
      name: 'Squat', type: 'strength', programId: 'd40-b1', date: d.toISOString(),
      duration: '40 min', totalWeight: 0, sets: 4, newPRs: [],
      exercises: [{ name: 'Front Squat', logs: [{ weight, reps: 5, done: true }] }],
    };
  };
  // 60 -> 61.5kg is ~2.5%, inside 1RM measurement error
  await openProgram(page, { startWeeksAgo: 5, history: [mk(5, 60), mk(0, 61.5)] });
  const txt = (await page.locator('#block-progress').textContent())?.replace(/\s+/g, ' ');
  console.log('FLAT CASE:', txt?.slice(0, 160));
  expect(txt).toContain('flat — inside the noise');
});

test('Sunday now has a real engine session, not a checkbox', async ({ page }) => {
  await openProgram(page, { startWeeksAgo: 0 });
  const card = page.locator('[data-rehab="engine"]');
  await expect(card).toContainText('The Long Way');
  await card.click();
  await page.locator('#sp-start').click();
  await expect(page.locator('#rehab-player')).toHaveClass(/open/);
  await expect(page.locator('#rp-exname')).toHaveText('Box Step-Up');
});

// Same movements, same sets, different delivery — the only week-to-week
// variety that costs nothing (2026-10-09). Friday's two supersets rotate on
// staggered cycles: Legs & Back SETS → HEAVY → LAST SET MAX, Dips &
// Pull-Ups SETS ↔ LAST SET MAX. Nothing on Friday goes for time: the split
// squat, the row and the dip all need the rest floor. Week 1 is plain SETS
// everywhere (2026-10-10, physio QA). Round 2: Friday has its own Jumps
// EMOM, the press runs 1 build + 3 working on a 2:30 clock, and there is no
// RDL on Friday at all — Monday's is the week's only hinge. Round 3: three
// rounds of jumps on a 45 s clock and laterals in the press's rest. Round 4:
// the dips while fresh (with the cable leg curls), then Legs & Back.
async function pressOverview(page, week) {
  await checkInGood(page); // the full Friday — an unchecked one drops the jumps
  await openProgram(page, { startWeeksAgo: week - 1 });
  await page.locator('[data-d40="d40-c1"]').click();
  await page.locator('#sp-start').click();
  await page.locator('#rp-overview-btn').click();
  return (await page.locator('#rpo-list').textContent())?.replace(/\s+/g, ' ');
}
// in this order, every week
const PRESS_SLOTS = [
  /Warm-Up/,
  /Pogo Hop/, // every Friday warm-up ends on the springs
  /Jumps EMOM 5 · 3 rounds/, // max-intent jumps, unloaded, forced rest
  /Broad Jump/,
  /Skater Bound/,
  /The Anchor/,
  /30° Incline DB Press/, // the FIXED anchor, every week
  /\+ DB Lateral Raise 12 in the rest/, // the pair
  /Dips, Pull-Ups & Curls/, // round 4: the dips while fresh
  /Ring Dip/,
  /Strict Pull-Up/,
  /Cable Leg Curl/, // no sliders: the curl is on the cable, pinned 6/leg
  /Legs & Back/,
  /Rear-Foot-Elevated Split Squat/,
  /Lat Pulldown/, // QA round: the row moved to Monday's Wings
];
function expectPressSlots(t) {
  let at = 0;
  for (const slot of PRESS_SLOTS) {
    const m = t.slice(at).search(slot);
    expect(m, `${slot} after position ${at}`).toBeGreaterThanOrEqual(0);
    at += m + 1;
  }
  // the cable lateral left Legs & Back for the press's rest (round 3)
  expect(t).not.toContain('Cable Lateral Raise');
}

test('week 1: everything runs plain SETS — nothing heavy or maxed on first exposure', async ({ page }) => {
  const t = await pressOverview(page, 1);
  console.log('FRI wk1:', t?.slice(-260));
  expect(t).toContain('Dips, Pull-Ups & Curls SETS · 3 rounds');
  expect(t).toContain('Legs & Back SETS · 4 rounds'); // 45-min round: four
  expect(t).not.toMatch(/HEAVY|LAST SET MAX|for time/);
  expect(t).toContain('E2:30 10 · 4 rounds (1 to build)');
  expectPressSlots(t);
  expect(t).not.toContain('Romanian Deadlift');
});

test('week 2 is the heavy week for legs & back — same exercises, same sets', async ({ page }) => {
  const t = await pressOverview(page, 2);
  console.log('FRI wk2:', t?.slice(-260));
  expect(t).toContain('Legs & Back HEAVY · 4 rounds');
  expect(t).toContain('Rear-Foot-Elevated Split Squat 6/leg'); // ~70% of 8
  expect(t).toContain('Dips, Pull-Ups & Curls SETS · 3 rounds');
  expect(t).not.toContain('for time');
  expectPressSlots(t);
});

test('week 3: nothing on Friday goes for time — split squat and ring dip keep their rest', async ({ page }) => {
  const t = await pressOverview(page, 3);
  console.log('FRI wk3:', t?.slice(-260));
  expect(t).not.toContain('for time');
  // both supersets run their rep-out week together — on real rest
  expect(t.match(/LAST SET MAX/g)).toHaveLength(2);
  expect(t).toContain('Dips, Pull-Ups & Curls LAST SET MAX · 3 rounds');
  expectPressSlots(t);
});

// Wings is hypertrophy work, and hypertrophy work is never rushed (2026-10-10,
// coach QA): its third week is LAST SET MAX on real rest, never FOR TIME.
test('Monday\'s Wings never runs for time — week 3 is its rep-out week', async ({ page }) => {
  await openProgram(page, { startWeeksAgo: 2 }); // week 3
  await page.locator('[data-d40="d40-a1"]').click();
  await page.locator('#sp-start').click();
  for (let i = 0; i < 60; i++) {
    const head = (await page.locator('#rp-session-name').textContent()) || '';
    const meta = (await page.locator('#rp-meta').textContent()) || '';
    if (/WINGS/.test(head) && /ROUND 1 OF 4/.test(meta)) break;
    await page.locator('#rp-skip').click();
    await page.waitForTimeout(60);
  }
  await expect(page.locator('#rp-session-name')).toHaveText('WINGS');
  // the effort target leads the meta; MAX SET only lands on the last round
  // (Wings is three rounds since round 3)
  await expect(page.locator('#rp-meta')).toContainText('1–2 LEFT · ROUND 1 OF 4');
  await expect(page.locator('#rp-meta')).not.toContainText('FOR TIME');
  await page.locator('#rp-overview-btn').click();
  await expect(page.locator('#rpo-list')).toContainText('LAST SET MAX');
  await expect(page.locator('#rpo-list')).not.toContainText('for time');
});

// THE SUPERSET TARGET (2026-10-09). A superset set suggests the next load
// from the last session of the SAME week type — the heavy week's 7 reps at
// more weight is never the yardstick for a 10-rep week — and it confirms the
// reps actually done before they enter history. Read on Wings' pulldown (the
// laterals left Wings for the pull-up's rest in round 3).
const thisMondayLocal = () => {
  const m = new Date();
  m.setHours(0, 0, 0, 0);
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
  return m;
};
const begun = (m) => ({
  name: 'Pull', type: 'strength', programId: 'd40-a1', date: new Date(m.getTime() + 36e5).toISOString(),
  duration: '30 min', totalWeight: 0, sets: 4, newPRs: [], exercises: [],
});

test('a superset set shows a same-week-type target and confirms its reps', async ({ page }) => {
  const m = thisMondayLocal();
  const day = (d) => new Date(m.getTime() - d * 864e5 + 36e5).toISOString();
  const sets = (weight, reps, heavy) =>
    Array.from({ length: 3 }, () => ({ weight, reps, done: true, ...(heavy ? { heavy } : {}) }));
  const entry = (date, logs) => ({
    name: 'Density 40 · Full Body I', type: 'strength', programId: 'd40-a1', date,
    duration: '40 min', totalWeight: 0, sets: 3, newPRs: [],
    exercises: [{ name: 'Chest-Supported DB Row', sets: 3, logs }],
  });
  await openProgram(page, {
    startWeeksAgo: 0, // week 1: Wings runs straight SETS
    history: [
      entry(day(14), sets(40, 10)), // an ordinary week, every set hit
      entry(day(7), sets(50, 7, true)), // the MORE RECENT one was heavy
      begun(m), // the block counts as begun (see openProgram)
    ],
  });
  await page.locator('[data-d40="d40-a1"]').click();
  await page.locator('#sp-start').click();
  for (let i = 0; i < 60; i++) {
    const name = (await page.locator('#rp-exname').textContent()) || '';
    const meta = (await page.locator('#rp-meta').textContent()) || '';
    if (name === 'Chest-Supported DB Row' && /ROUND 1 OF 4/.test(meta)) break;
    await page.locator('#rp-skip').click();
    await page.waitForTimeout(60);
  }
  await expect(page.locator('#rp-exname')).toHaveText('Chest-Supported DB Row');
  // read against the ordinary week (40 × 10, all hit), not the heavy one —
  // the row loads first, and it isn't spine-loaded, so no Good morning is
  // needed for it to rise (round 3)
  await expect(page.locator('#rp-context')).toContainText('LAST 40×10');
  await expect(page.locator('#rp-context')).toContainText(/TARGET 42\.5\s*(kg|lbs)/);
  // QA round ★5: the dial pre-fills the TARGET, not last time's weight
  await expect(page.locator('#rp-w-val')).toHaveText('42.5');

  // first tap asks for the reps (nothing logged yet); the second logs them
  const pdSets = () =>
    page.evaluate(() =>
      (JSON.parse(localStorage.getItem('kilos-rehab-state') || '{}').liftSets || []).filter(
        (s) => s.exId === 'chest-supported-row',
      ),
    );
  await page.locator('#rp-skip').click();
  await expect(page.locator('#rp-meta')).toContainText('ROUND 1 OF 4');
  expect(await pdSets()).toHaveLength(0);
  await page.locator('#rp-skip').click();
  await expect(page.locator('#rp-meta')).not.toContainText('ROUND 1 OF 4 ·');
  await expect.poll(async () => (await pdSets()).length).toBe(1);
  const logged = await pdSets();
  expect(logged).toHaveLength(1);
  expect(logged[0].reps).toBe(10);
  expect(logged[0].weight).toBe(42.5); // the pre-filled target was what he lifted
  expect(logged[0].heavy).toBeUndefined();
});

// THE ANCHOR'S PAIR (round 3): the lateral raise rides the pull-up's rest on
// the same clock. It is a working set with its own target — read against the
// same week type, reps-first (a small lift) — and it logs the reps actually
// done through the REPS DONE row, never an anchor's reps-left question.
test('the anchor pair: laterals in the pull-up rest, own target, reps done logged', async ({ page }) => {
  const m = thisMondayLocal();
  const day = (d) => new Date(m.getTime() - d * 864e5 + 36e5).toISOString();
  const lat = (weight, reps, heavy) =>
    Array.from({ length: 5 }, () => ({ weight, reps, done: true, ...(heavy ? { heavy } : {}) }));
  const entry = (date, logs) => ({
    name: 'Density 40 · Full Body I', type: 'strength', programId: 'd40-a1', date,
    duration: '40 min', totalWeight: 0, sets: 5, newPRs: [],
    exercises: [{ name: 'DB Lateral Raise', sets: 5, logs }],
  });
  await openProgram(page, {
    startWeeksAgo: 0,
    history: [entry(day(14), lat(10, 12)), entry(day(7), lat(14, 8, true)), begun(m)],
  });
  await page.locator('[data-d40="d40-a1"]').click();
  await page.locator('#sp-start').click();
  for (let i = 0; i < 60; i++) {
    const name = (await page.locator('#rp-exname').textContent()) || '';
    if (name === 'DB Lateral Raise') break;
    await page.locator('#rp-skip').click();
    await page.waitForTimeout(60);
  }
  await expect(page.locator('#rp-exname')).toHaveText('DB Lateral Raise');
  // the pair rides the anchor's piece, straight after its first set
  await expect(page.locator('#rp-session-name')).toContainText('THE ANCHOR');
  await expect(page.locator('#rp-meta')).toContainText('PAIR · ROUND 1 OF 5');
  // reps first: one more rep at the same weight, never a +2.5 on 10 kg
  await expect(page.locator('#rp-context')).toContainText('LAST 10×12');
  await expect(page.locator('#rp-context')).toContainText(/TARGET 10\s*(kg|lbs) × 13/);
  // QA round ★5: REPS DONE starts at the suggested reps (13), the dial at
  // the suggested weight (10) — then logs what he actually did
  const row = page.locator('#rp-anchor-reps');
  await expect(row).toBeVisible();
  await expect(page.locator('#rp-ar-val')).toHaveText('13');
  await expect(page.locator('#rp-w-val')).toHaveText('10');
  await page.locator('#rp-ar-minus').click();
  await page.locator('#rp-ar-minus').click();
  await expect(page.locator('#rp-ar-val')).toHaveText('11');
  const latSets = () =>
    page.evaluate(() =>
      (JSON.parse(localStorage.getItem('kilos-rehab-state') || '{}').liftSets || []).filter(
        (s) => s.exId === 'db-lateral-raise',
      ),
    );
  await page.locator('#rp-skip').click();
  // straight back to the next pull-up set
  await expect(page.locator('#rp-exname')).toHaveText('Strict Pull-Up');
  await expect(page.locator('#rp-meta')).toContainText('SET 2 OF 5');
  await expect.poll(async () => (await latSets()).length).toBe(1);
  expect((await latSets())[0].reps).toBe(11);
});

// ── THE MORNING BACK CHECK (2026-10-10, physio QA) ──────────────────────────
// With a degenerative disc the answer to the last session arrives the NEXT
// MORNING. One tap — GOOD / STIFFER / PAIN WORSE / INTO A LEG, plus "slept
// under 5 h" — sets today's dose: amber serves the lighter day, a short
// night alone the tired day (full volume, no impact or maxing), red only the
// Daily Reset. Round 2: the check sits on EVERY training preview, not just
// today's card. The clock is pinned so "today" is the day under test.
const localDay = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const WED = new Date(2026, 9, 14, 7, 30); // a Wednesday: the squat + Power day
const SAT = new Date(2026, 9, 17, 7, 30); // a Saturday: Back & Hips
const daysBefore = (when, n) => localDay(new Date(when.getTime() - n * 864e5));

// earlier mornings' answers, seeded before the app boots
async function seedBackChecks(page, checks) {
  await page.addInitScript((c) => {
    localStorage.setItem('kilos-back-checks', JSON.stringify(c));
  }, checks);
}

async function openToday(page, when) {
  await page.clock.setFixedTime(when);
  // trained yesterday, so the gap advice stays out of it (a 3+ day gap would
  // lead with the SHORT day on its own) — and the block counts as begun
  const monday = new Date(when);
  monday.setHours(1, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const yesterday = new Date(when.getTime() - 864e5);
  const entry = (date, extra) => ({
    name: 'Rehab · Back & Hips', type: 'rehab', rehabId: 'daily', date: date.toISOString(),
    duration: '35 min', totalWeight: 0, sets: 20, newPRs: [], exercises: [], ...extra,
  });
  await openProgram(page, {
    startWeeksAgo: 0,
    history: [entry(monday, { type: 'strength', programId: 'd40-a1', rehabId: undefined }), entry(yesterday)],
  });
  await page.locator('#rh-today-btn').click();
  await expect(page.locator('#session-preview')).toHaveClass(/open/);
}

test('the back check sits on today\'s lift card, and STIFFER serves the lighter day', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openToday(page, WED);
  await expect(page.locator('#sp-title')).toHaveText('FULL BODY II');
  const check = page.locator('#sp-backcheck');
  await expect(check).toBeVisible();
  // four answers, in the order a morning reads them, plus the sleep toggle
  await expect(check.locator('.sp-back-btn')).toHaveText([
    'GOOD',
    'STIFFER',
    'PAIN WORSE',
    'INTO A LEG',
  ]);
  await expect(page.locator('#sp-back-sleep')).toBeVisible();
  // a lift day has no forward folds, so the morning-rule toggle stays hidden
  // — and with no stiff history there is no deload offer
  await expect(page.locator('#sp-back-early')).toBeHidden();
  await expect(page.locator('#sp-back-deload')).toBeHidden();
  // not checked in yet (QA round ★2): it asks, Start is the normal Start,
  // and until he answers the jumps, the Power EMOM and the finisher sit out
  await expect(page.locator('#sp-back-note')).toHaveText(
    'One tap first — until you answer, the jumps, sprints and finisher sit out.',
  );
  await expect(page.locator('#sp-start .sp-start-text')).toHaveText('START');
  const list = page.locator('#sp-list');
  await expect(list).not.toContainText('DB Push Press');
  await expect(list).not.toContainText('Pogo Hop');
  await expect(list).not.toContainText(/Seven|Tabata/i); // the week's metcon
  await expect(list).toContainText('Front Squat'); // the work stays
  const mins = async () =>
    Number(((await page.locator('#sp-meta').textContent()) || '').match(/~(\d+) MIN/)?.[1]);
  const unchecked = await mins();
  // GOOD brings the whole day back
  await check.locator('[data-back="good"]').click();
  await expect(page.locator('#sp-back-note')).toHaveText('');
  await expect(list).toContainText('DB Push Press'); // the Power EMOM
  await expect(list).toContainText('Pogo Hop'); // the warm-up's springs
  // week 1's metcon closes the day: the seven-minute AMRAP (45-min round)
  await expect(list).toContainText('SEVEN — AMRAP 7');
  const full = await mins();
  expect(full).toBeGreaterThan(unchecked);

  await check.locator('[data-back="stiff"]').click();
  await expect(check.locator('[data-back="stiff"]')).toHaveAttribute('aria-pressed', 'true');
  // QA round: the note lists only what THIS day changes
  await expect(page.locator('#sp-back-note')).toHaveText(
    'A shorter, lighter day: no jumps or sprints, the front squat a DB split squat.',
  );
  // amber: no Power piece, no Tabata, no pogo — the squat swapped to split
  // squats, the superset's split squats to glute bridges, the empty-bar
  // warm-up to a box squat
  await expect(list).not.toContainText('DB Push Press');
  await expect(list).not.toContainText(/Seven|Tabata/i); // the week's metcon
  await expect(list).not.toContainText('Pogo Hop');
  await expect(list).not.toContainText('Front Squat');
  await expect(list).toContainText('Heavy DB Split Squat');
  await expect(list).toContainText('Glute Bridge');
  await expect(list).toContainText('Box Squat');
  expect(await mins()).toBeLessThan(full);
  // the check is stored for TODAY, so every screen reads the same answer
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('kilos-back-checks')));
  expect(stored).toEqual([{ date: localDay(WED), back: 'stiff' }]);

  // and Start runs what the card shows: the anchor serves the split squat
  await page.locator('#sp-start').click();
  await expect(page.locator('#rehab-player')).toHaveClass(/open/);
  await page.locator('#rp-overview-btn').click();
  await expect(page.locator('#rpo-list')).toContainText('Heavy DB Split Squat');
  await expect(page.locator('#rpo-list')).toContainText('Glute Bridge');
  await expect(page.locator('#rpo-list')).not.toContainText('Power');
  expect(errors).toEqual([]);
});

// Both red answers — pain worse than usual, or anything into a leg — serve
// nothing but the Daily Reset, with the red-flag list on screen.
for (const [back, label] of [
  ['worse', 'PAIN WORSE'],
  ['leg', 'INTO A LEG'],
]) {
  test(`${label} turns today into the Daily Reset`, async ({ page }) => {
    await openToday(page, WED);
    const check = page.locator('#sp-backcheck');
    await check.locator(`[data-back="${back}"]`).click();
    await expect(check.locator(`[data-back="${back}"]`)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#sp-start .sp-start-text')).toHaveText('DAILY RESET');
    // the red-flag list is on screen, not buried in a menu
    await expect(page.locator('#sp-back-note')).toContainText('Rest today');
    await expect(page.locator('#sp-back-note')).toContainText('leg weakness');
    // round 4: the true emergencies say so, and the leg-direction rule is there
    await expect(page.locator('#sp-back-note')).toContainText(
      'EMERGENCY DEPARTMENT NOW for numbness in the groin or saddle area',
    );
    await expect(page.locator('#sp-back-note')).toContainText(
      'Stop anything that sends symptoms further down the leg',
    );
    await page.locator('#sp-start').click();
    await expect(page.locator('#rehab-player')).toHaveClass(/open/);
    // the Daily Reset opens on its cat-camel — never the squat day
    await expect(page.locator('#rp-exname')).toHaveText('Cat-Camel');
    const state = await page.evaluate(() => JSON.parse(localStorage.getItem('kilos-rehab-state') || '{}'));
    expect(JSON.stringify(state)).toContain('reset');
    expect(JSON.stringify(state)).not.toContain('d40-b1');
  });
}

// A good back after a short night is the TIRED day, not amber: the volume
// stays, the impact and the maxing go. On Saturday every `finisher` block
// goes — the carry sits in one, so it goes too; the supporting move stays.
test('Back & Hips days carry the check too; a short night alone is the tired day', async ({ page }) => {
  await openToday(page, SAT);
  const check = page.locator('#sp-backcheck');
  await expect(check).toBeVisible();
  const list = page.locator('#sp-list');
  await expect(list).toContainText('Farmer Carry'); // Saturday's carry
  await expect(list).toContainText('Back Extension');
  // unchecked: no sprints until he answers (QA round ★2)
  await expect(list).not.toContainText(/Sprint/);
  await check.locator('[data-back="good"]').click();
  await expect(check.locator('[data-back="good"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(list).toContainText('Farmer Carry');
  await expect(page.locator('#sp-back-note')).toHaveText('');
  // the sprints sit right after the Big 3: three build rounds, five sprints
  // (the minutes in the kicker are pinned in the unit suite — see the
  // reported overview/wall-clock mismatch)
  await expect(list).toContainText(
    /SPRINTS: STARTS — SPRINTS \d+ · 8 ROUNDS \(3 TO BUILD\)\s*Sprint\s*4 SEC/,
  );
  await page.locator('#sp-back-sleep').click();
  await expect(page.locator('#sp-back-sleep')).toHaveAttribute('aria-pressed', 'true');
  // the tired day is real — it says so (QA round copy)
  await expect(page.locator('#sp-back-note')).toHaveText(
    'A short night: one round lighter, a rep further from failure, no jumps or max sets. The heavy back lifts hold their weight.',
  );
  await expect(list).not.toContainText('Farmer Carry');
  await expect(list).not.toContainText('Suitcase Carry');
  // no sprints on a short night — ballistic work waits for a rested day
  await expect(list).not.toContainText(/Sprint/);
  await expect(list).toContainText('McGill Curl-Up'); // the primer always stays
  // the back extension is served as written — reps, not the amber hold
  await expect(list).toContainText('Back Extension');
  await expect(page.locator('#sp-start .sp-start-text')).toHaveText('START');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('kilos-back-checks')));
  expect(stored).toEqual([{ date: localDay(SAT), back: 'good', shortSleep: true }]);
});

test('a short night on the squat day keeps the squat, drops Power and Tabata', async ({ page }) => {
  await openToday(page, WED);
  await page.locator('#sp-back-sleep').click();
  await expect(page.locator('#sp-back-note')).toContainText('A short night');
  const list = page.locator('#sp-list');
  await expect(list).not.toContainText('DB Push Press');
  await expect(list).not.toContainText(/Seven|Tabata/i); // the week's metcon
  await expect(list).not.toContainText('Pogo Hop');
  // the squat stays — not swapped, one working set lighter (round 5: build
  // + three) — and so does the superset
  await expect(list).toContainText(/THE ANCHOR — E2:30 10 · 4 ROUNDS \(1 TO BUILD\)\s*Front Squat/);
  // the superset stays, one round lighter on a short night (round 4)
  await expect(list).toContainText('SPLIT SQUAT & CURL — SETS · 2 ROUNDS');
  await page.locator('#sp-start').click();
  await expect(page.locator('#rehab-player')).toHaveClass(/open/);
  await page.locator('#rp-overview-btn').click();
  const ov = page.locator('#rpo-list');
  await expect(ov).toContainText('Front Squat');
  await expect(ov).toContainText('4 rounds (1 to build)'); // one set lighter
  await expect(ov).not.toContainText('Power');
  await expect(ov).not.toContainText(/Seven|Tabata/i);
});

// EVERY START ASKS (round 2): browsing another day's card used to skip the
// check, which was a way around it. Now any training session's preview
// carries it — and the answer shapes that session too.
test('the check sits on another day\'s card too, and shapes it', async ({ page }) => {
  await page.clock.setFixedTime(WED);
  await openProgram(page, { startWeeksAgo: 0 });
  await page.locator('[data-d40="d40-a1"]').click(); // Monday's card on a Wednesday
  await expect(page.locator('#session-preview')).toHaveClass(/open/);
  const check = page.locator('#sp-backcheck');
  await expect(check).toBeVisible();
  // the preview's own Back button is untouched by it
  await expect(page.locator('#sp-back')).toBeVisible();
  const list = page.locator('#sp-list');
  await expect(list).toContainText('Romanian Deadlift');
  await check.locator('[data-back="stiff"]').click();
  // amber Monday: the RDL becomes a glute bridge
  await expect(list).not.toContainText('Romanian Deadlift');
  await expect(list).toContainText('Glute Bridge');
  await page.locator('#sp-back').click();
  // the Sunday rest day is a training session too
  await page.locator('[data-rehab="sunday"]').click();
  await expect(page.locator('#session-preview')).toHaveClass(/open/);
  await expect(check).toBeVisible();
  await expect(check.locator('[data-back="stiff"]')).toHaveAttribute('aria-pressed', 'true');
});

// THE MORNING AFTER A RED ONE starts amber until he says otherwise.
test('a red yesterday with no answer today carries over as amber', async ({ page }) => {
  await seedBackChecks(page, [{ date: daysBefore(WED, 1), back: 'worse' }]);
  await openToday(page, WED);
  const note = page.locator('#sp-back-note');
  await expect(note).toContainText('Yesterday was rough, so today starts lighter');
  await expect(note).toContainText('A shorter, lighter day');
  const list = page.locator('#sp-list');
  await expect(list).not.toContainText('DB Push Press');
  await expect(list).toContainText('Heavy DB Split Squat');
  // no answer is pressed — it is a carry-over, not today's answer
  await expect(page.locator('#sp-backcheck [aria-pressed="true"]')).toHaveCount(0);
  await expect(page.locator('#sp-start .sp-start-text')).toHaveText('START');
  // GOOD today lifts it
  await page.locator('#sp-backcheck [data-back="good"]').click();
  await expect(note).toHaveText('');
  await expect(list).toContainText('DB Push Press');
});

// round 5: the carried amber outranks a short night — a rough yesterday
// is still the lighter day even when today only says "slept under 5 h"
test('a red yesterday plus a short night today is still amber', async ({ page }) => {
  await seedBackChecks(page, [
    { date: daysBefore(WED, 1), back: 'worse' },
    { date: localDay(WED), shortSleep: true },
  ]);
  await openToday(page, WED);
  const note = page.locator('#sp-back-note');
  await expect(note).toContainText('Yesterday was rough, so today starts lighter');
  await expect(note).toContainText('A shorter, lighter day');
  await expect(note).not.toContainText('A short night');
  await expect(page.locator('#sp-list')).toContainText('Heavy DB Split Squat');
});

// ESCALATION (physio QA): repeated bad mornings are a clinician's job.
test('three red mornings in two weeks say to see a physio', async ({ page }) => {
  await seedBackChecks(page, [
    { date: daysBefore(WED, 20), back: 'worse' }, // outside the window
    { date: daysBefore(WED, 9), back: 'worse' },
    { date: daysBefore(WED, 5), back: 'sore' }, // the pre-round-2 red counts
    { date: daysBefore(WED, 3), back: 'worse' },
  ]);
  await openToday(page, WED);
  const note = page.locator('#sp-back-note');
  await expect(note).toContainText('3 rough mornings in the last two weeks');
  await expect(note).toContainText('book a physio');
  // it rides along with today's answer too
  await page.locator('#sp-backcheck [data-back="good"]').click();
  await expect(note).toContainText('book a physio');
});

test('leg symptoms twice in two weeks say to see a physio', async ({ page }) => {
  await seedBackChecks(page, [
    { date: daysBefore(WED, 8), back: 'leg' },
    { date: daysBefore(WED, 3), back: 'leg' },
  ]);
  await openToday(page, WED);
  await expect(page.locator('#sp-back-note')).toContainText('book a physio');
});

test('one rough morning is not an escalation', async ({ page }) => {
  await seedBackChecks(page, [{ date: daysBefore(WED, 4), back: 'worse' }]);
  await openToday(page, WED);
  await expect(page.locator('#sp-back-note')).not.toContainText('physio');
});

// THE LOAD GATE (2026-10-10, physio QA; split in round 3). A SPINE-LOADED
// lift (front squat, RDL, the split squats, the front-rack lunge) rises only
// on a Good morning AND only when the first back check after its last session
// wasn't stiff or worse. Every other lift rises unless today is amber or red —
// a short night or a skipped check no longer freezes the arms for weeks.
// Read on Monday's lat pulldown (not spine-loaded: 40 × 10 every set last
// time) and Wednesday's DB split squat (spine-loaded: 30 × 8 last time).
const lastWeekMon = () => new Date(thisMondayLocal().getTime() - 7 * 864e5 + 36e5);
async function supersetContext(
  page,
  // QA round: Monday's Wings leads with the chest-supported row (not spine-loaded)
  {
    sessionId = 'd40-a1',
    exName = 'Chest-Supported DB Row',
    // Wings and Legs & Back run four rounds (45-min round), Wednesday three
    rounds = sessionId === 'd40-b1' ? 3 : 4,
    logs,
    history,
    checks = [],
  },
) {
  await page.addInitScript((c) => {
    if (c.length) localStorage.setItem('kilos-back-checks', JSON.stringify(c));
  }, checks);
  const m = thisMondayLocal();
  const entry = (date, l, extra = {}) => ({
    name: 'Density 40', type: 'strength', programId: sessionId, date: date.toISOString(),
    duration: '40 min', totalWeight: 0, sets: l.length, newPRs: [],
    exercises: [{ name: exName, sets: l.length, logs: l }],
    ...extra,
  });
  await openProgram(page, {
    startWeeksAgo: 0, // week 1: every superset runs straight SETS
    history: [...(history ? history(entry) : [entry(lastWeekMon(), logs)]), begun(m)],
  });
  await page.locator(`[data-d40="${sessionId}"]`).click();
  await page.locator('#sp-start').click();
  const first = new RegExp(`ROUND 1 OF ${rounds}`);
  for (let i = 0; i < 80; i++) {
    const name = (await page.locator('#rp-exname').textContent()) || '';
    const meta = (await page.locator('#rp-meta').textContent()) || '';
    if (name === exName && first.test(meta)) break;
    await page.locator('#rp-skip').click();
    await page.waitForTimeout(60);
  }
  await expect(page.locator('#rp-exname')).toHaveText(exName);
  await expect(page.locator('#rp-meta')).toContainText(`ROUND 1 OF ${rounds}`);
  return page.locator('#rp-context');
}
const today = () => localDay(new Date());
const after = (d, n) => localDay(new Date(d.getTime() + n * 864e5));
const pd = (weight = 40, reps = 10) =>
  Array.from({ length: 3 }, () => ({ weight, reps, done: true }));
const pulldownContext = (page, checks, rounds) =>
  supersetContext(page, {
    logs: pd(),
    // a tired morning runs every superset one round lighter (round 4)
    // Wings: four rounds, one fewer on a short night (45-min round)
    rounds: rounds ?? (checks?.some((c) => c.shortSleep) ? 3 : 4),
    checks: (checks || []).map((c) => ({ date: today(), ...c })),
  });
const splitContext = (page, checks) =>
  supersetContext(page, {
    rounds: checks.some((c) => c.date === today() && c.shortSleep) ? 2 : 3,
    sessionId: 'd40-b1',
    exName: 'Heavy DB Split Squat',
    logs: Array.from({ length: 3 }, () => ({ weight: 30, reps: 8, done: true })),
    checks,
  });

test('the load gate: no check-in today, a non-spine lift still rises', async ({ page }) => {
  const ctx = await pulldownContext(page, null);
  await expect(ctx).toContainText('LAST 40×10');
  await expect(ctx).toContainText(/TARGET 42\.5\s*(kg|lbs)/);
  await expect(ctx).not.toContainText('HOLD');
});

// A stiffer morning is the AMBER day (round 2): the short dose (Wings runs
// one round) and loads EASE ~10% — never a target, never a rise.
test('the load gate: a stiffer morning eases the load, never raises it', async ({ page }) => {
  const ctx = await pulldownContext(page, [{ back: 'stiff' }], 1);
  await expect(ctx).toContainText(/EASE 35\s*(kg|lbs)/);
  await expect(ctx).not.toContainText('TARGET');
});

// A good back after a short night is the TIRED day: full volume, and since
// round 3 a non-spine lift may still rise on it.
test('the load gate: a short night no longer freezes a non-spine lift', async ({ page }) => {
  const ctx = await pulldownContext(page, [{ back: 'good', shortSleep: true }]);
  await expect(ctx).toContainText(/TARGET 42\.5\s*(kg|lbs)/);
  await expect(ctx).not.toContainText('HOLD');
});

test('the load gate: a Good check-in opens the +2.5 target', async ({ page }) => {
  const ctx = await pulldownContext(page, [{ back: 'good' }]);
  await expect(ctx).toContainText(/TARGET 42\.5\s*(kg|lbs)/);
  await expect(ctx).not.toContainText('HOLD');
});

// The split squats (round 4, TIRED_RISE): his main leg-growth lifts,
// unilateral and light on the disc — on a short night or an unchecked
// morning they may still rise, but only if the morning after their last
// session was fine. They progress reps-first (round 4), and a HOLD keeps the
// reps target: 'HOLD 30 × 9'.
// QA round: TIRED_RISE is gone — every spine-loaded lift (the split squats
// included) rises ONLY on a Good morning whose morning-after was fine; an
// unchecked or short-night morning HOLDS it, still asking for the next rep.
test('the load gate: a split squat HOLDS on an unchecked morning', async ({ page }) => {
  const ctx = await splitContext(page, []);
  await expect(ctx).toContainText('LAST 30×8');
  await expect(ctx).toContainText(/HOLD 30\s*(kg|lbs) × 9/);
  await expect(ctx).not.toContainText('TARGET');
});

test('the load gate: a split squat HOLDS on a short night', async ({ page }) => {
  const ctx = await splitContext(page, [{ date: today(), back: 'good', shortSleep: true }]);
  await expect(ctx).toContainText(/HOLD 30\s*(kg|lbs) × 9/);
});

// …and a lift he flared on (the player's "back flared" stop marks THAT
// day's check) holds next time, even after a fine morning-after (QA round)
test('the load gate: a split squat he flared on last time HOLDS', async ({ page }) => {
  const ctx = await splitContext(page, [
    { date: localDay(lastWeekMon()), back: 'worse', flare: 'db-split-squat' },
    { date: after(lastWeekMon(), 1), back: 'good' },
    { date: today(), back: 'good' },
  ]);
  await expect(ctx).toContainText(/HOLD 30\s*(kg|lbs) × 9/);
});

test('the load gate: a split squat HOLDS when the morning after it was stiff', async ({ page }) => {
  // Good today — but the disc's answer to last week's split squats, the
  // next morning, was stiff. The held lift keeps its reps target.
  const ctx = await splitContext(page, [
    { date: after(lastWeekMon(), 1), back: 'stiff' },
    { date: today(), back: 'good' },
  ]);
  await expect(ctx).toContainText(/HOLD 30\s*(kg|lbs) × 9/);
  await expect(ctx).not.toContainText('TARGET');
});

test('the load gate: a split squat rises on Good after a fine morning-after', async ({ page }) => {
  const ctx = await splitContext(page, [
    { date: after(lastWeekMon(), 1), back: 'good' },
    { date: today(), back: 'good' },
  ]);
  await expect(ctx).toContainText(/TARGET 30\s*(kg|lbs) × 9/);
  await expect(ctx).not.toContainText('HOLD');
});

// The heavy axial lifts wait for a GOOD morning: the RDL (with its own ≥2
// reps-left rule) holds on an unchecked or short-night morning.
const rdlContext = (page, checks) =>
  supersetContext(page, {
    exName: 'Romanian Deadlift',
    rounds: checks.some((c) => c.shortSleep) ? 2 : 3,
    history: (entry) => [
      entry(lastWeekMon(), Array.from({ length: 3 }, () => ({ weight: 60, reps: 8, done: true })), {
        rdlRIR: 2,
      }),
    ],
    checks,
  });
test('the load gate: the RDL HOLDS without a Good morning', async ({ page }) => {
  const ctx = await rdlContext(page, []);
  await expect(ctx).toContainText('LAST 60×8');
  await expect(ctx).toContainText(/HOLD 60\s*(kg|lbs)/);
  await expect(ctx).not.toContainText('TARGET');
});
test('the load gate: the RDL HOLDS on a short night', async ({ page }) => {
  const ctx = await rdlContext(page, [{ date: today(), back: 'good', shortSleep: true }]);
  await expect(ctx).toContainText(/HOLD 60\s*(kg|lbs)/);
});
test('the load gate: the RDL rises on a Good morning with 2 reps left last time', async ({ page }) => {
  const ctx = await rdlContext(page, [{ date: today(), back: 'good' }]);
  await expect(ctx).toContainText(/TARGET 62\.5\s*(kg|lbs)/);
});

// THE STALL RULE (round-3 coach QA): two FULL-DOSE sessions running short of
// the reps at the same top weight reset ~10% (at least 2.5 kg) and build back
// — a HOLD forever was the alternative. Load-first lifts only.
test('the stall rule: two full sessions short at the same weight RESET ~10%', async ({ page }) => {
  const ctx = await supersetContext(page, {
    history: (entry) => [
      entry(new Date(lastWeekMon().getTime() - 7 * 864e5), pd(40, 8)),
      entry(lastWeekMon(), pd(40, 8)),
    ],
    checks: [{ date: today(), back: 'good' }],
  });
  await expect(ctx).toContainText('LAST 40×8');
  await expect(ctx).toContainText(/RESET 35\s*(kg|lbs)/);
  await expect(ctx).not.toContainText('TARGET');
});

test('the stall rule: a tired day is never the yardstick — no RESET', async ({ page }) => {
  const ctx = await supersetContext(page, {
    history: (entry) => [
      entry(new Date(lastWeekMon().getTime() - 7 * 864e5), pd(40, 8)),
      // the most recent miss was on a short night — not a full dose
      entry(lastWeekMon(), pd(40, 8), { tired: true }),
    ],
    checks: [{ date: today(), back: 'good' }],
  });
  await expect(ctx).not.toContainText('RESET');
  await expect(ctx).toContainText(/TARGET 40\s*(kg|lbs)/);
});

// THE ANCHOR'S OWN GATE (round 2): a heavy lift rises only with his explicit
// "≥2 reps left" on last time's final set — a skipped answer (null) is not a
// yes, and neither is 1. Read on Wednesday's front squat, 60 × 5 last week.
async function squatAnchor(page, { anchorRIR, back = 'good', shortSleep = false } = {}) {
  await page.clock.setFixedTime(WED);
  await page.addInitScript(
    ({ day, b, ss }) => {
      localStorage.setItem(
        'kilos-back-checks',
        JSON.stringify([{ date: day, back: b, ...(ss ? { shortSleep: true } : {}) }]),
      );
    },
    { day: localDay(WED), b: back, ss: shortSleep },
  );
  // a tired day runs the anchor one working set lighter (round 5)
  const of = shortSleep ? 3 : 4;
  const monday = new Date(WED);
  monday.setHours(1, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const lastWed = new Date(WED.getTime() - 7 * 864e5);
  await openProgram(page, {
    startWeeksAgo: 0,
    history: [
      {
        name: 'Density 40 · Full Body II', type: 'strength', programId: 'd40-b1',
        date: lastWed.toISOString(), duration: '40 min', totalWeight: 0, sets: 4, newPRs: [],
        exercises: [{
          name: 'Front Squat', sets: 4,
          logs: Array.from({ length: 4 }, () => ({ weight: 60, reps: 5, done: true })),
        }],
        ...(anchorRIR != null ? { anchorRIR } : {}),
      },
      // Monday trained, so the block counts as begun and there is no gap
      { name: 'Pull', type: 'strength', programId: 'd40-a1', date: monday.toISOString(),
        duration: '30 min', totalWeight: 0, sets: 4, newPRs: [], exercises: [] },
    ],
  });
  await page.locator('[data-d40="d40-b1"]').click();
  await page.locator('#sp-start').click();
  await expect(page.locator('#rehab-player')).toHaveClass(/open/);
  // skip to the anchor's first WORKING set (past its unlogged build round)
  for (let i = 0; i < 60; i++) {
    const head = (await page.locator('#rp-session-name').textContent()) || '';
    const meta = (await page.locator('#rp-meta').textContent()) || '';
    if (/^THE ANCHOR/.test(head) && new RegExp(`SET 1 OF ${of}`).test(meta)) break;
    await page.locator('#rp-skip').click();
    await page.waitForTimeout(60);
  }
  await expect(page.locator('#rp-session-name')).toContainText('THE ANCHOR · E2:30');
  await expect(page.locator('#rp-exname')).toHaveText('Front Squat');
  // QA round: a working anchor set reads SET n OF m (build rounds excluded)
  await expect(page.locator('#rp-meta')).toContainText(`SET 1 OF ${of}`);
  await expect(page.locator('#rp-context')).toContainText('LAST 60×5');
  return page.locator('#rp-context');
}

test('the anchor gate: no reps-left record last time, the squat HOLDS', async ({ page }) => {
  const ctx = await squatAnchor(page, {});
  await expect(ctx).toContainText(/HOLD 60\s*(kg|lbs)/);
  await expect(ctx).not.toContainText('TARGET');
});

test('the anchor gate: only 1 rep left last time, the squat HOLDS', async ({ page }) => {
  const ctx = await squatAnchor(page, { anchorRIR: 1 });
  await expect(ctx).toContainText(/HOLD 60\s*(kg|lbs)/);
  await expect(ctx).not.toContainText('TARGET');
});

test('the anchor gate: 2 reps left on a Good morning opens the target', async ({ page }) => {
  const ctx = await squatAnchor(page, { anchorRIR: 2 });
  await expect(ctx).toContainText(/TARGET 62\.5\s*(kg|lbs)/);
  await expect(ctx).not.toContainText('HOLD');
});

// QA round: a short night holds the squat again, even with GOOD tapped and
// ≥2 reps left — the heavy back lifts rise only on a fully green morning
test('the anchor gate: Good + a short night HOLDS the squat', async ({ page }) => {
  const ctx = await squatAnchor(page, { anchorRIR: 2, shortSleep: true });
  await expect(ctx).toContainText(/HOLD 60\s*(kg|lbs)/);
  await expect(ctx).not.toContainText('TARGET');
});

// THE REPS HE DID (2026-10-10, coach QA): a heavy-lift set used to log its
// target whether or not it happened. Now a working anchor set shows REPS
// DONE, starting at the target, and logs whatever he sets it to.
test('a heavy-lift set logs the reps done, not the target', async ({ page }) => {
  await page.clock.setFixedTime(WED);
  await openProgram(page, { startWeeksAgo: 0 });
  await page.locator('[data-d40="d40-b1"]').click();
  await page.locator('#sp-start').click();
  await expect(page.locator('#rehab-player')).toHaveClass(/open/);
  const row = page.locator('#rp-anchor-reps');
  // the build round is unlogged — no reps row there
  for (let i = 0; i < 60; i++) {
    const head = (await page.locator('#rp-session-name').textContent()) || '';
    const meta = (await page.locator('#rp-meta').textContent()) || '';
    if (/^THE ANCHOR/.test(head) && /WARM-UP/.test(meta)) break;
    await expect(row).toBeHidden(); // nothing before the anchor carries it
    await page.locator('#rp-skip').click();
    await page.waitForTimeout(60);
  }
  await expect(page.locator('#rp-meta')).toContainText('WARM-UP');
  await expect(row).toBeHidden();
  await page.locator('#rp-skip').click();
  // the first working set: the row, at the target
  await expect(page.locator('#rp-meta')).toContainText('SET 1 OF 4');
  await expect(row).toBeVisible();
  await expect(row).toContainText('REPS DONE');
  await expect(page.locator('#rp-ar-val')).toHaveText('5');
  await page.locator('#rp-ar-minus').click();
  await expect(page.locator('#rp-ar-val')).toHaveText('4');
  await page.locator('#rp-ar-plus').click();
  await page.locator('#rp-ar-plus').click();
  await expect(page.locator('#rp-ar-val')).toHaveText('6');
  await page.locator('#rp-ar-minus').click();
  await page.locator('#rp-ar-minus').click();
  await page.locator('#rp-ar-minus').click();
  await expect(page.locator('#rp-ar-val')).toHaveText('3');
  // moving on logs the set with the reps he set
  await page.locator('#rp-skip').click();
  await expect(page.locator('#rp-meta')).toContainText('SET 2 OF 4');
  const sets = () =>
    page.evaluate(() =>
      (JSON.parse(localStorage.getItem('kilos-rehab-state') || '{}').liftSets || []).filter(
        (s) => s.exId === 'front-squat',
      ),
    );
  await expect.poll(async () => (await sets()).length).toBe(1);
  expect((await sets())[0].reps).toBe(3);
  // the next set starts back at its target
  await expect(row).toBeVisible();
  await expect(page.locator('#rp-ar-val')).toHaveText('5');
});

// ── ROUND 3 ─────────────────────────────────────────────────────────────────
const TUE = new Date(2026, 9, 13, 7, 30); // Back & Hips: Arms + Calves
const FRI = new Date(2026, 9, 16, 7, 30); // the press day
const SUN = new Date(2026, 9, 18, 7, 30); // the rest day + the Bonus WOD

// THE MORNING RULE (round-3 physio QA): within an hour of waking the discs
// are fully hydrated and bending stress peaks. UP UNDER 1 HR drops the two
// held forward folds — and only on a day that has them.
test('UP UNDER 1 HR drops the forward folds from a Back & Hips day, and a refresh keeps it', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openToday(page, TUE);
  await expect(page.locator('#sp-title')).toHaveText('BACK & HIPS');
  const early = page.locator('#sp-back-early');
  await expect(early).toBeVisible();
  await expect(early).toHaveText('UP UNDER 1 HR');
  await expect(early).toHaveAttribute('aria-pressed', 'false');
  // it sits with the sleep toggle
  await expect(page.locator('.sp-back-toggles #sp-back-early')).toHaveCount(1);
  await expect(page.locator('.sp-back-toggles #sp-back-sleep')).toHaveCount(1);
  const list = page.locator('#sp-list');
  await expect(list).toContainText('Elephant Walk');
  await expect(list).toContainText('Seated Good Morning');
  await expect(list).toContainText('DB Bench Press'); // Tuesday's arm pump leads with it

  await early.click();
  await expect(early).toHaveAttribute('aria-pressed', 'true');
  // unanswered, so it still asks first — and says what the toggle did
  await expect(page.locator('#sp-back-note')).toContainText(
    'Up under an hour: the forward folds sit out today.',
  );
  await expect(list).not.toContainText('Elephant Walk');
  await expect(list).not.toContainText('Seated Good Morning');
  // nothing else changes: the openers, the primer and the pump all stay
  await expect(list).toContainText('T-Spine Reach');
  await expect(list).toContainText('McGill Curl-Up');
  await expect(list).toContainText('DB Bench Press');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('kilos-back-checks')));
  expect(stored).toEqual([{ date: localDay(TUE), early: true }]);

  // Start runs what the card shows
  await page.locator('#sp-start').click();
  await expect(page.locator('#rehab-player')).toHaveClass(/open/);
  await page.locator('#rp-overview-btn').click();
  await expect(page.locator('#rpo-list')).toContainText('McGill Curl-Up');
  await expect(page.locator('#rpo-list')).not.toContainText('Elephant Walk');
  await expect(page.locator('#rpo-list')).not.toContainText('Seated Good Morning');
  expect(errors).toEqual([]);
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('kilos-rehab-state') || '{}'),
  );
  expect(saved.noFolds).toBe(true);

  // crash-safety: the same no-folds run comes back, not salvaged — the
  // restore rebuilds the queue with saved.noFolds and the fingerprint matches
  await page.reload();
  await expect(page.locator('#rehab-player')).toHaveClass(/open/);
  await expect(page.locator('#rp-meta')).not.toHaveText('');
  const after2 = await page.evaluate(() => ({
    saved: JSON.parse(localStorage.getItem('kilos-rehab-state') || '{}'),
    hist: JSON.parse(localStorage.getItem('workoutHistory') || '[]'),
  }));
  expect(after2.saved.noFolds).toBe(true);
  expect(after2.hist.filter((h) => h.rehabId === 'daily' && h.date > localDay(TUE)).length).toBe(0);
});

// After a refresh the in-player overview must be built from the DOSED
// session, like the queue — a restored no-folds (or short / amber) run must
// never list blocks it won't serve (bug found and fixed in round 6).
test('after a refresh, the overview still matches the dosed run (no folds)', async ({ page }) => {
  await openToday(page, TUE);
  await page.locator('#sp-back-early').click();
  await page.locator('#sp-start').click();
  await expect(page.locator('#rehab-player')).toHaveClass(/open/);
  await page.reload();
  await expect(page.locator('#rehab-player')).toHaveClass(/open/);
  await page.locator('#rp-overview-btn').click();
  await expect(page.locator('#rpo-list')).toContainText('McGill Curl-Up');
  await expect(page.locator('#rpo-list')).not.toContainText('Elephant Walk', { timeout: 2000 });
});

test('UP UNDER 1 HR is hidden on a day with no folds', async ({ page }) => {
  await openToday(page, FRI);
  await expect(page.locator('#sp-title')).toHaveText('FULL BODY III');
  await expect(page.locator('#sp-backcheck')).toBeVisible();
  await expect(page.locator('#sp-back-sleep')).toBeVisible();
  await expect(page.locator('#sp-back-early')).toBeHidden();
  await expect(page.locator('#sp-back-deload')).toBeHidden();
});

// amber on a fold day says the folds sit out — and they do
test('an amber Back & Hips day drops the folds and keeps one round of the pump', async ({ page }) => {
  await openToday(page, TUE);
  await page.locator('#sp-backcheck [data-back="stiff"]').click();
  // the note lists only what this day changes
  await expect(page.locator('#sp-back-note')).toHaveText('A shorter, lighter day: the folds sit out.');
  const list = page.locator('#sp-list');
  await expect(list).not.toContainText('Elephant Walk');
  await expect(list).not.toContainText('Seated Good Morning');
  await expect(list).not.toContainText('Calves');
  await expect(list).toContainText(/ARMS — SETS · 1 ROUND\b/);
  await expect(list).toContainText('DB Bench Press');
});

// PERSISTENT STIFFNESS (round-3 physio QA): five stiff-or-worse mornings in
// two weeks is a load problem — the check offers a deload week, one tap.
test('five stiff mornings in two weeks offer DELOAD THIS WEEK, and one tap runs it', async ({
  page,
}) => {
  await seedBackChecks(
    page,
    [2, 4, 6, 8, 10].map((n) => ({ date: daysBefore(TUE, n), back: 'stiff' })),
  );
  await openToday(page, TUE);
  const btn = page.locator('#sp-back-deload');
  await expect(btn).toBeVisible();
  await expect(btn).toHaveText('DELOAD THIS WEEK');
  await expect(page.locator('#sp-back-note')).toContainText(
    'A run of stiff mornings or short nights — a lighter week would help.',
  );
  // the full day is what it leads with until he taps it
  await expect(page.locator('#sp-dose-full')).toHaveAttribute('aria-pressed', 'true');
  await btn.click();
  // the deload is on, today is the short dose, and the offer is gone
  await expect(page.locator('#sp-dose-short')).toHaveAttribute('aria-pressed', 'true');
  await expect(btn).toBeHidden();
  await expect(page.locator('#sp-back-note')).not.toContainText('A run of stiff mornings');
  // the deload says what it is
  await expect(page.locator('#sp-back-note')).toContainText(
    'Deload week: every session leads with its short version.',
  );
  const deload = await page.evaluate(() => JSON.parse(localStorage.getItem('kilos-deload')));
  expect(deload?.monday).toBeTruthy();
});

test('four stiff mornings are not yet a deload', async ({ page }) => {
  await seedBackChecks(
    page,
    [2, 4, 6, 8].map((n) => ({ date: daysBefore(TUE, n), back: 'stiff' })),
  );
  await openToday(page, TUE);
  await expect(page.locator('#sp-back-deload')).toBeHidden();
});

test('three red mornings say physio, never deload', async ({ page }) => {
  await seedBackChecks(page, [
    ...[2, 4, 6].map((n) => ({ date: daysBefore(TUE, n), back: 'worse' })),
    ...[3, 5].map((n) => ({ date: daysBefore(TUE, n), back: 'stiff' })),
  ]);
  await openToday(page, TUE);
  await expect(page.locator('#sp-back-note')).toContainText('book a physio');
  await expect(page.locator('#sp-back-deload')).toBeHidden();
});

// THE BONUS WOD WAITS FOR A GOOD MORNING (round-3 physio QA): it is scored
// and raced — an amber or tired Sunday runs the Rest Day instead.
test('the Bonus WOD waits for a Good morning — amber or tired runs the Rest Day', async ({ page }) => {
  await page.clock.setFixedTime(SUN);
  await openProgram(page, { startWeeksAgo: 0 });
  await page.locator('[data-rehab="wod"]').click();
  await expect(page.locator('#session-preview')).toHaveClass(/open/);
  const check = page.locator('#sp-backcheck');
  const note = page.locator('#sp-back-note');
  const WAITS = 'The Bonus WOD waits for a Good morning — today runs the Rest Day.';
  // QA round ★2: unanswered, it waits too
  await expect(page.locator('#sp-title')).toHaveText('REST DAY');
  await expect(note).toContainText(WAITS);

  await check.locator('[data-back="stiff"]').click();
  await expect(page.locator('#sp-title')).toHaveText('REST DAY');
  await expect(note).toContainText(WAITS);
  await expect(page.locator('#sp-list')).toContainText('McGill Curl-Up');

  // a Good morning brings it back
  await check.locator('[data-back="good"]').click();
  await expect(page.locator('#sp-title')).toHaveText('THE BONUS WOD');
  await expect(note).not.toContainText('waits for a Good morning');

  // a short night on a good back waits too
  await page.locator('#sp-back-sleep').click();
  await expect(page.locator('#sp-title')).toHaveText('REST DAY');
  await expect(note).toContainText(WAITS);
  // and Start runs the Rest Day, not the WOD
  await page.locator('#sp-start').click();
  await expect(page.locator('#rehab-player')).toHaveClass(/open/);
  await expect(page.locator('#rp-exname')).toHaveText('T-Spine Reach');
});

// THE WEEK PLAN'S CHIPS GO THROUGH THE PREVIEW (round-3 QA): a chip must
// never be a way around a red or amber morning. The #week-plan host isn't in
// the shipped markup any more, so the test mounts it before the page opens.
test('a week-plan chip opens the session preview, not the player', async ({ page }) => {
  await page.clock.setFixedTime(TUE);
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const host = document.createElement('div');
      host.id = 'week-plan';
      (document.getElementById('rehab-page') || document.body).prepend(host);
    });
  });
  await openProgram(page, { startWeeksAgo: 0 });
  const chip = page.locator('.wp-chip[data-action="session:d40-b1"]').first();
  await expect(chip).toBeVisible();
  await chip.click();
  await expect(page.locator('#session-preview')).toHaveClass(/open/);
  await expect(page.locator('#sp-title')).toHaveText('FULL BODY II');
  await expect(page.locator('#sp-backcheck')).toBeVisible();
  await expect(page.locator('#rehab-player')).not.toHaveClass(/open/);
  // and the preview's answer applies: amber from the chip is still amber
  await page.locator('#sp-backcheck [data-back="stiff"]').click();
  await expect(page.locator('#sp-list')).not.toContainText('DB Push Press');
});

// THE PULL-UP PACK (round-3 coach QA; round 4: earned). From week 9 the pack
// goes on only after a session where every pull-up set (4+) hit 8 — and only
// then does a pull-up Monday ask what was in it, so the chart reads body +
// pack instead of guessing. Never asked before week 9.
const pullUpSession = (date, reps) => ({
  name: 'Density 40 · Full Body I', type: 'strength', programId: 'd40-a1', date,
  duration: '40 min', totalWeight: 0, sets: reps.length, newPRs: [],
  exercises: [{ name: 'Strict Pull-Up', sets: reps.length, logs: reps.map((r) => ({ weight: 0, reps: r, done: true })) }],
});
async function openMonday(page, weeksAgo, pullReps) {
  const m = new Date();
  m.setHours(0, 0, 0, 0);
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
  const lastMon = new Date(m.getTime() - 7 * 864e5 + 36e5).toISOString();
  await openProgram(page, {
    startWeeksAgo: weeksAgo,
    history: [
      ...(pullReps ? [pullUpSession(lastMon, pullReps)] : []),
      { name: 'Pull', type: 'strength', programId: 'd40-b1', date: new Date(m.getTime() + 36e5).toISOString(),
        duration: '30 min', totalWeight: 0, sets: 4, newPRs: [], exercises: [] },
    ],
  });
  await page.locator('[data-d40="d40-a1"]').click();
  await expect(page.locator('#session-preview')).toHaveClass(/open/);
}
async function finishAfterOnePullUpSet(page, { started = false } = {}) {
  if (!started) await page.locator('#sp-start').click();
  await expect(page.locator('#rehab-player')).toHaveClass(/open/);
  for (let i = 0; i < 40; i++) {
    const name = (await page.locator('#rp-exname').textContent()) || '';
    const meta = (await page.locator('#rp-meta').textContent()) || '';
    if (name === 'Strict Pull-Up' && /SET 1 OF 5/.test(meta)) break;
    await page.locator('#rp-skip').click();
    await page.waitForTimeout(60);
  }
  await expect(page.locator('#rp-meta')).toContainText('SET 1 OF 5');
  await page.locator('#rp-skip').click(); // logs the first pull-up set
  await page.locator('#rp-overview-btn').click();
  await page.locator('#rpo-finish').click();
  await page.locator('#btn-rhfinish-yes').click();
  // the anchor's reps-left question comes first — skip it
  await expect(page.locator('#bm-score')).toHaveClass(/open/);
  await expect(page.locator('#bm-score-title')).toHaveText('THE HEAVY LIFT — REPS LEFT');
  await page.locator('#bm-score-skip').click();
}
const lastPack = (page) =>
  page.evaluate(
    () =>
      JSON.parse(localStorage.getItem('workoutHistory') || '[]').findLast(
        (h) => h.programId === 'd40-a1',
      )?.pullupPackKg,
  );

test('week 9, pack earned: the anchor runs as written and the pack weight is logged', async ({
  page,
}) => {
  await openMonday(page, 8, [8, 8, 8, 8, 8]); // every set at 8 — earned
  // the first pack day (round 6): the bodyweight weakest − 3, never under 5
  await expect(page.locator('#sp-list')).toContainText(/Strict Pull-Up\s*×5/);
  await page.locator('#sp-start').click();
  for (let i = 0; i < 40; i++) {
    const name = (await page.locator('#rp-exname').textContent()) || '';
    const meta = (await page.locator('#rp-meta').textContent()) || '';
    if (name === 'Strict Pull-Up' && /SET 1 OF 5/.test(meta)) break;
    await page.locator('#rp-skip').click();
    await page.waitForTimeout(60);
  }
  await expect(page.locator('#rp-cue')).toContainText('Pack on — start at 2.5 kg');
  await page.locator('#rp-overview-btn').click();
  await page.locator('#rpo-close').click();
  await finishAfterOnePullUpSet(page, { started: true });
  await expect(page.locator('#bm-score')).toHaveClass(/open/);
  await expect(page.locator('#bm-score-title')).toHaveText('PULL-UPS — PACK WEIGHT');
  await expect(page.locator('#bm-unit')).toHaveText('kg');
  await expect(page.locator('#bm-val')).toHaveText('—'); // blank, never a guess
  await page.locator('#bm-plus').click();
  await expect(page.locator('#bm-val')).toHaveText('2.5');
  await page.locator('#bm-plus').click(); // the prompt steps 2.5 kg
  await expect(page.locator('#bm-val')).toHaveText('5');
  await page.locator('#bm-score-save').click();
  await expect.poll(() => lastPack(page)).toBe(5);
});

test('week 9, pack NOT earned: bodyweight, chasing 8s, and no pack prompt', async ({ page }) => {
  await openMonday(page, 8, [7, 7, 6, 6, 6]); // the 8s weren't owned
  // the rung is earned too: one over the weakest set last Monday
  await page.locator('#sp-start').click();
  await page.locator('#rp-overview-btn').click();
  await expect(page.locator('#rpo-list')).toContainText(/Strict Pull-Up\s*7/);
  await page.locator('#rpo-close').click();
  for (let i = 0; i < 40; i++) {
    const name = (await page.locator('#rp-exname').textContent()) || '';
    const meta = (await page.locator('#rp-meta').textContent()) || '';
    if (name === 'Strict Pull-Up' && /SET 1 OF 5/.test(meta)) break;
    await page.locator('#rp-skip').click();
    await page.waitForTimeout(60);
  }
  await expect(page.locator('#rp-meta')).toContainText('SET 1 OF 5');
  await expect(page.locator('#rp-cue')).toContainText(
    'No pack yet — bodyweight, chasing every 8. Own them all and it goes on.',
  );
  await page.locator('#rp-skip').click();
  await page.locator('#rp-overview-btn').click();
  await page.locator('#rpo-finish').click();
  await page.locator('#btn-rhfinish-yes').click();
  await expect(page.locator('#bm-score-title')).toHaveText('THE HEAVY LIFT — REPS LEFT');
  await page.locator('#bm-score-skip').click();
  await page.waitForTimeout(1200);
  await expect(page.locator('#bm-score')).not.toHaveClass(/open/);
  expect(await lastPack(page)).toBeUndefined();
});

test('week 8: no pack prompt — even with every 8 owned', async ({ page }) => {
  await openMonday(page, 7, [8, 8, 8, 8, 8]);
  await finishAfterOnePullUpSet(page);
  await page.waitForTimeout(1200);
  await expect(page.locator('#bm-score')).not.toHaveClass(/open/);
  expect(await lastPack(page)).toBeUndefined();
});

// THE LADDERS ARE EARNED (round 4): a weekly rung is never more than one rep
// over the weakest set last time on that day.
test('the ladder is capped at one over the weakest set last time', async ({ page }) => {
  // week 7 schedules 8 strict pull-ups on Monday; last Monday's weakest was 5
  await openMonday(page, 6, [6, 6, 5, 5, 5]);
  await expect(page.locator('#sp-list')).toContainText(/Strict Pull-Up\s*×6/);
});

// round 5: the ladder moves BOTH ways — an owned rung above the calendar
// is served too (week 1 schedules 5; last Monday's weakest set was 7)
test('the ladder climbs past the calendar when the reps were owned', async ({ page }) => {
  await openMonday(page, 0, [8, 8, 7, 7, 7]);
  await expect(page.locator('#sp-list')).toContainText(/Strict Pull-Up\s*×8/);
});

test('with no history on the day, the ladder runs as scheduled', async ({ page }) => {
  await openMonday(page, 6, null);
  await expect(page.locator('#sp-list')).toContainText(/Strict Pull-Up\s*×8/);
});

// the calendar's one phase flag is the earned pack (round 3); week 5's old
// pull-up step is gone
test('the calendar flags week 9 as the pack, and nothing at week 5', async ({ page }) => {
  await openProgram(page, { startWeeksAgo: 8 });
  await expect(page.locator('.blk-name')).toContainText('WK 9/12');
  await expect(page.locator('.cal-week.cal-now')).toContainText(
    'PHASE 3 — Monday pull-ups earn the pack',
  );
  await expect(page.locator('#rehab-page')).not.toContainText('PHASE 2');
});

// ROUND 4: a GET SET in front of a block that brings its own cue says THAT
// cue — Thursday's back extension is a hold, never the rep cue
test('Thursday: the back-extension GET SET already reads the hold cue', async ({ page }) => {
  const THU = new Date(2026, 9, 15, 7, 30);
  await openToday(page, THU);
  await expect(page.locator('#sp-list')).toContainText('Back Extension');
  await page.locator('#sp-start').click();
  await expect(page.locator('#rehab-player')).toHaveClass(/open/);
  for (let i = 0; i < 80; i++) {
    const name = (await page.locator('#rp-exname').textContent()) || '';
    if (name === 'Back Extension') break;
    await page.locator('#rp-skip').click();
    await page.waitForTimeout(40);
  }
  await expect(page.locator('#rp-exname')).toHaveText('Back Extension');
  await expect(page.locator('#rp-phase')).toHaveText('GET SET');
  await expect(page.locator('#rp-cue')).toContainText('STAY there');
  await page.locator('#rp-skip').click();
  await expect(page.locator('#rp-phase')).toHaveText('HOLD');
  await expect(page.locator('#rp-cue')).toContainText('STAY there');
});

// ROUND 4: the morning rule reaches Monday — a loaded hinge in the first
// waking hour is the week's riskiest bend, so the RDL bridges and its ramp
// drops. Wednesday and Friday have nothing to swap, so the toggle hides.
test('UP UNDER 1 HR on a Monday: the RDL becomes a glute bridge', async ({ page }) => {
  const MON = new Date(2026, 9, 12, 7, 30);
  await page.clock.setFixedTime(MON);
  await openProgram(page, { startWeeksAgo: 0 });
  await page.locator('[data-d40="d40-a1"]').click();
  await expect(page.locator('#session-preview')).toHaveClass(/open/);
  await expect(page.locator('#sp-title')).toHaveText('FULL BODY I');
  const early = page.locator('#sp-back-early');
  await expect(early).toBeVisible();
  const list = page.locator('#sp-list');
  await expect(list).toContainText('Romanian Deadlift');
  await expect(list).toContainText('warm-up ramp');
  await early.click();
  await expect(early).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#sp-back-note')).toContainText(
    'Up under an hour: the RDL becomes a glute bridge — or train later and untick this.',
  );
  await expect(list).not.toContainText('Romanian Deadlift');
  await expect(list).toContainText('Glute Bridge');
  // the rest of Monday is as written
  await expect(list).toContainText('Strict Pull-Up');
  await expect(list).toContainText('Chest-Supported DB Row');
  // untick it and the hinge is back
  await early.click();
  await expect(list).toContainText('Romanian Deadlift');
});

test('UP UNDER 1 HR is hidden on Wednesday', async ({ page }) => {
  await openToday(page, WED);
  await expect(page.locator('#sp-back-sleep')).toBeVisible();
  await expect(page.locator('#sp-back-early')).toBeHidden();
});

// round 5: the Back & Hips preview names its first act
test('the Back & Hips preview opens on OPEN UP, THEN BRACE', async ({ page }) => {
  await openToday(page, TUE);
  await expect(page.locator('#sp-list .sp-row-kicker').first()).toHaveText('OPEN UP, THEN BRACE');
  await expect(page.locator('#sp-list')).not.toContainText('THE HOLDS — ONE SET EACH');
});

// ROUND 6: a flare mid-session is one tap from the overview — it marks
// today red (with the movement that flared), saves what was done, and ends.
test('Back flared — stop here: saves the sets, marks today red, ends the run', async ({ page }) => {
  await openToday(page, WED);
  await page.locator('#sp-backcheck [data-back="good"]').click();
  await page.locator('#sp-start').click();
  await expect(page.locator('#rehab-player')).toHaveClass(/open/);
  for (let i = 0; i < 4; i++) {
    await page.locator('#rp-skip').click();
    await page.waitForTimeout(60);
  }
  const ex = await page.evaluate(() => {
    const st = JSON.parse(localStorage.getItem('kilos-rehab-state') || '{}');
    return st.sessionId;
  });
  expect(ex).toBe('d40-b1');
  await page.locator('#rp-overview-btn').click();
  const flare = page.locator('#rpo-flare');
  await expect(flare).toHaveText('Back flared — stop here');
  // QA round ★6: two taps — the first only arms it
  await flare.click();
  await expect(flare).toHaveText('Tap again to stop — back flared');
  await expect(page.locator('#rehab-player')).toHaveClass(/open/);
  await flare.click();
  await expect(page.locator('#rehab-player')).not.toHaveClass(/open/);
  // the summary says it stopped, shows the warning signs, and asks nothing
  await expect(page.locator('#wsum-eyebrow')).toHaveText('STOPPED — BACK FLARED');
  await expect(page.locator('#wsum-flare')).toBeVisible();
  await expect(page.locator('#wsum-flare')).toContainText('EMERGENCY DEPARTMENT NOW');
  await page.waitForTimeout(1200);
  await expect(page.locator('#bm-score')).not.toHaveClass(/open/);
  const after = await page.evaluate(() => ({
    checks: JSON.parse(localStorage.getItem('kilos-back-checks') || '[]'),
    hist: JSON.parse(localStorage.getItem('workoutHistory') || '[]'),
  }));
  const todayCheck = after.checks.find((c) => c.date === localDay(WED));
  expect(todayCheck.back).toBe('worse');
  expect(typeof todayCheck.flare).toBe('string');
  expect(todayCheck.flare.length).toBeGreaterThan(0);
  const run = after.hist.find(
    (h) => h.programId === 'd40-b1' && localDay(new Date(h.date)) === localDay(WED),
  );
  expect(run?.endedEarly).toBe(true);
});

// THE LADDER CAP (round 6 mechanism, now only on the pull-up anchor): a
// weekly rung is one over the weakest set last time — but never past the
// anchor's cap of 10 bodyweight reps
test('the pull-up ladder never climbs past its cap of 10', async ({ page }) => {
  await openMonday(page, 6, [10, 10, 10, 10, 10]); // week 7, all tens owned
  await expect(page.locator('#sp-list')).toContainText(/Strict Pull-Up\s*×10/);
  await expect(page.locator('#sp-list')).not.toContainText(/Strict Pull-Up\s*×11/);
});

// NO SLIDERS (his kit): the hamstring curl is a cable curl — Wednesday 8/leg
// in the superset, reps-first like the other small lifts
test('Wednesday\'s cable leg curl earns reps first', async ({ page }) => {
  const ctx = await supersetContext(page, {
    sessionId: 'd40-b1',
    exName: 'Cable Leg Curl',
    // 45-min round: Wednesday's curl is 10/leg — every set hit last time
    logs: Array.from({ length: 3 }, () => ({ weight: 20, reps: 10, done: true })),
    checks: [{ date: today(), back: 'good' }],
  });
  await expect(ctx).toContainText('LAST 20×10');
  await expect(ctx).toContainText(/TARGET 20\s*(kg|lbs) × 11/);
  await expect(page.locator('#rp-meta')).toContainText('10/leg');
});

// SPRINT ROUND: Saturday sprints — four shapes rotating weekly, one build
// minute then fast reps on an every-minute clock, never scored. A stiff
// morning drops them; no room to run swaps to high knees for the same secs.
test('Saturday runs its sprints after the Big 3, and amber drops them', async ({ page }) => {
  await openToday(page, SAT);
  const list = page.locator('#sp-list');
  // unanswered: no sprints yet (QA round ★2)
  await expect(list).not.toContainText('SPRINTS: STARTS');
  await page.locator('#sp-backcheck [data-back="good"]').click();
  await expect(list).toContainText('SPRINTS: STARTS');
  await page.locator('#sp-start').click();
  await expect(page.locator('#rehab-player')).toHaveClass(/open/);
  for (let i = 0; i < 80; i++) {
    const head = (await page.locator('#rp-session-name').textContent()) || '';
    if (/^SPRINTS/.test(head) && (await page.locator('#rp-exname').textContent()) === 'Sprint') break;
    await page.locator('#rp-skip').click();
    await page.waitForTimeout(40);
  }
  await expect(page.locator('#rp-session-name')).toContainText('SPRINTS: STARTS');
  await expect(page.locator('#rp-exname')).toHaveText('Sprint');
  // three build rounds come first on 90 s, unlogged: jog + drills,
  // strides, one stride at the day's effort
  await expect(page.locator('#rp-meta')).toContainText('WARM-UP 1 OF 3');
  await expect(page.locator('#rp-cue')).toContainText('Jog');
  await expect(page.locator('#rp-time')).toHaveText('1:30');
  await page.locator('#rp-skip').click();
  await expect(page.locator('#rp-meta')).toContainText('WARM-UP 2 OF 3');
  await expect(page.locator('#rp-cue')).toContainText('70%');
  await page.locator('#rp-skip').click();
  await expect(page.locator('#rp-meta')).toContainText('WARM-UP 3 OF 3');
  await page.locator('#rp-skip').click();
  await expect(page.locator('#rp-meta')).toContainText('MIN 4 OF 8');
  await expect(page.locator('#rp-cue')).toContainText('Effort ~80%');
  // nothing to weigh on a sprint
  await expect(page.locator('#rp-lift .rp-weight-row')).toBeHidden();
  // no score prompt at the end of it — the next step is the back extension
  for (let i = 0; i < 8; i++) {
    if ((await page.locator('#rp-exname').textContent()) !== 'Sprint') break;
    await page.locator('#rp-skip').click();
    await page.waitForTimeout(40);
  }
  await expect(page.locator('#rp-exname')).toHaveText('Back Extension');
  await expect(page.locator('#bm-score')).not.toHaveClass(/open/);
});

test('a stiff Saturday has no sprints', async ({ page }) => {
  await openToday(page, SAT);
  await page.locator('#sp-backcheck [data-back="stiff"]').click();
  await expect(page.locator('#sp-list')).not.toContainText(/Sprint/);
});

// THE EMOM DAY: from week 2 one lift day a week runs its supersets as an
// EMOM (week 2 = Monday). Same exercises, same sets — and (QA round) its
// minutes are real working sets: REPS DONE row, confirmed reps and the heavy
// flag logged, never "eased".
test('week 2 Monday is the EMOM day — supersets on the minute, reps confirmed', async ({ page }) => {
  // trained yesterday too, so no week-away easing colours the logged sets
  const m = thisMondayLocal();
  await openProgram(page, {
    startWeeksAgo: 1,
    history: [
      { ...begun(new Date(m.getTime() - 7 * 864e5)) },
      { ...begun(m), programId: 'd40-b1', date: new Date(Date.now() - 864e5).toISOString() },
    ],
  });
  await expect(page.locator('.blk-name')).toContainText('WK 2/12');
  await page.locator('[data-d40="d40-a1"]').click();
  const list = page.locator('#sp-list');
  // week 2 is Wings' heavy week too — the EMOM day keeps it
  await expect(list).toContainText('WINGS — EMOM · HEAVY 12 · 4 ROUNDS');
  // the per-leg calf minute runs 90 s: 60 + 90 per round, three rounds
  await expect(list).toContainText('HINGE & CALF — EMOM 8 · 3 ROUNDS');
  // only Wings is heavy this week — the hinge never is
  await expect(list).not.toContainText('HINGE & CALF — EMOM · HEAVY');
  await page.locator('#sp-start').click();
  await expect(page.locator('#rehab-player')).toHaveClass(/open/);
  for (let i = 0; i < 80; i++) {
    const name = (await page.locator('#rp-exname').textContent()) || '';
    const head = (await page.locator('#rp-session-name').textContent()) || '';
    if (name === 'Chest-Supported DB Row' && /^WINGS/.test(head)) break;
    await page.locator('#rp-skip').click();
    await page.waitForTimeout(40);
  }
  await expect(page.locator('#rp-session-name')).toContainText('WINGS · EMOM · HEAVY 12');
  // a working minute: REPS DONE at the heavy prescription (10 × 0.7)
  await expect(page.locator('#rp-anchor-reps')).toBeVisible();
  await expect(page.locator('#rp-ar-val')).toHaveText('7');
  await page.locator('#rp-ar-minus').click();
  await page.locator('#rp-skip').click(); // the minute logs itself on the way past
  const sets = await page.evaluate(() =>
    (JSON.parse(localStorage.getItem('kilos-rehab-state') || '{}').liftSets || []).filter(
      (s) => s.exId === 'chest-supported-row',
    ),
  );
  expect(sets).toHaveLength(1);
  expect(sets[0].reps).toBe(6);
  expect(sets[0].heavy).toBe(true);
  expect(sets[0].eased).toBeUndefined();
});

test('week 2 Wednesday is not the EMOM day — supersets stay SETS', async ({ page }) => {
  await openProgram(page, { startWeeksAgo: 1 });
  await page.locator('[data-d40="d40-b1"]').click();
  await expect(page.locator('#sp-list')).toContainText(/SPLIT SQUAT & CURL — (SETS|HEAVY|LAST SET MAX) · 3 ROUNDS/);
  await expect(page.locator('#sp-list')).not.toContainText('SPLIT SQUAT & CURL — EMOM');
});

// ★6: the first tap disarms itself after three seconds
test('Back flared: one tap alone stops nothing and disarms after 3 s', async ({ page }) => {
  await openToday(page, WED);
  await page.locator('#sp-backcheck [data-back="good"]').click();
  await page.locator('#sp-start').click();
  await page.locator('#rp-skip').click();
  await page.locator('#rp-overview-btn').click();
  const flare = page.locator('#rpo-flare');
  await flare.click();
  await expect(flare).toHaveText('Tap again to stop — back flared');
  await expect(flare).toHaveText('Back flared — stop here', { timeout: 4500 });
  await expect(page.locator('#rehab-player')).toHaveClass(/open/);
  const check = await page.evaluate(() => JSON.parse(localStorage.getItem('kilos-back-checks')));
  expect(check.find((c) => c.date === localDay(WED)).back).toBe('good');
});

// ── QA ROUND REGRESSIONS ────────────────────────────────────────────────────
// ★1 DOSES COMPOSE: a run built from two doses (a short day on a short night,
// a short day before the check is answered) must restore after a reload to
// the exact same queue — the old single-valued dose retired it as stale.
async function startDosed(page, when, { answer, shortSleep, early }) {
  await openToday(page, when);
  const check = page.locator('#sp-backcheck');
  if (answer) await check.locator(`[data-back="${answer}"]`).click();
  if (shortSleep) await page.locator('#sp-back-sleep').click();
  if (early) await page.locator('#sp-back-early').click();
  await page.locator('#sp-dose-short').click();
  await expect(page.locator('#sp-dose-short')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#sp-start').click();
  await expect(page.locator('#rehab-player')).toHaveClass(/open/);
  for (let i = 0; i < 5; i++) {
    await page.locator('#rp-skip').click();
    await page.waitForTimeout(60);
  }
}
const runState = (page) =>
  page.evaluate(() => ({
    st: JSON.parse(localStorage.getItem('kilos-rehab-state') || '{}'),
    hist: JSON.parse(localStorage.getItem('workoutHistory') || '[]'),
  }));
for (const [label, when, opts, dose, title] of [
  ['short + tired', WED, { answer: 'good', shortSleep: true }, 'short+tired', 'SHORT VERSION · SHORT-NIGHT VERSION'],
  ['short + unchecked', WED, {}, 'short+unchecked', 'SHORT VERSION · NO JUMPS UNTIL CHECKED IN'],
  ['short + unchecked + no folds', TUE, { early: true }, 'short+unchecked', 'SHORT VERSION · NO JUMPS UNTIL CHECKED IN'],
]) {
  test(`a ${label} run restores to the same queue after a reload`, async ({ page }) => {
    await startDosed(page, when, opts);
    const before = await runState(page);
    expect(before.st.dose).toBe(dose);
    if (opts.early) expect(before.st.noFolds).toBe(true);
    const meta = await page.locator('#rp-meta').textContent();
    const name = await page.locator('#rp-exname').textContent();
    // the overview title says what the run IS
    await page.locator('#rp-overview-btn').click();
    await expect(page.locator('#rpo-title')).toContainText(title);
    await page.locator('#rpo-close').click();

    await page.reload();
    await expect(page.locator('#rehab-player')).toHaveClass(/open/);
    await expect(page.locator('#rp-exname')).toHaveText(name || '');
    await expect(page.locator('#rp-meta')).toHaveText(meta || '');
    const after = await runState(page);
    expect(after.st.queueSig).toBe(before.st.queueSig);
    expect(after.st.dose).toBe(dose);
    expect(after.st.idx).toBe(before.st.idx);
    // nothing was retired as interrupted
    expect(after.hist.filter((h) => h.interrupted || h.salvaged)).toHaveLength(0);
    await page.locator('#rp-overview-btn').click();
    await expect(page.locator('#rpo-title')).toContainText(title);
  });
}

test('the overview title says FULL SESSION on a full Good day', async ({ page }) => {
  await openToday(page, WED);
  await page.locator('#sp-backcheck [data-back="good"]').click();
  await page.locator('#sp-start').click();
  await page.locator('#rp-overview-btn').click();
  await expect(page.locator('#rpo-title')).toContainText('· FULL SESSION');
});

// ★2: a RED morning previews what Start will run — the Daily Reset
test('a red morning previews the Daily Reset itself, not the day', async ({ page }) => {
  await openToday(page, WED);
  await page.locator('#sp-backcheck [data-back="worse"]').click();
  await expect(page.locator('#sp-title')).toHaveText('DAILY RESET');
  await expect(page.locator('#sp-list')).toContainText('Cat-Camel');
  await expect(page.locator('#sp-list')).not.toContainText('Front Squat');
  // GOOD puts the day back
  await page.locator('#sp-backcheck [data-back="good"]').click();
  await expect(page.locator('#sp-title')).toHaveText('FULL BODY II');
});

// ★5: REPS DONE survives a refresh mid-minute
test('the REPS DONE value survives a refresh', async ({ page }) => {
  await openToday(page, WED);
  await page.locator('#sp-backcheck [data-back="good"]').click();
  await page.locator('#sp-start').click();
  for (let i = 0; i < 60; i++) {
    const head = (await page.locator('#rp-session-name').textContent()) || '';
    const meta = (await page.locator('#rp-meta').textContent()) || '';
    if (/^THE ANCHOR/.test(head) && /SET 1 OF 4/.test(meta)) break;
    await page.locator('#rp-skip').click();
    await page.waitForTimeout(60);
  }
  await expect(page.locator('#rp-meta')).toContainText('SET 1 OF 4');
  await page.locator('#rp-ar-minus').click();
  await page.locator('#rp-ar-minus').click();
  await expect(page.locator('#rp-ar-val')).toHaveText('3');
  await expect
    .poll(async () => (await runState(page)).st.arSaved?.reps)
    .toBe(3);
  await page.reload();
  await expect(page.locator('#rehab-player')).toHaveClass(/open/);
  await expect(page.locator('#rp-meta')).toContainText('SET 1 OF 4');
  await expect(page.locator('#rp-ar-val')).toHaveText('3');
});
