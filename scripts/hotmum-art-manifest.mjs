// ─── HOTMUM art manifest — Sam's exercise illustrations ─────────────────────
// Same pipeline as scripts/art-manifest.mjs (see generate-art.mjs --pack
// hotmum); different character, different palette, different exercise list.
//
// WHY THIS EXISTS: the built-in SVG rig (src/hotmum/demos.js) draws a jointed
// geometric figure. It's honest, offline and free — and it is a fallback, not
// the finish. KILOS shipped generated flat-vector art on top of exactly the
// same rig and the difference is not subtle. Her app gets the same treatment.
//
// One entry per HOTMUM_EXERCISES id (unit-tested — a typo or a gap fails):
//   scene     — setup + equipment, shared by both poses
//   a         — start pose ("-a" file)
//   b         — working pose ("-b" file; omit for single-pose holds)
//   important — the form line the model loves to get wrong, restated hard
//   view      — per-exercise camera override (the frontal moves)
//
// THE CHAIR IS NOT A PROP. It's the depth stop the whole knee doctrine rests
// on (src/hotmum/program.js §2.9), so on every squat pattern the chair is
// named in the scene AND the touch is named in the working pose. Art that
// draws her squatting to the floor teaches the opposite of the program.

export const STYLE_PROMPT = `Create a flat vector-style fitness exercise illustration, like the demonstration art in a modern women's workout app.

CHARACTER: an athletic adult woman, completely faceless — a clean skin-tone face shape with a simple ear, no eyes, nose, or mouth. Dark brown hair tied in a neat low ponytail. Warm light-tan skin. She wears a fitted deep-magenta athletic crop tank top, high-waisted dark plum leggings ending at mid-calf, and white low-profile training shoes.

STYLE: clean flat vector illustration with solid fill colors only — no gradients, no outlines, no texture. The arm and leg on the far side of her body are a slightly darker flat shade for depth. A single subtle flat ellipse ground shadow under her in neutral warm grey. No text, no logo, no watermark, no border, no equipment except what the exercise names.

VIEW: side profile with a very slight three-quarter turn toward the viewer.`;

export const SINGLE_LAYOUT = `LAYOUT: ONE figure only, her whole body fully in frame. The figure is LARGE, filling most of the image height, centered, with only a small margin around her.`;

export const PAIR_LAYOUT = `LAYOUT: a wide landscape image showing this SAME character TWICE, side by side, with clear empty space between the two figures — they must never touch or overlap, and each has her own equipment and her own ground shadow. Both figures are the same size, FACE THE SAME DIRECTION, and are fully in frame with no body part cropped.`;

export const STACK_LAYOUT = `LAYOUT: a tall portrait image showing this SAME character TWICE, one ABOVE the other, with clear empty vertical space between the two figures — they must never touch or overlap, and each has her own floor line and her own ground shadow. TOP figure and BOTTOM figure are the same size, FACE THE SAME DIRECTION, and are fully in frame with no body part cropped.`;

// The one instruction the model keeps breaking: it reaches for the background
// colour when it paints the ground shadow, which knocks the shadow out with
// the background and reads as a 20% "chroma stain" on the figure. Stated twice
// and in caps, because once politely did not hold.
export const BG_NOTE = `BACKGROUND: one solid uniform chroma-key green, exactly #00FF00, filling every pixel outside the figure, her equipment and her ground shadow. This exact flat green everywhere — no gradient, no vignette — it will be removed digitally.

GROUND SHADOW: the flat ellipse shadow under her feet must be WARM NEUTRAL GREY (around #B8B0AC). It must NOT be green, and NOT any tint of green. Green appears ONLY in the background, nowhere else in the image — not in the shadow, not in her clothing, not in the equipment.`;

// Deliberately different from the KILOS wording. That pack says "the same
// faceless man" because its reference IS the character; the first HOTMUM run
// seeds off a KILOS image for STYLE only, so the character must come from the
// prompt and the reference must not be allowed to override it.
export const REFERENCE_NOTE = `Using the attached image as a reference for the FLAT VECTOR RENDERING STYLE ONLY — the same solid-fill shapes, the same faceless treatment, the same slight three-quarter side view, the same clean proportions. The CHARACTER is the woman described above, NOT the person in the attached image: match her hair, her skin tone and her clothing exactly as written. Ignore the attached image's background.`;

const CHAIR = 'a plain sturdy dining chair with a straight back';

