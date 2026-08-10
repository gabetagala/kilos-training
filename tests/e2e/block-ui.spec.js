import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { dismissOnboarding } from './helpers.js';

// The BLOCK-01 UI at phone width. These exist because a code review found two
// bugs that only show up in a real browser: the benchmark score sheet borrowed
// the player's `.rp-w-*` class names and sat EARLIER in the DOM, so the
// player's own weight dial was being written into a hidden modal; and a
// for-time piece rendered with no clock at all despite being scored in time.


async function setup(page, weeksAgo = 0, extra = () => {}) {
  await page.addInitScript((w) => {
    const m = new Date(); m.setHours(0,0,0,0);
    m.setDate(m.getDate() - ((m.getDay()+6)%7) - w*7);
    localStorage.setItem('kilos-block-start', JSON.stringify(m.toISOString()));
    // mark the one-time v1->v2 start-date migration as already done, so it
    // can't move the date these tests deliberately set
    localStorage.setItem('kilos-block-seed-v2', 'true');
    localStorage.setItem('kilos-benchmarks', JSON.stringify([
      {id:'bm-descent',score:400,date:'2026-07-01T08:00:00.000Z'},
      {id:'bm-descent',score:330,date:'2026-08-01T08:00:00.000Z'},
      {id:'bm-three',score:11,date:'2026-07-01T08:00:00.000Z'},
    ]));
    const mk=(wa,wt,nm,pid)=>{const d=new Date();d.setDate(d.getDate()-wa*7);
      return {name:nm,type:'strength',programId:pid,date:d.toISOString(),duration:'30 min',
        totalWeight:0,sets:4,newPRs:[],exercises:[{name:nm==='Pull'?'Weighted Pull-Up':'Barbell Floor Press',logs:[{weight:wt,reps:6,done:true}]}]};};
    localStorage.setItem('workoutHistory', JSON.stringify([
      mk(4,20,'Pull','d40-a1'), mk(2,25,'Pull','d40-a1'), mk(0,30,'Pull','d40-a1'),
      mk(3,50,'Push','d40-c1'), mk(0,60,'Push','d40-c1'),
    ]));
  }, weeksAgo);
  await page.goto('/');
  await dismissOnboarding(page);
}

test('program page at 375px — block banner, progress, benchmarks', async ({ page }) => {
  const errors=[]; page.on('console',m=>m.type()==='error'&&errors.push(m.text()));
  page.on('pageerror',e=>errors.push(String(e)));
  await setup(page, 5);
  await page.locator('.nav-btn[data-screen="train"]').click();
  await page.locator('#btn-rehab-open').click();
  await expect(page.locator('.blk-name')).toBeVisible();

  // no horizontal overflow at phone width
  const overflow = await page.evaluate(() => {
    const bad=[]; for (const el of document.querySelectorAll('#rehab-page *')) {
      if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflowX === 'visible')
        bad.push(el.id||el.className||el.tagName);
    } return bad.slice(0,5);
  });
  console.log('OVERFLOW:', JSON.stringify(overflow));
  console.log('PROGRESS PANEL:', (await page.locator('#block-progress').textContent())?.replace(/\s+/g,' ').slice(0,300));
  console.log('ERRORS:', JSON.stringify(errors));
  expect(errors).toEqual([]);
});

test('deload sheet and benchmark score sheet render correctly', async ({ page }) => {
  await setup(page, 3); // week 4 — the checkpoint fires
  await page.locator('.nav-btn[data-screen="train"]').click();
  await page.locator('#btn-rehab-open').click();
  await expect(page.locator('#deload-check')).toHaveClass(/open/, {timeout:4000});
  await page.locator('#deload-yes').click();
  await expect(page.locator('#deload-advice')).toHaveClass(/open/);
  await page.locator('#deload-ok').click();
});

test('the player weight row still shows the right unit (class collision guard)', async ({ page }) => {
  await setup(page, 0);
  await page.locator('.nav-btn[data-screen="train"]').click();
  await page.locator('#btn-rehab-open').click();
  await page.locator('[data-d40="d40-a1"]').click();
  for (let i=0;i<3;i++){ if(await page.locator('#rp-lift').isVisible() && await page.locator('#rp-w-val').isVisible()) break;
    await page.locator('#rp-skip').click(); await page.waitForTimeout(80); }
  const unit = await page.locator('#rp-lift .rp-w-unit').textContent();
  const val  = await page.locator('#rp-w-val').textContent();
  console.log('PLAYER DIAL:', val, unit);
  expect(['kg','lbs','reps']).toContain(unit.trim());
});

