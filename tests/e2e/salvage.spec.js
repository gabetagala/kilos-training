import { expect, test } from '@playwright/test';
import { dismissOnboarding } from './helpers.js';

// A paused guided run that can no longer resume — its session was deleted, or
// the program's queue changed shape underneath it — must be SALVAGED into
// history, never silently discarded and never resumed onto the wrong steps.
// Losing a logged set is the one thing this app must never do, and a program
// rebuild is exactly when it would have happened.

const STALE_SAVE = {
  sessionId: 'd40-a2', // deleted in the 2026-08-10 rebuild
  variant: 0,
  idx: 14,
  counted: [3, 5, 7, 9],
  loggedEmom: [3, 5, 7, 9],
  liftSets: [
    { exId: 'floor-press', name: 'Floor Press', weight: 40, reps: 6 },
    { exId: 'floor-press', name: 'Floor Press', weight: 40, reps: 6 },
    { exId: 'hammer-curl', name: 'DB Hammer Curl', weight: 10, reps: 12 },
  ],
  startedAt: Date.now() - 3 * 864e5 - 30 * 60 * 1000,
  savedAt: Date.now() - 3 * 864e5, // paused three days ago
  awayMs: 0,
  phase: 1,
  weightKg: 40,
};

test('a paused run from a deleted session is salvaged into history', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript((save) => {
    localStorage.setItem('kilos-rehab-state', JSON.stringify(save));
  }, STALE_SAVE);
  await page.goto('/');
  await dismissOnboarding(page);

  // the stale state is gone — no Resume card pointing into a void
  await expect
    .poll(async () =>
      page.evaluate(() => localStorage.getItem('kilos-rehab-state')),
    )
    .toBeNull();

  // …and the logged sets reached history, dated when the work happened
  const entry = await page.evaluate(() => {
    const hist = JSON.parse(localStorage.getItem('workoutHistory') || '[]');
    return hist.find((h) => /interrupted/.test(h.name)) || null;
  });
  expect(entry).not.toBeNull();
  expect(entry.programId).toBe('d40-a2');
  expect(entry.type).toBe('strength');
  expect(entry.sets).toBe(4); // counted sets win over logged lifts
  expect(entry.totalWeight).toBe(40 * 6 + 40 * 6 + 10 * 12);
  expect(entry.exercises.map((e) => e.name)).toEqual([
    'Floor Press',
    'DB Hammer Curl',
  ]);
  const ageDays = (Date.now() - new Date(entry.date).getTime()) / 864e5;
  expect(ageDays).toBeGreaterThan(2.5); // dated at the pause, not the salvage

  // a reload must not salvage it twice
  await page.reload();
  await dismissOnboarding(page);
  const count = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem('workoutHistory') || '[]').filter((h) =>
        /interrupted/.test(h.name),
      ).length,
  );
  expect(count).toBe(1);
  expect(errors).toEqual([]);
});

test('a save with no logged work is retired without a history entry', async ({
  page,
}) => {
  await page.addInitScript((save) => {
    localStorage.setItem(
      'kilos-rehab-state',
      JSON.stringify({ ...save, counted: [], loggedEmom: [], liftSets: [] }),
    );
  }, STALE_SAVE);
  await page.goto('/');
  await dismissOnboarding(page);
  await expect
    .poll(async () =>
      page.evaluate(() => localStorage.getItem('kilos-rehab-state')),
    )
    .toBeNull();
  const n = await page.evaluate(
    () => JSON.parse(localStorage.getItem('workoutHistory') || '[]').length,
  );
  expect(n).toBe(0);
});
