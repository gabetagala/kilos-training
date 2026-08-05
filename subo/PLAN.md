> Working name: **subo** (Tagalog: a spoonful / to feed a bite) — placeholder, rename freely.
> Produced 2026-08-03 by a 7-agent research workflow (6 web researchers + 1 synthesizer).
> Personal-use rebuild: we recreate FEATURES only — no scraping/copying Solid Starts content, images, or marks.

# Solid Starts Rebuild — Synthesis & Build Plan

## 1. How Solid Starts actually works

**Product shape.** Freemium iOS/Android app (SolidStarts LLC) + a fully-free SEO website. Content is authored by a credentialed multidisciplinary team (pediatric GI, allergist, feeding/swallowing OTs, RD) and every food article lists named expert reviewers — that's the trust engine.

**Free tier (app AND website):** the First Foods® database — 400+ foods, each with: age suggestion, common-allergen flag, iron-rich flag, age-banded "how to serve" instructions (6/9/12/18mo breakpoints) with cut-size infographics, videos of real babies eating, a prose choking-risk statement, allergen/FPIES notes, nutrition rationale, and food-specific FAQs. This — the universally-loved killer feature per reviews — costs nothing and is ungated at solidstarts.com/foods/.

**Paid tier:** everything workflow-shaped. "Compass" (guided First-100-Foods plan, meal planning, allergen-risk assessment + step-by-step allergen introduction with serving sizes + exposure-rotation reminders), the "Tracker" (log foods/favorites/reactions/notes/milestones, allergens-introduced dashboard, export for the pediatrician), 300+ recipes, guides/video courses, personalized homescreen.

**What the ₱1k/month is buying.** PH App Store: Tracker ₱999/mo, Compass ₱999/mo, Unlimited ₱1,290/mo, yearly ₱4,990–5,990. Gabe is almost certainly on a ₱999 monthly SKU — i.e. paying **₱11,988/yr-equivalent for the tracking/guided layer only**, since the database itself is free. Yearly (₱4,990 ≈ 5 months of monthly) would be 58% cheaper — but reviews consistently say the app's useful life is ~3–6 months ("by about 3 months into solids, I had absolutely no need of it"), which is exactly why monthly-payers get burned. Recent reviews are dominated by price-hike anger ($2.99–$10 → $100/yr), paywall creep (formerly-free videos now gated), and bugs (forced sign-outs locking paying users out, allergen logs not registering). Reddit consensus: "the free tier is enough."

## 2. The 20% actually used daily (and what Gabe's family is paying for)

From reviews, the daily loops are:

1. **The serve-by-age safety lookup** ("how do I cut X for a 9-month-old?") — the most-loved feature, used at meal prep and the grocery store. **Already free on the website** — this is reference content, not software.
2. **The food/allergen tracker** — the #1 paid feature happy subscribers cite, anchored on the "100 foods before 1" goal: log foods tried, mark favorites, flag reactions, see allergens introduced, export for the pediatrician. **This is what ₱999/mo actually buys.**
3. **Allergen introduction + rotation** — introduce the 9 common allergens early, then keep each in rotation (≥1×/week once tolerated). The "egg hasn't been served in 8 days" nudge is genuinely valuable and trivially computable from the log.
4. **A lightweight "what's next" list** — try-later foods. (The full Compass meal planner is the most-refunded expectation — "odd things I wouldn't have at home.")

Also relevant: a top complaint is **poor cultural food coverage** (no pierogi; Filipino foods — lugaw, malunggay, bangus, kamote — are certainly thin). A personal rebuild fixes that for free.

**Worth rebuilding: the tracker + allergen rotation + a small self-authored food reference covering the foods this family actually serves.** Not worth rebuilding: videos, 300+ recipes, courses, meal planner, personalization engine.

## 3. MVP spec — personal sub-app in the Kilos repo

**Working name:** `/subo` (Tagalog: a spoonful / to feed a bite) — sits alongside `/tayo`. Vanilla JS + Vite, localStorage-first, dark, one-handed, PWA-installable. No account, no sync at v1 (optionally reuse the existing Supabase push/pull later).

### Screens (4)

1. **Today (home)** — baby's age auto-computed from birthdate; big one-tap "log a food" (search-as-you-type over the personal food list, defaults to recently-served); progress counter ("47 / 100 foods"); allergen rotation nudges ("Egg — last served 8 days ago"). This is the Kilos logging-loop philosophy applied to feeding: fewest taps, instant, offline.
2. **Foods** — the personal reference list. Filter: age band, allergen, status (to-try / tried / favorite), choking risk. Tap → detail.
3. **Food detail** — the authored content (fields below) + "Served today" one-tap log + "Reaction?" flag + family notes.
4. **History / Allergens** — chronological log with reaction entries highlighted; allergen dashboard (9 allergens × status: not introduced / introduced / tolerated ×N / reacted, with last-served date); **export** as CSV/JSON share (html2canvas share-card optional for the "100 foods" milestone).

### Data model

`subo-foods` (authored content, shipped as a static JS module like `src/data.js`):

