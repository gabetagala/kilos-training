// HOTMUM — share cards. Canvas 2D, same approach as src/shareCard.js.
//
// Three templates that read as ONE set: identical field, grain, lockup and
// tracked micro-type, differing only in what they put in the middle.
//   countdown — how long is left, and what today was
//   workout   — the session itself, movement by movement
//   mark      — just the lockup, for when the picture is the point
//
// 1080×1350 (4:5) — the aspect of the reference posters and of an Instagram
// portrait post, so nothing gets cropped on the way out.

const W = 1080;
const H = 1350;
const PAD = 84;

const DISPLAY = "'Teko', sans-serif";
const GROT = "-apple-system, 'Helvetica Neue', Inter, system-ui, sans-serif";

const INK = '#FFFFFF';
const CREAM = '#FFE9A8';

export const TEMPLATES = [
  { id: 'countdown', name: 'Countdown' },
  { id: 'workout', name: 'The workout' },
  { id: 'mark', name: 'The mark' },
];

// ─── The field ─────────────────────────────────────────────────────────────
// The CSS field from style.css, rebuilt in canvas: a deep magenta ground with
// magenta/ember/cream blooms and a long-exposure smear. Same recipe, so a card
// and the app look like the same object.

function bloom(ctx, x, y, r, color, alpha) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function smear(ctx, x, y, w, h, color, alpha, rot) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.filter = 'blur(60px)';
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function grain(ctx, opacity) {
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
  ctx.globalCompositeOperation = 'overlay';
  ctx.drawImage(off, 0, 0);
  ctx.restore();
}

function field(ctx, intense = false) {
  ctx.fillStyle = '#8E0068';
  ctx.fillRect(0, 0, W, H);
  bloom(ctx, W * 0.3, H * 0.08, W * 1.05, '#E0119B', 1);
  bloom(ctx, W * 0.78, H * 0.3, W * 0.8, '#FF4FA0', 0.95);
  bloom(ctx, W * 0.62, H * 0.9, W * 0.85, '#FF8A3D', 0.9);
  bloom(ctx, W * 0.18, H * 1.06, W * 1.0, '#FFC65C', 0.95);

  smear(ctx, W * 0.36, H * 0.44, W * 0.75, H * 0.14, '#FF9E4D', 0.42, -0.24);
  smear(ctx, W * 0.62, H * 0.64, W * 0.8, H * 0.1, '#FFD37A', 0.34, -0.14);
  smear(ctx, W * 0.68, H * 0.2, W * 0.5, H * 0.2, '#FF2E93', 0.45, 0.2);
  if (intense) {
    smear(ctx, W * 0.2, H * 0.78, W * 0.7, H * 0.12, '#FFF0C4', 0.3, -0.09);
  }
  grain(ctx, 0.16);
}

// ─── Type ──────────────────────────────────────────────────────────────────
// Canvas letter-spacing is uneven across browsers, so tracked type is drawn a
// character at a time. It's the poster's signature and worth the loop.

function tracked(ctx, text, x, y, size, spacing = 0.18, align = 'left') {
  ctx.save();
  ctx.font = `700 ${size}px ${GROT}`;
  ctx.textBaseline = 'alphabetic';
  const chars = [...text.toUpperCase()];
  const gap = size * spacing;
  const width =
    chars.reduce((n, c) => n + ctx.measureText(c).width + gap, 0) - gap;
  let cx =
    align === 'right' ? x - width : align === 'center' ? x - width / 2 : x;
  for (const c of chars) {
    ctx.fillText(c, cx, y);
    cx += ctx.measureText(c).width + gap;
  }
  ctx.restore();
  return width;
}

