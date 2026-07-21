# UX Sweep — 2026-07 ("real app" bar)

> 37-agent fresh-eyes sweep (7 reviewers → dedupe → adversarial verify → synthesis).
> 79 raw findings → 28 confirmed, 0 refuted. Evidence: seeded-account screenshots + live Playwright + code.
> STATUS (2026-07-25): 27 of 28 findings FIXED and shipped across 14 commits
> (54c7546…). The one exception: f25 (unify illustration languages) is
> deliberately NOT applied — the founder explicitly approved the current
> color white-mat art direction the same week; revisit only if he reopens it.

## Verdict
Not yet — and the gap is specific, not diffuse. The surface is genuinely close: the near-black Bebas/Space Mono system, the quiet-confidence restraint, and instant local-first logging with working crash-restore are NTC/Whoop-class, and no competitor's free tier looks this good. But the sweep proves the app currently lies about the one thing it exists to be true about: the numbers. Sessions physically cannot be finished at phone widths (AMRAP/For Time/cardio never end), an undone set permanently inflates volume into synced history, guided lifts store the literal string "5–8" as reps while +2.5kg auto-fires every session regardless of performance, the week strip lights future days as already trained, and "what did I front-squat last Tuesday" is unanswerable because History was retired while the app still points at it. Any one of these fails the Nike test on first contact; together they make the confident numerals fiction. The diagnosis is also the good news: this is a finishing problem, not a taste problem — the codebase already contains the correct pattern for nearly every fix (the 44px .rp-close hit-area trick, the finish-confirm modal, the recompute-from-logs reduce at rehab finish, the post-workout account nudge), just applied inconsistently. The five P0s are 2S+2M+1L — roughly one hard week to stop breaking the illusion — and P1 is ordered so the first ten items are S-effort data-safety and legibility wins that compound daily.

## Already clears the bar (protect these)
Genuinely at the bar already: the visual identity (near-black surfaces, oversized Bebas numerals, Space Mono labels, monochrome restraint — no confetti, no badges, no streak-shaming anywhere); the local-first architecture as felt speed — writes are instant, offline-tolerant, and a mid-workout refresh restores the session with the rest timer correctly fast-forwarded; the guided player's fixed-slot layout (a deliberate, correct anti-layout-shift decision for mid-set use); the commissioned rehab illustrations as artwork; and the post-workout account nudge (right moment, isConfigured/session-count guards) — growth done with taste. These are the assets the punch list protects.

## P0 — breaks the illusion
### f1 · Finish is unreachable under the fixed nav — AMRAP / For Time / cardio and any early-exit session can never be ended
**Effort S** — The core loop cannot complete: at 375–390px the z-100 nav permanently covers #btn-finish (verified by two reviewers plus live Playwright — click times out, 'nav intercepts pointer events'), and only strength/EMOM/Rounds auto-finish.

**Fix:** Add padding-bottom: calc(96px + env(safe-area-inset-bottom)) to #active (the #active{padding:0} rule) or to its scrollable content container so the timer strip is unaffected. Keep #nav visible — it is the exit path. Add a Playwright smoke test at 375x667 that scrolls #active and asserts #btn-finish is clickable and opens the confirm sheet.

 Files: `src/style.css:1999-2000` · `src/main.js:4005` · `src/main.js:4670`

### f2 · Un-logging a set never subtracts it — undo permanently inflates volume and set counts, saved forever and synced
**Effort S** — toggleSetDone increments on done but the undo branch (whose own aria-label says 'tap to undo') never decrements; finishWorkout saves the raw accumulators, so every one-handed mis-tap corrupts history, CSV, weekly volume, and Supabase — proven live: 1 set logged, entry says 2,000 KG / 2 SETS.

**Fix:** Make logs the source of truth: in finishWorkout, recompute totalWeight and sets from done logs (mirror the rehab-finish reduce at main.js:2116-2120) instead of trusting live accumulators. Also call saveActiveState() on the undo branch so undos survive a refresh; optionally recompute accumulators on undo so in-workout header stats stay honest.

 Files: `src/main.js:4301-4345` · `src/main.js:4787-4788` · `src/main.js:2116-2120`

