// ─── What the coach SAYS on arrival at a step ────────────────────────────────
// Pure: given the queue and an index, the one cue to speak — a list of clip
// parts plus the speech-synthesis text for the same words. main.js owns the
// tones, the mic and playback; scripts/verify-voice.mjs runs this over every
// reachable queue to prove every part has a clip behind it. That matters
// because iOS throttles speechSynthesis mid-session: a part with no clip is a
// cue that never lands on the iPhone in his hand.

// A part no clip will ever match — forces the TTS text. Only reached for a
// number outside 1–99 or a prescription with no number at all.
export const TTS_ONLY = 'tts-fallback';

const ONES = [
  '',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
];
const TENS = [
  '',
  '',
  'twenty',
  'thirty',
  'forty',
  'fifty',
  'sixty',
  'seventy',
  'eighty',
  'ninety',
];

// The clip slug for a number: 'twenty-one'. null outside 1–99.
export function numberSlug(n) {
  const k = Number(n);
  if (!Number.isInteger(k) || k < 1 || k > 99) return null;
  if (k < 20) return ONES[k];
  const tens = TENS[Math.floor(k / 10)];
  return k % 10 ? `${tens}-${ONES[k % 10]}` : tens;
}

// Spoken rep ranges: "5–8" reads as "5 to 8", "/side" as "per side".
export const speakReps = (r) =>
  String(r || '')
    .replace(/[–-]/g, ' to ')
    .replace(/\/side/g, ' per side');

// The PRESCRIPTION, spoken (2026-08-12, his ask): a station opens with its
// number — "ten reps", "forty-five seconds", "one length" — so the start needs
// zero glancing. Every number 1–99 resolves to a clip slug; the generator
// ships one per word.
export function rxCue(step) {
  if (step.workSecs) {
    const w = numberSlug(step.workSecs);
    return {
      parts: w ? [w, 'seconds'] : [TTS_ONLY],
      text: `${step.workSecs} seconds`,
    };
  }
  // unit-bearing prescriptions ('1 length') speak their unit — extracting
  // the digit alone announced every carry as 'one reps'
  const lm = String(step.reps ?? '').match(/^(\d+)\s*(length|lengths)$/i);
  if (lm) {
    const n = Number(lm[1]);
    const unit = n === 1 ? 'length' : 'lengths';
    const w = numberSlug(n);
    return { parts: w ? [w, unit] : [TTS_ONLY], text: `${n} ${unit}` };
  }
  const n = Number.parseInt(
    String(step.reps ?? '').match(/\d+/)?.[0] ?? '',
    10,
  );
  if (!n || step.reps === 'build') return null;
  const side = /\/(side|leg|arm)/.test(String(step.reps));
  const w = numberSlug(n);
  return {
    parts: w ? [w, 'reps', ...(side ? ['each-side'] : [])] : [TTS_ONLY],
    text: `${n} reps${side ? ' each side' : ''}`,
  };
}

// Only work steps sandwiched between other sets of the SAME exercise count:
// "last set" on a single-set exercise would just be noise.
export function isFinalSet(queue, idx) {
  const step = queue[idx];
  const same = (st) => st.kind === 'work' && st.manual && st.exId === step.exId;
  return queue.slice(0, idx).some(same) && !queue.slice(idx + 1).some(same);
}

// Does this work step need its movement NAMED as it starts?
//
// The name used to be spoken only on the prep or the rest that led into a
// movement. A metcon has neither: its members alternate on one continuous
// clock, so every minute after the first opened with a number and no name —
// "twelve reps, go" of WHAT (his 2026-09-16 report: "sometimes it doesn't say
// the workout"). Now the name rides in front of the number whenever the
// movement changes, unless a prep step just said it.
export function needsName(queue, idx) {
  const step = queue[idx];
  if (step?.kind !== 'work') return false;
  const prev = queue[idx - 1];
  if (!prev) return true;
  if (prev.kind === 'prep') return false;
  return prev.exId !== step.exId;
}

const sideSlug = (step) =>
  step.side ? `${step.side.toLowerCase()}-side` : null;
const sideText = (step) =>
  step.side ? `${step.side.toLowerCase()} side — ` : '';