```js
{
  id: "saging",
  name: "Banana", localName: "Saging",
  category: "fruit",
  ageMonths: 6,                    // earliest introduction band
  allergen: null,                  // or one of: dairy|egg|fish|nut|peanut|sesame|shellfish|soy|wheat
  ironRich: false,
  chokingRisk: "moderate",         // low|moderate|high
  chokingNote: "Firm/round pieces are a hazard; slice lengthwise...",  // authored
  serve: { 6: "…", 9: "…", 12: "…" },  // authored age-banded prep text
  fdcId: 173944,                   // optional USDA FoodData Central ref
  sources: ["nhs-weaning", "cdc-choking"]
}
```

`subo-log` (append-only): `{ ts, foodId, reaction: null | {symptoms, severity, note}, note, favorite }` — firsts, counts, allergen status, and rotation nudges are all derived. `subo-profile`: `{ name, birthdate }`.

### Content sourcing (author everything; never copy Solid Starts)

| Content | Source | License |
|---|---|---|
| Serving/texture by age, safety basics | NHS Start for Life weaning hub (nhs.uk/start-for-life/baby/weaning/) | **OGL v3.0 — reusable/adaptable**; must display the NHS-OGL attribution line; must NOT attribute adapted text to the NHS |
| Choking guidance + under-4 do-not-serve list | CDC choking-hazards page; Mass.gov WIC list | US public domain / free |
| Allergen introduction protocol | NIAID peanut guidelines (public domain); ASCIA "Nip Allergies in the Bub" (paraphrase only — license unverified) | mixed |
| Per-food nutrition | USDA FoodData Central API/bulk CSV | **CC0** — cite USDA |
| Age/stage framework, iron-first-foods consensus | WHO 2023 complementary-feeding guideline (CC BY-NC-SA, fine for personal), NZ MoH 0–2 guidelines (**CC BY 4.0**), USDA WIC Infant Nutrition & Feeding Guide | open |
| PH-specific framing | NNC Quick Guide to Complementary Feeding; DOH IYCF | reference freely for personal use |
| Photos/illustrations | Own phone photos; optionally reuse the repo's Gemini art pipeline for simple cut-diagrams — but verify every diagram against the source text (safety content) | own |

Hard rule baked in: **no scraping or reproducing solidstarts.com content, structure, images, or the First Foods®/Solid Starts marks** — their terms explicitly prohibit copying and data mining. Features are fair game; their expression is not.

### Skip entirely

Videos of babies eating, recipes/meal planner (Compass), courses/guides library, readiness quiz (one static NHS-derived checklist page at most), accounts/auth, push notifications (compute "due" nudges on open instead), multi-child (add a `childId` field but don't build UI for it).

## 4. Effort estimate & risks

**Code: ~20–30 hours.** This is a CRUD tracker + static-content viewer in a stack he already has patterns for (state machine, localStorage keys, dark mobile shell, share cards). Scaffold + shell 4–6h; log loop + persistence 4–6h; foods list/detail/filters 6–8h; allergen dashboard + rotation logic 4–6h; export/share 2–4h.

**Content: the real cost — ~20–35 hours for a usable set, and it dominates.**
- A family doesn't need 400 foods. The realistic target is the "100 foods before 1" arc, and the launch set is **30–40 foods**: Filipino staples (lugaw/rice, saging, mangga, kalabasa, kamote, malunggay, papaya, tokwa/taho, tilapia, bangus, chicken, pork, egg) + the 9 allergens + the high-choking-risk offenders (grapes, hot-dog-shaped foods, nuts).
- Per-entry authoring (read NHS/CDC source, write age-banded serve text + choking note, cross-check): **~30–45 min for full entries; ~1h for the 9 allergens and high-risk foods**. Mitigation: tier it — full entries only for allergens + high-risk foods (~15 foods × 1h), light entries (age, one-line prep, risk flag, source link) for everything else (~10 min each). That gets launch content to ~20h, growing organically as new foods enter rotation.
- **Total: roughly 45–60 hours** for a version that genuinely replaces what the family uses daily.

**Biggest risks, honestly ranked:**
1. **Content authoring stalls the project.** The code is a weekend-scale job; the content is not. If authoring is skipped, he's built an empty tracker. Mitigation: the tiered plan above, and ship the tracker against a 15-food allergen/high-risk core first — the free solidstarts.com website remains the ad-hoc lookup for anything not yet authored (it's free and legal to read).
2. **This is safety content for his own baby.** Wrong choking or allergen guidance is the one place a mistake actually matters. Mitigation: author only from the cited public-health sources, store the source per entry, never let generated art or paraphrase drift from the source text — and treat the app as a memory aid, not the authority.
3. **Payback math is thin and the clock is ticking.** The product's useful life is ~6–12 more months; at ₱999/mo saved that's ₱6–12k against ~50 hours of work. The rational pure-money move is "cancel monthly, use the free website, keep a notes file" — the build is justified by owning the data (exportable log for the pediatrician), Filipino food coverage Solid Starts lacks, offline reliability (their app is online-required and buggy per 2026 reviews), and it being a personal project in a repo he already lives in. Frame it as that, not as savings.
4. **Scope creep toward Compass.** Meal planning is the most-regretted paid feature in reviews; resist rebuilding it.
5. **License hygiene.** NHS OGL requires the attribution line and forbids crediting adapted text to the NHS; WHO material is NC-only (fine for personal use, blocks any future commercial pivot of the content layer); USDA needs only a citation. Trivial to comply with now, annoying to retrofit.
