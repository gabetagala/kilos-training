import { expect, test } from '@playwright/test';
import { dismissOnboarding } from './helpers.js';

// The daily session after the 2026-08-11 EMOM40 rebuild: the Back & Hips
// distillate (six fixed favorites + one rotating supporting-cast slot) plus
// the topper EMOM, calendar-pinned across the four rehab days. A mid-session
// refresh must still restore the same run — losing a session here is
// unforgivable.

async function openRehabPage(page) {
  await page.locator('.nav-btn[data-screen="train"]').click();
  await page.locator('#btn-rehab-open').click();
}

test('the daily session is the Back & Hips distillate + topper', async ({
  page,
}) => {
  await page.goto('/');
  await dismissOnboarding(page);
  await openRehabPage(page);
  // daily + the 10-min reset + open-up + the Sunday engine + power primer
  await expect(page.locator('#rehab-session-list .rhs-card')).toHaveCount(5);
  const card = page.locator('#rehab-session-list [data-rehab="daily"]');
  // 8 blocks; the calendar picks the variant, and no A–H letter is printed
  await expect(card.locator('.rhs-meta')).toContainText('8 MOVES');
  await expect(card.locator('.rhs-meta')).not.toContainText('DAY ');
  await card.click();
  await expect(page.locator('#rehab-player')).toHaveClass(/open/);
  await expect(page.locator('#rp-exname')).toHaveText('T-Spine Reach');
  await page.locator('#rp-overview-btn').click();
  // his favorites are fixed daily; the topper closes the session
  await expect(page.locator('#rpo-list')).toContainText('Elephant Walk');
  await expect(page.locator('#rpo-list')).toContainText('Seated Good Morning');
  await expect(page.locator('#rpo-list')).toContainText(
    /The (Pump|Popeye|Engine|Wing)/,
  );
});

test('the rotation is calendar-pinned — completed runs do not flip it', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'workoutHistory',
      JSON.stringify([
        {
          name: 'Rehab · Back & Hips',
          type: 'rehab',
          rehabId: 'daily',
          date: new Date().toISOString(),
          duration: '38 min',
          totalWeight: 0,
          sets: 23,
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
  // a completed run in history changes NOTHING — today's variant comes from
  // the calendar (block week × rehab-day slot), so the sheet can never drift
  await expect(card.locator('.rhs-meta')).toContainText('8 MOVES');
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
  await expect(page.locator('#rp-exname')).toHaveText('T-Spine Reach');
});
