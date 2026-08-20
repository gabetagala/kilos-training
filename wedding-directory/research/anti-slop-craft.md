# Design Direction: Human-Crafted, Not AI-Made

> Research agent output, 2026-08-17. Sources at bottom.

## Part 1 — The AVOID list (the tells)

2025–26 design commentary has converged on a named fingerprint for "AI slop." Each item below reads as slop because it's the *statistical average* of training data — an unchosen default, not a decision:

1. **Indigo/purple gradient hero.** Traces directly to Tailwind's `bg-indigo-500` demo default (Adam Wathan has publicly apologized). The single loudest tell.
2. **Inter (or Poppins) for everything.** Inter isn't bad — *unchosen* Inter signals no typographic decision was made.
3. **Template anatomy:** centered hero → "Plan smarter. Marry better." headline → three rounded feature cards with thin-line Lucide/Heroicons → pricing table → FAQ accordion. Learned from ten thousand SaaS tutorials.
4. **Card soup.** Gray 1px-bordered, soft-shadowed, `rounded-2xl` cards on everything; the colored 3–4px left-border strip is cited as the single most reliable tell.
5. **Emoji-bullet feature grids and ✨ sparkle badges** ("✨ AI-powered matching"). Decoration substituting for content.
6. **Glassmorphism/frosted panels + uninvited dark mode.** Default vibe-code aesthetics, hostile to photo-heavy content.
7. **Weightless copy:** "seamless," "effortless," "elevate your special day" — confident phrasing with zero specifics.
8. **Fake trust walls:** stock-avatar testimonials, invented "10,000+ happy couples" counters, Midjourney-style hero illustrations. Couples researching a ₱300k decision will smell it — and AI-slop pages convert dramatically worse.
9. **Blush-pink script-font wedding clichés** — the *industry's* version of slop; 2026 wedding palettes are explicitly moving off millennial blush toward richer, quieter tones.

## Part 2 — What signals craft

**Typography (all Google Fonts, free).** The 2026 counter-trend is expressive editorial serifs over neutral sans defaults. Pick one pairing; set `font-variant-numeric: tabular-nums` on all prices.

- **A (warmest): Fraunces** 500–600, optical size auto, for headlines and display prices + **Public Sans** 400/600 for UI and data. Fraunces' old-style warmth is the current premium-editorial choice; Public Sans is a workhorse nobody associates with AI output.
- **B (quieter): Newsreader** 500 (opsz 36+) headings, italic for editor's notes + **Schibsted Grotesk** 400/500 for UI.
- **C (serif-forward): Source Serif 4** for body/longform + **Archivo** 500 SemiExpanded for labels, nav, and numerals.

**Color: one accent, warm paper, no gradients.** Avoid both blush and SaaS-purple:

- **Piña & palm:** ivory `#F7F2E9` ground, ink `#1F1D1A`, deep palm green `#3E5C42` accent. Garden-venue, muted-olive 2026 direction; quietly tropical.
- **Tablea:** cream `#FBF6EE`, cocoa ink `#2B211B`, burnt clay `#A64B2A` accent. Warm-cocoa/terracotta; Filipino warmth without parol-and-jeepney costume.
- **South Sea:** paper `#FCFAF6`, charcoal `#23272A`, lagoon teal `#0F5257` accent, brass `#B08D57` reserved for hairline rules only. Coastal-premium (Palawan energy) without beach kitsch.

Accent appears only on links, the verified stamp, and key numerals. Everything else is ink on paper.

**Editorial layout devices.** Hairline rules (`1px #E7E0D2`) instead of card shadows; asymmetric grids (venue name left, price column hard-right-aligned); sharp or 2–4px corners; eyebrow labels in letterspaced small caps ("TAGAYTAY · GARDEN · 150 PAX"); prices as the display element — ₱ symbol small and muted, the numeral huge in the serif. Real venue photography full-bleed; zero illustration.

**Data density, warmly.** Fathom Analytics puts two big numbers front-and-center with softened type and generous spacing — polish through restraint, one accent. Linear's changelog proves a long list stays elegant as dated typographic entries with rules, not cards. Data-journalism style (The Pudding): put numbers *inside sentences* ("Rates here start at ₱185,000 for 100 pax — below the Tagaytay median of ₱230,000") and annotate them. Comparison tables beat card grids for a numbers product: rows, tabular numerals, muted units.

**Honest-content details as visual features.** Real names everywhere ("Fernwood Gardens, Quezon City," never placeholder-shaped copy). A **"Last verified: Aug 2026"** stamp designed as a badge in the accent color — this is the trust feature competitors can't fake. Sourced footnotes ("rate from the venue's 2026 kit, sent 07 Aug"). True counts ("87 venues, 41 verified this quarter" — small numbers read *more* honest). No testimonials; short signed editor's notes instead. A colophon/byline: a named human is the ultimate anti-AI signal.

## Part 3 — Reference sites

1. **usefathom.com** — numbers as the hero; friendly softened type, generous spacing, single accent. Steal the "two big honest numbers" dashboard energy.
2. **linear.app/changelog** — dated typographic entries, hairlines, no cards. Steal for listings and "recently verified" feeds.
3. **mrandmrssmith.com** — twice Condé Nast's best travel site; a *venue directory* where anonymous in-person verification IS the brand. Steal the curation voice and honest review structure.
4. **gridmagazine.ph** — award-winning Filipino travel editorial. Steal how "premium and Filipino" looks: photography and restraint, not motifs.
5. **designhotels.com** — photography-led directory on a strict grid with tight curation copy. Steal listing-page rhythm.
6. **pudding.cool** — numbers woven into warm annotated prose. Steal for price-comparison storytelling.
7. **typewolf.com** — a dense directory kept elegant with pure typography, hairlines, and a pale tinted ground. Steal for index pages.

Sources: [925 Studios — AI slop tells](https://www.925studios.co/blog/ai-slop-design-tells) · [925 Studios — slop guide](https://www.925studios.co/blog/ai-slop-web-design-guide) · [Indigo-500 essay](https://dev.to/alanwest/why-every-ai-built-website-looks-the-same-blame-tailwinds-indigo-500-3h2p) · [vibecodekit](https://vibecodekit.dev/ai-slop-design) · [Creative Bloq 2026 trends](https://www.creativebloq.com/design/graphic-design/texture-warmth-and-tactile-rebellion-the-big-graphic-design-trends-for-2026) · [Fireart 2026](https://fireart.studio/blog/the-best-web-design-trends/) · [Typewolf Google Fonts](https://www.typewolf.com/google-fonts) · [Mantlr pairings](https://mantlr.com/blog/google-fonts-pairing-cheat-sheet) · [Fathom branding](https://usefathom.com/blog/branding) · [Paperlust 2026 palettes](https://paperlust.co/blog/2026-wedding-color-palettes/) · [Mr & Mrs Smith curation](https://www.forbes.com/sites/petertaylor/2017/01/23/meet-mr-and-mrs-smith-the-coupl-curating-the-worlds-best-hotel-collection-youve-never-heard-of/) · [GRID Magazine](https://www.gridmagazine.ph/)
