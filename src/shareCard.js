// ─────────────────────────────────────────────────────────────────────────────
// KILOS — shareCard.js  (three-style redesign)
// Styles: editorial (ruled table), poster (brutalist type), minimal (airy
// stat overlay) — each over a generated photographic plate, or the user's
// own photo. Content: workout · movements · sets×reps · elapsed time.
// Color-themable: white (default) / bright yellow / bright red.
// ─────────────────────────────────────────────────────────────────────────────

const W = 540;
const H = 960;
const PAD = 40;

const BEBAS = "'Bebas Neue', sans-serif";
const MONO = "'Space Mono', monospace";

// ─── PLATES ──────────────────────────────────────────────────────────────────
const plateCache = new Map(); // style → Promise<Image|null>
function loadPlate(style) {
  if (!plateCache.has(style)) {
    plateCache.set(
      style,
      new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = `/share/share-${style}.webp`;
      }),
    );
  }
  return plateCache.get(style);
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function addGrain(ctx, opacity = 0.1) {
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

function drawCover(ctx, img, scrim = 0) {
  const scale = Math.max(W / img.width, H / img.height);
  const sw = img.width * scale;
  const sh = img.height * scale;
  ctx.drawImage(img, (W - sw) / 2, (H - sh) / 2, sw, sh);
  if (scrim > 0) {
    ctx.fillStyle = `rgba(0,0,0,${scrim})`;
    ctx.fillRect(0, 0, W, H);
  }
}

function fitText(ctx, text, maxWidth, maxSize, fontStr) {
  let size = maxSize;
  ctx.font = `${size}px ${fontStr}`;
  while (ctx.measureText(text).width > maxWidth && size > 16) {
    size -= 2;
    ctx.font = `${size}px ${fontStr}`;
  }
  return size;
}

function withAlpha(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${a})`;
}

// ─── DATA ────────────────────────────────────────────────────────────────────
export function buildShareData({
  workout,
  duration,
  cfRoundsCompleted,
  streak = 0,
}) {
  const type = workout?.type || 'strength';
  const isCF = ['emom', 'amrap', 'rounds', 'fortime'].includes(type);

  // Movements: name + honest sets×reps from the done logs.
  let movements = [];
  if (isCF) {
    movements = (workout?.cf?.movements || []).map((m) => ({
      name: m.name,
      detail: m.reps ? String(m.reps) : '',
    }));
  } else {
    movements = (workout?.exercises || []).map((ex) => {
      const done = (ex.logs || []).filter((l) => l.done);
      const sets = done.length || ex.sets || 0;
      const reps = [
        ...new Set(
          done
            .map((l) => parseInt(l.reps, 10))
            .filter((r) => Number.isFinite(r) && r > 0),
        ),
      ];
      let repStr = '';
      if (reps.length === 1) repStr = `×${reps[0]}`;
      else if (reps.length > 1)
        repStr = `×${Math.min(...reps)}–${Math.max(...reps)}`;
      else if (ex.reps) repStr = `×${ex.reps}`;
      return { name: ex.name, detail: `${sets}${repStr}` };
    });
  }

  const totalSets = isCF
    ? cfRoundsCompleted || 0
    : (workout?.exercises || []).reduce(
        (sum, ex) => sum + (ex.logs || []).filter((l) => l.done).length,
        0,
      );

  return {
    workoutName: workout?.name || 'Workout',
    type,
    isCF,
    movements,
    totalSets,
    duration: duration || '—',
    streak,
    dateStr: new Date()
      .toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
      .toUpperCase(),
  };
}

// ─── STYLE A · EDITORIAL — ruled table, top-left ─────────────────────────────
function drawEditorial(ctx, data, color) {
  const c = color;
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = c;
  ctx.font = `700 12px ${MONO}`;
  ctx.textAlign = 'left';
  ctx.fillText('KILOS — TRAINING LOG', PAD, 74);

  const nameSize = fitText(
    ctx,
    data.workoutName.toUpperCase(),
    W - PAD * 2,
    40,
    BEBAS,
  );
  ctx.font = `${nameSize}px ${BEBAS}`;
  ctx.fillText(data.workoutName.toUpperCase(), PAD, 74 + nameSize + 12);

  let y = 74 + nameSize + 40;
  const rows = data.movements.slice(0, 6);
  for (const m of rows) {
    ctx.fillStyle = withAlpha(c, 0.7);
    ctx.fillRect(PAD, y, W - PAD * 2, 1);
    y += 31;
    ctx.fillStyle = c;
    const sz = fitText(ctx, m.name, W - PAD * 2 - 110, 24, BEBAS);
    ctx.font = `${sz}px ${BEBAS}`;
    ctx.textAlign = 'left';
    ctx.fillText(m.name, PAD, y);
    ctx.font = `12px ${MONO}`;
    ctx.textAlign = 'right';
    ctx.fillText(m.detail, W - PAD, y);
    y += 15;
  }
  if (data.movements.length > 6) {
    ctx.fillStyle = withAlpha(c, 0.7);
    ctx.fillRect(PAD, y, W - PAD * 2, 1);
    y += 26;
    ctx.font = `11px ${MONO}`;
    ctx.textAlign = 'left';
    ctx.fillStyle = withAlpha(c, 0.85);
    ctx.fillText(`+ ${data.movements.length - 6} MORE`, PAD, y);
    y += 12;
  }
  ctx.fillStyle = withAlpha(c, 0.7);
  ctx.fillRect(PAD, y, W - PAD * 2, 1);

  ctx.fillStyle = c;
  ctx.font = `700 12px ${MONO}`;
  ctx.textAlign = 'left';
  ctx.fillText(data.dateStr, PAD, H - 44);
  ctx.textAlign = 'right';
  ctx.fillText(`${data.duration} ELAPSED`, W - PAD, H - 44);
  ctx.font = `28px ${BEBAS}`;
  ctx.fillText('KILOS', W - PAD, H - 74);
}

// ─── STYLE B · POSTER — brutalist type, the time enormous ───────────────────
function drawChecker(ctx, x, y, cell, color) {
  ctx.fillStyle = color;
  for (let r = 0; r < 4; r++) {
    for (let col = 0; col < 4; col++) {
      if ((r + col) % 2 === 0) {
        ctx.fillRect(x + col * cell, y + r * cell, cell, cell);
      }
    }
  }
}

function drawPoster(ctx, data, color) {
  const c = color;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = c;
  ctx.font = `700 13px ${MONO}`;
  ctx.textAlign = 'left';
  ctx.fillText('—KILOS', PAD, 58);
  ctx.textAlign = 'center';
  ctx.fillText(data.dateStr, W / 2, 58);
  drawChecker(ctx, W - PAD - 30, 42, 8, c);

  const dur = String(data.duration);
  const [big, small] = dur.includes(':') ? dur.split(':') : [dur, null];
  ctx.fillStyle = c;
  ctx.font = `220px ${BEBAS}`;
  ctx.textAlign = 'left';
  ctx.fillText(big, PAD + 6, 396);
  if (small != null) {
    ctx.textAlign = 'right';
    ctx.fillText(small, W - PAD - 6, 600);
    ctx.font = `700 12px ${MONO}`;
    ctx.fillText('MIN : SEC ELAPSED', W - PAD - 6, 636);
  }

  let y = 706;
  ctx.font = `700 12px ${MONO}`;
  ctx.textAlign = 'left';
  ctx.fillStyle = c;
  ctx.fillText(data.workoutName.toUpperCase().slice(0, 40), PAD, y);
  y += 24;
  ctx.font = `11px ${MONO}`;
  for (const m of data.movements.slice(0, 5)) {
    ctx.fillStyle = withAlpha(c, 0.85);
    ctx.fillText(
      `${m.name.toUpperCase().slice(0, 30)}  ${m.detail}`.trim(),
      PAD,
      y,
    );
    y += 20;
  }
  if (data.movements.length > 5) {
    ctx.fillStyle = withAlpha(c, 0.85);
    ctx.fillText(`+ ${data.movements.length - 5} MORE`, PAD, y);
  }

  ctx.fillStyle = c;
  ctx.fillRect(PAD, H - 62, 11, 11);
  ctx.font = `700 12px ${MONO}`;
  ctx.fillText('KILOS TRAINING — FREE FOREVER', PAD + 20, H - 52);
}

// ─── STYLE C · MINIMAL — airy stat overlay ──────────────────────────────────
function drawMinimal(ctx, data, color) {
  const c = color;
  ctx.save();
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 10;

  const cols = [W * 0.32, W * 0.68];
  const stats = [
    ['ELAPSED', data.duration],
    ['MOVEMENTS', String(data.movements.length)],
    [data.isCF ? 'ROUNDS' : 'SETS', String(data.totalSets || '—')],
    ['DATE', data.dateStr.replace(/, \d{4}$/, '')],
  ];
  let y = 200;
  stats.forEach(([label, val], i) => {
    const x = cols[i % 2];
    if (i === 2) y += 104;
    ctx.fillStyle = withAlpha(c, 0.85);
    ctx.font = `700 11px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.fillText(label, x, y);
    ctx.fillStyle = c;
    ctx.font = `46px ${BEBAS}`;
    ctx.fillText(val, x, y + 50);
  });

  let cy = H - 174;
  ctx.font = `700 12px ${MONO}`;
  ctx.fillStyle = c;
  ctx.textAlign = 'center';
  ctx.fillText(data.workoutName.toUpperCase().slice(0, 40), W / 2, cy);
  cy += 22;
  ctx.font = `11px ${MONO}`;
  for (const m of data.movements.slice(0, 4)) {
    ctx.fillStyle = withAlpha(c, 0.85);
    ctx.fillText(
      `${m.name.toUpperCase().slice(0, 30)}  ${m.detail}`.trim(),
      W / 2,
      cy,
    );
    cy += 18;
  }
  if (data.movements.length > 4) {
    ctx.fillStyle = withAlpha(c, 0.85);
    ctx.fillText(`+ ${data.movements.length - 4} MORE`, W / 2, cy);
  }

  ctx.font = `20px ${BEBAS}`;
  ctx.fillStyle = c;
  ctx.fillText('KILOS', W / 2, H - 40);
  ctx.restore();
}


