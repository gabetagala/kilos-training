import { describe, expect, it } from 'vitest';
import {
  compareBenchmark,
  formatBenchmarkScore,
  NOISE_BAND,
  scoreFromRun,
} from '../../src/workout/benchmark.js';
import {
  BENCHMARK_SESSIONS,
  getBenchmark,
} from '../../src/workout/program.js';
import { buildStepQueue } from '../../src/workout/rehab.js';

describe('benchmark scoring', () => {
  it('formats each score type in its own units', () => {
    expect(formatBenchmarkScore('time', 754)).toBe('12:34');
    expect(formatBenchmarkScore('time', 65)).toBe('1:05');
    expect(formatBenchmarkScore('minute', 11)).toBe('MIN 11');
    expect(formatBenchmarkScore('hr', 96)).toBe('96 BPM');
    expect(formatBenchmarkScore('time', null)).toBe('—');
  });

  // The load-bearing test. Fight Gone Bad's SEM is 6% — the only published
  // noise floor for a metcon — so a change inside that band is measurement
  // error, and reporting it as progress would be a lie the athlete acts on.
  it('refuses to call a change inside the noise band an improvement', () => {
    // 4% faster on a for-time test: inside the 6% band → flat
    const small = compareBenchmark('time', 576, 600);
    expect(small.meaningful).toBe(false);
    expect(small.dir).toBe('flat');
    // 10% faster: clears the band → a real improvement
    const real = compareBenchmark('time', 540, 600);
    expect(real.meaningful).toBe(true);
    expect(real.dir).toBe('better');
  });

  it('knows which direction is better for each test', () => {
    // time + hr: lower is better
    expect(compareBenchmark('time', 500, 600).dir).toBe('better');
    expect(compareBenchmark('time', 700, 600).dir).toBe('worse');
    expect(compareBenchmark('hr', 80, 100).dir).toBe('better');
    expect(compareBenchmark('hr', 120, 100).dir).toBe('worse');
    // minute (a ladder): higher is better
    expect(compareBenchmark('minute', 14, 10).dir).toBe('better');
    expect(compareBenchmark('minute', 8, 10).dir).toBe('worse');
  });

  it('is safe with a missing or zero baseline', () => {
    for (const prev of [null, undefined, 0]) {
      const c = compareBenchmark('time', 600, prev);
      expect(c.meaningful).toBe(false);
      expect(c.dir).toBe('flat');
    }
    expect(compareBenchmark('time', null, 600).meaningful).toBe(false);
  });

  it('every score type has a declared noise band', () => {
    for (const b of BENCHMARK_SESSIONS) {
      expect(NOISE_BAND[b.scoreType], b.id).toBeGreaterThan(0);
    }
  });
});

describe('scoreFromRun', () => {
  it('scores a for-time benchmark as elapsed seconds', () => {
    const descent = getBenchmark('bm-descent');
    expect(
      scoreFromRun(descent, { elapsedSecs: 743.6, stepsCompleted: 7, queue: [] }),
    ).toBe(744);
  });

  it('never lets a finished run round down to "unscoreable"', () => {
    const descent = getBenchmark('bm-descent');
    expect(scoreFromRun(descent, { elapsedSecs: 0.4, queue: [] })).toBe(1);
    expect(scoreFromRun(descent, { elapsedSecs: 0, queue: [] })).toBeNull();
  });

  it('scores a ladder as the last minute COMPLETED, not attempted', () => {
    // the ladder lives in the finisher pool now; the scoring rule is the same
    const ladderSession = {
      id: 'x',
      benchmark: true,
      scoreType: 'minute',
      blocks: [
        {
          mode: 'emom',
          name: 'L',
          rounds: 12,
          members: [{ ex: 'push-up', ladderFrom: 5, logWeight: false }],
        },
      ],
    };
    const queue = buildStepQueue(ladderSession);
    const ladderLen = queue.filter((s) => s.ladder).length;
    const preSteps = queue.length - ladderLen; // the prep step
    expect(
      scoreFromRun(ladderSession, {
        elapsedSecs: 600,
        stepsCompleted: preSteps + 9,
        queue,
      }),
    ).toBe(9);
    expect(
      scoreFromRun(ladderSession, {
        elapsedSecs: 9999,
        stepsCompleted: preSteps + ladderLen + 5,
        queue,
      }),
    ).toBe(ladderLen);
  });

  it('returns null for the heart-rate test — the app cannot observe it', () => {
    const control = getBenchmark('bm-control');
    expect(
      scoreFromRun(control, { elapsedSecs: 240, stepsCompleted: 3, queue: [] }),
    ).toBeNull();
  });

  it('ignores non-benchmark sessions', () => {
    expect(
      scoreFromRun({ id: 'd40-a1' }, { elapsedSecs: 600, stepsCompleted: 9 }),
    ).toBeNull();
  });
});

