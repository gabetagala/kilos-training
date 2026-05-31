# KILOS — Nutrition Data & Macro Methodology (M1 research)

Decision-ready research for the Nutrition pillar: which free/open food data we
can legally build on, the licensing obligations, and the evidence-based macro
calculator (with the registered-dietitian safe-rate guardrail). Durable asset —
pull from it when M1 nutrition is built.

> Source: multi-agent research pass (2026-05). The bottom-line recommendation is
> the operative part; the source tables are the evidence. **Re-verify licenses
> before shipping** — terms change.

---

## TL;DR — the path

1. **No single free DB covers Filipino food.** Build a **3-layer open stack.**
2. **The authoritative PH source (DOST-FNRI PhilFCT) is legally off-limits** —
   All-Rights-Reserved, web-view-only, released only under "no commercial /
   no public distribution." **Never scrape or ingest it.** An MOU is a slow,
   optional upside track — *not* a dependency.
3. **The stack:**
   - **Generic whole foods** → **USDA FoodData Central** (CC0 / public domain — zero obligations). Rice, chicken, egg, oils, fish, veg.
   - **Barcode / packaged** → **Open Food Facts** (ODbL — free + commercial OK, with attribution + DB-level share-alike). Query **local-first** from a filtered PH+global bulk dump.
   - **Filipino staples / home dishes** → a **small in-house curated table** (~100–300 items) composed from *open generic values* (USDA, optionally CIQUAL) at PH portions, as recipes (adobo = pork + soy + vinegar + oil). Labeled estimates. *Not* FNRI's numbers.
4. **Fill the sari-sari gap by crowdsourcing, not buying:** on a barcode miss, snap the nutrition panel → **client-side OCR** (instant, local, never blocks logging) → opt-in background submit to **Open Food Facts / Robotoff** so coverage compounds.
5. **The macro calculator's safe-rate guardrail is a brand differentiator** — and your sister's "0.5–1 kg/week" is exactly the evidence-based cap.

---

## Food databases — verdicts

| Source | Role | License | Free for us? | Verdict |
|---|---|---|---|---|
| **USDA FoodData Central** | generic whole-food backbone | **CC0 / public domain** | Yes — zero obligations | ✅ **USE** |
| **Open Food Facts** | barcode / packaged products | **ODbL** (attrib + share-alike on derived DBs) | Yes, incl. commercial | ✅ **USE** |
| OFF **Robotoff** + OCR | fill PH coverage (contribute back) | open-source → ODbL data | Yes | ✅ **USE** |
| ANSES **CIQUAL** (France) | supplementary generic cross-check | **Etalab** (attrib-only, commercial-OK) | Yes | 🟡 optional |
| **DOST-FNRI PhilFCT** | authoritative PH foods | **All-Rights-Reserved, no-commercial** | **No — license breach to ingest** | ⛔ **AVOID** (MOU = slow upside only) |
| ASEAN AFCD (Mahidol) | regional PH subset | unclear, PDF-only, dated | No | ⛔ avoid |
| FAO/INFOODS | standards / methodology | **CC BY-NC-SA** (NonCommercial) | No for a business | ⛔ avoid as data |
| Frida (Denmark) | generic | commercial terms unclear | risky | ⛔ avoid |
| FatSecret / Edamam / Nutritionix / Chomp | commercial barcode APIs | proprietary, uncacheable | tiny/again-paid tiers, no PH edge | ⛔ avoid |

**Why not just use FNRI?** It's the gold standard for Filipino foods (~1,500 items: rice as eaten, fish, adobo, kakanin) — but it's **All-Rights-Reserved, not downloadable, no API**, and the raw dataset is released only on signed condition of *"no commercial or public distribution."* Embedding it in a free app (or future paid coach tier) breaks those terms. The legitimate route is a negotiated DOST-FNRI data-use MOU — slow, and "no commercial" is their default stance. **Treat as a partnership track, never an engineering integration.**

