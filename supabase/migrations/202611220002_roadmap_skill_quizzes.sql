alter table public.roadmap_tasks add column quiz_skill text;

drop policy if exists "Users can insert own roadmap tasks" on public.roadmap_tasks;
drop policy if exists "Users can update own roadmap tasks" on public.roadmap_tasks;
revoke all on table public.roadmap_tasks from public, anon, authenticated;
grant select on table public.roadmap_tasks to authenticated;
grant select, insert, update, delete on table public.roadmap_tasks to service_role;

-- Roadmap progress comes from task status. Clients can still edit plan details.
drop policy if exists "Users can insert own roadmaps" on public.roadmaps;
revoke insert, update on table public.roadmaps from public, anon, authenticated;
revoke insert (progress_percentage), update (progress_percentage)
  on table public.roadmaps from public, anon, authenticated;
grant update (title, description, duration_weeks, is_active) on table public.roadmaps to authenticated;

create function public.update_owned_roadmap_task(
  p_user_id uuid,
  p_roadmap_id uuid,
  p_task_id uuid,
  p_status public.task_status
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Serialize status changes to the same roadmap so each aggregate sees the previous update.
  perform 1
  from public.roadmaps
  where id = p_roadmap_id and user_id = p_user_id
  for update;

  if not found then
    return false;
  end if;

  update public.roadmap_tasks as task
  set status = p_status,
      completed_at = case
        when p_status <> 'completed' then null
        when task.status = 'completed' then coalesce(task.completed_at, now())
        else now()
      end
  where task.id = p_task_id and task.roadmap_id = p_roadmap_id;

  if not found then
    return false;
  end if;

  update public.roadmaps
  set progress_percentage = (
    select coalesce(round(100.0 * count(*) filter (where status = 'completed') / nullif(count(*), 0)), 0)::integer
    from public.roadmap_tasks
    where roadmap_id = p_roadmap_id
  )
  where id = p_roadmap_id;

  return true;
end;
$$;

revoke all on function public.update_owned_roadmap_task(uuid, uuid, uuid, public.task_status)
  from public, anon, authenticated;
grant execute on function public.update_owned_roadmap_task(uuid, uuid, uuid, public.task_status)
  to service_role;
