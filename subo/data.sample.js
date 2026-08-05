/**
 * Sample seed data for subo — shape demo, not the finished set.
 *
 * 18 of a target ~35–40 launch foods. Every `serve` string and safety note is
 * authored from the public sources in FEEDING.md / RESEARCH-FEEDING.md —
 * nothing is copied from Solid Starts.
 *
 * Nutrition figures: USDA FoodData Central (CC0), per 100 g.
 *
 * !! DATA INTEGRITY !!
 * Only the foods listed in VERIFIED_NUTRITION below had their figures pulled
 * from the USDA API during research. Every OTHER food's ironMg/vitCMg/fdcId is
 * a placeholder written from memory and MUST be re-pulled before this drives
 * anything real. They are marked `nutritionVerified: false`. Safety text
 * (serve, choking, allergen) is sourced for all foods; it's the numbers that
 * are provisional.
 */

/** Foods whose nutrition figures came from a live USDA FoodData Central query. */
export const VERIFIED_NUTRITION = [
  'atay-manok', 'dilis', 'malunggay', 'monggo', 'itlog', 'bangus',
];

/** The nine common allergens. `null` on a food means not an allergen. */
export const ALLERGENS = [
  'dairy', 'egg', 'fish', 'peanut', 'sesame', 'shellfish', 'soy', 'treenut', 'wheat',
];

/** Weekly rotation target once introduced — the whole point of the app. */
export const ALLERGEN_ROTATION_DAYS = 7;

/** Iron-rich food is a DAILY target (WHO 2023 Rec 4a, strong recommendation). */
export const IRON_TARGET = { perDay: 1, rdaMg: 11 };

/** Evidence-based exposure target before calling a food refused. */
export const EXPOSURE_TARGET = 10;

