import { describe, expect, it } from 'vitest';
import {
  blockDetail,
  blockForDay,
  blockWorkSecs,
  dayNumber,
  daysToGo,
  estimateMins,
  getMovement,
  getSession,
  hasKneeSwap,
  HOTMUM_EXERCISES,
  HOTMUM_SESSIONS,
  kneeEasy,
  loadLabel,
  MOVEMENTS,
  PARTS,
  playable,
  progress,
  SEASON,
  sessionForToday,
  sessionParts,
  setTotal,
  timeUnderTension,
  WEEK,
} from '../../src/hotmum/program.js';
import { HOTMUM_DEMOS } from '../../src/hotmum/demos.js';
import {
  buildStepQueue,
  estimateSessionMins,
  nextWorkLabel,
  sessionOverview,
  tempoStateAt,
} from '../../src/hotmum/engine.js';
import {
  countdownTone,
  NUM_SLUGS,
  SEC_SLUGS,
  setAnnounce,
} from '../../src/hotmum/cues.js';
import {
  DEFAULTS,
  formatLoad,
  greeting,
  lbToKg,
  subGreeting,
} from '../../src/hotmum/profile.js';

const allBlocks = HOTMUM_SESSIONS.flatMap((s) => s.blocks);

describe('program data', () => {
  it('is the three days from her plan, on the right weekdays', () => {
    expect(HOTMUM_SESSIONS.map((s) => s.id)).toEqual(['lower', 'upper', 'full']);
    expect(HOTMUM_SESSIONS.map((s) => s.day)).toEqual(['MON', 'WED', 'FRI']);
  });

  it('every block references a known exercise', () => {
    for (const b of allBlocks) {
      expect(HOTMUM_EXERCISES[b.ex], `exercise ${b.ex}`).toBeTruthy();
    }
  });

  it('every exercise carries the coaching copy the player renders', () => {
    for (const [id, ex] of Object.entries(HOTMUM_EXERCISES)) {
      for (const field of ['name', 'feel', 'avoid', 'cue', 'why']) {
        expect(ex[field], `${id}.${field}`).toBeTruthy();
      }
    }
  });

  it('every block declares which part of the session it belongs to', () => {
    for (const b of allBlocks) expect(PARTS, `${b.ex} part`).toContain(b.part);
  });

  it('every session names its parts, in order, with nothing orphaned', () => {
    for (const s of HOTMUM_SESSIONS) {
      const parts = sessionParts(s);
      // Wednesday has no CORE part — her 25:00–30:00 block IS the core.
      expect(parts.map((p) => p.key), s.id).toEqual(
        s.id === 'upper'
          ? ['warmup', 'main', 'finisher']
          : ['warmup', 'main', 'finisher', 'core'],
      );
      for (const p of parts) expect(p.label, `${s.id}/${p.key}`).toBeTruthy();
      // and they're HER headings, not the raw keys ("WARMUP")
      expect(parts[0].label).toBe('WARM-UP');
      expect(parts.map((p) => p.label)).toContain(
        s.id === 'upper' ? 'ATHLETIC CORE + CARRY' : 'CORE',
      );
      // every block lands in exactly one part
      expect(parts.reduce((n, p) => n + p.blocks.length, 0)).toBe(
        s.blocks.length,
      );
    }
  });

  it('every working set is timed — nothing is left to counting', () => {
    for (const b of allBlocks) {
      expect(['tempo', 'reps', 'hold'], `${b.ex} mode`).toContain(b.mode);
      if (b.mode === 'tempo') expect(b.tempo, `${b.ex} tempo`).toBeTruthy();
      else expect(b.holdSecs, `${b.ex} holdSecs`).toBeGreaterThan(0);
    }
  });

  // A set is now a timed interval with a rep target, not a beat pattern.
  // These are the invariants that replaced the phase-label checks.
  it('every working set states a rep target AND the seconds to do it in', () => {
    for (const b of allBlocks) {
      expect(b.mode, `${b.ex} mode`).toBe('hold');
      expect(b.holdSecs, `${b.ex} holdSecs`).toBeGreaterThan(0);
      // holds (wall sit, carries) have no reps; everything else does
      if (b.reps) {
        expect(b.secsPerRep, `${b.ex} secsPerRep`).toBeGreaterThan(0);
        expect(b.holdSecs, `${b.ex} interval`).toBe(b.reps * b.secsPerRep);
      }
    }
  });

  it('nothing in the program still carries a beat pattern', () => {
    for (const b of allBlocks) expect(b.tempo, `${b.ex}`).toBeUndefined();
    for (const [id, ex] of Object.entries(HOTMUM_EXERCISES)) {
      expect(ex.repTempo, `${id}.repTempo`).toBeUndefined();
    }
  });

  it('describes a block the way the sheet reads it', () => {
    const rdl = getSession('lower').blocks.find((b) => b.ex === 'sl-rdl');
    expect(blockDetail(rdl)).toBe('3 × 6 reps · 30s / side');
    const wall = getSession('lower').blocks.find((b) => b.ex === 'wall-sit');
    expect(blockDetail(wall)).toBe('2 × 30s');
  });

  // Every rep in the program must have a number clip. Before the coach went
  // count-only this failed silently (NUM_SLUGS stopped at ten); now a set
  // with no words in it is the whole bug.
  it('owns a number for every rep of every set', () => {
    const most = Math.max(
      ...allBlocks.filter((b) => b.tempo).map((b) => b.reps),
    );
    expect(NUM_SLUGS.length - 1).toBeGreaterThanOrEqual(most);
    for (const b of allBlocks.filter((x) => x.tempo)) {
      for (let rep = 1; rep <= b.reps; rep++) {
        expect(NUM_SLUGS[rep], `${b.ex} rep ${rep}`).toBeTruthy();
      }
    }
  });

  // The 3-2-1 is a TONE now, on every step rather than only on holds — with
  // no countdown on screen it's the only thing that says a set is ending.
  it('sounds three tones into the end of any timed step', () => {
    expect(countdownTone(3)).toBe(880);
    expect(countdownTone(2)).toBe(880);
    // the last one is higher, so "go" is audibly different from "nearly"
    expect(countdownTone(0.4)).toBe(1180);
    expect(countdownTone(1)).toBe(1180);
    // and nothing outside the window
    expect(countdownTone(4)).toBeNull();
    expect(countdownTone(3.1)).toBeNull();
    expect(countdownTone(0)).toBeNull();
    expect(countdownTone(-2)).toBeNull();
  });

  // Beeping into the end of a 4-second warm-up rep would be a metronome, not
  // a countdown. Every step in the program is long enough to have three
  // seconds that mean something.
  it('every step is long enough for a 3-2-1 to make sense', () => {
    for (const s of HOTMUM_SESSIONS) {
      for (const st of buildStepQueue(s)) {
        if (st.secs == null) continue;
        expect(st.secs, `${st.exId} ${st.kind} is ${st.secs}s`).toBeGreaterThan(
          3,
        );
      }
    }
  });

  it('prescribes pounds, never kilos', () => {
    for (const b of allBlocks) {
      if (!b.load || b.load === 'BW') continue;
      expect(b.load.lb, `${b.ex} load`).toBeGreaterThan(0);
      expect([10, 15, 20], `${b.ex} owns fixed dumbbells`).toContain(b.load.lb);
    }
    expect(loadLabel({ lb: 15, each: true })).toBe('15 lb × 2');
    expect(loadLabel({ lb: 20 })).toBe('20 lb');
    expect(loadLabel('BW')).toBe('Bodyweight');
  });
});

