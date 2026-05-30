// Shared e2e helpers. Not a spec — Playwright won't run it as a test.

// Dismiss the first-visit gauntlet (beta welcome → name prompt → tier).
// Each step is optional so a flow change doesn't mask a real break.
export async function dismissOnboarding(page) {
  const steps = ['#bw-cta', '#np-local-btn', '#onboarding-modal [data-tier="full-gym"]'];
  for (const sel of steps) {
    const el = page.locator(sel);
    try {
      await el.waitFor({ state: 'visible', timeout: 5000 });
      await el.click();
    } catch {
      // not part of this run
    }
  }
}

// Quick Start the nth muscle and land on the active session's set log.
export async function quickStart(page, muscleIndex = 0) {
  await page.locator('#btn-qs-open').click();
  await page.locator('.qs-page-chip').nth(muscleIndex).click();
  await page.locator('#set-log-rows .log-row').first().waitFor({ state: 'visible' });
  await page.waitForTimeout(700); // let the quick-start overlay finish closing
}
