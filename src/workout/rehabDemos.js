// Built-in exercise demos for the guided rehab player — flat-illustration
// figures (no stick person), animated in-SVG, no video, no network. Keys match
// REHAB_EXERCISES ids. Static data only: this module builds SVG strings with a
// tiny forward-kinematics rig at import time; nothing computes at play time.
//
// Art system: 200×120 viewBox, ground y≈104, dark-bg grayscale "clothed
// figure" palette — skin off-white, top mid-grey, leggings dark grey, hair
// mid-grey, shoes light. Far-side limbs are shaded darker for depth. The
// figure is a jointed rig: every part is a tapered filled capsule hanging
// from its joint; poses are per-joint angles (degrees, clockwise, 0 = aligned
// with the parent's downward axis), so all eight demos share one anatomy.
//
// Motion:
//   movements — SMIL animateTransform on the joints between pose A (start)
//               and pose B (contraction), pausing at B. Static attributes
//               hold pose B, so stripping <animate*> (reduced motion, done by
//               the player) freezes at the working position. The bridge loop
//               runs on the same 4s tempo as the rep counter.
//   holds     — a CSS wrapper (.rd-hang/.rd-pulse/.rd-rock/.rd-shift) around
//               the figure or one limb; wrappers carry no transform attribute
//               so CSS animation composes safely with the rig.
//   action    — .rd-action motion trails / emphasis ticks, gently pulsing.

// ── Palette (dark background) ────────────────────────────────────────────────
const SKIN = '#f1eee8';
const SKIN_FAR = '#b9b5ae';
const TOP = '#9c9c9c';
const TOP_FAR = '#6e6e6e';
const LEGS = '#5f5f5f';
const LEGS_FAR = '#494949';
const HAIR = '#7d7d7d';
const SHOE = '#d6d3ce';
const SHOE_FAR = '#a39f99';
// Cut-out separation: every part carries a thin dark outline so overlapping
// parts read as distinct shapes (head vs torso vs limbs) on the dark bg.
const SEP = 'stroke="#191919" stroke-width="1.4"';

// ── Rig geometry ─────────────────────────────────────────────────────────────
const L = { torso: 31, uarm: 14, farm: 16, thigh: 19, shin: 17, foot: 9 };

// Tapered capsule from the joint (radius r1) to the far end (r2), hanging +y.
const taper = (len, r1, r2, fill) =>
  `<path d="M ${-r1} 0 A ${r1} ${r1} 0 0 1 ${r1} 0 L ${r2} ${len} A ${r2} ${r2} 0 0 1 ${-r2} ${len} Z" fill="${fill}" ${SEP}/>`;

// Joint: translate to the attachment point, rotate, optionally animate the
// rotation between pose A and B (static attribute holds B).
function joint(x, y, rot, inner, anim) {
  const a = anim
    ? `<animateTransform attributeName="transform" type="rotate" values="${anim.a};${anim.b};${anim.b};${anim.a};${anim.a}" keyTimes="${anim.kt || '0;.25;.65;.85;1'}" ${anim.ks || 'keySplines=".42 0 .2 1;0 0 1 1;.42 0 .2 1;0 0 1 1" calcMode="spline"'} dur="${anim.dur || '4.5s'}" repeatCount="indefinite"/>`
    : '';
  return `<g transform="translate(${x} ${y})"><g transform="rotate(${rot})">${a}${inner}</g></g>`;
}

// arm/leg chains — `far` swaps in the shaded palette. Arms get a short shirt
// sleeve over the shoulder (separates arm from torso); legs wear shorts to the
// knee with skin shins (separates thigh from shin). `hand` appends a plate
// ring (RDL). Angles: sh/el, hip/knee/ankle; anims target sh (arms) / hip.
function arm(x, y, sh, el, far, opts = {}) {
  const skin = far ? SKIN_FAR : SKIN;
  const forearm = taper(L.farm, 3.8, 3, skin) + (opts.hand ? opts.hand : '');
  return joint(
    x,
    y,
    sh,
    taper(L.uarm, 4.6, 4, skin) +
      taper(8, 5.3, 4.5, far ? TOP_FAR : TOP) +
      joint(0, L.uarm, el, forearm, opts.elAnim),
    opts.anim,
  );
}
function leg(x, y, hip, knee, ankle, far, opts = {}) {
  const shortsFill = far ? LEGS_FAR : LEGS;
  const skin = far ? SKIN_FAR : SKIN;
  const shoeFill = far ? SHOE_FAR : SHOE;
  const foot = taper(L.foot, 3.4, 2.8, shoeFill);
  return joint(
    x,
    y,
    hip,
    taper(L.thigh, 6.2, 5.2, shortsFill) +
      joint(
        0,
        L.thigh,
        knee,
        taper(L.shin, 4.6, 3.4, skin) + joint(0, L.shin, ankle, foot),
        opts.kneeAnim,
      ),
    opts.anim,
  );
}

