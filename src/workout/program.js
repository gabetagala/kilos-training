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
    feel: 'Lats — elbows driving to your ribs',
    avoid: 'Swinging, cutting the bottom short',
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
    feel: 'Lat + mid-back on the working side',
    avoid: 'Torso twisting to yank the stack',
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
    feel: 'Side delt floating the weight out',
    avoid: 'Shrugging traps, swinging hips',
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
    feel: 'Triceps only — elbows pinned still',
    avoid: 'Shoulders rolling in to press',
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
    feel: 'Forearm + biceps, wrist locked',
    avoid: 'Elbows drifting, body English',
    cue: 'Thumbs up, strict, no lean-back.',
    why: 'Brachioradialis — the visible forearm mass.',
    yt: 'hammer curl form',
  },
  'suitcase-carry': {
    name: 'Suitcase Carry',
    feel: 'The side AWAY from the weight bracing',
    avoid: 'Leaning into or away from the load',
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
    feel: 'Top of the forearm lifting the knuckles',
    avoid: 'Going heavy — this one stays light',
    cue: 'Light DBs, knuckles up, slow both ways.',
    why: 'Forearm extensors — the top of the "Popeye" look.',
    yt: 'reverse wrist curl',
  },
  // ── Benchmark movements (2026-08-07) ──────────────────────────────────────
  // Both exist for the BLOCK-01 tests. Chosen because their failure mode under
  // fatigue is NOT spinal: the step-up fails at the legs and lungs with an
  // upright torso, the push-up fails at the chest with the hips sagging into
  // extension. That's what makes a genuine max effort defensible here — and a
  // test you can't safely max on isn't a test.
  'box-step-up': {
    name: 'Box Step-Up',
    feel: 'The top leg driving you up — the bottom one just follows',
    avoid: 'Pushing off the back foot, or leaning forward to get up',
    cue: 'Whole foot on the box, stand tall through the top leg, step down under control. Torso stays upright — a forward lean means the box is too high.',
    why: 'The best engine builder in the garage: upright, unilateral, and zero spine flexion even when you are wrecked.',
    yt: 'weighted box step up form',
  },
  'box-squat': {
    name: 'Box Squat',
    feel: 'Quads and glutes, torso tall, weight through the heels',
    avoid: 'Flopping onto the box, or letting the hips tuck under at the bottom',
    cue: 'Sit back until your backside TOUCHES the box, then stand. Touch, never rest. Chest up the whole way.',
    // The box isn't a scaling aid — it's the safety mechanism. Fatigue drives
    // posterior pelvic tilt at the bottom of an air squat (loaded flexion,
    // exactly what a DDD spine can't spend cycles on). A fixed box defines
    // depth mechanically, so rep 200 has the same depth as rep 1 no matter
    // how wrecked you are. That's what makes a bodyweight test safe to max on.
    why: 'The box fixes your depth, so fatigue can never tuck your pelvis under — and it makes every rep the same rep, which is what a benchmark needs.',
    yt: 'box squat bodyweight form',
  },
  'push-up': {
    name: 'Push-Up',
    feel: 'Chest and triceps, body one straight line',
    avoid: 'Hips sagging — the set ends at the first sagging rep',
    cue: 'Hands under the shoulders, ribs down, glutes on. Full lockout at the top.',
    why: 'Pressing volume with near-zero spine load — the benchmark rep that never gets dangerous.',
    yt: 'push up form',
  },
  'front-squat': {
    repTempo: [
      ['DOWN', 2],
      ['UP', 1],
    ],
    name: 'Front Squat',
    feel: 'Quads, torso tall, elbows high',
    avoid: 'Elbows dropping, heels lifting',
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
    feel: 'Front-leg quad + glute doing it all',
    avoid: 'Pushing off the back foot',
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
    feel: 'Rear delts pulling the rope apart',
    avoid: 'Turning it into a row — thumbs back',
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
    feel: 'Underside of the forearm squeezing',
    avoid: 'Fingers opening at the bottom',
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
    feel: 'Side delt fighting the band out wide',
    avoid: 'Speed — the band rewards control',
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
    feel: 'Chest + triceps, upper arms grounded',
    avoid: 'Bouncing the elbows off the floor',
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
    feel: 'Lats — chest tall, bar to collarbone',
    avoid: 'Leaning back to heave it down',
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
    feel: 'Upper chest + shoulders pressing',
    avoid: 'Hips sagging — brace like a plank',
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
    feel: 'Upper chest sweeping up and across',
    avoid: 'Arms bending into a press',
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
    feel: 'Biceps — palm turning up on the lift',
    avoid: 'Shoulders creeping into the curl',
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
    feel: 'Triceps long head, arms overhead',
    avoid: 'Ribs flaring — stay stacked',
    cue: 'Facing away from the low pulley, elbows by the ears. Ribs down, glutes on — no arch.',
    why: 'Long-head triceps at full stretch — the arm-size move.',
    yt: 'overhead rope tricep extension',
  },
  'farmer-carry': {
    name: 'Farmer Carry',
    feel: 'Grip, traps and trunk all bracing',
    avoid: 'Rushing — walk tall and controlled',
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
    feel: 'Lats from a dead hang, no kip',
    avoid: 'Chin-poking half reps',
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
    feel: 'Front-leg quad + glute under load',
    avoid: 'The knee caving inward',
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
    feel: 'Chest + triceps, elbows to the floor',
    avoid: 'Arching — the floor is the point',
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
    feel: 'Upper chest pressing up and in',
    avoid: 'Elbows flaring straight out',
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
    feel: 'Mid-back squeezing, chest glued down',
    avoid: 'Chest lifting off the pad',
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
    feel: 'Constant tension on the side delt',
    avoid: 'Leaning away to cheat the start',
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
    feel: 'Top of forearm + upper arm lifting',
    avoid: 'Wrists breaking backward',
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
    feel: 'Chest sweeping across the body',
    avoid: 'Pressing instead of hugging',
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
    feel: 'Rear delts pulling the band wide',
    avoid: 'Shrugging as it opens',
    cue: 'Arms long, squeeze the shoulder blades, control the return.',
    why: 'Rear delts + posture — the face pull’s no-cable twin.',
    yt: 'band pull apart form',
  },
};

