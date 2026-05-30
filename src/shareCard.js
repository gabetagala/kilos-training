// ─────────────────────────────────────────────────────────────────────────────
// GRIT — shareCard.js  (editorial redesign)
// Left-aligned asymmetric layout. KG is the hero. Movements are the grid.
// Geometric K watermark behind everything.
// ─────────────────────────────────────────────────────────────────────────────

const W = 540;
const H = 960;
const PAD = 36;

// ─── GRAIN ───────────────────────────────────────────────────────────────────
function addGrain(ctx, opacity = 0.18) {
  const off = document.createElement('canvas');
  off.width = W;
  off.height = H;
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
    const glow = ctx.createRadialGradient(
      W * 0.85,
      H * 0.08,
      0,
      W * 0.85,
      H * 0.08,
      W * 0.65,
    );
    glow.addColorStop(0, 'rgba(255,255,255,0.04)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
    addGrain(ctx, 0.2);
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

function rule(ctx, y, alpha = 0.1) {
  ctx.fillStyle = `rgba(255,255,255,${alpha})`;
  ctx.fillRect(PAD, y, W - PAD * 2, 1);
}

// ─── MAIN RENDERER ───────────────────────────────────────────────────────────
export async function renderShareCard(
  canvas,
  data,
  mode = 'dark',
  bgImage = null,
) {
  await document.fonts.ready;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  const {
    workoutName,
    date,
    duration,
    heroStr,
    heroLabel,
    heroSub,
    sets,
    exercises,
    streak,
  } = data;

  // ── Background + K ──
  drawBackground(ctx, mode, bgImage);
  drawGeoK(ctx);

  // ── Top rule ──
  ctx.fillStyle = 'rgba(255,255,255,0.20)';
  ctx.fillRect(0, 0, W, 2);

  // ── Header row ──
  ctx.fillStyle = 'rgba(255,255,255,0.90)';
  ctx.font = `16px 'Bebas Neue', sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('GRIT TRAINING', PAD, 54);

  ctx.fillStyle = 'rgba(255,255,255,0.32)';
  ctx.font = `9px 'Space Mono', monospace`;
  ctx.textAlign = 'right';
  ctx.fillText(date.toUpperCase(), W - PAD, 54);

  rule(ctx, 68, 0.12);

  // ── HERO NUMBER ──
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  fitText(ctx, heroStr, W - PAD * 2 - 20, 196, `'Bebas Neue', sans-serif`);
  ctx.fillText(heroStr, PAD, 292);

  // Hero label (+ optional sub for CF types like "AMRAP 20 MIN")
  ctx.fillStyle = 'rgba(255,255,255,0.32)';
  ctx.font = `9px 'Space Mono', monospace`;
  ctx.textAlign = 'left';
  ctx.fillText(heroLabel, PAD, 316);
  if (heroSub) {
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillText(heroSub, PAD, 330);
  }

  // ── WORKOUT NAME (left) + secondary stat (right) ──
  const nameStr = workoutName.toUpperCase();
  ctx.fillStyle = 'rgba(255,255,255,0.82)';
  ctx.textAlign = 'left';
  fitText(ctx, nameStr, W * 0.58, 60, `'Bebas Neue', sans-serif`);
  ctx.fillText(nameStr, PAD, 400);

  // Show duration top-right unless the hero IS the time (for time / RFT)
  const heroIsTime =
    heroLabel === 'FOR TIME' ||
    heroLabel.includes('ROUNDS FOR TIME') ||
    heroLabel === 'DURATION';
  if (!heroIsTime && duration && duration !== '—') {
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
    while (ctx.measureText(name).width > 290 && name.length > 4)
      name = name.slice(0, -1);
    if (name !== ex.name.toUpperCase()) name += '—';
    ctx.fillText(name, PAD, y);

    // Stat (right) — sets×reps
    ctx.fillStyle = 'rgba(255,255,255,0.40)';
    ctx.textAlign = 'right';
    ctx.fillText(ex.stat, W - PAD, y);

    if (i < listItems.length - 1) rule(ctx, y + 13, 0.05);
  });

  // ── Footer ──
  rule(ctx, H - 58, 0.1);

  ctx.fillStyle = 'rgba(255,255,255,0.20)';
  ctx.font = `8px 'Space Mono', monospace`;
  ctx.textAlign = 'left';
  ctx.fillText('GRITTRAINING.APP', PAD, H - 34);

  ctx.textAlign = 'right';
  ctx.fillText('#GRIT', W - PAD, H - 34);

  // Streak — centered between the footer marks (only when there's a chain).
  if (streak >= 2) {
    ctx.fillStyle = 'rgba(255,255,255,0.32)';
    ctx.textAlign = 'center';
    ctx.fillText(`${streak} DAY STREAK`, W / 2, H - 34);
  }

  // Bottom rule
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(0, H - 2, W, 2);

  return canvas;
}

// ─── BUILD SHARE DATA ────────────────────────────────────────────────────────
export function buildShareData({
  workout,
  totalWeightMoved,
  sessionSets,
  cfRoundsCompleted,
  duration,
  streak = 0,
}) {
  const type = workout?.type || 'strength';
  const isCF = ['emom', 'amrap', 'rounds', 'fortime'].includes(type);
  const isCardio = type === 'cardio';
  const cf = workout?.cf || {};

  // ── Hero number + label — changes per workout type ──
  let heroStr, heroLabel, heroSub;

  if (type === 'amrap') {
    heroStr = String(cfRoundsCompleted || 0);
    heroLabel = 'ROUNDS';
    heroSub = `AMRAP ${cf.timeCap || '—'} MIN`;
  } else if (type === 'fortime') {
    heroStr = duration || '—';
    heroLabel = 'FOR TIME';
    heroSub = null;
  } else if (type === 'emom') {
    const total = cf.rounds || cf.timeCap || '—';
    heroStr = `${cfRoundsCompleted || 0}/${total}`;
    heroLabel = 'INTERVALS';
    heroSub = `EMOM`;
  } else if (type === 'rounds') {
    heroStr = duration || '—';
    heroLabel = `${cf.rounds || '—'} ROUNDS FOR TIME`;
    heroSub = null;
  } else if (totalWeightMoved > 0) {
    // Strength — check for Olympic lifts (single heavy sets)
    const olympicNames = [
      'snatch',
      'clean',
      'jerk',
      'clean and jerk',
      'clean & jerk',
    ];
    const isOlympic = (workout?.exercises || []).some((e) =>
      olympicNames.some((o) => e.name.toLowerCase().includes(o)),
    );
    if (isOlympic) {
      // Hero = best single lift weight across all exercises
      const bestWeight = (workout?.exercises || []).reduce((max, e) => {
        const top = (e.logs || [])
          .filter((l) => l.done)
          .reduce((m, l) => Math.max(m, parseFloat(l.weight) || 0), 0);
        return Math.max(max, top);
      }, 0);
      heroStr =
        bestWeight > 0
          ? String(bestWeight)
          : Math.round(totalWeightMoved).toLocaleString();
      heroLabel = bestWeight > 0 ? 'KG · BEST LIFT' : 'KG TOTAL';
      heroSub = null;
    } else {
      heroStr = Math.round(totalWeightMoved).toLocaleString();
      heroLabel = 'KG TOTAL';
      heroSub = null;
    }
  } else {
    heroStr = duration || '—';
    heroLabel = 'DURATION';
    heroSub = null;
  }

  // ── Movement list ──
  const exercises = isCF
    ? (cf.movements || []).slice(0, 6).map((m) => ({
        name: m.name,
        stat: m.reps ? `${m.reps} REPS` : '—',
      }))
    : isCardio
      ? []
      : (workout?.exercises || [])
          .filter((e) => e.logs?.some((l) => l.done))
          .slice(0, 6)
          .map((e) => {
            const done = e.logs.filter((l) => l.done);
            const bestReps = done.reduce(
              (max, l) => Math.max(max, parseInt(l.reps, 10) || 0),
              0,
            );
            return {
              name: e.name,
              stat: bestReps
                ? `${done.length}×${bestReps}`
                : `${done.length} SETS`,
            };
          });

  return {
    workoutName: workout?.name || 'WORKOUT',
    date: new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
    duration: duration || '—',
    heroStr,
    heroLabel,
    heroSub,
    sets: sessionSets || 0,
    exercises,
    isCF,
    streak: streak || 0,
  };
}