function display(ctx, text, x, y, size, align = 'left') {
  ctx.save();
  ctx.font = `600 ${size}px ${DISPLAY}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, x, y);
  ctx.restore();
}

// The stacked lockup — three letters over three letters, never "HM" (§1.1).
function lockup(ctx, x, y, size, color = INK) {
  ctx.save();
  ctx.fillStyle = color;
  display(ctx, 'HOT', x, y, size);
  display(ctx, 'MUM', x, y + size * 0.76, size);
  ctx.restore();
}

// The poster's own header rail: three tracked labels across the top.
function rail(ctx, left, mid, right, y = PAD + 18) {
  ctx.fillStyle = 'rgba(255,255,255,.92)';
  tracked(ctx, left, PAD, y, 21);
  tracked(ctx, mid, W / 2, y, 21, 0.18, 'center');
  tracked(ctx, right, W - PAD, y, 21, 0.18, 'right');
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(PAD, y + 22);
  ctx.lineTo(W - PAD, y + 22);
  ctx.stroke();
  ctx.restore();
}

function footer(ctx, right) {
  lockup(ctx, PAD, H - PAD - 52, 60);
  ctx.fillStyle = 'rgba(255,255,255,.9)';
  tracked(ctx, right, W - PAD, H - PAD - 8, 20, 0.18, 'right');
}

// ─── Data ──────────────────────────────────────────────────────────────────

export function buildShareData({
  record,
  session,
  week,
  weeks,
  daysToGo,
  seasonLabel,
  seasonName,
  rows = [],
}) {
  return {
    activity:
      record?.kind === 'walk'
        ? 'WALK'
        : session
          ? session.name.toUpperCase()
          : 'HOTMUM',
    blurb: session?.blurb || '',
    secs: record?.secs || 0,
    sets: record?.sets || 0,
    tut: record?.tut || 0,
    dose: record?.dose ? record.dose.toUpperCase() : '',
    week,
    weeks,
    daysToGo,
    seasonLabel,
    seasonName,
    rows,
  };
}

// An em dash beats a fake 0:00 — a stat with nothing behind it should look
// absent, not zero.
const mmss = (s) => {
  const n = Math.max(0, Math.round(Number(s) || 0));
  if (!n) return '—';
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
};

// ─── Templates ─────────────────────────────────────────────────────────────

function drawCountdown(ctx, d) {
  field(ctx);
  rail(ctx, d.seasonLabel, 'TONED CHRISTMAS', '2026');

  ctx.fillStyle = INK;
  display(ctx, String(d.daysToGo), W / 2, H * 0.47, 400, 'center');
  ctx.fillStyle = CREAM;
  tracked(ctx, 'DAYS TO CHRISTMAS', W / 2, H * 0.47 + 56, 26, 0.22, 'center');

  ctx.fillStyle = INK;
  display(ctx, d.activity, W / 2, H * 0.68, 132, 'center');
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  tracked(
    ctx,
    `WK ${d.week} OF ${d.weeks}`,
    W / 2,
    H * 0.68 + 44,
    22,
    0.2,
    'center',
  );

  footer(ctx, 'HOT AS IN STRONG');
}

function drawWorkout(ctx, d) {
  field(ctx);
  rail(ctx, d.seasonLabel, `WK ${d.week} OF ${d.weeks}`, '2026');

  ctx.fillStyle = INK;
  display(ctx, d.activity, PAD, PAD + 190, 150);
  if (d.dose) {
    ctx.fillStyle = CREAM;
    tracked(ctx, d.dose, PAD, PAD + 232, 22, 0.2);
  }

  // the movements
  let y = PAD + 320;
  ctx.save();
  for (const r of d.rows.slice(0, 9)) {
    ctx.fillStyle = 'rgba(255,255,255,.22)';
    ctx.fillRect(PAD, y - 34, W - PAD * 2, 2);
    ctx.fillStyle = INK;
    ctx.font = `400 30px ${GROT}`;
    ctx.textAlign = 'left';
    ctx.fillText(r.title, PAD, y);
    ctx.fillStyle = 'rgba(255,255,255,.8)';
    tracked(ctx, r.detail, W - PAD, y, 19, 0.14, 'right');
    y += 62;
  }
  ctx.restore();

  // the numbers this format earns
  const stats = [
    [mmss(d.secs), 'TIME'],
    [d.sets ? String(d.sets) : '—', 'SETS'],
    [mmss(d.tut), 'UNDER TENSION'],
  ];
  const sy = H - PAD - 190;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(PAD, sy - 74);
  ctx.lineTo(W - PAD, sy - 74);
  ctx.stroke();
  ctx.restore();
  stats.forEach(([v, k], i) => {
    const x = PAD + i * ((W - PAD * 2) / 3);
    ctx.fillStyle = INK;
    display(ctx, v, x, sy, 76);
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    tracked(ctx, k, x, sy + 32, 18, 0.18);
  });

  footer(ctx, 'HOT AS IN STRONG');
}

function drawMark(ctx, d) {
  field(ctx, true);
  rail(ctx, d.seasonLabel, 'TONED CHRISTMAS', '2026');

  ctx.save();
  ctx.fillStyle = INK;
  ctx.shadowColor = 'rgba(120,0,70,.45)';
  ctx.shadowBlur = 60;
  ctx.shadowOffsetY = 8;
  display(ctx, 'HOT', W / 2, H * 0.47, 300, 'center');
  display(ctx, 'MUM', W / 2, H * 0.47 + 228, 300, 'center');
  ctx.restore();

  ctx.fillStyle = CREAM;
  tracked(ctx, 'HOT AS IN STRONG', W / 2, H * 0.47 + 306, 28, 0.24, 'center');

  ctx.fillStyle = 'rgba(255,255,255,.85)';
  tracked(ctx, `${d.daysToGo} DAYS TO GO`, PAD, H - PAD - 8, 20, 0.18);
  tracked(
    ctx,
    `WK ${d.week} OF ${d.weeks}`,
    W - PAD,
    H - PAD - 8,
    20,
    0.18,
    'right',
  );
}

const DRAW = {
  countdown: drawCountdown,
  workout: drawWorkout,
  mark: drawMark,
};

/** Paint one template onto a canvas. Fonts must be ready before calling. */
export async function renderShare(canvas, data, template = 'countdown') {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  // Teko is a webfont; drawing before it loads silently falls back to sans.
  if (document.fonts?.ready) await document.fonts.ready;
  (DRAW[template] || drawCountdown)(ctx, data);
  return canvas;
}

/** Hand the card to the OS share sheet, or fall back to a download. */
export async function shareCanvas(canvas, filename = 'hotmum.png') {
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
  if (!blob) return false;
  const file = new File([blob], filename, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return true;
    } catch {
      return false; // she cancelled — not an error
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
