// HOTMUM exercise demos — the same flat-illustration figure KILOS draws, in
// Sam's palette.
//
// WHY THIS EXISTS: her player used to show a name, a timer and a line of text.
// The one thing a beginner actually needs — what does this look like — was the
// only thing missing, and a YouTube link mid-set is not an answer at 6am with
// a baby monitor on. KILOS solved this already (src/workout/rehabDemos.js):
// a jointed rig, poses as per-joint angles, animated in-SVG with SMIL. No
// video, no network, nothing to load.
//
// So this module SHARES that rig rather than forking it. rehabDemos.js exports
// its primitives (2026-08-20) and paints with `--fig-*` CSS custom properties
// that fall back to the KILOS greys, so the identical code draws a grey figure
// on his black and a warm figure on her plum — see `.hm-demo` in style.css.
// Don't copy poses in here; alias them.
//
// Three kinds of entry below:
//   ALIAS   — the movement genuinely IS the KILOS one (a box squat and a
//             controlled sit-to-stand are the same picture).
//   POSED   — authored here because the movement is hers: the chair-supported
//             work, the standing core, the knee block.
//   ANIMATED — poses with `anim` on a joint move between the start and the
//             working position on the same beat as the tempo. Holds don't
//             move, because a wall sit that bobs is a lie about the exercise.
//
// The player strips <animate*> under prefers-reduced-motion, which freezes
// every figure at its WORKING position — so each pose is drawn contracted,
// with the animation running back to the start rather than forward to it.

import {
  action,
  BOX,
  DB,
  figure,
  GROUND,
  L,
  PROGRAM_DEMOS,
  PROP,
  REHAB_DEMOS,
  SH,
  shadow,
  standing,
  svg,
  swoosh,
  tick,
} from '../workout/rehabDemos.js';

// Her tempos are 3–5s a rep, slower than the rehab rig's 4.5s default. Two
// timings cover the lot: the eccentric-led work (5s) and the quick standing
// core (3s).
const T5 = {
  kt: '0;.2;.6;.8;1',
  ks: 'keySplines=".42 0 .2 1;0 0 1 1;.42 0 .2 1;0 0 1 1" calcMode="spline"',
  dur: '5s',
};
const T3 = {
  kt: '0;.33;.66;.9;1',
  ks: 'keySplines=".42 0 .2 1;0 0 1 1;.42 0 .2 1;0 0 1 1" calcMode="spline"',
  dur: '3s',
};

// A chair. It is the most important prop in this program: on every squat
// pattern the chair is the depth stop, so it belongs IN the picture rather
// than in a sentence underneath it (see the knee doctrine in program.js).
const CHAIR = (x = 128) =>
  BOX(x, 84, 34, 20) +
  `<line x1="${x + 2}" y1="84" x2="${x + 2}" y2="46" ${PROP} stroke-width="4"/>`;
const WALL = (x = 146) =>
  `<line x1="${x}" y1="14" x2="${x}" y2="104" ${PROP} stroke-width="4"/>`;

// ── Where the hand actually is ───────────────────────────────────────────────
// Dumbbells were being placed by eye, which is how KILOS' farmer carry ended
// up with its weights resting near the ankles. The rig is a transform chain,
// so the hand is computable: root → rotate(torso) → translate(at) → rotate(sh)
// → down the upper arm → rotate(sh+el) → down the forearm. Run the same maths
// the renderer runs and the dumbbell lands in the fist every time.
//
// Takes the SAME pose object passed to figure(), so the two can't drift.
const RAD = Math.PI / 180;
const spin = (deg, x, y) => {
  const c = Math.cos(deg * RAD);
  const s = Math.sin(deg * RAD);
  return [x * c - y * s, x * s + y * c];
};
function hand(pose, which = 'armN') {
  const a = pose[which];
  const [ux, uy] = spin(a.sh, 0, L.uarm);
  const [fx, fy] = spin(a.sh + (a.el || 0), 0, L.farm);
  const [tx, ty] = spin(
    pose.torso ?? 180,
    a.at[0] + ux + fx,
    a.at[1] + uy + fy,
  );
  return [(pose.root?.x ?? 100) + tx, (pose.root?.y ?? 68) + ty];
}
/** A dumbbell drawn in the hand of `which` arm. */
const heldDB = (pose, which) => DB(...hand(pose, which));

