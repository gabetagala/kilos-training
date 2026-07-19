# KILOS — Design & Experience Spine

The one place the look, feel, and retention logic are written down, so every
new screen inherits them instead of being re-decided (and re-graded) each time.
Pairs with `STANDARDS.md` (engineering) and `BUILD-PLAN.md` (what/when).

Two halves:
- **Part A — the visual + motion system** (tokens you compose, not hand-type).
- **Part B — the experience principles** that make people come back, distilled
  from a verified research pass (sources at the end). Each is tied to a concrete
  Kilos move and its anti-pattern.

> Brand essence: **Train Heavy. Free Forever.** Dark, editorial, **monochrome**
> (no color accent — white *is* the accent). Giant **Bebas Neue** numbers are
> the hero; tracked **Space Mono** uppercase micro-labels are the editorial
> signature; system sans for body. Read one-handed, sweaty, mid-set, in bright
> gym light. Calm and premium, never a slot machine.

---

## PART A — VISUAL + MOTION SYSTEM

### A1. Color (already in `:root` — keep)
| Token | Value | Use |
|---|---|---|
| `--bg` / `--bg2` / `--bg3` | `#222` / `#2a2a2a` / `#333` | surfaces, grain shows |
| `--line` / `--border` | `rgba(255,255,255,.08)` / `.14` | hairlines, dividers |
| `--text` / `--text2`(`--grey`) / `--muted` | `#ebebeb` / `#888` / `#4a4a4a` | primary / secondary / faint |
| `--white` / `--off` | `#fff` / `#f0eeea` | hero panels, active, the "accent" |

Monochrome is deliberate. Don't introduce a hue without a deliberate decision
in `DECISIONS.md`.

### A2. Type
Families: **Bebas Neue** (display + the big numbers) · **Space Mono** (uppercase
tracked labels, `letter-spacing` ~`0.08–0.12em`) · `--font-body` system sans (body/UI).

