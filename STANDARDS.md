# Kilos Training — Engineering Standards

Living engineering standards. Read before adding a new pattern; if you invent a
new convention, add it here so the next change inherits it. Pairs with `CLAUDE.md`
(architecture) and `DESIGN.md` (visual system, once it lands in M0).

---

## 1. The non-negotiables

1. **Vanilla JS + Vite. No framework, no TypeScript.** No heavy state library.
2. **Local-first. Never block the logging loop on the network.** Writes hit
   localStorage *first* (instant, offline-safe); Supabase sync runs in the
   background. The mid-workout loop must work with zero connection.
3. **Free Forever for athletes.** Never gate a user's own training/food history.
4. **Mobile-first, dark, high-contrast.** The user is one-handed, sweaty, mid-set.

## 2. State + persistence

- **Single source of truth** lives in the app state in `main.js` (until split out).
  Render reads from state; events mutate state then persist + re-render.
- **Persistence keys are prefixed `kilos-*`** (e.g. `kilos-active-state`). Read/write
  through the `get`/`set` JSON helpers; never touch `localStorage` raw inline.
- **Crash-safety:** any in-progress workout/meal state must survive a refresh or a
  backgrounded tab. Losing a logged session is the worst bug we can ship.
- **Sync is one-way-then-merge:** mutate local → mark pending (`hasPendingSync`) →
  `pushData()` in the background; `pullAndMerge()` on load/login. All network +
  Supabase access lives in `supabase.js` — never call `supabase.from(...)` from a
  screen.

## 3. Data model evolution (staged on purpose)

- **Now:** one `user_data` JSONB blob per user. Fine for workouts + profile.
- **At M1 (food):** add a shared read-only `foods` reference table (USDA + Filipino
  staples + barcodes) — it cannot live in the blob. Food logs may stay in the blob
  until volume forces a `food_logs` table.
- **At M4 (coaches):** add relational tables (`coaches`, `coach_clients`,
  `assigned_programs`, `client_logs`).
- **Rule:** don't pre-build schema. Add a table exactly when a feature needs
  queryability the blob can't give — and write the migration in `supabase-setup.sql`
  (or a numbered migration) with RLS from day one.

## 4. Code structure (as the monolith splits)

`main.js` is ~3k lines today. Carve it into feature modules as you touch them —
don't big-bang it. Target boundaries:
- `screens/*` — one file per screen; a `render*()` returns markup, events wired
  **after** the DOM is in place (never before append).
- `workout/*` — the logging state machines (strength / CF / cardio).
- `state.js` — state + persistence helpers.
- `supabase.js` — all network + sync (already isolated; keep it that way).
- `data.js` — static datasets only (no logic).
- `personalization.js` — profile, equipment tiers, exercise resolution.

**Adding a screen:** register it in the screen switch, render returns a full
container, wire listeners after mount, and tear down any timers/intervals when
leaving (the rest timer / WOD clock must not leak).

## 5. Styling (enforced once M0 lands the design spine)

- Compose the shared type scale + spacing/radius/color tokens — don't hand-type
  `font-size` / `padding` / hex per element.
- **12px text floor** (audience reads numbers mid-set in gym light) — enforced by
  `npm run lint:design` in CI.
- **Touch targets ≥44px** (steppers, log buttons, rows), ≥8px apart.
- Dark-first. One accent. No one-off inline styles that reinvent an existing pattern;
  if you write the same inline style twice, make it a class.

## 6. Quality bar (before shipping)

- Works at iPhone Safari 375px; renders dark; no console errors.
- Loading (skeleton, not spinner), empty (first workout / no food yet), and a *useful*
  error state.
- Mid-workout/mid-meal state survives a refresh.
- Writes don't block on the network; offline-tolerant.
- Logging a set or a meal is the fewest taps possible with smart defaults.

## 7. Testing (see FOUNDATION-SETUP.md)

- **Vitest** for pure logic: progression math (+2.5kg/+1 rep), macro/calorie totals,
  `resolveExercise` (equipment/injury substitution), date/streak helpers.
- **Playwright** for the money paths end-to-end: start a workout → log sets → finish →
  see summary/share; (later) log a meal by search + barcode; sign-in + sync.
- Build-passing is NOT verification — drive the real flow.

## 8. Workflow

- Flat git flow: `main` is trunk; work on `feature/*` `fix/*` `chore/*`; merge back.
  Use `/start-work`, `/save-progress`, `/ship`.
- Use `/ux-review` and `/competitor-check` to pressure-test a change before shipping.

## 9. What NOT to do

- Don't introduce TypeScript or a framework.
- Don't block the logging loop on a network call.
- Don't query Supabase from a screen — add a helper to `supabase.js`.
- Don't paywall a core/basic feature.
- Don't add a build-time dep without checking it's needed — keep Vite fast.
- Don't roll your own persistence — use the `kilos-*` keyed helpers.
