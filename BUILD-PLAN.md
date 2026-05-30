# Kilos Training — Build Plan

**Aggressive, sequenced plan to get from "good lifting tracker" to "the simple-but-
comprehensive training + nutrition app, with coaches built in."** Read alongside
`STRATEGY.md` (the why) and `CLAUDE.md` (the how/rules). Written 2026-05-30.

> **The one rule that governs everything:** the free logging loop must become the
> best free loop before anything else is built on top. Community has no fuel,
> coaches have no audience, and food tracking has no daily habit to attach to if
> people don't come back to log. Validate the loop (M0) before pouring effort into
> M1+. Don't skip phases — each is the fuel for the next.

---

## Where we already are (don't rebuild this)

A 3,000-line `main.js` monolith, local-first (localStorage → Supabase `user_data`
JSONB blob sync), PWA. Already built:

- **Hybrid logging works today:** strength (sets/reps/weight), CrossFit
  (EMOM / AMRAP / Rounds / For-Time), and cardio. This is a real moat — most
  trackers do one.
- **Screens:** Home (week strip, muscle frequency, recent), Build (+ CF build,
  exercise search, "shuffle" auto-workouts), Active workout, History, Coaches
  (static showcase), Legends, Profile sheet, Onboarding, beta welcome.
- **Extras:** PR logging + celebration, plate calculator, workout summary, share
  card (html2canvas), equipment tiers (incl. `ph-local`), injury substitutions.

So the **lift/workout panel pillar is ~80% there.** The build plan is: *polish it
to best-in-class*, then add the two missing pillars (**food**, **personal page**)
and the business layer (**coaches**).

The four pillars → phases:
1. Simple-but-comprehensive **lift/workout panel** → **M0** (polish + validate)
2. Great **food tracking / meal logging** → **M1**
3. **Personal page** → **M2**
4. **Coaches built in** → **M3–M4** (community on-ramp, then B2B)

---

## M0 — Make the loop undeniable + lay the foundation  *(the validation bet)*

**Goal:** turn casual openers into daily loggers, and put a foundation under the
3k-line monolith before it grows. This is the month that decides everything.

**Build:**
- **Inline last-session numbers** pre-filled on every exercise ("last time: 80kg × 5").
  The single highest-leverage feature — it's the "did I beat last week?" dopamine loop.
- **One-tap progression** (+2.5kg / +1 rep steppers; sensible default = last top set).
- **Streaks** (current + longest; loss-aversion). Cheap, outsized retention.
- **Tighten the post-workout summary + share card** (PRs, total volume, streak) — the
  reward *and* the seed of community.
