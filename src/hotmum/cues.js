// HOTMUM — what Alice says, and when.
//
// Deliberately NOT src/workout/tempoCues.js — that file is built around
// calling a barbell rep phase by phase, which is exactly what HOTMUM stopped
// doing (2026-08-22). A set here is a stretch of WORK with a rep target in it;
// there are no phases left to name, so the phase vocabulary that used to live
// here (UP / DOWN / SQUEEZE / HOLD / OUT / BACK) is gone with them.
//
// What survives is the short list of things worth saying between sets, and the
// tone that closes one.
export const NUM_SLUGS = [
  null,
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
  'twenty',
];

// The hold lengths in the program, as words. Deliberately a lookup and not
// arithmetic: a clip either exists or the number is simply not spoken, and a
// test walks every hold in the program to catch one that isn't in here.
export const SEC_SLUGS = {
  10: 'ten',
  15: 'fifteen',
  20: 'twenty',
  25: 'twenty-five',
  30: 'thirty',
  40: 'forty',
  45: 'forty-five',
  50: 'fifty',
  60: 'sixty',
};

/**
 * WHAT ALICE SAYS AT THE TOP OF A SET — the movement, then the dose.
 *
 * "Single-Leg RDL. Six reps."   /   "Wall Sit. Thirty seconds."
 *
 * NOTHING is spoken inside a set any more. The arc got here in two steps:
 * first she stopped calling the phase on every beat (it narrated something
 * already on screen in 50px type), then she stopped counting the reps too.
 * What's left is the KILOS pattern — name the movement, name the dose, then
 * be quiet and let her work. The rep counter on screen is the running total;
 * a voice repeating it was a second copy of the same fact.
 *
 * Returns a list of slugs to speak in order, or [] if there's nothing to say.
 */
export function setAnnounce(work, block) {
  if (!work) return [];
  const name = `name-${work.exId}`;
  // The rep target lives on the BLOCK, not the step — the engine's timed
  // interval knows how many seconds it runs for and nothing else.
  if (block?.reps) {
    const n = NUM_SLUGS[block.reps];
    return n ? [name, n, 'reps'] : [name];
  }
  const n = SEC_SLUGS[work.secs];
  return n ? [name, n, 'seconds'] : [name];
}

/**
 * The 3-2-1 into the end of ANY step, as three tones (see beep() in voice.js).
 *
 * It used to be Alice SAYING "three… two… one", and only on timed holds. Two
 * changes: it's a tone now, because a countdown is the one sound in the app
 * where exact timing matters more than warmth; and it fires on every step, not
 * just holds, because "how long until this set ends" is the question the big
 * countdown used to answer and no longer does (§2.1).
 *
 * Returns the pitch for the second, or null on a second that isn't counted.
 * The last one is higher so "go" is audibly different from "nearly".
 */
export function countdownTone(secsLeft) {
  const n = Math.ceil(secsLeft);
  if (n < 1 || n > 3) return null;
  return n === 1 ? 1180 : 880;
}
