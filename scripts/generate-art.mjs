#!/usr/bin/env node
// ─── Gemini exercise-art generator ───────────────────────────────────────────
// Generates the guided player's flat-vector demo art via the Gemini API
// (Nano Banana) and drops finished webp files straight into public/rehab/,
// where the app auto-detects them (see rhProbeArt in src/main.js).
//
// Pipeline per exercise:
//   two-pose  → ONE wide image, both poses side by side (the model renders
//               pose pairs far more distinctly than chained edits), chroma
//               background knocked out, auto-split at the empty column
//               between the figures → <id>-a.webp + <id>-b.webp
//   single    → one figure → <id>-a.webp
// Background: prompted as chroma magenta, sampled from the borders (Gemini
// drifts the hue), globally thresholded to transparency, despeckled,
// trimmed, padded — matching the transparent-bg framing of the approved art.
//
// Usage:
//   GEMINI_API_KEY=...  node scripts/generate-art.mjs [options]
//   (or put GEMINI_API_KEY=... in .env.local — it's gitignored)
//
// Options:
//   --only <id[,id...]>  generate just these exercise ids
//   --force              regenerate even when art already exists
//   --dry-run            list what would be generated, no API calls
//   --model <name>       default: gemini-2.5-flash-image
//   --ref <path>         style-reference image (default: public/rehab/rdl-a.webp)
//
// Review: every run rewrites art-review.html (repo root, gitignored) — open
// it, check each pose against the manifest's ⚠ line, regenerate offenders
// with --only <id> --force.

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import {
  ART_MANIFEST,
  BG_NOTE,
  PAIR_LAYOUT,
  REFERENCE_NOTE,
  SINGLE_LAYOUT,
  STACK_LAYOUT,
  STYLE_PROMPT,
} from './art-manifest.mjs';
import { PROGRAM_EXERCISES } from '../src/workout/program.js';
import { REHAB_EXERCISES } from '../src/workout/rehab.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'public', 'rehab');
const GUIDED = { ...REHAB_EXERCISES, ...PROGRAM_EXERCISES };

// ── args ─────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};
const ONLY = opt('only', '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const FORCE = flag('force');
const DRY = flag('dry-run');
const MODEL = opt('model', 'gemini-2.5-flash-image');
const REF_PATH = resolve(ROOT, opt('ref', 'public/rehab/rdl-a.webp'));

// ── API key: env first, .env.local second (gitignored) ───────────────────────
function apiKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  const envFile = join(ROOT, '.env.local');
  if (existsSync(envFile)) {
    const m = readFileSync(envFile, 'utf8').match(/^GEMINI_API_KEY=(.+)$/m);
    if (m) return m[1].trim();
  }
  return null;
}

const hasArt = (id) =>
  ['svg', 'png', 'webp'].some((ext) =>
    existsSync(join(OUT_DIR, `${id}-a.${ext}`)),
  );

// ── prompt assembly ──────────────────────────────────────────────────────────
function buildPrompt(id) {
  const { scene, a, b, important, stack } = ART_MANIFEST[id];
  const name = GUIDED[id]?.name || id;
  const [first, second] = stack ? ['TOP', 'BOTTOM'] : ['LEFT', 'RIGHT'];
  const body = b
    ? `${stack ? STACK_LAYOUT : PAIR_LAYOUT}

EXERCISE — ${name}: ${scene}.
${first} figure (start position): ${a}.
${second} figure (working position): ${b}.
The two poses must look clearly different at a glance.`
    : `${SINGLE_LAYOUT}

EXERCISE — ${name}: ${scene}.
POSE: ${a}.`;
  return `${STYLE_PROMPT}

${REFERENCE_NOTE}

${BG_NOTE}

${body}${important ? `\nIMPORTANT: ${important}.` : ''}`;
}

// ── Gemini call: reference + prompt in, png buffer out ───────────────────────
async function generateImage(key, prompt, refBuffer, refMime) {
  const body = {
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType: refMime,
              data: refBuffer.toString('base64'),
            },
          },
          { text: prompt },
        ],
      },
    ],
    generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
  };
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: 'POST',
        headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );
    if (res.ok) {
      const json = await res.json();
      const part = json.candidates?.[0]?.content?.parts?.find(
        (p) => p.inlineData?.data,
      );
      if (part) return Buffer.from(part.inlineData.data, 'base64');
      console.warn(`  ⚠ no image in response (attempt ${attempt})`);
    } else {
      const text = await res.text();
      console.warn(
        `  ⚠ HTTP ${res.status} (attempt ${attempt}): ${text.slice(0, 200)}`,
      );
      if (res.status === 400 || res.status === 403) break; // key/config — retrying won't fix
    }
    if (attempt < 3) await new Promise((r) => setTimeout(r, attempt * 4000));
  }
  return null;
}

