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
${s('kamote', `<ellipse cx="30" cy="52" rx="19" ry="3.4" fill="#00000012"/>
<path d="M11 34c-3-8 4-16 15-18 12-2 22 3 24 10 2 8-6 15-17 16-10 1-19-2-22-8z" fill="#C97038"/>
<path d="M15 32c-1-5 5-10 13-11 9-1 16 2 18 7-9-1-22 0-31 4z" fill="#DE8A50"/>
<path d="M9 33c-3-2-5-5-4-7 3-1 6 1 7 4zM50 25c3-3 7-3 8-1-1 3-4 5-7 4z" fill="#9C5427"/>
<path d="M27 15c-1-5 2-9 6-10 1 4-1 8-4 10z" fill="#3F7A4E"/>`)}
${s('carrot', `<ellipse cx="30" cy="53" rx="13" ry="3.4" fill="#00000012"/>
<path d="M30 52c-2 0-3-2-4-5l-6-27c-1-4 4-7 10-7s11 3 10 7l-6 27c-1 3-2 5-4 5z" fill="#E9963E"/>
<path d="M26 20c3-1 5-1 8 0l-4 26z" fill="#F4B472"/>
<g stroke="#CF7C29" stroke-width="1.3" stroke-linecap="round"><path d="M23 22h5M32 26h5M25 31h4M31 36h4"/></g>
<path d="M30 13c-2-6 1-10 5-11 1 5-1 9-3 11zM30 13c-3-5-7-6-10-4 2 4 6 6 9 5zM30 13c1-6 5-8 8-7-1 4-4 7-7 7z" fill="#3F7A4E"/>`)}
${s('kalabasa', `<ellipse cx="30" cy="52" rx="20" ry="3.4" fill="#00000012"/>
<ellipse cx="30" cy="36" rx="22" ry="16" fill="#E08A32"/>
<ellipse cx="30" cy="36" rx="9" ry="16" fill="#F2A957"/>
<ellipse cx="14" cy="36" rx="6.5" ry="13.5" fill="#CE7A26"/>
<ellipse cx="46" cy="36" rx="6.5" ry="13.5" fill="#CE7A26"/>
<path d="M27 20h6l-1 4h-4z" fill="#4A6B2E"/><rect x="26" y="14" width="8" height="8" rx="3" fill="#3F7A4E"/>
<path d="M36 17c5-3 9-1 9 2-3 2-7 2-9-2z" fill="#4E9060"/>`)}
${s('sayote', `<ellipse cx="30" cy="52" rx="15" ry="3.4" fill="#00000012"/>
<path d="M30 12c11 0 18 11 18 22 0 11-7 18-18 18s-18-7-18-18c0-11 7-22 18-22z" fill="#8FB35C"/>
<path d="M30 18c6 0 11 8 11 17 0 8-4 12-11 12s-11-4-11-12c0-9 5-17 11-17z" fill="#A9C97C"/>
<g stroke="#7A9C4A" stroke-width="1.6" stroke-linecap="round" fill="none"><path d="M24 26c2 8 2 14 0 20M36 26c-2 8-2 14 0 20M30 24v24"/></g>
<path d="M28 12c0-3 4-3 4 0z" fill="#5F7F3A"/>`)}
${s('chicken', `<ellipse cx="30" cy="52" rx="17" ry="3.4" fill="#00000012"/>
<path d="M13 33c2-9 12-14 23-13 10 1 15 7 13 14-2 8-13 12-24 10-9-2-14-6-12-11z" fill="#EBD3B0"/>
<path d="M18 31c3-5 10-8 18-7-6 2-13 5-18 7z" fill="#F7E7CE"/>
<path d="M44 40c5 1 8 4 7 7-3 2-7 0-9-4z" fill="#D9B98E"/>
<g stroke="#D9B98E" stroke-width="1.4" stroke-linecap="round"><path d="M20 38c5 1 10 1 15 0M22 43c5 1 9 1 13 0"/></g>`)}
${s('avocado', `<ellipse cx="30" cy="53" rx="16" ry="3.4" fill="#00000012"/>
<path d="M30 9c11 0 19 12 19 26 0 11-8 18-19 18s-19-7-19-18C11 21 19 9 30 9z" fill="#3F7A4E"/>
<path d="M30 15c8 0 14 10 14 21 0 8-6 13-14 13s-14-5-14-13c0-11 6-21 14-21z" fill="#A9C97C"/>
<ellipse cx="30" cy="35" rx="8.5" ry="9.5" fill="#8A5A2B"/><ellipse cx="27.5" cy="32" rx="3" ry="3.4" fill="#A67340"/>
<path d="M30 9c-1-4 1-6 3-6 1 3 0 5-2 6z" fill="#5F7F3A"/>`)}
${s('liver', `<ellipse cx="30" cy="51" rx="19" ry="3.4" fill="#00000012"/>
<path d="M10 28c5-11 22-14 33-8 8 4 8 16 0 22-10 8-27 7-33-2-3-4-3-8 0-12z" fill="#8E3220"/>
<path d="M17 28c5-5 15-7 22-3-5 6-16 9-22 3z" fill="#B04A32"/>
<path d="M43 20c4-2 8 0 8 3-3 2-7 2-8-3z" fill="#7A2717"/>
<path d="M22 40c6 2 13 2 18-1" stroke="#7A2717" stroke-width="1.6" fill="none" stroke-linecap="round"/>`)}
${s('banana', `<ellipse cx="32" cy="52" rx="18" ry="3.4" fill="#00000012"/>
<path d="M12 15c3 20 16 32 34 32 3 0 4-3 2-5-15-4-25-13-28-28-1-3-8-2-8 1z" fill="#F0C64E"/>
<path d="M17 19c4 15 13 24 26 27-13 0-24-10-26-27z" fill="#F9DC86"/>
<path d="M46 47c4 0 6 1 6 3-2 1-5 1-6-3z" fill="#C9A02F"/>
<path d="M12 15c-3-3-3-6-1-7 2 1 3 4 1 7z" fill="#6B5A2A"/>`)}
${s('papaya', `<ellipse cx="30" cy="52" rx="18" ry="3.4" fill="#00000012"/>
<path d="M30 9c12 0 21 12 21 25s-9 21-21 21S9 47 9 34 18 9 30 9z" fill="#E08A32"/>
<path d="M30 16c8 0 14 9 14 19s-6 15-14 15-14-5-14-15 6-19 14-19z" fill="#F2A957"/>
<g fill="#3A3684"><circle cx="30" cy="30" r="2.6"/><circle cx="25" cy="36" r="2.6"/><circle cx="35" cy="36" r="2.6"/><circle cx="30" cy="42" r="2.6"/><circle cx="25" cy="27" r="2"/><circle cx="35" cy="27" r="2"/></g>
<path d="M28 9c0-3 4-3 4 0z" fill="#4E9060"/>`)}
${s('egg', `<ellipse cx="28" cy="53" rx="15" ry="3.4" fill="#00000012"/>
<ellipse cx="27" cy="32" rx="18" ry="22" fill="#FCF6E9"/>
<ellipse cx="22" cy="24" rx="6" ry="8" fill="#FFFDF7"/>
<ellipse cx="45" cy="38" rx="13" ry="14" fill="#F6EEDD"/>
<circle cx="45" cy="38" r="7" fill="#E9963E"/><circle cx="43" cy="36" r="2.6" fill="#F4B472"/>`)}
${s('peanut', `<ellipse cx="30" cy="53" rx="16" ry="3.4" fill="#00000012"/>
<path d="M22 10c7 0 11 5 11 10 0 4-2 6-2 9s2 5 2 9c0 6-5 11-11 11S11 44 11 38c0-4 2-6 2-9s-2-5-2-9c0-5 4-10 11-10z" transform="translate(6,0)" fill="#D9A05B"/>
<g stroke="#B98B44" stroke-width="1.2" fill="none"><path d="M22 18c5 2 8 2 13 0M21 30c5 2 9 2 14 0M22 42c5 2 8 2 13 0"/></g>
<ellipse cx="47" cy="42" rx="7" ry="9" transform="rotate(24 47 42)" fill="#E8C9A0"/>
<path d="M44 37c3-1 5 0 6 2-2 2-5 1-6-2z" fill="#C08840"/>`)}
${s('malunggay', `<ellipse cx="30" cy="53" rx="15" ry="3.4" fill="#00000012"/>
<path d="M30 53V12" stroke="#3F7A4E" stroke-width="2.6" stroke-linecap="round"/>
<g fill="#4E9060"><ellipse cx="20" cy="20" rx="7.5" ry="5.5" transform="rotate(-18 20 20)"/><ellipse cx="40" cy="25" rx="7.5" ry="5.5" transform="rotate(18 40 25)"/>
<ellipse cx="19" cy="32" rx="7.5" ry="5.5" transform="rotate(-14 19 32)"/><ellipse cx="41" cy="37" rx="7.5" ry="5.5" transform="rotate(14 41 37)"/>
<ellipse cx="21" cy="43" rx="6.5" ry="4.8" transform="rotate(-10 21 43)"/><ellipse cx="30" cy="13" rx="6.5" ry="5"/></g>
<g fill="#6FA97F"><ellipse cx="18" cy="19" rx="3" ry="2.2" transform="rotate(-18 18 19)"/><ellipse cx="38" cy="24" rx="3" ry="2.2" transform="rotate(18 38 24)"/></g>`)}
${s('fish', `<ellipse cx="30" cy="50" rx="21" ry="3.4" fill="#00000012"/>
<path d="M7 30c9-11 27-13 38-5l8-7-2 12 2 12-8-7C34 43 16 41 7 30z" fill="#7C93A8"/>
<path d="M11 30c8-8 22-10 31-5-9 6-23 8-31 5z" fill="#9FB2C2"/>
<circle cx="41" cy="26" r="2.6" fill="#2A1E19"/><circle cx="42" cy="25" r=".9" fill="#fff"/>
<path d="M24 22c5 5 5 11 0 16" stroke="#63798C" stroke-width="1.8" fill="none" stroke-linecap="round"/>
<path d="M26 17c4-4 9-3 11 0-4 1-8 1-11 0z" fill="#63798C"/>`)}
${s('dilis', `<ellipse cx="30" cy="50" rx="22" ry="3.4" fill="#00000012"/>
<g fill="#9FB2C2"><path d="M5 22c8-6 19-6 25-1l6-4-1 5 1 5-6-4c-6 5-17 5-25-1z"/>
<path d="M22 38c8-6 19-6 25-1l6-4-1 5 1 5-6-4c-6 5-17 5-25-1z"/></g>
<g fill="#B9C8D4"><path d="M9 22c6-4 14-4 19-1-6 3-14 4-19 1zM26 38c6-4 14-4 19-1-6 3-14 4-19 1z"/></g>
<g fill="#2A1E19"><circle cx="27" cy="20" r="1.7"/><circle cx="44" cy="36" r="1.7"/></g>`)}
${s('meat', `<ellipse cx="30" cy="51" rx="19" ry="3.4" fill="#00000012"/>
<path d="M11 30c4-10 18-14 30-10 9 3 11 14 3 20-9 7-25 7-32 0-3-3-3-7-1-10z" fill="#B04A32"/>
<path d="M18 29c5-5 15-7 22-3-6 5-16 7-22 3z" fill="#CB6549"/>
<g fill="#E8C9A0" opacity=".75"><ellipse cx="24" cy="36" rx="4" ry="2.2" transform="rotate(-12 24 36)"/><ellipse cx="35" cy="33" rx="3.4" ry="2" transform="rotate(8 35 33)"/><ellipse cx="30" cy="41" rx="3" ry="1.8"/></g>`)}
${s('yogurt', `<ellipse cx="30" cy="53" rx="16" ry="3.4" fill="#00000012"/>
<path d="M15 22h30l-3 27a5 5 0 0 1-5 4H23a5 5 0 0 1-5-4z" fill="#FCF6E9"/>
<path d="M18 22h24l-2 20a4 4 0 0 1-4 3h-12a4 4 0 0 1-4-3z" fill="#F2ECDC"/>
<rect x="12" y="15" width="36" height="9" rx="4" fill="#3A3684"/>
<path d="M24 32c4-3 10-3 13 0" stroke="#E3DAC5" stroke-width="2" fill="none" stroke-linecap="round"/>`)}
${s('oats', `<ellipse cx="30" cy="52" rx="20" ry="3.4" fill="#00000012"/>
<path d="M8 34h44a22 13 0 0 1-44 0z" fill="#E3D6BC"/>
<ellipse cx="30" cy="34" rx="22" ry="8" fill="#F2E7D2"/>
<g fill="#D9C4A0"><ellipse cx="22" cy="32" rx="4.6" ry="2.8" transform="rotate(-20 22 32)"/><ellipse cx="34" cy="35" rx="4.6" ry="2.8" transform="rotate(14 34 35)"/>
<ellipse cx="41" cy="31" rx="4" ry="2.4" transform="rotate(-8 41 31)"/><ellipse cx="27" cy="37" rx="4" ry="2.4" transform="rotate(22 27 37)"/></g>
<g fill="#C9B48E"><ellipse cx="50" cy="45" rx="4" ry="2.4" transform="rotate(28 50 45)"/><ellipse cx="12" cy="45" rx="4" ry="2.4" transform="rotate(-24 12 45)"/></g>`)}
${s('pasta', `<ellipse cx="30" cy="52" rx="19" ry="3.4" fill="#00000012"/>
<g fill="none" stroke="#F0C64E" stroke-width="8" stroke-linecap="round">
<path d="M14 24a9 9 0 0 1 15 6"/><path d="M33 34a9 9 0 0 1 15 6"/><path d="M34 16a9 9 0 0 1 14 6"/></g>
<g fill="none" stroke="#DFAF33" stroke-width="2.6" stroke-linecap="round">
<path d="M15 25a9 9 0 0 1 12 5"/><path d="M35 17a9 9 0 0 1 11 5"/></g>
<g fill="none" stroke="#F0C64E" stroke-width="8" stroke-linecap="round"><path d="M12 42a9 9 0 0 1 15 5"/></g>`)}
${s('tofu', `<ellipse cx="30" cy="52" rx="18" ry="3.4" fill="#00000012"/>
<path d="M10 26l20-9 20 9v16l-20 9-20-9z" fill="#F2ECDC"/>
<path d="M10 26l20 9 20-9-20-9z" fill="#FCF6E9"/>
<path d="M30 35v16l-20-9V26z" fill="#E6DDC8"/>
<path d="M36 30l10-4.5v9L36 39z" fill="#FFFDF7" opacity=".6"/>`)}
${s('tahini', `<ellipse cx="30" cy="53" rx="15" ry="3.4" fill="#00000012"/>
<path d="M18 24h24l-2 25a5 5 0 0 1-5 4H25a5 5 0 0 1-5-4z" fill="#E8C9A0"/>
<path d="M21 24h18l-2 19a3 3 0 0 1-3 3h-8a3 3 0 0 1-3-3z" fill="#F2DCBE"/>
<rect x="15" y="16" width="30" height="9" rx="4" fill="#8A5A2B"/>
<g fill="#C9A96F"><ellipse cx="24" cy="34" rx="2.4" ry="1.5"/><ellipse cx="33" cy="38" rx="2.4" ry="1.5"/><ellipse cx="29" cy="31" rx="2" ry="1.3"/></g>`)}
${s('nut', `<ellipse cx="30" cy="52" rx="16" ry="3.4" fill="#00000012"/>
<path d="M18 14c9-3 20 2 24 12 3 8-2 17-11 20-8 3-16-1-16-7 0-5 6-6 10-9 4-3 5-8 1-11-4-3-11-2-8-5z" fill="#D9A05B"/>
<path d="M22 19c7-1 14 4 16 11-5-5-11-9-16-11z" fill="#E8C090"/>
<path d="M20 40c4-2 8-1 9 2-3 2-7 2-9-2z" fill="#B98B44"/>`)}
${s('shrimp', `<ellipse cx="30" cy="52" rx="17" ry="3.4" fill="#00000012"/>
<path d="M44 12c-16 0-26 9-26 20 0 9 8 15 16 15 3 0 5-2 4-4-1-2-3-2-6-2-5 0-9-4-9-9 0-7 8-13 19-13z" fill="#E8845E"/>
<path d="M42 17c-12 1-19 7-19 15 0 4 2 7 5 8-2-3-3-5-3-8 0-7 7-13 17-15z" fill="#F2A88C"/>
<circle cx="42" cy="16" r="2.4" fill="#2A1E19"/>
<path d="M46 10c4-2 8-1 9 2-3 2-7 2-9-2z" fill="#D06A4E"/>
<path d="M35 45c4 2 7 5 6 8-4 0-7-3-8-6z" fill="#D06A4E"/>`)}
${s('monggo', `<ellipse cx="30" cy="52" rx="18" ry="3.4" fill="#00000012"/>
<path d="M9 27c10-8 30-8 42 0-2 8-12 13-21 13S11 35 9 27z" fill="#6B9B58"/>
<path d="M13 28c9-6 25-6 34 0-9 4-25 4-34 0z" fill="#8FB874"/>
<g fill="#4E9060"><ellipse cx="20" cy="43" rx="6" ry="4.4" transform="rotate(-18 20 43)"/><ellipse cx="32" cy="45" rx="6" ry="4.4" transform="rotate(12 32 45)"/><ellipse cx="43" cy="42" rx="5.4" ry="4" transform="rotate(-8 43 42)"/></g>
<g fill="#7FAE72"><ellipse cx="19" cy="42" rx="2.4" ry="1.7" transform="rotate(-18 19 42)"/><ellipse cx="31" cy="44" rx="2.4" ry="1.7"/></g>`)}
${s('mango', `<ellipse cx="30" cy="53" rx="17" ry="3.4" fill="#00000012"/>
<path d="M40 11c9 5 13 17 8 28-5 12-18 18-27 14-8-4-9-16-4-27 5-11 14-19 23-15z" fill="#E9963E"/>
<path d="M37 19c5 4 6 13 2 21-4 8-11 12-16 10 7-2 12-9 14-17 1-6 1-11 0-14z" fill="#F4B472"/>
<path d="M43 11c1-4-1-6-4-6 0 3 1 5 4 6z" fill="#4E9060"/>
<path d="M17 41c4 3 9 3 13 1" stroke="#D07E29" stroke-width="1.6" fill="none" stroke-linecap="round"/>`)}
${s('lugaw', `<ellipse cx="30" cy="52" rx="21" ry="3.4" fill="#00000012"/>
<path d="M7 32h46a23 14 0 0 1-46 0z" fill="#E3D6BC"/>
<ellipse cx="30" cy="32" rx="23" ry="8.5" fill="#FCF6E9"/>
<ellipse cx="30" cy="31" rx="17" ry="5.5" fill="#F2ECDC"/>
<path d="M18 30c7-4 17-4 24 0" stroke="#E3D6BC" stroke-width="2" fill="none" stroke-linecap="round"/>
<path d="M46 14c4 0 6 3 6 6s-2 5-5 5l1 12" stroke="#B9A88F" stroke-width="2.6" fill="none" stroke-linecap="round"/>`)}
${s('cut-puree', `<ellipse cx="34" cy="40" rx="26" ry="7" fill="#00000010"/>
<path d="M8 26h52a26 15 0 0 1-52 0z" fill="var(--c2,#E09355)"/>
<ellipse cx="34" cy="26" rx="26" ry="8" fill="var(--c1,#D4763C)"/>
<ellipse cx="34" cy="25" rx="20" ry="5.5" fill="var(--c2,#E09355)"/>
<path d="M20 24c6-3 22-3 28 0" stroke="var(--c1,#D4763C)" stroke-width="1.6" fill="none" stroke-linecap="round"/>
<path d="M52 9c4 0 6 3 6 6s-2 5-5 5l1 18" stroke="#B9A88F" stroke-width="2.4" fill="none" stroke-linecap="round"/>`, '0 0 68 48')}
${s('cut-mash', `<ellipse cx="34" cy="41" rx="26" ry="7" fill="#00000010"/>
<path d="M8 27h52a26 15 0 0 1-52 0z" fill="var(--c2,#E09355)"/>
<ellipse cx="34" cy="27" rx="26" ry="8" fill="var(--c1,#D4763C)"/>
<g fill="var(--c2,#E09355)"><ellipse cx="25" cy="25" rx="6" ry="3.6"/><ellipse cx="38" cy="28" rx="7" ry="4"/><ellipse cx="46" cy="24" rx="5" ry="3"/><ellipse cx="31" cy="30" rx="5" ry="3"/></g>
<path d="M52 9c4 0 6 3 6 6s-2 5-5 5l1 19" stroke="#B9A88F" stroke-width="2.4" fill="none" stroke-linecap="round"/>`, '0 0 68 48')}
${s('cut-baton', `<ellipse cx="34" cy="43" rx="28" ry="4" fill="#00000010"/>
<g>
  <rect x="8" y="10" width="12" height="31" rx="6" fill="var(--c1,#D4763C)"/>
  <rect x="10.5" y="13" width="4" height="22" rx="2" fill="var(--c2,#E09355)" opacity=".85"/>
  <rect x="27" y="7" width="12" height="34" rx="6" fill="var(--c1,#D4763C)"/>
  <rect x="29.5" y="10" width="4" height="25" rx="2" fill="var(--c2,#E09355)" opacity=".85"/>
  <rect x="46" y="12" width="12" height="29" rx="6" fill="var(--c1,#D4763C)"/>
  <rect x="48.5" y="15" width="4" height="20" rx="2" fill="var(--c2,#E09355)" opacity=".85"/>
</g>
<path d="M27 45h12" stroke="#0F4A35" stroke-width="1.4" stroke-linecap="round" opacity=".45"/>
<path d="M27 43v4M39 43v4" stroke="#0F4A35" stroke-width="1.4" stroke-linecap="round" opacity=".45"/>`, '0 0 68 48')}
${s('cut-cube', `<ellipse cx="34" cy="42" rx="27" ry="4" fill="#00000010"/>
<g>
  <path d="M10 20l7-4 7 4v8l-7 4-7-4z" fill="var(--c1,#D4763C)"/><path d="M10 20l7 4 7-4-7-4z" fill="var(--c2,#E09355)"/>
  <path d="M27 26l7-4 7 4v8l-7 4-7-4z" fill="var(--c1,#D4763C)"/><path d="M27 26l7 4 7-4-7-4z" fill="var(--c2,#E09355)"/>
  <path d="M44 18l7-4 7 4v8l-7 4-7-4z" fill="var(--c1,#D4763C)"/><path d="M44 18l7 4 7-4-7-4z" fill="var(--c2,#E09355)"/>
  <path d="M19 33l7-4 7 4v6l-7 4-7-4z" fill="var(--c1,#D4763C)" opacity=".9"/><path d="M19 33l7 4 7-4-7-4z" fill="var(--c2,#E09355)"/>
</g>`, '0 0 68 48')}
${s('cut-spear', `<ellipse cx="34" cy="43" rx="26" ry="4" fill="#00000010"/>
<path d="M18 40c-2-14 6-27 22-32 3-1 5 1 4 4-5 13-11 22-19 29-2 2-6 2-7-1z" fill="var(--c1,#D4763C)"/>
<path d="M23 36c0-11 6-20 17-25-4 12-9 19-17 25z" fill="var(--c2,#E09355)"/>
<path d="M18 40c-5 2-9 1-11-2 3-3 7-3 11 2zM14 34c-5 0-8-2-9-5 4-1 8 1 9 5z" fill="#C8B89E"/>`, '0 0 68 48')}
${s('cut-flake', `<ellipse cx="34" cy="41" rx="26" ry="5" fill="#00000010"/>
<g fill="var(--c1,#D4763C)">
  <path d="M9 22c6-6 15-7 20-3 4 4 1 10-5 12-7 2-16-3-15-9z"/>
  <path d="M34 14c7-3 14 0 15 5 1 6-6 10-13 8-6-2-8-10-2-13z"/>
  <path d="M24 32c6-3 14-1 16 4 1 4-5 7-11 6-6-1-9-8-5-10z"/>
</g>
<g fill="var(--c2,#E09355)" opacity=".8">
  <path d="M13 22c4-3 10-4 13-1-4 1-9 2-13 1zM38 17c4-1 8 0 9 3-3-1-7-2-9-3z"/></g>`, '0 0 68 48')}
