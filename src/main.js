import {
  COACHES_DATA,
  EXERCISES_DB,
  FAMOUS_WODS,
  LEGENDS_DATA,
  MUSCLES,
  SHUFFLE_PLANS,
} from './data.js';
import {
  EQUIPMENT_TIERS,
  getActiveProfile,
  getProfile,
  resolveExercise,
  saveProfile,
} from './personalization.js';
import { initMonitoring, reportError } from './monitoring.js';
import { buildShareData, renderShareCard } from './shareCard.js';
import {
  allRepsMet,
  estimate1RM,
  repTargetTop,
  suggestNextWeight,
} from './workout/progression.js';
import {
  buildStepQueue,
  estimateSessionMins,
  getRehabSession,
  nextWorkLabel,
  REHAB_EXERCISES,
  REHAB_SESSIONS,
  sessionOverview,
  tempoStateAt,
} from './workout/rehab.js';
import {
  DENSITY40_SESSIONS,
  getProgramSession,
  PROGRAM_EXERCISES,
  WEEK_PLAN,
} from './workout/program.js';
import { PROGRAM_DEMOS, REHAB_DEMOS } from './workout/rehabDemos.js';
import { addCheckin, checkinStatus } from './workout/checkin.js';
import { loggedExercisesOf, resolveMuscleGroup } from './workout/muscles.js';
import { currentStreak, longestStreak } from './workout/streak.js';
import {
  deleteAccount,
  getSession,
  hasPendingSync,
  isConfigured,
  pullAndMerge,
  pushData,
  signInWithPassword,
  signOut,
  signUpWithPassword,
  supabase,
} from './supabase.js';

// ─── STORAGE ──────────────────────────────────────────────────────────────────
const get = (k) => {
  try {
    return JSON.parse(localStorage.getItem(k) || 'null');
  } catch {
    return null;
  }
};
// Local calendar-day key — THE week/day identity everywhere (strip, plan,
// check-ins). One definition so Home and Program can never disagree again.
const dateKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// PR tiles are tiny — but truncating to the LAST word turns "Romanian
// Deadlift" into a conventional-deadlift claim. Curated names for the
// program lifts; ambiguous last words keep their qualifier.
const PR_SHORT_NAMES = {
  'Romanian Deadlift': 'ROMANIAN DL',
  'Front Squat': 'FRONT SQUAT',
  'Barbell Floor Press': 'FLOOR PRESS',
  'DB Floor Press': 'DB FLOOR PRESS',
  'Weighted Pull-Up': 'WTD PULL-UP',
  'Strict Pull-Up': 'PULL-UP',
  '30° Incline DB Press': 'INCLINE DB',
};
const PR_AMBIGUOUS = new Set([
  'squat', 'press', 'deadlift', 'row', 'curl', 'raise', 'pulldown', 'bridge',
]);
function prShortName(name) {
  if (PR_SHORT_NAMES[name]) return PR_SHORT_NAMES[name];
  const words = String(name).trim().split(/\s+/);
  const last = words[words.length - 1];
  if (words.length >= 2 && PR_AMBIGUOUS.has(last.toLowerCase())) {
    return `${words[words.length - 2]} ${last}`;
  }
  return last;
}

const set = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {}
};

// ─── PERSISTENCE KEYS ────────────────────────────────────────────────────────
const ACTIVE_STATE_KEY = 'kilos-active-state';

function saveActiveState() {
  if (!activeWorkout) {
    try {
      localStorage.removeItem(ACTIVE_STATE_KEY);
    } catch {}
    return;
  }
  set(ACTIVE_STATE_KEY, {
    activeWorkout,
    currentExIdx,
    currentSetIdx,
    workoutStartTime,
    totalWeightMoved,
    sessionSets,
    cfCurrentRound,
    cfRoundsCompleted,
    cfRoundLog,
    cfMovementsDone: [...cfMovementsDone],
    // Rest/work timer snapshot — so a mid-rest refresh restores the live
    // countdown (fast-forwarded by real elapsed time), not just the workout.
    timerRunning,
    timerPhase,
    timerTotal,
    timerSeconds,
    cardioElapsed,
    timerSavedAt: Date.now(),
  });
}

function loadActiveState() {
  const s = get(ACTIVE_STATE_KEY);
  if (!s?.activeWorkout) return false;
  // Schema guard: a drifted or corrupt snapshot must not brick boot — a
  // strength workout without a real exercises array can't render.
  const w = s.activeWorkout;
  if (
    !CF_TYPES.has(w.type) &&
    w.type !== 'cardio' &&
    !Array.isArray(w.exercises)
  ) {
    return false;
  }
  activeWorkout = s.activeWorkout;
  currentExIdx = s.currentExIdx || 0;
  currentSetIdx = s.currentSetIdx || 0;
  workoutStartTime = s.workoutStartTime || Date.now();
  totalWeightMoved = s.totalWeightMoved || 0;
  sessionSets = s.sessionSets || 0;
  cfCurrentRound = s.cfCurrentRound || 0;
  cfRoundsCompleted = s.cfRoundsCompleted || 0;
  cfRoundLog = s.cfRoundLog || [];
  cfMovementsDone = new Set(s.cfMovementsDone || []);
  // Stash the timer snapshot; restoreTimer() replays it once the active
  // screen has rendered (it needs the #ring-time DOM to exist).
  _pendingTimer =
    s.timerRunning || s.timerTotal > 0 || s.cardioElapsed > 0
      ? {
          running: !!s.timerRunning,
          phase: s.timerPhase || 'work',
          total: s.timerTotal || 0,
          seconds: s.timerSeconds || 0,
          cardioElapsed: s.cardioElapsed || 0,
          savedAt: s.timerSavedAt || Date.now(),
        }
      : null;
  return true;
}

// ─── STATE ────────────────────────────────────────────────────────────────────
let activeWorkout = null;
let currentExIdx = 0;
let currentSetIdx = 0;
let timerInterval = null;
let timerSeconds = 0;
let timerTotal = 0;
let timerPhase = 'work';
let timerRunning = false;
let _pendingTimer = null; // timer snapshot from a restored session (see restoreTimer)
let workoutStartTime = null;
let totalWeightMoved = 0;
let sessionSets = 0;
let buildExercises = [];
let selectedMuscles = [];
let selectedShuffleMuscle = null;
let buildMode = 'strength'; // 'strength' | 'cardio' | 'crossfit'
let newPRsThisSession = [];
let exSearchMode = 'add'; // 'add' | 'swap'
let timerHiddenAt = null;
let lastFinishedWorkout = null;
let lastFinishedEntry = null;

// ── Share card state ──────────────────────────────────────────────────────────
let currentShareData = null;
let currentShareStyle = 'editorial';
let currentShareColor = '#FFFFFF';
let currentShareBgImage = null;

// ── CrossFit build state ──────────────────────────────────────────────────────
let cfFormat = 'emom'; // 'emom' | 'amrap' | 'rounds' | 'fortime'
let cfMovements = []; // [{name, reps}]

// ── CrossFit active state ─────────────────────────────────────────────────────
let cfCurrentRound = 0;
let cfRoundsCompleted = 0;
let cfMovementsDone = new Set(); // indices complete in current round
let cfRoundLog = []; // [bool] one per EMOM round

// ─── UNIT SYSTEM ─────────────────────────────────────────────────────────────
const UNIT_KEY = 'kilos-unit';
function getUnit() {
  return get(UNIT_KEY) || 'kg';
}
function isLbs() {
  return getUnit() === 'lbs';
}
function toDisplayWeight(kg) {
  if (!isLbs()) return kg;
  return kg ? Math.round(parseFloat(kg) * 2.2046 * 4) / 4 : kg; // round to nearest 0.25 lbs
}
function fromDisplayWeight(val) {
  if (!isLbs()) return val;
  return val ? Math.round((parseFloat(val) / 2.2046) * 10) / 10 : val;
}
function weightUnit() {
  return isLbs() ? 'lbs' : 'kg';
}
// One thousands format everywhere a weight/volume renders (f28).
const fmtNum = (n) => Number(n).toLocaleString();

// ─── AUDIO ────────────────────────────────────────────────────────────────────
let audioCtx;
function beep(freq, duration) {
  try {
    if (!audioCtx)
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    // iOS/PWA suspends the context after a lock/background/idle stretch — a
    // countdown that resumes into a suspended context is silent. Wake it first.
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      audioCtx.currentTime + duration,
    );
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch {}
}
// Tempo sound kit — per the audio research: one uniform harmonic-rich tick
// (900Hz triangle + 1800Hz body, the same family as the liked countdown), and
// a two-note rising "da-DUM" accent for the drive. Meaning lives in rhythm,
// timbre and voice — never in pitch steps.
function ensureCtx() {
  if (!audioCtx)
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}
function tickNote(t, freq, dur, gain, type = 'triangle') {
  const ctx = ensureCtx();
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.connect(g);
  g.connect(ctx.destination);
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.start(t);
  osc.stop(t + dur);
}
function clickTick() {
  try {
    const t = ensureCtx().currentTime;
    tickNote(t, 900, 0.1, 0.25, 'triangle');
    tickNote(t, 1800, 0.1, 0.08, 'sine');
  } catch {}
}
function clickTickDouble() {
  try {
    const t = ensureCtx().currentTime;
    tickNote(t, 900, 0.05, 0.22, 'triangle');
    tickNote(t + 0.12, 900, 0.05, 0.22, 'triangle');
  } catch {}
}
function driveAccent() {
  try {
    const t = ensureCtx().currentTime;
    tickNote(t, 900, 0.06, 0.3, 'triangle');
    tickNote(t + 0.09, 1350, 0.2, 0.4, 'triangle');
    tickNote(t + 0.09, 2700, 0.2, 0.1, 'sine');
  } catch {}
}

['touchstart', 'click'].forEach((e) => {
  document.addEventListener(
    e,
    () => {
      if (!audioCtx)
        try {
          audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        } catch {}
    },
    { once: true },
  );
});

// ─── PR HELPERS ───────────────────────────────────────────────────────────────
function getPRMap() {
  return get('prMap') || {};
}

function checkAndUpdatePR(exerciseName, weight) {
  if (!weight || weight <= 0) return false;
  const map = getPRMap();
  const prev = map[exerciseName] || 0;
  if (weight > prev) {
    map[exerciseName] = weight;
    set('prMap', map);
    // Only signal "new PR" if there was a previous record to beat.
    // First-ever set just establishes the baseline — no celebration.
    return prev > 0;
  }
  return false;
}

// Volume PR — fires when weight × reps beats the previous best single-set volume.
// Catches progression that weight-only tracking misses (same weight, more reps = real gain).
function checkAndUpdateVolPR(exerciseName, weight, reps) {
  if (!weight || !reps || weight <= 0 || reps <= 0) return false;
  const vol = weight * reps;
  const map = get('volPRMap') || {};
  const prev = map[exerciseName] || 0;
  if (vol > prev) {
    map[exerciseName] = vol;
    set('volPRMap', map);
    return prev > 0; // Only celebrate when beating an existing record
  }
  return false;
}

// ─── COUNT-UP ─────────────────────────────────────────────────────────────────
// Animates a number from 0 → target with an ease-out so hero stats "snap into
// place" — the premium reveal. Snaps instantly under prefers-reduced-motion.
// Decimals inferred from the target; thousands grouped. Used only on earned/
// summary moments, never in the live logging loop.
function countUp(el, target, duration = 720) {
  if (!el) return;
  const dec = Number.isInteger(target) ? 0 : 1;
  const fmt = (n) => Number(n.toFixed(dec)).toLocaleString();
  const reduce = window.matchMedia?.(
    '(prefers-reduced-motion: reduce)',
  )?.matches;
  if (reduce || !(target > 0)) {
    el.textContent = fmt(Math.max(target, 0));
    return;
  }
  const start = performance.now();
  const ease = (t) => 1 - Math.pow(1 - t, 4); // easeOutQuart — confident, no bounce
  requestAnimationFrame(function tick(now) {
    const p = Math.min((now - start) / duration, 1);
    el.textContent = fmt(target * ease(p));
    if (p < 1) requestAnimationFrame(tick);
  });
}

// Count up every [data-count] number inside the post-workout summary.
function animateSummaryNumbers() {
  document.querySelectorAll('#workout-summary [data-count]').forEach((el) => {
    const target = parseFloat(el.dataset.count);
    if (!Number.isNaN(target)) countUp(el, target);
  });
}

function showPRToast(exerciseName, weight, reps, type = 'weight') {
  const toast = document.getElementById('pr-toast');
  toast.querySelector('.pr-toast-icon').textContent =
    type === 'volume' ? 'VOL' : 'PR';
  toast.querySelector('.pr-toast-label').textContent =
    type === 'volume' ? 'VOLUME RECORD' : 'NEW PERSONAL RECORD';
  toast.querySelector('.pr-toast-text').textContent =
    `${exerciseName} — ${toDisplayWeight(weight)}${weightUnit()} × ${reps}`;
  toast.classList.add('show');
  if (navigator.vibrate) navigator.vibrate([50, 30, 100]);
  beep(660, 0.15);
  setTimeout(() => beep(880, 0.15), 160);
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2800);

  // PR Celebration flash — bigger moment for weight PRs
  if (type === 'weight') showPRCelebration(exerciseName, weight, reps);
}

let _prCelebrateTimer = null;
function showPRCelebration(exerciseName, weight, reps) {
  const overlay = document.getElementById('pr-celebrate');
  const weightEl = document.getElementById('prc-weight');
  document.getElementById('prc-unit').textContent = `${weightUnit()} × ${reps}`;
  document.getElementById('prc-ex').textContent = exerciseName.toUpperCase();
  overlay.classList.add('open');
  // The brass number counts up as the light-bloom pulses out behind it.
  countUp(weightEl, parseFloat(weight), 760);
  if (_prCelebrateTimer) clearTimeout(_prCelebrateTimer);
  _prCelebrateTimer = setTimeout(() => overlay.classList.remove('open'), 3500);
}

document.getElementById('prc-dismiss').addEventListener('click', () => {
  document.getElementById('pr-celebrate').classList.remove('open');
  if (_prCelebrateTimer) clearTimeout(_prCelebrateTimer);
});

document.getElementById('prc-share').addEventListener('click', () => {
  document.getElementById('pr-celebrate').classList.remove('open');
  if (_prCelebrateTimer) clearTimeout(_prCelebrateTimer);
  // Build share card and open immediately if we have workout state
  if (activeWorkout) {
    const elapsed = Math.floor((Date.now() - workoutStartTime) / 1000);
    const dur = `${Math.floor(elapsed / 60)}:${(elapsed % 60).toString().padStart(2, '0')}`;
    currentShareData = buildShareData({
      workout: activeWorkout,
      cfRoundsCompleted,
      duration: dur,
      streak: currentStreak(get('workoutHistory') || []),
    });
    currentShareStyle = get('kilos-share-style') || 'editorial';
    currentShareColor = get('kilos-share-color') || '#FFFFFF';
    currentShareBgImage = null;
    document.getElementById('share-modal').classList.add('open');
    _renderShareCanvas();
  }
});

// ─── PLATE CALCULATOR ─────────────────────────────────────────────────────────
function calcPlates(targetKg) {
  const barKg = 20; // Standard Olympic bar
  if (targetKg <= barKg) return { perSide: [], remainder: targetKg };
  const plates = [25, 20, 15, 10, 5, 2.5, 1.25];
  let remaining = (targetKg - barKg) / 2;
  const perSide = [];
  for (const plate of plates) {
    while (remaining >= plate - 0.001) {
      perSide.push(plate);
      remaining = Math.round((remaining - plate) * 1000) / 1000;
    }
  }
  return { perSide, remainder: Math.round(remaining * 1000) / 1000 };
}

function renderPlateCalc() {
  const raw = parseFloat(document.getElementById('plate-input').value);
  const res = document.getElementById('plate-result');
  if (!raw || raw <= 0) {
    res.innerHTML = '';
    return;
  }
  const kg = isLbs() ? raw / 2.205 : raw;
  const { perSide, remainder } = calcPlates(Math.round(kg * 2) / 2);
  const barLine = `<div class="pc-row"><span class="pc-label">Bar</span><span class="pc-val">20 kg</span></div>`;
  const plateLine = perSide.length
    ? perSide
        .map(
          (p) =>
            `<div class="pc-row"><span class="pc-label">Each side</span><span class="pc-val">${p} kg</span></div>`,
        )
        .join('')
    : '';
  const totalLine = `<div class="pc-row pc-total"><span class="pc-label">Total</span><span class="pc-val">${Math.round(kg * 2) / 2} kg${isLbs() ? ` (${raw} lbs)` : ''}</span></div>`;
  const warnLine =
    remainder > 0.1
      ? `<div class="pc-warn">Can't make exact weight — nearest: ${Math.round((Math.round(kg * 2) / 2) * 100) / 100} kg</div>`
      : '';
  res.innerHTML = barLine + plateLine + totalLine + warnLine;
}

// Unit (kg/lb) lives in the Profile sheet now — removed from the set-log header.
// Plate calculator also removed from the toolbar (kept dormant); guard so the
// missing button doesn't throw at load.
document.getElementById('btn-plate-calc')?.addEventListener('click', () => {
  document.getElementById('plate-input').value = '';
  document.getElementById('plate-result').innerHTML = '';
  document.getElementById('plate-unit-label').textContent = weightUnit();
  document.getElementById('plate-modal').classList.add('open');
  setTimeout(() => document.getElementById('plate-input').focus(), 120);
});
document
  .getElementById('plate-input')
  .addEventListener('input', renderPlateCalc);
document.getElementById('btn-close-plate').addEventListener('click', () => {
  document.getElementById('plate-modal').classList.remove('open');
});

// ─── PREVIOUS SESSION RECALL ──────────────────────────────────────────────────
function getLastSession(exerciseName) {
  const history = get('workoutHistory') || [];
  for (let i = history.length - 1; i >= 0; i--) {
    const ex = history[i].exercises?.find((e) => e.name === exerciseName);
    if (ex?.logs?.length) return ex.logs;
  }
  return null;
}

// ─── NAVIGATION ───────────────────────────────────────────────────────────────
const SCREEN_ORDER = ['home', 'train', 'history', 'coaches', 'build', 'active'];

function goScreen(id) {
  const currentEl = document.querySelector('.screen.active');
  const nextEl = document.getElementById(id);
  if (!nextEl || currentEl?.id === id) return;

  const ci = SCREEN_ORDER.indexOf(currentEl?.id ?? '');
  const ni = SCREEN_ORDER.indexOf(id);
  const forward = ni >= ci; // higher tab index = slide right in, old slides left out

  // 1. Stage the entering screen off-screen (no transition yet — just position)
  nextEl.classList.remove(
    's-enter-right',
    's-enter-left',
    's-exit-left',
    's-exit-right',
  );
  nextEl.classList.add(forward ? 's-enter-right' : 's-enter-left');

  // 2. Force a paint so the browser registers the starting position
  void nextEl.offsetWidth;

  // 3. Exit current screen
  if (currentEl) {
    currentEl.classList.remove('active');
    currentEl.classList.add(forward ? 's-exit-left' : 's-exit-right');
    // Clean up exit class after transition completes
    currentEl.addEventListener(
      'transitionend',
      () => {
        currentEl.classList.remove('s-exit-left', 's-exit-right');
      },
      { once: true },
    );
  }

  // 4. Activate next screen — CSS transitions fire from staged position → translateX(0)
  nextEl.classList.remove('s-enter-right', 's-enter-left');
  nextEl.classList.add('active');

  // 5. Update nav indicator
  document.querySelectorAll('.nav-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.screen === id);
  });

  // Hide the floating feedback button on the active screen — it overlaps the
  // set-log controls (done / ± steppers) and isn't needed mid-set.

  // 6. Render content
  if (id === 'home') {
    renderHome();
  }
  if (id === 'train') renderTrain();
  if (id === 'history') {
    renderHistory();
    renderProfilePane();
  }
  if (id === 'coaches') renderCoaches(); // was 'legends'
  if (id === 'build') renderBuild();
  if (id === 'active') renderActiveScreen();
}
document.querySelectorAll('.nav-btn').forEach((btn) => {
  btn.addEventListener('click', () => goScreen(btn.dataset.screen));
});
for (const [btnId, listId] of [['rh-toggle-moves', 'rehab-ex-list']]) {
  document.getElementById(btnId)?.addEventListener('click', () => {
    const list = document.getElementById(listId);
    const open = list.style.display !== 'none';
    list.style.display = open ? 'none' : '';
    const btn = document.getElementById(btnId);
    btn.setAttribute('aria-expanded', String(!open));
    btn.querySelector('.rh-toggle-arrow').textContent = open ? '→' : '↓';
  });
}

// ─── TRAIN ────────────────────────────────────────────────────────────────────
// One source of truth for "is something in progress?" — the classic loop's
// live workout OR a paused guided session. Home's strip, Train's Resume and
// the begin-workout guard all read THIS, so they can never disagree.
function activeSessionInfo() {
  if (activeWorkout) {
    return { kind: 'classic', name: activeWorkout.name };
  }
  const saved = get(REHAB_STATE_KEY);
  if (saved?.sessionId) {
    const session = getGuidedSession(saved.sessionId);
    if (session) return { kind: 'guided', name: session.name, session, saved };
  }
  return null;
}
function resumeActiveSession() {
  const info = activeSessionInfo();
  if (!info) return;
  if (info.kind === 'classic') goScreen('active');
  else openRehabPlayer(info.session, info.saved);
}

// The movement launcher (Quick Start / Legends / CrossFit / Custom / Resume).
function renderTrain() {
  const info = activeSessionInfo();
  const sub = document.getElementById('resume-sub');
  if (sub) sub.textContent = info ? info.name : 'No active session';
  const resumeBtn = document.getElementById('btn-resume');
  if (resumeBtn) {
    resumeBtn.style.display = info ? '' : 'none';
    resumeBtn.classList.toggle('resume-active', !!info);
    resumeBtn.style.order = info ? '-1' : '';
  }
}

// ─── HOME ─────────────────────────────────────────────────────────────────────
// The day-glance hero replaced the rotating one-liner: the date is the
// headline, the sentence is data-driven (done / next / week standing) —
// same quiet-confidence rules: earned, never loud, never guilt.


// Day-glance hero: the date as the headline, the day as a sentence.
function renderDayHero() {
  const now = new Date();
  // The sentence is fixed for the day-part: salutation + what today HOLDS.
  // Progress lives in the grid and the action line — the greeting never
  // changes because you trained or reloaded.
  const sumEl = document.getElementById('day-summary');
  if (!sumEl) return;
  const name = getUserName() || 'Athlete';
  const hour = now.getHours();
  const salut = hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening';
  // The greeting IS the poster: two full-width lines, details drop below.
  const helloEl = document.getElementById('dg-hello');
  if (helloEl) {
    // Reveal only on the first paint of the app, not on every re-render/return.
    const rc = helloEl.dataset.revealed ? '' : ' dg-reveal';
    helloEl.dataset.revealed = '1';
    helloEl.innerHTML = `
      <span class="dg-line${rc}" id="dg-l1">${salut.toUpperCase()},</span>
      <span class="dg-line${rc}" id="dg-l2">${name.toUpperCase()}.</span>`;
    fitLineFont(document.getElementById('dg-l1'), 78, 36);
    fitLineFont(document.getElementById('dg-l2'), 78, 36);
  }
  const b = (t) => `<strong>${t}</strong>`;
  const history = get('workoutHistory') || [];
  let line;
  if (!history.length) {
    line = `Day one — ${b('rehab + guided lifting')} is ready.`;
  } else {
    const plan = todayPlan().filter((i) => i.sessionId);
    const mins = plan.reduce((sum, i) => {
      const sess = getGuidedSession(i.sessionId);
      return sum + (sess ? estimateSessionMins(sess) : 0);
    }, 0);
    const labels = plan.map((i) => b(i.label)).join(' + ');
    line = plan.length
      ? `${labels} on today's plan — about ${b(`${mins} min`)} all in.`
      : `Nothing on the plan — an off day, on purpose.`;
  }
  sumEl.innerHTML = line;
}

// The month at a glance: one box per day, filled when you trained.
function renderMonthGrid() {
  const el = document.getElementById('month-grid');
  if (!el) return;
  const history = get('workoutHistory') || [];
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const todayK = dateKey(now);
  const daysIn = new Date(year, month + 1, 0).getDate();
  const offset = (new Date(year, month, 1).getDay() + 6) % 7; // Mon-first
  const doneKeys = new Set(history.map((h) => dateKey(new Date(h.date))));
  let trained = 0;
  const cells = [];
  for (let i = 0; i < offset; i++) cells.push('<span class="mg-cell ghost"></span>');
  for (let d = 1; d <= daysIn; d++) {
    const k = dateKey(new Date(year, month, d));
    let cls = 'ahead';
    if (k <= todayK && doneKeys.has(k)) {
      cls = 'on';
      trained++;
    } else if (k === todayK) cls = 'now';
    else if (k < todayK) cls = 'off';
    cells.push(`<span class="mg-cell ${cls}"></span>`);
  }
  const monName = now
    .toLocaleDateString('en-US', { month: 'long' })
    .toUpperCase();
  const jan1 = new Date(year, 0, 1);
  const week = Math.ceil(((now - jan1) / 864e5 + ((jan1.getDay() + 6) % 7) + 1) / 7);
  el.innerHTML = `
    <div class="mg-caption"><span>${monName} — W${week}</span><span>${trained} TRAINED</span></div>
    <div class="mg-grid">${cells.join('')}</div>`;
}

function renderHome() {
  renderDayHero();
  renderMonthGrid();
  renderTodayCard();
  renderRecent();
  renderHistory(); // PR board lives on Home now (the personal hub)
  updateStreak();
  renderRestDayCard();
  renderDataNotice();


}


function updateStreak() {
  const history = get('workoutHistory') || [];
  const streak = currentStreak(history);
  // High-water mark: persist so a record survives history pruning and the
  // 90-day look-back cap once it's been earned.
  const best = Math.max(get('bestStreak') || 0, longestStreak(history));
  set('bestStreak', best);

  const chip = document.getElementById('streak-count');
  // Earned elements only: no chip until there's a chain worth naming.
  if (streak >= 2) {
    chip.style.display = '';
    chip.textContent =
      best > streak
        ? `${streak} day streak · best ${best}`
        : `${streak} day streak`;
  } else if (best >= 3) {
    chip.style.display = '';
    chip.textContent = `Best ${best} · go again`; // loss-aversion nudge
  } else {
    chip.style.display = 'none';
  }
  chip.className = `streak-chip${streak >= 7 ? ' hot' : streak >= 3 ? ' warm' : ''}`;
}

