# KILOS — Competitor Teardown

What the best apps get **loved** for, what gets them **hated**, why people
**quit despite liking them**, and what Kilos can **steal**. This is a durable
research asset — pull from it for positioning, landing-page copy, store
listings, and roadmap calls.

> Source: a multi-agent research pass over real user reviews / Reddit / store
> ratings (2026-05). 8 apps. Re-run when the landscape shifts. The synthesis at
> the bottom is the operative part — the per-app sections are the evidence.

---

## TL;DR — the five bets the research backs

1. **"Free Forever" is the wedge, and it's bigger than we thought.** The #1
   fresh churn driver in *every* paid app is the bait-and-switch — Hevy's
   4-routine / 7-exercise / 3-month caps, Strong's 3-routine wall, Fitbod's
   3-workout trial, MacroFactor's no-free-tier, MFP's paywalled barcode scanner.
   People are *actively googling* "Hevy Pro for free." Kilos is structurally
   free (local-first = no per-user server cost) and monetizes later via coaches
   + brand deals — so we can promise "unlimited everything, free forever" as a
   permanent weapon incumbents **cannot match without torching their revenue.**
2. **"Your data is yours" is the second wedge.** Paying to see/export your *own*
   data is the most morally-charged complaint everywhere (Strong's CSV paywall,
   Strava's $80 Year-in-Sport wall, Whoop bricking history on churn, MFP burying
   export). One-tap free export is trivial over localStorage and pure trust.
3. **Crash-safety is a marketable feature, not a hidden default.** A single
   lost-workout incident is a *binary* trust-killer (Strong, Fitbod, MacroFactor
   all bleed users to it). We already have the architecture — say so loudly.
4. **Hybrid is an open category.** Hevy/Strong are lifting-only; Strava is
   cardio-only. Nobody owns strength + CrossFit/metcon + cardio in one log. We
   already have the CF state machine.
5. **PH-first + Android-equal is a structural gap.** Strong has no web app and
   lags Android; incumbents are iOS-centric. One vanilla-JS PWA covers Android,
   iOS Safari, and desktop, with share cards tuned for Messenger/Viber/IG.

---

## Per-app teardown

### Hevy — the closest competitor
**Love:** "Previous" column auto-fill (most-cited progressive-overload feature);
fast, out-of-the-way logging; progress charts that beat Strong; 1,000+ exercise
library with videos; **free** CSV export; social feed/leaderboards; cross-platform polish.
**Hate:** "free" quietly became a trial (4 routines / 7 custom exercises /
3-month history — "free for marketing purposes"); **rest-timer bugs after updates**
(caps at 30s, runs muted, auto-off); stability regressions (black screens);
supersets/dropsets gated; weak cardio + no metcon; poorly-structured starter
programs; nagging upgrade prompts.
**Love-but-quit:** defect back to Strong for speed ("got heavier over time");
hit the new caps → leave for FitNotes/Liftin' rather than pay; feed is
polarizing; it's a logger not a coach.
**Steal:** literal unlimited-everything free tier as direct contrast · crash-safe
timer that survives lock/refresh · first-class metcon+cardio · sane starter
templates · CSV import *from Hevy* (migration ramp) · quiet opt-in social.

### Strong — the OG
**Love:** fastest/cleanest mid-set logging in the category; best-in-class Apple
Watch app with **haptic rest-end** (most-loved touch); real-time PR notifications
+ progression graphs; smart last-session prefill + warm-up calc; clean kg/lbs
toggle with correct history conversion; honored old lifetime buyers.
**Hate:** **3-routine cap** is the #1 rage trigger (any PPL/split hits it
instantly); lifetime→subscription pivot still resented ("money-grab"); **CSV
export of your own data locked behind sub** (data-hostage); lost-workout-after-update
reports; logger-only (no cardio/metcon); Android lags iOS, no web app at all;
"high price for a simple log."
**Love-but-quit:** churn to Hevy *specifically* for uncapped routines; left on
principle over the subscription shift; outgrew the logger-only ceiling; a single
lost workout ends it ("trust in a log is binary").
**Steal:** unlimited routines free + loud · free export/import · crash-safe
autosave + "we restored your session" banner · metcon in one app · Watch-grade
one-handed ergonomics via PWA big-tap-targets · true cross-platform (no Android
second-class).

