import { expect, test } from '@playwright/test';
import { dismissOnboarding } from './helpers.js';

// The money path — the loop the whole business rests on (STRATEGY.md §4):
// start a workout → log a set → finish → see the summary. If this breaks,
// nothing else matters. Onboarding is dismissed defensively so a change to
// the first-run flow doesn't mask a break in the core loop.

test('start a workout, log a set, finish, and see the summary', async ({
  page,
}) => {
  await page.goto('/');
  await dismissOnboarding(page);

  // Train tab → Quick Start → pick the first muscle → begins the session.
  await page.locator('.nav-btn[data-screen="train"]').click();
  await page.locator('#btn-qs-open').click();
  const firstMuscle = page.locator('.qs-page-chip').first();
  await expect(firstMuscle).toBeVisible();
  await firstMuscle.click();

  // We should land on the active session with at least one set row.
  await expect(page.locator('#active')).toBeVisible();
  const firstRow = page.locator('#set-log-rows .log-row').first();
  await expect(firstRow).toBeVisible();

  // Log the first set: weight × reps, then tap the done check.
  await firstRow.locator('.log-input[data-field="weight"]').fill('60');
  await firstRow.locator('.log-input[data-field="reps"]').fill('5');
  const done = firstRow.locator('.log-done');
  await done.click();
  await expect(done).toHaveClass(/checked/);

  // Finish → confirm → summary.
  await page.locator('#btn-finish').click();
  await page.locator('#btn-finish-yes').click();
  await expect(page.locator('#workout-summary')).toBeVisible();
});