function renderRecent() {
  const history = get('workoutHistory') || [];
  const el = document.getElementById('recent-list');
  if (!history.length) {
    el.innerHTML = `
      <div class="recent-empty">
        <div class="re-fig">00</div>
        <div class="re-cap">No sessions logged</div>
        <div class="re-sub">Your training history writes itself here. Start your first session — it takes one tap.</div>
      </div>`;
    return;
  }
  // Daily rehab would occupy every slot — keep the latest rehab entry as one
  // row and fill the rest with actual lifts/WODs by recency.
  const nonRehab = history.filter((h) => h.type !== 'rehab');
  const latestRehab = [...history].reverse().find((h) => h.type === 'rehab');
  const pool = [...nonRehab.slice(-4), ...(latestRehab ? [latestRehab] : [])];
  pool.sort((a, b) => new Date(a.date) - new Date(b.date));
  el.innerHTML = pool
    .slice(-5)
    .reverse()
    .map((h) => {
      const ds = new Date(h.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
      const isCFh = CF_TYPES.has(h.type);
      const isRehab = h.type === 'rehab';
      const typeTag = isCFh
        ? h.type.toUpperCase().slice(0, 3)
        : isRehab
          ? 'RHB'
          : h.type === 'cardio'
            ? 'CDO'
            : 'STR';
      const bigNum = isCFh
        ? h.cfRoundsCompleted != null
          ? h.cfRoundsCompleted
          : h.duration || '—'
        : isRehab
          ? h.totalWeight
            ? fmtNum(toDisplayWeight(h.totalWeight))
            : h.sets || 0
          : h.type === 'cardio'
            ? h.duration || '0:00'
            : fmtNum(toDisplayWeight(h.totalWeight || 0));
      const bigUnit = isCFh
        ? h.type === 'amrap'
          ? 'rounds'
          : 'done'
        : isRehab
          ? h.totalWeight
            ? `${weightUnit()} volume`
            : 'holds'
          : h.type === 'cardio'
            ? 'duration'
            : `${weightUnit()} volume`;
      const meta = isCFh
        ? `${ds} · ${h.type.toUpperCase()} · ${h.duration || '—'}`
        : isRehab
          ? `${ds} · ${h.duration || '0:00'}`
          : h.type === 'cardio'
            ? `${ds} · ${h.distance || '—'} dist`
            : `${ds} · ${h.sets || 0} sets · ${h.duration || '0:00'}`;
      return `<div class="recent-card" data-ridx="${history.indexOf(h)}">
      <div class="rc-left">
        <div class="rc-name"><span class="rc-type">${typeTag}</span><span class="rc-name-text">${h.name}</span></div>
        <div class="rc-meta">${meta}</div>
      </div>
      <div>
        <div class="rc-big">${bigNum}</div>
        <div class="rc-big-unit">${bigUnit}</div>
      </div>
    </div>`;
    })
    .join('');
  el.querySelectorAll('.recent-card[data-ridx]').forEach((card) => {
    card.addEventListener('click', () => {
      expandedHistory.clear();
      expandedHistory.add(Number(card.dataset.ridx));
      goScreen('history');
    });
  });
}

// ─── PAGE OVERLAYS (Quick Start / Legends / CrossFit) ─────────────────────────
function openPage(id) {
  document.getElementById(id).classList.add('open');
}
function closePage(id) {
  document.getElementById(id).classList.remove('open');
}

// ── Swipe from the left edge to go back (any open .page-overlay) ──────────────
// Mirrors iOS's native back gesture: start within the left edge, drag right; the
// page follows the finger and dismisses past a third of the width (else snaps
// back). All page backs are just closePage(), so removing .open matches exactly.
{
  let sw = null;
  const EDGE = 28; // px from the left where the gesture may start
  window.addEventListener(
    'touchstart',
    (e) => {
      if (e.touches.length !== 1) return;
      const overlay = document.querySelector('.page-overlay.open');
      if (!overlay) return;
      const t = e.touches[0];
      if (t.clientX > EDGE) return;
      sw = { overlay, x0: t.clientX, y0: t.clientY, dx: 0, on: false };
    },
    { passive: true },
  );
  window.addEventListener(
    'touchmove',
    (e) => {
      if (!sw) return;
      const t = e.touches[0];
      const dx = t.clientX - sw.x0;
      const dy = t.clientY - sw.y0;
      if (!sw.on) {
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
        if (Math.abs(dy) > Math.abs(dx)) {
          sw = null; // vertical intent — let the page scroll
          return;
        }
        sw.on = true;
        sw.overlay.style.transition = 'none';
      }
      sw.dx = Math.max(0, dx);
      sw.overlay.style.transform = `translateX(${sw.dx}px)`;
      if (e.cancelable) e.preventDefault();
    },
    { passive: false },
  );
  const end = () => {
    if (!sw) return;
    const { overlay, dx, on } = sw;
    sw = null;
    if (!on) return;
    overlay.style.transition = ''; // restore the CSS slide
    overlay.style.transform = ''; // fall back to CSS (.open = 0, closed = 100%)
    if (dx > overlay.offsetWidth * 0.32) overlay.classList.remove('open');
  };
  window.addEventListener('touchend', end, { passive: true });
  window.addEventListener('touchcancel', end, { passive: true });
}

// ── Swipe left/right anywhere to move between the tab screens ─────────────────
// Home ⇆ Train ⇆ Athlete. Only when a plain tab screen is showing (no overlay,
// player, or modal) and the gesture is clearly horizontal, so vertical scrolling
// is untouched. Hands off to goScreen, which runs the existing slide animation.
const NAV_TABS = ['home', 'train', 'history'];
{
  let ts = null;
  const blocked = () =>
    document.querySelector('.page-overlay.open') ||
    document.querySelector('.modal-overlay.open') ||
    document.getElementById('rehab-player')?.classList.contains('open') ||
    document.getElementById('workout-summary')?.classList.contains('open');
  window.addEventListener(
    'touchstart',
    (e) => {
      if (e.touches.length !== 1 || blocked()) return;
      const active = document.querySelector('.screen.active')?.id;
      if (!NAV_TABS.includes(active)) return;
      const t = e.touches[0];
      ts = { x0: t.clientX, y0: t.clientY, active, decided: false, horiz: false };
    },
    { passive: true },
  );
  window.addEventListener(
    'touchmove',
    (e) => {
      if (!ts || ts.decided) return;
      const t = e.touches[0];
      const dx = t.clientX - ts.x0;
      const dy = t.clientY - ts.y0;
      if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return;
      ts.decided = true;
      ts.horiz = Math.abs(dx) > Math.abs(dy) * 1.3; // clearly sideways, not a scroll
    },
    { passive: true },
  );
  window.addEventListener(
    'touchend',
    (e) => {
      if (!ts) return;
      const { x0, active, horiz } = ts;
      ts = null;
      const dx = e.changedTouches[0].clientX - x0;
      if (!horiz || Math.abs(dx) < 60) return;
      const i = NAV_TABS.indexOf(active);
      const ni = dx < 0 ? i + 1 : i - 1; // swipe left → next tab
      if (ni >= 0 && ni < NAV_TABS.length) goScreen(NAV_TABS[ni]);
    },
    { passive: true },
  );
}

// ── Quick Start page ──────────────────────────────────────────────────────────
const QS_MUSCLES = Object.keys(SHUFFLE_PLANS);

function getMuscleDaysAgo(muscle) {
  const history = get('workoutHistory') || [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i];
    const hasMusc = loggedExercisesOf(h).some(
      (ex) =>
        resolveMuscleGroup(ex.name, EXERCISES_DB)?.toLowerCase() ===
        muscle.toLowerCase(),
    );
    if (hasMusc) {
      const d = new Date(h.date);
      d.setHours(0, 0, 0, 0);
      return Math.round((today - d) / 864e5);
    }
  }
  return null;
}

function renderQSPage() {
  const el = document.getElementById('qs-page-chips');
  el.innerHTML = QS_MUSCLES.map((m) => {
    const days = getMuscleDaysAgo(m);
    let badge = '',
      cls = '';
    if (days === null) {
      cls = 'qs-fresh';
      badge = '<span class="qs-chip-badge">fresh</span>';
    } else if (days === 0) {
      cls = 'qs-hot';
      badge = '<span class="qs-chip-badge">today</span>';
    } else if (days <= 2) {
      cls = 'qs-warm';
      badge = `<span class="qs-chip-badge">${days}d ago</span>`;
    } else {
      cls = 'qs-ready';
      badge = `<span class="qs-chip-badge">${days}d</span>`;
    }
    return `<button class="qs-page-chip ${cls}" data-muscle="${m}">${m}${badge}</button>`;
  }).join('');
  el.querySelectorAll('.qs-page-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      closePage('qs-page');
      quickStartWorkout(chip.dataset.muscle);
    });
  });
}
document
  .getElementById('qs-back')
  .addEventListener('click', () => closePage('qs-page'));
document.getElementById('btn-qs-open').addEventListener('click', () => {
  renderQSPage();
  openPage('qs-page');
});

// ── Legends page ──────────────────────────────────────────────────────────────
let selectedLegendId = null;

function renderLegendsPage() {
  const legends = LEGENDS_DATA.filter((l) => l.id !== 'zyzz');
  if (!selectedLegendId) selectedLegendId = legends[0]?.id;

  const tabsEl = document.getElementById('legends-page-tabs');
  const eraEl = document.getElementById('legends-page-era');
  const contentEl = document.getElementById('legends-page-content');

  tabsEl.innerHTML = legends
    .map(
      (l) => `
    <button class="legend-tab${selectedLegendId === l.id ? ' active' : ''}" data-lid="${l.id}" title="${l.name}${l.era ? ` · ${l.era}` : ''}">
      <span class="lt-name">${l.name.split(' ').pop()}</span>
      ${l.era ? `<span class="lt-era">${l.era.replace(/[()]/g, '').split(' ')[0]}</span>` : ''}
    </button>
  `,
    )
    .join('');
  tabsEl.querySelectorAll('.legend-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedLegendId = btn.dataset.lid;
      renderLegendsPage();
    });
  });

  const legend = legends.find((l) => l.id === selectedLegendId);
  if (!legend) return;
  eraEl.textContent = legend.era || '';
  contentEl.innerHTML = legend.workouts
    .map(
      (w) => `
    <div class="legend-wcard" data-lid="${legend.id}" data-wname="${w.name}">
      <div class="lwc-left">
        <div class="lwc-name">${w.name}</div>
        <div class="lwc-exlist">${w.exercises
          .slice(0, 4)
          .map((e) => e.name)
          .join(' · ')}${w.exercises.length > 4 ? ' …' : ''}</div>
        <div class="lwc-meta">${w.badge} · ${w.exercises.length} exercises</div>
      </div>
      <div class="lwc-right">
        <div class="lwc-sets">${w.exercises.reduce((s, e) => s + e.sets, 0)}</div>
        <div class="lwc-sets-lbl">sets</div>
      </div>
    </div>
  `,
    )
    .join('');
  contentEl.querySelectorAll('.legend-wcard').forEach((card) => {
    card.addEventListener('click', () => {
      closePage('legends-page');
      startLegendWorkout(card.dataset.lid, card.dataset.wname);
    });
  });
}

function startLegendWorkout(legendId, workoutName) {
  const legend = LEGENDS_DATA.find((l) => l.id === legendId);
  const workout = legend?.workouts.find((w) => w.name === workoutName);
  if (!workout) return;
  const profile = getActiveProfile();
  const exercises = dedupeExercises(
    workout.exercises.map((e) => {
      const resolved = resolveExercise(e.name, profile);
      return {
        name: resolved.name,
        originalName: resolved.reason !== 'none' ? resolved.original : null,
        sets: e.sets,
        reps: String(e.reps),
        rest: e.rest || 90,
        logs: Array.from({ length: e.sets }, () => ({
          weight: '',
          reps: '',
          done: false,
        })),
      };
    }),
  );
  beginWorkout(workout.name, 'strength', exercises);
}

document
  .getElementById('legends-back')
  .addEventListener('click', () => closePage('legends-page'));
document.getElementById('btn-legends-open').addEventListener('click', () => {
  renderLegendsPage();
  openPage('legends-page');
});

// ── CrossFit page ─────────────────────────────────────────────────────────────
function renderCFPage() {
  const el = document.getElementById('cf-page-content');
  const byCategory = {};
  FAMOUS_WODS.forEach((w) => {
    byCategory[w.category] = byCategory[w.category] || [];
    byCategory[w.category].push(w);
  });

  el.innerHTML = Object.entries(byCategory)
    .map(
      ([cat, wods]) => `
    <div class="section-label" style="margin-bottom:12px">${cat === 'Girls' ? 'The Girls' : cat === 'Hero' ? 'Hero WODs' : cat}</div>
    ${wods
      .map((w) => {
        const movLine = (w.movements || [])
          .slice(0, 3)
          .map((m) => (m.reps ? `${m.reps} ${m.name}` : m.name))
          .join(' · ');
        return `<div class="legend-wcard" data-wod="${w.name}">
        <div class="lwc-left">
          <div class="lwc-name">${w.name}</div>
          <div class="lwc-exlist">${movLine}</div>
          <div class="lwc-meta">${
            w.description
              ?.toLowerCase()
              .includes(String(w.badge || '').toLowerCase())
              ? w.description
              : [w.badge, w.description].filter(Boolean).join(' · ')
          }</div>
        </div>
        <div class="lwc-right">
          <div class="lwc-sets">${w.movements?.length || 0}</div>
          <div class="lwc-sets-lbl">${(w.movements?.length || 0) === 1 ? 'move' : 'moves'}</div>
        </div>
      </div>`;
      })
      .join('')}
    <div style="height:20px"></div>
  `,
    )
    .join('');

  el.querySelectorAll('.legend-wcard[data-wod]').forEach((card) => {
    card.addEventListener('click', () => {
      const wod = FAMOUS_WODS.find((w) => w.name === card.dataset.wod);
      if (!wod) return;
      closePage('cf-page');
      beginCFWorkout(wod.name, wod);
    });
  });
}

document
  .getElementById('cf-back')
  .addEventListener('click', () => closePage('cf-page'));
document.getElementById('btn-cf-open').addEventListener('click', () => {
  renderCFPage();
  openPage('cf-page');
});

// ─── REHAB — guided back-protocol player ──────────────────────────────────────
// Follow-along mode: each step shows a built-in animated demo, the cue, and a
// countdown that auto-advances (holds, re-braces, side switches, rests). RDL
// sets are self-paced with a weight stepper. Everything is offline — demos are
// inline SVG, no video, no network. Crash-safe via kilos-rehab-state.
//
// Audio language (each phase sounds different, so you never have to look):
//   rising 3-2-1 ticks  → only ever counts you INTO work
//   high double beep    → work starts
//   single low tone     → rest starts (release)
//   double mid tone     → switch sides
//   soft tick           → each tempo rep boundary
//   rising triple       → session complete
// Plus spoken cues (speechSynthesis) — "Left side — hold", "Rest", rep counts —
// toggleable via the speaker button, persisted in kilos-rehab-voice.
const REHAB_STATE_KEY = 'kilos-rehab-state';
const REHAB_RDL_KEY = 'kilos-rehab-rdl-kg';
const REHAB_VOICE_KEY = 'kilos-rehab-voice';
const GUIDED_WEIGHTS_KEY = 'kilos-guided-weights';

// One guided player, two programs: the rehab protocol + Density 40.
const GUIDED_EXERCISES = { ...REHAB_EXERCISES, ...PROGRAM_EXERCISES };
const GUIDED_DEMOS = { ...REHAB_DEMOS, ...PROGRAM_DEMOS };
const getGuidedSession = (id) => getRehabSession(id) || getProgramSession(id);
const isProgramSession = (session) => !!session && session.id.startsWith('d40');

const GUIDED_DEFAULT_KG = {
  'pull-up': 0,
  'front-squat': 40,
  'floor-press': 40,
  rdl: 40,
};
function guidedWeightFor(exId) {
  const map = get(GUIDED_WEIGHTS_KEY) || {};
  if (map[exId] != null) return map[exId];
  // No memory yet (e.g. first session after a swap) — the last logged weight
  // for this exercise anywhere in history beats a hardcoded guess.
  const name = GUIDED_EXERCISES[exId]?.name;
  const lastLogs = name ? getLastSession(name) : null;
  const w = lastLogs?.length
    ? Math.max(...lastLogs.map((l) => parseFloat(l.weight) || 0))
    : 0;
  if (w > 0) return w;
  return GUIDED_DEFAULT_KG[exId] ?? 10;
}
// Rep-logged exercises (bodyweight variants) reuse the same memory map — the
// stored number just means reps; the default comes from the range's bottom.
function guidedRepsFor(exId, repsRange) {
  const map = get(GUIDED_WEIGHTS_KEY) || {};
  return map[exId] ?? (Number.parseInt(repsRange, 10) || 5);
}
// The athlete's chosen alternates, keyed by each slot's original exercise.
const SWAPS_KEY = 'kilos-ex-swaps';
const getSwaps = () => get(SWAPS_KEY) || {};
function saveGuidedWeight(exId, kg) {
  const map = get(GUIDED_WEIGHTS_KEY) || {};
  map[exId] = kg;
  set(GUIDED_WEIGHTS_KEY, map);
}

let rhSession = null;
let rhQueue = [];
let rhIdx = 0;
let rhRemainMs = 0;
let rhEndsAt = 0;
let rhRunning = false;
let rhInterval = null;
let rhStartedAt = null;
let rhCounted = new Set(); // step indices whose set already counted (idempotent)
let rhLiftSets = []; // [{weight, reps}] logged RDL sets
// Two-stage logging for range prescriptions ("5–8"): first tap flips the
// stepper to reps (prefilled at the range top), second tap logs the truth.
// null = weight stage. Exact prescriptions stay single-tap.
let rhPendingReps = null;
const repsIsRange = (r) => /\d\D+\d/.test(String(r ?? ''));
let rhWeightKg = 40;
let rhLastBeepSec = null;
const rhTempoMem = { key: null }; // cue dedupe for timed tempo sets
let rhStepEnteredAt = Date.now(); // for estimating manual-step time remaining
let rhAnnouncedIdx = -1; // last step index already announced (no double cues)
let rhLastSave = 0;
let rhWakeLock = null;
let rhWallInterval = null;
let rhGuide = null; // active tempo guide on a self-paced set
let rhGuideInterval = null;
let rhVoiceOn = get(REHAB_VOICE_KEY) ?? true;

const rhStep = () => rhQueue[rhIdx];

// Prefer a male coach voice. The Web Speech API has no gender field, so match
// known male system voices by name (Apple, Chrome, Windows — in preference
// order, US-accent first), taking an Enhanced/Premium variant when the device
// has one. Voices load async, so re-resolve until the list is populated.
const RH_MALE_VOICES = [
  'aaron',
  'daniel',
  'alex',
  'reed',
  'evan',
  'arthur',
  'google uk english male',
  'microsoft david',
  'microsoft mark',
  'microsoft guy',
  'rishi',
  'fred',
];
let rhVoice = null;

function rhRefreshVoice() {
  if (typeof speechSynthesis === 'undefined') return;
  let voices = [];
  try {
    voices = speechSynthesis.getVoices() || [];
  } catch {}
  if (!voices.length) return; // not loaded yet — try again on the next cue
  const english = voices.filter((v) => /^en/i.test(v.lang || ''));
  rhVoice = null;
  for (const name of RH_MALE_VOICES) {
    const matches = english.filter((v) => v.name.toLowerCase().includes(name));
    if (matches.length) {
      rhVoice =
        matches.find((v) => /enhanced|premium/i.test(v.name)) || matches[0];
      break;
    }
  }
}
if (typeof speechSynthesis !== 'undefined') {
  rhRefreshVoice();
  speechSynthesis.addEventListener?.('voiceschanged', rhRefreshVoice);
}

// Gabe's own voice, when recorded: drop clips in public/voice/<slug>.m4a
// (or .mp3) per VOICE-RECORDING.md and they replace the system voice. Cues are
// built from parts (['left-side','go']); if any part's clip is missing the
// whole phrase falls back to speech synthesis.
const rhClipCache = new Map(); // slug → url | null
function rhProbeClip(slug) {
  if (rhClipCache.has(slug)) return Promise.resolve(rhClipCache.get(slug));
  const tryLoad = (url) =>
    new Promise((resolve) => {
      const a = new Audio();
      a.oncanplaythrough = () => resolve(url);
      a.onerror = () => resolve(null);
      a.preload = 'auto';
      a.src = url;
    });
  const probe = (async () => {
    let found = null;
    for (const ext of ['m4a', 'mp3', 'webm']) {
      found = await tryLoad(`/voice/${slug}.${ext}`);
      if (found) break;
    }
    rhClipCache.set(slug, found);
    return found;
  })();
  rhClipCache.set(slug, null);
  return probe;
}
const rhClipBuffers = new Map(); // slug → AudioBuffer (beat-accurate playback)
async function rhDecodeClip(slug) {
  if (rhClipBuffers.has(slug)) return rhClipBuffers.get(slug);
  const url = rhClipCache.get(slug);
  if (!url) return null;
  try {
    const res = await fetch(url);
    const buf = await ensureCtx().decodeAudioData(await res.arrayBuffer());
    rhClipBuffers.set(slug, buf);
    return buf;
  } catch {
    return null;
  }
}
// One voice, one mic: announcements (rest / get set / side — go) outrank
// tempo words; tempo counts DROP rather than talk over anything; a phase
// word may cut a lingering count's tail. Without this, the buffer channel
// and the announcement channel play simultaneously — audible pile-ups at
// set start ("go" + "lift") and set end (last count + "rest").
let rhBufSrc = null;
let rhBufUntil = 0;
let rhAnnounceUntil = 0;
const rhAnnounceActive = () => Date.now() < rhAnnounceUntil;
function rhStopBuf() {
  try {
    rhBufSrc?.stop();
  } catch {}
  rhBufSrc = null;
  rhBufUntil = 0;
}
function rhPlayBuf(slug, opts = {}) {
  const buf = rhClipBuffers.get(slug);
  if (!buf) return false;
  // Gate on the live announce source too — window arithmetic can drift, a
  // playing chain cannot.
  if (rhAnnounceActive() || rhAnnSrc) return false;
  const now = Date.now();
  // Counts drop when they'd talk over a word; phase words cut anything with
  // more than a fade-tail left (30ms) — rep boundaries must land clean.
  if (rhBufUntil - now > (opts.cut ? 30 : 120)) {
    if (!opts.cut) return false;
    rhStopBuf();
  }
  try {
    const ctx = ensureCtx();
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(ctx.currentTime);
    rhBufSrc = src;
    rhBufUntil = now + buf.duration * 1000;
    src.onended = () => {
      if (rhBufSrc === src) {
        rhBufSrc = null;
        rhBufUntil = 0;
      }
    };
    return true;
  } catch {
    return false;
  }
}
// Announcement playback through the AudioContext (gesture-free on iOS).
let rhAnnSrc = null;
function rhStopAnnounce() {
  try {
    rhAnnSrc?.stop();
  } catch {}
  rhAnnSrc = null;
}
function rhPlayClipSeq(slugs) {
  const ctx = ensureCtx();
  if (ctx.state === 'suspended') ctx.resume();
  rhStopBuf(); // announcements outrank tempo words
  rhStopAnnounce();
  const bufs = slugs.map((sl) => rhClipBuffers.get(sl)).filter(Boolean);
  // An announcement belongs to its moment. If the context was suspended and
  // playback queued, a late clip must be DROPPED, not fired mid-set as a
  // ghost over the tempo words.
  const deadline =
    Date.now() + bufs.reduce((sum, b) => sum + b.duration, 0) * 1000 + 1500;
  let i = 0;
  const playNext = () => {
    if (i >= bufs.length || Date.now() > deadline) {
      rhAnnounceUntil = 0;
      rhAnnSrc = null;
      return;
    }
    // re-anchor the mic window each hop — onended latency accumulates, and an
    // undershot window lets a tempo count talk over the announcement's tail
    const remaining = bufs
      .slice(i)
      .reduce((sum, b) => sum + b.duration, 0);
    rhAnnounceUntil = Date.now() + remaining * 1000 + 400;
    const src = ctx.createBufferSource();
    src.buffer = bufs[i];
    i += 1;
    src.connect(ctx.destination);
    src.onended = playNext;
    rhAnnSrc = src;
    src.start(ctx.currentTime);
  };
  playNext();
}

let rhClipAudio = null;
function rhPlayClips(urls) {
  try {
    rhClipAudio?.pause();
  } catch {}
  rhStopBuf();
  rhStopAnnounce();
  // ceiling estimate keeps the mic reserved even if `ended` never fires
  // (autoplay rejection); the chain clears it early on real completion.
  rhAnnounceUntil = Date.now() + urls.length * 1100;
  const done = () => {
    rhAnnounceUntil = 0;
  };
  const next = (i) => {
    if (i >= urls.length) {
      done();
      return;
    }
    rhClipAudio = new Audio(urls[i]);
    rhClipAudio.onended = () => next(i + 1);
    rhClipAudio.play().catch(done);
  };
  next(0);
}
// Speak a cue from parts. Decoded-buffer clips first (play from timers on
// iOS), HTMLAudio second (still fine mid-gesture), TTS last.
function rhCueSay(parts, ttsText) {
  if (!rhVoiceOn) return;
  if (parts.length && parts.every((slug) => rhClipBuffers.get(slug))) {
    rhPlayClipSeq(parts);
    return;
  }
  const urls = parts.map((slug) => rhClipCache.get(slug));
  if (urls.length && urls.every(Boolean)) {
    rhPlayClips(urls);
    return;
  }
  rhSay(ttsText ?? parts.join(' ').replace(/-/g, ' '));
}
// Spoken rep ranges: "5–8" reads as "5 to 8", "/side" as "per side".
const speakReps = (r) =>
  String(r || '')
    .replace(/[–-]/g, ' to ')
    .replace(/\/side/g, ' per side');

function rhSay(text) {
  if (!rhVoiceOn || typeof speechSynthesis === 'undefined') return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.05;
    if (!rhVoice) rhRefreshVoice();
    if (rhVoice) {
      // A bad/stale voice must never silence the cue — fall back to default.
      try {
        u.voice = rhVoice;
      } catch {}
    }
    speechSynthesis.speak(u);
  } catch {}
}

function rhCue(kind) {
  if (kind === 'work') {
    // the LANDING: one long unmistakable tone — the CrossFit-timer "go"
    beep(1000, 0.55);
  } else if (kind === 'rest') {
    beep(392, 0.3);
  } else if (kind === 'switch') {
    beep(523, 0.12);
    setTimeout(() => beep(523, 0.12), 170);
  } else if (kind === 'rep') {
    beep(520, 0.05);
  } else if (kind === 'count') {
    // 3-2-1: short bright beeps clearly ABOVE the in-set tick; the landing
    // (long work tone / low rest tone) is the "long beep".
    beep(1000, 0.12);
  } else if (kind === 'finish') {
    beep(660, 0.12);
    setTimeout(() => beep(830, 0.12), 160);
    setTimeout(() => beep(990, 0.24), 320);
  }
}

// Arriving at a step: distinct tone + spoken cue, so ears alone carry you.
function rhAnnounceStep(step) {
  rhAnnouncedIdx = rhIdx;
  const overlay = document.getElementById('rehab-player');
  if (step.kind === 'work') {
    rhCue('work');
    // Quick edge flash — the visual "GO" that can't be missed mid-set.
    overlay.classList.remove('rp-flash');
    void overlay.offsetWidth;
    overlay.classList.add('rp-flash');
  } else if (step.phase === 'SWITCH SIDES') {
    rhCue('switch');
  } else if (step.phase === 'REST') {
    rhCue('rest');
  } // BREATHE micro-rests stay silent — the 3-2-1 ticks carry them
  navigator.vibrate?.(step.kind === 'work' ? 120 : 60);

  const ex = GUIDED_EXERCISES[step.exId];
  const NUMS = [
    'zero',
    'one',
    'two',
    'three',
    'four',
    'five',
    'six',
    'seven',
    'eight',
    'nine',
    'ten',
  ];
  if (step.kind === 'prep') {
    rhCueSay(['get-set', `name-${step.exId}`], `Get set — ${ex.name}`);
  } else if (step.kind === 'work') {
    if (step.manual && step.logWeight === false) {
      rhCueSay(['warm-up'], 'Warm up — your pace');
    } else if (step.manual) {
      rhCueSay(['your-pace'], `Set — ${speakReps(step.reps)} reps, your pace`);
    } else if (step.tempo) {
      rhCueSay(
        step.side ? [`${step.side.toLowerCase()}-side`, 'go'] : ['go'],
        step.side ? `${step.side.toLowerCase()} side — go` : 'Go',
      );
    } else if (step.rep > 1) {
      rhCueSay([NUMS[step.rep] || 'go'], String(step.rep));
    } else if (step.holdSet && step.setTotal > 1) {
      // "know what I'm expecting": position in the hold sets, spoken
      const parts = step.side ? [`${step.side.toLowerCase()}-side`] : [];
      parts.push('hold', NUMS[step.setNum] || 'go', 'of', NUMS[step.setTotal] || 'go');
      const sideBit = step.side ? `${step.side.toLowerCase()} side — ` : '';
      rhCueSay(parts, `${sideBit}hold. ${step.setNum} of ${step.setTotal}.`);
    } else {
      rhCueSay(
        step.side ? [`${step.side.toLowerCase()}-side`, 'hold'] : ['hold'],
        step.side ? `${step.side.toLowerCase()} side — hold` : 'Hold',
      );
    }
  } else if (step.phase === 'SWITCH SIDES') {
    rhCueSay(['switch-sides'], 'Switch sides');
  } else if (step.phase === 'REST') {
    // Leaving an exercise? Say where we're going — the athlete plans the
    // rest around what's next.
    const nextLabel = nextWorkLabel(rhQueue, rhIdx);
    const nextStep = rhQueue.slice(rhIdx + 1).find((st) => st.kind === 'work');
    if (nextStep && nextStep.exId !== step.exId) {
      const parts = ['rest', 'next', `name-${nextStep.exId}`];
      if (nextStep.side) parts.push(`${nextStep.side.toLowerCase()}-side`);
      rhCueSay(parts, `Rest. Next — ${nextLabel.replace('·', ',')}`);
    } else {
      rhCueSay(['rest'], 'Rest');
    }
  }
}

function rhPersist() {
  if (!rhSession) {
    try {
      localStorage.removeItem(REHAB_STATE_KEY);
    } catch {}
    return;
  }
  set(REHAB_STATE_KEY, {
    sessionId: rhSession.id,
    idx: rhIdx,
    remainMs: rhRunning ? Math.max(0, rhEndsAt - Date.now()) : rhRemainMs,
    running: rhRunning,
    startedAt: rhStartedAt,
    counted: [...rhCounted],
    liftSets: rhLiftSets,
    weightKg: rhWeightKg,
    savedAt: Date.now(),
  });
  rhLastSave = Date.now();
}

async function rhAcquireWakeLock() {
  try {
    rhWakeLock = await navigator.wakeLock?.request('screen');
  } catch {
    /* not supported / denied — fine */
  }
}
function rhReleaseWakeLock() {
  try {
    rhWakeLock?.release();
  } catch {}
  rhWakeLock = null;
}

function rhFmt(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

// Time left in the whole session: the current step's remaining clock plus all
// steps still ahead (self-paced lift sets estimated at 35s each).
function rhSessionRemainMs() {
  const step = rhStep();
  let ms = 0;
  if (step) {
    ms = step.manual
      ? Math.max(0, 35000 - (Date.now() - rhStepEnteredAt))
      : rhRemainMs;
  }
  for (let i = rhIdx + 1; i < rhQueue.length; i++) {
    ms += (rhQueue[i].secs ?? 35) * 1000;
  }
  return ms;
}

function rhRenderSessionRemain() {
  document.getElementById('rp-count').textContent =
    `${rhFmt(rhSessionRemainMs())} LEFT`;
}

function rhRenderClock() {
  const step = rhStep();
  if (!step || step.manual) return;
  const total = step.secs * 1000;
  if (step.tempo) {
    // Tempo sets: the live rep count is the hero, the phase word coaches the
    // sub-movement (LIFT / SQUEEZE / LOWER) in time with the demo loop.
    const st = tempoStateAt(step.tempo, total - rhRemainMs);
    document.getElementById('rp-time').textContent =
      `${st.rep}/${step.tempo.reps}`;
    document.getElementById('rp-phase').textContent = st.label;
  } else {
    document.getElementById('rp-time').textContent = rhFmt(rhRemainMs);
  }
  const pct = total > 0 ? (1 - rhRemainMs / total) * 100 : 0;
  document.getElementById('rp-bar').style.width =
    `${Math.min(100, Math.max(0, pct))}%`;
}

function rhRenderPlayBtn() {
  const active = rhRunning || !!rhGuide;
  document.getElementById('rp-play-icon').style.display = active ? 'none' : '';
  document.getElementById('rp-pause-icon').style.display = active ? '' : 'none';
}

function rhRenderWeight() {
  const repMode = rhStep()?.logReps || rhPendingReps !== null;
  const val = rhPendingReps !== null ? rhPendingReps : rhWeightKg;
  document.getElementById('rp-w-val').textContent = repMode
    ? val
    : toDisplayWeight(val);
  document.querySelector('.rp-w-unit').textContent = repMode
    ? 'reps'
    : weightUnit();
}

// ── Demo art override ────────────────────────────────────────────────────────
// Drop licensed/commissioned illustrations in public/rehab/ and they replace
// the built-in figure — no code changes:
//   /rehab/<exercise-id>-a.svg   start pose (required; .png/.webp also work)
//   /rehab/<exercise-id>-b.svg   contraction pose (optional → crossfades A↔B)
// Custom art renders on a light panel (Hevy-style), so standard white-bg stock
// illustrations look right inside the dark player. Probed once per exercise,
// cached; falls back to the built-in rig while probing / when absent.
const rhArtCache = new Map(); // exId → {a, b} | null

function rhProbeArt(exId) {
  if (rhArtCache.has(exId)) return Promise.resolve(rhArtCache.get(exId));
  const tryLoad = (url) =>
    new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(url);
      img.onerror = () => resolve(null);
      img.src = url;
    });
  const probe = (async () => {
    let a = null;
    let b = null;
    for (const ext of ['svg', 'png', 'webp']) {
      a = await tryLoad(`/rehab/${exId}-a.${ext}`);
      if (a) {
        b = await tryLoad(`/rehab/${exId}-b.${ext}`);
        break;
      }
    }
    // tween frames enable tempo-synced stop-motion (t0 = bottom … tN = top)
    const frames = [];
    for (let i = 0; i < 9; i++) {
      const f = await tryLoad(`/rehab/${exId}-t${i}.webp`);
      if (!f) break;
      frames.push(f);
    }
    const art =
      a || frames.length
        ? { a, b, frames: frames.length >= 3 ? frames : null }
        : null;
    rhArtCache.set(exId, art);
    return art;
  })();
  rhArtCache.set(exId, null); // don't re-probe while in flight
  return probe;
}