- **Foundation pass (do it now, while the app is small enough):**
  - Establish a design spine like grit's: a `DESIGN.md` + the `.t-*` type scale,
    spacing/radius tokens, 12px text floor, 44/48px touch targets, dark-first. Port
    the `scripts/check-design-system.mjs` guardrail + wire CI.
  - Add CI (lint + build gate) and Sentry-style error capture (grit's setup ports cleanly).
  - **Start splitting `main.js`** by feature (e.g. `screens/`, `workout/`, `state/`) —
    don't big-bang it; carve off one screen at a time as you touch it. It WILL block
    velocity at 5k+ lines once food + coaches land.

**Ship/validate criteria:** put it in front of **20–30 real lifters** (lean on Grit/PH
gym contacts). Watch one number: **of people who log a first workout, how many log 3+
sessions in 2 weeks?** Majority return unprompted → greenlight M1. They ghost → fix the
loop, do NOT proceed.

**Not yet:** food, coaches, native apps, paywalls of any kind.

---

## M1 — Food tracking / meal logging  *(the "well-rounded" + PH-fit pillar)*

**Goal:** the easiest, most PH-accurate food log there is — the two things MyFitnessPal
gets wrong (paywalled barcode scan + Western-only food DB).

**Architecture inflection (important):** the food *database* (hundreds of thousands of
items + barcodes) can NOT live in the `user_data` JSONB blob or localStorage. M1 is when
you add your **first real reference table in Supabase**:
- `foods` — shared read-only reference (name, brand, serving, kcal, P/C/F, barcode, source).
- `food_logs` — per-user entries (or keep in the user blob short-term; move to a table once
  volume/perf demands it).

**Build (MVP — resist scope creep):**
- **Food database, build-vs-buy decided:** seed **USDA FoodData Central (CC0, free)** into
  the `foods` table, hand-curate **~200 Filipino staples** (rice, adobo, sinigang, pandesal,
  lechon, common sari-sari/grocery brands), and add **barcode lookup via Open Food Facts**
  (free) with on-device scanning (e.g. ZXing-js). **Action item, start now (long lead):**
  FOI request to **FNRI for the PhilFCT dataset + commercial-use clearance** — that's the moat.
- **Meal logging:** add a food to breakfast/lunch/dinner/snack in the fewest taps; recent +
  favorites surface first; free barcode scan.
- **Daily totals vs a manual target** (calories + P/C/F). No adaptive algorithm.
- **Same streak/reward layer** as workouts — one habit system across training + eating.
- **One integrated day view:** today's training *and* today's food together (the integration
  is the wedge; siloing them is what competitors do).

**Ship criteria:** a PH user can log a local meal by barcode or search in <15s and see their
day's macros, offline, free.

**Not yet:** adaptive macros (MacroFactor's real engineering), AI photo logging, recipe
builder, restaurant menus, micronutrients. None are needed to be "well-rounded."

---

## M2 — Personal page  *(the identity + retention hub)*

**Goal:** the "this is *me* and my progress" surface that makes leaving feel like losing
something. Consolidate the scattered profile/stats into one page.

**Build:**
- **Identity:** avatar, name, home gym, equipment tier, units.
- **Lifetime stats:** total workouts, total volume, current/longest streak, sessions/week trend.
- **PR board:** best lifts + benchmark WOD times, with trend (e.g. "Fran 4:12 → 3:58 → 3:44 ↓").
- **Body metrics (optional):** bodyweight over time, simple line; ties food + training together.
- **History, richer:** calendar heatmap + per-session detail.
- **Achievements/milestones** (100th workout, first bodyweight bench, etc.) + shareable cards.

**Ship criteria:** a returning user lands here and immediately sees momentum (streak, recent
PRs, trend) — a reason to keep the chain alive.

---

## M3 — Community seeds  *(compounds retention + the coach on-ramp)*

**Goal:** make the app feel alive and create the path for an unknown coach to earn an
audience *before* charging.

**Build (rough order):**
- **Kudos / reactions** on shared workouts.
- **Program library:** users (and later coaches) publish a routine/4-week plan; others import
  it in one tap. This is Hevy's *and* Boostcamp's growth engine *and* your coach on-ramp.
- **Follow + a light activity feed** (friends/coaches you follow).
- Wire the existing **Coaches/Legends** showcase into this — turn the static page into "follow
  this coach → import their free program."

**Ship criteria:** a free program published by one person gets imported and run by others.

---

## M4 — Coaches built in (B2B)  *(#1 — where the money is)*

**Goal:** a coach programs for and tracks each client individually, in their own branded
space — the Grit multi-tenant/branding model pointed at individual coaches, sitting on top of
the Kilos logger an audience already uses.

**Build:**
- **Coach ↔ client data model:** real tables now — `coaches`, `coach_clients`,
  `assigned_programs`, `client_logs` (the client's existing Kilos logs, visible to their coach).
  This is the second big move off the single-blob model.
- **Program builder → assign to a client → coach sees their actual logged results** (the
  "divergence" view: planned vs. done).
- **In-app per-coach branding** (port grit's `branding.js` / slug routing / per-tenant theming).
  Near-zero marginal cost. **Do NOT build per-coach native App Store apps yet** — that's a
  later premium tier, after paying demand.
- **Messaging** (lightweight, async) between coach and client.
- **Pricing:** flat PH price, everything-included (nutrition + branding, no add-on creep),
  low/zero payment commission. Aim at **new/small coaches (<30 clients)** priced out of
  Trainerize. Later: a revenue-share tier for famous creators who bring their own audience.

**Ship criteria:** one real PH coach runs a paying client end-to-end (program → log → review)
in their branded space.

---

## M5 — Monetization polish (brand deals, #2)  *(margin-booster, not a strategy)*

Only once there's an engaged audience (~10k engaged MAU, or a coach who brings it).
- **Affiliate at launch-level** via PH-native rails (Shopee/Lazada, local supplement brands via
  GCash) — ambient revenue + intent data. Build a "Sponsored/Affiliate" disclosure chip into
  the UI early.
- **Sponsored challenges** as the premium brand product — design the program/4-week feature with
  a sponsor slot from the start (a coach's branded program + a supplement sponsor = one sellable unit).
- **No intrusive ad SDKs**, ever — near-zero at PH eCPMs and they wreck the mid-workout UX.

---

## Cross-cutting (applies to every milestone)

- **Free Forever for athletes.** Never gate a user's own training/food history. The free loop is
  the acquisition engine; money comes from coaches and (later) brands.
- **Local-first, never block the loop on the network.** Writes hit localStorage first; sync after.
- **Data-model evolution is staged on purpose:** single `user_data` blob now → add reference/log
  tables at M1 (food) → add relational tables at M4 (coach↔client). Don't pre-build the schema;
  add tables exactly when a feature needs queryability the blob can't give.
- **Keep the monolith honest:** carve `main.js` into feature modules as you touch them, starting M0.
- **Mobile-first, dark, high-contrast, 44/48px targets, 12px text floor** — enforced by the design
  guardrail once M0 lands it.
- **PH-native throughout:** PHP, Filipino food, local payment rails, local-creator coaches.

## What NOT to do (from STRATEGY.md)

- Don't build coaches before the consumer loop is validated (M0 first).
- Don't paywall athlete data, add ad SDKs, or chase brand deals before scale.
- Don't ship adaptive-macro algorithms / AI photo logging / recipes / micronutrients in M1.
- Don't build per-coach native apps before paying demand.
- Don't try to do all of hybrid at once — strength logging is the polished beachhead; the rest
  follows the proven loop.
- Don't model PH revenue on US benchmarks.

---

**The through-line:** undeniable free loop → food + personal page make it sticky → community
compounds it → coaches come for the audience and pay → brands sponsor at scale.
