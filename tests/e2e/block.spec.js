import { expect, test } from '@playwright/test';
import { dismissOnboarding } from './helpers.js';

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
  // PHASE_SWAPS is retired (2026-08-10) — weekly rotation superseded it. Week
  // 6 resolves to variant 1 of every pool, where the side-delt slot serves
  // the band raise (DB ↔ band since the one-pulley rule, 2026-08-11), so the
  // assertion holds through the rotation itself.
  await page.locator('[data-d40="d40-c1"]').click();
  await page.locator('#rp-overview-btn').click();
  const rows = (await page.locator('#rpo-list').textContent())?.replace(/\s+/g, ' ');
  console.log('WK6 c1 overview:', rows?.slice(0, 180));
  expect(rows).toContain('Band Lateral Raise');
  expect(rows).not.toContain('DB Lateral Raise');
});

// The phase step is a fifth ANCHOR set now (2026-08-10), not an extra piece
// member — see block.js for why it moved.
test('phase 2 steps the pull anchor to five working rounds', async ({ page }) => {
  await openProgram(page, { startWeeksAgo: 5 });
  await page.locator('[data-d40="d40-a1"]').click();
  await page.locator('#rp-overview-btn').click();
  const rows = (await page.locator('#rpo-list').textContent())?.replace(/\s+/g, ' ');
  console.log('WK6 a1 overview:', rows?.slice(0, 220));
  // bodyweight pull-ups: two-minute clock, no build rounds
  expect(rows).toContain('E2M 10 · 5 rounds');
});

test('phase 3 steps the squat anchor to five working rounds', async ({ page }) => {
  await openProgram(page, { startWeeksAgo: 9 }); // week 10
  await expect(page.locator('.blk-phase')).toContainText('PEAK');
  await page.locator('[data-d40="d40-b1"]').click();
  await page.locator('#rp-overview-btn').click();
  const rows = (await page.locator('#rpo-list').textContent())?.replace(/\s+/g, ' ');
  console.log('WK10 b1 overview:', rows?.slice(0, 200));
  expect(rows).toContain('E3M 18 · 6 rounds (1 to build)');
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
  const mk = (weeksAgo, weight) => {
    const d = new Date();
    d.setDate(d.getDate() - weeksAgo * 7);
    return {
      name: 'Pull', type: 'strength', programId: 'd40-a1', date: d.toISOString(),
      duration: '30 min', totalWeight: 0, sets: 4, newPRs: [],
      exercises: [{ name: 'Weighted Pull-Up', logs: [{ weight, reps: 6, done: true }] }],
    };
  };
  // +10kg over 5 weeks — comfortably past the ~5% a real 1RM change must clear
  await openProgram(page, { startWeeksAgo: 5, history: [mk(5, 20), mk(0, 30)] });
  const bp = page.locator('#block-progress');
  await expect(bp).toContainText('Weighted Pull-Up');
  const txt = (await bp.textContent())?.replace(/\s+/g, ' ');
  console.log('PROGRESS:', txt?.slice(0, 260));
  expect(txt).toMatch(/\+[\d.]+(kg|lbs) since wk 1/);
  await expect(bp.locator('.spark').first()).toBeVisible();
  // untested benchmarks say so rather than showing a fake zero
  expect(txt).toContain('not tested yet');
});

test('a tiny gain reads as flat, not as progress', async ({ page }) => {
  const mk = (weeksAgo, weight) => {
    const d = new Date();
    d.setDate(d.getDate() - weeksAgo * 7);
    return {
      name: 'Pull', type: 'strength', programId: 'd40-a1', date: d.toISOString(),
      duration: '30 min', totalWeight: 0, sets: 4, newPRs: [],
      exercises: [{ name: 'Weighted Pull-Up', logs: [{ weight, reps: 6, done: true }] }],
    };
  };
  // 20 -> 20.5kg is ~2.5%, inside 1RM measurement error
  await openProgram(page, { startWeeksAgo: 5, history: [mk(5, 20), mk(0, 20.5)] });
  const txt = (await page.locator('#block-progress').textContent())?.replace(/\s+/g, ' ');
  console.log('FLAT CASE:', txt?.slice(0, 160));
  expect(txt).toContain('flat — inside the noise');
});

