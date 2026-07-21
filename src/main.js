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
import { estimate1RM, suggestNextWeight } from './workout/progression.js';
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
let currentShareMode = 'dark';
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

// ─── AUDIO ────────────────────────────────────────────────────────────────────
let audioCtx;
function beep(freq, duration) {
  try {
    if (!audioCtx)
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
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
    `${exerciseName} — ${weight}kg × ${reps}`;
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
      totalWeightMoved,
      sessionSets,
      newPRsThisSession,
      cfRoundsCompleted,
      cfCurrentRound,
      duration: dur,
      streak: currentStreak(get('workoutHistory') || []),
    });
    currentShareMode = 'dark';
    currentShareBgImage = null;
    document.getElementById('share-bg-dark').classList.add('active');
    document.getElementById('share-bg-photo').classList.remove('active');
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
const SCREEN_ORDER = ['home', 'train', 'coaches', 'build', 'active'];

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
  const fab = document.getElementById('feedback-btn');
  if (fab) fab.style.display = id === 'active' ? 'none' : '';

  // 6. Render content
  if (id === 'home') {
    pickHomeGreeting(); // fresh greeting each time you land on Home
    renderHome();
  }
  if (id === 'train') renderTrain();
  if (id === 'coaches') renderCoaches(); // was 'legends'
  if (id === 'build') renderBuild();
  if (id === 'active') renderActiveScreen();
}
document.querySelectorAll('.nav-btn').forEach((btn) => {
  btn.addEventListener('click', () => goScreen(btn.dataset.screen));
});

// ─── TRAIN ────────────────────────────────────────────────────────────────────
// The movement launcher (Quick Start / Legends / CrossFit / Custom / Resume).
function renderTrain() {
  const sub = document.getElementById('resume-sub');
  if (sub) {
    sub.textContent = activeWorkout ? activeWorkout.name : 'No active session';
  }
  const resumeBtn = document.getElementById('btn-resume');
  if (resumeBtn) {
    resumeBtn.classList.toggle('resume-active', !!activeWorkout);
    resumeBtn.style.order = activeWorkout ? '-1' : '';
  }
}

// ─── HOME ─────────────────────────────────────────────────────────────────────
// Greeting under the wordmark — rotates each visit so Home feels alive, and
// quietly *rewards coming back*: it reads your streak / return / milestone from
// real history and folds it into the line. Tone is quiet-confidence — earned,
// never cheerleader-loud, and never guilt (loss-aversion points at your own
// past self, per the retention loop). See [[quiet-confidence-vibe]].
function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

function buildHomeGreetings(name) {
  const history = get('workoutHistory') || [];
  const total = history.length;

  // First-timer — no history to reward yet.
  if (total === 0) {
    return [
      `Let's log your first one, ${name}.`,
      `Welcome, ${name}. First session?`,
      `Ready to start, ${name}?`,
    ];
  }

  const streak = currentStreak(history);
  const best = Math.max(get('bestStreak') || 0, longestStreak(history));
  const last = new Date(history[history.length - 1].date);
  last.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysSince = Math.round((today - last) / 86400000);

  // Always-eligible "ready to train" lines (keep the variety).
  const generic = [
    `Ready to train, ${name}?`,
    `Let's get to work, ${name}.`,
    `Time to lift, ${name}.`,
    `Let's move, ${name}.`,
    `What's the session, ${name}?`,
    `Back at it, ${name}.`,
  ];

  // Data-aware reward lines — only the ones that make sense right now.
  const rewards = [];
  if (streak >= 2) {
    rewards.push(`Back for the ${ordinal(streak)} straight, ${name}?`);
    rewards.push(`Day ${streak} of the streak, ${name}.`);
    rewards.push(`${streak} in a row, ${name} — keep it.`);
  }
  if (streak > 0 && streak >= best && best >= 3) {
    rewards.push(`Best run yet, ${name}. ${streak} and counting.`);
  } else if (streak > 0 && best - streak >= 1 && best - streak <= 2) {
    rewards.push(`${best - streak} off your best, ${name}.`);
  }
  if (daysSince >= 4) {
    // Warm, not guilt — the door's open whenever they walk back in.
    rewards.push(`Good to have you back, ${name}.`);
    rewards.push(`Welcome back, ${name}. Let's ease in.`);
  }
  rewards.push(`Session ${total + 1}, ${name}.`);

  // Weight rewards a little heavier than plain generic so returns get noticed,
  // without making the line predictable.
  return [...rewards, ...rewards, ...generic];
}

