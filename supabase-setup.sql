-- ─────────────────────────────────────────────────────────────────────────────
-- KILOS TRAINING — Supabase schema (baseline)
-- Run this once on a fresh project: Supabase dashboard → SQL Editor → New Query
-- Tracked changes after this baseline live in supabase/migrations/.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Create the user_data table
-- on delete cascade: removing the auth user removes their data row (DPA erasure).
create table if not exists public.user_data (
  user_id   uuid primary key references auth.users(id) on delete cascade,
  data      jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now()
);

-- 2. Row Level Security — each user can only touch their own row.
-- auth.uid() is wrapped in (select …) so it's evaluated once per query, not
-- once per row (see supabase advisor auth_rls_initplan).
alter table public.user_data enable row level security;

create policy "Users can read their own data"
  on public.user_data for select
  using ((select auth.uid()) = user_id);

create policy "Users can insert their own data"
  on public.user_data for insert
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own data"
  on public.user_data for update
  using ((select auth.uid()) = user_id);

create policy "Users can delete their own data"
  on public.user_data for delete
  using ((select auth.uid()) = user_id);

-- 3. Index for fast lookups
create index if not exists user_data_user_id_idx on public.user_data(user_id);
