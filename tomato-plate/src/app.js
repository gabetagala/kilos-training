// ─── TOMATO PLATE — app shell ───────────────────────────────────────────────
// Vanilla, localStorage-first, no framework. Renders whole screens; the state
// is small enough that diffing would cost more than it saves.
import { SPRITE, cutGlyph, cutIcon, icon, stepGlyph } from './art.js'
import { ALLERGENS, AMOUNTS, EXPOSURE_TARGET, FOODS, HAND_GUIDE, MILK, REACTION, ROTATION_DAYS, TAKEN } from './data.js'
import { dayPlan, ironToday, scheduleIndex, slotOf, swapOptions } from './plan.js'
import * as store from './store.js'

const BUILD = `${import.meta.env.KILOS_BUILD || 'dev'} · ${import.meta.env.KILOS_COMMIT || '—'}`

const app = document.getElementById('app')
document.body.insertAdjacentHTML('afterbegin', SPRITE)

const esc = (s = '') => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const possessive = (n) => (!n ? 'Baby\u2019s' : /[sz]$/i.test(n) ? `${n}\u2019` : `${n}\u2019s`)
/** Pull the eye to timings and to the words that matter for safety. */
const emphasise = (s) => s
  .replace(/(\d+\s?[–-]\s?\d+\s?min|\d+\s?min(?:utes)?|overnight)/gi, '<b>$1</b>')
  .replace(/\b(NO pink|NEVER|CHECK FOR BONES AGAIN|FRESH|AT LEAST 10 minutes|WHOLE)\b/g, '<b class="warn">$1</b>')

const MEAL_ORDER = ['breakfast', 'snack', 'lunch', 'dinner']
const TITLE = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' }

let view = { tab: 'today', food: null, age: null, sheet: null, openMeal: null, filter: 'all',
  ob: { name: '', birthdate: '', startDate: '' }, pretried: new Set() }

/* ── derived ─────────────────────────────────────────────────────────────── */
const today = () => {
  const s = store.get()
  const day = store.planDay()
  const age = store.ageOf(s.profile.birthdate)
  const band = ageBand(age.months)
  const swaps = s.swaps || {}
  const skip = s.profile.preTried || []
  return { s, day, age, band, swaps, skip, slot: slotOf(day, swaps, skip), plan: dayPlan(day, band, swaps, skip) }
}

function allergenRows() {
  const s = store.get()
  return ALLERGENS.map((a) => {
    const rec = s.allergens[a.id]
    const since = store.daysSince(rec?.lastServed)
    const state = !rec?.introduced ? 'new' : since >= ROTATION_DAYS ? 'due' : 'ok'
    return { ...a, since, state }
  })
}

/* ── screens ─────────────────────────────────────────────────────────────── */
/** Which serving band his age falls in. */
const ageBand = (months) => (months >= 12 ? 12 : months >= 9 ? 9 : 6)
const amountFor = (day) => AMOUNTS.find((a) => day <= a.upTo) || AMOUNTS[AMOUNTS.length - 1]

/**
 * The hands column sometimes points at a different food — liver's reads
 * "serve a kamote stick alongside". Draw the food it names, or you get red
 * batons for liver. The spoon column is always the food itself: "mashed
 * through lugaw" is still liver, lugaw is only the vehicle.
 */
const RX_ESCAPE = /[.*+?^${}()|[\]\\]/g
const FORM_RX = (() => {
  const FORM = '(?:stick|baton|spear|cube|finger|flake|strip|piece|wedge)'
  const out = []
  for (const [id, f] of Object.entries(FOODS)) {
    for (const n of [f.name, f.sub].filter(Boolean).map((x) => x.toLowerCase())) {
      if (n.length > 3) out.push([id, new RegExp(`\\b${n.replace(RX_ESCAPE, '\\$&')}\\s+${FORM}`)])
    }
  }
  return { list: out, bread: new RegExp(`\\b(?:toast|bread)\\s*${FORM}?`) }
})()

function referencedFood(text, selfId) {
  const t = (text || '').toLowerCase()
  // The name must be followed by a form word — "kamote stick", "kalabasa
  // baton". Matching the bare name caught "squash-TESTED" as the vegetable
  // squash and drew carrot batons as kalabasa.
  for (const [id, rx] of FORM_RX.list) if (id !== selfId && rx.test(t)) return id
  if (FORM_RX.bread.test(t)) return 'wheat'
  return null
}

/** The whole "how do I actually make this" block — shared by Today and Food detail. */
/** Do the two serving notes actually say different things? */
function saysTheSame(a = '', c = '') {
  const key = (x) => new Set(x.toLowerCase().replace(/[^a-z ]/g, '').split(' ').filter((w) => w.length > 3))
  const [x, y] = [key(a), key(c)]
  if (!x.size) return false
  return [...x].filter((w) => y.has(w)).length / x.size >= 0.5
}