### f3 · Rep ranges are never parsed — history stores the string "5–8" as reps, and +2.5kg auto-fires every session with zero performance signal
**Effort M** — Guided lift steps have no rep input, so main.js:2600 logs the prescription range as reps; parseInt('5–8')=5 corrupts volume/PRs, and because stored reps always equal the prescription, suggestNextWeight's allMet is unconditionally true — auto-escalating load in a back-rehab-adjacent program.

**Fix:** On SET DONE, flip the existing stepper (rep mode already exists at main.js:2630-2635) to reps prefilled at the range's upper bound for one confirm tap; store the integer, never the range string. In progression.js parse the range's upper bound for allMet (keep the floor for fell-short detection), apply the same parse to the duplicated inline lastAllMet near main.js:4152, and handle '/side' suffixes. Add render-time coercion or a one-time migration for existing non-numeric reps; update tests/unit/progression.test.js and the seed generator so fixtures are producible.

 Files: `src/main.js:2600` · `src/main.js:2630-2635` · `src/main.js:4152` · `src/workout/progression.js` · `tests/unit/progression.test.js`

### f5 · "THIS WEEK" lights future days as already trained — and Home and Program disagree on what a week is
**Effort M** — The strip buckets a trailing 7×24h window by weekday, so last Wed–Sat light this week's Wed–Sat (all 7 dots 'done' on a Tuesday, live-verified); a 4x/week trainee can never see a gap, and the strip starts Sunday while the Program week starts Monday — false data on the most-seen surface of a consistency app.

**Fix:** One Monday-start week model keyed by local dateKey(): extract renderWeekPlan's monday computation + byDate index into a shared helper; renderWeekStrip consumes it and marks a day done only if dateKey(d) <= todayKey and an entry exists. Delete the trailing-7-days/getDay() logic and reorder the strip's labels Mon-first to match Program.

 Files: `src/main.js:661-667` · `src/main.js:2218-2219`

### f4 · A tracker that can't show last Tuesday's weights — History was retired but the app still points at it everywhere
**Effort L** — The session list was deliberately retired (comment at main.js:5133) yet recent cards keep a pressed state with no click handler, 'SEE HISTORY' routes to Home, rehab entries flood the 5 recent slots, and a permanent nav slot sells 'COACHES · SOON' — the log is the product's spine at Hevy/Strong and this is the largest single gap against them.

**Fix:** Reinstate History as a real overlay destination (no router — the retired renderer is a head start): sessions grouped by week, tap-to-expand per-exercise sets from workoutHistory logs. Wire recent cards and the summary 'See History' button to open it; segment/filter rehab entries in the Home recent list so lifts stay visible. The nav-slot swap (Coaches → quiet Home-footer card, History into the nav) is recommended but present it to the founder as a separate business decision from the non-optional reinstatement.

 Files: `src/main.js:5133` · `src/main.js:713-717` · `src/main.js:4973` · `index.html:318-322` · `index.html:443` · `src/style.css:1016`

## P1 — polish that compounds
### f11 · A failed pull at sign-in pushes the empty device over the user's cloud history
**Effort S** — pullAndMerge treats ANY .single() error — timeouts, 5xx, rate limits, the PH-LTE norm — as 'first ever sign-in' and upserts the fresh device's nulls over months of backup: the only failure mode that destroys the backup at the exact moment (device loss) an account exists for.

**Fix:** Switch to .maybeSingle(); treat first-sign-in only as (error === null && row === null). On any error return without pushing and leave the pending-sync flag so the next open retries the pull, not the push. Belt: pushData refuses to upsert when every SYNC_KEY is null/empty and a remote row is known or the account is >1 day old.

 Files: `src/supabase.js:189-199` · `src/supabase.js:155-174`

### f20 · "Discard paused session" destroys logged sets with one tap on a 9px link — no confirmation, no undo
**Effort S** — The handler removes REHAB_STATE_KEY (which holds liftSets, weights, elapsed position) instantly, on a zero-padding text link directly under the Resume card — the exact 'losing a logged WOD' class CLAUDE.md calls unforgivable, in an app that confirms every other destructive action.