// ── chroma knockout ──────────────────────────────────────────────────────────
// Gemini never holds the exact #FF00FF, so the key is SAMPLED: the dominant
// border color, accepted only if it's clearly a saturated pink (a beige/white
// drift must NOT be flooded — it would eat the grey-beige ground shadow).
function sampleKey(data, w, h) {
  const counts = new Map();
  const bucket = (i) =>
    `${data[i] >> 4},${data[i + 1] >> 4},${data[i + 2] >> 4}`;
  const tally = (x, y) => {
    const k = bucket((y * w + x) * 4);
    counts.set(k, (counts.get(k) || 0) + 1);
  };
  for (let x = 0; x < w; x++) {
    tally(x, 0);
    tally(x, h - 1);
  }
  for (let y = 1; y < h - 1; y++) {
    tally(0, y);
    tally(w - 1, y);
  }
  const [top] = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const [r, g, b] = top[0].split(',').map((v) => (v << 4) + 8);
  if (!(r - g > 100 && b - g > 50)) return null;
  return [r, g, b];
}

async function knockOut(buffer) {
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const key = sampleKey(data, w, h);
  if (!key) return null;
  const keyDist = (d, i) =>
    Math.max(
      Math.abs(d[i] - key[0]),
      Math.abs(d[i + 1] - key[1]),
      Math.abs(d[i + 2] - key[2]),
    );
  const FLOOD = 70; // definitely background
  const BLEND = 140; // anti-aliased figure edge
  const cleared = new Uint8Array(w * h);
  // Global threshold, not flood-fill: the figure's palette contains no pink
  // by design, and enclosed pockets (under a bridging torso, between legs)
  // must be cleared even though no border path reaches them. Saturated pink
  // ANYWHERE also clears — the model sometimes paints the ground shadow in a
  // second pink that sits outside the sampled key's tolerance.
  const isPink = (d, i) =>
    d[i] - d[i + 1] > 100 && d[i + 2] - d[i + 1] > 50;
  for (let p = 0; p < w * h; p++) {
    if (keyDist(data, p * 4) <= FLOOD || isPink(data, p * 4)) cleared[p] = 1;
  }
  // Despeckle: drop tiny opaque islands (model dust, border specks) — one
  // stray pixel at a corner otherwise defeats the content trim, and orphan
  // crumbs between the two figures would fool the pair split.
  const MIN_ISLAND = Math.max(600, (w * h) / 2000);
  const seen = new Uint8Array(w * h);
  const stack = [];
  for (let p0 = 0; p0 < w * h; p0++) {
    if (cleared[p0] || seen[p0]) continue;
    const comp = [p0];
    seen[p0] = 1;
    stack.push(p0);
    while (stack.length) {
      const p = stack.pop();
      const x = p % w;
      const y = (p / w) | 0;
      for (const q of [
        x > 0 ? p - 1 : -1,
        x < w - 1 ? p + 1 : -1,
        y > 0 ? p - w : -1,
        y < h - 1 ? p + w : -1,
      ]) {
        if (q >= 0 && !cleared[q] && !seen[q]) {
          seen[q] = 1;
          comp.push(q);
          stack.push(q);
        }
      }
    }
    if (comp.length < MIN_ISLAND) {
      for (const p of comp) cleared[p] = 1;
    }
  }
  // Alpha + fringe soften: near-key pixels touching background keep a
  // proportional alpha and lose the pink tint.
  for (let p = 0; p < w * h; p++) {
    const i = p * 4;
    if (cleared[p]) {
      data[i + 3] = 0;
      continue;
    }
    const x = p % w;
    const y = (p / w) | 0;
    const touches =
      (x > 0 && cleared[p - 1]) ||
      (x < w - 1 && cleared[p + 1]) ||
      (y > 0 && cleared[p - w]) ||
      (y < h - 1 && cleared[p + w]);
    if (!touches) continue;
    const d = keyDist(data, i);
    if (d <= BLEND) {
      data[i + 3] = Math.round(
        (255 * Math.max(0, d - FLOOD)) / (BLEND - FLOOD),
      );
      data[i] = data[i + 2] = data[i + 1]; // kill the magenta fringe
    }
  }
  return { data, info: { width: w, height: h, channels: 4 } };
}

// ── pair split: cut at the emptiest column (or row, for stacked pairs) ───────
function splitPair({ data, info }, stack = false) {
  const { width: w, height: h } = info;
  const lanes = stack ? h : w; // lanes run across the cut axis
  const laneSpan = stack ? w : h;
  const opaque = new Uint32Array(lanes);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 0) opaque[stack ? y : x]++;
    }
  }
  let best = -1;
  let bestVal = Number.POSITIVE_INFINITY;
  for (let i = lanes >> 2; i < (3 * lanes) >> 2; i++) {
    if (opaque[i] < bestVal) {
      bestVal = opaque[i];
      best = i;
    }
  }
  // ground shadows may just touch across the midline — allow a whisker
  if (bestVal > laneSpan * 0.04) return null;
  if (stack) {
    const sliceRows = (y0, y1) => ({
      data: data.subarray(y0 * w * 4, y1 * w * 4),
      info: { width: w, height: y1 - y0, channels: 4 },
    });
    return { first: sliceRows(0, best), second: sliceRows(best, h) };
  }
  const sliceCols = (x0, x1) => {
    const sw = x1 - x0;
    const out = Buffer.alloc(sw * h * 4);
    for (let y = 0; y < h; y++) {
      data.copy(out, y * sw * 4, (y * w + x0) * 4, (y * w + x1) * 4);
    }
    return { data: out, info: { width: sw, height: h, channels: 4 } };
  };
  return { first: sliceCols(0, best), second: sliceCols(best, w) };
}

