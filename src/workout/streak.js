// Streak math — pure, no DOM, no storage. Unit-tested in
// tests/unit/streak.test.js. Extracted from main.js per STANDARDS.md §4.
//
// Rule: a day counts if there's a workout on it. One grace miss is allowed
// before the streak breaks, and that grace resets every 7 trained days.
// Missing *today* never breaks the streak (you might still train later today).

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function trainedDaySet(history) {
  // Set of start-of-day timestamps that have at least one workout.
  const days = new Set();
  for (const h of history || []) {
    if (!h?.date) continue;
    days.add(startOfDay(h.date).getTime());
  }
  return days;
}

// Current streak as of `now`, walking back up to 90 days.
export function currentStreak(history, now = new Date()) {
  const days = trainedDaySet(history);
  if (!days.size) return 0;
  const cursor = startOfDay(now);

  let streak = 0;
  let restDayUsed = false;
  for (let i = 0; i < 90; i++) {
    const d = new Date(cursor);
    d.setDate(d.getDate() - i); // setDate is DST-safe; fixed-ms math is not
    const found = days.has(d.getTime());
    if (found) {
      streak++;
      if (streak % 7 === 0) restDayUsed = false; // earn back the grace
    } else if (i > 0) {
      if (!restDayUsed) {
        restDayUsed = true; // one grace miss
        continue;
      }
      break;
    }
  }
  return streak;
}
