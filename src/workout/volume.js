// Fractional muscle attribution + the volume bands — ONE copy, imported by
// BOTH auditors (scripts/verify-program.mjs and scripts/block-sheet.mjs).
// They used to each carry their own MAP; the sheet's drifted (it was missing
// the ballistic movements entirely) and under-reported chest and triceps —
// exactly the failure a shared module makes impossible.
//
// Model: Pelland et al. 2025 (67 studies) — a direct working set counts 1.0,
// an indirect set 0.5. MEV 4 fractional sets/week; 30+ is the wasteful band.

export const MUSCLE_MAP = {
  'pull-up': { lats: 1, biceps: 0.5, forearm: 0.5 },
  'pull-up-bw': { lats: 1, biceps: 0.5, forearm: 0.5 },
  'lat-pulldown': { lats: 1, biceps: 0.5 },
  'cable-row-1arm': { upperback: 1, biceps: 0.5, reardelt: 0.5 },
  'chest-supported-row': { upperback: 1, biceps: 0.5, reardelt: 0.5 },
  'db-lateral-raise': { sidedelt: 1 },
  'band-lateral-raise': { sidedelt: 1 },
  'cable-lateral-raise': { sidedelt: 1 },
  'band-pull-apart': { reardelt: 1, upperback: 0.5 },
  'face-pull': { reardelt: 1, upperback: 0.5 },
  'floor-press': { chest: 1, triceps: 0.5, frontdelt: 0.5 },
  'elevated-pushup': { chest: 1, triceps: 0.5 },
  'push-up': { chest: 1, triceps: 0.5 },
  'band-fly': { chest: 1 },
  'cable-fly-low': { chest: 1 },
  'rope-pushdown': { triceps: 1 },
  'overhead-triceps': { triceps: 1 },
  'db-kickback': { triceps: 1 },
  'diamond-pushup': { triceps: 1, chest: 0.5 },
  'ring-dip': { chest: 1, triceps: 1, frontdelt: 0.5 },
  'db-calf-raise': { calves: 1 },
  'slider-leg-curl': { hams: 1, glutes: 0.5 },
  'cable-leg-curl': { hams: 1 },
  // the amber-day stand-in for the RDL and split squats
  'glute-bridge': { glutes: 1, hams: 0.5 },
  'lying-db-extension': { triceps: 1 },
  'incline-y-raise': { upperback: 1, reardelt: 0.5 },
  'ring-row': { upperback: 1, reardelt: 0.5, biceps: 0.5 },
  'hammer-curl': { biceps: 1, forearm: 0.5 },
  'supinated-curl': { biceps: 1 },
  'reverse-curl': { biceps: 1, forearm: 0.5 },
  'front-squat': { quads: 1, glutes: 0.5 },
  'rfe-split-squat': { quads: 1, glutes: 1 },
  'box-squat': { quads: 1, glutes: 0.5 },
  'box-step-up': { quads: 1, glutes: 0.5 },
  // honest credits (2026-10-10, coach QA): the RDL's upper-back "credit" was
  // isometric holding, the push press's quads were a dip, a suitcase carry
  // isn't a lateral raise — all three removed
  rdl: { hams: 1, glutes: 1 },
  'single-leg-bridge': { glutes: 1, hams: 0.5 },
  'suitcase-carry': { obliques: 1, forearm: 1 },
  'farmer-carry': { forearm: 1, upperback: 0.5 },
  'wrist-curl': { forearm: 1 },
  'reverse-wrist-curl': { forearm: 1 },
  'side-plank': { obliques: 1 },
  // CrossFit movements (2026-08-10) — same fractional model as everything else.
  'db-push-press': { frontdelt: 1, triceps: 0.5 },
  'db-hang-snatch': { frontdelt: 0.5, upperback: 0.5, hams: 0.5, glutes: 0.5 },
  'db-hang-clean-press': {
    frontdelt: 0.5,
    triceps: 0.5,
    upperback: 0.5,
    hams: 0.5,
    glutes: 0.5,
  },
  'db-front-rack-lunge': { quads: 1, glutes: 1 },
  'bear-crawl': { obliques: 1, frontdelt: 0.5 },
  // The cardio stations are a CONDITIONING stimulus, not a hypertrophy one —
  // 40 seconds of jumping jacks is not a set of anything. Only the reverse
  // lunge carries a real (half) leg set: it is the one that is genuinely
  // loaded by bodyweight through a full range. Counting the rest of them as
  // growth volume would be the same category error the daily rehab exemption
  // exists to avoid.
  'jumping-jack': {},
  'shadow-boxing': {}, // conditioning, not a set of anything — same rule as the cardio stations

  'high-knees': {},
  sprint: {},
  'skater-bound': {},
  'reverse-lunge': { quads: 0.5, glutes: 0.5 },
  // Anchor variants that were MISSING from the verifier's map until
  // 2026-08-10 and so counted as zero — two of them are Friday's anchor,
  // which meant chest was silently undercounted in half the weeks of the
  // block. The verifier's attribution guard now makes an omission a build
  // failure instead of a quiet wrong number.
  'db-split-squat': { quads: 1, glutes: 1 },
  'db-floor-press': { chest: 1, triceps: 0.5, frontdelt: 0.5 },
  'incline-db-press': { chest: 1, triceps: 0.5, frontdelt: 0.5 },
  'db-bench-press': { chest: 1, triceps: 0.5, frontdelt: 0.5 },
  // Ballistic work, same reasoning as the cardio stations: a jump has almost no
  // time under tension, so it is power, not growth volume. The explosive
  // push-up is the exception — it is a bodyweight press through a full range,
  // so it takes half credit, exactly like the reverse lunge.
  'power-pushup': { chest: 0.5, triceps: 0.5 },
  'broad-jump': {},
  'pogo-hop': {},
};

