# Kilos Training — Strategy Memo

*Free tracker → community → coach B2B. Researched + written 2026-05-30 (multi-agent
market research: coach-B2B platforms, brand-deal economics, nutrition build-vs-buy,
free→community→coach funnel). Some pricing/competitor specifics need live verification.*

---

## 1. Product thesis (the one paragraph)

**Kilos is the fastest, smartest free workout logger for athletes who lift *and*
train — and the consumer logger is the acquisition engine for the real business,
which is coaches.** Athletes get a best-in-class free loop (log a set, see if you
beat last week, keep your streak) forever, no data gating. That free base attracts
coaches who want a captive, already-logging audience to program for. You monetize
the coaches — branded per-coach apps + a cut of what they charge their clients — not
the consumers. Nutrition and community are *retention and stickiness layers* that
make the free loop better and give coaches more to work with; they are not where the
money comes from. Brand deals are a margin-booster you switch on much later, once you
have an engaged audience to sell. The whole thing only spins if the free tracker is
genuinely the best free tracker, so that's job #1.

---

## 2. The positioning call: HYBRID, not lifting-only

**Go hybrid (strength + conditioning), but ship strength logging first.**

Why hybrid wins:
- **Bigger, faster-growing audience.** Hybrid ("deadlift heavy, run a fast 5k") is
  the dominant 2026 fitness trend. Pure lifting is a red ocean — Hevy (~13M users)
  and Strong already own the logger position; competing there means out-UXing
  entrenched incumbents on logging alone.
- **Better retention.** Hybrid athletes program more varied sessions (lift / run /
  metcon / mobility) = more reasons to open the app, fewer "I plateaued, I quit"
  exits than a pure-strength user stalling on linear progression.
- **The deciding factor — coach supply.** Pure-lifting coaching is commoditized and
  over-served by software. Hybrid/functional coaching has real demand and no obvious
  software home. A hybrid-native tracker gives hybrid coaches a place they don't
  currently have. That *is* your coach wedge.

The discipline: **"hybrid" is the story and the eventual surface, but strength
logging is the beachhead** — highest-frequency, highest-retention behavior, easiest
to model well. Don't try to do six sports adequately on day one (a run isn't a
set-of-reps). Be "the tracker for people who lift *and* train," not "a tracker that
does everything okay."

---

## 3. The phased sequence

### BUILD NOW — earn daily active loggers (nothing else matters until this works)
Highest-leverage feature is **logging speed + smart progression**:
- **Inline last-session numbers** pre-filled on every exercise — instantly see if
  you're beating last week. This is the dopamine loop and the entire funnel.
- **One-tap progression** (+2.5kg / +1 rep).
- **Streaks** (loss-aversion; cheap to build, outsized retention).
- **Post-workout summary / share card** (PRs, volume) — immediate reward *and* the
  seed of community. (`html2canvas` is already in the repo.)