describe('tempo maths — a set is a countdown', () => {
  it('set length = reps × secs-per-rep', () => {
    const rdl = getSession('full').blocks.find((b) => b.ex === 'rdl');
    expect(rdl.secsPerRep).toBe(5);
    expect(rdl.reps).toBe(8);
    expect(rdl.holdSecs).toBe(40);
  });

  it('the per-side blocks cost double — one side at a time', () => {
    const lunge = getSession('lower').blocks.find(
      (b) => b.ex === 'reverse-lunge',
    );
    expect(lunge.perSide).toBe(true);
    // 2 sets × 2 sides × 6 reps × 4s
    expect(blockWorkSecs(lunge)).toBe(96);
  });

  it('holds are counted too', () => {
    const wall = getSession('lower').blocks.find((b) => b.ex === 'wall-sit');
    expect(blockWorkSecs(wall)).toBe(60); // 2 sets × 30s

    // the calf raise appears twice on Friday at different doses — the warm-up
    // single set and the knee finisher. Find by dose, never by exercise alone.
    const blocks = getSession('full').blocks.filter(
      (b) => b.ex === 'calf-raise',
    );
    expect(blocks.map((b) => b.part)).toEqual(['warmup', 'finisher']);
    expect(blockWorkSecs(blocks[0])).toBe(48); // 1 × 16 × 3s
    expect(blockWorkSecs(blocks[1])).toBe(120); // 2 × 12 × 5s
  });
});

