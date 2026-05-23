import { EXERCISES_DB, COACHES_DATA, SHUFFLE_PLANS, MUSCLES, MUSCLES_ALL } from './data.js';
import {
  EQUIPMENT_TIERS, INJURY_TYPES,
  getProfile, saveProfile, getActiveProfile, resolveExercise,
} from './personalization.js';
import {
  supabase, isConfigured,
  getSession, signInWithGoogle, signOut,
  pushData, pullAndMerge,
} from './supabase.js';

// ─── STORAGE ──────────────────────────────────────────────────────────────────
const get = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
const set = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

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

// ── CrossFit build state ──────────────────────────────────────────────────────
let cfFormat = 'emom';  // 'emom' | 'amrap' | 'rounds' | 'fortime'
let cfMovements = [];   // [{name, reps}]

// ── CrossFit active state ─────────────────────────────────────────────────────
let cfCurrentRound  = 0;
let cfRoundsCompleted = 0;
let cfMovementsDone = new Set(); // indices complete in current round
let cfRoundLog      = [];        // [bool] one per EMOM round

// (ring removed — bold type timer)

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
  if (!map[exerciseName] || weight > map[exerciseName]) {
    map[exerciseName] = weight;
    set('prMap', map);
    return true;
  }
  return false;
}

// Volume PR — fires when weight × reps beats the previous best single-set volume.
// Catches progression that weight-only tracking misses (same weight, more reps = real gain).
function checkAndUpdateVolPR(exerciseName, weight, reps) {
  if (!weight || !reps || weight <= 0 || reps <= 0) return false;
  const vol = weight * reps;
  const map = get('volPRMap') || {};
  if (!map[exerciseName] || vol > map[exerciseName]) {
    map[exerciseName] = vol;
    set('volPRMap', map);
    return true;
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
}

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
function renderHome() {
  renderWeekStrip();
  renderMuscleFrequency();
  renderRecent();
  updateStreak();
  renderDataNotice();
  document.getElementById('resume-sub').textContent = activeWorkout ? activeWorkout.name : 'No active session';

  // Profile indicator
  const profile = getActiveProfile();
  const tier = EQUIPMENT_TIERS.find(t => t.id === profile.equipmentTier);
  const tierLabel = tier ? tier.label : 'Full Gym';
  const injuryLabel = profile.injuries.length ? ` · ${profile.injuries.length} limitation${profile.injuries.length > 1 ? 's' : ''}` : '';
  let tag = document.getElementById('profile-tag');
  if (!tag) {
    tag = document.createElement('div');
    tag.id = 'profile-tag';
    tag.className = 'profile-tag';
    const header = document.querySelector('.home-header');
    header.insertAdjacentElement('afterend', tag);
  }
  tag.textContent = `${tierLabel}${injuryLabel}`;
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
  const today = new Date(); today.setHours(0, 0, 0, 0);
  for (let i = 0; i < 60; i++) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    const found = history.find(h => {
      const hd = new Date(h.date); hd.setHours(0, 0, 0, 0);
      return hd.getTime() === d.getTime();
    });
    if (found) streak++;
    else if (i > 0) break;
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

document.getElementById('btn-shuffle').addEventListener('click', openShuffle);
document.getElementById('btn-custom').addEventListener('click', () => goScreen('build'));
document.getElementById('btn-coaches-home').addEventListener('click', () => goScreen('coaches'));
document.getElementById('btn-resume').addEventListener('click', () => {
  if (activeWorkout) goScreen('active');
  else goScreen('build');
});

// ─── COACHES ──────────────────────────────────────────────────────────────────
function renderCoaches() {
  const tabsEl   = document.getElementById('coach-tabs');
  const contentEl = document.getElementById('coach-content');
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
  goScreen('active');
}

// ─── BUILD ────────────────────────────────────────────────────────────────────
function renderBuild() {
  // Mode toggle
  document.querySelectorAll('.build-mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === buildMode);
  });
  document.getElementById('strength-section').style.display   = buildMode === 'strength'  ? '' : 'none';
  document.getElementById('cardio-section').style.display     = buildMode === 'cardio'    ? '' : 'none';
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
    // Keep start button visible in cardio mode (no exercises needed)
    startWrap.style.display = buildMode === 'cardio' ? 'block' : 'none';
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
    const startWrap = document.getElementById('build-start-wrap');
    startWrap.style.display = buildMode === 'cardio' ? 'block' : 'none';
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
  const name = document.getElementById('custom-name').value || (buildMode === 'cardio' ? 'Cardio Session' : buildMode === 'crossfit' ? 'My WOD' : 'My Workout');

  if (buildMode === 'cardio') {
    const cardioType = document.querySelector('input[name="cardio-type"]:checked')?.value || 'Run';
    const cardioTarget = document.getElementById('cardio-target').value;
    const cardioNotes = document.getElementById('cardio-notes').value;
    beginCardioWorkout(`${cardioType}${cardioTarget ? ' · ' + cardioTarget : ''}`, cardioType, cardioTarget, cardioNotes);
    return;
  }

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
  goScreen('active');
}

function beginCardioWorkout(name, cardioType, target, notes) {
  newPRsThisSession = [];
  activeWorkout = { name, type: 'cardio', cardioType, target, notes, startTime: Date.now() };
  workoutStartTime = Date.now();
  totalWeightMoved = 0;
  sessionSets = 0;
  stopTimer();
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

function renderActiveScreen() {
  if (!activeWorkout) {
    showStrengthUI(true);
    showCFUI(false);
    showCardioUI(false);
    document.getElementById('current-ex-name').textContent = 'No active workout';
    document.getElementById('current-ex-sets').textContent = 'Pick a program or build your own';
    document.getElementById('ex-nav-pills').innerHTML = '';
    document.getElementById('set-log-rows').innerHTML = '';
    resetTimerDisplay(0);
    return;
  }

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
  pills.innerHTML = activeWorkout.exercises.map((_, i) => `
    <div class="ex-nav-pill${i === currentExIdx ? ' active' : ''}" data-idx="${i}"></div>
  `).join('');
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
    document.querySelector('.set-log-title').insertAdjacentElement('afterend', warmupEl);
  }
}

function renderSetLog() {
  const ex = activeWorkout.exercises[currentExIdx];
  const lastSession = getLastSession(ex.name);
  const suggestion = suggestNextWeight(lastSession, ex.reps);
  const rows = document.getElementById('set-log-rows');
  rows.innerHTML = (suggestion
    ? `<div class="overload-hint">→ Try ${suggestion}kg today</div>`
    : '') + ex.logs.map((log, i) => {
    const prev = lastSession?.[i];
    const wPlaceholder = prev?.weight ? `${prev.weight}` : 'kg';
    const rPlaceholder = prev?.reps ? `${prev.reps}` : ex.reps;
    const prevHint = prev?.weight ? `<span class="log-prev">Last: ${prev.weight}kg × ${prev.reps}</span>` : '';
    return `<div class="log-row">
      <span class="log-set-num">${i + 1}</span>
      <input class="log-input" type="number" placeholder="${wPlaceholder}" value="${log.weight}"
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
      activeWorkout.exercises[currentExIdx].logs[parseInt(input.dataset.idx)][input.dataset.field] = input.value;
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
  }
  renderSetLog();
}

document.getElementById('btn-prev-ex').addEventListener('click', () => {
  if (!activeWorkout || activeWorkout.type === 'cardio' || currentExIdx <= 0) return;
  currentExIdx--; currentSetIdx = 0; stopTimer(); renderCurrentExercise(); renderExNav();
});
document.getElementById('btn-next-ex').addEventListener('click', () => {
  if (!activeWorkout || activeWorkout.type === 'cardio' || currentExIdx >= activeWorkout.exercises.length - 1) return;
  currentExIdx++; currentSetIdx = 0; stopTimer(); renderCurrentExercise(); renderExNav();
});
document.getElementById('nav-prev').addEventListener('click', () => document.getElementById('btn-prev-ex').click());
document.getElementById('nav-next').addEventListener('click', () => document.getElementById('btn-next-ex').click());

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
document.getElementById('btn-finish').addEventListener('click', finishWorkout);

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

  showShareCard(completed, durationStr, entry);
  activeWorkout = null;
}

function showShareCard(workout, duration, entry) {
  document.getElementById('sc-date').textContent = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  document.getElementById('sc-workout-name').textContent = workout.name;

  const prBadge = newPRsThisSession.length
    ? `<div class="sc-pr-badge">+${newPRsThisSession.length} PR${newPRsThisSession.length > 1 ? 's' : ''}</div>`
    : '';

  const isCFWorkout = CF_TYPES.has(workout.type);
  if (isCFWorkout) {
    const roundsVal = workout.type === 'amrap' ? cfRoundsCompleted : cfCurrentRound;
    const roundsLbl = workout.type === 'amrap' ? 'Rounds' : 'Rounds done';
    document.getElementById('sc-stats').innerHTML = `
      <div class="sc-stat"><div class="val">${duration}</div><div class="lbl">Duration</div></div>
      <div class="sc-stat"><div class="val">${roundsVal}</div><div class="lbl">${roundsLbl}</div></div>
      <div class="sc-stat"><div class="val">${workout.cf?.badge || workout.type.toUpperCase()}</div><div class="lbl">Format</div></div>
    `;
    const movs = workout.cf?.movements || [];
    document.getElementById('sc-exercise-list').innerHTML = prBadge + movs
      .slice(0, 5)
      .map(m => `<div class="sc-ex-item"><span>${m.name}</span><span>${m.reps ? m.reps + ' reps' : (m.note || '')}</span></div>`)
      .join('');
  } else if (workout.type === 'cardio') {
    document.getElementById('sc-stats').innerHTML = `
      <div class="sc-stat"><div class="val">${duration}</div><div class="lbl">Duration</div></div>
      <div class="sc-stat"><div class="val">${entry.distance || '—'}</div><div class="lbl">Distance</div></div>
      <div class="sc-stat"><div class="val">${workout.cardioType || 'Cardio'}</div><div class="lbl">Type</div></div>
    `;
    document.getElementById('sc-exercise-list').innerHTML = prBadge;
  } else {
    document.getElementById('sc-stats').innerHTML = `
      <div class="sc-stat"><div class="val">${Math.round(totalWeightMoved)}</div><div class="lbl">KG Volume</div></div>
      <div class="sc-stat"><div class="val">${sessionSets}</div><div class="lbl">Sets Done</div></div>
      <div class="sc-stat"><div class="val">${duration}</div><div class="lbl">Duration</div></div>
    `;
    document.getElementById('sc-exercise-list').innerHTML = prBadge + workout.exercises
      .slice(0, 5)
      .map(e => `<div class="sc-ex-item"><span>${e.name}</span><span>${e.sets} sets</span></div>`)
      .join('');
  }
  document.getElementById('share-modal').classList.add('open');
}

document.getElementById('btn-share').addEventListener('click', () => {
  const name = document.getElementById('sc-workout-name').textContent;
  const text = `Just finished ${name} on KILOS TRAINING — #kilostraining #kilostrainingapp`;
  if (navigator.share) {
    navigator.share({ title: 'KILOS TRAINING', text }).catch(() => {});
  } else {
    navigator.clipboard?.writeText(text);
    document.getElementById('btn-share').textContent = 'Copied!';
    setTimeout(() => { document.getElementById('btn-share').textContent = 'Share'; }, 1500);
  }
  document.getElementById('share-modal').classList.remove('open');
  goScreen('home');
});
document.getElementById('btn-close-share').addEventListener('click', () => {
  document.getElementById('share-modal').classList.remove('open');
  goScreen('home');
});

// ─── HISTORY ──────────────────────────────────────────────────────────────────
const expandedHistory = new Set();

function renderHistory() {
  const history = get('workoutHistory') || [];
  const prMap = getPRMap();
  const prs = Object.entries(prMap).filter(([, v]) => v > 0);
  document.getElementById('pr-count').textContent = `${prs.length} PRs`;

  document.getElementById('pr-row').innerHTML = prs
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, val]) => `
      <div class="pr-card">
        <div class="pr-val">${val}kg</div>
        <div class="pr-label">${name.split(' ').slice(-1)[0]}</div>
      </div>
    `).join('');

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