function serveBlock(id, band, { solo = false } = {}) {
  const f = FOODS[id]
  if (!f) return ''
  const [spoon, hands] = f.cut[band] || f.cut[9]
  const noHands = /^not\b|^never\b|^—$/i.test((hands || '').trim())

  // By 12 months the spoon/hands split collapses — he feeds himself. Showing
  // two identical cards reads as a bug, so show one.
  const merged = !noHands && saysTheSame(spoon, hands)
  // Render the UNION, never just the hands text — carrot's spoon says "Soft
  // cubes" and its hands says "Small cubes he picks up"; dropping "soft" would
  // lose the only cooked-through cue on a food whose own safety note is about
  // exactly that.
  const mergedText = (() => {
    const words = (x) => x.toLowerCase().replace(/[^a-z ]/g, '').split(' ').filter(Boolean)
    const [sw, hw] = [words(spoon), words(hands)]
    if (sw.every((w) => hw.includes(w))) return hands
    if (hw.every((w) => sw.includes(w))) return spoon
    return `${spoon} — ${hands.charAt(0).toLowerCase()}${hands.slice(1)}`
  })()
  const cards = merged
    ? `<div class="cut wide">${cutIcon(cutGlyph(hands), referencedFood(hands, id) || id, 92)}
        <b>Spoon or hands</b><span>${esc(mergedText)} — the same either way at this age.</span></div>`
    : `<div class="cut">${cutIcon(cutGlyph(spoon), id)}<b>On the spoon</b><span>${esc(spoon)}</span></div>
       <div class="cut hands">${cutIcon(cutGlyph(hands), referencedFood(hands, id) || id)}<b>In his hands</b><span>${esc(hands)}</span></div>`

  // The finishing step is the one that actually changes with his age, so it is
  // generated from the band rather than sitting static in the food data.
  const finish = noHands || merged
    ? `Finish it: ${(merged ? hands : spoon).toLowerCase()}.`
    : `Finish it: ${spoon.toLowerCase()} — and set aside ${hands.toLowerCase().replace(/^serve (a|an) /, '')} for him to hold.`

  return `<div class="cuts ${merged ? 'one' : ''}">${cards}</div>
    ${f.prep.length ? `<div style="margin-top:14px"><div class="eyebrow ruled" style="margin-bottom:12px">Prepare it</div>
      <ol class="steps">${f.prep.map((p, i) => `<li>
        <span class="step-n">${i + 1}</span>
        <span class="step-i">${icon(stepGlyph(p), 22)}</span>
        <span class="step-t">${emphasise(esc(p))}</span></li>`).join('')}
        <li class="step-final">
          <span class="step-n">${f.prep.length + 1}</span>
          <span class="step-i">${icon('s-stir', 22)}</span>
          <span class="step-t">${emphasise(esc(finish))} <i>at ${band} months</i></span></li>
      </ol></div>` : ''}
    ${solo
      ? '<div class="note" style="margin-top:12px"><b>On its own for these three days.</b> No mixing yet — if something flares up, one ingredient means you know which.</div>'
      : f.pairing ? `<div class="note" style="margin-top:12px"><b>Goes well with</b> ${esc(f.pairing)}</div>` : ''}
    ${f.buy ? `<div class="buy" style="margin-top:12px"><b>What to buy</b>${esc(f.buy)}</div>` : ''}`
}

