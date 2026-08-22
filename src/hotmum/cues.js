// HOTMUM — what Alice says, and when.
//
// Deliberately NOT src/workout/tempoCues.js. That file maps UP → "lift" and
// anything unrecognised → "lower", which is right for Gabe's barbell work and
// wrong here: on a squat you go DOWN and UP, not "lower" and "lift". Changing
// the shared file would have changed his coach's mouth, so HOTMUM gets its own
// vocabulary and his is left alone.

// The closed set of phase labels. Alice owns a clip for each, but as of
// 2026-08-20 she no longer SAYS them on the beat (see beatSlug) — these are
// what the player prints on screen, and the map is what keeps a pattern from
// inventing a label the app has no word for.
export const PHASE_WORDS = {
  UP: 'up',
  DOWN: 'down',
  SQUEEZE: 'squeeze',
  HOLD: 'hold',
  OUT: 'out',
  BACK: 'back',
};

// One to TWENTY. It stopped at ten while the phase words were also being
// spoken, so the gap was covered — now that the rep number is the ONLY thing
// Alice says during a set (see beatSlug), a 20-rep standing crunch would have
// counted to ten and then gone silent for the rest of the set.
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

export const phaseWord = (label) => PHASE_WORDS[label] || null;

// The hold lengths in the program, as words. Deliberately a lookup and not
// arithmetic: a clip either exists or the number is simply not spoken, and a
// test walks every hold in the program to catch one that isn't in here.
export const SEC_SLUGS = {
  10: 'ten',
  15: 'fifteen',
  20: 'twenty',
  30: 'thirty',
  40: 'forty',
  45: 'forty-five',
  60: 'sixty',
};

/**
 * WHICH BEAT CARRIES THE REP NUMBER.
 *
 * A rep is counted when it's FINISHED, and a rep finishes on the way up. On a
 * glute bridge the pattern starts on UP, so counting at the start of the rep
 * was already right. On a squat the pattern starts on DOWN — counting there
 * called the number as she descended, which is backwards from how anyone
 * counts a squat.
 *
 * So the number always lands on the UP (or the BACK, on a dead bug or heel
 * slide, where returning is what completes the rep). Both now count in the
 * same place: at the top.
 */
export function countPhase(tempo) {
  const labels = (tempo?.pattern || []).map(([l]) => l);
  if (labels.includes('UP')) return 'UP';
  if (labels.includes('BACK')) return 'BACK';
  return labels[0] ?? null;
}

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
export function setAnnounce(work) {
  if (!work) return [];
  const name = `name-${work.exId}`;
  if (work.tempo?.reps) {
    const n = NUM_SLUGS[work.tempo.reps];
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
