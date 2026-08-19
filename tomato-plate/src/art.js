// ─── Flat-vector sprite ─────────────────────────────────────────────────────
// Placeholders standing in for generated art (see DESIGN.md §3 — the real set
// comes from the scripts/art-manifest.mjs pipeline). Style rules hold here too:
// solid fills only, max three colours per item, drawn from the palette.

const s = (id, body, vb = '0 0 60 60') => `<symbol id="a-${id}" viewBox="${vb}">${body}</symbol>`

export const SPRITE = `<svg xmlns="http://www.w3.org/2000/svg" style="display:none" aria-hidden="true"><defs>
${s('logo', `<circle cx="50" cy="50" r="46" fill="#C0442A"/><circle cx="50" cy="50" r="35" fill="#D4553A"/>
<circle cx="50" cy="50" r="27" fill="#C0442A"/>
<path d="M50 26c2 0 3 4 3 7 3-2 6-4 8-2s0 6-2 8c3 0 7 1 7 3s-4 3-7 3c2 2 4 5 2 7s-5 0-8-2c0 3-1 7-3 7s-3-4-3-7c-3 2-6 4-8 2s0-5 2-7c-3 0-7-1-7-3s4-3 7-3c-2-2-4-6-2-8s5 0 8 2c0-3 1-7 3-7z" fill="#2E6B44"/>
<circle cx="50" cy="43" r="4" fill="#4E9060"/>`, '0 0 100 100')}
${s('kamote', `<ellipse cx="30" cy="32" rx="21" ry="14" transform="rotate(-18 30 32)" fill="#D4763C"/><ellipse cx="24" cy="28" rx="6" ry="4" transform="rotate(-18 24 28)" fill="#E09355"/>`)}
${s('carrot', `<path d="M30 54 18 20c-1-4 4-8 12-8s13 4 12 8z" fill="#E9963E"/><path d="M30 48 24 24c4-1 8-1 12 0z" fill="#F0AB5E"/><path d="M30 12c-3-6-9-6-11-2 4 0 6 2 7 4zM30 12c3-6 9-6 11-2-4 0-6 2-7 4z" fill="#2E6B44"/>`)}
${s('kalabasa', `<ellipse cx="30" cy="35" rx="22" ry="18" fill="#E9963E"/><ellipse cx="30" cy="35" rx="8" ry="18" fill="#F0AB5E"/><ellipse cx="15" cy="35" rx="6" ry="15" fill="#DD8630"/><ellipse cx="45" cy="35" rx="6" ry="15" fill="#DD8630"/><rect x="27" y="12" width="6" height="9" rx="2" fill="#2E6B44"/>`)}
${s('sayote', `<path d="M30 10c11 0 17 10 17 22 0 12-7 18-17 18s-17-6-17-18c0-12 6-22 17-22z" fill="#9FBF6A"/><path d="M30 18c6 0 10 8 10 16 0 8-4 12-10 12s-10-4-10-12c0-8 4-16 10-16z" fill="#B8D188"/>`)}
${s('chicken', `<ellipse cx="30" cy="34" rx="19" ry="14" fill="#E8C9A0"/><ellipse cx="25" cy="30" rx="7" ry="5" fill="#F2DCBE"/><path d="M44 24c4-3 8-1 7 2s-5 4-8 3z" fill="#D9B187"/>`)}
${s('avocado', `<path d="M30 8c11 0 19 12 19 26 0 11-8 18-19 18s-19-7-19-18C11 20 19 8 30 8z" fill="#2E6B44"/><path d="M30 14c8 0 14 10 14 21 0 8-6 13-14 13s-14-5-14-13c0-11 6-21 14-21z" fill="#9FBF6A"/><ellipse cx="30" cy="34" rx="8" ry="9" fill="#8A5A2B"/>`)}
${s('liver', `<path d="M12 26c6-10 22-12 32-6 6 4 6 14 0 20-8 8-24 8-31 0-3-4-3-10-1-14z" fill="#9A3520"/><path d="M20 28c5-5 14-6 20-2-4 6-14 8-20 2z" fill="#B84A33"/>`)}
${s('banana', `<path d="M14 16c2 18 14 30 32 30 3 0 5-3 3-5-14-3-24-12-27-26-1-3-8-2-8 1z" fill="#F0C64E"/><path d="M18 20c3 14 12 22 24 25-12 0-22-9-24-25z" fill="#E0B03A"/>`)}
${s('papaya', `<path d="M30 8c12 0 20 12 20 24s-8 20-20 20-20-8-20-20S18 8 30 8z" fill="#E9963E"/><path d="M30 16c8 0 13 8 13 16s-5 13-13 13-13-5-13-13 5-16 13-16z" fill="#F2B266"/><g fill="#3A3684"><circle cx="30" cy="30" r="2.5"/><circle cx="26" cy="36" r="2.5"/><circle cx="34" cy="36" r="2.5"/><circle cx="30" cy="41" r="2.5"/></g>`)}
${s('egg', `<ellipse cx="30" cy="32" rx="19" ry="23" fill="#FCF6E9"/><circle cx="30" cy="33" r="10" fill="#E9963E"/><circle cx="27" cy="30" r="3.5" fill="#F2B266"/>`)}
${s('peanut', `<path d="M30 12c7 0 11 5 11 10 0 4-2 6-2 9s2 5 2 9c0 6-5 11-11 11s-11-5-11-11c0-4 2-6 2-9s-2-5-2-9c0-5 4-10 11-10z" fill="#D9A05B"/><circle cx="27" cy="22" r="3" fill="#C08840"/><circle cx="33" cy="41" r="3" fill="#C08840"/>`)}
${s('malunggay', `<path d="M30 52V14" stroke="#2E6B44" stroke-width="3"/><g fill="#4E9060"><ellipse cx="21" cy="22" rx="7" ry="5"/><ellipse cx="39" cy="27" rx="7" ry="5"/><ellipse cx="21" cy="34" rx="7" ry="5"/><ellipse cx="39" cy="40" rx="7" ry="5"/><ellipse cx="30" cy="14" rx="6" ry="5"/></g>`)}
${s('fish', `<path d="M10 30c8-9 24-11 34-4l6-5-1 9 1 9-6-5C34 41 18 39 10 30z" fill="#7C93A8"/><circle cx="38" cy="27" r="2.5" fill="#2A1E19"/><path d="M22 24c4 4 4 8 0 12" stroke="#5F7488" stroke-width="2" fill="none"/>`)}
${s('meat', `<path d="M14 24c4-8 16-11 26-7 8 3 9 13 3 19-7 7-21 7-28 0-3-3-3-8-1-12z" fill="#B84A33"/><path d="M22 26c5-4 13-5 18-1-4 5-13 7-18 1z" fill="#D06A4E"/>`)}
${s('yogurt', `<path d="M16 20h28l-3 28a4 4 0 0 1-4 4H23a4 4 0 0 1-4-4z" fill="#FCF6E9"/><rect x="14" y="14" width="32" height="8" rx="3" fill="#3A3684"/>`)}
${s('oats', `<ellipse cx="30" cy="38" rx="20" ry="11" fill="#E8C9A0"/><ellipse cx="30" cy="35" rx="20" ry="11" fill="#F2DCBE"/><g fill="#D9A05B"><ellipse cx="24" cy="33" rx="4" ry="2.5"/><ellipse cx="35" cy="36" rx="4" ry="2.5"/><ellipse cx="30" cy="30" rx="4" ry="2.5"/></g>`)}
${s('pasta', `<g fill="#F0C64E"><rect x="12" y="22" width="36" height="7" rx="3.5"/><rect x="12" y="32" width="36" height="7" rx="3.5"/><rect x="16" y="42" width="28" height="7" rx="3.5"/></g><rect x="12" y="22" width="36" height="7" rx="3.5" fill="#E0B03A"/>`)}
${s('tofu', `<rect x="14" y="20" width="32" height="26" rx="4" fill="#FCF6E9"/><rect x="14" y="20" width="32" height="9" rx="4" fill="#F4E9D6"/><rect x="30" y="20" width="2" height="26" fill="#EDDFC6"/>`)}
${s('tahini', `<path d="M18 22h24l-2 26a4 4 0 0 1-4 4H24a4 4 0 0 1-4-4z" fill="#E8C9A0"/><rect x="16" y="16" width="28" height="8" rx="3" fill="#8A5A2B"/>`)}
${s('nut', `<path d="M30 10c10 0 16 8 16 18 0 12-7 22-16 22s-16-10-16-22c0-10 6-18 16-18z" fill="#D9A05B"/><path d="M30 18c6 0 9 6 9 12 0 8-4 14-9 14s-9-6-9-14c0-6 3-12 9-12z" fill="#C08840"/>`)}
${s('shrimp', `<path d="M42 16c-14 0-24 8-24 18 0 8 7 12 14 12 3 0 5-2 5-4s-2-3-4-3c-4 0-7-2-7-6 0-6 7-11 16-11z" fill="#E8845E"/><circle cx="41" cy="20" r="2.5" fill="#2A1E19"/>`)}
${s('monggo', `<g fill="#4E9060"><ellipse cx="22" cy="28" rx="7" ry="5" transform="rotate(-20 22 28)"/><ellipse cx="36" cy="26" rx="7" ry="5" transform="rotate(15 36 26)"/><ellipse cx="28" cy="38" rx="7" ry="5" transform="rotate(-8 28 38)"/><ellipse cx="40" cy="38" rx="7" ry="5" transform="rotate(25 40 38)"/></g>`)}
${s('mango', `<path d="M38 12c8 4 12 14 8 24-4 11-16 17-24 13-7-4-8-14-4-23 4-10 12-17 20-14z" fill="#E9963E"/><path d="M36 20c4 3 5 10 2 16-3 6-9 9-13 7 6-2 10-8 11-14 0-4 0-7 0-9z" fill="#F0AB5E"/>`)}
${s('lugaw', `<ellipse cx="30" cy="40" rx="22" ry="10" fill="#EDDFC6"/><ellipse cx="30" cy="36" rx="22" ry="10" fill="#FCF6E9"/><path d="M18 34c6-4 18-4 24 0" stroke="#EDDFC6" stroke-width="2.5" fill="none"/>`)}
${s('cut-puree', `<ellipse cx="30" cy="30" rx="21" ry="9" fill="#D4763C"/><ellipse cx="30" cy="27" rx="21" ry="9" fill="#E09355"/><path d="M19 25c6-3 16-3 22 0" stroke="#D4763C" stroke-width="2" fill="none"/>`, '0 0 60 44')}
${s('cut-mash', `<ellipse cx="30" cy="31" rx="21" ry="9" fill="#D4763C"/><ellipse cx="30" cy="28" rx="21" ry="9" fill="#E09355"/><circle cx="22" cy="26" r="3" fill="#D4763C"/><circle cx="32" cy="29" r="3.5" fill="#D4763C"/><circle cx="39" cy="25" r="2.5" fill="#D4763C"/>`, '0 0 60 44')}
${s('cut-baton', `<rect x="10" y="10" width="10" height="26" rx="5" fill="#D4763C"/><rect x="25" y="10" width="10" height="26" rx="5" fill="#E09355"/><rect x="40" y="10" width="10" height="26" rx="5" fill="#D4763C"/>`, '0 0 60 44')}
${s('cut-cube', `<rect x="12" y="11" width="11" height="11" rx="3" fill="#D4763C"/><rect x="27" y="17" width="11" height="11" rx="3" fill="#E09355"/><rect x="40" y="10" width="11" height="11" rx="3" fill="#D4763C"/><rect x="20" y="26" width="11" height="11" rx="3" fill="#E09355"/>`, '0 0 60 44')}
${s('cut-spear', `<path d="M14 34c6-16 20-24 32-24 2 0 3 2 1 4-10 6-18 14-22 24-1 3-12 0-11-4z" fill="#F0C64E"/>`, '0 0 60 44')}
${s('cut-flake', `<g fill="#7C93A8"><ellipse cx="20" cy="20" rx="9" ry="5" transform="rotate(-15 20 20)"/><ellipse cx="38" cy="24" rx="9" ry="5" transform="rotate(12 38 24)"/><ellipse cx="28" cy="32" rx="9" ry="5" transform="rotate(-6 28 32)"/></g>`, '0 0 60 44')}
${s('cut-none', `<circle cx="30" cy="22" r="15" fill="none" stroke="#D8CBB6" stroke-width="3" stroke-dasharray="5 5"/>`, '0 0 60 44')}

${s('s-cut', `<path d="M4 17 17 4l3 3L7 20z" fill="none" stroke="#0F4A35" stroke-width="1.8" stroke-linejoin="round"/><path d="M14 7l3 3" stroke="#0F4A35" stroke-width="1.8"/>`, '0 0 24 24')}
${s('s-heat', `<path d="M4 11h16v5a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" fill="none" stroke="#0F4A35" stroke-width="1.8"/><path d="M9 7c0-1.5 1.5-1.5 1.5-3M14 7c0-1.5 1.5-1.5 1.5-3" stroke="#0F4A35" stroke-width="1.6" stroke-linecap="round"/>`, '0 0 24 24')}
${s('s-blend', `<path d="M7 4h10l-1.5 12a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2z" fill="none" stroke="#0F4A35" stroke-width="1.8" stroke-linejoin="round"/><path d="M8 21h8" stroke="#0F4A35" stroke-width="1.8" stroke-linecap="round"/><path d="M9 9h6" stroke="#0F4A35" stroke-width="1.4"/>`, '0 0 24 24')}
${s('s-mash', `<path d="M7 3v7M11 3v7M15 3v7" stroke="#0F4A35" stroke-width="1.8" stroke-linecap="round"/><path d="M5 10h12v2a3 3 0 0 1-3 3h-6a3 3 0 0 1-3-3z" fill="none" stroke="#0F4A35" stroke-width="1.8"/><path d="M11 15v6" stroke="#0F4A35" stroke-width="1.8" stroke-linecap="round"/>`, '0 0 24 24')}
${s('s-thin', `<path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z" fill="none" stroke="#0F4A35" stroke-width="1.8" stroke-linejoin="round"/>`, '0 0 24 24')}
${s('s-cool', `<path d="M3 9c3-3 6 3 9 0s6-3 9 0M3 16c3-3 6 3 9 0s6-3 9 0" fill="none" stroke="#0F4A35" stroke-width="1.8" stroke-linecap="round"/>`, '0 0 24 24')}
${s('s-check', `<circle cx="10" cy="10" r="6.5" fill="none" stroke="#C0442A" stroke-width="1.8"/><path d="M15 15l5 5" stroke="#C0442A" stroke-width="1.8" stroke-linecap="round"/><path d="M7.5 10l2 2 3.5-4" fill="none" stroke="#C0442A" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>`, '0 0 24 24')}
${s('s-soak', `<path d="M4 12h16v4a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" fill="none" stroke="#0F4A35" stroke-width="1.8"/><path d="M4 15c3-2 5 2 8 0s5-2 8 0" fill="none" stroke="#0F4A35" stroke-width="1.5"/><path d="M17 7a3.2 3.2 0 1 1-3.6-3.2A2.6 2.6 0 0 0 17 7z" fill="#0F4A35"/>`, '0 0 24 24')}
${s('s-stir', `<circle cx="12" cy="13" r="7.5" fill="none" stroke="#0F4A35" stroke-width="1.8"/><path d="M15 3l-4 9" stroke="#0F4A35" stroke-width="1.8" stroke-linecap="round"/>`, '0 0 24 24')}
${s('s-aside', `<rect x="3" y="8" width="8" height="9" rx="2" fill="none" stroke="#0F4A35" stroke-width="1.8"/><rect x="14" y="5" width="7" height="7" rx="2" fill="#0F4A35" opacity=".85"/><path d="M14 19h7" stroke="#0F4A35" stroke-width="1.6" stroke-linecap="round"/>`, '0 0 24 24')}
${s('s-dot', `<circle cx="12" cy="12" r="4" fill="#0F4A35" opacity=".5"/>`, '0 0 24 24')}
</defs></svg>`

// Which cut-state glyph a serving description implies.
export function cutGlyph(text = '') {
  const t = text.toLowerCase()
  if (/not yet|never|^—$|^-$/.test(t)) return 'cut-none'
  if (/baton|stick/.test(t)) return 'cut-baton'
  if (/spear|wedge|strip/.test(t)) return 'cut-spear'
  if (/cube|piece|chunk/.test(t)) return 'cut-cube'
  if (/flake|shred|minced/.test(t)) return 'cut-flake'
  if (/mash|lump|coarse/.test(t)) return 'cut-mash'
  return 'cut-puree'
}

/** Which action a prep step is — order matters, most specific first. */
export function stepGlyph(text = '') {
  const t = text.toLowerCase()
  // Order is the whole trick: "cooking water" must not read as cooking, and
  // "mash, thinning with…" is a mash, not a thin.
  if (/soak/.test(t)) return 's-soak'
  if (/bone|devein|shell completely/.test(t)) return 's-check'
  if (/set aside|keep the cooking water/.test(t)) return 's-aside'
  if (/peel|cut into|trim|chop|slice/.test(t)) return 's-cut'
  if (/\bmash/.test(t)) return 's-mash'
  if (/\bblend/.test(t)) return 's-blend'
  if (/thin|loosen|hot water/.test(t)) return 's-thin'
  if (/boil|steam|simmer|poach|cooked through|cook it/.test(t)) return 's-heat'
  if (/cool|lukewarm|wrist/.test(t)) return 's-cool'
  if (/stir|mix|serve|offer|start with/.test(t)) return 's-stir'
  return 's-dot'
}

export const icon = (id, size = 40, cls = '') =>
  `<svg class="ic ${cls}" width="${size}" height="${size}" aria-hidden="true"><use href="#a-${id}"/></svg>`