function screenToday() {
  const { s, day, plan, age, band } = today()
  const due = allergenRows().filter((a) => a.state === 'due')
  const iron = ironToday(plan)
  const logged = s.log[store.todayISO()] || {}
  const amt = amountFor(day)

  const who = possessive(s.profile.name)
  const hero = plan.mode === 'trial'
    ? `<header class="hero">
        <h1 class="greeting">Today in ${esc(who)} plate is <em>${esc(plan.food.name)}</em></h1>
        <div class="hero-art">${icon(plan.food.art, 132)}</div>
        <div class="row pills">
          <span class="pill solid">Day ${plan.trialDay} of ${plan.trialLen}</span>
          ${plan.allergen ? '<span class="pill allergen">Allergen</span>' : ''}
          ${plan.food.ironMg >= 1 ? '<span class="pill iron">Iron</span>' : ''}
          ${plan.food.choking !== 'low' ? `<span class="pill due">${plan.food.choking} choking risk</span>` : ''}
        </div>
        ${plan.rescheduled ? `<p class="hero-note">${esc(plan.note)}</p>` : plan.note && !plan.swappedFrom ? `<p class="hero-note">${esc(plan.note)}</p>` : ''}
        <button class="swapline" data-swapopen>${plan.swappedFrom
          ? `Swapped for ${esc(FOODS[plan.swappedFrom].name)} · <b>change</b>`
          : 'Not in the house? <b>Swap it</b>'}</button>
        ${plan.allergen && plan.trialDay === 1
          ? '<div class="band"><b>First exposure.</b> Morning, at home, only if he\u2019s well. Two hours free to watch. Tip of the spoon, wait 10 minutes, then the rest.</div>' : ''}
      </header>`
    : `<header class="hero">
        <h1 class="greeting">Today in ${esc(who)} plate</h1>
        <div class="hero-art">${icon(FOODS[plan.meals.dinner.foods[0]]?.art || 'logo', 132)}</div>
        <div class="row pills">
          <span class="pill solid">Cycle day ${plan.cycle}</span>
          <span class="pill iron">${esc(plan.iron)}</span>
        </div>
      </header>`

  // In the trial months the new food IS the day — show its full prep inline,
  // no tapping through.
  const inlinePrep = plan.mode === 'trial'
    ? `<div><div class="eyebrow ruled" style="margin-bottom:10px">How to serve it at ${band} months</div>
        ${serveBlock(plan.foodId, band, { solo: true })}</div>` : ''

  const meals = MEAL_ORDER.filter((k) => plan.meals[k] || (k === 'snack' && plan.snack)).map((k) => {
    const m = plan.meals[k] || { spoon: plan.snack, hands: '', foods: [] }
    const rec = logged[k]
    const art = FOODS[m.foods?.[0]]?.art || 'lugaw'
    const expandable = plan.mode === 'cycle' && (m.foods?.length || 0) > 0
    const open = expandable && view.openMeal === k
    const detail = open
      ? `<div class="mealdetail">${m.foods.map((id) => `
          <div class="row" style="margin-bottom:8px">${icon(FOODS[id].art, 24)}
            <b style="font-size:12px">${esc(FOODS[id].name)}</b>
            <button class="link" data-food="${id}" style="margin-left:auto;font-size:11px">Open</button></div>
          ${serveBlock(id, band)}`).join('<hr style="border:0;border-top:1px solid rgba(42,30,25,.09);margin:14px 0">')}</div>`
      : ''
    return `<div class="meal">
      <div class="row" ${expandable ? `data-meal="${k}"` : ''} style="${expandable ? 'cursor:pointer' : ''}">
        ${icon(art, 32)}
        <div style="min-width:0">
          <div class="t">${TITLE[k]}${expandable ? ` <span class="soft" style="font-weight:600;font-size:11px">${open ? '▾' : '▸'}</span>` : ''}</div>
          <div class="d">${esc(m.spoon)}</div>
          ${m.hands ? `<div class="hands">✋ ${esc(m.hands)}</div>` : ''}
          ${m.alongside ? `<div class="d">Alongside: ${esc(m.alongside)}</div>` : ''}
          ${rec?.note ? `<div class="mealnote">\u201C${esc(rec.note)}\u201D</div>` : ''}
          ${rec?.amount ? `<div class="d" style="margin-top:2px">Ate: <b>${esc((TAKEN.find((t) => t.id === rec.amount) || {}).label || rec.amount)}</b></div>` : ''}
        </div>
        <div class="thumbs">
          <button class="th ${rec?.verdict === 'up' ? 'on-up' : ''}" data-log="${k}" data-v="up" aria-label="Liked it">👍</button>
          <button class="th ${rec?.verdict === 'down' ? 'on-down' : ''}" data-log="${k}" data-v="down" aria-label="Not today">👎</button>
        </div>
      </div>${detail}</div>`
  }).join('')

  return `<div class="scroll stack">
    <div class="row topbar">
      ${icon('logo', 28)}
      <div class="meta">Day ${day} · ${esc(age.label)}</div>
    </div>
    ${hero}
    <div class="row" style="gap:6px;flex-wrap:wrap">
      <span class="pill ${iron.length ? 'iron' : 'due'}">${iron.length ? 'Iron ✓' : 'No iron yet'}</span>
      ${due.length ? `<span class="pill due">${due.length} allergen${due.length > 1 ? 's' : ''} due</span>` : '<span class="pill iron">Rotation on track</span>'}
    </div>
    ${inlinePrep}
    <div class="card"><div class="eyebrow" style="margin-bottom:5px">How much to offer</div>
      <div style="font-size:14px;font-weight:800">${esc(amt.offer)}</div>
      <div class="soft" style="font-size:11px;margin-top:3px">${esc(amt.meals)}. This is what to <i>offer</i>, never what he has to finish — stop when he turns away.</div>
      <button class="link" data-hands style="margin-top:6px">No measuring spoons? Use your hands →</button></div>
    <div><div class="eyebrow ruled" style="margin-bottom:10px">Today\u2019s meals${plan.mode === 'cycle' ? ' · tap one for how to make it' : ''}</div>${meals}</div>
    ${due.length ? `<div class="note"><b style="color:var(--ink)">Due back in rotation:</b> ${due.map((d) => `${esc(d.name)} (${d.since}d)`).join(', ')}. Once an allergen is in, it stays in — at least weekly, for good.</div>` : ''}
  </div>`
}

