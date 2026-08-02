import { expect, test } from '@playwright/test';
import { dismissOnboarding } from './helpers.js';

// Temporary verification of the review fixes — current selectors, prod build.
// Covers the core loop AND the headline crash-safety promise (mid-workout
// refresh must restore the session), which Batch 1 hardened.

test('core loop: quick start, log a set, finish, summary — no console errors', async ({
  page,
}) => {
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto('/');
  await dismissOnboarding(page);

  await page.locator('.nav-btn[data-screen="train"]').click();
  await page.locator('#btn-qs-open').click();
  await page.locator('.qs-page-chip').first().click();

  await expect(page.locator('#active')).toBeVisible();
  const firstRow = page.locator('#set-log-rows .log-row').first();
  await expect(firstRow).toBeVisible();

  await firstRow.locator('.log-input[data-field="weight"]').fill('60');
  await firstRow.locator('.log-input[data-field="reps"]').fill('5');
  await firstRow.locator('.log-row-top').click();
  await expect(firstRow).toHaveClass(/done/);

  await page.locator('#btn-finish').click();
  await page.locator('#btn-finish-yes').click();
  await expect(page.locator('#workout-summary')).toBeVisible();

  expect(errors, `console errors: ${errors.join('\n')}`).toEqual([]);
});

test('crash-safe: a logged set survives a mid-workout refresh', async ({
  page,
}) => {
  await page.goto('/');
  await dismissOnboarding(page);

  await page.locator('.nav-btn[data-screen="train"]').click();
  await page.locator('#btn-qs-open').click();
  await page.locator('.qs-page-chip').first().click();

  const firstRow = page.locator('#set-log-rows .log-row').first();
  await expect(firstRow).toBeVisible();
  await firstRow.locator('.log-input[data-field="weight"]').fill('80');
  await firstRow.locator('.log-input[data-field="reps"]').fill('5');
  await firstRow.locator('.log-row-top').click();
  await expect(firstRow).toHaveClass(/done/);

  // The whole point of the app: reload mid-session and pick up where we were.
  await page.reload();

  await expect(page.locator('#active')).toBeVisible();
  const restoredRow = page.locator('#set-log-rows .log-row').first();
  await expect(restoredRow).toBeVisible();
  await expect(restoredRow).toHaveClass(/done/);
});