**Fix:** Route through the existing finish-confirm-style modal ('Discard paused session? N logged sets will be lost', N from saved.liftSets) with Discard/Keep buttons — do not introduce native confirm(), none exists in the codebase. Give the link >=44px tap height via padding, separated from the Resume card's hit area.

 Files: `src/main.js:2482-2487` · `src/style.css:6257-6269` · `src/main.js:4748-4768`

### f9 · A border token used as text color renders the account nudge, warm-up numbers, and two tap targets at 8% alpha — functionally invisible
**Effort S** — --grey2 is rgba(255,255,255,0.08), a border token, yet 15 rules use it as color: — the growth nudge shipped in 11e9b23 is unreadable at ~1.1:1, mid-workout warm-up weights are ghosted, and .ex-delete/.ex-nav-btn are invisible touch targets.

**Fix:** Replace color: var(--grey2) with var(--text2) in the ~13 rules carrying text, numbers, or tap targets (.dn-*, .wr-*, .ap-hint, .esm-sub-tag, .shuffle-override-label, .ex-delete, .ex-nav-btn); judgment call on the 2 decorative ones (.feel-badge::before separator, .mf-cell.fresh fade scale). Raise .dn-label/.dn-sub from 8px to 11px. Reserve --grey2 for borders — quiet via token, never via alpha.

 Files: `src/style.css:74` · `src/style.css:3443-3495` · `src/style.css:3656-3672` · `src/style.css:4461`

### f14 · The PR board attributes the user's numbers to lifts they didn't do — Romanian Deadlift renders as "DEADLIFT 75KG"
**Effort S** — Tiles are labeled with name.split(' ').slice(-1)[0], so the seeded truth (Romanian DL / Front Squat / Floor Press) claims a conventional-deadlift and back-squat max the user doesn't have, Front+Back Squat collide into duplicate tiles, and the '4 PRS' chip contradicts the 3 visible tiles — misattributed numbers on Home's most-scanned block.

**Fix:** Curated short-name map for program lifts (ROMANIAN DL, FRONT SQUAT, FLOOR PRESS, WTD PULL-UP) plus a generic fallback: keep the last TWO words when the last word is an ambiguous noun (Squat/Press/Deadlift/Row/Curl/Raise) so custom exercises don't regress. Make the #pr-count chip a 44px button opening openPRLog, matching the Add tile.

 Files: `src/main.js:5102` · `src/main.js:5116-5121` · `index.html:98`

### f17 · Primary exits and mid-set controls measure far below the 44px minimum — the only way out of four pages is a 37x13px "← Back"
**Effort S** — Measured live: .page-back 37x13, #rp-swap 144x25 and #rp-guide 179x20 with an 8px gap (sweaty-thumb mid-set controls), #wsum-close 52x33, week chips 26px — violating the repo's own >=44px quality bar while the correct pattern already exists in-file.

**Fix:** Apply the .rp-close pattern (min-width/min-height 44px via padding, offset with negative margin so visuals are unchanged) to .page-back, .rp-swap, .rp-guide, .wsum-close, .export-btn, .build-save, .np-link; bump .rpo-close 40→44. Exception: .wp-chip sits in a wrapped flex row, so grow it with real padding to ~36-44px and raise the row gap to >=8px instead of negative margins. Re-verify with a Playwright boundingBox sweep at 390x844.

 Files: `src/style.css:3272-3284` · `src/style.css:6343-6356` · `src/style.css:5237` · `src/style.css:6835` · `src/style.css:7120`

### f21 · Brand fonts load from Google's CDN — fallback-type flash on every cold open, and the entire identity disappears offline
**Effort S** — No woff2 in the repo and the service worker caches navigations only, so in a gym dead-zone cold start — the exact scenario the local-first architecture exists for — every Bebas numeral and mono label falls back to system fonts; online, every launch flashes the classic web-page tell.

**Fix:** Self-host subset woff2 (Bebas Neue latin; Space Mono 400/700 — OFL/Apache, ~50KB) in public/fonts/, @font-face with font-display:swap in style.css, preload the Bebas file, delete the Google Fonts links and preconnects. No vite.config.js change — the existing woff2 glob precaches them. Verify with DevTools offline + cleared HTTP cache.

 Files: `index.html:38-40` · `src/style.css` · `vite.config.js:18-43`

