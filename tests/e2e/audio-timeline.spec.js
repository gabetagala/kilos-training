import { expect, test } from '@playwright/test';
import { announceCue } from '../../src/workout/announce.js';
import { applyFormats, applyPhase, blockState, phaseSwaps } from '../../src/workout/block.js';
import { PROGRAM_EXERCISES, getProgramSession } from '../../src/workout/program.js';
import {
  REHAB_EXERCISES,
  buildStepQueue,
  getRehabSession,
  nextWorkLabel,
} from '../../src/workout/rehab.js';
import { dismissOnboarding } from './helpers.js';

// THE COACH'S AUDIO, AS A TIMELINE (2026-09-16, his report: overlapped or
// mixed audio, cues missing, cues too early). Ears can't run in CI, so this
// records what the audio graph was actually asked to do — every decoded clip
// (tagged with its slug), every buffer start/stop, every oscillator — on the
// page's logical clock, drives a whole session on a fake clock, and then
// checks the recording:
//   1. no two voice sources ever overlap (a cut phrase counts as ended)
//   2. no tone is still audible when a phrase starts, and none lands inside one
//   3. the words spoken are EXACTLY what announce.js says they should be,
//      in order, for every step traversed
//   4. a screen-lock-style gap past a step's end announces nothing until
//      the play tap, and the play tap does announce
//   5. nothing fell through to speechSynthesis; every clip decoded
// WebKit at an iPhone viewport — the engine in his hand, not its OS: what
// iOS does to a parked context or a silent switch is outside this test.

const INSTRUMENT = () => {
  const log = { events: [], decodes: { pending: 0, ok: 0, fail: 0 }, tts: [] };
  window.__audio = log;
  log.mark = (name) => log.events.push({ kind: 'mark', name, at: Date.now() });
  const urlByAB = new WeakMap(); // ArrayBuffer → /voice/<slug>.m4a
  const slugByBuf = new WeakMap(); // AudioBuffer → slug
  const origFetch = window.fetch;
  window.fetch = async function (input, init) {
    const res = await origFetch.call(this, input, init);
    const url = typeof input === 'string' ? input : input?.url;
    if (url?.includes('/voice/')) {
      const ab = res.arrayBuffer.bind(res);
      res.arrayBuffer = async () => {
        const b = await ab();
        urlByAB.set(b, url);
        return b;
      };
    }
    return res;
  };
  const AC = window.AudioContext || window.webkitAudioContext;
  const origDecode = AC.prototype.decodeAudioData;
  AC.prototype.decodeAudioData = function (ab, ...rest) {
    log.decodes.pending += 1;
    return origDecode.call(this, ab, ...rest).then(
      (buf) => {
        log.decodes.pending -= 1;
        log.decodes.ok += 1;
        const u = urlByAB.get(ab);
        slugByBuf.set(buf, u ? u.match(/\/voice\/([^./]+)/)?.[1] || u : '?');
        return buf;
      },
      (e) => {
        log.decodes.pending -= 1;
        log.decodes.fail += 1;
        throw e;
      },
    );
  };
  const offsetMs = (node, when) =>
    Math.max(0, (when ?? 0) - node.context.currentTime) * 1000;
  const BS = window.AudioBufferSourceNode.prototype;
  const bsStart = BS.start;
  const bsStop = BS.stop;
  BS.start = function (when, ...rest) {
    const offset = offsetMs(this, when);
    const ev = {
      kind: 'voice',
      slug: slugByBuf.get(this.buffer) || '?',
      at: Date.now() + offset,
      dur: (this.buffer?.duration || 0) * 1000,
      state: this.context.state,
      stoppedAt: null,
    };
    this.__ev = ev;
    log.events.push(ev);
    // Project playback onto the PAGE clock: the app's onended fires when the
    // (fake) page clock reaches the clip's end, or right after a stop —
    // never on the real audio clock. The session runs on the fake clock, so
    // this is what makes cuts and mic releases land exactly where they
    // would on a phone, where the two clocks are one.
    let handler = null;
    Object.defineProperty(this, 'onended', {
      configurable: true,
      get: () => handler,
      set: (fn) => {
        handler = fn;
      },
    });
    let fired = false;
    this.__fire = () => {
      if (fired) return;
      fired = true;
      handler?.call(this, { type: 'ended' });
    };
    setTimeout(this.__fire, offset + ev.dur);
    return bsStart.call(this, when, ...rest);
  };
  BS.stop = function (...a) {
    if (this.__ev && this.__ev.stoppedAt == null) {
      this.__ev.stoppedAt = Date.now();
      setTimeout(this.__fire, 0);
    }
    return bsStop.apply(this, a);
  };
  const OS = window.OscillatorNode.prototype;
  const osStart = OS.start;
  const osStop = OS.stop;
  OS.start = function (when, ...rest) {
    const ev = {
      kind: 'tone',
      freq: Math.round(this.frequency.value),
      at: Date.now() + offsetMs(this, when),
      dur: 0,
    };
    this.__ev = ev;
    log.events.push(ev);
    return osStart.call(this, when, ...rest);
  };
  OS.stop = function (when, ...rest) {
    if (this.__ev && when != null) {
      this.__ev.dur =
        (when - this.context.currentTime) * 1000 - (this.__ev.at - Date.now());
    }
    return osStop.call(this, when, ...rest);
  };
  if (window.speechSynthesis) {
    const ss = window.speechSynthesis;
    const speak = ss.speak.bind(ss);
    ss.speak = (u) => {
      log.tts.push({ at: Date.now(), text: u.text });
      return speak(u);
    };
  }
};