function rhRenderDemo(demoEl, exId) {
  const art = rhArtCache.get(exId);
  if (art?.frames) {
    demoEl.innerHTML = `<div class="rp-art" data-frames="${art.frames.length}">
      ${art.frames
        .map(
          (f, i) =>
            `<img class="rp-art-img frame${i === 0 ? ' on' : ''}" data-frame="${i}" src="${f}" alt="">`,
        )
        .join('')}
    </div>`;
    rhFrameState.idx = 0;
    rhFrameState.exId = exId;
    return;
  }
  if (art?.a) {
    const fade = art.b ? ' fade' : '';
    demoEl.innerHTML = `<div class="rp-art">
      <img class="rp-art-img${fade}" src="${art.a}" alt="">
      ${art.b ? `<img class="rp-art-img b fade" src="${art.b}" alt="">` : ''}
    </div>`;
    return;
  }
  // Built-in figure (also shown while the first probe is in flight)
  demoEl.innerHTML = GUIDED_DEMOS[exId] || '';
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) {
    // Static demos freeze at the working position (the drawn pose).
    demoEl.querySelectorAll('animate, animateTransform').forEach((a) => {
      a.remove();
    });
  }
  if (!rhArtCache.has(exId)) {
    rhProbeArt(exId).then((found) => {
      // Swap in the illustration if this exercise is still on screen.
      if (found && rhStep()?.exId === exId) rhRenderDemo(demoEl, exId);
    });
  }
}

// Tempo cue schemes (from the audio research — pick by ear in Sound Check):
//   coach — your voice counting each second over a uniform click; drive = da-DUM + "lift"
//   voice — pure voice counting, no synthesis
//   click — pure metronome: tick/s on the eccentric, double-tick on squeeze, da-DUM drive
const TEMPO_SCHEME_KEY = 'kilos-tempo-scheme';
const getTempoScheme = () => get(TEMPO_SCHEME_KEY) || 'coach';

const NUM_SLUGS = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
];
function phaseWordSlug(label) {
  if (label === 'UP' || label === 'LIFT') return 'lift';
  if (label === 'SQUEEZE') return 'squeeze';
  if (label === 'PAUSE') return 'hold';
  return 'lower';
}

function rhTempoTick(st, mem) {
  const key = `${st.rep}:${st.label}:${st.phaseSec}`;
  if (mem.key === key) return;
  mem.key = key;
  const scheme = getTempoScheme();
  const isDrive = st.label === 'UP' || st.label === 'LIFT';
  const isSqueeze = st.label === 'SQUEEZE' || st.label === 'PAUSE';
  // the word: phase word on second 1 (it IS count one); in-phase numbers only
  // when the phase is long enough to need pacing (≥3s) — a 2s squeeze saying
  // "squeeze… two" is noise, a 3s eccentric saying "down… two… three" is help
  const slug =
    st.phaseSec === 0
      ? phaseWordSlug(st.label)
      : st.phaseLen >= 3
        ? NUM_SLUGS[st.phaseSec + 1]
        : null;
  const wantVoice = rhVoiceOn && (scheme === 'coach' || scheme === 'voice');
  // phase words may cut a lingering count; plain counts never talk over
  const spoke = wantVoice && slug ? rhPlayBuf(slug, { cut: st.phaseSec === 0 }) : false;
  // in voice scheme, silent beats stay silent — no surprise ticks in a
  // tickless scheme (word dropped by an announcement, or a no-number beat)
  if (scheme === 'voice' && (spoke || !slug || rhAnnounceActive())) return;
  // synthesis layer (coach + click, and voice's fallback when a clip is missing)
  if (isDrive) {
    if (st.phaseSec === 0) driveAccent();
    else clickTick();
  } else if (isSqueeze) {
    if (scheme === 'click') clickTickDouble();
    else clickTick();
  } else {
    clickTick();
  }
}

// ── Demo frame driver: t-frames scrub with the tempo (up = climb the frames,
// squeeze = hold the top, slow eccentric = step down slowly). Idle steps get a
// gentle stop-motion cycle instead.
const rhFrameState = { idx: -1, exId: null };
function rhSetDemoFrame(idx) {
  if (idx === rhFrameState.idx) return;
  const stage = document.querySelector('#rp-demo .rp-art[data-frames]');
  if (!stage) return;
  rhFrameState.idx = idx;
  stage.querySelectorAll('.rp-art-img.frame').forEach((img) => {
    img.classList.toggle('on', Number(img.dataset.frame) === idx);
  });
}
function rhFrameCount() {
  const stage = document.querySelector('#rp-demo .rp-art[data-frames]');
  return stage ? Number(stage.dataset.frames) : 0;
}
// Map a tempo state onto a frame index (0 = start pose, N-1 = contracted).
// Direction comes from the pattern, not the label's name: the pattern's FIRST
// phase always travels 0 → top (bridge LIFT rises, RDL DOWN hinges), squeezes
// park on top, the return phase travels back. Steps are word-anchored so the
// picture moves ON the cue: leave the floor the instant the first word lands,
// top out exactly when "squeeze" fires, visibly drop on "lower".
function rhFrameForTempo(st, n, pattern) {
  const top = n - 1;
  if (st.label === 'SQUEEZE' || st.label === 'PAUSE') return top;
  if (st.label === pattern?.[0]?.[0]) {
    // outbound: climb the intermediates, save the top for the squeeze beat
    // (no squeeze in the pattern → let it reach the top itself)
    const hasSqueeze = pattern.some(([l]) => l === 'SQUEEZE' || l === 'PAUSE');
    const cap = hasSqueeze ? top - 1 : top;
    return Math.min(cap, 1 + Math.floor(st.phaseProgress * cap));
  }
  // return: first step down lands with the word, floor before the rep ends
  return Math.max(0, top - 1 - Math.floor(st.phaseProgress * top));
}
function rhIdleFrameTick() {
  // slow stop-motion cycle when nothing is pacing the figure
  const n = rhFrameCount();
  if (!n) return;
  const t = Math.floor(Date.now() / 900);
  const cycle = t % (2 * (n - 1));
  rhSetDemoFrame(cycle < n ? cycle : 2 * (n - 1) - cycle);
}

// ── Tempo guide for self-paced sets: count-in, then glide-paced reps ─────────
function rhStopGuide(silent = false) {
  if (rhGuideInterval) clearInterval(rhGuideInterval);
  rhGuideInterval = null;
  const was = rhGuide;
  rhGuide = null;
  if (was && !silent) rhCue('rest');
  const g = document.getElementById('rp-guide');
  if (g) g.textContent = 'TAP ▶ FOR TEMPO GUIDE';
  rhRenderPlayBtn();
}

function rhStartGuide() {
  const step = rhStep();
  if (!step?.manual || !step.repTempo) return;
  const secsPerRep = step.repTempo.reduce((sum, [, x]) => sum + x, 0);
  rhGuide = {
    tempo: { reps: step.repTarget, secsPerRep, pattern: step.repTempo },
    startsAt: Date.now() + 3000, // 3-beep count-in
    lastCountSec: null,
    key: null,
  };
  rhRenderPlayBtn();
  if (rhGuideInterval) clearInterval(rhGuideInterval);
  rhGuideInterval = setInterval(() => {
    const g = rhGuide;
    const el = document.getElementById('rp-guide');
    if (!g || !el) return;
    const now = Date.now();
    if (now < g.startsAt) {
      const sec = Math.ceil((g.startsAt - now) / 1000);
      if (sec !== g.lastCountSec) {
        g.lastCountSec = sec;
        rhCue('count');
      }
      el.textContent = `READY · ${sec}`;
      return;
    }
    const elapsed = now - g.startsAt;
    const total = g.tempo.reps * g.tempo.secsPerRep * 1000;
    if (elapsed >= total) {
      el.textContent = `${g.tempo.reps}/${g.tempo.reps} · DONE`;
      rhStopGuide();
      return;
    }
    const st = tempoStateAt(g.tempo, elapsed);
    rhTempoTick(st, g);
    const n = rhFrameCount();
    if (n) rhSetDemoFrame(rhFrameForTempo(st, n, g.tempo.pattern));
    el.textContent = `${st.rep}/${g.tempo.reps} · ${st.label}`;
  }, 100);
}

// ── Session overview sheet: done above, current anchored, upcoming below ────
function rhRenderOverview() {
  const overlay = document.getElementById('rp-overview');
  if (!overlay.classList.contains('open') || !rhSession) return;
  document.getElementById('rpo-title').textContent =
    `${rhSession.name} · FULL SESSION`.toUpperCase();
  const currentBi = rhStep()?.bi ?? 0;
  // a block is done when every one of its steps is behind us
  const lastIdxByBi = {};
  rhQueue.forEach((st, i) => {
    lastIdxByBi[st.bi] = i;
  });
  document.getElementById('rpo-list').innerHTML = sessionOverview(rhSession, getSwaps())
    .map((row, bi2) => {
      const state =
        lastIdxByBi[bi2] < rhIdx ? 'done' : bi2 === currentBi ? 'current' : '';
      return `<div class="rpo-item ${state}" ${state === 'current' ? 'data-current' : ''}>
        <div class="rpo-item-title">${row.title}</div>
        <div class="rpo-item-detail">${row.detail}</div>
        ${row.note ? `<div class="rpo-item-note">${row.note}</div>` : ''}
      </div>`;
    })
    .join('');
  // anchor the view on NOW — finished work sits above, scrollable
  const cur = document.querySelector('#rpo-list [data-current]');
  if (cur) {
    const list = document.getElementById('rpo-list');
    list.scrollTop = Math.max(0, cur.offsetTop - list.offsetTop - 8);
  }
}
function rhOpenOverview() {
  if (!rhSession) return;
  document.getElementById('rp-overview').classList.add('open');
  rhRenderOverview();
}
document.getElementById('rp-guide').addEventListener('click', () => {
  const step = rhStep();
  if (!step?.manual || !step.repTempo) return;
  if (rhGuide) rhStopGuide(true);
  else rhStartGuide();
});
document
  .getElementById('rp-overview-btn')
  .addEventListener('click', rhOpenOverview);
// MORE is retired — the cue now shows in full (compact), so there's no button
// to wire. The element stays hidden in the DOM.
// Finish early from the overview — logged work saves, the queue is skipped.
document.getElementById('rpo-finish').addEventListener('click', () => {
  document.getElementById('rp-overview').classList.remove('open');
  const n = rhCounted.size;
  document.getElementById('rhfinish-sub').textContent = n
    ? `${n} set${n === 1 ? '' : 's'} logged and saved. The remaining steps are skipped.`
    : 'Nothing logged yet — this saves the session as done anyway.';
  document.getElementById('rhfinish-confirm').classList.add('open');
});
document.getElementById('btn-rhfinish-yes').addEventListener('click', () => {
  document.getElementById('rhfinish-confirm').classList.remove('open');
  rhFinish();
});
document.getElementById('btn-rhfinish-no').addEventListener('click', () => {
  document.getElementById('rhfinish-confirm').classList.remove('open');
});
document.getElementById('rp-exname').addEventListener('click', rhOpenOverview);
document.getElementById('rpo-close').addEventListener('click', () => {
  document.getElementById('rp-overview').classList.remove('open');
});
document.getElementById('rp-overview').addEventListener('click', (e) => {
  if (e.target === document.getElementById('rp-overview')) {
    document.getElementById('rp-overview').classList.remove('open');
  }
});

// ── Exercise swap: pick a sanctioned alternate for this slot ────────────────
// The choice persists (kilos-ex-swaps) and applies to every future session;
// the live queue is rebuilt in place — step counts are identical across
// variants, so the current index stays valid.
function rhCloseSwapSheet() {
  document.getElementById('rp-swap-sheet').classList.remove('open');
}
function rhApplySwap(chosenId) {
  const step = rhStep();
  if (!step?.baseEx) return;
  const swaps = getSwaps();
  if (chosenId === step.baseEx) delete swaps[step.baseEx];
  else swaps[step.baseEx] = chosenId;
  set(SWAPS_KEY, swaps);
  const rebuilt = buildStepQueue(rhSession, swaps);
  if (rebuilt.length === rhQueue.length) {
    rhQueue = rebuilt;
  } else {
    // fallback (never expected): remap just this slot's steps in place
    for (const st of rhQueue) {
      if (st.baseEx === step.baseEx) {
        const spec = st.altSpecs?.find((a) => a.ex === chosenId);
        st.exId = chosenId;
        if (spec?.reps) st.reps = spec.reps;
      }
    }
  }
  rhCloseSwapSheet();
  rhRenderStep();
  rhPersist();
}
document.getElementById('rp-swap').addEventListener('click', () => {
  const step = rhStep();
  if (!step?.altSpecs) return;
  document.getElementById('rp-swap-list').innerHTML = step.altSpecs
    .map((a) => {
      const ex = GUIDED_EXERCISES[a.ex];
      const current = a.ex === step.exId;
      const sub = [
        a.reps ? `${a.reps} reps` : '',
        ex?.logReps ? 'logs reps' : '',
      ]
        .filter(Boolean)
        .join(' · ');
      return `<button class="rps-opt${current ? ' current' : ''}" data-ex="${a.ex}">
        <span class="rps-name">${ex?.name || a.ex}</span>
        <span class="rps-sub">${current ? 'CURRENT' : sub}</span>
      </button>`;
    })
    .join('');
  document.getElementById('rp-swap-sheet').classList.add('open');
  document.querySelectorAll('#rp-swap-list .rps-opt').forEach((btn) => {
    btn.addEventListener('click', () => rhApplySwap(btn.dataset.ex));
  });
});
document
  .getElementById('rp-swap-close')
  .addEventListener('click', rhCloseSwapSheet);
document.getElementById('rp-swap-sheet').addEventListener('click', (e) => {
  if (e.target === document.getElementById('rp-swap-sheet')) rhCloseSwapSheet();
});

function rhRenderVoiceBtn() {
  document.getElementById('rp-voice-on').style.display = rhVoiceOn
    ? ''
    : 'none';
  document.getElementById('rp-voice-off').style.display = rhVoiceOn
    ? 'none'
    : '';
  document
    .getElementById('rp-voice')
    .setAttribute('aria-pressed', String(rhVoiceOn));
}

function rhRenderStep() {
  const step = rhStep();
  if (!step) return;
  const ex = GUIDED_EXERCISES[step.exId];
  const overlay = document.getElementById('rehab-player');

  overlay.classList.toggle('phase-rest', step.kind === 'rest');
  overlay.classList.toggle('phase-work', step.kind === 'work');
  document.getElementById('rp-session-name').textContent =
    rhSession.name.toUpperCase();
  rhRenderSessionRemain();

  // Demo — licensed illustration if present, else the built-in figure.
  const demoEl = document.getElementById('rp-demo');
  rhRenderDemo(demoEl, step.exId);
  demoEl.classList.toggle('flip', step.side === 'RIGHT');

  document.getElementById('rp-exname').textContent = ex.name;
  document.getElementById('rp-meta').textContent = step.meta || '';
  const cueEl = document.getElementById('rp-cue');
  cueEl.textContent =
    step.kind === 'prep'
      ? `${ex.cue} — ${ex.why}`
      : [ex.cue, step.cueNote].filter(Boolean).join(' — ');
  // Full cue always shows now (no clamp, compact type) — MORE stays hidden.
  const moreEl = document.getElementById('rp-cue-more');
  if (moreEl) moreEl.style.display = 'none';
  // Coach rows — where to feel it, what gives the rep away.
  const coachEl = document.getElementById('rp-coach');
  if (coachEl) {
    coachEl.style.display = ex.feel || ex.avoid ? '' : 'none';
    const feelEl = document.getElementById('rp-coach-feel');
    const avoidEl = document.getElementById('rp-coach-avoid');
    feelEl.textContent = ex.feel || '';
    avoidEl.textContent = ex.avoid || '';
    feelEl.parentElement.style.display = ex.feel ? '' : 'none';
    avoidEl.parentElement.style.display = ex.avoid ? '' : 'none';
  }
  document.getElementById('rp-phase').textContent = step.phase;

  // Countdown vs self-paced set (with or without a weight to log)
  document.getElementById('rp-clock').style.display = step.manual ? 'none' : '';
  document.getElementById('rp-lift').style.display = step.manual ? '' : 'none';
  rhPendingReps = null; // arriving at any step resets the two-stage logger
  const skipBtn = document.getElementById('rp-skip');
  const isManualWork = !!(step.manual && step.kind === 'work');
  skipBtn.innerHTML = isManualWork
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>';
  skipBtn.setAttribute(
    'aria-label',
    isManualWork ? 'Log set and continue' : 'Next step',
  );
  skipBtn.classList.toggle('rp-ctrl-log', isManualWork);
  if (step.manual) {
    const showWeight = step.logWeight !== false;
    document.querySelector('.rp-weight-row').style.display = showWeight
      ? ''
      : 'none';
    document.getElementById('rp-set-done').style.display = 'none';
    document.getElementById('rp-set-done').textContent = showWeight
      ? 'Set done →'
      : 'Done →';
    if (showWeight) {
      rhWeightKg = step.logReps
        ? guidedRepsFor(step.exId, step.reps)
        : guidedWeightFor(step.exId);
      rhRenderWeight();
    }
    // Glance context: what you did last time and what today asks for.
    const ctxEl = document.getElementById('rp-context');
    if (ctxEl) {
      let ctx = '';
      if (showWeight) {
        const lastLogs = getLastSession(ex?.name);
        if (lastLogs?.length) {
          const top = lastLogs.reduce((b, l) =>
            (parseFloat(l.weight) || 0) > (parseFloat(b.weight) || 0) ? l : b,
          );
          if (step.logReps) {
            ctx = `LAST ${top.reps || '—'} REPS`;
          } else {
            const sugg = suggestNextWeight(lastLogs, step.reps);
            ctx = `LAST ${toDisplayWeight(top.weight)}×${top.reps || '—'}`;
            if (sugg) {
              ctx += ` · TARGET ${toDisplayWeight(sugg)}${weightUnit()}`;
            }
          }
        }
      }
      ctxEl.textContent = ctx;
      ctxEl.style.display = ctx ? '' : 'none';
    }
  } else {
    rhRenderClock();
  }

  // Only rests point forward — on prep/work the screen already IS the task.
  document.getElementById('rp-next').textContent =
    step.kind === 'rest'
      ? `NEXT · ${nextWorkLabel(rhQueue, rhIdx).toUpperCase()}`
      : '';

  rhRenderOverview();
  rhStopGuide(true);
  const guideEl = document.getElementById('rp-guide');
  if (guideEl) {
    guideEl.style.display = step.manual && step.repTempo ? '' : 'none';
    guideEl.textContent = 'TAP ▶ FOR TEMPO GUIDE';
  }
  const swapEl = document.getElementById('rp-swap');
  if (swapEl) {
    swapEl.style.display = step.manual && step.altSpecs ? '' : 'none';
  }
  document.getElementById('rp-prev').disabled = rhIdx === 0;
  const playBtn = document.getElementById('rp-play');
  playBtn.disabled = !!step.manual && !step.repTempo;
  rhRenderPlayBtn();
}

function rhStop() {
  if (rhInterval) clearInterval(rhInterval);
  rhInterval = null;
  rhRunning = false;
}

function rhPause() {
  if (rhRunning) rhRemainMs = Math.max(0, rhEndsAt - Date.now());
  rhStop();
  rhRenderPlayBtn();
  rhPersist();
}

function rhPlay() {
  const step = rhStep();
  if (!step || step.manual || rhRunning) return;
  rhEndsAt = Date.now() + rhRemainMs;
  rhRunning = true;
  rhLastBeepSec = null;
  if (rhInterval) clearInterval(rhInterval);
  rhInterval = setInterval(rhTick, 250);
  rhRenderPlayBtn();
  rhAcquireWakeLock();
  rhPersist();
}

function rhTick() {
  if (!rhRunning) return;
  const left = rhEndsAt - Date.now();
  if (left <= 0) {
    rhComplete(-left);
    return;
  }
  rhRemainMs = left;
  const step = rhStep();
  const sec = Math.ceil(left / 1000);

  // Rising 3-2-1 into work — only from rests long enough to need it (short
  // breathes flow straight into the "go" cue, no tick spam).
  const next = rhQueue[rhIdx + 1];
  if (
    step.kind !== 'work' &&
    next?.kind === 'work' &&
    step.secs > 6 &&
    sec <= 3 &&
    sec !== rhLastBeepSec
  ) {
    rhLastBeepSec = sec;
    rhCue('count');
  }

  // End-of-hold countdown — CrossFit beeps so you know the release is coming.
  if (
    step.kind === 'work' &&
    !step.tempo &&
    step.secs >= 8 &&
    sec <= 3 &&
    sec !== rhLastBeepSec
  ) {
    rhLastBeepSec = sec;
    rhCue('count');
  }

  // Tempo sets: percussive per-second pacing + frame-synced figure.
  if (step.tempo) {
    const st = tempoStateAt(step.tempo, step.secs * 1000 - left);
    rhTempoTick(st, rhTempoMem);
    const n = rhFrameCount();
    if (n) rhSetDemoFrame(rhFrameForTempo(st, n, step.tempo.pattern));
  }

  rhRenderClock();
  rhRenderSessionRemain();
  if (Date.now() - rhLastSave > 5000) rhPersist();
}

// A timed step ran out — count it, move on, and carry any overflow (e.g. the
// tab was backgrounded through several steps) into the following steps.
function rhComplete(overflowMs = 0) {
  const step = rhStep();
  if (step?.kind === 'work' && step.countsAsSet) rhCounted.add(rhIdx);
  let carry = overflowMs;
  let idx = rhIdx + 1;
  while (idx < rhQueue.length) {
    const next = rhQueue[idx];
    if (next.manual) break; // self-paced — wait for the athlete
    const dur = next.secs * 1000;
    if (carry < dur) break;
    carry -= dur;
    if (next.kind === 'work' && next.countsAsSet) rhCounted.add(idx);
    idx++;
  }
  if (idx >= rhQueue.length) {
    rhFinish();
    return;
  }
  rhIdx = idx;
  const next = rhStep();
  rhRemainMs = next.manual ? 0 : next.secs * 1000 - carry;
  rhLastBeepSec = null;
  rhTempoMem.key = null;
  rhStepEnteredAt = Date.now();
  rhAnnounceStep(next);
  if (next.manual) {
    rhStop();
  } else if (rhRunning) {
    rhEndsAt = Date.now() + rhRemainMs;
  }
  rhRenderStep();
  rhPersist();
}

// Manual navigation — skip forward / step back without counting the set.
function rhJump(dir) {
  const idx = rhIdx + dir;
  if (idx < 0 || !rhSession) return;
  if (idx >= rhQueue.length) {
    rhFinish();
    return;
  }
  rhIdx = idx;
  const step = rhStep();
  rhRemainMs = step.manual ? 0 : step.secs * 1000;
  rhLastBeepSec = null;
  rhTempoMem.key = null;
  rhStepEnteredAt = Date.now();
  rhAnnounceStep(step); // a manual jump still tells you where you landed
  if (step.manual) rhStop();
  else if (rhRunning) rhEndsAt = Date.now() + rhRemainMs;
  rhRenderStep();
  rhPersist();
}

function openRehabPlayer(session, saved = null) {
  rhSession = session;
  rhQueue = buildStepQueue(session, getSwaps());
  rhIdx = Math.min(saved?.idx ?? 0, rhQueue.length - 1);
  rhCounted = new Set(saved?.counted || []);
  rhLiftSets = saved?.liftSets || [];
  rhStartedAt = saved?.startedAt || Date.now();
  rhWeightKg = saved?.weightKg ?? get(REHAB_RDL_KEY) ?? 40;
  const step = rhStep();
  rhRemainMs = step.manual
    ? 0
    : Math.min(saved?.remainMs ?? step.secs * 1000, step.secs * 1000);
  newPRsThisSession = [];
  rhStepEnteredAt = Date.now();
  rhAnnouncedIdx = -1;
  rhStop(); // opens paused — press play to go
  if (rhWallInterval) clearInterval(rhWallInterval);
  rhWallInterval = setInterval(() => {
    if (rhStep()?.manual) rhRenderSessionRemain();
    const pacing = (rhRunning && rhStep()?.tempo) || rhGuide;
    if (
      !pacing &&
      !window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    ) {
      rhIdleFrameTick();
    }
  }, 900);
  document.getElementById('rehab-player').classList.add('open');
  rhRenderVoiceBtn();
  rhRenderStep();
  rhPersist();
  rhAcquireWakeLock();
  // Preload every exercise's art now (user starts paused), so mid-session
  // step changes never pop a loading image into the stage.
  [...new Set(rhQueue.map((s) => s.exId))].forEach((exId) => {
    rhProbeArt(exId);
  });
  // …and probe the custom-voice clips once, so cues never wait on a fetch.
  [
    'get-set',
    'go',
    'hold',
    'rest',
    'switch-sides',
    'left-side',
    'right-side',
    'your-pace',
    'warm-up',
    'lift',
    'squeeze',
    'lower',
    'session-complete',
    'one',
    'two',
    'three',
    'four',
    'five',
    'six',
    'seven',
    'eight',
    'nine',
    'ten',
    'of',
    'next',
    ...Object.keys(GUIDED_EXERCISES).map((id) => `name-${id}`),
  ].forEach((slug) => {
    // Decode everything up front: iOS Safari only allows fresh HTMLAudio
    // inside a tap, so timer-driven announcements must play through the
    // (once-unlocked) AudioContext — same path as the beat words.
    rhProbeClip(slug).then(() => rhDecodeClip(slug));
  });
}

function closeRehabPlayer() {
  rhPause(); // keeps state — resumable from the Rehab page
  if (rhWallInterval) clearInterval(rhWallInterval);
  rhWallInterval = null;
  document.getElementById('rehab-player').classList.remove('open');
  rhReleaseWakeLock();
  renderRehabPage();
}

// ── Finish → history entry (counts toward streak) + the normal summary ────────
function rhFinish() {
  if (!rhSession) return;
  rhStop();
  rhCue('finish');
  rhCueSay(['session-complete'], 'Session complete. Nice work.');
  const session = rhSession;
  const liftSets = rhLiftSets;
  const setsDone = rhCounted.size;
  const elapsed = Math.floor((Date.now() - rhStartedAt) / 1000);
  const durationStr = `${Math.floor(elapsed / 60)}:${(elapsed % 60).toString().padStart(2, '0')}`;

  rhSession = null;
  rhPersist(); // clears the crash-state key
  if (rhWallInterval) clearInterval(rhWallInterval);
  rhWallInterval = null;
  document.getElementById('rehab-player').classList.remove('open');
  rhReleaseWakeLock();
  closePage('rehab-page');

  // Feed the same pipes as a normal workout: history, streak, summary, share.
  const repsNum = (r) => parseInt(r, 10) || 0;
  totalWeightMoved = liftSets.reduce(
    (sum, l) => sum + (l.weight || 0) * repsNum(l.reps),
    0,
  );
  sessionSets = setsDone;

  let completed;
  let entry;
  if (isProgramSession(session)) {
    // Density 40 → a real strength entry: logged sets feed volume, PRs, share.
    const byEx = new Map();
    for (const l of liftSets) {
      if (!byEx.has(l.exId)) byEx.set(l.exId, []);
      byEx.get(l.exId).push({ weight: l.weight, reps: l.reps, done: true });
    }
    const exercises = [...byEx.entries()].map(([exId, logs]) => ({
      name: GUIDED_EXERCISES[exId]?.name || exId,
      sets: logs.length,
      logs,
    }));
    completed = {
      name: `Density 40 · ${session.name}`,
      type: 'strength',
      exercises,
    };
    entry = {
      name: completed.name,
      type: 'strength',
      programId: session.id,
      date: new Date().toISOString(),
      duration: durationStr,
      totalWeight: Math.round(totalWeightMoved),
      sets: setsDone,
      newPRs: newPRsThisSession,
      exercises,
    };
    // Advance the A→B→C queue.
    const idx = DENSITY40_SESSIONS.findIndex((x) => x.id === session.id);
    if (idx >= 0)
      set('kilos-d40-cursor', (idx + 1) % DENSITY40_SESSIONS.length);
  } else {
    newPRsThisSession = [];
    const exercises = session.blocks
      .filter((b) => b.ex)
      .map((b) => ({
        name: GUIDED_EXERCISES[b.ex].name,
        sets: b.sets || b.repScheme?.length || 1,
        logs:
          b.mode === 'lift'
            ? liftSets.map((l) => ({
                weight: l.weight,
                reps: l.reps,
                done: true,
              }))
            : [],
      }));
    completed = { name: `Rehab · ${session.name}`, type: 'rehab', exercises };
    entry = {
      name: completed.name,
      type: 'rehab',
      rehabId: session.id,
      date: new Date().toISOString(),
      duration: durationStr,
      totalWeight: Math.round(totalWeightMoved),
      sets: setsDone,
      newPRs: [],
      exercises,
    };
  }
  const hist = get('workoutHistory') || [];
  hist.push(entry);
  set('workoutHistory', hist);
  pushData();
  lastFinishedWorkout = completed;
  lastFinishedEntry = entry;
  lastFinishSnapshot = null; // guided finishes advance state — no undo
  renderHome();
  showWorkoutSummary(completed, durationStr, entry);
}