function screenFoods() {
  const { s, day, plan } = today()
  const { schedule, moved } = scheduleIndex(s.swaps || {}, s.profile.preTried || [])
  const todayFood = plan.mode === 'trial' ? plan.foodId : null
  const rows = Object.entries(FOODS).map(([id, f]) => {
    const rec = s.foods[id]
    const on = schedule[id] || null
    const now = id === todayFood || (on && day >= on && day < on + 3)
    return { id, f, rec, on, now, moved: moved[id] || null, tried: Boolean(rec) }
  }).sort((x, y) => (x.on || 9e3) - (y.on || 9e3))

  const F = view.filter
  const shown = rows.filter((r) =>
    F === 'tried' ? r.tried : F === 'todo' ? !r.tried : F === 'allergens' ? r.f.allergen : true)

  const chip = (id, label, n) =>
    `<button class="chip ${F === id ? 'on' : ''}" data-filter="${id}">${label}<span>${n}</span></button>`

  const card = (r) => {
    const since = r.rec ? store.daysSince(r.rec.lastServed) : null
    const status = r.id === todayFood ? `Today · day ${today().plan.trialDay} of 3`
      : r.now ? `Day ${day - r.on + 1} of 3`
      : r.tried ? `${r.rec.exposures}× · ${since === 0 ? 'today' : `${since}d ago`}`
      : r.moved ? `Moved to day ${r.moved}`
      : r.on ? `Day ${r.on}` : 'anytime'
    return `<div class="fcard ${r.now ? 'now' : ''} ${r.tried ? 'tried' : ''} ${r.moved ? 'moved' : ''}" data-food="${r.id}">
      ${r.f.allergen ? '<span class="fdot allergen"></span>' : r.f.ironMg >= 1 ? '<span class="fdot iron"></span>' : ''}
      ${icon(r.f.art, 42)}<b>${esc(r.f.name)}</b><span>${status}</span></div>`
  }

  return `<div class="scroll stack">
    <div><h1>Foods</h1><div class="soft" style="font-size:13px;margin-top:4px">When each one lands, and how it went</div></div>
    <div class="chips">
      ${chip('all', 'All', rows.length)}
      ${chip('todo', 'To try', rows.filter((r) => !r.tried).length)}
      ${chip('tried', 'Tried', rows.filter((r) => r.tried).length)}
      ${chip('allergens', 'Allergens', rows.filter((r) => r.f.allergen).length)}
    </div>
    ${shown.length
      ? `<div class="foodgrid">${shown.map(card).join('')}</div>`
      : `<div class="note" style="text-align:center;padding:28px 18px">${
          F === 'tried' ? 'Nothing logged yet. Foods appear here once you tick one off on the Today tab.'
          : F === 'todo' ? 'Every food has been tried at least once. Worth a look at the allergen board.'
          : 'Nothing here yet.'}</div>`}
    ${Object.keys(moved).length ? `<div class="note"><b>Dates swapped.</b> ${Object.entries(moved).map(([id, d]) => `${esc(FOODS[id].name)} → day ${d}`).join(', ')}. Nothing is dropped — the two just traded places.</div>` : ''}
    <div class="note"><b>Green dot</b> is iron-rich, <b>amber</b> is one of the nine allergens. Tap any food for how to cut it at his age.</div>
  </div>`
}

function screenFood(id) {
  const f = FOODS[id]
  const s = store.get()
  const rec = s.foods[id]
  const band = view.age || 9
  const serveBlockInline = serveBlock(id, band)
  const notes = store.notesFor(id)
  // Tint the header by what the food IS, so a sweet potato never reads pink.
  const TINT = { vegetable: '#E4EEE7', fruit: '#FAEEDB', protein: '#FAE5DF',
                 legume: '#E9EDE2', grain: '#F2EDE1', dairy: '#EEF1F7' }
  const tint = f.allergen ? '#F9EEDA' : TINT[f.cat] || 'var(--surface-2)'
  return `<div class="scroll" style="padding:0">
    <div style="background:${tint};height:150px;display:grid;place-items:center;position:relative">
      <button class="link" data-back style="position:absolute;left:12px;top:10px;font-size:22px;text-decoration:none;color:var(--ink);min-height:44px;padding:0 10px">‹</button>
      ${icon(f.art, 96)}
    </div>
    <div style="padding:14px 18px 24px" class="stack">
      <div><h1>${esc(f.name)}</h1><div class="soft" style="font-size:12px;margin-top:2px">${esc(f.sub ? `${f.sub} · ` : '')}${esc(f.cat)}</div></div>
      <div class="row" style="gap:6px;flex-wrap:wrap">
        ${f.allergen ? `<span class="pill allergen">Allergen · ${f.allergen}</span>` : '<span class="pill">No allergen</span>'}
        ${f.ironMg ? `<span class="pill ${f.ironMg >= 1 ? 'iron' : ''}">Iron ${f.ironMg}mg</span>` : ''}
        <span class="pill ${f.choking === 'high' ? 'due' : f.choking === 'moderate' ? 'allergen' : 'iron'}">${f.choking} risk</span>
        ${f.maxPerWeek ? `<span class="pill due">Max ${f.maxPerWeek}×/week</span>` : ''}
      </div>
      <div class="seg">${[6, 9, 12].map((a) => `<button data-age="${a}" class="${view.age === a ? 'on' : ''}">${a} mo</button>`).join('')}</div>
      <div>
        <div class="eyebrow ruled" style="margin-bottom:10px">How to serve it at ${band} months</div>
        ${serveBlockInline}
      </div>
      <div class="note"><b style="color:var(--ink)">Squash test.</b> Every piece must squash between your finger and thumb with light pressure. If it doesn't, cook it longer.</div>
      ${notes.length ? `<div><div class="eyebrow" style="margin-bottom:7px">What you noticed</div>
        ${notes.map((n) => `<div class="notelog"><div class="row" style="gap:7px;margin-bottom:3px">
          <span style="font-size:13px">${n.verdict === 'down' ? '👎' : '👍'}</span>
          <span class="soft" style="font-size:10px;font-weight:700">${esc(n.date)}</span></div>
          <div style="font-size:12px;line-height:1.45">${esc(n.note)}</div></div>`).join('')}</div>` : ''}
      <div class="soft" style="font-size:12px;text-align:center">${rec ? `Served ${rec.exposures}× · last ${esc(rec.lastServed)}` : 'Not tried yet'}</div>
      <button class="btn" data-logfood="${id}">Log ${esc(f.name)} today</button>
      <button class="link" data-tried="${id}" style="text-align:center;width:100%">${rec ? 'Not actually tried — undo' : 'He has already had this'}</button>
    </div>
  </div>`
}

