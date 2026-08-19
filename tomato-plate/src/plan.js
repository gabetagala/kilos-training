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
function trialMeals(id, food, cleared) {
  const hands = food.cut[9]?.[1]
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
 * What day `n` of the plan looks like.
 * Days 1–69 are 3-day single-ingredient trials (the pediatrician's rule).
 * From day 70 a 7-day cycle repeats — deliberately, so allergens come round
 * weekly and liver never lands more than twice.
 */
export function dayPlan(n) {
  if (n <= M8) {
    const [month, list, offset] =
      n <= M6 ? [6, TRIALS[6], 0] : n <= M7 ? [7, TRIALS[7], M6] : [8, TRIALS[8], M7]
    const i = Math.floor((n - offset - 1) / TRIAL_LEN)
    const trial = list[i]
    const food = FOODS[trial.food]
    const cleared = clearedBefore(n)
    return {
      mode: 'trial', month, day: n,
      trialDay: ((n - offset - 1) % TRIAL_LEN) + 1, trialLen: TRIAL_LEN,
      foodId: trial.food, food, note: trial.note, allergen: food.allergen,
      cleared, meals: trialMeals(trial.food, food, cleared),
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
