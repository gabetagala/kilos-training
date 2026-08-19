// ─── TOMATO PLATE — app shell ───────────────────────────────────────────────
// Vanilla, localStorage-first, no framework. Renders whole screens; the state
// is small enough that diffing would cost more than it saves.
import { SPRITE, cutGlyph, icon } from './art.js'
import { ALLERGENS, AMOUNTS, EXPOSURE_TARGET, FOODS, HAND_GUIDE, MILK, REACTION, ROTATION_DAYS } from './data.js'
import { dayPlan, ironToday } from './plan.js'
import * as store from './store.js'

const app = document.getElementById('app')
document.body.insertAdjacentHTML('afterbegin', SPRITE)

const esc = (s = '') => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const possessive = (n) => (!n ? "Baby's" : /[sz]$/i.test(n) ? `${n}\u2019` : `${n}\u2019s`)
const MEAL_ORDER = ['breakfast', 'snack', 'lunch', 'dinner']
const TITLE = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' }

let view = { tab: 'today', food: null, age: null, sheet: null, openMeal: null }

/* ── derived ─────────────────────────────────────────────────────────────── */
const today = () => {
  const s = store.get()
  const day = store.planDay()
  const age = store.ageOf(s.profile.birthdate)
  const band = ageBand(age.months)
  return { s, day, age, band, plan: dayPlan(day, band) }
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

/** The whole "how do I actually make this" block — shared by Today and Food detail. */
function serveBlock(id, band) {
  const f = FOODS[id]
  if (!f) return ''
  const [spoon, hands] = f.cut[band] || f.cut[9]
  return `<div class="cuts">
      <div class="cut">${icon(cutGlyph(spoon), 52)}<b>On the spoon</b><span>${esc(spoon)}</span></div>
      <div class="cut hands">${icon(cutGlyph(hands), 52)}<b>In his hands</b><span>${esc(hands)}</span></div>
    </div>
    ${f.prep.length ? `<div style="margin-top:12px"><div class="eyebrow" style="margin-bottom:6px">Prepare it</div>
      <ol class="prep">${f.prep.map((p) => `<li>${esc(p)}</li>`).join('')}</ol></div>` : ''}
    ${f.buy ? `<div class="buy" style="margin-top:12px"><b>What to buy</b>${esc(f.buy)}</div>` : ''}
    ${f.safety ? `<div class="safety" style="margin-top:12px">${esc(f.safety)}</div>` : ''}`
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
        ${plan.note ? `<p class="hero-note">${esc(plan.note)}</p>` : ''}
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
    ? `<div><div class="eyebrow" style="margin-bottom:8px">How to serve it at ${band} months</div>
        ${serveBlock(plan.foodId, band)}</div>` : ''

  const meals = MEAL_ORDER.filter((k) => plan.meals[k] || (k === 'snack' && plan.snack)).map((k) => {
    const m = plan.meals[k] || { spoon: plan.snack, hands: '', foods: [] }
    const rec = logged[k]
    const art = FOODS[m.foods?.[0]]?.art || 'lugaw'
    const open = view.openMeal === k
    const detail = open && m.foods?.length
      ? `<div class="mealdetail">${m.foods.map((id) => `
          <div class="row" style="margin-bottom:8px">${icon(FOODS[id].art, 24)}
            <b style="font-size:12px">${esc(FOODS[id].name)}</b>
            <button class="link" data-food="${id}" style="margin-left:auto;font-size:11px">Open</button></div>
          ${serveBlock(id, band)}`).join('<hr style="border:0;border-top:1px solid rgba(42,30,25,.09);margin:14px 0">')}</div>`
      : ''
    return `<div class="meal">
      <div class="row" data-meal="${k}" style="cursor:pointer">
        ${icon(art, 32)}
        <div style="min-width:0">
          <div class="t">${TITLE[k]} <span class="soft" style="font-weight:600;font-size:10px">${open ? '▾' : '▸'}</span></div>
          <div class="d">${esc(m.spoon)}</div>
          ${m.hands ? `<div class="hands">✋ ${esc(m.hands)}</div>` : ''}
          ${m.alongside ? `<div class="d">Alongside: ${esc(m.alongside)}</div>` : ''}
          ${rec?.note ? `<div class="mealnote">\u201C${esc(rec.note)}\u201D</div>` : ''}
          ${rec?.amount ? `<div class="d" style="margin-top:2px">Ate: <b>${esc(rec.amount)}</b></div>` : ''}
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
      <div class="eyebrow">Day ${day} · ${age.label}</div>
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
    <div><div class="eyebrow" style="margin-bottom:8px">Today\u2019s meals${plan.mode === 'cycle' ? ' · tap for how to make it' : ''}</div>${meals}</div>
    ${due.length ? `<div class="note"><b style="color:var(--ink)">Due back in rotation:</b> ${due.map((d) => `${esc(d.name)} (${d.since}d)`).join(', ')}. Once an allergen is in, it stays in — at least weekly, for good.</div>` : ''}
  </div>`
}

function screenPlan() {
  const cur = store.planDay()
  const { band } = today()
  const rows = []
  for (let d = 1; d <= 120; d += 1) {
    const p = dayPlan(d, band)
    if (p.mode === 'trial' && p.trialDay !== 1) continue
    if (p.mode === 'cycle' && d > 76) break
    const isNow = d <= cur && cur < d + (p.mode === 'trial' ? 3 : 1)
    rows.push(p.mode === 'trial'
      ? `<div class="dayrow" data-day="${d}" style="${isNow ? 'background:var(--cream-2);border-radius:12px' : ''}">
          <div class="dnum">${d}</div>${icon(p.food.art, 28)}
          <div style="min-width:0"><div style="font-size:13px;font-weight:800">${esc(p.food.name)}</div>
            <div style="font-size:10px;font-weight:700;color:${p.allergen ? 'var(--amber)' : p.food.ironMg >= 1 ? 'var(--calyx)' : 'var(--ink-soft)'}">
              ${p.allergen ? `Allergen · ${p.allergen}` : p.food.ironMg >= 1 ? 'Iron' : esc(p.food.sub || p.food.cat)}</div></div>
          <div class="pips">${[1, 2, 3].map((i) => `<span class="pip ${isNow && cur - d + 1 >= i ? 'on' : ''}"></span>`).join('')}</div>
        </div>`
      : `<div class="dayrow" data-day="${d}"><div class="cyc">${p.cycle}</div>
          ${icon(FOODS[p.meals.dinner.foods[0]]?.art || 'lugaw', 28)}
          <div style="min-width:0"><div style="font-size:13px;font-weight:800">${esc(p.meals.dinner.spoon.split(' with ')[0])}</div>
            <div style="font-size:10px;color:var(--ink-soft)">${esc(p.iron)}</div></div></div>`)
  }
  return `<div class="scroll stack">
    <div><h1>The plan</h1><div class="soft" style="font-size:12px;margin-top:3px">One new ingredient every 3 days, then a repeating cycle</div></div>
    <div><div class="eyebrow" style="margin-bottom:6px">Months 6–8 · single-ingredient trials</div>${rows.slice(0, 23).join('')}</div>
    <div><div class="eyebrow" style="margin:6px 0">From month 8 — the cycle repeats</div>${rows.slice(23).join('')}
      <div class="note" style="margin-top:11px">The repeat is on purpose. Familiar food is what he learns to eat, and the cycle keeps every allergen coming round at least weekly while liver never lands more than twice.</div></div>
  </div>`
}

function screenFoods() {
  const s = store.get()
  const cards = Object.entries(FOODS).map(([id, f]) => {
    const rec = s.foods[id]
    return `<div class="fcard" data-food="${id}">${icon(f.art, 36)}<b>${esc(f.name)}</b>
      <span>${rec ? `${rec.exposures}× tried` : esc(f.sub || f.cat)}</span></div>`
  }).join('')
  return `<div class="scroll stack">
    <div><h1>Foods</h1><div class="soft" style="font-size:12px;margin-top:3px">How to cut it, at every age</div></div>
    <div class="foodgrid">${cards}</div>
    <div class="note">Every serving instruction here is authored from public guidance — NHS, CDC, USDA, and the allergy guidelines. Nothing is copied from another app.</div>
  </div>`
}

function screenFood(id) {
  const f = FOODS[id]
  const s = store.get()
  const rec = s.foods[id]
  const band = view.age || 9
  const serveBlockInline = serveBlock(id, band)
  const notes = store.notesFor(id)
  const tint = f.allergen ? 'var(--amber)' : f.ironMg >= 1 ? 'var(--calyx)' : 'var(--tomato-soft)'
  return `<div class="scroll" style="padding:0">
    <div style="background:${tint};height:150px;display:grid;place-items:center;position:relative">
      <button class="link" data-back style="position:absolute;left:14px;top:12px;font-size:20px;text-decoration:none;color:var(--cream)">‹</button>
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
        <div class="eyebrow" style="margin-bottom:8px">How to serve it at ${band} months</div>
        ${serveBlockInline}
      </div>
      <div class="note"><b style="color:var(--ink)">Squash test.</b> Every piece must squash between your finger and thumb with light pressure. If it doesn't, cook it longer.</div>
      ${notes.length ? `<div><div class="eyebrow" style="margin-bottom:7px">What you noticed</div>
        ${notes.map((n) => `<div class="notelog"><div class="row" style="gap:7px;margin-bottom:3px">
          <span style="font-size:13px">${n.verdict === 'down' ? '👎' : '👍'}</span>
          <span class="soft" style="font-size:10px;font-weight:700">${esc(n.date)}</span></div>
          <div style="font-size:12px;line-height:1.45">${esc(n.note)}</div></div>`).join('')}</div>` : ''}
      <div class="soft" style="font-size:11px;text-align:center">${rec ? `Served ${rec.exposures}× · last ${esc(rec.lastServed)}` : 'Not tried yet'}</div>
      <button class="btn" data-logfood="${id}">Log ${esc(f.name)} today</button>
    </div>
  </div>`
}

function screenBaby() {
  const { s, age } = today()
  const rows = allergenRows()
  const tried = Object.keys(s.foods).length
  const total = Object.keys(FOODS).length
  const milk = MILK.find((m) => m.m === Math.min(12, Math.max(6, age.months))) || MILK[0]
  const pct = Math.round((tried / total) * 132)
  return `<div class="scroll stack">
    <div style="text-align:center;padding:8px 0 4px">
      <div style="width:70px;height:70px;border-radius:999px;background:var(--tomato-soft);margin:0 auto 10px;display:grid;place-items:center;font-size:32px">👶</div>
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
  </div>`
}

function screenOnboard() {
  return `<div class="scroll stack" style="justify-content:center;display:flex;flex-direction:column">
    <div style="text-align:center">
      ${icon('logo', 72, 'ic')}
      <div class="wordmark" style="margin-top:12px"><span class="l1">TOMATO</span><span class="l2">PLATE</span></div>
      <p class="soft" style="font-size:13px;margin:16px 0 4px;line-height:1.5">Every food, how to cut it,<br>and what he thought of it.</p>
    </div>
    <div><div class="eyebrow" style="margin-bottom:6px">His name</div><input type="text" id="ob-name" placeholder="Baby's name" autocomplete="off"></div>
    <div><div class="eyebrow" style="margin-bottom:6px">Birthday</div><input type="date" id="ob-dob"></div>
    <div><div class="eyebrow" style="margin-bottom:6px">First day of solids</div><input type="date" id="ob-start" value="${store.todayISO()}"></div>
    <button class="btn" data-onboard>Start the plan</button>
    <p class="soft" style="font-size:10px;text-align:center;line-height:1.5">Not medical advice. Always follow your pediatrician's guidance.</p>
  </div>`
}

/* ── log sheet ───────────────────────────────────────────────────────────── */
function sheetLog(ctx) {
  const f = FOODS[ctx.foods?.[0]]
  const exposures = (store.get().foods[ctx.foods?.[0]]?.exposures || 0) + 1
  const encourage = ctx.verdict === 'down' && exposures < EXPOSURE_TARGET
  return `<div class="scrim" data-close><div class="sheet stack" data-stop>
    <div class="grab"></div>
    <div class="row">${icon(f?.art || 'lugaw', 42)}
      <div><div style="font-size:17px;font-weight:900">${esc(ctx.label)}</div>
        <div class="soft" style="font-size:11px">${esc(TITLE[ctx.key] || '')} · exposure ${exposures}</div></div></div>
    <div><div class="eyebrow" style="margin-bottom:8px">How did it go?</div>
      <div class="row" style="gap:9px">
        <button class="card" data-v="up" style="flex:1;text-align:center;border:0;font:inherit;cursor:pointer;${ctx.verdict === 'up' ? 'background:var(--calyx);color:#fff' : ''}">
          <div style="font-size:25px">👍</div><div style="font-size:11px;font-weight:800;margin-top:4px">Liked it</div></button>
        <button class="card" data-v="down" style="flex:1;text-align:center;border:0;font:inherit;cursor:pointer;${ctx.verdict === 'down' ? 'background:var(--tomato);color:var(--cream)' : ''}">
          <div style="font-size:25px">👎</div><div style="font-size:11px;font-weight:800;margin-top:4px">Not today</div></button>
      </div></div>
    ${encourage ? `<div class="encourage">That's exposure <b>${exposures} of ${EXPOSURE_TARGET}</b>. Most parents stop at 3–5 — the evidence says keep going. Try again in a few days.</div>` : ''}
    <div><div class="eyebrow" style="margin-bottom:8px">How much</div>
      <div class="amounts">${['none', 'a taste', 'some', 'lots'].map((a) => `<button data-amt="${a}" class="${ctx.amount === a ? 'on' : ''}">${a}</button>`).join('')}</div></div>
    <textarea id="log-note" placeholder="Anything worth remembering?">${esc(ctx.note || '')}</textarea>
    <div class="row">
      <button class="link" data-reaction>Flag a reaction</button>
      <button class="btn" data-save style="margin-left:auto;width:auto;padding:13px 30px">Save</button>
    </div>
  </div></div>`
}

function sheetHands() {
  return `<div class="scrim" data-close><div class="sheet stack" data-stop>
    <div class="grab"></div>
    <h2>Sizing by hand</h2>
    <p class="soft" style="font-size:12px;line-height:1.5">Everything in this app is measured against a hand, not a ruler. Yours for amounts, his for portions.</p>
    ${HAND_GUIDE.map(([k, v]) => `<div class="card"><div style="font-size:13px;font-weight:800;margin-bottom:2px">${esc(k)}</div>
      <div class="soft" style="font-size:11.5px;line-height:1.5">${esc(v)}</div></div>`).join('')}
    <button class="btn ghost" data-close>Got it</button>
  </div></div>`
}

function sheetReaction() {
  return `<div class="scrim" data-close><div class="sheet stack" data-stop>
    <div class="grab"></div>
    <h2>Is it a reaction?</h2>
    <div class="safety"><b>Get help immediately</b><ul style="margin:6px 0 0 16px;font-weight:600">${REACTION.urgent.map((r) => `<li>${esc(r)}</li>`).join('')}</ul></div>
    <div class="note"><b style="color:var(--ink)">Mild</b> — ${REACTION.mild.map(esc).join(', ').toLowerCase()}. Call the pediatrician if it appears within 2 hours.</div>
    <div class="encourage">${esc(REACTION.notReaction)}</div>
    <button class="btn ghost" data-close>Close</button>
  </div></div>`
}

/* ── render + events ─────────────────────────────────────────────────────── */
const TABS = [['today', '●', 'Today'], ['plan', '▤', 'Plan'], ['foods', '❋', 'Foods'], ['baby', '◍', 'Baby']]

function render() {
  if (!store.isOnboarded()) { app.innerHTML = screenOnboard(); return }
  const body = view.food ? screenFood(view.food)
    : view.tab === 'plan' ? screenPlan()
    : view.tab === 'foods' ? screenFoods()
    : view.tab === 'baby' ? screenBaby()
    : screenToday()
  const bar = view.food ? '' : `<nav class="tabbar">${TABS.map(([id, ic, label]) =>
    `<button data-tab="${id}" class="${view.tab === id ? 'on' : ''}"><i>${ic}</i>${label}</button>`).join('')}</nav>`
  const sheetEl = !view.sheet ? '' : view.sheet.kind === 'reaction' ? sheetReaction() : view.sheet.kind === 'hands' ? sheetHands() : sheetLog(view.sheet)
  app.innerHTML = body + bar + sheetEl
}

app.addEventListener('click', (e) => {
  const hit = (sel) => e.target.closest(sel)
  const sheet = view.sheet

  // Every interaction re-renders the sheet, which recreates the textarea —
  // grab whatever is typed BEFORE that happens or the note is lost.
  if (view.sheet?.kind === 'log') {
    const ta = document.getElementById('log-note')
    if (ta) view.sheet.note = ta.value
  }

  if (hit('[data-onboard]')) {
    const name = document.getElementById('ob-name').value.trim()
    const birthdate = document.getElementById('ob-dob').value
    const startDate = document.getElementById('ob-start').value || store.todayISO()
    if (!birthdate) { document.getElementById('ob-dob').focus(); return }
    store.saveProfile({ name, birthdate, startDate })
    return render()
  }
  if (hit('[data-tab]')) { view.tab = hit('[data-tab]').dataset.tab; view.food = null; return render() }
  if (hit('[data-back]')) { view.food = null; return render() }
  if (hit('[data-hands]')) { view.sheet = { kind: 'hands' }; return render() }
  if (hit('[data-food]')) { view.food = hit('[data-food]').dataset.food; view.age ??= ageBand(today().age.months); return render() }
  if (hit('[data-age]')) { view.age = +hit('[data-age]').dataset.age; return render() }
  if (hit('[data-day]')) { view.tab = 'today'; return render() }

  // open the log sheet
  const th = hit('[data-log]')
  if (th) {
    const key = th.dataset.log
    const plan = dayPlan(store.planDay(), today().band)
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
    if (hit('[data-reaction]')) { view.sheet = { kind: 'reaction' }; return render() }
    if (hit('[data-v]')) { sheet.verdict = hit('[data-v]').dataset.v; return render() }
    if (hit('[data-amt]')) { sheet.amount = hit('[data-amt]').dataset.amt; return render() }
    if (hit('[data-save]')) {
      store.logMeal({ key: sheet.key, verdict: sheet.verdict || 'up', amount: sheet.amount, note: sheet.note || '', foods: sheet.foods })
      for (const id of sheet.foods) if (FOODS[id]?.allergen) store.markAllergen(FOODS[id].allergen)
      view.sheet = null
      return render()
    }
    // backdrop, or any explicit close button (which lives inside [data-stop])
    if (e.target.classList.contains('scrim') || hit('button[data-close]')) { view.sheet = null; return render() }
  }

  if (hit('[data-export]')) {
    const blob = new Blob([JSON.stringify(store.get(), null, 2)], { type: 'application/json' })
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob), download: `tomato-plate-${store.todayISO()}.json`,
    })
    a.click(); URL.revokeObjectURL(a.href)
  }
})

render()
