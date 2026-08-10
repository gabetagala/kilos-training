import { expect, test } from '@playwright/test';
import { dismissOnboarding } from './helpers.js';

// The daily protocol after the 2026-08-07 trim: ONE fixed 10-minute session,
// the same every day, no A/B rotation left (the hinge moved into the lift
// halves; the glutes + stretches became the Sunday "Open Up" session).
// A mid-session refresh must still restore the same run — losing a session
// here is unforgivable.

async function openRehabPage(page) {
  await page.locator('.nav-btn[data-screen="train"]').click();
  await page.locator('#btn-rehab-open').click();
}

test('the daily session is the Lower Back & Hips program, twelve moves', async ({
  page,
}) => {
  await page.goto('/');
  await dismissOnboarding(page);
  await openRehabPage(page);
  // daily + the 10-min reset + open-up + the Sunday engine + power primer
  await expect(page.locator('#rehab-session-list .rhs-card')).toHaveCount(5);
  const card = page.locator('#rehab-session-list [data-rehab="daily"]');
  await expect(card.locator('.rhs-meta')).toContainText('12 MOVES');
  await expect(card.locator('.rhs-meta')).not.toContainText('DAY A');
  await card.click();
  await expect(page.locator('#rehab-player')).toHaveClass(/open/);
  await expect(page.locator('#rp-exname')).toHaveText('Hip Internal Rotation');
  await page.locator('#rp-overview-btn').click();
  // the McGill core lives in its own short-day session now, not in here
  await expect(page.locator('#rpo-list')).not.toContainText('Cat-Camel');
  await expect(page.locator('#rpo-list')).not.toContainText('Bird Dog');
  await expect(page.locator('#rpo-list')).toContainText('Elephant Walk');
});

test('completed runs no longer flip the session — it stays identical', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'workoutHistory',
      JSON.stringify([
        {
          name: 'Rehab · Daily Reset',
          type: 'rehab',
          rehabId: 'daily',
          date: new Date().toISOString(),
          duration: '10 min',
          totalWeight: 0,
          sets: 13,
          newPRs: [],
          exercises: [],
        },
      ]),
    );
  });
  await page.goto('/');
  await dismissOnboarding(page);
  await openRehabPage(page);
  const card = page.locator('#rehab-session-list [data-rehab="daily"]');
  await expect(card.locator('.rhs-meta')).toContainText('12 MOVES');
  await expect(card.locator('.rhs-meta')).not.toContainText('DAY B');
  await card.click();
  await page.locator('#rp-overview-btn').click();
  await expect(page.locator('#rpo-list')).not.toContainText('Romanian Deadlift');
});

test('the displaced work is still reachable as its own session', async ({
  page,
}) => {
  await page.goto('/');
  await dismissOnboarding(page);
  await openRehabPage(page);
  const card = page.locator('#rehab-session-list [data-rehab="open-up"]');
  await expect(card.locator('.rhs-meta')).toContainText('3 MOVES');
  await card.click();
  await expect(page.locator('#rehab-player')).toHaveClass(/open/);
  await page.locator('#rp-overview-btn').click();
  await expect(page.locator('#rpo-list')).toContainText('Single-Leg Bridge');
  await expect(page.locator('#rpo-list')).toContainText('Hamstring Stretch');
  await expect(page.locator('#rpo-list')).toContainText('Hip Flexor Stretch');
});

test('a mid-session refresh reopens the same run by itself', async ({
  page,
}) => {
  await page.goto('/');
  await dismissOnboarding(page);
  await openRehabPage(page);
  await page.locator('#rehab-session-list [data-rehab="daily"]').click();
  await expect(page.locator('#rehab-player')).toHaveClass(/open/);
  await page.reload();
  // No taps needed: the player restores itself with the same queue.
  await expect(page.locator('#rehab-player')).toHaveClass(/open/);
  await expect(page.locator('#rp-exname')).toHaveText('Hip Internal Rotation');
});