// ─── BACKUP / RESTORE + AUTH ──────────────────────────────────────────────────
const BACKUP_KEYS = ['workoutHistory', 'prMap', 'volPRMap', 'customWorkouts', 'userProfile'];

// JSON export — manual fallback, always available regardless of auth state
document.getElementById('btn-export-json').addEventListener('click', () => {
  const data = { version: 1, exported: new Date().toISOString() };
  BACKUP_KEYS.forEach(k => { data[k] = get(k) || null; });
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `kilos-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  const btn = document.getElementById('btn-export-json');
  btn.textContent = 'Saved ✓';
  setTimeout(() => { btn.textContent = 'Export backup'; }, 1800);
});

document.getElementById('btn-import-json').addEventListener('click', () => {
  document.getElementById('import-file').click();
});

document.getElementById('import-file').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (ev) => {
    try {
      const data = JSON.parse(ev.target.result);
      if (!data.version || !data.exported) throw new Error('Not a KILOS TRAINING backup');
      BACKUP_KEYS.forEach(k => { if (data[k] != null) set(k, data[k]); });
      // If signed in, push the restored data to the cloud immediately
      await pushData();
      const btn = document.getElementById('btn-import-json');
      btn.textContent = 'Restored ✓';
      setTimeout(() => { btn.textContent = 'Restore'; renderHome(); renderHistory(); }, 1200);
    } catch {
      const btn = document.getElementById('btn-import-json');
      btn.textContent = 'Invalid file';
      setTimeout(() => { btn.textContent = 'Restore'; }, 2000);
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
    // Signed in — show email and sign out option
    const email = currentUser.email || 'Google account';
    notice.innerHTML = `
      <div class="dn-top">
        <span class="dn-label">Synced · ${email}</span>
        <div class="dn-btns">
          <button class="dn-btn" id="btn-export-json">Export backup</button>
          <button class="dn-btn dn-signout" id="btn-signout">Sign out</button>
        </div>
      </div>
      <div class="dn-sub">Your data is backed up automatically</div>
      <input type="file" id="import-file" accept=".json" style="display:none">
    `;
    document.getElementById('btn-export-json').addEventListener('click', () => {
      const data = { version: 1, exported: new Date().toISOString() };
      BACKUP_KEYS.forEach(k => { data[k] = get(k) || null; });
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `kilos-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click(); URL.revokeObjectURL(url);
    });
    document.getElementById('btn-signout').addEventListener('click', async () => {
      await signOut();
      renderDataNotice();
    });
  } else {
    // Signed out — show sign-in CTA + manual backup as fallback
    notice.innerHTML = `
      <div class="dn-top">
        <span class="dn-label">This device only</span>
        <div class="dn-btns">
          <button class="dn-btn" id="btn-export-json">Export backup</button>
          <button class="dn-btn" id="btn-import-json">Restore</button>
        </div>
      </div>
      ${isConfigured
        ? `<button class="dn-google-btn" id="btn-google-signin">
             <svg width="14" height="14" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
             Continue with Google
           </button>
           <div class="dn-sub">One tap · no password · no catch · skip if you want</div>`
        : `<div class="dn-sub">Google Sign-In coming — one tap, no password, no catch</div>`
      }
      <input type="file" id="import-file" accept=".json" style="display:none">
    `;
    document.getElementById('btn-export-json')?.addEventListener('click', () => {
      const data = { version: 1, exported: new Date().toISOString() };
      BACKUP_KEYS.forEach(k => { data[k] = get(k) || null; });
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `kilos-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click(); URL.revokeObjectURL(url);
    });
    document.getElementById('btn-import-json')?.addEventListener('click', () => {
      document.getElementById('import-file').click();
    });
    document.getElementById('import-file')?.addEventListener('change', (e) => {
      const file = e.target.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target.result);
          if (!data.version || !data.exported) throw new Error();
          BACKUP_KEYS.forEach(k => { if (data[k] != null) set(k, data[k]); });
          renderHome(); renderHistory();
        } catch { alert('Not a valid KILOS TRAINING backup file.'); }
        e.target.value = '';
      };
      reader.readAsText(file);
    });
    document.getElementById('btn-google-signin')?.addEventListener('click', signInWithGoogle);
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
let obStep = 0;
let obTier = null;
let obInjuries = [];

function openOnboarding() {
  const profile = getProfile();
  obStep = 0;
  obTier = profile.equipmentTier || null;
  obInjuries = [...(profile.injuries || [])];
  renderObStep();
  document.getElementById('onboarding-modal').classList.add('open');
}

function renderObStep() {
  // Step dots
  document.querySelectorAll('.ob-step').forEach((dot, i) => {
    dot.classList.toggle('done', i < obStep);
    dot.style.background = i === obStep ? 'var(--white)' : i < obStep ? 'var(--grey2)' : 'var(--grey2)';
    // active step dot is white
    dot.style.background = i <= obStep ? 'var(--white)' : 'var(--grey2)';
  });

  // Pages
  document.querySelectorAll('.ob-page').forEach((p, i) => {
    p.classList.toggle('active', i === obStep);
  });

  // CTA + skip
  const nextBtn = document.getElementById('ob-next');
  const skipEl = document.getElementById('ob-skip');

  if (obStep === 0) {
    nextBtn.textContent = 'Continue →';
    nextBtn.disabled = !obTier;
    skipEl.textContent = 'Skip setup';
    skipEl.style.display = 'block';
    renderObTiers();
  } else if (obStep === 1) {
    nextBtn.textContent = 'Continue →';
    nextBtn.disabled = false;
    skipEl.textContent = 'No injuries — skip';
    skipEl.style.display = 'block';
    renderObInjuryChips();
  } else {
    nextBtn.textContent = 'Start Training →';
    nextBtn.disabled = false;
    skipEl.style.display = 'none';
  }
}

function renderObTiers() {
  const el = document.getElementById('ob-tiers');
  el.innerHTML = EQUIPMENT_TIERS.map(t => `
    <div class="ob-tier-card${obTier === t.id ? ' selected' : ''}" data-tier="${t.id}">
      <div class="ob-tier-name">${t.label}</div>
      <div class="ob-tier-desc">${t.description}</div>
    </div>
  `).join('');
  el.querySelectorAll('.ob-tier-card').forEach(card => {
    card.addEventListener('click', () => {
      obTier = card.dataset.tier;
      el.querySelectorAll('.ob-tier-card').forEach(c => c.classList.toggle('selected', c === card));
      document.getElementById('ob-next').disabled = false;
    });
  });
}

function renderObInjuryChips() {
  const el = document.getElementById('ob-injuries');
  el.innerHTML = INJURY_TYPES.map(inj => `
    <div class="ob-injury-chip${obInjuries.includes(inj.id) ? ' selected' : ''}" data-injury="${inj.id}">
      ${inj.label}
    </div>
  `).join('');
  el.querySelectorAll('.ob-injury-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const id = chip.dataset.injury;
      if (obInjuries.includes(id)) {
        obInjuries = obInjuries.filter(x => x !== id);
        chip.classList.remove('selected');
      } else {
        obInjuries.push(id);
        chip.classList.add('selected');
      }
    });
  });
}

function closeOnboarding() {
  document.getElementById('onboarding-modal').classList.remove('open');
}

function completeOnboarding() {
  saveProfile({
    equipmentTier: obTier || 'full-gym',
    injuries: obInjuries,
    setupComplete: true,
    setupDate: new Date().toISOString(),
  });
  closeOnboarding();
  renderHome(); // refresh profile tag
}

document.getElementById('ob-next').addEventListener('click', () => {
  if (obStep < 2) {
    obStep++;
    renderObStep();
  } else {
    completeOnboarding();
  }
});

document.getElementById('ob-skip').addEventListener('click', () => {
  if (obStep === 0) {
    // Skip entire onboarding — default to Full Gym, no injuries
    obTier = 'full-gym';
    obInjuries = [];
    completeOnboarding();
  } else if (obStep === 1) {
    // Skip injuries only — keep selected tier, move to confirmation
    obInjuries = [];
    obStep = 2;
    renderObStep();
  }
});

// Profile button on home screen
document.getElementById('btn-profile').addEventListener('click', openOnboarding);

// ─── INIT ─────────────────────────────────────────────────────────────────────
renderHome();
renderCoaches();

// Show onboarding on first launch (after a brief delay for the home screen to render)
setTimeout(() => {
  const profile = getProfile();
  if (!profile.setupComplete) {
    openOnboarding();
  }
}, 200);
