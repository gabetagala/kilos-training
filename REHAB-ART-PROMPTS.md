# Rehab demo art — Gemini (Nano Banana) prompt kit

Goal: 8 flat-vector exercise illustrations (Hevy-style) for the guided rehab
player. The app is already wired: drop finished files in `public/rehab/` and
they replace the built-in figure automatically.

**File naming** (crop each pose into its own file):

| Exercise | Files |
|---|---|
| Dead Hang | `dead-hang-a.png` (single pose) |
| McGill Curl-Up | `mcgill-curlup-a.png` + `mcgill-curlup-b.png` |
| Side Plank | `side-plank-a.png` (single pose) |
| Bird Dog | `bird-dog-a.png` + `bird-dog-b.png` |
| Glute Bridge | `glute-bridge-a.png` + `glute-bridge-b.png` |
| Single-Leg Bridge | `single-leg-bridge-a.png` + `single-leg-bridge-b.png` |
| Romanian Deadlift | `rdl-a.png` + `rdl-b.png` |
| Hamstring Stretch | `hamstring-stretch-a.png` (single pose) |
| Hip Flexor Stretch | `hip-flexor-stretch-a.png` (single pose) |

`-a` = start pose, `-b` = working pose. When a `-b` exists the app crossfades
between the two (animated, like Hevy); single-pose holds just show `-a`.
SVG/PNG/WebP all work. Export big (≥1024px per pose), PNG is fine.

---

## 1 · Master prompt (run first — establishes character + style)

> Create a flat vector-style fitness exercise illustration, like the
> demonstration art in modern workout apps.
>
> CHARACTER: an athletic adult man, completely faceless — a clean skin-tone
> face shape with a simple ear, no eyes, nose, or mouth. Short black hair,
> natural tan skin. He wears a light grey athletic tank top, charcoal-black
> training shorts ending just above the knee, and black low-profile training
> shoes with white soles.
>
> STYLE: clean flat vector illustration with solid fill colors only — no
> gradients, no outlines, no texture. The arm and leg on the far side of his
> body are a slightly darker flat shade for depth. A single subtle flat
> ellipse shadow under the figure. Background: one solid color filling the
> entire image, exactly #F0EEEA. No text, no logo, no watermark, no border,
> no props except equipment named in the exercise.
>
> VIEW: side profile with a very slight three-quarter turn toward the viewer.
> The whole body is always fully in frame.
>
> LAYOUT: a wide landscape image showing this SAME character twice, side by
> side with clear empty space between them. LEFT figure = starting position.
> RIGHT figure = working position.
>
> EXERCISE — Glute Bridge: he lies on his back, knees bent, feet flat on the
> floor hip-width apart, arms resting on the floor at his sides. LEFT figure:
> hips resting on the floor. RIGHT figure: hips lifted so his knees, hips and
> shoulders form one straight diagonal line, squeezing at the top. His head
> stays on the floor in both.

Save the result — it is the **style reference** for every other image.

## 2 · Template for the remaining exercises

Attach the previous image, then:

> Using the attached image as the exact character and style reference — the
> same faceless man, same clothing, same flat vector style, same background
> color #F0EEEA, same slight three-quarter side view — now draw:
>
> [PASTE ONE EXERCISE BLOCK BELOW]
>
> Keep the proportions, rendering style, and layout identical.

### Exercise blocks

**Dead Hang** (single figure, portrait or square is fine)
> EXERCISE — Dead Hang: ONE figure only. He hangs from a straight pull-up
> bar, arms fully extended overhead gripping the bar, body long and relaxed,
> feet off the ground with toes pointed slightly down.

**McGill Curl-Up** (two figures)
> EXERCISE — McGill Curl-Up: he lies on his back. One knee is bent with the
> foot flat on the floor; the other leg lies straight. Both hands are tucked
> palms-down under the arch of his lower back. LEFT figure: head and
> shoulders resting on the floor. RIGHT figure: head and shoulders lifted
> only a few centimeters off the floor, neck neutral, lower back flat on the
> floor. IMPORTANT: this is NOT a sit-up or crunch — the lift is very small
> and the spine does not bend.

