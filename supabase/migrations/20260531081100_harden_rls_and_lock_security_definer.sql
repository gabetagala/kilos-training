-- Harden the public API surface and optimize RLS on user_data.
-- Applied to the live project on 2026-05-31 (first tracked migration).
-- Semantics are preserved exactly; this only (a) removes API-callability of an
-- internal event-trigger function and (b) makes auth.uid() evaluate once per
-- query instead of once per row.
--
-- Fixes Supabase advisors:
--   • anon/authenticated_security_definer_function_executable (rls_auto_enable)
--   • auth_rls_initplan ×4 (user_data read/insert/update/delete policies)

-- (1) rls_auto_enable() is an event-trigger function that auto-enables RLS on
-- new public tables. It must never be callable via the PostgREST RPC endpoint.
-- Event triggers run with the definer's privileges regardless of EXECUTE
-- grants, so revoking here does NOT affect the auto-RLS behavior.
revoke execute on function public.rls_auto_enable() from public;
revoke execute on function public.rls_auto_enable() from anon;
revoke execute on function public.rls_auto_enable() from authenticated;

-- (2) Recreate the four user_data policies with auth.uid() wrapped in a scalar
-- subselect so Postgres evaluates it once (initplan) rather than per row.
-- Predicates and the (PUBLIC) role binding are identical to before.
drop policy if exists "Users can read their own data" on public.user_data;
create policy "Users can read their own data" on public.user_data
  for select using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own data" on public.user_data;
create policy "Users can insert their own data" on public.user_data
  for insert with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own data" on public.user_data;
create policy "Users can update their own data" on public.user_data
  for update using ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own data" on public.user_data;
create policy "Users can delete their own data" on public.user_data
  for delete using ((select auth.uid()) = user_id);