export const FOODS = [
  // ─── Vegetables: the week 1–2 daily rotation ──────────────────────────────
  {
    id: 'kalabasa',
    nutritionVerified: false, // TODO: re-pull from USDA FoodData Central
    name: 'Squash',
    localName: 'Kalabasa',
    category: 'vegetable',
    ageMonths: 6,
    allergen: null,
    ironRich: false,
    ironMg: 0.8,
    vitCMg: 21,
    fdcId: 168482,
    chokingRisk: 'low',
    serve: {
      6: 'Steam or boil until it mashes with no resistance. Purée smooth, thinning with breast milk, formula or the cooking water.',
      9: 'Cook soft and mash with a fork, leaving visible lumps. Also works as finger-sized batons he can hold.',
      12: 'Soft cubes as finger food, or whatever the family squash dish is — portioned out before any salt.',
    },
    notes: 'Naturally sweet, so it lands easily. Good day-one food.',
    sources: ['nhs-weaning', 'usda-fdc'],
  },
  {
    id: 'kamote',
    nutritionVerified: false, // TODO: re-pull from USDA FoodData Central
    name: 'Sweet potato',
    localName: 'Kamote',
    category: 'vegetable',
    ageMonths: 6,
    allergen: null,
    ironRich: false,
    ironMg: 0.61,
    vitCMg: 2.4,
    chokingRisk: 'low',
    serve: {
      6: 'Boil or steam peeled chunks until very soft, purée, thin to a loose consistency.',
      9: 'Mash coarsely, or cut into finger-length steamed sticks for self-feeding.',
      12: 'Roasted wedges, soft enough to squash between finger and thumb.',
    },
    sources: ['nhs-weaning', 'usda-fdc'],
  },
  {
    id: 'malunggay',
    name: 'Moringa leaves',
    localName: 'Malunggay',
    category: 'vegetable',
    ageMonths: 6,
    allergen: null,
    ironRich: true,
    ironMg: 4.0,
    vitCMg: 51.7,
    fdcId: 168416,
    chokingRisk: 'low',
    serve: {
      6: 'Strip leaves from the stems, boil soft, and blend into lugaw or a vegetable purée — not served alone.',
      9: 'Finely chopped and stirred through mashed food.',
      12: 'Cooked into family dishes (tinola, monggo) and portioned out before salt.',
    },
    notes:
      'Carries its own vitamin C (51.7 mg) alongside non-heme iron, so it enhances its own absorption. Pairs naturally with dilis in lugaw.',
    sources: ['usda-fdc', 'ph-complementary-foods-study'],
  },

  // ─── Iron: the daily engine ───────────────────────────────────────────────
  {
    id: 'atay-manok',
    name: 'Chicken liver',
    localName: 'Atay ng manok',
    category: 'protein',
    ageMonths: 6,
    allergen: null,
    ironRich: true,
    ironMg: 11.6,
    vitCMg: 27.9,
    fdcId: 171061,
    chokingRisk: 'low',
    maxPerWeek: 2,
    maxPerWeekReason:
      'Extremely vitamin-A dense. This is the one food where more is worse — confirm the exact limit with the pediatrician.',
    serve: {
      6: 'Simmer until fully cooked through, then purée 1–2 tsp into lugaw. No pink remaining.',
      9: 'Cooked and finely mashed through porridge or vegetables.',
      12: 'Finely chopped into rice or vegetable dishes.',
    },
    notes:
      'The single highest-leverage food in the whole plan: plain lugaw is 0.45 mg iron, lugaw with chicken liver is 10.20 mg — about 23x. Heme iron also boosts absorption of plant iron eaten alongside it.',
    sources: ['who-2023', 'ph-complementary-foods-study', 'usda-fdc'],
  },
  {
    id: 'dilis',
    name: 'Anchovy',
    localName: 'Dilis',
    category: 'protein',
    ageMonths: 6,
    allergen: 'fish',
    ironRich: true,
    ironMg: 3.25,
    vitCMg: 0,
    fdcId: 174182,
    chokingRisk: 'moderate',
    chokingNote: 'Bones. Debone carefully and mash fine; check twice.',
    serve: {
      6: 'Fresh, deboned, cooked and mashed completely smooth into lugaw. Use fresh — not the dried salted kind.',
      9: 'Deboned and flaked finely through porridge or rice.',
      12: 'Flaked into family dishes. Still no dried salted dilis — the salt load is far too high.',
    },
    notes:
      'Roughly 10x the iron of bangus, plus serious calcium (147 mg), cheap, and on the FDA low-mercury Best Choices list. Doubles as the fish allergen introduction.',
    sources: ['fda-fish-advice', 'usda-fdc'],
  },
  {
    id: 'bangus',
    name: 'Milkfish',
    localName: 'Bangus',
    category: 'protein',
    ageMonths: 6,
    allergen: 'fish',
    ironRich: false,
    ironMg: 0.32,
    vitCMg: 0,
    fdcId: 173675,
    chokingRisk: 'high',
    chokingNote: 'Notoriously bony. Debone meticulously, flake, and check by hand before serving.',
    serve: {
      6: 'Steamed, deboned with great care, flaked and mashed into lugaw or vegetable purée.',
      9: 'Deboned and flaked into soft lumps.',
      12: 'Flaked into family dishes, deboned, before any patis or salt.',
    },
    notes:
      'Counterintuitive: despite being the default "healthy fish" here, bangus is a poor iron source at 0.32 mg. Fine food, not an iron strategy — use dilis or liver for that.',
    sources: ['usda-fdc'],
  },
  {
    id: 'monggo',
    name: 'Mung beans',
    localName: 'Monggo',
    category: 'legume',
    ageMonths: 6,
    allergen: null,
    ironRich: true,
    ironMg: 1.4,
    vitCMg: 1.0,
    fdcId: 175255,
    chokingRisk: 'low',
    serve: {
      6: 'Soak overnight, boil until collapsing, purée smooth. Pair with calamansi or papaya for the vitamin C.',
      9: 'Soaked, well-cooked and mashed — a good early lumpy texture.',
      12: 'Family monggo with malunggay, portioned out before salt.',
    },
    notes:
      'Soaking overnight cut phytate by 45% in the Philippine study (275.6 to 151.0 mg/100 g), which meaningfully improves iron and zinc absorption. Free win.',
    sources: ['ph-complementary-foods-study', 'usda-fdc'],
  },

  // ─── The nine allergens (egg + peanut lead) ───────────────────────────────
  {
    id: 'itlog',
    name: 'Egg',
    localName: 'Itlog',
    category: 'protein',
    ageMonths: 6,
    allergen: 'egg',
    ironRich: true,
    ironMg: 1.19,
    vitCMg: 0,
    fdcId: 173424,
    chokingRisk: 'low',
    cookedFormRequired: true,
    cookedFormNote:
      'WELL-COOKED ONLY — hard-boiled, fully scrambled, or baked into food. Never raw, runny, or raw-pasteurised egg powder: trials using raw pasteurised egg had to be halted for anaphylaxis.',
    serve: {
      6: 'Hard-boil at least 10 minutes. Mash the yolk and white with a little breast milk or vegetable purée.',
      9: 'Firmly scrambled in strips, or omelette fingers.',
      12: 'Scrambled, hard-boiled wedges, or baked into pancakes. Still fully cooked — no runny yolks before 12 months.',
    },
    introduction: {
      priority: 1,
      evidence:
        'PETIT trial: egg allergy at 12 months 38% placebo vs 8% early introduction. Meta-analysis RR 0.60, high certainty.',
      firstAmount: 'Tip of a teaspoon, wait 10 minutes, then the rest at his normal pace.',
      watchHours: 2,
    },
    sources: ['ascia-2026', 'aaaai-2021', 'petit-2017'],
  },
  {
    id: 'mani',
    nutritionVerified: false, // TODO: re-pull from USDA FoodData Central
    name: 'Peanut',
    localName: 'Mani',
    category: 'protein',
    ageMonths: 6,
    allergen: 'peanut',
    ironRich: false,
    ironMg: 1.66,
    vitCMg: 0,
    fdcId: 172470,
    chokingRisk: 'high',
    minAgeWholeYears: 4,
    chokingNote:
      'NEVER whole nuts before age 4 — whole or chopped. NEVER peanut butter off a spoon or in a lump: it is a genuine airway risk. It must be thinned.',
    serve: {
      6: 'Stir 2 tsp smooth peanut butter into 2–3 tsp hot water until loose, cool it, then mix through a purée he already eats.',
      9: 'Thinned peanut butter stirred through porridge, or peanut flour mixed into food.',
      12: 'Thinly spread on toast fingers — a thin scrape, never a dollop.',
    },
    introduction: {
      priority: 2,
      evidence:
        'LEAP trial: peanut allergy at age 5 was 13.7% avoiding vs 1.9% eating — 86% relative reduction. Meta-analysis RR 0.31, high certainty.',
      firstAmount:
        '2 g peanut protein = 2 level tsp smooth peanut butter, thinned. Tip of the spoon first, wait 10 minutes.',
      watchHours: 2,
      medicalGateBefore:
        'If he has severe eczema or a known egg allergy, NIAID advises considering peanut IgE or skin-prick testing BEFORE first exposure. Ask the pediatrician first.',
    },
    sources: ['niaid-2017', 'leap-2015', 'aaaai-2021'],
  },
  {
    id: 'tokwa',
    nutritionVerified: false, // TODO: re-pull from USDA FoodData Central
    name: 'Tofu',
    localName: 'Tokwa',
    category: 'protein',
    ageMonths: 6,
    allergen: 'soy',
    ironRich: true,
    ironMg: 2.66,
    vitCMg: 0.2,
    fdcId: 172461,
    chokingRisk: 'low',
    serve: {
      6: 'Soft/silken tofu mashed smooth, or plain taho with no syrup at all.',
      9: 'Soft cubes he can pick up himself — an excellent early finger food.',
      12: 'Cubed into family dishes, portioned out before the sauce.',
    },
    notes:
      'Use tofu or plain taho for the soy introduction, NOT soy sauce — toyo has almost no protein and an enormous salt load.',
    sources: ['ascia-2026', 'usda-fdc'],
  },
  {
    id: 'yogurt',
    nutritionVerified: false, // TODO: re-pull from USDA FoodData Central
    name: 'Plain yogurt',
    localName: null,
    category: 'dairy',
    ageMonths: 6,
    allergen: 'dairy',
    ironRich: false,
    ironMg: 0.05,
    vitCMg: 0.5,
    fdcId: 170886,
    chokingRisk: 'low',
    serve: {
      6: 'Plain, unsweetened, full-fat. Stir in fruit purée if he needs it sweeter — never added sugar or honey.',
      9: 'On its own, or with mashed fruit.',
      12: 'As is, with soft fruit.',
    },
    notes:
      'Yogurt and cheese are fine from ~6 months. Liquid cow\'s milk as a DRINK is a different question — not before 12 months, because of low iron and occult intestinal blood loss in about 40% of infants under one.',
    sources: ['ascia-2026', 'aap-2019'],
  },
  {
    id: 'tahini',
    nutritionVerified: false, // TODO: re-pull from USDA FoodData Central
    name: 'Sesame paste',
    localName: null,
    category: 'protein',
    ageMonths: 6,
    allergen: 'sesame',
    ironRich: true,
    ironMg: 8.95,
    vitCMg: 0,
    fdcId: 170190,
    chokingRisk: 'high',
    chokingNote: 'Same rule as peanut butter — thick paste must be thinned. Never a lump or a spoonful.',
    serve: {
      6: 'Thin 1 tsp tahini with warm water and stir through a familiar purée. Hummus works too, thinned.',
      9: 'Thinned tahini through porridge or mashed vegetables.',
      12: 'Thinly spread, or as hummus with soft vegetable sticks. No sesame candy or brittle.',
    },
    sources: ['ascia-2026', 'usda-fdc'],
  },
  {
    id: 'hipon',
    nutritionVerified: false, // TODO: re-pull from USDA FoodData Central
    name: 'Shrimp',
    localName: 'Hipon',
    category: 'protein',
    ageMonths: 6,
    allergen: 'shellfish',
    ironRich: false,
    ironMg: 0.51,
    vitCMg: 0,
    fdcId: 175179,
    chokingRisk: 'moderate',
    chokingNote: 'Rubbery texture is hard to break down. Cook fully, shell, devein, and chop very finely.',
    serve: {
      6: 'Fully cooked, peeled, deveined and puréed or chopped extremely fine into lugaw.',
      9: 'Finely chopped — not whole, not in rings.',
      12: 'Chopped small into family dishes.',
    },
    sources: ['ascia-2026', 'fda-fish-advice'],
  },
  {
    id: 'pasta',
    nutritionVerified: false, // TODO: re-pull from USDA FoodData Central
    name: 'Wheat pasta',
    localName: null,
    category: 'grain',
    ageMonths: 6,
    allergen: 'wheat',
    ironRich: false,
    ironMg: 1.28,
    vitCMg: 0,
    fdcId: 168927,
    chokingRisk: 'low',
    serve: {
      6: 'Overcook small pasta until very soft, then mash. Or a strip of bread soaked soft.',
      9: 'Soft-cooked pasta pieces he can pick up — one of the best early finger foods.',
      12: 'Family pasta, cut small, sauce portioned out before salt.',
    },
    notes:
      'Gluten can go in any time between 4 and 12 months; timing does not change coeliac risk (ESPGHAN). No reason to leave it last.',
    sources: ['espghan-2017', 'ascia-2026'],
  },
  {
    id: 'kasuy-butter',
    nutritionVerified: false, // TODO: re-pull from USDA FoodData Central
    name: 'Cashew butter',
    localName: 'Kasuy',
    category: 'protein',
    ageMonths: 6,
    allergen: 'treenut',
    ironRich: true,
    ironMg: 5.16,
    vitCMg: 0,
    fdcId: 170571,
    chokingRisk: 'high',
    minAgeWholeYears: 4,
    chokingNote:
      'NO whole or chopped tree nuts before age 4. Nut butter only, and thinned — never a lump.',
    serve: {
      6: 'Thin 1–2 tsp smooth cashew butter with hot water, cool, stir through a familiar purée.',
      9: 'Thinned nut butter through porridge.',
      12: 'Thinly spread on soft toast fingers.',
    },
    sources: ['ascia-2026', 'usda-fdc'],
  },

  // ─── Fruit + staples ──────────────────────────────────────────────────────
  {
    id: 'saging',
    nutritionVerified: false, // TODO: re-pull from USDA FoodData Central
    name: 'Banana',
    localName: 'Saging',
    category: 'fruit',
    ageMonths: 6,
    allergen: null,
    ironRich: false,
    ironMg: 0.26,
    vitCMg: 8.7,
    fdcId: 173944,
    chokingRisk: 'low',
    serve: {
      6: 'Ripe, mashed smooth with a fork.',
      9: 'Cut lengthwise into spears he can hold, or in chunks.',
      12: 'Whole-ish, in pieces he manages himself.',
    },
    notes:
      'Deliberately not a first food — starting with sweet fruit makes vegetables a harder sell. Vegetables led for two weeks first.',
    sources: ['nhs-weaning', 'usda-fdc'],
  },
  {
    id: 'papaya',
    nutritionVerified: false, // TODO: re-pull from USDA FoodData Central
    name: 'Papaya',
    localName: 'Papaya',
    category: 'fruit',
    ageMonths: 6,
    allergen: null,
    ironRich: false,
    ironMg: 0.25,
    vitCMg: 60.9,
    fdcId: 169926,
    chokingRisk: 'low',
    serve: {
      6: 'Ripe, seeds removed, mashed or puréed smooth.',
      9: 'Soft ripe spears for self-feeding.',
      12: 'Cubed.',
    },
    notes:
      'High vitamin C (60.9 mg) — a useful pairing on the monggo and malunggay days to help absorb plant iron.',
    sources: ['usda-fdc'],
  },
  {
    id: 'lugaw',
    nutritionVerified: false, // TODO: re-pull from USDA FoodData Central
    name: 'Rice porridge',
    localName: 'Lugaw',
    category: 'grain',
    ageMonths: 6,
    allergen: null,
    ironRich: false,
    ironMg: 0.45,
    vitCMg: 0,
    chokingRisk: 'low',
    serve: {
      6: 'Cooked thick rather than watery — thin lugaw is mostly water and fills him up without feeding him. Always carries something else.',
      9: 'Thicker, with visible soft lumps of whatever protein is on today.',
      12: 'Family lugaw, portioned out before salt or patis.',
    },
    notes:
      'The base, never the meal. On its own it is 0.45 mg iron — with chicken liver it is 10.20 mg. Vary the grain too: rice takes up roughly 10x more arsenic than other grains, so oats and other grains should rotate through.',
    sources: ['ph-complementary-foods-study', 'aap-arsenic'],
  },
];