**Side Plank** (single figure)
> EXERCISE — Side Plank: ONE figure only. He lies on his side propped on his
> forearm, elbow directly under his shoulder, body in one perfectly straight
> line from head to stacked feet, hips lifted off the floor, top hand resting
> on his hip.

**Bird Dog** (two figures)
> EXERCISE — Bird Dog: he is on all fours, hands under shoulders, knees under
> hips, back flat like a tabletop. LEFT figure: all four limbs on the floor.
> RIGHT figure: one arm extended straight forward and the opposite leg
> extended straight back, both parallel to the floor, back still flat, hips
> level. IMPORTANT: the arm and leg reach LONG, not high.

**Glute Bridge** (two figures — also the Step-1 master prompt; use this block
if you ever need to regenerate it standalone)
> EXERCISE — Glute Bridge: he lies on his back, knees bent, feet flat on the
> floor hip-width apart, arms resting on the floor at his sides. LEFT figure:
> hips resting on the floor. RIGHT figure: hips lifted so his knees, hips and
> shoulders form one straight diagonal line, squeezing at the top. His head
> stays on the floor in both.

**Single-Leg Bridge** (two figures)
> EXERCISE — Single-Leg Glute Bridge: he lies on his back, one knee bent with
> that foot flat on the floor, the other leg held straight out. LEFT figure:
> hips on the floor, straight leg raised in line with his thighs. RIGHT
> figure: hips lifted on the planted leg so knee, hips and shoulders form one
> straight line, the straight leg staying in line with his body. Hips stay
> perfectly level — no tilting.

**Romanian Deadlift** (two figures)
> EXERCISE — Romanian Deadlift: he holds a barbell with both hands in front
> of his thighs, overhand grip. LEFT figure: standing tall, bar resting at
> his thighs, knees soft. RIGHT figure: hips pushed far back, torso hinged
> forward with a completely FLAT straight back, the bar lowered to mid-shin
> level sliding close along his legs, knees only slightly bent. IMPORTANT:
> this is a hip hinge, NOT a squat — the hips stay high and the shins stay
> vertical.

**Hamstring Stretch** (single figure)
> EXERCISE — Lying Hamstring Stretch: ONE figure only. He lies on his back,
> one leg flat on the floor, the other leg raised straight up with the foot
> flexed, both hands holding behind the raised thigh, gently pulling it
> toward him.

**Hip Flexor Stretch** (single figure)
> EXERCISE — Half-Kneeling Hip Flexor Stretch: ONE figure only. One knee is
> on the floor with the shin flat behind him; the other foot is planted in
> front with the knee bent at 90 degrees. His torso is tall and upright,
> hips shifted slightly forward, both hands resting on the front knee.

---

## 3 · Finishing checklist

1. **Check the form against the IMPORTANT lines** — image models love turning
   RDLs into squats and curl-ups into sit-ups. Fix conversationally:
   "same image, but make the back flatter / the hips higher / the lift smaller."
2. Crop two-figure images into separate `-a` / `-b` files with the figure
   centered; keep the background around them.
3. Name per the table, drop into `public/rehab/`. Nothing to code — the app
   picks them up, shows them on the light panel, and crossfades A↔B.
4. If Gemini won't hold the #F0EEEA background and outputs pure white, that's
   fine — ask Claude to switch the player's art panel to white (one line).


---

# PART 2 · Density 40 — lifting program art

Same character, same style, same template sentence as Part 1. These are written
to be maximally descriptive: equipment in frame, both positions shown, the form
cue drawn into the pose. File ids below; two-figure images split into `-a`
(left) and `-b` (right) as before.

