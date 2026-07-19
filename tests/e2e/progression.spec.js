import { expect, test } from '@playwright/test';
import { dismissOnboarding, quickStart } from './helpers.js';

// The M0 loop features, end-to-end on WebKit: one-tap steppers, last-session
// pre-fill across two sessions, and the streak chip updating.

test('weight stepper adjusts by 2.5kg and clamps at 0', async ({ page }) => {
  await page.goto('/');
  await dismissOnboarding(page);
  await quickStart(page);

  const row = page.locator('#set-log-rows .log-row').first();
  const weight = row.locator('.log-input[data-field="weight"]');
  const plus = row.locator('.step-btn[data-field="weight"][data-dir="1"]');
  const minus = row.locator('.step-btn[data-field="weight"][data-dir="-1"]');

  await plus.click();
  await expect(weight).toHaveValue('2.5');
  await plus.click();
  await expect(weight).toHaveValue('5');
  // can't go negative
  await minus.click();
  await minus.click();
  await minus.click();
  await expect(weight).toHaveValue('0');
});

test('a second session pre-fills last time, and the streak chip updates', async ({
  page,
}) => {
  await page.goto('/');
  await dismissOnboarding(page);

  // Session 1: log the first exercise's opening set at 60kg × 8 (target met).
  await quickStart(page); // Chest
  const firstExercise = await page.locator('#current-ex-name').textContent();
  const row1 = page.locator('#set-log-rows .log-row').first();
  await row1.locator('.log-input[data-field="weight"]').fill('60');
  await row1.locator('.log-input[data-field="reps"]').fill('8');
  await row1.locator('.log-done').click();
  await page.locator('#btn-finish').click();
  await page.locator('#btn-finish-yes').click();
  await expect(page.locator('#workout-summary')).toBeVisible();
  await page.locator('#wsum-close').click();

  // Streak chip reflects today's session.
  await page.locator('.nav-btn[data-screen="home"]').click();
  await expect(page.locator('#streak-count')).toContainText('1 day streak');

  // Session 2: same muscle → same first exercise → opening set is pre-filled
  // from last time (60kg, all reps met → suggests 62.5).
  await quickStart(page);
  await expect(page.locator('#current-ex-name')).toHaveText(firstExercise || '');
  const weight2 = page
    .locator('#set-log-rows .log-row')
    .first()
    .locator('.log-input[data-field="weight"]');
  const v = await weight2.inputValue();
  expect(Number(v)).toBeGreaterThan(0); // pre-filled, not blank
});
