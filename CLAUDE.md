# Kilos Training

**"Train Heavy. Free Forever."** — a fast, no-BS training tracker. Free
consumer app for logging workouts (lifting + CrossFit-style metcons) and
history, used one-handed at the gym between sets. Philippines-first; the
consumer app is free, and the business is intended to come later from
**coaches** (their own branded client app) and **brand deals** — see
`ROADMAP.md` / `STRATEGY.md` once those land.

> This is a living doc. The architecture section is accurate as of the last
> scan; the product direction (nutrition tracking, coaches, community) is
> being figured out — don't treat speculative roadmap as settled.

## Stack

- **Vanilla JS + Vite** (no framework, no TypeScript)
- **Supabase** (auth + cloud sync) — but the app is **local-first**
- **PWA** (`vite-plugin-pwa`) — installable, offline-tolerant
- **html2canvas** for shareable cards

## Common commands

```bash
npm run dev       # vite dev server (port auto-picked; grit-training-affiliate
                  # often holds 5173, so Vite may fall through to 5174+)
npm run build     # production build
npm run preview   # preview the production build locally
```

## Architecture (as scanned — verify before relying on a detail)

Single-page app, no router. `src/main.js` is the monolithic core: app state,
render functions, the workout/logging loop, and localStorage persistence.

- **`src/main.js`** — entry + app shell + state + render + event wiring. The
  active-workout state machine lives here (lifting sets + CrossFit rounds:
  `cfCurrentRound`, `cfRoundsCompleted`, `cfRoundLog`, `cfMovementsDone`).
- **`src/data.js`** — static datasets: `EXERCISES_DB`, `COACHES_DATA`,
  `LEGENDS_DATA`, `FAMOUS_WODS`, `SHUFFLE_PLANS`, `MUSCLES` / `MUSCLES_ALL`.
- **`src/personalization.js`** — profiles + equipment tiers + exercise
  resolution (`getProfile`, `saveProfile`, `getActiveProfile`, `EQUIPMENT_TIERS`,
  `resolveExercise`).
- **`src/supabase.js`** — auth + **sync** layer: `isConfigured`, `getSession`,
  `signUp/signInWithPassword`, `signOut`, and the sync primitives
  `pushData`, `pullAndMerge`, `hasPendingSync`.
- **`src/shareCard.js`** — `renderShareCard` / `buildShareData` (html2canvas).
- **`src/config.js`** — config / keys / flags.
- **`src/style.css`** — global styles. Dark theme (`theme-color #222`).

### Local-first model (important)

Writes go to **localStorage first** so the UI is instant and works offline
(`kilos-active-state` holds the live session, plus other `kilos-*` keys).
Supabase sync runs in the **background** via `pushData` / `pullAndMerge`;
`hasPendingSync` tracks unflushed changes. **Never block the logging loop on
a network round-trip** — that's the whole point of the architecture.

## UX principles (specific to this app)

The user is mid-workout: one-handed, sweaty, resting ~60–90s between sets,
opening the app for a few seconds at a time, dozens of times per session.

- **Logging is the core loop.** Fewest taps possible. Sensible defaults from
  last session. No needless confirmations.
- **Instant + offline.** localStorage-first; sync later. Bad gym data is the
  norm.
- **Crash-safe.** A mid-workout refresh or backgrounded tab must restore the
  session. Losing a logged WOD is unforgivable.
- **Mobile-first, dark, high-contrast.** Numbers are the most-read thing —
  big and legible in bright gym light.
- **Touch targets ≥44px**, ≥8px apart. No hover-only affordances.
- **Free-forever.** Don't paywall a basic need; that's the brand promise.

## Quality bar (before shipping)

- Works on **iPhone Safari (375px)** and a normal phone width; renders dark.
- No console errors.
- Loading (skeleton), empty (first workout), and useful error states.
- Mid-workout state survives a refresh.
- Writes don't block on the network.

## Workflow commands

Use these — don't type git manually for the common flows:

- `/start-work <type> <description>` — branch off main
- `/save-progress` — checkpoint commit on the current branch
- `/ship` — merge current branch → main, push, clean up
- `/preview` — start dev server, return URL

## Quality-lens commands

- `/ux-review` — UX review through Kilos' lens (mid-set logging, free-forever, mobile)
- `/competitor-check` — Hevy / Strong / MyFitnessPal lens + where we can be better

## What NOT to do

- Don't introduce TypeScript or a framework (React/Vue/etc.).
- Don't block the logging loop on a network call — localStorage first, sync after.
- Don't add a build-time dep without checking it's needed — keep Vite fast.
- Don't paywall a core/basic feature — "Free Forever" is the promise.
- Don't add a heavy state library; the app is intentionally vanilla + localStorage.

## Docs to build out next (not yet present)

This repo got the workflow + command system ported from `grit-training-affiliate`.
Still to author for Kilos (informed by the in-progress strategy research):
`STRATEGY.md`, `ROADMAP.md`, `DECISIONS.md`, `DESIGN.md`, `STANDARDS.md`,
`DEPLOY.md`, `CHANGELOG.md`.
