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

  // ── Lower Back & Hips (Movementgems) ───────────────────────────────────────
  // These sets run 2 to 4 minutes, so each movement carries three lines — the
  // player has a lot of quiet minutes to fill. Burn is the target, pain never
  // is, and breaking mid-set is expected: several lines say exactly that.
  'hip-internal-rotation': [
    { slug: 'cue-hip-internal-rotation-1', text: 'Sit tall — chest stays up' },
    {
      slug: 'cue-hip-internal-rotation-2',
      text: 'Small lift, all from the hip',
    },
    { slug: 'cue-hip-internal-rotation-3', text: 'Burn yes, pain no' },
  ],
  'hip-airplane': [
    { slug: 'cue-hip-airplane-1', text: 'Rotate the hip, not the back' },
    { slug: 'cue-hip-airplane-2', text: 'Slow — own the balance' },
    { slug: 'cue-hip-airplane-3', text: 'Back leg long behind you' },
  ],
  'side-hip-abduction': [
    {
      slug: 'cue-side-hip-abduction-1',
      text: 'Hips stacked — do not roll back',
    },
    { slug: 'cue-side-hip-abduction-2', text: 'Up and slightly behind' },
    { slug: 'cue-side-hip-abduction-3', text: 'Toes level, leg straight' },
  ],
  'side-hip-adduction': [
    { slug: 'cue-side-hip-adduction-1', text: 'Bottom leg does the work' },
    { slug: 'cue-side-hip-adduction-2', text: 'Straight leg, lift and hold' },
    { slug: 'cue-side-hip-adduction-3', text: 'Stay stacked on your side' },
  ],
  'hip-flexor-lift': [
    { slug: 'cue-hip-flexor-lift-1', text: 'Tall spine — no leaning back' },
    { slug: 'cue-hip-flexor-lift-2', text: 'Hands off — hold it up there' },
    { slug: 'cue-hip-flexor-lift-3', text: 'Keep the knee locked long' },
  ],
  'ql-plank': [
    { slug: 'cue-ql-plank-1', text: 'Hips high — drive them up' },
    { slug: 'cue-ql-plank-2', text: 'Push the floor away' },
    { slug: 'cue-ql-plank-3', text: 'Break if you must, then back on' },
  ],
  plank: [
    { slug: 'cue-plank-1', text: 'Ribs down, glutes on' },
    { slug: 'cue-plank-2', text: 'One line — no sagging' },
    { slug: 'cue-plank-3', text: 'Breathe. Rest and restart if needed' },
  ],
  'back-extension': [
    { slug: 'cue-back-extension-1', text: 'Lift to straight — never past' },
    { slug: 'cue-back-extension-2', text: 'Long spine, slow down' },
    { slug: 'cue-back-extension-3', text: 'Stop at pain, not at burn' },
  ],
  'wall-groin-stretch': [
    { slug: 'cue-wall-groin-stretch-1', text: 'Let gravity do it' },
    { slug: 'cue-wall-groin-stretch-2', text: 'Long breaths — stop pushing' },
  ],
  '90-90-pushup': [
    { slug: 'cue-90-90-pushup-1', text: 'Both shins stay square' },
    { slug: 'cue-90-90-pushup-2', text: 'Up over the front hip' },
    { slug: 'cue-90-90-pushup-3', text: 'Spine long — do not round' },
  ],
  'couch-stretch': [
    { slug: 'cue-couch-stretch-1', text: 'Tuck the tail, squeeze the glute' },
    { slug: 'cue-couch-stretch-2', text: 'Tall chest — no arching' },
  ],
  'elephant-walk': [
    { slug: 'cue-elephant-walk-1', text: 'Flat back — raise the hands' },
    { slug: 'cue-elephant-walk-2', text: 'One knee bends, one straightens' },
    { slug: 'cue-elephant-walk-3', text: 'Keep walking — easy rhythm' },
  ],

  // ── CrossFit movements + cardio stations (2026-08-10) ─────────────────────
  // A cardio station runs 40–45s inside its minute, so one line each is plenty
  // — the coach should be quiet while he is breathing hard.
  'db-push-press': [
    { slug: 'cue-db-push-press-1', text: 'Dip from the knees, ribs down' },
    { slug: 'cue-db-push-press-2', text: 'Punch it — finish overhead' },
  ],
  'db-hang-snatch': [
    { slug: 'cue-db-hang-snatch-1', text: 'From the hang — never the floor' },
    { slug: 'cue-db-hang-snatch-2', text: 'Snap the hips, stay light' },
    { slug: 'cue-db-hang-snatch-3', text: 'Back rounds, set ends' },
  ],
  'db-front-rack-lunge': [
    { slug: 'cue-db-front-rack-lunge-1', text: 'Elbows up, chest tall' },
    { slug: 'cue-db-front-rack-lunge-2', text: 'Step back, knee down light' },
  ],
  'bear-crawl': [
    { slug: 'cue-bear-crawl-1', text: 'Hips low and level' },
    { slug: 'cue-bear-crawl-2', text: 'Short steps — no swinging' },
  ],
  'jumping-jack': [
    { slug: 'cue-jumping-jack-1', text: 'Land soft, arms all the way up' },
  ],
  'reverse-lunge': [
    { slug: 'cue-reverse-lunge-1', text: 'Step back — chest stays tall' },
  ],
  'high-knees': [
    { slug: 'cue-high-knees-1', text: 'Run tall — knees to the hips' },
  ],
  'skater-bound': [
    { slug: 'cue-skater-bound-1', text: 'Land on one leg and stick it' },
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