let currentHomeGreeting = null;
let lastHomeGreeting = null;
// Pick a fresh line (avoiding an immediate repeat). Called on each navigation
// *into* Home — not on in-place re-renders, so it doesn't flicker mid-screen.
function pickHomeGreeting() {
  const pool = buildHomeGreetings(getUserName() || 'Athlete');
  let pick = pool[Math.floor(Math.random() * pool.length)];
  for (let i = 0; pick === lastHomeGreeting && pool.length > 1 && i < 6; i++) {
    pick = pool[Math.floor(Math.random() * pool.length)];
  }
  lastHomeGreeting = pick;
  currentHomeGreeting = pick;
}

function matchWordmarkWidth() {
  const trainingEl = document.querySelector('.hw-training');
  if (!trainingEl || trainingEl.dataset.split) return;
  trainingEl.dataset.split = '1';
  trainingEl.innerHTML = [...'TRAINING']
    .map((l) => `<span>${l}</span>`)
    .join('');
}

function renderHome() {
  renderWeekStrip();
  renderMuscleFrequency();
  renderRecent();
  renderHistory(); // PR board lives on Home now (the personal hub)
  updateStreak();
  renderRestDayCard();
  renderDataNotice();

  // Greeting under the wordmark (replaces the old equipment-tier + units tags;
  // units stay switchable mid-set on the logging screen). Rotated by
  // pickHomeGreeting() on each Home visit; pick one now on first load.
  if (!currentHomeGreeting) pickHomeGreeting();
  let greet = document.getElementById('home-greeting');
  if (!greet) {
    greet = document.createElement('div');
    greet.id = 'home-greeting';
    greet.className = 'home-greeting';
    const header = document.querySelector('.home-header');
    header.insertAdjacentElement('afterend', greet);
  }
  greet.textContent = currentHomeGreeting;

  matchWordmarkWidth();
}

function renderWeekStrip() {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = new Date().getDay();
  const history = get('workoutHistory') || [];
  const doneDays = new Set();
  history.forEach((h) => {
    const d = new Date(h.date);
    if (Date.now() - d.getTime() < 7 * 24 * 60 * 60 * 1000)
      doneDays.add(d.getDay());
  });
  document.getElementById('week-days').innerHTML = days
    .map(
      (day, i) => `
    <div class="day-cell ${i === today ? 'today' : ''} ${doneDays.has(i) ? 'done' : ''}">
      <div class="day-name">${day.slice(0, 2)}</div>
      <div class="day-dot"></div>
    </div>
  `,
    )
    .join('');
}

function updateStreak() {
  const history = get('workoutHistory') || [];
  const streak = currentStreak(history);
  // High-water mark: persist so a record survives history pruning and the
  // 90-day look-back cap once it's been earned.
  const best = Math.max(get('bestStreak') || 0, longestStreak(history));
  set('bestStreak', best);

  const chip = document.getElementById('streak-count');
  if (streak > 0) {
    chip.textContent =
      best > streak
        ? `${streak} day streak · best ${best}`
        : `${streak} day streak`;
  } else if (best > 0) {
    chip.textContent = `Best ${best} · go again`; // loss-aversion nudge
  } else {
    chip.textContent = '0 day streak';
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
  el.innerHTML = history
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
          ? h.totalWeight || h.sets || 0
          : h.type === 'cardio'
            ? h.duration || '0:00'
            : h.totalWeight || 0;
      const bigUnit = isCFh
        ? h.type === 'amrap'
          ? 'rounds'
          : 'done'
        : isRehab
          ? h.totalWeight
            ? 'kg volume'
            : 'holds'
          : h.type === 'cardio'
            ? 'duration'
            : 'kg volume';
      const meta = isCFh
        ? `${ds} · ${h.type.toUpperCase()} · ${h.duration || '—'}`
        : isRehab
          ? `${ds} · ${h.duration || '0:00'}`
          : h.type === 'cardio'
            ? `${ds} · ${h.distance || '—'} dist`
            : `${ds} · ${h.sets || 0} sets · ${h.duration || '0:00'}`;
      return `<div class="recent-card">
      <div class="rc-left">
        <div class="rc-name"><span class="rc-type">${typeTag}</span> ${h.name}</div>
        <div class="rc-meta">${meta}</div>
      </div>
      <div>
        <div class="rc-big">${bigNum}</div>
        <div class="rc-big-unit">${bigUnit}</div>
      </div>
    </div>`;
    })
    .join('');
}

// ─── PAGE OVERLAYS (Quick Start / Legends / CrossFit) ─────────────────────────
function openPage(id) {
  document.getElementById(id).classList.add('open');
}
function closePage(id) {
  document.getElementById(id).classList.remove('open');
}

// ── Quick Start page ──────────────────────────────────────────────────────────
const QS_MUSCLES = Object.keys(SHUFFLE_PLANS);

