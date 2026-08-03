// ─── The coach's form lines ──────────────────────────────────────────────────
// One short line per exercise, spoken sparingly in quiet windows (mid-rest
// before a set, early into a long hold). Quiet confidence: imperative, calm,
// never shouty — a reminder, not a hype man. Recorded clips land in
// public/voice/<slug>.m4a (see VOICE-RECORDING.md); a missing clip falls back
// to speech synthesis automatically.

export const FORM_CUES = {
  // ── Rehab / daily session ──────────────────────────────────────────────────
  'dead-hang': [
    { slug: 'cue-dead-hang-1', text: 'Long spine — relax and breathe' },
  ],
  'cat-camel': [{ slug: 'cue-cat-camel-1', text: 'Slow — segment by segment' }],
  't-spine-reach': [
    { slug: 'cue-t-spine-reach-1', text: 'Reach through and exhale' },
  ],
  'mcgill-curlup': [
    { slug: 'cue-mcgill-curlup-1', text: 'Lower back stays on the floor' },
    { slug: 'cue-mcgill-curlup-2', text: 'Small lift — neck long' },
  ],
  'side-plank': [
    { slug: 'cue-side-plank-1', text: 'One straight line — hips high' },
    { slug: 'cue-side-plank-2', text: 'Push the floor away' },
  ],
  'bird-dog': [
    { slug: 'cue-bird-dog-1', text: 'Reach long, not high' },
    { slug: 'cue-bird-dog-2', text: 'Hips stay level' },
  ],
  'glute-bridge': [
    { slug: 'cue-glute-bridge-1', text: 'Squeeze at the top' },
    { slug: 'cue-glute-bridge-2', text: 'Ribs down — no arching' },
  ],
  rdl: [
    { slug: 'cue-rdl-1', text: 'Hips back, back flat' },
    { slug: 'cue-rdl-2', text: 'Bar close to your legs' },
  ],
  'glute-kickback': [
    { slug: 'cue-glute-kickback-1', text: 'Squeeze — no arching your back' },
  ],
  'single-leg-bridge': [
    { slug: 'cue-single-leg-bridge-1', text: 'Hips level — no tilting' },
    { slug: 'cue-single-leg-bridge-2', text: 'Drive through the heel' },
  ],
  'pogo-hop': [
    { slug: 'cue-pogo-hop-1', text: 'Stiff ankles — quick off the floor' },
  ],
  'broad-jump': [{ slug: 'cue-broad-jump-1', text: 'Land soft and stick it' }],
  'power-pushup': [
    { slug: 'cue-power-pushup-1', text: 'Sharp push, soft landing' },
  ],
  'hamstring-stretch': [
    { slug: 'cue-hamstring-stretch-1', text: 'Easy pull — breathe into it' },
  ],
  'hip-flexor-stretch': [
    { slug: 'cue-hip-flexor-stretch-1', text: 'Tall torso, hips forward' },
  ],

  // ── Density 40 ─────────────────────────────────────────────────────────────
  'pull-up': [
    { slug: 'cue-pull-up-1', text: 'Full hang at the bottom' },
    { slug: 'cue-pull-up-2', text: 'Chest to the bar' },
  ],
  'pull-up-bw': [{ slug: 'cue-pull-up-bw-1', text: 'Full hang at the bottom' }],
  'cable-row-1arm': [
    { slug: 'cue-cable-row-1arm-1', text: 'Pull to the hip — torso still' },
  ],
  'chest-supported-row': [
    { slug: 'cue-chest-supported-row-1', text: 'Squeeze the blades together' },
  ],
  'db-lateral-raise': [
    { slug: 'cue-db-lateral-raise-1', text: 'To shoulder height, no higher' },
    { slug: 'cue-db-lateral-raise-2', text: 'No lean-back' },
  ],
  'cable-lateral-raise': [
    { slug: 'cue-cable-lateral-raise-1', text: 'Slow on the way down' },
  ],
  'band-lateral-raise': [
    { slug: 'cue-band-lateral-raise-1', text: 'To shoulder height, no higher' },
  ],
  'rope-pushdown': [
    { slug: 'cue-rope-pushdown-1', text: 'Elbows pinned to your sides' },
  ],
  'overhead-triceps': [
    { slug: 'cue-overhead-triceps-1', text: 'Elbows narrow, ribs down' },
  ],
  'hammer-curl': [
    { slug: 'cue-hammer-curl-1', text: 'Elbows at your ribs — no swing' },
  ],
  'supinated-curl': [
    { slug: 'cue-supinated-curl-1', text: 'No swing — squeeze it up' },
  ],
  'reverse-curl': [
    { slug: 'cue-reverse-curl-1', text: 'Wrists straight, elbows still' },
  ],
  'suitcase-carry': [
    { slug: 'cue-suitcase-carry-1', text: 'Stay tall — no leaning' },
  ],
  'farmer-carry': [
    { slug: 'cue-farmer-carry-1', text: 'Shoulders packed, walk tall' },
  ],
  'reverse-wrist-curl': [
    { slug: 'cue-reverse-wrist-curl-1', text: 'Forearms glued to your thighs' },
  ],
  'wrist-curl': [
    { slug: 'cue-wrist-curl-1', text: 'Full stretch at the bottom' },
  ],
  'front-squat': [
    { slug: 'cue-front-squat-1', text: 'Elbows high, chest proud' },
    { slug: 'cue-front-squat-2', text: 'Knees track your toes' },
  ],
  'rfe-split-squat': [
    { slug: 'cue-rfe-split-squat-1', text: 'Torso tall — drop straight down' },
  ],
  'db-split-squat': [
    { slug: 'cue-db-split-squat-1', text: 'Torso tall — drop straight down' },
  ],
  'face-pull': [
    { slug: 'cue-face-pull-1', text: 'Pull to your eyebrows, thumbs back' },
  ],
  'band-pull-apart': [
    { slug: 'cue-band-pull-apart-1', text: 'Squeeze the blades together' },
  ],
  'lat-pulldown': [
    { slug: 'cue-lat-pulldown-1', text: 'Chest up — elbows down and back' },
  ],
  'elevated-pushup': [
    { slug: 'cue-elevated-pushup-1', text: 'One rigid line — no sag' },
  ],
  'band-fly': [{ slug: 'cue-band-fly-1', text: 'Wide arc, ribs down' }],
  'cable-fly-low': [
    { slug: 'cue-cable-fly-low-1', text: 'Wide arc — hands to eye level' },
  ],
  'floor-press': [
    { slug: 'cue-floor-press-1', text: 'Lower back flat on the floor' },
  ],
  'db-floor-press': [
    { slug: 'cue-db-floor-press-1', text: 'Lower back flat on the floor' },
  ],
  'incline-db-press': [
    { slug: 'cue-incline-db-press-1', text: 'Ribs down — press smooth' },
  ],
};

// Rotate deterministically: same seed → same line (a crash-restored session
// replays identically), consecutive seeds walk the list so back-to-back sets
// and back-to-back days don't repeat one line forever.
export function pickFormCue(exId, seed = 0) {
  const list = FORM_CUES[exId];
  if (!list?.length) return null;
  return list[((seed % list.length) + list.length) % list.length];
}