function screenBaby() {
  const { s, age } = today()
  const rows = allergenRows()
  const tried = Object.keys(s.foods).length
  const total = Object.keys(FOODS).length
  const milk = MILK.find((m) => m.m === Math.min(12, Math.max(6, age.months))) || MILK[0]
  const pct = Math.round((tried / total) * 138)
  return `<div class="scroll stack">
    <div style="text-align:center;padding:8px 0 4px">
      <button class="avatar" data-photo aria-label="Change photo">
        ${s.profile.photo ? `<img src="${s.profile.photo}" alt="">` : '<span>👶</span>'}
        <i class="avatar-edit">${s.profile.photo ? 'Change' : 'Add photo'}</i>
      </button>
      <input type="file" id="photo-input" accept="image/*" hidden>
      <h1>${esc(s.profile.name || 'Baby')}</h1>
      <div class="soft" style="font-size:12px;margin-top:3px">${age.label}${s.profile.birthdate ? ` · born ${esc(s.profile.birthdate)}` : ''}</div>
    </div>
    <div class="card row" style="gap:14px">
      <svg width="56" height="56" viewBox="0 0 56 56" class="ic">
        <circle cx="28" cy="28" r="22" fill="none" stroke="rgba(42,30,25,.1)" stroke-width="6"/>
        <circle cx="28" cy="28" r="22" fill="none" stroke="var(--tomato)" stroke-width="6"
          stroke-dasharray="138" stroke-dashoffset="${138 - pct}" stroke-linecap="round" transform="rotate(-90 28 28)"/>
      </svg>
      <div><div style="font-size:22px;font-weight:900;line-height:1">${tried} <span class="soft" style="font-size:13px">/ ${total} foods</span></div>
        <div class="soft" style="font-size:11px;margin-top:3px">${total - tried} still to try</div></div>
    </div>
    <div>
      <div class="row" style="margin-bottom:9px"><div class="eyebrow">The nine allergens</div>
        ${rows.filter((r) => r.state === 'due').length ? `<span class="pill due" style="margin-left:auto">${rows.filter((r) => r.state === 'due').length} overdue</span>` : ''}</div>
      <div class="board">${rows.map((a) => `<div class="al ${a.state === 'ok' ? 'ok' : a.state === 'due' ? 'due' : ''}">
        <b>${esc(a.name)}</b><span>${a.state === 'new' ? 'not yet' : a.since === 0 ? 'today' : `${a.since}d ago`}</span></div>`).join('')}</div>
    </div>
    <div class="card"><div class="eyebrow" style="margin-bottom:5px">Milk &amp; weaning</div>
      <div style="font-size:14px;font-weight:800">${milk.feeds} feeds a day · ${milk.meals} meal${milk.meals > 1 ? 's' : ''}</div>
      <div class="soft" style="font-size:11px;margin-top:3px">${esc(milk.note)}</div></div>
    <div class="note"><b style="color:var(--ink)">Not a reaction:</b> ${esc(REACTION.notReaction)}</div>
    <button class="btn ghost" data-export>Export the log</button>
    <button class="buildstamp" data-update>${esc(BUILD)} · tap to update</button>
  </div>`
}

function screenOnboard() {
  view.ob.startDate ||= store.todayISO()
  return `<div class="scroll stack" style="justify-content:center;display:flex;flex-direction:column">
    <div style="text-align:center">
      ${icon('logo', 72, 'ic')}
      <div class="wordmark" style="margin-top:12px"><span class="l1">TOMATO</span><span class="l2">PLATE</span></div>
      <p class="soft" style="font-size:13px;margin:16px 0 4px;line-height:1.5">Every food, how to cut it,<br>and what he thought of it.</p>
    </div>
    <div><div class="eyebrow" style="margin-bottom:6px">His name</div><input type="text" id="ob-name" placeholder="Baby's name" autocomplete="off" value="${esc(view.ob.name)}"></div>
    <div><div class="eyebrow" style="margin-bottom:6px">Birthday</div><input type="date" id="ob-dob" value="${esc(view.ob.birthdate)}"></div>
    <div><div class="eyebrow" style="margin-bottom:6px">First day of solids</div><input type="date" id="ob-start" value="${esc(view.ob.startDate)}"></div>
    <div><div class="eyebrow" style="margin-bottom:8px">Already tried any of these?</div>
      <div class="chips wrap">${Object.entries(FOODS).slice(0, 12).map(([id, f]) =>
        `<button class="chip ${view.pretried.has(id) ? 'on' : ''}" data-pretried="${id}">${esc(f.name)}</button>`).join('')}</div>
      <div class="soft" style="font-size:12px;margin-top:8px">Tap any he has already had — they’ll show as done instead of coming up.</div></div>
    <button class="btn" data-onboard>Start the plan</button>
    <p class="soft" style="font-size:10px;text-align:center;line-height:1.5">Not medical advice. Always follow your pediatrician's guidance.</p>
  </div>`
}

