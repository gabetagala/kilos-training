import { expect, test } from '@playwright/test';
import { dismissOnboarding, startBenchmark } from './helpers.js';

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
  await startBenchmark(page, 'bm-descent');
  await expect(page.locator('#rehab-player')).toHaveClass(/open/);
  await expect(page.locator('#rp-exname')).toHaveText('Box Squat');
  // Box Squat has generated art too: the drawn figure shows only while the
  // art probe is in flight (the preview → GOOD → START path gives it time to
  // land). Either is a real demo.
  await expect
    .poll(async () => {
      const paths = await page.locator('#rp-demo svg path').count();
      const art = await page.locator('#rp-demo img.rp-art-img').count();
      return paths > 5 || art > 0;
    })
    .toBe(true);
  for (let i = 0; i < 6; i++) {
    if ((await page.locator('#rp-exname').textContent()) === 'Push-Up') break;
    await page.locator('#rp-skip').click();
    await page.waitForTimeout(60);
  }
  await expect(page.locator('#rp-exname')).toHaveText('Push-Up');
  // Push-Up has generated art: the drawn figure shows only while the art probe
  // is in flight, then the illustration replaces it. Either is a real demo —
  // counting SVG paths once raced that swap.
  await expect
    .poll(async () => {
      const paths = await page.locator('#rp-demo svg path').count();
      const art = await page.locator('#rp-demo img.rp-art-img').count();
      return paths > 5 || art > 0;
    })
    .toBe(true);
});

