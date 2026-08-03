import { expect, test } from '@playwright/test';

// Tayô — the hidden desk-break coach at /tayo/ (unlinked from the app on
// purpose). ?at=HH:MM freezes "now" for deterministic states.

test('idle: counts down to the next snack inside the window', async ({
  page,
}) => {
  await page.goto('/tayo/?at=09:57');
  await expect(page.locator('#kicker')).toContainText('NEXT · SNACK · 10:00');
  await expect(page.locator('#count')).toContainText(':');
  await expect(page.locator('#dots .dot')).toHaveCount(6); // 10:00 → 15:00
});

test('a due snack takes the stage; Done logs a hit dot', async ({ page }) => {
  await page.goto('/tayo/?at=10:00');
  await expect(page.locator('#kicker')).toContainText('TAYO NA — SNACK');
  await expect(page.locator('#what')).toContainText('pull-ups');
  await page.locator('#done').click();
  await expect(page.locator('#dots .dot.hit')).toHaveCount(1);
  await expect(page.locator('#kicker')).toContainText('NEXT');
});

test('outside the window it goes quiet', async ({ page }) => {
  await page.goto('/tayo/?at=16:10');
  await expect(page.locator('#kicker')).toContainText('OFF THE CLOCK');
});
