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

const BEBAS = "'Teko', sans-serif"; // display face (Teko rebrand; const name kept)
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
      const top = Math.max(
        0,
        ...done.map((l) => parseFloat(l.weight) || 0),
      );
      return {
        name: ex.name,
        detail: `${sets}${repStr}`,
        weight: top > 0 ? `${top}KG` : 'BW',
      };
    });
  }

  // Every done set's reps, in session order — the honest trace.
  const repSeq = isCF
    ? []
    : (workout?.exercises || []).flatMap((ex) =>
        (ex.logs || [])
          .filter((l) => l.done)
          .map((l) => parseInt(l.reps, 10) || 1),
      );

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
    repSeq,
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


// ─── STYLE I · MONOGRAM — scattered giant letters + the one huge number ─────
function drawMonogram(ctx, data, color) {
  const c = color;
  ctx.textBaseline = 'alphabetic';
  // three initials of the session, scattered like a city code
  const words = data.workoutName.toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  const letters = (words.length >= 3 ? words.slice(0, 3) : ['K', 'L', 'S']).map((w) => w[0]);
  ctx.fillStyle = c;
  ctx.font = `150px ${BEBAS}`;
  ctx.textAlign = 'right';
  ctx.fillText(letters[1] || 'L', W - PAD, 170);
  ctx.textAlign = 'left';
  ctx.fillText(letters[0] || 'K', PAD, H * 0.44);
  ctx.textAlign = 'right';
  ctx.fillText(letters[2] || 'S', W - PAD, H * 0.44);
  // caption block top-left — the movements, tiny
  ctx.font = `700 10px ${MONO}`;
  ctx.textAlign = 'left';
  ctx.fillStyle = withAlpha(c, 0.9);
  let y = 58;
  ctx.fillText('KILOS — TRAINING LOG', PAD, y);
  y += 16;
  for (const m of data.movements.slice(0, 4)) {
    ctx.fillText(`${m.name.toUpperCase().slice(0, 22)} ${m.detail}`.trim(), PAD, y);
    y += 14;
  }
  if (data.movements.length > 4) ctx.fillText(`+ ${data.movements.length - 4} MORE`, PAD, y);
  // the one huge number — elapsed time
  ctx.fillStyle = c;
  ctx.textAlign = 'left';
  const t = data.duration;
  const size = fitText(ctx, t, W - PAD * 2, 210, BEBAS);
  ctx.font = `${size}px ${BEBAS}`;
  ctx.fillText(t, PAD, H - 120);
  ctx.font = `700 11px ${MONO}`;
  ctx.fillText('ELAPSED', PAD, H - 84);
  ctx.textAlign = 'right';
  ctx.fillText('©K', W - PAD, H - 84);
}