| Exercise | Files |
|---|---|
| Weighted Pull-Up | `pull-up-a/b` |
| 1-Arm Cable Row | `cable-row-1arm-a/b` |
| DB Lateral Raise | `db-lateral-raise-a/b` |
| Rope Pushdown | `rope-pushdown-a/b` |
| DB Hammer Curl | `hammer-curl-a/b` |
| Suitcase Carry | `suitcase-carry-a` (single) |
| Reverse Wrist Curl | `reverse-wrist-curl-a/b` |
| Front Squat | `front-squat-a/b` |
| RFE Split Squat | `rfe-split-squat-a/b` |
| Rope Face Pull | `face-pull-a/b` |
| DB Wrist Curl | `wrist-curl-a/b` |
| Band Lateral Raise | `band-lateral-raise-a/b` |
| Barbell Floor Press | `floor-press-a/b` |
| Lat Pulldown | `lat-pulldown-a/b` |
| Feet-Elevated Push-Up | `elevated-pushup-a/b` |
| Low-to-High Band Fly | `band-fly-a/b` |
| DB Supinated Curl | `supinated-curl-a/b` |
| Overhead Rope Extension | `overhead-triceps-a/b` |
| Farmer Carry | `farmer-carry-a` (single) |

**Weighted Pull-Up** (two figures)
> EXERCISE — Weighted Strict Pull-Up: he hangs from a straight pull-up bar wearing a small dark backpack. LEFT figure: full dead hang, arms completely straight, shoulders stretched up by his ears, feet crossed behind him. RIGHT figure: chin just above the bar, elbows pulled down and back, chest toward the bar, body perfectly vertical with no swing. The backpack stays flat against his back in both.

**1-Arm Cable Row** (two figures)
> EXERCISE — Standing Single-Arm Cable Row: a low cable pulley at ankle height with a visible cable and handle. He stands in a split stance, hips hinged slightly back, back flat and long, free hand braced on his front thigh. LEFT figure: working arm fully extended toward the low pulley, lat stretched, torso still. RIGHT figure: handle pulled to his hip, elbow driven behind him, shoulder blade squeezed, torso unchanged — only the arm has moved.

**DB Lateral Raise** (two figures)
> EXERCISE — Dumbbell Lateral Raise: standing tall with a dumbbell in each hand. LEFT figure: arms hanging at his sides, soft elbows. RIGHT figure: both arms raised straight out to the sides to exactly shoulder height, slight elbow bend, knuckles leading, ribs down, no lean-back — a perfect T shape.

**Rope Pushdown** (two figures)
> EXERCISE — Cable Rope Pushdown: a high cable with a rope attachment. He stands upright, elbows pinned to his sides. LEFT figure: forearms up, hands at chest height holding the rope ends. RIGHT figure: arms fully extended straight down, the two rope ends split apart beside his thighs, elbows still pinned, shoulders down.

**DB Hammer Curl** (two figures)
> EXERCISE — Dumbbell Hammer Curl: standing tall, a dumbbell in each hand held with a neutral thumbs-up grip. LEFT figure: arms straight at his sides. RIGHT figure: both dumbbells curled to shoulder height, thumbs still up, elbows staying at his ribs, torso perfectly upright — no lean-back.

**Suitcase Carry** (ONE figure)
> EXERCISE — Suitcase Carry: ONE figure mid-stride, walking, carrying a single heavy dumbbell in one hand at his side like a suitcase. His posture is perfectly tall and level — shoulders even, hips even, no leaning toward or away from the weight — the free arm slightly out for balance.

**Reverse Wrist Curl** (two figures)
> EXERCISE — Reverse Wrist Curl: kneeling with his forearms resting on his thighs, palms facing DOWN, holding light dumbbells. LEFT figure: wrists relaxed, knuckles dropped below thigh level. RIGHT figure: knuckles raised as high as the wrists allow, forearms still glued to his thighs.

**Front Squat** (two figures)
> EXERCISE — Barbell Front Squat: a barbell with plates racked across the FRONT of his shoulders, arms crossed over the bar holding it in place, standing inside a power rack with visible side safety pins at thigh height. LEFT figure: standing fully upright, chest proud, elbows high. RIGHT figure: squatted down until his thighs are just above the safety pins, torso remarkably upright, elbows still high, heels flat, knees tracking over his toes.

