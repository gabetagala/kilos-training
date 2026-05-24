import { EXERCISES_DB, COACHES_DATA, LEGENDS_DATA, FAMOUS_WODS, SHUFFLE_PLANS, MUSCLES, MUSCLES_ALL } from './data.js';
import {
  EQUIPMENT_TIERS,
  getProfile, saveProfile, getActiveProfile, resolveExercise,
} from './personalization.js';
import {
  supabase, isConfigured,
  getSession, signInWithGoogle, signOut,
  signUpWithPassword, signInWithPassword,
  pushData, pullAndMerge, hasPendingSync,
} from './supabase.js';
import { renderShareCard, buildShareData } from './shareCard.js';

// ─── STORAGE ──────────────────────────────────────────────────────────────────
const get = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
const set = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

// ─── PERSISTENCE KEYS ────────────────────────────────────────────────────────
const ACTIVE_STATE_KEY = 'kilos-active-state';

function saveActiveState() {
  if (!activeWorkout) { try { localStorage.removeItem(ACTIVE_STATE_KEY); } catch {} return; }
  set(ACTIVE_STATE_KEY, {
    activeWorkout, currentExIdx, currentSetIdx,
    workoutStartTime, totalWeightMoved, sessionSets,
    cfCurrentRound, cfRoundsCompleted, cfRoundLog,
    cfMovementsDone: [...cfMovementsDone],
  });
}

function loadActiveState() {
  const s = get(ACTIVE_STATE_KEY);
  if (!s || !s.activeWorkout) return false;
  activeWorkout      = s.activeWorkout;
  currentExIdx       = s.currentExIdx || 0;
  currentSetIdx      = s.currentSetIdx || 0;
  workoutStartTime   = s.workoutStartTime || Date.now();
  totalWeightMoved   = s.totalWeightMoved || 0;
  sessionSets        = s.sessionSets || 0;
  cfCurrentRound     = s.cfCurrentRound || 0;
  cfRoundsCompleted  = s.cfRoundsCompleted || 0;
  cfRoundLog         = s.cfRoundLog || [];
  cfMovementsDone    = new Set(s.cfMovementsDone || []);
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
let cfFormat = 'emom';  // 'emom' | 'amrap' | 'rounds' | 'fortime'
let cfMovements = [];   // [{name, reps}]

// ── CrossFit active state ─────────────────────────────────────────────────────
let cfCurrentRound  = 0;
let cfRoundsCompleted = 0;
let cfMovementsDone = new Set(); // indices complete in current round
let cfRoundLog      = [];        // [bool] one per EMOM round

// ─── UNIT SYSTEM ─────────────────────────────────────────────────────────────
const UNIT_KEY = 'kilos-unit';
function getUnit() { return get(UNIT_KEY) || 'kg'; }
function isLbs() { return getUnit() === 'lbs'; }
function toDisplayWeight(kg) {
  if (!isLbs()) return kg;
  return kg ? Math.round(parseFloat(kg) * 2.2046 * 4) / 4 : kg; // round to nearest 0.25 lbs
}
function fromDisplayWeight(val) {
  if (!isLbs()) return val;
  return val ? Math.round(parseFloat(val) / 2.2046 * 10) / 10 : val;
}
function weightUnit() { return isLbs() ? 'lbs' : 'kg'; }

// ─── AUDIO ────────────────────────────────────────────────────────────────────
let audioCtx;
function beep(freq, duration) {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.start(); osc.stop(audioCtx.currentTime + duration);
  } catch {}
}
['touchstart', 'click'].forEach(e => {
  document.addEventListener(e, () => {
    if (!audioCtx) try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch {}
  }, { once: true });
});

// ─── PR HELPERS ───────────────────────────────────────────────────────────────
function getPRMap() { return get('prMap') || {}; }

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

function showPRToast(exerciseName, weight, reps, type = 'weight') {
  const toast = document.getElementById('pr-toast');
  toast.querySelector('.pr-toast-icon').textContent = type === 'volume' ? 'VOL' : 'PR';
  toast.querySelector('.pr-toast-label').textContent = type === 'volume' ? 'VOLUME RECORD' : 'NEW PERSONAL RECORD';
  toast.querySelector('.pr-toast-text').textContent = `${exerciseName} — ${weight}kg × ${reps}`;
  toast.classList.add('show');
  if (navigator.vibrate) navigator.vibrate([50, 30, 100]);
  beep(660, 0.15);
  setTimeout(() => beep(880, 0.15), 160);
  setTimeout(() => { toast.classList.remove('show'); }, 2800);

  // PR Celebration flash — bigger moment for weight PRs
  if (type === 'weight') showPRCelebration(exerciseName, weight, reps);
}

let _prCelebrateTimer = null;
function showPRCelebration(exerciseName, weight, reps) {
  const overlay = document.getElementById('pr-celebrate');
  document.getElementById('prc-weight').textContent = weight;
  document.getElementById('prc-unit').textContent = `${weightUnit()} × ${reps}`;
  document.getElementById('prc-ex').textContent = exerciseName.toUpperCase();
  overlay.classList.add('open');
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
    currentShareData = buildShareData({ workout: activeWorkout, totalWeightMoved, sessionSets, newPRsThisSession, cfRoundsCompleted, cfCurrentRound, duration: dur });
    currentShareMode = 'dark'; currentShareBgImage = null;
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
  if (!raw || raw <= 0) { res.innerHTML = ''; return; }
  const kg = isLbs() ? raw / 2.205 : raw;
  const { perSide, remainder } = calcPlates(Math.round(kg * 2) / 2);
  const barLine = `<div class="pc-row"><span class="pc-label">Bar</span><span class="pc-val">20 kg</span></div>`;
  const plateLine = perSide.length
    ? perSide.map(p => `<div class="pc-row"><span class="pc-label">Each side</span><span class="pc-val">${p} kg</span></div>`).join('')
    : '';
  const totalLine = `<div class="pc-row pc-total"><span class="pc-label">Total</span><span class="pc-val">${Math.round(kg * 2) / 2} kg${isLbs() ? ` (${raw} lbs)` : ''}</span></div>`;
  const warnLine = remainder > 0.1 ? `<div class="pc-warn">Can't make exact weight — nearest: ${Math.round((Math.round(kg*2)/2)*100)/100} kg</div>` : '';
  res.innerHTML = barLine + plateLine + totalLine + warnLine;
}

document.getElementById('btn-plate-calc').addEventListener('click', () => {
  document.getElementById('plate-input').value = '';
  document.getElementById('plate-result').innerHTML = '';
  document.getElementById('plate-unit-label').textContent = weightUnit();
  document.getElementById('plate-modal').classList.add('open');
  setTimeout(() => document.getElementById('plate-input').focus(), 120);
});
document.getElementById('plate-input').addEventListener('input', renderPlateCalc);
document.getElementById('btn-close-plate').addEventListener('click', () => {
  document.getElementById('plate-modal').classList.remove('open');
});

// Suggest the next working weight based on the previous session.
// If the lifter hit all target reps last time → add 2.5 kg.
// If they fell short on any set → same weight, keep working.
function suggestNextWeight(lastLogs, targetRepsStr) {
  if (!lastLogs?.length) return null;
  const weights = lastLogs.map(l => parseFloat(l.weight)).filter(w => w > 0);
  if (!weights.length) return null;
  const topW = Math.max(...weights);
  const target = parseInt(targetRepsStr) || 8;
  const allMet = lastLogs.every(l => !l.reps || parseInt(l.reps) >= target);
  return allMet ? Math.round((topW + 2.5) * 2) / 2 : topW;
}

// ─── PREVIOUS SESSION RECALL ──────────────────────────────────────────────────
function getLastSession(exerciseName) {
  const history = get('workoutHistory') || [];
  for (let i = history.length - 1; i >= 0; i--) {
    const ex = history[i].exercises?.find(e => e.name === exerciseName);
    if (ex?.logs?.length) return ex.logs;
  }
  return null;
}

// ─── NAVIGATION ───────────────────────────────────────────────────────────────
const SCREEN_ORDER = ['home', 'coaches', 'build', 'history', 'active'];

function goScreen(id) {
  const currentEl = document.querySelector('.screen.active');
  const nextEl    = document.getElementById(id);
  if (!nextEl || currentEl?.id === id) return;

  const ci = SCREEN_ORDER.indexOf(currentEl?.id ?? '');
  const ni = SCREEN_ORDER.indexOf(id);
  const forward = ni >= ci; // higher tab index = slide right in, old slides left out

  // 1. Stage the entering screen off-screen (no transition yet — just position)
  nextEl.classList.remove('s-enter-right', 's-enter-left', 's-exit-left', 's-exit-right');
  nextEl.classList.add(forward ? 's-enter-right' : 's-enter-left');

  // 2. Force a paint so the browser registers the starting position
  void nextEl.offsetWidth;

  // 3. Exit current screen
  if (currentEl) {
    currentEl.classList.remove('active');
    currentEl.classList.add(forward ? 's-exit-left' : 's-exit-right');
    // Clean up exit class after transition completes
    currentEl.addEventListener('transitionend', () => {
      currentEl.classList.remove('s-exit-left', 's-exit-right');
    }, { once: true });
  }

  // 4. Activate next screen — CSS transitions fire from staged position → translateX(0)
  nextEl.classList.remove('s-enter-right', 's-enter-left');
  nextEl.classList.add('active');

  // 5. Update nav indicator
  document.querySelectorAll('.nav-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.screen === id)
  );

  // 6. Render content
  if (id === 'home')    renderHome();
  if (id === 'coaches') renderCoaches();  // was 'legends'
  if (id === 'build')   renderBuild();
  if (id === 'history') renderHistory();
  if (id === 'active')  renderActiveScreen();
}
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => goScreen(btn.dataset.screen));
});

// ─── HOME ─────────────────────────────────────────────────────────────────────
function matchWordmarkWidth() {
  const trainingEl = document.querySelector('.hw-training');
  if (!trainingEl || trainingEl.dataset.split) return;
  trainingEl.dataset.split = '1';
  trainingEl.innerHTML = [...'TRAINING'].map(l => `<span>${l}</span>`).join('');
}

