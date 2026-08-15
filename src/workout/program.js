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
    pulley: true,
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
    pulley: true,
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
    avoid:
      'Flopping onto the box, or letting the hips tuck under at the bottom',
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
    pulley: true,
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
    pulley: true,
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
    pulley: true,
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
    pulley: true,
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
    pulley: true,
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

  // ── CrossFit-flavoured, DDD-legal (2026-08-10) ────────────────────────────
  // He asked for CrossFit movements. These four clear the bar the rest of the
  // program is held to: the spine stays stacked and neutral, and there is no
  // rep where FATIGUE produces loaded lumbar flexion. What stays banned is
  // unchanged and not up for negotiation — thrusters, wall balls, burpees,
  // GHD, toes-to-bar, kipping anything, box jumps, barbell snatch and clean.
  'db-push-press': {
    name: 'DB Push Press',
    feel: 'Legs launching it, shoulders finishing it',
    avoid: 'Arching the low back to get under the weight',
    cue: 'DBs at the shoulders, ribs down. Short dip from the KNEES, drive, punch overhead. The dip is legs — the spine never moves.',
    why: 'Overhead power with a stacked spine: the dip is knees and hips, so the load stays axial and neutral instead of bending anything.',
    yt: 'dumbbell push press form',
  },
  'db-hang-snatch': {
    name: 'DB Hang Power Snatch',
    feel: 'Hips snapping, the bell floating up',
    avoid: 'Dipping below the knee, or rounding to reach it',
    cue: 'ONE DB, start from the HANG — above the knee, never the floor. Short hinge, snap the hips, punch it overhead. Light. The set ends the moment the back rounds.',
    // HONEST NOTE: the one movement here sitting closest to the line. It is in
    // because it is a HANG variant with one light DB — the hinge is shallow,
    // the spine stays neutral, and it never goes on an open clock (it is in
    // OPEN_PACE_BANNED). The from-the-floor and barbell versions stay
    // contraindicated, and the NEVER list in verify-program.mjs still bans them.
    why: 'The one genuinely explosive full-body movement the program can safely hold — hip power under speed, with the range kept above the knee.',
    yt: 'dumbbell hang power snatch form',
  },
  'db-front-rack-lunge': {
    name: 'DB Front-Rack Reverse Lunge',
    feel: 'Front leg loaded, torso locked upright',
    avoid: 'Tipping forward, or letting the back knee crash down',
    cue: 'DBs at the shoulders, chest tall. Step BACK, touch the knee light, drive out of the front heel. Elbows stay up.',
    why: 'Loaded single-leg work where the front rack forces an upright torso — the position does the spine-safety for you.',
    yt: 'dumbbell front rack reverse lunge',
  },
  'bear-crawl': {
    name: 'Bear Crawl',
    feel: 'Shoulders working, midline fighting the twist',
    avoid: 'Hips swinging side to side, or riding up high',
    cue: 'Knees an inch off the floor, hips low and level. Opposite hand and foot, short steps — a glass of water on your back would not spill.',
    why: 'Anti-rotation core under load with a flat spine, and it smokes the shoulders — the safest midline piece in the metcon canon.',
    yt: 'bear crawl form',
  },

  // ── The cardio stations (2026-08-10) ──────────────────────────────────────
  // Every quartet closes on one of these: the minute that makes it a workout
  // instead of a list of sets. All of them are UPRIGHT and unloaded — a DDD
  // spine pays nothing for them, and none can turn into loaded lumbar flexion
  // when the clock is running and he is breathing hard. That rules out the
  // obvious ones: no burpees (the highest flexion-cycle count per minute in
  // the whole metcon canon), no mountain climbers, no sit-ups.
  'diamond-pushup': {
    name: 'Diamond Push-Up',
    feel: 'All of it in the back of the arms',
    avoid: 'Hips sagging, elbows flaring wide',
    cue: 'Thumbs and index fingers touch under your chest. Elbows track back, body one plank — first hip-sag rep ends the set.',
    why: 'The no-equipment triceps builder — the push-up family already proved itself spine-safe here, and the narrow hands put the load where he wants it.',
    yt: 'diamond push up form',
  },
  'db-hang-clean-press': {
    name: 'DB Hang Clean & Press',
    feel: 'One flowing shot: hips snap, bells ride up, press to lockout',
    avoid: 'Bending past the knees, pressing with a soft brace',
    cue: 'Bells at the hips, hinge only to the knee — snap the hips, ride the bells to the shoulders, press out. One flow, every rep crisp.',
    why: "The hang clean carve-out, same terms as the hang snatch: above the knee, light DBs, forced-rest clocks only — never a barbell, never from the floor, never open pace.",
    yt: 'dumbbell hang clean and press',
  },
  'db-kickback': {
    name: 'DB Kickback',
    feel: 'The back of the arm locking out hard',
    avoid: 'Swinging the weight, elbow drifting down',
    cue: 'Chest on the incline bench — same setup as the row. Elbow pinned high, kick the DB back to a full lockout, squeeze, lower slow.',
    why: "The no-pulley triceps isolator: chest-supported so the spine carries nothing, from his old programming's BBG arm days.",
    yt: 'chest supported db kickback',
  },
  'shadow-boxing': {
    name: 'Shadow Boxing',
    feel: 'Hips driving every punch, shoulders burning by round six',
    avoid: 'Arm-only punches, holding your breath',
    cue: 'Stance tall, fists at the chin. Jab-cross with the hips, exhale on every punch. Real punches at air — not a wave.',
    why: "The breakout home-conditioning movement for a reason: zero equipment, zero floor space, spine-neutral, and a heart rate that climbs as fast as you're willing to throw.",
    yt: 'shadow boxing basics beginners',
  },
  'jumping-jack': {
    name: 'Jumping Jack',
    feel: 'Everything moving, breathing up fast',
    avoid: 'Heavy, flat-footed landings',
    cue: 'Tall and easy. Land soft through the whole foot, arms all the way up. Set a rhythm you can hold for the whole minute.',
    why: 'The cheapest honest minute of cardio there is — no equipment, no spine cost, and it never gets technical when you are tired.',
    yt: 'jumping jacks form',
  },
  'reverse-lunge': {
    name: 'Reverse Lunge',
    feel: 'Front leg working, back knee dropping under control',
    avoid: 'Torso tipping forward, back knee slamming down',
    cue: 'Step BACK, not forward — chest tall the whole way. Touch the back knee down light, drive out of the front heel.',
    why: 'Stepping back keeps the torso upright and the shin quiet, so the legs get a hard minute and the low back never enters the movement.',
    yt: 'reverse lunge form',
  },
  'high-knees': {
    name: 'High Knees',
    feel: 'Hip flexors burning, lungs opening',
    avoid: 'Leaning back, or thumping the heels down',
    cue: 'Run tall on the spot, knees to hip height, quick off the floor. Arms driving.',
    why: 'Heart rate and hip flexors in the same minute, standing straight up — and the hip flexors are already a target of the back program.',
    yt: 'high knees exercise form',
  },
  'skater-bound': {
    name: 'Skater Bound',
    feel: 'Pushing side to side, catching on one leg',
    avoid: 'Crossing the feet, or landing with a collapsing knee',
    cue: 'Bound sideways, land on one leg and stick it for a beat. Chest tall, knee tracking over the toe.',
    why: 'The only side-to-side minute in the program — hip stability in the plane the rest of the week never trains.',
    yt: 'skater bounds exercise',
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

// The standalone RDL_BLOCK is GONE (2026-08-10 fix round) — nothing imported
// it, and its comment described a 3×/week hinge across sessions that no
// longer exist. The hinge ships exclusively as the HINGE() station inside the
// Mon/Fri pieces (2×/week — asserted in tests/unit/rehab.test.js), where its
// rest is interval × stations and its reps are pinned by fixedReps. The one
// rule that survives it: the hinge never shares a day with the FRONT SQUAT,
// the only genuinely axial anchor in the week — so Wednesday has no RDL.

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
// The primer is three minutes' worth of work in a six-minute window — bounce,
// leap, throw the floor away, one per minute, twice through. EMOM suits
// ballistic work better than anything: the interval forces the rest that keeps
// every rep crisp, which is the whole rule for this block (stop while springy,
// never near fatigue).
// The ballistic slot, as a STATION in the day's piece. It used to be a
// tap-through warm-up in front of the anchor; consolidating the day put it in
// the cycle, which is what he asked for — one tap, one heavy clock, one piece.
//
// THE TRADEOFF, STATED: the rule for this work is "crisp, and stop while
// you're still springy — never near fatigue". As a station it now runs with
// some fatigue on board — and since EMOM40 (2026-08-11) with no full rest
// minute on Monday. What keeps it defensible: tiny doses, the cardio minute
// parked MID-cycle so the wrap into the ballistic opener comes off a light
// curl minute (b1/c1 keep 20s breathers), and a movement whose own cue is
// "stop when the pop fades". If the jumps ever start landing heavy, THIS is
// the station to cut — that instruction survives every redesign.
const POWER = (specs) =>
  specs.map((m) => ({
    ...m,
    logWeight: false,
    // The ballistic dose is 3 CRISP reps, full stop — the descending format
    // must never hand it a 5-rep opener, so the reps are pinned.
    fixedReps: true,
    phase: m.phase || 'GO',
    note: 'Crisp only. If the pop fades, stop the minute early and take the rest.',
  }));

export const POWER_BLOCKS = [
  {
    mode: 'emom',
    name: 'The Spring',
    rounds: 2,
    members: [
      { ex: 'pogo-hop', secs: 15, phase: 'BOUNCE', logWeight: false },
      { ex: 'broad-jump', reps: '3', logWeight: false },
      { ex: 'power-pushup', reps: '3', logWeight: false },
    ],
  },
];

// ── WHERE THE FINISHER WENT (2026-08-10) ────────────────────────────────────
// There used to be a six-deep pool of short bodyweight finishers in a block of
// their own at the end of a session. Consolidating each day into ONE piece
// removed the block: a finisher was, by definition, a second clock after the
// clock, and "start the timer, work, then end" has room for exactly one.
//
// What it did is still done. The last round of every piece carries a
// `lastRoundNote` telling him to empty the tank, and each day's cardio station
// is what he empties it into — same job, same fun, no extra timer. The AMRAP
// and tabata formats live on in the benchmarks, which is the one place volume
// genuinely does not need to be auditable.

// ── The three days ──────────────────────────────────────────────────────────
// REBUILT 2026-08-10 (three lift days + four rehab days), then capped
// 2026-08-11: EMOM40 — every day in the week fits 40 minutes of clock work,
// verifier-enforced. The rehab days run the Back & Hips distillate + topper
// (rehab.js); nothing stacks on anything.
//
// ── TWO CLOCKS, AND THE SECOND ONE RUNS TO THE END ──────────────────────────
// "Start the timer, work, then end." A day is:
//
//   warm-up (taps, no clock)  →  THE ANCHOR (E3M)  →  THE PIECE (one EMOM)
//
// Everything that is not the heavy lift lives in ONE continuous piece —
// six to eight stations, a minute each, straight through (b1/c1 keep a
// 20-second breather between trips; the full rest minute died for the
// EMOM40 cap, 2026-08-11). No second header, no third timer.
//
// WHY THE ANCHOR KEEPS ITS OWN CLOCK, and why that isn't negotiable: a heavy
// set at 2–4 RIR needs unrack, setup, five hard reps and a re-rack. Sixty
// seconds turns that into a rush, and rushing is precisely what converts a
// neutral spine into a flexed one. Three minutes means the set takes ~30s and
// the rest is ~2:30 — clear of TRAINING.md IRON RULE 2's 2:00 floor, and
// enforced by a clock rather than by how strong he feels that day.
//
// WHY THE HINGE DOESN'T NEED ONE. In a multi-station EMOM the rest between
// sets of a movement is `interval × stations`, not `interval` — an RDL sitting
// in a six-station cycle gets six minutes between sets, well past the floor.
// The rule was never "no clock"; it is a REST FLOOR, and this clears it easily.
// scripts/verify-program.mjs measures the real gap and fails the build if any
// spine-loaded movement ever comes round faster than 2:00.
//
// ── EVERY PIECE HAS ITS OWN NAME ────────────────────────────────────────────
// A different set of movements is a different workout, so it gets a different
// name — twelve of them, four per day, one per week of the rotation. "The Vice"
// meaning four different sessions depending on the week was the thing that made
// the program hard to talk about.
//
// ── EVERY SLOT ROTATES, INCLUDING THE ANCHOR (his call) ─────────────────────
// A slot is a `{ rotate: [v1, v2, v3, v4] }` pool and the engine advances it
// one step per completed run — at one run a week that is a four-week cycle, so
// no session repeats inside a month.
//
// THE COST, STATED PLAINLY: rotating the anchor is the one part that isn't
// free. Baz-Valle 2019 randomised exercise selection every session for 8 weeks
// — hypertrophy identical, but bench 1RM went +0.77% (varied) vs +4.7%
// (fixed). Rotation costs strength TRACKING, not muscle. He took that trade
// knowingly: variety he'll actually do beats a PR line he won't. Load logs
// against the exercise, so each variant keeps its own honest history.
//
// A PIECE IS A SLOT PATTERN, NOT A LIST. Each station is a fixed job and only
// the movement filling it rotates. That is what lets four different-looking
// weeks deliver the same dose to the same thirteen muscles, and it is why the
// audit passes in every week rather than on average.

// The heavy slot: one movement, every three minutes, four working rounds plus
// however many build rounds that lift needs. THE WARM-UP IS ON THE SAME CLOCK
// (his call, 2026-08-10) — a tap-through ramp in front of a timer meant the
// heavy block started twice. Now it starts once. Build rounds are unlogged and
// do not count as sets, so they can never reach the volume audit or a PR.
//
// `warmupRounds` is per-lift because the need is per-lift: ONE round while he
// is lifting light (2026-08-10 — "I lift very light at the moment"), and ZERO
// for bodyweight pull-ups, which have nothing to build up to.
// THE INTERVAL FOLLOWS THE MOVEMENT (2026-08-10, his call). A barbell squat or
// floor press earns three minutes: heavy, technical, and a rushed rep is the
// exact failure this program exists to avoid. A bodyweight pull-up or a DB push
// press does not — it is quick to set up, the spine stays stacked, and ninety
// seconds of rest is plenty. So each spec may name its own `intervalSecs`.
//
// The 2:00 rest floor (TRAINING.md IRON RULE 2) still binds everything on the
// SPINE_LOADED list, and E2M cannot clear it — which is exactly why the two
// lifts that drop to two minutes are the two that aren't on it.
const ANCHOR = (specs, { warmupRounds = 1, intervalSecs = 180 } = {}) => ({
  rotate: specs.map(({ alts, intervalSecs: own, ...m }) => {
    const iv = own ?? intervalSecs;
    return {
      mode: 'emom',
      name: 'The Anchor',
      formatLabel: `E${iv / 60}M`,
      intervalSecs: iv,
      anchor: true,
      warmupRounds,
      rounds: warmupRounds + 4,
      members: [{ ...m, alts }],
    };
  }),
});

// THE PIECE. `names` is one name per week of the rotation — a different set of
// movements is a different workout, so it gets a different name, and "the piece
// I did on Monday" is a thing he can actually say. `slots` is one pool per
// station, read down the column to get that week's session. Written this way on
// purpose: the shape of the data is the invariant, so a movement can't land in
// the wrong job and a pool can't quietly end up three deep.
// EMOM40 (2026-08-11, his call): the piece runs STRAIGHT THROUGH — the full
// rest minute between trips died for the 40-minute cap, traded knowingly
// against his original "a minute for rest" spec (he chose stations over
// breathers after feeling the format). Where a day has headroom (b1/c1 at
// 39:00), `roundRestSecs: 20` buys three 20-second breathers between trips
// and lands the clock at exactly 40:00. The spine never needed the rest
// rounds — a 6-8 station cycle puts 6+ minutes between same-movement sets.
const PIECE = (
  names,
  rounds,
  slots,
  { formats = ['emom', 'emom-desc'], roundRestSecs = 0 } = {},
) => ({
  rotate: names.map((name, v) => ({
    mode: 'emom',
    name,
    rounds,
    ...(roundRestSecs ? { roundRestSecs } : {}),
    formats,
    members: slots.map((pool) => pool[v]),
  })),
});

// A cardio station — the minute that turns a cycle into a workout. Worked for
// `secs`; whatever is left of the minute is the recovery. Never logged: the
// point is the breathing, not a number to beat.
const CARDIO = (ex, secs = 40) => ({ ex, secs, phase: 'GO', logWeight: false });

// The lungs slot, offset per day so no two pieces in a week open the same way.
const LUNGS = [
  CARDIO('jumping-jack', 45),
  CARDIO('high-knees', 45),
  CARDIO('skater-bound'),
  CARDIO('reverse-lunge', 45),
];
const LUNGS_FROM = (offset) => [
  ...LUNGS.slice(offset),
  ...LUNGS.slice(0, offset),
];

// The hinge, as a station. Same 3×8 dose it always had; it now comes round
// once per trip through the cycle, which is more rest than it used to get.
// `fixedReps`: the one spine-loaded movement inside the pieces never rides
// the descending scheme — its dose is deliberately flat and symptom-gated,
// and a 10-rep "hardest set while freshest" is exactly the escalation the
// note below exists to prevent.
const HINGE = () => ({
  ex: 'rdl',
  reps: '8',
  fixedReps: true,
  note: 'Add load only if the last hinge day stayed quiet.',
});

export const DENSITY40_SESSIONS = [
  {
    id: 'd40-a1',
    // NOT "Pull" any more (2026-08-10). The day carries a pull ANCHOR, but the
    // piece after it works legs, chest, delts and lungs — naming the whole day
    // after one slot was the last bit of the old body-part split still lying
    // around. The anchor's pattern lives in `freq`, where it is actually true.
    name: 'Full Body I',
    freq: 'Mon · pull anchor',
    blurb:
      'Forty minutes flat. Pull on a two-minute clock, then one EMOM straight to the end — power, hinge, pull, push, lungs, delts, arms.',
    blocks: [
      // ONE MOVEMENT, NO ROTATION, NO BUILD-UP (2026-08-10, his call): "we can
      // only do regular pull ups". Weighted pull-ups leave the program until he
      // can add a pack, and a bodyweight pull-up has nothing to warm up TO — so
      // this day's heavy block is four working rounds and nothing else.
      // Progression here is REPS, not load: `logReps` on the exercise means the
      // sets record reps at 0 kg and never chase a weight PR.
      ANCHOR(
        [
          {
            ex: 'pull-up-bw',
            reps: '5',
            intervalSecs: 120, // bodyweight and decompressive — 90s rest is plenty
            note: 'Strict, dead-hang every rep. Add a rep before you ever add a pack.',
            alts: [{ ex: 'lat-pulldown', reps: '8' }],
          },
        ],
        { warmupRounds: 0 },
      ),
      // [power · hinge · vertical pull · horizontal push · lungs ·
      // side delt · rear delt · biceps] — cardio mid-cycle (2026-08-11), so
      // the round-wrap never lands it before the ballistic opener.
      // The anchor is strict pull-ups every week and this station is
      // pulldowns every week — lats get the bar AND the machine every Monday
      // by construction. Lats are a stated V-taper priority.
      //
      // REP COUNTS ARE BUDGETED AGAINST THE MINUTE (2026-08-10): prescribed
      // reps × the movement's own tempo must fit 75% of the interval, so
      // every station keeps ~15s to get there and breathe. The old 20-rep
      // laterals were 60s of work in a 60s minute — a rush by construction.
      // The tempo is the intensity knob now: 12 controlled reps is a 36s set
      // meant to be taken near burn, not a lighter day.
      //
      // The REAR-DELT station was added 2026-08-10: at 6 fractional sets/week
      // the 3-D part of "big shoulders" was the thinnest thing in the program.
      PIECE(['The Spread', 'The Winch', 'The Quarry', 'The Draw'], 4, [
        // power opens each trip round — the freshest point in the cycle
        POWER([
          { ex: 'pogo-hop', secs: 15, phase: 'BOUNCE' },
          { ex: 'broad-jump', reps: '3' },
          { ex: 'power-pushup', reps: '3' },
          { ex: 'pogo-hop', secs: 15, phase: 'BOUNCE' },
        ]),
        [0, 1, 2, 3].map(HINGE),
        // the anchor is pull-ups every week, so this is its volume counterpart
        // — and Monday's ONE pulley station (lat bar, set before the piece)
        [0, 1, 2, 3].map(() => ({
          ex: 'lat-pulldown',
          reps: '10',
          alts: [{ ex: 'pull-up-bw', reps: '3' }],
        })),
        [
          {
            ex: 'elevated-pushup',
            reps: '12',
            logWeight: false,
            alts: [{ ex: 'push-up', reps: '15', logWeight: false }],
          },
          { ex: 'push-up', reps: '15', logWeight: false },
          {
            ex: 'band-fly',
            reps: '12',
            logWeight: false,
            alts: [{ ex: 'push-up', reps: '15', logWeight: false }],
          },
          {
            ex: 'elevated-pushup',
            reps: '12',
            logWeight: false,
            alts: [{ ex: 'push-up', reps: '15', logWeight: false }],
          },
        ],
        // the cardio minute sits MID-cycle (2026-08-11): with the rest rounds
        // gone, the wrap runs station 8 → station 1, and cardio straight into
        // the ballistic opener is the one adjacency the deleted rest minute
        // used to break
        LUNGS_FROM(0).map((c) => ({
          ...c,
          lastRoundNote: 'LAST ROUND — empty the tank.',
        })),
        // DB ↔ band only — the pulley is spoken for (pulldowns) and a second
        // attachment change mid-cycle is exactly what a 60s window can't buy
        [
          {
            ex: 'db-lateral-raise',
            reps: '12',
            note: 'Heavier than the old 20-rep weight — 12 should burn by the last rep.',
            alts: [{ ex: 'band-lateral-raise', reps: '12', logWeight: false }],
          },
          {
            ex: 'band-lateral-raise',
            reps: '12',
            logWeight: false,
            alts: [{ ex: 'db-lateral-raise', reps: '12' }],
          },
          {
            ex: 'db-lateral-raise',
            reps: '12',
            note: 'Heavier than the old 20-rep weight — 12 should burn by the last rep.',
            alts: [{ ex: 'band-lateral-raise', reps: '12', logWeight: false }],
          },
          {
            ex: 'band-lateral-raise',
            reps: '12',
            logWeight: false,
            alts: [{ ex: 'db-lateral-raise', reps: '12' }],
          },
        ],
        // Band pull-aparts every week: the only non-pulley rear-delt movement
        // in the palette, and the band lives in a gym bag — zero setup, which
        // is what a station between pulldowns and curls needs to be. The reps
        // can't rise (the minute is budgeted), so the BAND is the load knob.
        [0, 1, 2, 3].map(() => ({
          ex: 'band-pull-apart',
          reps: '14',
          logWeight: false,
          note: 'When the last rep is smooth, shorten your grip a hand-width — the band is the load knob.',
        })),
        [
          {
            ex: 'hammer-curl',
            reps: '10',
            alts: [
              { ex: 'supinated-curl', reps: '10' },
              { ex: 'reverse-curl', reps: '10' },
            ],
          },
          {
            ex: 'supinated-curl',
            reps: '10',
            alts: [
              { ex: 'hammer-curl', reps: '10' },
              { ex: 'reverse-curl', reps: '10' },
            ],
          },
          {
            ex: 'reverse-curl',
            reps: '10',
            alts: [
              { ex: 'hammer-curl', reps: '10' },
              { ex: 'supinated-curl', reps: '10' },
            ],
          },
          {
            ex: 'hammer-curl',
            reps: '10',
            alts: [
              { ex: 'supinated-curl', reps: '10' },
              { ex: 'reverse-curl', reps: '10' },
            ],
          },
        ],
      ]),
    ],
  },
  {
    id: 'd40-b1',
    name: 'Full Body II',
    freq: 'Wed · squat anchor',
    blurb:
      'Forty minutes flat. Build and squat on a three-minute clock, then one EMOM to the end — pull, press, delts, arms, a carry — twenty seconds of air between trips.',
    blocks: [
      ANCHOR([
        {
          ex: 'front-squat',
          reps: '5',
          note: '2–4 RIR hard cap, forever. No barbell today? Heavy DB split squat, same reps.',
          warmupNote:
            'One build round: empty bar ×3, quick load to ~80%, ×2 — working weight next round.',
          alts: [{ ex: 'db-split-squat', reps: '6/leg' }],
        },
        // the front-rack reverse lunge joined the alt lists 2026-08-16 (QA):
        // it had art, a demo and a muscle-map entry but was served nowhere.
        // Same single-leg class as the split squats, and the front rack
        // forces the upright torso — the position does the spine-safety.
        {
          ex: 'db-split-squat',
          reps: '6/leg',
          alts: [
            { ex: 'rfe-split-squat', reps: '6/leg' },
            { ex: 'db-front-rack-lunge', reps: '6/leg' },
          ],
        },
        {
          ex: 'rfe-split-squat',
          reps: '6/leg',
          alts: [
            { ex: 'db-split-squat', reps: '6/leg' },
            { ex: 'db-front-rack-lunge', reps: '6/leg' },
          ],
        },
        {
          ex: 'box-squat',
          reps: '8',
          alts: [{ ex: 'db-split-squat', reps: '6/leg' }],
        },
      ]),
      // NO HINGE ON SQUAT DAY. The rule is that the hinge never shares a day
      // with the axial anchor, and this is that day whichever variant comes up
      // — so the RDL rides Mon and Fri, twice a week.
      //
      // [horizontal pull · overhead press · side delt · triceps · biceps ·
      // carry] — six stations since EMOM40 (2026-08-11; forearms live in The
      // Popeye topper, the crawl in The Engine). The press slot is the
      // CrossFit slot: push press or hang snatch, both of which put load
      // overhead through a stacked spine, never a bent one. The carry holds
      // its slot in every variant — obliques now come from it (Wed) plus the
      // Engine topper's crawl, and the audit checks the sum weekly. Load note
      // (McGill, Marshall & Andersen 2013): a one-hand carry is the MORE
      // spine-expensive carry — 30kg in one hand = 2874 N at L4/L5 vs 2339 N
      // for 30kg in EACH hand. Keep it light.
      PIECE(
        ['The Forge', 'The Anvil', 'The Mill', 'The Kiln'],
        4,
        [
          // Chest-supported DB row EVERY week (2026-08-11, one-pulley rule):
          // the 1-arm cable row wanted the low pulley on the same weeks the
          // triceps station holds the rope, and one pulling station can't wear
          // two attachments mid-cycle. The DB row is the spine-safest row in
          // the palette anyway — chest on the bench, spine fully unloaded.
          [0, 1, 2, 3].map(() => ({ ex: 'chest-supported-row', reps: '10' })),
          [
            // the hang clean & press rides as the pre-clock alt on every
            // week of this slot (2026-08-15): same forced-rest clock, same
            // light-DB class, one more flavor of overhead
            {
              ex: 'db-push-press',
              reps: '8',
              alts: [{ ex: 'db-hang-clean-press', reps: '6' }],
            },
            // the snatch's dose is quality-capped exactly like the ballistic
            // primer — the descending format never touches it
            {
              ex: 'db-hang-snatch',
              reps: '5/side',
              fixedReps: true,
              alts: [
                { ex: 'db-hang-clean-press', reps: '5', fixedReps: true },
              ],
            },
            // week 3's primary is the hang clean & press (2026-08-16 QA):
            // the slot now rotates all THREE overhead flavors — push press,
            // snatch, clean & press, snatch — instead of holding the third
            // one hostage in the alt list. Same class as the snatch: light
            // DBs, above the knee, forced-rest clocks, quality-capped reps.
            {
              ex: 'db-hang-clean-press',
              reps: '6',
              fixedReps: true,
              alts: [{ ex: 'db-push-press', reps: '8' }],
            },
            {
              ex: 'db-hang-snatch',
              reps: '5/side',
              fixedReps: true,
              alts: [
                { ex: 'db-hang-clean-press', reps: '5', fixedReps: true },
              ],
            },
          ],
          // WAS a second quad station. His legs are already where he wants them
          // (2026-08-10) and he asked for maintenance, not growth — you cannot
          // train a muscle leaner, so "more cuts" is a body-fat outcome, not a
          // volume one. The heavy squat anchor holds what he has; this slot went
          // to the width instead, which is what he IS chasing.
          // BAND laterals every week on THIS day (2026-08-11): the row and the
          // push press are back-to-back DB stations already — one re-dial with
          // the DBs in hand. A DB lateral third in the chain meant a second
          // double-DB re-dial inside a 60s window, which is the same cost class
          // as the mid-piece attachment change this day just banned. TRAINING.md
          // has always said it: "if you rotate in the DB row, pair it with BAND
          // laterals". The DB version stays as the alt — a pre-clock choice.
          [0, 1, 2, 3].map(() => ({
            ex: 'band-lateral-raise',
            reps: '12',
            logWeight: false,
            alts: [{ ex: 'db-lateral-raise', reps: '12' }],
          })),
          // THE pulley station (2026-08-11): the week's one attachment lives
          // here — rope high on pushdown weeks, rope low on overhead weeks,
          // rigged before the piece and never touched mid-cycle. The alts
          // swap exercise AND rig before the clock — and since 2026-08-15
          // the diamond push-up is the no-equipment out: pick it and the
          // pulley isn't touched at all that day.
          [
            {
              ex: 'rope-pushdown',
              reps: '12',
              alts: [
                { ex: 'overhead-triceps', reps: '10' },
                { ex: 'diamond-pushup', reps: '10', logWeight: false },
              ],
            },
            {
              ex: 'overhead-triceps',
              reps: '10',
              alts: [
                { ex: 'rope-pushdown', reps: '12' },
                { ex: 'diamond-pushup', reps: '10', logWeight: false },
              ],
            },
            {
              ex: 'rope-pushdown',
              reps: '12',
              alts: [
                { ex: 'overhead-triceps', reps: '10' },
                { ex: 'diamond-pushup', reps: '10', logWeight: false },
              ],
            },
            {
              ex: 'overhead-triceps',
              reps: '10',
              alts: [
                { ex: 'rope-pushdown', reps: '12' },
                { ex: 'diamond-pushup', reps: '10', logWeight: false },
              ],
            },
          ],
          [
            {
              ex: 'supinated-curl',
              reps: '10',
              alts: [
                { ex: 'hammer-curl', reps: '10' },
                { ex: 'reverse-curl', reps: '10' },
              ],
            },
            {
              ex: 'hammer-curl',
              reps: '10',
              alts: [
                { ex: 'supinated-curl', reps: '10' },
                { ex: 'reverse-curl', reps: '10' },
              ],
            },
            {
              ex: 'supinated-curl',
              reps: '10',
              alts: [
                { ex: 'hammer-curl', reps: '10' },
                { ex: 'reverse-curl', reps: '10' },
              ],
            },
            {
              ex: 'reverse-curl',
              reps: '10',
              alts: [
                { ex: 'hammer-curl', reps: '10' },
                { ex: 'supinated-curl', reps: '10' },
              ],
            },
          ],
          // forearms moved to The Popeye topper (2026-08-11, EMOM40 cap) — the
          // look is still fed, just on the light days
          [0, 1, 2, 3].map(() => ({
            ex: 'suitcase-carry',
            secs: 45,
            phase: 'CARRY',
            note: 'Right side first, swap at halfway. Tall and level — set it down the moment the hips tip.',
          })),
        ],
        { roundRestSecs: 20 },
      ),
      // NO COOL-DOWN CLOCK. It was a third timer at the end of a session that
      // wants two, and it is not load-bearing any more: the hamstring and hip
      // flexor stretches still run on Sunday's Open Up, and the four rehab days
      // now carry the couch stretch, the wall groin stretch and the elephant
      // walk — far more hip work than this four minutes ever was.
    ],
  },
  {
    id: 'd40-c1',
    name: 'Full Body III',
    freq: 'Fri · press anchor',
    blurb:
      'Forty minutes flat. Build and press heavy first, then one EMOM to the end — power, hinge, chest, pull-ups, delts, triceps — twenty seconds of air between trips.',
    blocks: [
      ANCHOR([
        {
          ex: 'floor-press',
          reps: '6',
          warmupNote:
            'Bar on LOW safeties. One build round: ~half ×5, load to ~80% ×2 — working weight next round.',
          alts: [
            { ex: 'db-floor-press', reps: '8' },
            { ex: 'incline-db-press', reps: '8' },
          ],
        },
        {
          ex: 'db-floor-press',
          reps: '8',
          alts: [{ ex: 'incline-db-press', reps: '8' }],
        },
        {
          ex: 'incline-db-press',
          reps: '8',
          alts: [{ ex: 'db-floor-press', reps: '8' }],
        },
        {
          ex: 'db-push-press',
          reps: '6',
          intervalSecs: 120, // stacked spine, quick setup — not a three-minute lift
          // NOT db-floor-press: that lift is SPINE_LOADED and needs the 3:00
          // interval, and a persisted swap would have run it at E2M forever.
          // Every alt must clear the SAME rest floor as its block's interval —
          // the verifier now checks alts too.
          alts: [{ ex: 'push-up', reps: '15', logWeight: false }],
        },
      ]),
      // [power · hinge · chest · strict pull-up · side delt · triceps] —
      // six stations since EMOM40 (2026-08-11). Rear delts and the lungs
      // minute moved to the rehab-day toppers; side delts stay in every
      // variant because they are the V-taper's width.
      PIECE(
        ['The Gate', 'The Cage', 'The Bellows', 'The Furnace'],
        4,
        [
          // offset from Monday's pool so the two days never open the same way
          POWER([
            { ex: 'broad-jump', reps: '3' },
            { ex: 'power-pushup', reps: '3' },
            { ex: 'pogo-hop', secs: 15, phase: 'BOUNCE' },
            { ex: 'power-pushup', reps: '3' },
          ]),
          // On the barbell-press week the hinge shares THE bar with the anchor —
          // the strip-and-move happens in the power minute, not mid-set. The DB
          // anchor weeks need no note; the bar was never racked.
          [
            {
              ...HINGE(),
              // covers both cases: the anchor's alts are DB presses, and a
              // persisted swap would leave a barbell instruction pointing at
              // a bar that was never racked
              note: 'Barbell press week: same bar — strip to hinge weight during the power minute. DB press week: stage the bar loaded before the session. Add load only if the last hinge day stayed quiet.',
            },
            HINGE(),
            HINGE(),
            HINGE(),
          ],
          // band / bodyweight only — Friday's pulley belongs to the triceps
          // station (one attachment per piece, rigged before the clock)
          [
            {
              ex: 'band-fly',
              reps: '12',
              logWeight: false,
              alts: [{ ex: 'push-up', reps: '15', logWeight: false }],
            },
            {
              ex: 'push-up',
              reps: '15',
              logWeight: false,
              alts: [{ ex: 'band-fly', reps: '12', logWeight: false }],
            },
            {
              ex: 'elevated-pushup',
              reps: '12',
              logWeight: false,
              alts: [{ ex: 'push-up', reps: '15', logWeight: false }],
            },
            {
              ex: 'band-fly',
              reps: '12',
              logWeight: false,
              alts: [{ ex: 'push-up', reps: '15', logWeight: false }],
            },
          ],
          // lats on a second day — the triangle's other side. STRICT PULL-UPS,
          // not pulldowns (2026-08-11): Friday's pulley is rigged for triceps,
          // and the pull-up bar needs nothing. Three crisp reps a minute is a
          // real dose at his ~5-rep max — and it STEPS WITH THE PHASES (4 in
          // phase 2, 5 in phase 3, via applyPhase) so it stays a real dose as
          // the Monday anchor drives his pull-up strength up. A fixed 3 would
          // decay into warm-up grade while the audit kept crediting full sets.
          // fixedReps: the descending format must never manufacture a 6-rep
          // opening minute at his ~5-rep max — the phase step (3 → 4 → 5) IS
          // this station's progression
          [0, 1, 2, 3].map(() => ({
            ex: 'pull-up-bw',
            reps: '3',
            fixedReps: true,
          })),
          // DB ↔ band only — same one-pulley rule as the other days
          [
            {
              ex: 'db-lateral-raise',
              reps: '12',
              note: 'Heavier than the old 20-rep weight — 12 should burn by the last rep.',
              lastRoundNote:
                'LAST ROUND: drop the weight ~30% and rep out once.',
              alts: [
                { ex: 'band-lateral-raise', reps: '12', logWeight: false },
              ],
            },
            {
              ex: 'band-lateral-raise',
              reps: '12',
              logWeight: false,
              alts: [{ ex: 'db-lateral-raise', reps: '12' }],
            },
            {
              ex: 'db-lateral-raise',
              reps: '12',
              note: 'Heavier than the old 20-rep weight — 12 should burn by the last rep.',
              lastRoundNote:
                'LAST ROUND: drop the weight ~30% and rep out once.',
              alts: [
                { ex: 'band-lateral-raise', reps: '12', logWeight: false },
              ],
            },
            {
              ex: 'band-lateral-raise',
              reps: '12',
              logWeight: false,
              alts: [{ ex: 'db-lateral-raise', reps: '12' }],
            },
          ],
          // rear delts moved to the toppers (2026-08-11, EMOM40 cap) — band
          // pull-aparts now land on the light days instead
          [
            {
              ex: 'overhead-triceps',
              reps: '10',
              alts: [{ ex: 'rope-pushdown', reps: '12' }],
            },
            {
              ex: 'rope-pushdown',
              reps: '12',
              alts: [{ ex: 'overhead-triceps', reps: '10' }],
            },
            {
              ex: 'overhead-triceps',
              reps: '10',
              alts: [{ ex: 'rope-pushdown', reps: '12' }],
            },
            {
              ex: 'rope-pushdown',
              reps: '12',
              alts: [{ ex: 'overhead-triceps', reps: '10' }],
            },
          ],
        ],
        { roundRestSecs: 20 },
      ),
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
// REWRITTEN 2026-08-10 — three lift days, four rehab days, nothing doubled up.
//
// The rehab days run Back & Hips (~25 min of holds) + the 12-minute topper
// EMOM; Mon/Wed/Fri are the EMOM40 lift days with NO rehab stacked. Every
// day in the week lands 35–40 minutes (2026-08-11) — one shape, one press
// of start.
//
// THE BACK STILL WINS THE ARGUMENT: 4×/week beats the source program's own
// 3×/week prescription, and the hardest lift days are the ones with a full
// rehab day either side of them.
//
// SUNDAY IS THE REST DAY (2026-08-16, his ask — "rest days on Sundays").
// It carries the 'sunday' session: the same distillate holds, and then it
// ENDS — no finisher, no clock, no score. Sunday's old mini-WOD column is
// 'wod', opt-in and audited as optional alongside Open Up and The Long Way.
// The audited week must prove every volume target WITHOUT the optional
// Sunday work — that is what makes the rest day real instead of polite.
export const WEEK_PLAN = [
  /* Sun */ [
    { type: 'rehab', session: 'sunday' },
    { type: 'rehab', session: 'wod' },
    { type: 'rehab', session: 'open-up' },
    { type: 'rehab', session: 'engine' },
  ],
  /* Mon */ [{ type: 'lift', session: 'd40-a1' }],
  /* Tue */ [{ type: 'rehab' }],
  /* Wed */ [{ type: 'lift', session: 'd40-b1' }],
  /* Thu */ [{ type: 'rehab' }],
  /* Fri */ [{ type: 'lift', session: 'd40-c1' }],
  /* Sat */ [{ type: 'rehab' }],
];