// ── Poses shared with the dumbbell placement ─────────────────────────────────
// Declared as objects rather than inline so `hand()` can be handed the exact
// same pose the figure is drawn from.

const STAND_LEGS = {
  legF: { hip: 4, knee: 2, ankle: 86, far: true },
  legN: { hip: -4, knee: -2, ankle: -86 },
};
const SQUAT_LEGS = {
  legF: {
    hip: -74,
    knee: 96,
    ankle: 62,
    far: true,
    anim: { a: 4, b: -74, ...T5 },
  },
  legN: { hip: -70, knee: 92, ankle: 60, anim: { a: -4, b: -70, ...T5 } },
};

const GOBLET_POSE = {
  root: { x: 100, y: 66, rot: 0 },
  torso: 168,
  torsoAnim: { a: 180, b: 168, ...T5 },
  head: 6,
  armF: { at: [-4, 26], sh: -128, el: -98 },
  armN: { at: [4, 26], sh: -132, el: -94 },
  ...SQUAT_LEGS,
};

// Wide and SHALLOW — a sumo squat bends the knee far less than a goblet does
// for the same glute work, which is exactly why it's in a knee-limited plan.
const SUMO_POSE = {
  root: { x: 100, y: 64, rot: 0 },
  torso: 176,
  head: 3,
  armF: { at: [-3, 27], sh: 174, el: -2 },
  armN: { at: [3, 27], sh: -174, el: 2 },
  legF: {
    hip: -44,
    knee: 62,
    ankle: 60,
    far: true,
    anim: { a: 4, b: -44, ...T5 },
  },
  legN: { hip: -40, knee: 58, ankle: 58, anim: { a: -4, b: -40, ...T5 } },
};

const LUNGE_POSE = {
  root: { x: 100, y: 66, rot: 0 },
  torso: 176,
  head: 4,
  armF: { at: [-3, 27], sh: 170, el: -6 },
  // near hand out to the chair back — the support IS the safety feature
  armN: { at: [3, 27], sh: -118, el: -34 },
  legF: {
    hip: 40,
    knee: -88,
    ankle: -52,
    far: true,
    anim: { a: 4, b: 40, ...T5 },
  },
  legN: { hip: -22, knee: 42, ankle: 68, anim: { a: -4, b: -22, ...T5 } },
};

const ROW_POSE = {
  root: { x: 112, y: 66, rot: 0 },
  torso: 96,
  head: -6,
  armF: { at: SH, sh: -96, el: 0 },
  armN: {
    at: [0, L.torso - 5],
    sh: -150,
    el: -30,
    anim: { a: -100, b: -150, ...T5 },
  },
  legF: { hip: 6, knee: -4, ankle: 84, far: true },
  legN: { hip: 10, knee: -6, ankle: 86 },
};

const SQUEEZE_POSE = {
  root: { x: 100, y: 66, rot: 0 },
  torso: 180,
  head: 2,
  armF: { at: [-3, 26], sh: -84, el: -4, anim: { a: -128, b: -84, ...T5 } },
  armN: { at: [3, 26], sh: -88, el: 0, anim: { a: -132, b: -88, ...T5 } },
  ...STAND_LEGS,
};

const FLY_POSE = {
  root: { x: 104, y: 68, rot: 0 },
  torso: 122,
  head: -4,
  armF: { at: SH, sh: -78, el: -6, anim: { a: -164, b: -78, ...T5 } },
  armN: {
    at: [0, L.torso - 5],
    sh: -96,
    el: 6,
    anim: { a: -172, b: -96, ...T5 },
  },
  legF: { hip: 8, knee: -4, ankle: 84, far: true },
  legN: { hip: 12, knee: -6, ankle: 86 },
};

