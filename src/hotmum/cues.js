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
 * The word for one tempo beat, or null for a silent one.
 *
 * Rep-start beats count the REP — milestones outrank numbers ("last three"
 * three out, "last one" on the final rep), numbers outrank the phase word.
 * Every other phase boundary says its phase word. Phases of 3s or more pace
 * their middle seconds; a 2s phase saying "two" is just noise.
 */
export function beatSlug(st, tempo) {
  const first = tempo?.pattern?.[0]?.[0];
  const repStart = st.phaseSec === 0 && st.label === first;
  if (repStart) {
    const total = tempo.reps || 0;
    if (total >= 6 && st.rep === total - 2) return 'last-three';
    if (total >= 2 && st.rep === total) return 'last-one';
    if (NUM_SLUGS[st.rep]) return NUM_SLUGS[st.rep];
  }
  if (st.phaseSec === 0) return phaseWord(st.label);
  return st.phaseLen >= 3 ? (NUM_SLUGS[st.phaseSec + 1] ?? null) : null;
}

/**
 * The 3-2-1 on any plain timed step — holds, carries, rests, prep.
 * Without this a bird-dog hold or a rest just ends, with no warning.
 */
export function countdownSlug(secsLeft) {
  const n = Math.ceil(secsLeft);
  return n >= 1 && n <= 3 ? NUM_SLUGS[n] : null;
}
