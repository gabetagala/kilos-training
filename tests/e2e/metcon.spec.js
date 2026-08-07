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

const atPopeye = (page) => async () =>
  !!(await page.locator('#rp-session-name').textContent())?.includes('POPEYE');

test('an EMOM minute shows the piece, a running clock AND a weight row', async ({
  page,
}) => {
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/');
  await dismissOnboarding(page);
  await openHalf(page, 'd40-b2');
  await skipTo(page, atPopeye(page), 14);

  // the header becomes the PIECE — these minutes are one workout, not 15 items
  await expect(page.locator('#rp-session-name')).toContainText(
    'POPEYE · EMOM 15',
  );
  await expect(page.locator('#rp-meta')).toContainText('MIN 1 OF 15');
  // both at once: the clock runs the piece, the weight row sets the load
  await expect(page.locator('#rp-clock')).toBeVisible();
  await expect(page.locator('#rp-lift .rp-weight-row')).toBeVisible();
  await expect(page.locator('#rp-time')).toHaveText('1:00');
  expect(errors).toEqual([]);
});

// C2's finisher slot rotates; on a fresh history it serves "The Grip".
test('the AMRAP finisher lists its movements and is scored in rounds', async ({
  page,
}) => {
  await page.goto('/');
  await dismissOnboarding(page);
  await openHalf(page, 'd40-c2');
  await skipTo(
    page,
    async () =>
      !!(await page.locator('#rp-session-name').textContent())?.includes(
        'THE GRIP',
      ),
    30,
  );
  await expect(page.locator('#rp-session-name')).toContainText(
    'THE GRIP · AMRAP 3',
  );
  await expect(page.locator('#rp-meta')).toContainText('SCORE = ROUNDS');
  await expect(page.locator('#rp-time')).toHaveText('3:00');
  // a finisher is scored in rounds, so there is no load to log
  await expect(page.locator('#rp-lift .rp-weight-row')).toBeHidden();
  await expect(page.locator('#rp-cue')).toContainText('Farmer Carry 30s');
  await expect(page.locator('#rp-cue')).toContainText('as many rounds');
});

test('the overview lists a piece as one row, not as its minutes', async ({
  page,
}) => {
  await page.goto('/');
  await dismissOnboarding(page);
  await openHalf(page, 'd40-b2');
  await page.locator('#rp-overview-btn').click();
  const rows = page.locator('#rpo-list');
  await expect(rows).toContainText('Popeye');
  await expect(rows).toContainText('EMOM 15');
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
  await openHalf(page, 'd40-b2');
  await skipTo(page, atPopeye(page), 14);
  await expect(page.locator('#rp-meta')).toContainText('MIN 1 OF 15');

  await page.evaluate(() => localStorage.removeItem('kilos-guided-weights'));
  // rp-play TOGGLES — clicking an already-running clock would pause it
  if (await page.locator('#rp-play-icon').isVisible()) {
    await page.locator('#rp-play').click();
  }
  await expect(page.locator('#rp-meta')).toContainText('MIN 2 OF 15', {
    timeout: 70000,
  });

  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('kilos-guided-weights') || '{}'),
  );
  expect(Object.keys(saved)).toContain('db-lateral-raise');
  expect(errors).toEqual([]);
});
