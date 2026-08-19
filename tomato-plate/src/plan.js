// ─── Turning a plan-day into "what do I feed him right now" ─────────────────
import { CYCLE, FOODS, TRIALS } from './data.js'

export const TRIAL_LEN = 3
const M6 = TRIALS[6].length * TRIAL_LEN            // 30
const M7 = M6 + TRIALS[7].length * TRIAL_LEN       // 60
const M8 = M7 + TRIALS[8].length * TRIAL_LEN       // 69

/** Every food already through its 3-day trial before day n. */
function clearedBefore(n) {
  const out = []
  for (const [month, list] of Object.entries(TRIALS)) {
    const offset = month === '6' ? 0 : month === '7' ? M6 : M7
    list.forEach((t, i) => {
      if (offset + (i + 1) * TRIAL_LEN < n) out.push(t.food)
    })
  }
  return out
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

/** The 3-day trial slot containing day n (null once the cycle starts). */
export function slotOf(n) {
  if (n > M8) return null
  const [list, offset] = n <= M6 ? [TRIALS[6], 0] : n <= M7 ? [TRIALS[7], M6] : [TRIALS[8], M7]
  const i = Math.floor((n - offset - 1) / TRIAL_LEN)
  return { start: offset + i * TRIAL_LEN + 1, foodId: list[i].food, note: list[i].note }
}

/**
 * What day `n` of the plan looks like.
 * Days 1–69 are 3-day single-ingredient trials (the pediatrician's rule).
 * From day 70 a 7-day cycle repeats — deliberately, so allergens come round
 * weekly and liver never lands more than twice.
 */
export function dayPlan(n, band = 9, swapId = null) {
  if (n <= M8) {
    const [month, list, offset] =
      n <= M6 ? [6, TRIALS[6], 0] : n <= M7 ? [7, TRIALS[7], M6] : [8, TRIALS[8], M7]
    const i = Math.floor((n - offset - 1) / TRIAL_LEN)
    const trial = list[i]
    const foodId = swapId && FOODS[swapId] ? swapId : trial.food
    const food = FOODS[foodId]
    const cleared = clearedBefore(n)
    return {
      mode: 'trial', month, day: n,
      trialDay: ((n - offset - 1) % TRIAL_LEN) + 1, trialLen: TRIAL_LEN,
      foodId, food, note: trial.note, allergen: food.allergen,
      swappedFrom: foodId !== trial.food ? trial.food : null,
      cleared, meals: trialMeals(foodId, food, cleared, band),
    }
  }
  const c = CYCLE[(n - M8 - 1) % CYCLE.length]
  return { mode: 'cycle', month: 8, day: n, cycle: c.id, snack: c.snack, iron: c.iron, meals: c.meals }
}

/** Foods carrying iron on a given day's plan. */
export function ironToday(plan) {
  const ids = Object.values(plan.meals).flatMap((m) => m.foods || [])
  return ids.filter((id) => (FOODS[id]?.ironMg || 0) >= 1)
}

export const planLength = { M6, M7, M8 }

/**
 * What can stand in when the day's ingredient isn't in the house.
 * The slot has a JOB, and the substitute has to do the same job:
 *   allergen day  -> only the same allergen (fish for fish), never a bystander
 *   iron day      -> another iron-rich food
 *   otherwise     -> the same food group, untried first
 */
export function swapOptions(foodId) {
  const f = FOODS[foodId]
  if (!f) return []
  const rest = Object.entries(FOODS).filter(([id]) => id !== foodId)
  if (f.allergen) return rest.filter(([, x]) => x.allergen === f.allergen).map(([id, x]) => ({ id, ...x, why: `Also ${f.allergen}` }))
  if (f.ironMg >= 1) return rest.filter(([, x]) => x.ironMg >= 1).map(([id, x]) => ({ id, ...x, why: `${x.ironMg}mg iron` }))
  return rest.filter(([, x]) => x.cat === f.cat && !x.allergen).map(([id, x]) => ({ id, ...x, why: x.cat }))
}

/**
 * Which plan day each food actually lands on, once swaps are applied — and
 * which foods a swap pushed out of the plan. A displaced food is NOT dropped;
 * it has no date any more and the Foods tab says so, so it can be swapped back
 * in rather than quietly disappearing.
 */
export function scheduleIndex(swaps = {}) {
  const schedule = {}
  const displaced = new Set()
  for (const [month, list] of Object.entries(TRIALS)) {
    const offset = month === '6' ? 0 : month === '7' ? M6 : M7
    list.forEach((t, i) => {
      const start = offset + i * TRIAL_LEN + 1
      const actual = swaps[start] || t.food
      schedule[actual] ??= start
      if (actual !== t.food) displaced.add(t.food)
    })
  }
  for (const id of displaced) if (schedule[id] !== undefined) displaced.delete(id)
  return { schedule, displaced }
}
