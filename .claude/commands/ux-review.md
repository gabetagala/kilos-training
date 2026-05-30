---
description: UX review of recent changes through Kilos' specific lens — mobile-first, mid-set gym use, free-forever consumer lifter.
---

# /ux-review — UX review of recent changes

Review the UI changes on the current branch (`git diff main...HEAD`) against
Kilos' UX principles. Concrete findings tied to specific files/lines, not
generic advice.

## Context to apply

Kilos is a **free, no-BS training tracker** ("Train Heavy. Free Forever.").
The user is a **solo lifter at the gym**, logging sets **between rounds**,
one-handed, sweaty, phone in one hand and a barbell nearby. They open the app
dozens of times per session for a few seconds each. Mobile-first, always.
Dark theme is primary (gym lighting varies, screens are bright).

## What to check

1. **Mobile-first (375px width)**: Does the change render at iPhone Safari
   width? Anything that overflows, requires hover, or assumes desktop layout?
2. **Touch targets ≥44px**: Buttons, steppers, weight/rep inputs, tap-able
   rows. Spacing ≥8px between adjacent targets — sweaty fat fingers mis-tap.
3. **Logging speed**: Logging a set is the core loop and happens mid-workout.
   Is it the fewest taps possible? Are number inputs easy to bump (steppers,
   sensible defaults pulled from last session)? No needless confirmations.
4. **Local-first / instant**: Writes should hit localStorage immediately and
   feel instant — never block the UI on a network round-trip. Supabase sync
   (`pushData`/`pullAndMerge`) happens in the background.
5. **One-handed reach**: Primary actions (log set, next exercise, rest timer)
   in the lower 2/3 of the screen (thumb zone)?
6. **Contrast**: Readable in bright gym light? Nothing depending on subtle
   gray-on-gray. Numbers (the most-read thing) are big and high-contrast?
7. **States covered**: Loading (skeleton, not spinner), empty (first-ever
   workout, no history yet), and a useful error state (not "An error occurred").
8. **Resume / crash-safety**: Mid-workout state survives a refresh or a
   backgrounded tab (`kilos-active-state`). A dropped session mid-WOD is data
   loss the user will rage about.
9. **Offline-tolerant**: Gym wifi/data is spotty. Does the change still work
   with no connection, syncing later?
10. **Visual language**: Matches the existing design system — consistent type
    scale, spacing, dark surfaces, ALL-CAPS labels. No one-off inline styling
    that reinvents an existing pattern.

## Report format

Group findings by severity. Cite `file:line` for each:

```
❌ Breaks the principles (must fix)
   • src/main.js:420 — log-set button is 34px tall, below 44px touch target
   • src/main.js:880 — write blocks on the network; should hit localStorage first

⚠️ Worth reconsidering
   • src/main.js:1200 — error message is generic; what's the user supposed to do?

💡 Nice-to-have
   • Default the weight input to last session's top set
```

Skip categories that don't apply. If the diff is mostly non-UI (data, sync,
utils), say so and exit early — no need to invent findings.

## Tone

Concrete, kind, fast. Cite specific lines. Don't restate the principles
unless the finding is non-obvious.
