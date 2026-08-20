// Places API (New) sweep: discover wedding venue candidates across PH wedding areas.
//
//   node scripts/sweep-places.mjs --dry-run          # show plan, no API calls
//   node scripts/sweep-places.mjs --areas "Tagaytay, Cavite;Cebu City, Cebu"
//   node scripts/sweep-places.mjs                    # full sweep (cached + capped)
//   node scripts/sweep-places.mjs --lean             # cheaper SKU: skips rating/website/phone
//
// Every (area x query) response is cached in raw-cache/, so re-runs are free and
// an interrupted sweep resumes where it stopped. Outputs: seed-data/candidates.json/.csv
// plus closed.json (permanently closed places — stale-blog-detector content).

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(ROOT, 'raw-cache');
const OUT = join(ROOT, 'seed-data');

// ---- config ---------------------------------------------------------------

const AREAS = [
  // Metro Manila
  'Quezon City, Metro Manila', 'Manila City, Metro Manila', 'Makati, Metro Manila',
  'Taguig, Metro Manila', 'Pasig, Metro Manila', 'Parañaque, Metro Manila',
  'Pasay, Metro Manila', 'San Juan, Metro Manila', 'Mandaluyong, Metro Manila',
  'Muntinlupa, Metro Manila', 'Las Piñas, Metro Manila', 'Marikina, Metro Manila',
  'Caloocan, Metro Manila', 'Valenzuela, Metro Manila',
  // Tagaytay corridor + Cavite
  'Tagaytay, Cavite', 'Alfonso, Cavite', 'Silang, Cavite', 'Indang, Cavite',
  'Amadeo, Cavite', 'Mendez, Cavite', 'General Trias, Cavite', 'Dasmariñas, Cavite',
  'Imus, Cavite', 'Bacoor, Cavite',
  // CALABARZON rest
  'Laurel, Batangas', 'Lipa, Batangas', 'Batangas City, Batangas', 'Nasugbu, Batangas',
  'San Juan, Batangas', 'Calatagan, Batangas', 'Santa Rosa, Laguna', 'Calamba, Laguna',
  'San Pablo, Laguna', 'Los Baños, Laguna', 'Antipolo, Rizal', 'Tanay, Rizal',
  'Taytay, Rizal',
  // Central/North Luzon
  'Malolos, Bulacan', 'San Jose del Monte, Bulacan', 'San Fernando, Pampanga',
  'Angeles City, Pampanga', 'Clark Freeport Zone, Pampanga', 'Subic Bay Freeport Zone, Zambales',
  'Baguio City, Benguet', 'San Juan, La Union', 'Vigan, Ilocos Sur', 'Laoag, Ilocos Norte',
  // Bicol + Visayas
  'Naga City, Camarines Sur', 'Legazpi City, Albay', 'Cebu City, Cebu',
  'Lapu-Lapu City, Cebu', 'Mandaue City, Cebu', 'Tagbilaran, Bohol', 'Panglao, Bohol',
  'Boracay, Malay, Aklan', 'Iloilo City, Iloilo', 'Bacolod City, Negros Occidental',
  'Dumaguete, Negros Oriental', 'Tacloban, Leyte',
  // Palawan + Mindanao
  'Puerto Princesa, Palawan', 'El Nido, Palawan', 'Coron, Palawan',
  'Davao City, Davao del Sur', 'Cagayan de Oro, Misamis Oriental',
  'General Santos, South Cotabato', 'Siargao, Surigao del Norte',
  'Zamboanga City, Zamboanga del Sur',
];

const QUERIES = [
  'wedding venue',
  'events place',            // the Filipino term — surfaces venues Google won't type as wedding_venue
  'wedding reception venue',
  'garden events venue',
];

// Fields: the lean mask bills as Text Search Pro (bigger free tier); the full
// mask adds rating/website/phone and bills as Enterprise (1K free calls/month).
const MASK_LEAN =
  'places.id,places.displayName,places.formattedAddress,places.location,places.businessStatus,places.primaryType,places.types,places.googleMapsUri,nextPageToken';
const MASK_FULL =
  MASK_LEAN + ',places.rating,places.userRatingCount,places.websiteUri,places.nationalPhoneNumber';

const MAX_REQUESTS = Number(process.env.MAX_REQUESTS ?? 950); // stay under the free tier
const PAGES_PER_QUERY = 3; // 20 results/page, 60 max per (area x query)

// ---- setup ----------------------------------------------------------------

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const LEAN = args.includes('--lean');
const areaArg = args.indexOf('--areas');
const areas = areaArg !== -1 ? args[areaArg + 1].split(';').map((s) => s.trim()) : AREAS;

const envPath = join(ROOT, '.env');
const KEY = existsSync(envPath)
  ? (readFileSync(envPath, 'utf8').match(/^GOOGLE_PLACES_API_KEY=(.+)$/m)?.[1] ?? '').trim()
  : '';

