// Tayô — iPhone Lock Screen widget (runs in the free Scriptable app).
//
// INSTALL (once):
//   1. App Store → install "Scriptable" (free)
//   2. Scriptable → + → paste this whole file → name it "Tayo"
//   3. Lock Screen → hold to customize → add a rectangular widget →
//      choose Scriptable → Script: Tayo
//
// It shows the next break (SNACK on the hour / STAND on the half hour)
// with a live-ticking countdown, and taps through to the Tayô page.
// Mirror of the /tayo schedule — edit the window here if you edit it there.

const START = '09:00';
const END = '15:00';
const SNACK_A = 'pull-ups · push-ups · squats';
const SNACK_B = 'squats · walk · hip flexor';
const URL = 'https://kilostraining.vercel.app/tayo/';

const hm = (s) => {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
};
const S = hm(START);
const E = hm(END);

function slots() {
  const out = [];
  for (let m = S; m <= E; m++) {
    if (m % 60 === 0 && m > S) out.push({ m, type: 'SNACK' });
    else if (m % 60 === 30) out.push({ m, type: 'STAND' });
  }
  return out;
}

const now = new Date();
const mins = now.getHours() * 60 + now.getMinutes();
const nxt = slots().find((s) => s.m > mins) || null;
const inDay = mins < E;

const w = new ListWidget();
w.url = URL;

if (nxt && inDay) {
  const at = new Date(now);
  at.setHours(Math.floor(nxt.m / 60), nxt.m % 60, 0, 0);

  const title = w.addText(`TAYÔ · ${nxt.type}`);
  title.font = Font.mediumMonospacedSystemFont(11);
  title.textOpacity = 0.7;

  const timer = w.addDate(at);
  timer.applyTimerStyle(); // live countdown — ticks without refreshes
  timer.font = Font.boldSystemFont(24);

  if (nxt.type === 'SNACK') {
    // rough A/B hint: even hours A, odd hours B (the page owns the truth)
    const sub = w.addText(
      Math.floor(nxt.m / 60) % 2 === 0 ? SNACK_A : SNACK_B,
    );
    sub.font = Font.mediumMonospacedSystemFont(9);
    sub.textOpacity = 0.55;
    sub.lineLimit = 1;
  }
  // wake the widget right when the break lands, to roll to the next one
  w.refreshAfterDate = at;
} else {
  const title = w.addText('TAYÔ');
  title.font = Font.mediumMonospacedSystemFont(11);
  title.textOpacity = 0.7;
  const msg = w.addText(mins < S ? `starts ${START}` : 'done for today');
  msg.font = Font.boldSystemFont(16);
  const tomorrow = new Date(now);
  if (mins >= S) tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(Math.floor(S / 60), S % 60, 0, 0);
  w.refreshAfterDate = tomorrow;
}

Script.setWidget(w);
Script.complete();