// ── Shared blocks ───────────────────────────────────────────────────────────
// These four moved out of the daily rehab on 2026-08-07 (see rehab.js header
// for the why). Defined once here and spliced into the halves below so the
// dose is auditable in one place.

// Tempo pattern for the glute bridge: [label, seconds] per sub-phase.
// The eccentric is the point — a 1s lower reads as a drop, not a lower.
const BRIDGE_TEMPO = [
  ['LIFT', 1],
  ['SQUEEZE', 2],
  ['LOWER', 2],
];

// The hinge. Dose unchanged from the rehab (3×/week) — A1 (Mon), B2 (Thu),
// C1 (Fri). Asserted in tests/unit/rehab.test.js.
//
// The rule is NOT "alternate with the anchors" — an earlier comment here said
// Tue/Thu/Sat and it was never true of A2 or C2. The rule is: the hinge never
// shares a day with the FRONT SQUAT, which is the only genuinely axial anchor
// in the week. Monday's pull-up decompresses the spine and Friday's floor
// press is low-axial (TRAINING.md's morning rule says both are fine straight
// out of bed, while "the three RDL slots (A1, B2, C1) and the B1 front squat
// want 2 h+"). So B1 — Wednesday — is the one lift day with no RDL, on purpose.
export const RDL_BLOCK = {
  ex: 'rdl',
  mode: 'lift',
  sets: 3,
  reps: 8,
  restSecs: 90,
  note: 'Add load only if the last hinge day stayed quiet.',
};

