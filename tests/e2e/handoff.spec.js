import { expect, test } from '@playwright/test';
import { dismissOnboarding } from './helpers.js';

// Cross-device handoff (2026-08-15): a run paused on the phone rides the
// cloud as an envelope; the laptop adopts it at boot and offers the SAME
// resume card the crash-restore path uses — so the queue fingerprint still
// gets the final word. This spec fakes the "other device" by pausing a real
// run, re-wrapping its saved state under a foreign deviceId, and rebooting.

test('a run parked by another device is offered here, and resumes', async ({
  page,
}) => {
  await page.goto('/');
  await dismissOnboarding(page);
  // park a real run: open the daily session, start it, advance one step
  await page.locator('.nav-btn[data-screen="train"]').click();
  await page.locator('#btn-rehab-open').click();
  await page.locator('[data-rehab="daily"]').click();
  await page.locator('#sp-start').click();
  await expect(page.locator('#rehab-player')).toHaveClass(/open/);
  await page.locator('#rp-skip').click();
  await page.locator('#rp-close').click(); // pause out — state persists

  // become "the laptop": the pause came from a DIFFERENT device via sync
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('kilos-rehab-state'));
    localStorage.removeItem('kilos-rehab-state');
    localStorage.setItem('kilos-device-id', JSON.stringify('this-device'));
    window.__runId = state.runId; // the tombstone below must NAME this run
    localStorage.setItem(
      'kilos-active-sync',
      JSON.stringify({
        state,
        runId: state.runId,
        deviceId: 'other-device',
        updatedAt: Date.now(),
      }),
    );
  });
  await page.reload();

  // boot adoption wrote the state back, and the existing restore path did
  // the rest: the run is simply OPEN here, at the step the phone left it
  await expect(page.locator('#rehab-player')).toHaveClass(/open/);
  await page.locator('#rp-close').click();

  // a TOMBSTONE from the other device retires the offer instead — it
  // names the run, so wall clocks are irrelevant
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('kilos-rehab-state'));
    localStorage.setItem(
      'kilos-active-sync',
      JSON.stringify({
        state: null,
        runId: state?.runId ?? window.__runId,
        deviceId: 'other-device',
        updatedAt: Date.now(),
      }),
    );
  });
  await page.reload();
  await expect(page.locator('#rehab-player')).not.toHaveClass(/open/);
  await page.locator('.nav-btn[data-screen="train"]').click();
  await page.locator('#btn-rehab-open').click();
  await expect(page.locator('#rehab-session-list')).not.toContainText(
    'PAUSED AT STEP',
  );
});

// 2026-09-27 (his report): "discard & start new" on the phone, refresh the
// laptop — the laptop still offered the old run. The phone's NEXT run had
// overwritten the tombstone, and a different-run pause with logged sets is
// untouchable. The envelope's `ended` list is what retires it now.
test('a run discarded elsewhere is gone here, even after a new run started', async ({
  page,
}) => {
  await page.goto('/');
  await dismissOnboarding(page);
  await page.locator('.nav-btn[data-screen="train"]').click();
  await page.locator('#btn-rehab-open').click();
  await page.locator('[data-rehab="daily"]').click();
  await page.locator('#sp-start').click();
  await expect(page.locator('#rehab-player')).toHaveClass(/open/);
  await page.locator('#rp-skip').click();
  await page.locator('#rp-close').click();

  // this laptop's paused run carries logged sets (the untouchable case);
  // the phone discarded it and is already on a NEW run
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('kilos-rehab-state'));
    state.counted = [0, 1];
    localStorage.setItem('kilos-rehab-state', JSON.stringify(state));
    localStorage.setItem('kilos-device-id', JSON.stringify('this-device'));
    localStorage.setItem(
      'kilos-active-sync',
      JSON.stringify({
        state: { ...state, runId: 'phone-new-run', counted: [] },
        runId: 'phone-new-run',
        deviceId: 'other-device',
        updatedAt: Date.now(),
        ended: [state.runId],
      }),
    );
  });
  await page.reload();
  // the old run is retired; the phone's new run is what's on offer
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem('kilos-rehab-state') || 'null')?.runId,
      ),
    )
    .not.toBe(undefined);
  const runId = await page.evaluate(
    () => JSON.parse(localStorage.getItem('kilos-rehab-state') || 'null')?.runId,
  );
  expect(runId).toBe('phone-new-run');
});