/* ── log sheet ───────────────────────────────────────────────────────────── */
function sheetLog(ctx) {
  const id = ctx.foods?.[0]
  const f = FOODS[id]
  // Editing an existing entry is a correction — do not preview it as one more.
  const already = Boolean(store.get().log[store.todayISO()]?.[ctx.key])
  const n = (store.get().foods[id]?.exposures || 0) + (already ? 0 : 1)
  // One slot, always filled — nothing appears or disappears under the thumbs,
  // so tapping one never shoves the rest of the sheet around.
  // All four run to a similar length on purpose: the slot is fixed, so a
  // message that wrapped to a different line count would shift the sheet.
  const msg = ctx.verdict === 'down' && n < EXPOSURE_TARGET
      ? `Exposure <b>${n} of ${EXPOSURE_TARGET}</b>. Most parents stop at 3–5. Keep going — offer it again in a few days.`
    : ctx.verdict === 'down'
      ? `Exposure <b>${n}</b>. Some foods take far longer than this, and a few never land at all. That is allowed.`
    : ctx.verdict === 'up'
      ? `Exposure <b>${n}</b>. Keep it in the rotation — liking it once is not the same as keeping it.`
      : `Exposure <b>${n} of ${EXPOSURE_TARGET}</b>. Either answer is useful here — a refusal is data, not a failure.`
  return `<div class="scrim"><div class="sheet stack" data-stop>
    <div class="grab"></div>
    <div class="row">${icon(f?.art || 'lugaw', 44)}
      <div><div style="font-size:18px;font-weight:650;letter-spacing:-.02em">${esc(ctx.label)}</div>
        <div class="soft" style="font-size:12px">${esc(TITLE[ctx.key] || 'Extra')} · exposure ${n}</div></div></div>
    <div><div class="eyebrow ruled" style="margin-bottom:10px">How did it go?</div>
      <div class="verdicts">
        <button class="verdict ${ctx.verdict === 'up' ? 'on-up' : ''}" data-v="up"><span>👍</span>Liked it</button>
        <button class="verdict ${ctx.verdict === 'down' ? 'on-down' : ''}" data-v="down"><span>👎</span>Not today</button>
      </div>
      <div class="verdict-msg ${ctx.verdict === 'down' ? 'warm' : ''}">${msg}</div>
    </div>
    <div><div class="eyebrow ruled" style="margin-bottom:10px">How much</div>
      <div class="takens">${TAKEN.map((t) => `<button data-amt="${t.id}" class="taken ${ctx.amount === t.id ? 'on' : ''}">
        <b>${t.label}</b><span>${t.desc}</span></button>`).join('')}</div></div>
    <textarea id="log-note" placeholder="Anything worth remembering?">${esc(ctx.note || '')}</textarea>
    <div class="row">
      <button class="link" data-reaction>Flag a reaction</button>
      <button class="btn" data-save style="margin-left:auto;width:auto;padding:14px 32px">Save</button>
    </div>
  </div></div>`
}

/** The day's ingredient isn't in the house — offer something that does the same job. */
function sheetSwap(ctx) {
  const opts = swapOptions(ctx.foodId)
  const f = FOODS[ctx.foodId]
  return `<div class="scrim"><div class="sheet stack" data-stop>
    <div class="grab"></div>
    <h2>No ${esc(f.name.toLowerCase())} today?</h2>
    ${opts.length
      ? `<p class="soft" style="font-size:13px;line-height:1.5">The two trade places — this food takes today's slot, and the one you're out of takes its date. A trial split between two ingredients tests neither, so the whole 3-day slot moves. ${
          f.allergen ? `This is an <b>allergen day</b>, so only another ${f.allergen} food counts — a vegetable would skip the introduction entirely.`
          : f.ironMg >= 1 ? 'This is an <b>iron day</b>, so the stand-in needs to carry iron too.'
          : 'Same food group, so the variety still counts.'}</p>
        ${opts.map((o) => `<button class="swapopt" data-swap="${o.id}">${icon(o.art, 34)}
          <div><b>${esc(o.name)}</b><span>${esc(o.why)}</span></div></button>`).join('')}`
      : `<div class="safety">Nothing else does this job — ${esc(f.name)} is the only ${esc(f.allergen || f.cat)} food in the plan. Skip today rather than substituting, and pick it up when you have some. Missing a day costs nothing; skipping the introduction does.</div>`}
    ${ctx.swapped ? '<button class="btn ghost" data-swap="">Put it back</button>' : ''}
    <button class="btn ghost" data-close>Close</button>
  </div></div>`
}

function sheetHands() {
  return `<div class="scrim"><div class="sheet stack" data-stop>
    <div class="grab"></div>
    <h2>Sizing by hand</h2>
    <p class="soft" style="font-size:12px;line-height:1.5">Everything in this app is measured against a hand, not a ruler. Yours for amounts, his for portions.</p>
    ${HAND_GUIDE.map(([k, v]) => `<div class="card"><div style="font-size:13px;font-weight:800;margin-bottom:2px">${esc(k)}</div>
      <div class="soft" style="font-size:11.5px;line-height:1.5">${esc(v)}</div></div>`).join('')}
    <button class="btn ghost" data-close>Got it</button>
  </div></div>`
}

function sheetReaction() {
  return `<div class="scrim"><div class="sheet stack" data-stop>
    <div class="grab"></div>
    <h2>Is it a reaction?</h2>
    <div class="safety"><b>Get help immediately</b><ul style="margin:6px 0 0 16px;font-weight:600">${REACTION.urgent.map((r) => `<li>${esc(r)}</li>`).join('')}</ul></div>
    <div class="note"><b style="color:var(--ink)">Mild</b> — ${REACTION.mild.map(esc).join(', ').toLowerCase()}. Call the pediatrician if it appears within 2 hours.</div>
    <div class="encourage">${esc(REACTION.notReaction)}</div>
    <button class="btn ghost" data-close>Close</button>
  </div></div>`
}