${s('cut-none', `<circle cx="34" cy="24" r="15" fill="none" stroke="#CFC3AC" stroke-width="2.5" stroke-dasharray="5 6" stroke-linecap="round"/>
<path d="M27 20c3 0 5 2 5 4s-2 4-5 4-5-2-5-4 2-4 5-4z" fill="#CFC3AC" opacity=".45"/>
<path d="M40 16c3 0 4 2 4 4s-1 3-3 3l1 10" stroke="#CFC3AC" stroke-width="2" fill="none" stroke-linecap="round"/>`, '0 0 68 48')}

<!-- ── per-food cut diagrams: the shape is the information ─────────────── -->
${s('cut-carrot-baton', `<ellipse cx="34" cy="43" rx="27" ry="4" fill="#00000010"/>
<g fill="#E9963E"><path d="M12 9c3 0 5 1 5 3l-1 27c0 2-2 3-4 3s-4-1-4-3l-1-27c0-2 2-3 5-3z"/>
<path d="M34 6c3 0 5 1 5 3l-1 30c0 2-2 3-4 3s-4-1-4-3l-1-30c0-2 2-3 5-3z"/>
<path d="M56 11c3 0 5 1 5 3l-1 25c0 2-2 3-4 3s-4-1-4-3l-1-25c0-2 2-3 5-3z"/></g>
<g stroke="#F0AB5E" stroke-width="1.3" stroke-linecap="round" opacity=".9">
<path d="M9 18h6M9 26h6M31 15h6M31 24h6M31 32h6M53 20h6M53 29h6"/></g>`, '0 0 68 48')}
${s('cut-kamote-baton', `<ellipse cx="34" cy="43" rx="27" ry="4" fill="#00000010"/>
<g><rect x="7" y="11" width="13" height="30" rx="6.5" fill="#E09355"/><path d="M7 17.5a6.5 6.5 0 0 1 13 0v-1a6.5 6.5 0 0 0-13 0z" fill="#B85E2C"/><rect x="7" y="11" width="13" height="4" rx="2" fill="#B85E2C"/>
<rect x="27" y="7" width="13" height="34" rx="6.5" fill="#E09355"/><rect x="27" y="7" width="13" height="4" rx="2" fill="#B85E2C"/>
<rect x="47" y="13" width="13" height="28" rx="6.5" fill="#E09355"/><rect x="47" y="13" width="13" height="4" rx="2" fill="#B85E2C"/></g>`, '0 0 68 48')}
${s('cut-kalabasa-baton', `<ellipse cx="34" cy="43" rx="27" ry="4" fill="#00000010"/>
<g><path d="M9 12h11v27a4 4 0 0 1-4 4h-3a4 4 0 0 1-4-4z" fill="#E9963E"/><rect x="9" y="9" width="11" height="4" rx="2" fill="#2E6B44"/>
<path d="M29 8h11v31a4 4 0 0 1-4 4h-3a4 4 0 0 1-4-4z" fill="#F0AB5E"/><rect x="29" y="5" width="11" height="4" rx="2" fill="#2E6B44"/>
<path d="M49 14h11v25a4 4 0 0 1-4 4h-3a4 4 0 0 1-4-4z" fill="#E9963E"/><rect x="49" y="11" width="11" height="4" rx="2" fill="#2E6B44"/></g>`, '0 0 68 48')}
${s('cut-lakatan-spear', `<ellipse cx="36" cy="43" rx="24" ry="4" fill="#00000010"/>
<path d="M24 41c-3-13 3-27 18-33 3-1 5 1 4 4-6 13-11 22-16 29-2 3-5 3-6 0z" fill="#FCF0C9"/>
<path d="M28 36c-1-10 4-20 15-25-5 11-9 18-15 25z" fill="#FDF8E4"/>
<g fill="#F0C64E"><path d="M24 41c-6 3-11 2-13-2 4-3 10-3 13 2z"/><path d="M20 33c-6 1-10-1-11-5 5-1 10 1 11 5z"/><path d="M25 44c-4 4-9 5-12 2 3-4 8-5 12-2z"/></g>`, '0 0 68 48')}
${s('cut-avocado-spear', `<ellipse cx="34" cy="43" rx="24" ry="4" fill="#00000010"/>
<g><path d="M14 39c-2-12 5-24 19-29 3-1 4 1 3 4-5 11-10 19-16 25-2 2-5 2-6 0z" fill="#9FBF6A"/>
<path d="M18 35c-1-9 5-17 14-21-4 9-8 15-14 21z" fill="#B8D188"/>
<path d="M36 12c4-2 8 0 8 3s-4 6-8 6-6-3-5-6 3-2 5-3z" fill="#2E6B44"/></g>
<ellipse cx="52" cy="30" rx="9" ry="10" fill="#8A5A2B"/><ellipse cx="50" cy="27" rx="3" ry="3.5" fill="#A67340"/>`, '0 0 68 48')}
${s('cut-egg-spear', `<ellipse cx="34" cy="43" rx="25" ry="4" fill="#00000010"/>
<g><rect x="9" y="10" width="14" height="31" rx="3" fill="#FCF6E9"/><rect x="12" y="16" width="8" height="19" rx="2" fill="#F2B266"/>
<rect x="27" y="7" width="14" height="34" rx="3" fill="#FCF6E9"/><rect x="30" y="13" width="8" height="22" rx="2" fill="#E9963E"/>
<rect x="45" y="13" width="14" height="28" rx="3" fill="#FCF6E9"/><rect x="48" y="19" width="8" height="16" rx="2" fill="#F2B266"/></g>`, '0 0 68 48')}
${s('cut-tofu-cube', `<ellipse cx="34" cy="42" rx="26" ry="4" fill="#00000010"/>
<g><path d="M9 20l8-4 8 4v9l-8 4-8-4z" fill="#F4EBD8"/><path d="M9 20l8 4 8-4-8-4z" fill="#FCF6E9"/>
<path d="M28 26l8-4 8 4v9l-8 4-8-4z" fill="#F4EBD8"/><path d="M28 26l8 4 8-4-8-4z" fill="#FCF6E9"/>
<path d="M45 17l8-4 8 4v9l-8 4-8-4z" fill="#F4EBD8"/><path d="M45 17l8 4 8-4-8-4z" fill="#FCF6E9"/></g>`, '0 0 68 48')}
${s('cut-dilis-flake', `<ellipse cx="34" cy="41" rx="26" ry="5" fill="#00000010"/>
<g fill="#9FB2C2"><path d="M6 24c6-6 16-6 21-1l5-4-1 5 1 5-5-4c-5 5-15 5-21-1z"/>
<path d="M34 14c6-5 15-4 20 1l5-4-1 5 1 5-5-4c-5 5-14 4-20-3z"/>
<path d="M18 34c6-4 14-3 18 2l5-3-1 4 1 4-5-3c-4 4-13 4-18-4z"/></g>
<g fill="#2A1E19"><circle cx="24" cy="22" r="1.6"/><circle cx="51" cy="16" r="1.6"/><circle cx="34" cy="35" r="1.4"/></g>`, '0 0 68 48')}
${s('cut-tilapia-flake', `<ellipse cx="34" cy="41" rx="26" ry="5" fill="#00000010"/>
<g fill="#FCF6E9"><path d="M8 20c7-5 16-4 20 2 2 4-3 9-10 9-8 0-14-6-10-11z"/>
<path d="M33 13c7-4 15-1 17 4 1 5-6 9-13 7-6-1-9-8-4-11z"/>
<path d="M24 31c7-3 14 0 15 5 1 4-6 6-12 4-5-1-8-7-3-9z"/></g>
<g stroke="#DFD3BC" stroke-width="1.3" fill="none" stroke-linecap="round">
<path d="M12 22c5-2 10-1 13 2M37 17c4-1 8 0 10 3M28 34c4-1 8 0 10 3"/></g>`, '0 0 68 48')}
${s('cut-papaya-spear', `<ellipse cx="34" cy="43" rx="25" ry="4" fill="#00000010"/>
<g><path d="M10 38c-2-12 5-23 18-28 3-1 4 1 3 4-5 11-10 18-15 24-2 2-5 2-6 0z" fill="#E9963E"/>
<path d="M14 34c-1-9 5-16 13-20-4 8-8 14-13 20z" fill="#F2B266"/>
<path d="M40 34c-2-12 5-23 18-28 3-1 4 1 3 4-5 11-10 18-15 24-2 2-5 2-6 0z" fill="#E9963E"/></g>
<g fill="#3A3684"><circle cx="24" cy="27" r="2"/><circle cx="20" cy="32" r="2"/><circle cx="28" cy="22" r="1.8"/></g>`, '0 0 68 48')}
${s('cut-mangga-spear', `<ellipse cx="34" cy="43" rx="25" ry="4" fill="#00000010"/>
<g><path d="M9 37c-1-12 6-22 18-26 3-1 4 1 3 4-5 10-10 17-15 22-2 2-5 2-6 0z" fill="#F0AB5E"/>
<path d="M13 33c0-8 6-15 13-18-4 7-8 13-13 18z" fill="#F7C77E"/>
<path d="M31 39c-1-13 6-24 19-28 3-1 4 1 3 4-5 11-11 19-16 24-2 2-5 2-6 0z" fill="#E9963E"/>
<path d="M35 34c0-9 6-17 14-20-5 8-9 14-14 20z" fill="#F0AB5E"/></g>`, '0 0 68 48')}
${s('cut-chicken-flake', `<ellipse cx="34" cy="41" rx="25" ry="5" fill="#00000010"/>
<g fill="#F2DCBE"><rect x="7" y="18" width="22" height="6" rx="3" transform="rotate(-8 18 21)"/>
<rect x="30" y="13" width="24" height="6" rx="3" transform="rotate(6 42 16)"/>
<rect x="14" y="28" width="26" height="6" rx="3" transform="rotate(-3 27 31)"/>
<rect x="38" y="26" width="20" height="6" rx="3" transform="rotate(10 48 29)"/></g>
<g stroke="#E0C8A4" stroke-width="1.1" stroke-linecap="round"><path d="M10 21h16M33 16h18M18 31h18"/></g>`, '0 0 68 48')}
${s('cut-meat-flake', `<ellipse cx="34" cy="42" rx="24" ry="4" fill="#00000010"/>
<g><ellipse cx="22" cy="26" rx="15" ry="9" fill="#B84A33"/><ellipse cx="22" cy="23" rx="11" ry="5.5" fill="#D06A4E"/>
<ellipse cx="47" cy="31" rx="12" ry="7" fill="#B84A33"/><ellipse cx="47" cy="29" rx="8" ry="4" fill="#D06A4E"/></g>
<path d="M12 40h44" stroke="#0F4A35" stroke-width="1.3" stroke-linecap="round" opacity=".35"/>`, '0 0 68 48')}
${s('cut-monggo-puree', `<ellipse cx="34" cy="41" rx="26" ry="7" fill="#00000010"/>
<path d="M8 27h52a26 15 0 0 1-52 0z" fill="#7FAE72"/><ellipse cx="34" cy="27" rx="26" ry="8" fill="#4E9060"/>
<g fill="#7FAE72"><ellipse cx="24" cy="25" rx="5" ry="3.4" transform="rotate(-18 24 25)"/>
<ellipse cx="37" cy="28" rx="5" ry="3.4" transform="rotate(12 37 28)"/><ellipse cx="45" cy="24" rx="4.4" ry="3" transform="rotate(-8 45 24)"/>
<ellipse cx="30" cy="30" rx="4.4" ry="3" transform="rotate(20 30 30)"/></g>
<path d="M52 9c4 0 6 3 6 6s-2 5-5 5l1 19" stroke="#B9A88F" stroke-width="2.4" fill="none" stroke-linecap="round"/>`, '0 0 68 48')}
${s('cut-liver-puree', `<ellipse cx="34" cy="41" rx="26" ry="7" fill="#00000010"/>
<path d="M8 27h52a26 15 0 0 1-52 0z" fill="#B84A33"/><ellipse cx="34" cy="27" rx="26" ry="8" fill="#9A3520"/>
<ellipse cx="32" cy="26" rx="17" ry="4.6" fill="#B84A33"/>
<path d="M52 9c4 0 6 3 6 6s-2 5-5 5l1 19" stroke="#B9A88F" stroke-width="2.4" fill="none" stroke-linecap="round"/>`, '0 0 68 48')}
${s('cut-pasta-cube', `<ellipse cx="34" cy="42" rx="26" ry="4" fill="#00000010"/>
<g fill="none" stroke="#F0C64E" stroke-width="6" stroke-linecap="round">
<path d="M12 20a7 7 0 0 1 12 5"/><path d="M30 26a7 7 0 0 1 12 5"/><path d="M45 16a7 7 0 0 1 12 5"/><path d="M20 33a7 7 0 0 1 12 4"/></g>
<g fill="none" stroke="#E0B03A" stroke-width="2" stroke-linecap="round">
<path d="M13 21a7 7 0 0 1 10 4"/><path d="M31 27a7 7 0 0 1 10 4"/></g>`, '0 0 68 48')}
${s('cut-shrimp-flake', `<ellipse cx="34" cy="41" rx="24" ry="5" fill="#00000010"/>
<g fill="#E8845E"><path d="M14 16c7-2 13 2 13 8 0 5-5 9-10 8-2 0-3-2-2-3 4-1 7-3 7-6 0-3-3-5-8-4-2 0-2-2 0-3z"/>
<path d="M38 22c7-2 13 2 13 8 0 5-5 9-10 8-2 0-3-2-2-3 4-1 7-3 7-6 0-3-3-5-8-4-2 0-2-2 0-3z"/></g>
<g fill="#F0A183"><path d="M18 19c4-1 7 1 7 4M42 25c4-1 7 1 7 4" stroke="#F0A183" stroke-width="2" fill="none" stroke-linecap="round"/></g>`, '0 0 68 48')}
${s('cut-sayote-cube', `<ellipse cx="34" cy="42" rx="26" ry="4" fill="#00000010"/>
<g><path d="M10 21l8-4 8 4v9l-8 4-8-4z" fill="#9FBF6A"/><path d="M10 21l8 4 8-4-8-4z" fill="#B8D188"/>
<path d="M28 27l8-4 8 4v9l-8 4-8-4z" fill="#9FBF6A"/><path d="M28 27l8 4 8-4-8-4z" fill="#B8D188"/>
<path d="M45 18l8-4 8 4v9l-8 4-8-4z" fill="#9FBF6A"/><path d="M45 18l8 4 8-4-8-4z" fill="#B8D188"/></g>`, '0 0 68 48')}
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
  const t = text.toLowerCase().trim()
  // Only a genuine "not yet" gets the empty diagram — "never rings" is an
  // instruction about shape, not an absence of one.
  if (!t || t === '—' || t === '-' || /^not\b|^never\b/.test(t)) return 'cut-none'
  if (/baton|stick/.test(t)) return 'cut-baton'
  // "finger" is ambiguous — "finger-length baton" is a baton, "finger food"
  // is a category — so match the shape words, not the word finger.
  if (/spear|wedge|strip|toast/.test(t)) return 'cut-spear'
  if (/patty|flatten|shred|flake|mince|chopped/.test(t)) return 'cut-flake'
  if (/cube|piece|chunk|bean|pasta/.test(t)) return 'cut-cube'
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