// Glute prep — one hip at a time, continuous tempo reps. 2×/week on the leg
// halves (was 7× inside the rehab, which is a lot for an activation drill
// sitting next to 10+ weekly sets of squat/split/hinge).
export const BRIDGE_BLOCK = {
  ex: 'single-leg-bridge',
  mode: 'tempo',
  sets: 2,
  reps: 8,
  tempo: BRIDGE_TEMPO,
  perSide: true,
  switchSecs: 8,
  restSecs: 25,
};

// The cool-down. Warm tissue, after the work — never cold before it.
export const STRETCH_BLOCKS = [
  {
    ex: 'hamstring-stretch',
    mode: 'hold',
    sets: 2,
    holdSecs: 30,
    perSide: true,
    switchSecs: 8,
    restSecs: 10,
  },
  {
    ex: 'hip-flexor-stretch',
    mode: 'hold',
    sets: 2,
    holdSecs: 30,
    perSide: true,
    switchSecs: 8,
    restSecs: 10,
  },
];

// The Power Primer, folded into the two accessory halves 2026-08-07 (his
// call) instead of owning its own day. Same movements, same tiny dose, same
// rules: ballistic, never tempo-paced, never near fatigue, quiet-back days
// only — it opens the session so it lands fresh. Exercise defs live in
// REHAB_EXERCISES; the step engine is built from both maps so the ids
// resolve. The standalone 'power' session in rehab.js reuses this array.
export const POWER_BLOCKS = [
  // Elasticity first — short ground contact, spine tall.
  { ex: 'pogo-hop', mode: 'hold', phase: 'BOUNCE', sets: 2, holdSecs: 15, restSecs: 40 },
  // Hip power — jump far, land stuck and silent.
  {
    mode: 'circuit',
    rounds: 3,
    restSecs: 60,
    members: [{ ex: 'broad-jump', reps: '3', logWeight: false }],
  },
  // Upper-body speed — the set ends when the pop fades.
  {
    mode: 'circuit',
    rounds: 3,
    restSecs: 60,
    members: [{ ex: 'power-pushup', reps: '3–5', logWeight: false }],
  },
];

// ── FINISHERS (2026-08-07) ──────────────────────────────────────────────────
// Short, bodyweight, fun, and deliberately UNPROGRAMMED. This is the one slot
// in the week where the volume-accounting rules are switched off on purpose:
// a finisher carries no muscle's weekly dose, so it's free to use formats
// whose volume isn't auditable (tabata, AMRAP, ladders). That's exactly why
// the rest of the program can't use them — and why this slot can.
//
// The safety rule still applies and is not negotiable: every movement here
// fails at the lungs, legs, chest or grip. Nothing fails at a flexing spine.
// Box squats (not air squats) because the box fixes depth — fatigue can never
// tuck the pelvis. Strict pull-ups only. No burpees: they're the highest
// flexion-cycle-count movement per minute in the metcon canon, and the disc
// spends cycles it doesn't get back.
//
// VARIETY IS THE POINT, so each slot is a `rotate` pool — the engine advances
// it once per completed run of that session, which at one run a week means a
// different finisher every week, cycling. Each day gets the pool rotated to a
// different starting offset so Monday and Thursday don't serve the same one.
// ONE ITEM PER MUSCLE — this is the constraint that makes the pool safe to
// randomise. The first version had TWO chest finishers (Tabata Push-Up and
// Death by Push-Up) in a six-deep pool drawn by four days at once, so some
// weeks served both: chest hit 30 fractional sets (the "wasteful" tier) while
// other weeks served neither and it fell to 10. A 3x week-to-week swing in a
// priority muscle is exactly the "not hitting threshold" failure this program
// is supposed to prevent — variety is only free if it's audited.
//
// With one item per muscle and four distinct day-offsets into six items, any
// given week serves four DIFFERENT muscles and can never double up. The Ladder
// keeps the death-by format in the rotation; the band pull-apart was added
// because rear delts were the thinnest thing in the whole program at 4.5.
const FINISHER_POOL = [
  {
    mode: 'tabata',
    name: 'Tabata Push-Up',
    ex: 'push-up',
    note: 'Max reps each round. Score the WORST round — your best one tells you nothing.',
  },
  {
    mode: 'tabata',
    name: 'Tabata Squat',
    ex: 'box-squat',
    note: 'Touch the box every rep, even on round 8. Score the worst round.',
  },
  {
    // the death-by format, on the movement that needs the volume most
    mode: 'emom',
    name: 'The Ladder',
    rounds: 10, // a queue CEILING, not a target — failure ends it
    members: [{ ex: 'pull-up-bw', ladderFrom: 2, logWeight: false }],
  },
  {
    mode: 'amrap',
    name: 'The Grip',
    capSecs: 180,
    phase: 'CARRY',
    members: [{ ex: 'farmer-carry', secs: 30, phase: 'CARRY' }],
    note: 'Walk 30s, set down, rest as needed, go again. Grip goes, you stop — the clock never wins.',
  },
  {
    mode: 'tabata',
    name: 'Tabata Side Plank',
    ex: 'side-plank',
    note: 'Alternate sides each round. Hips tall — the set ends when they drop, not when the clock does.',
  },
  {
    mode: 'tabata',
    name: 'Tabata Pull-Apart',
    ex: 'band-pull-apart',
    note: 'Rear delts — the thinnest thing in the program. Light band, thumbs back, squeeze the shoulder blades.',
  },
];

