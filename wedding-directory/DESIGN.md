# Design Brief — PH Wedding Venue Directory

> Synthesized 2026-08-17 from three research passes: `research/ux-patterns.md`,
> `research/anti-slop-craft.md`, `research/ph-market-audit.md`. This is the
> working doc for any UI build pass.

## The stance

**A price tag in a market that whispers.** Every design decision serves one
promise: the number is on the page, honestly dated, with its source. The
product should feel like GRID Magazine editing a rate sheet — Filipino,
premium, factual — never like a SaaS landing page and never like a bridal
brochure.

Formula stolen from GCash/Angkas (what reads "legit" to Filipino consumers):
**restrained modern UI + hard verifiable numbers + warmth in the copy, never
in the chrome.**

## Hard NOs (the anti-slop contract)

No indigo/purple, no gradients anywhere, no glassmorphism, no `rounded-2xl`
card soup, no colored left-border strips, no emoji in UI chrome, no ✨, no
Inter/Poppins, no centered-hero + 3-feature-cards + FAQ template anatomy, no
stock testimonials, no invented counters, no AI-illustration, no blush-pink
script fonts, no countdown timers or urgency banners (Booking.com dark
patterns), no price-behind-a-form (The Knot pattern — it's the enemy), and no
fake vanity metrics. Small true numbers ("41 verified this quarter") beat big
fake ones.

## Type

- **Display + prices: Fraunces** (500–600, optical sizing on). Headlines and
  the big peso numerals.
- **UI + data: Public Sans** (400/600). Labels, body, tables, buttons.
- `font-variant-numeric: tabular-nums` on every price and table.
- Eyebrow labels in letterspaced small caps: `TAGAYTAY · GARDEN · 200 PAX`.
- Fallback pairing if Fraunces feels too warm in practice: Newsreader +
  Schibsted Grotesk.

## Color — "Piña & palm"

| Token | Value | Use |
|---|---|---|
| paper | `#F7F2E9` | page ground (warm ivory, not white) |
| ink | `#1F1D1A` | text |
| palm | `#3E5C42` | THE accent: links, verified stamp, key numerals |
| hairline | `#E7E0D2` | rules, borders (instead of shadows) |

One accent only. Alternates documented in research/anti-slop-craft.md
(Tablea terracotta, South Sea teal) if palm green disappoints in mockup.
Filipino-ness comes from light and texture (capiz translucency, piña weave
at ≤4% opacity, golden-hour photography) — never from motif icons.

## Layout language

Hairline rules, not card shadows. Corners sharp or 2–4px. Asymmetric rows:
venue name left, price hard-right, tabular. The price IS the display element:
small muted ₱, huge serif numeral. Listings as dated typographic entries
(Linear-changelog style), not card grids. Comparison tables over card soup.
Real venue photos full-bleed when we have licensed/owner-provided ones; until
then, typographic covers + map, never AI art.

## Core screens (from ux-patterns.md)

1. **Browse**: list default → floating "Map" pill bottom-center → full-screen
   map with price-labeled pins → pin tap slides a horizontal card carousel.
   Never split-screen on phones. "Search this area" is explicit, no
   refetch-on-pan.
2. **Card**: photo/cover → name → city/province → capacity → **"from ₱150k"
   bold** → tiny "verified Nov 2024". Nothing else.
3. **Filters**: chip bar (budget, location, capacity) + bottom sheet with
   live-count apply button ("Show 128 venues"), per-option counts, ≥44px rows.
4. **Venue page**: cover → name/location/capacity strip → **price block above
   the fold** (from-price, inclusions, source + verified date) → rate table →
   map (free Google embed) → Q&A → similar venues. Sticky bottom bar: price
   left, "Enquire" (Messenger deep-link) right.
5. **Empty/loading**: skeletons that mirror card layout; zero-results states
   quantify recovery ("0 under ₱100k in Tagaytay — 14 if budget ₱150k").

## The trust system (the product's whole moat)

- **Verified stamp** as a designed badge in palm green: `Verified Aug 2026`.
  Recency states: green ≤6mo → gray "may have changed" — never alarm-red.
- Every price carries **source + date**: "venue's 2026 rate card" / "couple's
  quote, Jul 2026". Glassdoor-style range + confidence when sources conflict.
- One-tap crowdsourcing: "Is this price still right? ✓ Yes / It changed."
- **Claim flow**: quiet text link ("Own this venue?"), verification via
  venue-domain email or callback to the published number, human review,
  "Managed by owner" badge. Never auto-approve; never style claim like the
  couple's CTA.
- Colophon with a real named human. No testimonials; signed editor's notes.

## Language rules (from ph-market-audit.md)

- English for data/UI labels (prices, capacity, filters). Tagalog for warmth:
  headlines, empty states, encouragement.
- The "walang PM-PM dito" joke: marketing pages only, NEVER inside listings.
  Listings stay factual. (Bonus: DTI/RA 7394 price-display rule means the
  positioning literally has the regulator's side.)
- FB-native conventions: reviewer names + dates visible, "typically replies
  in X hrs" once claimed, Messenger/Viber deep-link as the contact CTA,
  public Q&A under listings (the "HM po?" ritual, subverted — asked once,
  answered forever).

## Naming (undecided)

Pattern that earns PH affection: two-syllable everyday Tagalog word that
states the job (Angkas, Kumu, Bantay). Vocabulary space: settling/promising
words. Test: survives a Messenger voice note without explanation. Decide
before domain purchase; don't block UI work on it.