/** Each food's two flat tones, so a cut diagram is drawn in the food's colour. */
export const TINT = {
  kamote: ['#D4763C', '#E09355'], carrot: ['#E9963E', '#F0AB5E'],
  kalabasa: ['#E9963E', '#F0AB5E'], sayote: ['#9FBF6A', '#B8D188'],
  chicken: ['#E8C9A0', '#F2DCBE'], avocado: ['#2E6B44', '#9FBF6A'],
  liver: ['#9A3520', '#B84A33'], lakatan: ['#F0C64E', '#E0B03A'],
  papaya: ['#E9963E', '#F2B266'], egg: ['#F2B266', '#FCF6E9'],
  peanut: ['#D9A05B', '#C08840'], malunggay: ['#2E6B44', '#4E9060'],
  tilapia: ['#7C93A8', '#9FB2C2'], beef: ['#B84A33', '#D06A4E'],
  yogurt: ['#EDE4D2', '#FCF6E9'], oats: ['#D9A05B', '#E8C9A0'],
  wheat: ['#F0C64E', '#E0B03A'], pork: ['#D08A7E', '#E0A79C'],
  tofu: ['#EDE4D2', '#FCF6E9'], dilis: ['#7C93A8', '#9FB2C2'],
  tahini: ['#D9A05B', '#E8C9A0'], cashew: ['#D9A05B', '#C08840'],
  shrimp: ['#E8845E', '#F0A183'], monggo: ['#4E9060', '#7FAE72'],
  mangga: ['#E9963E', '#F0AB5E'], bangus: ['#7C93A8', '#9FB2C2'],
  lugaw: ['#E5D9C2', '#FCF6E9'],
}

