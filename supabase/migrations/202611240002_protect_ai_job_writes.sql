-- The API and queue workers own AI job input, execution status, and billing state.
drop policy if exists "Users can insert own ai jobs" on public.ai_jobs;
drop policy if exists "Users can update own ai jobs" on public.ai_jobs;

revoke all on table public.ai_jobs from public, anon, authenticated;
grant select on table public.ai_jobs to authenticated;
grant select, insert, update, delete on table public.ai_jobs to service_role;
