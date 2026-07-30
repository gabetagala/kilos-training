// Pairing-code security. The media itself is always DTLS-SRTP encrypted by
// WebRTC (no unencrypted mode exists) and host-only ICE keeps it on the LAN;
// this module protects the SIGNALING: the channel topic is a hash of the
// code (the code never appears on the wire or in Supabase logs), and every
// signaling payload is AES-GCM sealed with a key derived from the code —
// wrong-code or tampered messages simply fail to open and are dropped.
const enc = new TextEncoder();
const dec = new TextDecoder();

// 6 digits — numpad-fast to type. The entropy tradeoff is deliberate:
// joining still needs the project URL + anon key, join attempts are
// rate-limited, media needs to be ON the home LAN (host-only ICE), and M1
// private channels + RLS make the code a convenience, not the wall.
export function genCode() {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return String(n).padStart(6, '0');
}

export const normalizeCode = (s) => s.replace(/\D/g, '');
export const formatCode = (s) => `${s.slice(0, 3)} ${s.slice(3)}`;

export async function deriveKeys(code) {
  const topicHash = await crypto.subtle.digest('SHA-256', enc.encode(`bantay-topic-v1:${code}`));
  const topic = `bantay-${hex(new Uint8Array(topicHash).slice(0, 8))}`;
  const keyHash = await crypto.subtle.digest('SHA-256', enc.encode(`bantay-key-v1:${code}`));
  const key = await crypto.subtle.importKey('raw', keyHash, 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ]);
  return { topic, key };
}

export async function seal(key, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(JSON.stringify(obj)),
  );
  return { iv: b64(iv), ct: b64(new Uint8Array(ct)) };
}

export async function unseal(key, payload) {
  try {
    const pt = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: unb64(payload.iv) },
      key,
      unb64(payload.ct),
    );
    return JSON.parse(dec.decode(pt));
  } catch {
    return null; // wrong code or tampered — drop silently
  }
}

const hex = (u8) => [...u8].map((b) => b.toString(16).padStart(2, '0')).join('');
const b64 = (u8) => btoa(String.fromCharCode(...u8));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