/**
 * Source registry — every food cites into this, so any claim in the app can be
 * traced back to a public, appropriately-licensed source.
 */
export const SOURCES = {
  'nhs-weaning': {
    title: 'NHS Start for Life — Weaning',
    url: 'https://www.nhs.uk/start-for-life/baby/weaning/',
    license: 'OGL v3.0 — reusable with attribution; adapted text must NOT be attributed to the NHS',
  },
  'usda-fdc': {
    title: 'USDA FoodData Central',
    url: 'https://fdc.nal.usda.gov/',
    license: 'CC0 / public domain — cite USDA',
  },
  'who-2023': {
    title: 'WHO Guideline: complementary feeding of infants and young children 6–23 months (2023)',
    url: 'https://www.ncbi.nlm.nih.gov/books/NBK596427/',
    license: 'CC BY-NC-SA 3.0 IGO — non-commercial only',
  },
  'niaid-2017': {
    title: 'NIAID Addendum Guidelines for the Prevention of Peanut Allergy (Togias et al., JACI 2017)',
    url: 'https://www.aaaai.org/Aaaai/media/Media-Library-PDFs/Allergist%20Resources/Statements%20and%20Practice%20Parameters/Addendum-guidelines-for-the-prevention-of-peanut-allergy-in-the-United-States.pdf',
  },
  'aaaai-2021': {
    title: 'AAAAI/ACAAI/CSACI Consensus on Primary Prevention of Food Allergy (Fleischer et al., 2021)',
    url: 'https://www.aaaai.org/Aaaai/media/MediaLibrary/PDF%20Documents/Practice%20and%20Parameters/A-Consensus-Approach-to-the-Primary-Prevention-of-Food-Allergy-Through-Nutrition-Jan-21.pdf',
  },
  'ascia-2026': {
    title: 'ASCIA Guideline: Infant Feeding for Food Allergy Prevention (Vale et al., 2026)',
    url: 'https://onlinelibrary.wiley.com/doi/10.1111/cea.70217',
  },
  'leap-2015': {
    title: 'LEAP — Randomized Trial of Peanut Consumption in Infants at Risk (NEJM 2015)',
    url: 'https://pubmed.ncbi.nlm.nih.gov/25705822/',
  },
  'petit-2017': {
    title: 'PETIT — Two-step egg introduction for prevention of egg allergy (Lancet 2017)',
    url: 'https://pubmed.ncbi.nlm.nih.gov/27939035/',
  },
  'espghan-2017': {
    title: 'ESPGHAN Position Paper on Complementary Feeding (Fewtrell et al., JPGN 2017)',
    url: 'https://onlinelibrary.wiley.com/doi/10.1097/MPG.0000000000001454',
  },
  'aap-2019': {
    title: 'AAP Clinical Report — Effects of Early Nutritional Interventions (Greer et al., 2019)',
    url: 'https://pubmed.ncbi.nlm.nih.gov/30886111/',
  },
  'aap-arsenic': {
    title: 'AAP HealthyChildren — Reducing arsenic in baby food',
    url: 'https://www.healthychildren.org/English/ages-stages/baby/feeding-nutrition/Pages/reduce-arsenic.aspx',
  },
  'fda-fish-advice': {
    title: 'FDA/EPA Advice About Eating Fish',
    url: 'https://www.fda.gov/food/consumers/advice-about-eating-fish',
  },
  'ph-complementary-foods-study': {
    title: 'Nutrient content of Philippine complementary food porridges (PMC6860945)',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6860945/',
  },
};
