// ─────────────────────────────────────────────────────────────────────────────
// KILOS TRAINING — shareCard.js
// Canvas-based 9:16 share card renderer.
// Clean bold type, no glitch. Two background modes: dark texture | photo.
// ─────────────────────────────────────────────────────────────────────────────

const W = 540;
const H = 960;
const PAD = 40;

// ─── GRAIN TEXTURE ───────────────────────────────────────────────────────────
function addGrain(ctx, opacity = 0.20) {
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
    // Cover-fit the photo
    const scale = Math.max(W / bgImage.width, H / bgImage.height);
    const sw = bgImage.width * scale;
    const sh = bgImage.height * scale;
    const sx = (W - sw) / 2;
    const sy = (H - sh) / 2;

    // Desaturate + blur
    ctx.filter = 'grayscale(100%) blur(10px)';
    ctx.drawImage(bgImage, sx, sy, sw, sh);
    ctx.filter = 'none';

    // Dark vignette overlay so text stays legible
    ctx.fillStyle = 'rgba(0,0,0,0.62)';
    ctx.fillRect(0, 0, W, H);

    // Lighter grain on photos
    addGrain(ctx, 0.10);
  } else {
    // ── Dark texture ──
    // Base charcoal
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, W, H);

    // Very subtle top-left radial glow
    const glow = ctx.createRadialGradient(W * 0.3, H * 0.25, 0, W * 0.3, H * 0.25, W * 0.7);
    glow.addColorStop(0, 'rgba(255,255,255,0.04)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // Heavier grain on dark bg
    addGrain(ctx, 0.22);
  }
}

// ─── HELPER: fit text to max width ───────────────────────────────────────────
function fitText(ctx, text, maxWidth, maxSize, fontPrefix) {
  let size = maxSize;
  ctx.font = `${size}px ${fontPrefix}`;
  while (ctx.measureText(text).width > maxWidth && size > 24) {
    size -= 4;
    ctx.font = `${size}px ${fontPrefix}`;
  }
  return size;
}

// ─── HELPER: draw a horizontal rule ──────────────────────────────────────────
function rule(ctx, y, alpha = 0.1) {
  ctx.fillStyle = `rgba(255,255,255,${alpha})`;
  ctx.fillRect(PAD, y, W - PAD * 2, 1);
}

