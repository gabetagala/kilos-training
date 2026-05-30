import { expect, test } from '@playwright/test';

// The money path — the loop the whole business rests on (STRATEGY.md §4):
// start a workout → log a set → finish → see the summary. If this breaks,
// nothing else matters. Onboarding is dismissed defensively so a change to
// the first-run flow doesn't mask a break in the core loop.

async function dismissOnboarding(page) {
  // First-visit gauntlet: beta welcome → name prompt → equipment tier.
  // Each overlay animates in, so wait for its button before clicking; a step
  // that never appears (flow changed) is skipped rather than failing the test.
  const steps = [
    '#bw-cta', // "Let's go →"
    '#np-local-btn', // "No account →"
    '#onboarding-modal [data-tier="full-gym"]', // full-gym = exercises pass through
  ];
  for (const sel of steps) {
    const el = page.locator(sel);
    try {
      await el.waitFor({ state: 'visible', timeout: 5000 });
      await el.click();
    } catch {
      // overlay not part of this run — move on
    }
  }
  // Ensure no onboarding overlay is still intercepting taps.
  await expect(page.locator('#beta-welcome')).not.toBeVisible();
}

test('start a workout, log a set, finish, and see the summary', async ({
  page,
}) => {
  await page.goto('/');
  await dismissOnboarding(page);

  // Quick Start → pick the first muscle → quickStartWorkout begins the session.
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
