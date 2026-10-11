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
    cue: 'One DB off the bench, never the floor. Tall, level hips — don’t lean toward it or away.',
    why: 'Walking side plank — obliques, grip, posture.',
    yt: 'suitcase carry form',
    how: 'Walk tall for the clock, one hand then the other. Set the DB down the moment you lean.',
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
    how: 'Steady, even steps to the beep — no counting, no rush. Swap the lead leg at halfway.',
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
    cue: 'Collars on, brace before you descend. Down only until just before your pelvis tucks — pins set there. Crisp speed; a grinding rep ends the set.',
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
    cue: 'Rear foot on the box, DBs at sides. Ribs down, squeeze the back glute.',
    why: 'Single-leg strength — quads and glutes, one side at a time.',
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
    cue: 'Kneel tall beside the bench, forearms flat on it, wrists off the edge, palms up. Full roll, slow.',
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
    why: 'Upper chest with no load on the spine.',
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
    cue: 'Both DBs, picked up off the bench — never the floor. Tall posture; set them down the moment it degrades.',
    why: 'Grip, traps, engine — the athletic finisher.',
    how: 'Walk tall for the clock. DBs off the bench — set them down the moment your posture slips.',
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
    cue: 'Dead-hang stretch every rep, zero swing. Log the reps — own every 8 before the pack goes on.',
    why: 'The earn-it step before weighted — same lats, same grip.',
    yt: 'strict pull up form',
  },
  // ── The 2026-10-10 rework (coach + physio QA) ─────────────────────────────
  'db-calf-raise': {
    repTempo: [
      ['UP', 1],
      ['HOLD', 1],
      ['DOWN', 2],
    ],
    name: 'DB Calf Raise',
    feel: 'Calves, all the way up and all the way down',
    avoid: 'Bouncing out of the bottom',
    cue: 'Box flush against the rack, ball of one foot on the edge, DB in that hand, other hand on the rack. All the way up, sink into the stretch, pause.',
    why: 'Calves — two minutes, no load on the spine.',
    yt: 'dumbbell calf raise off step',
  },
  // his hamstring curl (2026-10-10: no sliders at home) — standing, ankle
  // strap on the pulley, one leg at a time. Spine-quiet, loadable, reps-first.
  'cable-leg-curl': {
    repTempo: [
      ['CURL', 1],
      ['DOWN', 2],
    ],
    name: 'Cable Leg Curl',
    pulley: true,
    feel: 'The back of the thigh pulling the heel to the glute',
    avoid: 'Hips swinging forward, or leaning on the rack',
    cue: 'Ankle strap on the low pulley, face the stack, hands on the rack, knees side by side. Curl the heel to the glute, slow down.',
    why: 'Hamstrings through knee bend — what the RDL can’t give, with zero load on the spine.',
    yt: 'standing cable leg curl ankle strap',
  },
  'slider-leg-curl': {
    repTempo: [
      ['OUT', 3],
      ['IN', 1],
    ],
    name: 'Slider Leg Curl',
    feel: 'The backs of the thighs pulling the heels in',
    avoid: 'Hips dropping, or the low back arching',
    logReps: true,
    cue: 'On your back, heels on sliders (or a towel on a smooth floor), hips up — glutes squeezed, ribs down. Slide out slowly, pull back in. Can’t pull back yet? Lower the hips and reset.',
    scale:
      'Easier: slide out only, drop the hips, reset · Harder: both legs → one leg out, two back → single leg',
    why: 'Hamstrings through the knee, spine flat on the floor.',
    yt: 'slider hamstring curl',
  },
  'lying-db-extension': {
    repTempo: [
      ['DOWN', 2],
      ['UP', 1],
    ],
    name: 'Lying DB Triceps Extension',
    feel: 'The back of the arm stretching, then locking out',
    avoid: 'Elbows flaring out wide',
    cue: 'Sit with the DBs on your thighs, roll back onto the bench, arms up. Bend only at the elbow, lower beside your head, press back up.',
    why: 'Long-head triceps at full stretch, lying flat.',
    yt: 'lying dumbbell triceps extension',
  },
  'incline-y-raise': {
    repTempo: [
      ['UP', 1],
      ['HOLD', 1],
      ['DOWN', 2],
    ],
    name: 'Incline Y-Raise',
    feel: 'Low traps and rear delts, between the shoulder blades',
    avoid: 'Shrugging, or lifting the chest off the bench',
    cue: 'Chest on the incline bench, light DBs, thumbs up. Raise into a Y, squeeze, lower slow.',
    why: 'An upper back that holds a baby without slumping.',
    yt: 'incline dumbbell y raise',
  },
  // ── Rings (2026-10-09, his new kit — hung at a FIXED height, dip height) ──
  // Both are spine-quiet: the dip is supported upright, the row is a plank
  // that pulls. The dip's failure mode is the SHOULDER, not the back, so it is
  // OPEN_PACE_BANNED all the same: every dip stays strict.
  'ring-dip': {
    logReps: true,
    repTempo: [
      ['DOWN', 3],
      ['UP', 1],
    ],
    name: 'Ring Dip',
    feel: 'Chest and triceps',
    avoid: 'Shoulders rolling forward',
    cue: 'Rings tight to your sides, three seconds down until your upper arms are level with the floor. Stop at the first rep you can’t control.',
    why: 'Chest and triceps — the rings make every rep earn its stability.',
    yt: 'strict ring dip form',
  },
  'ring-row': {
    repTempo: [
      ['UP', 1],
      ['DOWN', 2],
    ],
    logReps: true,
    name: 'Ring Row',
    feel: 'Upper back, blades squeezing',
    avoid: 'Hips sagging',
    cue: 'Body one straight line, pull the rings to your ribs, lower slow. Walk the feet forward to make it harder.',
    why: 'Upper-back thickness with the spine braced like a plank and nothing loading it.',
    yt: 'ring row form',
  },
  'db-split-squat': {
    repTempo: [
      ['DOWN', 2],
      ['UP', 1],
    ],
    name: 'Heavy DB Split Squat',
    feel: 'Front-leg quad + glute under load',
    avoid: 'The knee caving inward',
    cue: 'DBs at sides, right leg first. Torso tall, knee tracks the toes.',
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
  // Tuesday's loadable chest (round-3 coach QA): the push-ups had no
  // overload path, and a flat bench keeps the stretch the floor press cuts off
  'db-bench-press': {
    repTempo: [
      ['DOWN', 2],
      ['UP', 1],
    ],
    name: 'DB Bench Press',
    feel: 'Chest stretching at the bottom, squeezing at the top',
    avoid: 'Bouncing out of the bottom, elbows flared wide',
    cue: 'Sit with the DBs on your thighs, roll back, feet planted, ribs down. Lower to a deep stretch, press up and in. Done: DBs back to the thighs and sit up.',
    why: 'Chest size — the full stretch, loaded, with the back on the bench.',
    yt: 'dumbbell bench press form',
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
    repTempo: [
      ['DOWN', 2],
      ['UP', 1],
    ],
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
    why: 'The hang clean carve-out, same terms as the hang snatch: above the knee, light DBs, forced-rest clocks only — never a barbell, never from the floor, never open pace.',
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
  // Saturday's sprints (2026-10-10, his ask: "conditioning — weekly sprints")
  sprint: {
    name: 'Sprint',
    feel: 'Fast and tall — hips driving, arms pumping',
    avoid: 'Straining at the start, or leaning back to slow down',
    cue: 'Flat ground. Ease off after — never brake hard.',
    why: 'Top speed — the athletic quality nothing else in the week trains, on a straight, upright spine.',
    how: 'Fast but smooth at the effort the note gives — never a lunge for the line. Walk back; the next one starts on the clock.',
    scale:
      'No room to run? High knees in place for the same seconds. Easier: 80% for the whole phase.',
    yt: 'sprint technique acceleration',
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
const ANCHOR = (
  specs,
  { warmupRounds = 1, intervalSecs = 180, sets = 4 } = {},
) => ({
  rotate: specs.map(({ alts, intervalSecs: own, pair, ...m }) => {
    const iv = own ?? intervalSecs;
    return {
      mode: 'emom',
      name: 'The Anchor',
      // "E2:30" for a two-and-a-half-minute clock — "E2.5M" read like a typo
      formatLabel:
        iv % 60
          ? `E${Math.floor(iv / 60)}:${String(iv % 60).padStart(2, '0')}`
          : `E${iv / 60}M`,
      intervalSecs: iv,
      anchor: true,
      warmupRounds,
      rounds: warmupRounds + sets,
      // loading the bar / setting the bench before the first set
      changeoverSecs: 60,
      // block-level, so an alt swap of the lift never drops it
      ...(pair ? { pair } : {}),
      members: [{ ...m, alts }],
    };
  }),
});

// What an amber morning's glute bridge says, wherever it stands in for a hinge
// or a split squat.
const BRIDGE_NOTE =
  'Ribs down, squeeze 2 s at the top — glutes, not the low back.';

// The hinge. Monday only (2026-10-10), never on the squat day, always a flat 8 — its dose is symptom-gated, never descended or maxed out.
const HINGE = (note) => ({
  ex: 'rdl',
  reps: '8',
  fixedReps: true,
  // the effort this hinge asks for — more in reserve than the accessories
  effort: '2–3 LEFT',
  note,
  // an amber morning bridges instead of hinging
  amberEx: 'glute-bridge',
  amberReps: '12',
  amberNote: BRIDGE_NOTE,
  // THE MORNING RULE reaches the lift day (round-3 physio QA): a loaded
  // hinge in the first waking hour is the week's riskiest bend — "up under
  // 1 hr" bridges instead, the same swap an amber morning makes
  morning: true,
});
// Its unlogged ramp: one easy set before the first working set (2026-10-10,
// physio QA — "set 1 at working weight inside a superset" had no ramp at all).
const HINGE_RAMP = {
  mode: 'ramp',
  amberDrop: true, // an amber morning has no RDL to ramp into
  morning: true, // …nor does an early one
  changeoverSecs: 45,
  ex: 'rdl',
  note: 'One easy set of 5 at about half your working weight — groove the hinge. Not logged.',
};

// ── The three days ──────────────────────────────────────────────────────────
// REWORKED 2026-10-10 after two independent reviews (S&C coach + spine
// physio). The shape:
//
//   Mon  warm-up → pull-up anchor → (RDL ramp) Hinge & Calf → Wings
//   Wed  warm-up → Power (broad jump + push press) → front squat anchor →
//        Split Squat & Curl → Tabata
//   Fri  warm-up → Jumps → incline press anchor → Dip, Pull, Curl →
//        Legs & Back
// (round 2, after the final independent QA: one RDL a week — Monday, fresh,
// on its own load rule; Friday's hinge became hamstring curls; no second
// front-rack exercise on squat day; real jumps on Friday.)
//
// THE ANCHORS ARE FIXED (coach QA, critical): a lift that comes round once a
// month can't progress — the front squat got three sessions a block. Each day
// now owns one lift for all 12 weeks; variety lives in the accessories'
// delivery and the finishers. This reverses his 2026-08-10 "every slot
// rotates" call, deliberately, with the reviews' reasoning.
//
// ISOLATION MOVED TO THE BACK & HIPS DAYS (rehab.js pumps, Tue/Thu): curls,
// triceps, extra laterals, rows and calves — spine-quiet real sets that buy the
// lift days their minutes. Lift days carry compounds, legs and power.
//
// SINGLE NUMBERS, STEPPED BY THE APP (his rule): `weekReps` steps the
// bodyweight anchors week by week; isolation progresses reps-first in the
// player (progression.js). Week 1 always runs plain SETS.
//
// EVERY DAY OPENS WITH ITS OWN WARM-UP: heat, cat-camel, then the brace (bird
// dog) and whatever the day loads first — the empty bar on squat day.

// A warm-up move: timed, unlogged, never a set.
const WARM = (ex, secs, note, phase = 'GO') => ({
  ex,
  secs,
  phase,
  note,
  logWeight: false,
  countsAsSet: false,
});
const WARMUP = (name, members) => ({
  mode: 'circuit',
  name,
  warmup: true,
  rounds: 1,
  betweenSecs: 5,
  members,
});
const CAT_CAMEL = WARM(
  'cat-camel',
  40,
  'Six slow cycles — round, then arch, in an easy range; never push either end. Breathe with it.',
  'BREATHE',
);
const BIRD_DOG_WARM = WARM(
  'bird-dog',
  40,
  'Alternate sides, five-second holds, hips level — switch the brace on before anything loads.',
  'HOLD',
);

// ── THE WARM-UPS ROTATE (2026-10-10, round 3 — his "constantly varied" ask) ──
// Four per lift day, one per week (variant = week − 1), the same job each
// time: a pulse raiser, the cat-camel (the back's daily primer stays), a
// day-specific prep, and the last move grooves the day's first pattern —
// the hang and the hinge Monday, the squat and the springs Wednesday, the
// springs and the shoulders Friday. Regular movements, plain names, every
// one already in the app. Pogo hops are `ballistic` (amber/short/tired drop
// them); the empty-bar squat swaps to a box squat on an amber morning.
const PULSE = {
  jacks: WARM('jumping-jack', 40, 'Easy pace — warm, not winded.'),
  knees: WARM('high-knees', 40, 'Easy pace — warm, not winded.'),
};
const POGO = {
  ...WARM(
    'pogo-hop',
    20,
    'Easy bounces, then two easy broad jumps — warm the springs before the max ones.',
    'BOUNCE',
  ),
  ballistic: true,
};
const BAR_SQUAT = {
  ...WARM(
    'front-squat',
    40,
    'Empty bar, five easy reps — elbows high, groove the pattern.',
  ),
  amberEx: 'box-squat',
  amberNote: 'Bodyweight to the box, five slow reps — groove it.',
};
const GLUTE_BRIDGE_WARM = WARM(
  'glute-bridge',
  40,
  'Ten slow bridges, a squeeze at the top — glutes on before anything hinges.',
);
const DEAD_HANG_WARM = WARM(
  'dead-hang',
  30,
  'Relaxed hang, then pull the shoulders down for the last ten seconds.',
  'HOLD',
);
const PULL_APART_WARM = WARM(
  'band-pull-apart',
  30,
  'Light band, easy reps — wake the upper back up.',
);
const MON_WARMUPS = [
  WARMUP('Warm-Up', [PULSE.jacks, CAT_CAMEL, BIRD_DOG_WARM, PULL_APART_WARM]),
  WARMUP('Warm-Up', [
    PULSE.knees,
    CAT_CAMEL,
    GLUTE_BRIDGE_WARM,
    DEAD_HANG_WARM,
  ]),
  WARMUP('Warm-Up', [
    PULSE.jacks,
    CAT_CAMEL,
    WARM(
      'ring-row',
      30,
      'Easy ring rows, squeeze the shoulder blades together.',
    ),
    GLUTE_BRIDGE_WARM,
  ]),
  WARMUP('Warm-Up', [PULSE.knees, CAT_CAMEL, BIRD_DOG_WARM, DEAD_HANG_WARM]),
];
const WED_WARMUPS = [
  WARMUP('Warm-Up', [PULSE.knees, CAT_CAMEL, BIRD_DOG_WARM, BAR_SQUAT, POGO]),
  WARMUP('Warm-Up', [
    PULSE.jacks,
    CAT_CAMEL,
    GLUTE_BRIDGE_WARM,
    BAR_SQUAT,
    POGO,
  ]),
  WARMUP('Warm-Up', [
    PULSE.knees,
    CAT_CAMEL,
    WARM(
      'hip-internal-rotation',
      40,
      'Five slow reps a side — hips loose before they squat.',
    ),
    BAR_SQUAT,
    POGO,
  ]),
  WARMUP('Warm-Up', [
    PULSE.jacks,
    CAT_CAMEL,
    WARM('side-plank', 30, 'Fifteen seconds a side, hips high.', 'HOLD'),
    BAR_SQUAT,
    POGO,
  ]),
];
// Friday ends every warm-up on the springs (the jumps come next) and preps the
// shoulders the press and the dips are about to load
const FRI_WARMUPS = [
  WARMUP('Warm-Up', [PULSE.jacks, CAT_CAMEL, PULL_APART_WARM, POGO]),
  WARMUP('Warm-Up', [
    PULSE.knees,
    CAT_CAMEL,
    WARM('push-up', 30, 'Eight easy push-ups — shoulders warm for the press.'),
    POGO,
  ]),
  WARMUP('Warm-Up', [
    PULSE.jacks,
    CAT_CAMEL,
    WARM(
      'band-lateral-raise',
      30,
      'Light band, easy reps — wake the delts up.',
    ),
    POGO,
  ]),
  WARMUP('Warm-Up', [PULSE.knees, CAT_CAMEL, DEAD_HANG_WARM, POGO]),
];

// A superset / giant set: members back to back, then the rest on the timer.
// `isPiece` is the slot's identity for the ramp, the short and amber days.
// Every block that changes station costs real time — `changeoverSecs` is the
// walk, the re-plate, the re-pin, counted honestly in the estimate.
const SET = (name, rounds, members, opts = {}) => ({
  mode: 'circuit',
  name,
  isPiece: true,
  rounds,
  betweenSecs: 10,
  restSecs: 60,
  formatLabel: 'SETS',
  changeoverSecs: 45,
  ...opts,
  members,
});

// Wednesday's metcon pool (see the session): one per week, rotating.
const WED_METCONS = [
  {
    mode: 'amrap',
    name: 'Seven',
    capSecs: 7 * 60,
    note: 'As many rounds as you can in seven minutes — smooth beats fast. Score = rounds.',
    members: [
      { ex: 'band-pull-apart', reps: '10', logWeight: false },
      { ex: 'push-up', reps: '8', logWeight: false },
      { ex: 'box-step-up', reps: '12', logWeight: false },
    ],
  },
  {
    mode: 'emom',
    name: 'Every Minute',
    formatLabel: 'EMOM',
    rounds: 4,
    note: 'Odd minutes step-ups, even minutes push-ups — rest what’s left of each minute.',
    members: [
      { ex: 'box-step-up', reps: '14', logWeight: false },
      { ex: 'push-up', reps: '10', logWeight: false },
    ],
  },
  {
    mode: 'fortime',
    name: 'Ladder Down',
    note: 'Three rounds, each smaller than the last — it only gets easier. Score = time.',
    members: [
      { ex: 'jumping-jack', repScheme: [30, 20, 10], logWeight: false },
      { ex: 'box-step-up', repScheme: [16, 12, 8], logWeight: false },
      { ex: 'push-up', repScheme: [12, 8, 4], logWeight: false },
    ],
  },
  {
    mode: 'tabata',
    name: 'Tabata: Jumping Jacks',
    ex: 'jumping-jack',
    note: 'Eight rounds of twenty seconds all-out, ten off. Score = your worst round.',
  },
];

export const DENSITY40_SESSIONS = [
  {
    id: 'd40-a1',
    name: 'Full Body I',
    freq: 'Mon · pull anchor',
    blurb:
      'Pull day. Strict pull-ups on a two-minute clock, the week’s one heavy hinge with calf raises while you’re fresh, then lats and delts on real rest.',
    blocks: [
      // a different warm-up each week, same job (round 3, his ask)
      { rotate: MON_WARMUPS },
      ANCHOR(
        [
          {
            ex: 'pull-up-bw',
            reps: '5',
            intervalSecs: 120, // bodyweight and decompressive — 90s rest is plenty
            // the ladder: a rep every two weeks, then an earned pack from week 9
            weekReps: [
              '5',
              '5',
              '6',
              '6',
              '7',
              '7',
              '8',
              '8',
              '5',
              '6',
              '7',
              '8',
            ],
            // the pack is EARNED (round-3 coach QA): only if every 8 was
            // owned in week 8 — and its kilos are logged after the session
            weekNotes: {
              9: 'Owned every 8 in week 8? Pack on, 2.5 kg, back to 5. If not, bodyweight — chase 8s.',
              10: 'Pack on if you earned it — or bodyweight, chasing 8s.',
              11: 'Pack on if you earned it — or bodyweight, chasing 8s.',
              12: 'Pack on if you earned it — or bodyweight, chasing 8s.',
            },
            note: 'Strict, dead-hang, zero swing. Stop two short of failure and log every rep you did — next week asks for one more.',
            // 10, not 12: twelve strict reps would outrun the 40 s before the
            // laterals start (round-6 coach QA) — past 10 the pack takes over
            ladderCap: 10,
            alts: [{ ex: 'lat-pulldown', reps: '8' }],
            // the side delts ride the rest (round 3): set, laterals, breathe
            pair: {
              ex: 'db-lateral-raise',
              reps: '12',
              at: 40,
              note: 'Right after the pull-ups. Strict, a beat at the top — then rest.',
            },
          },
        ],
        // five working sets: the lats' floor with Wings at three rounds
        { warmupRounds: 0, sets: 5 },
      ),
      // THE ONE HINGE DAY (2026-10-10, both final reviews): the RDL comes
      // before the shoulder work — fresh grip, fresh back — and it is the
      // week's only RDL. Its load moves on its own rule (main.js): only on a
      // Good morning, only with ≥2 reps left last time, at most every other
      // week. On an amber morning it becomes a glute bridge.
      HINGE_RAMP,
      SET(
        'Hinge & Calf',
        3,
        [
          HINGE('Never a grind — the load moves only when the app says so.'),
          {
            ex: 'db-calf-raise',
            reps: '10/leg',
            note: 'One leg at a time, the DB in the same-side hand.',
          },
        ],
        // 75 s of rest keeps the RDL ≥2:30 apart, start to start
        {
          betweenSecs: 20,
          restSecs: 75,
          formats: ['sets', 'sets-heavy', 'sets-repout'],
          formatOffset: 1,
        },
      ),
      SET(
        'Wings',
        // four rounds again (2026-10-11, the 45-minute cap): chest, upper
        // back and rear delts get headroom above their floors
        4,
        [
          // the row lives here now and the pulldown moved to Friday (round-6
          // coach QA): Monday carried 8 of the week's 11 lat sets
          {
            ex: 'chest-supported-row',
            reps: '10',
            alts: [{ ex: 'ring-row', reps: '10' }],
          },
          // feet up from week 1 (round-4 coach QA: floor push-ups are too far
          // from failure for a man with strict ring dips to count as chest)
          {
            ex: 'elevated-pushup',
            reps: '12',
            logWeight: false,
            note: 'Twelve smooth? Wear the backpack.',
          },
          {
            ex: 'band-pull-apart',
            reps: '15',
            logWeight: false,
            note: 'When the last rep is smooth, shorten your grip a hand-width — the band is the load knob.',
          },
        ],
        // hypertrophy work is never rushed: no FOR TIME here (coach QA)
        { formats: ['sets', 'sets-heavy', 'sets-repout'] },
      ),
    ],
  },
  {
    id: 'd40-b1',
    name: 'Full Body II',
    freq: 'Wed · squat anchor',
    blurb:
      'Leg and power day. Max broad jumps and push presses while you’re fresh, the front squat, split squats with cable leg curls — then a short metcon that changes every week.',
    blocks: [
      // a different warm-up each week, same job (round 3, his ask)
      { rotate: WED_WARMUPS },
      // POWER BEFORE THE SQUAT (both reviews): fresh legs, low reps, real rest —
      // the one loaded ballistic all block, the same lift every week so it can
      // become a skill. Best jump is logged after the session and charted.
      {
        mode: 'emom',
        name: 'Power',
        isPiece: true,
        ballistic: true,
        rounds: 3,
        changeoverSecs: 30,
        members: [
          {
            ex: 'broad-jump',
            reps: '3',
            logWeight: false,
            fixedReps: true,
            note: 'Near-max, stick every landing. Remember your best — the app asks after. Weeks 1–2 at about 80%.',
          },
          {
            ex: 'db-push-press',
            reps: '4',
            fixedReps: true,
            note: 'Ribs down, short dip from the knees, punch it up. No lay-back.',
          },
        ],
      },
      ANCHOR([
        {
          ex: 'front-squat',
          reps: '5',
          // 2:30 still clears the rest floor: a ~20 s set leaves 2:10
          intervalSecs: 150,
          note: '2–4 reps left in the tank, every set. A grinding rep ends the set.',
          warmupNote:
            'Build round: ~50% ×5, then ~70% ×3 — working weight next round.',
          // a stiff-back morning swaps to the split squat: the front rack
          // also loads a sore mid-back
          amberEx: 'db-split-squat',
          amberReps: '6/leg',
          amberNote:
            'DBs at your sides, an easy weight, 3–4 reps left. Any back pull ends the set.',
          alts: [{ ex: 'db-split-squat', reps: '6/leg' }],
        },
      ]),
      // DBs AT THE SIDES (physio QA): the front squat already holds a rack —
      // a second front-rack exercise loads the same sore mid-back twice
      SET(
        'Split Squat & Curl',
        3,
        [
          {
            ex: 'db-split-squat',
            reps: '8/leg',
            amberEx: 'glute-bridge',
            amberReps: '12',
            amberNote: BRIDGE_NOTE,
          },
          // the cable leg curl (no sliders at home, 2026-10-10)
          // 10 a leg — reps-first climbs it to 13 before the stack moves
          { ex: 'cable-leg-curl', reps: '10/leg' },
        ],
        {
          betweenSecs: 15,
          restSecs: 75,
          formats: ['sets', 'sets-heavy', 'sets-repout'],
          formatOffset: 2,
        },
      ),
      // THE METCON (2026-10-11, his ask: "are we missing metcons?" — the
      // week's only required one was a 4-minute Tabata). A rotating 4–8
      // minute piece closes the leg day, CrossFit-style: AMRAP, EMOM, a
      // descending for-time, a Tabata — a different format every week.
      // Regular movements only, nothing loaded on the spine, nothing that
      // flexes it under fatigue (push-ups end at the first hip sag, step-ups
      // stay upright). Saturday's sprints never share a movement with it.
      { finisher: true, conditioning: true, rotate: WED_METCONS },
    ],
  },
  {
    id: 'd40-c1',
    name: 'Full Body III',
    freq: 'Fri · press anchor',
    blurb:
      'Press day. Jumps and bounds, the incline press with laterals in its rest, ring dips, pull-ups and cable leg curls while fresh, then split squats and pulldowns. No hinge today — Monday has it.',
    blocks: [
      // a different warm-up each week, same job (round 3, his ask)
      { rotate: FRI_WARMUPS },
      // JUMPS (coach QA: "athleticism is one block a week"): max-intent broad
      // jumps and the program's only side-to-side power — unloaded, forced
      // rest, stopped while still springy.
      {
        mode: 'emom',
        name: 'Jumps',
        isPiece: true,
        ballistic: true,
        prime: true, // a short day spends these minutes first
        // three rounds on a 45 s clock (round-3 plan QA): +50% contacts in
        // the same minutes, and each movement still gets 90 s to its next set
        rounds: 3,
        intervalSecs: 45,
        changeoverSecs: 20,
        members: [
          {
            ex: 'broad-jump',
            reps: '3',
            // the contacts grow by phase (round-4 coach QA), the clock doesn't
            phaseReps: { 3: '4' },
            logWeight: false,
            fixedReps: true,
            note: 'Near-max, stick every landing. Weeks 1–2 at about 80% — learn the landing first.',
          },
          {
            ex: 'skater-bound',
            reps: '3/side',
            phaseReps: { 2: '4/side', 3: '4/side' },
            logWeight: false,
            fixedReps: true,
            note: 'Bound sideways, stick each landing on one leg for a beat.',
          },
        ],
      },
      ANCHOR(
        [
          {
            ex: 'incline-db-press',
            reps: '8',
            intervalSecs: 150,
            warmupNote:
              'Build round: ~50% ×8, then ~75% ×3 — working weight next round.',
            alts: [
              { ex: 'db-floor-press', reps: '8' },
              { ex: 'floor-press', reps: '6' },
            ],
            // the side delts ride the press's rest (round 3) — the cable
            // lateral left Legs & Back for it, two minutes back on Friday
            pair: {
              ex: 'db-lateral-raise',
              reps: '12',
              at: 50,
              note: 'Right after the press. Strict, a beat at the top — then rest.',
            },
          },
        ],
        { sets: 3 },
      ),
      // DIPS WHILE FRESH (round-3 QA): his named priority, a 5–8 rep skill
      // lift — it can't come after 30 minutes of work
      SET(
        'Dips, Pull-Ups & Curls',
        3,
        [
          {
            ex: 'ring-dip',
            reps: '5',
            weekReps: [
              '5',
              '5',
              '6',
              '6',
              '6',
              '7',
              '7',
              '7',
              '8',
              '8',
              '8',
              '8',
            ],
            note: 'Can’t get every rep clean? Do the rest as 3-second lowering-only reps.',
            alts: [{ ex: 'elevated-pushup', reps: '12', logWeight: false }],
          },
          // a rep under Monday's ladder, at bodyweight all block
          {
            ex: 'pull-up-bw',
            reps: '4',
            weekReps: [
              '4',
              '4',
              '5',
              '5',
              '6',
              '6',
              '7',
              '7',
              '7',
              '7',
              '8',
              '8',
            ],
          },
          // the hamstring curl rides here, not in Legs & Back: the ankle strap
          // goes on the pulley once and comes off once, never every round
          {
            ex: 'cable-leg-curl',
            reps: '6/leg',
            // never a max set the day before the sprints (round-6 QA), and a
            // lighter six a leg — Wednesday's tens are the growth set
            fixedReps: true,
          },
        ],
        // 45 s: dips, pull-ups and a leg curl share the load around
        { restSecs: 45, formats: ['sets', 'sets-repout'], formatOffset: 1 },
      ),
      // then the legs — four rounds (2026-10-11, the 45-minute cap): quads
      // and lats off their floors
      SET(
        'Legs & Back',
        4,
        [
          {
            ex: 'rfe-split-squat',
            reps: '8/leg',
            note: 'Right leg first — left matches its reps.',
            // amber keeps the legs (round-4 physio QA: split squats are light
            // on the disc) — the rear foot comes off the box, which takes the
            // low-back extension out, and the range shortens
            amberEx: 'db-split-squat',
            amberReps: '8/leg',
            amberNote:
              'Both feet on the floor, a shorter range, 3–4 reps left. Any back pull ends the set.',
            alts: [{ ex: 'db-split-squat', reps: '8/leg' }],
          },
          { ex: 'lat-pulldown', reps: '10' },
        ],
        // 20 s: the split-squat DBs go down, the pulldown bar goes on
        { betweenSecs: 20, formats: ['sets', 'sets-heavy', 'sets-repout'] },
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