test('Sunday now has a real engine session, not a checkbox', async ({ page }) => {
  await openProgram(page, { startWeeksAgo: 0 });
  const card = page.locator('[data-rehab="engine"]');
  await expect(card).toContainText('The Long Way');
  await card.click();
  await expect(page.locator('#rehab-player')).toHaveClass(/open/);
  await expect(page.locator('#rp-exname')).toHaveText('Box Step-Up');
});

// Same movements, same sets, different delivery — the only week-to-week
// variety that costs nothing. The Gate rotates EMOM → EMOM↓ → for time.
async function gateOverview(page, week) {
  await openProgram(page, { startWeeksAgo: week - 1 });
  await page.locator('[data-d40="d40-c1"]').click();
  await page.locator('#rp-overview-btn').click();
  return (await page.locator('#rpo-list').textContent())?.replace(/\s+/g, ' ');
}
// The piece is named per week of the rotation, so the overview assertions
// match the pool, not one name.
const PRESS_PIECE_NAMES = /The (Gate|Cage|Bellows|Furnace)/;
// The Gate's slot pattern asserts five of the eight stations: [hinge ·
// chest · side delt · rear delt · lungs]. Which MOVEMENT fills each slot
// depends on the variant, so the test asserts the pattern survived the
// format change, not one particular week's line-up. The alternations are
// deliberately the AS-BUILT palette (no cable movements — the one-pulley
// rule lives in verify-program.mjs; this just keeps the UI honest).
const GATE_SLOTS = [
  /Romanian Deadlift/,
  /Band Fly|Push-Up/,
  /Lateral Raise/,
  /Pull-Apart/,
  /Jumping Jack|High Knees|Skater Bound|Reverse Lunge/,
];

test('week 1 runs The Gate as an EMOM', async ({ page }) => {
  const t = await gateOverview(page, 1);
  console.log('GATE wk1:', t?.slice(-200));
  expect(t).toMatch(PRESS_PIECE_NAMES);
  expect(t).toContain('EMOM 35');
  for (const slot of GATE_SLOTS) expect(t, String(slot)).toMatch(slot);
});

// Consolidating the day into one piece put the hinge inside it, so every piece
// now runs on forced rest — the rotation is EMOM → EMOM ↓ → EMOM. A self-paced
// clock has no rest floor, and the hinge needs one.
test('week 3 comes back round to the EMOM — never self-paced', async ({ page }) => {
  const t = await gateOverview(page, 3);
  console.log('GATE wk3:', t?.slice(-200));
  expect(t).toContain('EMOM 35');
  expect(t).not.toContain('for time');
  for (const slot of GATE_SLOTS) expect(t, String(slot)).toMatch(slot);
});

// The press day's piece is a DIFFERENT NAMED WORKOUT each week of the rotation
// — Gate, Cage, Bellows, Furnace — so the test matches the day's name pool
// rather than one name. Which one comes up depends on completed runs.
const PRESS_PIECES = /THE (GATE|CAGE|BELLOWS|FURNACE)/;

test('week 2 runs it descending — top of the range down, same 4 sets', async ({ page }) => {
  await openProgram(page, { startWeeksAgo: 1 }); // week 2
  await page.locator('[data-d40="d40-c1"]').click();
  for (let i = 0; i < 40; i++) {
    if (PRESS_PIECES.test((await page.locator('#rp-session-name').textContent()) || '')) break;
    await page.locator('#rp-skip').click();
    await page.waitForTimeout(60);
  }
  await expect(page.locator('#rp-session-name')).toHaveText(PRESS_PIECES);
  await expect(page.locator('#rp-session-name')).toContainText('EMOM ↓');
  const meta = await page.locator('#rp-meta').textContent();
  console.log('GATE wk2 first minute:', meta);
  await expect(page.locator('#rp-meta')).toContainText('MIN 1 OF 32');
});
