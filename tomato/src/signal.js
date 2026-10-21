// Supabase Realtime signaling, secured by the pairing code (crypto.js):
// the topic is a hash of the code and every payload is AES-GCM sealed —
// without the code you can't find the channel, read a handshake, or even
// trigger a 'call'. M1 adds private channels + RLS on top (SCOPE D5).
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../../src/config.js';
import { deriveKeys, seal, unseal } from './crypto.js';

export const isConfigured =
  SUPABASE_URL.startsWith('https://') && !SUPABASE_ANON_KEY.startsWith('YOUR_');

const EVENTS = ['call', 'offer', 'answer', 'ice', 'beacon', 'bye', 'hello'];

// Signaling-only client. No session persistence so these pages never touch
// the Kilos auth storage key (the shared session comes into play at M1).
export async function openSignal(code, onEvent, onStatus) {
  const { topic, key } = await deriveKeys(code);
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const channel = supabase.channel(topic, {
    config: { broadcast: { self: false } },
  });
  for (const event of EVENTS) {
    channel.on('broadcast', { event }, async ({ payload }) => {
      const data = await unseal(key, payload);
      if (data) onEvent(event, data); // wrong-code/tampered → dropped
    });
  }
  channel.subscribe((status) => onStatus(status));
  return {
    async send(event, payload) {
      try {
        channel.send({ type: 'broadcast', event, payload: await seal(key, payload) });
      } catch {
        /* fire-and-forget; reconnect logic re-offers */
      }
    },
  };
}
