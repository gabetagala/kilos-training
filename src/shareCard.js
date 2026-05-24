// ─────────────────────────────────────────────────────────────────────────────
// KILOS — shareCard.js  (editorial redesign)
// Left-aligned asymmetric layout. KG is the hero. Movements are the grid.
// Geometric K watermark behind everything.
// ─────────────────────────────────────────────────────────────────────────────

const W = 540;
const H = 960;
const PAD = 36;

// ─── GRAIN ───────────────────────────────────────────────────────────────────
function addGrain(ctx, opacity = 0.18) {
  const off = document.createElement('canvas');
  off.width = W; off.height = H;
  const octx = off.getContext('2d');
  const img = octx.createImageData(W, H);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = (Math.random() * 255) | 0;
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = 255;
  }
  octx.putImageData(img, 0, 0);
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.drawImage(off, 0, 0);
  ctx.restore();
}

// ─── BACKGROUND ──────────────────────────────────────────────────────────────
function drawBackground(ctx, mode, bgImage) {
  if (mode === 'photo' && bgImage) {
    const scale = Math.max(W / bgImage.width, H / bgImage.height);
    const sw = bgImage.width * scale;
    const sh = bgImage.height * scale;
    ctx.filter = 'grayscale(100%) blur(8px)';
    ctx.drawImage(bgImage, (W - sw) / 2, (H - sh) / 2, sw, sh);
    ctx.filter = 'none';
    ctx.fillStyle = 'rgba(0,0,0,0.68)';
    ctx.fillRect(0, 0, W, H);
    addGrain(ctx, 0.09);
  } else {
    ctx.fillStyle = '#111111';
    ctx.fillRect(0, 0, W, H);
    // Subtle top-right glow
    const glow = ctx.createRadialGradient(W * 0.85, H * 0.08, 0, W * 0.85, H * 0.08, W * 0.65);
    glow.addColorStop(0, 'rgba(255,255,255,0.04)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
    addGrain(ctx, 0.20);
  }
}

// ─── GEOMETRIC K WATERMARK ───────────────────────────────────────────────────
// Giant Bebas K, bleeding off the top-right — lives behind all content
function drawGeoK(ctx) {
  ctx.save();
  ctx.globalAlpha = 0.055;
  ctx.fillStyle = '#ffffff';
  ctx.font = `720px 'Bebas Neue', sans-serif`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  // Bleed off right edge and slightly off top
  ctx.fillText('K', W + 90, -30);
  ctx.restore();
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function fitText(ctx, text, maxWidth, maxSize, fontStr) {
  let size = maxSize;
  ctx.font = `${size}px ${fontStr}`;
  while (ctx.measureText(text).width > maxWidth && size > 20) {
    size -= 3;
    ctx.font = `${size}px ${fontStr}`;
  }
  return size;
}

function rule(ctx, y, alpha = 0.10) {
  ctx.fillStyle = `rgba(255,255,255,${alpha})`;
  ctx.fillRect(PAD, y, W - PAD * 2, 1);
}

// ─── MAIN RENDERER ───────────────────────────────────────────────────────────
export async function renderShareCard(canvas, data, mode = 'dark', bgImage = null) {
  await document.fonts.ready;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  const { workoutName, date, duration, volume, sets, exercises } = data;

  // ── Background + K ──
  drawBackground(ctx, mode, bgImage);
  drawGeoK(ctx);

  // ── Top rule (very top) ──
  ctx.fillStyle = 'rgba(255,255,255,0.20)';
  ctx.fillRect(0, 0, W, 2);

  // ── Header row ──
  ctx.fillStyle = 'rgba(255,255,255,0.90)';
  ctx.font = `16px 'Bebas Neue', sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('KILOS TRAINING', PAD, 54);

  ctx.fillStyle = 'rgba(255,255,255,0.32)';
  ctx.font = `9px 'Space Mono', monospace`;
  ctx.textAlign = 'right';
  ctx.fillText(date.toUpperCase(), W - PAD, 54);

  rule(ctx, 68, 0.12);

  // ── HERO: total KG ──
  const volStr = volume > 0 ? Math.round(volume).toLocaleString() : duration;
  const heroLabel = volume > 0 ? 'KG TOTAL' : 'DURATION';

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  fitText(ctx, volStr, W - PAD * 2 - 20, 196, `'Bebas Neue', sans-serif`);
  ctx.fillText(volStr, PAD, 292);

  ctx.fillStyle = 'rgba(255,255,255,0.32)';
  ctx.font = `9px 'Space Mono', monospace`;
  ctx.textAlign = 'left';
  ctx.fillText(heroLabel, PAD, 316);

  // ── WORKOUT NAME (left) + DURATION (right) — same zone, different x ──
  const nameStr = workoutName.toUpperCase();
  ctx.fillStyle = 'rgba(255,255,255,0.82)';
  ctx.textAlign = 'left';
  fitText(ctx, nameStr, W * 0.58, 60, `'Bebas Neue', sans-serif`);
  ctx.fillText(nameStr, PAD, 400);

  // Time — right aligned, slightly higher for asymmetry
  if (volume > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.50)';
    ctx.font = `50px 'Bebas Neue', sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillText(duration, W - PAD, 392);

    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.font = `8px 'Space Mono', monospace`;
    ctx.textAlign = 'right';
    ctx.fillText('TIME', W - PAD, 408);
  }

  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.font = `8px 'Space Mono', monospace`;
  ctx.textAlign = 'left';
  ctx.fillText('WORKOUT', PAD, 418);

  // ── Divider ──
  rule(ctx, 444, 0.12);

  // ── Movements section header ──
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.font = `8px 'Space Mono', monospace`;
  ctx.textAlign = 'left';
  ctx.fillText('MOVEMENTS', PAD, 468);

  if (sets > 0) {
    ctx.textAlign = 'right';
    ctx.fillText(`${sets} SETS`, W - PAD, 468);
  }

  rule(ctx, 478, 0.07);

  // ── Movement rows ──
  const listItems = (exercises || []).slice(0, 6);
  const rowH = listItems.length > 4 ? 46 : 52;

  listItems.forEach((ex, i) => {
    const y = 510 + i * rowH;

    // Exercise name (left)
    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    ctx.font = `10px 'Space Mono', monospace`;
    ctx.textAlign = 'left';
    let name = ex.name.toUpperCase();
    while (ctx.measureText(name).width > 290 && name.length > 4) name = name.slice(0, -1);
    if (name !== ex.name.toUpperCase()) name += '—';
    ctx.fillText(name, PAD, y);

    // Stat (right) — sets×reps
    ctx.fillStyle = 'rgba(255,255,255,0.40)';
    ctx.textAlign = 'right';
    ctx.fillText(ex.stat, W - PAD, y);

    if (i < listItems.length - 1) rule(ctx, y + 13, 0.05);
  });

  // ── Footer ──
  rule(ctx, H - 58, 0.10);

  ctx.fillStyle = 'rgba(255,255,255,0.20)';
  ctx.font = `8px 'Space Mono', monospace`;
  ctx.textAlign = 'left';
  ctx.fillText('KILOSTRAINING.APP', PAD, H - 34);

  ctx.textAlign = 'right';
  ctx.fillText('#KILOS', W - PAD, H - 34);

  // Bottom rule
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(0, H - 2, W, 2);

  return canvas;
}

// ─── BUILD SHARE DATA ────────────────────────────────────────────────────────
export function buildShareData({ workout, totalWeightMoved, sessionSets, newPRsThisSession, cfRoundsCompleted, cfCurrentRound, duration }) {
  const isCF = ['emom', 'amrap', 'rounds', 'fortime'].includes(workout?.type);
  const isCardio = workout?.type === 'cardio';

  // Exercises with sets×reps stat
  const exercises = isCF
    ? (workout.cf?.movements || []).slice(0, 6).map(m => ({
        name: m.name,
        stat: m.reps ? `${m.reps} REPS` : '—',
      }))
    : isCardio
    ? []
    : (workout.exercises || [])
        .filter(e => e.logs?.some(l => l.done))
        .slice(0, 6)
        .map(e => {
          const done = e.logs.filter(l => l.done);
          const totalSets = done.length;
          // Best reps from any done set
          const bestReps = done.reduce((max, l) => Math.max(max, parseInt(l.reps) || 0), 0);
          return {
            name: e.name,
            stat: bestReps ? `${totalSets}×${bestReps}` : `${totalSets} SETS`,
          };
        });

  return {
    workoutName: workout?.name || 'WORKOUT',
    date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    duration: duration || '—',
    volume: Math.round(totalWeightMoved || 0),
    sets: sessionSets || 0,
    exercises,
  };
}
