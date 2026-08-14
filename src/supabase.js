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
  'kilos-checkins',
];

// ─── ACTIVE-SESSION HANDOFF (2026-08-15) ─────────────────────────────────────
// The paused player state rides the cloud row as an ENVELOPE
// { state, deviceId, updatedAt } — `state` is the kilos-rehab-state payload,
// or null as a tombstone after a finish/discard. It is last-writer-wins, not
// a union: two devices can't both be right about one running workout, so the
// newest save is the truth and everything else defers to it. Adoption rules
// (live-session guard, same-run check, the queue-fingerprint gate) live in
// main.js — this layer only carries the newest envelope faithfully.
export const ACTIVE_SYNC_KEY = 'kilos-active-sync';

/** The newer of two envelopes; null-safe. Pure — unit-tested.
 *  RUN IDENTITY OUTRANKS WALL CLOCKS: a tombstone for run R beats any state
 *  save OF run R regardless of stamps — device clocks skew, a run's
 *  identity doesn't. Without this, a laptop lid closing after a phone
 *  finish would bury the tombstone and resurrect a completed workout. */
export function newerEnvelope(a, b) {
  if (!a) return b || null;
  if (!b) return a;
  const aTomb = a.state == null;
  const bTomb = b.state == null;
  if (aTomb !== bTomb) {
    const tomb = aTomb ? a : b;
    const live = aTomb ? b : a;
    if (tomb.runId && tomb.runId === live.state?.runId) return tomb;
  }
  return (b.updatedAt || 0) > (a.updatedAt || 0) ? b : a;
}

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

// Permanently delete the signed-in user's account and all synced cloud data.
// Calls the delete-account edge function (service-role delete of the auth user,
// which cascades to user_data), then signs out and clears the synced keys from
// this device so nothing is left pointing at a deleted account. Returns
// { error } on failure; resolves on success.
export async function deleteAccount() {
  if (!supabase)
    return {
      error: { message: 'Sync not configured — no account to delete.' },
    };
  const session = await getSession();
  if (!session) return { error: { message: 'Not signed in.' } };

  const { data, error } = await supabase.functions.invoke('delete-account', {
    method: 'POST',
  });
  if (error || data?.error) {
    return { error: error || { message: data.error } };
  }

  // Tear down the local session + synced data; the device keeps no orphan state.
  clearPendingSync();
  await supabase.auth.signOut();
  try {
    localStorage.removeItem(ACTIVE_SYNC_KEY);
  } catch {}
  SYNC_KEYS.forEach((k) => {
    try {
      localStorage.removeItem(k);
    } catch {}
  });
  return { success: true };
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

// Loss-free merge of a remote row's RECORDS into local: union workout history &
// check-ins & custom workouts, max PRs. Deliberately does NOT touch userProfile —
// the profile has caller-specific rules (see pullAndMerge). Writes to localStorage.
function mergeRecords(remote) {
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

  // Check-ins — union by date, local wins on a same-date conflict
  const localCI = _get('kilos-checkins') || [];
  const remoteCI = remote['kilos-checkins'] || [];
  const localDates = new Set(localCI.map((e) => e.date));
  const mergedCI = [
    ...localCI,
    ...remoteCI.filter((e) => !localDates.has(e.date)),
  ].sort((a, b) => (a.date < b.date ? -1 : 1));
  _set('kilos-checkins', mergedCI);
}

// Push all local data to Supabase (called after every meaningful action).
// MERGE-BEFORE-PUSH: read the current cloud row and fold it into local FIRST, so
// an upsert can never wipe records this device never saw (two-device sync) or
// overwrite the cloud backup with near-empty local state after an earlier failed
// pull. If offline / unreachable, the pending flag is left set to retry later.
export async function pushData() {
  if (!supabase) return;
  const session = await getSession();
  if (!session) return;

  // Mark pending before attempting — so if we crash mid-push we retry next time
  markPendingSync();

  // Read the current cloud row and merge it into local before writing back.
  // A failed READ must NEVER be followed by a write — that is the overwrite bug.
  const { data: row, error: readErr } = await supabase
    .from('user_data')
    .select('data')
    .eq('user_id', session.user.id)
    .maybeSingle();
  if (readErr) return; // leave pending; retry later — do not overwrite the cloud
  if (row?.data) mergeRecords(row.data); // union/max remote records into local

  const data = {};
  SYNC_KEYS.forEach((k) => {
    data[k] = _get(k);
  });
  // Active-session handoff: carry the NEWEST envelope, and keep the local
  // copy caught up so adoption on this device sees what the cloud sees.
  const activeEnv = newerEnvelope(_get(ACTIVE_SYNC_KEY), row?.data?.activeSession);
  if (activeEnv) {
    data.activeSession = activeEnv;
    _set(ACTIVE_SYNC_KEY, activeEnv);
  }
  // Internal-only marker never belongs in the cloud copy.
  if (data.userProfile?._signinSeed) {
    data.userProfile = { ...data.userProfile };
    delete data.userProfile._signinSeed;
  }
  // Belt for the overwrite class of bugs: an entirely empty payload can never
  // improve the cloud copy — refuse to upsert nothing over something.
  const allEmpty = SYNC_KEYS.every((k) => {
    const v = data[k];
    return (
      v == null ||
      (Array.isArray(v) && v.length === 0) ||
      (typeof v === 'object' &&
        !Array.isArray(v) &&
        Object.keys(v).length === 0)
    );
  });
  if (allEmpty && !data.activeSession) {
    clearPendingSync();
    return;
  }
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
//   prMap / volPRMap — take max per exercise
//   customWorkouts — union (dedupe by name, local wins on conflict)
//   kilos-checkins — union (dedupe by date, local wins on same-date conflict)
//   userProfile    — cloud is authoritative on sign-in (adopt remote when local
//                    is absent or is just the sign-in seed); a genuine local edit
//                    is preserved and pushed up instead.
export async function pullAndMerge() {
  if (!supabase) return;
  const session = await getSession();
  if (!session) return;

  const { data: row, error } = await supabase
    .from('user_data')
    .select('data')
    .eq('user_id', session.user.id)
    .maybeSingle();

  // A transient failure (timeout, 5xx, rate limit) must NEVER be mistaken for
  // "first ever sign-in" — pushing here would overwrite the user's cloud
  // backup with this device's (possibly empty) state. Leave the pending flag
  // so the next retry pulls again (retrySyncIfNeeded routes through pullAndMerge).
  if (error) {
    markPendingSync();
    return;
  }
  // True first sign-in — genuinely no remote row yet, seed it from local
  if (!row?.data) {
    await pushData();
    return;
  }

  const remote = row.data;
  mergeRecords(remote);

  // Active-session handoff: keep the newest envelope locally; main.js
  // decides whether this device actually adopts it (rhAdoptCloudSession).
  const activeEnv = newerEnvelope(_get(ACTIVE_SYNC_KEY), remote.activeSession);
  if (activeEnv) _set(ACTIVE_SYNC_KEY, activeEnv);

  // Profile — on sign-in the cloud profile is authoritative for the user's real
  // settings (equipment tier, injuries). Adopt it when the local profile is
  // absent or is just the sign-in seed; keep setupComplete so a returning user
  // never re-enters onboarding. A genuine local profile (offline edit) is kept.
  const localProfile = _get('userProfile');
  if (remote.userProfile && (!localProfile || localProfile._signinSeed)) {
    const merged = { ...remote.userProfile, setupComplete: true };
    delete merged._signinSeed;
    _set('userProfile', merged);
  }

  // Push the merged result back so both ends stay in sync
  await pushData();
}