test('The Three runs as one 20-minute AMRAP with its movement list', async ({ page }) => {
  await page.goto('/');
  await dismissOnboarding(page);
  await openBenchmarks(page);
  await startBenchmark(page, 'bm-three');
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
  await startBenchmark(page, 'bm-descent');
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
  await startBenchmark(page, 'bm-descent');
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

// The week's reps and formats advance with the BLOCK WEEK — not with how
// many sessions you've completed — so a missed week can never desync the app
// from the printed plan.
async function a1Overview(page, blockWeek) {
  await page.addInitScript((weeks) => {
    const m = new Date();
    m.setHours(0, 0, 0, 0);
    m.setDate(m.getDate() - ((m.getDay() + 6) % 7) - weeks * 7);
    localStorage.setItem('kilos-block-start', JSON.stringify(m.toISOString()));
    // already migrated — the one-time v1->v2 correction must not move a date
    // this test deliberately sets
    localStorage.setItem('kilos-block-seed-v2', 'true');
  }, blockWeek - 1);
  await page.goto('/');
  await dismissOnboarding(page);
  await page.locator('.nav-btn[data-screen="train"]').click();
  await page.locator('#btn-rehab-open').click();
  await page.locator('[data-d40="d40-a1"]').click();
  await page.locator('#sp-start').click();
  await page.locator('#rp-overview-btn').click();
  return (await page.locator('#rpo-list').textContent())?.replace(/\s+/g, ' ');
}

// The lift day is short named blocks (2026-10-09), reshaped 2026-10-10: its
// own warm-up, the FIXED pull-up anchor, Wings, the RDL's unlogged ramp and
// Hinge & Calf. No finisher on Monday — the engine work lives on Wednesday's
// Tabata and Saturday's scored finisher.
test('a lift day is a warm-up, the anchor, named supersets — and the hinge ramps', async ({ page }) => {
  const txt = await a1Overview(page, 1);
  console.log('A1 wk1:', txt?.slice(-200));
  expect(txt).toContain('Warm-Up');
  expect(txt).toContain('The Anchor');
  expect(txt).toContain('Strict Pull-Up');
  expect(txt).toContain('Wings');
  expect(txt).toContain('warm-up ramp');
  expect(txt).toContain('Hinge & Calf');
  expect(txt).toContain('DB Calf Raise');
  // the pull anchor is bodyweight, so it has nothing to build up to
  expect(txt).toContain('E2M');
  expect(txt).not.toContain('to build');
  // week 1 is plain: no heavy, no rep-out, nothing for time, no Prime
  expect(txt).not.toMatch(/HEAVY|LAST SET MAX|for time|Prime/);
});

test('the anchor stays fixed as the weeks advance — only its reps and the delivery move', async ({ page }) => {
  // week 4: the same pull-up anchor, one rep up the ladder (5,5,6,6…), and
  // Hinge & Calf on its staggered HEAVY week — same exercises, same sets.
  // Round 3: five working pull-up sets, the laterals riding their rest, and
  // Wings at three rounds.
  const wk4 = await a1Overview(page, 4);
  console.log('A1 wk4:', wk4?.slice(-200));
  expect(wk4).toMatch(/E2M 10 · 5 rounds\s*Strict Pull-Up\s*6\s*\+ DB Lateral Raise\s*12 in the rest/);
  expect(wk4).toContain('Hinge & Calf HEAVY · 3 rounds');
  expect(wk4).toContain('Romanian Deadlift 8'); // the hinge never goes heavy
  expect(wk4).toContain('Wings SETS · 4 rounds'); // four rounds (45-min round)
  // round 5: Wings' push-up is feet-elevated
  // QA round: Wings = the chest-supported row, the elevated push-up, the band
  expect(wk4).toMatch(/Chest-Supported DB Row\s*10\s*Feet-Elevated Push-Up\s*12\s*Band Pull-Apart\s*15/);
  expect(wk4).not.toMatch(/for time|Prime/);
});

// ROUND 5: a benchmark is a max effort — it opens through the preview
// (header TEST), carries the back check, and only starts on a GOOD morning.
// Amber, tired or unchecked: TEST WAITS and Start does nothing. Red: the
// Daily Reset, like every other start.
test('a benchmark waits for a Good morning', async ({ page }) => {
  await page.goto('/');
  await dismissOnboarding(page);
  await openBenchmarks(page);
  await page.locator('[data-benchmark="bm-three"]').click();
  await expect(page.locator('#session-preview')).toHaveClass(/open/);
  await expect(page.locator('#sp-header-title')).toHaveText('TEST');
  await expect(page.locator('#sp-backcheck')).toBeVisible();
  const startText = page.locator('#sp-start .sp-start-text');
  // unchecked: it waits, LOOKS waiting, and a tap points at the check
  await expect(startText).toHaveText('TEST WAITS');
  await expect(page.locator('#sp-start')).toHaveClass(/is-waiting/);
  await page.locator('#sp-start').click();
  await expect(page.locator('#rehab-player')).not.toHaveClass(/open/);
  await expect(page.locator('#sp-backcheck')).toBeInViewport();
  // stiffer: still waits
  await page.locator('#sp-backcheck [data-back="stiff"]').click();
  await expect(startText).toHaveText('TEST WAITS');
  // a good back after a short night: still waits
  await page.locator('#sp-backcheck [data-back="good"]').click();
  await expect(startText).toHaveText('START');
  await page.locator('#sp-back-sleep').click();
  await expect(startText).toHaveText('TEST WAITS');
  await page.locator('#sp-start').click();
  await expect(page.locator('#rehab-player')).not.toHaveClass(/open/);
  // red: the Daily Reset
  await page.locator('#sp-back-sleep').click();
  await page.locator('#sp-backcheck [data-back="worse"]').click();
  await expect(startText).toHaveText('DAILY RESET');
  // GOOD (no short night): the test runs
  await page.locator('#sp-backcheck [data-back="good"]').click();
  await expect(startText).toHaveText('START');
  await expect(page.locator('#sp-start')).not.toHaveClass(/is-waiting/);
  await page.locator('#sp-start').click();
  await expect(page.locator('#rehab-player')).toHaveClass(/open/);
  await page.locator('#rp-skip').click();
  await expect(page.locator('#rp-session-name')).toContainText('THE THREE · AMRAP 20');
});
