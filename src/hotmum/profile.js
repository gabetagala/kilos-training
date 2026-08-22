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
// "Hello, hot mum Sam." — Gabe's line, and it's the right one: it's what he
// actually calls her, which for an app one husband built for one wife beats
// anything neutral.
//
// "Hot mum" here is the BRAND NAME, not a remark about her body — that's what
// the tagline exists to fix ("hot as in strong"). The distinction is load-
// bearing and tested: the app may say hot mum, and must never comment on how
// she looks. Postpartum, a training app that drifts into appearance talk stops
// being a training app.
//
// The `date` argument is unused now (the greeting was time-of-day before) but
// kept so the signature stays stable if that ever comes back.

export function greeting(name, _date = new Date(), doneToday = false) {
  if (doneToday) return `Nice work, hot mum ${name}.`;
  return `Hello, hot mum ${name}.`;
}

/**
 * The second line. There is no schedule — she chooses each day — so this
 * states the fact and gets out of the way rather than assigning her a session.
 */
export function subGreeting({ doneToday, day, days }) {
  if (doneToday) return "That's today done.";
  return `Day ${day} of ${days}. Today's yours to pick.`;
}
