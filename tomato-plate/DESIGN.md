# TOMATO PLATE — app design plan

> A baby-feeding app for the first year. Free, local-first, Philippines-first.
> The plan, the food reference, and the log — the three things the ₱999/month
> subscription actually sells — in one app that works offline in a kitchen with
> one hand free.
>
> Content and evidence: [../subo/FEEDING.md](../subo/FEEDING.md).

---

## 1. The idea

**A tomato, seen from above, is already a plate.** Round, red, with a green
star in the middle. That's the whole mark — no illustration of a plate needed,
because the tomato *is* one.

The app inherits that logic: **one strong visual idea per screen, drawn flat.**
No stock iOS lists, no card soup, no gradient buttons.

### Tone

Warm, hand-made, calm. This is a parent at 6am with a baby on one hip. The app
never scolds, never gamifies, never celebrates loudly. Its most important
emotional job is in the reference research: **a refused food is not a failure.**
Most parents quit at 3–5 exposures; the evidence says 8–10+. So a thumbs-down
is logged as *progress*, never as a red mark.

---

## 2. Design system

### Palette

| Token | Hex | Use |
|---|---|---|
| `--tomato` | `#C0442A` | Primary. Brand, headers, key actions |
| `--tomato-deep` | `#9A3520` | Pressed states, text on cream |
| `--tomato-soft` | `#E8A594` | Tints, fills, empty states |
| `--cream` | `#FBF3E4` | App background |
| `--cream-2` | `#F4E9D6` | Cards, wells |
| `--calyx` | `#2E6B44` | The tomato's crown. Iron, "cleared", success |
| `--calyx-soft` | `#B9D3BF` | Iron tints |
| `--amber` | `#E9963E` | Allergens, warnings, squash family |
| `--aubergine` | `#3A3684` | Accent for depth and contrast |
| `--ink` | `#2A1E19` | Text |
| `--ink-soft` | `#7A675C` | Secondary text |

Six colours plus two inks. Every illustration draws from this set only — that
constraint is what makes 90 separate food drawings read as one family.

### Type

- **Wordmark** — heavy condensed display, slight per-line rotation and varying
  scale, set in three stacked lines like the reference. Hand-lettered feel.
- **UI** — one geometric sans. Semi-bold for labels, regular for body.
- **Numbers** — tabular, one weight heavier. Counts are the most-glanced thing
  on the home screen.

### Shape and space

- Corner radii: `8px` chips, `18px` cards, `26px` sheets, `999px` pills.
- 8pt spacing scale.
- Touch targets ≥ 44px, ≥ 8px apart — one-handed, mid-kitchen.
- Cards sit on cream with **no drop shadow** — separation comes from the
  `--cream-2` fill. Flat, like the illustrations.

---

## 3. The illustration system

This is the part that makes it feel like the references, and the part that
replaces what Solid Starts charges for.

### Style rules (non-negotiable, they're what keeps 90 drawings coherent)

1. Flat vector. **Solid fills only** — no gradients, no outlines, no texture.
2. Maximum **three colours per item**, drawn from the palette above.
3. Slightly irregular, hand-drawn edges. Nothing geometrically perfect.
4. Square canvas, transparent background, consistent optical weight.
5. No faces, no hands, no props. Food only.

### Three artefacts per food

| Artefact | What it shows | Count |
|---|---|---|
| **Hero** | The whole raw food | 1 per food |
| **Cut states** | How it's prepared at 6 / 9 / 12 months | 3 per food |
| **Plated pair** | The spoon form and the hands form, side by side | 3 per food |

For ~30 launch foods that's ~30 heroes + ~90 cut states. Generated, never
hand-repaired — the same discipline as `scripts/generate-art.mjs`, which
already does exactly this for the rehab exercise art and knows how to knock out
a chroma background and split a pair image.

### The cut-state visual language

A small fixed vocabulary, so a parent learns to read it once:

- **Purée** — a soft mound with a spoon-swirl
- **Mash** — the mound with visible lumps
- **Baton** — three rounded-end sticks, the app's signature shape
- **Cube** — scattered soft squares
- **Spear** — a long wedge, skin peeled halfway back
- **Flake** — irregular soft pieces

