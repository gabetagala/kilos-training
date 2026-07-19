#!/usr/bin/env node
// Design-system guardrail (DESIGN.md). Runs in pre-commit + CI via `lint:design`.
//
// Philosophy (matches DESIGN.md A2): the 12px floor governs DATA the athlete
// reads mid-set — enforced through the .t-data/.t-hero/.t-display/.t-title/.t-body
// scale classes, which MUST be ≥12px. Tracked Space-Mono micro-labels may sit at
// 9px as a deliberate editorial device, so existing sub-12px label declarations
// are REPORTED as migration debt, not failed. A hard floor catches truly
// unreadable text. Off-scale radii are reported toward the 8/14/999 collapse.

import { readFileSync } from 'node:fs';

const FLOOR_PX = 8; // hard fail below this — nothing should be unreadable
const DATA_FLOOR_PX = 12; // the scale's data classes must meet this
const SCALE_DATA = ['t-hero', 't-display', 't-title', 't-body', 't-data'];
const RADIUS_SCALE = new Set([8, 14, 999]); // --r-sm / --r-md / --r-pill

const read = (p) => {
  try {
    return readFileSync(p, 'utf8');
  } catch {
    return '';
  }
};
const css = read('src/style.css');
const html = read('index.html');

const errors = [];
const warnings = [];
const subFloorLabels = [];

// 1) Hard floor on every font-size:Npx in CSS + inline HTML styles.
for (const [name, text] of [
  ['style.css', css],
  ['index.html', html],
]) {
  for (const mm of text.matchAll(/font-size:\s*([\d.]+)px/g)) {
    const px = parseFloat(mm[1]);
    if (px < FLOOR_PX) {
      errors.push(`${name}: font-size ${px}px is below the ${FLOOR_PX}px hard floor`);
    } else if (px < DATA_FLOOR_PX) {
      subFloorLabels.push(px);
    }
  }
}

// 2) The scale's DATA classes must be ≥ the 12px floor.
for (const cls of SCALE_DATA) {
  const m = css.match(
    new RegExp(`\\.${cls}\\s*\\{[^}]*?font-size:\\s*([\\d.]+)px`),
  );
  if (m && parseFloat(m[1]) < DATA_FLOOR_PX) {
    errors.push(
      `.${cls} is ${m[1]}px — scale data classes must be ≥${DATA_FLOOR_PX}px (DESIGN.md A2)`,
    );
  }
}

// 3) Off-scale radii — reported as migration debt toward 8/14/999.
const radii = [...css.matchAll(/border-radius:\s*([\d.]+)px/g)].map((m) =>
  parseFloat(m[1]),
);
const offScale = [...new Set(radii.filter((r) => !RADIUS_SCALE.has(r)))].sort(
  (a, b) => a - b,
);

if (subFloorLabels.length) {
  warnings.push(
    `${subFloorLabels.length} sub-${DATA_FLOOR_PX}px font-size declarations — fine for Space-Mono micro-labels (.t-micro); move any DATA to .t-data.`,
  );
}
if (offScale.length) {
  warnings.push(
    `Off-scale radii (migrate toward --r-sm/md/pill = 8/14/999): ${offScale.join(', ')}px`,
  );
}

for (const w of warnings) console.log(`  • ${w}`);

if (errors.length) {
  console.error('\n✗ Design-system check failed:');
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}

console.log(
  `✓ Design-system check passed — hard floor ${FLOOR_PX}px; ${SCALE_DATA.length} data classes ≥${DATA_FLOOR_PX}px.`,
);