/* ── render + events ─────────────────────────────────────────────────────── */
const TABS = [['today', 'Today'], ['foods', 'Foods'], ['baby', 'Baby']]
const SCROLL_MEM = {}

function render() {
  if (!store.isOnboarded()) { app.innerHTML = screenOnboard(); return }
  const body = view.food ? screenFood(view.food)
    : view.tab === 'foods' ? screenFoods()
    : view.tab === 'baby' ? screenBaby()
    : screenToday()
  const bar = view.food ? '' : `<nav class="tabbar">${TABS.map(([id, label]) =>
    `<button data-tab="${id}" class="${view.tab === id ? 'on' : ''}">${label}</button>`).join('')}</nav>`
  // Remember where the reader was on each screen, so returning from a food
  // detail lands back at the card they tapped instead of at the top.
  const prevKey = app.dataset.screen
  const key = view.food ? `food:${view.food}` : view.tab
  if (prevKey) SCROLL_MEM[prevKey] = app.querySelector('.scroll')?.scrollTop || 0
  const keep = SCROLL_MEM[key] || 0

  let sheetEl = !view.sheet ? '' : view.sheet.kind === 'reaction' ? sheetReaction() : view.sheet.kind === 'hands' ? sheetHands() : view.sheet.kind === 'swap' ? sheetSwap(view.sheet) : sheetLog(view.sheet)
  if (sheetEl && !view.sheet._shown) { sheetEl = sheetEl.replace('class="scrim"', 'class="scrim enter"'); view.sheet._shown = true }
  app.innerHTML = body + bar + sheetEl
  app.dataset.screen = key
  // innerHTML rebuilds the scroller, so put the reader back where they were —
  // otherwise every tap below the fold snaps the page to the top. Deferred a
  // frame: assigning scrollTop before layout settles silently clamps to 0.
  if (keep) {
    const sc = app.querySelector('.scroll')
    if (sc) {
      sc.scrollTop = keep
      requestAnimationFrame(() => { sc.scrollTop = keep })
    }
  }
}

