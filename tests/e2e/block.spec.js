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

test('week 6 is phase 2 and serves the phase-2 accessories', async ({ page }) => {
  await openProgram(page, { startWeeksAgo: 5 });
  await expect(page.locator('.blk-name')).toContainText('WK 6/12');
  await expect(page.locator('.blk-phase')).toContainText('PRESS');
  // phase 2 swaps the DB lateral raise to the cable version
  await page.locator('[data-d40="d40-b2"]').click();
  await page.locator('#rp-overview-btn').click();
  const rows = (await page.locator('#rpo-list').textContent())?.replace(/\s+/g, ' ');
  console.log('WK6 b2 overview:', rows?.slice(0, 180));
  expect(rows).toContain('Cable Lateral Raise');
  expect(rows).not.toContain('DB Lateral Raise');
});

test('phase 2 adds the lat sets that close the audit gap', async ({ page }) => {
  await openProgram(page, { startWeeksAgo: 5 });
  await page.locator('[data-d40="d40-a1"]').click();
  await page.locator('#rp-overview-btn').click();
  const rows = (await page.locator('#rpo-list').textContent())?.replace(/\s+/g, ' ');
  console.log('WK6 a1 overview:', rows?.slice(-160));
  expect(rows).toContain('Lat Pulldown');
});

test('phase 3 adds the quad sets', async ({ page }) => {
  await openProgram(page, { startWeeksAgo: 9 }); // week 10
  await expect(page.locator('.blk-phase')).toContainText('PEAK');
  await page.locator('[data-d40="d40-b1"]').click();
  await page.locator('#rp-overview-btn').click();
  const rows = (await page.locator('#rpo-list').textContent())?.replace(/\s+/g, ' ');
  console.log('WK10 b1 overview:', rows?.slice(0, 200));
  expect(rows).toContain('5 × 8–10/leg');
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
// variety that costs nothing. Popeye rotates EMOM → EMOM↓ → for time.
async function popeyeOverview(page, week) {
  await openProgram(page, { startWeeksAgo: week - 1 });
  await page.locator('[data-d40="d40-b2"]').click();
  await page.locator('#rp-overview-btn').click();
  return (await page.locator('#rpo-list').textContent())?.replace(/\s+/g, ' ');
}
const POPEYE_MOVES = [
  'DB Lateral Raise',
  'Rope Face Pull',
  'DB Wrist Curl',
  'Band Lateral Raise',
];

test('week 1 runs Popeye as an EMOM', async ({ page }) => {
  const t = await popeyeOverview(page, 1);
  console.log('POPEYE wk1:', t?.slice(-150));
  expect(t).toContain('Popeye');
  expect(t).toContain('EMOM 15');
});

test('week 3 runs the same piece for time — movements untouched', async ({ page }) => {
  const t = await popeyeOverview(page, 3);
  console.log('POPEYE wk3:', t?.slice(-170));
  expect(t).toContain('3 rounds for time');
  expect(t).not.toContain('EMOM 15');
  for (const m of POPEYE_MOVES) expect(t, m).toContain(m);
});

test('week 2 runs it descending — top of the range down, same 3 sets', async ({ page }) => {
  await openProgram(page, { startWeeksAgo: 1 }); // week 2
  await page.locator('[data-d40="d40-b2"]').click();
  for (let i = 0; i < 12; i++) {
    if ((await page.locator('#rp-session-name').textContent())?.includes('POPEYE')) break;
    await page.locator('#rp-skip').click();
    await page.waitForTimeout(60);
  }
  await expect(page.locator('#rp-session-name')).toContainText('POPEYE');
  await expect(page.locator('#rp-session-name')).toContainText('EMOM ↓');
  // lateral raise is prescribed 12-20, so a descending scheme opens at 20
  await expect(page.locator('#rp-exname')).toHaveText('DB Lateral Raise');
  const meta = await page.locator('#rp-meta').textContent();
  console.log('POPEYE wk2 first minute:', meta);
  await expect(page.locator('#rp-meta')).toContainText('MIN 1 OF 15');
});
