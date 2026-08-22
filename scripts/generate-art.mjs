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

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { PROGRAM_EXERCISES } from '../src/workout/program.js';
import { REHAB_EXERCISES } from '../src/workout/rehab.js';
import { HOTMUM_EXERCISES } from '../src/hotmum/program.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// ── packs ────────────────────────────────────────────────────────────────────
// Same pipeline, two catalogues. `kilos` is Gabe's guided player (a man, grey
// on black); `hotmum` is Sam's (a woman, magenta on plum) — see
// hotmum-art-manifest.mjs. The prompts, the character and the output dir all
// come from the pack; everything below this line is pack-agnostic.
const PACKS = {
  kilos: {
    manifest: './art-manifest.mjs',
    dir: 'rehab',
    exercises: { ...REHAB_EXERCISES, ...PROGRAM_EXERCISES },
    ref: 'public/rehab/rdl-a.webp',
    chroma: 'magenta',
  },
  hotmum: {
    manifest: './hotmum-art-manifest.mjs',
    dir: 'hotmum-art',
    exercises: HOTMUM_EXERCISES,
    // Seeds off a KILOS image for the RENDERING STYLE only — her manifest's
    // REFERENCE_NOTE is written to stop the reference overriding the
    // character. Once a good female figure exists, pass --ref <that file> so
    // the rest of the catalogue matches it exactly.
    ref: 'public/rehab/rdl-a.webp',
    chroma: 'green',
  },
};

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
// Nano Banana Pro: ~3× the price of gemini-2.5-flash-image but decisively
// better at equipment (cable machines, benches, boxes) and pose instructions
// — flash failed ~half the catalog, pro passed the hardest cases first try.
// If this preview id is ever retired, fall back with --model.
const MODEL = opt('model', 'gemini-3-pro-image-preview');
const SIZE = opt('size', '2K'); // 1K | 2K | 4K — see generateImage
const PACK = opt('pack', 'kilos');
if (!PACKS[PACK]) {
  console.error(`Unknown --pack ${PACK}. Try: ${Object.keys(PACKS).join(', ')}`);
  process.exit(1);
}
const {
  ART_MANIFEST,
  BG_NOTE,
  PAIR_LAYOUT,
  REFERENCE_NOTE,
  SINGLE_LAYOUT,
  STACK_LAYOUT,
  STYLE_PROMPT,
} = await import(PACKS[PACK].manifest);
const GUIDED = PACKS[PACK].exercises;
const OUT_DIR = join(ROOT, 'public', PACKS[PACK].dir);
mkdirSync(OUT_DIR, { recursive: true });
const REF_PATH = resolve(ROOT, opt('ref', PACKS[PACK].ref));

