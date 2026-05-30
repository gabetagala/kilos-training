# Foundation Setup — make Kilos a professional web app

The turnkey checklist to bring Kilos to the same production bar as
grit-training-affiliate. **Run this in the Kilos session** so each tool is
installed, run, and verified in place. Do the batches in order; verify each
before moving on (small + isolated first, risky last). This is M0 of `BUILD-PLAN.md`.

> Discipline: after each change, confirm the dev server still transforms the file
> (`curl -o /dev/null -w "%{http_code}" http://localhost:<port>/src/...` → 200) and
> `npm run build` stays green. Don't batch unrelated changes.

---

## Batch 1 — Tooling + CI gate
- [ ] `npm i -D @biomejs/biome` → `npx biome init`; scope to `src`. Add scripts:
      `"lint": "biome lint src"`, `"format": "biome format --write src"`,
      `"check": "biome check src"`.
- [ ] Pre-commit hook: `.githooks/pre-commit` runs `npm run lint` (+ design check
      from Batch 5); `"prepare": "git config core.hooksPath .githooks || true"`.
- [ ] `.github/workflows/ci.yml`: on push/PR to main → `npm ci` → `npm run lint` →
      `npm run test` → `npm run build`. (Vercel auto-deploys main, so red CI must
      block a deploy.)
- [ ] `.gitignore` hygiene: ignore `node_modules`, `dist`, `.env*` (keep
      `.env.example`), `test-results/`, `playwright-report/`, `.scratch/`, editor +
      OS junk, and stray root screenshots (`/*.png`). Don't commit `.claude/skills`,
      `.agents/`, `.mcp.json`, `.playwright-mcp/`.
- **Verify:** `npm run lint` clean, CI green on a throwaway PR.

## Batch 2 — Tests (Vitest + Playwright)
- [ ] `npm i -D vitest`; `"test": "vitest run"`, `"test:watch": "vitest"`.
- [ ] Unit tests for **pure logic** (no DOM): progression math, macro/calorie totals
      (when M1 lands), `resolveExercise` equipment/injury substitution, streak/date
      helpers. Put them next to or under `tests/unit/`.
- [ ] `npm i -D @playwright/test`; `npx playwright install`; `"test:e2e":
      "playwright test"`; `playwright.config.js` pointing at the preview server.
- [ ] Playwright **money-path** smoke: app loads with 0 JS errors; manifest + icons
      200; SW registers (in preview); then the core loop — start workout → log a set →
      finish → summary/share renders. Gate auth/sync tests behind an env-set test account.
- **Verify:** `npm run test` green; `npm run test:e2e` green against `npm run preview`.

## Batch 3 — Observability
- [ ] Global handlers in the entry: `window.addEventListener('error', …)` +
      `'unhandledrejection'` → console + (if configured) Sentry.
- [ ] `npm i @sentry/browser`; **static import**; `Sentry.init({...})` guarded by
      `if (import.meta.env.VITE_SENTRY_DSN)`. Add `VITE_SENTRY_DSN` to `.env.example`
      and to Vercel (Production + Preview). CSP (if any) must allow the Sentry ingest host.
- [ ] A friendly crash screen for an unrecoverable render error ("Something broke —
      tap to reload") instead of a blank page.
- **Verify:** trigger a test error in prod build → it appears in Sentry; DSN present in
      the built bundle.

## Batch 4 — PWA hardening
- [ ] Confirm **installable**: real 192/512/maskable icons, valid `manifest`,
      apple-touch-icon + iOS meta. DevTools → Application shows "Installable".
- [ ] `registerType: 'prompt'` + a "New version available → refresh" toast (no silent
      mid-session swaps).
- [ ] Confirm the logging loop works **offline** and pending writes sync on reconnect
      (the local-first model already does most of this — verify, don't rebuild).
- **Verify:** install to a phone home screen; airplane-mode a workout, log sets, reconnect → syncs.

## Batch 5 — Design spine + guardrail
- [ ] Author `DESIGN.md` for Kilos: surfaces (logging / personal / community / coach),
      color tokens (dark-first), the `.t-*` type scale, spacing/radius tokens, component
      patterns, **12px text floor**, **44/48px touch targets**. (Do a real pass against
      the existing `style.css` — don't copy Grit's tokens blindly.)
- [ ] Sweep `style.css` + inline styles to the 12px floor and the token scale.
- [ ] Port `scripts/check-design-system.mjs` (the sub-12px guardrail); add
      `"lint:design": "node scripts/check-design-system.mjs"` and a CI step + pre-commit.
- **Verify:** `npm run lint:design` passes; spot-check the main screens on 375px + desktop.

## Batch 6 — Doc set
- [ ] `DECISIONS.md` — ADR log (vanilla JS, local-first, Supabase single-blob→tables,
      free-forever, PH-first, hybrid positioning, coaches = business). Seed from STRATEGY.md.
- [ ] `ROADMAP.md` — now/next/later from BUILD-PLAN.md + a NOT-DOING list.
- [ ] `DEPLOY.md` — env vars, Supabase migrations, Vercel deploy, post-deploy checklist.
- [ ] `CHANGELOG.md` — start it at the first shipped milestone.
- **Verify:** docs cross-link; CLAUDE.md "docs to build out" list is satisfied.

---

**Order rationale:** tooling/CI first (cheap, catches everything after), then tests
(so refactors are safe), then observability (see prod failures), then PWA + design
(user-facing polish), then docs (capture the decisions). Foundation before features —
then M1 (food) builds on solid ground.
