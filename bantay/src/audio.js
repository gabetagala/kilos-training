// Cam-side audio chain: mic → gain (boost) → compressor → outgoing track,
// with the noise meter tapping the same chain so the meter shows what the
// parent actually hears. Local-stream Web Audio is the known-good WebKit
// path (SCOPE §4.1); the raw mic track stays available as a fallback when
// the audio engine is suspended.
export function buildAudio(stream, onLevel) {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const ctx = new Ctx();
  const resume = () => {
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  };
  document.addEventListener('pointerdown', resume, { passive: true });
  resume();

  const gain = ctx.createGain();
  const comp = ctx.createDynamicsCompressor(); // tames boosted cry spikes
  const dest = ctx.createMediaStreamDestination();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  ctx.createMediaStreamSource(stream).connect(gain);
  gain.connect(comp);
  comp.connect(dest);
  comp.connect(analyser);

  const buf = new Float32Array(analyser.fftSize);
  const audio = {
    level: 0,
    running: () => ctx.state === 'running',
    boostedTrack: () => dest.stream.getAudioTracks()[0],
    setGain: (v) => {
      gain.gain.value = v;
    },
  };

  setInterval(() => {
    resume();
    if (ctx.state !== 'running' || !analyser.getFloatTimeDomainData) return;
    analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    audio.level = Math.sqrt(sum / buf.length); // RMS 0..~1
    onLevel(audio.level);
  }, 100);

  return audio;
}