### Fitbod — AI/auto-programming
**Love:** muscle-recovery heat-map ("don't have to think"); zero decision
fatigue (full session generated); equipment/travel-aware regeneration; adaptive
auto-progressing weights ("personal coach"); big library + form video; clean UI
+ Apple Health.
**Hate:** flaky Watch↔phone sync **resets completed exercises mid-session**;
billing rage (hard refunds, day-1-of-year-2 auto-renew ~$80-96); steep price
($15.99/mo); years-old bugs unfixed; **auto-swapping exercises breaks
consistency**; suggestions too conservative for serious strength; slow results
(~400 workouts to feel it).
**Love-but-quit:** "I outgrew it" — learn the routine, stop needing AI, resent
paying premium just to log; price-to-use collapses; variability fatigue; 3-workout
trial too thin to ever reach the ~10-15 sessions the algorithm needs.
**Steal:** optional read-only muscle-freshness view (no AI) · "repeat last
session" one-tap default (no forced swaps — the consistency lifters beg for) ·
crash-safe offline logging · free full-feature · equipment quick-profiles ·
consistency-vs-variety control defaulted to consistency.

### Strava — social/community gold standard
**Love:** **kudos as a dopamine engine** (research: kudos measurably makes people
train more); segments/leaderboards/KOM; **Local Legend rewards consistency, not
just speed** (inclusive); Year-in-Sport recap as identity moment; auto-aggregates
every device into one feed; clubs/challenges as accountability.
**Hate:** relentless incremental paywalling ("slow betrayal"); **pay to see MY
OWN data** (Year-in-Sport behind ~$80); battery drain; GPS inaccuracy;
subscription fatigue; crashes/failed syncs/billing; heatmap privacy/stalker alarm.
**Love-but-quit:** "breach of trust" — quit on principle when a beloved free
feature got walled; duplicate-data churn (Garmin/Zwift power users won't
double-pay); lifters never fit (no strength logging); feed fatigue when it stops
feeling like friends.
**Steal:** kudos-style one-tap reactions (free, never paywalled) · "Year in
Lifting" recap card · strength/CrossFit-native PRs + consistency badges
(Local-Legend-style) · battery-light/offline framing · privacy-by-default +
export · free share to Messenger/Viber/IG.

