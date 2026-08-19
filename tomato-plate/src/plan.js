// ─── Turning a plan-day into "what do I feed him right now" ─────────────────
import { CYCLE, FOODS, TRIALS } from './data.js'

export const TRIAL_LEN = 3
const M6 = TRIALS[6].length * TRIAL_LEN            // 30
const M7 = M6 + TRIALS[7].length * TRIAL_LEN       // 60
const M8 = M7 + TRIALS[8].length * TRIAL_LEN       // 69

/**
 * Every 3-day trial slot, with swaps applied.
 *
 * A swap moves the WHOLE slot — a trial split between two ingredients tests
 * neither. And the food that got displaced keeps a real date: being out of
 * kalabasa this week is an availability problem, not a decision to skip it,
 * so it re-queues onto the next free slot after the scheduled trials rather
 * than dropping out of the plan.
 */
export function planSlots(swaps = {}) {
  const base = []
  for (const [month, list] of Object.entries(TRIALS)) {
    const offset = month === '6' ? 0 : month === '7' ? M6 : M7
    list.forEach((t, i) => base.push({ start: offset + i * TRIAL_LEN + 1, original: t.food, note: t.note }))
  }
  base.sort((a, b) => a.start - b.start)

  // A swap is a TRADE. If the stand-in already has a slot of its own, the two
  // simply exchange places — the food you were out of takes the other's date
  // rather than being shunted to the back of the queue. Only a stand-in with
  // no slot of its own (already eaten, or never scheduled) leaves the
  // displaced food needing a fresh date at the end.
  const at = new Map(base.map((s) => [s.start, s.original]))
  const queued = []
  for (const start of Object.keys(swaps).map(Number).sort((a, b) => a - b)) {
    const incoming = swaps[start]
    if (!incoming || !at.has(start)) continue
    const outgoing = at.get(start)
    if (outgoing === incoming) continue
    let otherStart = null
    for (const [k, v] of at) if (v === incoming) { otherStart = k; break }
    at.set(start, incoming)
    if (otherStart !== null) at.set(otherStart, outgoing)
    else queued.push(outgoing)
  }

  const slots = base.map((s) => ({ start: s.start, original: s.original, food: at.get(s.start), note: s.note }))
  const last = base[base.length - 1].start
  queued.forEach((food, i) => {
    slots.push({
      start: last + TRIAL_LEN * (i + 1),
      original: food, food, rescheduled: true,
      note: 'Moved — you were out of it',
    })
  })
  return slots
}

/** The slot containing day n, or null once the trials are done. */
export function slotOf(n, swaps = {}) {
  return planSlots(swaps).find((s) => n >= s.start && n < s.start + TRIAL_LEN) || null
}

/** Where each food actually lands, once swaps and re-queues are applied. */
export function scheduleIndex(swaps = {}) {
  const home = {}
  for (const s of planSlots()) home[s.original] ??= s.start
  const schedule = {}
  const moved = {}
  for (const s of planSlots(swaps)) {
    schedule[s.food] ??= s.start
    if (home[s.food] !== undefined && home[s.food] !== s.start) moved[s.food] ??= s.start
  }
  return { schedule, moved }
}

/** Every food already through a trial that finished before day n. */
function clearedBefore(n, swaps) {
  return planSlots(swaps).filter((s) => s.start + TRIAL_LEN <= n).map((s) => s.food)
}

/** During the trial months there's one designated meal; cleared foods ride along. */
function trialMeals(id, food, cleared, band) {
  const hands = food.cut[band]?.[1]
  return {
    lunch: {
      spoon: `${food.name} — ${food.cut[6][0]}`,
      hands: hands && !/not yet|never/i.test(hands) ? hands : '',
      foods: [id],
      alongside: cleared.slice(-3).map((c) => FOODS[c].name).join(', '),
    },
  }
}

/**
 * What day `n` looks like. Trials run until the slot list is exhausted (which
 * a swap can extend), then a 7-day cycle repeats — deliberately, so every
 * allergen comes round weekly and liver never lands more than twice.
 */
export function dayPlan(n, band = 9, swaps = {}) {
  const slots = planSlots(swaps)
  const slot = slots.find((s) => n >= s.start && n < s.start + TRIAL_LEN)
  if (slot) {
    const food = FOODS[slot.food]
    const cleared = clearedBefore(n, swaps)
    return {
      mode: 'trial', month: slot.start <= M6 ? 6 : slot.start <= M7 ? 7 : 8, day: n,
      trialDay: n - slot.start + 1, trialLen: TRIAL_LEN,
      foodId: slot.food, food, note: slot.note, allergen: food.allergen,
      swappedFrom: slot.food !== slot.original ? slot.original : null,
      rescheduled: Boolean(slot.rescheduled),
      slotStart: slot.start, cleared,
      meals: trialMeals(slot.food, food, cleared, band),
    }
  }
  const last = slots[slots.length - 1]
  const cycleStart = last.start + TRIAL_LEN
  const c = CYCLE[Math.max(0, n - cycleStart) % CYCLE.length]
  return { mode: 'cycle', month: 8, day: n, cycle: c.id, snack: c.snack, iron: c.iron, meals: c.meals }
}

/** Foods carrying iron on a given day's plan. */
export function ironToday(plan) {
  const ids = Object.values(plan.meals).flatMap((m) => m.foods || [])
  return ids.filter((id) => (FOODS[id]?.ironMg || 0) >= 1)
}

/**
 * What can stand in when the day's ingredient isn't in the house.
 * The slot has a JOB and the substitute has to do the same job:
 *   allergen day -> only the same allergen, never a bystander
 *   iron day     -> another iron-rich food
 *   otherwise    -> the same food group
 */
export function swapOptions(foodId) {
  const f = FOODS[foodId]
  if (!f) return []
  const rest = Object.entries(FOODS).filter(([id]) => id !== foodId)
  if (f.allergen) return rest.filter(([, x]) => x.allergen === f.allergen).map(([id, x]) => ({ id, ...x, why: `Also ${f.allergen}` }))
  if (f.ironMg >= 1) return rest.filter(([, x]) => x.ironMg >= 1).map(([id, x]) => ({ id, ...x, why: `${x.ironMg}mg iron` }))
  return rest.filter(([, x]) => x.cat === f.cat && !x.allergen).map(([id, x]) => ({ id, ...x, why: x.cat }))
}

export const planLength = { M6, M7, M8 }
