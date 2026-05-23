-- ─────────────────────────────────────────────────────────────────────────────
-- KILOS TRAINING — Supabase schema
-- Run this once in: Supabase dashboard → SQL Editor → New Query
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Create the user_data table
create table if not exists public.user_data (
  user_id   uuid primary key references auth.users(id) on delete cascade,
  data      jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now()
);

-- 2. Row Level Security — each user can only touch their own row
alter table public.user_data enable row level security;

create policy "Users can read their own data"
  on public.user_data for select
  using (auth.uid() = user_id);

create policy "Users can insert their own data"
  on public.user_data for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own data"
  on public.user_data for update
  using (auth.uid() = user_id);

create policy "Users can delete their own data"
  on public.user_data for delete
  using (auth.uid() = user_id);

-- 3. Index for fast lookups
create index if not exists user_data_user_id_idx on public.user_data(user_id);