test('a for-time piece shows a running clock', async ({ page }) => {
  await setup(page, 0);
  await page.locator('.nav-btn[data-screen="train"]').click();
  await page.locator('#btn-rehab-open').click();
  await page.locator('[data-benchmark="bm-descent"]').click();
  await page.locator('#rp-skip').click(); // into the piece
  await expect(page.locator('#rp-clock')).toBeVisible();
  await expect(page.locator('#rp-phase')).toHaveText('ELAPSED');
  const t1 = await page.locator('#rp-time').textContent();
  await page.waitForTimeout(1600);
  const t2 = await page.locator('#rp-time').textContent();
  console.log('FOR-TIME CLOCK:', t1, '->', t2);
  expect(t1).not.toBe(t2); // it must actually be running
});

test('a11y: the program page with all the new sections', async ({ page }) => {
  await setup(page, 3);
  await page.locator('.nav-btn[data-screen="train"]').click();
  await page.locator('#btn-rehab-open').click();
  await page.locator('#deload-no').click().catch(() => {});
  const r = await new AxeBuilder({ page })
    .include('#rehab-page')
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
  console.log('AXE program page:', r.violations.length ? JSON.stringify(r.violations.map(v => `${v.id}: ${v.nodes.length}`)) : 'clean');
  expect(r.violations).toEqual([]);
});

test('a11y: the deload sheet', async ({ page }) => {
  await setup(page, 3);
  await page.locator('.nav-btn[data-screen="train"]').click();
  await page.locator('#btn-rehab-open').click();
  await expect(page.locator('#deload-check')).toHaveClass(/open/, { timeout: 4000 });
  const r = await new AxeBuilder({ page }).include('#deload-check').withTags(['wcag2a','wcag2aa']).analyze();
  console.log('AXE deload:', r.violations.length ? JSON.stringify(r.violations.map(v=>`${v.id}: ${v.nodes.length}`)) : 'clean');
  expect(r.violations).toEqual([]);
});

test('touch targets on the new controls are >= 44px', async ({ page }) => {
  await setup(page, 3);
  await page.locator('.nav-btn[data-screen="train"]').click();
  await page.locator('#btn-rehab-open').click();
  await page.locator('#deload-no').click().catch(() => {});
  const small = await page.evaluate(() => {
    const out = [];
    for (const sel of ['.blk-check', '#benchmark-list .rhs-card', '#bm-minus', '#bm-plus', '#deload-yes', '#deload-no']) {
      for (const el of document.querySelectorAll(sel)) {
        const r = el.getBoundingClientRect();
        if (r.width && r.height && r.height < 44) out.push(`${sel} ${Math.round(r.height)}px`);
      }
    }
    return out;
  });
  console.log('SMALL TARGETS:', JSON.stringify(small));
  expect(small).toEqual([]);
});

// The program page IS the block calendar: 12 weeks, every session, split the
// way the program is actually structured (A quality / B the piece / F the
// finisher). Built from the same calls as scripts/block-sheet.mjs so the app
// and the printed sheet can never disagree.
test('the block calendar shows all 12 weeks and every part of a session', async ({ page }) => {
  const errors=[]; page.on('console',m=>m.type()==='error'&&errors.push(m.text()));
  page.on('pageerror',e=>errors.push(String(e)));
  await page.addInitScript(() => {
    const m=new Date(); m.setHours(0,0,0,0);
    m.setDate(m.getDate()-((m.getDay()+6)%7)-1*7); // week 2
    localStorage.setItem('kilos-block-start', JSON.stringify(m.toISOString()));
  });
  await page.goto('/');
  await dismissOnboarding(page);
  await page.locator('.nav-btn[data-screen="train"]').click();
  await page.locator('#btn-rehab-open').click();
  await expect(page.locator('#block-calendar .cal-week')).toHaveCount(12);
  await expect(page.locator('.cal-week.open .cal-day')).toHaveCount(7);
  console.log('OPEN WEEK:', await page.locator('.cal-week.open .cal-wk').textContent());
  const mon = page.locator('.cal-week.open .cal-day').first();
  console.log('MONDAY:', (await mon.textContent())?.replace(/\s+/g,' ').trim().slice(0,220));
  // collapse/expand
  await page.locator('[data-cal-week="5"]').click();
  await expect(page.locator('.cal-week.open .cal-wk')).toHaveText('WK 5');
  const w5 = (await page.locator('.cal-week.open').textContent())?.replace(/\s+/g,' ');
  console.log('WK5 flags:', w5?.slice(0,150));
  const overflow = await page.evaluate(() => {
    const bad=[]; for (const el of document.querySelectorAll('#block-calendar *'))
      if (el.scrollWidth > el.clientWidth+2 && getComputedStyle(el).overflowX==='visible') bad.push(el.className);
    return bad.slice(0,4);
  });
  console.log('OVERFLOW:', JSON.stringify(overflow));
  console.log('ERRORS:', JSON.stringify(errors));
  expect(errors).toEqual([]);
  expect(overflow).toEqual([]);
});

// The block starts on a MONDAY — never mid-week, because week 1 has to be a
// real week for week 12 to be comparable to it. Before it starts the program
// is fully usable, it just isn't counting.

