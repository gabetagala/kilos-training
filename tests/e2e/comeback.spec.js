import { expect, test } from '@playwright/test';
import { dismissOnboarding } from './helpers.js';

// AFTER A GAP (2026-09-23): the app answers "I haven't trained in days —
// what do I do?" before he has to ask it. In a real browser because the
// answer has to reach three places: Home's line, the preview's lead, and
// the anchor's target.

async function withGap(page, daysAgo) {
  await page.addInitScript((d) => {
    // a block already running, so the banner is the real week-N banner
    const m = new Date();
    m.setHours(0, 0, 0, 0);
    // week 1 of the block: the anchor slot serves the front squat, which is
    // what the seeded history below has a weight for
    m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
    localStorage.setItem('kilos-block-start', JSON.stringify(m.toISOString()));
    localStorage.setItem('kilos-block-seed-v2', 'true');
    const when = new Date();
    when.setDate(when.getDate() - d);
    when.setHours(8, 0, 0, 0);
    localStorage.setItem(
      'workoutHistory',
      JSON.stringify([
        {
          name: 'Density 40 · Full Body I',
          type: 'strength',
          programId: 'd40-a1',
          date: when.toISOString(),
          duration: '40 min',
          totalWeight: 2000,
          sets: 20,
          newPRs: [],
          exercises: [
            {
              name: 'Front Squat',
              logs: [{ weight: 60, reps: 5, done: true }],
            },
          ],
        },
      ]),
    );
  }, daysAgo);
  await page.goto('/');
  await dismissOnboarding(page);
}

const openProgram = async (page) => {
  await page.locator('.nav-btn[data-screen="train"]').click();
  await page.locator('#btn-rehab-open').click();
};

test('two days off: nothing to make up, and the full day is still the plan', async ({
  page,
}) => {
  await withGap(page, 2);
  await expect(page.locator('#day-summary')).toContainText('nothing to make up');
  await openProgram(page);
  await page.locator('[data-d40="d40-b1"]').click();
  await expect(page.locator('#sp-dose-full')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#sp-dose-note')).toContainText('today is today');
});

test('four days off: the today card leads with the short version and says why', async ({
  page,
}) => {
  await withGap(page, 4);
  await expect(page.locator('#day-summary')).toContainText('4 days off');
  await expect(page.locator('#day-summary')).toContainText('short version');
  await openProgram(page);
  await page.locator('#rh-today-btn').click();
  await expect(page.locator('#sp-dose-short')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#sp-dose-note')).toContainText('4 days off');
  // it leads, it never locks — the full day is one tap away
  await page.locator('#sp-dose-full').click();
  await expect(page.locator('#sp-dose-full')).toHaveAttribute('aria-pressed', 'true');
});

test('browsing a session still shows the program, with the advice alongside', async ({
  page,
}) => {
  await withGap(page, 4);
  await openProgram(page);
  // NOT today's card — a session he opened to look at. It must not redraw
  // itself into a twelve-minute day; that reads as the program shrinking.
  await page.locator('[data-d40="d40-b1"]').click();
  await expect(page.locator('#sp-dose-full')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#sp-meta')).toContainText('~40 MIN');
  await expect(page.locator('#sp-dose-note')).toContainText('4 days off');
});

test('nine days off: the anchor target steps back instead of up', async ({
  page,
}) => {
  await withGap(page, 9);
  await openProgram(page);
  await page.locator('[data-d40="d40-b1"]').click(); // front-squat anchor day
  await page.locator('#sp-dose-full').click();
  await page.locator('#sp-start').click();
  let ctx = '';
  const seen = [];
  for (let i = 0; i < 14; i++) {
    ctx = (await page.locator('#rp-context').textContent()) || '';
    const meta = (await page.locator('#rp-meta').textContent()) || '';
    seen.push(`${meta}>>${ctx}`);
    if (/EASE/.test(ctx)) break;
    await page.locator('#rp-skip').click();
    await page.waitForTimeout(60);
  }
  console.log('ANCHOR STEPS:', seen.join(' | ').slice(0, 500));
  expect(ctx).toContain('LAST 60');
  // ~10% off 60, snapped to a loadable 2.5 — and never the usual +2.5
  expect(ctx).toContain('EASE 55');
  expect(ctx).not.toContain('TARGET');
});

test('three weeks off: the banner names the gap and offers the restart', async ({
  page,
}) => {
  await withGap(page, 21);
  await openProgram(page);
  await expect(page.locator('.blk-restart-open')).toContainText('21 days off');
  await page.locator('.blk-restart-open').click();
  await page.locator('.blk-restart-yes').click();
  await expect(page.locator('.blk-name')).toHaveText('RAMP-UP · WK 1/2');
});