// ─── MAIN RENDERER ───────────────────────────────────────────────────────────
export async function renderShareCard(canvas, data, mode = 'dark', bgImage = null) {
  // Wait for fonts before drawing
  await document.fonts.ready;

  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  const {
    workoutName, date, duration,
    prWeight, prExercise, hasPR,
    volume, sets,
    exercises,
  } = data;

  // ── Background ──
  drawBackground(ctx, mode, bgImage);

  // ── Top + bottom accent lines ──
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(0, 0, W, 2);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(0, H - 2, W, 2);

  // ── Header: KILOS (left) + date (right) ──
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.font = `900 20px 'Bebas Neue', sans-serif`;
  ctx.fillText('KILOS TRAINING', PAD, 52);

  ctx.fillStyle = 'rgba(255,255,255,0.38)';
  ctx.font = `10px 'Space Mono', monospace`;
  ctx.textAlign = 'right';
  ctx.fillText(date.toUpperCase(), W - PAD, 52);

  // ── Workout name ──
  ctx.fillStyle = 'rgba(255,255,255,0.30)';
  ctx.font = `9px 'Space Mono', monospace`;
  ctx.textAlign = 'left';
  const nameStr = workoutName.toUpperCase();
  ctx.fillText(nameStr, PAD, 72);

  // ── Divider ──
  rule(ctx, 90, 0.12);

  // ── BIG NUMBER 1: PR weight (or duration if no PR) ──
  if (hasPR && prWeight) {
    // "NEW PR" badge
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(PAD, 108, 66, 20);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = `8px 'Space Mono', monospace`;
    ctx.textAlign = 'left';
    ctx.fillText('NEW PR', PAD + 7, 122);

    // The weight
    const weightStr = String(prWeight);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    fitText(ctx, weightStr, W - PAD * 2 - 20, 210, `'Bebas Neue', sans-serif`);
    ctx.fillText(weightStr, W / 2, 348);

    // KG · exercise
    ctx.fillStyle = 'rgba(255,255,255,0.38)';
    ctx.font = `10px 'Space Mono', monospace`;
    ctx.textAlign = 'center';
    const exStr = `KG  ·  ${(prExercise || '').toUpperCase()}`;
    ctx.fillText(exStr, W / 2, 376);
  } else {
    // No PR — show duration as top big number
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    fitText(ctx, duration, W - PAD * 2, 170, `'Bebas Neue', sans-serif`);
    ctx.fillText(duration, W / 2, 320);

    ctx.fillStyle = 'rgba(255,255,255,0.38)';
    ctx.font = `10px 'Space Mono', monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('DURATION', W / 2, 350);
  }

  // ── Divider ──
  rule(ctx, 400, 0.10);

  // ── BIG NUMBER 2: Total volume ──
  const volStr = Math.round(volume).toLocaleString();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  fitText(ctx, volStr, W - PAD * 2, 130, `'Bebas Neue', sans-serif`);
  ctx.fillText(volStr, W / 2, 536);

  ctx.fillStyle = 'rgba(255,255,255,0.38)';
  ctx.font = `10px 'Space Mono', monospace`;
  ctx.textAlign = 'center';
  ctx.fillText(`KG VOLUME  ·  ${sets} SETS  ·  ${duration}`, W / 2, 560);

  // ── Divider ──
  rule(ctx, 584, 0.08);

  // ── Exercise list ──
  const listItems = (exercises || []).slice(0, 4);
  listItems.forEach((ex, i) => {
    const y = 624 + i * 52;

    // Exercise name (left)
    ctx.fillStyle = 'rgba(255,255,255,0.80)';
    ctx.font = `10px 'Space Mono', monospace`;
    ctx.textAlign = 'left';
    let name = ex.name.toUpperCase();
    // Truncate to fit
    while (ctx.measureText(name).width > 250 && name.length > 3) name = name.slice(0, -1);
    if (name !== ex.name.toUpperCase()) name += '…';
    ctx.fillText(name, PAD, y);

    // Stat (right)
    ctx.fillStyle = 'rgba(255,255,255,0.38)';
    ctx.textAlign = 'right';
    ctx.fillText(ex.stat.toUpperCase(), W - PAD, y);

    // Row rule (skip last)
    if (i < listItems.length - 1) {
      rule(ctx, y + 10, 0.05);
    }
  });

  // ── Footer ──
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.font = `8px 'Space Mono', monospace`;
  ctx.textAlign = 'left';
  ctx.fillText('#KILOSTRAINING  ·  KILOSTRAINING.APP', PAD, H - 28);

  return canvas;
}

// ─── BUILD DATA OBJECT from workout state ────────────────────────────────────
export function buildShareData({ workout, totalWeightMoved, sessionSets, newPRsThisSession, cfRoundsCompleted, cfCurrentRound, duration }) {
  const isCF = ['emom', 'amrap', 'rounds', 'fortime'].includes(workout?.type);
  const isCardio = workout?.type === 'cardio';

  // Best PR this session (by weight)
  const topPR = (newPRsThisSession || []).reduce(
    (best, pr) => (!best || pr.weight > best.weight) ? pr : best,
    null,
  );

  // Done exercises with best set stat
  const exercises = isCF
    ? (workout.cf?.movements || []).slice(0, 4).map(m => ({
        name: m.name,
        stat: m.reps ? `${m.reps} reps` : '',
      }))
    : isCardio
    ? []
    : (workout.exercises || [])
        .filter(e => e.logs?.some(l => l.done))
        .slice(0, 4)
        .map(e => {
          const done = e.logs.filter(l => l.done);
          const best = done.reduce((b, l) => {
            const vol = (parseFloat(l.weight) || 0) * (parseInt(l.reps) || 0);
            return vol > b.vol ? { weight: l.weight, reps: l.reps, vol } : b;
          }, { vol: 0 });
          return {
            name: e.name,
            stat: best.weight ? `${best.weight}kg × ${best.reps}` : `${done.length} sets`,
          };
        });

  return {
    workoutName: workout?.name || 'Workout',
    date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    duration: duration || '—',
    hasPR: !!topPR,
    prWeight: topPR?.weight,
    prExercise: topPR?.name,
    volume: Math.round(totalWeightMoved || 0),
    sets: sessionSets || 0,
    exercises,
  };
}
