// Progression math — pure, no DOM, no storage. Unit-tested in
// tests/unit/progression.test.js. Extracted from main.js per STANDARDS.md §4.

// Suggest the next working weight based on the previous session.
// If the lifter hit all target reps last time → add 2.5 kg.
// If they fell short on any set → same weight, keep working.
// Returns a number (kg) or null when there's nothing to base it on.
export function suggestNextWeight(lastLogs, targetRepsStr) {
  if (!lastLogs?.length) return null;
  const weights = lastLogs
    .map((l) => parseFloat(l.weight))
    .filter((w) => w > 0);
  if (!weights.length) return null;
  const topW = Math.max(...weights);
  const target = parseInt(targetRepsStr, 10) || 8;
  const allMet = lastLogs.every(
    (l) => !l.reps || parseInt(l.reps, 10) >= target,
  );
  return allMet ? Math.round((topW + 2.5) * 2) / 2 : topW;
}

// Estimated 1-rep max (Epley formula) — the headline strength metric every
// serious tracker trends. Returns kg rounded to 0.5; the actual weight for a
// true single; null for junk input (no weight or no reps).
export function estimate1RM(weightKg, reps) {
  const w = parseFloat(weightKg);
  const r = parseInt(reps, 10);
  if (!(w > 0) || !(r > 0)) return null;
  if (r === 1) return Math.round(w * 2) / 2;
  return Math.round(w * (1 + r / 30) * 2) / 2;
}

// Best estimated 1RM across a list of logs (e.g. one exercise's done sets).
// Returns kg or null when nothing qualifies.
export function bestE1RM(logs) {
  if (!logs?.length) return null;
  let best = null;
  for (const l of logs) {
    const e = estimate1RM(l.weight, l.reps);
    if (e != null && (best == null || e > best)) best = e;
  }
  return best;
}

// Did the lifter meet the rep target on every logged set last session?
// Drives the "+2.5kg from last session" vs "hit all reps first" copy.
export function allRepsMet(lastLogs, targetRepsStr) {
  if (!lastLogs?.length) return false;
  const target = parseInt(targetRepsStr, 10) || 8;
  return lastLogs.every((l) => !l.reps || parseInt(l.reps, 10) >= target);
}
