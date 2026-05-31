import { expect, test } from '@playwright/test';

// Smoke: the production build boots clean on iPhone Safari and is installable.
// Runs against `vite preview` (real bundle + service worker), per playwright.config.

test('app loads with no console errors and the shell renders', async ({
  page,
}) => {
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(String(err)));

  await page.goto('/');

  // App shell is present even under the first-visit onboarding overlays.
  await expect(page.locator('#app')).toBeVisible();
  await expect(page.locator('#nav')).toBeAttached();

  // Give the module a beat to run its boot path, then assert no JS errors.
  await page.waitForLoadState('networkidle');
  expect(errors, `console/page errors:\n${errors.join('\n')}`).toEqual([]);
});

test('PWA manifest and an icon are served', async ({ page, baseURL }) => {
  const manifest = await page.request.get(`${baseURL}/manifest.json`);
  expect(manifest.ok()).toBeTruthy();
  const json = await manifest.json();
  expect(Array.isArray(json.icons) && json.icons.length).toBeTruthy();

  const icon = await page.request.get(`${baseURL}/icons/icon-192.png`);
  expect(icon.ok()).toBeTruthy();
});

test('service worker registers in the production build', async ({ page }) => {
  await page.goto('/');
  const registered = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return false;
    const reg = await navigator.serviceWorker.ready.catch(() => null);
    return !!reg;
  });
  expect(registered).toBeTruthy();
});

// Regression: toggling weight unit with NO active workout used to crash
// (profile unit toggle called renderSetLog() unguarded → activeWorkout.exercises
// on null). Caught during a manual-QA drive.
test('toggling kg/lbs in profile with no active workout does not error', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/');
  for (const sel of [
    '#bw-cta',
    '#np-local-btn',
    '#onboarding-modal [data-tier="full-gym"]',
  ]) {
    const el = page.locator(sel);
    try {
      await el.waitFor({ state: 'visible', timeout: 5000 });
      await el.click();
    } catch {}
  }
  await page.locator('#btn-profile').click();
  await page.locator('#prof-unit-toggle').waitFor({ state: 'visible' });
  await page.locator('#prof-unit-toggle').click();
  await page.locator('#prof-unit-toggle').click();
  expect(errors, `page errors:\n${errors.join('\n')}`).toEqual([]);
});