// ── Week plan — Mon…Sun with dates; fills in as things get done ──────────────
const WEEK_MARKS_KEY = 'kilos-week-marks';

function renderWeekPlan() {
  const el = document.getElementById('week-plan');
  if (!el) return;
  const hist = get('workoutHistory') || [];
  const marks = get(WEEK_MARKS_KEY) || {};
  const cursor = get('kilos-d40-cursor') || 0;

  // Index history by local date once
  const byDate = {};
  for (const h of hist) {
    const k = dateKey(new Date(h.date));
    if (!byDate[k]) byDate[k] = [];
    byDate[k].push(h);
  }

  const today = new Date();
  const todayKey = dateKey(today);
  // Week starts Monday
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));

  const rows = [];
  let liftOffset = 0; // projects the A→B→C queue across the week's lift slots
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const k = dateKey(d);
    const isToday = k === todayKey;
    const entries = byDate[k] || [];
    const dayMarks = marks[k] || [];

    const chips = WEEK_PLAN[d.getDay()]
      .map((item) => {
        // Everything clickable: done → redo (a fresh run of that session),
        // undone → start/continue, past days included. Only future walk/
        // engine marks stay inert (can't have done them yet).
        let label = '';
        let done = false;
        let action = '';
        if (item.type === 'rehab') {
          label = 'REHAB';
          done = entries.some((h) => h.rehabId === 'daily');
          action = 'session:daily';
        } else if (item.type === 'hinge') {
          label = 'HINGE';
          done = entries.some((h) => h.rehabId === 'hinge');
          action = 'session:hinge';
        } else if (item.type === 'lift') {
          const doneEntry = entries.find((h) => h.programId);
          done = !!doneEntry;
          const isPast = k < todayKey;
          let s2 = null;
          if (doneEntry) {
            s2 = getProgramSession(doneEntry.programId);
          } else if (!isPast) {
            // future/today lift slots walk the queue forward: B, then C, then A…
            s2 =
              DENSITY40_SESSIONS[
                (cursor + liftOffset) % DENSITY40_SESSIONS.length
              ];
            liftOffset++;
          } else {
            // a missed past lift = the next session the queue owes you
            s2 = DENSITY40_SESSIONS[cursor % DENSITY40_SESSIONS.length];
          }
          label = s2
            ? `LIFT ${s2.name.split('—')[0].trim().toUpperCase()}`
            : 'LIFT';
          action = s2 ? `session:${s2.id}` : '';
        } else {
          label = item.type.toUpperCase();
          done = dayMarks.includes(item.type);
          action = k <= todayKey ? `mark:${item.type}` : '';
        }
        const emphasized = action && isToday && !done;
        return `<button class="wp-chip${done ? ' done' : ''}${emphasized ? ' ready' : ''}"
          ${action ? `data-action="${action}" data-date="${k}"` : 'disabled'}>${done ? '✓ ' : ''}${label}</button>`;
      })
      .join('');

    const dayName = d
      .toLocaleDateString('en-US', { weekday: 'short' })
      .toUpperCase();
    rows.push(`<div class="wp-row${isToday ? ' today' : ''}">
      <div class="wp-day"><span class="wp-day-name">${dayName}</span><span class="wp-day-date">${d.getDate()}</span></div>
      <div class="wp-chips">${chips}</div>
    </div>`);
  }
  el.innerHTML = `${rows.join('')}
    <div class="wp-legend">REHAB warm-up · HINGE hip-hinge lift · LIFT A/B/C the rotation · ENGINE conditioning</div>`;

  el.querySelectorAll('.wp-chip[data-action]').forEach((chip) => {
    chip.addEventListener('click', () => {
      const [kind, id] = chip.dataset.action.split(':');
      if (kind === 'session') {
        const saved = get(REHAB_STATE_KEY);
        if (saved?.sessionId === id) {
          // unfinished = continue where it paused
          openRehabPlayer(getGuidedSession(id), saved);
          return;
        }
        try {
          localStorage.removeItem(REHAB_STATE_KEY);
        } catch {}
        openRehabPlayer(getGuidedSession(id));
      } else {
        const marks2 = get(WEEK_MARKS_KEY) || {};
        const k = chip.dataset.date;
        const arr = marks2[k] || [];
        marks2[k] = arr.includes(id)
          ? arr.filter((x) => x !== id)
          : [...arr, id];
        set(WEEK_MARKS_KEY, marks2);
        renderWeekPlan();
      }
    });
  });
}

// ── Sunday check-in: waist + weight, the fat-loss feedback loop ──────────────
// Measurement only, no food tracking. The status line runs TRAINING.md's rule:
// two weeks with no downward trend → add steps first, then trim ~150 kcal.
const CHECKINS_KEY = 'kilos-checkins';
let ciEditing = false;
let ciExpanded = false; // off-Sunday the card rests as one line (f16)

function renderCheckin() {
  const el = document.getElementById('checkin-card');
  if (!el) return;
  const list = get(CHECKINS_KEY) || [];
  const { state, latest, ref } = checkinStatus(list);
  const todayK = dateKey(new Date());
  const isSunday = new Date().getDay() === 0;
  const due = isSunday && latest?.date !== todayK;

  // Off-Sunday with a healthy trend: one quiet line, not a block (f16).
  if (!ciEditing && !ciExpanded && !due && state !== 'stalled' && latest) {
    el.innerHTML = `
      <button class="ci-row" id="ci-expand">
        <span class="ci-row-vals">${latest.weightKg.toFixed(1)} kg · ${latest.waistCm.toFixed(1)} cm</span>
        <span class="ci-row-state">${state === 'trending' ? '▾ TRENDING' : 'LOGGED'} · SUNDAYS</span>
        <span class="cc-arrow">→</span>
      </button>`;
    document.getElementById('ci-expand').addEventListener('click', () => {
      ciExpanded = true;
      renderCheckin();
    });
    return;
  }

  if (ciEditing) {
    el.innerHTML = `
      <div class="ci-card">
        <div class="ci-edit-row">
          <label class="ci-field"><span class="ci-label">WEIGHT · KG</span>
            <input class="ci-input" id="ci-weight" type="number" inputmode="decimal" step="0.1" min="30" max="250" value="${latest?.weightKg ?? ''}" placeholder="0.0"></label>
          <label class="ci-field"><span class="ci-label">WAIST · CM</span>
            <input class="ci-input" id="ci-waist" type="number" inputmode="decimal" step="0.1" min="40" max="200" value="${latest?.waistCm ?? ''}" placeholder="0.0"></label>
        </div>
        <div class="ci-actions">
          <button class="ci-btn ci-save" id="ci-save">SAVE</button>
          <button class="ci-btn" id="ci-cancel">CANCEL</button>
        </div>
      </div>`;
    document.getElementById('ci-save').addEventListener('click', () => {
      const w = Number.parseFloat(document.getElementById('ci-weight').value);
      const c = Number.parseFloat(document.getElementById('ci-waist').value);
      if (!(w >= 30 && w <= 250) || !(c >= 40 && c <= 200)) return;
      set(
        CHECKINS_KEY,
        addCheckin(list, { date: todayK, weightKg: w, waistCm: c }),
      );
      ciEditing = false;
      ciExpanded = false;
      renderCheckin();
      pushData();
    });
    document.getElementById('ci-cancel').addEventListener('click', () => {
      ciEditing = false;
      renderCheckin();
    });
    return;
  }

  const delta = (a, b, unit) => {
    if (a == null || b == null) return '';
    const d = +(a - b).toFixed(1);
    if (Math.abs(d) < 0.05) return `<span class="ci-delta">— flat / 2 wks</span>`;
    return `<span class="ci-delta">${d < 0 ? '▾' : '▴'} ${Math.abs(d)} ${unit} / 2 wks</span>`;
  };
  const STATUS = {
    first: 'Two numbers, once a week — the trend does the coaching.',
    building: 'Logged. Two weeks of entries builds your first trend.',
    trending: 'Trending down — keep the kitchen exactly as is.',
    stalled:
      'Flat for 2 weeks → add 1–2k steps/day. Still flat next Sunday → trim ~150 kcal.',
  };
  el.innerHTML = `
    <div class="ci-card">
      <div class="ci-nums">
        <div class="ci-num-cell"><span class="ci-label">WEIGHT</span>
          <span class="ci-num">${latest ? latest.weightKg.toFixed(1) : '—'}<small> kg</small></span>
          ${latest && ref ? delta(latest.weightKg, ref.weightKg, 'kg') : ''}</div>
        <div class="ci-num-cell"><span class="ci-label">WAIST</span>
          <span class="ci-num">${latest ? latest.waistCm.toFixed(1) : '—'}<small> cm</small></span>
          ${latest && ref ? delta(latest.waistCm, ref.waistCm, 'cm') : ''}</div>
      </div>
      <div class="ci-status${state === 'stalled' ? ' stalled' : ''}">${due ? 'Due today · ' : ''}${STATUS[state]}</div>
      <button class="ci-btn ci-log${due ? ' due' : ''}" id="ci-log">${latest?.date === todayK ? 'EDIT TODAY' : 'LOG CHECK-IN'}</button>
    </div>`;
  document.getElementById('ci-log').addEventListener('click', () => {
    ciEditing = true;
    renderCheckin();
  });
}

// ── Session preview — what's inside, before you press go ────────────────────
let _spSession = null;
let _spAfter = null;
function openSessionPreview(session, after = null) {
  _spSession = session;
  _spAfter = after;
  document.getElementById('sp-title').textContent = session.name.toUpperCase();
  document.getElementById('sp-meta').textContent =
    `~${estimateSessionMins(session)} MIN · ${session.blocks.length} BLOCKS · ${(session.blurb || session.freq || '').toUpperCase().replace(/\.$/, '')}`;
  const rows = sessionOverview(session, getSwaps());
  const prettyDetail = (d) =>
    d
      .replace(/^(\d+) × (.+)$/, '$1 SETS × $2 REPS')
      .replace(/\/side/gi, ' / SIDE')
      .toUpperCase();
  document.getElementById('sp-list').innerHTML = rows
    .map((r) => {
      if (r.members?.length > 1) {
        // per-side members appear once, marked PER SIDE
        const seen = new Map();
        for (const m of r.members) {
          const key = `${m.name}|${m.detail}`;
          if (seen.has(key)) seen.get(key).perSide = true;
          else seen.set(key, { ...m });
        }
        const collapsed = [...seen.values()].map((m) => ({
          ...m,
          detail: `${m.detail || ''}${m.perSide ? ' · PER SIDE' : ''}`,
        }));
        const lines = collapsed
          .map(
            (m) => `
        <div class="sp-row-name">${m.name}</div>
        <div class="sp-row-sub">${prettyDetail(String(m.detail || ''))}</div>`,
          )
          .join('');
        return `
    <div class="sp-row">
      <div class="sp-row-kicker">SUPERSET · ${r.rounds} ROUNDS</div>${lines}
    </div>`;
      }
      return `
    <div class="sp-row">
      <div class="sp-row-name">${r.title}</div>
      <div class="sp-row-sub">${prettyDetail(r.detail)}</div>
    </div>`;
    })
    .join('');
  const afterEl = document.getElementById('sp-after');
  afterEl.textContent = after ? `THEN — ${after.toUpperCase()}` : '';
  afterEl.style.display = after ? '' : 'none';
  openPage('session-preview');
  fitLineFont(document.querySelector('.sp-title'), 84, 30);
}
document.getElementById('sp-back').addEventListener('click', () => {
  closePage('session-preview');
});
document.getElementById('sp-start').addEventListener('click', () => {
  if (!_spSession) return;
  closePage('session-preview');
  try {
    localStorage.removeItem(REHAB_STATE_KEY);
  } catch {}
  openRehabPlayer(_spSession);
});

// ── Rehab page (program overview + resume) ────────────────────────────────────
// The page's first job: today's action above the fold. Resume outranks it.
function renderRehabToday() {
  const slot = document.getElementById('rh-today-slot');
  if (!slot) return;
  if (get(REHAB_STATE_KEY)) {
    slot.innerHTML = ''; // the resume card owns the top
    return;
  }
  const plan = todayPlan();
  const done = plan.filter((i) => i.done);
  const undone = plan.filter((i) => !i.done);
  const next = undone.find((i) => i.sessionId);
  if (!next) {
    slot.innerHTML = undone.length
      ? ''
      : `<div class="rhs-card rh-today-done"><div class="rhs-top"><div class="rhs-name">Today — all done ✓</div></div></div>`;
    return;
  }
  const session = getGuidedSession(next.sessionId);
  const doneStr = done.length
    ? `${done.map((i) => i.label.toUpperCase()).join(' + ')} DONE · `
    : '';
  slot.innerHTML = `
    <button class="rhs-card rh-today" id="rh-today-btn">
      <div class="rhs-top"><div class="rhs-name">Today · ${next.label}</div><div class="rhs-go">→</div></div>
      <div class="rhs-meta">${doneStr}~${estimateSessionMins(session)} MIN · START NOW</div>
    </button>`;
  document.getElementById('rh-today-btn').addEventListener('click', () => {
    try {
      localStorage.removeItem(REHAB_STATE_KEY);
    } catch {}
    openRehabPlayer(session);
  });
}
function renderRehabPage() {
  renderWeekPlan();
  renderCheckin();
  renderRehabToday();
  const saved = get(REHAB_STATE_KEY);
  const savedSession = saved ? getGuidedSession(saved.sessionId) : null;
  const resumeSlot = document.getElementById('rehab-resume-slot');
  if (savedSession) {
    const queueLen = buildStepQueue(savedSession, getSwaps()).length;
    resumeSlot.innerHTML = `
      <button class="rhs-card rh-resume" id="rh-resume-btn">
        <div class="rhs-top"><div class="rhs-name">Resume · ${savedSession.name}</div><div class="rhs-go">→</div></div>
        <div class="rhs-meta">PAUSED AT STEP ${Math.min((saved.idx ?? 0) + 1, queueLen)} OF ${queueLen}</div>
      </button>
      <button class="rh-discard" id="rh-discard-btn">Discard paused session</button>`;
    document.getElementById('rh-resume-btn').addEventListener('click', () => {
      openRehabPlayer(savedSession, saved);
    });
    document.getElementById('rh-discard-btn').addEventListener('click', () => {
      const n = saved?.liftSets?.length || 0;
      document.getElementById('discard-confirm-sub').textContent = n
        ? `${n} logged set${n === 1 ? '' : 's'} will be lost.`
        : 'Your place in the session will be lost.';
      document.getElementById('discard-confirm').classList.add('open');
    });
  } else {
    resumeSlot.innerHTML = '';
  }

  document.getElementById('rehab-session-list').innerHTML = REHAB_SESSIONS.map(
    (s) => `
    <button class="rhs-card" data-rehab="${s.id}">
      <div class="rhs-top"><div class="rhs-name">${s.name}</div><div class="rhs-go">→</div></div>
      <div class="rhs-meta">~${estimateSessionMins(s)} MIN · ${s.freq.toUpperCase()} · ${s.blocks.length} MOVES</div>
      <div class="rhs-blurb">${s.blurb}</div>
    </button>`,
  ).join('');
  document
    .querySelectorAll('#rehab-session-list [data-rehab]')
    .forEach((card) => {
      card.addEventListener('click', () => {
        try {
          localStorage.removeItem(REHAB_STATE_KEY); // fresh start replaces a stale pause
        } catch {}
        openRehabPlayer(getRehabSession(card.dataset.rehab));
      });
    });

  // ── Density 40 — the lifting program queue ──
  const cursor = get('kilos-d40-cursor') || 0;
  document.getElementById('d40-session-list').innerHTML =
    DENSITY40_SESSIONS.map(
      (s2, i) => `
    <button class="rhs-card${i === cursor ? ' rh-resume' : ''}" data-d40="${s2.id}">
      <div class="rhs-top"><div class="rhs-name">${s2.name}</div><div class="rhs-go">${i === cursor ? 'NEXT →' : '→'}</div></div>
      <div class="rhs-meta">~${estimateSessionMins(s2)} MIN · ${s2.freq.toUpperCase()}</div>
      <div class="rhs-blurb">${s2.blurb}</div>
      ${i !== cursor ? `<span class="rhs-setnext" data-setnext="${i}" role="button">SET AS NEXT</span>` : ''}
    </button>`,
    ).join('');
  document.querySelectorAll('#d40-session-list [data-d40]').forEach((card) => {
    card.addEventListener('click', () => {
      try {
        localStorage.removeItem(REHAB_STATE_KEY);
      } catch {}
      openRehabPlayer(getProgramSession(card.dataset.d40));
    });
  });
  // Queue control — every finish advances the rotation (test runs included),
  // so the athlete can point it back at the session they actually owe.
  document.querySelectorAll('#d40-session-list [data-setnext]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      set('kilos-d40-cursor', Number(el.dataset.setnext));
      renderRehabPage();
      renderDayHero();
      renderTodayCard();
      renderMonthGrid();
    });
  });

  document.getElementById('rehab-ex-list').innerHTML = Object.values(
    REHAB_EXERCISES,
  )
    .map(
      (ex) => `
    <div class="rh-ex">
      <div>
        <div class="rh-ex-name">${ex.name}</div>
        <div class="rh-ex-cue">${ex.why}</div>
      </div>
      <a class="rh-ex-yt" href="https://www.youtube.com/results?search_query=${encodeURIComponent(ex.yt)}"
         target="_blank" rel="noopener" aria-label="Watch ${ex.name} on YouTube">Video ↗</a>
    </div>`,
    )
    .join('');
}

document.getElementById('btn-rehab-open').addEventListener('click', () => {
  renderRehabPage();
  openPage('rehab-page');
});
document
  .getElementById('rehab-back')
  .addEventListener('click', () => closePage('rehab-page'));
document.getElementById('rp-close').addEventListener('click', closeRehabPlayer);
document.getElementById('rp-play').addEventListener('click', () => {
  const mstep = rhStep();
  if (mstep?.manual && mstep.repTempo) {
    if (rhGuide) rhStopGuide(true);
    else rhStartGuide();
    return;
  }
  if (rhRunning) {
    rhPause();
    return;
  }
  // Starting a step from its very top gets the spoken kickoff too — unless
  // arriving at this step already announced it.
  const step = rhStep();
  const fresh =
    step &&
    !step.manual &&
    rhRemainMs === step.secs * 1000 &&
    rhAnnouncedIdx !== rhIdx;
  rhPlay();
  if (fresh) rhAnnounceStep(step);
});
document.getElementById('rp-prev').addEventListener('click', () => rhJump(-1));
document.getElementById('rp-skip').addEventListener('click', () => {
  const step = rhStep();
  if (step?.manual && step.kind === 'work') {
    rhLogSetDone(); // the ✓ — same control, no extra button
    return;
  }
  rhJump(1);
});
document.getElementById('rp-voice').addEventListener('click', () => {
  rhVoiceOn = !rhVoiceOn;
  set(REHAB_VOICE_KEY, rhVoiceOn);
  if (!rhVoiceOn && typeof speechSynthesis !== 'undefined') {
    try {
      speechSynthesis.cancel();
    } catch {}
  }
  rhRenderVoiceBtn();
});
function rhLogSetDone() {
  const step = rhStep();
  if (!step?.manual) return;
  rhStopGuide(true);
  // Stage 1 for range prescriptions: confirm what ACTUALLY happened before
  // it enters history — "5–8" is a plan, not a result.
  if (
    step.logWeight !== false &&
    !step.logReps &&
    repsIsRange(step.reps) &&
    rhPendingReps === null
  ) {
    rhPendingReps = repTargetTop(step.reps) ?? 8;
    rhRenderWeight();
    document.getElementById('rp-set-done').textContent = 'Log reps ✓';
    return;
  }
  if (step.logWeight !== false) {
    const ex = GUIDED_EXERCISES[step.exId];
    const repsDone =
      rhPendingReps !== null
        ? rhPendingReps
        : step.logReps
          ? rhWeightKg
          : Number.parseInt(step.reps, 10) || 0;
    rhLiftSets.push({
      exId: step.exId,
      name: ex?.name || step.exId,
      weight: step.logReps ? 0 : rhWeightKg,
      reps: repsDone,
    });
    rhPendingReps = null;
    saveGuidedWeight(step.exId, rhWeightKg);
    if (step.exId === 'rdl') set(REHAB_RDL_KEY, rhWeightKg);
    // PRs are part of the lifting program's scoreboard (not the rehab's).
    if (
      !step.logReps &&
      isProgramSession(rhSession) &&
      checkAndUpdatePR(ex?.name || step.exId, rhWeightKg)
    ) {
      newPRsThisSession.push({
        name: ex?.name || step.exId,
        weight: rhWeightKg,
        reps: repsDone,
      });
      showPRToast(ex?.name || step.exId, rhWeightKg, repsDone);
    }
  }
  rhCounted.add(rhIdx);
  navigator.vibrate?.(120);
  // Roll into the rest countdown without needing another tap.
  const wasLast = rhIdx + 1 >= rhQueue.length;
  rhJump(1); // announces the landing step
  if (!wasLast && !rhStep()?.manual) rhPlay();
}
document.getElementById('rp-set-done').addEventListener('click', rhLogSetDone);
function rhAdjust(dir) {
  if (rhPendingReps !== null) {
    rhPendingReps = Math.max(0, rhPendingReps + dir);
    rhRenderWeight();
    return;
  }
  const inc = rhStep()?.logReps ? 1 : 2.5;
  rhWeightKg = Math.max(rhStep()?.logReps ? 1 : 0, rhWeightKg + dir * inc);
  rhRenderWeight();
}
// Tap = one step; hold = repeat (sweaty-thumb travel to a far weight).
function rhHoldRepeat(el, dir) {
  let holdTimer = null;
  let repeater = null;
  let held = false;
  el.addEventListener('pointerdown', () => {
    held = false;
    holdTimer = setTimeout(() => {
      held = true;
      repeater = setInterval(() => rhAdjust(dir), 110);
    }, 420);
  });
  const stop = () => {
    clearTimeout(holdTimer);
    clearInterval(repeater);
  };
  el.addEventListener('pointerup', stop);
  el.addEventListener('pointerleave', stop);
  el.addEventListener('pointercancel', stop);
  el.addEventListener('click', () => {
    if (held) {
      held = false;
      return; // the hold already moved the value
    }
    rhAdjust(dir);
  });
}
rhHoldRepeat(document.getElementById('rp-w-minus'), -1);
rhHoldRepeat(document.getElementById('rp-w-plus'), 1);

document.getElementById('btn-startover-resume').addEventListener('click', () => {
  document.getElementById('startover-confirm').classList.remove('open');
  pendingBegin = null;
  resumeActiveSession();
});
document.getElementById('btn-startover-new').addEventListener('click', () => {
  document.getElementById('startover-confirm').classList.remove('open');
  activeWorkout = null;
  try {
    localStorage.removeItem(ACTIVE_STATE_KEY);
    localStorage.removeItem(REHAB_STATE_KEY);
  } catch {}
  if (pendingBegin) {
    const { name, type, exercises } = pendingBegin;
    pendingBegin = null;
    beginWorkoutNow(name, type, exercises);
  }
});
document.getElementById('btn-discard-yes').addEventListener('click', () => {
  try {
    localStorage.removeItem(REHAB_STATE_KEY);
  } catch {}
  document.getElementById('discard-confirm').classList.remove('open');
  renderRehabPage();
});
document.getElementById('btn-discard-no').addEventListener('click', () => {
  document.getElementById('discard-confirm').classList.remove('open');
});

// Crash / refresh recovery: a session that was live in the last 30 minutes
// reopens exactly where it was (paused). Older ones wait on the Rehab page
// as a Resume card.
(() => {
  const saved = get(REHAB_STATE_KEY);
  if (!saved) return;
  const session = getGuidedSession(saved.sessionId);
  if (!session) return;
  if (Date.now() - (saved.savedAt || 0) < 30 * 60 * 1000) {
    openRehabPlayer(session, saved);
  }
})();

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    if (rhSession) rhPersist();
  } else {
    // iOS suspends the AudioContext in the background — wake it on ANY return to
    // foreground so the next countdown/rest-over beep actually sounds (not just
    // the rehab player: the strength/CF rest timer relies on this too).
    if (audioCtx?.state === 'suspended') audioCtx.resume();
    if (rhSession && rhRunning) {
      rhAcquireWakeLock();
      rhTick(); // catch up instantly after a backgrounded stretch
    }
  }
});

// ── Legal pages (Privacy / Terms) — opened from the profile sheet ─────────────
function openLegal(id) {
  openPage(id);
}
document
  .getElementById('btn-open-privacy')
  ?.addEventListener('click', () => openLegal('privacy-page'));
document
  .getElementById('btn-open-terms')
  ?.addEventListener('click', () => openLegal('terms-page'));
document
  .getElementById('privacy-back')
  ?.addEventListener('click', () => closePage('privacy-page'));
document
  .getElementById('terms-back')
  ?.addEventListener('click', () => closePage('terms-page'));


// ─── REST-DAY CARD ────────────────────────────────────────────────────────────
// Shows on home screen when no workout has been logged today.
// Surfaces: most-recovered muscle (best next session suggestion) + weekly volume.
// What does the program want TODAY? Shared derivation (same rules as the
// Program week view) so Home and Program can't disagree.
function todayPlan() {
  const hist = get('workoutHistory') || [];
  const cursor = get('kilos-d40-cursor') || 0;
  const todayK = dateKey(new Date());
  const entries = hist.filter((h) => dateKey(new Date(h.date)) === todayK);
  const marks = get(WEEK_MARKS_KEY)?.[todayK] || [];
  return WEEK_PLAN[new Date().getDay()].map((item) => {
    if (item.type === 'rehab') {
      return {
        type: 'rehab',
        label: 'Rehab',
        done: entries.some((h) => h.rehabId === 'daily'),
        sessionId: 'daily',
      };
    }
    if (item.type === 'hinge') {
      return {
        type: 'hinge',
        label: 'Hinge',
        done: entries.some((h) => h.rehabId === 'hinge'),
        sessionId: 'hinge',
      };
    }
    if (item.type === 'lift') {
      const doneEntry = entries.find((h) => h.programId);
      const s2 = doneEntry
        ? getProgramSession(doneEntry.programId)
        : DENSITY40_SESSIONS[cursor % DENSITY40_SESSIONS.length];
      return {
        type: 'lift',
        label: s2 ? `Lift ${s2.name.split('—')[0].trim()}` : 'Lift',
        done: !!doneEntry,
        sessionId: s2?.id,
      };
    }
    return {
      type: item.type,
      label: item.type,
      done: marks.includes(item.type),
      sessionId: null,
    };
  });
}

// Scale a one-line element's font so the text fills its box (poster move).
function fitLineFont(el, maxPx, minPx) {
  if (!el) return;
  el.style.whiteSpace = 'nowrap';
  // Fit the TEXT to the content box — clientWidth includes padding, so a
  // padded line (e.g. .tl-text reserving arrow room) would otherwise fill
  // into it. A Range measures the rendered text without the padding.
  const cs = getComputedStyle(el);
  const boxW =
    el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const range = document.createRange();
  range.selectNodeContents(el);
  let size = maxPx;
  el.style.fontSize = `${size}px`;
  while (size > minPx && range.getBoundingClientRect().width > boxW) {
    size -= 2;
    el.style.fontSize = `${size}px`;
  }
}

function renderTodayCard() {
  const card = document.getElementById('today-card');
  if (!card) return;
  const history = get('workoutHistory') || [];
  const live = activeSessionInfo();
  if (live) {
    card.style.display = '';
    card.innerHTML = `
      <span class="tl-text">RESUME ${live.name.toUpperCase().slice(0, 22)}</span>
      <span class="tl-sub">${live.kind === 'classic' ? 'IN PROGRESS' : 'PAUSED'} · PICK UP WHERE YOU LEFT OFF</span>
      <span class="tl-arrow">→</span>`;
    card.onclick = resumeActiveSession;
    fitLineFont(card.querySelector('.tl-text'), 118, 34);
    return;
  }
  if (!history.length) {
    card.style.display = '';
    card.innerHTML = `
      <span class="tl-text">FIRST SESSION</span>
      <span class="tl-sub">REHAB WARM-UP + GUIDED LIFTING · DEMOS, TIMERS, VOICE</span>
      <span class="tl-arrow">→</span>`;
    card.onclick = () => {
      renderRehabPage();
      openPage('rehab-page');
    };
    fitLineFont(card.querySelector('.tl-text'), 118, 34);
    return;
  }
  const plan = todayPlan();
  const undone = plan.filter((i) => !i.done);
  if (!undone.length) {
    card.style.display = 'none'; // everything done — recovery card can speak
    return;
  }
  const first = undone.find((i) => i.sessionId) || undone[0];
  const session = first.sessionId ? getGuidedSession(first.sessionId) : null;
  const mins = session ? ` · ~${estimateSessionMins(session)} MIN` : '';
  card.style.display = '';
  // One compact line: the session's movements by name, then the time.
  let moveLine = '';
  if (session) {
    const ids = [];
    for (const bl of session.blocks || []) {
      for (const ex of bl.members ? bl.members.map((m) => m.ex) : [bl.ex]) {
        if (ex && !ids.includes(ex)) ids.push(ex);
      }
    }
    const names = ids.map((id) => prShortName(GUIDED_EXERCISES[id]?.name || id));
    const out = [];
    let len = 0;
    for (const n of names) {
      if (len + n.length + 3 > 34) break;
      out.push(n.toUpperCase());
      len += n.length + 3;
    }
    const extra = names.length - out.length;
    moveLine = out.join(' · ') + (extra > 0 ? ` +${extra}` : '');
  }
  card.innerHTML = `
    <span class="tl-text">${undone.map((i) => i.label.toUpperCase()).join(' + ')}</span>
    ${moveLine ? `<span class="tl-sub">${moveLine}${mins.toUpperCase()}</span>` : ''}
    <span class="tl-arrow">→</span>`;
  fitLineFont(card.querySelector('.tl-text'), 118, 34);
  card.onclick = () => {
    if (session) {
      const rest = undone.filter((i) => i.sessionId && i !== first);
      openSessionPreview(session, rest.length ? rest[0].label : null);
    } else {
      renderRehabPage();
      openPage('rehab-page');
    }
  };
}

