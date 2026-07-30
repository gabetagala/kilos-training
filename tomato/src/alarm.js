// ALL sound lives on the VIEWER. The cam phone never makes a sound —
// Gabe's rule: nothing may ever wake the baby. Dual-path output (blessed
// looping <audio> + AudioContext oscillators) because iOS silent mode can
// mute Web Audio while media-element playback ignores it (SCOPE §4.2).
// Loudness follows the hardware media volume — iOS ignores element
// volume — so the Test button is the only real proof.
//
// Styles: gentle (soft bell triad + calm popup, default) and loud
// (two-tone siren + flashing popup). The viewer escalates gentle → loud
// when an alarm goes unanswered — calm first, but never sleep-through-able.
let ctx = null;
let style = 'gentle';
const els = { gentle: null, loud: null, ding: null };
let elBlessed = false;
let sirenOn = false;
let sirenReason = null; // 'real' | 'test' — a test must never silence a real alarm

function ensureCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  return ctx;
}

function resumeCtx() {
  try {
    ensureCtx();
    if (ctx.state !== 'running') ctx.resume?.().catch(() => {});
  } catch {
    /* best-effort */
  }
}

function wavUrl(seconds, sampleAt) {
  const sr = 8000;
  const n = Math.round(sr * seconds);
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const w = (o, s) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  w(0, 'RIFF');
  v.setUint32(4, 36 + n * 2, true);
  w(8, 'WAVEfmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sr, true);
  v.setUint32(28, sr * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  w(36, 'data');
  v.setUint32(40, n * 2, true);
  const data = new Int16Array(buf, 44);
  for (let i = 0; i < n; i++) data[i] = Math.round(sampleAt(i / sr) * 32767);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

// Gentle: three soft bell notes (C5 E5 G5) with warm decay, then rest.
function gentleSample(t) {
  const notes = [
    [0.0, 523.25],
    [0.4, 659.25],
    [0.8, 783.99],
  ];
  let s = 0;
  for (const [start, f] of notes) {
    if (t >= start) {
      const dt = t - start;
      s += Math.sin(2 * Math.PI * f * dt) * Math.exp(-dt / 0.28) * 0.4;
    }
  }
  return Math.max(-0.95, Math.min(0.95, s));
}

// Loud: alternating two-tone siren with tremolo.
function loudSample(t) {
  const f = Math.floor(t / 0.35) % 2 ? 950 : 700;
  const tremolo = 0.75 + 0.25 * Math.sin(2 * Math.PI * 5 * t);
  return Math.sin(2 * Math.PI * f * t) * tremolo * 0.9;
}

// Ding: short double beep — media-element fallback for chirp/chime when
// the AudioContext is suspended (post-interruption).
function dingSample(t) {
  const on = t < 0.15 || (t > 0.25 && t < 0.4) ? 1 : 0;
  return Math.sin(2 * Math.PI * 880 * t) * 0.5 * on;
}

// Returns false when the oscillator path can't sound right now.
function beep(freq, dur, delay = 0, vol = 0.5) {
  try {
    ensureCtx();
    if (ctx.state !== 'running') {
      resumeCtx();
      return false;
    }
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = freq;
    g.gain.value = vol;
    o.connect(g);
    g.connect(ctx.destination);
    const t = ctx.currentTime + delay;
    o.start(t);
    o.stop(t + dur);
    return true;
  } catch {
    return false;
  }
}

function playDing() {
  try {
    if (!elBlessed) return;
    els.ding.currentTime = 0;
    els.ding.play().catch(() => {});
  } catch {
    /* fallback only */
  }
}

function oscLoop() {
  if (!sirenOn) return;
  if (style === 'loud') {
    beep(700, 0.3, 0, 0.9);
    beep(950, 0.3, 0.35, 0.9);
    setTimeout(oscLoop, 750);
  } else {
    beep(523.25, 0.25, 0, 0.18);
    beep(659.25, 0.25, 0.4, 0.18);
    beep(783.99, 0.35, 0.8, 0.18);
    setTimeout(oscLoop, 2400);
  }
}

export const alarmSound = {
  init() {
    els.gentle = new Audio(wavUrl(2.4, gentleSample));
    els.loud = new Audio(wavUrl(1.4, loudSample));
    els.ding = new Audio(wavUrl(0.5, dingSample));
    els.gentle.loop = true;
    els.loud.loop = true;
    try {
      if (navigator.audioSession) navigator.audioSession.type = 'playback';
    } catch {
      /* hint only */
    }
  },

  setStyle(s) {
    if (s !== 'gentle' && s !== 'loud') return;
    const wasOn = sirenOn;
    const reason = sirenReason;
    if (wasOn) this.siren(false);
    style = s;
    if (wasOn) this.siren(true, reason ?? 'real');
  },

  getStyle: () => style,

  isArmed: () => elBlessed || ctx?.state === 'running',

  // Call from a user gesture (pointerup/click). play()/resume() start
  // synchronously inside the handler so iOS counts the activation; a
  // timeout race keeps the promise settling even if resume() hangs.
  bless() {
    try {
      ensureCtx();
      const timeout = new Promise((res) => {
        setTimeout(res, 1500);
      });
      const pCtx = Promise.race([ctx.resume?.() ?? Promise.resolve(), timeout]);
      const keys = ['gentle', 'loud', 'ding'];
      const plays = keys.map((k) => {
        if (sirenOn && k === style) return Promise.reject(new Error('siren-live')); // never touch a live siren
        els[k].muted = true;
        return els[k].play();
      });
      return Promise.race([
        Promise.allSettled([pCtx, ...plays]).then((results) => {
          keys.forEach((k, i) => {
            const r = results[i + 1];
            if (r.status === 'fulfilled') {
              if (!(sirenOn && k === style)) {
                els[k].pause();
                els[k].currentTime = 0;
              }
              elBlessed = true;
            }
            els[k].muted = false;
          });
          return this.isArmed();
        }),
        new Promise((res) => {
          setTimeout(() => res(this.isArmed()), 2500);
        }),
      ]);
    } catch {
      return Promise.resolve(this.isArmed());
    }
  },

  // Cheap, safe to call from every tap + visibilitychange: revives a
  // suspended context after an iOS interruption (call, Siri, alarm).
  poke() {
    resumeCtx();
    if (!this.isArmed()) return this.bless();
    return Promise.resolve(true);
  },

  chirp() {
    const ok = beep(880, 0.15, 0);
    beep(880, 0.15, 0.25);
    if (!ok) playDing();
  },

  chime() {
    const ok = beep(620, 0.12, 0, 0.35);
    beep(830, 0.18, 0.15, 0.35);
    if (!ok) playDing();
  },

  siren(on, reason = 'real') {
    if (on) {
      if (reason === 'real') sirenReason = 'real'; // real always wins
      else if (!sirenOn) sirenReason = 'test';
      if (sirenOn) return;
      sirenOn = true;
      resumeCtx();
      try {
        const el = els[style];
        el.muted = false;
        el.play().catch(() => {});
        oscLoop();
      } catch {
        /* keep state consistent even if one path throws */
      }
    } else {
      if (!sirenOn) return;
      sirenOn = false;
      sirenReason = null;
      try {
        for (const k of ['gentle', 'loud']) {
          els[k].pause();
          els[k].currentTime = 0;
        }
      } catch {
        /* already stopped */
      }
    }
  },

  test(ms = 2500) {
    this.siren(true, 'test');
    setTimeout(() => {
      if (sirenReason === 'test') this.siren(false);
    }, ms);
  },
};