const EX = { ...REHAB_EXERCISES, ...PROGRAM_EXERCISES };
// Words the FULL coach level adds on its own schedule — tempo beats, counts,
// milestones, form lines — which the tick loop drops or cuts by mic rule
// rather than by queue position, so they are allowed anywhere between the
// announcements but nothing else is.
const EXTRA_OK = (slug) =>
  /^(one|two|three|four|five|six|seven|eight|nine|ten|lift|squeeze|lower|hold|last-three|last-one|halfway)$/.test(slug) ||
  slug.startsWith('cue-');
// The tempo click family: by design a click sounds UNDER each tempo word
// (the researched "coach" scheme), so those tones are exempt from the
// tone-vs-voice checks at the full coach level.
const TICK_HZ = new Set([900, 1800, 1350, 2700]);
const queueSig = (q) =>
  q.map((s) => `${s.kind}:${s.exId}:${s.secs || 0}:${s.reps || ''}`).join('|');
const stored = async (page, key) =>
  page.evaluate((k) => {
    const raw = localStorage.getItem(k);
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }, key);
// Every tone decays exponentially to 0.001 of peak; it is inaudible well
// before it stops. -20 dB from a 0.3 peak lands at 40% of the nominal length.
const audibleEnd = (t) => t.at + 0.404 * t.dur;

async function openCard(page, attr, id) {
  await page.locator('.nav-btn[data-screen="train"]').click();
  await page.locator('#btn-rehab-open').click();
  await page.locator(`[data-${attr}="${id}"]`).click();
  await page.locator('#sp-start').click(); // preview first, then Start
  await expect(page.locator('#rehab-player')).toHaveClass(/open/);
}

// A timed step long enough to park the phone in, whose successor is timed
// too and has something to say — the pocket-gap scenario needs all three.
const gapCandidate = (queue, idx, cue) => {
  const s = queue[idx];
  const n = queue[idx + 1];
  return (
    !!s && !s.manual && (s.secs || 0) >= 15 && !!n && !n.manual &&
    !!announceCue(queue, idx + 1, cue)
  );
};

// Week 2 of the block (start = the Monday before this one): a different
// rotation than a fresh profile's week 1, which brings the for-time pieces
// with self-paced stations into the daily session and the Sunday piece.
const WEEK2_START = (() => {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) - 7);
  return d.toISOString().slice(0, 10);
})();

