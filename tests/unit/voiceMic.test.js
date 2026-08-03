import { describe, expect, it } from 'vitest';
import { mayInterject, ttsWindowMs } from '../../src/workout/voiceMic.js';

const T = 100_000; // arbitrary "now"

const state = (over = {}) => ({
  now: T,
  announceUntil: 0,
  announceLive: false,
  bufUntil: 0,
  ...over,
});

describe('mayInterject — counts (no cut)', () => {
  it('speaks on a free mic', () => {
    expect(mayInterject(state())).toEqual({ speak: true, stopBuf: false });
  });

  it('drops while an announcement window is claimed', () => {
    expect(mayInterject(state({ announceUntil: T + 500 }))).toEqual({
      speak: false,
      stopBuf: false,
    });
  });

  it('drops while an announcement source is audibly live, even with a stale window', () => {
    // window arithmetic drifted to "free" but the chain / TTS is still talking
    expect(
      mayInterject(state({ announceUntil: T - 1, announceLive: true })),
    ).toEqual({ speak: false, stopBuf: false });
  });

  it('drops while another count still has real tail left', () => {
    expect(mayInterject(state({ bufUntil: T + 121 }))).toEqual({
      speak: false,
      stopBuf: false,
    });
  });

  it('speaks over a nearly-finished count (fade tail only)', () => {
    expect(mayInterject(state({ bufUntil: T + 120 }))).toEqual({
      speak: true,
      stopBuf: false,
    });
  });
});

describe('mayInterject — phase words (cut)', () => {
  const cut = { cut: true };

  it('cuts a lingering count so the beat lands clean', () => {
    expect(mayInterject(state({ bufUntil: T + 800 }), cut)).toEqual({
      speak: true,
      stopBuf: true,
    });
  });

  it('lets a 30ms fade tail ring out instead of cutting', () => {
    expect(mayInterject(state({ bufUntil: T + 30 }), cut)).toEqual({
      speak: true,
      stopBuf: false,
    });
  });

  it('still never talks over an announcement', () => {
    expect(mayInterject(state({ announceUntil: T + 500 }), cut)).toEqual({
      speak: false,
      stopBuf: false,
    });
    expect(mayInterject(state({ announceLive: true }), cut)).toEqual({
      speak: false,
      stopBuf: false,
    });
  });
});

describe('ttsWindowMs', () => {
  it('scales with word count', () => {
    expect(ttsWindowMs('Rest. Next — Front Squat, left side')).toBeGreaterThan(
      ttsWindowMs('Rest'),
    );
  });

  it('never claims less than a beat, even for empty text', () => {
    expect(ttsWindowMs('')).toBeGreaterThanOrEqual(900);
    expect(ttsWindowMs(null)).toBeGreaterThanOrEqual(900);
  });

  it('caps runaway phrases so a bad estimate cannot hold the mic forever', () => {
    expect(ttsWindowMs('word '.repeat(200))).toBeLessThanOrEqual(8000);
  });

  it('a one-word cue stays clear of the next tempo beat', () => {
    // counts arrive every ~1s; a bare number must release the mic in time
    expect(ttsWindowMs('three')).toBeLessThanOrEqual(1000);
  });
});
