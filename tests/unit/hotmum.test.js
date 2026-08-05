import { describe, expect, it } from 'vitest';
import {
  blockForWeek,
  blockWorkSecs,
  daysToGo,
  DOSES,
  estimateMins,
  getSession,
  HOTMUM_EXERCISES,
  HOTMUM_SESSIONS,
  loadLabel,
  SEASON,
  seasonWeek,
  sessionAtDose,
  setTotal,
  tempoLabel,
  tempoSecs,
  timeUnderTension,
  WEEK,
} from '../../src/hotmum/program.js';
import {
  buildStepQueue,
  estimateSessionMins,
  nextWorkLabel,
  sessionOverview,
  tempoStateAt,
} from '../../src/hotmum/engine.js';
import { phaseWordSlug } from '../../src/workout/tempoCues.js';
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
    expect(HOTMUM_SESSIONS.map((s) => s.id)).toEqual([
      'lower-a',
      'upper',
      'lower-b',
    ]);
    expect(HOTMUM_SESSIONS.map((s) => s.day)).toEqual(['TUE', 'THU', 'SAT']);
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

  it('every block declares a dose so the FULL/SHORT/CORE cuts are total', () => {
    const known = new Set(Object.values(DOSES).flatMap((d) => d.includes));
    for (const b of allBlocks) expect(known.has(b.dose), `${b.ex} dose`).toBe(true);
  });

  it('every working set is timed — nothing is left to counting', () => {
    for (const b of allBlocks) {
      expect(['tempo', 'reps', 'hold'], `${b.ex} mode`).toContain(b.mode);
      if (b.mode === 'tempo') expect(b.tempo, `${b.ex} tempo`).toBeTruthy();
      else expect(b.holdSecs, `${b.ex} holdSecs`).toBeGreaterThan(0);
    }
  });

  // The coach can only say lift / squeeze / hold / lower. A label outside that
  // set doesn't add a word — it silently makes her say "lower" on the wrong beat.
  it('uses only phase labels the coach voice can actually speak', () => {
    const speakable = { LIFT: 'lift', SQUEEZE: 'squeeze', PAUSE: 'hold', LOWER: 'lower' };
    for (const b of allBlocks) {
      for (const [label] of b.tempo || []) {
        expect(Object.keys(speakable), `${b.ex} phase ${label}`).toContain(label);
        expect(phaseWordSlug(label)).toBe(speakable[label]);
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
    const rdl = getSession('lower-a').blocks.find((b) => b.ex === 'rdl');
    expect(tempoSecs(rdl.tempo)).toBe(5); // 3 lower + 1 pause + 1 lift
    expect(tempoLabel(rdl.tempo)).toBe('3-1-1');
    expect(rdl.reps * tempoSecs(rdl.tempo)).toBe(50);
  });

  it('the per-side blocks cost double — one side at a time', () => {
    const lunge = getSession('lower-a').blocks.find((b) => b.ex === 'lunge');
    expect(lunge.perSide).toBe(true);
    // 3 sets × 2 sides × 10 reps × 4s
    expect(blockWorkSecs(lunge)).toBe(240);
  });

  it('holds and per-rep holds are counted too', () => {
    const plank = getSession('lower-a').blocks.find((b) => b.ex === 'side-plank');
    expect(blockWorkSecs(plank)).toBe(120); // 2 sets × 2 sides × 30s

    // bird dog appears twice per session at different doses — the warm-up
    // single set and the core double. Find by dose, never by exercise alone.
    const blocks = getSession('upper').blocks.filter((b) => b.ex === 'bird-dog');
    expect(blocks.map((b) => b.dose)).toEqual(['warmup', 'core']);
    expect(blockWorkSecs(blocks[0])).toBe(80); // 1 × 2 sides × 5 reps × 8s
    expect(blockWorkSecs(blocks[1])).toBe(160); // 2 × 2 × 5 × 8s
  });
});

describe('doses — same program, three exits', () => {
  it('FULL is everything; SHORT drops finishers and core; CORE is core alone', () => {
    const s = getSession('lower-a');
    expect(sessionAtDose(s, 'full').blocks.length).toBe(s.blocks.length);
    expect(
      sessionAtDose(s, 'short').blocks.every((b) => b.dose !== 'core'),
    ).toBe(true);
    expect(
      sessionAtDose(s, 'core').blocks.every((b) => b.dose === 'core'),
    ).toBe(true);
  });

  // These bounds are the MEASURED cost of her plan under tempo, not a target.
  // FULL came in at 41–46 min (PLAN.md §2.7) — longer than the 34 first
  // estimated, because tempo sets take longer than rushed ones. The band is
  // wide enough to be honest and tight enough to catch a data error that
  // doubles a session.
  it('each dose lands in its measured band', () => {
    for (const s of HOTMUM_SESSIONS) {
      const full = estimateMins(s, 'full');
      expect(full, `${s.id} full`).toBeGreaterThanOrEqual(35);
      expect(full, `${s.id} full`).toBeLessThanOrEqual(50);
      expect(estimateMins(s, 'short'), `${s.id} short`).toBeLessThanOrEqual(35);
      expect(estimateMins(s, 'core'), `${s.id} core`).toBeLessThanOrEqual(12);
    }
  });

  // Measured: lower-a saves 32%, upper 46%, lower-b only 28% — Lower B's main
  // block is so big that SHORT still costs 31 min, well over the 22 the dose
  // is meant to promise. Open decision in PLAN.md §2.7 (re-tier the step-up as
  // a finisher, or re-advertise the dose). Guard at 25% until that's settled.
  it('SHORT is a genuine escape hatch on every session', () => {
    for (const s of HOTMUM_SESSIONS) {
      const saved = 1 - estimateMins(s, 'short') / estimateMins(s, 'full');
      expect(saved, `${s.id} saves ${Math.round(saved * 100)}%`).toBeGreaterThan(0.25);
    }
  });

  it('a shorter dose is never longer than a fuller one', () => {
    for (const s of HOTMUM_SESSIONS) {
      expect(estimateMins(s, 'core')).toBeLessThanOrEqual(estimateMins(s, 'short'));
      expect(estimateMins(s, 'short')).toBeLessThanOrEqual(estimateMins(s, 'full'));
    }
  });

  it('counts sets and time-under-tension for the finish card', () => {
    const s = getSession('lower-a');
    expect(setTotal(s, 'full')).toBeGreaterThan(20);
    expect(timeUnderTension(s, 'full')).toBeGreaterThan(15 * 60);
  });
});