function renderRestDayCard() {
  const card = document.getElementById('rest-day-card');
  if (!card) return;

  const history = get('workoutHistory') || [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Check if there's a workout logged today
  const trainedToday = history.some((h) => {
    const d = new Date(h.date);
    d.setHours(0, 0, 0, 0);
    return d.getTime() === today.getTime();
  });

  // Scheduled work owns Home — the recovery card only speaks on a true
  // rest day (nothing due, nothing active).
  const hasWorkDue =
    history.length > 0 && todayPlan().some((i) => !i.done && i.sessionId);
  if (!history.length || trainedToday || activeWorkout || hasWorkDue) {
    card.style.display = 'none'; // day-one card owns the empty state
    return;
  }

  // Find most-recovered muscle (highest days since last trained, minimum 1 day)
  let bestMuscle = null,
    bestDays = 0;
  QS_MUSCLES.forEach((m) => {
    const days = getMuscleDaysAgo(m);
    // null = never trained (freshest), big number = longest rest
    const effectiveDays = days === null ? 999 : days;
    if (effectiveDays > bestDays) {
      bestDays = effectiveDays;
      bestMuscle = m;
    }
  });

  // Weekly volume (last 7 days)
  const oneWeekAgo = new Date(today);
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const weekVolume = history
    .filter((h) => new Date(h.date) >= oneWeekAgo && h.type === 'strength')
    .reduce((sum, h) => sum + (h.totalWeight || 0), 0);

  // Streak
  const chip = document.getElementById('streak-count');
  const streakText = chip?.textContent || '0 day streak';

  // Days since best muscle trained
  const readyLabel =
    bestDays >= 999
      ? 'Fresh'
      : bestDays >= 3
        ? `${bestDays}d rest`
        : 'Recovered';

  card.style.display = '';
  card.innerHTML = `
    <div class="rdc-wrap">
      <div class="rdc-row">
        <div class="rdc-label">Rest Day</div>
        <div class="rdc-streak">${streakText}</div>
      </div>
      ${
        bestMuscle
          ? `
        <div class="rdc-suggest">
          <div class="rdc-suggest-label">Most recovered</div>
          <div class="rdc-suggest-muscle">${bestMuscle}<span class="rdc-ready-badge">${readyLabel}</span></div>
          <button class="rdc-start" data-muscle="${bestMuscle}">Start ${bestMuscle} Day →</button>
        </div>`
          : ''
      }
      ${
        weekVolume > 0
          ? `
        <div class="rdc-stat">
          <span class="rdc-stat-val">${fmtNum(Math.round(toDisplayWeight(weekVolume)))}<span class="rdc-stat-unit"> ${weightUnit()}</span></span>
          <span class="rdc-stat-lbl">this week</span>
        </div>`
          : ''
      }
    </div>`;

  card.querySelector('.rdc-start')?.addEventListener('click', (e) => {
    quickStartWorkout(e.currentTarget.dataset.muscle);
  });
}

// Quick Start — muscle chips tap directly into a workout (no modal needed)
function quickStartWorkout(muscle) {
  if (!SHUFFLE_PLANS[muscle]) return;
  const profile = getActiveProfile();
  const plan = sortByFeel(SHUFFLE_PLANS[muscle]);
  const exercises = dedupeExercises(
    plan.map((e) => {
      const resolved = resolveExercise(e.name, profile);
      return {
        name: resolved.name,
        originalName: resolved.reason !== 'none' ? resolved.original : null,
        sets: e.sets,
        reps: String(e.reps),
        rest: e.rest,
        logs: Array.from({ length: e.sets }, () => ({
          weight: '',
          reps: '',
          done: false,
        })),
      };
    }),
  );
  beginWorkout(`${muscle} Day`, 'strength', exercises);
}

document
  .getElementById('btn-custom')
  .addEventListener('click', () => goScreen('build'));
document.getElementById('btn-resume').addEventListener('click', resumeActiveSession);


// ─── COACHES ──────────────────────────────────────────────────────────────────
function renderCoaches() {
  const tabsEl = document.getElementById('coach-tabs');
  const contentEl = document.getElementById('coach-content');
  // Coaches screen is currently "Coming Soon" — no tabs/content to render
  if (!tabsEl || !contentEl) return;
  tabsEl.innerHTML = '';
  contentEl.innerHTML = '';

  COACHES_DATA.forEach((coach, i) => {
    // Tab
    const tab = document.createElement('button');
    tab.className = `athlete-tab${i === 0 ? ' active' : ''}`;
    tab.textContent = coach.name.split(' ').pop(); // "Cilyn"
    tab.dataset.id = coach.id;
    tab.addEventListener('click', () => selectCoach(coach.id));
    tabsEl.appendChild(tab);

    // Content block
    const block = document.createElement('div');
    block.className = `athlete-block${i === 0 ? ' active' : ''}`;
    block.id = `coach-${coach.id}`;

    const wodCards = coach.workouts
      .map((w) => {
        const isCF = ['emom', 'amrap', 'rounds', 'fortime'].includes(w.type);
        const bigNum = isCF
          ? cfBigNum(w)
          : w.exercises?.reduce((s, e) => s + e.sets, 0);
        const bigUnit = isCF ? cfBigUnit(w) : 'sets';
        const subLine = isCF
          ? cfSubLine(w)
          : w.exercises?.map((e) => e.name).join(' · ');
        return `
      <div class="workout-card">
        <div class="wc-body">
          <div class="wc-left">
            <div class="wc-name">${w.name}</div>
            <div class="wc-exercises-line">${subLine}</div>
            <div class="wc-meta">${w.badge} · ${w.movements?.length || w.exercises?.length || 0} movements</div>
          </div>
          <div class="wc-right">
            <div class="wc-big">${bigNum}</div>
            <div class="wc-big-unit">${bigUnit}</div>
          </div>
        </div>
        <button class="wc-go" data-coach="${coach.id}" data-workout="${w.name}">Start this workout →</button>
      </div>`;
      })
      .join('');

    block.innerHTML = `
      <div class="athlete-name-big">${coach.name}</div>
      <span class="coach-specialty section-label">${coach.specialty}</span>
      ${wodCards}`;
    contentEl.appendChild(block);
  });

  contentEl.querySelectorAll('.wc-go').forEach((btn) => {
    btn.addEventListener('click', () =>
      startCoachWorkout(btn.dataset.coach, btn.dataset.workout),
    );
  });
}

// Helper display values for CF workout cards
function cfBigNum(w) {
  if (w.type === 'emom') return w.rounds;
  if (w.type === 'amrap') return w.timeCap;
  if (w.type === 'rounds') return w.rounds;
  if (w.type === 'fortime') return w.sets ? w.sets[0] : '—';
  return '—';
}
function cfBigUnit(w) {
  if (w.type === 'emom') return 'rounds';
  if (w.type === 'amrap') return 'min';
  if (w.type === 'rounds') return 'rounds';
  if (w.type === 'fortime') return 'reps';
  return '';
}
function cfSubLine(w) {
  return (w.movements || [])
    .map((m) => (m.reps ? `${m.reps} ${m.name}` : m.name))
    .join(' · ');
}

function selectCoach(id) {
  document.querySelectorAll('.athlete-tab').forEach((t) => {
    t.classList.toggle('active', t.dataset.id === id);
  });
  document.querySelectorAll('.athlete-block').forEach((b) => {
    b.classList.toggle('active', b.id === `coach-${id}`);
  });
}

// Remove duplicate exercise names that can arise after substitution
// (e.g. two exercises both resolve to "Incline Dumbbell Press").
// Keep the first occurrence; merge its sets into it if you want volume,
// but simpler is just to drop the duplicate entirely.
function dedupeExercises(exercises) {
  const seen = new Set();
  return exercises.filter((e) => {
    if (seen.has(e.name)) return false;
    seen.add(e.name);
    return true;
  });
}

function startCoachWorkout(coachId, workoutName) {
  const coach = COACHES_DATA.find((c) => c.id === coachId);
  const workout = coach.workouts.find((w) => w.name === workoutName);
  const isCF = ['emom', 'amrap', 'rounds', 'fortime'].includes(workout.type);

  if (isCF) {
    beginCFWorkout(workout.name, workout);
  } else {
    // Strength fallback (if we ever add strength workouts to coaches)
    const profile = getActiveProfile();
    const exercises = dedupeExercises(
      workout.exercises.map((e) => {
        const resolved = resolveExercise(e.name, profile);
        return {
          name: resolved.name,
          originalName: resolved.reason !== 'none' ? resolved.original : null,
          sets: e.sets,
          reps: String(e.reps),
          rest: e.rest || 90,
          logs: Array.from({ length: e.sets }, () => ({
            weight: '',
            reps: '',
            done: false,
          })),
        };
      }),
    );
    beginWorkout(workout.name, 'strength', exercises);
  }
}

function beginCFWorkout(name, cfData) {
  newPRsThisSession = [];
  activeWorkout = { name, type: cfData.type, cf: cfData };
  cfCurrentRound = 0;
  cfRoundsCompleted = 0;
  cfMovementsDone = new Set();
  cfRoundLog = [];
  workoutStartTime = Date.now();
  totalWeightMoved = 0;
  sessionSets = 0;
  stopTimer();
  saveActiveState();
  goScreen('active');
}

// ─── BUILD ────────────────────────────────────────────────────────────────────
function renderBuild() {
  // Mode toggle
  document.querySelectorAll('.build-mode-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.mode === buildMode);
  });
  document.getElementById('strength-section').style.display =
    buildMode === 'strength' ? '' : 'none';
  document.getElementById('crossfit-section').style.display =
    buildMode === 'crossfit' ? '' : 'none';

  if (buildMode === 'crossfit') {
    renderCFBuild();
    return;
  }

  // Muscle chips (strength only)
  const chips = document.getElementById('muscle-chips');
  chips.innerHTML = MUSCLES.map(
    (m) => `
    <div class="muscle-chip${selectedMuscles.includes(m) ? ' active' : ''}" data-muscle="${m}">${m}</div>
  `,
  ).join('');
  chips.querySelectorAll('.muscle-chip').forEach((chip) => {
    chip.addEventListener('click', () => toggleMuscle(chip.dataset.muscle));
  });

  renderExerciseList();
}

function renderCFBuild() {
  // Format buttons
  document.querySelectorAll('.cf-format-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.format === cfFormat);
  });
  // Show/hide config sections
  ['emom', 'amrap', 'rounds', 'fortime'].forEach((f) => {
    const el = document.getElementById(`cf-config-${f}`);
    if (el) el.style.display = f === cfFormat ? '' : 'none';
  });
  // Movements list
  renderCFMovementList();
  // Show start button if at least 1 movement
  document.getElementById('build-start-wrap').style.display = cfMovements.length
    ? 'block'
    : 'none';
}

function renderCFMovementList() {
  const el = document.getElementById('cf-movement-list');
  if (!cfMovements.length) {
    el.innerHTML =
      '<div class="empty-state">No movements yet — add one below.</div>';
    return;
  }
  el.innerHTML = cfMovements
    .map(
      (m, i) => `
    <div class="cf-movement-item">
      <div class="cf-movement-item-left">
        <div class="cf-movement-item-name">${m.name}</div>
        ${m.reps ? `<div class="cf-movement-item-reps">${m.reps}</div>` : ''}
      </div>
      <button class="ex-delete" data-cf-idx="${i}">✕</button>
    </div>
  `,
    )
    .join('');
  el.querySelectorAll('[data-cf-idx]').forEach((btn) => {
    btn.addEventListener('click', () => {
      cfMovements.splice(parseInt(btn.dataset.cfIdx, 10), 1);
      renderCFBuild();
    });
  });
}

function toggleMuscle(m) {
  selectedMuscles = selectedMuscles.includes(m)
    ? selectedMuscles.filter((x) => x !== m)
    : [...selectedMuscles, m];
  renderBuild();
}

function renderExerciseList() {
  const el = document.getElementById('exercise-list');
  const startWrap = document.getElementById('build-start-wrap');
  if (!buildExercises.length) {
    el.innerHTML =
      '<div class="empty-state">No exercises yet — add one below.</div>';
    startWrap.style.display = 'none';
    return;
  }
  startWrap.style.display = 'block';
  el.innerHTML = buildExercises
    .map((ex, i) => {
      const last = getLastSession(ex.name);
      const lastText = last
        ? `Last: ${last[0]?.weight ? toDisplayWeight(last[0].weight) + weightUnit() : '—'} × ${last[0]?.reps || '—'}`
        : '';
      return `
    <div class="exercise-item" id="ex-item-${i}">
      <div class="ex-header" data-idx="${i}">
        <div class="ex-name-wrap">
          <div class="ex-name">${ex.name}</div>
          <div class="ex-summary" id="ex-summary-${i}">${ex.reps} reps · ${ex.rest}s rest${lastText ? ` · ${lastText}` : ''}</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div class="ex-sets-big" id="ex-sets-big-${i}">${ex.sets}</div>
          <div class="ex-sets-unit">sets</div>
        </div>
        <button class="ex-delete" data-idx="${i}">✕</button>
      </div>
      <div class="ex-details" id="ex-detail-${i}">
        <div class="ex-row">
          <div class="ex-field"><label>Sets</label><input type="number" value="${ex.sets}" min="1" max="20" data-idx="${i}" data-field="sets"></div>
          <div class="ex-field"><label>Reps</label><input type="text" value="${ex.reps}" data-idx="${i}" data-field="reps"></div>
          <div class="ex-field"><label>Rest (s)</label><input type="number" value="${ex.rest}" min="0" max="600" data-idx="${i}" data-field="rest"></div>
        </div>
      </div>
    </div>`;
    })
    .join('');

  el.querySelectorAll('.ex-header').forEach((h) => {
    h.addEventListener('click', (e) => {
      if (e.target.classList.contains('ex-delete')) return;
      toggleExDetail(parseInt(h.dataset.idx, 10));
    });
  });
  el.querySelectorAll('.ex-delete').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeExercise(parseInt(btn.dataset.idx, 10));
    });
  });
  el.querySelectorAll('.ex-details input').forEach((input) => {
    input.addEventListener('input', () =>
      updateEx(
        parseInt(input.dataset.idx, 10),
        input.dataset.field,
        input.value,
      ),
    );
  });
}

function toggleExDetail(i) {
  const det = document.getElementById(`ex-detail-${i}`);
  if (det) det.classList.toggle('open');
}

function updateEx(i, field, val) {
  buildExercises[i][field] =
    field === 'sets' || field === 'rest' ? parseInt(val, 10) || 0 : val;
  const s = document.getElementById(`ex-summary-${i}`);
  if (s)
    s.textContent = `${buildExercises[i].reps} reps · ${buildExercises[i].rest}s rest`;
  const sb = document.getElementById(`ex-sets-big-${i}`);
  if (sb && field === 'sets') sb.textContent = buildExercises[i].sets;
}

function removeExercise(i) {
  buildExercises.splice(i, 1);
  renderExerciseList();
}

// Build mode toggle
document.querySelectorAll('.build-mode-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    buildMode = btn.dataset.mode;
    buildExercises = [];
    cfMovements = [];
    selectedMuscles = [];
    renderBuild();
  });
});

// CF format selector
document.querySelectorAll('.cf-format-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    cfFormat = btn.dataset.format;
    renderCFBuild();
  });
});

// CF add movement
document.getElementById('btn-add-cf-movement').addEventListener('click', () => {
  const nameInput = document.getElementById('cf-mov-name');
  const repsInput = document.getElementById('cf-mov-reps');
  const name = nameInput.value.trim();
  if (!name) return;
  cfMovements.push({ name, reps: repsInput.value.trim() });
  nameInput.value = '';
  repsInput.value = '';
  nameInput.focus();
  renderCFBuild();
});

// Enter key on CF movement name input
document.getElementById('cf-mov-name').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('btn-add-cf-movement').click();
});

document
  .getElementById('btn-add-exercise')
  .addEventListener('click', openExSearch);
document
  .getElementById('btn-save-workout')
  .addEventListener('click', saveCustomWorkout);
document
  .getElementById('btn-start-custom')
  .addEventListener('click', startCustomWorkout);

function saveCustomWorkout() {
  const name = document.getElementById('custom-name').value || 'My Workout';
  const saved = get('customWorkouts') || [];
  saved.push({
    name,
    exercises: buildExercises,
    muscles: selectedMuscles,
    type: buildMode,
    created: Date.now(),
  });
  set('customWorkouts', saved);
  const btn = document.getElementById('btn-save-workout');
  btn.textContent = 'Saved ✓';
  setTimeout(() => {
    btn.textContent = 'Save';
  }, 1500);
}

function startCustomWorkout() {
  const name =
    document.getElementById('custom-name').value ||
    (buildMode === 'crossfit' ? 'My WOD' : 'My Workout');

  if (buildMode === 'crossfit') {
    if (!cfMovements.length) return;
    const cfData = { type: cfFormat, movements: [...cfMovements] };
    if (cfFormat === 'emom') {
      cfData.rounds =
        parseInt(document.getElementById('cf-emom-rounds').value, 10) || 10;
      cfData.intervalSecs =
        parseInt(document.getElementById('cf-emom-interval').value, 10) || 60;
      const mins = cfData.intervalSecs === 60 ? '' : `${cfData.intervalSecs}s `;
      cfData.description = `EMOM ${mins}× ${cfData.rounds}`;
      cfData.badge = 'EMOM';
    } else if (cfFormat === 'amrap') {
      cfData.timeCap =
        parseInt(document.getElementById('cf-amrap-time').value, 10) || 20;
      cfData.description = `AMRAP ${cfData.timeCap} MIN`;
      cfData.badge = 'AMRAP';
    } else if (cfFormat === 'rounds') {
      cfData.rounds =
        parseInt(document.getElementById('cf-rounds-count').value, 10) || 3;
      cfData.description = `${cfData.rounds} ROUNDS FOR TIME`;
      cfData.badge = 'RFT';
    } else {
      cfData.description = 'FOR TIME';
      cfData.badge = 'FOR TIME';
    }
    beginCFWorkout(name, cfData);
    return;
  }

  if (!buildExercises.length) return;
  beginWorkout(
    name,
    'strength',
    buildExercises.map((e) => ({
      name: e.name,
      sets: e.sets,
      reps: String(e.reps),
      rest: e.rest,
      logs: Array.from({ length: e.sets }, () => ({
        weight: '',
        reps: '',
        done: false,
      })),
    })),
  );
}

// ─── EXERCISE SEARCH ─────────────────────────────────────────────────────────
function openExSearch() {
  document.getElementById('ex-search-modal').classList.add('open');
  const input = document.getElementById('ex-search-input');
  input.value = '';
  filterExercises('');
  setTimeout(() => input.focus(), 100);
}

function closeExSearch() {
  exSearchMode = 'add';
  document.getElementById('ex-search-modal').classList.remove('open');
}

function filterExercises(q) {
  const list = document.getElementById('ex-search-list');
  const profile = getActiveProfile();
  const results = EXERCISES_DB.filter(
    (e) =>
      e.name.toLowerCase().includes(q.toLowerCase()) ||
      e.group.toLowerCase().includes(q.toLowerCase()),
  );
  list.innerHTML = results
    .map((e) => {
      const pr = getPRMap()[e.name];
      const resolved = resolveExercise(e.name, profile);
      const isSubbed = resolved.reason !== 'none';
      return `<div class="esm-item${isSubbed ? ' esm-subbed' : ''}" data-name="${e.name}">
      <div>
        <div class="esm-item-name">${e.name}${isSubbed ? `<span class="esm-sub-tag">→ ${resolved.name}</span>` : ''}</div>
        <div class="esm-item-group">${e.group}${pr ? ` · PR: ${toDisplayWeight(pr)}${weightUnit()}` : ''}</div>
      </div>
      <span style="color:var(--grey)">+</span>
    </div>`;
    })
    .join('');
  list.querySelectorAll('.esm-item').forEach((item) => {
    item.addEventListener('click', () => addExercise(item.dataset.name));
  });
}

function addExercise(name) {
  const ex = EXERCISES_DB.find((e) => e.name === name);
  if (exSearchMode === 'swap' && activeWorkout) {
    // Replace the current exercise in-place, keep sets/reps structure, reset logs
    const cur = activeWorkout.exercises[currentExIdx];
    activeWorkout.exercises[currentExIdx] = {
      name: ex.name,
      sets: cur.sets,
      reps: cur.reps,
      rest: ex.defaultRest,
      logs: Array.from({ length: cur.sets }, () => ({
        weight: '',
        reps: '',
        done: false,
      })),
    };
    closeExSearch();
    renderCurrentExercise();
    renderExNav();
    return;
  }
  buildExercises.push({
    name: ex.name,
    sets: ex.defaultSets,
    reps: ex.defaultReps,
    rest: ex.defaultRest,
  });
  closeExSearch();
  renderExerciseList();
}

document
  .getElementById('ex-search-input')
  .addEventListener('input', (e) => filterExercises(e.target.value));
document
  .getElementById('btn-close-ex-search')
  .addEventListener('click', closeExSearch);

// ─── SHUFFLE ──────────────────────────────────────────────────────────────────
// Sort compounds first (heavy → moderate → light) so the workout
// always starts with the highest-load movements.
const FEEL_ORDER = { heavy: 0, moderate: 1, light: 2 };

function sortByFeel(exercises) {
  return [...exercises].sort((a, b) => {
    const aEx = EXERCISES_DB.find((e) => e.name === a.name);
    const bEx = EXERCISES_DB.find((e) => e.name === b.name);
    return (FEEL_ORDER[aEx?.feel] ?? 1) - (FEEL_ORDER[bEx?.feel] ?? 1);
  });
}

// Session-level tier override — null means "use saved profile"
let shuffleSessionTier = null;

function renderShuffleTierChips() {
  const profile = getActiveProfile();
  const activeTier = shuffleSessionTier || profile.equipmentTier;
  const container = document.getElementById('shuffle-tier-chips');
  container.innerHTML = EQUIPMENT_TIERS.map(
    (t) => `
    <span class="shuffle-tier-chip${activeTier === t.id ? ' active' : ''}" data-tier="${t.id}">${t.label}</span>
  `,
  ).join('');
  container.querySelectorAll('.shuffle-tier-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      shuffleSessionTier = chip.dataset.tier;
      renderShuffleTierChips();
    });
  });
}

function _openShuffle() {
  selectedShuffleMuscle = null;
  shuffleSessionTier = null;
  renderShuffleTierChips();
  const el = document.getElementById('shuffle-muscles');
  el.innerHTML = Object.keys(SHUFFLE_PLANS)
    .map(
      (m) => `
    <div class="shuffle-muscle" data-m="${m}">${m}</div>
  `,
    )
    .join('');
  el.querySelectorAll('.shuffle-muscle').forEach((chip) => {
    chip.addEventListener('click', () => {
      selectedShuffleMuscle = chip.dataset.m;
      el.querySelectorAll('.shuffle-muscle').forEach((c) => {
        c.classList.toggle('active', c === chip);
      });
      document.getElementById('shuffle-go').disabled = false;
    });
  });
  document.getElementById('shuffle-go').disabled = true;
  document.getElementById('shuffle-modal').classList.add('open');
}

document.getElementById('shuffle-go').addEventListener('click', () => {
  if (!selectedShuffleMuscle) return;
  const baseProfile = getActiveProfile();
  const profile = shuffleSessionTier
    ? { ...baseProfile, equipmentTier: shuffleSessionTier }
    : baseProfile;
  // Sort heavy→moderate→light (compounds first), then keep order within each tier
  const plan = sortByFeel(SHUFFLE_PLANS[selectedShuffleMuscle]);
  document.getElementById('shuffle-modal').classList.remove('open');
  const exercises = dedupeExercises(
    plan.map((e) => {
      const resolved = resolveExercise(e.name, profile);
      return {
        name: resolved.name,
        originalName: resolved.reason !== 'none' ? resolved.original : null,
        sets: e.sets,
        reps: String(e.reps),
        rest: e.rest,
        logs: Array.from({ length: e.sets }, () => ({
          weight: '',
          reps: '',
          done: false,
        })),
      };
    }),
  );
  beginWorkout(`${selectedShuffleMuscle} Day`, 'strength', exercises);
});
document.getElementById('btn-close-shuffle').addEventListener('click', () => {
  document.getElementById('shuffle-modal').classList.remove('open');
});

// ─── OVERLAY TAP TO CLOSE ────────────────────────────────────────────────────
['shuffle-modal', 'ex-search-modal'].forEach((id) => {
  document.getElementById(id).addEventListener('click', function (e) {
    if (e.target === this) this.classList.remove('open');
  });
});

// ─── NAME PROMPT — multi-step: Name → Create Account → Sign In ───────────────
const NAME_KEY = 'kilos-name';
const getUserName = () => get(NAME_KEY);
const saveUserName = (n) => set(NAME_KEY, (n || '').trim() || 'Athlete');

let _npCallback = null;

function requireName(callback) {
  if (getUserName()) {
    callback();
    return;
  }
  _npCallback = callback;
  npShowStep('start');
  // Accounts are a sync feature, not a gate — hide the door when the backend
  // isn't configured so nobody walks into a dead end.
  document.getElementById('np-start-create').style.display = isConfigured
    ? ''
    : 'none';
  document.getElementById('name-prompt').classList.add('open');
  setTimeout(() => document.getElementById('np-start-name').focus(), 320);
}

function closeNamePrompt() {
  document.getElementById('name-prompt').classList.remove('open');
  renderProfileBtn();
}

function npShowStep(step) {
  ['start', 'account', 'signin'].forEach((s) => {
    document.getElementById(`np-step-${s}`).style.display =
      s === step ? '' : 'none';
  });
}

function npSetError(id, msg) {
  const el = document.getElementById(id);
  if (el) el.textContent = msg;
}

// Derive username from display name
function nameToUsername(name) {
  return name
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9_]/g, '');
}

// Create account
document.getElementById('np-btn-create').addEventListener('click', async () => {
  const displayName = document.getElementById('np-display-name').value.trim();
  const password = document.getElementById('np-password').value;
  npSetError('np-create-error', '');

  if (!displayName) {
    document.getElementById('np-display-name').focus();
    return;
  }
  if (password.length < 6) {
    npSetError('np-create-error', 'Password needs 6+ characters.');
    return;
  }

  const username = nameToUsername(displayName);
  const btn = document.getElementById('np-btn-create');
  btn.textContent = 'Creating…';
  btn.disabled = true;

  let result;
  try {
    result = await Promise.race([
      signUpWithPassword(displayName, username, password),
      new Promise((resolve) =>
        setTimeout(() => resolve({ error: { message: '__timeout' } }), 15000),
      ),
    ]);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Create account →';
  }
  let { error } = result;

  // The account may already exist — including from a create that succeeded
  // server-side while the phone lost the response. Just sign them in.
  if (error?.message?.includes('already registered')) {
    const signin = await Promise.race([
      signInWithPassword(username, password),
      new Promise((resolve) =>
        setTimeout(() => resolve({ error: { message: '__timeout' } }), 15000),
      ),
    ]);
    if (!signin.error) error = null;
    else {
      npSetError('np-create-error', 'Name taken — try a different one.');
      return;
    }
  } else if (error?.message === '__timeout') {
    npSetError(
      'np-create-error',
      'Taking too long — check your connection. If it already went through, use Sign in.',
    );
    return;
  } else if (error) {
    npSetError('np-create-error', error.message || 'Something went wrong.');
    return;
  }

  saveUserName(displayName);
  closeNamePrompt();
  if (_npCallback) {
    const cb = _npCallback;
    _npCallback = null;
    cb();
  }
});

document.getElementById('np-password').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('np-btn-create').click();
});

// The primary path: a name and straight into training — local-first.
document.getElementById('np-local-btn').addEventListener('click', () => {
  const name = document.getElementById('np-start-name').value.trim();
  saveUserName(name || 'Athlete');
  closeNamePrompt();
  if (_npCallback) {
    const cb = _npCallback;
    _npCallback = null;
    cb();
  }
});
document.getElementById('np-start-name').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('np-local-btn').click();
});
document.getElementById('np-start-create').addEventListener('click', () => {
  const n = document.getElementById('np-start-name').value.trim();
  if (n) document.getElementById('np-display-name').value = n;
  npShowStep('account');
});
document.getElementById('np-start-signin').addEventListener('click', () => {
  const u = document.getElementById('np-signin-username');
  if (u && !u.value) u.value = get(NAME_KEY) || '';
  npShowStep('signin');
});
document.getElementById('np-acc-back').addEventListener('click', () => {
  npSetError('np-create-error', '');
  npShowStep('start');
});

// Account → Sign in
document.getElementById('np-btn-go-signin').addEventListener('click', () => {
  npSetError('np-create-error', '');
  npShowStep('signin');
  setTimeout(() => document.getElementById('np-signin-username').focus(), 80);
});

// Sign in
document.getElementById('np-btn-signin').addEventListener('click', async () => {
  const nameInput = document.getElementById('np-signin-username').value.trim();
  const password = document.getElementById('np-signin-password').value;
  npSetError('np-signin-error', '');

  if (!nameInput || !password) {
    npSetError('np-signin-error', 'Enter your name and password.');
    return;
  }

  const username = nameToUsername(nameInput);
  const btn = document.getElementById('np-btn-signin');
  btn.textContent = 'Signing in…';
  btn.disabled = true;

  let result;
  try {
    result = await Promise.race([
      signInWithPassword(username, password),
      new Promise((resolve) =>
        setTimeout(() => resolve({ error: { message: '__timeout' } }), 15000),
      ),
    ]);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Sign in →';
  }
  const { data, error } = result;

  if (error) {
    npSetError(
      'np-signin-error',
      error.message === '__timeout'
        ? 'Taking too long — check your connection and try again.'
        : 'Wrong name or password.',
    );
    return;
  }

  const displayName = data?.user?.user_metadata?.display_name || nameInput;
  saveUserName(displayName);
  // Returning user — never show onboarding, they've been through setup already
  saveProfile({
    setupComplete: true,
    equipmentTier: getProfile().equipmentTier || 'full-gym',
  });
  closeNamePrompt();
  if (_npCallback) {
    const cb = _npCallback;
    _npCallback = null;
    cb();
  }
});