// ── export: trim to content, pad, resize, webp ───────────────────────────────
const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 };
async function exportRaw(raw, file) {
  await sharp(raw.data, { raw: raw.info })
    .trim({ background: CLEAR })
    .extend({ top: 24, bottom: 24, left: 24, right: 24, background: CLEAR })
    .resize({
      width: 1024,
      height: 1280,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 88 })
    .toFile(join(OUT_DIR, file));
}
async function exportOpaque(buffer, file) {
  // knockout found no chroma key — save as-is so the review sheet shows it
  await sharp(buffer)
    .resize({
      width: 1024,
      height: 1280,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 88 })
    .toFile(join(OUT_DIR, file));
}

// ── contact sheet: eyeball form before trusting the art ─────────────────────
function writeReviewSheet() {
  const rows = Object.keys(ART_MANIFEST)
    .filter(hasArt)
    .map((id) => {
      const imgs = readdirSync(OUT_DIR)
        .filter(
          (f) => f.startsWith(`${id}-`) && /-(a|b)\.(svg|png|webp)$/.test(f),
        )
        .sort()
        .map((f) => `<img src="public/rehab/${f}" alt="${f}" title="${f}">`)
        .join('');
      const imp = ART_MANIFEST[id].important
        ? `<p class="imp">⚠ ${ART_MANIFEST[id].important}</p>`
        : '';
      return `<section><h2>${id}</h2>${imp}<div class="pair">${imgs}</div></section>`;
    })
    .join('\n');
  const html = `<!doctype html><meta charset="utf-8"><title>Kilos art review</title>
<style>
  body{font-family:system-ui;background:#222;margin:24px;color:#eee}
  section{margin-bottom:32px;border-bottom:1px solid #444;padding-bottom:24px}
  .pair{display:flex;gap:16px;flex-wrap:wrap}
  img{width:320px;max-width:45vw;border-radius:8px}
  .imp{color:#f9a03f;font-size:14px}
</style>
<h1>Exercise art — check each pose against its ⚠ line</h1>
${rows}`;
  writeFileSync(join(ROOT, 'art-review.html'), html);
}

// ── main ─────────────────────────────────────────────────────────────────────
const targets = Object.keys(ART_MANIFEST).filter((id) => {
  if (ONLY.length) return ONLY.includes(id);
  return FORCE || !hasArt(id);
});

if (!targets.length) {
  console.log('Nothing to generate — all exercises have art. (--force to redo)');
  writeReviewSheet();
  process.exit(0);
}
console.log(
  `${DRY ? '[dry-run] would generate' : 'Generating'} ${targets.length} exercise(s):\n  ${targets.join(', ')}\n`,
);
if (DRY) process.exit(0);

const key = apiKey();
if (!key) {
  console.error(
    'No GEMINI_API_KEY. Export it or add GEMINI_API_KEY=... to .env.local\n' +
      '(get one at https://aistudio.google.com/apikey)',
  );
  process.exit(1);
}
if (!existsSync(REF_PATH)) {
  console.error(`Style reference not found: ${REF_PATH}`);
  process.exit(1);
}

const styleRef = readFileSync(REF_PATH);
const failures = [];
for (const id of targets) {
  const entry = ART_MANIFEST[id];
  console.log(`▸ ${id}`);
  const png = await generateImage(key, buildPrompt(id), styleRef, 'image/webp');
  if (!png) {
    failures.push(id);
    console.warn('  ✗ generation failed');
    continue;
  }
  const cut = await knockOut(png);
  if (!cut) {
    await exportOpaque(png, `${id}-a.webp`);
    failures.push(id);
    console.warn(`  ⚠ ${id}-a.webp — no chroma key found, bg left in (review)`);
    continue;
  }
  if (!entry.b) {
    await exportRaw(cut, `${id}-a.webp`);
    console.log(`  ✓ ${id}-a.webp`);
    continue;
  }
  const pair = splitPair(cut, !!entry.stack);
  if (!pair) {
    await exportRaw(cut, `${id}-a.webp`);
    failures.push(id);
    console.warn(
      `  ⚠ ${id}-a.webp — figures touch, could not split (review + retry)`,
    );
    continue;
  }
  await exportRaw(pair.first, `${id}-a.webp`);
  await exportRaw(pair.second, `${id}-b.webp`);
  console.log(`  ✓ ${id}-a.webp + ${id}-b.webp`);
}

writeReviewSheet();
console.log(
  `\nDone. Review: open art-review.html — check every pose against its ⚠ line,` +
    `\nthen redo any offender with:  npm run art:generate -- --only <id> --force`,
);
if (failures.length) {
  console.warn(`\nNeeds attention: ${failures.join(', ')}`);
  process.exitCode = 1;
}
