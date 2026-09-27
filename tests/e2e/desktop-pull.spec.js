import { expect, test } from '@playwright/test';
import { dismissOnboarding } from './helpers.js';

// 2026-09-27 (his ask): the phone had pull-to-sync, the laptop didn't. A
// trackpad/wheel scrolled up past the top now draws the same pill and
// releases when the wheel goes quiet.
test.use({
  viewport: { width: 1280, height: 800 },
  isMobile: false,
  hasTouch: false,
});

test('scrolling up past the top on a laptop pulls to sync', async ({ page }) => {
  await page.goto('/');
  await dismissOnboarding(page);
  const ptr = page.locator('#ptr');
  await page.mouse.move(640, 400);
  // one gesture that starts at the top, far enough to arm the release
  for (let i = 0; i < 8; i++) {
    await page.mouse.wheel(0, -60);
    await page.waitForTimeout(30);
  }
  await expect(ptr).toHaveClass(/on/);
  await expect(page.locator('#ptr-label')).toHaveText('RELEASE TO SYNC');
  // wheel goes quiet → release; signed out, it says so honestly
  await expect(page.locator('#ptr-label')).toHaveText('THIS DEVICE ONLY');
  await expect(ptr).not.toHaveClass(/on/);
});

test('a small nudge up at the top does not sync', async ({ page }) => {
  await page.goto('/');
  await dismissOnboarding(page);
  await page.mouse.move(640, 400);
  await page.mouse.wheel(0, -40);
  await page.waitForTimeout(400);
  await expect(page.locator('#ptr')).not.toHaveClass(/on/);
});

// the phone path shares release() with the laptop now — keep it honest
test.describe('on the phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test('a finger pull past the threshold still syncs', async ({ page }) => {
    await page.goto('/');
    await dismissOnboarding(page);
    const ok = await page.evaluate(async () => {
      const sc = [...document.querySelectorAll('.screen')].find(
        (el) => el.offsetParent !== null,
      );
      if (!sc) return 'no-screen';
      // WebKit forbids constructing Touch — a plain event carrying the one
      // field the handler reads is the same input as far as it can tell
      const fire = (type, y) => {
        const ev = new Event(type, { bubbles: true, cancelable: true });
        Object.defineProperty(ev, 'touches', {
          value: type === 'touchend' ? [] : [{ clientY: y }],
        });
        sc.dispatchEvent(ev);
      };
      fire('touchstart', 100);
      for (let y = 110; y <= 340; y += 20) fire('touchmove', y);
      const armed = document.getElementById('ptr-label').textContent;
      fire('touchend', 340);
      return armed;
    });
    expect(ok).toBe('RELEASE TO SYNC');
    await expect(page.locator('#ptr-label')).toHaveText('THIS DEVICE ONLY');
  });
});