document
  .getElementById('np-signin-password')
  .addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('np-btn-signin').click();
  });

// Sign in → back to create
document.getElementById('np-btn-go-create').addEventListener('click', () => {
  npSetError('np-signin-error', '');
  npShowStep('account');
});

// ─── ACTIVE WORKOUT ───────────────────────────────────────────────────────────
let pendingBegin = null;
let lastFinishSnapshot = null;
function beginWorkout(name, type, exercises) {
  const info = activeSessionInfo();
  if (info) {
    pendingBegin = { name, type, exercises };
    document.getElementById('startover-sub').textContent =
      `${info.name} is unfinished. Starting new discards it.`;
    document.getElementById('startover-confirm').classList.add('open');
    return;
  }
  beginWorkoutNow(name, type, exercises);
}
function beginWorkoutNow(name, type, exercises) {
  newPRsThisSession = [];
  activeWorkout = { name, type, exercises };
  currentExIdx = 0;
  currentSetIdx = 0;
  workoutStartTime = Date.now();
  totalWeightMoved = 0;
  sessionSets = 0;
  stopTimer();
  saveActiveState();
  goScreen('active');
}

function _beginCardioWorkout(name, cardioType, target, notes) {
  newPRsThisSession = [];
  activeWorkout = {
    name,
    type: 'cardio',
    cardioType,
    target,
    notes,
    startTime: Date.now(),
  };
  workoutStartTime = Date.now();
  totalWeightMoved = 0;
  sessionSets = 0;
  stopTimer();
  saveActiveState();
  goScreen('active');
}

const CF_TYPES = new Set(['emom', 'amrap', 'rounds', 'fortime']);

function showStrengthUI(show) {
  document.getElementById('exercise-nav').style.display = show ? '' : 'none';
  document.getElementById('exercise-display').style.display = show
    ? ''
    : 'none';
  document.getElementById('set-log').style.display = show ? '' : 'none';
}
function showCFUI(show) {
  document.getElementById('cf-meta').style.display = show ? '' : 'none';
  document.getElementById('cf-log').style.display = show ? '' : 'none';
}
function showCardioUI(show) {
  document.getElementById('cardio-log-section').style.display = show
    ? ''
    : 'none';
}

function setActiveWorkoutUI(visible) {
  const ids = [
    'exercise-nav',
    'exercise-display',
    'set-log',
    'cf-log',
    'cf-meta',
    'cardio-log-section',
  ];
  const cls = ['.timer-block', '.timer-controls'];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = visible ? '' : 'none';
  });
  cls.forEach((sel) => {
    const el = document.querySelector(sel);
    if (el) el.style.display = visible ? '' : 'none';
  });
  const ph = document.getElementById('active-placeholder');
  if (ph) ph.style.display = visible ? 'none' : 'flex';
}

function renderActiveScreen() {
  if (!activeWorkout) {
    setActiveWorkoutUI(false);
    resetTimerDisplay(0);
    return;
  }
  setActiveWorkoutUI(true);

  // Mode class drives layout: strength is log-first (compact rest timer);
  // CrossFit keeps the big clock as the hero.
  const mode = CF_TYPES.has(activeWorkout.type)
    ? 'cf'
    : activeWorkout.type === 'cardio'
      ? 'cardio'
      : 'strength';
  const activeEl = document.getElementById('active');
  activeEl.classList.remove('mode-cf', 'mode-cardio', 'mode-strength');
  activeEl.classList.add(`mode-${mode}`);
  updateLogBtn(); // strength → "Log" button; CF/cardio → play/pause icons

  if (CF_TYPES.has(activeWorkout.type)) {
    renderCFActive();
    return;
  }

  if (activeWorkout.type === 'cardio') {
    showStrengthUI(false);
    showCFUI(false);
    renderCardioActive();
    return;
  }

  // Strength
  showCFUI(false);
  showCardioUI(false);
  showStrengthUI(true);
  renderExNav();
  renderCurrentExercise();
}

function renderCardioActive() {
  document.getElementById('set-log').style.display = 'none';
  document.getElementById('cardio-log-section').style.display = '';
  document.getElementById('ex-nav-pills').innerHTML = '';
  document.getElementById('current-ex-name').textContent =
    activeWorkout.cardioType || activeWorkout.name;
  document.getElementById('current-ex-sets').textContent =
    activeWorkout.target || 'Go at your own pace';
  document.getElementById('cardio-type-label').textContent =
    activeWorkout.cardioType || 'Cardio';
  document.getElementById('cardio-notes-label').textContent =
    activeWorkout.notes || '';

  // RPE effort selector
  document.getElementById('rpe-selector')?.remove();
  const rpeEl = document.createElement('div');
  rpeEl.id = 'rpe-selector';
  rpeEl.innerHTML = `
    <div style="font-family:'Space Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:var(--grey);padding:16px 24px 10px">Effort</div>
    <div class="rpe-row">
      <button class="rpe-btn" data-rpe="easy">Easy</button>
      <button class="rpe-btn" data-rpe="moderate">Moderate</button>
      <button class="rpe-btn" data-rpe="hard">Hard</button>
      <button class="rpe-btn" data-rpe="max">Max</button>
    </div>`;
  rpeEl.querySelectorAll('.rpe-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      rpeEl.querySelectorAll('.rpe-btn').forEach((b) => {
        b.classList.remove('active');
      });
      btn.classList.add('active');
      if (activeWorkout) activeWorkout.rpe = btn.dataset.rpe;
    });
  });
  document.getElementById('cardio-log-section').appendChild(rpeEl);

  startTimer(0, 'cardio');
}

// ─── CROSSFIT ACTIVE ──────────────────────────────────────────────────────────
function renderCFActive() {
  const cf = activeWorkout.cf;
  showStrengthUI(false);
  showCardioUI(false);
  showCFUI(true);

  renderCFMeta();
  renderCFLog();

  // Initialise the timer for this format
  if (cf.type === 'emom') {
    resetTimerDisplay(cf.intervalSecs || 60);
  } else if (cf.type === 'amrap') {
    resetTimerDisplay((cf.timeCap || 20) * 60);
  } else {
    // Rounds / ForTime — stopwatch (count-up)
    setTimerText('0', 'READY');
    setTimerBar(1, false);
    setTimerStyle('work');
  }
}

function renderCFMeta() {
  const cf = activeWorkout.cf;
  document.getElementById('cf-wod-label').textContent =
    cf.description || cf.type.toUpperCase();
  const roundEl = document.getElementById('cf-round-display');
  if (cf.type === 'emom' || cf.type === 'rounds') {
    roundEl.textContent = `Round ${cfCurrentRound + 1} of ${cf.rounds}`;
  } else if (cf.type === 'amrap') {
    roundEl.textContent = cf.description || 'AMRAP';
  } else if (cf.type === 'fortime') {
    roundEl.textContent = cf.sets ? `${cf.sets.join('-')} reps` : 'For Time';
  }
}

function renderCFLog() {
  const el = document.getElementById('cf-log');
  const cf = activeWorkout.cf;
  switch (cf.type) {
    case 'emom':
      renderEMOMLog(el, cf);
      break;
    case 'amrap':
      renderAMRAPLog(el, cf);
      break;
    case 'rounds':
      renderRoundsLog(el, cf);
      break;
    case 'fortime':
      renderForTimeLog(el, cf);
      break;
  }
}

function renderEMOMLog(el, cf) {
  const movHtml = cf.movements
    .map(
      (m) => `
    <div class="cf-movement-row">
      <div>
        <div class="cf-mov-name">${m.name}</div>
        ${m.note ? `<div class="cf-mov-note">${m.note}</div>` : ''}
      </div>
      ${m.reps ? `<div class="cf-mov-reps">${m.reps}</div>` : ''}
    </div>`,
    )
    .join('');

  const dots = Array.from({ length: cf.rounds }, (_, i) => {
    const done = cfRoundLog[i] === true;
    const cur = i === cfCurrentRound;
    return `<div class="cf-round-dot${done ? ' done' : cur ? ' current' : ''}" data-round="${i}">${i + 1}</div>`;
  }).join('');

  el.innerHTML = `
    <span class="cf-log-label">This minute</span>
    ${movHtml}
    <span class="cf-log-label" style="margin-top:10px">Rounds</span>
    <div class="cf-round-dots">${dots}</div>
    <button class="cf-action-btn" id="cf-mark-done">Mark Round Complete ✓</button>`;

  el.querySelector('#cf-mark-done').addEventListener('click', () => {
    cfRoundLog[cfCurrentRound] = true;
    advanceCFRound();
  });
  el.querySelectorAll('.cf-round-dot').forEach((dot) => {
    dot.addEventListener('click', () => {
      const i = parseInt(dot.dataset.round, 10);
      cfRoundLog[i] = !cfRoundLog[i];
      renderCFLog();
    });
  });
}

function renderAMRAPLog(el, cf) {
  const movHtml = cf.movements
    .map(
      (m) => `
    <div class="cf-movement-row">
      ${m.reps ? `<div class="cf-mov-reps">${m.reps}</div>` : ''}
      <div class="cf-mov-name">${m.name}</div>
    </div>`,
    )
    .join('');

  el.innerHTML = `
    <div class="cf-amrap-counter">
      <div class="cf-amrap-rounds-label">Rounds completed</div>
      <div class="cf-amrap-rounds-num">${cfRoundsCompleted}</div>
      <div class="cf-amrap-controls">
        <button class="cf-amrap-minus" id="cf-minus">−</button>
        <button class="cf-amrap-plus"  id="cf-plus">+ Round</button>
      </div>
    </div>
    <span class="cf-log-label">Movements</span>
    ${movHtml}`;

  el.querySelector('#cf-plus').addEventListener('click', () => {
    cfRoundsCompleted++;
    beep(660, 0.1);
    if (navigator.vibrate) navigator.vibrate(30);
    renderCFLog();
  });
  el.querySelector('#cf-minus').addEventListener('click', () => {
    if (cfRoundsCompleted > 0) {
      cfRoundsCompleted--;
      renderCFLog();
    }
  });
}

function renderRoundsLog(el, cf) {
  const movHtml = cf.movements
    .map((m, i) => {
      const done = cfMovementsDone.has(i);
      const label = m.unit === 'run' ? m.name : `${m.reps} ${m.name}`;
      return `
      <div class="cf-checklist-row${done ? ' done' : ''}" data-idx="${i}">
        <div class="cf-check-box">${done ? '✓' : ''}</div>
        <div class="cf-check-label">${label}</div>
      </div>`;
    })
    .join('');

  const allDone = cf.movements.every((_, i) => cfMovementsDone.has(i));
  el.innerHTML = `
    <span class="cf-log-label">Round ${cfCurrentRound + 1} — tap to complete</span>
    ${movHtml}
    <button class="cf-action-btn" id="cf-complete-round" ${allDone ? '' : 'disabled'}>
      Complete Round ${cfCurrentRound + 1} →
    </button>`;

  el.querySelectorAll('.cf-checklist-row').forEach((row) => {
    row.addEventListener('click', () => {
      const i = parseInt(row.dataset.idx, 10);
      if (cfMovementsDone.has(i)) cfMovementsDone.delete(i);
      else cfMovementsDone.add(i);
      if (navigator.vibrate) navigator.vibrate(25);
      renderCFLog();
    });
  });
  el.querySelector('#cf-complete-round').addEventListener('click', () => {
    if (!allDone) return;
    beep(880, 0.15);
    advanceCFRound();
  });
}

function renderForTimeLog(el, cf) {
  // Expand sets × movements into a flat checklist
  const items = [];
  if (cf.sets?.length) {
    cf.sets.forEach((reps) => {
      cf.movements.forEach((m) => {
        items.push({ name: m.name, reps });
      });
    });
  } else {
    cf.movements.forEach((m) => {
      items.push({ name: m.name, reps: m.reps || null });
    });
  }

  const movHtml = items
    .map((item, i) => {
      const done = cfMovementsDone.has(i);
      const label = item.reps ? `${item.reps} ${item.name}` : item.name;
      return `
      <div class="cf-checklist-row${done ? ' done' : ''}" data-idx="${i}">
        <div class="cf-check-box">${done ? '✓' : ''}</div>
        <div class="cf-check-label">${label}</div>
      </div>`;
    })
    .join('');

  const allDone = items.every((_, i) => cfMovementsDone.has(i));
  el.innerHTML = `
    <span class="cf-log-label">Tap each as you complete it</span>
    ${movHtml}
    ${allDone ? '<button class="cf-action-btn" id="cf-fortime-finish">Done! Finish workout →</button>' : ''}`;

  el.querySelectorAll('.cf-checklist-row').forEach((row) => {
    row.addEventListener('click', () => {
      const i = parseInt(row.dataset.idx, 10);
      if (cfMovementsDone.has(i)) cfMovementsDone.delete(i);
      else cfMovementsDone.add(i);
      if (navigator.vibrate) navigator.vibrate(25);
      const nowAllDone = items.every((_, j) => cfMovementsDone.has(j));
      if (nowAllDone) {
        stopTimer();
        beep(880, 0.3);
        setTimeout(() => beep(880, 0.3), 220);
      }
      renderCFLog();
    });
  });
  el.querySelector('#cf-fortime-finish')?.addEventListener(
    'click',
    finishWorkout,
  );
}

function advanceCFRound() {
  const cf = activeWorkout?.cf;
  if (!cf) return;
  cfCurrentRound++;
  cfMovementsDone = new Set();

  if (cfCurrentRound >= (cf.rounds || 1)) {
    // All rounds done
    stopTimer();
    beep(880, 0.3);
    setTimeout(() => beep(880, 0.3), 220);
    if (cf.type === 'rounds') finishWorkout();
    else if (cf.type === 'emom') finishWorkout();
    return;
  }

  renderCFMeta();
  renderCFLog();

  if (cf.type === 'emom') {
    beep(880, 0.15);
    startTimer(cf.intervalSecs || 60, 'emom');
  }
}

function renderExNav() {
  const pills = document.getElementById('ex-nav-pills');
  const nextEx = activeWorkout.exercises[currentExIdx + 1];
  pills.innerHTML = `
    ${activeWorkout.exercises
      .map(
        (_, i) => `
      <div class="ex-nav-pill${i === currentExIdx ? ' active' : ''}" data-idx="${i}"></div>
    `,
      )
      .join('')}
    ${nextEx ? `<span class="ex-nav-next">Up: ${nextEx.name}</span>` : ''}
  `;
  pills.querySelectorAll('.ex-nav-pill').forEach((p) => {
    p.addEventListener('click', () => jumpToEx(parseInt(p.dataset.idx, 10)));
  });
}

function jumpToEx(i) {
  currentExIdx = i;
  currentSetIdx = 0;
  stopTimer();
  renderCurrentExercise();
  renderExNav();
}

// Short, single-word intensity — sits inline on the meta row next to "Set x of y".
const FEEL_LABEL = {
  heavy: 'Heavy',
  moderate: 'Moderate',
  light: 'Light',
};

function renderCurrentExercise() {
  if (!activeWorkout || activeWorkout.type === 'cardio') return;
  const ex = activeWorkout.exercises[currentExIdx];
  document.getElementById('current-ex-name').textContent = ex.name;
  const setsEl = document.getElementById('current-ex-sets');
  setsEl.textContent = `Set ${currentSetIdx + 1} of ${ex.sets}`;

  // Remove stale dynamic elements
  document.getElementById('feel-badge')?.remove();
  document.getElementById('sub-hint')?.remove();
  document.getElementById('btn-swap-ex')?.remove();
  document.getElementById('warmup-block')?.remove();

  const metaRow = document.querySelector('.ex-meta-row');
  const dbEx = EXERCISES_DB.find((e) => e.name === ex.name);

  // Feel / intensity chip — inline on the meta row next to the set counter
  // ("Set 1 of 4 · Heavy"). What's coming up next lives in the dots row below,
  // so there's no separate "Next:" line here anymore.
  if (dbEx?.feel) {
    const badge = document.createElement('span');
    badge.id = 'feel-badge';
    badge.className = `feel-badge ${dbEx.feel}`;
    badge.textContent = FEEL_LABEL[dbEx.feel];
    setsEl.insertAdjacentElement('afterend', badge);
  }

  // Swap — a small, quiet link pushed to the end of the meta row
  const swapBtn = document.createElement('button');
  swapBtn.id = 'btn-swap-ex';
  swapBtn.className = 'swap-ex-btn';
  swapBtn.textContent = 'Swap →';
  swapBtn.addEventListener('click', () => {
    exSearchMode = 'swap';
    openExSearch();
  });
  metaRow.appendChild(swapBtn);

  // Substitution hint — sits under the meta row when this is a sub
  if (ex.originalName) {
    const hint = document.createElement('div');
    hint.id = 'sub-hint';
    hint.style.cssText =
      'font-family:"Space Mono",monospace;font-size:8px;color:var(--grey2);text-transform:uppercase;letter-spacing:.1em;padding:0 24px;margin:4px 0 0;';
    hint.textContent = `Sub for: ${ex.originalName}`;
    metaRow.insertAdjacentElement('afterend', hint);
  }

  renderSetLog();
  resetTimerDisplay(ex.rest);

  // Warmup protocol block — only for compound (heavy) exercises
  if (dbEx?.feel === 'heavy') {
    const lastSession = getLastSession(ex.name);
    const topW = lastSession
      ? Math.max(...lastSession.map((l) => parseFloat(l.weight) || 0))
      : 0;
    const wSets =
      topW > 0
        ? [
            { w: `${toDisplayWeight(Math.round((topW * 0.4) / 2.5) * 2.5)}${weightUnit()}`, r: 10 },
            { w: `${toDisplayWeight(Math.round((topW * 0.6) / 2.5) * 2.5)}${weightUnit()}`, r: 5 },
            { w: `${toDisplayWeight(Math.round((topW * 0.8) / 2.5) * 2.5)}${weightUnit()}`, r: 2 },
          ]
        : [
            { w: '40%', r: 10 },
            { w: '60%', r: 5 },
            { w: '80%', r: 2 },
          ];
    const warmupEl = document.createElement('div');
    warmupEl.id = 'warmup-block';
    warmupEl.className = 'warmup-block';
    warmupEl.innerHTML = `
      <div class="warmup-header">
        <span>Warmup protocol</span>
        <span class="warmup-toggle">▾</span>
      </div>
      <div class="warmup-sets">
        ${wSets
          .map(
            (s) => `<div class="warmup-row">
          <span class="wr-weight">${s.w}</span>
          <span class="wr-x">×</span>
          <span class="wr-reps">${s.r} reps</span>
          <span class="wr-hint">not logged</span>
        </div>`,
          )
          .join('')}
      </div>`;
    warmupEl
      .querySelector('.warmup-header')
      .addEventListener('click', () => warmupEl.classList.toggle('open'));
    // Collapsed by default — log-first: the steppers are the priority, warmup
    // guidance is one tap away (DESIGN.md active-screen hierarchy).
    const setLog = document.getElementById('set-log');
    setLog.insertBefore(warmupEl, document.getElementById('set-log-rows'));
  }
}

function renderSetLog() {
  const ex = activeWorkout.exercises[currentExIdx];
  const lastSession = getLastSession(ex.name);
  const suggestion = suggestNextWeight(lastSession, ex.reps);
  const unit = weightUnit();
  const rows = document.getElementById('set-log-rows');
  // Overload hint: show specific weight + rep prescription
  const lastLogs = lastSession || [];
  const lastAllMet = allRepsMet(lastLogs, ex.reps);
  const dispSugg = suggestion
    ? isLbs()
      ? toDisplayWeight(suggestion)
      : suggestion
    : null;
  const suggReps = ex.reps || '8';
  // The next un-logged set is "current" — highlighted, and what the big timer
  // button logs when tapped.
  const nextSetIdx = ex.logs.findIndex((l) => !l.done);
  rows.innerHTML =
    (suggestion
      ? `<div class="overload-hint">
         <span class="oh-arrow">↑</span>
         <div class="oh-text">
           <span>Target today: <strong>${dispSugg}${unit} × ${suggReps}</strong></span>
           <span class="oh-sub">${lastAllMet ? `+2.5${unit} from last session` : 'Same as last session — hit all reps first'}</span>
         </div>
       </div>`
      : '') +
    ex.logs
      .map((log, i) => {
        const prev = lastSession?.[i];
        const dispPrevW = prev?.weight ? toDisplayWeight(prev.weight) : null;
        const wPlaceholder = dispPrevW ? `${dispPrevW}` : unit;
        const rPlaceholder = prev?.reps ? `${prev.reps}` : ex.reps;
        // No per-row "Last:" line — the target hint above and the prefilled
        // inputs already carry that. Once a set is logged the row earns its
        // payoff instead: the set's estimated 1RM (headline strength metric).
        const e1rm = log.done ? estimate1RM(log.weight, log.reps) : null;
        const e1rmDisp =
          e1rm != null ? (isLbs() ? toDisplayWeight(e1rm) : e1rm) : null;
        const midHint =
          e1rmDisp != null
            ? `<span class="log-e1rm">EST. 1RM ${e1rmDisp}${unit}</span>`
            : '';
        const dispLogW = log.weight ? toDisplayWeight(log.weight) : '';
        // Pre-fill the suggested set when there's a prior session to beat, so a
        // single tap on done logs it. Untouched pre-fills are captured on done
        // (toggleSetDone) — never written to data until then, so unperformed
        // sets stay out of history.
        const wValue = dispLogW || (suggestion ? dispSugg : '');
        const rValue = log.reps || (suggestion ? suggReps : '');
        const prefilled = !log.weight && suggestion ? ' prefilled' : '';
        const isCurrent = i === nextSetIdx;
        return `<div class="log-row${log.done ? ' done' : ''}${isCurrent ? ' current' : ''}">
      <button type="button" class="log-row-top" data-idx="${i}" aria-label="${log.done ? `Set ${i + 1} logged — tap to undo` : `Set ${i + 1}`}">
        <span class="log-set-num">SET ${i + 1}</span>
        ${midHint}
        ${
          log.done
            ? '<span class="log-check" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></span>'
            : ''
        }
      </button>
      <div class="log-fields">
        <div class="log-stepper-group">
          <span class="log-field-label">Weight</span>
          <div class="log-stepper">
            <button type="button" class="step-btn step-minus" data-idx="${i}" data-field="weight" data-dir="-1" aria-label="decrease weight">−</button>
            <input class="log-input${prefilled}" type="number" placeholder="${wPlaceholder}" value="${wValue}"
              data-idx="${i}" data-field="weight" inputmode="decimal">
            <button type="button" class="step-btn step-plus" data-idx="${i}" data-field="weight" data-dir="1" aria-label="increase weight">+</button>
          </div>
        </div>
        <div class="log-stepper-group">
          <span class="log-field-label">Reps</span>
          <div class="log-stepper">
            <button type="button" class="step-btn step-minus" data-idx="${i}" data-field="reps" data-dir="-1" aria-label="decrease reps">−</button>
            <input class="log-input${prefilled}" type="text" placeholder="${rPlaceholder}" value="${rValue}"
              data-idx="${i}" data-field="reps" inputmode="numeric" pattern="[0-9]*">
            <button type="button" class="step-btn step-plus" data-idx="${i}" data-field="reps" data-dir="1" aria-label="increase reps">+</button>
          </div>
        </div>
      </div>
    </div>`;
      })
      .join('');

  rows.querySelectorAll('.log-input').forEach((input) => {
    input.addEventListener('input', () => {
      input.classList.remove('prefilled'); // typed = committed, no longer a suggestion
      const idx = parseInt(input.dataset.idx, 10);
      const field = input.dataset.field;
      // Convert lbs back to kg for storage
      const val =
        field === 'weight' && isLbs()
          ? input.value
            ? String(fromDisplayWeight(input.value))
            : ''
          : input.value;
      activeWorkout.exercises[currentExIdx].logs[idx][field] = val;
    });
  });
  // Tapping a set's SET line toggles it logged/un-logged (precision + undo);
  // the big timer button is the fast path for logging the next set in order.
  rows.querySelectorAll('.log-row-top').forEach((top) => {
    top.addEventListener('click', () =>
      toggleSetDone(parseInt(top.dataset.idx, 10)),
    );
  });
  rows.querySelectorAll('.step-btn').forEach((btn) => {
    btn.addEventListener('click', () =>
      stepField(
        parseInt(btn.dataset.idx, 10),
        btn.dataset.field,
        parseInt(btn.dataset.dir, 10),
      ),
    );
  });
  updateLogBtn(); // keep the big button's label in sync with set progress
}

// One-tap progression: step the shown value (weight ±2.5kg, reps ±1) and
// commit it to the log. Stepping is an explicit edit, so it leaves the
// pre-fill state. Re-renders to reflect the new value.
function stepField(idx, field, dir) {
  const ex = activeWorkout.exercises[currentExIdx];
  const log = ex.logs[idx];
  const el = document.querySelector(
    `#set-log-rows .log-input[data-idx="${idx}"][data-field="${field}"]`,
  );
  const shown = parseFloat(el?.value) || 0;
  if (field === 'weight') {
    // Step the *displayed* value by 2.5 in either unit (matches the
    // "+2.5 from last session" hint); store back as kg.
    const nextDisp = Math.max(0, shown + dir * 2.5);
    log.weight = isLbs()
      ? String(fromDisplayWeight(nextDisp))
      : String(Math.round(nextDisp * 2) / 2);
  } else {
    log.reps = String(Math.max(1, Math.round(shown) + dir)); // a logged set is ≥1 rep
  }
  if (navigator.vibrate) navigator.vibrate(20);
  saveActiveState();
  renderSetLog();
}

function toggleSetDone(setIdx) {
  const ex = activeWorkout.exercises[currentExIdx];
  const log = ex.logs[setIdx];

  // Marking a set done: if the lifter accepted the pre-filled suggestion
  // without touching the inputs, the log data is still empty — capture what's
  // displayed now so the set is logged with the suggested numbers.
  if (!log.done) {
    const base = `#set-log-rows .log-input[data-idx="${setIdx}"]`;
    const wEl = document.querySelector(`${base}[data-field="weight"]`);
    const rEl = document.querySelector(`${base}[data-field="reps"]`);
    if (!log.weight && wEl?.value) {
      log.weight = isLbs() ? String(fromDisplayWeight(wEl.value)) : wEl.value;
    }
    if (!log.reps && rEl?.value) log.reps = rEl.value;
  }

  log.done = !log.done;

  if (!log.done) {
    // Undo must subtract what done added — otherwise a mis-tap permanently
    // inflates volume/sets into saved (and synced) history.
    sessionSets = Math.max(0, sessionSets - 1);
    const w = parseFloat(log.weight) || 0;
    const r = parseInt(log.reps, 10) || parseInt(ex.reps, 10) || 0;
    totalWeightMoved = Math.max(0, totalWeightMoved - w * r);
    saveActiveState();
  }

  if (log.done) {
    if (navigator.vibrate) navigator.vibrate(50);
    sessionSets++;
    const w = parseFloat(log.weight) || 0;
    const r = parseInt(log.reps, 10) || parseInt(ex.reps, 10) || 0;
    totalWeightMoved += w * r;
    currentSetIdx = Math.min(setIdx + 1, ex.sets - 1);
    document.getElementById('current-ex-sets').textContent =
      `Set ${currentSetIdx + 1} of ${ex.sets}`;

    // PR check — weight PR and volume PR (same weight × more reps = real gain)
    if (w > 0) {
      const isWeightPR = checkAndUpdatePR(ex.name, w);
      const isVolPR = r > 0 && checkAndUpdateVolPR(ex.name, w, r);
      if (isWeightPR || isVolPR) {
        newPRsThisSession.push({ name: ex.name, weight: w, reps: r });
        showPRToast(ex.name, w, r, isWeightPR ? 'weight' : 'volume');
      }
    }

    stopTimer();
    startTimer(ex.rest, 'rest');
    saveActiveState();
  }
  renderSetLog();
}

document.getElementById('btn-prev-ex').addEventListener('click', () => {
  if (!activeWorkout || activeWorkout.type === 'cardio' || currentExIdx <= 0)
    return;
  currentExIdx--;
  currentSetIdx = 0;
  stopTimer();
  renderCurrentExercise();
  renderExNav();
  saveActiveState();
});
document.getElementById('btn-next-ex').addEventListener('click', () => {
  if (
    !activeWorkout ||
    activeWorkout.type === 'cardio' ||
    currentExIdx >= activeWorkout.exercises.length - 1
  )
    return;
  currentExIdx++;
  currentSetIdx = 0;
  stopTimer();
  renderCurrentExercise();
  renderExNav();
  saveActiveState();
});

// ─── TIMER ────────────────────────────────────────────────────────────────────
function setTimerText(time, phase) {
  const el = document.getElementById('ring-time');
  el.textContent = time;
  // Drive responsive font-size via CSS [data-len] attribute selectors
  el.dataset.len = time.length;
  document.getElementById('ring-phase').textContent = phase;
}

function setTimerBar(pct, isRest) {
  const bar = document.getElementById('timer-bar');
  bar.style.width = `${Math.max(0, pct * 100)}%`;
  bar.classList.toggle('rest-bar', isRest);
}

function setTimerStyle(phase) {
  const num = document.getElementById('ring-time');
  const lbl = document.getElementById('ring-phase');
  const block = document.querySelector('.timer-block');
  num.classList.toggle('rest-color', phase === 'rest');
  lbl.classList.toggle('rest', phase === 'rest');
  lbl.classList.toggle('go', phase === 'work' || phase === 'cardio');
  if (block) block.classList.toggle('is-rest', phase === 'rest');
}

