import { describe, expect, it } from 'vitest';
import { NUM_SLUGS, phaseWordSlug, tempoBeatSlug } from '../../src/workout/tempoCues.js';

// Real patterns from the programs
const FLOOR_PRESS = { reps: 8, pattern: [['DOWN', 2], ['UP', 1]] };
const BRIDGE = { reps: 10, pattern: [['LIFT', 1], ['SQUEEZE', 2], ['LOWER', 2]] };
const RDL = { reps: 5, pattern: [['DOWN', 3], ['LIFT', 1]] };

const st = (rep, label, phaseSec, phaseLen) => ({ rep, label, phaseSec, phaseLen });

describe('tempoBeatSlug — rep counting (the floor-press fix)', () => {
  it('speaks the rep number on each rep-start beat', () => {
    expect(tempoBeatSlug(st(1, 'DOWN', 0, 2), FLOOR_PRESS)).toBe('one');
    expect(tempoBeatSlug(st(4, 'DOWN', 0, 2), FLOOR_PRESS)).toBe('four');
    expect(tempoBeatSlug(st(2, 'LIFT', 0, 1), BRIDGE)).toBe('two');
  });

  it('keeps phase words on non-rep-start boundaries', () => {
    expect(tempoBeatSlug(st(1, 'UP', 0, 1), FLOOR_PRESS)).toBe('lift');
    expect(tempoBeatSlug(st(3, 'SQUEEZE', 0, 2), BRIDGE)).toBe('squeeze');
    expect(tempoBeatSlug(st(3, 'LOWER', 0, 2), BRIDGE)).toBe('lower');
  });

  it('milestones own the rep-start beat: last-three on long sets, last-one at the end', () => {
    expect(tempoBeatSlug(st(6, 'DOWN', 0, 2), FLOOR_PRESS)).toBe('last-three');
    expect(tempoBeatSlug(st(8, 'DOWN', 0, 2), FLOOR_PRESS)).toBe('last-one');
    expect(tempoBeatSlug(st(8, 'LIFT', 0, 1), BRIDGE)).toBe('last-three');
    expect(tempoBeatSlug(st(10, 'LIFT', 0, 1), BRIDGE)).toBe('last-one');
    // 5-rep set: no "last three" push (too short), but the last rep still lands
    expect(tempoBeatSlug(st(3, 'DOWN', 0, 3), RDL)).toBe('three');
    expect(tempoBeatSlug(st(5, 'DOWN', 0, 3), RDL)).toBe('last-one');
  });

  it('paces long phases with in-phase counts, leaves short phases silent', () => {
    expect(tempoBeatSlug(st(1, 'DOWN', 1, 3), RDL)).toBe('two');
    expect(tempoBeatSlug(st(1, 'DOWN', 2, 3), RDL)).toBe('three');
    expect(tempoBeatSlug(st(1, 'DOWN', 1, 2), FLOOR_PRESS)).toBeNull();
    expect(tempoBeatSlug(st(3, 'SQUEEZE', 1, 2), BRIDGE)).toBeNull();
  });

  it('falls back to the phase word past the counted range (rep 11+)', () => {
    const long = { reps: 12, pattern: [['DOWN', 2], ['UP', 1]] };
    expect(tempoBeatSlug(st(11, 'DOWN', 0, 2), long)).toBe('lower');
    expect(NUM_SLUGS[11]).toBeUndefined();
  });

  it('survives a missing pattern (defensive: never throws mid-set)', () => {
    expect(tempoBeatSlug(st(1, 'LIFT', 0, 1), { reps: 8 })).toBe('lift');
  });
});

describe('phaseWordSlug', () => {
  it('maps every label family', () => {
    expect(phaseWordSlug('UP')).toBe('lift');
    expect(phaseWordSlug('LIFT')).toBe('lift');
    expect(phaseWordSlug('SQUEEZE')).toBe('squeeze');
    expect(phaseWordSlug('PAUSE')).toBe('hold');
    expect(phaseWordSlug('DOWN')).toBe('lower');
  });
});