The carrot you described is the canonical example: **purée on the left, a
two-finger baton on the right, same food, same screen.**

---

## 4. Screens

Four tabs — **Today · Plan · Foods · Baby** — plus a log sheet that can open
from anywhere.

### 4.1 Welcome
Wordmark on cream, illustration cluster spilling off the top edge like the
reference. Sign in with Apple / Google / email. A single line of legal
underneath: *not medical advice; follow your pediatrician.*

### 4.2 Today — the home screen
The screen that has to answer "what do I feed him right now" in under a second.

- **Header** — baby's name, exact age ("7 months, 2 weeks").
- **Hero card** — today's new food, its illustration, and the trial day
  (`Day 1 of 3`). If it's an allergen, an amber band: *first exposure — morning,
  at home, 2 hours free to watch.*
- **Meal rows** — breakfast / lunch / dinner, each showing the **spoon** item
  and the **hands** item as a pair of small illustrations.
- **Status strip** — three chips: `Iron ✓` · `2 allergens due` · `Liver 1/2`.
  These are the three rules the plan enforces, made glanceable.
- **Log** — thumbs on every meal row, one tap.

### 4.3 Food detail — the screen that replaces the subscription
- Big hero illustration on a tinted ground.
- Badge row: allergen · iron · choking risk.
- **Age tabs: 6mo / 9mo / 12mo.** Switching re-draws everything below.
- **How to cut** — the cut-state illustration, full width, with the size rule
  in words underneath ("finger-length, two fingers wide, squash-tested").
- **On the spoon / In his hands** — two cards side by side, illustrated. This
  is the hybrid you asked for, made structural rather than a footnote.
- **Prepare it** — numbered steps.
- **Safety** — the non-negotiables in a tomato-tinted block (whole egg not just
  yolk; peanut butter thinned, never a lump; debone twice).
- Footer: *served 4 times · last Tuesday* + a log button.

### 4.4 Plan
Month strip along the top. Days as a vertical list: day number, the new food's
illustration, trial-day pips, an iron dot and allergen dots. Repeating cycle
days are labelled **A–G** so the repeat is visible and deliberate, never
accidental. Tap a day → day detail.

### 4.5 Day detail / log
Each meal expands to: thumbs up · thumbs down · a note field. Amount as four
pills (none / a taste / some / lots). A quiet "reaction?" link that opens the
symptom list — deliberately not a big red button, because most flare-ups aren't
food.

**After a thumbs-down**, the app says: *"That's exposure 3 of 10. Most parents
stop at 3–5. Try again in a few days."* Turning the single most discouraging
moment into the app's best feature.

### 4.6 Baby — the person page
- Photo, name, age, birthdate.
- **Progress ring** — foods tried, e.g. `23 / 30`.
- **The allergen board** — nine tiles. Green = in rotation, amber = overdue,
  cream = not yet introduced. Each shows days since last served. This is the
  clinical heart of the app and it deserves to be a *picture*, not a table.
- **Milk & weaning** — current feeds per day and the taper.
- **Notes & reactions** — anything flagged, exportable for the pediatrician.

---

## 5. Build notes

- Vanilla JS + Vite, localStorage-first, PWA — same architecture as the parent
  repo. Writes never block on the network.
- Data model already drafted in [../subo/data.sample.js](../subo/data.sample.js);
  add `cutStates`, `platedPair`, `maxPerWeek`, `exposureCount`.
- Illustrations: extend the `scripts/art-manifest.mjs` pattern with a food
  manifest and a food style prompt. Same generate-review-regenerate loop.
- Offline is mandatory. A kitchen is a bad-signal environment and the whole
  reference library must work with the plane on.

## 6. What this is not

No meal planner (the most-regretted paid feature in the reviews). No recipe
library beyond the ~20 we actually cook. No social feed. No streaks, no badges,
no confetti — the tone is quiet, and a feeding app that shames a parent for
missing a day is worse than no app.
