import { expect, test } from '@playwright/test';
import { dismissOnboarding, checkInGood } from './helpers.js';

// QA round: an unanswered back check serves the lighter 'unchecked' dose —
// these specs exercise the full session, so today's check is GOOD
test.beforeEach(async ({ page }) => {
  await checkInGood(page);
});

// Since 2026-10-10 the one non-anchor EMOM on a lift day is Wednesday's
// Power piece (broad jump + DB push press, three rounds, before the squat).
// What has to hold wherever an EMOM runs: a metcon reads as ONE workout,
// an EMOM minute can show a clock and a load at the same time, and a minute
// that runs out logs its set by itself — a logged set is never lost.

async function openHalf(page, id) {
  await page.locator('.nav-btn[data-screen="train"]').click();
  await page.locator('#btn-rehab-open').click();
  await page.locator(`[data-d40="${id}"]`).click();
  await page.locator('#sp-start').click(); // preview first, then Start
  await expect(page.locator('#rehab-player')).toHaveClass(/open/);
}

async function skipTo(page, pred, max) {
  for (let i = 0; i < max; i++) {
    if (await pred()) return;
    await page.locator('#rp-skip').click();
    await page.waitForTimeout(60);
  }
}

const atPower = (page) => async () =>
  !!(await page.locator('#rp-session-name').textContent())?.startsWith('POWER');

test('an EMOM minute shows the piece, a running clock AND a weight row', async ({
  page,
}) => {
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/');
  await dismissOnboarding(page);
  await openHalf(page, 'd40-b1');
  await skipTo(page, atPower(page), 40);

  // the header becomes the PIECE — these minutes are one workout, not 6 items
  await expect(page.locator('#rp-session-name')).toContainText('POWER · EMOM 6');
  await expect(page.locator('#rp-meta')).toContainText('MIN 1 OF 6');
  // minute 1 is the broad jump: bodyweight, max intent — a clock, no load
  await expect(page.locator('#rp-exname')).toHaveText('Broad Jump');
  await expect(page.locator('#rp-meta')).toContainText('×3');
  // the NEXT station shows during the minute so the transition needs no memory
  await expect(page.locator('#rp-next')).toContainText('NEXT · DB PUSH PRESS');
  await expect(page.locator('#rp-lift .rp-weight-row')).toBeHidden();
  // neither power station has a sanctioned swap — the header icon stays off
  await expect(page.locator('#rp-swap')).toBeHidden();

  // minute 2, the push press: both at once — the clock runs the piece, the
  // weight row sets the load
  await page.locator('#rp-skip').click();
  await expect(page.locator('#rp-meta')).toContainText('MIN 2 OF 6');
  await expect(page.locator('#rp-exname')).toHaveText('DB Push Press');
  await expect(page.locator('#rp-meta')).toContainText('×4');
  await expect(page.locator('#rp-clock')).toBeVisible();
  await expect(page.locator('#rp-lift .rp-weight-row')).toBeVisible();
  await expect(page.locator('#rp-time')).toHaveText('1:00');
  await expect(page.locator('#rp-swap')).toBeHidden();

  // the anchor right after is an EMOM too — and it DOES offer its swap
  // (front squat → DB split squat), so the icon comes back
  await skipTo(
    page,
    async () =>
      !!(await page.locator('#rp-session-name').textContent())?.startsWith('THE ANCHOR'),
    10,
  );
  // the squat's clock is 2:30 since round 2 — read as E2:30, never "E2.5M"
  await expect(page.locator('#rp-session-name')).toContainText('THE ANCHOR · E2:30');
  await expect(page.locator('#rp-swap')).toBeVisible();
  expect(errors).toEqual([]);
});

test('the overview lists a piece as one row, not as its minutes', async ({
  page,
}) => {
  await page.goto('/');
  await dismissOnboarding(page);
  await openHalf(page, 'd40-b1');
  await page.locator('#rp-overview-btn').click();
  const rows = page.locator('#rpo-list');
  await expect(rows).toContainText('Power');
  await expect(rows).toContainText('EMOM 6 · 3 rounds');
  // a superset is one row too: its name, its week's format, its moves
  await expect(rows).toContainText('Split Squat & Curl');
  await expect(rows).toContainText('Cable Leg Curl'); // no sliders — the cable
  // DBs at the sides: no second front-rack exercise on squat day
  await expect(rows).not.toContainText('Front-Rack');
  // the hang clean & press and the hang snatch are no longer served
  await expect(rows).not.toContainText(/Hang (Clean|Power Snatch)/);
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
  await skipTo(page, atPower(page), 40);
  await expect(page.locator('#rp-meta')).toContainText('MIN 1 OF 6');
  // minute 2 is the loaded one — the DB push press
  await page.locator('#rp-skip').click();
  await expect(page.locator('#rp-meta')).toContainText('MIN 2 OF 6');

  await page.evaluate(() => localStorage.removeItem('kilos-guided-weights'));
  // rp-play TOGGLES — clicking an already-running clock would pause it
  if (await page.locator('#rp-play-icon').isVisible()) {
    await page.locator('#rp-play').click();
  }
  await expect(page.locator('#rp-meta')).toContainText('MIN 3 OF 6', {
    timeout: 70000,
  });

  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('kilos-guided-weights') || '{}'),
  );
  expect(Object.keys(saved)).toContain('db-push-press');
  expect(errors).toEqual([]);
});