// ─── STYLE J · CLUB — the session as a boxed schedule table ─────────────────
function drawClub(ctx, data, color) {
  const c = color;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = c;
  ctx.font = `700 20px ${MONO}`;
  ctx.textAlign = 'left';
  ctx.fillText('KILOS', PAD, H * 0.36);
  ctx.textAlign = 'right';
  const title = data.workoutName.toUpperCase().slice(0, 22);
  fitText(ctx, title, W * 0.6, 20, `700 ${MONO}`);
  ctx.font = `700 ${fitText(ctx, title, W * 0.6, 20, MONO)}px ${MONO}`;
  ctx.fillText(title, W - PAD, H * 0.36);
  // boxed rows — one per movement
  const rows = data.movements.slice(0, 5);
  let y = H * 0.36 + 34;
  ctx.font = `700 12px ${MONO}`;
  for (const m of rows) {
    const boxW = 118;
    ctx.strokeStyle = c;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(PAD, y - 17, boxW, 26);
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.fillText(m.detail || '—', PAD + boxW / 2, y);
    ctx.textAlign = 'left';
    ctx.fillText(m.name.toUpperCase().slice(0, 24), PAD + boxW + 18, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = withAlpha('#FFFFFF', 0.85);
    ctx.fillText(m.weight || (data.isCF ? 'RND' : ''), W - PAD, y);
    ctx.fillStyle = '#FFFFFF';
    y += 38;
  }
  if (data.movements.length > 5) {
    ctx.textAlign = 'left';
    ctx.fillStyle = withAlpha('#FFFFFF', 0.8);
    ctx.fillText(`+ ${data.movements.length - 5} MORE`, PAD, y);
    y += 30;
  }
  ctx.font = `700 11px ${MONO}`;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('TRAIN HEAVY. FREE FOREVER.', PAD, H - 64);
  ctx.textAlign = 'right';
  ctx.fillText(`${data.duration} · ${data.dateStr}`, W - PAD, H - 64);
}

// ─── STYLE K · TICKET — rotated label band down the left edge ───────────────
function drawTicket(ctx, data, color) {
  const c = color;
  const bandW = 96;
  const accH = H * 0.42;
  // accent block + light block
  ctx.fillStyle = c === '#FFFFFF' ? '#E84A27' : c;
  ctx.fillRect(0, H * 0.12, bandW, accH);
  ctx.fillStyle = '#EDEAE3';
  ctx.fillRect(0, H * 0.12 + accH, bandW, H * 0.46);
  ctx.save();
  ctx.translate(0, 0);
  ctx.rotate(-Math.PI / 2);
  ctx.textBaseline = 'alphabetic';
  // on the accent block (dark ink)
  ctx.fillStyle = '#111111';
  ctx.font = `700 30px ${BEBAS}`;
  ctx.textAlign = 'right';
  ctx.fillText('KILOS', -(H * 0.12) - 14, 40);
  ctx.font = `700 10px ${MONO}`;
  ctx.fillText(`${data.dateStr} *`, -(H * 0.12) - 16, 66);
  ctx.fillText('TRAINING PACK', -(H * 0.12) - 16, 84);
  // on the light block
  const topLight = H * 0.12 + accH;
  ctx.textAlign = 'right';
  ctx.font = `700 16px ${MONO}`;
  const nm = data.workoutName.toUpperCase().slice(0, 24);
  ctx.fillText(nm, -topLight - 14, 44);
  ctx.font = `700 10px ${MONO}`;
  ctx.fillText(`* ${String(data.totalSets).padStart(4, '0')} / SETS *`, -topLight - 16, 66);
  ctx.fillText(`${data.duration} ELAPSED`, -topLight - 16, 84);
  ctx.restore();
  // movements, small, bottom-right over the photo
  ctx.font = `700 10px ${MONO}`;
  ctx.textAlign = 'right';
  ctx.fillStyle = withAlpha('#FFFFFF', 0.92);
  let y = H - 70 - Math.min(data.movements.length, 4) * 14;
  for (const m of data.movements.slice(0, 4)) {
    ctx.fillText(`${m.name.toUpperCase().slice(0, 24)} ${m.detail}`.trim(), W - PAD, y);
    y += 14;
  }
  if (data.movements.length > 4) ctx.fillText(`+ ${data.movements.length - 4} MORE`, W - PAD, y);
}

// ─── STYLE L · BADGE — one centered capsule mark, nothing else ──────────────
function drawBadge(ctx, data, color) {
  const c = color;
  ctx.textBaseline = 'alphabetic';
  // capsule outline
  const bw = 250;
  const bh = 150;
  const r = bh / 2;
  const cx = W / 2;
  const cy = H / 2;
  ctx.strokeStyle = c;
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.moveTo(cx - bw / 2 + r, cy - bh / 2);
  ctx.arcTo(cx + bw / 2, cy - bh / 2, cx + bw / 2, cy + bh / 2, r);
  ctx.arcTo(cx + bw / 2, cy + bh / 2, cx - bw / 2, cy + bh / 2, r);
  ctx.arcTo(cx - bw / 2, cy + bh / 2, cx - bw / 2, cy - bh / 2, r);
  ctx.arcTo(cx - bw / 2, cy - bh / 2, cx + bw / 2, cy - bh / 2, r);
  ctx.closePath();
  ctx.stroke();
  ctx.fillStyle = c;
  ctx.font = `86px ${BEBAS}`;
  ctx.textAlign = 'center';
  ctx.fillText('KLS.', cx, cy + 30);
  // one quiet line at the bottom
  ctx.font = `700 10px ${MONO}`;
  ctx.fillText(
    `${data.workoutName.toUpperCase().slice(0, 24)} · ${data.totalSets} ${data.isCF ? 'RND' : 'SETS'} · ${data.duration}`,
    cx,
    H - 56,
  );
}

// ─── STYLE M · TOUR — giant type wash, movements as tour stops ──────────────
function drawTour(ctx, data, color) {
  const c = color === '#FFFFFF' ? '#FFFFFF' : color;
  // color wash over the plate (multiply keeps the photo beneath)
  if (color !== '#FFFFFF') {
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = withAlpha(color, 0.42);
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = c;
  // headline: name + ©'26, two condensed lines
  const nm = data.workoutName.toUpperCase();
  const l1 = nm.slice(0, 14);
  const size = fitText(ctx, l1, W - PAD * 2, 92, BEBAS);
  ctx.font = `${size}px ${BEBAS}`;
  ctx.textAlign = 'left';
  ctx.fillText(l1, PAD, 60 + size * 0.8);
  ctx.font = `${size}px ${BEBAS}`;
  ctx.fillText(`${data.dateStr.split(',')[0]} ©'26`, PAD, 60 + size * 1.72);
  // center mark
  ctx.font = `700 13px ${MONO}`;
  ctx.textAlign = 'center';
  ctx.fillText('KILOS — TRAIN HEAVY', W / 2, H * 0.52);
  // movements as tour stops with superscript detail
  const rows = data.movements.slice(0, 6);
  let y = H - 88 - (rows.length - 1) * 44;
  for (const m of rows) {
    const name = m.name.toUpperCase().slice(0, 16);
    const ns = fitText(ctx, name, W - PAD * 2 - 70, 44, BEBAS);
    ctx.font = `${ns}px ${BEBAS}`;
    ctx.textAlign = 'left';
    const nw = ctx.measureText(name).width; // measured in the display font
    ctx.fillText(name, PAD, y);
    if (m.detail) {
      ctx.font = `700 12px ${MONO}`;
      ctx.fillText(m.detail, PAD + nw + 10, y - ns * 0.52);
    }
    y += 44;
  }
}

// ─── STYLE N · ROUTE — the session traced as a path + stat footer ───────────
function drawRoute(ctx, data, color) {
  const c = color === '#FFFFFF' ? '#7FD8E8' : color;
  ctx.textBaseline = 'alphabetic';
  // the session, plotted honestly: x = set order, y = reps in that set
  const seq = data.repSeq?.length ? data.repSeq : [data.totalSets || 1];
  const maxRep = Math.max(...seq, 1);
  const pts = seq.map((reps, i) => ({
    x: PAD + 30 + ((W - PAD * 2 - 60) * i) / Math.max(seq.length - 1, 1),
    y: H * 0.62 - (reps / maxRep) * H * 0.3,
  }));
  ctx.strokeStyle = c;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    const mx = (pts[i - 1].x + pts[i].x) / 2;
    const my = (pts[i - 1].y + pts[i].y) / 2;
    ctx.quadraticCurveTo(pts[i - 1].x, pts[i - 1].y, mx, my);
  }
  ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
  ctx.stroke();
  ctx.fillStyle = c;
  ctx.font = `700 11px ${MONO}`;
  ctx.textAlign = 'left';
  ctx.fillText('KILOS — TRAINING LOG', PAD, 58);
  ctx.textAlign = 'center';
  ctx.fillText('SET 1', pts[0].x, pts[0].y + 24);
  ctx.fillText('REPS, SET BY SET', W / 2, H * 0.68);
  // checker finish
  const f = pts[pts.length - 1];
  const cell = 5;
  for (let ix = 0; ix < 4; ix++)
    for (let iy = 0; iy < 2; iy++)
      if ((ix + iy) % 2 === 0)
        ctx.fillRect(f.x - 10 + ix * cell, f.y - 26 + iy * cell, cell, cell);
  // stat footer — honest four-up
  const stats = [
    [data.isCF ? 'ROUNDS' : 'SETS', String(data.totalSets || '—')],
    ['TIME', data.duration],
    ['MOVES', String(data.movements.length)],
    ['DAY', data.dateStr.split(',')[0]],
  ];
  const colW = (W - PAD * 2) / 4;
  stats.forEach(([lbl, val], i) => {
    const x = PAD + colW * i + colW / 2;
    ctx.font = `700 10px ${MONO}`;
    ctx.fillStyle = withAlpha(c, 0.8);
    ctx.fillText(lbl, x, H - 96);
    ctx.font = `700 15px ${MONO}`;
    ctx.fillStyle = c;
    ctx.fillText(val, x, H - 72);
  });
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
        monogram: 0.18,
        club: 0.34,
        ticket: 0.2,
        badge: 0.16,
        tour: 0.3,
        route: 0.24,
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
    monogram: drawMonogram,
    club: drawClub,
    ticket: drawTicket,
    badge: drawBadge,
    tour: drawTour,
    route: drawRoute,
  };
  (drawers[style] || drawEditorial)(ctx, data, color);

  return canvas;
}
