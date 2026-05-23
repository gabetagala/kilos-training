// ─── Supabase credentials ─────────────────────────────────────────────────────
// Dev:  create .env.local → VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
// Prod: set those same keys as Vercel Environment Variables
// If neither is set the app runs fine — auth/sync silently no-op.

export const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL      || 'YOUR_SUPABASE_URL';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';
