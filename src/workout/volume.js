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
  'hammer-curl': { biceps: 1, forearm: 0.5 },
  'supinated-curl': { biceps: 1 },
  'reverse-curl': { biceps: 1, forearm: 0.5 },
  'front-squat': { quads: 1, glutes: 0.5 },
  'rfe-split-squat': { quads: 1, glutes: 1 },
  'box-squat': { quads: 1, glutes: 0.5 },
  'box-step-up': { quads: 1, glutes: 0.5 },
  rdl: { hams: 1, glutes: 1, upperback: 0.5 },
  'single-leg-bridge': { glutes: 1, hams: 0.5 },
  'suitcase-carry': { obliques: 1, forearm: 1, sidedelt: 0.5 },
  'farmer-carry': { forearm: 1, upperback: 0.5 },
  'wrist-curl': { forearm: 1 },
  'reverse-wrist-curl': { forearm: 1 },
  'side-plank': { obliques: 1 },
  // CrossFit movements (2026-08-10) — same fractional model as everything else.
  'db-push-press': { frontdelt: 1, triceps: 0.5, quads: 0.5 },
  'db-hang-snatch': { frontdelt: 0.5, upperback: 0.5, hams: 0.5, glutes: 0.5 },
  'db-front-rack-lunge': { quads: 1, glutes: 1 },
  'bear-crawl': { obliques: 1, frontdelt: 0.5 },
  // The cardio stations are a CONDITIONING stimulus, not a hypertrophy one —
  // 40 seconds of jumping jacks is not a set of anything. Only the reverse
  // lunge carries a real (half) leg set: it is the one that is genuinely
  // loaded by bodyweight through a full range. Counting the rest of them as
  // growth volume would be the same category error the daily rehab exemption
  // exists to avoid.
  'jumping-jack': {},
  'high-knees': {},
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

// Front delts are intentionally unserved — their MEV is ~0 because every
// press saturates them. Flagging them red twelve times is noise, not signal.
export const EXPECTED_LOW = new Set(['frontdelt']);

// Sessions whose ENTIRE content is exempt from the hypertrophy tally.
// EMPTY since 2026-08-11: the rebuilt 'daily' carries a topper EMOM that IS
// hypertrophy work, so its exemption became per-step — the auditors skip a
// step only when (session === 'daily' AND the exercise is a rehab-dictionary
// hold). The long holds are endurance medicine, not sets; counting them once
// reported obliques at 42 sets/week and failed the program. The set survives
// for any future all-medicine session.
export const HYPERTROPHY_EXEMPT = new Set([]);

// AND SO ARE THE OPTIONAL SESSIONS. Sunday's Open Up and The Long Way are
// explicitly skippable, so counting them describes a week he might not train.
// The audited numbers are the FLOOR — the required days on their own.
export const OPTIONAL_SESSIONS = new Set(['open-up', 'engine']);