// One-shot tick animation — remove then re-add class to re-trigger
function flashTick() {
  const num = document.getElementById('ring-time');
  if (!num) return;
  num.classList.remove('tick');
  // Force reflow so the animation re-triggers
  void num.offsetWidth;
  num.classList.add('tick');
}

function resetTimerDisplay(seconds) {
  timerSeconds = seconds;
  timerTotal = seconds;
  timerPhase = 'work';
  setTimerText(fmtTimeBig(seconds), 'READY');
  setTimerBar(1, false);
  setTimerStyle('work');
}

function _fmtTime(s) {
  const abs = Math.abs(s);
  return `${Math.floor(abs / 60)}:${(abs % 60).toString().padStart(2, '0')}`;
}

// Hero display format: pure seconds when < 60 (1-2 chars, triggers giant font),
// MM:SS when >= 60. Makes the active screen timer dramatic.
function fmtTimeBig(s) {
  const abs = Math.abs(s);
  if (abs < 60) return abs.toString();
  return `${Math.floor(abs / 60)}:${(abs % 60).toString().padStart(2, '0')}`;
}

let cardioElapsed = 0;

function startTimer(seconds, phase) {
  stopTimer();
  timerPhase = phase;
  timerRunning = true;
  const numEl = document.getElementById('ring-time');
  numEl.classList.remove('go-text', 'tick');
  setTimerStyle(phase);

  // Count-up phases: cardio + stopwatch (rounds/fortime)
  if (phase === 'cardio' || phase === 'stopwatch') {
    cardioElapsed = 0;
    const label = phase === 'stopwatch' ? 'ELAPSED' : 'ACTIVE';
    setTimerText('0', label);
    setTimerBar(1, false);
    showPauseBtn();
    timerInterval = setInterval(() => {
      cardioElapsed++;
      setTimerText(fmtTimeBig(cardioElapsed), label);
      if (phase === 'cardio') {
        const spin = (cardioElapsed % 30) / 30;
        setTimerBar(spin < 0.5 ? spin * 2 : 2 - spin * 2, false);
      }
    }, 1000);
    saveActiveState();
    return;
  }

  // Countdown phases: work / rest / emom / amrap
  timerSeconds = seconds;
  timerTotal = seconds;
  const phaseLabel =
    phase === 'emom'
      ? 'EMOM'
      : phase === 'amrap'
        ? 'AMRAP'
        : phase.toUpperCase();
  setTimerText(fmtTimeBig(timerSeconds), phaseLabel);
  setTimerBar(1, phase === 'rest');
  showPauseBtn();
  timerInterval = setInterval(() => {
    timerSeconds--;
    setTimerText(
      fmtTimeBig(timerSeconds),
      timerPhase === 'emom'
        ? 'EMOM'
        : timerPhase === 'amrap'
          ? 'AMRAP'
          : timerPhase.toUpperCase(),
    );
    setTimerBar(
      timerTotal > 0 ? timerSeconds / timerTotal : 0,
      timerPhase === 'rest',
    );
    flashTick();
    if (timerSeconds <= 3 && timerSeconds > 0) beep(440, 0.1);
    if (timerSeconds <= 0) {
      stopTimer();
      beep(880, 0.3);

      // EMOM: auto-advance to next round
      if (timerPhase === 'emom') {
        advanceCFRound();
        return;
      }

      // AMRAP: time's up
      if (timerPhase === 'amrap') {
        setTimeout(() => beep(660, 0.15), 300); // after the 880 lands — a two-note, not a clash
        setTimerText('DONE', 'TIME UP');
        const el = document.getElementById('ring-time');
        el.classList.remove('tick');
        el.classList.add('go-text');
        setTimerStyle('work');
        setTimerBar(0, false);
        return;
      }

      // Standard rest/work — second note delayed so it reads as a rising
      // "da-DUM", not two tones stacked at the same instant.
      setTimeout(() => beep(660, 0.15), 300);
      const doneWord = timerPhase === 'rest' ? 'GO' : 'DONE';
      const doneLbl = timerPhase === 'rest' ? 'REST OVER' : 'SET DONE';
      setTimerText(doneWord, doneLbl);
      const el = document.getElementById('ring-time');
      el.classList.remove('tick');
      el.classList.add('go-text');
      setTimerStyle('work');
      setTimerBar(1, false);
    }
  }, 1000);
  saveActiveState();
}

function stopTimer() {
  clearInterval(timerInterval);
  timerRunning = false;
  showPlayBtn();
  // Persist the frozen state so a refresh-while-paused restores the remaining
  // time exactly (no fast-forward), not a stale running snapshot.
  saveActiveState();
}

// Replay a restored timer snapshot after the active screen has rendered.
// A running countdown is fast-forwarded by the real wall-clock time elapsed
// since it was saved (setInterval doesn't run while the tab is closed).
function restoreTimer() {
  const t = _pendingTimer;
  _pendingTimer = null;
  if (!t || !document.getElementById('ring-time')) return;

  // Count-up (cardio / stopwatch): resume from elapsed + time away.
  if (t.phase === 'cardio' || t.phase === 'stopwatch') {
    if (!t.running) return;
    const away = Math.max(0, Math.round((Date.now() - t.savedAt) / 1000));
    startTimer(0, t.phase);
    cardioElapsed = t.cardioElapsed + away;
    setTimerText(
      fmtTimeBig(cardioElapsed),
      t.phase === 'stopwatch' ? 'ELAPSED' : 'ACTIVE',
    );
    return;
  }

  // Countdown (work / rest / emom / amrap).
  let remaining = t.seconds;
  if (t.running) {
    const away = Math.max(0, Math.round((Date.now() - t.savedAt) / 1000));
    remaining = Math.max(0, t.seconds - away);
  }
  timerPhase = t.phase;
  timerTotal = t.total;
  timerSeconds = remaining;

  if (remaining <= 0) {
    // Expired while away (or finished): show the completed state.
    stopTimer();
    setTimerText(
      t.phase === 'rest' ? 'GO' : 'DONE',
      t.phase === 'rest' ? 'REST OVER' : 'SET DONE',
    );
    const el = document.getElementById('ring-time');
    el.classList.remove('tick');
    el.classList.add('go-text');
    setTimerStyle('work');
    setTimerBar(1, false);
  } else if (t.running) {
    // Resume the live countdown from where it really is, but keep the original
    // total so the progress ring fills correctly (startTimer resets total).
    startTimer(remaining, t.phase);
    timerTotal = t.total;
    setTimerBar(t.total > 0 ? remaining / t.total : 0, t.phase === 'rest');
  } else {
    // Paused with time left: show the frozen remaining.
    setTimerText(fmtTimeBig(remaining), t.phase.toUpperCase());
    setTimerBar(t.total > 0 ? remaining / t.total : 0, t.phase === 'rest');
    setTimerStyle(t.phase);
    showPlayBtn();
  }
}

function toggleTimer() {
  if (timerRunning) {
    stopTimer();
    return;
  }
  if (!activeWorkout) return;

  switch (activeWorkout.type) {
    case 'cardio':
      startTimer(0, 'cardio');
      break;
    case 'emom':
      startTimer(timerSeconds || activeWorkout.cf?.intervalSecs || 60, 'emom');
      break;
    case 'amrap': {
      // Don't restart if AMRAP already expired (timerSeconds <= 0 and not running)
      const amrapFull = (activeWorkout.cf?.timeCap || 20) * 60;
      if (timerSeconds > 0 || timerTotal === 0)
        startTimer(timerSeconds || amrapFull, 'amrap');
      break;
    }
    case 'rounds':
    case 'fortime':
      startTimer(0, 'stopwatch');
      break;
    default:
      // Strength: resume countdown where it left off
      startTimer(
        timerSeconds || activeWorkout.exercises?.[currentExIdx]?.rest || 90,
        timerPhase || 'work',
      );
  }
}

// In strength mode the big button is a Log button (.is-log), not a play/pause —
// so the timer's start/stop must not swap its icons out from under the label.
function isStrengthActive() {
  return (
    activeWorkout &&
    !CF_TYPES.has(activeWorkout.type) &&
    activeWorkout.type !== 'cardio'
  );
}
function showPlayBtn() {
  if (isStrengthActive()) return;
  document.getElementById('play-icon').style.display = '';
  document.getElementById('pause-icon').style.display = 'none';
  document
    .getElementById('play-pause-btn')
    .setAttribute('aria-label', 'Start the timer');
}
function showPauseBtn() {
  if (isStrengthActive()) return;
  document.getElementById('play-icon').style.display = 'none';
  document.getElementById('pause-icon').style.display = '';
  document
    .getElementById('play-pause-btn')
    .setAttribute('aria-label', 'Pause the timer');
}

// The big central button: in strength it logs the next set (and the rest timer
// auto-runs); in CrossFit/cardio it stays the clock's play/pause.
function advanceActive() {
  if (!activeWorkout) return;
  const ex = activeWorkout.exercises[currentExIdx];
  const next = ex.logs.findIndex((l) => !l.done);
  if (next !== -1) {
    currentSetIdx = next;
    toggleSetDone(next); // logs the set (+ PR check + rest), re-renders set log
    return;
  }
  // All sets logged → step to the next exercise, or finish on the last one.
  if (currentExIdx < activeWorkout.exercises.length - 1) {
    currentExIdx++;
    currentSetIdx = 0;
    stopTimer();
    renderCurrentExercise();
    renderExNav();
    saveActiveState();
  } else {
    document.getElementById('btn-finish').click();
  }
}

// Sync the big button's mode + label with the current state.
function updateLogBtn() {
  const btn = document.getElementById('play-pause-btn');
  const label = document.getElementById('pp-label');
  const playIcon = document.getElementById('play-icon');
  const pauseIcon = document.getElementById('pause-icon');
  if (!btn || !label) return;
  if (!isStrengthActive()) {
    btn.classList.remove('is-log');
    label.style.display = 'none';
    if (!timerRunning) {
      playIcon.style.display = '';
      pauseIcon.style.display = 'none';
    }
    return;
  }
  btn.classList.add('is-log');
  playIcon.style.display = 'none';
  pauseIcon.style.display = 'none';
  label.style.display = '';
  const ex = activeWorkout.exercises[currentExIdx];
  if (ex.logs.some((l) => !l.done)) {
    label.textContent = 'Log';
    btn.setAttribute('aria-label', 'Log the next set');
  } else if (currentExIdx < activeWorkout.exercises.length - 1) {
    label.textContent = 'Next';
    btn.setAttribute('aria-label', 'Next exercise');
  } else {
    label.textContent = 'Finish';
    btn.setAttribute('aria-label', 'Finish session');
  }
}

document.getElementById('play-pause-btn').addEventListener('click', () => {
  if (isStrengthActive()) advanceActive();
  else toggleTimer();
});

// ─── SCREEN LOCK / BACKGROUND TAB TIMER FIX ──────────────────────────────────
// When the screen locks or tab goes background, setInterval pauses.
// On return, we calculate real elapsed time and fast-forward the timer.
const COUNTUP_PHASES = new Set(['cardio', 'stopwatch']);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (timerRunning && !COUNTUP_PHASES.has(timerPhase))
      timerHiddenAt = Date.now();
  } else if (timerHiddenAt !== null) {
    if (timerRunning && !COUNTUP_PHASES.has(timerPhase)) {
      const elapsed = Math.round((Date.now() - timerHiddenAt) / 1000);
      timerSeconds = Math.max(0, timerSeconds - elapsed);
      setTimerText(fmtTimeBig(timerSeconds), timerPhase.toUpperCase());
      setTimerBar(
        timerTotal > 0 ? timerSeconds / timerTotal : 0,
        timerPhase === 'rest',
      );
      setTimerStyle(timerPhase);
      if (timerSeconds <= 0) {
        stopTimer();
        beep(880, 0.3);
        setTimerText(
          timerPhase === 'rest' ? 'GO' : 'DONE',
          timerPhase === 'rest' ? 'REST OVER' : 'SET DONE',
        );
        setTimerStyle('work');
        setTimerBar(1, false);
      }
    }
    timerHiddenAt = null;
  }
});

// ─── FINISH ───────────────────────────────────────────────────────────────────
document.getElementById('btn-finish').addEventListener('click', () => {
  if (!activeWorkout) return;
  // Guard: if no sets logged yet, show 0-data warning in confirm sub-text (task #3)
  const hasSets = activeWorkout.exercises
    ? activeWorkout.exercises.some((e) => e.logs?.some((l) => l.done))
    : false;
  const isCFOrCardio = !activeWorkout.exercises;
  const sub = document.getElementById('finish-confirm-sub');
  if (sub) {
    if (!hasSets && !isCFOrCardio) {
      sub.textContent = 'No sets logged yet — you sure you want to end?';
    } else {
      sub.textContent = 'This will end your session and save it.';
    }
  }
  document.getElementById('finish-confirm').classList.add('open');
});
document.getElementById('btn-finish-yes').addEventListener('click', () => {
  document.getElementById('finish-confirm').classList.remove('open');
  finishWorkout();
});
document.getElementById('btn-finish-no').addEventListener('click', () => {
  document.getElementById('finish-confirm').classList.remove('open');
});

function finishWorkout() {
  if (!activeWorkout) return;
  stopTimer();
  const elapsed = workoutStartTime
    ? Math.floor((Date.now() - workoutStartTime) / 1000)
    : 0;
  const durationStr = `${Math.floor(elapsed / 60)}:${(elapsed % 60).toString().padStart(2, '0')}`;
  const completed = { ...activeWorkout };

  const history = get('workoutHistory') || [];
  const isCF = CF_TYPES.has(completed.type);
  // Logs are the source of truth for the saved entry — live accumulators can
  // drift (undos, restores); recompute like the rehab finish does.
  const doneLogs = (completed.exercises || []).flatMap((e) =>
    (e.logs || []).filter((l) => l.done),
  );
  const savedSets =
    completed.type === 'cardio' || isCF ? sessionSets : doneLogs.length;
  const savedWeight =
    completed.type === 'cardio' || isCF
      ? totalWeightMoved
      : doneLogs.reduce(
          (sum, l) =>
            sum + (parseFloat(l.weight) || 0) * (parseInt(l.reps, 10) || 0),
          0,
        );
  const entry = {
    name: completed.name,
    type: completed.type || 'strength',
    date: new Date().toISOString(),
    duration: durationStr,
    totalWeight: Math.round(savedWeight),
    sets: savedSets,
    newPRs: newPRsThisSession,
    exercises:
      completed.type === 'cardio' || isCF
        ? []
        : completed.exercises.map((e) => ({
            name: e.name,
            sets: e.sets,
            logs: e.logs,
          })),
  };
  if (completed.type === 'cardio') {
    entry.cardioType = completed.cardioType;
    entry.distance =
      document.getElementById('cardio-distance-input')?.value || '';
    entry.rpe = completed.rpe || null;
  }
  if (isCF) {
    entry.cfFormat = completed.type;
    entry.cfRoundsCompleted =
      completed.type === 'amrap' ? cfRoundsCompleted : cfCurrentRound;
    entry.cfMovements = (completed.cf?.movements || []).map((m) => m.name);
  }
  // Snapshot for "Undo — keep training" on the summary (classic loop only):
  // accidental finishes restore the live session and drop the entry.
  lastFinishSnapshot = {
    workout: completed,
    startTime: workoutStartTime,
    entryDate: entry.date,
    totals: { totalWeightMoved, sessionSets },
  };
  history.push(entry);
  // The finished workout must never celebrate a save that didn't happen —
  // write raw (the get/set helper swallows quota errors), retry once after
  // pruning non-essential keys, and if it STILL fails keep the session open.
  let historySaved = false;
  try {
    localStorage.setItem('workoutHistory', JSON.stringify(history));
    historySaved = true;
  } catch {
    try {
      localStorage.removeItem('kilos-launch-workout');
      localStorage.removeItem(`${ACTIVE_STATE_KEY}-bak`);
      localStorage.setItem('workoutHistory', JSON.stringify(history));
      historySaved = true;
    } catch {}
  }
  if (!historySaved) {
    history.pop();
    const note = document.createElement('div');
    note.className = 'save-fail-note';
    note.setAttribute('role', 'alert');
    note.textContent =
      "Couldn't save to this device — your session is still open. Free up storage and finish again.";
    document.body.appendChild(note);
    setTimeout(() => note.remove(), 6000);
    return; // active state intact; nothing lost
  }

  // Auto-sync to cloud if signed in
  pushData();

  lastFinishedWorkout = completed;
  lastFinishedEntry = entry;
  activeWorkout = null;
  saveActiveState(); // clear persisted active state
  renderHome(); // update Resume button
  showWorkoutSummary(completed, durationStr, entry);
}

// ─── POST-WORKOUT SUMMARY SCREEN ─────────────────────────────────────────────
function showWorkoutSummary(workout, duration, entry) {
  const undoBtn = document.getElementById('wsum-undo');
  if (undoBtn) undoBtn.style.display = lastFinishSnapshot ? '' : 'none';
  const isCF = CF_TYPES.has(workout.type);
  const isCardio = workout.type === 'cardio';

  // Header — "Density 40 · A — Pull" splits into a mono kicker + a poster
  // line fitted to the width, same treatment as the session preview title.
  const nameEl = document.getElementById('wsum-name');
  const fullName = workout.name.toUpperCase();
  const dotAt = fullName.indexOf(' · ');
  const kicker = dotAt > 0 ? fullName.slice(0, dotAt) : '';
  const poster = dotAt > 0 ? fullName.slice(dotAt + 3) : fullName;
  nameEl.innerHTML = `${kicker ? `<span class="wsum-name-kicker">${kicker}</span>` : ''}<span class="wsum-name-poster" id="wsum-name-poster">${poster}</span>`;

  // Streak — the reward moment. The finished session is already in history,
  // so this reflects the extended chain.
  const streak = currentStreak(get('workoutHistory') || []);
  const eyebrowEl = document.getElementById('wsum-eyebrow');
  if (eyebrowEl) {
    eyebrowEl.textContent =
      streak >= 2 ? `${streak} DAY STREAK` : 'SESSION COMPLETE';
  }

  // PR badge
  const prBadgeEl = document.getElementById('wsum-pr-badge');
  if (newPRsThisSession.length) {
    prBadgeEl.textContent = `+${newPRsThisSession.length} NEW PR${newPRsThisSession.length > 1 ? 'S' : ''}`;
    prBadgeEl.style.display = '';
  } else {
    prBadgeEl.style.display = 'none';
  }

  // Stats grid — strength leads with ONE big number (count-up); CF/cardio keep
  // the 3-up grid. .is-strength switches the container to the hero layout (CSS).
  const statsEl = document.getElementById('wsum-stats');
  statsEl.classList.toggle('is-strength', !isCF && !isCardio);
  if (isCF) {
    const roundsVal =
      workout.type === 'amrap' ? cfRoundsCompleted : cfCurrentRound;
    const roundsLbl = workout.type === 'amrap' ? 'Rounds' : 'Rounds Done';
    statsEl.innerHTML = `
      <div class="wsum-stat"><div class="ws-val">${duration}</div><div class="ws-lbl">Duration</div></div>
      <div class="wsum-stat"><div class="ws-val" data-count="${roundsVal}">0</div><div class="ws-lbl">${roundsLbl}</div></div>
      <div class="wsum-stat"><div class="ws-val">${workout.cf?.badge || workout.type.toUpperCase()}</div><div class="ws-lbl">Format</div></div>
    `;
  } else if (isCardio) {
    statsEl.innerHTML = `
      <div class="wsum-stat"><div class="ws-val">${duration}</div><div class="ws-lbl">Duration</div></div>
      <div class="wsum-stat"><div class="ws-val">${entry.distance || '—'}</div><div class="ws-lbl">Distance</div></div>
      <div class="wsum-stat"><div class="ws-val">${workout.cardioType || 'Cardio'}</div><div class="ws-lbl">Type</div></div>
    `;
  } else {
    // No totals — the work itself is the record. Sets + time, then the list.
    statsEl.innerHTML = `
      <div class="wsum-substats">
        <div class="wsum-stat"><div class="ws-val" data-count="${sessionSets}">0</div><div class="ws-lbl">Sets Done</div></div>
        <div class="wsum-stat"><div class="ws-val">${duration}</div><div class="ws-lbl">Duration</div></div>
      </div>
    `;
  }

  // The work, in full — every movement with its honest sets × reps (+ top
  // weight where one was logged). Replaces the old total-volume/best-set focus.
  document.getElementById('wsum-top-lift').style.display = 'none';
  const workEl = document.getElementById('wsum-work');
  if (workEl) {
    const esc = (t) =>
      String(t).replace(
        /[&<>"']/g,
        (c) =>
          ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
          })[c],
      );
    let rows = [];
    if (isCF) {
      rows = (workout.cf?.movements || []).map((m) => ({
        name: m.name,
        detail: m.reps ? `${m.reps} REPS / ROUND` : '',
      }));
    } else if (!isCardio) {
      rows = (workout.exercises || [])
        .map((ex) => {
          const done = (ex.logs || []).filter((l) => l.done);
          const sets = done.length || ex.sets || 0;
          if (!sets) return null;
          const reps = [
            ...new Set(
              done
                .map((l) => parseInt(l.reps, 10))
                .filter((r) => Number.isFinite(r) && r > 0),
            ),
          ];
          let repStr = '';
          if (reps.length === 1) repStr = ` × ${reps[0]} REPS`;
          else if (reps.length > 1)
            repStr = ` × ${Math.min(...reps)}–${Math.max(...reps)} REPS`;
          else if (ex.reps) repStr = ` × ${ex.reps} REPS`;
          const top = Math.max(
            0,
            ...done.map((l) => parseFloat(l.weight) || 0),
          );
          const wStr =
            top > 0
              ? ` · ${toDisplayWeight(top)} ${weightUnit().toUpperCase()}`
              : '';
          return {
            name: ex.name,
            detail: `${sets} SET${sets > 1 ? 'S' : ''}${repStr}${wStr}`,
          };
        })
        .filter(Boolean);
    }
    workEl.style.display = rows.length ? '' : 'none';
    workEl.innerHTML = rows.length
      ? `<div class="wsum-work-label">The Work</div>` +
        rows
          .map(
            (r) =>
              `<div class="wsum-work-row"><div class="wsum-work-name">${esc(r.name.toUpperCase())}</div>${r.detail ? `<div class="wsum-work-sub">${esc(r.detail)}</div>` : ''}</div>`,
          )
          .join('')
      : '';
  }

  // Smart account nudge: only for signed-out users, and only the first few
  // sessions — enough to convert, capped so it never nags. (Local-first stays
  // the default; this just makes backing up obvious once there's data worth it.)
  const nudge = document.getElementById('wsum-nudge');
  if (nudge) {
    const sessions = (get('workoutHistory') || []).length;
    nudge.style.display =
      isConfigured && !currentUser && sessions <= 5 ? '' : 'none';
  }

  document.getElementById('workout-summary').classList.add('open');
  fitLineFont(document.getElementById('wsum-name-poster'), 76, 28);
  animateSummaryNumbers();
}

document.getElementById('wsum-nudge-cta')?.addEventListener('click', () => {
  document.getElementById('workout-summary').classList.remove('open');
  const nameEl = document.getElementById('np-display-name');
  if (nameEl && getUserName()) nameEl.value = getUserName(); // prefill known name
  npShowStep('account');
  document.getElementById('name-prompt').classList.add('open');
  setTimeout(() => document.getElementById('np-password')?.focus(), 320);
});
document.getElementById('wsum-nudge-skip')?.addEventListener('click', () => {
  document.getElementById('wsum-nudge').style.display = 'none';
});

document.getElementById('wsum-share').addEventListener('click', () => {
  document.getElementById('workout-summary').classList.remove('open');
  showShareCard(
    lastFinishedWorkout,
    lastFinishedEntry?.duration || '—',
    lastFinishedEntry,
  );
});
document.getElementById('wsum-history').addEventListener('click', () => {
  document.getElementById('workout-summary').classList.remove('open');
  goScreen('history');
});
document.getElementById('wsum-undo').addEventListener('click', () => {
  const snap = lastFinishSnapshot;
  if (!snap) return;
  lastFinishSnapshot = null;
  // Drop the entry that was just saved…
  const history = get('workoutHistory') || [];
  const idx = history.findLastIndex((h) => h.date === snap.entryDate);
  if (idx >= 0) {
    history.splice(idx, 1);
    set('workoutHistory', history);
    pushData();
  }
  // …and put the session back exactly where it was.
  activeWorkout = snap.workout;
  workoutStartTime = snap.startTime;
  totalWeightMoved = snap.totals.totalWeightMoved;
  sessionSets = snap.totals.sessionSets;
  saveActiveState();
  document.getElementById('workout-summary').classList.remove('open');
  renderActiveScreen();
  goScreen('active');
});
document.getElementById('wsum-close').addEventListener('click', () => {
  document.getElementById('workout-summary').classList.remove('open');
});

function showShareCard(workout, duration, _entry) {
  // Build the data model for the canvas renderer
  currentShareData = buildShareData({
    workout,
    cfRoundsCompleted,
    duration,
    streak: currentStreak(get('workoutHistory') || []),
  });
  currentShareStyle = get('kilos-share-style') || 'editorial';
  currentShareColor = get('kilos-share-color') || '#FFFFFF';
  currentShareBgImage = null;

  // Reflect persisted choices in the pickers
  document.querySelectorAll('#share-style-row .share-bg-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.style === currentShareStyle);
  });
  document.querySelectorAll('.share-color-dot').forEach((b) => {
    b.classList.toggle('active', b.dataset.color === currentShareColor);
  });
  document.getElementById('share-bg-photo').classList.remove('active');
  document.getElementById('share-bg-file').value = '';

  document.getElementById('share-modal').classList.add('open');
  _renderShareCanvas();
}

async function _renderShareCanvas() {
  const canvas = document.getElementById('share-canvas');
  if (!canvas || !currentShareData) return;
  await renderShareCard(canvas, currentShareData, {
    style: currentShareStyle,
    color: currentShareColor,
    photo: currentShareBgImage,
  });
}

document.querySelectorAll('#share-style-row .share-bg-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    currentShareStyle = btn.dataset.style;
    set('kilos-share-style', currentShareStyle);
    document.querySelectorAll('#share-style-row .share-bg-btn').forEach((b) => {
      b.classList.toggle('active', b === btn);
    });
    _renderShareCanvas();
  });
});
document.querySelectorAll('.share-color-dot').forEach((btn) => {
  btn.addEventListener('click', () => {
    currentShareColor = btn.dataset.color;
    set('kilos-share-color', currentShareColor);
    document.querySelectorAll('.share-color-dot').forEach((b) => {
      b.classList.toggle('active', b === btn);
    });
    _renderShareCanvas();
  });
});

document.getElementById('share-bg-photo').addEventListener('click', () => {
  document.getElementById('share-bg-file').click();
});

document.getElementById('share-bg-file').addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    currentShareBgImage = img;
    document.getElementById('share-bg-photo').classList.add('active');
    _renderShareCanvas();
  };
  img.src = url;
});

document.getElementById('btn-share').addEventListener('click', async () => {
  const btn = document.getElementById('btn-share');
  btn.textContent = 'Saving…';
  btn.disabled = true;
  try {
    const canvas = document.getElementById('share-canvas');
    await shareWorkoutImage(canvas, lastFinishedWorkout?.name || 'My Workout');
  } catch (e) {
    console.warn('Share failed', e);
  }
  btn.textContent = 'Save Photo';
  btn.disabled = false;
  document.getElementById('share-modal').classList.remove('open');
  goScreen('home');
});
document.getElementById('btn-close-share').addEventListener('click', () => {
  document.getElementById('share-modal').classList.remove('open');
  goScreen('home');
});

async function shareWorkoutImage(canvas, workoutName) {
  return new Promise((resolve) => {
    canvas.toBlob(async (blob) => {
      const file = new File([blob], 'kilos-workout.png', { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: 'KILOS TRAINING',
            text: `${workoutName} · #kilostraining`,
          });
        } catch (e) {
          if (e.name !== 'AbortError') _downloadCanvas(canvas);
        }
      } else {
        // Desktop / unsupported — download the image directly
        _downloadCanvas(canvas);
      }
      resolve();
    }, 'image/png');
  });
}

function _downloadCanvas(canvas) {
  const a = document.createElement('a');
  a.download = 'kilos-workout.png';
  a.href = canvas.toDataURL('image/png');
  a.click();
}

// ─── HISTORY ──────────────────────────────────────────────────────────────────
const expandedHistory = new Set();