const TRI_POSE = {
  root: { x: 100, y: 68, rot: 0 },
  torso: 180,
  head: 2,
  armF: { at: [-3, 27], sh: -4, el: -66, anim: { a: -2, b: -66, ...T5 } },
  armN: { at: [3, 27], sh: 4, el: 66, anim: { a: 2, b: 66, ...T5 } },
  ...STAND_LEGS,
};

// Racked → overhead. Only the shoulder angle can animate on this rig, so the
// elbow stays bent and the arm sweeps up: it reads as a press, which is what
// matters at arm's length on a phone.
const PRESS_POSE = {
  root: { x: 100, y: 68, rot: 0 },
  torso: 180,
  head: 2,
  armF: { at: [-3, 27], sh: -8, el: -16, anim: { a: -62, b: -8, dur: '4s' } },
  armN: { at: [3, 27], sh: 8, el: 16, anim: { a: 62, b: 8, dur: '4s' } },
  ...STAND_LEGS,
};

const CURL_POSE = {
  root: { x: 100, y: 68, rot: 0 },
  torso: 180,
  head: 2,
  armF: { at: [-7, 26], sh: 168, el: 128 },
  armN: { at: [7, 26], sh: -168, el: -128 },
  ...STAND_LEGS,
};

const CARRY_POSE = {
  root: { x: 100, y: 68, rot: 0 },
  torso: 180,
  head: 2,
  armF: { at: [-3, 27], sh: 176, el: 0 },
  armN: { at: [3, 27], sh: -176, el: 0 },
  ...STAND_LEGS,
};

const SUITCASE_POSE = {
  ...CARRY_POSE,
  armF: { at: [-3, 27], sh: 170, el: -6 },
  armN: { at: [3, 27], sh: -176, el: 0 },
};

const GOBLET = svg(
  GROUND +
    shadow(100, 44) +
    CHAIR(112) +
    figure(GOBLET_POSE) +
    heldDB(GOBLET_POSE, 'armN') +
    action(tick(120, 76, 130, 76, 2.6)),
);

const SUMO = svg(
  GROUND +
    shadow(100, 52) +
    figure(SUMO_POSE) +
    heldDB(SUMO_POSE, 'armN') +
    // knees driving OUT — the cue that stops them caving
    action(tick(78, 84, 66, 88, 2.6) + tick(122, 84, 134, 88, 2.6)),
);

