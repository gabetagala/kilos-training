// Supabase Realtime signaling for Bantay (M0: one hardcoded public channel).
// M1 replaces the hardcoded topic with a pairing code + private channel + RLS
// pinned to the owner's auth.uid() — see SCOPE.md D5.
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../../src/config.js';

export const isConfigured =
  SUPABASE_URL.startsWith('https://') && !SUPABASE_ANON_KEY.startsWith('YOUR_');

const TOPIC = 'bantay-m0';
const EVENTS = ['call', 'offer', 'answer', 'ice'];

// Signaling-only client. No session persistence so these pages never touch the
// Kilos auth storage key (the shared session comes into play at M1).
export function openSignal(onEvent, onStatus) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const channel = supabase.channel(TOPIC, {
    config: { broadcast: { self: false } },
  });
  for (const event of EVENTS) {
    channel.on('broadcast', { event }, ({ payload }) => onEvent(event, payload));
  }
  channel.subscribe((status) => onStatus(status));
  return {
    send(event, payload) {
      channel.send({ type: 'broadcast', event, payload }).catch(() => {});
    },
  };
}
