// Cam-side noise meter on the LOCAL stream (the known-good Web Audio path —
// SCOPE §4.1). The level ships to the viewer inside the 1 Hz beacon; the
// viewer never analyses the remote stream in M0.
export function startMeter(stream, onLevel) {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const ctx = new Ctx();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  ctx.createMediaStreamSource(stream).connect(analyser);
  const buf = new Float32Array(analyser.fftSize);
  const meter = { level: 0, state: () => ctx.state };

  setInterval(() => {
    if (ctx.state === 'suspended') {
      // Capturing pages are normally allowed to run audio; retry quietly.
      ctx.resume().catch(() => {});
      return;
    }
    if (analyser.getFloatTimeDomainData) {
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      meter.level = Math.sqrt(sum / buf.length); // RMS 0..~1
    }
    onLevel(meter.level);
  }, 100);

  return meter;
}