const plannedQueries = areas.length * QUERIES.length;
console.log(`plan: ${areas.length} areas x ${QUERIES.length} queries = ${plannedQueries} searches`);
console.log(`      up to ${plannedQueries * PAGES_PER_QUERY} requests worst-case; hard cap ${MAX_REQUESTS}; mask: ${LEAN ? 'lean' : 'full'}`);
if (DRY) process.exit(0);
if (!KEY || KEY.includes('paste-your-key')) {
  console.error('No key found. Copy .env.example to wedding-directory/.env and paste your key.');
  process.exit(1);
}

mkdirSync(CACHE, { recursive: true });
mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let requests = 0;

async function searchPage(body) {
  if (requests >= MAX_REQUESTS) throw new Error(`request cap ${MAX_REQUESTS} reached — raise MAX_REQUESTS to continue (cache keeps finished queries)`);
  requests++;
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': KEY,
      'X-Goog-FieldMask': LEAN ? MASK_LEAN : MASK_FULL,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

async function runQuery(area, query) {
  const cacheKey = createHash('sha1').update(`${LEAN ? 'lean' : 'full'}|${area}|${query}`).digest('hex');
  const cacheFile = join(CACHE, `${cacheKey}.json`);
  if (existsSync(cacheFile)) return JSON.parse(readFileSync(cacheFile, 'utf8'));

  const places = [];
  let pageToken;
  for (let page = 0; page < PAGES_PER_QUERY; page++) {
    if (pageToken) await sleep(1500); // token needs a beat to become valid
    const body = pageToken
      ? { textQuery: `${query} in ${area}`, pageToken }
      : { textQuery: `${query} in ${area}`, pageSize: 20 };
    let data;
    try {
      data = await searchPage(body);
    } catch (e) {
      if (String(e).includes('request cap')) throw e;
      await sleep(2000); // one retry for transient errors / not-ready tokens
      data = await searchPage(body);
    }
    places.push(...(data.places ?? []));
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }
  writeFileSync(cacheFile, JSON.stringify({ area, query, places }));
  await sleep(300);
  return { area, query, places };
}

// ---- sweep ----------------------------------------------------------------

const byId = new Map();
let done = 0;
for (const area of areas) {
  for (const query of QUERIES) {
    let result;
    try {
      result = await runQuery(area, query);
    } catch (e) {
      console.error(`\nstopped at "${query} in ${area}": ${e.message}`);
      console.error('progress is cached — rerun to resume from here.');
      break;
    }
    done++;
    process.stdout.write(`\r${done}/${plannedQueries} queries | ${requests} API calls | ${byId.size} unique places`);
    for (const p of result.places) {
      const existing = byId.get(p.id);
      if (existing) { existing.found_via.push(`${query} @ ${area}`); continue; }
      byId.set(p.id, {
        place_id: p.id,
        name: p.displayName?.text ?? '',
        address: p.formattedAddress ?? '',
        lat: p.location?.latitude ?? null,
        lng: p.location?.longitude ?? null,
        rating: p.rating ?? null,
        user_ratings: p.userRatingCount ?? null,
        business_status: p.businessStatus ?? 'UNKNOWN',
        primary_type: p.primaryType ?? null,
        types: p.types ?? [],
        website: p.websiteUri ?? null,
        phone: p.nationalPhoneNumber ?? null,
        google_maps_uri: p.googleMapsUri ?? null,
        found_via: [`${query} @ ${area}`],
      });
    }
  }
}
console.log('');

// ---- output ---------------------------------------------------------------

const all = [...byId.values()];
const closed = all.filter((p) => p.business_status === 'CLOSED_PERMANENTLY');
const candidates = all
  .filter((p) => p.business_status !== 'CLOSED_PERMANENTLY')
  .sort((a, b) => (b.user_ratings ?? 0) - (a.user_ratings ?? 0));

writeFileSync(join(OUT, 'candidates.json'), JSON.stringify(candidates, null, 2));
writeFileSync(join(OUT, 'closed.json'), JSON.stringify(closed, null, 2));

const esc = (v) => (v == null ? '' : `"${String(v).replace(/"/g, '""')}"`);
const cols = ['name', 'address', 'lat', 'lng', 'rating', 'user_ratings', 'business_status', 'primary_type', 'website', 'phone', 'google_maps_uri', 'place_id', 'found_via'];
writeFileSync(
  join(OUT, 'candidates.csv'),
  [cols.join(','), ...candidates.map((p) => cols.map((c) => esc(c === 'found_via' ? p.found_via.join(' | ') : c === 'types' ? p.types.join(' ') : p[c])).join(','))].join('\n')
);

console.log(`\ndone: ${candidates.length} candidates (${closed.length} permanently closed filtered out)`);
console.log(`API calls this run: ${requests}`);
console.log(`-> seed-data/candidates.json / candidates.csv / closed.json`);
console.log(`top 10 by review count:`);
for (const p of candidates.slice(0, 10)) console.log(`   ${p.user_ratings ?? '?'} reviews | ${p.rating ?? '?'}★ | ${p.name}`);