describe('one whole session — no cuts', () => {
  // THE THIRTY-MINUTE PROMISE. Her rewritten plan writes the clock into the
  // session — 0:00–5:00 warm-up, 5:00–23:00 strength, 23:00–28:00 knee,
  // 28:00–30:00 core — so a session that runs to forty is not her plan any
  // more. Guarded on every session AND at every point in the season, because
  // the progression blocks add reps and sets.
  //
  // This is also what killed the FULL/SHORT/MINI picker: the three cuts
  // existed because the first draft measured 41–46 minutes. At thirty, SHORT
  // saved eight — a decision standing between her and starting, for no mercy.
  it('every session is about thirty minutes, all season long', () => {
    for (const s of HOTMUM_SESSIONS) {
      for (const b of SEASON.blocks) {
        const mins = estimateMins(playable(progress(s, b.days[0])));
        expect(mins, `${s.id} @ ${b.name}`).toBeGreaterThanOrEqual(26);
        expect(mins, `${s.id} @ ${b.name}`).toBeLessThanOrEqual(32);
      }
    }
  });

  it('counts sets and time-under-tension for the finish card', () => {
    const s = getSession('lower');
    expect(setTotal(s)).toBeGreaterThan(20);
    expect(timeUnderTension(s)).toBeGreaterThan(12 * 60);
  });
});

describe('season — a hundred days, not a streak', () => {
  it('runs a hundred days in five twenty-day blocks', () => {
    expect(SEASON.days).toBe(100);
    expect(SEASON.startDate).toBe('2026-08-24');
    expect(SEASON.blocks.map((b) => b.name)).toEqual([
      'GROOVE',
      'EXTEND',
      'SLOW',
      'LOAD',
      'PEAK',
    ]);
  });

  // The end date is written down (the countdown and the grid both read it) but
  // it is DERIVED — day 1 plus 99. This catches the two drifting apart.
  it('the end date really is day one hundred', () => {
    const start = new Date(`${SEASON.startDate}T00:00:00`);
    const day100 = new Date(start);
    day100.setDate(day100.getDate() + SEASON.days - 1);
    const iso = `${day100.getFullYear()}-${String(day100.getMonth() + 1).padStart(2, '0')}-${String(day100.getDate()).padStart(2, '0')}`;
    expect(iso).toBe(SEASON.endDate);
    expect(dayNumber(SEASON.endDate)).toBe(100);
  });

  // Christmas used to BE the deadline, and the two never lined up (20 Aug to
  // Christmas is 128 days). It's gone, not demoted to a second milestone —
  // ONE finish line is the entire reason the mechanic works, and a stray
  // second date would quietly put it back.
  it('has exactly one finish line and no leftover Christmas', () => {
    expect(SEASON.after).toBeUndefined();
    expect(JSON.stringify(SEASON)).not.toMatch(/christmas|12-25/i);
    expect(SEASON.name).toBe('100 Days of Showing Up');
  });

  it('the blocks tile the season with no gaps and no overlaps', () => {
    for (let day = 1; day <= SEASON.days; day++) {
      const hits = SEASON.blocks.filter(
        (b) => day >= b.days[0] && day <= b.days[1],
      );
      expect(hits.length, `day ${day}`).toBe(1);
    }
  });

  it('counts down to day one hundred and clamps at zero after it', () => {
    expect(daysToGo('2026-08-24')).toBe(99);
    expect(daysToGo('2026-11-30')).toBe(1);
    expect(daysToGo('2027-01-05')).toBe(0);
  });

  it('reports the day number, clamped at both ends', () => {
    expect(dayNumber('2026-08-24')).toBe(1);
    expect(dayNumber('2026-08-25')).toBe(2);
    expect(dayNumber('2026-07-01')).toBe(1); // before the start
    expect(dayNumber('2027-03-01')).toBe(100); // long after the end
  });

  // Her plan is written Monday-to-Sunday, so day 1 has to BE a Monday —
  // otherwise the twenty-day blocks drift across her weeks.
  it('starts on a Monday', () => {
    expect(new Date(`${SEASON.startDate}T00:00:00`).getDay()).toBe(1);
  });

  it('maps a day to its training block', () => {
    expect(blockForDay(1).name).toBe('GROOVE');
    expect(blockForDay(20).name).toBe('GROOVE');
    expect(blockForDay(21).name).toBe('EXTEND');
    expect(blockForDay(100).name).toBe('PEAK');
  });

  it('loads up only where the 15 → 20 lb jump is survivable', () => {
    for (const b of SEASON.blocks.filter((x) => x.loadUp)) {
      expect(b.loadUp).toEqual(['rdl', 'sl-rdl', 'goblet-squat', 'sumo-squat']);
      // never on the single-leg or light-isolation work
      expect(b.loadUp).not.toContain('reverse-lunge');
      expect(b.loadUp).not.toContain('lateral-raise');
    }
  });
});

