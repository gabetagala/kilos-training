import { describe, expect, it } from 'vitest';
import { ART_MANIFEST } from '../../scripts/art-manifest.mjs';
import { PROGRAM_EXERCISES } from '../../src/workout/program.js';
import { REHAB_EXERCISES } from '../../src/workout/rehab.js';

const GUIDED = { ...REHAB_EXERCISES, ...PROGRAM_EXERCISES };

describe('ART_MANIFEST', () => {
  it('only describes exercises that exist (typo guard)', () => {
    for (const id of Object.keys(ART_MANIFEST)) {
      expect(GUIDED[id], `unknown exercise id: ${id}`).toBeDefined();
    }
  });

  it('covers every guided exercise — no silent art gaps', () => {
    for (const id of Object.keys(GUIDED)) {
      expect(ART_MANIFEST[id], `no art prompts for: ${id}`).toBeDefined();
    }
  });

  it('every entry has a scene and a standalone start pose', () => {
    for (const [id, entry] of Object.entries(ART_MANIFEST)) {
      expect(entry.scene?.length, `${id}: empty scene`).toBeGreaterThan(10);
      expect(entry.a?.length, `${id}: empty pose a`).toBeGreaterThan(10);
    }
  });

  it('poses stand alone — no two-figure layout language (each pose is its own API call)', () => {
    for (const [id, entry] of Object.entries(ART_MANIFEST)) {
      for (const field of [entry.scene, entry.a, entry.b ?? '']) {
        expect(field, `${id}: contains LEFT/RIGHT figure language`).not.toMatch(
          /LEFT figure|RIGHT figure/,
        );
      }
    }
  });
});
