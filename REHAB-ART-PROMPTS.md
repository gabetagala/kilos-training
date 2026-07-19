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