// ─── STYLE D · DOTS — dot matrix + vertical type ────────────────────────────
function drawDots(ctx, data, color) {
  const c = color;
  // the grid: 4 × 7 dots, full frame
  for (let row = 0; row < 7; row++) {
    for (let col = 0; col < 4; col++) {
      const x = W * (0.12 + col * 0.253);
      const y = H * (0.06 + row * 0.147);
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fillStyle = withAlpha(c, 0.9);
      ctx.fill();
    }
  }
  // index marks
  ctx.fillStyle = c;
  ctx.font = `700 12px ${MONO}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.save();
  ctx.translate(W * 0.53, 46);
  ctx.rotate(Math.PI / 2);
  ctx.fillText(data.dateStr, 0, 0);
  ctx.restore();

  // vertical block: name huge + details, reading downward
  ctx.save();
  ctx.translate(W * 0.62, H * 0.3);
  ctx.rotate(Math.PI / 2);
  const nameSize = fitText(ctx, data.workoutName.toUpperCase(), H * 0.62, 44, BEBAS);
  ctx.font = `${nameSize}px ${BEBAS}`;
  ctx.fillStyle = c;
  ctx.textAlign = 'left';
  ctx.fillText(data.workoutName.toUpperCase(), 0, 0);
  ctx.font = `700 11px ${MONO}`;
  let vy = 22;
  for (const m of data.movements.slice(0, 4)) {
    ctx.fillText(`${m.name.toUpperCase().slice(0, 26)}  ${m.detail}`.trim(), 0, vy);
    vy += 18;
  }
  if (data.movements.length > 4) {
    ctx.fillText(`+ ${data.movements.length - 4} MORE`, 0, vy);
    vy += 18;
  }
  ctx.fillText(`${data.duration} ELAPSED`, 0, vy + 6);
  ctx.restore();

  ctx.fillStyle = c;
  ctx.font = `20px ${BEBAS}`;
  ctx.textAlign = 'left';
  ctx.fillText('KILOS', PAD, H - 42);
}

// ─── STYLE E · HEADLINE — the big statement, top and bottom ─────────────────
function drawHeadline(ctx, data, color) {
  const c = color;
  ctx.fillStyle = c;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  const year = new Date().getFullYear();
  const line1 = data.workoutName.toUpperCase().slice(0, 22);
  const s1 = fitText(ctx, line1, W - PAD * 2, 76, BEBAS);
  ctx.font = `${s1}px ${BEBAS}`;
  ctx.fillText(line1, W / 2, 100);
  ctx.font = `${Math.min(s1, 60)}px ${BEBAS}`;
  ctx.fillText(`© ${year} SESSION`, W / 2, 100 + Math.min(s1, 60) + 6);

  // mid marks
  ctx.font = `24px ${BEBAS}`;
  ctx.textAlign = 'left';
  ctx.fillText('K—', PAD, H * 0.56);
  ctx.font = `700 11px ${MONO}`;
  ctx.textAlign = 'right';
  ctx.fillText('POWERED BY', W - PAD, H * 0.545);
  ctx.fillText('KILOS TRAINING', W - PAD, H * 0.56 + 3);

  // movements, quiet, above the bottom statement
  ctx.font = `700 10px ${MONO}`;
  ctx.textAlign = 'center';
  let my = H - 232;
  for (const m of data.movements.slice(0, 3)) {
    ctx.fillStyle = withAlpha(c, 0.9);
    ctx.fillText(`${m.name.toUpperCase().slice(0, 28)}  ${m.detail}`.trim(), W / 2, my);
    my += 16;
  }
  if (data.movements.length > 3) {
    ctx.fillText(`+ ${data.movements.length - 3} MORE`, W / 2, my);
  }

  ctx.fillStyle = c;
  const line3 = `${data.duration} ELAPSED.`;
  const s3 = fitText(ctx, line3, W - PAD * 2, 84, BEBAS);
  ctx.font = `${s3}px ${BEBAS}`;
  ctx.fillText(line3, W / 2, H - 64);
}

// ─── STYLE F · SPEC — mid spec strip, logotype bleeding the edges ───────────
function drawSpec(ctx, data, color) {
  const c = color;
  ctx.textBaseline = 'alphabetic';

  // the bleeding logotype band
  ctx.fillStyle = c;
  ctx.font = `120px ${BEBAS}`;
  ctx.textAlign = 'left';
  ctx.fillText('KILOS', -34, H * 0.47);
  ctx.textAlign = 'right';
  ctx.font = `84px ${BEBAS}`;
  ctx.fillText('© KLS', W + 46, H * 0.47);

  // spec columns under the band
  const top = H * 0.5;
  ctx.font = `700 10px ${MONO}`;
  ctx.textAlign = 'left';
  let y = top;
  ctx.fillStyle = c;
  ctx.fillText(`${data.workoutName.toUpperCase().slice(0, 24)} //`, PAD, y);
  y += 16;
  for (const m of data.movements.slice(0, 4)) {
    ctx.fillStyle = withAlpha(c, 0.92);
    ctx.fillText(`${m.name.toUpperCase().slice(0, 24)} · ${m.detail}`.trim(), PAD, y);
    y += 15;
  }
  if (data.movements.length > 4) {
    ctx.fillText(`+ ${data.movements.length - 4} MORE`, PAD, y);
  }
  let ry = top;
  ctx.textAlign = 'right';
  ctx.fillStyle = c;
  ctx.fillText(`ELAPSED: ${data.duration}`, W - PAD, ry);
  ry += 16;
  ctx.fillStyle = withAlpha(c, 0.92);
  ctx.fillText(`${data.isCF ? 'ROUNDS' : 'SETS'}: ${data.totalSets || '—'}`, W - PAD, ry);
  ry += 15;
  ctx.fillText(`DATE: ${data.dateStr}`, W - PAD, ry);
  ry += 15;
  ctx.fillText('LOGGED ON KILOS', W - PAD, ry);
}

