// ─── One-mic arbitration for the guided player's voice ───────────────────────
// Three things can speak: announcement clips, tempo-count clips, and the
// speechSynthesis fallback. One coach, one mic: announcements outrank counts;
// counts DROP rather than talk over anything; a phase word may cut a lingering
// count's tail. A missed count is fine — two voices at once is not.
// Pure functions: callers pass the clock and channel state, so the rules are
// unit-testable (timing pile-ups don't repro reliably by hand).

// May a tempo count / phase word take the mic right now?
//   announceUntil — window claimed by the current announcement (clips or TTS)
//   announceLive  — an announcement source is audibly playing (window
//                   arithmetic can drift; a playing chain cannot)
//   bufUntil      — when the currently playing count clip ends
//   cut           — phase words land on the beat: they may cut a count with
//                   more than a fade-tail (30ms) left; plain counts never
//                   interrupt (>120ms of count remaining = drop).
export function mayInterject(
  { now, announceUntil, announceLive, bufUntil },
  { cut = false } = {},
) {
  if (announceLive || now < announceUntil) {
    return { speak: false, stopBuf: false };
  }
  const tail = bufUntil - now;
  if (tail > (cut ? 30 : 120)) {
    return cut
      ? { speak: true, stopBuf: true }
      : { speak: false, stopBuf: false };
  }
  return { speak: true, stopBuf: false };
}

// Estimated spoken length of a TTS phrase at the player's rate (~1.05).
// TTS claims the announce window up front from this estimate — utterance
// onstart/onend are unreliable (iOS can skip them while a voice loads), and
// an unclaimed window lets counts talk over the announcement's opening words.
// The live `speechSynthesis.speaking` check covers a long-running voice; this
// covers the gap before playback actually starts.
export function ttsWindowMs(text) {
  const words = String(text ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.min(8000, Math.max(900, words * 340 + 400));
}
