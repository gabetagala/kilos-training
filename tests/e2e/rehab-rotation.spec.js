import { expect, test } from '@playwright/test';
import { dismissOnboarding } from './helpers.js';

// The unified daily session: ONE card holds the whole protocol, the hinge
// slot rotates A (carries) / B (RDLs) per completed run, and a mid-session
// refresh restores the same run. Losing a session here is unforgivable.

async function openRehabPage(page) {
  await page.locator('.nav-btn[data-screen="train"]').click();
  await page.locator('#btn-rehab-open').click();
}

test('one session, day A: opens on cat-camel, barbell-free, no separate hinge', async ({
  page,
}) => {
  await page.goto('/');
  await dismissOnboarding(page);
  await openRehabPage(page);
  // daily protocol + power primer — the hinge still lives inside daily
  await expect(page.locator('#rehab-session-list .rhs-card')).toHaveCount(2);
  const card = page.locator('#rehab-session-list [data-rehab="daily"]');
  await expect(card.locator('.rhs-meta')).toContainText('DAY A');
  await expect(card.locator('.rhs-meta')).toContainText('8 MOVES');
  await card.click();
  await expect(page.locator('#rehab-player')).toHaveClass(/open/);
  await expect(page.locator('#rp-exname')).toHaveText('Cat-Camel');
  await page.locator('#rp-overview-btn').click();
  await expect(page.locator('#rpo-title')).toContainText('DAY A');
  await expect(page.locator('#rpo-list')).toContainText('Hamstring Stretch');
  await expect(page.locator('#rpo-list')).not.toContainText(
    'Romanian Deadlift',
  );
});

test('a completed run flips the next one to day B — the RDL hinge', async ({
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
          duration: '24 min',
          totalWeight: 0,
          sets: 32,
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
  await expect(card.locator('.rhs-meta')).toContainText('DAY B');
  await expect(card.locator('.rhs-meta')).toContainText('9 MOVES');
  await card.click();
  await page.locator('#rp-overview-btn').click();
  await expect(page.locator('#rpo-title')).toContainText('DAY B');
  await expect(page.locator('#rpo-list')).toContainText('Romanian Deadlift');
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
  await expect(page.locator('#rp-exname')).toHaveText('Cat-Camel');
});
