// Progression math — pure, no DOM, no storage. Unit-tested in
// tests/unit/progression.test.js. Extracted from main.js per STANDARDS.md §4.

// Suggest the next working weight based on the previous session.
// If the lifter hit all target reps last time → add 2.5 kg.
// If they fell short on any set → same weight, keep working.
// Returns a number (kg) or null when there's nothing to base it on.
export function suggestNextWeight(lastLogs, targetRepsStr) {
  if (!lastLogs?.length) return null;
  const weights = lastLogs.map((l) => parseFloat(l.weight)).filter((w) => w > 0);
  if (!weights.length) return null;
  const topW = Math.max(...weights);
  const target = parseInt(targetRepsStr, 10) || 8;
  const allMet = lastLogs.every(
    (l) => !l.reps || parseInt(l.reps, 10) >= target,
  );
  return allMet ? Math.round((topW + 2.5) * 2) / 2 : topW;
}

// Did the lifter meet the rep target on every logged set last session?
// Drives the "+2.5kg from last session" vs "hit all reps first" copy.
export function allRepsMet(lastLogs, targetRepsStr) {
  if (!lastLogs?.length) return false;
  const target = parseInt(targetRepsStr, 10) || 8;
  return lastLogs.every((l) => !l.reps || parseInt(l.reps, 10) >= target);
}