// Same pool, different starting point per day.
const finisherSlot = (offset) => ({
  rotate: [
    ...FINISHER_POOL.slice(offset),
    ...FINISHER_POOL.slice(0, offset),
  ],
});

// ── The six halves ──────────────────────────────────────────────────────────
// SPLIT 2026-08-07. Was three ~30-min sessions on Mon/Wed/Fri; stacked on the
// rehab that made a lift day 48–55 min, which is the reason he stopped looking
// forward to them. Same weekly volume, same anchors, same rep schemes — cut in
// half and spread across six days (he trains daily anyway).
//
// The cut line is always ANCHOR FIRST: each half-1 is ramp + the heavy anchor
// + its first density block, and each half-2 is the remaining density work.
// The anchor now lands first thing, on a fresh body, instead of after 24
// minutes of rehab — the PR lifts get better, not just shorter.
export const DENSITY40_SESSIONS = [
  {
    id: 'd40-a1',
    name: 'Pull',
    // Thursday's label declares its hinge; this one and Friday's didn't, which
    // is what made the RDL look misplaced rather than scheduled.
    freq: 'Mon · width + back + hinge',
    blurb: 'Weighted pull-ups fresh, then rows + laterals. Hinge to close.',
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
      RDL_BLOCK,
      {
        mode: 'emom',
        name: 'The Spread',
        rounds: 3,
        // fortime is declared but FILTERED OUT by formatsFor(): the 1-arm cable
        // row is hinged and loaded, and an unpaced clock is exactly what turns
        // that into lumbar flexion. It rotates EMOM / EMOM-descending only.
        formats: ['emom', 'emom-desc', 'fortime'],
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
      finisherSlot(0),
    ],
  },
  {
    id: 'd40-a2',
    name: 'Arms',
    freq: 'Tue · power, arms, grip',
    blurb: 'Power primer while you’re fresh, then triceps, biceps, carries.',
    blocks: [
      ...POWER_BLOCKS,
      {
        mode: 'emom',
        name: 'The Vice',
        rounds: 3,
        // suitcase carry keeps this on forced rest (see OPEN_PACE_BANNED)
        formats: ['emom', 'emom-desc'],
        members: [
          { ex: 'rope-pushdown', reps: '10–15', alts: [{ ex: 'overhead-triceps' }] },
          { ex: 'hammer-curl', reps: '10–12', alts: [{ ex: 'reverse-curl' }, { ex: 'supinated-curl' }] },
          // One side per minute, 30s on / 30s off. Cramming both sides into a
          // single minute cost 25% of the per-side time under load (80s → 60s)
          // and pushed the oblique dose under threshold — the fractional-set
          // audit caught it. Split back out: 3 × 30s a side = 90s, above where
          // it started, and the demo flips per side again.
          //
          // Load note (McGill, Marshall & Andersen 2013): a one-hand carry is
          // the MORE spine-expensive carry — 30kg in one hand = 2874 N at
          // L4/L5, vs 2339 N for 30kg in EACH hand. Keep this one deliberately
          // light and short; the farmer carry is the one to load up.
          { ex: 'suitcase-carry', secs: 30, phase: 'CARRY', side: 'RIGHT' },
          { ex: 'suitcase-carry', secs: 30, phase: 'CARRY', side: 'LEFT' },
          { ex: 'reverse-wrist-curl', reps: '15–20', logWeight: false },
        ],
      },
    ],
  },
  {
    id: 'd40-b1',
    name: 'Legs',
    freq: 'Wed · quads + glutes',
    blurb: 'Front squat fresh, split squats, glute prep, stretch to close.',
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
      // Split squats stay OUT of the clock: loaded unilateral leg work is the
      // one accessory here where a rushed rep is a real spine/knee event.
      {
        ex: 'rfe-split-squat',
        alts: [{ ex: 'db-split-squat', reps: '6–8/leg' }],
        mode: 'lift',
        sets: 3,
        reps: '8–10/leg',
        restSecs: 60,
      },
      // NO METCON ON LEG DAY — a deliberate exception, not an oversight.
      // B1's only accessories are loaded unilateral leg work (excluded from
      // the clock above) and a cool-down whose whole dose is per-side 30s
      // holds, which don't map onto minutes without losing half of it.
      // Wednesday's "piece" is the front squat. Forcing a metcon here would
      // be for the aesthetic, not the training.
      BRIDGE_BLOCK,
      ...STRETCH_BLOCKS,
    ],
  },
  {
    id: 'd40-b2',
    name: 'Delts',
    freq: 'Thu · delts, hinge, forearms',
    blurb: 'The hinge, then laterals + face pulls and the Popeye block.',
    blocks: [
      RDL_BLOCK,
      // Both old circuits become one 15-minute piece. Same five movements,
      // same 3 sets each — but it's one workout with a name instead of two
      // supersets separated by a rest timer.
      {
        mode: 'emom',
        name: 'Popeye',
        rounds: 3,
        // every movement here is light, upright and fails at the muscle — the
        // one piece that can safely take a self-paced clock
        formats: ['emom', 'emom-desc', 'fortime'],
        members: [
          {
            ex: 'db-lateral-raise',
            alts: [{ ex: 'cable-lateral-raise' }, { ex: 'band-lateral-raise' }],
            reps: '12–20',
            lastRoundNote: 'LAST ROUND: drop the weight ~30% and rep out once.',
          },
          { ex: 'face-pull', reps: '15–20', alts: [{ ex: 'band-pull-apart' }] },
          { ex: 'wrist-curl', reps: '15–20', logWeight: false },
          { ex: 'reverse-wrist-curl', reps: '15–20', logWeight: false },
          { ex: 'band-lateral-raise', reps: '15–20', logWeight: false },
        ],
      },
      finisherSlot(2),
    ],
  },
  {
    id: 'd40-c1',
    // Was "Push", which the day isn't: The Gate is a pulldown paired with a
    // push-up, and the RDL closes it. The pairing is deliberate (see the block
    // comment below) — the name just never caught up.
    name: 'Chest + Back',
    freq: 'Fri · chest + back + hinge',
    blurb: 'Floor press fresh, then pulldowns + push-ups. Hinge to close.',
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
      RDL_BLOCK,
      {
        mode: 'emom',
        name: 'The Gate',
        rounds: 3,
        // pulldown + push-up: both fail at the muscle, neither at the spine
        formats: ['emom', 'emom-desc', 'fortime'],
        members: [
          { ex: 'lat-pulldown', reps: '8–12' },
          { ex: 'elevated-pushup', reps: '10–15', logWeight: false },
        ],
      },
      finisherSlot(4),
    ],
  },
  {
    id: 'd40-c2',
    name: 'Chest',
    freq: 'Sat · power, chest, arms',
    blurb: 'Power primer, then flys + curls, triceps, and farmer carries.',
    blocks: [
      ...POWER_BLOCKS,
      {
        mode: 'emom',
        name: 'The Cage',
        rounds: 3,
        // overhead triceps keeps this on forced rest — fatigue drives the
        // lumbar arch its own cue warns about
        formats: ['emom', 'emom-desc'],
        members: [
          { ex: 'band-fly', reps: '12–15', logWeight: false, alts: [{ ex: 'cable-fly-low' }] },
          { ex: 'supinated-curl', reps: '8–12', alts: [{ ex: 'hammer-curl' }, { ex: 'reverse-curl' }] },
          { ex: 'overhead-triceps', reps: '10–15', alts: [{ ex: 'rope-pushdown' }] },
        ],
      },
      finisherSlot(3),
    ],
  },
];

