// HOTMUM — what Alice says, and when.
//
// Deliberately NOT src/workout/tempoCues.js. That file maps UP → "lift" and
// anything unrecognised → "lower", which is right for Gabe's barbell work and
// wrong here: on a squat you go DOWN and UP, not "lower" and "lift". Changing
// the shared file would have changed his coach's mouth, so HOTMUM gets its own
// vocabulary and his is left alone.

// The closed set of words Alice owns. A label outside this map is silent
// rather than mispronounced — see the test that walks every tempo pattern.
export const PHASE_WORDS = {
  UP: 'up',
  DOWN: 'down',
  SQUEEZE: 'squeeze',
  HOLD: 'hold',
  OUT: 'out',
  BACK: 'back',
};

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
];

export const phaseWord = (label) => PHASE_WORDS[label] || null;

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
 * The word for one tempo beat, or null for a silent one.
 *
 * One word per phase change, and nothing in between. The old version also
 * paced the inside of long phases ("down… two… three…"), which collided head-on
 * with the rep count — "two" meaning the second second of the descent and
 * "two" meaning the second rep, seconds apart. The phase word plus the rep
 * number is all the information there is; the rest was chatter.
 */
export function beatSlug(st, tempo) {
  if (st.phaseSec !== 0) return null;
  if (st.label === countPhase(tempo)) {
    const total = tempo.reps || 0;
    if (total >= 6 && st.rep === total - 2) return 'last-three';
    if (total >= 2 && st.rep === total) return 'last-one';
    if (NUM_SLUGS[st.rep]) return NUM_SLUGS[st.rep];
  }
  return phaseWord(st.label);
}

/**
 * The 3-2-1 into the end of a timed HOLD — a bird dog, a plank, a carry.
 *
 * Work only. A rest already says "rest" when it starts; counting it down again
 * turns a breather into a drill and fills the one quiet part of the set.
 */
export function countdownSlug(secsLeft) {
  const n = Math.ceil(secsLeft);
  return n >= 1 && n <= 3 ? NUM_SLUGS[n] : null;
}