export const MEV = 4;
export const WASTEFUL = 30;

// ── THE HYPERTROPHY TARGETS (2026-08-16 QA) ─────────────────────────────────
// MEV is a survival floor, not a growth target — a program could park every
// muscle at 4 fractional sets and the old audit would stay green. His ask
// was "hit the threshold for hypertrophy per muscle every week", so the
// muscles he is actually chasing get a REAL floor, enforced weekly by
// verify-program.mjs: the triangle (his stated physique goal) at 10+ —
// the bottom of the 10–20 productive band — and the 3-D support muscles
// at 7+. Everything absent here keeps the MEV floor: obliques get their
// real dose from the daily side-core medicine the tally deliberately
// excludes, and front delts are EXPECTED_LOW.
//
// LEGS GROW NOW (2026-10-10, his call: "go further and grow legs too"). They
// were maintenance by goal since 2026-08-10; quads and glutes now carry the
// same 10+ floor as the triangle, trained Wednesday and Friday (Monday's
// hinge feeds glutes and hamstrings). Hamstrings hold 8: one RDL a week (back
// medicine first) plus the slider leg curls Wednesday and Friday.
// ROUND 3 (2026-10-10, coach QA: "the triangle is dosed at the floor"): the
// three muscles that make the triangle read wide now sit above the generic
// 10 — the anchor pairs and Tuesday's bench press pay for it in zero minutes.
export const TARGETS = {
  lats: 11,
  chest: 12,
  sidedelt: 12,
  biceps: 10,
  triceps: 10,
  forearm: 10,
  upperback: 7,
  reardelt: 7,
  quads: 10,
  glutes: 10,
  // 2026-10-10 (coach QA): the last two leg gaps — knee-flexion hamstrings
  // (slider curls) and calves (they had none at all)
  hams: 8,
  calves: 8,
};

// Front delts are intentionally unserved — their MEV is ~0 because every
// press saturates them. Flagging them red twelve times is noise, not signal.
// obliques too (round 5): Saturday's suitcase carry credits them, but their
// real dose is the daily side plank the tally deliberately excludes
export const EXPECTED_LOW = new Set(['frontdelt', 'obliques']);

// Sessions whose ENTIRE content is exempt from the hypertrophy tally.
// The rebuilt 'daily' carries a topper EMOM that IS hypertrophy work, so its
// exemption is per-step — the auditors skip a step only when (session ===
// 'daily' AND the exercise is a rehab-dictionary hold). The long holds are
// endurance medicine, not sets; counting them once reported obliques at 42
// sets/week and failed the program. 'sunday' (2026-08-16) is the promised
// all-medicine session: holds and the McGill cap, zero sets by construction.
export const HYPERTROPHY_EXEMPT = new Set(['sunday']);

// AND SO ARE THE OPTIONAL SESSIONS. Sunday's Bonus WOD, Open Up and The Long
// Way are explicitly skippable, so counting them describes a week he might
// not train. The audited numbers are the FLOOR — the required days on their
// own. 'wod' being here is what makes the Sunday rest day real: every
// volume target above must be provable without it.
export const OPTIONAL_SESSIONS = new Set(['wod', 'open-up', 'engine']);
