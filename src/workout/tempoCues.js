// ─── What the coach says on each tempo beat ──────────────────────────────────
// The athlete is under a bar with eyes off the screen — the ear alone must
// carry three things: when to move (phase words on the beat), how to pace a
// long phase (in-phase counts), and HOW FAR INTO THE SET they are (rep
// numbers + end-of-set milestones; without these a floor press just chants
// "lift… lower" forever and the set's end is a surprise).
// Pure decision logic — main.js owns the clips, mic, and percussion.

export const NUM_SLUGS = [
  'zero',
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

export function phaseWordSlug(label) {
  if (label === 'UP' || label === 'LIFT') return 'lift';
  if (label === 'SQUEEZE') return 'squeeze';
  if (label === 'PAUSE') return 'hold';
  return 'lower';
}

// The word for one tempo beat, or null for a silent beat.
//   Rep-start beats (first phase of the pattern, second 0) count the REP:
//   milestones outrank numbers ("last three" three out on long sets, "last
//   one" on the final rep), numbers outrank the phase word. Every other
//   phase boundary keeps its phase word, and phases ≥3s pace their middle
//   seconds ("lower… two… three") — a 2s phase saying "two" is noise.
export function tempoBeatSlug(st, tempo) {
  const repStart = st.phaseSec === 0 && st.label === tempo?.pattern?.[0]?.[0];
  if (repStart) {
    const total = tempo.reps || 0;
    if (total >= 6 && st.rep === total - 2) return 'last-three';
    if (total >= 2 && st.rep === total) return 'last-one';
    if (NUM_SLUGS[st.rep]) return NUM_SLUGS[st.rep];
  }
  if (st.phaseSec === 0) return phaseWordSlug(st.label);
  return st.phaseLen >= 3 ? (NUM_SLUGS[st.phaseSec + 1] ?? null) : null;
}
