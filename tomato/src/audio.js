// Cam-side audio chain: mic → gain (boost) → compressor → outgoing track,
// with the noise meter tapping the same chain so the meter shows what the
// parent actually hears, plus a pre-gain analyser so cry detection on the
// viewer doesn't rescale with the boost setting. Local-stream Web Audio is
// the known-good WebKit path (SCOPE §4.1); the raw mic track stays
// available as a fallback when the audio engine is suspended.
//
// This chain routes mic → MediaStreamDestination ONLY. Nothing connects to
// ctx.destination (the speaker) — the cam phone must never make a sound.
export function buildAudio(stream, onLevel) {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const ctx = new Ctx();
  const resume = () => {
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  };
  document.addEventListener('pointerdown', resume, { passive: true });
  resume();

  const src = ctx.createMediaStreamSource(stream);
  const gain = ctx.createGain();
  const comp = ctx.createDynamicsCompressor(); // tames boosted cry spikes
  const dest = ctx.createMediaStreamDestination();
  const analyser = ctx.createAnalyser(); // post-boost: what the parent hears
  const rawAnalyser = ctx.createAnalyser(); // pre-boost: honest room level
  analyser.fftSize = 1024;
  rawAnalyser.fftSize = 1024;
  src.connect(gain);
  src.connect(rawAnalyser);
  gain.connect(comp);
  comp.connect(dest);
  comp.connect(analyser);

  const buf = new Float32Array(analyser.fftSize);

  function rms(node) {
    if (!node.getFloatTimeDomainData) return 0;
    node.getFloatTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    return Math.sqrt(sum / buf.length);
  }

  const audio = {
    level: 0,
    rawLevel: 0,
    running: () => ctx.state === 'running',
    boostedTrack: () => dest.stream.getAudioTracks()[0],
    setGain: (v) => {
      gain.gain.value = v;
    },
    dispose() {
      clearInterval(timer);
      document.removeEventListener('pointerdown', resume);
      try {
        ctx.close();
      } catch {
        /* already closed */
      }
    },
  };

  const timer = setInterval(() => {
    if (ctx.state !== 'running') {
      // Flatline honestly: a suspended engine must read as silence on the
      // viewer, never as a frozen-but-plausible level.
      resume();
      audio.level = 0;
      audio.rawLevel = 0;
      onLevel(0);
      return;
    }
    audio.level = rms(analyser);
    audio.rawLevel = rms(rawAnalyser);
    onLevel(audio.level);
  }, 100);

  return audio;
}
