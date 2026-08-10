// ─── Gemini art manifest — every guided exercise's pose prompts ──────────────
// Consumed by generate-art.mjs. One entry per exercise id (must match
// REHAB_EXERCISES / PROGRAM_EXERCISES keys — unit-tested):
//   scene     — equipment + setup, shared by both poses
//   a         — start pose ("-a" file)
//   b         — working pose ("-b" file; omit for single-pose holds)
//   important — the form line Gemini loves to get wrong, restated hard
// Poses are generated as SEPARATE images chained on a reference image, so
// each description must stand alone (no "LEFT figure / RIGHT figure").
// Source of truth for style + the original two-figure blocks:
// REHAB-ART-PROMPTS.md.

export const STYLE_PROMPT = `Create a flat vector-style fitness exercise illustration, like the demonstration art in modern workout apps.

CHARACTER: an athletic adult man, completely faceless — a clean skin-tone face shape with a simple ear, no eyes, nose, or mouth. Short black hair, natural tan skin. He wears a light grey athletic tank top, charcoal-black training shorts ending just above the knee, and black low-profile training shoes with white soles.

STYLE: clean flat vector illustration with solid fill colors only — no gradients, no outlines, no texture. The arm and leg on the far side of his body are a slightly darker flat shade for depth. A single subtle flat ellipse ground shadow under the figure in neutral grey-beige. No text, no logo, no watermark, no border, no props except equipment named in the exercise.

VIEW: side profile with a very slight three-quarter turn toward the viewer.`;

export const SINGLE_LAYOUT = `LAYOUT: ONE figure only, the whole body fully in frame. The figure is LARGE, filling most of the image height, centered, with only a small margin around him.`;

// Two-pose exercises are generated as ONE image with both poses (the model
// renders pose pairs far more distinctly than via chained edits) and split
// automatically at the empty gap between the figures. Wide side-by-side by
// default; exercises marked `stack: true` (lying / horizontal bodies, where
// side-by-side tempts the model into inventing a standing figure) go one
// ABOVE the other and split on rows instead.
export const PAIR_LAYOUT = `LAYOUT: a wide landscape image showing this SAME character TWICE, side by side, with clear empty space between the two figures — they must never touch or overlap, and each has his own equipment and his own ground shadow. Both figures are the same size, FACE THE SAME DIRECTION, and are fully in frame with no body part cropped.`;

export const STACK_LAYOUT = `LAYOUT: a tall portrait image showing this SAME character TWICE, one ABOVE the other, with clear empty vertical space between the two figures — they must never touch or overlap, and each lies on his own floor line with his own ground shadow. TOP figure and BOTTOM figure are the same size, FACE THE SAME DIRECTION, and are fully in frame with no body part cropped.`;

// The background is removed digitally (see knockOut in generate-art.mjs), so
// ask for a chroma key no figure color can collide with.
export const BG_NOTE = `BACKGROUND: one solid uniform chroma-key magenta, exactly #FF00FF, filling every pixel outside the figure, his equipment and his ground shadow. This exact flat magenta everywhere — no gradient, no vignette — it will be removed digitally. The ground shadow stays grey-beige, NOT magenta.`;

export const REFERENCE_NOTE = `Using the attached image as the exact character and style reference — the same faceless man, same clothing, same flat vector style, same slight three-quarter side view — keep the proportions and rendering style identical. Ignore the attached image's background.`;

