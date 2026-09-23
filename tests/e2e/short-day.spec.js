import { expect, test } from '@playwright/test';
import { dismissOnboarding } from './helpers.js';

// THE SHORT DAY (2026-09-23): the ~15-minute version of any day, for the
// nights the baby won. What matters in a real browser: the preview REDRAWS
// to what Start will actually run, the short run logs as that same day, and
// a mid-session refresh restores the short queue instead of salvaging it.

async function openProgram(page) {
  await page.goto('/');
  await dismissOnboarding(page);
  await page.locator('.nav-btn[data-screen="train"]').click();
  await page.locator('#btn-rehab-open').click();
}

const mins = async (page) => {
  const t = (await page.locator('#sp-meta').textContent()) || '';
  return Number(t.match(/~(\d+) MIN/)?.[1]);
};

test('the preview redraws to the short day, and Start runs what is shown', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.setViewportSize({ width: 375, height: 812 });
  await openProgram(page);
  await page.locator('[data-d40="d40-a1"]').click();

  const full = await mins(page);
  expect(full).toBeGreaterThan(30);
  await expect(page.locator('#sp-dose')).toBeVisible();

  await page.locator('#sp-dose-short').click();
  const short = await mins(page);
  expect(short).toBeLessThanOrEqual(20);
  expect(short).toBeGreaterThanOrEqual(10);
  await expect(page.locator('#sp-dose-note')).toContainText('still counts');
  await expect(page.locator('#sp-dose-short')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.locator('#sp-dose').screenshot({
    path: 'test-results/short-switch.png',
  });

  // and back again — the switch is a switch, not a one-way door
  await page.locator('#sp-dose-full').click();
  expect(await mins(page)).toBe(full);

  await page.locator('#sp-dose-short').click();
  await page.locator('#sp-start').click();
  await expect(page.locator('#rehab-player')).toHaveClass(/open/);
  // the anchor is two sets in a short day, not four
  const metas = [];
  for (let i = 0; i < 12; i++) {
    const m = (await page.locator('#rp-meta').textContent()) || '';
    metas.push(m);
    if (/ROUND 1 OF 1/.test(m)) break;
    await page.locator('#rp-skip').click();
    await page.waitForTimeout(60);
  }
  const all = metas.join(' | ');
  console.log('SHORT METAS:', all.slice(0, 300));
  expect(all).toContain('ROUND 1 OF 2'); // anchor: two sets
  expect(all).toContain('ROUND 1 OF 1'); // piece: one trip
  expect(errors).toEqual([]);

  // a refresh restores the SHORT run — not a salvaged "interrupted" entry
  await page.reload();
  await expect(page.locator('#rehab-player')).toHaveClass(/open/);
  const hist = await page.evaluate(
    () => JSON.parse(localStorage.getItem('workoutHistory') || '[]').length,
  );
  expect(hist).toBe(0);
  const dose = await page.evaluate(
    () => JSON.parse(localStorage.getItem('kilos-rehab-state') || '{}').dose,
  );
  expect(dose).toBe('short');
});

test('a short rehab day keeps the holds and drops the finisher', async ({
  page,
}) => {
  await openProgram(page);
  await page.locator('#rehab-session-list [data-rehab="daily"]').click();
  const full = await mins(page);
  await page.locator('#sp-dose-short').click();
  expect(await mins(page)).toBeLessThan(full);
  await expect(page.locator('#sp-list')).toContainText('Elephant Walk');
  await page.locator('#sp-start').click();
  await page.locator('#rp-overview-btn').click();
  await expect(page.locator('#rpo-list')).toContainText('T-Spine Reach');
  await expect(page.locator('#rpo-list')).not.toContainText(
    /(The (Pump|Arm Farm|Redline|Classic|Downhill|Popeye|Porter|Sprint|Chase|Complex|Test|Climb|Century)|Death by|Crawl & Haul)/,
  );
});

test('the switch stays hidden where there is nothing to halve', async ({
  page,
}) => {
  await openProgram(page);
  await page.locator('#rehab-session-list [data-rehab="reset"]').click();
  await expect(page.locator('#sp-dose')).toBeHidden();
});

test('a finished short session logs as that day, marked short', async ({
  page,
}) => {
  await openProgram(page);
  await page.locator('#rehab-session-list [data-rehab="daily"]').click();
  await page.locator('#sp-dose-short').click();
  await page.locator('#sp-start').click();
  await expect(page.locator('#rehab-player')).toHaveClass(/open/);
  // walk it to the end
  for (let i = 0; i < 80; i++) {
    if (!(await page.locator('#rehab-player').evaluate((el) => el.classList.contains('open')))) break;
    await page.locator('#rp-skip').click();
    await page.waitForTimeout(30);
  }
  const entry = await page.evaluate(
    () => JSON.parse(localStorage.getItem('workoutHistory') || '[]').at(-1),
  );
  expect(entry?.rehabId).toBe('daily'); // same day, so the calendar ticks
  expect(entry?.short).toBe(true);
});
