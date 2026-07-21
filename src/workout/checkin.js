// Sunday check-in — the fat-loss feedback loop from TRAINING.md.
// Two numbers once a week (scale weight + waist at navel), a two-week trend,
// and the program's escalation rule when the trend flatlines. Measurement
// only — no food tracking, by design.

// Entries: [{ date: 'YYYY-MM-DD', weightKg, waistCm }], ascending, one per date.

export function addCheckin(list, entry) {
  const rest = (list || []).filter((e) => e.date !== entry.date);
  return [...rest, entry].sort((a, b) => (a.date < b.date ? -1 : 1));
}

const DAY = 86400000;
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / DAY);

// A measure counts as "down" only past scale/tape noise.
const EPS = 0.3;

// Trend reference = newest entry at least 11 days older than the latest —
// "two weeks ago" with tolerance for weekly-ish logging.
export function checkinStatus(list) {
  const l = list || [];
  if (!l.length) return { state: 'first', latest: null, prev: null, ref: null };
  const latest = l[l.length - 1];
  const prev = l.length > 1 ? l[l.length - 2] : null;
  const ref =
    [...l].reverse().find((e) => daysBetween(e.date, latest.date) >= 11) ||
    null;
  if (!ref) return { state: 'building', latest, prev, ref };
  // one-decimal rounding first — float noise must not decide a trend
  const weightDown = +(ref.weightKg - latest.weightKg).toFixed(1) >= EPS;
  const waistDown = +(ref.waistCm - latest.waistCm).toFixed(1) >= EPS;
  return {
    state: weightDown || waistDown ? 'trending' : 'stalled',
    latest,
    prev,
    ref,
  };
}