// The blocks used to be COPY. The app promised "same tempo, more reps" on day
// 21 and then handed her the identical session, because nothing ever applied
// the deltas. These are the tests that stop that regressing.
describe('the season actually progresses', () => {
  const opener = (s) => s.blocks.find((b) => b.part === 'main');

  it('EXTEND adds reps and shortens the rest', () => {
    const a = opener(progress(getSession('lower'), 1));
    const b = opener(progress(getSession('lower'), 21));
    expect(b.reps).toBe(a.reps + 2);
    expect(b.restSecs).toBeLessThan(a.restSecs);
  });

  it('SLOW lengthens the rep, and the interval grows with it', () => {
    const a = opener(progress(getSession('lower'), 1));
    const b = opener(progress(getSession('lower'), 41));
    expect(b.secsPerRep).toBe(a.secsPerRep + 1);
    expect(b.holdSecs).toBe(b.reps * b.secsPerRep);
  });

  // The interval is reps × pace, always. A stored holdSecs drifting out of
  // step with the two numbers that define it would silently mis-dose a set.
  it('keeps the interval equal to reps × pace at every point in the season', () => {
    for (const s of HOTMUM_SESSIONS) {
      for (const blk of SEASON.blocks) {
        for (const b of progress(s, blk.days[0]).blocks) {
          if (!b.reps) continue;
          expect(b.holdSecs, `${s.id}/${b.ex} @ ${blk.name}`).toBe(
            b.reps * b.secsPerRep,
          );
        }
      }
    }
  });

  it('LOAD puts 20 lb on the hinges and squats, and nothing else', () => {
    const s = progress(getSession('lower'), 61);
    const at = (id) => s.blocks.find((b) => b.ex === id && b.part === 'main');
    expect(at('sl-rdl').load.lb).toBe(20);
    expect(at('goblet-squat').load.lb).toBe(20);
    expect(at('reverse-lunge').load.lb).toBe(15);
  });

  it('PEAK adds a set to the opener, and only the opener', () => {
    const base = getSession('lower');
    const peak = progress(base, 81);
    expect(opener(peak).sets).toBe(opener(base).sets + 1);
    const second = peak.blocks.filter((b) => b.part === 'main')[1];
    const baseSecond = base.blocks.filter((b) => b.part === 'main')[1];
    expect(second.sets).toBe(baseSecond.sets);
  });

  // The knee block is medicine at a fixed dose. A knee protocol that creeps
  // upward every twenty days is how a knee protocol becomes a knee problem.
  it('never progresses the warm-up or the knee work', () => {
    for (const s of HOTMUM_SESSIONS) {
      for (const day of [21, 41, 61, 81]) {
        const before = s.blocks.filter((b) => b.part !== 'main');
        const after = progress(s, day).blocks.filter((b) => b.part !== 'main');
        expect(after, `${s.id} @ day ${day}`).toEqual(before);
      }
    }
  });
});

// ─── The knee doctrine ──────────────────────────────────────────────────────
// Sam's knees are the binding constraint on this program (program.js header).
// These are the rules that must not quietly regress in a later edit.
// ─── Rotations ──────────────────────────────────────────────────────────────
// Her plan says "Alternate:" on the knee blocks and "Rotate through:" on
// Wednesday's carry block. Straight sets are the same movements and the same
// volume arranged as a different exercise — a rotation gets its rest from
// changing movement, so it runs tighter and harder.
describe('the rotations her plan asks for', () => {
  it('interleaves every part marked as a rotation', () => {
    const s = playable(getSession('lower'));
    const knee = s.blocks.filter((b) => b.part === 'finisher').map((b) => b.ex);
    expect(knee).toEqual([
      'wall-sit',
      'sit-to-stand',
      'hip-abduction',
      'wall-sit',
      'sit-to-stand',
      'hip-abduction',
    ]);
    // one set each, and no programmed rest — the change-over IS the rest
    for (const b of s.blocks.filter((x) => x.part === 'finisher')) {
      expect(b.sets).toBe(1);
      expect(b.restSecs).toBe(0);
    }
  });

  it('leaves the straight-set parts exactly as written', () => {
    const raw = getSession('lower');
    const s = playable(raw);
    for (const key of ['warmup', 'main', 'core']) {
      expect(s.blocks.filter((b) => b.part === key)).toEqual(
        raw.blocks.filter((b) => b.part === key),
      );
    }
  });

  it('rotates the same total work, not less of it', () => {
    for (const raw of HOTMUM_SESSIONS) {
      expect(timeUnderTension(playable(raw)), raw.id).toBe(
        timeUnderTension(raw),
      );
      expect(setTotal(playable(raw)), raw.id).toBe(setTotal(raw));
    }
  });

  it('is a no-op on a session that declares no rotation', () => {
    const plain = { ...getSession('lower'), rotate: [] };
    expect(playable(plain).blocks).toEqual(plain.blocks);
  });
});