test('pre-block state + rehab on the four days that carry it', async ({ page }) => {
  const errors=[]; page.on('console',m=>m.type()==='error'&&errors.push(m.text()));
  page.on('pageerror',e=>errors.push(String(e)));
  await page.goto('/');
  await dismissOnboarding(page);
  await page.locator('.nav-btn[data-screen="train"]').click();
  await page.locator('#btn-rehab-open').click();
  console.log('BANNER:', (await page.locator('#block-banner').textContent())?.replace(/\s+/g,' ').trim());
  console.log('START:', await page.evaluate(()=>localStorage.getItem('kilos-block-start')));
  console.log('IS MONDAY?', await page.evaluate(()=>new Date(JSON.parse(localStorage.getItem('kilos-block-start'))).getDay()));
  // The 48-min rehab runs Sun/Tue/Thu/Sat (2026-08-10) — it no longer stacks
  // on the three lift days, so four rows, not seven.
  const rehabLines = await page.locator('.cal-week.open .cal-part-btn').count();
  console.log('REHAB LINES IN OPEN WEEK:', rehabLines);
  expect(rehabLines).toBe(4);
  console.log('ERRORS:', JSON.stringify(errors));
  expect(errors).toEqual([]);
});

test('tapping the rehab line on a calendar day opens the rehab', async ({ page }) => {
  await page.goto('/');
  await dismissOnboarding(page);
  await page.locator('.nav-btn[data-screen="train"]').click();
  await page.locator('#btn-rehab-open').click();
  await page.locator('.cal-week.open .cal-part-btn').first().click();
  await expect(page.locator('#rehab-player')).toHaveClass(/open/);
  await expect(page.locator('#rp-session-name')).toContainText('LOWER BACK & HIPS');
  await expect(page.locator('#rp-exname')).toHaveText('Hip Internal Rotation');
});

test('double-tap does not zoom', async ({ page }) => {
  await page.goto('/');
  await dismissOnboarding(page);
  const ta = await page.evaluate(() => getComputedStyle(document.documentElement).touchAction);
  console.log('html touch-action:', ta);
  expect(ta).toBe('manipulation');
  const vp = await page.evaluate(() => document.querySelector('meta[name=viewport]').content);
  console.log('viewport:', vp);
  expect(vp).toContain('maximum-scale=1.0');
});


// Reproduces Gabe's exact device state: the first build seeded THIS week's
// Monday, and he has trained every day this week. The old heuristic read that
// history as "the block is live" and refused to move the date.
test('corrects a device seeded by the old build, even with history', async ({ page }) => {
  await page.addInitScript(() => {
    const m = new Date(); m.setHours(0,0,0,0);
    m.setDate(m.getDate() - ((m.getDay()+6)%7));           // THIS week's Monday
    localStorage.setItem('kilos-block-start', JSON.stringify(m.toISOString()));
    // trained every day since — which says nothing about the block
    const hist = [0,1,2,3].map(i => {
      const d = new Date(m); d.setDate(m.getDate()+i);
      return { name:'Pull', type:'strength', programId:'d40-a1', date:d.toISOString(),
               duration:'30 min', totalWeight:0, sets:4, newPRs:[], exercises:[] };
    });
    localStorage.setItem('workoutHistory', JSON.stringify(hist));
  });
  await page.goto('/');
  await dismissOnboarding(page);
  await page.locator('.nav-btn[data-screen="train"]').click();
  await page.locator('#btn-rehab-open').click();
  const start = await page.evaluate(() => JSON.parse(localStorage.getItem('kilos-block-start')));
  const d = new Date(start);
  console.log('CORRECTED START:', start, '| weekday', d.getDay(), '| future?', d > new Date());
  expect(d.getDay()).toBe(1);          // a Monday
  expect(d.getTime()).toBeGreaterThan(Date.now()); // in the future
  await expect(page.locator('.blk-name')).toContainText('STARTS MONDAY');
  console.log('WK1 HEADER:', await page.locator('.cal-week').first().textContent());
});

// The heuristic version of this reset the block EVERY WEEK once it was live.
test('never re-fires once the block is actually running', async ({ page }) => {
  await page.addInitScript(() => {
    const m = new Date(); m.setHours(0,0,0,0);
    m.setDate(m.getDate() - ((m.getDay()+6)%7) - 7*3);  // week 4, genuinely live
    localStorage.setItem('kilos-block-start', JSON.stringify(m.toISOString()));
    localStorage.setItem('kilos-block-seed-v2', 'true'); // already migrated
  });
  await page.goto('/');
  await dismissOnboarding(page);
  await page.locator('.nav-btn[data-screen="train"]').click();
  await page.locator('#btn-rehab-open').click();
  await expect(page.locator('.blk-name')).toContainText('WK 4/12');
  console.log('LIVE BLOCK PRESERVED:', await page.locator('.blk-name').textContent());
});
