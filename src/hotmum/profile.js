// HOTMUM — who she is and how she likes things. Pure + storage only, no DOM.
//
// Deliberately small. This is a personal app for one person, so "profile" means
// the four things that actually change what she sees: her name (the greeting),
// the dumbbells she owns (what the app is allowed to prescribe), the unit she
// reads, and whether Alice talks.

const KEY = 'hotmum-profile';

export const DEFAULTS = {
  name: 'Sam',
  unit: 'lb', // her plan is lb-native; kg is display-only
  dumbbells: [10, 15, 20], // the fixed set she owns, in lb
  voice: true,
};

export function getProfile() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveProfile(patch) {
  const next = { ...getProfile(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* private mode — settings just won't persist */
  }
  return next;
}

// ─── Units ─────────────────────────────────────────────────────────────────
// The program is written in pounds because that's what's printed on her
// dumbbells. kg is a reading preference, never a change to the prescription.

const LB_PER_KG = 2.20462;
export const lbToKg = (lb) => Math.round((lb / LB_PER_KG) * 2) / 2;

/** "15 lb × 2" · "6.5 kg" · "Bodyweight" */
export function formatLoad(load, unit = 'lb') {
  if (!load || load === 'BW') return 'Bodyweight';
  const n = unit === 'kg' ? lbToKg(load.lb) : load.lb;
  return `${n} ${unit}${load.each ? ' × 2' : ''}`;
}

// ─── The greeting ──────────────────────────────────────────────────────────
// Warm but not gushing — HOTMUM is playful, not loud. One line, her name, and
// an acknowledgement of where she is in the day. Never a compliment about how
// she looks: the whole point of "hot as in strong" is that the app talks about
// what she does.

export function greeting(name, date = new Date(), doneToday = false) {
  const h = date.getHours();
  const part =
    h < 5 ? 'Late one' : h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening';
  if (doneToday) return `Nice work, ${name}.`;
  return `${part}, ${name}.`;
}

/** The second line — what today actually asks of her. */
export function subGreeting({ kind, doneToday, daysToGo }) {
  if (doneToday) return "That's today done.";
  if (kind === 'walk') return 'Thirty minutes on your feet, whenever it fits.';
  return `${daysToGo} days to Christmas. Today's a lifting day.`;
}