describe('the knee doctrine', () => {
  const lowerDays = ['lower', 'full'].map(getSession);

  it('gives both lower days a knee block and a standing core', () => {
    for (const s of lowerDays) {
      expect(s.parts.finisher, s.id).toMatch(/KNEE/);
      expect(
        s.blocks.some((b) => b.part === 'finisher' && b.ex === 'wall-sit'),
        s.id,
      ).toBe(true);
      expect(
        s.blocks.some((b) => b.part === 'finisher' && b.ex === 'sit-to-stand'),
        s.id,
      ).toBe(true);
    }
  });

  // Depth is capped by a CHAIR, not by a cue nobody follows on rep nine — and
  // the deep, high-load knee patterns are simply not in the program.
  it('has no deep or unsupported knee-dominant work in it', () => {
    const banned = ['step-up', 'lunge', 'jump-squat', 'pistol', 'split-squat'];
    for (const b of allBlocks) expect(banned, b.ex).not.toContain(b.ex);
    // the lunge that IS here steps BACK, with a hand on a chair
    expect(HOTMUM_EXERCISES['reverse-lunge'].name).toMatch(/Supported/);
    expect(HOTMUM_EXERCISES['reverse-lunge'].cue).toMatch(/chair/i);
    expect(HOTMUM_EXERCISES['goblet-squat'].cue).toMatch(/chair/i);
  });

  it('carries the glute-medius work that stops the knee caving in', () => {
    expect(
      getSession('lower').blocks.some((b) => b.ex === 'hip-abduction'),
    ).toBe(true);
    expect(HOTMUM_EXERCISES['hip-abduction'].why).toMatch(/glute medius/i);
  });

  it('puts a knee note on every knee-relevant movement', () => {
    for (const id of [
      'goblet-squat',
      'sumo-squat',
      'reverse-lunge',
      'wall-sit',
      'sit-to-stand',
      'hip-abduction',
      'calf-raise',
      'rdl',
    ]) {
      expect(HOTMUM_EXERCISES[id].knee, id).toBeTruthy();
    }
  });

  it('EASY KNEE swaps the knee-dominant work for hip work', () => {
    const s = kneeEasy(getSession('lower'));
    const at = (id) => s.blocks.filter((b) => b.ex === id);
    expect(at('goblet-squat')).toHaveLength(0);
    expect(at('sumo-squat')).toHaveLength(0);
    expect(s.blocks.some((b) => b.swappedFrom === 'goblet-squat')).toBe(true);
    expect(s.blocks.some((b) => b.swappedFrom === 'reverse-lunge')).toBe(true);
    // every swap lands on a real, playable exercise
    for (const b of s.blocks) expect(HOTMUM_EXERCISES[b.ex], b.ex).toBeTruthy();
  });

  // Isometric holds at a tolerable angle SETTLE an irritated knee. Dropping
  // them on a sore day would be the exact wrong reflex.
  it('keeps the wall sit and the sit-to-stand on an easy-knee day', () => {
    const s = kneeEasy(getSession('lower'));
    expect(s.blocks.some((b) => b.ex === 'wall-sit')).toBe(true);
    expect(s.blocks.some((b) => b.ex === 'sit-to-stand')).toBe(true);
  });

  it('offers the swap on the lower days and needs none on the upper', () => {
    expect(hasKneeSwap(getSession('lower'))).toBe(true);
    expect(hasKneeSwap(getSession('full'))).toBe(true);
    expect(hasKneeSwap(getSession('upper'))).toBe(false);
  });

  it('an easy-knee session is still a real session, not a rest day', () => {
    for (const id of ['lower', 'full']) {
      const easy = estimateMins(kneeEasy(getSession(id)), 'full');
      expect(easy, id).toBeGreaterThanOrEqual(24);
      expect(easy, id).toBeLessThanOrEqual(32);
    }
  });
});

// ─── Standing only ─────────────────────────────────────────────────────────
// Her plan has no floor work in it, and that's deliberate: getting down and
// back up with a baby in the house is the tax that stops a session starting.
describe('everything is done standing', () => {
  it('has no floor work anywhere in the program', () => {
    const floor = [
      'side-plank',
      'dead-bug',
      'heel-slide',
      'bird-dog',
      'glute-bridge',
      'glute-bridge-burnout',
      'hip-thrust',
      'floor-press',
    ];
    for (const b of allBlocks) expect(floor, b.ex).not.toContain(b.ex);
  });

  it('trains the core standing up instead', () => {
    for (const s of HOTMUM_SESSIONS) {
      // Wednesday's standing core lives in her ATHLETIC CORE + CARRY rotation
      const core = s.blocks
        .filter((b) => b.part === 'core' || b.part === 'finisher')
        .map((b) => b.ex);
      expect(core, s.id).toContain('suitcase-hold');
    }
    for (const id of ['lower', 'full']) {
      const core = getSession(id)
        .blocks.filter((b) => b.part === 'core')
        .map((b) => b.ex);
      expect(core, id).toEqual(['knee-to-elbow', 'suitcase-hold']);
    }
  });
});

