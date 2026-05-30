---
description: Apply a Hevy / Strong / MyFitnessPal competitor lens to a recent change. What do they do? Where's Kilos' opportunity to be better?
---

# /competitor-check — competitor parity & differentiation

For a recent feature or change on the current branch
(`git diff main...HEAD`), think about how Kilos compares against the
established players, and where to lean into our edge.

## The competitors

**Training trackers**
- **Hevy** — the current darling. Clean, fast, generous free tier, strong
  social feed + routines. The bar for "good free lifting tracker."
- **Strong** — clean and simple, beloved, but free tier is capped (limits
  on routines) and it's effectively paywalled for power users.
- **Fitbod** — AI-generated workouts, subscription-first. Strong on
  "tell me what to do today," weaker as a pure logger.
- **Boostcamp / TrainHeroic** — program-led (follow a coach's 4-week plan);
  closest to Kilos' coaches/programs direction.

**Nutrition (once food tracking ships)**
- **MyFitnessPal** — huge but bloated, ad-heavy, slow; barcode scanner is
  paywalled; food DB is crowdsourced US-centric junk for non-US foods.
- **MacroFactor** — premium, polished, smart (adaptive macros) but paid-only.
- **Cronometer / Lose It** — accurate / simple respectively, both Western-DB.

## Our angles (pick 1–2, not all of them)

- **Easier + faster**: the others are bloated or slow. Is logging a set / a
  meal obviously fewer taps and quicker than Hevy/MFP?
- **Free-forever**: Strong/MFP gate core features. Kilos keeps the core free.
  Does this change respect that promise (no paywalling a basic need)?
- **PH / SEA fit**: Western apps assume Western food (MFP has no real adobo,
  sinigang, pandesal, local sari-sari brands) and USD/Western context. A
  curated **Filipino food database** + PHP + local norms is a real moat.
- **Training + nutrition in ONE**: competitors silo lifting and eating. Kilos
  showing your training and your eating together is the integration play.
- **Local-first / offline**: instant logging that works on bad gym data,
  syncs later. Many competitors stall without a connection.
- **Community → coaches**: real coaches + programs + reach-out, not just an
  anonymous feed. Boostcamp-style programming, made local.

## Report format

Tight. A few lines plus one suggestion.

```
WHAT COMPETITORS DO:
  Hevy: <one sentence>
  MyFitnessPal: <one sentence>   (only if the change touches nutrition)

WHAT WE DO:
  <one sentence on the current change>

OPPORTUNITY (angle: <easier|free-forever|ph-fit|training+nutrition|offline|community>):
  <one concrete suggestion — or "we're already differentiated here" if no obvious move>
```

## Don't

- Don't list every angle. Pick one or two that fit the change.
- Don't write a whitepaper.
- Don't fabricate competitor specifics you're not sure about — if you don't
  know what Hevy does in a given area, say "I don't know what Hevy does here
  specifically; ask Gabe" rather than guessing.