// 3/4-style head, attached at the torso's shoulder end: full hair mass with
// the face as an offset patch toward the front (-x) and chin (-y local).
const headPart = (rot = 0) =>
  joint(
    0,
    L.torso,
    rot,
    `<rect x="-2.8" y="1" width="5.6" height="5" rx="2" fill="${SKIN}"/>` +
      `<circle cy="9.5" r="7.4" fill="${HAIR}" ${SEP}/>` +
      `<circle cx="-2.1" cy="7.9" r="5.7" fill="${SKIN}"/>`,
  );

// A whole figure. Pose: {root:{x,y,rot,scale}, torso, head, armF, armN,
// legF, legN, wrap?, torsoAnim?, rootAnim?}. Legs may be null (drawn
// separately, e.g. inside a CSS wrapper). Render order gives depth:
// far leg → torso(far arm, head, near arm) → near leg.
function figure(p) {
  const s = p.root.scale || 1;
  const rootAnim = p.rootAnim
    ? `<animateTransform attributeName="transform" type="translate" values="${p.rootAnim.a};${p.rootAnim.b};${p.rootAnim.b};${p.rootAnim.a};${p.rootAnim.a}" keyTimes="${p.rootAnim.kt || '0;.25;.65;.85;1'}" ${p.rootAnim.ks || 'keySplines=".42 0 .2 1;0 0 1 1;.42 0 .2 1;0 0 1 1" calcMode="spline"'} dur="${p.rootAnim.dur || '4.5s'}" repeatCount="indefinite"/>`
    : '';
  const torsoInner =
    arm(...p.armF.at, p.armF.sh, p.armF.el, true, p.armF) +
    taper(L.torso, 7.4, 8.2, TOP) +
    `<circle r="7.6" fill="${LEGS}"/>` +
    headPart(p.head || 0) +
    arm(...p.armN.at, p.armN.sh, p.armN.el, false, p.armN);
  const ordered =
    (p.legF
      ? leg(0, 0, p.legF.hip, p.legF.knee, p.legF.ankle, true, p.legF)
      : '') +
    joint(0, 0, p.torso, torsoInner, p.torsoAnim) +
    (p.legN
      ? leg(0, 0, p.legN.hip, p.legN.knee, p.legN.ankle, false, p.legN)
      : '');
  const core = `<g transform="translate(${p.root.x} ${p.root.y}) rotate(${p.root.rot || 0})${s !== 1 ? ` scale(${s})` : ''}">${ordered}</g>`;
  const inner = rootAnim
    ? `<g transform="translate(0 0)">${rootAnim}${core}</g>`
    : core;
  return p.wrap
    ? `<g class="${p.wrap}"${p.wrapStyle ? ` style="${p.wrapStyle}"` : ''}>${inner}</g>`
    : inner;
}

// Shoulder attachment (in torso-local coords, near the torso's shoulder end).
const SH = [0, L.torso - 3];

// ── Scene bits ───────────────────────────────────────────────────────────────
const PROP =
  'stroke="currentColor" stroke-width="3" stroke-linecap="round" fill="none" opacity=".22"';
const GROUND = `<line x1="16" y1="104" x2="184" y2="104" ${PROP}/>`;
const shadow = (cx, rx) =>
  `<ellipse cx="${cx}" cy="107" rx="${rx}" ry="3" fill="currentColor" opacity=".1"/>`;
// Action lines instead of literal arrows: `swoosh` = a curved motion trail
// (quadratic path), `tick` = a short emphasis stroke at a working/stretch
// site. Grouped under .rd-action (gentle pulse via CSS).
const swoosh = (d, w = 3) =>
  `<path d="${d}" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" fill="none"/>`;
