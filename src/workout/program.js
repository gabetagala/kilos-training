// Density 40 — "Armored V-Taper" — Gabe's lifting program as guided sessions.
// Designed 2026-07-20 by the multi-agent research→draft→audit→synthesis run;
// full document + rationale in TRAINING.md. Static data only; the step engine
// lives in rehab.js (shared with the rehab protocol).
//
// Session shape: one spine-loaded lift first (straight sets, long rests),
// then density formats (supersets/circuits) on cables/DBs/bands/bodyweight
// only. A→B→C rotating queue; the player's cursor lives in main.js.

export const PROGRAM_EXERCISES = {
  'pull-up': {
    name: 'Weighted Pull-Up',
    cue: 'Strict, dead-hang stretch every rep, zero swing. Load with the backpack.',
    why: 'The V-taper builder — lats and grip, spine unloaded.',
    yt: 'strict weighted pull up form',
  },
  'cable-row-1arm': {
    name: '1-Arm Cable Row',
    cue: 'Split stance, hips hinged, spine long, free hand braced. Right side first.',
    why: 'Back thickness with zero seated flexion.',
    yt: 'single arm standing cable row',
  },
  'db-lateral-raise': {
    name: 'DB Lateral Raise',
    cue: 'Soft elbows, lead with the knuckles, ribs down. No swing.',
    why: 'Side delts = shoulder width = the taper.',
    yt: 'dumbbell lateral raise form',
  },
  'rope-pushdown': {
    name: 'Rope Pushdown',
    cue: 'Elbows pinned, split the rope at the bottom, slow return.',
    why: 'Triceps are two-thirds of arm size.',
    yt: 'rope pushdown form',
  },
  'hammer-curl': {
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
    name: 'Reverse Wrist Curl',
    cue: 'Light DBs, knuckles up, slow both ways.',
    why: 'Forearm extensors — the top of the "Popeye" look.',
    yt: 'reverse wrist curl',
  },
  'front-squat': {
    name: 'Front Squat',
    cue: 'Shoe lift on, collars on. Squat to just above the safety pins. Crisp speed — a grinding rep ends the set.',
    why: 'Legs + upright torso = least spine cost per unit of leg work.',
    yt: 'front squat cross arm form',
  },
  'rfe-split-squat': {
    name: 'Rear-Foot-Elevated Split Squat',
    cue: 'Rear foot on the box, DBs at sides. Right leg first — left matches its reps.',
    why: 'Single-leg strength that respects the leg-length difference.',
    yt: 'rear foot elevated split squat',
  },
  'face-pull': {
    name: 'Rope Face Pull',
    cue: 'Pull to the eyebrows, elbows high, thumbs back. Light and strict.',
    why: 'Rear delts + healthy shoulders behind all the pressing.',
    yt: 'rope face pull form',
  },
  'wrist-curl': {
    name: 'DB Wrist Curl',
    cue: 'Kneeling, forearms on thighs, palms up. Full roll, slow.',
    why: 'Forearm flexors — the underside mass.',
    yt: 'dumbbell wrist curl',
  },
  'band-lateral-raise': {
    name: 'Band Lateral Raise',
    cue: 'Stand on the band, lead with the knuckles, constant tension.',
    why: 'Extra side-delt volume with zero setup.',
    yt: 'resistance band lateral raise',
  },
  'floor-press': {
    name: 'Barbell Floor Press',
    cue: 'Bar off the LOW safeties, dead-stop each rep, ribs down. Roll to your side to get up.',
    why: 'Heavy pressing, solo-safe by design. Becomes incline DB when the bench lands.',
    yt: 'barbell floor press form',
  },
  'lat-pulldown': {
    name: 'Lat Pulldown',
    cue: 'Overhand, just outside shoulders, full stretch + 1-s pause at the top.',
    why: 'More lat width volume at zero spine cost.',
    yt: 'lat pulldown form',
  },
  'elevated-pushup': {
    name: 'Feet-Elevated Push-Up',
    cue: 'Feet on the box, ribs down. The set ends at the first hip-sag rep.',
    why: 'Upper-chest bias until the bench arrives.',
    yt: 'feet elevated push up',
  },
  'band-fly': {
    name: 'Low-to-High Band Fly',
    cue: 'Band under the rack foot, sweep low to high, ribs down, no lean-back.',
    why: 'Upper-chest isolation from the equipment you have.',
    yt: 'low to high band fly',
  },
  'supinated-curl': {
    name: 'DB Supinated Curl',
    cue: 'Palms up the whole rep, strict, full stretch.',
    why: 'Biceps peak to pair with the hammer work.',
    yt: 'supinated dumbbell curl',
  },
  'overhead-triceps': {
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
        mode: 'ramp',
        note: 'Ramp: 1 easy set of 3–5 pull-ups (or light pulldown ×8). Not logged.',
      },
      {
        ex: 'pull-up',
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
          { ex: 'cable-row-1arm', reps: '8–12/side' },
          {
            ex: 'db-lateral-raise',
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
          { ex: 'rope-pushdown', reps: '10–15' },
          { ex: 'hammer-curl', reps: '10–12' },
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
        mode: 'ramp',
        note: 'Ramp: empty bar ×5 → ~50% ×3 → ~80% ×2. Only barbell setup today.',
      },
      {
        ex: 'front-squat',
        mode: 'lift',
        sets: 4,
        reps: '4–6',
        restSecs: 135,
        note: '2–4 RIR hard cap, forever. Swap any day: heavy DB split squat 4×6–8/leg.',
      },
      {
        ex: 'rfe-split-squat',
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
            reps: '12–20',
            lastRoundNote: 'LAST ROUND: drop the weight ~30% and rep out once.',
          },
          { ex: 'face-pull', reps: '15–20' },
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
        mode: 'ramp',
        note: 'Bar on LOW safeties. 2×3–5 explosive push-ups first, then ~50% ×5 → ~80% ×2.',
      },
      {
        ex: 'floor-press',
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
          { ex: 'band-fly', reps: '12–15', logWeight: false },
          { ex: 'supinated-curl', reps: '8–12' },
        ],
      },
      {
        ex: 'overhead-triceps',
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
