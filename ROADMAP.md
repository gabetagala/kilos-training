# KILOS — Roadmap to External-Ready

The path from "good prototype" to a product real strangers can rely on. This is
the **driving doc**: phases in order, each with **checkpoints you can tick**.
Pairs with `BUILD-PLAN.md` (the feature milestones M0–M5), `STRATEGY.md` (the
why), `DESIGN.md` (the visual/UX bar) and the **Quality Rubric** below (the
objective bar we grade against — populated from a multi-source research pass).

> **North star:** the fastest, smartest *free* training tracker — and the
> consumer loop is the acquisition engine for coaches later. **The one bet:**
> can we make logging fast + rewarding enough to turn downloaders into daily
> loggers? Everything below serves shipping that loop to real lifters and not
> embarrassing ourselves on quality when we do.

---

## Where we are (honest snapshot — 2026-05-31)

**Strong:** core logging loop works (pre-fill, ± steppers, streaks, PRs,
summary, share card); hybrid strength/CF/cardio; cohesive two-tone design
system + token guardrail in CI; WCAG 2.1 AA (axe-core clean, enforced in CI);
log-first active screen; Biome + Vitest + Playwright(+axe) all green; Supabase
`user_data` blob **with RLS** + username/password auth; local-first, crash-safe.

**Fragmented / missing (why it doesn't feel "pro" yet):** not deployed; no real
analytics (we're flying blind on the one bet); no error monitoring; no privacy
policy/terms or account-deletion; `main.js` is a ~3k-line monolith; Supabase
schema is **untracked** (no migrations) with a few advisor warnings; food +
coaches are stubs; no real-device QA; docs half-written.

---

## NOW — Phase 1: Get to a private beta we can learn from
*Goal: the loop in front of 20–30 real lifters, instrumented, without leaking data or crashing silently. This is the bet — nothing past here matters until the loop proves out.*

- [ ] **Deploy to production** (Vercel): wire `VITE_SUPABASE_URL` + anon key as env vars, confirm the live build, lock the domain (`kilostraining.*`), CI red blocks deploy.
- [ ] **Real account/sync works live** — sign up → log → sign in on another device → data syncs. (Needs the Supabase env keys; verify against the real project.)
- [ ] **Analytics / the one metric** — privacy-respecting product analytics, instrument the funnel: install → first set logged (aha) → 3+ sessions in 2 weeks. We must *measure* retention, not guess.
- [ ] **Error monitoring** — Sentry (FOUNDATION Batch 3) + a friendly crash screen, so beta breakage is visible.
- [ ] **Privacy policy + Terms + account deletion/export** — minimum legal/trust for real users' health data (PH Data Privacy Act + general). Non-negotiable before external users.
- [ ] **Supabase hardening** — fix advisor warnings (lock down `rls_auto_enable`, enable leaked-password protection, wrap `auth.uid()` in `(select …)`), and **commit the schema as a tracked migration** so it's reproducible.
- [ ] **Real-device QA** — iPhone Safari + a mid-range Android, mid-workout, offline → reconnect.
- [ ] **Beta feedback loop** — the in-app message channel routes somewhere you read.

**✅ Checkpoint (ship gate):** a stranger can install, create an account, log 3 workouts across 2 days, and you can *see* it in analytics — with no console errors, on a real phone, with a privacy policy live.

---

## NEXT — Phase 2: Professionalize the codebase & close fragmentation
*Goal: the app stops feeling stitched-together and becomes maintainable as it grows. Run in parallel with the beta read.*

- [ ] **Split the `main.js` monolith** by feature (`screens/`, `workout/`, `state/`) as STANDARDS.md prescribes — carve as touched, not big-bang.
- [ ] **Finish the design-system migration** the guardrail tracks (remaining sub-12 labels onto `.t-*`, off-scale radii → `--r-sm/md/pill`).
- [ ] **Broaden tests** — unit for streak/volume/units edge cases; e2e for build→start→finish, CF, cardio, sign-in+sync; keep axe in CI.
- [ ] **Finish the doc set** — `DECISIONS.md` (ADRs), `DEPLOY.md`, `CHANGELOG.md` (the rest of CLAUDE.md's list).
- [ ] **Performance budget** — Lighthouse pass, bundle-size budget, real LCP/INP on a mid phone.
- [ ] **Score against the Quality Rubric** (below) — get every weighted dimension to its bar; re-score each milestone.

**✅ Checkpoint:** Rubric overall ≥ target; no file > ~800 lines doing five jobs; Lighthouse PWA/Perf/A11y/Best-Practices green.

---

## LATER — Phases 3–5: the product story (per BUILD-PLAN.md)
Gated on the loop validating (Phase 1) — don't build these before the bet pays.

- [ ] **M1 — Nutrition** (the second pillar): USDA + Filipino staples + barcode; the "better-than-MyFitnessPal" log; one integrated day view. *(Replaces the Nutrition stub.)*
- [ ] **M2 — Personal page**: lifetime stats, PR board, achievements, body metrics.
- [ ] **M3 — Community seeds**: kudos, program library, follow/feed (the coach on-ramp).
- [ ] **M4 — Coaches B2B** (the business): coach↔client model, program-assign, in-app branding, messaging. *(Replaces the Coaches stub.)*
- [ ] **M5 — Brand deals**: PH-native affiliate, sponsored challenges — only past ~10k engaged MAU.

---

## Launch-readiness checklist (the gate to *any* external user)
The hard line before strangers touch it:
- [ ] Privacy policy + terms live; account deletion + data export work.
- [ ] RLS verified on every table; Supabase advisors clean; secrets only in env (never committed).
- [ ] Error monitoring + analytics live; no console errors on the money paths.
- [ ] Works on real iPhone Safari + Android; installable PWA; offline-tolerant; mid-workout survives refresh.
- [ ] WCAG AA (axe clean); Lighthouse green; load fast on PH mobile data.
- [ ] A support/feedback channel a human actually monitors.

---

## Quality Rubric (the objective bar)
*Populated from a multi-source research pass across fitness trackers, food
trackers, mobile UI craft, UX/usability, accessibility, performance/PWA, and
trust/privacy. Each dimension gets a weight, the "what 5/5 looks like" bar, and
Kilos' honest current score — re-scored each milestone.*

> ⏳ **In progress** — research fleet running; the scored rubric lands here next.

---

## NOT doing (yet) — on purpose
- Native iOS/Android apps (PWA first; native is a later distribution call).
- Per-coach native App Store listings (in-app branding first).
- Adaptive-macro algorithms / AI photo logging / recipes (not needed to be "well-rounded").
- Intrusive ad SDKs (kill the mid-workout UX, ~zero PH eCPM).
- Paywalling athletes' own data — ever (free-forever is the brand).

---

## How we work (cadence)
- Flat git flow; every change gated by CI (lint · design guardrail · unit · e2e+axe · build).
- Design/UX changes pressure-tested via `/ux-review`; backend changes via the Supabase advisors + a security pass before launch.
- Re-score the Rubric at each checkpoint; this doc is living — update NOW/NEXT/LATER as reality moves.
