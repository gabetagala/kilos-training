// Second pass: token-overlap matching for venues the strict normalizer missed.
//   node scripts/rescue-photos.mjs --dry-run    # show proposed matches
//   node scripts/rescue-photos.mjs              # fetch them

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'app', 'photos');
const MAP = join(ROOT, 'seed-data', 'photo-map.json');
const DRY = process.argv.includes('--dry-run');

const KEY = (readFileSync(join(ROOT, '.env'), 'utf8').match(/^GOOGLE_PLACES_API_KEY=(.+)$/m)?.[1] ?? '').trim();
mkdirSync(OUT, { recursive: true });

const map = existsSync(MAP) ? JSON.parse(readFileSync(MAP, 'utf8')) : {};
const classified = JSON.parse(readFileSync(join(ROOT, 'seed-data', 'classified.json'), 'utf8'));
const seed = JSON.parse(readFileSync(join(ROOT, 'seed-data', 'seed-venues.json'), 'utf8'));

const STOP = new Set(['the', 'a', 'de', 'and', 'at', 'by', 'of', 'city', 'philippines']);
const deaccent = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const tokens = (s) => new Set(
  deaccent(s).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
    .filter((t) => t.length > 2 && !STOP.has(t))
);
const slug = (n) => n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

const candidates = classified.map((p) => ({ p, t: tokens(p.name) }));

// Strict: a wrong photo on a venue page is worse than no photo. The candidate
// must contain EVERY significant word of the venue name (so "Crimson … Mactan"
// never matches "Shangri-La … Mactan"), the name must carry at least two such
// words (so bare "The View" can't match "Apo View Hotel"), and the address must
// corroborate the location (so a Lola Cafe branch in Pasay isn't used for the
// Quezon City one).
function bestMatch(name, area) {
  const t = tokens(name);
  if (t.size < 2) return null;
  const areaT = tokens(area ?? '');
  for (const c of candidates) {
    if (![...t].every((x) => c.t.has(x))) continue;
    const addr = deaccent(c.p.address ?? '').toLowerCase();
    if (areaT.size && ![...areaT].some((x) => addr.includes(x))) continue;
    return { place: c.p, score: 1 };
  }
  return null;
}

// Multi-branch brands the address check can't separate (the sweep found a
// different branch than the one our rate data describes).
const SKIP = new Set(['lola-cafe']);

const todo = [];
for (const v of seed) {
  const name = v.name.replace(/ \(.*?\)$/, '');
  const key = slug(name);
  if (SKIP.has(key)) continue;
  if (map[key]?.file && existsSync(join(OUT, map[key].file))) continue;
  const hit = bestMatch(name, v.area);
  if (hit) todo.push({ name, key, place: hit.place, score: hit.score });
}

console.log(`${todo.length} rescue matches:`);
for (const t of todo) console.log(`  ${t.score.toFixed(2)}  ${t.name}  ->  ${t.place.name} (${t.place.address?.slice(0, 44)})`);
if (DRY) process.exit(0);

let fetched = 0, calls = 0;
for (const t of todo) {
  try {
    calls++;
    const det = await fetch(`https://places.googleapis.com/v1/places/${t.place.place_id}?fields=photos`,
      { headers: { 'X-Goog-Api-Key': KEY } }).then((r) => r.json());
    const photo = det.photos?.[0];
    if (!photo?.name) continue;
    calls++;
    const res = await fetch(`https://places.googleapis.com/v1/${photo.name}/media?maxWidthPx=800&key=${KEY}`);
    if (!res.ok) continue;
    writeFileSync(join(OUT, `${t.key}.jpg`), Buffer.from(await res.arrayBuffer()));
    try {
      execFileSync('sips', ['-Z', '900', '-s', 'formatOptions', '55', join(OUT, `${t.key}.jpg`), '--out', join(OUT, `${t.key}.jpg`)], { stdio: 'ignore' });
    } catch { /* no sips */ }
    map[t.key] = {
      file: `${t.key}.jpg`,
      attribution: photo.authorAttributions?.[0]?.displayName ?? null,
      attributionUri: photo.authorAttributions?.[0]?.uri ?? null,
    };
    fetched++;
  } catch { /* skip */ }
}

writeFileSync(MAP, JSON.stringify(map, null, 2));
console.log(`rescued ${fetched} photos in ${calls} API calls`);
