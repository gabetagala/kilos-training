import { describe, expect, it } from 'vitest';
import {
  comebackAdvice,
  daysSince,
  GAP_EASE,
  GAP_EASE_LOAD,
  GAP_RESTART,
  lastSessionDate,
} from '../../src/workout/comeback.js';

const at = (iso) => new Date(iso);

describe('daysSince', () => {
  it('counts calendar days, not elapsed hours', () => {
    // 6am yesterday → 9pm today is ONE day off, not two
    expect(
      daysSince('2026-09-22T06:00:00', at('2026-09-23T21:00:00')),
    ).toBe(1);
    expect(daysSince('2026-09-23T05:00:00', at('2026-09-23T23:00:00'))).toBe(0);
    expect(daysSince('2026-09-09T18:00:00', at('2026-09-23T07:00:00'))).toBe(14);
  });

  it('is null-safe and never negative', () => {
    expect(daysSince(null)).toBe(null);
    expect(daysSince('not a date')).toBe(null);
    expect(daysSince('2026-09-25T06:00:00', at('2026-09-23T06:00:00'))).toBe(0);
  });
});

describe('comebackAdvice', () => {
  it('says nothing at all for a normal week', () => {
    for (const d of [null, 0, 1]) {
      expect(comebackAdvice(d)).toMatchObject({ level: 'none', dose: null, easeLoad: false });
    }
  });

  it('never prescribes making up a missed session', () => {
    const a = comebackAdvice(2);
    expect(a.level).toBe('carry-on');
    expect(a.dose).toBe(null); // the full day, as written
    expect(a.note).toMatch(/nothing to make up/i);
  });

  it('leads with the short day from three days off, weights unchanged', () => {
    const a = comebackAdvice(GAP_EASE);
    expect(a).toMatchObject({ level: 'ease', dose: 'short', easeLoad: false });
    expect(comebackAdvice(6).level).toBe('ease');
  });

  it('eases the load too from a week off', () => {
    const a = comebackAdvice(GAP_EASE_LOAD);
    expect(a).toMatchObject({ level: 'ease-load', dose: 'short', easeLoad: true });
    expect(comebackAdvice(13).level).toBe('ease-load');
  });

  it('points at a restart from a fortnight off', () => {
    const a = comebackAdvice(GAP_RESTART);
    expect(a).toMatchObject({ level: 'restart', dose: 'short', easeLoad: true });
    expect(a.note).toMatch(/restart/i);
    expect(comebackAdvice(90).level).toBe('restart');
  });

  it('escalates monotonically — more days off is never lighter advice', () => {
    const rank = { none: 0, 'carry-on': 1, ease: 2, 'ease-load': 3, restart: 4 };
    let last = 0;
    for (let d = 0; d <= 40; d++) {
      const r = rank[comebackAdvice(d).level];
      expect(r).toBeGreaterThanOrEqual(last);
      last = r;
    }
  });

  it('always carries the headline and note it advises with', () => {
    for (const d of [2, 3, 7, 14]) {
      const a = comebackAdvice(d);
      expect(a.headline).toBe(`${d} days off`);
      expect(a.note.length).toBeGreaterThan(10);
    }
  });
});

describe('lastSessionDate', () => {
  it('finds the most recent session whatever the order', () => {
    const h = [
      { date: '2026-09-01T08:00:00.000Z' },
      { date: '2026-09-20T08:00:00.000Z' },
      { date: '2026-09-10T08:00:00.000Z' },
    ];
    expect(lastSessionDate(h)).toBe(new Date('2026-09-20T08:00:00.000Z').toISOString());
  });

  it('counts a salvaged partial as training — he showed up', () => {
    const h = [
      { date: '2026-09-01T08:00:00.000Z' },
      { date: '2026-09-22T08:00:00.000Z', interrupted: true },
    ];
    expect(daysSince(lastSessionDate(h), at('2026-09-23T08:00:00'))).toBe(1);
  });

  it('survives junk and emptiness', () => {
    expect(lastSessionDate([])).toBe(null);
    expect(lastSessionDate()).toBe(null);
    expect(lastSessionDate([{}, { date: 'nope' }])).toBe(null);
  });
});