function renderHome() {
  renderWeekStrip();
  renderMuscleFrequency();
  renderRecent();
  updateStreak();
  renderRestDayCard();
  renderDataNotice();
  const resumeBtn = document.getElementById('btn-resume');
  document.getElementById('resume-sub').textContent = activeWorkout ? activeWorkout.name : 'No active session';
  if (resumeBtn) {
    resumeBtn.classList.toggle('resume-active', !!activeWorkout);
    resumeBtn.style.order = activeWorkout ? '-1' : '';
  }

  // Profile indicator
  const profile = getActiveProfile();
  const tier = EQUIPMENT_TIERS.find(t => t.id === profile.equipmentTier);
  const tierLabel = tier ? tier.label : 'Full Gym';
  let tag = document.getElementById('profile-tag');
  if (!tag) {
    tag = document.createElement('div');
    tag.id = 'profile-tag';
    tag.className = 'profile-tag';
    const header = document.querySelector('.home-header');
    header.insertAdjacentElement('afterend', tag);
  }
  tag.textContent = tierLabel;

  // Unit toggle (kg ↔ lbs) — injected next to profile tag
  let unitBtn = document.getElementById('unit-toggle-btn');
  if (!unitBtn) {
    unitBtn = document.createElement('button');
    unitBtn.id = 'unit-toggle-btn';
    unitBtn.className = 'unit-toggle-btn';
    tag.insertAdjacentElement('afterend', unitBtn);
    unitBtn.addEventListener('click', () => {
      set(UNIT_KEY, isLbs() ? 'kg' : 'lbs');
      renderHome();
      if (activeWorkout) renderSetLog();
    });
  }
  unitBtn.textContent = isLbs() ? 'kg' : 'lbs';
  unitBtn.title = `Switch to ${isLbs() ? 'kg' : 'lbs'}`;

  matchWordmarkWidth();
}

function renderWeekStrip() {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = new Date().getDay();
  const history = get('workoutHistory') || [];
  const doneDays = new Set();
  history.forEach(h => {
    const d = new Date(h.date);
    if ((Date.now() - d.getTime()) < 7 * 24 * 60 * 60 * 1000) doneDays.add(d.getDay());
  });
  document.getElementById('week-days').innerHTML = days.map((day, i) => `
    <div class="day-cell ${i === today ? 'today' : ''} ${doneDays.has(i) ? 'done' : ''}">
      <div class="day-name">${day.slice(0, 2)}</div>
      <div class="day-dot"></div>
    </div>
  `).join('');
}

function updateStreak() {
  const history = get('workoutHistory') || [];
  let streak = 0;
  let restDayUsed = false; // one grace miss allowed per week
  const today = new Date(); today.setHours(0, 0, 0, 0);
  for (let i = 0; i < 90; i++) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    const found = history.find(h => {
      const hd = new Date(h.date); hd.setHours(0, 0, 0, 0);
      return hd.getTime() === d.getTime();
    });
    if (found) {
      streak++;
      // Reset grace once per 7 calendar days of actual training
      if (streak % 7 === 0) restDayUsed = false;
    } else if (i > 0) {
      // Allow one grace miss before breaking the streak
      if (!restDayUsed) {
        restDayUsed = true;
        // Still count it as a "rest day saved" — don't increment streak, just skip
        continue;
      }
      break;
    }
  }
  const chip = document.getElementById('streak-count');
  chip.textContent = `${streak} day streak`;
  chip.className = `streak-chip${streak >= 7 ? ' hot' : streak >= 3 ? ' warm' : ''}`;
}

function renderRecent() {
  const history = get('workoutHistory') || [];
  const el = document.getElementById('recent-list');
  if (!history.length) {
    el.innerHTML = '<div class="empty-state">No sessions yet — pick a program or build your own.</div>';
    return;
  }
  el.innerHTML = history.slice(-5).reverse().map(h => {
    const ds = new Date(h.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const isCFh = CF_TYPES.has(h.type);
    const typeTag = isCFh ? h.type.toUpperCase().slice(0, 3) : h.type === 'cardio' ? 'CDO' : 'STR';
    const bigNum = isCFh ? (h.cfRoundsCompleted != null ? h.cfRoundsCompleted : h.duration || '—')
                         : h.type === 'cardio' ? (h.duration || '0:00') : (h.totalWeight || 0);
    const bigUnit = isCFh ? (h.type === 'amrap' ? 'rounds' : 'done')
                          : h.type === 'cardio' ? 'duration' : 'kg volume';
    const meta = isCFh
      ? `${ds} · ${h.type.toUpperCase()} · ${h.duration || '—'}`
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
  }).join('');
}

// ─── PAGE OVERLAYS (Quick Start / Legends / CrossFit) ─────────────────────────
function openPage(id) { document.getElementById(id).classList.add('open'); }
function closePage(id) { document.getElementById(id).classList.remove('open'); }

// ── Quick Start page ──────────────────────────────────────────────────────────
const QS_MUSCLES = Object.keys(SHUFFLE_PLANS);

function getMuscleDaysAgo(muscle) {
  const history = get('workoutHistory') || [];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i];
    if (h.type !== 'strength') continue;
    const hasMusc = (h.exercises || []).some(ex => {
      const dbEx = EXERCISES_DB.find(e => e.name === ex.name);
      return dbEx?.group?.toLowerCase() === muscle.toLowerCase();
    });
    if (hasMusc) {
      const d = new Date(h.date); d.setHours(0, 0, 0, 0);
      return Math.round((today - d) / 864e5);
    }
  }
  return null;
}

function renderQSPage() {
  const el = document.getElementById('qs-page-chips');
  el.innerHTML = QS_MUSCLES.map(m => {
    const days = getMuscleDaysAgo(m);
    let badge = '', cls = '';
    if (days === null) { cls = 'qs-fresh'; badge = '<span class="qs-chip-badge">fresh</span>'; }
    else if (days === 0) { cls = 'qs-hot'; badge = '<span class="qs-chip-badge">today</span>'; }
    else if (days <= 2) { cls = 'qs-warm'; badge = `<span class="qs-chip-badge">${days}d ago</span>`; }
    else { cls = 'qs-ready'; badge = `<span class="qs-chip-badge">${days}d</span>`; }
    return `<button class="qs-page-chip ${cls}" data-muscle="${m}">${m}${badge}</button>`;
  }).join('');
  el.querySelectorAll('.qs-page-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      closePage('qs-page');
      quickStartWorkout(chip.dataset.muscle);
    });
  });
}
document.getElementById('qs-back').addEventListener('click', () => closePage('qs-page'));
document.getElementById('btn-qs-open').addEventListener('click', () => { renderQSPage(); openPage('qs-page'); });

// ── Legends page ──────────────────────────────────────────────────────────────
let selectedLegendId = null;

function renderLegendsPage() {
  const legends = LEGENDS_DATA.filter(l => l.id !== 'zyzz');
  if (!selectedLegendId) selectedLegendId = legends[0]?.id;

  const tabsEl    = document.getElementById('legends-page-tabs');
  const eraEl     = document.getElementById('legends-page-era');
  const contentEl = document.getElementById('legends-page-content');

  tabsEl.innerHTML = legends.map(l => `
    <button class="legend-tab${selectedLegendId === l.id ? ' active' : ''}" data-lid="${l.id}" title="${l.name}${l.era ? ' · ' + l.era : ''}">
      <span class="lt-name">${l.name.split(' ').pop()}</span>
      ${l.era ? `<span class="lt-era">${l.era.replace(/[()]/g, '').split(' ')[0]}</span>` : ''}
    </button>
  `).join('');
  tabsEl.querySelectorAll('.legend-tab').forEach(btn => {
    btn.addEventListener('click', () => { selectedLegendId = btn.dataset.lid; renderLegendsPage(); });
  });

  const legend = legends.find(l => l.id === selectedLegendId);
  if (!legend) return;
  eraEl.textContent = legend.era || '';
  contentEl.innerHTML = legend.workouts.map(w => `
    <div class="legend-wcard" data-lid="${legend.id}" data-wname="${w.name}">
      <div class="lwc-left">
        <div class="lwc-name">${w.name}</div>
        <div class="lwc-exlist">${w.exercises.slice(0,4).map(e => e.name).join(' · ')}${w.exercises.length > 4 ? ' …' : ''}</div>
        <div class="lwc-meta">${w.badge} · ${w.exercises.length} exercises</div>
      </div>
      <div class="lwc-right">
        <div class="lwc-sets">${w.exercises.reduce((s, e) => s + e.sets, 0)}</div>
        <div class="lwc-sets-lbl">sets</div>
      </div>
    </div>
  `).join('');
  contentEl.querySelectorAll('.legend-wcard').forEach(card => {
    card.addEventListener('click', () => {
      closePage('legends-page');
      startLegendWorkout(card.dataset.lid, card.dataset.wname);
    });
  });
}

function startLegendWorkout(legendId, workoutName) {
  const legend = LEGENDS_DATA.find(l => l.id === legendId);
  const workout = legend?.workouts.find(w => w.name === workoutName);
  if (!workout) return;
  const profile = getActiveProfile();
  const exercises = dedupeExercises(workout.exercises.map(e => {
    const resolved = resolveExercise(e.name, profile);
    return {
      name: resolved.name,
      originalName: resolved.reason !== 'none' ? resolved.original : null,
      sets: e.sets, reps: String(e.reps), rest: e.rest || 90,
      logs: Array.from({ length: e.sets }, () => ({ weight: '', reps: '', done: false })),
    };
  }));
  beginWorkout(workout.name, 'strength', exercises);
}

document.getElementById('legends-back').addEventListener('click', () => closePage('legends-page'));
document.getElementById('btn-legends-open').addEventListener('click', () => { renderLegendsPage(); openPage('legends-page'); });

// ── CrossFit page ─────────────────────────────────────────────────────────────
function renderCFPage() {
  const el = document.getElementById('cf-page-content');
  const byCategory = {};
  FAMOUS_WODS.forEach(w => {
    (byCategory[w.category] = byCategory[w.category] || []).push(w);
  });

  el.innerHTML = Object.entries(byCategory).map(([cat, wods]) => `
    <div class="section-label" style="margin-bottom:12px">${cat === 'Girls' ? 'The Girls' : cat === 'Hero' ? 'Hero WODs' : cat}</div>
    ${wods.map(w => {
      const movLine = (w.movements || []).slice(0, 3).map(m => m.reps ? `${m.reps} ${m.name}` : m.name).join(' · ');
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
    }).join('')}
    <div style="height:20px"></div>
  `).join('');

  el.querySelectorAll('.legend-wcard[data-wod]').forEach(card => {
    card.addEventListener('click', () => {
      const wod = FAMOUS_WODS.find(w => w.name === card.dataset.wod);
      if (!wod) return;
      closePage('cf-page');
      beginCFWorkout(wod.name, wod);
    });
  });
}