export const ART_MANIFEST = {
  // ── warm-up ───────────────────────────────────────────────────────────────
  'bw-squat': {
    scene: 'standing on the floor with no equipment, feet shoulder-width apart',
    a: 'standing tall, arms relaxed at her sides',
    b: 'in a SHALLOW half-squat — hips pushed back and down only a little way, thighs still well above parallel, chest tall, both arms reaching straight forward at shoulder height for balance',
    important:
      'this is a WARM-UP squat and must look clearly SHALLOW — she is nowhere near a deep squat, her thighs stay well above parallel to the floor',
  },
  'standing-hinge': {
    scene: 'standing on the floor with no equipment, hands resting on her hips',
    a: 'standing tall, hands on hips, knees soft',
    b: 'hinged forward at the hips with a long flat back, chest lowered toward parallel with the floor, hips pushed far BACK behind her heels, knees only slightly bent, hands still on her hips',
    important:
      'her back stays perfectly FLAT and long — the movement is the hips travelling backward, never the spine rounding, and the knees barely bend',
  },
  'knee-lift': {
    scene: 'standing tall on the floor with no equipment',
    a: 'standing tall, both feet on the floor, arms bent at her sides',
    b: 'one knee lifted to hip height in front of her, thigh parallel to the floor, standing tall on the other leg, arms bent at her sides',
  },
  'hip-circles': {
    scene: 'standing on the floor with no equipment, hands on her hips',
    a: 'standing with her feet hip-width apart, hands on her hips, hips shifted out to one side in the middle of a slow circle',
    view: 'facing the viewer straight on (frontal view), so the sideways hip movement is visible',
  },
  'arm-circles': {
    scene: 'standing on the floor with no equipment',
    a: 'standing tall with both arms extended straight out to the sides at shoulder height, palms down, mid-way through a slow circle',
    view: 'facing the viewer straight on (frontal view), so both outstretched arms are visible',
  },
  'shoulder-rolls': {
    scene: 'standing on the floor with no equipment, arms hanging relaxed',
    a: 'standing tall, arms hanging relaxed at her sides, both shoulders lifted and rolled back and up toward her ears',
  },
  'torso-rotation': {
    scene:
      'standing on the floor with no equipment, forearms folded across her chest at shoulder height',
    a: 'standing tall with her forearms folded across her chest, torso rotated to one side, hips staying square and facing forward',
    view: 'a three-quarter view from the front, so the rotation of the chest away from the hips is clearly visible',
    important:
      'her hips and feet stay pointing straight forward — only the upper body turns',
  },
  'good-morning': {
    scene:
      'standing on the floor with no equipment, fingertips touching her temples with elbows out wide',
    a: 'standing tall, fingertips at her temples, elbows out wide',
    b: 'hinged forward at the hips to about halfway down, back long and flat, fingertips still at her temples, elbows still wide',
    important: 'the back stays flat and long — it never rounds',
  },

  // ── lower ─────────────────────────────────────────────────────────────────
  rdl: {
    scene:
      'a dumbbell in each hand, hanging in front of her thighs — she wears her usual deep-magenta crop tank top and dark plum leggings',
    a: 'standing tall with both dumbbells hanging at arm\'s length in front of her thighs, knees soft',
    b: 'hinged forward at the hips with a long flat back, chest lowered toward parallel with the floor, hips pushed far BACK, both dumbbells hanging close against the fronts of her shins, knees only slightly bent',
    important:
      'her back stays perfectly FLAT — this is a hip hinge, not a squat: the knees barely bend and the dumbbells stay brushing close to her legs the whole way down',
  },
  'sl-rdl': {
    scene: `${CHAIR} beside her, one hand resting on the chair back for balance, a single dumbbell held in her other hand`,
    a: 'standing tall on one leg, one hand on the chair back, the dumbbell hanging at arm\'s length beside her, the free leg just off the floor',
    b: 'balanced on ONE leg, hinged far forward at the hip so her torso and her lifted free leg form ONE long straight line roughly parallel to the floor, the dumbbell hanging straight down toward the floor, the standing knee only slightly bent, one hand still on the chair back',
    important:
      'the torso and the raised back leg make ONE straight line — the hips stay level and square to the floor, and the standing knee barely bends at all',
  },
  'reverse-lunge': {
    scene: `${CHAIR} beside her, one hand resting on the chair back for balance, a dumbbell in her other hand`,
    a: 'standing tall with both feet together, one hand on the chair back, a dumbbell hanging at her side',
    b: 'in a lunge with one foot stepped far BACKWARD behind her, the back knee lowered toward the floor, the front thigh close to parallel and the front shin nearly vertical, torso upright, one hand still on the chair back',
    important:
      'she steps BACKWARD into the lunge, never forward — the front knee stays stacked over the front ankle and never travels past her toes',
  },
  'goblet-squat': {
    scene: `${CHAIR} directly behind her, and one dumbbell held vertically against her chest with both hands cupping the top end`,
    a: 'standing tall in front of the chair, the dumbbell held vertically at her chest, elbows tucked in',
    b: 'squatted down until her hips are HOVERING JUST ABOVE the front edge of the chair seat with a visible gap of a few centimetres between her backside and the seat, thighs about parallel to the floor, chest tall and upright, dumbbell still at her chest',
    important:
      'she is NOT SITTING. There must be a clearly visible GAP between her backside and the chair seat — she is holding herself just above it, still taking her full weight through her feet. Her heels stay flat on the floor and her knees track out over her toes, never falling inward',
  },
  'sumo-squat': {
    scene:
      'a wide stance with feet much wider than her shoulders and toes turned out, holding one dumbbell hanging vertically between her legs with both hands',
    a: 'standing tall in the wide stance, the dumbbell hanging at arm\'s length between her legs',
    b: 'squatted straight down in the wide stance with her torso upright, thighs about parallel to the floor, knees pushed OUT in line with her turned-out toes, the dumbbell hanging just above the floor between her feet',
    view: 'facing the viewer straight on (frontal view), so the wide stance and the knees pushing outward are clearly visible',
    important:
      'her knees push OUT over her toes and never collapse inward, and her torso stays vertical rather than leaning forward',
  },
  'calf-raise': {
    scene: 'standing on the floor with no equipment, feet hip-width apart',
    a: 'standing flat-footed, arms relaxed at her sides',
    b: 'risen up onto the balls of both feet with her heels lifted as high as they will go, calves visibly contracted, body straight and tall',
  },
  'sl-calf-raise': {
    scene: `${CHAIR} beside her, one hand resting lightly on the chair back for balance`,
    a: 'standing on ONE foot flat on the floor, the other foot tucked up behind her, one hand lightly on the chair back',
    b: 'risen up onto the ball of that ONE foot with the heel lifted as high as it will go, the other foot still tucked behind her, one hand still lightly on the chair back',
    important:
      'she stands on one foot only — the free foot is clearly off the floor and tucked behind her',
  },

  // ── knee strength ─────────────────────────────────────────────────────────
  'wall-sit': {
    scene: 'a plain flat wall behind her',
    a: 'seated in mid-air against the wall — her back flat against the wall, hips and knees both bent to a right angle, thighs exactly parallel to the floor, shins vertical, feet flat, arms hanging relaxed at her sides',
    important:
      'her thighs are exactly parallel to the floor and NOT lower, her knees are directly above her ankles, and her whole back stays flat against the wall',
  },
  'sit-to-stand': {
    scene: `${CHAIR} directly behind her, arms reaching straight forward at shoulder height for balance`,
    a: 'standing tall in front of the chair, arms reaching forward at shoulder height',
    b: 'lowered until her hips are just touching the front edge of the chair seat, thighs about parallel to the floor, chest tall, arms still reaching forward',
    important:
      'she only just touches the chair seat and never rests her weight on it — the chair sets the depth',
  },
  'hip-abduction': {
    scene: `${CHAIR} in front of her, one hand resting on the chair back for balance`,
    a: 'standing tall on both feet, one hand on the chair back',
    b: 'one leg lifted straight OUT TO THE SIDE, knee straight and toes pointing forward, torso staying upright and NOT leaning away, one hand still on the chair back',
    view: 'facing the viewer straight on (frontal view), so the leg lifting sideways away from the body is clearly visible',
    important:
      'the leg goes straight out SIDEWAYS with the knee locked straight, and her torso stays vertical instead of leaning to the opposite side',
  },

  // ── upper ─────────────────────────────────────────────────────────────────
  'shoulder-press': {
    scene: 'a dumbbell in each hand',
    a: 'standing tall with a dumbbell in each hand at shoulder height, elbows bent and tucked slightly in front of her, palms facing forward',
    b: 'both dumbbells pressed straight overhead with her arms fully extended, ribs down and body straight',
    important: 'her lower back stays flat — she does not arch backward',
  },
  'one-arm-row': {
    scene:
      'a low sturdy bench, one hand and the same-side knee resting on the bench, back flat and parallel to the floor, a dumbbell in the free hand',
    a: 'the dumbbell hanging straight down at arm\'s length below her shoulder, back flat and level',
    b: 'the dumbbell pulled up close to her hip with her elbow driving back past her ribs, shoulder blade squeezed, back still flat and level',
    important:
      'her back stays flat and her shoulders stay level — she does not twist her torso to lift the weight',
  },
  'squeeze-press': {
    scene:
      'two dumbbells held together, pressed hard against each other, in front of her chest',
    a: 'standing tall with the two dumbbells pressed firmly together against the middle of her chest, elbows tucked in at her sides',
    b: 'the two dumbbells still pressed firmly together, pushed straight out in front of her chest with her arms fully extended at shoulder height',
    important:
      'the two dumbbells stay touching and pressed hard together the whole time',
  },
  'lateral-raise': {
    scene: 'a dumbbell in each hand',
    a: 'standing tall with a dumbbell hanging at each side, elbows slightly bent',
    b: 'both arms raised straight out to the sides to exactly shoulder height, elbows slightly bent, shoulders down away from her ears',
    view: 'facing the viewer straight on (frontal view), so both raised arms are visible',
    important: 'the arms stop level with her shoulders and go no higher',
  },
  'rear-delt-fly': {
    scene: 'a dumbbell in each hand, hinged forward at the hips',
    a: 'hinged forward at the hips with a flat back, both dumbbells hanging straight down beneath her chest, elbows slightly bent',
    b: 'still hinged forward with a flat back, both arms opened wide out to the sides like a wingspan until level with her back, elbows slightly bent',
    view: 'a three-quarter view from the front so both arms opening wide are visible',
    important:
      'the arms open OUT to the sides like wings — this is not a row, the elbows do not pull backward toward her hips',
  },
  'bicep-curl': {
    scene: 'a dumbbell in each hand',
    a: 'standing tall with both dumbbells hanging at arm\'s length beside her thighs, palms facing forward',
    b: 'both dumbbells curled up to shoulder height with elbows pinned tight against her sides, forearms vertical',
    important: 'her elbows stay pinned at her sides and her torso does not rock back',
  },
  'tricep-ext': {
    scene: 'one dumbbell held vertically in both hands directly overhead',
    a: 'standing tall with the dumbbell held in both hands straight overhead, arms fully extended',
    b: 'the dumbbell lowered behind her head with her elbows bent and pointing up and forward, upper arms staying vertical beside her ears',
    important:
      'her upper arms stay still and vertical beside her head — only the forearms move, and her elbows stay close together, not flaring wide',
  },
  'farmer-carry': {
    scene: 'a dumbbell hanging in each hand at her sides',
    a: 'walking forward mid-stride, standing very tall, a dumbbell hanging at arm\'s length in each hand, shoulders pulled down and back',
    important:
      'she is upright and walking — shoulders down, not shrugged, and not leaning backward',
  },
  'suitcase-hold': {
    scene: 'one single dumbbell hanging in ONE hand at her side',
    a: 'standing perfectly upright and still, one dumbbell hanging at arm\'s length in one hand, the other arm hanging empty and relaxed, her torso dead vertical and NOT leaning toward the loaded side',
    important:
      'she carries the weight in ONE hand only and her body stays perfectly vertical — she is resisting the pull sideways',
    view: 'facing the viewer straight on (frontal view), so the single weight on one side and her level shoulders are visible',
  },

  // ── standing core ─────────────────────────────────────────────────────────
  'knee-to-elbow': {
    scene: 'standing on the floor with no equipment, hands up beside her head',
    a: 'standing tall, both feet on the floor, hands up beside her head with elbows out',
    b: 'one knee driven up toward the SAME-side elbow while that elbow drives down to meet it, her torso crunching down toward the knee on that side, standing tall on the other leg',
    important:
      'the knee and the elbow on the SAME side meet — and her ribs come DOWN to meet the knee rather than the knee doing all the work',
  },
  'knee-drive': {
    scene: 'standing on the floor with no equipment, hands up beside her head',
    a: 'standing tall, both feet on the floor, hands up beside her head with elbows out',
    b: 'one knee driven up and ACROSS her body toward the OPPOSITE elbow, that elbow reaching down and across to meet it, her torso twisting on the diagonal, standing tall on the other leg',
    view: 'a three-quarter view from the front so the diagonal twist across her body is clearly visible',
    important:
      'the knee crosses to the OPPOSITE elbow — it is a diagonal, not a straight-up march',
  },
};