## Licensing obligations (meet these by design)
- **USDA FDC (CC0):** none required. Best practice: still credit "U.S. Department of Agriculture, Agricultural Research Service, FoodData Central" on a Data Sources screen. Show factual nutrition only for branded items (don't imply endorsement).
- **Open Food Facts (ODbL):** (1) **attribute** "Open Food Facts contributors" with a link wherever OFF data shows; (2) **share-alike** — if you ever publicly *redistribute a derived database* (ship a bundled OFF table for download, or expose a public food-DB API), it must be ODbL. Share-alike attaches to the **database**, *not* your app code or users' private logs — internal query/cache + display is fine. (3) Technical: custom User-Agent (`KilosTraining/1.0 (gabe@spiralytics.com)`), respect read limits (**15/min barcode, 10/min search**), "1 call = 1 real scan", bulk-dump for bootstrapping. (4) **Don't reuse OFF product images** (separately CC-BY-SA) — use facts only.
- **Keep stores separate** for license hygiene: OFF cache ≠ USDA/CIQUAL generic table ≠ user logs. Prevents ODbL share-alike ever "leaking" into a proprietary combined DB.

## Risks to watch
- **Legal:** FNRI must never be scraped/ingested. Build staples in-house from open data instead.
- **Data quality:** in-house Filipino staples are *estimated* from generic values, not lab-measured — label as estimates, refine over time.
- **Coverage:** OFF has only ~8,176 PH products; many sari-sari misses at launch → OCR + Robotoff loop, set expectations that scanning improves.
- **ODbL share-alike trap:** don't fuse OFF into a proprietary combined DB you redistribute.

---

## Macro calculator — the spec (evidence-backed)

**BMR — Mifflin-St Jeor** (Academy of Nutrition & Dietetics review found it within 10% of measured RMR in ~82% of people, beating Harris-Benedict):
- Men: `(10·kg) + (6.25·cm) − (5·age) + 5`
- Women: `(10·kg) + (6.25·cm) − (5·age) − 161`
- Optional "advanced (I know my body-fat %)" path: **Katch-McArdle** `370 + 21.6·LBM` (better for lean lifters).

**TDEE** = BMR × activity: sedentary 1.2 · light 1.375 · moderate 1.55 · very 1.725 · extra 1.9. *Default conservative (1.2–1.375)* — most people overestimate activity; the user's logged weight trend over 2–3 weeks is the real calibration.

**Safe rate (your sister's 0.5–1 kg/week — validated by Academy of Nutrition & Dietetics, ACSM, CDC):**
- Express as **0.5–1% of bodyweight/week** so it scales with body size (ISSN: 0.7%/wk preserves more muscle than 1.4%/wk).
- **Deficit math:** 1 kg fat ≈ **7,700 kcal** → daily deficit = `rate_kg/week × 7700 / 7`. So **0.5 kg/wk ≈ −550 kcal/day**, **1.0 kg/wk ≈ −1,100 kcal/day** (matches ACSM's 500–1,000 kcal/day). It *overestimates* real loss (metabolic adaptation) — present as a starting estimate, recalibrate from logged weight.

**Floors (critical for smaller-bodied PH users):** never below ~**1,200 kcal ♀ / 1,500 kcal ♂**, and warn below the user's own BMR. `target = max(TDEE − deficit, sex floor, BMR)`. If the safe deficit would breach a floor, **cap the deficit (slower, longer) — never starve.** Below-floor/below-BMR → warning + "consult a professional."

**Macros (protein-forward for lifters in a deficit):** protein **1.6–2.2 g/kg** bodyweight (ISSN; up to 2.3–3.1 g/kg FFM if body-fat known) · fat **20–35%** of calories (floor ~0.6–0.8 g/kg for hormones) · **carbs = the remainder** (suits rice-heavy Filipino diets — carbs are the flexible bucket).

### The differentiator (how Kilos "spins it up")
Unlike crash-deficit apps, Kilos is the **honest, RND-backed** calculator:
1. **Default to the safe rate** pre-selected (not the aggressive one).
2. **Cap unsafe choices** and show an honest timeline ("at a safe pace you'll reach X by [date]") instead of silently obeying.
3. **Floors that cap the deficit, never starve** — important for smaller PH bodies.
4. **Recalibrate from the user's logged weight** — turns our existing local-first weight log into the feedback loop.
5. **Plain-language citations** (Academy of Nutrition & Dietetics, ACSM, ISSN) so the guardrail reads as trustworthy, not arbitrary.
6. **All math is local** — never blocks the logging loop, stays free-forever.

> **Your sister (RND) is an asset:** "macros reviewed by a registered
> nutritionist-dietitian," safe-by-default. Credibility MyFitnessPal can't buy —
> consider crediting her as an advisor.