// ── BENCHMARKS (BLOCK-01, 2026-08-07) ───────────────────────────────────────
// Three tests, three time domains, three retest cadences. See BLOCK-01.md §4
// for the full rationale; the short version:
//
// ONE BENCHMARK IS NOT A FITNESS SCORE. Grace (~3 min) is 77% explained by
// whole-body strength; Fight Gone Bad (17 min) is 59–72% explained by aerobic
// measures; Cindy (20 min) had NO significant physiological predictors at all
// — a long AMRAP is not automatically an engine test, it can just be a pacing
// test. So: a maximal test, a self-terminating test, and a cheap low-noise
// submaximal test that catches the trend between them.
//
// EVERY MOVEMENT HERE FAILS SOMEWHERE THAT ISN'T THE SPINE — step-ups fail at
// the legs and lungs with an upright torso, carries fail at the grip, push-ups
// fail at the chest with the hips sagging into extension. There is no rep in
// any of these where fatigue produces loaded lumbar flexion. That is the whole
// design: a test you cannot safely max on is not a test.
//
// All three are morning-safe. The morning rule is about BENDING, not load —
// overnight the discs superhydrate, which makes them stiffer in compression
// but more vulnerable in bending. Axial load on a neutral spine is exactly
// what a morning disc handles best.
//
// Retest cadence is set by noise, not enthusiasm. Fight Gone Bad's SEM is 6%
// — the only published noise floor for a metcon — so a hard test needs a long
// gap to beat measurement error, while the submaximal test can run monthly.
export const BENCHMARK_SESSIONS = [
  {
    id: 'bm-three',
    name: 'The Three',
    freq: 'Week 1 + 6 + 12',
    benchmark: true,
    scoreType: 'rounds',
    blurb:
      'Twenty minutes, three movements, no equipment to set up. As many rounds as you can hold together.',
    note: 'Pace it — this is won in the last five minutes, not the first five. Break the push-ups BEFORE you have to.',
    blocks: [
      {
        mode: 'amrap',
        name: 'The Three',
        capSecs: 1200,
        members: [
          { ex: 'pull-up-bw', reps: '5' },
          { ex: 'push-up', reps: '10' },
          { ex: 'box-squat', reps: '15' },
        ],
        note: 'Strict pull-ups only — no kip, ever. Squats TOUCH the box every rep.',
      },
    ],
  },
  {
    id: 'bm-descent',
    name: 'Descent',
    freq: 'Week 1 + 6 + 12',
    benchmark: true,
    scoreType: 'time',
    blurb:
      'Twenty-one, fifteen, nine. Squats and push-ups, for time. Short, nasty, over in about five minutes.',
    note: 'A different engine than The Three: this one is a sprint, and a 20-min AMRAP will not tell you how you would do here.',
    blocks: [
      {
        mode: 'fortime',
        name: 'Descent',
        repScheme: [21, 15, 9],
        members: [
          { ex: 'box-squat', logWeight: false },
          { ex: 'push-up', logWeight: false },
        ],
      },
    ],
  },
  {
    id: 'bm-control',
    name: 'The Control',
    freq: 'Every 4 weeks',
    benchmark: true,
    scoreType: 'hr',
    blurb:
      'Three minutes of steady step-ups, then stand still and read your pulse a minute later. The cheapest honest signal you have.',
    // Grounded in the YMCA / Queen\'s College step tests (reliability 0.92).
    // Deliberately NOT using their VO2max formulas — the box height won\'t
    // match theirs, so the normative equations don\'t apply. This is a
    // within-person tracker: same box, same cadence, same pack, same time of
    // day. Improving recovery HR at identical work is a clean read on cardiac
    // fitness, and unlike a max test it isn\'t confounded by how much grit you
    // had that morning. It is also the ONLY test here sensitive enough to show
    // a change inside four weeks — the other two need 8-12 to beat their noise.
    note: 'Same box, same pack, same time of day, every time — or the number means nothing.',
    blocks: [
      {
        ex: 'box-step-up',
        mode: 'hold',
        sets: 1,
        holdSecs: 180,
        phase: 'STEADY',
        note: 'Steady metronome pace, whole foot on the box, torso tall. Not a sprint — the pace is fixed so the score is your heart, not your effort.',
      },
      {
        ex: 'box-step-up',
        mode: 'hold',
        sets: 1,
        holdSecs: 60,
        phase: 'STAND STILL',
        note: 'Stand still. At the beep, take your pulse for 15s and multiply by 4 — that is your score. Lower is fitter.',
      },
    ],
  },
];