export const HOTMUM_DEMOS = {
  // ── ALIAS ─────────────────────────────────────────────────────────────────
  rdl: REHAB_DEMOS.rdl,
  'knee-lift': PROGRAM_DEMOS['high-knees'],
  'lateral-raise': PROGRAM_DEMOS['db-lateral-raise'],
  // A box squat and a controlled sit-to-stand are the same movement with
  // different intent — and the box IS the chair.
  'sit-to-stand': PROGRAM_DEMOS['box-squat'],

  // Authored rather than aliased: KILOS' carry and curl art draws the
  // dumbbells by eye and they land near the ankles. hand() puts them in the
  // fist. Fixing the KILOS poses is a separate job — this is hers.
  'shoulder-press': svg(
    GROUND +
      shadow(100, 44) +
      figure(PRESS_POSE) +
      heldDB(PRESS_POSE, 'armF') +
      heldDB(PRESS_POSE, 'armN') +
      action(swoosh('M 122 40 Q 126 28 122 18', 2.6)),
  ),
  'bicep-curl': svg(
    GROUND +
      shadow(100, 44) +
      figure(CURL_POSE) +
      heldDB(CURL_POSE, 'armF') +
      heldDB(CURL_POSE, 'armN') +
      action(swoosh('M 124 62 Q 132 52 126 44', 2.4)),
  ),
  'farmer-carry': svg(
    GROUND +
      shadow(100, 48) +
      figure(CARRY_POSE) +
      heldDB(CARRY_POSE, 'armF') +
      heldDB(CARRY_POSE, 'armN'),
  ),
  'suitcase-hold': svg(
    GROUND +
      shadow(100, 46) +
      figure(SUITCASE_POSE) +
      heldDB(SUITCASE_POSE, 'armN') +
      // the whole exercise is refusing to tip toward the loaded side
      action(tick(88, 58, 80, 58, 2.4)),
  ),

  // ── POSED ─────────────────────────────────────────────────────────────────

  // Warm-up squat: no chair, no load, and deliberately drawn shallower than
  // the working squat — the warm-up is not the set.
  'bw-squat': svg(
    GROUND +
      shadow(100, 42) +
      figure({
        root: { x: 100, y: 66, rot: 0 },
        torso: 172,
        torsoAnim: { a: 180, b: 172, ...T3 },
        head: 5,
        armF: {
          at: [-3, 27],
          sh: -104,
          el: -6,
          anim: { a: -176, b: -104, ...T3 },
        },
        armN: {
          at: [3, 27],
          sh: -110,
          el: -2,
          anim: { a: -178, b: -110, ...T3 },
        },
        legF: {
          hip: -50,
          knee: 66,
          ankle: 68,
          far: true,
          anim: { a: 4, b: -50, ...T3 },
        },
        legN: { hip: -46, knee: 62, ankle: 66, anim: { a: -4, b: -46, ...T3 } },
      }),
  ),

  // Hinge: hips travel BACK, spine stays long. Hands on the hips so there's
  // nothing to look at except the hinge.
  'standing-hinge': svg(
    GROUND +
      shadow(96, 40) +
      figure({
        root: { x: 106, y: 69, rot: 0 },
        rootAnim: { a: '-6 -2', b: '0 0', ...T3 },
        torso: 108,
        torsoAnim: { a: 176, b: 108, ...T3 },
        head: -4,
        armF: { at: SH, sh: -150, el: -70 },
        armN: { at: [0, L.torso - 5], sh: -154, el: -74 },
        legF: { hip: 10, knee: -4, ankle: 84, far: true },
        legN: { hip: 14, knee: -8, ankle: 86 },
      }) +
      action(swoosh('M 78 56 Q 66 60 68 70') + tick(70, 66, 64, 70, 2.6)),
  ),

  // Same hinge, hands at the temples — heavier on the back line, which is why
  // it warms the upper day rather than the lower one.
  'good-morning': svg(
    GROUND +
      shadow(96, 40) +
      figure({
        root: { x: 106, y: 69, rot: 0 },
        rootAnim: { a: '-4 -2', b: '0 0', ...T3 },
        torso: 118,
        torsoAnim: { a: 176, b: 118, ...T3 },
        head: -6,
        armF: { at: SH, sh: -30, el: -128 },
        armN: { at: [0, L.torso - 5], sh: 30, el: 128 },
        legF: { hip: 8, knee: -4, ankle: 84, far: true },
        legN: { hip: 12, knee: -8, ankle: 86 },
      }) +
      action(swoosh('M 80 52 Q 68 58 70 68')),
  ),

  'arm-circles': svg(
    GROUND +
      shadow(100, 44) +
      figure(
        standing({
          armF: {
            at: [-2.5, 27],
            sh: 92,
            el: 0,
            anim: { a: 140, b: 44, dur: '3s' },
          },
          armN: {
            at: [2.5, 27],
            sh: -92,
            el: 0,
            anim: { a: -140, b: -44, dur: '3s' },
          },
        }),
      ) +
      action(
        swoosh('M 58 30 Q 46 44 58 58') + swoosh('M 142 30 Q 154 44 142 58'),
      ),
  ),

  'shoulder-rolls': svg(
    GROUND +
      shadow(100, 44) +
      figure(
        standing({
          rootAnim: { a: '0 0', b: '0 -4', dur: '3s' },
          armF: { at: [-3, 27], sh: 170, el: -8 },
          armN: { at: [3, 27], sh: -170, el: 8 },
        }),
      ) +
      action(
        swoosh('M 86 46 Q 100 34 114 46', 2.6) + tick(100, 40, 100, 32, 2.2),
      ),
  ),

  // Rotation happens across the screen, not along it, so the figure can only
  // hint at it: folded arms, and the motion lines carry the meaning.
  'torso-rotation': svg(
    GROUND +
      shadow(100, 44) +
      figure(
        standing({
          torso: 176,
          torsoAnim: { a: 186, b: 168, dur: '3s' },
          armF: { at: [-4, 26], sh: -92, el: -104 },
          armN: { at: [4, 26], sh: -96, el: -100 },
        }),
      ) +
      action(
        swoosh('M 74 54 Q 86 44 100 46', 2.6) +
          swoosh('M 126 54 Q 114 44 100 46', 2.6),
      ),
  ),

  'hip-circles': svg(
    GROUND +
      shadow(100, 44) +
      figure(
        standing({
          rootAnim: { a: '-4 0', b: '4 0', dur: '4s' },
          armF: { at: [-4, 26], sh: -142, el: -74 },
          armN: { at: [4, 26], sh: -146, el: -78 },
        }),
      ) +
      action(swoosh('M 78 68 Q 100 56 122 68 Q 100 82 78 68', 2.6)),
  ),

  // Loaded squat TO THE CHAIR. The chair is drawn touching the hips at the
  // bottom of the rep because that is the entire coaching point.
  'goblet-squat': GOBLET,

  // Wide and shallow: less bend at the knee for the same glute work. The
  // dumbbell hangs between the legs.
  'sumo-squat': SUMO,

  // Chair under one hand — the support is the safety feature, so it's drawn.
  'reverse-lunge': svg(
    GROUND +
      shadow(98, 52) +
      CHAIR(140) +
      figure(LUNGE_POSE) +
      heldDB(LUNGE_POSE, 'armF') +
      action(swoosh('M 74 74 Q 62 80 60 90')),
  ),

  'calf-raise': svg(
    GROUND +
      shadow(100, 30) +
      figure({
        root: { x: 100, y: 62, rot: 0 },
        rootAnim: { a: '0 6', b: '0 0', ...T5 },
        torso: 180,
        head: 2,
        armF: { at: [-3, 27], sh: 176, el: 0 },
        armN: { at: [3, 27], sh: -176, el: 0 },
        // Heels up: the FOOT rotates, the shin stays vertical.
        legF: { hip: 3, knee: 1, ankle: 44, far: true },
        legN: { hip: -3, knee: -1, ankle: -44 },
      }) +
      action(tick(100, 24, 100, 14, 2.6)),
  ),

  // A hold, so it does not move. Thighs at parallel and no lower — the pose
  // IS the prescription.
  'wall-sit': svg(
    GROUND +
      WALL(140) +
      shadow(112, 30) +
      figure({
        root: { x: 130, y: 78, rot: 0 },
        torso: 184,
        head: -2,
        armF: { at: [-3, 27], sh: 172, el: -4 },
        armN: { at: [3, 27], sh: -172, el: 4 },
        legF: { hip: -92, knee: 92, ankle: 88, far: true },
        legN: { hip: -88, knee: 88, ankle: 86 },
      }) +
      // The right angle IS the prescription — mark it, don't animate it.
      action(tick(110, 74, 110, 84, 2.4) + tick(110, 84, 122, 84, 2.4)),
  ),

  // Standing on one leg, hand on the chair, other leg lifting away. Abduction
  // happens across the screen from a side view, so the lifted leg is drawn
  // swung out and the motion line does the rest.
  'hip-abduction': svg(
    GROUND +
      shadow(102, 40) +
      CHAIR(140) +
      figure({
        root: { x: 100, y: 66, rot: 0 },
        torso: 178,
        head: 3,
        armF: { at: [-3, 27], sh: 172, el: -4 },
        armN: { at: [3, 27], sh: -120, el: -32 },
        legF: {
          hip: -34,
          knee: 0,
          ankle: 80,
          far: true,
          anim: { a: 4, b: -34, ...T5 },
        },
        legN: { hip: -2, knee: 0, ankle: -86 },
      }) +
      action(swoosh('M 78 82 Q 62 82 56 90') + tick(96, 62, 88, 60, 2.6)),
  ),

  // Hand and knee on the couch, torso flat, dumbbell pulled to the hip.
  'one-arm-row': svg(
    GROUND +
      shadow(104, 48) +
      BOX(120, 78, 44, 26) +
      figure(ROW_POSE) +
      heldDB(ROW_POSE, 'armN') +
      action(swoosh('M 62 88 Q 56 78 62 68')),
  ),

  // Crush the dumbbells together, press straight out. The squeeze is the
  // exercise, so the two dumbbells are drawn touching.
  'squeeze-press': svg(
    GROUND +
      shadow(100, 44) +
      figure(SQUEEZE_POSE) +
      heldDB(SQUEEZE_POSE, 'armF') +
      heldDB(SQUEEZE_POSE, 'armN') +
      action(tick(118, 40, 110, 40, 2.4)),
  ),

  // Hinged, arms opening wide like a wingspan.
  'rear-delt-fly': svg(
    GROUND +
      shadow(98, 42) +
      figure(FLY_POSE) +
      heldDB(FLY_POSE, 'armF') +
      heldDB(FLY_POSE, 'armN') +
      action(swoosh('M 84 40 Q 74 34 66 34', 2.6)),
  ),

  // One dumbbell in both hands, overhead, lowering behind the head.
  'tricep-ext': svg(
    GROUND +
      shadow(100, 44) +
      figure(TRI_POSE) +
      heldDB(TRI_POSE, 'armN') +
      action(swoosh('M 104 14 Q 92 14 86 22', 2.6)),
  ),

  // Standing crunch: the knee comes up AND the ribs come down to meet it.
  'knee-to-elbow': svg(
    GROUND +
      shadow(100, 42) +
      figure({
        root: { x: 100, y: 66, rot: 0 },
        torso: 166,
        torsoAnim: { a: 178, b: 166, ...T3 },
        head: 8,
        armF: { at: [-3, 27], sh: 168, el: -6 },
        armN: {
          at: [3, 27],
          sh: -46,
          el: -122,
          anim: { a: -170, b: -46, ...T3 },
        },
        legF: {
          hip: -96,
          knee: 84,
          ankle: 60,
          far: true,
          anim: { a: 4, b: -96, ...T3 },
        },
        legN: { hip: -4, knee: -2, ankle: -86 },
      }) +
      action(tick(90, 50, 90, 42, 2.6)),
  ),

  // Same shape, opposite elbow — the diagonal is the point.
  'knee-drive': svg(
    GROUND +
      shadow(100, 42) +
      figure({
        root: { x: 100, y: 66, rot: 0 },
        torso: 168,
        torsoAnim: { a: 178, b: 168, ...T3 },
        head: 7,
        armF: {
          at: [-3, 27],
          sh: -50,
          el: -118,
          anim: { a: -172, b: -50, ...T3 },
        },
        armN: { at: [3, 27], sh: -166, el: 10 },
        legF: {
          hip: -92,
          knee: 80,
          ankle: 58,
          far: true,
          anim: { a: 4, b: -92, ...T3 },
        },
        legN: { hip: -4, knee: -2, ankle: -86 },
      }) +
      action(swoosh('M 84 46 Q 92 54 88 62', 2.6)),
  ),
};

/** The figure for an exercise, or '' when there isn't one yet. */
export const demoFor = (exId) => HOTMUM_DEMOS[exId] || '';

/**
 * The same figure with the motion stripped — for lists.
 *
 * A session sheet holds fifteen of these, and fifteen SMIL timelines ticking
 * inside a scrolling list is jank for no benefit: in a list she's scanning
 * what's coming, not learning the movement. Each pose is drawn at its WORKING
 * position, so a frozen figure still shows the shape (same contract as the
 * player's reduced-motion path).
 */
export const stillDemo = (exId) =>
  demoFor(exId).replace(/<animate(Transform)?\b[^>]*\/>/g, '');
