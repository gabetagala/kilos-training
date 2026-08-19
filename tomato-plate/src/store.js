// ─── localStorage-first store ───────────────────────────────────────────────
// Every write lands locally first; nothing here ever waits on a network call.
const KEY = 'tomato-plate-v1'

// LOCAL calendar day, not UTC. toISOString() in Manila (UTC+8) returns the
// previous date until 08:00, which filed every early-morning log under
// yesterday and overwrote it.
const today = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const DEFAULT = {
  profile: { name: '', birthdate: '', startDate: today(), preTried: [] },
  // { [isoDate]: { [mealOrFoodId]: { verdict:'up'|'down', amount, note, foods:[], ts } } }
  log: {},
  // { [foodId]: { exposures, lastServed, liked } }
  foods: {},
  // { [allergenId]: { introduced, lastServed } }
  allergens: {},
  // { [planDay]: foodId } — the day's food was unavailable, this went instead
  swaps: {},
}

let state = load()

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return structuredClone(DEFAULT)
    return { ...structuredClone(DEFAULT), ...JSON.parse(raw) }
  } catch {
    return structuredClone(DEFAULT)
  }
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* quota or private mode — the session still works in memory */
  }
}

export const get = () => state
export const isOnboarded = () => Boolean(state.profile.birthdate)

export function saveProfile(p) {
  state.profile = { ...state.profile, ...p }
  persist()
}

/** Log one meal. Returns the food's new exposure count for the encouragement line. */
export function logMeal({ date = today(), key, verdict, amount = '', note = '', foods = [] }) {
  state.log[date] ??= {}
  // Re-saving the same meal is a CORRECTION, not another serving — counting it
  // again would inflate the exposure number the whole app is built on.
  const prev = state.log[date][key]
  state.log[date][key] = { verdict, amount, note, foods, ts: Date.now() }
  for (const id of foods) {
    const f = (state.foods[id] ??= { exposures: 0, lastServed: null, liked: 0 })
    if (!prev) f.exposures += 1
    f.lastServed = date
    if (verdict === 'up' && prev?.verdict !== 'up') f.liked += 1
    if (verdict !== 'up' && prev?.verdict === 'up') f.liked = Math.max(0, f.liked - 1)
  }
  persist()
  return foods.map((id) => ({ id, exposures: state.foods[id].exposures }))
}

/** Swap the day's ingredient for an equivalent one (see plan.swapOptions). */
export function setSwap(day, foodId) {
  if (foodId) state.swaps[day] = foodId
  else delete state.swaps[day]
  persist()
}

/** Backfill a food he has already had, before the app existed. */
export function markTried(foodId, date = today(), allergen = null) {
  const f = (state.foods[foodId] ??= { exposures: 0, lastServed: null, liked: 0 })
  f.exposures = Math.max(1, f.exposures)
  if (!f.lastServed || f.lastServed < date) f.lastServed = date
  if (allergen) {
    const a = (state.allergens[allergen] ??= { introduced: null, lastServed: null })
    a.introduced ??= date
    if (!a.lastServed || a.lastServed < date) a.lastServed = date
  }
  persist()
}

export function forgetTried(foodId) {
  delete state.foods[foodId]
  persist()
}

export function markAllergen(id, date = today()) {
  const a = (state.allergens[id] ??= { introduced: null, lastServed: null })
  a.introduced ??= date
  a.lastServed = date
  persist()
}

export const daysSince = (iso) =>
  iso ? Math.floor((Date.now() - new Date(`${iso}T00:00:00`)) / 86400000) : null

/** Whole months + leftover days, from a birthdate. */
export function ageOf(birthdate, now = new Date()) {
  if (!birthdate) return { months: 6, weeks: 0, label: '—' }
  const b = new Date(`${birthdate}T00:00:00`)
  let months = (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth())
  if (now.getDate() < b.getDate()) months -= 1
  // A birthdate in the future is a typo, not a negative age.
  if (months < 0) return { months: 0, weeks: 0, label: 'not born yet' }
  // setMonth overflows: Jan 31 + 1 month lands on Mar 3, which made the week
  // count negative. Clamp the day to the target month's length.
  const y = b.getFullYear()
  const m = b.getMonth() + months
  const lastDay = new Date(y, m + 1, 0).getDate()
  const anchor = new Date(y, m, Math.min(b.getDate(), lastDay))
  const weeks = Math.max(0, Math.floor((now - anchor) / 604800000))
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`
  const label = weeks ? `${plural(months, 'month')}, ${plural(weeks, 'week')}` : plural(months, 'month')
  return { months, weeks, label }
}

/** 1-based day index into the plan. */
export const planDay = (startDate = state.profile.startDate, now = new Date()) =>
  Math.max(1, Math.floor((now - new Date(`${startDate}T00:00:00`)) / 86400000) + 1)

export const todayISO = today

/** Every note ever written on a meal containing this food, newest first. */
export function notesFor(foodId) {
  const out = []
  for (const [date, meals] of Object.entries(state.log)) {
    for (const rec of Object.values(meals)) {
      if (rec.note && rec.foods?.includes(foodId)) out.push({ date, note: rec.note, verdict: rec.verdict })
    }
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : -1))
}

export function reset() {
  state = structuredClone(DEFAULT)
  persist()
}
