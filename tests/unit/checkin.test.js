import { describe, expect, it } from 'vitest';
import { addCheckin, checkinStatus } from '../../src/workout/checkin.js';

const e = (date, weightKg, waistCm) => ({ date, weightKg, waistCm });

describe('addCheckin', () => {
  it('appends and keeps ascending date order', () => {
    const list = addCheckin(
      addCheckin([], e('2026-07-19', 82, 90)),
      e('2026-07-12', 83, 91),
    );
    expect(list.map((x) => x.date)).toEqual(['2026-07-12', '2026-07-19']);
  });

  it('replaces a same-date entry instead of duplicating', () => {
    const list = addCheckin(
      [e('2026-07-19', 82, 90)],
      e('2026-07-19', 81.5, 89.5),
    );
    expect(list).toHaveLength(1);
    expect(list[0].weightKg).toBe(81.5);
  });

  it('tolerates a null/undefined starting list', () => {
    expect(addCheckin(null, e('2026-07-19', 82, 90))).toHaveLength(1);
  });
});

describe('checkinStatus', () => {
  it('is "first" with no entries', () => {
    expect(checkinStatus([]).state).toBe('first');
    expect(checkinStatus(null).state).toBe('first');
  });

  it('is "building" until an entry ≥11 days older than the latest exists', () => {
    const s = checkinStatus([e('2026-07-12', 83, 91), e('2026-07-19', 82, 90)]);
    expect(s.state).toBe('building');
    expect(s.ref).toBeNull();
  });

  it('picks the NEWEST entry that is ≥11 days older as the reference', () => {
    const s = checkinStatus([
      e('2026-06-28', 84, 92),
      e('2026-07-05', 83, 91),
      e('2026-07-19', 82, 90),
    ]);
    expect(s.state).toBe('trending');
    expect(s.ref.date).toBe('2026-07-05');
  });

  it('trends when only the waist moved', () => {
    const s = checkinStatus([e('2026-07-05', 82, 91), e('2026-07-19', 82, 90)]);
    expect(s.state).toBe('trending');
  });

  it('trends when only the weight moved', () => {
    const s = checkinStatus([e('2026-07-05', 83, 90), e('2026-07-19', 82, 90)]);
    expect(s.state).toBe('trending');
  });

  it('stalls when neither measure dropped past noise (0.3)', () => {
    const s = checkinStatus([
      e('2026-07-05', 82.2, 90.2),
      e('2026-07-19', 82.0, 90.0),
    ]);
    expect(s.state).toBe('stalled');
  });

  it('a 0.3 drop counts; weight going UP never counts as trending', () => {
    expect(
      checkinStatus([e('2026-07-05', 82.3, 90), e('2026-07-19', 82.0, 90)])
        .state,
    ).toBe('trending');
    expect(
      checkinStatus([e('2026-07-05', 82, 90), e('2026-07-19', 83, 90.1)])
        .state,
    ).toBe('stalled');
  });

  // BUILDING, NOT CUTTING (2026-10-10, coach QA): the goal grew to a bigger
  // triangle AND bigger legs, so flat weight is no longer the alarm. The one
  // alarm is the WAIST rising by a REAL move — 1.0 cm, not the 0.3 that
  // tape-measure noise reaches on its own (round 2).
  it('flags waistUp only when the waist rose a real 1.0 cm', () => {
    // scale up 1.5 kg, waist up 1 cm → the alarm
    const up = checkinStatus([e('2026-07-05', 80, 88), e('2026-07-19', 81.5, 89)]);
    expect(up.waistUp).toBe(true);
    expect(up.state).toBe('stalled'); // nothing dropped — and that's fine now
    // scale up, waist flat → building, no alarm
    expect(
      checkinStatus([e('2026-07-05', 80, 88), e('2026-07-19', 81.5, 88)]).waistUp,
    ).toBe(false);
    // exactly 1.0 cm counts; just under it doesn't (float-noise safe)
    expect(
      checkinStatus([e('2026-07-05', 80, 88.1), e('2026-07-19', 80, 89.1)]).waistUp,
    ).toBe(true);
    expect(
      checkinStatus([e('2026-07-05', 80, 88.2), e('2026-07-19', 80, 89.1)]).waistUp,
    ).toBe(false);
    // the old 0.3 noise floor is no longer an alarm
    expect(
      checkinStatus([e('2026-07-05', 80, 88.1), e('2026-07-19', 80, 88.4)]).waistUp,
    ).toBe(false);
    expect(
      checkinStatus([e('2026-07-05', 80, 88), e('2026-07-19', 80, 88.9)]).waistUp,
    ).toBe(false);
    // a waist going DOWN is never an alarm
    const down = checkinStatus([e('2026-07-05', 80, 89), e('2026-07-19', 80, 88)]);
    expect(down.waistUp).toBe(false);
    expect(down.state).toBe('trending');
  });

  // The building statuses read the two directions separately: weight down
  // WITHOUT the waist down is the 'losing' alarm in the UI (muscle, not fat).
  it('reports weightDown and waistDown separately, past the 0.3 noise floor', () => {
    const losing = checkinStatus([e('2026-07-05', 82, 90), e('2026-07-19', 81.5, 90)]);
    expect(losing.weightDown).toBe(true);
    expect(losing.waistDown).toBe(false);
    expect(losing.state).toBe('trending');
    const cutting = checkinStatus([e('2026-07-05', 82, 90), e('2026-07-19', 81.5, 89.5)]);
    expect(cutting.weightDown).toBe(true);
    expect(cutting.waistDown).toBe(true);
    // exactly 0.3 counts on both; 0.2 doesn't
    const edge = checkinStatus([e('2026-07-05', 82.3, 90.3), e('2026-07-19', 82, 90)]);
    expect(edge.weightDown).toBe(true);
    expect(edge.waistDown).toBe(true);
    const flat = checkinStatus([e('2026-07-05', 82.2, 90.2), e('2026-07-19', 82, 90)]);
    expect(flat.weightDown).toBe(false);
    expect(flat.waistDown).toBe(false);
    // gaining never reads as down
    const gain = checkinStatus([e('2026-07-05', 80, 88), e('2026-07-19', 81, 88.5)]);
    expect(gain.weightDown).toBe(false);
    expect(gain.waistDown).toBe(false);
    // no reference yet → no direction at all
    expect(
      checkinStatus([e('2026-07-12', 80, 88), e('2026-07-19', 79, 87)]).weightDown,
    ).toBeUndefined();
  });

  it('carries no waistUp until there is a two-week reference', () => {
    expect(checkinStatus([]).waistUp).toBeUndefined();
    expect(
      checkinStatus([e('2026-07-12', 80, 88), e('2026-07-19', 81, 90)]).waistUp,
    ).toBeUndefined();
  });
});

// ── bodyKgAsOf (2026-08-12): kcal uses the weight he had WHEN he trained ────
import { bodyKgAsOf } from '../../src/workout/checkin.js';

describe('bodyKgAsOf', () => {
  const list = addCheckin(
    addCheckin([], { date: '2026-08-01', weightKg: 80, waistCm: 86 }),
    { date: '2026-08-10', weightKg: 78, waistCm: 85 },
  );

  it('a new check-in changes the NEXT workouts, never the previous ones', () => {
    expect(bodyKgAsOf(list, '2026-08-05T10:00:00Z')).toBe(80); // before the drop
    expect(bodyKgAsOf(list, '2026-08-11T10:00:00Z')).toBe(78); // after it
    expect(bodyKgAsOf(list, '2026-08-10')).toBe(78); // check-in day itself
  });

  it('sessions older than every check-in use the earliest, not the latest', () => {
    expect(bodyKgAsOf(list, '2026-07-20')).toBe(80);
  });

  it('falls back with no check-ins at all', () => {
    expect(bodyKgAsOf([], '2026-08-05')).toBe(80);
    expect(bodyKgAsOf(null, '2026-08-05', 75)).toBe(75);
  });
});