export const ART_MANIFEST = {
  // ── Rehab / daily session ──────────────────────────────────────────────────
  'dead-hang': {
    scene: 'a straight pull-up bar overhead',
    a: 'he hangs from the bar, arms fully extended overhead gripping it, body long and relaxed, feet off the ground with toes pointed slightly down',
  },
  'cat-camel': {
    scene: 'on all fours on the floor, hands under shoulders, knees under hips',
    a: 'his whole spine rounded STRONGLY UPWARD into an exaggerated dome — upper back pushed high toward the ceiling, head and tailbone both tucked far down, belly drawn up',
    b: 'his whole spine swayed STRONGLY DOWNWARD into an exaggerated dip — belly dropped low toward the floor, chest and tailbone both tilted up, head raised looking forward',
    important:
      'the two poses are opposite extremes of spine curvature — the curve must be obvious and exaggerated, a smooth arc of the whole spine',
  },
  't-spine-reach': {
    scene:
      'kneeling with his hips sitting back on his heels, chest lowered toward the floor, both arms stretched far forward on the floor',
    a: 'both palms flat on the floor, spine long, forehead near the floor',
    b: 'one hand threaded under his chest toward the opposite side, that shoulder and upper back rotated toward the floor',
    important:
      'the rotation comes from the UPPER back only — hips stay square and seated toward the heels',
  },
  'mcgill-curlup': {
    scene:
      'lying on his back, one knee bent with the foot flat on the floor, the other leg lying straight, both hands tucked palms-down under the arch of his lower back',
    a: 'head and shoulders resting on the floor',
    b: 'head and shoulders lifted only a few centimeters off the floor, neck neutral, lower back flat on the floor',
    important:
      'this is NOT a sit-up or crunch — the lift is very small and the spine does not bend',
    // A body lying flat is as wide as the frame, so two of them side by side
    // always touch and the split fails (it did, twice). Stacked is what the
    // flag is for — every other lying exercise here already uses it.
    stack: true,
  },
  'side-plank': {
    scene: 'lying on his side propped on his forearm',
    a: 'elbow directly under his shoulder, body in one perfectly straight line from head to stacked feet, hips lifted off the floor, top hand resting on his hip',
  },
  'bird-dog': {
    scene:
      'on all fours, hands under shoulders, knees under hips, back flat like a tabletop',
    a: 'all four limbs on the floor',
    b: 'one arm extended straight forward and the opposite leg extended straight back, both parallel to the floor, back still flat, hips level',
    important: 'the arm and leg reach LONG, not high',
  },
  'glute-bridge': {
    scene:
      'lying on his back, knees bent, feet flat on the floor hip-width apart, arms resting on the floor at his sides',
    a: 'hips resting on the floor',
    b: 'hips lifted so his knees, hips and shoulders form one straight diagonal line, squeezing at the top; his head stays on the floor',
    important: 'his head and shoulders stay on the floor in both poses',
  },
  rdl: {
    scene:
      'holding a barbell with both hands in front of his thighs, overhand grip',
    a: 'standing tall, bar resting at his thighs, knees soft',
    b: 'hips pushed far back, torso hinged forward with a completely FLAT straight back, the bar lowered to mid-shin level sliding close along his legs, knees only slightly bent',
    important:
      'this is a hip hinge, NOT a squat — the hips stay high and the shins stay vertical',
  },
  'glute-kickback': {
    scene: 'on all fours, hands under shoulders, knees under hips, back flat',
    a: 'both knees on the floor, one leg ready to move',
    b: 'one leg driven straight back and up behind him, knee extended, sole of the shoe facing the ceiling-wall corner, back still flat with no arch',
    important:
      'the leg lifts from the GLUTE — the lower back stays flat, no arching, hips stay square',
  },
  'single-leg-bridge': {
    scene:
      'lying on his back, one knee bent with that foot flat on the floor, the other leg held straight out, arms resting at his sides',
    a: 'hips on the floor, the straight leg raised in line with his thighs',
    b: 'hips lifted on the planted leg so knee, hips and shoulders form one straight line, the straight leg staying in line with his body',
    important: 'hips stay perfectly level — no tilting',
  },
  'pogo-hop': {
    scene: 'standing tall, arms relaxed at his sides',
    a: 'captured mid-hop just off the floor, both ankles stiff and springy, knees nearly straight, toes pointed slightly down, a small gap of air under his shoes',
    important:
      'the bounce comes from the ankles — knees stay nearly straight, the hop is small and quick',
  },
  'broad-jump': {
    scene: 'open floor, no equipment',
    a: 'loaded to jump: crouched with hips back, knees bent, torso leaned forward, both arms swung straight back behind him',
    b: 'landed softly a stride ahead: feet flat, knees bent absorbing, hips back, arms forward for balance, chest up',
    important: 'the landing is SOFT and stuck — knees bent, no stumble',
  },
  'power-pushup': {
    stack: true,
    scene:
      'a horizontal push-up position on the floor — body one rigid straight line facing the floor, hands under shoulders, toes on the ground',
    a: 'chest lowered to just above the floor, elbows bent at 45 degrees, body horizontal',
    b: 'the top of an explosive push: arms fully extended and both palms a few centimeters OFF the floor, body still one rigid horizontal line facing the floor',
    important:
      'BOTH poses are horizontal push-up positions facing the floor — never standing or kneeling; the TWO FIGURES MUST LOOK CLEARLY DIFFERENT: top figure LOW with elbows deeply bent, bottom figure HIGH with arms perfectly straight and palms airborne; no hip sag',
  },
  'hamstring-stretch': {
    scene: 'lying on his back, one leg flat on the floor',
    a: 'the other leg raised straight up with the foot flexed, both hands holding behind the raised thigh, gently pulling it toward him',
  },
  'hip-flexor-stretch': {
    scene:
      'half-kneeling: one knee on the floor with the shin flat behind him, the other foot planted in front with the knee bent at 90 degrees',
    a: 'torso tall and upright, hips shifted slightly forward, both hands resting on the front knee',
  },

  // ── Lower Back & Hips (Movementgems) ───────────────────────────────────────
  // Every one of these is a single long set, so the `b` pose is the working
  // end of the movement, not a separate rep phase. Floor work is `stack: true`
  // — side by side, the model reliably invents a standing second figure.
  'hip-internal-rotation': {
    scene:
      'sitting on the floor, torso tall and upright, both knees bent with the feet planted wider than the knees, hands resting on the floor behind his hips for support',
    a: 'both feet flat on the floor, both knees pointing up',
    b: 'one knee dropped inward toward the floor and that same foot LIFTED clear of the floor, the other foot still planted',
    important:
      'the lifted foot is off the floor while that knee stays dropped inward — the torso stays tall, it must not lean back',
    stack: true,
  },
  'hip-airplane': {
    scene:
      'balancing on one leg with the torso hinged forward until it is level with the floor, the other leg extended straight out behind him at the same height as his back',
    a: 'hips level and square to the floor, arms stretched straight out in front of him',
    b: 'the pelvis rotated OPEN — the back hip lifted high and turned toward the ceiling, the same arms still stretched forward',
    important:
      'the standing knee stays soft and the standing foot stays flat — the whole rotation happens at the hip, not the low back',
  },
  'side-hip-abduction': {
    scene:
      'lying on his side on the floor, body in one straight line, the bottom arm stretched out flat on the floor under his head, the top hand planted on the floor in front of his chest',
    a: 'both legs stacked and straight, resting on the floor',
    b: 'the top leg raised high, straight, and slightly behind the line of his body, foot level',
    important:
      'the hips stay stacked vertically and do not roll backward, and the raised leg stays straight with the toes pointing forward, not up',
    stack: true,
  },
  'side-hip-adduction': {
    scene:
      'lying on his side on the floor, the bottom arm stretched out flat on the floor under his head, the TOP leg crossed over the bottom one with that knee bent high and that foot planted flat on the floor in front of his thighs',
    a: 'the bottom leg straight and resting on the floor',
    b: 'the bottom leg raised straight up off the floor toward the underside of the crossed top leg',
    important:
      'the working leg is the BOTTOM one and it stays perfectly straight as it lifts — the top foot stays planted on the floor',
    stack: true,
  },
  'hip-flexor-lift': {
    scene:
      'sitting on the floor with the torso tall and upright and both legs stretched out straight in front of him, hands resting on the floor beside his hips',
    a: 'both legs straight and resting on the floor',
    b: 'one straight leg lifted as high as it will go, the other still resting on the floor, hands NOT touching the raised leg',
    important:
      'the raised leg stays completely straight and the torso stays tall and vertical — he must not lean back to lift higher',
    stack: true,
  },
  'ql-plank': {
    scene:
      'a side plank on the floor: the bottom forearm flat on the floor with the elbow directly under the shoulder, legs stacked and straight, the top hand resting on his top hip',
    a: 'hips lifted so the body forms one straight line from ear to ankle',
    b: 'the hips driven even HIGHER than the straight line, the waist clearly lifted toward the ceiling',
    important:
      'the bottom shoulder stays packed and pushed away from the floor — it must not collapse, and the hips must never sag',
  },
  plank: {
    scene:
      'a front plank on the floor: both forearms flat on the floor with the elbows directly under the shoulders, toes tucked under',
    a: 'the body held in one perfectly straight line from head to heels, hips level with the shoulders',
    important:
      'the hips are exactly in line — not sagging toward the floor and not piked up toward the ceiling',
    stack: true,
  },
  'back-extension': {
    scene:
      'set up in a 45-degree Roman chair back extension bench, hips resting on the angled pad and both ankles hooked under the ankle rollers, arms hanging relaxed toward the floor',
    a: 'the torso hinged all the way DOWN toward the floor from the hips, spine long',
    b: 'the torso lifted UP until the body is one straight line from head to heels, arms still hanging',
    important:
      'the top position is exactly straight — the back must NOT arch backward past the line of the legs',
  },
  'wall-groin-stretch': {
    scene:
      'lying on his back on the floor with his hips right up against a plain wall and both legs extended straight up the wall, arms resting on the floor out to his sides',
    a: 'both legs straight up the wall and together',
    b: 'both straight legs fallen wide apart into a broad V against the wall, heels still touching the wall surface',
    important:
      'the low back and both shoulders stay flat on the floor, and both legs stay straight — this is a relaxed stretch, not a strain',
    stack: true,
  },
  '90-90-pushup': {
    scene:
      'sitting on the floor in the 90/90 position: the front leg bent 90 degrees with the shin across in front of him, the back leg bent 90 degrees out to his other side, both shins flat on the floor',
    a: 'sitting down on the floor with one hand planted on the floor beside him',
    b: 'pushed up so his hips are OFF the floor and he is up tall over the front hip, both shins still on the floor in the same 90/90 shape',
    important:
      'both shins stay pinned in the 90/90 position while the hips lift — the spine stays long, it must not round',
  },
  'couch-stretch': {
    scene:
      'in a half-kneeling lunge with his back foot and shin propped up against the front face of a couch behind him, the front foot planted flat on the floor with the knee bent at 90 degrees',
    a: 'one hand resting lightly on the front knee, torso upright',
    b: 'the torso fully tall and vertical, tailbone tucked under, the back glute visibly squeezed, both hands off the knee',
    important:
      'the low back stays FLAT with the pelvis tucked — no arching backward to fake depth',
  },
  'elephant-walk': {
    scene:
      'hinged forward at the hips with both hands flat on the floor in front of his feet and both legs nearly straight, head hanging relaxed',
    a: 'both knees nearly straight, both heels down',
    b: 'one knee bent with that heel lifted while the OTHER leg is pushed completely straight with its heel pressed down',
    important:
      'the back stays long and flat throughout — he does not round his spine to reach the floor',
    stack: true,
  },

  // ── CrossFit movements + cardio stations (2026-08-10) ─────────────────────
  'db-push-press': {
    scene:
      'standing tall holding a dumbbell in each hand racked at his shoulders, elbows in front of him',
    a: 'a short shallow dip — knees bent slightly, torso perfectly vertical, dumbbells still at the shoulders',
    b: 'both dumbbells punched straight overhead with the arms locked out, legs straight, biceps beside his ears',
    important:
      'the dip is entirely in the KNEES — the torso stays vertical and the low back never arches, even at lockout',
  },
  'db-hang-snatch': {
    scene:
      'holding ONE dumbbell in one hand, arm hanging straight down in front of his thigh, feet hip width',
    a: 'hinged forward at the hips with the dumbbell just ABOVE his knee, back flat, shoulders over the weight',
    b: 'standing fully upright with that same dumbbell punched straight overhead in one hand, arm locked, other arm out for balance',
    important:
      'the start is a shallow hinge with the dumbbell ABOVE the knee — never at the floor — and the back stays flat, never rounded',
  },
  'db-front-rack-lunge': {
    scene:
      'holding a dumbbell in each hand racked at his shoulders with the elbows up, torso vertical',
    a: 'standing tall with both feet together, dumbbells at the shoulders',
    b: 'in a deep reverse lunge — one leg stepped far BACK with that knee just above the floor, front shin vertical, torso still perfectly upright and elbows still high',
    important:
      'the torso is bolt upright the whole time and the step goes BACKWARD, not forward',
  },
  'bear-crawl': {
    scene:
      'on all fours on the floor with his knees hovering just above the ground, hands under his shoulders, back flat and level',
    a: 'both hands planted, knees hovering an inch off the floor, hips level with the shoulders',
    b: 'mid-crawl — one hand and the OPPOSITE knee lifted and moving forward, the other hand and knee supporting, back still flat and level',
    important:
      'the knees hover barely off the floor and the back stays flat as a table — the hips must not swing side to side or pike up',
    stack: true,
  },
  'jumping-jack': {
    scene: 'standing on a flat floor with no equipment at all',
    a: 'feet together, arms straight down at his sides',
    b: 'mid-jack — feet jumped wide apart and both arms swung straight overhead, hands nearly touching above his head',
    important: 'both poses are the same person mid-exercise, landing softly on the whole foot',
  },
  'reverse-lunge': {
    scene: 'standing on a flat floor with no equipment, hands relaxed at his sides',
    a: 'standing tall with both feet together',
    b: 'in a deep reverse lunge — one leg stepped far BACK with that knee just above the floor, front shin vertical, torso upright',
    important: 'the step goes BACKWARD and the torso stays vertical — no forward lean',
  },
  'high-knees': {
    scene: 'running on the spot on a flat floor with no equipment',
    a: 'standing tall on one leg, the other foot just leaving the floor, arms bent at his sides',
    b: 'one knee driven UP to hip height with that shin hanging down, up on the ball of the standing foot, opposite arm driven forward',
    important:
      'the torso stays vertical — he must not lean back as the knee comes up',
  },
  'skater-bound': {
    scene: 'bounding sideways on a flat floor with no equipment',
    a: 'loaded on one leg with the knee bent, ready to push off sideways, the other foot off the floor',
    b: 'landing on the opposite single leg with that knee softly bent and the trail leg swept BEHIND him, chest tall, arms counterbalancing',
    important:
      'he lands on ONE leg with the knee tracking over the toes — the feet never cross in front of each other',
  },

  // ── Density 40 ─────────────────────────────────────────────────────────────
  'pull-up': {
    scene:
      'hanging from a straight pull-up bar mounted HIGH above standing reach, wearing a small dark backpack, with visible empty air between his shoes and the floor',
    a: 'full dead hang, arms completely straight overhead, shoulders stretched up by his ears, knees slightly bent with feet crossed at the ankles, dangling in the air',
    b: 'pulled all the way up: chin just above the bar, elbows pulled down and back, chest toward the bar, knees slightly bent with feet crossed at the ankles, still dangling',
    important:
      'his feet are OFF the ground in BOTH poses — he hangs in the air; there is clear empty space under his shoes, no floor contact whatsoever; the backpack stays flat against his back',
  },
  'pull-up-bw': {
    scene:
      'hanging from a straight pull-up bar mounted HIGH above standing reach, with visible empty air between his shoes and the floor',
    a: 'full dead hang, arms completely straight overhead, shoulders stretched up by his ears, knees slightly bent with feet crossed at the ankles, dangling in the air',
    b: 'pulled all the way up: chin just above the bar, elbows pulled down and back, chest toward the bar, knees slightly bent with feet crossed at the ankles, still dangling',
    important:
      'his feet are OFF the ground in BOTH poses — he hangs in the air; there is clear empty space under his shoes, no floor contact whatsoever',
  },
  'cable-row-1arm': {
    scene:
      'a cable machine column with a low pulley at ankle height; a single D-handle connects to the pulley by a clearly drawn taut cable; he stands in a split stance, hips hinged slightly back, back flat and long, free hand braced on his front thigh',
    a: 'working arm fully extended toward the low pulley holding the D-handle, the cable drawn taut from handle to pulley, lat stretched, torso still',
    b: 'the D-handle pulled to his hip, the cable still clearly connecting it to the low pulley, elbow driven behind him, shoulder blade squeezed, torso unchanged',
    important:
      'he holds a CABLE HANDLE connected by a visible cable to the machine in BOTH figures — no dumbbells; only the arm moves; ONE single unbroken cable line visibly connects the pulley to the handle in his hands — no other lines, poles, stubs or floating fragments anywhere in the image',
  },
  'chest-supported-row': {
    scene:
      'lying chest-down on an incline bench set to a low angle, exactly one dumbbell in each hand and no other equipment anywhere, feet braced on the floor',
    a: 'both arms hanging straight down toward the floor, dumbbells at full stretch below the bench, shoulder blades apart, chest glued to the pad',
    b: 'both dumbbells rowed UP to the sides of his ribs at bench height, elbows bent past 90 degrees driven up behind his back, shoulder blades squeezed together, chest still glued to the pad',
    important:
      'exactly TWO dumbbells total, one per hand, no extras lying around; in the working pose the dumbbells are clearly lifted to rib height — the two poses must differ obviously',
  },
  'db-lateral-raise': {
    scene: 'standing tall with a dumbbell in each hand',
    a: 'arms hanging at his sides, soft elbows',
    b: 'both arms raised straight out to the sides, hands EXACTLY level with his shoulders — perfectly horizontal arms forming a T, slight elbow bend, knuckles leading, ribs down',
    important:
      'in the working pose the arms are EXACTLY horizontal — hands at shoulder height, never above it; torso upright with no lean-back',
  },
  'cable-lateral-raise': {
    view:
      'seen from the FRONT — he faces the viewer straight on, so an arm raised to the side travels across the picture, not toward the camera',
    scene:
      'a compact cable machine column with a low pulley stands beside him; the handle is in the hand FARTHER from the machine, the cable crossing low in front of his shins to that hand; his near hand rests on the column for balance',
    a: 'facing the viewer, the working arm hanging down across his body toward the low pulley, cable gently slack',
    b: 'facing the viewer, the working arm raised straight out to his side to exactly shoulder height — half of a T — the cable taut in a straight diagonal from the low pulley across his shins up to his hand',
    important:
      'the arm travels sideways in line with his shoulders, NEVER forward like a front raise; it stops exactly at shoulder height; ONE single unbroken cable line visibly connects the pulley to the handle in his hands — no other lines, poles, stubs or floating fragments anywhere in the image',
  },
  'band-lateral-raise': {
    scene:
      'standing on the middle of a long resistance band, holding one end in each hand',
    a: 'arms at his sides, band slack ready',
    b: 'both arms raised straight out to shoulder height forming a T, the band stretched taut in a V shape from under his feet to each hand',
    important: 'arms stop exactly at shoulder height, no lean-back',
  },
  'rope-pushdown': {
    scene:
      'a tall cable machine column beside him with a pulley at the TOP; a thick two-ended rope attachment hangs from the high pulley on a clearly drawn taut cable; he stands upright facing the machine, elbows pinned to his sides',
    a: 'gripping the two rope ends at chest height, forearms up, the cable running from the rope straight up to the high pulley',
    b: 'arms fully extended straight down, the two rope ends split apart beside his thighs, the cable still running up to the high pulley, elbows still pinned, shoulders down',
    important:
      'the cable machine with its high pulley is VISIBLE in both figures and the rope hangs FROM the pulley by one taut cable — never floating free; the elbows never leave his sides; ONE single unbroken cable line visibly connects the pulley to the handle in his hands — no other lines, poles, stubs or floating fragments anywhere in the image',
  },
  'overhead-triceps': {
    scene:
      'facing AWAY from a low cable pulley, the rope held behind his head, one foot slightly forward, ribs down',
    a: 'elbows bent, hands behind his neck, elbows pointing to the ceiling beside his ears',
    b: 'arms extended fully overhead and slightly forward, rope ends split, elbows still narrow',
    important:
      'SIDE PROFILE view like the reference — never drawn from behind; no lower-back arch, ribs stay down',
  },
  'hammer-curl': {
    scene:
      'standing tall, a dumbbell in each hand held with a neutral thumbs-up grip',
    a: 'arms straight at his sides',
    b: 'both dumbbells curled to shoulder height, thumbs still up, elbows staying at his ribs, torso perfectly upright',
    important:
      'each dumbbell is held VERTICAL — neutral hammer grip, thumb side up, the round end face of the dumbbell toward the viewer; no lean-back, elbows pinned at the ribs',
  },
  'supinated-curl': {
    scene: 'standing tall, dumbbells at his sides with palms facing FORWARD',
    a: 'arms straight, palms forward',
    b: 'dumbbells curled to shoulder height with palms now facing his shoulders, elbows pinned to his ribs, upright torso',
    important: 'no swing — the torso does not move',
  },
  'reverse-curl': {
    scene:
      'standing tall holding a light barbell with both hands, palms facing DOWN in an overhand grip',
    a: 'arms straight, the bar resting at his thighs, knuckles forward',
    b: 'the bar curled to chest height with palms still facing down, wrists straight, elbows pinned at his ribs',
    important: 'the palms face DOWN the whole time and the wrists stay straight',
  },
  'suitcase-carry': {
    scene: 'open floor, one heavy dumbbell',
    a: 'mid-stride, walking, carrying the single dumbbell in one hand at his side like a suitcase; posture perfectly tall and level — shoulders even, hips even, no leaning toward or away from the weight — the free arm slightly out for balance',
  },
  'farmer-carry': {
    scene: 'open floor, a heavy dumbbell in EACH hand',
    a: 'mid-stride, walking tall with the dumbbells at his sides; shoulders packed and level, chest proud, arms straight, hips level',
  },
  'reverse-wrist-curl': {
    stack: true,
    scene:
      'seated on a flat bench, leaning slightly forward, both forearms LYING FLAT along the tops of his thighs with the hands and light dumbbells sticking out past his knees, palms facing DOWN',
    a: 'forearms flat on the thighs, wrists relaxed so the knuckles droop below knee level, dumbbells hanging low',
    b: 'forearms still flat on the thighs, only the hands raised — knuckles lifted as high as the wrists allow, dumbbells tilted up',
    important:
      'this is a tiny wrist movement: the forearms stay GLUED to the thighs in both poses and the dumbbells NEVER rise above knee height — if a dumbbell is higher than his knees the image is wrong',
  },
  'wrist-curl': {
    scene:
      'seated on a flat bench, leaning slightly forward, both forearms LYING FLAT along the tops of his thighs with the hands and light dumbbells sticking out past his knees, palms facing UP',
    a: 'forearms flat on the thighs, wrists rolled open so the dumbbells sit low in his fingers below knee level',
    b: 'forearms still flat on the thighs, only the hands curled — wrists rolled fully up toward the forearms, dumbbells lifted',
    important:
      'this is a tiny wrist movement: the forearms stay GLUED to the thighs in both poses and the dumbbells NEVER rise above knee height — if a dumbbell is higher than his knees the image is wrong',
  },
  'front-squat': {
    scene:
      'a barbell with plates racked across the FRONT of his shoulders at collarbone height, arms crossed over the bar pressing it against his shoulders, upper arms raised so the elbows point straight FORWARD at shoulder height, standing inside a power rack with visible side safety pins at thigh height',
    a: 'standing fully upright, chest proud, upper arms horizontal with elbows high in front of the bar',
    b: 'squatted down until his thighs are just above the safety pins, torso remarkably upright, upper arms still horizontal with elbows high, heels flat, knees tracking over his toes',
    important:
      'in BOTH poses his upper arms are HORIZONTAL with the elbows lifted to shoulder height pointing straight forward — the elbows NEVER drop, especially in the deep squat',
  },
  'box-step-up': {
    scene:
      'a knee-high box sits on the floor directly IN FRONT of him; a dumbbell hangs in each hand at his sides',
    a: 'standing on the floor behind the box, one whole foot already placed flat on top of the box, the other foot still flat on the floor, torso tall, dumbbells at his sides',
    b: 'standing fully upright ON TOP of the box on the working leg, hip and knee locked out, the trailing leg hanging below with its foot off the floor, torso tall and vertical, dumbbells at his sides',
    important:
      'the torso stays VERTICAL in both poses — never leaning forward over the box; the working foot is FLAT on the box, never on the ball of the foot',
  },
  'box-squat': {
    scene:
      'a knee-high box sits on the floor directly BEHIND him, close enough to sit back onto; no weights, bodyweight only',
    a: 'standing tall in front of the box, feet shoulder-width, arms reaching forward at chest height for balance',
    b: 'squatted down until his backside just TOUCHES the top of the box, thighs about parallel to the floor, chest up and torso TALL, low back neutral, arms reaching forward',
    important:
      'he only TOUCHES the box, he is not sitting or resting on it; the torso stays upright and the low back stays flat — never rounded or tucked under at the bottom',
  },
  'push-up': {
    scene: 'open floor, no equipment',
    a: 'top of a push-up: arms locked straight, hands under the shoulders, body one straight rigid line from head to heels, toes on the floor',
    b: 'bottom of a push-up: elbows bent to about 45 degrees from the ribs, chest an inch off the floor, body STILL one straight line — hips neither sagging nor piked',
    important:
      'the spine and hips stay in one straight line in BOTH poses — a sagging or piked hip is wrong',
  },
  'rfe-split-squat': {
    scene:
      'a knee-high box sits on the floor BEHIND him; his rear leg reaches back so the TOP of that rear foot rests flat on the box, shoelaces down, while his front foot stands flat on the floor a long stride ahead; a dumbbell hangs in each hand',
    a: 'standing tall on the front leg, the rear foot up on the box behind him, dumbbells at his sides',
    b: 'lowered until the front thigh is parallel to the floor, torso tall and upright, rear knee dropped toward the floor with the rear foot STILL on top of the box, dumbbells hanging straight down',
    important:
      'the rear foot is elevated ON the box in BOTH poses — never on the floor; the torso stays tall, not a forward lunge',
  },
  'db-split-squat': {
    scene:
      'a LONG split stance on flat ground — front foot a full stride ahead of the rear foot, rear heel raised — a dumbbell hanging in each hand',
    a: 'standing tall in the long split stance, one foot clearly far in front of the other, dumbbells at his sides',
    b: 'dropped STRAIGHT down in the same split stance: front thigh parallel to the floor, rear knee hovering just above the floor, torso tall, dumbbells hanging straight down',
    important:
      'the feet are clearly SPLIT front-to-back in both poses — never side by side; he lowers straight down, torso tall, front shin near vertical',
  },
  'face-pull': {
    scene:
      'a compact free-standing cable machine column on its own base plate stands directly in FRONT of him at arm’s length (each figure faces his OWN separate machine); a two-ended rope attachment connects to its upper-chest-height pulley by one clearly drawn taut cable',
    a: 'arms extended forward holding the rope ends, the cable taut back to the pulley, shoulder blades reaching',
    b: 'rope pulled to his eyebrows, the cable still clearly connected to the pulley, elbows high and wide, hands split apart with thumbs pointing behind him, chest tall',
    important:
      'the rope is connected to the machine by a visible taut cable in BOTH figures; the pull lands at eyebrow height with elbows HIGH; ONE single unbroken cable line visibly connects the pulley to the handle in his hands — no other lines, poles, stubs or floating fragments anywhere in the image',
  },
  'band-pull-apart': {
    scene:
      'standing tall holding a resistance band stretched HORIZONTALLY between his two hands, directly in front of his chest at shoulder height, both arms straight out in front of him — the band touches nothing but his hands',
    a: 'hands close together in front of his chest, the short span of band between them hanging slightly slack',
    b: 'both straight arms swept wide out to his sides, the band now stretched long and taut horizontally across his chest, shoulder blades squeezed together',
    important:
      'the band is held in the air between his two hands at chest height — it never touches the floor, his feet, or anything else; arms stay straight and horizontal',
  },
  'lat-pulldown': {
    scene:
      'seated at a lat pulldown station with a visible high pulley, wide bar, and cable',
    a: 'arms fully extended overhead gripping the bar, lats stretched, torso tall',
    b: 'bar pulled down to his collarbones, elbows driven down and back, chest lifted, shoulder blades squeezed',
    important: 'the bar comes to the collarbones in FRONT — no leaning far back',
  },
  'elevated-pushup': {
    stack: true,
    scene:
      'a DECLINE push-up: his HANDS are on the floor under his shoulders and his FEET are raised behind him on a low box, so his body slopes DOWNHILL from the elevated feet to his head — head lower than feet',
    a: 'arms fully extended, body one rigid straight line sloping down from the feet on the box to his hands on the floor, ribs down',
    b: 'chest lowered to just above the floor, elbows bent at 45 degrees, feet STILL up on the box, the body line still perfectly rigid and sloping downhill',
    important:
      'his FEET are on the box and his HANDS are on the floor in BOTH poses; his head is the LOWEST point of the body, clearly below the level of the box — the body slopes DOWN from feet to head; no hip sag; the two poses must clearly differ in elbow bend and chest height',
  },
  'band-fly': {
    scene:
      'a long resistance band anchored to a wall fitting at FLOOR level BEHIND him, both band handles in his hands, the band running low past his hips from behind; one foot slightly forward',
    a: 'arms reaching down-and-back toward the low anchor behind him, handles at hip height, slight elbow bend, chest open, band gently taut',
    b: 'both arms swept forward and UP so the hands finish at EYE level in a wide hugging arc, hands nearly meeting far in front of his face, arms long with only soft elbows, the band stretched hard from the anchor behind him, ribs down',
    important:
      'the anchor is BEHIND him at floor level; in the working pose the hands finish at EYE level with nearly straight arms — a wide hugging arc, not a press or a curl',
  },
  'cable-fly-low': {
    scene:
      'standing between two low cable pulleys, a handle in each hand, one foot slightly forward',
    a: 'arms down-and-back toward the low pulleys at hip height, slight elbow bend, chest open, cables taut behind him',
    b: 'both arms swept forward and UP to eye level in a wide hugging arc, hands nearly meeting, cables stretched from the low anchors, ribs down',
    important: 'a wide hugging arc with soft elbows — no pressing',
  },
  'floor-press': {
    scene:
      'lying flat on his back on the floor inside a power rack, knees bent, feet flat, pressing a barbell with plates',
    a: 'upper arms resting on the floor, elbows bent 90 degrees, bar above his chest',
    b: 'arms fully extended, bar locked out directly over his shoulders, lower back flat against the floor',
    important: 'the lower back stays flat on the floor',
  },
  'db-floor-press': {
    stack: true,
    scene:
      'lying flat on his back on the floor seen from the side — whole body in frame including the head — knees bent, feet flat on the floor, a dumbbell in each hand',
    a: 'upper arms resting on the floor, elbows bent 90 degrees, dumbbells held above his chest with neutral grips',
    b: 'arms fully extended straight up, dumbbells locked out directly over his shoulders, lower back flat against the floor',
    important:
      'his whole body including the head is fully in frame in both poses; the upper arms touch the floor at the bottom, the lower back stays flat',
  },
  'incline-db-press': {
    scene:
      'an incline bench whose backrest is clearly ANGLED UP at about 40 degrees — the head end high, the seat low — he lies back on the sloped backrest with his torso reclined on the slope, feet flat on the floor, a dumbbell in each hand',
    a: 'dumbbells held at the sides of his upper chest, elbows bent below shoulder level, torso reclined on the angled backrest',
    b: 'arms fully extended, dumbbells pressed up and slightly together above his upper chest perpendicular to the sloped torso, ribs down',
    important:
      'the backrest is visibly INCLINED at about 40 degrees in both poses — his torso slopes up from hips to head; this is NOT a flat bench',
  },
};
