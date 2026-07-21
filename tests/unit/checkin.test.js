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
});
