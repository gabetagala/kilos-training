import { describe, expect, it } from 'vitest';
import { FORM_CUES, pickFormCue } from '../../src/workout/formCues.js';
import { PROGRAM_EXERCISES } from '../../src/workout/program.js';
import { REHAB_EXERCISES } from '../../src/workout/rehab.js';

const GUIDED = { ...REHAB_EXERCISES, ...PROGRAM_EXERCISES };

describe('FORM_CUES library', () => {
  it('only cues exercises that actually exist (typo guard)', () => {
    for (const exId of Object.keys(FORM_CUES)) {
      expect(GUIDED[exId], `unknown exercise id: ${exId}`).toBeDefined();
    }
  });

  it('slugs are unique, kebab-case, and cue- prefixed (file naming contract)', () => {
    const all = Object.values(FORM_CUES).flat();
    const slugs = all.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) {
      expect(slug).toMatch(/^cue-[a-z0-9-]+$/);
    }
  });

  it('every line is a short spoken phrase, not a paragraph', () => {
    for (const cue of Object.values(FORM_CUES).flat()) {
      expect(cue.text.length).toBeGreaterThan(0);
      expect(cue.text.length).toBeLessThanOrEqual(40);
    }
  });
});

describe('pickFormCue', () => {
  it('returns null for an exercise with no lines', () => {
    expect(pickFormCue('no-such-exercise', 0)).toBeNull();
  });

  it('is deterministic and walks the list across seeds', () => {
    const list = FORM_CUES['mcgill-curlup'];
    expect(list.length).toBeGreaterThan(1);
    expect(pickFormCue('mcgill-curlup', 0)).toBe(list[0]);
    expect(pickFormCue('mcgill-curlup', 1)).toBe(list[1]);
    expect(pickFormCue('mcgill-curlup', list.length)).toBe(list[0]);
    expect(pickFormCue('mcgill-curlup', 0)).toBe(pickFormCue('mcgill-curlup', 0));
  });

  it('survives negative seeds (defensive: rotation math must never throw)', () => {
    expect(pickFormCue('rdl', -1)).toBeTruthy();
  });
});