**RFE Split Squat** (two figures)
> EXERCISE — Rear-Foot-Elevated Split Squat: his rear foot rests on a low box behind him, a dumbbell hanging in each hand. LEFT figure: standing tall on the front leg, rear foot on the box. RIGHT figure: lowered until the front thigh is parallel to the floor, torso upright with a slight forward lean, rear knee dropped near the floor, dumbbells hanging straight down.

**Rope Face Pull** (two figures)
> EXERCISE — Cable Rope Face Pull: a cable set at upper-chest height with a rope attachment. LEFT figure: arms extended forward holding the rope, shoulder blades reaching. RIGHT figure: rope pulled to his eyebrows, elbows high and wide, hands split apart with thumbs pointing behind him, chest tall.

**DB Wrist Curl** (two figures)
> EXERCISE — Wrist Curl: kneeling with his forearms resting on his thighs, palms facing UP, holding light dumbbells. LEFT figure: wrists rolled open, the dumbbells low in his fingers. RIGHT figure: wrists curled fully up toward his forearms, forearms never leaving his thighs.

**Band Lateral Raise** (two figures)
> EXERCISE — Resistance Band Lateral Raise: he stands on the middle of a long resistance band, holding one end in each hand. LEFT figure: arms at his sides, band slack ready. RIGHT figure: both arms raised straight out to shoulder height forming a T, the band stretched taut in a V shape from under his feet to each hand.

**Barbell Floor Press** (two figures)
> EXERCISE — Barbell Floor Press: he lies flat on his back on the floor inside a power rack, knees bent, feet flat, pressing a barbell with plates. LEFT figure: upper arms resting on the floor, elbows bent 90 degrees, bar above his chest. RIGHT figure: arms fully extended, bar locked out directly over his shoulders, lower back flat against the floor.

**Lat Pulldown** (two figures)
> EXERCISE — Lat Pulldown: seated at a lat pulldown station with a visible high pulley, wide bar, and cable. LEFT figure: arms fully extended overhead gripping the bar, lats stretched, torso tall. RIGHT figure: bar pulled down to his collarbones, elbows driven down and back, chest lifted, shoulder blades squeezed.

**Feet-Elevated Push-Up** (two figures)
> EXERCISE — Feet-Elevated Push-Up: a push-up with his feet raised on a low box behind him, hands on the floor. LEFT figure: arms fully extended, body one rigid straight line angled slightly downward from feet to head, ribs down. RIGHT figure: chest lowered to just above the floor, elbows at 45 degrees, the body line still perfectly rigid — no hip sag.

**Low-to-High Band Fly** (two figures)
> EXERCISE — Low-to-High Band Fly: a resistance band anchored at floor level behind him. LEFT figure: arms down-and-back holding the band handles at hip height, slight elbow bend, chest open. RIGHT figure: both arms swept forward and UP to eye level in a wide hugging arc, hands nearly meeting, band stretched from the low anchor, ribs down, no lean-back.

**DB Supinated Curl** (two figures)
> EXERCISE — Supinated Dumbbell Curl: standing tall, dumbbells at his sides with palms facing FORWARD. LEFT figure: arms straight, palms forward. RIGHT figure: dumbbells curled to shoulder height with palms now facing his shoulders, elbows pinned to his ribs, upright torso.

**Overhead Rope Extension** (two figures)
> EXERCISE — Overhead Cable Rope Triceps Extension: he faces AWAY from a low cable pulley, the rope held behind his head, one foot slightly forward, ribs down. LEFT figure: elbows bent, hands behind his neck, elbows pointing to the ceiling beside his ears. RIGHT figure: arms extended fully overhead and slightly forward, rope ends split, elbows still narrow — no lower-back arch.

**Farmer Carry** (ONE figure)
> EXERCISE — Farmer Carry: ONE figure mid-stride, walking tall with a heavy dumbbell in EACH hand at his sides. Shoulders packed and level, chest proud, arms straight, hips level — the posture of someone carrying groceries perfectly.