document.getElementById('cf-back').addEventListener('click', () => closePage('cf-page'));
document.getElementById('btn-cf-open').addEventListener('click', () => { renderCFPage(); openPage('cf-page'); });

function renderMuscleFrequency() {
  const history = get('workoutHistory') || [];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const freq = {};
  MUSCLES.forEach(m => { freq[m] = null; });
  [...history].reverse().forEach(h => {
    if (h.type !== 'strength') return;
    (h.exercises || []).forEach(ex => {
      const dbEx = EXERCISES_DB.find(e => e.name === ex.name);
      if (dbEx && freq[dbEx.group] === null) {
        const d = new Date(h.date); d.setHours(0, 0, 0, 0);
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
      ${MUSCLES.map(m => {
        const d = freq[m];
        let label = '—', cls = 'fresh';
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
  const today = new Date(); today.setHours(0, 0, 0, 0);

  // Check if there's a workout logged today
  const trainedToday = history.some(h => {
    const d = new Date(h.date); d.setHours(0, 0, 0, 0);
    return d.getTime() === today.getTime();
  });

  if (trainedToday || activeWorkout) {
    card.style.display = 'none';
    return;
  }

  // Find most-recovered muscle (highest days since last trained, minimum 1 day)
  let bestMuscle = null, bestDays = 0;
  QS_MUSCLES.forEach(m => {
    const days = getMuscleDaysAgo(m);
    // null = never trained (freshest), big number = longest rest
    const effectiveDays = days === null ? 999 : days;
    if (effectiveDays > bestDays) { bestDays = effectiveDays; bestMuscle = m; }
  });

  // Weekly volume (last 7 days)
  const oneWeekAgo = new Date(today); oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const weekVolume = history
    .filter(h => new Date(h.date) >= oneWeekAgo && h.type === 'strength')
    .reduce((sum, h) => sum + (h.totalWeight || 0), 0);

  // Streak
  const chip = document.getElementById('streak-count');
  const streakText = chip?.textContent || '0 day streak';

  // Days since best muscle trained
  const readyLabel = bestDays >= 999 ? 'Never trained' : bestDays >= 3 ? `${bestDays}d rest` : 'Recovered';

  card.style.display = '';
  card.innerHTML = `
    <div class="rdc-wrap">
      <div class="rdc-row">
        <div class="rdc-label">Rest Day</div>
        <div class="rdc-streak">${streakText}</div>
      </div>
      ${bestMuscle ? `
        <div class="rdc-suggest">
          <div class="rdc-suggest-label">Most recovered</div>
          <div class="rdc-suggest-muscle">${bestMuscle}<span class="rdc-ready-badge">${readyLabel}</span></div>
          <button class="rdc-start" data-muscle="${bestMuscle}">Start ${bestMuscle} Day →</button>
        </div>` : ''}
      ${weekVolume > 0 ? `
        <div class="rdc-stat">
          <span class="rdc-stat-val">${Math.round(weekVolume).toLocaleString()}<span class="rdc-stat-unit"> kg</span></span>
          <span class="rdc-stat-lbl">this week</span>
        </div>` : ''}
    </div>`;

  card.querySelector('.rdc-start')?.addEventListener('click', e => {
    quickStartWorkout(e.currentTarget.dataset.muscle);
  });
}

// Quick Start — muscle chips tap directly into a workout (no modal needed)
function quickStartWorkout(muscle) {
  if (!SHUFFLE_PLANS[muscle]) return;
  const profile = getActiveProfile();
  const plan = sortByFeel(SHUFFLE_PLANS[muscle]);
  const exercises = dedupeExercises(plan.map(e => {
    const resolved = resolveExercise(e.name, profile);
    return {
      name: resolved.name,
      originalName: resolved.reason !== 'none' ? resolved.original : null,
      sets: e.sets, reps: String(e.reps), rest: e.rest,
      logs: Array.from({ length: e.sets }, () => ({ weight: '', reps: '', done: false })),
    };
  }));
  beginWorkout(`${muscle} Day`, 'strength', exercises);
}

document.getElementById('btn-custom').addEventListener('click', () => goScreen('build'));
document.getElementById('btn-resume').addEventListener('click', () => {
  if (activeWorkout) goScreen('active');
  else goScreen('build');
});

// ─── COACHES ──────────────────────────────────────────────────────────────────
function renderCoaches() {
  const tabsEl   = document.getElementById('coach-tabs');
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

    const wodCards = coach.workouts.map(w => {
      const isCF = ['emom', 'amrap', 'rounds', 'fortime'].includes(w.type);
      const bigNum   = isCF ? cfBigNum(w)   : w.exercises?.reduce((s, e) => s + e.sets, 0);
      const bigUnit  = isCF ? cfBigUnit(w)  : 'sets';
      const subLine  = isCF ? cfSubLine(w)  : w.exercises?.map(e => e.name).join(' · ');
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
    }).join('');

    block.innerHTML = `
      <div class="athlete-name-big">${coach.name}</div>
      <span class="coach-specialty section-label">${coach.specialty}</span>
      ${wodCards}`;
    contentEl.appendChild(block);
  });

  contentEl.querySelectorAll('.wc-go').forEach(btn => {
    btn.addEventListener('click', () => startCoachWorkout(btn.dataset.coach, btn.dataset.workout));
  });
}

// Helper display values for CF workout cards
function cfBigNum(w) {
  if (w.type === 'emom')    return w.rounds;
  if (w.type === 'amrap')   return w.timeCap;
  if (w.type === 'rounds')  return w.rounds;
  if (w.type === 'fortime') return w.sets ? w.sets[0] : '—';
  return '—';
}
function cfBigUnit(w) {
  if (w.type === 'emom')    return 'rounds';
  if (w.type === 'amrap')   return 'min';
  if (w.type === 'rounds')  return 'rounds';
  if (w.type === 'fortime') return 'reps';
  return '';
}
function cfSubLine(w) {
  return (w.movements || []).map(m => m.reps ? `${m.reps} ${m.name}` : m.name).join(' · ');
}

function selectCoach(id) {
  document.querySelectorAll('.athlete-tab').forEach(t => t.classList.toggle('active', t.dataset.id === id));
  document.querySelectorAll('.athlete-block').forEach(b => b.classList.toggle('active', b.id === `coach-${id}`));
}

// Remove duplicate exercise names that can arise after substitution
// (e.g. two exercises both resolve to "Incline Dumbbell Press").
// Keep the first occurrence; merge its sets into it if you want volume,
// but simpler is just to drop the duplicate entirely.
function dedupeExercises(exercises) {
  const seen = new Set();
  return exercises.filter(e => {
    if (seen.has(e.name)) return false;
    seen.add(e.name);
    return true;
  });
}

function startCoachWorkout(coachId, workoutName) {
  const coach   = COACHES_DATA.find(c => c.id === coachId);
  const workout = coach.workouts.find(w => w.name === workoutName);
  const isCF    = ['emom', 'amrap', 'rounds', 'fortime'].includes(workout.type);

  if (isCF) {
    beginCFWorkout(workout.name, workout);
  } else {
    // Strength fallback (if we ever add strength workouts to coaches)
    const profile = getActiveProfile();
    const exercises = dedupeExercises(workout.exercises.map(e => {
      const resolved = resolveExercise(e.name, profile);
      return {
        name: resolved.name,
        originalName: resolved.reason !== 'none' ? resolved.original : null,
        sets: e.sets, reps: String(e.reps), rest: e.rest || 90,
        logs: Array.from({ length: e.sets }, () => ({ weight: '', reps: '', done: false })),
      };
    }));
    beginWorkout(workout.name, 'strength', exercises);
  }
}

function beginCFWorkout(name, cfData) {
  newPRsThisSession = [];
  activeWorkout = { name, type: cfData.type, cf: cfData };
  cfCurrentRound    = 0;
  cfRoundsCompleted = 0;
  cfMovementsDone   = new Set();
  cfRoundLog        = [];
  workoutStartTime  = Date.now();
  totalWeightMoved  = 0;
  sessionSets       = 0;
  stopTimer();
  saveActiveState();
  goScreen('active');
}

// ─── BUILD ────────────────────────────────────────────────────────────────────
function renderBuild() {
  // Mode toggle
  document.querySelectorAll('.build-mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === buildMode);
  });
  document.getElementById('strength-section').style.display   = buildMode === 'strength'  ? '' : 'none';
  document.getElementById('crossfit-section').style.display   = buildMode === 'crossfit'  ? '' : 'none';

  if (buildMode === 'crossfit') {
    renderCFBuild();
    return;
  }

  // Muscle chips (strength only)
  const chips = document.getElementById('muscle-chips');
  chips.innerHTML = MUSCLES.map(m => `
    <div class="muscle-chip${selectedMuscles.includes(m) ? ' active' : ''}" data-muscle="${m}">${m}</div>
  `).join('');
  chips.querySelectorAll('.muscle-chip').forEach(chip => {
    chip.addEventListener('click', () => toggleMuscle(chip.dataset.muscle));
  });

  renderExerciseList();
}

function renderCFBuild() {
  // Format buttons
  document.querySelectorAll('.cf-format-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.format === cfFormat);
  });
  // Show/hide config sections
  ['emom', 'amrap', 'rounds', 'fortime'].forEach(f => {
    const el = document.getElementById(`cf-config-${f}`);
    if (el) el.style.display = f === cfFormat ? '' : 'none';
  });
  // Movements list
  renderCFMovementList();
  // Show start button if at least 1 movement
  document.getElementById('build-start-wrap').style.display = cfMovements.length ? 'block' : 'none';
}

function renderCFMovementList() {
  const el = document.getElementById('cf-movement-list');
  if (!cfMovements.length) {
    el.innerHTML = '<div class="empty-state">No movements yet — add one below.</div>';
    return;
  }
  el.innerHTML = cfMovements.map((m, i) => `
    <div class="cf-movement-item">
      <div class="cf-movement-item-left">
        <div class="cf-movement-item-name">${m.name}</div>
        ${m.reps ? `<div class="cf-movement-item-reps">${m.reps}</div>` : ''}
      </div>
      <button class="ex-delete" data-cf-idx="${i}">✕</button>
    </div>
  `).join('');
  el.querySelectorAll('[data-cf-idx]').forEach(btn => {
    btn.addEventListener('click', () => {
      cfMovements.splice(parseInt(btn.dataset.cfIdx), 1);
      renderCFBuild();
    });
  });
}

function toggleMuscle(m) {
  selectedMuscles = selectedMuscles.includes(m) ? selectedMuscles.filter(x => x !== m) : [...selectedMuscles, m];
  renderBuild();
}

function renderExerciseList() {
  const el = document.getElementById('exercise-list');
  const startWrap = document.getElementById('build-start-wrap');
  if (!buildExercises.length) {
    el.innerHTML = '<div class="empty-state">No exercises yet — add one below.</div>';
    startWrap.style.display = 'none';
    return;
  }
  startWrap.style.display = 'block';
  el.innerHTML = buildExercises.map((ex, i) => {
    const last = getLastSession(ex.name);
    const lastText = last ? `Last: ${last[0]?.weight || '—'}kg × ${last[0]?.reps || '—'}` : '';
    return `
    <div class="exercise-item" id="ex-item-${i}">
      <div class="ex-header" data-idx="${i}">
        <div class="ex-name-wrap">
          <div class="ex-name">${ex.name}</div>
          <div class="ex-summary" id="ex-summary-${i}">${ex.reps} reps · ${ex.rest}s rest${lastText ? ' · ' + lastText : ''}</div>
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
  }).join('');

  el.querySelectorAll('.ex-header').forEach(h => {
    h.addEventListener('click', (e) => {
      if (e.target.classList.contains('ex-delete')) return;
      toggleExDetail(parseInt(h.dataset.idx));
    });
  });
  el.querySelectorAll('.ex-delete').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); removeExercise(parseInt(btn.dataset.idx)); });
  });
  el.querySelectorAll('.ex-details input').forEach(input => {
    input.addEventListener('input', () => updateEx(parseInt(input.dataset.idx), input.dataset.field, input.value));
  });
}

function toggleExDetail(i) {
  const det = document.getElementById(`ex-detail-${i}`);
  if (det) det.classList.toggle('open');
}

function updateEx(i, field, val) {
  buildExercises[i][field] = (field === 'sets' || field === 'rest') ? (parseInt(val) || 0) : val;
  const s = document.getElementById(`ex-summary-${i}`);
  if (s) s.textContent = `${buildExercises[i].reps} reps · ${buildExercises[i].rest}s rest`;
  const sb = document.getElementById(`ex-sets-big-${i}`);
  if (sb && field === 'sets') sb.textContent = buildExercises[i].sets;
}

function removeExercise(i) {
  buildExercises.splice(i, 1);
  renderExerciseList();
}

// Build mode toggle
document.querySelectorAll('.build-mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    buildMode = btn.dataset.mode;
    buildExercises = [];
    cfMovements    = [];
    selectedMuscles = [];
    renderBuild();
  });
});

// CF format selector
document.querySelectorAll('.cf-format-btn').forEach(btn => {
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
document.getElementById('cf-mov-name').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('btn-add-cf-movement').click();
});

document.getElementById('btn-add-exercise').addEventListener('click', openExSearch);
document.getElementById('btn-save-workout').addEventListener('click', saveCustomWorkout);
document.getElementById('btn-start-custom').addEventListener('click', startCustomWorkout);

function saveCustomWorkout() {
  const name = document.getElementById('custom-name').value || 'My Workout';
  const saved = get('customWorkouts') || [];
  saved.push({ name, exercises: buildExercises, muscles: selectedMuscles, type: buildMode, created: Date.now() });
  set('customWorkouts', saved);
  const btn = document.getElementById('btn-save-workout');
  btn.textContent = 'Saved ✓';
  setTimeout(() => { btn.textContent = 'Save'; }, 1500);
}

function startCustomWorkout() {
  const name = document.getElementById('custom-name').value || (buildMode === 'crossfit' ? 'My WOD' : 'My Workout');

  if (buildMode === 'crossfit') {
    if (!cfMovements.length) return;
    const cfData = { type: cfFormat, movements: [...cfMovements] };
    if (cfFormat === 'emom') {
      cfData.rounds = parseInt(document.getElementById('cf-emom-rounds').value) || 10;
      cfData.intervalSecs = parseInt(document.getElementById('cf-emom-interval').value) || 60;
      const mins = cfData.intervalSecs === 60 ? '' : `${cfData.intervalSecs}s `;
      cfData.description = `EMOM ${mins}× ${cfData.rounds}`;
      cfData.badge = 'EMOM';
    } else if (cfFormat === 'amrap') {
      cfData.timeCap = parseInt(document.getElementById('cf-amrap-time').value) || 20;
      cfData.description = `AMRAP ${cfData.timeCap} MIN`;
      cfData.badge = 'AMRAP';
    } else if (cfFormat === 'rounds') {
      cfData.rounds = parseInt(document.getElementById('cf-rounds-count').value) || 3;
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
  beginWorkout(name, 'strength', buildExercises.map(e => ({
    name: e.name, sets: e.sets, reps: String(e.reps), rest: e.rest,
    logs: Array.from({ length: e.sets }, () => ({ weight: '', reps: '', done: false })),
  })));
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
  const results = EXERCISES_DB.filter(e =>
    e.name.toLowerCase().includes(q.toLowerCase()) ||
    e.group.toLowerCase().includes(q.toLowerCase())
  );
  list.innerHTML = results.map(e => {
    const pr = getPRMap()[e.name];
    const resolved = resolveExercise(e.name, profile);
    const isSubbed = resolved.reason !== 'none';
    return `<div class="esm-item${isSubbed ? ' esm-subbed' : ''}" data-name="${e.name}">
      <div>
        <div class="esm-item-name">${e.name}${isSubbed ? `<span class="esm-sub-tag">→ ${resolved.name}</span>` : ''}</div>
        <div class="esm-item-group">${e.group}${pr ? ' · PR: ' + pr + 'kg' : ''}</div>
      </div>
      <span style="color:var(--grey)">+</span>
    </div>`;
  }).join('');
  list.querySelectorAll('.esm-item').forEach(item => {
    item.addEventListener('click', () => addExercise(item.dataset.name));
  });
}

function addExercise(name) {
  const ex = EXERCISES_DB.find(e => e.name === name);
  if (exSearchMode === 'swap' && activeWorkout) {
    // Replace the current exercise in-place, keep sets/reps structure, reset logs
    const cur = activeWorkout.exercises[currentExIdx];
    activeWorkout.exercises[currentExIdx] = {
      name: ex.name,
      sets: cur.sets, reps: cur.reps, rest: ex.defaultRest,
      logs: Array.from({ length: cur.sets }, () => ({ weight: '', reps: '', done: false })),
    };
    closeExSearch();
    renderCurrentExercise();
    renderExNav();
    return;
  }
  buildExercises.push({ name: ex.name, sets: ex.defaultSets, reps: ex.defaultReps, rest: ex.defaultRest });
  closeExSearch();
  renderExerciseList();
}

document.getElementById('ex-search-input').addEventListener('input', e => filterExercises(e.target.value));
document.getElementById('btn-close-ex-search').addEventListener('click', closeExSearch);

// ─── SHUFFLE ──────────────────────────────────────────────────────────────────
// Sort compounds first (heavy → moderate → light) so the workout
// always starts with the highest-load movements.
const FEEL_ORDER = { heavy: 0, moderate: 1, light: 2 };

function sortByFeel(exercises) {
  return [...exercises].sort((a, b) => {
    const aEx = EXERCISES_DB.find(e => e.name === a.name);
    const bEx = EXERCISES_DB.find(e => e.name === b.name);
    return (FEEL_ORDER[aEx?.feel] ?? 1) - (FEEL_ORDER[bEx?.feel] ?? 1);
  });
}

// Session-level tier override — null means "use saved profile"
let shuffleSessionTier = null;

function renderShuffleTierChips() {
  const profile = getActiveProfile();
  const activeTier = shuffleSessionTier || profile.equipmentTier;
  const container = document.getElementById('shuffle-tier-chips');
  container.innerHTML = EQUIPMENT_TIERS.map(t => `
    <span class="shuffle-tier-chip${activeTier === t.id ? ' active' : ''}" data-tier="${t.id}">${t.label}</span>
  `).join('');
  container.querySelectorAll('.shuffle-tier-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      shuffleSessionTier = chip.dataset.tier;
      renderShuffleTierChips();
    });
  });
}

function openShuffle() {
  selectedShuffleMuscle = null;
  shuffleSessionTier = null;
  renderShuffleTierChips();
  const el = document.getElementById('shuffle-muscles');
  el.innerHTML = Object.keys(SHUFFLE_PLANS).map(m => `
    <div class="shuffle-muscle" data-m="${m}">${m}</div>
  `).join('');
  el.querySelectorAll('.shuffle-muscle').forEach(chip => {
    chip.addEventListener('click', () => {
      selectedShuffleMuscle = chip.dataset.m;
      el.querySelectorAll('.shuffle-muscle').forEach(c => c.classList.toggle('active', c === chip));
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
  const exercises = dedupeExercises(plan.map(e => {
    const resolved = resolveExercise(e.name, profile);
    return {
      name: resolved.name,
      originalName: resolved.reason !== 'none' ? resolved.original : null,
      sets: e.sets, reps: String(e.reps), rest: e.rest,
      logs: Array.from({ length: e.sets }, () => ({ weight: '', reps: '', done: false })),
    };
  }));
  beginWorkout(`${selectedShuffleMuscle} Day`, 'strength', exercises);
});
document.getElementById('btn-close-shuffle').addEventListener('click', () => {
  document.getElementById('shuffle-modal').classList.remove('open');
});

// ─── OVERLAY TAP TO CLOSE ────────────────────────────────────────────────────
['shuffle-modal', 'ex-search-modal'].forEach(id => {
  document.getElementById(id).addEventListener('click', function(e) {
    if (e.target === this) this.classList.remove('open');
  });
});

// ─── NAME PROMPT — multi-step: Name → Create Account → Sign In ───────────────
const NAME_KEY = 'kilos-name';
const getUserName = () => get(NAME_KEY);
const saveUserName = (n) => set(NAME_KEY, (n || '').trim() || 'Athlete');

let _npCallback = null;

function requireName(callback) {
  if (getUserName()) { callback(); return; }
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
  ['account', 'signin'].forEach(s => {
    document.getElementById(`np-step-${s}`).style.display = s === step ? '' : 'none';
  });
  // Google button only shown on account step if Supabase is configured
  const googleWrap = document.getElementById('np-google-wrap');
  if (googleWrap) googleWrap.style.display = (step === 'account' && isConfigured) ? '' : 'none';
}

function npSetError(id, msg) {
  const el = document.getElementById(id);
  if (el) el.textContent = msg;
}

// Derive username from display name
function nameToUsername(name) {
  return name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9_]/g, '');
}

// Create account
document.getElementById('np-btn-create').addEventListener('click', async () => {
  const displayName = document.getElementById('np-display-name').value.trim();
  const password = document.getElementById('np-password').value;
  npSetError('np-create-error', '');

  if (!displayName) { document.getElementById('np-display-name').focus(); return; }
  if (password.length < 6) { npSetError('np-create-error', 'Password needs 6+ characters.'); return; }

  const username = nameToUsername(displayName);
  const btn = document.getElementById('np-btn-create');
  btn.textContent = 'Creating…'; btn.disabled = true;

  const { error } = await signUpWithPassword(displayName, username, password);
  btn.disabled = false; btn.textContent = 'Create account →';

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
  if (_npCallback) { const cb = _npCallback; _npCallback = null; cb(); }
});

document.getElementById('np-password').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('np-btn-create').click();
});

// Skip — save locally with just the name
document.getElementById('np-local-btn').addEventListener('click', () => {
  const name = document.getElementById('np-display-name').value.trim();
  saveUserName(name || 'Athlete');
  closeNamePrompt();
  if (_npCallback) { const cb = _npCallback; _npCallback = null; cb(); }
});

// Google sign-in
document.getElementById('np-google-btn').addEventListener('click', async () => {
  const name = document.getElementById('np-display-name').value.trim();
  if (name) saveUserName(name);
  _npCallback = null;
  closeNamePrompt();
  await signInWithGoogle();
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

  if (!nameInput || !password) { npSetError('np-signin-error', 'Enter your name and password.'); return; }

  const username = nameToUsername(nameInput);
  const btn = document.getElementById('np-btn-signin');
  btn.textContent = 'Signing in…'; btn.disabled = true;

  const { data, error } = await signInWithPassword(username, password);
  btn.disabled = false; btn.textContent = 'Sign in →';

  if (error) {
    npSetError('np-signin-error', 'Wrong name or password.');
    return;
  }

  const displayName = data?.user?.user_metadata?.display_name || nameInput;
  saveUserName(displayName);
  await pullAndMerge();
  closeNamePrompt();
  if (_npCallback) { const cb = _npCallback; _npCallback = null; cb(); }
});

document.getElementById('np-signin-password').addEventListener('keydown', e => {
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

function beginCardioWorkout(name, cardioType, target, notes) {
  newPRsThisSession = [];
  activeWorkout = { name, type: 'cardio', cardioType, target, notes, startTime: Date.now() };
  workoutStartTime = Date.now();
  totalWeightMoved = 0;
  sessionSets = 0;
  stopTimer();
  saveActiveState();
  goScreen('active');
}

const CF_TYPES = new Set(['emom', 'amrap', 'rounds', 'fortime']);

function showStrengthUI(show) {
  document.getElementById('exercise-nav').style.display     = show ? '' : 'none';
  document.getElementById('exercise-display').style.display = show ? '' : 'none';
  document.getElementById('set-log').style.display          = show ? '' : 'none';
}
function showCFUI(show) {
  document.getElementById('cf-meta').style.display = show ? '' : 'none';
  document.getElementById('cf-log').style.display  = show ? '' : 'none';
}
function showCardioUI(show) {
  document.getElementById('cardio-log-section').style.display = show ? '' : 'none';
}

function setActiveWorkoutUI(visible) {
  const ids = ['exercise-nav', 'exercise-display', 'set-log', 'cf-log', 'cf-meta', 'cardio-log-section'];
  const cls = ['.timer-block', '.timer-controls'];
  ids.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = visible ? '' : 'none'; });
  cls.forEach(sel => { const el = document.querySelector(sel); if (el) el.style.display = visible ? '' : 'none'; });
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
  document.getElementById('current-ex-name').textContent = activeWorkout.cardioType || activeWorkout.name;
  document.getElementById('current-ex-sets').textContent = activeWorkout.target || 'Go at your own pace';
  document.getElementById('cardio-type-label').textContent = activeWorkout.cardioType || 'Cardio';
  document.getElementById('cardio-notes-label').textContent = activeWorkout.notes || '';

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
  rpeEl.querySelectorAll('.rpe-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      rpeEl.querySelectorAll('.rpe-btn').forEach(b => b.classList.remove('active'));
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
  document.getElementById('cf-wod-label').textContent = cf.description || cf.type.toUpperCase();
  const roundEl = document.getElementById('cf-round-display');
  if (cf.type === 'emom' || cf.type === 'rounds') {
    roundEl.textContent = `Round ${cfCurrentRound + 1} of ${cf.rounds}`;
  } else if (cf.type === 'amrap') {
    roundEl.textContent = cf.description || 'AMRAP';
  } else if (cf.type === 'fortime') {
    roundEl.textContent = cf.sets ? cf.sets.join('-') + ' reps' : 'For Time';
  }
}

function renderCFLog() {
  const el = document.getElementById('cf-log');
  const cf = activeWorkout.cf;
  switch (cf.type) {
    case 'emom':    renderEMOMLog(el, cf);    break;
    case 'amrap':   renderAMRAPLog(el, cf);   break;
    case 'rounds':  renderRoundsLog(el, cf);  break;
    case 'fortime': renderForTimeLog(el, cf); break;
  }
}

function renderEMOMLog(el, cf) {
  const movHtml = cf.movements.map(m => `
    <div class="cf-movement-row">
      <div>
        <div class="cf-mov-name">${m.name}</div>
        ${m.note ? `<div class="cf-mov-note">${m.note}</div>` : ''}
      </div>
      ${m.reps ? `<div class="cf-mov-reps">${m.reps}</div>` : ''}
    </div>`).join('');

  const dots = Array.from({ length: cf.rounds }, (_, i) => {
    const done = cfRoundLog[i] === true;
    const cur  = i === cfCurrentRound;
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
  el.querySelectorAll('.cf-round-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      const i = parseInt(dot.dataset.round);
      cfRoundLog[i] = !cfRoundLog[i];
      renderCFLog();
    });
  });
}

function renderAMRAPLog(el, cf) {
  const movHtml = cf.movements.map(m => `
    <div class="cf-movement-row">
      ${m.reps ? `<div class="cf-mov-reps">${m.reps}</div>` : ''}
      <div class="cf-mov-name">${m.name}</div>
    </div>`).join('');

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
    if (cfRoundsCompleted > 0) { cfRoundsCompleted--; renderCFLog(); }
  });
}

function renderRoundsLog(el, cf) {
  const movHtml = cf.movements.map((m, i) => {
    const done  = cfMovementsDone.has(i);
    const label = m.unit === 'run' ? m.name : `${m.reps} ${m.name}`;
    return `
      <div class="cf-checklist-row${done ? ' done' : ''}" data-idx="${i}">
        <div class="cf-check-box">${done ? '✓' : ''}</div>
        <div class="cf-check-label">${label}</div>
      </div>`;
  }).join('');

  const allDone = cf.movements.every((_, i) => cfMovementsDone.has(i));
  el.innerHTML = `
    <span class="cf-log-label">Round ${cfCurrentRound + 1} — tap to complete</span>
    ${movHtml}
    <button class="cf-action-btn" id="cf-complete-round" ${allDone ? '' : 'disabled'}>
      Complete Round ${cfCurrentRound + 1} →
    </button>`;

  el.querySelectorAll('.cf-checklist-row').forEach(row => {
    row.addEventListener('click', () => {
      const i = parseInt(row.dataset.idx);
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
    cf.sets.forEach(reps => cf.movements.forEach(m => items.push({ name: m.name, reps })));
  } else {
    cf.movements.forEach(m => items.push({ name: m.name, reps: m.reps || null }));
  }

  const movHtml = items.map((item, i) => {
    const done  = cfMovementsDone.has(i);
    const label = item.reps ? `${item.reps} ${item.name}` : item.name;
    return `
      <div class="cf-checklist-row${done ? ' done' : ''}" data-idx="${i}">
        <div class="cf-check-box">${done ? '✓' : ''}</div>
        <div class="cf-check-label">${label}</div>
      </div>`;
  }).join('');

  const allDone = items.every((_, i) => cfMovementsDone.has(i));
  el.innerHTML = `
    <span class="cf-log-label">Tap each as you complete it</span>
    ${movHtml}
    ${allDone ? '<button class="cf-action-btn" id="cf-fortime-finish">Done! Finish workout →</button>' : ''}`;

  el.querySelectorAll('.cf-checklist-row').forEach(row => {
    row.addEventListener('click', () => {
      const i = parseInt(row.dataset.idx);
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
  el.querySelector('#cf-fortime-finish')?.addEventListener('click', finishWorkout);
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
    ${activeWorkout.exercises.map((_, i) => `
      <div class="ex-nav-pill${i === currentExIdx ? ' active' : ''}" data-idx="${i}"></div>
    `).join('')}
    ${nextEx ? `<span class="ex-nav-next">Up: ${nextEx.name}</span>` : ''}
  `;
  pills.querySelectorAll('.ex-nav-pill').forEach(p => {
    p.addEventListener('click', () => jumpToEx(parseInt(p.dataset.idx)));
  });
}

function jumpToEx(i) {
  currentExIdx = i; currentSetIdx = 0;
  stopTimer(); renderCurrentExercise(); renderExNav();
}

const FEEL_LABEL = {
  heavy:    'HEAVY — LOAD UP',
  moderate: 'MODERATE — CONTROLLED',
  light:    'LIGHT — SQUEEZE IT',
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

  // Feel / intensity badge
  const dbEx = EXERCISES_DB.find(e => e.name === ex.name);
  if (dbEx?.feel) {
    const badge = document.createElement('div');
    badge.id = 'feel-badge';
    badge.className = `feel-badge ${dbEx.feel}`;
    badge.textContent = FEEL_LABEL[dbEx.feel];
    document.getElementById('current-ex-name').insertAdjacentElement('afterend', badge);
  }

  // Substitution hint
  if (ex.originalName) {
    const hint = document.createElement('div');
    hint.id = 'sub-hint';
    hint.style.cssText = 'font-family:"Space Mono",monospace;font-size:8px;color:var(--grey2);text-transform:uppercase;letter-spacing:.1em;padding:0 24px;margin-bottom:4px;';
    hint.textContent = `Sub for: ${ex.originalName}`;
    setsEl.insertAdjacentElement('afterend', hint);
  }

  // Next exercise preview (task #25)
  document.getElementById('next-ex-preview')?.remove();
  const nextEx = activeWorkout.exercises[currentExIdx + 1];
  if (nextEx) {
    const nextPreview = document.createElement('div');
    nextPreview.id = 'next-ex-preview';
    nextPreview.className = 'next-ex-preview';
    nextPreview.textContent = `Next: ${nextEx.name}`;
    document.querySelector('.exercise-display').appendChild(nextPreview);
  }

  // Swap exercise button — lets user replace current exercise mid-session
  const swapBtn = document.createElement('button');
  swapBtn.id = 'btn-swap-ex';
  swapBtn.className = 'swap-ex-btn';
  swapBtn.textContent = 'swap exercise →';
  swapBtn.addEventListener('click', () => { exSearchMode = 'swap'; openExSearch(); });
  document.querySelector('.exercise-display').appendChild(swapBtn);

  renderSetLog();
  resetTimerDisplay(ex.rest);

  // Warmup protocol block — only for compound (heavy) exercises
  if (dbEx?.feel === 'heavy') {
    const lastSession = getLastSession(ex.name);
    const topW = lastSession ? Math.max(...lastSession.map(l => parseFloat(l.weight) || 0)) : 0;
    const wSets = topW > 0
      ? [
          { w: (Math.round(topW * 0.4 / 2.5) * 2.5) + 'kg', r: 10 },
          { w: (Math.round(topW * 0.6 / 2.5) * 2.5) + 'kg', r: 5 },
          { w: (Math.round(topW * 0.8 / 2.5) * 2.5) + 'kg', r: 2 },
        ]
      : [{ w: '40%', r: 10 }, { w: '60%', r: 5 }, { w: '80%', r: 2 }];
    const warmupEl = document.createElement('div');
    warmupEl.id = 'warmup-block';
    warmupEl.className = 'warmup-block';
    warmupEl.innerHTML = `
      <div class="warmup-header">
        <span>Warmup protocol</span>
        <span class="warmup-toggle">▾</span>
      </div>
      <div class="warmup-sets">
        ${wSets.map(s => `<div class="warmup-row">
          <span class="wr-weight">${s.w}</span>
          <span class="wr-x">×</span>
          <span class="wr-reps">${s.r} reps</span>
          <span class="wr-hint">not logged</span>
        </div>`).join('')}
      </div>`;
    warmupEl.querySelector('.warmup-header').addEventListener('click', () => warmupEl.classList.toggle('open'));
    // Open warmup by default on the first exercise (task #9)
    if (currentExIdx === 0) warmupEl.classList.add('open');
    document.querySelector('.set-log-title').insertAdjacentElement('afterend', warmupEl);
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
  const lastAllMet = lastLogs.length > 0 && lastLogs.every(l => !l.reps || parseInt(l.reps) >= (parseInt(ex.reps) || 8));
  const dispSugg = suggestion ? (isLbs() ? toDisplayWeight(suggestion) : suggestion) : null;
  const suggReps = ex.reps || '8';
  rows.innerHTML = (suggestion
    ? `<div class="overload-hint">
         <span class="oh-arrow">↑</span>
         <div class="oh-text">
           <span>Target today: <strong>${dispSugg}${unit} × ${suggReps}</strong></span>
           <span class="oh-sub">${lastAllMet ? `+2.5${unit} from last session` : 'Same as last session — hit all reps first'}</span>
         </div>
       </div>`
    : '') + ex.logs.map((log, i) => {
    const prev = lastSession?.[i];
    const dispPrevW = prev?.weight ? toDisplayWeight(prev.weight) : null;
    const wPlaceholder = dispPrevW ? `${dispPrevW}` : unit;
    const rPlaceholder = prev?.reps ? `${prev.reps}` : ex.reps;
    const prevHint = dispPrevW ? `<span class="log-prev">Last: ${dispPrevW}${unit} × ${prev.reps}</span>` : '';
    const dispLogW = log.weight ? toDisplayWeight(log.weight) : '';
    return `<div class="log-row">
      <span class="log-set-num">${i + 1}</span>
      <input class="log-input" type="number" placeholder="${wPlaceholder}" value="${dispLogW}"
        data-idx="${i}" data-field="weight" inputmode="decimal">
      <span class="log-x">×</span>
      <input class="log-input" type="text" placeholder="${rPlaceholder}" value="${log.reps}"
        data-idx="${i}" data-field="reps" inputmode="numeric" pattern="[0-9]*">
      <div class="log-done${log.done ? ' checked' : ''}" data-idx="${i}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      ${prevHint}
    </div>`;
  }).join('');

  rows.querySelectorAll('.log-input').forEach(input => {
    input.addEventListener('input', () => {
      const idx = parseInt(input.dataset.idx);
      const field = input.dataset.field;
      // Convert lbs back to kg for storage
      const val = (field === 'weight' && isLbs())
        ? (input.value ? String(fromDisplayWeight(input.value)) : '')
        : input.value;
      activeWorkout.exercises[currentExIdx].logs[idx][field] = val;
    });
  });
  rows.querySelectorAll('.log-done').forEach(btn => {
    btn.addEventListener('click', () => toggleSetDone(parseInt(btn.dataset.idx)));
  });
}

function toggleSetDone(setIdx) {
  const ex = activeWorkout.exercises[currentExIdx];
  const log = ex.logs[setIdx];
  log.done = !log.done;

  if (log.done) {
    if (navigator.vibrate) navigator.vibrate(50);
    sessionSets++;
    const w = parseFloat(log.weight) || 0;
    const r = parseInt(log.reps) || parseInt(ex.reps) || 0;
    totalWeightMoved += w * r;
    currentSetIdx = Math.min(setIdx + 1, ex.sets - 1);
    document.getElementById('current-ex-sets').textContent = `Set ${currentSetIdx + 1} of ${ex.sets}`;

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
  if (!activeWorkout || activeWorkout.type === 'cardio' || currentExIdx <= 0) return;
  currentExIdx--; currentSetIdx = 0; stopTimer(); renderCurrentExercise(); renderExNav();
  saveActiveState();
});
document.getElementById('btn-next-ex').addEventListener('click', () => {
  if (!activeWorkout || activeWorkout.type === 'cardio' || currentExIdx >= activeWorkout.exercises.length - 1) return;
  currentExIdx++; currentSetIdx = 0; stopTimer(); renderCurrentExercise(); renderExNav();
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
  timerSeconds = seconds; timerTotal = seconds; timerPhase = 'work';
  setTimerText(fmtTimeBig(seconds), 'READY');
  setTimerBar(1, false);
  setTimerStyle('work');
}

function fmtTime(s) {
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
    return;
  }

  // Countdown phases: work / rest / emom / amrap
  timerSeconds = seconds; timerTotal = seconds;
  const phaseLabel = phase === 'emom' ? 'EMOM' : phase === 'amrap' ? 'AMRAP' : phase.toUpperCase();
  setTimerText(fmtTimeBig(timerSeconds), phaseLabel);
  setTimerBar(1, phase === 'rest');
  showPauseBtn();
  timerInterval = setInterval(() => {
    timerSeconds--;
    setTimerText(fmtTimeBig(timerSeconds), timerPhase === 'emom' ? 'EMOM' : timerPhase === 'amrap' ? 'AMRAP' : timerPhase.toUpperCase());
    setTimerBar(timerTotal > 0 ? timerSeconds / timerTotal : 0, timerPhase === 'rest');
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
      const doneWord  = timerPhase === 'rest' ? 'GO'       : 'DONE';
      const doneLbl   = timerPhase === 'rest' ? 'REST OVER': 'SET DONE';
      setTimerText(doneWord, doneLbl);
      const el = document.getElementById('ring-time');
      el.classList.remove('tick');
      el.classList.add('go-text');
      setTimerStyle('work');
      setTimerBar(1, false);
    }
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerRunning = false;
  showPlayBtn();
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
      startTimer(timerSeconds || (activeWorkout.cf?.intervalSecs || 60), 'emom');
      break;
    case 'amrap': {
      // Don't restart if AMRAP already expired (timerSeconds <= 0 and not running)
      const amrapFull = (activeWorkout.cf?.timeCap || 20) * 60;
      if (timerSeconds > 0 || timerTotal === 0) startTimer(timerSeconds || amrapFull, 'amrap');
      break;
    }
    case 'rounds':
    case 'fortime':
      startTimer(0, 'stopwatch');
      break;
    default:
      // Strength: resume countdown where it left off
      startTimer(timerSeconds || activeWorkout.exercises?.[currentExIdx]?.rest || 90, timerPhase || 'work');
  }
}

function showPlayBtn() {
  document.getElementById('play-icon').style.display = '';
  document.getElementById('pause-icon').style.display = 'none';
}
function showPauseBtn() {
  document.getElementById('play-icon').style.display = 'none';
  document.getElementById('pause-icon').style.display = '';
}

document.getElementById('play-pause-btn').addEventListener('click', toggleTimer);

// ─── SCREEN LOCK / BACKGROUND TAB TIMER FIX ──────────────────────────────────
// When the screen locks or tab goes background, setInterval pauses.
// On return, we calculate real elapsed time and fast-forward the timer.
const COUNTUP_PHASES = new Set(['cardio', 'stopwatch']);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (timerRunning && !COUNTUP_PHASES.has(timerPhase)) timerHiddenAt = Date.now();
  } else if (timerHiddenAt !== null) {
    if (timerRunning && !COUNTUP_PHASES.has(timerPhase)) {
      const elapsed = Math.round((Date.now() - timerHiddenAt) / 1000);
      timerSeconds = Math.max(0, timerSeconds - elapsed);
      setTimerText(fmtTimeBig(timerSeconds), timerPhase.toUpperCase());
      setTimerBar(timerTotal > 0 ? timerSeconds / timerTotal : 0, timerPhase === 'rest');
      setTimerStyle(timerPhase);
      if (timerSeconds <= 0) {
        stopTimer();
        beep(880, 0.3);
        setTimerText(timerPhase === 'rest' ? 'GO' : 'DONE', timerPhase === 'rest' ? 'REST OVER' : 'SET DONE');
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
    ? activeWorkout.exercises.some(e => e.logs?.some(l => l.done))
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
  const elapsed = workoutStartTime ? Math.floor((Date.now() - workoutStartTime) / 1000) : 0;
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
    exercises: (completed.type === 'cardio' || isCF)
      ? []
      : completed.exercises.map(e => ({ name: e.name, sets: e.sets, logs: e.logs })),
  };
  if (completed.type === 'cardio') {
    entry.cardioType = completed.cardioType;
    entry.distance = document.getElementById('cardio-distance-input')?.value || '';
    entry.rpe = completed.rpe || null;
  }
  if (isCF) {
    entry.cfFormat = completed.type;
    entry.cfRoundsCompleted = completed.type === 'amrap' ? cfRoundsCompleted : cfCurrentRound;
    entry.cfMovements = (completed.cf?.movements || []).map(m => m.name);
  }
  history.push(entry);
  set('workoutHistory', history);

  // Auto-sync to cloud if signed in
  pushData();

  lastFinishedWorkout = completed;
  lastFinishedEntry = entry;
  activeWorkout = null;
  saveActiveState(); // clear persisted active state
  renderHome();      // update Resume button
  showWorkoutSummary(completed, durationStr, entry);
}

// ─── POST-WORKOUT SUMMARY SCREEN ─────────────────────────────────────────────
function showWorkoutSummary(workout, duration, entry) {
  const isCF = CF_TYPES.has(workout.type);
  const isCardio = workout.type === 'cardio';

  // Header
  document.getElementById('wsum-name').textContent = workout.name.toUpperCase();

  // PR badge
  const prBadgeEl = document.getElementById('wsum-pr-badge');
  if (newPRsThisSession.length) {
    prBadgeEl.textContent = `+${newPRsThisSession.length} NEW PR${newPRsThisSession.length > 1 ? 'S' : ''}`;
    prBadgeEl.style.display = '';
  } else {
    prBadgeEl.style.display = 'none';
  }

  // Stats grid
  const statsEl = document.getElementById('wsum-stats');
  if (isCF) {
    const roundsVal = workout.type === 'amrap' ? cfRoundsCompleted : cfCurrentRound;
    const roundsLbl = workout.type === 'amrap' ? 'Rounds' : 'Rounds Done';
    statsEl.innerHTML = `
      <div class="wsum-stat"><div class="ws-val">${duration}</div><div class="ws-lbl">Duration</div></div>
      <div class="wsum-stat"><div class="ws-val">${roundsVal}</div><div class="ws-lbl">${roundsLbl}</div></div>
      <div class="wsum-stat"><div class="ws-val">${workout.cf?.badge || workout.type.toUpperCase()}</div><div class="ws-lbl">Format</div></div>
    `;
  } else if (isCardio) {
    statsEl.innerHTML = `
      <div class="wsum-stat"><div class="ws-val">${duration}</div><div class="ws-lbl">Duration</div></div>
      <div class="wsum-stat"><div class="ws-val">${entry.distance || '—'}</div><div class="ws-lbl">Distance</div></div>
      <div class="wsum-stat"><div class="ws-val">${workout.cardioType || 'Cardio'}</div><div class="ws-lbl">Type</div></div>
    `;
  } else {
    statsEl.innerHTML = `
      <div class="wsum-stat"><div class="ws-val">${Math.round(totalWeightMoved).toLocaleString()}</div><div class="ws-lbl">KG Volume</div></div>
      <div class="wsum-stat"><div class="ws-val">${sessionSets}</div><div class="ws-lbl">Sets Done</div></div>
      <div class="wsum-stat"><div class="ws-val">${duration}</div><div class="ws-lbl">Duration</div></div>
    `;
  }

  // Top lift of the session
  const topLiftEl = document.getElementById('wsum-top-lift');
  const topPR = newPRsThisSession.length
    ? newPRsThisSession.reduce((best, pr) => (!best || pr.weight > best.weight) ? pr : best, null)
    : null;
  if (topPR) {
    topLiftEl.innerHTML = `<div class="wsum-top-lift-label">Top Lift</div>
      <div class="wsum-top-lift-val">${topPR.weight}<span class="wsum-top-lift-unit">kg × ${topPR.reps}</span></div>
      <div class="wsum-top-lift-ex">${topPR.name.toUpperCase()}</div>`;
    topLiftEl.style.display = '';
  } else if (!isCF && !isCardio) {
    // Best set by volume if no PR
    let bestSet = null;
    (workout.exercises || []).forEach(e => {
      (e.logs || []).filter(l => l.done).forEach(l => {
        const vol = (parseFloat(l.weight) || 0) * (parseInt(l.reps) || 0);
        if (!bestSet || vol > bestSet.vol) bestSet = { name: e.name, weight: l.weight, reps: l.reps, vol };
      });
    });
    if (bestSet?.weight) {
      topLiftEl.innerHTML = `<div class="wsum-top-lift-label">Best Set</div>
        <div class="wsum-top-lift-val">${bestSet.weight}<span class="wsum-top-lift-unit">kg × ${bestSet.reps}</span></div>
        <div class="wsum-top-lift-ex">${bestSet.name.toUpperCase()}</div>`;
      topLiftEl.style.display = '';
    } else {
      topLiftEl.style.display = 'none';
    }
  } else {
    topLiftEl.style.display = 'none';
  }

  document.getElementById('workout-summary').classList.add('open');
}

document.getElementById('wsum-share').addEventListener('click', () => {
  document.getElementById('workout-summary').classList.remove('open');
  showShareCard(lastFinishedWorkout, lastFinishedEntry?.duration || '—', lastFinishedEntry);
});
document.getElementById('wsum-history').addEventListener('click', () => {
  document.getElementById('workout-summary').classList.remove('open');
  goScreen('history');
});
document.getElementById('wsum-close').addEventListener('click', () => {
  document.getElementById('workout-summary').classList.remove('open');
});

function showShareCard(workout, duration, entry) {
  // Build the data model for the canvas renderer
  currentShareData = buildShareData({
    workout,
    totalWeightMoved,
    sessionSets,
    newPRsThisSession,
    cfRoundsCompleted,
    cfCurrentRound,
    duration,
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
  await renderShareCard(canvas, currentShareData, currentShareMode, currentShareBgImage);
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
    document.getElementById('btn-log-prs-h').addEventListener('click', openPRLog);
  } else {
    document.getElementById('pr-row').innerHTML = `
      ${prs.sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, val]) => `
        <div class="pr-card">
          <div class="pr-val">${val}kg</div>
          <div class="pr-label">${name.split(' ').slice(-1)[0]}</div>
        </div>`).join('')}
      <div class="pr-card pr-card-add" id="btn-add-prs">
        <div class="pr-val pr-add-icon">+</div>
        <div class="pr-label">Add</div>
      </div>`;
    document.getElementById('btn-add-prs').addEventListener('click', openPRLog);
  }

  const listEl = document.getElementById('history-list');
  if (!history.length) {
    listEl.innerHTML = `<div class="history-empty"><div class="big-num">0</div><p>No sessions yet.<br>Finish a workout to see it here.</p></div>`;
    return;
  }
  const CF_TYPE_TAGS = { emom: 'EMO', amrap: 'AMR', rounds: 'RFT', fortime: 'FT' };
  listEl.innerHTML = history.slice().reverse().map((h, revIdx) => {
    const realIdx = history.length - 1 - revIdx;
    const isExpanded = expandedHistory.has(realIdx);
    const d = new Date(h.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const isCF = CF_TYPES.has(h.type);
    const typeTag = isCF ? (CF_TYPE_TAGS[h.type] || 'CF') : (h.type === 'cardio' ? 'CDO' : 'STR');
    const prLine = h.newPRs?.length ? `<div class="hi-pr">PR — ${h.newPRs.map(p => p.name).join(', ')}</div>` : '';
    const bigNum = isCF ? (h.cfRoundsCompleted != null ? h.cfRoundsCompleted : h.duration || '—')
                        : h.type === 'cardio' ? (h.duration || '0:00') : (h.totalWeight || 0);
    const bigUnit = isCF ? (h.type === 'amrap' ? 'rounds' : h.type === 'fortime' ? 'done' : 'rounds')
                         : h.type === 'cardio' ? 'duration' : 'kg vol';
    const rpeStr = h.rpe ? ` · ${h.rpe}` : '';
    const meta = isCF
      ? `${d} · ${h.cfFormat || h.type} · ${h.duration}`
      : h.type === 'cardio'
      ? `${d} · ${h.distance || '—'}${rpeStr}`
      : `${d} · ${h.sets || 0} sets · ${h.duration}`;

    // Drill-down: show best set per exercise when expanded
    const detailHtml = isExpanded && h.type === 'strength' && h.exercises?.length
      ? `<div class="hi-detail">${
          h.exercises.map(ex => {
            const logs = (ex.logs || []).filter(l => l.weight || l.reps);
            const best = logs.reduce((b, l) => {
              const vol = (parseFloat(l.weight) || 0) * (parseInt(l.reps) || 0);
              return vol > (b.vol || 0) ? { ...l, vol } : b;
            }, {});
            const stat = best.weight ? `${best.weight}kg × ${best.reps || '?'}` : `${ex.sets}×`;
            return `<div class="hi-ex-row"><span>${ex.name}</span><span>${stat}</span></div>`;
          }).join('')
        }</div>`
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
  }).join('');

  listEl.querySelectorAll('.history-item').forEach(item => {
    item.addEventListener('click', () => {
      const idx = parseInt(item.dataset.ridx);
      if (expandedHistory.has(idx)) expandedHistory.delete(idx);
      else expandedHistory.add(idx);
      renderHistory();
    });
  });
}

// ─── PR LOG MODAL ─────────────────────────────────────────────────────────────
const PR_EXERCISES = {
  strength: [
    'Barbell Bench Press', 'Barbell Back Squat', 'Conventional Deadlift',
    'Barbell Overhead Press', 'Barbell Row (Overhand)', 'Weighted Pull-Up',
    'Romanian Deadlift', 'Incline Dumbbell Press', 'Hip Thrust (Barbell)',
  ],
  olympic: [
    'Snatch', 'Clean & Jerk', 'Clean (Squat)', 'Power Clean',
    'Power Snatch', 'Push Jerk', 'Split Jerk', 'Hang Power Clean',
    'Hang Power Snatch', 'Overhead Squat', 'Front Squat',
  ],
};

let prLogTab = 'strength';

function renderPRLogInputs() {
  const prMap = getPRMap();
  const list = PR_EXERCISES[prLogTab] || PR_EXERCISES.strength;
  document.getElementById('pr-log-inputs').innerHTML = list.map(name => `
    <div class="pr-log-row">
      <label class="pr-log-label">${name}</label>
      <div class="pr-log-input-wrap">
        <input type="number" class="pr-log-input" data-ex="${name}"
          placeholder="—" value="${prMap[name] || ''}"
          inputmode="decimal" min="0" step="0.5">
        <span class="pr-log-unit">kg</span>
      </div>
    </div>
  `).join('');
}

function openPRLog() {
  prLogTab = 'strength';
  document.querySelectorAll('.pr-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === prLogTab));
  renderPRLogInputs();
  document.getElementById('pr-log-modal').classList.add('open');
}

document.querySelectorAll('.pr-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    prLogTab = tab.dataset.tab;
    document.querySelectorAll('.pr-tab').forEach(t => t.classList.toggle('active', t === tab));
    renderPRLogInputs();
  });
});

document.getElementById('pr-log-save').addEventListener('click', () => {
  const prMap = getPRMap();
  document.querySelectorAll('.pr-log-input').forEach(input => {
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
document.getElementById('pr-log-modal').addEventListener('click', function(e) {
  if (e.target === this) this.classList.remove('open');
});

// Export CSV
document.getElementById('btn-export').addEventListener('click', () => {
  const history = get('workoutHistory') || [];
  if (!history.length) return;
  const rows = ['Date,Workout,Type,Exercise,Set,Weight(kg),Reps,Duration'];
  history.forEach(h => {
    if (h.type === 'cardio') {
      rows.push(`${h.date},"${h.name}",cardio,,,,,${h.duration}`);
    } else {
      h.exercises?.forEach(ex => {
        ex.logs?.forEach((log, i) => {
          rows.push(`${h.date},"${h.name}",strength,"${ex.name}",${i + 1},${log.weight || ''},${log.reps || ''},${h.duration}`);
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
const BACKUP_KEYS = ['workoutHistory', 'prMap', 'volPRMap', 'customWorkouts', 'userProfile'];

document.getElementById('import-file')?.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (ev) => {
    try {
      const data = JSON.parse(ev.target.result);
      if (!data.version || !data.exported) throw new Error('Not a KILOS TRAINING backup');
      BACKUP_KEYS.forEach(k => { if (data[k] != null) set(k, data[k]); });
      await pushData();
      renderHome(); renderHistory();
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
    document.getElementById('btn-signout').addEventListener('click', async () => {
      await signOut();
      renderDataNotice();
    });
  } else {
    // Signed out — just show the sync CTA (no confusing export/import buttons)
    notice.innerHTML = `
      <div class="dn-top">
        <span class="dn-label">This device only</span>
      </div>
      ${isConfigured
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
      setTimeout(() => document.getElementById('np-signin-username')?.focus(), 120);
    });
  }
}

// Listen for auth state changes (sign-in redirect returns here)
if (supabase) {
  supabase.auth.onAuthStateChange(async (event) => {
    if (event === 'SIGNED_IN') {
      await pullAndMerge();
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
  document.getElementById('ob-view-main').classList.toggle('active', view === 'main');
  document.getElementById('ob-view-custom').classList.toggle('active', view === 'custom');
  // Back button: visible only in custom sub-view
  document.getElementById('ob-back').classList.toggle('hidden', view === 'main');
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
document.getElementById('ob-tiers-main').addEventListener('click', e => {
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
  { id: 'dumbbells',  label: 'Dumbbells' },
  { id: 'barbell',    label: 'Barbell' },
  { id: 'squat-rack', label: 'Squat / Power Rack' },
  { id: 'bench',      label: 'Weight Bench' },
  { id: 'pull-up',    label: 'Pull-up Bar' },
  { id: 'cables',     label: 'Cable Machine' },
  { id: 'bands',      label: 'Resistance Bands' },
  { id: 'kettlebell', label: 'Kettlebells' },
  { id: 'machines',   label: 'Gym Machines' },
  { id: 'dip-bars',   label: 'Dip Bars' },
  { id: 'rings',      label: 'Gymnastic Rings' },
  { id: 'trx',        label: 'TRX / Suspension' },
];

let obSelectedEquipment = new Set();

function renderEquipmentChips() {
  const grid = document.getElementById('ob-eq-grid');
  grid.innerHTML = EQUIPMENT_ITEMS.map(item => `
    <button class="ob-eq-chip${obSelectedEquipment.has(item.id) ? ' selected' : ''}" data-eq="${item.id}">
      ${item.label}
    </button>
  `).join('');
  grid.querySelectorAll('.ob-eq-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const id = chip.dataset.eq;
      if (obSelectedEquipment.has(id)) { obSelectedEquipment.delete(id); chip.classList.remove('selected'); }
      else { obSelectedEquipment.add(id); chip.classList.add('selected'); }
    });
  });
}

function equipmentToTier(selected) {
  const s = [...selected];
  if (s.includes('cables') || s.includes('machines')) return 'full-gym';
  if (s.includes('barbell') && s.includes('squat-rack')) return 'barbell-rack';
  if (s.includes('dumbbells') || s.includes('barbell') || s.includes('kettlebell')) return 'home-dumbbells';
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
    saveProfile({ equipmentTier: 'full-gym', injuries: [], setupComplete: true });
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
  eqGrid.innerHTML = EQUIPMENT_TIERS.map(t => `
    <button class="prof-eq-btn${profile.equipmentTier === t.id ? ' active' : ''}" data-tier="${t.id}">
      <div>
        <div class="prof-eq-name">${t.label}</div>
        <div class="prof-eq-desc">${t.description}</div>
      </div>
      <span class="prof-eq-check">✓</span>
    </button>
  `).join('');
  eqGrid.querySelectorAll('.prof-eq-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      eqGrid.querySelectorAll('.prof-eq-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      saveProfile({ equipmentTier: btn.dataset.tier });
    });
  });

  // Unit toggle
  const toggle = document.getElementById('prof-unit-toggle');
  const kgLabel  = document.getElementById('prof-unit-kg');
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
    renderSetLog(); // update active workout display if any
  };

  // Sync / auth section
  const syncSection = document.getElementById('prof-sync-section');
  if (currentUser) {
    const rawEmail = currentUser.email || '';
    const displayId = rawEmail.endsWith('@kilostraining.app')
      ? rawEmail.replace('@kilostraining.app', '')
      : rawEmail;
    syncSection.innerHTML = `
      <div class="prof-label">ACCOUNT</div>
      <div class="prof-sync-row">
        <span class="prof-sync-label">Signed in as <strong>${displayId}</strong></span>
        <button class="prof-sync-btn danger" id="prof-signout-btn">Sign out</button>
      </div>
    `;
    document.getElementById('prof-signout-btn').addEventListener('click', async () => {
      await signOut();
      closeProfileSheet();
      renderDataNotice();
    });
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
      setTimeout(() => document.getElementById('np-signin-username')?.focus(), 120);
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

function renderProfileBtn() {
  const name = get(NAME_KEY) || '';
  const el = document.getElementById('profile-btn-name');
  if (el) el.textContent = name;
}

document.getElementById('btn-close-profile').addEventListener('click', closeProfileSheet);
document.getElementById('profile-sheet').addEventListener('click', e => {
  if (e.target === document.getElementById('profile-sheet')) closeProfileSheet();
});

// Profile button on home screen → open profile sheet
document.getElementById('btn-profile').addEventListener('click', openProfileSheet);

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
  if (_bwCallback) { const cb = _bwCallback; _bwCallback = null; cb(); }
});

// ─── FEEDBACK ─────────────────────────────────────────────────────────────────
const fbOverlay  = document.getElementById('feedback-sheet');
const fbTextarea = document.getElementById('fb-text');
const fbCount    = document.getElementById('fb-count');
const fbStatus   = document.getElementById('fb-status');
const fbSend     = document.getElementById('fb-send');

document.getElementById('feedback-btn').addEventListener('click', () => {
  fbTextarea.value = '';
  fbCount.textContent = '0';
  fbStatus.textContent = '';
  fbStatus.className = 'fb-status';
  fbOverlay.classList.add('open');
  setTimeout(() => fbTextarea.focus(), 280);
});

document.getElementById('fb-close').addEventListener('click', () => {
  fbOverlay.classList.remove('open');
});

fbOverlay.addEventListener('click', e => {
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
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          name: getUserName() || 'Anonymous',
          message: msg,
          _subject: `KILOS Beta Feedback · ${new Date().toLocaleDateString()}`,
        }),
      });
      ok = res.ok;
    } catch { ok = false; }
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
document.getElementById('btn-coaches-notify')?.addEventListener('click', function () {
  // Open email to coach intake address
  window.location.href = 'mailto:gabe@kilostraining.app?subject=Coach%20Inquiry&body=Hi%20Gabe%2C%20I%27m%20interested%20in%20being%20featured%20on%20KILOS.';
});

// ─── INIT ─────────────────────────────────────────────────────────────────────
// Restore in-progress workout from localStorage (task #1)
if (loadActiveState()) {
  renderHome();           // update Resume button + streak
  renderActiveScreen();   // rebuild active workout UI
}
renderHome();
renderCoaches();
renderProfileBtn();

// Active placeholder → go home
document.getElementById('ap-go-home')?.addEventListener('click', () => goScreen('home'));

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
    } catch { /* malformed — ignore */ }
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