### f22 · The feedback FAB parks on top of the right-aligned hero numerals — chrome over data on the primary screen
**Effort S** — The fixed 44px bubble occupies the same right margin the card numerals align to, so it overlaps the 'KG VOLUME' unit, the section area at 375px, and the account-nudge text at every scroll position — violating the app's own 'numbers are the most-read element' rule; Whoop/NTC never park chrome on data.

**Fix:** Remove the global FAB and add a 'Send feedback' row to the Profile sheet's ABOUT group (beside Privacy/Terms), reusing the existing #feedback-sheet overlay so the Formspree flow is unchanged. Delete the .feedback-float rules and the !important patch. Feedback is never a mid-set action, so nothing in the core loop is lost.

 Files: `src/style.css:4270` · `src/style.css:4770` · `index.html:809`

### f26 · Recent-session cards break with completely normal data — wrapped titles outdent under the type chip and crowd the hero numeral
**Effort S** — The STR chip is an inline span inside .rc-name, so a wrapping title's second line returns flush under the chip (reproduced live at 375px with the stock 'Density 40 · B — Legs + / Delts' name) — the flagship card on the primary screen looks broken for any program user.

**Fix:** Wrap the title in <span class="rc-name-text"> beside the chip in BOTH templates (.rc-name at main.js:762 and .hi-name at main.js:5212). CSS: .rc-name,.hi-name{display:flex;align-items:baseline;gap:6px} .rc-type{flex-shrink:0;margin-right:0} .rc-name-text{min-width:0} — wrapped lines then align to the title column and the existing card gap keeps clearance from the numeral.

 Files: `src/main.js:762` · `src/main.js:5212` · `src/style.css`

### f23 · CrossFit list gives display type to trivia ("2 MOVES") while printing duplicated meta — literally "FOR TIME · FOR TIME"
**Effort S** — main.js:956 concatenates badge · description, producing 'FOR TIME · 21-15-9 FOR TIME' (Fran) and 'FOR TIME · FOR TIME' (Jackie), while the WOD's identity sits at 8px under a 28px movement-count numeral — rendered duplicate strings across a whole content surface are an instant prototype tell.

**Fix:** Must-do (S): render only w.description (or strip a leading duplicated badge token) and bump .lwc-meta toward 10-11px since it carries the WOD's identity. Optional follow-up (M): replace the movement-count numeral with the user's best/last logged result for that WOD (dash if none) — but only after verifying workoutHistory stores CF results retrievably by WOD name; if not, keep the count.

 Files: `src/main.js:956-960` · `src/data.js:553` · `src/data.js:573` · `src/data.js:591` · `src/style.css:3410`

### f6 · Rotating to landscape collapses the app into its own desktop marketing mock — fake Safari bar, bezel, and watermark mid-workout
**Effort S** — The demo shell is gated on width alone (min-width:600px) and iPhone landscape is 667-932px wide, so mid-set rotation renders a fake browser bar and 'KILOS TRAINING' watermark with the real app squeezed to a 390x310px window — nothing says 'not a real app' louder than the app displaying a mockup of itself.