function getMuscleDaysAgo(muscle) {
  const history = get('workoutHistory') || [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i];
    if (h.type !== 'strength') continue;
    const hasMusc = (h.exercises || []).some((ex) => {
      const dbEx = EXERCISES_DB.find((e) => e.name === ex.name);
      return dbEx?.group?.toLowerCase() === muscle.toLowerCase();
    });
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
          <div class="lwc-meta">${w.badge} · ${w.description}</div>
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
  return map[exId] ?? GUIDED_DEFAULT_KG[exId] ?? 10;
}
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
  if (rhAnnounceActive()) return false;
  const now = Date.now();
  if (rhBufUntil - now > 120) {
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
let rhClipAudio = null;
function rhPlayClips(urls) {
  try {
    rhClipAudio?.pause();
  } catch {}
  rhStopBuf();
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
// Speak a cue from parts. Clip mode when every part is recorded; else TTS.
function rhCueSay(parts, ttsText) {
  if (!rhVoiceOn) return;
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
    beep(880, 0.1);
    setTimeout(() => beep(1175, 0.14), 120);
  } else if (kind === 'rest') {
    beep(392, 0.3);
  } else if (kind === 'switch') {
    beep(523, 0.12);
    setTimeout(() => beep(523, 0.12), 170);
  } else if (kind === 'rep') {
    beep(520, 0.05);
  } else if (kind === 'count') {
    // CrossFit-timer countdown: same uniform tick at 3, 2, 1 — the landing
    // sound (work double / rest low) is the "long beep".
    clickTick();
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
    rhCueSay(['get-set'], `Get set — ${ex.name}`);
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
    } else {
      rhCueSay(
        step.side ? [`${step.side.toLowerCase()}-side`, 'hold'] : ['hold'],
        step.side ? `${step.side.toLowerCase()} side — hold` : 'Hold',
      );
    }
  } else if (step.phase === 'SWITCH SIDES') {
    rhCueSay(['switch-sides'], 'Switch sides');
  } else if (step.phase === 'REST') {
    rhCueSay(['rest'], 'Rest');
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
  document.getElementById('rp-w-val').textContent = toDisplayWeight(rhWeightKg);
  document.querySelector('.rp-w-unit').textContent = weightUnit();
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
  document.getElementById('rpo-list').innerHTML = sessionOverview(rhSession)
    .map((row, bi2) => {
      const state =
        lastIdxByBi[bi2] < rhIdx ? 'done' : bi2 === currentBi ? 'current' : '';
      return `<div class="rpo-item ${state}" ${state === 'current' ? 'data-current' : ''}>
        <div class="rpo-item-title">${row.title}</div>
        <div class="rpo-item-detail">${row.detail}</div>
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
document.getElementById('rp-exname').addEventListener('click', rhOpenOverview);
document.getElementById('rpo-close').addEventListener('click', () => {
  document.getElementById('rp-overview').classList.remove('open');
});
document.getElementById('rp-overview').addEventListener('click', (e) => {
  if (e.target === document.getElementById('rp-overview')) {
    document.getElementById('rp-overview').classList.remove('open');
  }
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
  document.getElementById('rp-cue').textContent =
    step.kind === 'prep'
      ? `${ex.cue} — ${ex.why}`
      : [ex.cue, step.cueNote].filter(Boolean).join(' — ');
  document.getElementById('rp-phase').textContent = step.phase;

  // Countdown vs self-paced set (with or without a weight to log)
  document.getElementById('rp-clock').style.display = step.manual ? 'none' : '';
  document.getElementById('rp-lift').style.display = step.manual ? '' : 'none';
  if (step.manual) {
    const showWeight = step.logWeight !== false;
    document.querySelector('.rp-weight-row').style.display = showWeight
      ? ''
      : 'none';
    document.getElementById('rp-set-done').textContent = showWeight
      ? 'Set done →'
      : 'Done →';
    if (showWeight) {
      rhWeightKg = guidedWeightFor(step.exId);
      rhRenderWeight();
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
  rhQueue = buildStepQueue(session);
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
  ].forEach((slug) => {
    rhProbeClip(slug).then(() => {
      // decode the on-beat words up front (beat cues can't wait on a fetch)
      if (
        [
          'lift',
          'lower',
          'squeeze',
          'hold',
          'two',
          'three',
          'four',
          'five',
          'six',
          'seven',
          'eight',
          'nine',
          'ten',
        ].includes(slug)
      ) {
        rhDecodeClip(slug);
      }
    });
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
  renderHome();
  showWorkoutSummary(completed, durationStr, entry);
}

// ── Week plan — Mon…Sun with dates; fills in as things get done ──────────────
const WEEK_MARKS_KEY = 'kilos-week-marks';
const dateKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

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
        let label = '';
        let done = false;
        let action = '';
        if (item.type === 'rehab') {
          label = 'REHAB';
          done = entries.some((h) => h.rehabId === 'daily');
          action = isToday && !done ? 'session:daily' : '';
        } else if (item.type === 'hinge') {
          label = 'HINGE';
          done = entries.some((h) => h.rehabId === 'hinge');
          action = isToday && !done ? 'session:hinge' : '';
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
          }
          label = s2
            ? `LIFT ${s2.name.split('—')[0].trim().toUpperCase()}`
            : 'LIFT';
          action = isToday && !done && s2 ? `session:${s2.id}` : '';
        } else {
          label = item.type.toUpperCase();
          done = dayMarks.includes(item.type);
          action = isToday ? `mark:${item.type}` : '';
        }
        return `<button class="wp-chip${done ? ' done' : ''}${action ? ' ready' : ''}"
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
  el.innerHTML = rows.join('');

  el.querySelectorAll('.wp-chip[data-action]').forEach((chip) => {
    chip.addEventListener('click', () => {
      const [kind, id] = chip.dataset.action.split(':');
      if (kind === 'session') {
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

function renderCheckin() {
  const el = document.getElementById('checkin-card');
  if (!el) return;
  const list = get(CHECKINS_KEY) || [];
  const { state, latest, ref } = checkinStatus(list);
  const todayK = dateKey(new Date());
  const isSunday = new Date().getDay() === 0;
  const due = isSunday && latest?.date !== todayK;

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

// ── Sound check: audition the tempo schemes, pick by ear ─────────────────────
const TEMPO_SCHEMES = [
  {
    id: 'coach',
    name: 'Coach count',
    desc: 'Your voice counts each second over a click. Drive = da-DUM + "lift".',
  },
  {
    id: 'voice',
    name: 'Voice only',
    desc: 'Just your voice: "lower… two… three… lift". No clicks.',
  },
  {
    id: 'click',
    name: 'Metronome',
    desc: 'Pure clicks: one per second down, double-tick squeeze, da-DUM drive.',
  },
];

let rhDemoTimer = null;
function playTempoDemo(schemeId) {
  // one demo RDL rep: 3s down + drive — through the real cue engine
  const prev = getTempoScheme();
  set(TEMPO_SCHEME_KEY, schemeId);
  const mem = { key: null };
  const seq = [
    { rep: 1, label: 'DOWN', phaseSec: 0, phaseLen: 3 },
    { rep: 1, label: 'DOWN', phaseSec: 1, phaseLen: 3 },
    { rep: 1, label: 'DOWN', phaseSec: 2, phaseLen: 3 },
    { rep: 1, label: 'UP', phaseSec: 0, phaseLen: 1 },
  ];
  if (rhDemoTimer) clearInterval(rhDemoTimer);
  let i = 0;
  // make sure the on-beat words are decoded before the demo fires
  ['lower', 'two', 'three', 'lift'].forEach((slug) => {
    rhProbeClip(slug).then(() => rhDecodeClip(slug));
  });
  rhDemoTimer = setInterval(() => {
    if (i >= seq.length) {
      clearInterval(rhDemoTimer);
      rhDemoTimer = null;
      set(TEMPO_SCHEME_KEY, prev); // preview never changes the selection
      return;
    }
    rhTempoTick(seq[i], mem);
    i++;
  }, 1000);
}

function renderSoundCheck() {
  const el = document.getElementById('sound-check');
  if (!el) return;
  ['lower', 'two', 'three', 'lift', 'squeeze', 'hold'].forEach((slug) => {
    rhProbeClip(slug).then(() => rhDecodeClip(slug));
  });
  const active = getTempoScheme();
  el.innerHTML = TEMPO_SCHEMES.map(
    (sch) => `
    <div class="sc-row${sch.id === active ? ' active' : ''}" data-scheme="${sch.id}">
      <button class="sc-pick" data-pick="${sch.id}">
        <span class="sc-name">${sch.name}</span>
        <span class="sc-desc">${sch.desc}</span>
      </button>
      <button class="sc-play" data-demo="${sch.id}" aria-label="Preview ${sch.name}">▶</button>
    </div>`,
  ).join('');
  el.querySelectorAll('[data-demo]').forEach((btn) => {
    btn.addEventListener('click', () => playTempoDemo(btn.dataset.demo));
  });
  el.querySelectorAll('[data-pick]').forEach((btn) => {
    btn.addEventListener('click', () => {
      set(TEMPO_SCHEME_KEY, btn.dataset.pick);
      renderSoundCheck();
      playTempoDemo(btn.dataset.pick);
    });
  });
}

// ── Rehab page (program overview + resume) ────────────────────────────────────
function renderRehabPage() {
  renderWeekPlan();
  renderCheckin();
  renderSoundCheck();
  const saved = get(REHAB_STATE_KEY);
  const savedSession = saved ? getGuidedSession(saved.sessionId) : null;
  const resumeSlot = document.getElementById('rehab-resume-slot');
  if (savedSession) {
    const queueLen = buildStepQueue(savedSession).length;
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
      try {
        localStorage.removeItem(REHAB_STATE_KEY);
      } catch {}
      renderRehabPage();
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
document.getElementById('rp-skip').addEventListener('click', () => rhJump(1));
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
document.getElementById('rp-set-done').addEventListener('click', () => {
  const step = rhStep();
  if (!step?.manual) return;
  rhStopGuide(true);
  if (step.logWeight !== false) {
    const ex = GUIDED_EXERCISES[step.exId];
    rhLiftSets.push({
      exId: step.exId,
      name: ex?.name || step.exId,
      weight: rhWeightKg,
      reps: step.reps,
    });
    saveGuidedWeight(step.exId, rhWeightKg);
    if (step.exId === 'rdl') set(REHAB_RDL_KEY, rhWeightKg);
    // PRs are part of the lifting program's scoreboard (not the rehab's).
    if (
      isProgramSession(rhSession) &&
      checkAndUpdatePR(ex?.name || step.exId, rhWeightKg)
    ) {
      newPRsThisSession.push({
        name: ex?.name || step.exId,
        weight: rhWeightKg,
        reps: parseInt(step.reps, 10) || 0,
      });
      showPRToast(
        ex?.name || step.exId,
        rhWeightKg,
        parseInt(step.reps, 10) || 0,
      );
    }
  }
  rhCounted.add(rhIdx);
  navigator.vibrate?.(120);
  // Roll into the rest countdown without needing another tap.
  const wasLast = rhIdx + 1 >= rhQueue.length;
  rhJump(1); // announces the landing step
  if (!wasLast && !rhStep()?.manual) rhPlay();
});
document.getElementById('rp-w-minus').addEventListener('click', () => {
  rhWeightKg = Math.max(0, rhWeightKg - 2.5);
  rhRenderWeight();
});
document.getElementById('rp-w-plus').addEventListener('click', () => {
  rhWeightKg += 2.5;
  rhRenderWeight();
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
  } else if (rhSession && rhRunning) {
    rhAcquireWakeLock();
    rhTick(); // catch up instantly after a backgrounded stretch
  }
});

// ── Legal pages (Privacy / Terms) — opened from the profile sheet ─────────────
function openLegal(id) {
  document.getElementById('profile-sheet')?.classList.remove('open');
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

function renderMuscleFrequency() {
  const history = get('workoutHistory') || [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const freq = {};
  MUSCLES.forEach((m) => {
    freq[m] = null;
  });
  [...history].reverse().forEach((h) => {
    if (h.type !== 'strength') return;
    (h.exercises || []).forEach((ex) => {
      const dbEx = EXERCISES_DB.find((e) => e.name === ex.name);
      if (dbEx && freq[dbEx.group] === null) {
        const d = new Date(h.date);
        d.setHours(0, 0, 0, 0);
        freq[dbEx.group] = d;
      }
    });
  });

  let el = document.getElementById('muscle-freq');
  if (!el) {
    el = document.createElement('div');
    el.id = 'muscle-freq';
    el.className = 'muscle-freq-section';
    document.querySelector('.week-strip').insertAdjacentElement('afterend', el);
  }
  el.innerHTML = `
    <div class="section-label">Muscle status</div>
    <div class="mf-row">
      ${MUSCLES.map((m) => {
        const d = freq[m];
        let label = '—',
          cls = 'fresh';
        if (d) {
          const days = Math.round((today - d) / 864e5);
          label = days === 0 ? 'Today' : `${days}d`;
          cls = days === 0 ? 'hot' : days <= 3 ? 'warm' : 'fresh';
        }
        return `<div class="mf-cell ${cls}"><div class="mf-muscle">${m.slice(0, 3).toUpperCase()}</div><div class="mf-days">${label}</div></div>`;
      }).join('')}
    </div>`;
}

// ─── REST-DAY CARD ────────────────────────────────────────────────────────────
// Shows on home screen when no workout has been logged today.
// Surfaces: most-recovered muscle (best next session suggestion) + weekly volume.
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

  if (trainedToday || activeWorkout) {
    card.style.display = 'none';
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
      ? 'Never trained'
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
          <span class="rdc-stat-val">${Math.round(weekVolume).toLocaleString()}<span class="rdc-stat-unit"> kg</span></span>
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
document.getElementById('btn-resume').addEventListener('click', () => {
  if (activeWorkout) goScreen('active');
  else goScreen('build');
});

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
        ? `Last: ${last[0]?.weight || '—'}kg × ${last[0]?.reps || '—'}`
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
        <div class="esm-item-group">${e.group}${pr ? ` · PR: ${pr}kg` : ''}</div>
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
  npShowStep('account');
  document.getElementById('name-prompt').classList.add('open');
  setTimeout(() => document.getElementById('np-display-name').focus(), 320);
}

function closeNamePrompt() {
  document.getElementById('name-prompt').classList.remove('open');
  renderProfileBtn();
}

function npShowStep(step) {
  ['account', 'signin'].forEach((s) => {
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

  const { error } = await signUpWithPassword(displayName, username, password);
  btn.disabled = false;
  btn.textContent = 'Create account →';

  if (error) {
    const msg = error.message?.includes('already registered')
      ? 'Name taken — try a different one.'
      : error.message || 'Something went wrong.';
    npSetError('np-create-error', msg);
    return;
  }

  saveUserName(displayName);
  await pullAndMerge();
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

// Skip — save locally with just the name
document.getElementById('np-local-btn').addEventListener('click', () => {
  const name = document.getElementById('np-display-name').value.trim();
  saveUserName(name || 'Athlete');
  closeNamePrompt();
  if (_npCallback) {
    const cb = _npCallback;
    _npCallback = null;
    cb();
  }
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

  const { data, error } = await signInWithPassword(username, password);
  btn.disabled = false;
  btn.textContent = 'Sign in →';

  if (error) {
    npSetError('np-signin-error', 'Wrong name or password.');
    return;
  }

  const displayName = data?.user?.user_metadata?.display_name || nameInput;
  saveUserName(displayName);
  await pullAndMerge();
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
function beginWorkout(name, type, exercises) {
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
            { w: `${Math.round((topW * 0.4) / 2.5) * 2.5}kg`, r: 10 },
            { w: `${Math.round((topW * 0.6) / 2.5) * 2.5}kg`, r: 5 },
            { w: `${Math.round((topW * 0.8) / 2.5) * 2.5}kg`, r: 2 },
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
  const lastAllMet =
    lastLogs.length > 0 &&
    lastLogs.every(
      (l) => !l.reps || parseInt(l.reps, 10) >= (parseInt(ex.reps, 10) || 8),
    );
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
            ? `<span class="log-e1rm">e1RM ${e1rmDisp}${unit}</span>`
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
        beep(660, 0.15);
        setTimerText('DONE', 'TIME UP');
        const el = document.getElementById('ring-time');
        el.classList.remove('tick');
        el.classList.add('go-text');
        setTimerStyle('work');
        setTimerBar(0, false);
        return;
      }

      // Standard rest/work
      beep(660, 0.15);
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
  const entry = {
    name: completed.name,
    type: completed.type || 'strength',
    date: new Date().toISOString(),
    duration: durationStr,
    totalWeight: Math.round(totalWeightMoved),
    sets: sessionSets,
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
  history.push(entry);
  set('workoutHistory', history);

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
  const isCF = CF_TYPES.has(workout.type);
  const isCardio = workout.type === 'cardio';

  // Header
  document.getElementById('wsum-name').textContent = workout.name.toUpperCase();

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
    const vol = Math.round(totalWeightMoved);
    if (vol > 0) {
      statsEl.innerHTML = `
        <div class="wsum-hero">
          <div class="wsum-hero-val" data-count="${vol}">0</div>
          <div class="wsum-hero-unit">KG · Total Volume</div>
        </div>
        <div class="wsum-substats">
          <div class="wsum-stat"><div class="ws-val" data-count="${sessionSets}">0</div><div class="ws-lbl">Sets Done</div></div>
          <div class="wsum-stat"><div class="ws-val">${duration}</div><div class="ws-lbl">Duration</div></div>
        </div>
      `;
    } else {
      // Bodyweight / no load logged — lead with sets instead of an empty "0 kg".
      statsEl.innerHTML = `
        <div class="wsum-hero">
          <div class="wsum-hero-val" data-count="${sessionSets}">0</div>
          <div class="wsum-hero-unit">Sets Completed</div>
        </div>
        <div class="wsum-substats">
          <div class="wsum-stat"><div class="ws-val">${duration}</div><div class="ws-lbl">Duration</div></div>
          <div class="wsum-stat"><div class="ws-val">${(workout.exercises || []).length}</div><div class="ws-lbl">Exercises</div></div>
        </div>
      `;
    }
  }

  // Top lift of the session
  const topLiftEl = document.getElementById('wsum-top-lift');
  const topPR = newPRsThisSession.length
    ? newPRsThisSession.reduce(
        (best, pr) => (!best || pr.weight > best.weight ? pr : best),
        null,
      )
    : null;
  if (topPR) {
    const e1 = estimate1RM(topPR.weight, topPR.reps);
    topLiftEl.innerHTML = `<div class="wsum-top-lift-label">Top Lift</div>
      <div class="wsum-top-lift-val">${topPR.weight}<span class="wsum-top-lift-unit">kg × ${topPR.reps}</span></div>
      <div class="wsum-top-lift-ex">${topPR.name.toUpperCase()}</div>
      ${e1 != null ? `<div class="wsum-top-lift-e1rm">≈ ${e1}kg est. 1RM</div>` : ''}`;
    topLiftEl.style.display = '';
  } else if (!isCF && !isCardio) {
    // Best set by volume if no PR
    let bestSet = null;
    (workout.exercises || []).forEach((e) => {
      (e.logs || [])
        .filter((l) => l.done)
        .forEach((l) => {
          const vol = (parseFloat(l.weight) || 0) * (parseInt(l.reps, 10) || 0);
          if (!bestSet || vol > bestSet.vol)
            bestSet = { name: e.name, weight: l.weight, reps: l.reps, vol };
        });
    });
    if (bestSet?.weight) {
      const e1 = estimate1RM(bestSet.weight, bestSet.reps);
      topLiftEl.innerHTML = `<div class="wsum-top-lift-label">Best Set</div>
        <div class="wsum-top-lift-val">${bestSet.weight}<span class="wsum-top-lift-unit">kg × ${bestSet.reps}</span></div>
        <div class="wsum-top-lift-ex">${bestSet.name.toUpperCase()}</div>
        ${e1 != null ? `<div class="wsum-top-lift-e1rm">≈ ${e1}kg est. 1RM</div>` : ''}`;
      topLiftEl.style.display = '';
    } else {
      topLiftEl.style.display = 'none';
    }
  } else {
    topLiftEl.style.display = 'none';
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
  goScreen('home'); // history + PRs live on Home now
});
document.getElementById('wsum-close').addEventListener('click', () => {
  document.getElementById('workout-summary').classList.remove('open');
});

function showShareCard(workout, duration, _entry) {
  // Build the data model for the canvas renderer
  currentShareData = buildShareData({
    workout,
    totalWeightMoved,
    sessionSets,
    newPRsThisSession,
    cfRoundsCompleted,
    cfCurrentRound,
    duration,
    streak: currentStreak(get('workoutHistory') || []),
  });
  currentShareMode = 'dark';
  currentShareBgImage = null;

  // Reset UI state
  document.getElementById('share-bg-dark').classList.add('active');
  document.getElementById('share-bg-photo').classList.remove('active');
  document.getElementById('share-bg-file').value = '';

  document.getElementById('share-modal').classList.add('open');

  // Render immediately
  _renderShareCanvas();
}

async function _renderShareCanvas() {
  const canvas = document.getElementById('share-canvas');
  if (!canvas || !currentShareData) return;
  await renderShareCard(
    canvas,
    currentShareData,
    currentShareMode,
    currentShareBgImage,
  );
}

document.getElementById('share-bg-dark').addEventListener('click', () => {
  currentShareMode = 'dark';
  currentShareBgImage = null;
  document.getElementById('share-bg-dark').classList.add('active');
  document.getElementById('share-bg-photo').classList.remove('active');
  _renderShareCanvas();
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
    currentShareMode = 'photo';
    document.getElementById('share-bg-photo').classList.add('active');
    document.getElementById('share-bg-dark').classList.remove('active');
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
          <div class="pr-val">${val}kg</div>
          <div class="pr-label">${name.split(' ').slice(-1)[0]}</div>
        </div>`,
        )
        .join('')}
      <div class="pr-card pr-card-add" id="btn-add-prs">
        <div class="pr-val pr-add-icon">+</div>
        <div class="pr-label">Add</div>
      </div>`;
    document.getElementById('btn-add-prs').addEventListener('click', openPRLog);
  }

  // PR board (above) lives on Home; the full session list was retired with the
  // standalone History screen. Bail once the PR board is populated.
  const listEl = document.getElementById('history-list');
  if (!listEl) return;
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
      const typeTag = isCF
        ? CF_TYPE_TAGS[h.type] || 'CF'
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
        : h.type === 'cardio'
          ? h.duration || '0:00'
          : h.totalWeight || 0;
      const bigUnit = isCF
        ? h.type === 'amrap'
          ? 'rounds'
          : h.type === 'fortime'
            ? 'done'
            : 'rounds'
        : h.type === 'cardio'
          ? 'duration'
          : 'kg vol';
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
                  ? `${best.weight}kg × ${best.reps || '?'}`
                  : `${ex.sets}×`;
                return `<div class="hi-ex-row"><span>${ex.name}</span><span>${stat}</span></div>`;
              })
              .join('')}</div>`
          : '';

      return `<div class="history-item${isExpanded ? ' expanded' : ''}" data-ridx="${realIdx}">
      <div class="hi-main">
        <div class="hi-left">
          <div class="hi-name"><span class="rc-type">${typeTag}</span> ${h.name}</div>
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
    // Signed in — show username + sync status + sign-out
    const rawEmail = currentUser.email || '';
    const displayId = rawEmail.endsWith('@kilostraining.app')
      ? rawEmail.replace('@kilostraining.app', '')
      : rawEmail;
    const pending = hasPendingSync();
    const syncLabel = pending
      ? `<span class="dn-sync-pending">⟳ Sync pending</span>`
      : `Synced · ${displayId}`;
    notice.innerHTML = `
      <div class="dn-top">
        <span class="dn-label">${syncLabel}</span>
        <div class="dn-btns">
          <button class="dn-btn dn-signout" id="btn-signout">Sign out</button>
        </div>
      </div>
      <div class="dn-sub">${pending ? 'Will sync when connection restores' : 'Your data is backed up automatically'}</div>
    `;
    document
      .getElementById('btn-signout')
      .addEventListener('click', async () => {
        await signOut();
        renderDataNotice();
      });
  } else {
    // Signed out — just show the sync CTA (no confusing export/import buttons)
    notice.innerHTML = `
      <div class="dn-top">
        <span class="dn-label">This device only</span>
      </div>
      ${
        isConfigured
          ? `<div class="dn-signin-row">
             <button class="dn-signin-btn" id="btn-dn-signin">Sign in to sync →</button>
           </div>
           <div class="dn-sub">Your data, on every device.</div>`
          : `<div class="dn-sub">Create an account to keep your data across devices.</div>`
      }
    `;
    document.getElementById('btn-dn-signin')?.addEventListener('click', () => {
      // Open name prompt directly at sign-in step
      npShowStep('signin');
      document.getElementById('name-prompt').classList.add('open');
      setTimeout(
        () => document.getElementById('np-signin-username')?.focus(),
        120,
      );
    });
  }
}

// Listen for auth state changes (sign-in redirect returns here)
if (supabase) {
  supabase.auth.onAuthStateChange(async (event) => {
    if (event === 'SIGNED_IN') {
      await pullAndMerge();
      // Returning user — skip onboarding regardless of what pullAndMerge restored
      saveProfile({
        setupComplete: true,
        equipmentTier: getProfile().equipmentTier || 'full-gym',
      });
      renderHome();
      renderHistory();
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

function openProfileSheet() {
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
        closeProfileSheet();
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
      closeProfileSheet();
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

  document.getElementById('profile-sheet').classList.add('open');
  setTimeout(() => nameInput.focus(), 200);
}

function closeProfileSheet() {
  // Save name on close
  const val = document.getElementById('prof-name-input').value.trim();
  if (val) saveUserName(val);
  document.getElementById('profile-sheet').classList.remove('open');
  // Refresh name in profile button
  renderProfileBtn();
}

// ── Account deletion (DPA right to erasure) ───────────────────────────────────
function openDeleteAccountConfirm() {
  document.getElementById('profile-sheet').classList.remove('open');
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
  const name = get(NAME_KEY) || '';
  const el = document.getElementById('profile-btn-name');
  if (el) el.textContent = name;
}

document
  .getElementById('btn-close-profile')
  .addEventListener('click', closeProfileSheet);
document.getElementById('profile-sheet').addEventListener('click', (e) => {
  if (e.target === document.getElementById('profile-sheet'))
    closeProfileSheet();
});

// Profile button on home screen → open profile sheet
document
  .getElementById('btn-profile')
  .addEventListener('click', openProfileSheet);

// ─── BETA WELCOME ─────────────────────────────────────────────────────────────
// Fires once on first ever visit, before name prompt + onboarding.
const BETA_SEEN_KEY = 'kilos-beta-seen';

let _bwCallback = null;

function showBetaWelcome(callback) {
  _bwCallback = callback || null;
  document.getElementById('beta-welcome').classList.add('open');
}

document.getElementById('bw-cta').addEventListener('click', () => {
  set(BETA_SEEN_KEY, '1');
  document.getElementById('beta-welcome').classList.remove('open');
  if (_bwCallback) {
    const cb = _bwCallback;
    _bwCallback = null;
    cb();
  }
});

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
  .getElementById('feedback-btn')
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
    </div>`;
  document.body.appendChild(el);
  document
    .getElementById('kc-reload')
    .addEventListener('click', () => window.location.reload());
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
} catch (err) {
  showCrashScreen(err);
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
  if (!get(BETA_SEEN_KEY)) {
    // Brand new visitor — show beta welcome first, then chain into name + onboarding
    showBetaWelcome(() => {
      requireName(runPostNameFlow);
    });
  } else {
    // Returning user — skip beta welcome, show name prompt if somehow missing
    requireName(runPostNameFlow);
  }
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
