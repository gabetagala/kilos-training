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
 * SHE COUNTS, SHE DOESN'T COACH (2026-08-20). Alice used to call the phase on
 * every beat — "down… hold… up… two… down… hold… up… three" — which is a word
 * roughly every second and a half for twenty minutes. Two problems: it's
 * relentless, and it's redundant. The phase is ALREADY on screen in 50px type
 * and the whole canvas warms on the lift and cools on the lower (PLAN.md §3),
 * so the tempo is readable without a word for it. What the voice is genuinely
 * needed for is the thing she can't see while she's moving: **where she is in
 * the set**.
 *
 * So the only thing that lands on a tempo beat is the REP NUMBER, once per
 * rep, at the top. Everything else Alice still says is transition, not
 * coaching: "get set", the name of what's coming, "rest", "switch sides", and
 * the 3-2-1 into the end of a hold.
 *
 * The phase words stay in PHASE_WORDS and stay on screen — they're the label
 * set, and the clips are still on disk. This is a decision about how much the
 * coach talks, not about deleting the vocabulary.
 */
export function beatSlug(st, tempo) {
  if (st.phaseSec !== 0) return null;
  if (st.label !== countPhase(tempo)) return null;
  const total = tempo.reps || 0;
  if (total >= 6 && st.rep === total - 2) return 'last-three';
  if (total >= 2 && st.rep === total) return 'last-one';
  return NUM_SLUGS[st.rep] || null;
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
