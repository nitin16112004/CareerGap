begin;

-- Generated resume writes go through the API so score and export data stay server-owned.
drop policy if exists "Users can insert own generated resumes" on public.generated_resumes;
drop policy if exists "Users can update own generated resumes" on public.generated_resumes;
drop policy if exists "Users can delete own generated resumes" on public.generated_resumes;

revoke all privileges on table public.generated_resumes from public, anon, authenticated;
do $$
declare
  column_row record;
begin
  for column_row in
    select column_name from information_schema.columns
    where table_schema = 'public' and table_name = 'generated_resumes'
  loop
    execute format(
      'revoke all privileges (%I) on public.generated_resumes from public, anon, authenticated',
      column_row.column_name
    );
  end loop;
end;
$$;
grant select on public.generated_resumes to authenticated;
grant all privileges on public.generated_resumes to service_role;

-- The export endpoint authorizes downloads before issuing a short-lived signed URL.
drop policy if exists "Users can upload own generated resumes" on storage.objects;
drop policy if exists "Users can read own generated resumes" on storage.objects;
drop policy if exists "Users can delete own generated resumes" on storage.objects;

commit;
