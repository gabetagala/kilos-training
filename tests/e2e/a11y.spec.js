import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { dismissOnboarding, quickStart } from './helpers.js';

// Automated WCAG 2.1 A/AA scan (axe-core). Fails the build on serious/critical
// violations so accessibility can't silently regress.
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const BLOCKING = new Set(['serious', 'critical']);

async function scan(page, name) {
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const summary = violations.map(
    (v) => `${v.impact}:${v.id}(${v.nodes.length})`,
  );
  console.log(`AXE[${name}] ${summary.length ? summary.join(' ') : 'clean'}`);
  return violations.filter((v) => BLOCKING.has(v.impact));
}

test('a11y: home + onboarding', async ({ page }) => {
  await page.goto('/');
  const onboarding = await scan(page, 'welcome');
  await dismissOnboarding(page);
  await page.waitForTimeout(300);
  const home = await scan(page, 'home');
  expect(
    [...onboarding, ...home],
    'serious/critical a11y violations',
  ).toEqual([]);
});

test('a11y: train + active', async ({ page }) => {
  await page.goto('/');
  await dismissOnboarding(page);
  await page.locator('.nav-btn[data-screen="train"]').click();
  await page.waitForTimeout(300);
  const train = await scan(page, 'train');
  await quickStart(page);
  const active = await scan(page, 'active');
  expect([...train, ...active], 'serious/critical a11y violations').toEqual([]);
});
