import { expect, test } from '@playwright/test';
import { dismissOnboarding } from './helpers.js';

// BLOCK-01's benchmarks. What has to hold: all three are reachable, the new
// movements render a demo (a blank demo is a broken exercise), the ladder
// counts up, and a finished run stores a score you can beat next time.

async function openBenchmarks(page) {
  await page.locator('.nav-btn[data-screen="train"]').click();
  await page.locator('#btn-rehab-open').click();
  await expect(page.locator('#benchmark-list .rhs-card').first()).toBeVisible();
}

test('all three benchmarks are listed, untested, with their retest cadence', async ({ page }) => {
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/');
  await dismissOnboarding(page);
  await openBenchmarks(page);
  const cards = page.locator('#benchmark-list .rhs-card');
  await expect(cards).toHaveCount(3);
  const txt = (await cards.allTextContents()).map((t) => t.replace(/\s+/g, ' ').trim());
  console.log('BENCHMARKS:', JSON.stringify(txt, null, 1));
  expect(txt.join(' ')).toContain('NOT YET TESTED');
  expect(txt.join(' ')).toContain('WEEK 1 + 6 + 12');
  expect(errors).toEqual([]);
});

test('the new movements render a real demo, not an empty box', async ({ page }) => {
  await page.goto('/');
  await dismissOnboarding(page);
  await openBenchmarks(page);
  await page.locator('[data-benchmark="bm-descent"]').click();
  await expect(page.locator('#rehab-player')).toHaveClass(/open/);
  await expect(page.locator('#rp-exname')).toHaveText('Box Squat');
  const paths = await page.locator('#rp-demo svg path').count();
  console.log('box-squat demo paths:', paths);
  expect(paths).toBeGreaterThan(5);
  for (let i = 0; i < 6; i++) {
    if ((await page.locator('#rp-exname').textContent()) === 'Push-Up') break;
    await page.locator('#rp-skip').click();
    await page.waitForTimeout(60);
  }
  await expect(page.locator('#rp-exname')).toHaveText('Push-Up');
  expect(await page.locator('#rp-demo svg path').count()).toBeGreaterThan(5);
});

test('The Three runs as one 20-minute AMRAP with its movement list', async ({ page }) => {
  await page.goto('/');
  await dismissOnboarding(page);
  await openBenchmarks(page);
  await page.locator('[data-benchmark="bm-three"]').click();
  await page.locator('#rp-skip').click(); // past the prep step
  await expect(page.locator('#rp-session-name')).toContainText('THE THREE · AMRAP 20');
  await expect(page.locator('#rp-time')).toHaveText('20:00');
  const cue = await page.locator('#rp-cue').textContent();
  console.log('THE THREE cue:', cue);
  expect(cue).toContain('Strict Pull-Up 5');
  expect(cue).toContain('Push-Up 10');
  expect(cue).toContain('Box Squat 15');
});

test('Descent counts down 21-15-9', async ({ page }) => {
  await page.goto('/');
  await dismissOnboarding(page);
  await openBenchmarks(page);
  await page.locator('[data-benchmark="bm-descent"]').click();
  await page.locator('#rp-skip').click(); // past the prep step into the piece
  await expect(page.locator('#rp-session-name')).toContainText('DESCENT · 21-15-9');
  await expect(page.locator('#rp-meta')).toContainText('21 REPS · SET 1 OF 3');
  for (let i = 0; i < 2; i++) await page.locator('#rp-skip').click();
  await expect(page.locator('#rp-meta')).toContainText('15 REPS · SET 2 OF 3');
});

test('a finished for-time benchmark stores a score to beat', async ({ page }) => {
  await page.goto('/');
  await dismissOnboarding(page);
  await openBenchmarks(page);
  await page.locator('[data-benchmark="bm-descent"]').click();
  await expect(page.locator('#rehab-player')).toHaveClass(/open/);
  // tap through the whole piece
  for (let i = 0; i < 30; i++) {
    if (!(await page.locator('#rehab-player').evaluate((el) => el.classList.contains('open')))) break;
    await page.locator('#rp-skip').click(); // the ✓ on a manual set
    await page.waitForTimeout(60);
  }
  const runs = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('kilos-benchmarks') || '[]'));
  console.log('STORED RUNS:', JSON.stringify(runs));
  expect(runs.length).toBeGreaterThan(0);
  expect(runs[0].id).toBe('bm-descent');
  expect(runs[0].score).toBeGreaterThan(0);
});

test('a retest shows the delta — but only when it clears the noise band', async ({ page }) => {
  // Fight Gone Bad's SEM is 6%: a 4% change is measurement error, and showing
  // it as an improvement would be a lie the athlete trains on.
  await page.addInitScript(() => {
    localStorage.setItem('kilos-benchmarks', JSON.stringify([
      { id: 'bm-descent', score: 600, date: '2026-07-01T08:00:00.000Z' },
      { id: 'bm-descent', score: 576, date: '2026-08-01T08:00:00.000Z' }, // 4% faster
      { id: 'bm-three', score: 10, date: '2026-07-01T08:00:00.000Z' },
      { id: 'bm-three', score: 14, date: '2026-08-01T08:00:00.000Z' }, // +40%
    ]));
  });
  await page.goto('/');
  await dismissOnboarding(page);
  await openBenchmarks(page);
  const lane = page.locator('[data-benchmark="bm-descent"] .rhs-meta');
  const death = page.locator('[data-benchmark="bm-three"] .rhs-meta');
  console.log('LANE :', await lane.textContent());
  console.log('DEATH:', await death.textContent());
  await expect(lane).toContainText('LAST 9:36');
  await expect(lane).toContainText('=');        // inside the band → flat
  await expect(lane).not.toContainText('▲');
  await expect(death).toContainText('LAST 14 ROUNDS');
  await expect(death).toContainText('▲40%');    // clears the band → real
});

// The finisher advances with the BLOCK WEEK — not with how many sessions
// you've completed — so a missed week can never desync the app from the
// printed plan.
async function a1Overview(page, blockWeek) {
  await page.addInitScript((weeks) => {
    const m = new Date();
    m.setHours(0, 0, 0, 0);
    m.setDate(m.getDate() - ((m.getDay() + 6) % 7) - weeks * 7);
    localStorage.setItem('kilos-block-start', JSON.stringify(m.toISOString()));
  }, blockWeek - 1);
  await page.goto('/');
  await dismissOnboarding(page);
  await page.locator('.nav-btn[data-screen="train"]').click();
  await page.locator('#btn-rehab-open').click();
  await page.locator('[data-d40="d40-a1"]').click();
  await page.locator('#rp-overview-btn').click();
  return (await page.locator('#rpo-list').textContent())?.replace(/\s+/g, ' ');
}

test('week 1 opens on the first finisher in the pool', async ({ page }) => {
  const txt = await a1Overview(page, 1);
  console.log('A1 wk1:', txt?.slice(-110));
  expect(txt).toContain('Tabata Push-Up');
  expect(txt).toContain('The Spread'); // the graded EMOM is still there
});

test('week 4 serves a different finisher — rotation follows the calendar', async ({ page }) => {
  const txt = await a1Overview(page, 4);
  console.log('A1 wk4:', txt?.slice(-110));
  expect(txt).toContain('The Grip');
  expect(txt).not.toContain('Tabata Push-Up');
});
