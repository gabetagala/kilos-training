// Progression math — pure, no DOM, no storage. Unit-tested in
// tests/unit/progression.test.js. Extracted from main.js per STANDARDS.md §4.

// Classic-loop prescriptions are ranges ("5–8", "8–12/side") — double
// progression gates on the TOP of the range: every set at the top → add load.
// Gating on the bottom made +2.5kg fire on every session regardless of
// performance.
//
// THE GUIDED PROGRAM IS DIFFERENT (2026-08-10): its prescriptions are single
// numbers and its EMOM sets auto-log exactly the prescribed reps, so "hit the
// top" is structurally always true there and carries no information. The
// guided player therefore only asks for a suggestion on ANCHOR steps
// (step.anchor) — the heavy slot, which a rotating variant serves about once
// a month, where +2.5 per exposure is a sane default. Piece stations show
// last weight only; their load moves when the athlete decides.
export function repTargetTop(targetRepsStr) {
  const nums = String(targetRepsStr ?? '').match(/\d+/g);
  return nums?.length ? Number.parseInt(nums[nums.length - 1], 10) : null;
}

// Suggest the next working weight based on the previous session.
// If the lifter hit the TOP of the rep range on every set → add 2.5 kg.
// If they fell short on any set → same weight, keep working.
// Returns a number (kg) or null when there's nothing to base it on.
export function suggestNextWeight(lastLogs, targetRepsStr) {
  if (!lastLogs?.length) return null;
  const weights = lastLogs
    .map((l) => parseFloat(l.weight))
    .filter((w) => w > 0);
  if (!weights.length) return null;
  const topW = Math.max(...weights);
  const target = repTargetTop(targetRepsStr) ?? 8;
  const allMet = lastLogs.every(
    (l) => !l.reps || parseInt(l.reps, 10) >= target,
  );
  return allMet ? Math.round((topW + 2.5) * 2) / 2 : topW;
}

// Estimated 1-rep max (Epley formula) — the headline strength metric every
// serious tracker trends. Returns kg rounded to 0.5; the actual weight for a
// true single; null for junk input (no weight or no reps).
export function estimate1RM(weightKg, reps) {
  const w = parseFloat(weightKg);
  const r = parseInt(reps, 10);
  if (!(w > 0) || !(r > 0)) return null;
  if (r === 1) return Math.round(w * 2) / 2;
  return Math.round(w * (1 + r / 30) * 2) / 2;
}

// Best estimated 1RM across a list of logs (e.g. one exercise's done sets).
// Returns kg or null when nothing qualifies.
export function bestE1RM(logs) {
  if (!logs?.length) return null;
  let best = null;
  for (const l of logs) {
    const e = estimate1RM(l.weight, l.reps);
    if (e != null && (best == null || e > best)) best = e;
  }
  return best;
}

// Did the lifter meet the TOP of the rep range on every logged set last
// session? Drives the "+2.5kg from last session" vs "hit all reps first" copy.
export function allRepsMet(lastLogs, targetRepsStr) {
  if (!lastLogs?.length) return false;
  const target = repTargetTop(targetRepsStr) ?? 8;
  return lastLogs.every((l) => !l.reps || parseInt(l.reps, 10) >= target);
}

// ── Estimated session energy (2026-08-12, his ask) ──────────────────────────
// MET-based, honest ballpark: kcal = MET × kg × hours (2011 Compendium of
// Physical Activities). The EMOM40 days sit between "resistance training,
// multiple exercises" (3.5) and "circuit training, vigorous" (8.0) — work
// minutes with in-minute rest plus cardio stations lands them at 6.0. This
// is an ESTIMATE (±30% is normal for any non-lab number) — the UI labels it
// with a tilde and never pretends otherwise.
const SESSION_METS = {
  d40: 6.0, // EMOM full-body: continuous clock, cardio minutes inside
  strength: 3.5, // classic straight sets with real rests
  rehab: 2.5, // long positional holds + a light topper
  cardio: 7.0,
  metcon: 8.0, // amrap / for-time / tabata benchmarks
};

export function parseDurationMins(str) {
  const s = String(str ?? '');
  const clock = s.match(/^(\d+):(\d{2})$/);
  if (clock) return Number(clock[1]) + Number(clock[2]) / 60;
  const mins = s.match(/(\d+(?:\.\d+)?)/);
  return mins ? Number(mins[1]) : 0;
}

export function estimateKcal(entry, bodyKg = 80) {
  const isCF = ['amrap', 'fortime', 'emom', 'tabata'].includes(entry.type);
  const met = isCF
    ? SESSION_METS.metcon
    : entry.type === 'strength' &&
        String(entry.programId || '').startsWith('d40')
      ? SESSION_METS.d40
      : (SESSION_METS[entry.type] ?? SESSION_METS.strength);
  // Cap the clock at 75 min: salvaged/paused entries can carry wall-clock
  // durations (hours of pause) that would turn an estimate into a lie.
  const mins = Math.min(parseDurationMins(entry.duration), 75);
  if (!mins || !(bodyKg > 0)) return null;
  return Math.round(met * bodyKg * (mins / 60));
}
