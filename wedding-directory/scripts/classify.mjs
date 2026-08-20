// Classify sweep candidates into directory tiers. Local only — zero API cost.
//
//   node scripts/classify.mjs
//
// Tiers:
//   A  wedding-core (events places, gardens, banquet halls, wedding venues)
//   B  hospitality that hosts weddings (hotels, resorts, B&Bs, farmstays)
//   C  plausible but needs review (restaurants, convention centers, unclear)
//   X  noise (malls, buffet chains, supermarkets, suppliers, churches*)
// *churches matter for ceremonies but are a later category, not reception venues.

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const candidates = JSON.parse(readFileSync(join(ROOT, 'seed-data', 'candidates.json'), 'utf8'));

const CORE_TYPES = ['wedding_venue', 'event_venue', 'banquet_hall'];
const HOSP_TYPES = ['hotel', 'resort_hotel', 'bed_and_breakfast', 'inn', 'lodging', 'guest_house', 'farmstay', 'cottage', 'extended_stay_hotel'];
const FOOD_TYPES = ['restaurant', 'buffet_restaurant', 'fine_dining_restaurant', 'cafe', 'bar_and_grill', 'brunch_restaurant', 'bar', 'pub', 'night_club', 'filipino_restaurant', 'seafood_restaurant'];
const NOISE_TYPES = ['shopping_mall', 'department_store', 'supermarket', 'grocery_store', 'market', 'stadium', 'arena', 'movie_theater', 'amusement_park', 'tourist_attraction', 'park', 'furniture_store', 'clothing_store', 'store'];
const SUPPLIER_TYPES = ['photographer', 'photography_studio', 'florist', 'catering_service', 'beauty_salon', 'bakery'];
const CHURCH_TYPES = ['church', 'place_of_worship', 'catholic_church'];

const CORE_NAME = /\bevent[sz]? ?(place|venue|centre|center|hall|pavilion)|wedding|kasal|pavilion|garden|hacienda|villa|balai|balay|casa\b|farm\b|ranch\b|glass ?house|tent\b|marquee|ballroom|reception/i;
const NOISE_NAME = /vikings|buffet ?101|dads |kamayan|s ?& ?r\b|sm (city|center|mall|megamall|southmall|supermalls)|sm arena|smx|ayala malls?|ayala center|robinsons? (place|mall|galleria|town)|megaworld|department|convention center|trade (hall|center)|expo\b|city ?hall|municipal|barangay|gymnasium|\bgym\b|covered court|astrodome|coliseum|capitol|freedom park|plaza (rizal|quezon)|memorial|cemetery|funeral|school|university|college|hospital/i;
const CHAIN_HINT = /vikings|buffet ?101|max'?s|jollibee|mcdo|shakey'?s|gerry'?s|mang inasal|cabalen|kuya j|conti'?s|mesa\b|barrio fiesta/i;

// crude chain detection: same base name appearing 3+ times = branch chain
const baseName = (n) => n.toLowerCase().replace(/[-–,(].*$/, '').replace(/\b(the|a)\b/g, '').replace(/[^a-z0-9]/g, '').slice(0, 24);
const counts = new Map();
for (const p of candidates) counts.set(baseName(p.name), (counts.get(baseName(p.name)) ?? 0) + 1);

function classify(p) {
  const types = new Set([p.primary_type, ...(p.types ?? [])].filter(Boolean));
  const has = (list) => list.some((t) => types.has(t));
  const reasons = [];
  let score = 0;

  if (has(CORE_TYPES)) { score += 60; reasons.push('core-type'); }
  if (has(HOSP_TYPES)) { score += 35; reasons.push('hospitality-type'); }
  if (has(FOOD_TYPES)) { score += 10; reasons.push('food-type'); }
  // Google tags many restobars as event_venue in secondary types; a food-first
  // primary without a wedding-ish name caps those at hosts-events tier, not A.
  if (FOOD_TYPES.includes(p.primary_type) && has(CORE_TYPES) && !CORE_NAME.test(p.name)) {
    score -= 20; reasons.push('food-primary');
  }
  // Softer noise penalty when Google also calls it an event venue — catches
  // heritage/attraction venues like The Ruins without rescuing actual malls.
  if (has(NOISE_TYPES)) { const pen = has(CORE_TYPES) ? 25 : 50; score -= pen; reasons.push('noise-type'); }
  if (has(SUPPLIER_TYPES)) { score -= 40; reasons.push('supplier-type'); }
  if (has(CHURCH_TYPES)) { score -= 100; reasons.push('church'); }

  if (CORE_NAME.test(p.name)) { score += 25; reasons.push('core-name'); }
  if (NOISE_NAME.test(p.name)) { score -= 80; reasons.push('noise-name'); }
  if (CHAIN_HINT.test(p.name) || (counts.get(baseName(p.name)) >= 3 && !has(CORE_TYPES))) {
    score -= 60; reasons.push('chain');
  }

  // No signals at all = unknown, not junk — park it in C for the enrichment
  // agents to settle rather than silently discarding it.
  if (reasons.length === 0) return { tier: 'C', score: 0, reasons: ['unknown'] };
  const tier = score >= 60 ? 'A' : score >= 30 ? 'B' : score >= 1 ? 'C' : 'X';
  return { tier, score, reasons };
}

const out = candidates.map((p) => ({ ...p, ...classify(p) }));
const byTier = (t) => out.filter((p) => p.tier === t).sort((a, b) => (b.user_ratings ?? 0) - (a.user_ratings ?? 0));
const tiers = { A: byTier('A'), B: byTier('B'), C: byTier('C'), X: byTier('X') };

writeFileSync(join(ROOT, 'seed-data', 'classified.json'), JSON.stringify(out, null, 2));

const esc = (v) => (v == null ? '' : `"${String(v).replace(/"/g, '""')}"`);
const cols = ['tier', 'score', 'name', 'address', 'rating', 'user_ratings', 'primary_type', 'website', 'phone', 'lat', 'lng', 'place_id', 'reasons'];
writeFileSync(
  join(ROOT, 'seed-data', 'classified.csv'),
  [cols.join(','), ...['A', 'B', 'C', 'X'].flatMap((t) => tiers[t].map((p) => cols.map((c) => esc(c === 'reasons' ? p.reasons.join('|') : p[c])).join(',')))].join('\n')
);

console.log('tier distribution:');
for (const t of ['A', 'B', 'C', 'X']) {
  const rows = tiers[t];
  const sites = rows.filter((p) => p.website).length;
  console.log(`  ${t}: ${rows.length}  (with website: ${sites}, >=100 reviews: ${rows.filter((p) => (p.user_ratings ?? 0) >= 100).length})`);
}
console.log('\ntier A top 15 by reviews:');
for (const p of tiers.A.slice(0, 15)) console.log(`   ${p.user_ratings ?? '?'} | ${p.rating ?? '?'}★ | ${p.name} — ${p.primary_type}`);
console.log('\ntier X spot-check (should all be junk):');
for (const p of tiers.X.slice(0, 8)) console.log(`   ${p.name} — ${p.primary_type} [${p.reasons.join(',')}]`);
console.log('\ntier C spot-check (gray zone):');
for (const p of tiers.C.slice(0, 8)) console.log(`   ${p.name} — ${p.primary_type} [${p.reasons.join(',')}]`);