### Whoop — recovery/insight storytelling
**Love:** **Recovery score as a single morning verdict** (go hard / rest);
Strain Coach load target; Journal behavior-correlation engine ("which habits
help YOUR recovery" — stickiest hook); proactive insight delivery; Sleep Coach
with intent targets; multi-horizon trends; screenless no-notification wearable.
**Hate:** **wrist HR is "waaaay off" for strength/CrossFit/HIIT** (the exact
users we serve); "ghost workouts" inflate strain; poor step tracking;
subscription-only, **bricks on churn** (no read-only history); 5.0 forced-upgrade
broke the loyalty promise; cancellation dark patterns; flimsy hardware.
**Love-but-quit:** love the insight but it's all behind a $199-359/yr wall with
no free fallback; lock-in resentment overpowers affection; 5.0 episode burned
trust; accuracy doubt erodes willingness to pay for a score you don't believe.
**Steal:** daily one-line **readiness verdict from data we already have** (no
$300 sensor, sidesteps the HR-accuracy failure) · free lightweight Journal +
correlation · weekly/monthly recap card · barbell/metcon **load metric from
reps logged, not wrist HR** · never gate history / never brick · proactive
plain-language nudges (rare, rule-based).

### MyFitnessPal — food-logging incumbent
**Love:** 14M+ food database (search-and-tap); barcode scanner (when free) —
most-praised; recipe importer ~90% match; deep device integrations; years of
historical data; streaks; sheer ubiquity.
**Hate:** **2026 "Today tab" redesign buries the Diary behind "View All," adds
taps, permanent, no opt-out**; **paywalled the barcode scanner users helped build**
(the defining betrayal); **full-screen ads fire mid-log**; "outdated/slow/buggy";
crowdsourced data duplicates/inaccuracy; unreachable support; billing friction.
**Love-but-quit:** user-built-DB-now-paywalled betrayal (about trust, not
dollars); redesign-forced churn to Cronometer/Lose It; ad-fatigue bail (would
pay small "remove ads" fee but full Premium feels overpriced); accuracy ceiling.
**Steal:** never paywall the core logging loop ("the thing MFP took away, we
never will") · **logging screen is sacred — zero mid-set ads/interstitials** ·
never force a redesign / never bury the most-used view · free export + import
path from MFP · gentle non-guilt streaks · curated PH-aware library (anti-duplicate).

### MacroFactor — the modern, loved food tracker
**Love:** adaptive expenditure algorithm (reverse-calculates real TDEE weekly,
auto-adjusts targets); **"adherence-neutral" — adjusts to what you ate, no shame
spiral** (why people finally stick with tracking); trend-weight smoothing stops
panic-quitting; fastest logger (~10 actions vs MFP's ~15); verified curated DB;
**zero ads**; science credibility (Nuckols/Trexler).
**Hate:** **no free version** (7-day trial only) — the #1 complaint;
predatory-feeling trial-to-paid (charged-after-forgetting threads); **can't
cancel in-app** (must go to store, deleting app doesn't stop billing); first-week
overwhelm; mobile-only; partial logging silently corrupts targets; logging bugs.
**Love-but-quit:** logging fatigue after 2-4 weeks; price-vs-use mismatch for
seasonal dieters; "tracker not a system" (no meal planning); **goal-achieved =
churn** (the magic has less to do at maintenance).
**Steal:** **adherence-neutral no-shame tone** (never scold a missed day) ·
trend-line smoothing on est-1RM/volume/bodyweight · sub-10s logging as a measured
constraint · free-forever + frictionless cancel/export · crash-safe offline ·
phase-aware delightful re-engagement (capture the comebacks MF loses to billing).

### Duolingo — the world-class habit/retention engine (not fitness)
**Love:** **the streak as identity** (people protect 100+ day streaks even after
losing interest); instant XP reward welded to the action; **Streak Freeze
forgiveness** (removes all-or-nothing dread); leagues/leaderboards; bite-sized
sessions; Duo the owl as shareable personality; historically generous free tier.
**Hate:** ad volume/placement (full-screen between lessons, upsells timed for
max pressure — blamed for a ~30% stock drop); **guilt-trip notifications** ("rude/
aggressive" when relentless); **hearts/energy gates cut you off mid-session**
(punished for practicing); shallow repetitive content; gamification over real
learning; AI-quality degradation; streak anxiety becomes a chore.
**Love-but-quit:** **the streak-break cliff** — habit is scaffolded on the streak,
so when it breaks, the habit dies all at once; monetization made a once-free app
feel hostile; content ceiling; AI-first brand-trust erosion.
**Steal:** **training streak with forgiveness** (count WEEKS / planned days +
free rest-day freeze — never punish correct rest/deload, never paywall the
freeze) · instant in-the-moment reward on log-confirm · loss-aversion framing
pointed at *your own past self*, never guilt · shareable PR/milestone cards ·
optional friends/coach-scoped league (not global vanity) · **avoid the
energy/hearts/ad-gate entirely as an explicit anti-feature.**

---

## Synthesis

### Cross-cutting patterns
**Universal loves**
- **Smart defaults from last session** — Hevy "Previous", Strong prefill, Fitbod
  generation, MacroFactor sub-10s log all win for the same reason: *remove
  thinking from the core loop.* Fewest-taps wins every category.
- **Turn data into a verdict, not a chart** — Whoop Recovery, Fitbod heat-map,
  MacroFactor adaptive TDEE win by saying "do this today." Deciding > graphing.
- **Visible progress + PRs** — beating your past self is the deepest retention
  driver everywhere.
- **Social/streak dopamine** — kudos, streaks, leagues, feeds. Strongest habit
  hook, but each is double-edged.

**Universal hates**
- **Bait-and-switch monetization** of things that were free / that users built —
  the #1 fresh churn driver in *every* paid app.
- **Pay to access your own data/history** — the most morally-charged complaint.
- **Losing a logged session / flaky sync** — a binary, unforgivable trust-killer.
- **Interrupting the core loop** — mid-log ads, energy gates, upsell modals,
  redesigns that add taps. Anything between user and logging is rage-inducing.

### Prioritized steal-list (mapped to the roadmap)

**NOW (quick wins)**
- **"Free Forever," literal & loud** — unlimited routines/exercises/history, no
  caps, stated on first-run + landing. *(Hevy, Strong, Fitbod, MFP, MacroFactor)*
- **Crash-safe logging + visible "session restored" banner** — persist every
  set/round, recompute from timestamps, never block on network. *(Strong, Fitbod,
  MacroFactor, Hevy)* — *timer-persistence shipped 2026-05; banner still to add.*
- **Bulletproof rest timer** surviving background/lock/refresh, configurable
  beyond 30s, sound **and** vibration. *(Hevy, Strong)* — *core fix shipped 2026-05.*
- **Sub-10s logging as a measured constraint** — prefill, one-tap "same as last,"
  big steppers, glanceable numbers; default start = "repeat last session." *(Strong,
  Hevy, Fitbod, MacroFactor)*
- **One-tap free CSV/JSON export** as an explicit anti-lock-in promise. *(all 5 paid)*
- **Instant reward on log-confirm** — micro-animation + "beat last session / new
  PR" before leaving the screen. *(Duolingo, Strong, Hevy)*
- **Free shareable cards** (workout + PR/milestone), dark/high-contrast, tuned for
  Messenger/Viber/IG Stories. *(Strava, Duolingo, Hevy, Whoop)*

**NEXT**
- **Training streak with forgiveness** — consecutive weeks + free rest-day/freeze;
  loss-aversion at your own past self, never guilt. *(Duolingo, MFP, Strava)*
- **First-class metcon + cardio in one app** — AMRAP/EMOM/for-time/rounds + simple
  cardio. *(Hevy, Strong, Strava)*
- **Trend-line smoothing** on est-1RM / volume / bodyweight. *(MacroFactor, Hevy,
  Strong, Whoop)*
- **Vetted starter programs / balanced templates**, consistency defaulted over
  rotation. *(Hevy, Fitbod)*

**LATER (M1+)**
- **Daily one-line "readiness" verdict** + optional muscle-freshness view from
  local history only (transparent heuristic, no fake AI, no hardware). *(Whoop, Fitbod)*
- **Free "Year in Lifting" / monthly recap card.** *(Strava, Whoop, Hevy)*
- **Quiet, opt-in, friends/coach-scoped social** — kudos reactions + consistency
  badges, never a forced global feed, never paywalled. *(Strava, Hevy, Duolingo, MFP)*

### Anti-patterns — what we must NEVER do
1. **Never cap/paywall a basic need** — routines, custom exercises, history, PRs,
   WOD logging. Free Forever means *literally* free.
2. **Never hold data hostage** — export is free, one-tap, never buried; never
   brick history.
3. **Never lose a logged set/session** — local-first write-on-every-action, sync
   after, never block the loop.
4. **Never interrupt the logging loop** — no ads/interstitials/upsell modals,
   *especially* during an active workout. The active screen is sacred.
5. **Never use punishing/guilt mechanics** — no energy gates, no shame-spiral
   streak nags, no win-back spam. Adherence-neutral tone; loss-aversion points at
   the user's own past self.
6. **Never force a redesign without opt-out** or bury the most-used view behind
   extra taps. Logging + history stay one tap from home; resist card-bloat.
7. **Never auto-swap a user's exercises** by default — consistency is the default;
   rotation is opt-in and obvious.
8. **Never use dark-pattern billing/cancellation** — we have no subscription to
   cancel; keep it that way and never reintroduce the pattern via coaches/brand deals.

### Positioning angles (where we win that incumbents structurally can't)
1. **The genuinely-free logger in a category of bait-and-switch.** Local-first =
   no per-user cost forcing a cap; monetize via coaches + brand deals later.
   "Unlimited everything, your data always yours, free forever."
2. **The one app for hybrid athletes** — strength + CrossFit/metcon + cardio in
   one log. We already have the CF state machine.
3. **PH-first and Android-equal by default** — one PWA on Android/iOS/desktop;
   share cards tuned for Messenger/Viber/IG Stories; offline-tolerant for PH data.
4. **Fastest + most reliable mid-set loop** — out-log on tap-count *and* be the
   most crash-safe. "Instant, offline, never loses your set" — a claim cloud-
   dependent incumbents can't honestly make.
5. **Coach-decision payoff without the $300 sensor or subscription** — Whoop's
   "readiness" / Fitbod's "what to train" feel from data we already log,
   transparent heuristics, no wrist-HR (documented to fail lifters), free.
