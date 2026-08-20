// Inline the woff2 faces into each artboard source (no network egress in the
// canvas iframe, so fonts must ride as data: URIs).
//   node build.mjs

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const b64 = (f) => readFileSync(join(ROOT, 'assets', f)).toString('base64');

const FONTS = `
    @font-face {
      font-family: 'Fraunces';
      font-style: normal;
      font-weight: 500 600;
      font-display: swap;
      src: url(data:font/woff2;base64,${b64('fraunces.woff2')}) format('woff2');
    }
    @font-face {
      font-family: 'Public Sans';
      font-style: normal;
      font-weight: 400 600;
      font-display: swap;
      src: url(data:font/woff2;base64,${b64('publicsans.woff2')}) format('woff2');
    }`;

let n = 0;
for (const file of readdirSync(join(ROOT, 'src')).filter((f) => f.endsWith('.html'))) {
  const src = readFileSync(join(ROOT, 'src', file), 'utf8');
  if (!src.includes('@@FONTS@@')) throw new Error(`${file}: missing @@FONTS@@ placeholder`);
  const out = file.replace(/\.html$/, '.dc.html');
  writeFileSync(join(ROOT, out), src.replace('@@FONTS@@', FONTS.trim()));
  n++;
}
console.log(`built ${n} artboards with embedded fonts`);
