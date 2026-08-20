# UX Pattern Library — PH Wedding-Venue Directory

> Research agent output, 2026-08-17. Sources at bottom.

## 1. List + Map on Mobile

**Airbnb** (the reference): list is the default; a floating **"Map" pill at bottom-center** toggles to a full-screen map with price-labeled oval pins; tapping a pin slides a **horizontal card carousel over the map's bottom edge** — you never leave the map to preview. Map re-search is explicit ("Search as I move" toggle / "Search this area" button). **Zillow** is map-first (location dominates home buying) with a tapped-pin bottom card and a drag-up sheet to list; **Rightmove** stays list-first with map as secondary plus its "Draw a search" polygon. What breaks on 375px: split list/map (both halves unusable), auto-refetch on every pan (jank + data burn), and losing list scroll position on toggle-back.
**DO:** list default → floating map pill → price pins → pin-tap card carousel (Airbnb).
**AVOID:** split-screen on phones; refetching on pan without an explicit "search this area."

## 2. Venue Card Anatomy

**Airbnb's** card is borderless — the photo carries it: photo carousel with heart-save top-right → location/name → meta line → rating inline → **price bold on the last line**. **Bridebook** puts guide price, guest capacity, and accommodation **on the card itself** — their own research says **59% of couples won't contact a venue whose pricing isn't online**, which is your entire thesis.
**DO (order):** photo → venue name → city/province → capacity ("up to 200 pax") → **"from ₱150k"** bold as the anchor line, with a tiny "verified Nov 2024" beneath. Price is the differentiator; give it the strongest type on the card.
**AVOID:** **Booking.com's** card clutter — strikethrough fake discounts, six stacked badges, "In high demand!" noise.

## 3. Filters, One-Handed

**Airbnb:** horizontal chip bar of top filters (budget, location, capacity for you); "Filters" opens a **full-screen sheet** whose apply button shows a **live count ("Show 128 venues")** pinned in the thumb zone. **Booking.com's** one redeemable pattern: **per-option result counts** ("Garden (34)"), which prevents dead-end filtering. Active filters render as individually dismissible chips.
**DO:** bottom-sheet filters, ≥44px rows, live-count apply button at bottom, removable chips.
**AVOID:** instant-apply that re-renders the list under the user's thumb per checkbox; nested filter pages.

## 4. Venue Detail Page Anatomy

**Airbnb:** photos → title/rating/location → key facts → description → amenities → map → reviews, with a **sticky bottom bar: price left, CTA right** ("Reserve"). **The Knot** keeps a persistent "Request Quote" CTA but often hides actual numbers; **Zola** shows "Starting at $3,000" plainly in a pricing section.
**DO:** photos → name + location + capacity strip → **price block above the fold** (starting price, what it includes, source + verified date) → package/rate table → map → FAQs → similar venues. Sticky bottom bar: "from ₱150k" left, **"Enquire"** right.
**AVOID:** The Knot/WeddingWire's price-behind-a-form pattern — that's exactly what you're positioned against; and Booking.com's countdown timers anywhere near the CTA (Hungary fined them ~€7M for these).

## 5. Displaying Possibly-Stale Prices

**Glassdoor:** ranges not points, "based on N reports," and **confidence badges** (Very High/High/Low) computed from report **count + recency** — a directly liftable model. **GasBuddy:** every crowdsourced price carries a **"reported 3h ago" timestamp + attribution**; users treat 8–36h as stale, and the honest timestamp is what preserves trust rather than destroying it.
**DO:** `From ₱150,000 · verified Nov 2024 · source: venue's rate card` — a neutral recency badge (e.g., green ≤6 months, gray "may have changed" beyond), a range when sources conflict, and a one-tap **"Is this price still right? Yes / It changed"** prompt (Google Maps' "Suggest an edit" pattern) feeding your crowdsourcing loop.
**AVOID:** hiding the date (discovered staleness reads as deception) or alarm-red "OUTDATED" styling; state age plainly, never dramatize it.

## 6. Claim-This-Listing

**Glassdoor:** unclaimed pages show "Claim your Free Employer Profile"; verification = **work-email domain match + role attestation checkbox + human Trust & Safety review (~48h)**. **Google Business Profile:** a deliberately quiet **"Own this business?"** text link on the listing; Google picks the verification method (video walkthrough of premises is now the default, else postcard/phone). **TripAdvisor** routes claims through its Management Center with business email/phone checks.
**DO:** quiet text link under the venue name or at page bottom — "Own this venue? Claim this listing" — then verify via email at the venue's own domain or a callback to its published number; award a **"Managed by owner"** badge and let claimed owners correct the price (your data flywheel).
**AVOID:** a loud claim button styled like the couple's CTA; auto-approving claims without any out-of-band check (fake-owner price inflation kills the product).

## 7. Empty & Loading States

**DO:** skeleton cards that mirror the real card layout (Airbnb-style shimmer) so nothing reflows; for zero results, do what **Airbnb** does — name the cause and offer recovery ("No venues match · Remove filters"), ideally quantified: "0 venues under ₱100k in Tagaytay — 14 if you raise budget to ₱150k." Per-option filter counts (§3) prevent the wall entirely. Map empty state: "No venues here — zoom out" button.
**AVOID:** spinner-only loads, blank screens, or a bare "No results found." with no path back.

**Sources:** [Airbnb maps ranking](https://airbnb.tech/ai-ml/improving-search-ranking-for-maps/) · [Booking.com dark patterns & fines](https://behavioralinsight.substack.com/p/dark-patterns-on-bookingcom-manipulation) · [Bridebook pricing transparency](https://battleabbeyweddings.com/best-wedding-venue/) · [Glassdoor confidence badges](https://help.glassdoor.com/s/article/What-Salary-Information-is-on-Glassdoor) · [Glassdoor employer claim](https://help.glassdoor.com/s/article/Employer-Accounts-on-Glassdoor?language=en_US) · [Google Business verification](https://support.google.com/business/answer/7107242?hl=en) · [The Knot vendor pricing](https://www.fullybookedvenue.com/the-ultimate-guide-to-the-knot-vendor-pricing/) · [TripAdvisor ranking/recency](https://www.tripadvisor.com/TripAdvisorInsights/popularityranking) · [GasBuddy crowdsourcing](https://aiinstitute.hbs.edu/platform-digit/submission/gasbuddy-a-platform-for-crowdsourced-gas-price-data/) · [NN/g bottom sheets](https://www.nngroup.com/articles/bottom-sheet/) · [Empty states](https://www.pencilandpaper.io/articles/empty-states) · [Filter UX](https://www.pencilandpaper.io/articles/ux-pattern-analysis-enterprise-filtering)
