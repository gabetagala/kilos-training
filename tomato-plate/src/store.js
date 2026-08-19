// ─── localStorage-first store ───────────────────────────────────────────────
// Every write lands locally first; nothing here ever waits on a network call.
const KEY = 'tomato-plate-v1'

const today = () => new Date().toISOString().slice(0, 10)

const DEFAULT = {
  profile: { name: '', birthdate: '', startDate: today() },
  // { [isoDate]: { [mealOrFoodId]: { verdict:'up'|'down', amount, note, foods:[], ts } } }
  log: {},
  // { [foodId]: { exposures, lastServed, liked } }
  foods: {},
  // { [allergenId]: { introduced, lastServed } }
  allergens: {},
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
  state.log[date][key] = { verdict, amount, note, foods, ts: Date.now() }
  for (const id of foods) {
    const f = (state.foods[id] ??= { exposures: 0, lastServed: null, liked: 0 })
    f.exposures += 1
    f.lastServed = date
    if (verdict === 'up') f.liked += 1
  }
  persist()
  return foods.map((id) => ({ id, exposures: state.foods[id].exposures }))
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
  const anchor = new Date(b)
  anchor.setMonth(b.getMonth() + months)
  const weeks = Math.floor((now - anchor) / 604800000)
  return { months, weeks, label: `${months} mo${weeks ? `, ${weeks} wk` : ''}` }
}

/** 1-based day index into the plan. */
export const planDay = (startDate = state.profile.startDate, now = new Date()) =>
  Math.max(1, Math.floor((now - new Date(`${startDate}T00:00:00`)) / 86400000) + 1)

export const todayISO = today

export function reset() {
  state = structuredClone(DEFAULT)
  persist()
}
