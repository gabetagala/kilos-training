// ─────────────────────────────────────────────────────────────────────────────
// KILOS TRAINING — supabase.js
// Auth (Google Sign-In) + data sync.
// All Supabase calls are no-ops if config.js still has placeholder values.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config.js';

// Graceful degradation — app works fully without Supabase configured
export const isConfigured =
  SUPABASE_URL !== 'YOUR_SUPABASE_URL' &&
  SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY';

export const supabase = isConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

// ─── localStorage helpers (mirrors main.js, kept local to avoid circular deps)
const _get = (k) => {
  try {
    return JSON.parse(localStorage.getItem(k) || 'null');
  } catch {
    return null;
  }
};
const _set = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {}
};

const SYNC_KEYS = [
  'workoutHistory',
  'prMap',
  'volPRMap',
  'customWorkouts',
  'userProfile',
];

// ─── AUTH ─────────────────────────────────────────────────────────────────────

export async function getSession() {
  if (!supabase) return null;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}

export async function signInWithGoogle() {
  if (!supabase) return;
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
}

// ─── USERNAME / PASSWORD AUTH (Option B) ────────────────────────────────────
// Generates a fake email {username}@grittraining.app so users never see
// an email address. Disable "Email confirmations" in Supabase dashboard
// (Auth → Settings → Email) for instant access with no verification step.
//
// NOTE: The @grittraining.app suffix is DELIBERATELY KEPT despite the KILOS
// rebrand — existing accounts were created with this exact email in Supabase,
// so changing it would lock every current user out. It is internal-only and
// never user-visible, so the stale "grit" string is intentional here.

function usernameToEmail(username) {
  return `${username.toLowerCase().replace(/[^a-z0-9_]/g, '')}@grittraining.app`;
}

export async function signUpWithPassword(displayName, username, password) {
  if (!supabase)
    return { error: { message: 'Sync not configured — data saves locally.' } };
  const email = usernameToEmail(username);
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName, username } },
  });
  return { data, error };
}

export async function signInWithPassword(username, password) {
  if (!supabase)
    return { error: { message: 'Sync not configured — data saves locally.' } };
  const email = usernameToEmail(username);
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
}

export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
}

// ─── SYNC ─────────────────────────────────────────────────────────────────────

const PENDING_SYNC_KEY = 'kilos-pending-sync';

// Mark that a sync is needed (called optimistically — even if offline)
function markPendingSync() {
  try {
    localStorage.setItem(PENDING_SYNC_KEY, '1');
  } catch {}
}
function clearPendingSync() {
  try {
    localStorage.removeItem(PENDING_SYNC_KEY);
  } catch {}
}
export function hasPendingSync() {
  return localStorage.getItem(PENDING_SYNC_KEY) === '1';
}

// Push all local data to Supabase (called after every meaningful action).
// If offline or Supabase unreachable, marks a pending flag and returns silently.
// The pending flag is cleared only after a confirmed successful push.
export async function pushData() {
  if (!supabase) return;
  const session = await getSession();
  if (!session) return;

  // Mark pending before attempting — so if we crash mid-push we retry next time
  markPendingSync();

  const data = {};
  SYNC_KEYS.forEach((k) => {
    data[k] = _get(k);
  });
  const { error } = await supabase.from('user_data').upsert({
    user_id: session.user.id,
    data,
    synced_at: new Date().toISOString(),
  });

  if (!error) clearPendingSync();
}

// Pull remote data and merge with local on sign-in.
// Merge rules:
//   workoutHistory — union (dedupe by date + name, keep all unique sessions)
//   prMap          — take max weight per exercise
//   volPRMap       — take max volume per exercise
//   customWorkouts — union (dedupe by name, local wins on conflict)
//   userProfile    — local wins (most recent device interaction)
export async function pullAndMerge() {
  if (!supabase) return;
  const session = await getSession();
  if (!session) return;

  const { data: row, error } = await supabase
    .from('user_data')
    .select('data')
    .eq('user_id', session.user.id)
    .single();

  // First ever sign-in — no remote data yet, just push local
  if (error || !row?.data) {
    await pushData();
    return;
  }

  const remote = row.data;

  // Workout history — union, dedupe by date+name, sort chronologically
  const localHistory = _get('workoutHistory') || [];
  const remoteHistory = remote.workoutHistory || [];
  const seen = new Set();
  const mergedHistory = [...remoteHistory, ...localHistory]
    .filter((h) => {
      const key = `${h.date}|${h.name}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  _set('workoutHistory', mergedHistory);

  // PRs — take the highest weight recorded on either device
  const localPR = _get('prMap') || {};
  const remotePR = remote.prMap || {};
  const mergedPR = { ...remotePR };
  Object.entries(localPR).forEach(([ex, w]) => {
    mergedPR[ex] = Math.max(mergedPR[ex] || 0, w);
  });
  _set('prMap', mergedPR);

  // Volume PRs — same logic
  const localVol = _get('volPRMap') || {};
  const remoteVol = remote.volPRMap || {};
  const mergedVol = { ...remoteVol };
  Object.entries(localVol).forEach(([ex, v]) => {
    mergedVol[ex] = Math.max(mergedVol[ex] || 0, v);
  });
  _set('volPRMap', mergedVol);

  // Custom workouts — union, dedupe by name (local wins on name conflict)
  const localCW = _get('customWorkouts') || [];
  const remoteCW = remote.customWorkouts || [];
  const localNames = new Set(localCW.map((w) => w.name));
  const mergedCW = [
    ...localCW,
    ...remoteCW.filter((w) => !localNames.has(w.name)),
  ];
  _set('customWorkouts', mergedCW);

  // Profile — keep local unless there's nothing local
  const localProfile = _get('userProfile');
  if (!localProfile && remote.userProfile) {
    _set('userProfile', remote.userProfile);
  }

  // Push the merged result back so both ends stay in sync
  await pushData();
}