// ─── The illustrations ─────────────────────────────────────────────────────
describe('every movement has a figure', () => {
  it('draws all of them — a missing demo is a blank panel mid-set', () => {
    for (const id of Object.keys(HOTMUM_EXERCISES)) {
      expect(HOTMUM_DEMOS[id], `no demo for ${id}`).toBeTruthy();
      expect(HOTMUM_DEMOS[id], id).toContain('<svg');
    }
  });

  it('has no demo for an exercise that does not exist', () => {
    for (const id of Object.keys(HOTMUM_DEMOS)) {
      expect(HOTMUM_EXERCISES[id], `stale demo: ${id}`).toBeTruthy();
    }
  });

  // The player strips <animate*> under prefers-reduced-motion, which freezes
  // each figure at whatever pose the static attributes hold. So the drawn pose
  // has to BE the working position, with the animation running back to the
  // start — not forward to it.
  it('animates without needing to, so reduced motion still teaches', () => {
    for (const [id, svg] of Object.entries(HOTMUM_DEMOS)) {
      const frozen = svg.replace(/<animate[^>]*\/>/g, '');
      expect(frozen, id).toContain('<path');
    }
  });
});

// ─── Another movement ──────────────────────────────────────────────────────
describe('the other thirty minutes', () => {
  it('offers a walk and the things that replace one', () => {
    const ids = MOVEMENTS.map((m) => m.id);
    expect(ids[0]).toBe('walk');
    for (const id of ['easy-walk', 'yoga', 'pilates']) {
      expect(ids, id).toContain(id);
    }
  });

  it('every movement is a named, timed, loggable thing', () => {
    for (const m of MOVEMENTS) {
      expect(m.name, m.id).toBeTruthy();
      expect(m.blurb, m.id).toBeTruthy();
      expect(m.mins, m.id).toBeGreaterThan(0);
    }
  });

  it('falls back to the walk rather than breaking on an unknown id', () => {
    expect(getMovement('nope').id).toBe('walk');
    expect(getMovement(undefined).id).toBe('walk');
    expect(getMovement('yoga').name).toBe('Yoga');
  });
});

// ─── One door for the player ───────────────────────────────────────────────
describe('sessionForToday', () => {
  it('applies the day and the knee switch together', () => {
    const s = sessionForToday(getSession('lower'), { day: 81, easyKnee: true });
    expect(s.easyKnee).toBe(true);
    expect(s.block).toBe('PEAK');
    expect(s.blocks.some((b) => b.swappedFrom)).toBe(true);
  });

  it('survives a session that does not exist', () => {
    expect(sessionForToday(null)).toBeNull();
  });
});

// WEEK is the recommended rhythm, not a schedule — she picks each day in the
// app. These guard the shape the program was written around.
describe('the recommended rhythm', () => {
  it('is three sessions and four walks', () => {
    expect(WEEK).toHaveLength(7);
    expect(WEEK.filter((d) => d.kind === 'session')).toHaveLength(3);
    expect(WEEK.filter((d) => d.kind === 'walk')).toHaveLength(4);
  });

  it('never puts two sessions back to back', () => {
    for (let i = 0; i < WEEK.length; i++) {
      const next = WEEK[(i + 1) % WEEK.length];
      if (WEEK[i].kind === 'session') expect(next.kind).toBe('walk');
    }
  });

  it('every scheduled session exists', () => {
    for (const day of WEEK.filter((d) => d.kind === 'session')) {
      expect(getSession(day.id), day.id).toBeTruthy();
    }
  });

  it('is the Monday / Wednesday / Friday rhythm her plan is written on', () => {
    expect(
      WEEK.filter((d) => d.kind === 'session').map((d) => d.day),
    ).toEqual(['MON', 'WED', 'FRI']);
    expect(WEEK.at(-1)).toMatchObject({ day: 'SUN', move: 'easy-walk' });
  });
});

