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
// The launcher now lives under the Train tab, so go there first.
export async function quickStart(page, muscleIndex = 0) {
  await page.locator('.nav-btn[data-screen="train"]').click();
  await page.locator('#btn-qs-open').click();
  await page.locator('.qs-page-chip').nth(muscleIndex).click();
  await page.locator('#set-log-rows .log-row').first().waitFor({ state: 'visible' });
  await page.waitForTimeout(700); // let the quick-start overlay finish closing
}

// A benchmark card opens its PREVIEW (round 5, header TEST) and a test only
// starts on a GOOD morning — tap GOOD, then START. Lands in the player.
export async function startBenchmark(page, id) {
  await page.locator(`[data-benchmark="${id}"]`).click();
  await page.locator('#session-preview.open').waitFor({ state: 'visible' });
  await page.locator('#sp-backcheck [data-back="good"]').click();
  await page.locator('#sp-start').click();
  await page.locator('#rehab-player.open').waitFor({ state: 'visible' });
}

// Answer today's morning back check GOOD before the app boots (QA round: an
// unanswered check now serves the 'unchecked' dose — no jumps, sprints or
// finishers until he taps). Uses the page's own clock, so a test that pins
// the date with page.clock still gets "today". Never overwrites an answer a
// test seeded for today itself.
export async function checkInGood(page) {
  await page.addInitScript(() => {
    const d = new Date();
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    let all = [];
    try {
      all = JSON.parse(localStorage.getItem('kilos-back-checks') || '[]');
    } catch {}
    if (!all.some((c) => c.date === day)) {
      all.push({ date: day, back: 'good' });
      localStorage.setItem('kilos-back-checks', JSON.stringify(all));
    }
  });
}