app.addEventListener('click', (e) => {
  const hit = (sel) => e.target.closest(sel)
  const sheet = view.sheet

  // Re-rendering replaces the DOM, so anything typed into an uncontrolled
  // field is gone unless it is captured first. Same trap in both places.
  if (view.sheet?.kind === 'log') {
    const ta = document.getElementById('log-note')
    if (ta) view.sheet.note = ta.value
  }
  const obName = document.getElementById('ob-name')
  if (obName) {
    view.ob = {
      name: obName.value,
      birthdate: document.getElementById('ob-dob').value,
      startDate: document.getElementById('ob-start').value,
    }
  }

  if (hit('[data-onboard]')) {
    const name = view.ob.name.trim()
    const birthdate = view.ob.birthdate
    const startDate = view.ob.startDate || store.todayISO()
    if (!birthdate) { document.getElementById('ob-dob').focus(); return }
    store.saveProfile({ name, birthdate, startDate })
    for (const id of view.pretried) store.markTried(id, startDate, FOODS[id].allergen)
    store.saveProfile({ preTried: [...view.pretried] })
    view.pretried = new Set()
    return render()
  }
  if (hit('[data-tab]')) { view.tab = hit('[data-tab]').dataset.tab; view.food = null; return render() }
  if (hit('[data-back]')) { view.food = null; return render() }
  if (hit('[data-hands]')) { view.sheet = { kind: 'hands' }; return render() }
  if (hit('[data-filter]')) { view.filter = hit('[data-filter]').dataset.filter; return render() }
  if (hit('[data-pretried]')) {
    const id = hit('[data-pretried]').dataset.pretried
    if (view.pretried.has(id)) view.pretried.delete(id)
    else view.pretried.add(id)
    return render()
  }
  const tri = hit('[data-tried]')
  if (tri) {
    const id = tri.dataset.tried
    if (store.get().foods[id]) store.forgetTried(id)
    else store.markTried(id, store.todayISO(), FOODS[id].allergen)
    return render()
  }
  if (hit('[data-swapopen]')) {
    const { slot } = today()
    if (!slot) return
    view.sheet = { kind: 'swap', foodId: slot.food, slot, swapped: Boolean(store.get().swaps?.[slot.start]) }
    return render()
  }
  const sw = hit('[data-swap]')
  if (sw && (!sw.dataset.swap || FOODS[sw.dataset.swap])) {
    const { slot } = today()
    if (slot) store.setSwap(slot.start, sw.dataset.swap || null)
    view.sheet = null
    return render()
  }
  if (hit('[data-photo]')) { document.getElementById('photo-input')?.click(); return }
  if (hit('[data-food]')) { view.food = hit('[data-food]').dataset.food; view.age ??= ageBand(today().age.months); return render() }
  if (hit('[data-age]')) { view.age = +hit('[data-age]').dataset.age; return render() }
  if (hit('[data-day]')) { view.tab = 'today'; return render() }

  // open the log sheet
  const th = hit('[data-log]')
  if (th) {
    const key = th.dataset.log
    const { day: d0, band: b0, swaps: sw0, skip: sk0 } = today()
    const plan = dayPlan(d0, b0, sw0, sk0)
    const m = plan.meals[key] || { spoon: plan.snack, foods: [] }
    view.sheet = { kind: 'log', key, label: m.spoon, foods: m.foods || [], verdict: th.dataset.v, amount: '', note: '' }
    return render()
  }
  const lf = hit('[data-logfood]')
  if (lf) {
    const id = lf.dataset.logfood
    view.sheet = { kind: 'log', key: id, label: FOODS[id].name, foods: [id], verdict: null, amount: '', note: '' }
    return render()
  }

  // after the thumbs: they live inside the row, and tapping one must log, not expand
  if (hit('[data-meal]')) { const k = hit('[data-meal]').dataset.meal; view.openMeal = view.openMeal === k ? null : k; return render() }

  if (sheet) {
    // keep the log underneath — opening this used to discard a half-filled entry
    if (hit('[data-reaction]')) { view.sheet = { kind: 'reaction', back: sheet }; return render() }
    if (hit('[data-v]')) { sheet.verdict = hit('[data-v]').dataset.v; return render() }
    if (hit('[data-amt]')) { sheet.amount = hit('[data-amt]').dataset.amt; return render() }
    if (hit('[data-save]')) {
      store.logMeal({ key: sheet.key, verdict: sheet.verdict || 'up', amount: sheet.amount, note: sheet.note || '', foods: sheet.foods })
      for (const id of sheet.foods) if (FOODS[id]?.allergen) store.markAllergen(FOODS[id].allergen)
      view.sheet = null
      return render()
  }
    // backdrop, or any explicit close button (which lives inside [data-stop])
    if (e.target.classList.contains('scrim') || hit('button[data-close]')) {
      view.sheet = sheet.back || null
      return render()
    }
  }

  const upd = hit('[data-update]')
  if (upd) {
    // Never wipe caches while offline — that bricks the app until signal is back.
    // Prove the network first, THEN clear everything and land on a unique URL.
    upd.textContent = 'Updating…'
    ;(async () => {
      try {
        const probe = await fetch(`./?u=${Date.now()}`, { cache: 'reload' })
        if (!probe.ok) throw new Error(String(probe.status))
        const regs = (await navigator.serviceWorker?.getRegistrations?.()) || []
        if (window.caches) await Promise.all((await caches.keys()).map((k) => caches.delete(k)))
        for (const r of regs) { try { await r.unregister() } catch { /* already gone */ } }
        window.location.replace(`./?u=${Date.now()}`)
      } catch {
        // re-query: an unrelated render may have replaced this node
        const el = document.querySelector('[data-update]') || upd
        el.textContent = 'Offline — try again later'
        setTimeout(() => { el.textContent = `${BUILD} · tap to update` }, 2600)
      }
    })()
    return
  }

  if (hit('[data-export]')) {
    const blob = new Blob([JSON.stringify(store.get(), null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    // Firefox needs the anchor in the document for a synthetic click, and
    // Safari needs the blob URL to outlive the click by a tick.
    const link = Object.assign(document.createElement('a'), {
      href: url, download: `tomato-plate-${store.todayISO()}.json`,
    })
    document.body.appendChild(link)
    link.click()
    setTimeout(() => { link.remove(); URL.revokeObjectURL(url) }, 0)
  }
})

// Photos are downscaled to 320px before storing — a raw camera frame would
// blow the localStorage quota and take the log down with it.
app.addEventListener('change', (e) => {
  if (e.target.id !== 'photo-input') return
  const file = e.target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    const img = new Image()
    img.onload = () => {
      const size = 320
      const c = document.createElement('canvas')
      c.width = c.height = size
      const scale = Math.max(size / img.width, size / img.height)
      const w = img.width * scale
      const h = img.height * scale
      c.getContext('2d').drawImage(img, (size - w) / 2, (size - h) / 2, w, h)
      store.saveProfile({ photo: c.toDataURL('image/jpeg', 0.82) })
      render()
    }
    img.src = reader.result
  }
  reader.readAsDataURL(file)
})

// ── 2: swipe between tabs ────────────────────────────────────────────────
// Only on a plain tab screen, only when the gesture is clearly horizontal, so
// vertical scrolling and the sheets are untouched.
{
  let g = null
  const order = TABS.map(([id]) => id)
  app.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1 || view.sheet || view.food) return
    g = { x: e.touches[0].clientX, y: e.touches[0].clientY, on: false }
  }, { passive: true })
  app.addEventListener('touchmove', (e) => {
    if (!g) return
    const dx = e.touches[0].clientX - g.x
    const dy = e.touches[0].clientY - g.y
    if (!g.on) {
      if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return
      if (Math.abs(dy) >= Math.abs(dx)) { g = null; return } // vertical — let it scroll
      g.on = true
    }
    g.dx = dx
  }, { passive: true })
  const end = () => {
    if (!g?.on) { g = null; return }
    const { dx } = g
    g = null
    if (Math.abs(dx) < 60) return
    const i = order.indexOf(view.tab)
    const next = order[Math.min(order.length - 1, Math.max(0, i + (dx < 0 ? 1 : -1)))]
    if (next !== view.tab) { view.tab = next; view.openMeal = null; render() }
  }
  app.addEventListener('touchend', end, { passive: true })
  app.addEventListener('touchcancel', end, { passive: true })
}

render()
