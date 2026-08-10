// Benchmark scoring — pure, no DOM, no storage. Unit-tested in
// tests/unit/benchmark.test.js. See BLOCK-01.md §4 for the programming
// rationale; this file is only about turning a run into a comparable number.
//
// Three score types, because one benchmark is not a fitness score:
//   time   — seconds to finish a fixed amount of work (lower is better)
//   minute — the last minute completed in a ladder (higher is better)
//   hr     — recovery heart rate after fixed submaximal work (lower is better)
//
// THE NOISE FLOOR IS THE WHOLE POINT. Fight Gone Bad — the only CrossFit
// benchmark with published reliability — has ICC 0.90 and SEM 6%. A 4%
// "improvement" on a metcon is measurement error wearing a result's clothing.
// So every comparison here is gated: a change inside the noise band reports as
// flat, not as progress. Telling someone they improved when they didn't is
// worse than telling them nothing.

// Per-type noise band, as a fraction. Anything inside this is called flat.
// - time/minute: 6%, from FGB's published SEM. Metcon test-retest CV is
//   otherwise unpublished, so this is the best anchor available and is
//   deliberately conservative.
// - hr: 5%. Recovery HR is a much cleaner signal than a metcon score (fixed
//   submaximal work, no pacing decisions), but beat-to-beat and day-to-day
//   variation is real.
export const NOISE_BAND = { time: 0.06, rounds: 0.06, minute: 0.06, hr: 0.05 };

// Lower-is-better for time and recovery HR; higher-is-better for anything
// counting work done (rounds, ladder minutes).
const LOWER_IS_BETTER = { time: true, rounds: false, minute: false, hr: true };

export function formatBenchmarkScore(scoreType, score) {
  if (score == null || Number.isNaN(score)) return '—';
  if (scoreType === 'time') {
    const s = Math.round(score);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }
  if (scoreType === 'minute') return `MIN ${score}`;
  if (scoreType === 'hr') return `${score} BPM`;
  // Rounds are stored as a decimal so partial rounds survive: 12.5 = twelve
  // rounds plus a part-round. Displayed as the round count, halves marked.
  if (scoreType === 'rounds') {
    return Number.isInteger(score)
      ? `${score} ROUNDS`
      : `${Math.floor(score)}+ ROUNDS`;
  }
  return String(score);
}

/**
 * Compare a new score against the previous one.
 * Returns { dir: 'better'|'worse'|'flat', pct, meaningful }.
 * `meaningful` is false when the change sits inside the test's noise band —
 * the caller should render that as flat, however tempting the number looks.
 */
export function compareBenchmark(scoreType, score, prev) {
  if (score == null || prev == null || !(prev > 0)) {
    return { dir: 'flat', pct: 0, meaningful: false };
  }
  const pct = (score - prev) / prev;
  const band = NOISE_BAND[scoreType] ?? 0.06;
  if (Math.abs(pct) < band) return { dir: 'flat', pct, meaningful: false };
  const improved = LOWER_IS_BETTER[scoreType] ? pct < 0 : pct > 0;
  return { dir: improved ? 'better' : 'worse', pct, meaningful: true };
}

/**
 * The score a finished run earned, derived from what the player already knows.
 * - time:   how long the session actually took
 * - minute: the last ladder minute COMPLETED (a failed minute doesn't count)
 * - hr:     not derivable — the athlete takes their own pulse, so this returns
 *           null and the caller must prompt for it
 */
export function scoreFromRun(session, { elapsedSecs, stepsCompleted, queue }) {
  if (!session?.benchmark) return null;
  // A finished run always has a time — never let a fast/degenerate run round
  // to 0 and fall through to "the app couldn't score this".
  if (session.scoreType === 'time') {
    return elapsedSecs > 0 ? Math.max(1, Math.round(elapsedSecs)) : null;
  }
  if (session.scoreType === 'minute') {
    const ladder = (queue || []).filter((s) => s.ladder);
    if (!ladder.length) return null;
    // stepsCompleted counts every step including the prep; the score is how
    // many ladder minutes were finished, capped at what the queue held.
    const done = Math.min(
      Math.max(
        0,
        (stepsCompleted || 0) - ((queue?.length || 0) - ladder.length),
      ),
      ladder.length,
    );
    return done || null;
  }
  return null; // 'hr' and 'rounds' — the athlete supplies these
}