const SCENARIOS = [
  { name: 'EMOM half, skipped to the piece', card: ['d40', 'd40-b1'], piece: true, coach: 'minimal' },
  { name: 'daily rehab session, from the first step', card: ['rehab', 'daily'], piece: false, coach: 'minimal' },
  { name: 'Sunday optional piece (for-time stations)', card: ['rehab', 'wod'], piece: false, coach: 'minimal' },
  { name: 'EMOM half at the FULL coach level', card: ['d40', 'd40-b1'], piece: true, coach: 'full' },
  { name: 'daily rehab session at the FULL coach level', card: ['rehab', 'daily'], piece: false, coach: 'full' },
];

for (const sc of SCENARIOS) {
  test(`audio timeline — ${sc.name}`, async ({ page }) => {
    test.setTimeout(420_000);
    const CUE = { minimal: sc.coach === 'minimal', exercises: EX, nextWorkLabel };
    const errors = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript(INSTRUMENT);
    await page.addInitScript(
      ({ start, coach }) => {
        localStorage.setItem('kilos-block-start', JSON.stringify(start));
        localStorage.setItem('kilos-block-seed-v2', 'true');
        localStorage.setItem('kilos-coach-level', JSON.stringify(coach));
      },
      { start: WEEK2_START, coach: sc.coach },
    );
    await page.goto('/');
    await dismissOnboarding(page);
    await openCard(page, sc.card[0], sc.card[1]);

    // every clip this session can speak is decoded up front — wait for that
    // (real time; the decode is I/O, not a timer)
    for (let i = 0; i < 300; i++) {
      const d = await page.evaluate(() => window.__audio.decodes);
      if (d.pending === 0 && d.ok > 0) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    const decodes = await page.evaluate(() => window.__audio.decodes);
    expect(decodes.fail, 'every clip decodes in WebKit').toBe(0);

    // rebuild the exact queue the player built, and prove it with the
    // player's own fingerprint (program halves get the week's piece formats;
    // rehab sessions open raw — try both shapes)
    const st = await stored(page, 'kilos-rehab-state');
    const b = blockState(await stored(page, 'kilos-block-start'));
    const swaps = { ...phaseSwaps(st.phase), ...((await stored(page, 'kilos-swaps')) || {}) };
    const base = getProgramSession(st.sessionId) || getRehabSession(st.sessionId);
    const shaped = [
      applyFormats(applyPhase(base, st.phase), b.weekInBlock),
      applyPhase(base, st.phase),
    ];
    const queue = shaped
      .map((s) => buildStepQueue(s, swaps, st.variant))
      .find((q) => queueSig(q) === st.queueSig);
    expect(queue, 'reconstructed queue matches the player fingerprint').toBeTruthy();

    // fake clock from here: the session runs in seconds of wall time.
    // Installed BEFORE any skip — skipping an EMOM minute auto-starts the
    // clock, and an interval created on the real clock would never see the
    // fake one advance.
    await page.clock.install();

    if (sc.piece) {
      // skip the self-paced Part A to the piece (announcements fire on every
      // jump — the recording checks those cancellations too)
      for (let i = 0; i < 60; i++) {
        const idx = (await stored(page, 'kilos-rehab-state')).idx;
        if (queue[idx]?.piece) break;
        await page.locator('#rp-skip').click();
        await page.waitForTimeout(60);
      }
    }
    const startIdx = (await stored(page, 'kilos-rehab-state')).idx;
    // the mark goes BEFORE the play tap: a fresh open announces its first
    // step on that tap, with no tone lead, so the cue lands on the tap's
    // own timestamp. (A skip onto a minute auto-played it — nothing to tap.)
    await page.evaluate(() => window.__audio.mark('play'));
    if (await page.locator('#rp-play-icon').isVisible()) {
      await page.locator('#rp-play').click();
    }

    let gapDone = false;
    let gapInfo = '';
    let lastStep = '';
    for (let i = 0; i < 90 * 60; i++) {
      await page.clock.runFor(1000);
      const open = await page.evaluate(() =>
        document.getElementById('rehab-player').classList.contains('open'),
      );
      if (!open) {
        console.log(`t=${i}s player closed`);
        break;
      }
      const phase = (await page.locator('#rp-phase').textContent())?.trim();
      const meta = (await page.locator('#rp-meta').textContent())?.trim();
      const step = `${phase} | ${meta}`;
      if (step !== lastStep) {
        console.log(`t=${i}s ${step}`);
        lastStep = step;
      }
      const idx = (await stored(page, 'kilos-rehab-state'))?.idx ?? -1;
      if (await page.locator('#rp-play-icon').isVisible()) {
        // paused: a self-paced step gets its ✓ (the skip control logs it),
        // anything else gets play
        if (queue[idx]?.manual) {
          // do the station first: a ✓ one second after landing would cut
          // the station's own announcement (newest voice wins) — that is
          // the rule working, not a cue to test
          await page.clock.runFor(3000);
          await page.locator('#rp-skip').click();
        } else {
          await page.locator('#rp-play').click();
        }
        continue;
      }
      if (!gapDone && gapCandidate(queue, idx, CUE)) {
        // the phone goes in a pocket mid-step and comes out 30s after the
        // step should have ended: JS was frozen the whole time, one tick
        // fires on return
        gapDone = true;
        const n = queue[idx + 1];
        gapInfo = `gap during #${idx} ${queue[idx].phase}/${queue[idx].exId} ${queue[idx].secs}s → landing #${idx + 1} ${n.phase}/${n.exId}${n.tempo ? ' tempo' : ''}${n.side ? ` ${n.side}` : ''}`;
        await page.evaluate(() => window.__audio.mark('gap-start'));
        await page.clock.fastForward(queue[idx].secs * 1000 + 30_000);
        await page.evaluate(() => window.__audio.mark('gap-end'));
        await expect(page.locator('#rp-play-icon')).toBeVisible(); // paused
        // mark BEFORE the tap: the tap's own cue lands on the tap's timestamp
        // plus the tone lead, and a slow tap must not turn it into a phantom
        await page.evaluate(() => window.__audio.mark('gap-play'));
        await page.locator('#rp-play').click();
      }
    }

    const log = await page.evaluate(() => JSON.parse(JSON.stringify(window.__audio)));
    const mark = (n) => log.events.find((e) => e.kind === 'mark' && e.name === n)?.at;
    const t0 = mark('play');
    const voice = log.events
      .filter((e) => e.kind === 'voice' && e.at >= t0)
      .map((e) => {
        const natural = e.at + e.dur;
        const end = e.stoppedAt == null ? natural : Math.min(e.stoppedAt, natural);
        return { ...e, end };
      })
      // a source cancelled before its scheduled start never sounded
      .filter((e) => e.end > e.at + 1)
      .sort((a, b) => a.at - b.at);
    const allTones = log.events.filter((e) => e.kind === 'tone' && e.at >= t0);
    const tones =
      sc.coach === 'full' ? allTones.filter((t) => !TICK_HZ.has(t.freq)) : allTones;
    const phrases = [];
    for (const v of voice) {
      const last = phrases[phrases.length - 1];
      if (last && v.at - last.end <= 50) {
        last.slugs.push(v.slug);
        last.end = v.end;
      } else phrases.push({ at: v.at, end: v.end, slugs: [v.slug] });
    }
    console.log(
      `${sc.name}: ${phrases.length} phrases, ${voice.length} clips, ${allTones.length} tones, ${gapInfo}; ` +
        `tts ${log.tts.length}, decodes ${JSON.stringify(log.decodes)}, ` +
        `min tone-end→voice gap ${Math.round(
          Math.min(
            ...phrases.map((p) =>
              Math.min(...tones.filter((t) => t.at <= p.at).map((t) => p.at - audibleEnd(t))),
            ),
          ),
        )}ms`,
    );
    // a session of self-paced stations (the Sunday piece) has nowhere to
    // park a phone mid-step — the gap scenario is then simply not applicable
    const gapPossible = queue.some((_, i) => i >= startIdx && gapCandidate(queue, i, CUE));
    expect(gapDone, 'the run found a step to park the phone in').toBe(gapPossible);
    expect(voice.length).toBeGreaterThan(10);
    expect(voice.filter((v) => v.slug === '?')).toEqual([]);
    expect(voice.filter((v) => v.state !== 'running')).toEqual([]);
    expect(log.tts.filter((t) => t.at >= t0)).toEqual([]);

    // 1. never two voices at once
    let maxEnd = Number.NEGATIVE_INFINITY;
    const overlaps = [];
    let prev = null;
    // one audio render quantum (128 samples, 2.7ms at 48k) of slack: a
    // chain is scheduled sample-accurately, but the audio clock can tick
    // once between reading it for two consecutive clips
    for (const v of voice) {
      if (v.at < maxEnd - 4) {
        overlaps.push({
          slug: v.slug,
          at: v.at - t0,
          by: maxEnd - v.at,
          over: `${prev?.slug}@${prev?.at - t0}..${prev?.end - t0}`,
        });
      }
      if (v.end >= maxEnd) prev = v;
      maxEnd = Math.max(maxEnd, v.end);
    }
    expect(overlaps).toEqual([]);

    // 2. no tone still audible when a phrase starts; none inside a phrase
    const describe = (v) => `${v.slug}@${Math.round(v.at - t0)}..${Math.round(v.end - t0)}`;
    const ringing = phrases.filter((p) =>
      tones.some((t) => t.at <= p.at && audibleEnd(t) > p.at + 1),
    );
    expect(ringing.map((p) => ({ at: p.at - t0, slugs: p.slugs }))).toEqual([]);
    const inside = tones
      .map((t) => ({
        at: Math.round(t.at - t0),
        freq: t.freq,
        // 5ms of slack: the fake timer that ends a clip fires on a whole
        // millisecond, and a tap that lands on that same millisecond is a
        // coincidence of the test cadence, not a tone under a word
        under: voice.filter((v) => t.at > v.at && t.at < v.end - 5).map(describe),
      }))
      .filter((t) => t.under.length);
    expect(inside).toEqual([]);

    // 3. exactly the words announce.js prescribes, in order, from the step
    // the run started on (its cue is spoken at or after the play mark).
    // At the full coach level the tick loop adds tempo words, counts and
    // form lines on its own mic-ruled schedule: those may appear between
    // the announcements, nothing else may, and every announcement must
    // still arrive whole and in order.
    const expected = [];
    for (let i = startIdx; i < queue.length; i++) {
      const c = announceCue(queue, i, CUE);
      if (c) expected.push(c.parts.join(' '));
    }
    expected.push('session-complete');
    const said = phrases.map((p) => p.slugs.join(' '));
    if (sc.coach === 'minimal') {
      expect(said).toEqual(expected);
    } else {
      let k = 0;
      const stray = [];
      for (const key of said) {
        if (key === expected[k]) k += 1;
        else if (!key.split(' ').every(EXTRA_OK)) stray.push(key);
      }
      expect(stray, 'phrases that are neither an announcement nor a coach extra').toEqual([]);
      expect(expected.slice(k), 'announcements never spoken').toEqual([]);
    }

    // 4. the pocket gap: silence on return, the play tap speaks
    if (gapDone) {
      const gs = mark('gap-start');
      const gp = mark('gap-play');
      const ge = mark('gap-end');
      // the step we parked in may have landed on the very tick before the
      // mark, with its own cue still inside its tone lead (≤ 550ms) — that
      // cue was scheduled before the gap and is not a phantom
      expect(
        phrases
          .filter((p) => p.at > gs + 600 && p.at < gp)
          .map((p) => `${p.slugs.join(' ')}@${Math.round(p.at - gs)}ms after gap-start (gap-end at ${Math.round(ge - gs)}, gap-play at ${Math.round(gp - gs)})`),
        gapInfo,
      ).toEqual([]);
      expect(phrases.filter((p) => p.at >= gp && p.at < gp + 1500).length).toBeGreaterThan(0);
    }

    expect(errors).toEqual([]);
  });
}
