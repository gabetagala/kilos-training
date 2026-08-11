import { expect, test } from '@playwright/test';
import { dismissOnboarding } from './helpers.js';

// The accessory work runs as named pieces on a clock (2026-08-07) instead of
// supersets with rest timers. What has to hold: a metcon reads as ONE workout,
// an EMOM minute can show a clock and a load at the same time, and a minute
// that runs out logs its set by itself — a logged set is never lost.

async function openHalf(page, id) {
  await page.locator('.nav-btn[data-screen="train"]').click();
  await page.locator('#btn-rehab-open').click();
  await page.locator(`[data-d40="${id}"]`).click();
  await expect(page.locator('#rehab-player')).toHaveClass(/open/);
}

async function skipTo(page, pred, max) {
  for (let i = 0; i < max; i++) {
    if (await pred()) return;
    await page.locator('#rp-skip').click();
    await page.waitForTimeout(60);
  }
}

const atGate = (page) => async () =>
  !!(await page.locator('#rp-session-name').textContent())?.includes('THE GATE');
const atForge = (page) => async () =>
  !!(await page.locator('#rp-session-name').textContent())?.includes('THE FORGE');

test('an EMOM minute shows the piece, a running clock AND a weight row', async ({
  page,
}) => {
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/');
  await dismissOnboarding(page);
  await openHalf(page, 'd40-b1');
  await skipTo(page, atForge(page), 40);

  // the header becomes the PIECE — these minutes are one workout, not 12 items
  await expect(page.locator('#rp-session-name')).toContainText(
    'THE FORGE · EMOM 25',
  );
  await expect(page.locator('#rp-meta')).toContainText('MIN 1 OF 24');
  // the prescription rides on the movement (2026-08-11): ×reps leads the
  // meta, and the NEXT station + its number shows during the minute so the
  // transition needs zero memory
  await expect(page.locator('#rp-meta')).toContainText('×10');
  await expect(page.locator('#rp-next')).toContainText('NEXT · DB PUSH PRESS ×8');
  // both at once: the clock runs the piece, the weight row sets the load
  await expect(page.locator('#rp-clock')).toBeVisible();
  await expect(page.locator('#rp-lift .rp-weight-row')).toBeVisible();
  await expect(page.locator('#rp-time')).toHaveText('1:00');
  expect(errors).toEqual([]);
});

test('the overview lists a piece as one row, not as its minutes', async ({
  page,
}) => {
  await page.goto('/');
  await dismissOnboarding(page);
  await openHalf(page, 'd40-c1');
  await page.locator('#rp-overview-btn').click();
  const rows = page.locator('#rpo-list');
  await expect(rows).toContainText('The Gate');
  await expect(rows).toContainText('EMOM 25');
  await expect(rows).toContainText('Romanian Deadlift'); // Part A still listed
});

// SLOW (~70s) on purpose: the only honest way to prove the auto-log is to let
// a real interval expire. The clock owns the pace in an EMOM, so a set that
// needed a tap would either stall the piece or be lost — and losing a logged
// set is the one thing this app must never do.
test('an EMOM minute logs itself when the interval runs out', async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/');
  await dismissOnboarding(page);
  await openHalf(page, 'd40-b1');
  await skipTo(page, atForge(page), 40);
  await expect(page.locator('#rp-meta')).toContainText('MIN 1 OF 24');

  await page.evaluate(() => localStorage.removeItem('kilos-guided-weights'));
  // rp-play TOGGLES — clicking an already-running clock would pause it
  if (await page.locator('#rp-play-icon').isVisible()) {
    await page.locator('#rp-play').click();
  }
  await expect(page.locator('#rp-meta')).toContainText('MIN 2 OF 24', {
    timeout: 70000,
  });

  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('kilos-guided-weights') || '{}'),
  );
  // The Forge's first station is the chest-supported row (the 1-arm cable
  // row left the pieces with the one-pulley rule, 2026-08-11)
  expect(Object.keys(saved)).toContain('chest-supported-row');
  expect(errors).toEqual([]);
});