export const getBenchmark = (id) =>
  BENCHMARK_SESSIONS.find((s) => s.id === id) || null;

export const getProgramSession = (id) =>
  DENSITY40_SESSIONS.find((s) => s.id === id) || null;

// ── The week template (TRAINING.md "week at a glance") ───────────────────────
// Index = JS getDay() (0=Sun … 6=Sat). A 'lift' with a `session` is pinned to
// that exact day; a bare 'lift' falls back to the rotating queue.
// 'walk'/'engine' are manual mark-done items.
//
// REWRITTEN 2026-08-07 for the six-half split. Every lift day is pinned now —
// the queue only survives as the fallback for an unpinned slot. Power Primer
// no longer owns a day: it opens A2 (Tue) and C2 (Sat), which carry no anchor
// and no axial load, so the fast work still lands fresh on a quiet back.
// The hinge rides A1/B2/C1 (Mon/Thu/Fri) — see RDL_BLOCK for why it's keyed to
// the front squat rather than to the anchors.
// Sunday is the deliberate easy day — engine + walk, both manual marks, and
// the one to skip guilt-free when the week has been heavy.
export const WEEK_PLAN = [
  /* Sun */ [
    { type: 'rehab' },
    { type: 'rehab', session: 'open-up' },
    { type: 'rehab', session: 'engine' },
  ],
  /* Mon */ [{ type: 'rehab' }, { type: 'lift', session: 'd40-a1' }],
  /* Tue */ [{ type: 'rehab' }, { type: 'lift', session: 'd40-a2' }],
  /* Wed */ [{ type: 'rehab' }, { type: 'lift', session: 'd40-b1' }],
  /* Thu */ [{ type: 'rehab' }, { type: 'lift', session: 'd40-b2' }],
  /* Fri */ [{ type: 'rehab' }, { type: 'lift', session: 'd40-c1' }],
  /* Sat */ [{ type: 'rehab' }, { type: 'lift', session: 'd40-c2' }],
];
