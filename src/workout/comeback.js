// COMING BACK — what the gap since the last session means for today.
// Pure, no DOM, no storage. Unit-tested in tests/unit/comeback.test.js.
//
// His question, 2026-09-23: "if I haven't worked out in days, what should I
// do? if I skipped a day or two, what do I do?" Until now the app answered
// neither — it served the same day whether he trained yesterday or a month
// ago, and left the judgement to him at exactly the moment judgement is
// worst: tired, behind, and looking at a forty-minute session.
//
// THE FIRST RULE IS THE ONE PEOPLE GET WRONG: you never make up a missed
// session. Doubling up repays a debt that doesn't exist and buys fatigue
// with it. A missed Monday is gone; today is today. So a short gap changes
// NOTHING about the prescription — it only gets a sentence saying so,
// because the instinct to catch up is what actually does the damage.
//
// The thresholds below are where the evidence changes, not round numbers:
//
//   2 days   — inside every normal week. Say "nothing to make up", prescribe
//              today as written.
//   3–6 days — no measurable detraining yet (strength and muscle hold for
//              ~3 weeks: McMaster 2013, Ogasawara 2013), but the first
//              session back is the one that gets skipped or overcooked.
//              A short day gets him in the door. Loads stay.
//   7–13 days — conditioning starts to move (VO2max and work capacity fall
//              4–14% in 2–4 weeks: Mujika & Padilla 2000) while strength
//              hasn't. So: short day AND ease the anchor ~10%, which is the
//              same rule the ramp uses.
//   14+ days — a fortnight out is not a bad week, it's a broken block. The
//              honest move is to restart it with the ramp rather than carry
//              on counting weeks nobody trained.
export const GAP_EASE = 3;
export const GAP_EASE_LOAD = 7;
export const GAP_RESTART = 14;

const DAY_MS = 86400000;
const midnight = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

/**
 * Whole days between the last session and today, counted in CALENDAR days:
 * training at 6am yesterday and 9pm today is one day, not two. Null when
 * there's no history to measure from.
 */
export function daysSince(lastISO, now = new Date()) {
  if (!lastISO) return null;
  const last = midnight(new Date(lastISO));
  if (Number.isNaN(last.getTime())) return null;
  return Math.max(0, Math.round((midnight(now) - last) / DAY_MS));
}

/**
 * What today should be, given the gap. `dose` is a suggestion the athlete can
 * always override — the app leads, it never locks.
 *   level: 'none' | 'carry-on' | 'ease' | 'ease-load' | 'restart'
 */
export function comebackAdvice(days) {
  if (days == null || days < 2) return { level: 'none', dose: null, easeLoad: false };
  const off = `${days} days off`;
  if (days >= GAP_RESTART) {
    return {
      level: 'restart',
      dose: 'short',
      easeLoad: true,
      headline: off,
      note: 'Long enough that the block is worth restarting — two ramp weeks, then a fresh week 1. Today, take the short version.',
    };
  }
  if (days >= GAP_EASE_LOAD) {
    return {
      level: 'ease-load',
      dose: 'short',
      easeLoad: true,
      headline: off,
      note: 'Short version today, and take about 10% off the anchor. Your strength is still there; the engine is what faded.',
    };
  }
  if (days >= GAP_EASE) {
    return {
      level: 'ease',
      dose: 'short',
      easeLoad: false,
      headline: off,
      note: 'Short version today, normal tomorrow. Same weights — nothing has gone anywhere yet.',
    };
  }
  return {
    level: 'carry-on',
    dose: null,
    easeLoad: false,
    headline: off,
    note: 'Nothing to make up — today is today. Do it as written.',
  };
}

/** The date of the most recent session that counts as training. */
export function lastSessionDate(history = []) {
  let best = null;
  for (const h of history) {
    if (!h?.date) continue;
    const t = new Date(h.date).getTime();
    if (Number.isNaN(t)) continue;
    if (best == null || t > best) best = t;
  }
  return best == null ? null : new Date(best).toISOString();
}