/** Foods that have their own drawn diagram rather than the tinted generic. */
const DRAWN = new Set([
  'cut-carrot-baton', 'cut-carrot-cube', 'cut-kamote-baton', 'cut-kamote-cube',
  'cut-kalabasa-baton', 'cut-kalabasa-cube', 'cut-sayote-cube', 'cut-tofu-cube',
  'cut-lakatan-spear', 'cut-lakatan-cube', 'cut-avocado-spear', 'cut-avocado-cube',
  'cut-papaya-spear', 'cut-papaya-cube', 'cut-mangga-spear', 'cut-mangga-cube',
  'cut-egg-spear', 'cut-egg-cube',
  'cut-dilis-flake', 'cut-dilis-mash', 'cut-tilapia-flake', 'cut-tilapia-mash',
  'cut-bangus-flake', 'cut-bangus-mash', 'cut-chicken-flake', 'cut-chicken-mash',
  'cut-beef-flake', 'cut-beef-cube', 'cut-pork-flake', 'cut-pork-cube',
  'cut-shrimp-flake', 'cut-shrimp-mash', 'cut-shrimp-cube',
  'cut-monggo-puree', 'cut-monggo-mash', 'cut-monggo-cube',
  'cut-liver-puree', 'cut-liver-mash', 'cut-wheat-cube', 'cut-wheat-mash',
])
/** Some foods share a drawing — bangus is tilapia, beef and pork are meat. */
const ALIAS = {
  'cut-bangus-flake': 'cut-tilapia-flake', 'cut-bangus-mash': 'cut-tilapia-flake',
  'cut-beef-flake': 'cut-meat-flake', 'cut-pork-flake': 'cut-meat-flake',
  'cut-beef-cube': 'cut-meat-flake', 'cut-pork-cube': 'cut-meat-flake',
  'cut-wheat-cube': 'cut-pasta-cube', 'cut-wheat-mash': 'cut-pasta-cube',
  'cut-liver-mash': 'cut-liver-puree', 'cut-monggo-mash': 'cut-monggo-puree',
  'cut-monggo-cube': 'cut-monggo-puree', 'cut-tilapia-mash': 'cut-tilapia-flake',
  'cut-dilis-mash': 'cut-dilis-flake', 'cut-chicken-mash': 'cut-chicken-flake',
  'cut-shrimp-mash': 'cut-shrimp-flake', 'cut-shrimp-cube': 'cut-shrimp-flake',
  'cut-papaya-cube': 'cut-papaya-spear', 'cut-mangga-cube': 'cut-mangga-spear',
  'cut-lakatan-cube': 'cut-lakatan-spear', 'cut-avocado-cube': 'cut-avocado-spear',
  'cut-kamote-cube': 'cut-kamote-baton', 'cut-carrot-cube': 'cut-carrot-baton',
  'cut-kalabasa-cube': 'cut-kalabasa-baton', 'cut-egg-cube': 'cut-egg-spear',
}

/**
 * A cut-state diagram. A food with its own drawing gets it; everything else
 * falls back to the generic shape painted in that food's two tones.
 */
export const cutIcon = (glyph, foodId, w = 74) => {
  const key = `cut-${foodId}-${glyph.replace('cut-', '')}`
  const drawn = DRAWN.has(key) ? ALIAS[key] || key : null
  const [c1, c2] = TINT[foodId] || ['#D4763C', '#E09355']
  const h = Math.round((w * 48) / 68)
  return `<svg class="ic" width="${w}" height="${h}" style="--c1:${c1};--c2:${c2}" aria-hidden="true"><use href="#a-${drawn || glyph}"/></svg>`
}
