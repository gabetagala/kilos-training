# The Daily — KILOS' public program (spec)

*Working name. The default guided program every non-Gabe user lands in.
Decided 2026-08-17: this is a SEPARATE artifact from Gabe's Program — it
reuses the EMOM/step engine (timers, demos, voice, auto-log, crash-safety)
but shares zero content with it. Gabe's Program stays his, owner-only,
untouched.*

## Doctrine (what "simple" means, enforced)

1. **One decision per session: press start.** All choices (duration,
   equipment) live on the Start Card, sticky, never asked mid-session.
2. **A session is always available.** No calendar, no rest-day prescriptions,
   no missed-day state. Show up → next session in the rotation. Daily
   attendance is safe because emphasis rotates (see structure).
3. **No rehab content, no back-friendly variants, no injury programming.**
   That's Gabe's program's domain, not the public product's.
4. **Plain names.** "Squat", "Press", "Row" — no percentages, no RPE, no
   tempo notation, no jargon.
5. **Never auto-swap.** Same duration × equipment = same movements every
   time. The only change session-to-session is A→B→C and small progression.
6. **Hard caps:** 5 stations per session, 3 sessions in the rotation,
   4 equipment tiers, 3 durations. The program never grows past this.

## Structure

**Rotation:** Session A → B → C → A…, advancing on completion, not on the
calendar. Train 2×/week or 7×/week — same program, different speed.

- **A — squat-led** full body
- **B — press/pull-led** full body
- **C — hinge-led** full body

**Session shape:** ~4-min guided warm-up flow (generic, designed for this
program) + EMOM circuit of 5 stations, 1 minute each. Work ~40s, rest the
remainder, next station on screen, set logs itself when the minute expires.

**Duration = round count** (working math, verify against engine at build):

| Pick | Warm-up | Rounds | Total |
|---|---|---|---|
| 20 | 4' | 3 | ~19' |
| 30 | 4' | 5 | ~29' |
| 40 | 4' | 7 | ~39' |

Framing in copy: **"40 is the plan; 20 keeps the streak."** Shorter picks
drop rounds only — never introduce unfamiliar movements.

## Movement table (slot × tier)

Tiers map onto `EQUIPMENT_TIERS` / `resolveExercise` in
`src/personalization.js` at build time. Every slot preserves the movement
pattern across tiers.

### Session A — squat-led

| Slot | Full Gym | Home Rack | Dumbbells | Bodyweight |
|---|---|---|---|---|
| Squat (main) | Back squat | Back squat | Goblet squat | Split squat *(ladder)* |
| Push | Bench press | Bench/floor press | DB floor press | Push-up *(ladder)* |
| Pull | Seated row | Barbell row | One-arm DB row | Table row *(ladder)* |
| Hinge (light) | Romanian deadlift | Romanian deadlift | DB RDL | Glute bridge *(ladder)* |
| Core/carry | Farmer carry | Suitcase carry | Suitcase carry | Dead bug |

### Session B — press/pull-led

| Slot | Full Gym | Home Rack | Dumbbells | Bodyweight |
|---|---|---|---|---|
| Press (main) | Overhead press | Overhead press | DB overhead press | Pike push-up *(ladder)* |
| Pull (main) | Lat pulldown | Chin-up (rack bar) | Renegade row | Inverted row *(ladder)* |
| Squat (light) | Goblet squat | Goblet squat | Reverse lunge | Reverse lunge |
| Push | Incline DB press | Close-grip press | Incline/floor press | Decline push-up *(ladder)* |
| Core | Hanging knee raise | Hanging knee raise | Weighted dead bug | Hollow hold |

### Session C — hinge-led

| Slot | Full Gym | Home Rack | Dumbbells | Bodyweight |
|---|---|---|---|---|
| Hinge (main) | Deadlift | Deadlift | Heavy DB RDL | Single-leg hinge *(ladder)* |
| Pull | Barbell row | Barbell row | Chest-supported row | Towel row *(ladder)* |
| Push | Dip / machine press | Floor press | DB bench/floor press | Push-up *(ladder)* |
| Squat (light) | Step-up | Step-up | DB step-up | Step-up |
| Core/carry | Farmer carry | Farmer carry | Farmer carry | Side plank |

## Progression (one rule everywhere)

**Double progression:** work in a rep window per slot (main lifts 6–10,
accessories 8–12, EMOM-sustainable). Hit the top of the window every round →
next session offers **+2.5 kg upper / +5 kg lower** (DB tier: next available
bell). One-tap accept, prefilled from last session.

**Bodyweight tier progresses by ladder, not load** — e.g. push-up: incline →
knees → full → feet-up → archer. Hit the rep ceiling → next rung offered,
same one-tap accept. Ladders are fixed and visible so users see the path.

Carries/holds progress by time (+5s) then load.

## Out of scope for v1 (on purpose)

- Finishers (Gabe's rotation is his; a simple optional public finisher can
  come later).
- Back-friendly / injury toggles. Cut 2026-08-17 — not the public product's
  job.
- Any AI/adaptive programming, exercise rotation, or percentage math.
- More sessions, more tiers, more durations (the caps above are the spec).

## Open items

- [ ] Confirm the name ("The Daily" vs alternatives).
- [ ] Verify round math against the real engine shape in
      `src/workout/program.js` / `stepEngine.js`.
- [ ] Map spec tiers onto the existing `EQUIPMENT_TIERS` checklist items
      (Custom checklist resolves to nearest tier, floor = Bodyweight).
- [ ] Rep windows per slot sanity-checked at EMOM pacing (40s work cap).
- [ ] Demo art / voice cues for any movement not already in `EXERCISES_DB`.