const tick = (x1, y1, x2, y2, w = 3) =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="currentColor" stroke-width="${w}" stroke-linecap="round"/>`;
const action = (inner) => `<g class="rd-action">${inner}</g>`;
const svg = (inner) =>
  `<svg viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${inner}</svg>`;

// Bridge timing (matches the 4s rep tempo: lift 1s, squeeze 2s, lower 1s).
const T4 = {
  kt: '0;.25;.75;1',
  ks: 'keySplines=".42 0 .2 1;0 0 1 1;.42 0 .2 1" calcMode="spline"',
  dur: '4s',
};

// ── The demos ────────────────────────────────────────────────────────────────
export const REHAB_DEMOS = {
  'dead-hang': svg(
    `<line x1="46" y1="13" x2="154" y2="13" ${PROP} stroke-width="4"/>` +
      shadow(100, 20) +
      figure({
        wrap: 'rd-hang',
        root: { x: 101, y: 61, rot: 0, scale: 0.8 },
        torso: 180,
        head: 2,
        armF: { at: [-2.5, 27], sh: 8, el: -4 },
        armN: { at: [2.5, 27], sh: -8, el: 4 },
        legF: { hip: 4, knee: 3, ankle: 25, far: true },
        legN: { hip: -4, knee: -3, ankle: -25 },
      }) +
      action(
        tick(87, 50, 86, 62) +
          tick(80, 56, 79, 65, 2.6) +
          tick(115, 50, 116, 62) +
          tick(122, 56, 123, 65, 2.6),
      ),
  ),

  'mcgill-curlup': svg(
    GROUND +
      shadow(104, 55) +
      figure({
        root: { x: 112, y: 94, rot: 0, scale: 0.95 },
        torso: 101,
        torsoAnim: { a: 90, b: 101 },
        head: -8,
        armF: { at: SH, sh: -155, el: -10 },
        armN: { at: [0, L.torso - 6], sh: -158, el: -12 },
        legF: { hip: -122, knee: 89, ankle: -45, far: true },
        legN: { hip: -90, knee: -2, ankle: -80 },
      }) +
      action(
        swoosh('M 30 92 Q 23 80 30 70') + swoosh('M 40 87 Q 35 78 40 70', 2.6),
      ),
  ),

  'side-plank': svg(
    GROUND +
      shadow(100, 58) +
      figure({
        wrap: 'rd-pulse',
        wrapStyle: 'transform-origin:78% 92%',
        root: { x: 102, y: 86, rot: 0 },
        torso: 100,
        head: -6,
        armF: { at: SH, sh: -95, el: 84 },
        armN: { at: [0, L.torso - 7], sh: -55, el: -20 },
        legF: { hip: -70, knee: 0, ankle: -22, far: true },
        legN: { hip: -74, knee: 0, ankle: -24 },
      }) +
      action(tick(101, 73, 102, 62) + tick(109, 71, 111, 61, 2.6)),
  ),

  'bird-dog': svg(
    GROUND +
      shadow(98, 54) +
      figure({
        root: { x: 121, y: 71, rot: 0 },
        torso: 92,
        head: -12,
        armF: { at: SH, sh: -90, el: 2 },
        armN: {
          at: [0, L.torso - 8],
          sh: 8,
          el: 2,
          anim: { a: -92, b: 8 },
        },
        legF: { hip: 8, knee: -8, ankle: 78, far: true },
        legN: {
          hip: -97,
          knee: -4,
          ankle: 12,
          anim: { a: -20, b: -97 },
          kneeAnim: { a: 66, b: -4 },
        },
      }) +
      action(
        swoosh('M 32 56 Q 22 54 14 56') +
          swoosh('M 34 64 Q 25 63 18 64', 2.6) +
          swoosh('M 170 58 Q 180 56 188 58') +
          swoosh('M 168 66 Q 177 65 184 66', 2.6),
      ),
  ),

  'glute-bridge': svg(
    GROUND +
      shadow(95, 52) +
      figure({
        root: { x: 105, y: 83, rot: 0 },
        rootAnim: { a: '2 14', b: '0 0', ...T4 },
        torso: 76,
        torsoAnim: { a: 90, b: 76, ...T4 },
        head: 6,
        armF: { at: SH, sh: -166, el: 10 },
        armN: { at: [0, L.torso - 6], sh: -162, el: 12 },
        legF: {
          hip: -110,
          knee: 98,
          ankle: -78,
          far: true,
          anim: { a: -136, b: -110, ...T4 },
          kneeAnim: { a: 124, b: 98, ...T4 },
        },
        legN: {
          hip: -113,
          knee: 100,
          ankle: -80,
          anim: { a: -139, b: -113, ...T4 },
          kneeAnim: { a: 126, b: 100, ...T4 },
        },
      }) +
      action(
        swoosh('M 92 60 Q 104 52 116 60') +
          swoosh('M 96 68 Q 105 62 114 68', 2.6),
      ),
  ),

  'single-leg-bridge': svg(
    GROUND +
      shadow(95, 52) +
      figure({
        root: { x: 105, y: 83, rot: 0 },
        rootAnim: { a: '2 14', b: '0 0', ...T4 },
        torso: 76,
        torsoAnim: { a: 90, b: 76, ...T4 },
        head: 6,
        armF: { at: SH, sh: -166, el: 10 },
        armN: { at: [0, L.torso - 6], sh: -162, el: 12 },
        legF: {
          hip: -110,
          knee: 98,
          ankle: -78,
          far: true,
          anim: { a: -136, b: -110, ...T4 },
          kneeAnim: { a: 124, b: 98, ...T4 },
        },
        // near leg extended straight, riding the pelvis as the hips lift
        legN: { hip: -100, knee: 0, ankle: -80 },
      }) +
      action(
        swoosh('M 92 58 Q 104 50 116 58') + swoosh('M 96 66 Q 105 60 114 66', 2.6),
      ),
  ),

  rdl: svg(
    GROUND +
      shadow(95, 40) +
      figure({
        root: { x: 107, y: 69, rot: 0 },
        rootAnim: { a: '-6 -2', b: '0 0', kt: '0;.3;.6;.9;1', dur: '4s' },
        torso: 103,
        torsoAnim: { a: 176, b: 103, kt: '0;.3;.6;.9;1', dur: '4s' },
        head: -4,
        armF: {
          at: SH,
          sh: -101,
          el: 2,
          anim: { a: -174, b: -101, kt: '0;.3;.6;.9;1', dur: '4s' },
        },
        armN: {
          at: [0, L.torso - 5],
          sh: -105,
          el: 2,
          anim: { a: -178, b: -105, kt: '0;.3;.6;.9;1', dur: '4s' },
          hand: `<circle cy="${L.farm + 2}" r="8" fill="none" stroke="${SHOE}" stroke-width="5"/>`,
        },
        legF: { hip: 10, knee: -4, ankle: 84, far: true },
        legN: { hip: 14, knee: -8, ankle: 86 },
      }) +
      action(
        swoosh('M 92 30 Q 108 32 116 44') +
          swoosh('M 100 38 Q 110 40 114 48', 2.6),
      ),
  ),

  // Raised leg lives in its own CSS-rocked wrapper (no transform attribute on
  // the wrapper, so the animation composes with the rig).
  'hamstring-stretch': svg(
    GROUND +
      shadow(100, 55) +
      figure({
        root: { x: 104, y: 95, rot: 0, scale: 0.95 },
        torso: 90,
        head: 4,
        armF: { at: SH, sh: -120, el: -24 },
        armN: { at: [0, L.torso - 6], sh: -124, el: -28 },
        legF: { hip: -90, knee: -2, ankle: -82, far: true },
        legN: null,
      }) +
      `<g class="rd-rock" style="transform-box:fill-box;transform-origin:0% 100%">${leg(
        104,
        94,
        174,
        -6,
        -80,
        false,
      )}</g>` +
      action(tick(116, 78, 123, 76) + tick(114, 86, 121, 84, 2.6)),
  ),

  'hip-flexor-stretch': svg(
    GROUND +
      shadow(100, 48) +
      figure({
        root: { x: 100, y: 73, rot: 0 },
        torso: 179,
        head: 2,
        armF: { at: SH, sh: -140, el: -22 },
        armN: { at: [0, L.torso - 5], sh: -146, el: -24 },
        legF: { hip: -33, knee: -55, ankle: -80, far: true },
        legN: { hip: 76, knee: -62, ankle: 74 },
      }) +
      action(tick(94, 84, 87, 86) + tick(96, 91, 89, 93, 2.6)),
  ),
};