**Fix:** Change both desktop-shell gates from @media (min-width:600px) to @media (min-width:600px) and (min-height:501px) so phone landscape keeps the normal full-bleed layout. Also audit the end-of-file desktop overrides flagged in the comment at :274-276 (#nav, .np-overlay, .bw-overlay, .fb-overlay, .feedback-float) — same width-only query, same min-height condition, or landscape half-applies the desktop cascade.

 Files: `src/style.css:235` · `src/style.css:375` · `src/style.css:274-276`

### f10 · Persistence failures are silent and dirty — a full store destroys the finished workout behind "SESSION COMPLETE", and a schema-drifted active-state bricks boot forever
**Effort M** — The storage helper swallows every exception: at quota, Finish celebrates while workoutHistory gains nothing and the active state is cleared (the workout exists nowhere); a valid-JSON active-state missing exercises[] crashes boot in a permanent Reload loop, and the autoUpdate PWA ships any future shape change to every mid-workout user.

**Fix:** In finishWorkout, write history with a raw try{localStorage.setItem} (not the swallowing helper); on failure keep kilos-active-state, prune non-essential kilos-* keys, retry once, else show a quiet 'Couldn't save to this device — your session is still open' state instead of the summary. In loadActiveState, validate shape (Array.isArray(exercises) for non-CF/cardio) and return false on drift. In the boot catch, quarantine kilos-active-state to a -bak key, auto-reload once via sessionStorage flag; crash screen only on the second consecutive failure, with 'Start fresh — your history is safe' clearing only the active-state key.

 Files: `src/main.js:59-63` · `src/main.js:97-124` · `src/main.js:4771-4823` · `src/main.js:5895-5909` · `vite.config.js:12`

### f12 · A live or paused session is invisible — or lied about — everywhere except one below-the-fold card, and starting fresh silently overwrites it
**Effort M** — With a guided session paused, Train reads 'NO ACTIVE SESSION' and RESUME opens the Custom builder; after a mid-workout refresh the restore machinery works but Home greets you as idle; beginWorkout then clobbers the recovered session without asking — the app's own 'unforgivable' data-loss class.

**Fix:** One resume source of truth spanning classic activeWorkout + saved guided state (REHAB_STATE_KEY): a persistent 'SESSION IN PROGRESS · <name> →' strip on Home; Train's RESUME reads the same source, deep-links into the correct player, and hides entirely when idle. Guard beginWorkout with a lightweight inline two-option sheet ('Resume <name>' / 'Discard & start new') — big tap targets, explicit discard, mirroring the rh-discard pattern — not a native confirm().

 Files: `src/main.js:533-541` · `src/main.js:634-658` · `src/main.js:2470-2483` · `src/main.js:2839-2842` · `src/main.js:3618-3629`

### f7 · Home never answers "what do I do today" — it calls plan days "REST DAY" and greets first-runners with "NEVER TRAINED"
**Effort M** — The rest-day card never consults the plan renderWeekPlan owns, so an untrained day with scheduled REHAB + LIFT C reads 'REST DAY'; first run shows 'REST DAY / MOST RECOVERED / CHEST / NEVER TRAINED' (null history → 999 days) — the retention strategy's first beat, skipped on the app's front door.

**Fix:** Extract the plan-for-today derivation renderWeekPlan already computes into a shared today() resolver consumed by BOTH renderWeekPlan and a new Today card at the top of Home (duplicating the math would recreate the drift). Priority: (1) program work due → 'Today: Rehab + Hinge · ~13 min → START', one tap into the player; (2) off-program → the recovery card, minus the 'NEVER TRAINED' badge; (3) history.length===0 → 'DAY ONE — first session →'; (4) never render 'REST DAY' when the plan has scheduled work.

 Files: `src/main.js:2726-2773` · `src/main.js:2200`

### f13 · MUSCLE STATUS is dead for both flagship states — em-dashes for a 21-day-streak veteran AND fresh installs — and the broken resolver feeds Quick Start and the rest-day suggestion
**Effort M** — Three stacked causes: non-strength history is skipped, 28 of 31 of the app's OWN program.js names have no exact EXERCISES_DB match, and 'Front Squat' resolves to a group not in the displayed list — then the '—' renders in the 8%-alpha token under 8px 'BAC'/'CHE' non-words, and the suggestion layer inherits the lie.

**Fix:** Add a normalization + alias layer used by ALL consumers (muscle status, getMuscleDaysAgo, rest-day card, Quick Start): case/punctuation-insensitive matching with abbreviation expansion (DB→Dumbbell), an explicit alias map for program.js and rehab.js names, Olympic compounds mapped to a dominant displayed group, and non-strength entries with logs included. Unit test: every program/rehab exercise name resolves to a displayed group. Presentation: hollow dot or 'GO' in a readable token (>= var(--grey)), curated labels CHEST/BACK/LEGS/SHLD/BI/TRI/CORE instead of slice(0,3).

 Files: `src/main.js:2687-2696` · `src/main.js:2749-2763` · `src/data.js:538` · `src/workout/program.js` · `src/style.css:3543`

### f8 · First run is an account wall — three blocking modal gates led by password signup, with the free-forever path as the smallest text on screen
**Effort M** — Beta letter → account sheet → equipment modal, each blocking all nav; the skip ('No account →') is the smallest greyest element parsed as signup navigation, and Create Account dead-ends when Supabase is unreachable — backwards for a local-first 'Free Forever' app when Strong/Hevy let you log first.

**Fix:** Collapse to one sheet: name field + 'Start training →' as the sole primary CTA (existing np-local-btn path — a typed name is already kept). Move Create account / Sign in to equally-weighted secondary links; hide Create account when !isConfigured. Fold or defer the beta letter so there is at most one gate before the Train tab, and let the existing <=5-sessions post-workout nudge (already guards isConfigured && !currentUser) carry conversion once there's data worth backing up.

 Files: `src/main.js:5943-5953` · `src/main.js:3501` · `src/main.js:3548` · `src/main.js:4942-4947` · `index.html:734`

### f16 · The Program page is seven jobs on one 2,625px scroll — today's action a full screen below the fold, two contradictory "next" signals
**Effort M** — Measured live: today's HINGE launcher sits at y~919 beneath a Sunday-only check-in block shown on a Tuesday; the D40 queue badge says 'NEXT → C — PUSH' while the week strip marks today REHAB+HINGE; the only above-fold launchers are 26px chips that read as status decoration.

**Fix:** One hero card at top: resume-if-active, else 'TODAY — Rehab done · HINGE DAY → START' derived from the existing chip-action logic (main.js:2239-2266). Collapse the check-in to a one-line row unless isSunday/due (already computed at 2317-18). Move SOUND CHECK into the player or profile sheet; put THE MOVEMENTS behind a single 'Movement library →' row. Keep wp-chips as status only (non-interactive or >=44px) once the hero owns launching, and return post-summary CLOSE here so the freshly-ticked strip closes the reward loop.

 Files: `src/main.js:2239-2266` · `src/main.js:2268-2283` · `src/main.js:2317-2318`

### f27 · The flagship Program speaks the founder's private vocabulary — "DENSITY 40", "ENGINE", "QUEUE" — and ships his personal back-rehab protocol unframed to everyone
**Effort M** — No term is ever introduced, a mandatory REHAB chip sits on all 7 days for a back problem the user may not have, and program.js's own header calls it 'Gabe's lifting program' — the clearest 'personal project, not product' smell in the copy, squatting on the container coach programs will need.

**Fix:** Frame at the door and page intro, one sentence each: door 'Back-Safe Strength — rehab warm-up + a 40-min lifting rotation'; intro adds 'Built around a bad back — skip the rehab block if yours is fine.' Define terms inline at first use ('Density 40 — the 40-min lifting rotation (A → B → C)'; a chip legend under the week grid: 'HINGE conditioning-safe lift · ENGINE conditioning'). Keep 'Program' as the container name holding one named program card, so branded coach programs slot in later without a rename.

 Files: `index.html:134` · `index.html:537` · `index.html:551` · `src/workout/program.js:292`

### f24 · The entire label layer sits below the legibility floor — 23 rules at 8px, 97 at 9px, in an app read with sweat in your eyes
**Effort M** — Space Mono uppercase at 8-9px carries real mid-set data (dates, set counts, 'KG VOLUME' units, a plate-loading warning) — below the ~11pt iOS floor while Whoop/NTC eyebrows run 11-12px; the inverse of 'numbers big and legible in bright gym light'.

**Fix:** Add tokens --type-micro:10px and --type-caption:11px in :root; sweep 8px → micro, 9px → caption, tightening letter-spacing 0.08em → 0.06em. NOT a blind find-and-replace: after the sweep, visually verify tight-fit surfaces at 375px — the share card (html2canvas fixed dimensions), plate calculator rows, bottom nav — and let those few stay at micro if caption overflows. ~1 day including the visual pass; lifts every screen.

 Files: `src/style.css:598` · `src/style.css:1044` · `src/style.css:1061` · `src/style.css:2836` · `src/style.css:3277` · `src/style.css:5431`

### f15 · lbs mode only converts the inputs — every number the user READS stays hardcoded kg, contradicting what they just typed
**Effort M** — Verified live with kilos-unit='lbs': a user logs 220 and is told '100 kg' on the PR board, recent cards, summary hero, e1RM, history, and weekly volume — a half-implemented setting is a hard 'not shipped' tell (mitigated only by kg being the PH default).

**Fix:** Route every read surface through toDisplayWeight() + weightUnit() (storage stays canonical kg) and re-render Home on unit toggle — including the surfaces the original finding missed: share text (main.js:338), progress delta (2371), 'Last:' exercise hint (3095), and the share card, so the inconsistency doesn't just relocate.

 Files: `src/main.js:338` · `src/main.js:741-766` · `src/main.js:2371` · `src/main.js:2799` · `src/main.js:3095` · `src/main.js:4876-4930` · `src/main.js:5121` · `src/main.js:5182`

### f18 · The coach's cue is machine-clamped exactly at the actionable branch, and the lift step shows a bare number with no last/target context
**Effort M** — The 3-line clamp cuts 'Under 4×5 clean? Run heavy pulldowns…' mid-instruction with a bare ellipsis and no expand, while the flagship guided step gives LESS glance context than the legacy loop, which already renders 'Target today: X kg × Y, +2.5 from last session'.

**Fix:** Keep the fixed-slot layout (it deliberately prevents mid-set layout shift — don't let the box grow). Split content: form cue on-screen written to a 3-line budget; logging/progression notes move to the step's overview sheet or a one-time pre-set slot so coach-authored copy is never machine-truncated. Add one Space Mono line under the stepper — 'LAST 62.5×4 · TARGET 62.5×5' — from kilos-guided-weights + history, mirroring legacy renderSetLog. Any remaining clamp gets a deliberate 44px 'MORE', not a bare ellipsis.

 Files: `src/main.js:1814-1817` · `src/main.js:4178-4179` · `src/main.js:1006` · `src/workout/program.js:312` · `src/style.css:6542-6553`

### f25 · Two illustration languages inside one player — commissioned color figures for rehab vs a grayscale vector mannequin for lifts
**Effort L** — The program interleaves rehab and lifts every single day, so the guided player's hero panel — hit dozens of times per session — alternates art directions daily; NTC would never ship a program that switches illustration style mid-week.

**Fix:** Pick one language. Cheapest consistent path: batch-desaturate/flatten public/rehab/*.webp toward the near-black monochrome palette (kill the peach skin and bright mat, keep one accent) — zero code change via the existing load-order override. Longer term: commission the ~12 missing lift figures in the chosen style so every exercise gets the same treatment on the same panel.

 Files: `public/rehab/` · `src/main.js:1424-1494`

## P2 — later
### f28 · Number and unit formatting is not invariant — '75 KG × 8' beside '≈ 95kg est. 1RM', '1800' vs '1,800', 'e1RM' vs 'est. 1RM'
**Effort S** — The same workout's volume renders two ways and the same metric carries two names inside one summary card — on the reward screen, the strategy's dopamine moment, where the numbers are the brand.

**Fix:** Single helper fmtNum = n => Number(n).toLocaleString() (no locale arg — output identical, avoids implying locale-dependent rendering) for every rendered weight/volume including the home recent-card bigNum and weekly volume. One metric name — 'EST. 1RM' in card labels, drop the redundant '≈'. Unit casing convention: 'KG' beside numerals/in mono labels, 'kg' only mid-sentence.

 Files: `src/main.js:741` · `src/main.js:766` · `src/main.js:2799` · `src/main.js:4197` · `src/main.js:4911` · `src/main.js:4930`

### f19 · After a swap the player ignores history for the prefill (10kg vs the logged 47.5) and keeps the old slot's coaching note — 15 stepper taps, no typing, no hold-to-repeat
**Effort M** — guidedWeightFor() falls back to a hardcoded 10 without consulting history, and the slot's cueNote still coaches the pre-swap movement; downgraded to P2 because saveGuidedWeight() remembers after the first logged set — a one-time onboarding wart per swapped exercise, not a per-set trust breaker.

**Fix:** (1) guidedWeightFor() falls back to the last logged weight for that exercise from workout history before the hardcoded 10. (2) Suppress or replace the slot's cueNote when step.exId !== step.baseEx (per-alt notes on altSpecs, or just drop the note — the exercise's own cue already swaps correctly). (3) Hold-to-repeat on the +/- steppers; tap-to-type on rp-w-val is secondary for the sweaty one-handed context. The '8–10' reps issue is f3's fix, not this one.

 Files: `src/main.js:1020` · `src/main.js:2631-2635` · `index.html:583`