// ── the chroma key ──────────────────────────────────────────────────────────
// KILOS knocks out magenta; HOTMUM can't, because her kit IS magenta — it
// keys green instead. `cast` is "how far toward the key colour is this pixel",
// used both to clear background the sampled key missed and to measure how much
// of the FIGURE the key has stained (a bad roll bleeds the key into the edges).
const CHROMAS = {
  magenta: {
    // high red AND blue, starved green
    cast: (d, i) => Math.min(d[i], d[i + 2]) - d[i + 1],
    saturated: (d, i) => d[i] - d[i + 1] > 100 && d[i + 2] - d[i + 1] > 50,
  },
  green: {
    // high green, starved red AND blue
    cast: (d, i) => d[i + 1] - Math.max(d[i], d[i + 2]),
    saturated: (d, i) => d[i + 1] - d[i] > 90 && d[i + 1] - d[i + 2] > 60,
  },
};
const CHROMA = CHROMAS[PACKS[PACK].chroma];

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
  const { scene, a, b, important, stack, view } = ART_MANIFEST[id];
  const name = GUIDED[id]?.name || id;
  // a per-exercise camera override (e.g. frontal moves that don't read in
  // profile) — stated after the style block so the specific wins
  const viewNote = view ? `\nVIEW for this exercise (overrides the default): ${view}.` : '';
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
  return `${STYLE_PROMPT}${viewNote}

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
    // Without imageConfig the model returns 1408×768. A side-by-side pair then
    // splits into two ~600px figures — already upscaled at 1x in the player's
    // laptop layout, and ~3x on a retina panel. 2K returns 2816×1536, so each
    // split figure lands ~1200-1400px and nothing is ever enlarged. 4K works
    // too but is a 5MB JPEG per call for detail this flat art doesn't carry.
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: { imageSize: SIZE },
    },
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
  const rgb = top[0].split(',').map((v) => (v << 4) + 8);
  // The commonest border colour has to actually BE the key — otherwise the
  // model ignored the background instruction and knocking out would eat the
  // figure. Pack-specific: KILOS keys magenta, HOTMUM keys green.
  if (!CHROMA.saturated(rgb, 0)) return null;
  return rgb;
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
  // by design (see each manifest's BG_NOTE), and enclosed pockets (under a
  // must be cleared even though no border path reaches them. Saturated pink
  // ANYWHERE also clears — the model sometimes paints the ground shadow in a
  // second pink that sits outside the sampled key's tolerance.
  for (let p = 0; p < w * h; p++) {
    if (keyDist(data, p * 4) <= FLOOD || CHROMA.saturated(data, p * 4))
      cleared[p] = 1;
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
  // Alpha ramp: near-key pixels touching background keep a proportional alpha
  // so the silhouette stays anti-aliased instead of stair-stepping.
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
    }
  }
  // De-fringe here (the split and the trim both want clean colour); the bleed
  // runs last, in exportRaw, because `trim` keys on fully-transparent pixels
  // and would stop working once there's colour under them.
  deFringe(data, w, h);
  return { data, info: { width: w, height: h, channels: 4 } };
}

// ── the two passes that keep magenta out of the finished file ────────────────
// Between them these fix the violet halo the art carried until 2026-08.
// It had two sources, and killing only one leaves it visible:
//
//   1. Gemini returns JPEG. Lossy DCT smears the #FF00FF background INTO the
//      figure's own opaque edge pixels before the knockout ever sees them, so
//      clearing the background can't remove it — those pixels are the figure.
//   2. Clearing a pixel only sets alpha to 0; its RGB stayed magenta. Our own
//      lossy webp encode then smeared that back out over the silhouette,
//      because webp compresses colour in blocks with no regard for alpha.
//
// A cast toward pink is unambiguous here: the palette (skin, grey, charcoal,
// white) contains no pink by design, so anything pink is contamination.

const pinkCast = (d, i) => CHROMA.cast(d, i);

// (1) Repaint contaminated figure pixels from their clean neighbours.
function deFringe(data, w, h, tint = 10, radius = 4, rounds = 5) {
  for (let round = 0; round < rounds; round++) {
    const fix = [];
    for (let p = 0; p < w * h; p++) {
      const i = p * 4;
      if (data[i + 3] === 0) continue;
      if (pinkCast(data, i) > tint) fix.push(p);
    }
    if (!fix.length) return;
    const patch = new Map();
    for (const p of fix) {
      const x = p % w;
      const y = (p / w) | 0;
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -radius; dx <= radius; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          const j = (yy * w + xx) * 4;
          // only opaque, uncontaminated pixels are trustworthy sources
          if (data[j + 3] > 200 && pinkCast(data, j) <= tint) {
            r += data[j];
            g += data[j + 1];
            b += data[j + 2];
            n++;
          }
        }
      }
      if (n) patch.set(p, [(r / n) | 0, (g / n) | 0, (b / n) | 0]);
    }
    if (!patch.size) return; // nothing clean left to sample — stop, don't grey it out
    for (const [p, c] of patch) {
      const i = p * 4;
      data[i] = c[0];
      data[i + 1] = c[1];
      data[i + 2] = c[2];
    }
  }
}

// (2) Push the figure's edge colour outward UNDER the transparency, so the
// webp encoder has neutral colour to smear instead of magenta. Alpha is never
// touched — this is invisible on its own and only matters at encode time.
// A frontier walk, not a full-image pass: cost is perimeter × depth, which
// matters at 2K where a naive scan over 4M pixels per iteration would crawl.
function bleedUnderAlpha(data, w, h, depth = 24) {
  const known = new Uint8Array(w * h);
  let frontier = [];
  for (let p = 0; p < w * h; p++) {
    if (data[p * 4 + 3] > 0) {
      known[p] = 1;
      frontier.push(p);
    }
  }
  for (let step = 0; step < depth && frontier.length; step++) {
    const next = [];
    const patch = new Map();
    for (const p of frontier) {
      const x = p % w;
      const y = (p / w) | 0;
      for (const q of [
        x > 0 ? p - 1 : -1,
        x < w - 1 ? p + 1 : -1,
        y > 0 ? p - w : -1,
        y < h - 1 ? p + w : -1,
      ]) {
        if (q < 0 || known[q] || patch.has(q)) continue;
        const qx = q % w;
        const qy = (q / w) | 0;
        let r = 0;
        let g = 0;
        let b = 0;
        let n = 0;
        for (const s of [
          qx > 0 ? q - 1 : -1,
          qx < w - 1 ? q + 1 : -1,
          qy > 0 ? q - w : -1,
          qy < h - 1 ? q + w : -1,
        ]) {
          if (s >= 0 && known[s]) {
            const j = s * 4;
            r += data[j];
            g += data[j + 1];
            b += data[j + 2];
            n++;
          }
        }
        if (n) patch.set(q, [(r / n) | 0, (g / n) | 0, (b / n) | 0]);
      }
    }
    for (const [q, c] of patch) {
      const j = q * 4;
      data[j] = c[0];
      data[j + 1] = c[1];
      data[j + 2] = c[2];
      known[q] = 1;
      next.push(q);
    }
    frontier = next;
  }
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
  // both halves must actually contain a figure — a cut above/below both
  // figures produces one blank half and one double half
  let firstOpaque = 0;
  let total = 0;
  for (let i = 0; i < lanes; i++) {
    total += opaque[i];
    if (i < best) firstOpaque += opaque[i];
  }
  if (firstOpaque < total * 0.2 || firstOpaque > total * 0.8) return null;
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
// The player's laptop layout draws the figure in a ~628px CSS box, which is
// ~1256 device px on a retina panel. 1400 clears that without paying for
// detail nobody sees; `withoutEnlargement` means a smaller crop stays honest.
const EXPORT_MAX = Number(opt('max', '1400'));
const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 };
async function exportRaw(raw, file) {
  // Shape it first. sharp premultiplies alpha when resizing, so whatever sits
  // under the transparency contributes nothing here.
  const shaped = await sharp(raw.data, { raw: raw.info })
    .trim({ background: CLEAR })
    .extend({ top: 24, bottom: 24, left: 24, right: 24, background: CLEAR })
    .resize({
      width: EXPORT_MAX,
      height: EXPORT_MAX,
      fit: 'inside',
      withoutEnlargement: true, // never fake detail the model didn't draw
    })
    .raw()
    .toBuffer({ resolveWithObject: true });
  // Then, at final size and immediately before the encoder runs, give it
  // neutral colour under the alpha instead of magenta.
  const stain = magentaShare(shaped.data, shaped.info.width, shaped.info.height);
  bleedUnderAlpha(shaped.data, shaped.info.width, shaped.info.height);
  await sharp(shaped.data, {
    raw: { ...shaped.info, channels: 4 },
  })
    .webp({ quality: 86, alphaQuality: 100, effort: 6 })
    .toFile(join(OUT_DIR, file));
  return stain;
}

// A bad roll — the model drawing a half-formed extra figure that dissolves into
// the chroma background — lands as a large PINK region the knockout can't
// clear, because it isn't close enough to the key to flood and isn't saturated
// enough to trip isPink. Nothing upstream catches it: the split still
// "succeeds" and the file still writes, so the run reports ✓ on art that is
// visibly broken. Measure the finished pixels and say so.
// Purple bands and cable stacks are real artwork, hence a share threshold
// rather than a flat count — they sit under 1.5%, a ghost figure runs 2-20%.
const STAIN_LIMIT = 0.018;
function magentaShare(data, w, h) {
  let opaque = 0;
  let pink = 0;
  for (let p = 0; p < w * h; p++) {
    const i = p * 4;
    if (data[i + 3] <= 200) continue;
    opaque++;
    if (pinkCast(data, i) > 40) pink++;
  }
  return opaque ? pink / opaque : 0;
}
async function exportOpaque(buffer, file) {
  // knockout found no chroma key — save as-is so the review sheet shows it
  await sharp(buffer)
    .resize({
      width: EXPORT_MAX,
      height: EXPORT_MAX,
      fit: 'inside',
      withoutEnlargement: true, // never fake detail the model didn't draw
    })
    .webp({ quality: 86, alphaQuality: 100, effort: 6 })
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
    const stain = await exportRaw(cut, `${id}-a.webp`);
    if (stain > STAIN_LIMIT) {
      failures.push(id);
      console.warn(
        `  ⚠ ${id}-a.webp — ${(stain * 100).toFixed(1)}% of the figure is chroma stain (bad roll, re-run)`,
      );
    } else {
      console.log(`  ✓ ${id}-a.webp`);
    }
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
  const stainA = await exportRaw(pair.first, `${id}-a.webp`);
  const stainB = await exportRaw(pair.second, `${id}-b.webp`);
  const stain = Math.max(stainA, stainB);
  if (stain > STAIN_LIMIT) {
    failures.push(id);
    console.warn(
      `  ⚠ ${id}-a/b.webp — ${(stain * 100).toFixed(1)}% of the figure is chroma stain (bad roll, re-run)`,
    );
  } else {
    console.log(`  ✓ ${id}-a.webp + ${id}-b.webp`);
  }
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