A `.t-*` scale to replace hand-typed `font-size` (to be added to `style.css` in
the Batch 5 sweep; values reflect today's de-facto usage):

| Class | Font | Size | For |
|---|---|---|---|
| `.t-hero` | Bebas | clamp ~64–120px | the one big number per screen (KG, streak, timer) |
| `.t-display` | Bebas | 28–40px | screen titles, PR values |
| `.t-title` | Bebas | 18–22px | section/card headers |
| `.t-body` | system | 15–16px | sentences, descriptions |
| `.t-data` | system/Bebas | **≥16px** | **any number/state read mid-set** (see floor) |
| `.t-label` | Space Mono | 11–12px | standard labels |
| `.t-micro` | Space Mono | 9px | decorative tracked micro-labels only |

**The 12px-floor rule (reconciled — we have 90× `9px` today):** the floor governs
**data the athlete reads mid-set** — weights, reps, timers, set counts, PR
numbers — which must never be tiny. Tracked uppercase **Space Mono labels**
(section eyebrows like `WEIGHT`, `PERSONAL RECORDS`) are a deliberate editorial
device and may sit at 9–11px — but they must **never carry the primary data**.
The Batch 5 guardrail (`scripts/check-design-system.mjs`) should flag sub-12px
text *except* the whitelisted `.t-micro`/label classes.

### A3. Spacing — 4px base scale
`--s-1:4 · --s-2:8 · --s-3:12 · --s-4:16 · --s-6:24 · --s-8:32 · --s-12:48`.
Screen gutter = `--s-6` (24px). Compose these; stop hand-typing arbitrary padding.

### A4. Radius — collapse the sprawl (we have 8 different values today)
| Token | Value | Use |
|---|---|---|
| `--r-sm` | 8px | buttons, inputs, steppers, small controls |
| `--r-md` | 14px | cards, sheets, modals |
| `--r-pill` | 999px | chips, circular controls (done-check, FAB) |

Migrate the stray 2/4/6/10/13/20/48px values to these as files are touched.

### A5. Touch & ergonomics
- Targets **≥44px** (primary log/step/done **48px** where space allows), **≥8px** apart.
- Primary actions (log set, ±, done, rest timer) live in the **lower ⅔** — thumb zone.
- No hover-only affordances. Numbers big + high-contrast (bright-gym legibility).

### A6. Motion — restrained springs (the premium signal)
Apple's WWDC23 spring guidance is our default taste [S6]; translated to CSS:

| Token | Curve / duration | Use |
|---|---|---|
| `--dur-fast` | 120ms | tap feedback, stepper bumps |
| `--dur-base` | 220ms | most transitions, toggles |
| `--dur-slow` | 380ms | screen changes, celebration build |
| `--ease-smooth` | `cubic-bezier(0.2,0,0,1)` | **default** — smooth, no overshoot |
| `--ease-spring` | `cubic-bezier(0.34,1.56,0.64,1)` | emphasis/celebration — *small* overshoot only |

Rules, straight from the research [S6]:
- **Default to the smooth curve** ("when unsure, bounce 0"). Reach for `--ease-spring`
  only on *earned* moments (set done, PR, streak tick). The done-check already uses
  this spring — codify, don't exceed it.
- **Cap the bounce.** Noticeable bounce starts ~30%; ~15% just sharpens the tail.
  Never exaggerated — this is a calm tracker, not a toy.
- **Number count-ups** on the hero numbers (volume, streak, PR) — a short count-up
  reads as "premium" and earned. Use `--dur-slow`, `--ease-smooth`.
- **Haptics** (we already call `navigator.vibrate`): ~15–20ms on a stepper/set-done,
  a stronger pattern reserved for a PR. Map haptic intensity to event weight.

### A7. States (every screen)
Loading = skeleton (not spinner). Empty = a first-time prompt, not a blank. Error =
useful + recoverable. Mid-action state survives a refresh (crash-safety is sacred).

---

## PART B — EXPERIENCE PRINCIPLES (what makes people come back)

Distilled from an adversarially-verified research pass across habit apps
(Duolingo), fitness trackers (Apple rings, Peloton, Strava, Hevy), and craft SaaS
(Linear/Superhuman/Robinhood). Confidence noted; sources keyed `[S#]`.

### B1. Time-to-first-value is the #1 lever *(high confidence)* [S1]
~98% of new users in the median product are gone within two weeks — retention
fails **at the start**. So the first session must reach the "aha" fast: a logged
set / finished workout. **Mechanism for us:** sensible defaults (last-session
pre-fill already does this) so logging is near-zero-effort the very first time.
*Build attitude:* manual, non-scalable onboarding for the first cohorts.
*Anti-pattern:* a long setup before the first logged set.

### B2. The daily-open hook is an *internal* trigger, not a push *(high)* [S2]
Durable returns come from binding the app-open to an **existing routine** — here,
**resting 60–90s between sets** — not from notifications (push lifts adherence
only while it runs, then collapses). We're anchored to a pre-existing gym habit,
which activates better than inventing one. *Anti-pattern:* leaning on notification
spam for DAU.

### B3. Streaks/PRs/lifetime stats retain via loss aversion + ownership *(high)* [S3]
Accumulated history (streak, PRs, totals) becomes a **possession**; breaking it
feels like an identity loss, and the invested effort "loads" the next return
(loss aversion + endowment/IKEA effect — primary-research backed). We have streaks
+ a PR board; extend with **lifetime stats + badges** on Home so leaving costs
something. *Caveat:* on mobile, switching cost is low — treat history as a **modest**
moat, secondary to an genuinely-good daily loop, never a lock-in crutch.

### B4. Streaks MUST ship with graceful slack *(high)* [S3][S4]
The documented dark side: per-day **all-or-nothing** streaks make people who
travel/get sick/**take a rest day** feel judged — and rest is *correct training*.
Apple shipped streak-**pause** in watchOS 11 for exactly this. So: a **costed**
streak-freeze (an "emergency reserve," not a frictionless free pass — the cost is
what preserves the effect), per-day completion, and **no-guilt rest days**.
*Anti-pattern:* zeroing a streak for a legitimate rest day (drives over-training,
quitting, and perfectionist anxiety).

### B5. "Beat your last time," not a global leaderboard *(high)* [S7]
Personal-best loops and **ghosts of past performance** motivate durably; global
ranking demotivates everyone who feels permanently behind. Our pre-fill + PR
celebration already lean right — extend with "vs last time" framing and (if social
ever lands) **friends/cohort** comparison, not a global wall.

### B6. Celebration: proportional + earned, never a slot machine *(high)* [S4][S5]
A celebratory animation measurably helps (Duolingo's streak animation: **+1.7%**
D7). But over-celebration backfires (Robinhood pulled its confetti under
gamification scrutiny). The fix is **proportional, milestone-specific** moments:
**predictable trigger, variable magnitude** — a bigger PR earns a bigger moment.
Discrete and earned. *Anti-pattern:* an infinite-feed/slot-machine variable-reward
loop — explicitly wrong for a calm editorial tracker (see Overrated).

---

## PART C — WHAT'S OVERRATED / ANTI-PATTERNS (verified *refuted* or risky)
- **The Hook-Model "variable reward" loop as the core framework** — *refuted* in
  the research; don't build the daily-open around an infinite feed or surprise
  rewards. Our hook is the rest-between-sets routine + visible progress.
- **Global leaderboards / pure ranking** — demotivate the behind. Personal-best first.
- **Notification dependence** for DAU — collapses when it stops.
- **All-or-nothing streaks** — ship slack or don't ship the streak.
- **Over-celebration** — confetti on every tap trivializes the earned ones.
- Generic engagement benchmarks ("7% D7 = top quartile", "69% carryover") were
  *refuted* — don't anchor goals to them; instrument our own (see Open Questions).

---

## PART D — BUILD PRIORITY (retention-per-effort) & OPEN QUESTIONS
Research-ranked order, mapped to Kilos:
1. **Onboarding-to-first-value** — protect/shorten time to the first logged set. *(have pre-fill; verify the path)*
2. **Streak with costed freeze + no-guilt rest** — we have streaks; add the slack. *(highest-value missing piece)*
3. **Beat-your-last-time** surfacing + **identity accrual** (lifetime stats, badges on Home).
4. **Proportional celebration** — count-ups + a real, magnitude-scaled PR moment (motion tokens above).
5. **Motion spine** applied everywhere (springs, count-ups, haptics).

**Open questions to resolve with data, not assumption:**
- What's Kilos' actual 2-week retention curve and the precise "aha" event (first set? first finished workout? first PR?) — instrument it.
- Do these Western-sourced findings hold **Philippines-first** (notification norms, sharing, attitudes to competition/guilt)?
- Concrete streak-freeze params: how many, what cost/friction, how to frame rest as legitimate.
- The exact line between an earned PR celebration and a cheap one (a deadlift PR ≠ Robinhood's trading stakes).

---

## SOURCES (verified pass, 2026-05-31)
- **[S1]** Amplitude — retention is front-loaded / ~98% two-week churn (median). https://amplitude.com/blog/7-percent-retention-rule · churn.fm (Balfour) https://www.churn.fm/episode/product-habits-retention
- **[S2]** Internal vs external triggers; bind to existing routine. https://www.nirandfar.com/how-to-manufacture-desire/ · Lally 2010 / Wood & Neal 2012 (habit automaticity)
- **[S3]** Loss aversion + endowment/IKEA via streaks/records. https://blog.duolingo.com/how-duolingo-streak-builds-habit/ · https://yukaichou.com/gamification-analysis/top-10-gamification-in-fitness/ · Kahneman & Tversky 1979; Thaler 1990
- **[S4]** Streak dark-side + graceful slack (costed freeze). Apple Activity Rings HIG + watchOS 11 Pause. https://developer.apple.com/design/human-interface-guidelines/activity-rings · Sharif & Shu ("emergency reserve" slack)
- **[S5]** Celebration proportionality; Robinhood confetti removal. https://www.cnbc.com/2021/03/31/robinhood-gets-rid-of-confetti-feature-amid-scrutiny-over-gamification.html
- **[S6]** Motion = restrained springs. Apple WWDC23 "Animate with springs." https://developer.apple.com/videos/play/wwdc2023/10158/
- **[S7]** Personal-best > global leaderboards. https://yukaichou.com/gamification-analysis/top-10-gamification-in-fitness/ · Festinger social comparison; Wu/Kankanhalli/Huang 2015 (Nike+)

*All findings Western-sourced; none validated specifically for a PH audience. Effect sizes (the +1.7%, the 98%) are real but thin/median — treat as direction, not targets.*
