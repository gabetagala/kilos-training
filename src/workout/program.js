// Density 40 — "Armored V-Taper" — the built-in lifting program as guided sessions.
// Designed 2026-07-20 by the multi-agent research→draft→audit→synthesis run;
// full document + rationale in TRAINING.md. Static data only; the step engine
// lives in rehab.js (shared with the rehab protocol).
//
// Session shape: one spine-loaded lift first (straight sets, long rests),
// then density formats (supersets/circuits) on cables/DBs/bands/bodyweight
// only. A→B→C rotating queue; the player's cursor lives in main.js.

export const PROGRAM_EXERCISES = {
  'pull-up': {
    repTempo: [
      ['UP', 1],
      ['DOWN', 3],
    ],
    name: 'Weighted Pull-Up',
    cue: 'Strict, dead-hang stretch every rep, zero swing. Load with the backpack.',
    why: 'The V-taper builder — lats and grip, spine unloaded.',
    yt: 'strict weighted pull up form',
  },
  'cable-row-1arm': {
    repTempo: [
      ['UP', 1],
      ['DOWN', 2],
    ],
    name: '1-Arm Cable Row',
    cue: 'Split stance, hips hinged, spine long, free hand braced. Right side first.',
    why: 'Back thickness with zero seated flexion.',
    yt: 'single arm standing cable row',
  },
  'db-lateral-raise': {
    repTempo: [
      ['UP', 1],
      ['DOWN', 2],
    ],
    name: 'DB Lateral Raise',
    cue: 'Soft elbows, lead with the knuckles, ribs down. No swing.',
    why: 'Side delts = shoulder width = the taper.',
    yt: 'dumbbell lateral raise form',
  },
  'rope-pushdown': {
    repTempo: [
      ['UP', 1],
      ['DOWN', 2],
    ],
    name: 'Rope Pushdown',
    cue: 'Elbows pinned, split the rope at the bottom, slow return.',
    why: 'Triceps are two-thirds of arm size.',
    yt: 'rope pushdown form',
  },
  'hammer-curl': {
    repTempo: [
      ['UP', 1],
      ['DOWN', 2],
    ],
    name: 'DB Hammer Curl',
    cue: 'Thumbs up, strict, no lean-back.',
    why: 'Brachioradialis — the visible forearm mass.',
    yt: 'hammer curl form',
  },
  'suitcase-carry': {
    name: 'Suitcase Carry',
    cue: 'One DB, knee-height pickup, braced hinge. Tall, level hips. Stop-and-turn at each end.',
    why: 'Walking side plank — obliques, grip, posture.',
    yt: 'suitcase carry form',
  },
  'reverse-wrist-curl': {
    repTempo: [
      ['UP', 1],
      ['DOWN', 1],
    ],
    name: 'Reverse Wrist Curl',
    cue: 'Light DBs, knuckles up, slow both ways.',
    why: 'Forearm extensors — the top of the "Popeye" look.',
    yt: 'reverse wrist curl',
  },
  'front-squat': {
    repTempo: [
      ['DOWN', 2],
      ['UP', 1],
    ],
    name: 'Front Squat',
    cue: 'Shoe lift on, collars on. Squat to just above the safety pins. Crisp speed — a grinding rep ends the set.',
    why: 'Legs + upright torso = least spine cost per unit of leg work.',
    yt: 'front squat cross arm form',
  },
  'rfe-split-squat': {
    repTempo: [
      ['DOWN', 2],
      ['UP', 1],
    ],
    name: 'Rear-Foot-Elevated Split Squat',
    cue: 'Rear foot on the box, DBs at sides. Right leg first — left matches its reps.',
    why: 'Single-leg strength that respects the leg-length difference.',
    yt: 'rear foot elevated split squat',
  },
  'face-pull': {
    repTempo: [
      ['UP', 1],
      ['DOWN', 1],
    ],
    name: 'Rope Face Pull',
    cue: 'Pull to the eyebrows, elbows high, thumbs back. Light and strict.',
    why: 'Rear delts + healthy shoulders behind all the pressing.',
    yt: 'rope face pull form',
  },
  'wrist-curl': {
    repTempo: [
      ['UP', 1],
      ['DOWN', 1],
    ],
    name: 'DB Wrist Curl',
    cue: 'Kneeling, forearms on thighs, palms up. Full roll, slow.',
    why: 'Forearm flexors — the underside mass.',
    yt: 'dumbbell wrist curl',
  },
  'band-lateral-raise': {
    repTempo: [
      ['UP', 1],
      ['DOWN', 2],
    ],
    name: 'Band Lateral Raise',
    cue: 'Stand on the band, lead with the knuckles, constant tension.',
    why: 'Extra side-delt volume with zero setup.',
    yt: 'resistance band lateral raise',
  },
  'floor-press': {
    repTempo: [
      ['DOWN', 2],
      ['UP', 1],
    ],
    name: 'Barbell Floor Press',
    cue: 'Bar off the LOW safeties, dead-stop each rep, ribs down. Roll to your side to get up.',
    why: 'Heavy pressing, solo-safe by design. Becomes incline DB when the bench lands.',
    yt: 'barbell floor press form',
  },
  'lat-pulldown': {
    repTempo: [
      ['UP', 1],
      ['DOWN', 3],
    ],
    name: 'Lat Pulldown',
    cue: 'Overhand, just outside shoulders, full stretch + 1-s pause at the top.',
    why: 'More lat width volume at zero spine cost.',
    yt: 'lat pulldown form',
  },
  'elevated-pushup': {
    repTempo: [
      ['DOWN', 2],
      ['UP', 1],
    ],
    name: 'Feet-Elevated Push-Up',
    cue: 'Feet on the box, ribs down. The set ends at the first hip-sag rep.',
    why: 'Upper-chest bias until the bench arrives.',
    yt: 'feet elevated push up',
  },
  'band-fly': {
    repTempo: [
      ['UP', 1],
      ['DOWN', 2],
    ],
    name: 'Low-to-High Band Fly',
    cue: 'Band under the rack foot, sweep low to high, ribs down, no lean-back.',
    why: 'Upper-chest isolation from the equipment you have.',
    yt: 'low to high band fly',
  },
  'supinated-curl': {
    repTempo: [
      ['UP', 1],
      ['DOWN', 2],
    ],
    name: 'DB Supinated Curl',
    cue: 'Palms up the whole rep, strict, full stretch.',
    why: 'Biceps peak to pair with the hammer work.',
    yt: 'supinated dumbbell curl',
  },
  'overhead-triceps': {
    repTempo: [
      ['UP', 1],
      ['DOWN', 3],
    ],
    name: 'Overhead Rope Extension',
    cue: 'Facing away from the low pulley, elbows by the ears. Ribs down, glutes on — no arch.',
    why: 'Long-head triceps at full stretch — the arm-size move.',
    yt: 'overhead rope tricep extension',
  },
  'farmer-carry': {
    name: 'Farmer Carry',
    cue: 'Both DBs, knee-height pickup, braced hinge. Tall posture — set them down the moment it degrades.',
    why: 'Grip, traps, engine — the athletic finisher.',
    yt: 'farmers carry form',
  },

  // ── Sanctioned alternates (TRAINING.md swap lists) — selectable in-player ──
  'pull-up-bw': {
    logReps: true,
    repTempo: [
      ['UP', 1],
      ['DOWN', 3],
    ],
    name: 'Strict Pull-Up',
    cue: 'Bodyweight, dead-hang stretch every rep, zero swing. Log the reps — own 4×8 before loading.',
    why: 'The earn-it step before weighted — same lats, same grip.',
    yt: 'strict pull up form',
  },
  'db-split-squat': {
    repTempo: [
      ['DOWN', 2],
      ['UP', 1],
    ],
    name: 'Heavy DB Split Squat',
    cue: 'DBs at sides, shoe lift on, right leg first. Torso tall, knee tracks the toes.',
    why: 'The front squat’s zero-penalty swap — same legs, half the axial load.',
    yt: 'dumbbell split squat form',
  },
  'db-floor-press': {
    repTempo: [
      ['DOWN', 2],
      ['UP', 1],
    ],
    name: 'DB Floor Press',
    cue: 'Sit with DBs on thighs, roll back as one unit. Exit: lower DBs, roll to your side.',
    why: 'Press heavy with no bench and no spotter risk.',
    yt: 'dumbbell floor press form',
  },
  'incline-db-press': {
    repTempo: [
      ['DOWN', 2],
      ['UP', 1],
    ],
    name: '30° Incline DB Press',
    cue: 'Moderate arch only, ribs down. Start ~20–25% under your floor press.',
    why: 'The upper-chest slot the program is built toward — needs the bench.',
    yt: 'incline dumbbell press 30 degrees',
  },
  'chest-supported-row': {
    repTempo: [
      ['UP', 1],
      ['DOWN', 2],
    ],
    name: 'Chest-Supported DB Row',
    cue: 'Chest on the 30–45° bench, spine fully unloaded. Pull to the hips.',
    why: 'Row rotation once the bench arrives — zero brace cost.',
    yt: 'chest supported dumbbell row',
  },
  'cable-lateral-raise': {
    repTempo: [
      ['UP', 1],
      ['DOWN', 2],
    ],
    name: 'Cable Lateral Raise',
    cue: 'Cable behind the body, lean slightly away, lead with the knuckles.',
    why: 'Constant tension the DBs can’t give — same taper target.',
    yt: 'cable lateral raise form',
  },
  'reverse-curl': {
    repTempo: [
      ['UP', 1],
      ['DOWN', 2],
    ],
    name: 'DB Reverse Curl',
    cue: 'Knuckles up, strict, wrists straight — no lean-back.',
    why: 'Brachioradialis from the other side — forearm rotation option.',
    yt: 'dumbbell reverse curl form',
  },
  'cable-fly-low': {
    repTempo: [
      ['UP', 1],
      ['DOWN', 2],
    ],
    name: '1-Arm Low-Cable Fly',
    cue: 'Low pulley, step forward, sweep low-to-high. Ribs down, no lean-back.',
    why: 'The band fly’s rotation — smoother resistance curve.',
    yt: 'single arm low cable fly',
  },
  'band-pull-apart': {
    repTempo: [
      ['UP', 1],
      ['DOWN', 2],
    ],
    name: 'Band Pull-Apart',
    cue: 'Arms long, squeeze the shoulder blades, control the return.',
    why: 'Rear delts + posture — the face pull’s no-cable twin.',
    yt: 'band pull apart form',
  },
};