// The whole point of building on rehab.js: her data drives the shipped engine.
describe('drives the shipped step engine', () => {
  it('builds a playable queue for every session', () => {
    for (const s of HOTMUM_SESSIONS) {
      const queue = buildStepQueue(s);
      expect(queue.length, s.id).toBeGreaterThan(0);
      // every step is playable: a countdown or an explicit manual step
      for (const step of queue) {
        expect(['prep', 'work', 'rest']).toContain(step.kind);
        if (!step.manual) expect(step.secs, `${s.id}/${step.exId}`).toBeGreaterThan(0);
      }
      // sets counted by the engine match what the data promises
      expect(queue.filter((st) => st.countsAsSet).length).toBe(setTotal(s));
    }
  });

  it('builds one continuous WORK interval per set', () => {
    const queue = buildStepQueue(getSession('full'));
    const set = queue.find((st) => st.exId === 'rdl' && st.kind === 'work');
    expect(set.secs).toBe(40);
    expect(set.phase).toBe('WORK');
    // no beat state on the step at all any more
    expect(set.tempo).toBeUndefined();
  });

  // THE COACH NAMES THE SET AND THEN SHUTS UP (2026-08-22). It went in two
  // steps: she stopped calling the phase on every beat, then she stopped
  // counting the reps too. What's left is the KILOS pattern — the movement
  // and the dose, up front, then silence.
  it('announces a set as "movement, N reps" and says nothing inside it', () => {
    const queue = buildStepQueue(getSession('lower'));
    const rdl = queue.find((st) => st.exId === 'sl-rdl' && st.kind === 'work');
    expect(setAnnounce(rdl, getSession('lower').blocks[5])).toEqual([
      'name-sl-rdl',
      'six',
      'reps',
    ]);

    const wall = queue.find((st) => st.exId === 'wall-sit' && st.kind === 'work');
    const wallBlock = getSession('lower').blocks.find(
      (b) => b.ex === 'wall-sit',
    );
    expect(setAnnounce(wall, wallBlock)).toEqual([
      'name-wall-sit',
      'thirty',
      'seconds',
    ]);

    expect(setAnnounce(null)).toEqual([]);
  });

  // Every working step has to be announceable, or a set starts in silence.
  it('has a word for every rep count and every hold in the program', () => {
    for (const raw of HOTMUM_SESSIONS) {
      const s = playable(raw);
      for (const st of buildStepQueue(s)) {
        if (st.kind !== 'work') continue;
        const block = s.blocks[st.bi];
        const said = setAnnounce(st, block);
        expect(said[0], `${st.exId} name`).toBe(`name-${st.exId}`);
        expect(
          said,
          `${st.exId} — no word for ${block.reps || st.secs}`,
        ).toHaveLength(3);
      }
    }
    for (const w of Object.values(SEC_SLUGS)) expect(w).toBeTruthy();
  });

  // The whole point of the stepEngine extraction: bound to HOTMUM_EXERCISES,
  // the engine speaks her exercises. Before it, every name rendered as a raw
  // id — "hip-thrust" instead of "Hip Thrust".
  it('resolves HER exercise names, not raw ids', () => {
    for (const s of HOTMUM_SESSIONS) {
      for (const row of sessionOverview(s)) {
        expect(row.title, `${s.id} overview`).not.toMatch(/^[a-z0-9-]+$/);
        expect(row.detail).toBeTruthy();
      }
    }
    const overview = sessionOverview(getSession('lower'));
    expect(overview.map((r) => r.title)).toContain('Single-Leg RDL');
  });

  it('tells her what is coming during a rest, by name and side', () => {
    const queue = buildStepQueue(getSession('lower'));
    const restIdx = queue.findIndex((st) => st.kind === 'rest');
    expect(nextWorkLabel(queue, restIdx)).not.toMatch(/^[a-z0-9-]+$/);
    expect(nextWorkLabel(queue, queue.length - 1)).toBe('FINISH');
    // per-side work announces the side
    const lungeRest = queue.findIndex(
      (st) => st.exId === 'reverse-lunge' && st.phase === 'SWITCH SIDES',
    );
    expect(nextWorkLabel(queue, lungeRest)).toContain('Lunge');
  });

  // Two independent length calculations: program.js does it from the data,
  // the engine does it by summing the real queue. They should broadly agree —
  // a wide gap means one of them is wrong.
  it('the data estimate and the engine estimate agree within a few minutes', () => {
    for (const s of HOTMUM_SESSIONS) {
      const fromData = estimateMins(s);
      const fromQueue = estimateSessionMins(s);
      expect(
        Math.abs(fromData - fromQueue),
        `${s.id}: data ${fromData}m vs queue ${fromQueue}m`,
      ).toBeLessThanOrEqual(4);
    }
  });

  it('splits per-side work into left and right with a switch between', () => {
    const queue = buildStepQueue(getSession('lower'));
    const sides = queue
      .filter((st) => st.exId === 'reverse-lunge' && st.kind === 'work')
      .map((st) => st.side);
    expect(sides.slice(0, 2)).toEqual(['LEFT', 'RIGHT']);
    expect(
      queue.some(
        (st) => st.exId === 'reverse-lunge' && st.phase === 'SWITCH SIDES',
      ),
    ).toBe(true);
  });
});