// The cue for arriving at queue[idx], or null for a silent arrival.
//   minimal       — the coach level (see COACH_LEVEL_KEY in main.js)
//   exercises     — id → { name }
//   nextWorkLabel — (queue, idx) → "Name · SIDE" of the next work step
export function announceCue(queue, idx, { minimal, exercises, nextWorkLabel }) {
  const step = queue[idx];
  if (!step) return null;
  const exName = exercises[step.exId]?.name || step.exId;
  const named = needsName(queue, idx);
  const nameParts = named ? [`name-${step.exId}`] : [];
  const namePrefix = named ? `${exName} — ` : '';
  const withName = (parts, text) => ({
    parts: [...nameParts, ...parts],
    text: `${namePrefix}${text}`,
  });
  const restNext = (withRest) => {
    const next = queue.slice(idx + 1).find((st) => st.kind === 'work');
    if (!next || next.exId === step.exId) {
      return withRest ? { parts: ['rest'], text: 'Rest' } : null;
    }
    const parts = [...(withRest ? ['rest'] : []), 'next', `name-${next.exId}`];
    const s = sideSlug(next);
    if (s) parts.push(s);
    const label = nextWorkLabel(queue, idx).replace('·', ',');
    return { parts, text: `${withRest ? 'Rest. ' : ''}Next — ${label}` };
  };

  if (minimal) {
    // Name what is coming, and nothing else. A self-paced lifting set says
    // nothing at all: the name was spoken on the prep that led into it.
    if (step.kind === 'prep')
      return { parts: [`name-${step.exId}`], text: exName };
    if (
      step.kind === 'work' &&
      step.phase !== 'RAMP' &&
      (!step.manual || step.piece)
    ) {
      // the prescription is navigation, not coaching — a clocked minute (or a
      // for-time station) opens with its number; the GO tone has already
      // landed and the words ride behind it
      const rx = rxCue(step);
      if (rx) return withName(rx.parts, rx.text);
      return named ? { parts: nameParts, text: exName } : null;
    }
    if (step.phase === 'SWITCH SIDES') {
      return { parts: ['switch-sides'], text: 'Switch sides' };
    }
    if (step.phase === 'REST') return restNext(false);
    return null;
  }

  if (step.kind === 'prep') {
    return {
      parts: ['get-set', `name-${step.exId}`],
      text: `Get set — ${exName}`,
    };
  }
  if (step.kind === 'work') {
    if (step.manual && step.phase === 'RAMP') {
      // Only the ramp is a warm-up — unlogged band/bodyweight WORKING sets
      // (logWeight:false) used to get announced as "warm up" too.
      return withName(['warm-up'], 'Warm up — your pace');
    }
    if (step.manual) {
      // The push that matters: the final set of an exercise says so.
      return isFinalSet(queue, idx)
        ? withName(
            ['last-set'],
            `Last set — ${speakReps(step.reps)} reps, your pace`,
          )
        : withName(
            ['your-pace'],
            `Set — ${speakReps(step.reps)} reps, your pace`,
          );
    }
    const s = sideSlug(step);
    if (step.tempo) {
      return withName(s ? [s, 'go'] : ['go'], s ? `${sideText(step)}go` : 'Go');
    }
    if (step.rep > 1) {
      return withName([numberSlug(step.rep) || 'go'], String(step.rep));
    }
    if (step.holdSet && step.setTotal > 1) {
      // "know what I'm expecting": position in the hold sets, spoken
      const parts = s ? [s] : [];
      parts.push(
        'hold',
        numberSlug(step.setNum) || 'go',
        'of',
        numberSlug(step.setTotal) || 'go',
      );
      return withName(
        parts,
        `${sideText(step)}hold. ${step.setNum} of ${step.setTotal}.`,
      );
    }
    // SAY WHAT THE MINUTE IS (2026-08-11) + ITS NUMBER (2026-08-12, his
    // ask): "ten reps — go". GO for work and cardio minutes; HOLD only for
    // true isometrics and stretches (which carry no rep number).
    const word =
      step.phase === 'HOLD' || step.phase === 'BREATHE' ? 'hold' : 'go';
    const rx = word === 'go' ? rxCue(step) : null;
    return withName(
      [...(s ? [s] : []), ...(rx ? rx.parts : []), word],
      `${sideText(step)}${rx ? `${rx.text} — ` : ''}${word === 'go' ? 'Go' : 'Hold'}`,
    );
  }
  if (step.phase === 'SWITCH SIDES') {
    return { parts: ['switch-sides'], text: 'Switch sides' };
  }
  if (step.phase === 'REST') return restNext(true);
  return null;
}