// ─── STYLE G · GRAIN — staggered micro-captions in the quiet ────────────────
function drawGrain(ctx, data, color) {
  const c = color;
  addGrain(ctx, 0.16); // double down on the texture
  ctx.textBaseline = 'alphabetic';
  ctx.font = `700 12px ${MONO}`;

  let y = H * 0.42;
  ctx.fillStyle = c;
  ctx.textAlign = 'left';
  ctx.fillText('TRAINING LOG', W * 0.2, y);
  ctx.fillText(`${data.workoutName.toUpperCase().slice(0, 24)} ●●`, W * 0.2, y + 16);

  y += 56;
  for (const m of data.movements.slice(0, 3)) {
    ctx.fillText(`${m.name.toUpperCase().slice(0, 24)} ${m.detail}`.trim(), W * 0.32, y);
    y += 16;
  }
  if (data.movements.length > 3) {
    ctx.fillText(`+${data.movements.length - 3} /KILOS`, W * 0.32, y);
    y += 16;
  }

  y += 24;
  ctx.fillText(`${data.dateStr} · ${data.duration}`, W * 0.14, y);
  ctx.fillText('●● KILOS', W * 0.14, y + 16);
}

// ─── STYLE H · ARCHIVE — three-column caption grid ──────────────────────────
function drawArchive(ctx, data, color) {
  const c = color;
  ctx.textBaseline = 'alphabetic';
  ctx.font = `700 13px ${MONO}`;
  ctx.fillStyle = c;

  // top grid: three columns
  ctx.textAlign = 'left';
  ['KILOS', 'TRAINING', 'LOG'].forEach((wrd, i) => {
    ctx.fillText(wrd, PAD, 58 + i * 17);
  });
  ctx.textAlign = 'center';
  const nameWords = data.workoutName.toUpperCase().split(/\s+·?\s*/).slice(0, 3);
  nameWords.forEach((wrd, i) => {
    ctx.fillText(wrd.slice(0, 14), W / 2, 58 + i * 17);
  });
  ctx.textAlign = 'right';
  [data.dateStr.split(',')[0], `${data.duration}`, 'ELAPSED'].forEach((wrd, i) => {
    ctx.fillText(wrd, W - PAD, 58 + i * 17);
  });

  // mid row
  const midY = H * 0.52;
  ctx.textAlign = 'left';
  ctx.fillText(`${data.isCF ? 'RND' : 'SETS'} ${data.totalSets || '—'}`, PAD, midY);
  ctx.textAlign = 'center';
  ctx.fillText('©', W / 2, midY);
  ctx.textAlign = 'right';
  ctx.fillText(`MOVES ${data.movements.length}`, W - PAD, midY);

  // bottom-left: the movements, small
  ctx.font = `700 10px ${MONO}`;
  ctx.textAlign = 'left';
  let y = H - 96;
  for (const m of data.movements.slice(0, 3)) {
    ctx.fillStyle = withAlpha(c, 0.92);
    ctx.fillText(`${m.name.toUpperCase().slice(0, 26)}  ${m.detail}`.trim(), PAD, y);
    y += 15;
  }
  if (data.movements.length > 3) {
    ctx.fillText(`+ ${data.movements.length - 3} MORE`, PAD, y);
  }
}

// ─── MAIN RENDERER ───────────────────────────────────────────────────────────
export async function renderShareCard(canvas, data, opts = {}) {
  const { style = 'editorial', color = '#FFFFFF', photo = null } = opts;
  await document.fonts.ready;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Background: the user's photo beats the style plate; flat dark last.
  if (photo) {
    drawCover(ctx, photo, 0.45);
    addGrain(ctx, 0.08);
  } else {
    const plate = await loadPlate(style);
    if (plate) {
      const scrims = {
        minimal: 0.1,
        dots: 0.22,
        spec: 0.16,
        grain: 0.14,
        archive: 0.12,
        headline: 0.3,
      };
      drawCover(ctx, plate, scrims[style] ?? 0.2);
      addGrain(ctx, 0.05);
    } else {
      ctx.fillStyle = '#141414';
      ctx.fillRect(0, 0, W, H);
      addGrain(ctx, 0.15);
    }
  }

  const drawers = {
    poster: drawPoster,
    minimal: drawMinimal,
    dots: drawDots,
    headline: drawHeadline,
    spec: drawSpec,
    grain: drawGrain,
    archive: drawArchive,
  };
  (drawers[style] || drawEditorial)(ctx, data, color);

  return canvas;
}
