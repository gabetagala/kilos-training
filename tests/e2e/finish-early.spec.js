import { expect, test } from '@playwright/test';
import { dismissOnboarding } from './helpers.js';

// 2026-09-27 (his ask): "I'm doing a full workout but turns out I'm not
// ready — is there a button to finish anyway and save that?" The paused
// player shows FINISH ANYWAY; the session saves and says it ended early.
test('a paused session can be finished early and saved', async ({ page }) => {
  await page.goto('/');
  await dismissOnboarding(page);
  await page.locator('.nav-btn[data-screen="train"]').click();
  await page.locator('#btn-rehab-open').click();
  await page.locator('[data-rehab="daily"]').click();
  await page.locator('#sp-start').click();
  await expect(page.locator('#rehab-player')).toHaveClass(/open/);

  // not offered before anything has happened
  const endEarly = page.locator('#rp-endearly');
  await expect(endEarly).toBeHidden();
  await page.locator('#rp-skip').click();
  await page.locator('#rp-skip').click();
  // paused → offered
  await expect(endEarly).toBeVisible();

  await endEarly.click();
  await expect(page.locator('#rhfinish-confirm')).toHaveClass(/open/);
  await page.locator('#btn-rhfinish-yes').click();
  await expect(page.locator('#rehab-player')).not.toHaveClass(/open/);

  const entry = await page.evaluate(
    () => JSON.parse(localStorage.getItem('workoutHistory') || '[]')[0],
  );
  expect(entry?.rehabId).toBe('daily');
  expect(entry?.endedEarly).toBe(true);
});