- Keep the **entire tracking loop free forever.** Never gate an athlete's own history
  early (that's Hevy's *paid* wall — don't copy it yet).

Positioned strength-first, hybrid-story.

### NEXT — community (compounds retention, seeds the coach on-ramp)
1. **Kudos / reactions** on shared workouts — cheap, makes the feed feel alive.
2. **Community program library** — users (later coaches) publish routines others
   import in one tap. This is Hevy's *and* Boostcamp's growth engine *and* your coach
   on-ramp: a free program is how an unknown coach earns an audience before charging.
3. **Expand logging to running/conditioning** — deliver on the hybrid promise.
4. **Nutrition (free retention layer):** USDA FoodData Central (CC0) seeded into
   Supabase + ~200 hand-entered Filipino staples + Open Food Facts barcode lookup
   (e.g. ZXing-js). Free barcode scan + Filipino-accurate food = the exact two things
   MyFitnessPal gets wrong/paywalls. Calorie + macro totals vs. a manual target,
   wrapped in the same streak layer. Skip adaptive-macro algorithms, AI photo logging,
   recipes, micronutrients. **Action this month regardless: contact FNRI (FOI request)
   for the PhilFCT dataset + commercial-use clearance** — it's the food moat and its
   license is undocumented, so start the clock.

### LATER — coach B2B (#1) — *this is where the money is*
Spin the Grit multi-tenant + branding model (slug routing, `branding.js`, per-tenant
theming) onto *individual coaches* on top of the Kilos logger. ~70% built already;
closest analog (Hevy Coach = consumer logger + coach dashboard) is the exact shape.
- **Wedge incumbents can't match:** flat PH price, radical simplicity,
  everything-included (nutrition + branding, no add-on creep), low/zero payment
  commission — hits the three biggest coach-churn drivers at once.
- **Branding, sequenced right:** ship per-coach *in-app* theming first (PWA + themed
  single app, near-zero marginal cost, already done in Grit). Per-coach *native App
  Store listings* = a later premium tier, NOT a launch requirement.
- **Win new/small coaches** (sub-30 clients) priced out of Trainerize — fight at
  acquisition, since switching cost protects incumbents' big rosters.
- **Two coach tiers eventually:** long-tail working coaches (cheap SaaS + a cut of
  payments, à la TrueCoach ~5%) and famous creators (Playbook-style ~80/20 revenue
  share — they bring their own audience).

### LATER STILL — brand deals (#2) — margin-booster, not a strategy
- **Affiliate at launch** as ambient revenue + intent-data collector. Use PH-native
  rails (Shopee/Lazada affiliate, local supplement brands via GCash) — not Amazon
  (pays PH poorly). Build a "Sponsored/Affiliate" disclosure chip into the UI now.
- **Sponsored challenges are the premium brand product** — the natural extension of
  the coach 4-week-program feature. Design programs with a sponsor slot built in: a
  coach's branded program + a supplement sponsor = one clean sellable unit.
- **Avoid intrusive ad SDKs** (banners/interstitials) — near-zero at PH eCPMs and they
  wreck the mid-workout UX that is the whole product.
- **The bar before pitching a sponsor:** ~10k engaged MAU (or one coach who brings
  that) at >5% engagement, multi-session/week. Below that, brand revenue = affiliate only.

---

## 4. The single riskiest assumption — and a cheap test this month

**Riskiest assumption:** *that you can make logging fast and rewarding enough to turn
casual downloaders into daily loggers.* Everything downstream — community cold-start,
coach audience, brand inventory — collapses if the core loop doesn't create daily
active loggers. Industry baseline is brutal (~8.5% day-30 retention). This is the bet,
not nutrition or coaches.

**Test (no coaches, no nutrition, no community needed):** ship the bare loop — log a
set with **inline last-session pre-fill + one-tap progression + a streak + a
post-workout share card** — to **20–30 real lifters** (lean on existing Grit/PH gym
relationships). Watch one number: **of people who log a first workout, how many log
3+ sessions in their first 2 weeks?**
- Clear majority return unprompted + share cards get posted → loop works, greenlight community.
- They log once and ghost → fix the logging UX *before* building anything else.

Runs on what's already here (Supabase, PWA, html2canvas) — no new spend, two-week read.

---

## 5. What to deliberately NOT do yet

- **Don't gate athletes' own history/data early.** Free loop stays fully free — it's
  the acquisition engine.
- **Don't build per-coach native App Store apps.** In-app branding delivers ~90% of
  the feeling at near-zero cost. Native listings = a later paid tier.
- **Don't ship adaptive-macro algorithms, AI photo logging, recipe builders, or
  micronutrients.** None are needed to be "well-rounded."
- **Don't add intrusive ad SDKs.** They pay nothing in PH and corrode the UX.
- **Don't chase brand deals before ~10k engaged MAU.** Phase 3. Coaches (#1) create
  the audience that brand deals (#2) monetize — sequential, not parallel.
- **Don't try to do all of hybrid at once.** Strength logging first, best-in-class;
  running/conditioning after the core loop is proven.
- **Don't model PH revenue on US benchmarks** — eCPMs, affiliate payouts, ad rates are
  all materially lower in PH. Use local rails.
- **Don't build the coach layer before the consumer loop is validated.** The coach
  dashboard is a monetization wrapper around an excellent client logger; if the logger
  isn't excellent, the wrapper sells nothing.

---

**The through-line:** win daily active loggers → community compounds them → coaches
come for the audience and pay → brands sponsor the community at scale. Each phase is
the fuel for the next. Skip a phase and the next one starves.