export const DENSITY40_SESSIONS = [
  {
    id: 'd40-a',
    name: 'A — Pull',
    freq: 'Queue · width, arms, grip',
    blurb:
      'Weighted pull-ups, then rows + laterals, arms, and suitcase carries.',
    blocks: [
      {
        ex: 'pull-up',
        alts: [{ ex: 'pull-up-bw' }, { ex: 'lat-pulldown' }],
        mode: 'ramp',
        note: 'Ramp: 1 easy set of 3–5 pull-ups (or light pulldown ×8). Not logged.',
      },
      {
        ex: 'pull-up',
        alts: [
          { ex: 'pull-up-bw', reps: '5–8' },
          { ex: 'lat-pulldown', reps: '8–10' },
        ],
        mode: 'lift',
        sets: 4,
        reps: '5–8',
        restSecs: 120,
        note: 'Log added backpack kg (0 = bodyweight). Under 4×5 clean? Run heavy pulldowns 4×8–10 for now.',
      },
      {
        mode: 'circuit',
        rounds: 3,
        betweenSecs: 45,
        members: [
          { ex: 'cable-row-1arm', reps: '8–12/side', alts: [{ ex: 'chest-supported-row' }] },
          {
            ex: 'db-lateral-raise',
            alts: [{ ex: 'cable-lateral-raise' }, { ex: 'band-lateral-raise' }],
            reps: '12–15',
            lastRoundNote: 'LAST ROUND: drop the weight ~30% and rep out once.',
          },
        ],
      },
      {
        mode: 'circuit',
        rounds: 3,
        betweenSecs: 45,
        members: [
          { ex: 'rope-pushdown', reps: '10–15', alts: [{ ex: 'overhead-triceps' }] },
          { ex: 'hammer-curl', reps: '10–12', alts: [{ ex: 'reverse-curl' }, { ex: 'supinated-curl' }] },
        ],
      },
      {
        mode: 'circuit',
        rounds: 2,
        betweenSecs: 10,
        restSecs: 40,
        members: [
          { ex: 'suitcase-carry', secs: 40, phase: 'CARRY', side: 'RIGHT' },
          { ex: 'suitcase-carry', secs: 40, phase: 'CARRY', side: 'LEFT' },
          { ex: 'reverse-wrist-curl', reps: '15–20', logWeight: false },
        ],
      },
    ],
  },
  {
    id: 'd40-b',
    name: 'B — Legs + Delts',
    freq: 'Queue · legs, delts, forearms',
    blurb:
      'Front squat, split squats, laterals + face pulls, the Popeye block.',
    blocks: [
      {
        ex: 'front-squat',
        alts: [{ ex: 'db-split-squat' }],
        mode: 'ramp',
        note: 'Ramp: empty bar ×5 → ~50% ×3 → ~80% ×2. Only barbell setup today.',
      },
      {
        ex: 'front-squat',
        alts: [{ ex: 'db-split-squat', reps: '6–8/leg' }],
        mode: 'lift',
        sets: 4,
        reps: '4–6',
        restSecs: 135,
        note: '2–4 RIR hard cap, forever. Swap any day: heavy DB split squat 4×6–8/leg.',
      },
      {
        ex: 'rfe-split-squat',
        alts: [{ ex: 'db-split-squat', reps: '6–8/leg' }],
        mode: 'lift',
        sets: 3,
        reps: '8–10/leg',
        restSecs: 60,
      },
      {
        mode: 'circuit',
        rounds: 3,
        betweenSecs: 45,
        members: [
          {
            ex: 'db-lateral-raise',
            alts: [{ ex: 'cable-lateral-raise' }, { ex: 'band-lateral-raise' }],
            reps: '12–20',
            lastRoundNote: 'LAST ROUND: drop the weight ~30% and rep out once.',
          },
          { ex: 'face-pull', reps: '15–20', alts: [{ ex: 'band-pull-apart' }] },
        ],
      },
      {
        mode: 'circuit',
        rounds: 3,
        betweenSecs: 8,
        restSecs: 35,
        members: [
          { ex: 'wrist-curl', reps: '15–20', logWeight: false },
          { ex: 'reverse-wrist-curl', reps: '15–20', logWeight: false },
          { ex: 'band-lateral-raise', reps: '15–20', logWeight: false },
        ],
      },
    ],
  },
  {
    id: 'd40-c',
    name: 'C — Push',
    freq: 'Queue · chest, arms, carries',
    blurb:
      'Floor press, pulldown + push-ups, flys + curls, triceps, farmer carries.',
    blocks: [
      {
        ex: 'floor-press',
        alts: [{ ex: 'db-floor-press' }, { ex: 'incline-db-press' }],
        mode: 'ramp',
        note: 'Bar on LOW safeties. 2×3–5 explosive push-ups first, then ~50% ×5 → ~80% ×2.',
      },
      {
        ex: 'floor-press',
        alts: [{ ex: 'db-floor-press' }, { ex: 'incline-db-press' }],
        mode: 'lift',
        sets: 4,
        reps: '6–10',
        restSecs: 120,
        note: 'Bench arrives → this slot becomes 30° incline DB press, start ~20–25% lighter.',
      },
      {
        mode: 'circuit',
        rounds: 3,
        betweenSecs: 45,
        members: [
          { ex: 'lat-pulldown', reps: '8–12' },
          { ex: 'elevated-pushup', reps: '10–15', logWeight: false },
        ],
      },
      {
        mode: 'circuit',
        rounds: 3,
        betweenSecs: 45,
        members: [
          { ex: 'band-fly', reps: '12–15', logWeight: false, alts: [{ ex: 'cable-fly-low' }] },
          { ex: 'supinated-curl', reps: '8–12', alts: [{ ex: 'hammer-curl' }, { ex: 'reverse-curl' }] },
        ],
      },
      {
        ex: 'overhead-triceps',
        alts: [{ ex: 'rope-pushdown' }],
        mode: 'lift',
        sets: 3,
        reps: '10–15',
        restSecs: 40,
      },
      {
        mode: 'circuit',
        rounds: 3,
        betweenSecs: 0,
        restSecs: 70,
        members: [{ ex: 'farmer-carry', secs: 40, phase: 'CARRY' }],
      },
    ],
  },
];

export const getProgramSession = (id) =>
  DENSITY40_SESSIONS.find((s) => s.id === id) || null;

// ── The week template (TRAINING.md "week at a glance") ───────────────────────
// Index = JS getDay() (0=Sun … 6=Sat). 'lift' resolves to the next session in
// the A→B→C queue at render time; 'walk'/'engine' are manual mark-done items.
export const WEEK_PLAN = [
  /* Sun */ [{ type: 'rehab' }, { type: 'walk' }],
  /* Mon */ [{ type: 'rehab' }, { type: 'lift' }],
  /* Tue */ [{ type: 'rehab' }, { type: 'hinge' }],
  /* Wed */ [{ type: 'rehab' }, { type: 'lift' }],
  /* Thu */ [{ type: 'rehab' }, { type: 'hinge' }],
  /* Fri */ [{ type: 'rehab' }, { type: 'lift' }],
  /* Sat */ [{ type: 'rehab' }, { type: 'hinge' }, { type: 'engine' }],
];