function renderHistory() {
  const history = get('workoutHistory') || [];
  const prMap = getPRMap();
  const prs = Object.entries(prMap).filter(([, v]) => v > 0);
  document.getElementById('pr-count').textContent = `${prs.length} PRs`;

  if (!prs.length) {
    document.getElementById('pr-row').innerHTML = `
      <div class="pr-empty">
        <p>Log your current bests — unlocks weight suggestions and warmup plans.</p>
        <button class="pr-log-cta" id="btn-log-prs-h">Log my lifts →</button>
      </div>`;
    document
      .getElementById('btn-log-prs-h')
      .addEventListener('click', openPRLog);
  } else {
    document.getElementById('pr-row').innerHTML = `
      ${prs
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(
          ([name, val]) => `
        <div class="pr-card">
          <div class="pr-val">${toDisplayWeight(val)}${weightUnit()}</div>
          <div class="pr-label">${prShortName(name)}</div>
        </div>`,
        )
        .join('')}
      <div class="pr-card pr-card-add" id="btn-add-prs">
        <div class="pr-val pr-add-icon">+</div>
        <div class="pr-label">Add</div>
      </div>`;
    document.getElementById('btn-add-prs').addEventListener('click', openPRLog);
    document.getElementById('pr-count')?.addEventListener('click', openPRLog);
  }

  // PR board (above) lives on Home; the full session list was retired with the
  // standalone History screen. Bail once the PR board is populated.
  const listEl = document.getElementById('history-list');
  if (!listEl) return;
  if (!history.length) {
    listEl.innerHTML = `
      <div class="recent-empty">
        <div class="re-fig">00</div>
        <div class="re-cap">Nothing logged yet</div>
        <div class="re-sub">Finish a session and it lands here — every set, every kilo, forever.</div>
      </div>`;
    return;
  }
  if (!history.length) {
    listEl.innerHTML = `<div class="history-empty"><div class="big-num">0</div><p>No sessions yet.<br>Finish a workout to see it here.</p></div>`;
    return;
  }
  const CF_TYPE_TAGS = {
    emom: 'EMO',
    amrap: 'AMR',
    rounds: 'RFT',
    fortime: 'FT',
  };
  listEl.innerHTML = history
    .slice()
    .reverse()
    .map((h, revIdx) => {
      const realIdx = history.length - 1 - revIdx;
      const isExpanded = expandedHistory.has(realIdx);
      const d = new Date(h.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      const isCF = CF_TYPES.has(h.type);
      const isRehab = h.type === 'rehab';
      const typeTag = isCF
        ? CF_TYPE_TAGS[h.type] || 'CF'
        : isRehab
          ? 'RHB'
          : h.type === 'cardio'
            ? 'CDO'
            : 'STR';
      const prLine = h.newPRs?.length
        ? `<div class="hi-pr">PR — ${h.newPRs.map((p) => p.name).join(', ')}</div>`
        : '';
      const bigNum = isCF
        ? h.cfRoundsCompleted != null
          ? h.cfRoundsCompleted
          : h.duration || '—'
        : isRehab
          ? h.totalWeight
            ? fmtNum(toDisplayWeight(h.totalWeight))
            : h.sets || 0
          : h.type === 'cardio'
            ? h.duration || '0:00'
            : fmtNum(toDisplayWeight(h.totalWeight || 0));
      const bigUnit = isCF
        ? h.type === 'amrap'
          ? 'rounds'
          : h.type === 'fortime'
            ? 'done'
            : 'rounds'
        : isRehab
          ? h.totalWeight
            ? `${weightUnit()} vol`
            : 'sets'
          : h.type === 'cardio'
            ? 'duration'
            : `${weightUnit()} vol`;
      const rpeStr = h.rpe ? ` · ${h.rpe}` : '';
      const meta = isCF
        ? `${d} · ${h.cfFormat || h.type} · ${h.duration}`
        : h.type === 'cardio'
          ? `${d} · ${h.distance || '—'}${rpeStr}`
          : `${d} · ${h.sets || 0} sets · ${h.duration}`;

      // Drill-down: show best set per exercise when expanded
      const detailHtml =
        isExpanded && h.type === 'strength' && h.exercises?.length
          ? `<div class="hi-detail">${h.exercises
              .map((ex) => {
                const logs = (ex.logs || []).filter((l) => l.weight || l.reps);
                const best = logs.reduce((b, l) => {
                  const vol =
                    (parseFloat(l.weight) || 0) * (parseInt(l.reps, 10) || 0);
                  return vol > (b.vol || 0) ? { ...l, vol } : b;
                }, {});
                const stat = best.weight
                  ? `${toDisplayWeight(best.weight)}${weightUnit()} × ${best.reps || '?'}`
                  : `${ex.sets}×`;
                return `<div class="hi-ex-row"><span>${ex.name}</span><span>${stat}</span></div>`;
              })
              .join('')}</div>`
          : '';

      return `<div class="history-item${isExpanded ? ' expanded' : ''}" data-ridx="${realIdx}">
      <div class="hi-main">
        <div class="hi-left">
          <div class="hi-name"><span class="rc-type">${typeTag}</span><span class="rc-name-text">${h.name}</span></div>
          <div class="hi-meta">${meta}</div>
          ${prLine}
        </div>
        <div>
          <div class="hi-big">${bigNum}</div>
          <div class="hi-big-unit">${bigUnit}</div>
        </div>
      </div>
      ${detailHtml}
    </div>`;
    })
    .join('');

  listEl.querySelectorAll('.history-item').forEach((item) => {
    item.addEventListener('click', () => {
      const idx = parseInt(item.dataset.ridx, 10);
      if (expandedHistory.has(idx)) expandedHistory.delete(idx);
      else expandedHistory.add(idx);
      renderHistory();
    });
  });
}

// ─── PR LOG MODAL ─────────────────────────────────────────────────────────────
const PR_EXERCISES = {
  strength: [
    'Barbell Bench Press',
    'Barbell Back Squat',
    'Conventional Deadlift',
    'Barbell Overhead Press',
    'Barbell Row (Overhand)',
    'Weighted Pull-Up',
    'Romanian Deadlift',
    'Incline Dumbbell Press',
    'Hip Thrust (Barbell)',
  ],
  olympic: [
    'Snatch',
    'Clean & Jerk',
    'Clean (Squat)',
    'Power Clean',
    'Power Snatch',
    'Push Jerk',
    'Split Jerk',
    'Hang Power Clean',
    'Hang Power Snatch',
    'Overhead Squat',
    'Front Squat',
  ],
};

let prLogTab = 'strength';

function renderPRLogInputs() {
  const prMap = getPRMap();
  const list = PR_EXERCISES[prLogTab] || PR_EXERCISES.strength;
  document.getElementById('pr-log-inputs').innerHTML = list
    .map(
      (name) => `
    <div class="pr-log-row">
      <label class="pr-log-label">${name}</label>
      <div class="pr-log-input-wrap">
        <input type="number" class="pr-log-input" data-ex="${name}"
          placeholder="—" value="${prMap[name] || ''}"
          inputmode="decimal" min="0" step="0.5">
        <span class="pr-log-unit">kg</span>
      </div>
    </div>
  `,
    )
    .join('');
}

function openPRLog() {
  prLogTab = 'strength';
  document.querySelectorAll('.pr-tab').forEach((t) => {
    t.classList.toggle('active', t.dataset.tab === prLogTab);
  });
  renderPRLogInputs();
  document.getElementById('pr-log-modal').classList.add('open');
}

document.querySelectorAll('.pr-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    prLogTab = tab.dataset.tab;
    document.querySelectorAll('.pr-tab').forEach((t) => {
      t.classList.toggle('active', t === tab);
    });
    renderPRLogInputs();
  });
});

document.getElementById('pr-log-save').addEventListener('click', () => {
  const prMap = getPRMap();
  document.querySelectorAll('.pr-log-input').forEach((input) => {
    const val = parseFloat(input.value);
    if (val > 0) prMap[input.dataset.ex] = val;
  });
  set('prMap', prMap);
  document.getElementById('pr-log-modal').classList.remove('open');
  renderHistory();
});
document.getElementById('btn-close-pr-log').addEventListener('click', () => {
  document.getElementById('pr-log-modal').classList.remove('open');
});
document.getElementById('pr-log-modal').addEventListener('click', function (e) {
  if (e.target === this) this.classList.remove('open');
});

// Export CSV
document.getElementById('btn-export').addEventListener('click', () => {
  const history = get('workoutHistory') || [];
  if (!history.length) return;
  const rows = ['Date,Workout,Type,Exercise,Set,Weight(kg),Reps,Duration'];
  history.forEach((h) => {
    if (h.type === 'cardio') {
      rows.push(`${h.date},"${h.name}",cardio,,,,,${h.duration}`);
    } else {
      h.exercises?.forEach((ex) => {
        ex.logs?.forEach((log, i) => {
          rows.push(
            `${h.date},"${h.name}",strength,"${ex.name}",${i + 1},${log.weight || ''},${log.reps || ''},${h.duration}`,
          );
        });
      });
    }
  });
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `kilos-history-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
});

// ─── BACKUP / RESTORE ────────────────────────────────────────────────────────
// Export/import JSON removed from the public UI — regular users don't need to
// deal with files. Sync is handled via accounts. The hidden #import-file input
// is kept for future use (e.g. a developer/settings screen).
const BACKUP_KEYS = [
  'workoutHistory',
  'prMap',
  'volPRMap',
  'customWorkouts',
  'userProfile',
];

document.getElementById('import-file')?.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (ev) => {
    try {
      const data = JSON.parse(ev.target.result);
      if (!data.version || !data.exported)
        throw new Error('Not a KILOS TRAINING backup');
      BACKUP_KEYS.forEach((k) => {
        if (data[k] != null) set(k, data[k]);
      });
      await pushData();
      renderHome();
      renderHistory();
    } catch {
      // silently ignore — no visible error since there's no button to revert text on
    }
    e.target.value = '';
  };
  reader.readAsText(file);
});

// ─── AUTH STATE ───────────────────────────────────────────────────────────────
let currentUser = null;

async function renderDataNotice() {
  const session = await getSession();
  currentUser = session?.user || null;
  const notice = document.querySelector('.data-notice');
  if (!notice) return;
  if (currentUser) {
    const rawEmail = currentUser.email || '';
    const displayId = rawEmail.endsWith('@kilostraining.app')
      ? rawEmail.replace('@kilostraining.app', '')
      : rawEmail;
    const pending = hasPendingSync();
    notice.innerHTML = `<div class="dn-foot">${
      pending ? '⟳ SYNC PENDING' : `SYNCED · ${displayId.toUpperCase()}`
    }</div>`;
  } else {
    notice.innerHTML = `<div class="dn-foot">THIS DEVICE ONLY · CREATE AN ACCOUNT TO SYNC</div>`;
  }
}

// Listen for auth state changes (sign-in redirect returns here)
if (supabase) {
  // NEVER await supabase calls inside onAuthStateChange — the client holds
  // its auth lock until subscribers return, so signIn/signUp would deadlock
  // (server succeeds, the app hangs on "Creating…"/"Signing in…" forever).
  // Defer all follow-up work out of the callback.
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_IN') {
      setTimeout(async () => {
        await pullAndMerge();
        saveProfile({
          setupComplete: true,
          equipmentTier: getProfile().equipmentTier || 'full-gym',
        });
        renderHome();
        renderHistory();
        renderDataNotice();
      }, 0);
    }
    if (event === 'SIGNED_OUT') {
      renderDataNotice();
    }
  });
}

// ─── ONBOARDING ───────────────────────────────────────────────────────────────
// Two views: main (Full Gym / Bodyweight / Custom) and custom sub-options.
// Tapping any final tier card immediately saves and closes — no Continue button.

function openOnboarding() {
  showObView('main');
  document.getElementById('onboarding-modal').classList.add('open');
}

function showObView(view) {
  document
    .getElementById('ob-view-main')
    .classList.toggle('active', view === 'main');
  document
    .getElementById('ob-view-custom')
    .classList.toggle('active', view === 'custom');
  // Back button: visible only in custom sub-view
  document
    .getElementById('ob-back')
    .classList.toggle('hidden', view === 'main');
}

function closeOnboarding() {
  document.getElementById('onboarding-modal').classList.remove('open');
}

function pickTier(tierId) {
  saveProfile({
    equipmentTier: tierId || 'full-gym',
    setupComplete: true,
    setupDate: new Date().toISOString(),
  });
  closeOnboarding();
  renderHome();
}

// Main view: tap Full Gym or Bodyweight → immediate save; tap Custom → chip view
document.getElementById('ob-tiers-main').addEventListener('click', (e) => {
  const card = e.target.closest('[data-tier]');
  if (!card) return;
  const tier = card.dataset.tier;
  if (tier === 'custom') {
    obSelectedEquipment = new Set();
    renderEquipmentChips();
    showObView('custom');
  } else {
    pickTier(tier);
  }
});

// ─── CUSTOM EQUIPMENT CHECKLIST ──────────────────────────────────────────────
const EQUIPMENT_ITEMS = [
  { id: 'dumbbells', label: 'Dumbbells' },
  { id: 'barbell', label: 'Barbell' },
  { id: 'squat-rack', label: 'Squat / Power Rack' },
  { id: 'bench', label: 'Weight Bench' },
  { id: 'pull-up', label: 'Pull-up Bar' },
  { id: 'cables', label: 'Cable Machine' },
  { id: 'bands', label: 'Resistance Bands' },
  { id: 'kettlebell', label: 'Kettlebells' },
  { id: 'machines', label: 'Gym Machines' },
  { id: 'dip-bars', label: 'Dip Bars' },
  { id: 'rings', label: 'Gymnastic Rings' },
  { id: 'trx', label: 'TRX / Suspension' },
];

let obSelectedEquipment = new Set();

function renderEquipmentChips() {
  const grid = document.getElementById('ob-eq-grid');
  grid.innerHTML = EQUIPMENT_ITEMS.map(
    (item) => `
    <button class="ob-eq-chip${obSelectedEquipment.has(item.id) ? ' selected' : ''}" data-eq="${item.id}">
      ${item.label}
    </button>
  `,
  ).join('');
  grid.querySelectorAll('.ob-eq-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const id = chip.dataset.eq;
      if (obSelectedEquipment.has(id)) {
        obSelectedEquipment.delete(id);
        chip.classList.remove('selected');
      } else {
        obSelectedEquipment.add(id);
        chip.classList.add('selected');
      }
    });
  });
}

function equipmentToTier(selected) {
  const s = [...selected];
  if (s.includes('cables') || s.includes('machines')) return 'full-gym';
  if (s.includes('barbell') && s.includes('squat-rack')) return 'barbell-rack';
  if (
    s.includes('dumbbells') ||
    s.includes('barbell') ||
    s.includes('kettlebell')
  )
    return 'home-dumbbells';
  if (s.includes('bands')) return 'bands';
  return 'bodyweight';
}

document.getElementById('ob-eq-done').addEventListener('click', () => {
  pickTier(equipmentToTier(obSelectedEquipment));
});

// Back button: custom view → main
document.getElementById('ob-back').addEventListener('click', () => {
  showObView('main');
});

// Skip: close immediately, default to full-gym if not previously set
document.getElementById('ob-skip').addEventListener('click', () => {
  const profile = getProfile();
  const isFirstTime = !profile.setupComplete;
  if (isFirstTime) {
    saveProfile({
      equipmentTier: 'full-gym',
      injuries: [],
      setupComplete: true,
    });
    renderHome();
    closeOnboarding();
  } else {
    closeOnboarding();
  }
});

// ─── PROFILE SHEET ────────────────────────────────────────────────────────────

function renderProfilePane() {
  const profile = getProfile();

  // Name
  const nameInput = document.getElementById('prof-name-input');
  nameInput.value = get(NAME_KEY) || '';

  // Equipment grid
  const eqGrid = document.getElementById('prof-eq-grid');
  eqGrid.innerHTML = EQUIPMENT_TIERS.map(
    (t) => `
    <button class="prof-eq-btn${profile.equipmentTier === t.id ? ' active' : ''}" data-tier="${t.id}">
      <div>
        <div class="prof-eq-name">${t.label}</div>
        <div class="prof-eq-desc">${t.description}</div>
      </div>
      <span class="prof-eq-check">✓</span>
    </button>
  `,
  ).join('');
  eqGrid.querySelectorAll('.prof-eq-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      eqGrid.querySelectorAll('.prof-eq-btn').forEach((b) => {
        b.classList.remove('active');
      });
      btn.classList.add('active');
      saveProfile({ equipmentTier: btn.dataset.tier });
    });
  });

  // Unit toggle
  const toggle = document.getElementById('prof-unit-toggle');
  const kgLabel = document.getElementById('prof-unit-kg');
  const lbsLabel = document.getElementById('prof-unit-lbs');
  const updateUnitUI = () => {
    const lbs = isLbs();
    toggle.setAttribute('aria-checked', lbs ? 'true' : 'false');
    kgLabel.classList.toggle('active', !lbs);
    lbsLabel.classList.toggle('active', lbs);
  };
  updateUnitUI();
  toggle.onclick = () => {
    set(UNIT_KEY, isLbs() ? 'kg' : 'lbs');
    updateUnitUI();
    renderHome(); // every read surface re-renders in the new unit
    if (activeWorkout) renderSetLog(); // update active workout display if any
  };

  // Sync / auth section
  const syncSection = document.getElementById('prof-sync-section');
  if (currentUser) {
    // The login email is internal (synthetic) — only ever show the username.
    const displayId = (currentUser.email || '').split('@')[0];
    syncSection.innerHTML = `
      <div class="prof-label">ACCOUNT</div>
      <div class="prof-sync-row">
        <span class="prof-sync-label">Signed in as <strong>${displayId}</strong></span>
        <button class="prof-sync-btn danger" id="prof-signout-btn">Sign out</button>
      </div>
      <button class="prof-delete-link" id="prof-delete-btn">Delete account</button>
    `;
    document
      .getElementById('prof-signout-btn')
      .addEventListener('click', async () => {
        await signOut();
        renderProfilePane();
        renderDataNotice();
      });
    document
      .getElementById('prof-delete-btn')
      .addEventListener('click', openDeleteAccountConfirm);
  } else if (isConfigured) {
    syncSection.innerHTML = `
      <div class="prof-label">ACCOUNT</div>
      <div class="prof-sync-row">
        <span class="prof-sync-label">Data saved on this device only</span>
        <button class="prof-sync-btn" id="prof-signin-btn">Sign in →</button>
      </div>
    `;
    document.getElementById('prof-signin-btn').addEventListener('click', () => {
      const u = document.getElementById('np-signin-username');
      if (u && !u.value) u.value = get(NAME_KEY) || '';
      npShowStep('signin');
      document.getElementById('name-prompt').classList.add('open');
      setTimeout(
        () => document.getElementById('np-signin-username')?.focus(),
        120,
      );
    });
  } else {
    syncSection.innerHTML = '';
  }

}

// Name saves as you leave the field — there's no sheet to close anymore.
// ── Update to the latest build (iOS PWA caches linger) ─────────────────────
// Nuclear on purpose: fetch the new SW, drop every cache, unregister, reload.
// localStorage (all training data) is untouched.
{
  const stamp = document.getElementById('build-stamp');
  if (stamp)
    stamp.textContent = `Version ${import.meta.env.KILOS_BUILD || 'dev'} · ${import.meta.env.KILOS_COMMIT || '—'}`;
  document
    .getElementById('btn-check-update')
    ?.addEventListener('click', async () => {
      const btn = document.getElementById('btn-check-update');
      btn.textContent = 'Updating…';
      btn.disabled = true;
      try {
        // 1. Prove the network is reachable and pull a fresh shell FIRST —
        //    never wipe caches while offline (that bricks the app till signal).
        const probe = await fetch(`/?u=${Date.now()}`, { cache: 'reload' });
        if (!probe.ok) throw new Error(`status ${probe.status}`);
        // 2. Nothing stale survives: caches gone, workers gone.
        const regs =
          (await navigator.serviceWorker?.getRegistrations?.()) || [];
        if (window.caches) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
        for (const r of regs) {
          try {
            await r.unregister();
          } catch {}
        }
        // 3. Cache-busted navigation — a unique URL cannot be served from the
        //    HTTP cache, so this lands on the newest deploy in one tap.
        window.location.replace(`/?u=${Date.now()}`);
      } catch {
        btn.textContent = 'Offline — try again later';
        setTimeout(() => {
          btn.textContent = 'Check for update';
          btn.disabled = false;
        }, 2500);
      }
    });
}

document.getElementById('prof-name-input').addEventListener('change', () => {
  const val = document.getElementById('prof-name-input').value.trim();
  if (val) saveUserName(val);
});

// ── Account deletion (DPA right to erasure) ───────────────────────────────────
function openDeleteAccountConfirm() {
  const status = document.getElementById('delete-status');
  if (status) status.textContent = '';
  document.getElementById('delete-confirm').classList.add('open');
}
document
  .getElementById('btn-delete-no')
  ?.addEventListener('click', () =>
    document.getElementById('delete-confirm').classList.remove('open'),
  );
document
  .getElementById('btn-delete-yes')
  ?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-delete-yes');
    const status = document.getElementById('delete-status');
    btn.disabled = true;
    btn.textContent = 'Deleting…';
    const { error } = await deleteAccount();
    if (error) {
      if (status)
        status.textContent = error.message || 'Could not delete — try again.';
      btn.disabled = false;
      btn.textContent = 'Delete forever';
      return;
    }
    document.getElementById('delete-confirm').classList.remove('open');
    btn.disabled = false;
    btn.textContent = 'Delete forever';
    renderHome();
    renderDataNotice();
    renderProfileBtn();
  });

function renderProfileBtn() {
  // header button retired (settings live inline on the Athlete tab); the
  // name input there is the source of truth now
  const el = document.getElementById('prof-name-input');
  if (el && !el.value) el.value = get(NAME_KEY) || '';
}



// Profile button on home screen → open profile sheet


// ─── BETA WELCOME ─────────────────────────────────────────────────────────────
// Fires once on first ever visit, before name prompt + onboarding.
const BETA_SEEN_KEY = 'kilos-beta-seen';

// (The standalone beta-welcome gate was folded into the start sheet — the
// key stays so upgrading users don't see anything new.)

// ─── FEEDBACK ─────────────────────────────────────────────────────────────────
const fbOverlay = document.getElementById('feedback-sheet');
const fbTextarea = document.getElementById('fb-text');
const fbCount = document.getElementById('fb-count');
const fbStatus = document.getElementById('fb-status');
const fbSend = document.getElementById('fb-send');

function openFeedback(prefill = '') {
  fbTextarea.value = prefill;
  fbCount.textContent = String(prefill.length);
  fbStatus.textContent = '';
  fbStatus.className = 'fb-status';
  fbOverlay.classList.add('open');
  setTimeout(() => fbTextarea.focus(), 280);
}

document
  .getElementById('btn-open-feedback')
  .addEventListener('click', () => openFeedback());

document.getElementById('fb-close').addEventListener('click', () => {
  fbOverlay.classList.remove('open');
});

fbOverlay.addEventListener('click', (e) => {
  if (e.target === fbOverlay) fbOverlay.classList.remove('open');
});

fbTextarea.addEventListener('input', () => {
  fbCount.textContent = fbTextarea.value.length;
});

fbSend.addEventListener('click', async () => {
  const msg = fbTextarea.value.trim();
  if (!msg) return;

  fbSend.disabled = true;
  fbStatus.textContent = 'Sending…';
  fbStatus.className = 'fb-status';

  const formspreeId = import.meta.env.VITE_FORMSPREE_ID;
  let ok = false;

  if (formspreeId) {
    try {
      const res = await fetch(`https://formspree.io/f/${formspreeId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          name: getUserName() || 'Anonymous',
          message: msg,
          _subject: `KILOS Beta Feedback · ${new Date().toLocaleDateString()}`,
        }),
      });
      ok = res.ok;
    } catch {
      ok = false;
    }
  } else {
    // Not wired up yet — log locally so no silent failure during dev
    console.log('[Feedback]', msg);
    ok = true; // show success so UX isn't broken
  }

  fbSend.disabled = false;
  if (ok) {
    fbStatus.textContent = 'Sent. Thanks.';
    fbStatus.className = 'fb-status ok';
    fbTextarea.value = '';
    fbCount.textContent = '0';
    setTimeout(() => fbOverlay.classList.remove('open'), 1800);
  } else {
    fbStatus.textContent = 'Something went wrong — try again';
    fbStatus.className = 'fb-status err';
  }
});

// ─── COACHES NOTIFY ───────────────────────────────────────────────────────────
document.getElementById('btn-coaches-notify')?.addEventListener('click', () => {
  // Open email to coach intake address
  window.location.href =
    'mailto:gabe@kilostraining.app?subject=Coach%20Inquiry&body=Hi%20Gabe%2C%20I%27m%20interested%20in%20being%20featured%20on%20KILOS.';
});

// ─── INIT ─────────────────────────────────────────────────────────────────────
// Error monitoring first, so anything below is observable (no-op without a DSN).
initMonitoring();

// Global safety net: report uncaught errors. We do NOT take over the screen for
// these — a non-fatal error must never hide a working, mid-workout session.
window.addEventListener('error', (e) => reportError(e.error || e.message));
window.addEventListener('unhandledrejection', (e) => reportError(e.reason));

// A friendly, reassuring crash screen — shown ONLY if the app fails to boot.
// Because writes are localStorage-first, the user's last session is safe, so
// the message leads with that and offers a one-tap reload.
function showCrashScreen(err) {
  reportError(err, { phase: 'boot' });
  if (document.getElementById('kilos-crash')) return;
  const el = document.createElement('div');
  el.id = 'kilos-crash';
  el.setAttribute('role', 'alert');
  el.innerHTML = `
    <div class="kc-inner">
      <div class="kc-title">SOMETHING BROKE.</div>
      <p class="kc-body">Your last workout is saved on this device — nothing was
        lost. Reload to pick up where you left off.</p>
      <button class="kc-reload" id="kc-reload">Reload</button>
      <button class="kc-fresh" id="kc-fresh">Start fresh — your history is safe</button>
    </div>`;
  document.body.appendChild(el);
  document
    .getElementById('kc-reload')
    .addEventListener('click', () => window.location.reload());
  document.getElementById('kc-fresh').addEventListener('click', () => {
    try {
      localStorage.removeItem(ACTIVE_STATE_KEY);
      localStorage.removeItem(REHAB_STATE_KEY);
    } catch {}
    window.location.reload();
  });
}

// Restore in-progress workout from localStorage (task #1). Wrapped so a boot
// failure shows the recovery screen instead of a blank/half-rendered app.
try {
  if (loadActiveState()) {
    renderHome(); // update Resume button + streak
    renderActiveScreen(); // rebuild active workout UI
    restoreTimer(); // resume the rest/work countdown, fast-forwarded by elapsed time
  }
  renderHome();
  renderCoaches();
  renderProfileBtn();
  sessionStorage.removeItem('kilos-boot-retry'); // clean boot → arm the retry again
} catch (err) {
  // One shot at self-healing: quarantine the active-session snapshot (the
  // usual culprit after a schema change) and reload once. The crash screen
  // only shows when a CLEAN boot also fails.
  let retrying = false;
  try {
    if (!sessionStorage.getItem('kilos-boot-retry')) {
      sessionStorage.setItem('kilos-boot-retry', '1');
      const snap = localStorage.getItem(ACTIVE_STATE_KEY);
      if (snap != null) {
        localStorage.setItem(`${ACTIVE_STATE_KEY}-bak`, snap);
        localStorage.removeItem(ACTIVE_STATE_KEY);
      }
      retrying = true;
      window.location.reload();
    }
  } catch {}
  if (!retrying) showCrashScreen(err);
  throw err; // still surface it to monitoring / console
}

// Active placeholder → go home
document
  .getElementById('ap-go-home')
  ?.addEventListener('click', () => goScreen('home'));

// ─── FIRST-RUN FLOW ───────────────────────────────────────────────────────────
// New user:      Beta announcement → Name prompt → Equipment onboarding
// Returning user: all skipped (beta-seen + name already saved)
function runPostNameFlow() {
  const profile = getProfile();
  // Only open onboarding for true first-timers — not returning users who happened
  // to clear a single key or have a partial profile from an older app version.
  if (!profile.setupComplete && !profile.equipmentTier) openOnboarding();

  // ── Coach / preview workout launch ────────────────────────────────────────
  // Coach preview pages write a workout to this key before redirecting here.
  // We pick it up after the name/onboarding flow so the experience is clean.
  const pending = localStorage.getItem('kilos-launch-workout');
  if (pending) {
    localStorage.removeItem('kilos-launch-workout');
    try {
      const { name, cfData } = JSON.parse(pending);
      if (name && cfData) {
        // Small delay so any overlays have time to settle
        setTimeout(() => beginCFWorkout(name, cfData), 400);
      }
    } catch {
      /* malformed — ignore */
    }
  }
}

setTimeout(() => {
  // One gate, maximum: the beta letter folded into the start sheet's footer
  // note — Strong/Hevy let you log first, and so do we.
  if (!get(BETA_SEEN_KEY)) set(BETA_SEEN_KEY, true);
  requireName(runPostNameFlow);
}, 300);

// ─── OFFLINE SYNC RETRY ───────────────────────────────────────────────────────
// If a push failed while offline, retry silently when the network comes back.
// Also retry once on startup in case the last session ended offline.
async function retrySyncIfNeeded() {
  if (hasPendingSync()) {
    await pushData();
    renderDataNotice(); // refresh sync status label
  }
}

window.addEventListener('online', () => {
  retrySyncIfNeeded();
});

// Startup retry (async, non-blocking — runs after init)
setTimeout(retrySyncIfNeeded, 2000);

// ── iOS standalone paints the status-bar strip with theme-color ──────────────
// Keep it matched to the surface on screen, or Home wears a black slab over
// its cream hero. Watched, not wired: any surface toggling 'open'/'active'
// re-syncs automatically.
function syncThemeColor() {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) return;
  const CREAM = '#f0eeea';
  const DARK = '#0d0d0d';
  let color = DARK;
  if (
    document.getElementById('rehab-player')?.classList.contains('open') ||
    document.getElementById('workout-summary')?.classList.contains('open')
  ) {
    color = DARK;
  } else {
    const overlay = document.querySelector('.page-overlay.open');
    if (overlay) color = overlay.id === 'session-preview' ? CREAM : DARK;
    else
      color =
        document.querySelector('.screen.active')?.id === 'home' ? CREAM : DARK;
  }
  if (meta.getAttribute('content') !== color) {
    meta.setAttribute('content', color);
  }
}
// The tab bar belongs only to the five top-level tab screens. It's hidden for
// the active workout AND for any full-screen page/player: #screens owns its own
// stacking context (z-index:1) while the fixed nav sits at z-index:100, so a
// page-overlay opened over a tab screen would otherwise let the nav bleed across
// its bottom (PROGRAM, session preview, etc.). One rule, uniform everywhere.
function syncNavVisibility() {
  const nav = document.getElementById('nav');
  if (!nav) return;
  const onActive = document.querySelector('.screen.active')?.id === 'active';
  const overlayOpen =
    !!document.querySelector('.page-overlay.open') ||
    !!document.getElementById('rehab-player')?.classList.contains('open') ||
    !!document.getElementById('workout-summary')?.classList.contains('open');
  nav.classList.toggle('nav-hidden', onActive || overlayOpen);
}
function syncChrome() {
  syncThemeColor();
  syncNavVisibility();
}
{
  const tcObserver = new MutationObserver(syncChrome);
  for (const el of [
    document.getElementById('rehab-player'),
    document.getElementById('workout-summary'),
    ...document.querySelectorAll('.page-overlay'),
    ...document.querySelectorAll('.screen'),
  ]) {
    if (el) {
      tcObserver.observe(el, { attributes: true, attributeFilter: ['class'] });
    }
  }
  syncChrome();
}
