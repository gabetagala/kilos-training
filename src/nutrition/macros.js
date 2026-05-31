// Nutrition math — pure, no DOM, no storage. The macro/calorie calculator with
// a registered-dietitian-backed SAFE-rate guardrail. Unit-tested in
// tests/unit/macros.test.js. (M1 prototype — not yet wired to UI.)
//
// Evidence base (see NUTRITION-RESEARCH.md):
//   BMR        — Mifflin-St Jeor (Academy of Nutrition & Dietetics review:
//                within 10% of measured RMR in ~82% of people, beats Harris-Benedict)
//   safe rate  — 0.5–1 kg/week ≈ 0.5–1% bodyweight/week (Academy of Nutrition &
//                Dietetics, ACSM, CDC). ISSN: slower loss preserves more muscle.
//   deficit    — 1 kg fat ≈ 7700 kcal (a STARTING estimate; recalibrate from
//                the user's logged weight — metabolic adaptation slows real loss)
//   floors     — ~1200 kcal ♀ / 1500 ♂, and never below BMR (cap the deficit,
//                don't starve — matters for smaller-bodied PH users)
//   macros     — protein 1.6–2.2 g/kg (ISSN), fat 20–35% (floor ~0.6 g/kg),
//                carbs = remainder (suits rice-heavy Filipino diets)

const KCAL_PER_KG = 7700; // approx energy in 1 kg of body fat (Wishnofsky)

export const ACTIVITY = {
  sedentary: 1.2, // little / no exercise
  light: 1.375, // 1–3 days/week
  moderate: 1.55, // 3–5 days/week
  very: 1.725, // 6–7 days/week
  extra: 1.9, // hard daily training / physical job
};

// Mifflin-St Jeor BMR. weightKg, heightCm, age in years; sex 'male' | 'female'.
// Returns kcal/day (rounded) or null on junk input.
export function bmrMifflinStJeor({ weightKg, heightCm, age, sex } = {}) {
  const w = parseFloat(weightKg);
  const h = parseFloat(heightCm);
  const a = parseFloat(age);
  if (!(w > 0) || !(h > 0) || !(a > 0)) return null;
  const base = 10 * w + 6.25 * h - 5 * a;
  return Math.round(base + (sex === 'female' ? -161 : 5));
}

// Total Daily Energy Expenditure = BMR × activity multiplier. Returns kcal/day.
export function tdee({ weightKg, heightCm, age, sex, activity } = {}) {
  const bmr = bmrMifflinStJeor({ weightKg, heightCm, age, sex });
  if (bmr == null) return null;
  const mult = ACTIVITY[activity] ?? ACTIVITY.moderate;
  return Math.round(bmr * mult);
}

// The safe maximum weekly rate (kg) for a given bodyweight: min(1 kg, 1% of
// bodyweight). Expressing it as % bodyweight makes the cap scale with body size.
export function safeMaxRateKg(weightKg) {
  const w = parseFloat(weightKg);
  if (!(w > 0)) return 1;
  return Math.min(1, Math.round(w * 0.01 * 100) / 100);
}

// Build a full daily plan. goal: 'lose' | 'maintain' | 'gain'.
// requestedRateKg = desired kg/week (ignored for 'maintain'). Defaults to a
// gentle 0.5 kg/week. Returns null on junk input.
//
// The guardrail: the requested rate is clamped to the safe max; if hitting the
// calorie floor would otherwise force a bigger deficit, we cap the deficit
// (slower loss) rather than prescribe an unsafe intake.
export function macroPlan({
  weightKg,
  heightCm,
  age,
  sex,
  activity,
  goal = 'maintain',
  requestedRateKg = 0.5,
} = {}) {
  const bmr = bmrMifflinStJeor({ weightKg, heightCm, age, sex });
  const maintenance = tdee({ weightKg, heightCm, age, sex, activity });
  if (bmr == null || maintenance == null) return null;
  const w = parseFloat(weightKg);

  // Clamp the requested rate into the safe band.
  const safeMax = safeMaxRateKg(w);
  const requested = Math.max(0, parseFloat(requestedRateKg) || 0);
  const cappedForSafety = goal !== 'maintain' && requested > safeMax;
  let rate = goal === 'maintain' ? 0 : Math.min(requested, safeMax);

  // Translate rate → daily calorie delta (negative = deficit).
  const sign = goal === 'gain' ? 1 : -1;
  let delta = goal === 'maintain' ? 0 : sign * Math.round((rate * KCAL_PER_KG) / 7);
  let calories = maintenance + delta;

  // Safety floor (loss only): never below the sex floor or BMR — cap the
  // deficit instead of starving. Recompute the effective rate after capping.
  const floor = Math.max(sex === 'female' ? 1200 : 1500, bmr);
  let cappedByFloor = false;
  if (goal === 'lose' && calories < floor) {
    calories = floor;
    delta = calories - maintenance; // smaller (less negative) deficit
    rate = Math.round((Math.abs(delta) * 7) / KCAL_PER_KG / 0.05) * 0.05; // to 0.05kg
    cappedByFloor = true;
  }

  // Macros — protein first (preserve muscle), fat next, carbs fill the rest.
  const proteinPerKg = goal === 'lose' ? 2.0 : 1.8; // within ISSN 1.6–2.2 g/kg
  const protein = Math.round(w * proteinPerKg);
  // Fat ~25% of calories, but never below ~0.6 g/kg (hormonal floor).
  const fat = Math.max(Math.round((calories * 0.25) / 9), Math.round(w * 0.6));
  const carbs = Math.max(
    0,
    Math.round((calories - protein * 4 - fat * 9) / 4),
  );

  return {
    bmr,
    maintenance,
    calories: Math.round(calories),
    dailyDelta: Math.round(delta), // effective deficit/surplus after caps
    rateKg: goal === 'maintain' ? 0 : Math.round(rate * 100) / 100,
    safeMaxRateKg: safeMax,
    cappedForSafety, // requested rate exceeded the safe max
    cappedByFloor, // calorie floor forced a gentler deficit
    protein,
    fat,
    carbs,
  };
}

// Honest timeline: whole weeks to move from currentKg to goalKg at rateKg/week.
// Returns null if the goal direction doesn't need a change or inputs are junk.
export function weeksToGoal(currentKg, goalKg, rateKg) {
  const c = parseFloat(currentKg);
  const g = parseFloat(goalKg);
  const r = Math.abs(parseFloat(rateKg) || 0);
  if (!(c > 0) || !(g > 0) || !(r > 0)) return null;
  const diff = Math.abs(c - g);
  if (diff < 0.1) return 0;
  return Math.ceil(diff / r);
}
