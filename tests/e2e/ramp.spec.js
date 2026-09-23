import { expect, test } from '@playwright/test';
import { dismissOnboarding } from './helpers.js';

// THE RAMP (2026-09-21): a block that kept counting through weeks nobody
// trained gets restarted from the banner — two easy weeks, then a fresh
// week 1. These run in the real browser because the restart touches
// everything the day is built from: the banner, the calendar, the piece
// rounds, the finisher, and the crash-restore fingerprint.

async function setup(page, weeksAgo) {
  await page.addInitScript((w) => {
    const m = new Date();
    m.setHours(0, 0, 0, 0);
    m.setDate(m.getDate() - ((m.getDay() + 6) % 7) - w * 7);
    localStorage.setItem('kilos-block-start', JSON.stringify(m.toISOString()));
    localStorage.setItem('kilos-block-seed-v2', 'true');
  }, weeksAgo);
  await page.goto('/');
  await dismissOnboarding(page);
  await page.locator('.nav-btn[data-screen="train"]').click();
  await page.locator('#btn-rehab-open').click();
}

async function restart(page) {
  await page.locator('.blk-restart-open').click();
  await expect(page.locator('.blk-restart')).toContainText(
    'Your history, PRs and weights stay',
  );
  await page.locator('.blk-restart-yes').click();
  await expect(page.locator('.blk-name')).toHaveText('RAMP-UP · WK 1/2');
}

test('restart from week 7: two ramp weeks, then a fresh week 1', async ({
  page,
}) => {
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.setViewportSize({ width: 375, height: 812 });
  await setup(page, 6);
  await expect(page.locator('.blk-name')).toHaveText('BLOCK 01 · WK 7/12');

  // cancelling changes nothing
  await page.locator('.blk-restart-open').click();
  await page.locator('.blk-restart-no').click();
  await expect(page.locator('.blk-name')).toHaveText('BLOCK 01 · WK 7/12');

  await restart(page);
  const rec = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('kilos-block')),
  );
  expect(rec.ramp).toBe(2);
  expect(new Date(rec.start).getDay()).toBe(1); // week 1 is a Monday

  // the calendar lists the ramp above week 1 and opens on this week
  await expect(page.locator('.cal-week.cal-now .cal-wk')).toHaveText('RAMP 1');
  await expect(page.locator('.cal-week.cal-now')).toContainText(
    'two rounds a piece',
  );
  await expect(page.locator('.cal-week.cal-now .cal-days')).not.toContainText(
    'Finisher',
  );
  await page.locator('#block-banner').screenshot({
    path: 'test-results/ramp-banner.png',
  });

  const overflow = await page.evaluate(() => {
    const bad = [];
    for (const el of document.querySelectorAll('#rehab-page *')) {
      if (
        el.scrollWidth > el.clientWidth + 2 &&
        getComputedStyle(el).overflowX === 'visible'
      )
        bad.push(el.id || el.className || el.tagName);
    }
    return bad.slice(0, 5);
  });
  expect(overflow).toEqual([]);
  expect(errors).toEqual([]);
});

test('a ramp lift day: anchor one set down, piece at two rounds, and a refresh restores it', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await setup(page, 6);
  await restart(page);

  await page.locator('[data-d40="d40-a1"]').click();
  await page.locator('#sp-start').click();
  await expect(page.locator('#rehab-player')).toHaveClass(/open/);
  // skip through the anchor into the piece — and stop there: the ramp day
  // is short enough that skipping blindly runs off the end of it
  const metas = [];
  for (let i = 0; i < 20; i++) {
    const m = (await page.locator('#rp-meta').textContent()) || '';
    metas.push(m);
    if (/ROUND 1 OF 2/.test(m)) break;
    await page.locator('#rp-skip').click();
    await page.waitForTimeout(60);
  }
  const all = metas.join(' | ');
  console.log('RAMP METAS:', all.slice(0, 400));
  expect(all).toContain('ROUND 1 OF 3'); // the pull-up anchor: 3 sets, not 4
  expect(all).toContain('ROUND 1 OF 2'); // the piece: two rounds
  expect(all).not.toContain('ROUND 1 OF 4');

  expect(errors).toEqual([]);

  // crash-safety: the same run comes back after a refresh, not salvaged.
  // (A reload mid-session aborts the voice-clip prefetch, which WebKit
  // reports as page errors — pre-existing and harmless, so errors are
  // asserted BEFORE the reload.)
  await page.reload();
  await expect(page.locator('#rehab-player')).toHaveClass(/open/);
  await expect(page.locator('#rp-meta')).not.toHaveText('');
  const hist = await page.evaluate(
    () => JSON.parse(localStorage.getItem('workoutHistory') || '[]').length,
  );
  expect(hist).toBe(0); // nothing got salvaged as "interrupted"
});

test('a ramp rehab day is the holds and the core cap — no scored finisher', async ({
  page,
}) => {
  await setup(page, 6);
  await restart(page);
  await page.locator('#rehab-session-list [data-rehab="daily"]').click();
  await page.locator('#sp-start').click();
  await page.locator('#rp-overview-btn').click();
  await expect(page.locator('#rpo-list')).toContainText('Elephant Walk');
  await expect(page.locator('#rpo-list')).not.toContainText(
    /(The (Pump|Arm Farm|Redline|Classic|Downhill|Popeye|Porter|Sprint|Chase|Complex|Test|Climb|Century)|Death by|Crawl & Haul)/,
  );
});