describe('the benchmark set', () => {
  it('covers three score types — one benchmark is not a fitness score', () => {
    // Grace (~3 min) is 77% explained by strength; Fight Gone Bad (17 min) is
    // 59-72% aerobic; Cindy had NO significant physiological predictors. A
    // single test cannot stand in for fitness, so the set must be plural.
    expect(BENCHMARK_SESSIONS.map((b) => b.scoreType).sort()).toEqual([
      'hr',
      'rounds',
      'time',
    ]);
  });

  it('every benchmark movement fails somewhere that is not the spine', () => {
    // The design rule: a test you cannot safely max on is not a test. These
    // fail at the legs/lungs (step-up, torso upright), the grip (carry), or
    // the chest (push-up, hips sag into extension) — never at a flexing spine.
    // strict pull-up (decompressive hang, no kip), push-up (fails at the
    // chest, hips sag into extension), box squat (the box fixes depth so
    // fatigue can never tuck the pelvis), box step-up (upright torso)
    const SAFE = new Set(['box-step-up', 'box-squat', 'push-up', 'pull-up-bw']);
    for (const b of BENCHMARK_SESSIONS) {
      for (const s of buildStepQueue(b)) {
        expect(SAFE.has(s.exId), `${b.id} uses ${s.exId}`).toBe(true);
      }
    }
  });

  it('each benchmark states its retest cadence — retesting sooner is noise', () => {
    for (const b of BENCHMARK_SESSIONS) {
      expect(b.freq, b.id).toBeTruthy();
      expect(b.benchmark).toBe(true);
    }
  });
});

describe('ladder EMOM (death by)', () => {
  // The ladder is a FINISHER format now, not a benchmark — same engine.
  const q = buildStepQueue({
    id: 'x',
    blocks: [
      {
        mode: 'emom',
        name: 'Death by Push-Up',
        rounds: 12,
        members: [{ ex: 'push-up', ladderFrom: 5, logWeight: false }],
      },
    ],
  });
  const ladder = q.filter((s) => s.ladder);

  it('climbs one rep per minute from the declared start', () => {
    expect(ladder.slice(0, 6).map((s) => s.reps)).toEqual([
      '5',
      '6',
      '7',
      '8',
      '9',
      '10',
    ]);
  });

  it('runs on the interval clock and states the rule, not a minute count', () => {
    for (const s of ladder) {
      expect(s.secs).toBe(60);
      expect(s.emom).toBe(true);
      // a ladder has no fixed length — its end is failure — so "EMOM 12"
      // would be a lie about how long this is
      expect(s.pieceFormat).toBe('EMOM · +1 REP/MIN');
      expect(s.meta).toMatch(/^MIN \d+ · \d+ REPS$/);
    }
  });

  it('the rounds count is a queue ceiling, not a target', () => {
    expect(ladder.length).toBe(12);
  });
});

describe('21-15-9 (fortime repScheme)', () => {
  const q = buildStepQueue(getBenchmark('bm-descent')).filter(
    (s) => s.kind === 'work',
  );

  it('descends 21 → 15 → 9 across every movement', () => {
    expect(q.map((s) => s.reps)).toEqual([
      '21', '21', '15', '15', '9', '9',
    ]);
    expect(q.map((s) => s.exId)).toEqual([
      'box-squat', 'push-up', 'box-squat', 'push-up', 'box-squat', 'push-up',
    ]);
  });

  it('is self-paced with no prescribed rest — the clock is the score', () => {
    for (const s of q) {
      expect(s.manual).toBe(true);
      expect(s.pieceFormat).toBe('21-15-9');
    }
    expect(buildStepQueue(getBenchmark('bm-descent')).some((s) => s.kind === 'rest')).toBe(false);
  });
});
