// HOTMUM — cloud backup for Sam's progress.
//
// Reuses the KILOS Supabase project, client and auth. NO schema change and no
// dashboard work: public.user_data is generic (one jsonb row per user, RLS on
// auth.uid()), so Sam signing up in-app gets her own row and her own data,
// invisible to Gabe's account and vice versa.
//
// Her keys are namespaced under `hotmum` INSIDE the jsonb, so the same row
// could hold both apps if an account were ever shared.
//
// LOCAL-FIRST IS NOT NEGOTIABLE (CLAUDE.md): every one of these calls is
// fire-and-forget. Nothing in the logging loop ever waits on the network, and
// with no Supabase env configured the whole module quietly no-ops.

import {
  getSession,
  isConfigured,
  signInWithPassword,
  signOut,
  signUpWithPassword,
  supabase,
} from '../supabase.js';

const NS = 'hotmum';
const KEYS = ['hotmum-history', 'hotmum-profile'];
const PENDING = 'hotmum-pending-sync';
const SYNCED_AT = 'hotmum-synced-at';

const read = (k) => {
  try {
    return JSON.parse(localStorage.getItem(k) || 'null');
  } catch {
    return null;
  }
};
const write = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* private mode */
  }
};

export const syncAvailable = () => isConfigured;
export const pendingSync = () => localStorage.getItem(PENDING) === '1';
export const lastSynced = () => read(SYNCED_AT);

export { getSession, signInWithPassword, signOut, signUpWithPassword };

function snapshot() {
  const out = {};
  for (const k of KEYS) {
    const v = read(k);
    if (v !== null) out[k] = v;
  }
  return out;
}

// History is append-only in practice, so a union keyed on the log timestamp is
// the whole merge. Two devices can both be offline and neither loses a session.
function mergeHistory(local = [], remote = []) {
  const byKey = new Map();
  for (const h of [...remote, ...local]) {
    byKey.set(`${h.at || ''}|${h.date}|${h.kind}|${h.sessionId || ''}`, h);
  }
  return [...byKey.values()].sort((a, b) => (a.at || 0) - (b.at || 0));
}

/** Push local state up. Never throws; marks pending and moves on if offline. */
export async function push() {
  if (!supabase) return false;
  const session = await getSession();
  if (!session) return false;
  try {
    const { data: row } = await supabase
      .from('user_data')
      .select('data')
      .eq('user_id', session.user.id)
      .maybeSingle();

    const merged = { ...(row?.data || {}), [NS]: snapshot() };
    const { error } = await supabase.from('user_data').upsert({
      user_id: session.user.id,
      data: merged,
      synced_at: new Date().toISOString(),
    });
    if (error) throw error;
    localStorage.removeItem(PENDING);
    write(SYNCED_AT, Date.now());
    return true;
  } catch {
    localStorage.setItem(PENDING, '1');
    return false;
  }
}

/** Pull remote state and merge it into local. Local never loses a session. */
export async function pullAndMerge() {
  if (!supabase) return false;
  const session = await getSession();
  if (!session) return false;
  try {
    const { data: row } = await supabase
      .from('user_data')
      .select('data')
      .eq('user_id', session.user.id)
      .maybeSingle();

    const remote = row?.data?.[NS];
    if (!remote) return push(); // first device up — seed the row

    write(
      'hotmum-history',
      mergeHistory(
        read('hotmum-history') || [],
        remote['hotmum-history'] || [],
      ),
    );
    // Settings: whatever is on the device wins, so changing them on her phone
    // is never undone by a stale row.
    if (!read('hotmum-profile') && remote['hotmum-profile']) {
      write('hotmum-profile', remote['hotmum-profile']);
    }
    write(SYNCED_AT, Date.now());
    return true;
  } catch {
    return false;
  }
}

// Fire-and-forget, coalesced — a burst of writes results in one round trip and
// the caller is never made to wait.
let timer = 0;
export function queuePush() {
  if (!supabase) return;
  localStorage.setItem(PENDING, '1');
  clearTimeout(timer);
  timer = setTimeout(() => {
    push();
  }, 1500);
}

/** On boot: if she's signed in, reconcile in the background. */
export async function syncOnStart() {
  if (!supabase) return;
  const session = await getSession();
  if (!session) return;
  await pullAndMerge();
  if (pendingSync()) push();
}