describe('season — the countdown, not a streak', () => {
  it('runs 20 weeks and ends on Christmas', () => {
    expect(SEASON.weeks).toBe(20);
    expect(SEASON.endDate).toBe('2026-12-25');
    expect(SEASON.blocks.map((b) => b.name)).toEqual([
      'GROOVE',
      'EXTEND',
      'SLOW',
      'LOAD',
      'PEAK',
    ]);
  });

  it('the blocks tile the season with no gaps and no overlaps', () => {
    for (let week = 1; week <= SEASON.weeks; week++) {
      const hits = SEASON.blocks.filter(
        (b) => week >= b.weeks[0] && week <= b.weeks[1],
      );
      expect(hits.length, `week ${week}`).toBe(1);
    }
  });

  it('counts down to Christmas and clamps at zero after it', () => {
    expect(daysToGo('2026-08-05')).toBe(142);
    expect(daysToGo('2026-12-24')).toBe(1);
    expect(daysToGo('2027-01-05')).toBe(0);
  });

  it('reports the season week, clamped at both ends', () => {
    expect(seasonWeek('2026-08-11')).toBe(1); // day one
    expect(seasonWeek('2026-08-17')).toBe(1); // still week one
    expect(seasonWeek('2026-08-18')).toBe(2);
    expect(seasonWeek('2026-07-01')).toBe(1); // before the start
    expect(seasonWeek('2027-03-01')).toBe(20); // long after the end
  });

  it('maps a week to its training block', () => {
    expect(blockForWeek(1).name).toBe('GROOVE');
    expect(blockForWeek(4).name).toBe('GROOVE');
    expect(blockForWeek(5).name).toBe('EXTEND');
    expect(blockForWeek(20).name).toBe('PEAK');
  });

  it('loads up only where the 15 → 20 lb jump is survivable', () => {
    const load = SEASON.blocks.find((b) => b.name === 'LOAD');
    expect(load.loadUp).toEqual(['rdl', 'hip-thrust', 'goblet-squat']);
    // never on the single-leg or light-isolation work
    expect(load.loadUp).not.toContain('lunge');
    expect(load.loadUp).not.toContain('lateral-raise');
  });
});

describe('the week — something every day', () => {
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

  it('paces an RDL set beat by beat, and the coach counts the reps', () => {
    const queue = buildStepQueue(getSession('lower-a'));
    const set = queue.find((st) => st.exId === 'rdl' && st.kind === 'work');
    expect(set.secs).toBe(50);
    expect(set.tempo.reps).toBe(10);

    // first beat of rep 1, mid-set, and the last beat of rep 10
    expect(tempoStateAt(set.tempo, 0).label).toBe('LOWER');
    expect(tempoStateAt(set.tempo, 3000).label).toBe('PAUSE');
    expect(tempoStateAt(set.tempo, 4000).label).toBe('LIFT');
    expect(tempoStateAt(set.tempo, 5000).rep).toBe(2);
    expect(tempoStateAt(set.tempo, 49000).rep).toBe(10);
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
    const overview = sessionOverview(getSession('lower-a'));
    expect(overview.map((r) => r.title)).toContain('Romanian Deadlift');
    expect(overview.find((r) => r.title === 'Romanian Deadlift').detail).toBe(
      '3 × 10 tempo',
    );
  });

  it('tells her what is coming during a rest, by name and side', () => {
    const queue = buildStepQueue(getSession('lower-a'));
    const restIdx = queue.findIndex((st) => st.kind === 'rest');
    expect(nextWorkLabel(queue, restIdx)).not.toMatch(/^[a-z0-9-]+$/);
    expect(nextWorkLabel(queue, queue.length - 1)).toBe('FINISH');
    // per-side work announces the side
    const lungeRest = queue.findIndex(
      (st) => st.exId === 'lunge' && st.phase === 'SWITCH SIDES',
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
    const queue = buildStepQueue(getSession('lower-a'));
    const sides = queue
      .filter((st) => st.exId === 'lunge' && st.kind === 'work')
      .map((st) => st.side);
    expect(sides.slice(0, 2)).toEqual(['LEFT', 'RIGHT']);
    expect(
      queue.some((st) => st.exId === 'lunge' && st.phase === 'SWITCH SIDES'),
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
      ...['walk', 'session'].flatMap((kind) =>
        [true, false].map((doneToday) =>
          subGreeting({ kind, doneToday, daysToGo: 100 }),
        ),
      ),
    ];
    for (const line of lines) expect(line, line).not.toMatch(appearance);
    // …and the brand name survives, so the ban never quietly eats the greeting
    expect(greeting('Sam')).toMatch(/hot mum/i);
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