describe('profile — greeting and units', () => {
  it('greets her by the name Gabe actually calls her', () => {
    expect(greeting('Sam')).toBe('Hello, hot mum Sam.');
    expect(greeting('Sammy')).toBe('Hello, hot mum Sammy.');
  });

  it('changes register once the day is done', () => {
    expect(greeting('Sam', new Date(), true)).toBe('Nice work, hot mum Sam.');
  });

  // The brand name is allowed; remarks about her body are not. "Hot as in
  // strong" only holds if the app talks about what she DOES — postpartum, a
  // training app that drifts into appearance talk stops being a training app.
  // This should fail loudly if someone later writes a cute line.
  it('says hot mum, but never comments on how she looks', () => {
    const appearance = /sexy|slim|skinny|thin|lean|toned|bod(y|ies)|figure|look(s|ing)?\b|shape|weight loss|snap ?back|bounce ?back/i;
    const lines = [
      greeting('Sam'),
      greeting('Sam', new Date(), true),
      ...[1, 42, 100].flatMap((day) =>
        [true, false].map((doneToday) =>
          subGreeting({ doneToday, day, days: 100 }),
        ),
      ),
    ];
    for (const line of lines) expect(line, line).not.toMatch(appearance);
    // …and the brand name survives, so the ban never quietly eats the greeting
    expect(greeting('Sam')).toMatch(/hot mum/i);
  });

  it('counts the hundred days, and never a date beyond them', () => {
    expect(subGreeting({ doneToday: false, day: 1, days: 100 })).toMatch(
      /Day one of 100/,
    );
    expect(subGreeting({ doneToday: false, day: 42, days: 100 })).toMatch(
      /Day 42 of 100/,
    );
    expect(subGreeting({ doneToday: true, day: 42, days: 100 })).toBe(
      "That's today done.",
    );
  });

  it('formats load in her unit, and bodyweight as words', () => {
    expect(formatLoad({ lb: 15, each: true })).toBe('15 lb × 2');
    expect(formatLoad({ lb: 20 })).toBe('20 lb');
    expect(formatLoad('BW')).toBe('Bodyweight');
    expect(formatLoad(null)).toBe('Bodyweight');
  });

  it('converts to kg for display only, to the nearest half', () => {
    expect(lbToKg(10)).toBe(4.5);
    expect(lbToKg(20)).toBe(9);
    expect(formatLoad({ lb: 15, each: true }, 'kg')).toBe('7 kg × 2');
    // the prescription itself never changes — still the same pounds underneath
    expect(DEFAULTS.dumbbells).toEqual([10, 15, 20]);
  });
});

describe('dates are LOCAL, not UTC', () => {
  // In Manila (UTC+8) a 7am session stamped with the UTC date lands on
  // yesterday, so by that evening the app had forgotten she'd trained.
  const localKey = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  it('stamps a 7am session with today, not yesterday', () => {
    const morning = new Date(2026, 8, 1, 7, 0, 0); // 1 Sep, local
    expect(localKey(morning)).toBe('2026-09-01');
    // the old behaviour, for the record
    if (morning.getTimezoneOffset() < 0) {
      expect(morning.toISOString().slice(0, 10)).toBe('2026-08-31');
    }
  });

  it('the countdown does not drift through the day', () => {
    const morning = daysToGo(new Date(2026, 8, 1, 7, 0, 0));
    const evening = daysToGo(new Date(2026, 8, 1, 22, 0, 0));
    expect(morning).toBe(evening);
  });

  it('the day number is the same all day', () => {
    expect(dayNumber(new Date(2026, 8, 1, 6, 0, 0))).toBe(
      dayNumber(new Date(2026, 8, 1, 23, 0, 0)),
    );
  });
});

describe('the week', () => {
  // The weekly counter ("SESSIONS 2/3") is GONE — a quota is a streak wearing
  // a different hat, and with a newborn every week gets rearranged. WEEK is
  // still the rhythm the program is dosed for; nothing scores her against it.
  it('is three sessions and four walks, as a rhythm and not a quota', () => {
    expect(WEEK.filter((d) => d.kind === 'session')).toHaveLength(3);
    expect(WEEK.filter((d) => d.kind === 'walk')).toHaveLength(4);
  });

  // Mon-to-Sun, computed from LOCAL dates — the same UTC trap that filed her
  // 7am session to yesterday would put a Monday session in the week before.
  it('counts a Monday-to-Sunday week from local dates', () => {
    const mondayOf = (d) => {
      const m = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      m.setDate(m.getDate() - ((d.getDay() + 6) % 7));
      return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}-${String(m.getDate()).padStart(2, '0')}`;
    };
    // 2026-09-02 is a Wednesday; its week starts Monday the 31st of August
    expect(mondayOf(new Date(2026, 8, 2, 7, 0))).toBe('2026-08-31');
    // and a Monday is its own week start, even at 7am
    expect(mondayOf(new Date(2026, 7, 31, 7, 0))).toBe('2026-08-31');
    // Sunday belongs to the week that began six days earlier
    expect(mondayOf(new Date(2026, 8, 6, 22, 0))).toBe('2026-08-31');
  });
});
