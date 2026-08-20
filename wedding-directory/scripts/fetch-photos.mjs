// Fetch one Places photo per app venue, downsample, and record attribution.
//   node scripts/fetch-photos.mjs
//
// Cached: a venue already in photo-map.json (or with a file on disk) is skipped,
// so re-runs cost nothing. Google requires attribution wherever a photo shows —
// that string rides in photo-map.json and is rendered in the app.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'app', 'photos');
const MAP = join(ROOT, 'seed-data', 'photo-map.json');

const KEY = (readFileSync(join(ROOT, '.env'), 'utf8').match(/^GOOGLE_PLACES_API_KEY=(.+)$/m)?.[1] ?? '').trim();
if (!KEY) { console.error('No GOOGLE_PLACES_API_KEY in wedding-directory/.env'); process.exit(1); }

mkdirSync(OUT, { recursive: true });
const map = existsSync(MAP) ? JSON.parse(readFileSync(MAP, 'utf8')) : {};

const classified = JSON.parse(readFileSync(join(ROOT, 'seed-data', 'classified.json'), 'utf8'));
const seed = JSON.parse(readFileSync(join(ROOT, 'seed-data', 'seed-venues.json'), 'utf8'));

const norm = (n) =>
  n.toLowerCase().replace(/\(.*?\)/g, '')
   .replace(/\b(the|resort and spa|resort & spa|hotel|tagaytay|manila|cebu|boracay)\b/g, '')
   .replace(/[^a-z0-9]/g, '');
const places = new Map(classified.map((p) => [norm(p.name), p]));

const slug = (n) => n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

let fetched = 0, skipped = 0, missing = 0, calls = 0;

for (const v of seed) {
  const name = v.name.replace(/ \(.*?\)$/, '');
  const key = slug(name);
  if (map[key]?.file && existsSync(join(OUT, map[key].file))) { skipped++; continue; }

  const p = places.get(norm(name));
  if (!p) { missing++; continue; }

  try {
    calls++;
    const det = await fetch(`https://places.googleapis.com/v1/places/${p.place_id}?fields=photos`,
      { headers: { 'X-Goog-Api-Key': KEY } }).then((r) => r.json());
    const photo = det.photos?.[0];
    if (!photo?.name) { missing++; continue; }

    calls++;
    const res = await fetch(`https://places.googleapis.com/v1/${photo.name}/media?maxWidthPx=800&key=${KEY}`);
    if (!res.ok) { missing++; continue; }
    const buf = Buffer.from(await res.arrayBuffer());
    const file = `${key}.jpg`;
    writeFileSync(join(OUT, file), buf);
    // downsample for the card grid; keeps the app light on gym-grade connections
    try {
      execFileSync('sips', ['-Z', '900', '-s', 'formatOptions', '55', join(OUT, file), '--out', join(OUT, file)],
        { stdio: 'ignore' });
    } catch { /* sips missing — full-size file is still fine */ }

    map[key] = {
      file,
      attribution: photo.authorAttributions?.[0]?.displayName ?? null,
      attributionUri: photo.authorAttributions?.[0]?.uri ?? null,
    };
    fetched++;
    process.stdout.write(`\rfetched ${fetched} · skipped ${skipped} · missing ${missing} · ${calls} API calls`);
  } catch (e) {
    missing++;
  }
}

writeFileSync(MAP, JSON.stringify(map, null, 2));
console.log(`\ndone — ${fetched} new, ${skipped} cached, ${missing} without a usable photo. ${calls} API calls this run.`);
console.log(`photos -> app/photos/ · attribution -> seed-data/photo-map.json`);
