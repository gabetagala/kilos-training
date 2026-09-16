import { describe, expect, it } from 'vitest';
import {
  TTS_ONLY,
  announceCue,
  needsName,
  numberSlug,
  rxCue,
} from '../../src/workout/announce.js';

const EX = {
  rdl: { name: 'RDL' },
  'band-pull-apart': { name: 'Band Pull-Apart' },
  'farmer-carry': { name: 'Farmer Carry' },
};
const nextWorkLabel = (q, i) => {
  const n = q.slice(i + 1).find((s) => s.kind === 'work');
  return n ? `${EX[n.exId].name}${n.side ? ` · ${n.side}` : ''}` : 'FINISH';
};
const cue = (q, i, minimal = true) =>
  announceCue(q, i, { minimal, exercises: EX, nextWorkLabel });

const prep = (exId) => ({ kind: 'prep', exId, secs: 10, phase: 'GET SET' });
const rest = (exId, secs = 20) => ({ kind: 'rest', exId, secs, phase: 'REST' });
const minute = (exId, reps, extra = {}) => ({
  kind: 'work',
  exId,
  secs: 60,
  emom: true,
  piece: 'The Spread',
  phase: 'GO',
  reps,
  ...extra,
});

describe('numberSlug', () => {
  it('names every number the program can prescribe', () => {
    expect(numberSlug(1)).toBe('one');
    expect(numberSlug(11)).toBe('eleven');
    expect(numberSlug(20)).toBe('twenty');
    expect(numberSlug(21)).toBe('twenty-one');
    expect(numberSlug(46)).toBe('forty-six');
    expect(numberSlug('45')).toBe('forty-five');
  });
  it('is null outside 1–99 (a clip cannot exist)', () => {
    expect(numberSlug(0)).toBeNull();
    expect(numberSlug(100)).toBeNull();
    expect(numberSlug('build')).toBeNull();
  });
});

describe('rxCue — the spoken prescription', () => {
  it('speaks any rep count as a clip, not a TTS fallback', () => {
    expect(rxCue({ reps: '11' }).parts).toEqual(['eleven', 'reps']);
    expect(rxCue({ reps: '46' }).parts).toEqual(['forty-six', 'reps']);
  });
  it('speaks the unit of a carry', () => {
    expect(rxCue({ reps: '1 length' })).toEqual({
      parts: ['one', 'length'],
      text: '1 length',
    });
    expect(rxCue({ reps: '2 lengths' }).parts).toEqual(['two', 'lengths']);
  });
  it('speaks timed stations in seconds', () => {
    expect(rxCue({ workSecs: 15 }).parts).toEqual(['fifteen', 'seconds']);
    expect(rxCue({ workSecs: 45 }).parts).toEqual(['forty-five', 'seconds']);
  });
  it('adds "each side" for per-side prescriptions', () => {
    expect(rxCue({ reps: '5/side' }).parts).toEqual(['five', 'reps', 'each-side']);
    expect(rxCue({ reps: '6/leg' }).parts).toEqual(['six', 'reps', 'each-side']);
  });
  it('is silent for a build-up and only ever TTS for an unspeakable number', () => {
    expect(rxCue({ reps: 'build' })).toBeNull();
    expect(rxCue({ reps: '120' }).parts).toEqual([TTS_ONLY]);
  });
});

describe('needsName — the movement is named when it changes', () => {
  const q = [
    prep('rdl'),
    minute('rdl', '10'),
    minute('band-pull-apart', '12'),
    minute('band-pull-apart', '12'),
    rest('band-pull-apart'),
    minute('rdl', '10'),
  ];
  it('not right after its prep', () => expect(needsName(q, 1)).toBe(false));
  it('when a metcon minute changes movement', () =>
    expect(needsName(q, 2)).toBe(true));
  it('not when the next minute is the same movement', () =>
    expect(needsName(q, 3)).toBe(false));
  it('again after a round rest — the rest named it a while ago', () =>
    expect(needsName(q, 5)).toBe(true));
  it('never on a rest or prep step', () => {
    expect(needsName(q, 0)).toBe(false);
    expect(needsName(q, 4)).toBe(false);
  });
});

describe('announceCue — minimal coach', () => {
  const q = [
    prep('rdl'),
    minute('rdl', '10'),
    minute('band-pull-apart', '12'),
    rest('band-pull-apart'),
    minute('rdl', '10'),
  ];
  it('a prep says the name', () =>
    expect(cue(q, 0)).toEqual({ parts: ['name-rdl'], text: 'RDL' }));
  it('the first minute says only the number — the prep just named it', () =>
    expect(cue(q, 1)).toEqual({ parts: ['ten', 'reps'], text: '10 reps' }));
  it('a minute that changes movement says the name THEN the number', () =>
    expect(cue(q, 2)).toEqual({
      parts: ['name-band-pull-apart', 'twelve', 'reps'],
      text: 'Band Pull-Apart — 12 reps',
    }));
  it('a round rest says what is next', () =>
    expect(cue(q, 3)).toEqual({
      parts: ['next', 'name-rdl'],
      text: 'Next — RDL',
    }));
  it('a for-time station (manual, in a piece) is announced too', () => {
    const ft = [
      prep('farmer-carry'),
      { kind: 'work', exId: 'farmer-carry', manual: true, piece: 'Crawl & Haul', phase: 'GO', reps: '1 length' },
      { kind: 'work', exId: 'rdl', manual: true, piece: 'Crawl & Haul', phase: 'GO', reps: '8' },
    ];
    expect(cue(ft, 1).parts).toEqual(['one', 'length']);
    expect(cue(ft, 2).parts).toEqual(['name-rdl', 'eight', 'reps']);
  });
  it('a plain self-paced lifting set stays silent (its prep spoke)', () => {
    const lift = [
      prep('rdl'),
      { kind: 'work', exId: 'rdl', manual: true, phase: 'YOUR PACE', reps: '5–8' },
    ];
    expect(cue(lift, 1)).toBeNull();
  });
});

describe('announceCue — full coach', () => {
  it('a minute that changes movement: name, number, go', () => {
    const q = [prep('rdl'), minute('rdl', '10'), minute('band-pull-apart', '12')];
    expect(cue(q, 2, false)).toEqual({
      parts: ['name-band-pull-apart', 'twelve', 'reps', 'go'],
      text: 'Band Pull-Apart — 12 reps — Go',
    });
  });
  it('a rest into a new movement says rest, then next', () => {
    const q = [minute('rdl', '10'), rest('rdl'), minute('band-pull-apart', '12', { side: 'LEFT' })];
    expect(cue(q, 1, false)).toEqual({
      parts: ['rest', 'next', 'name-band-pull-apart', 'left-side'],
      text: 'Rest. Next — Band Pull-Apart , LEFT',
    });
  });
  it('the last self-paced set of an exercise says so', () => {
    const q = [
      prep('rdl'),
      { kind: 'work', exId: 'rdl', manual: true, reps: '8' },
      rest('rdl'),
      { kind: 'work', exId: 'rdl', manual: true, reps: '8' },
    ];
    expect(cue(q, 1, false).parts).toEqual(['your-pace']);
    expect(cue(q, 3, false).parts).toEqual(['last-set']);
  });
});
