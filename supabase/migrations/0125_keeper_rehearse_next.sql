-- A rehearsal takes the next drafts nobody has rehearsed, or the last rehearsal's drafts again
-- (keeper-task-01-shop-drafts.md). A rehearsal writes nothing, so without this every rehearsal takes the same
-- oldest drafts. A real run is unchanged: every draft not yet checked.

drop function if exists start_keeper_run(uuid, text, text, numeric, boolean, integer);

create or replace function start_keeper_run(
  p_tenant uuid, p_task text, p_pace text, p_cap_pence numeric, p_rehearsal boolean default false,
  p_limit integer default null, p_pick text default 'next'
)
returns keeper_runs
language plpgsql
security definer
set search_path = public
as $$
declare
  r keeper_runs;
  n integer;
  last_rehearsal uuid;
begin
  if not has_tenant(p_tenant) then raise exception 'Not your shop.' using errcode = '42501'; end if;
  if p_task is distinct from 'shop_check' then raise exception 'Unknown task %.', p_task; end if;
  if coalesce(p_pick, 'next') not in ('next', 'again') then raise exception 'Unknown pick %.', p_pick; end if;
  if exists (select 1 from keeper_runs where tenant_id = p_tenant and task = p_task and state in ('running', 'paused')) then
    raise exception 'A check is already going. Open it to carry on or stop it.' using errcode = '23505';
  end if;

  if coalesce(p_rehearsal, false) and p_pick = 'again' then
    select id into last_rehearsal from keeper_runs
    where tenant_id = p_tenant and task = p_task and rehearsal
    order by created_at desc limit 1;
    if last_rehearsal is null then raise exception 'There is no rehearsal to run again.' using errcode = 'P0002'; end if;
  end if;

  insert into keeper_runs (tenant_id, task, pace, cap_pence, rehearsal)
  values (p_tenant, p_task, coalesce(p_pace, 'watch'), p_cap_pence, coalesce(p_rehearsal, false))
  returning * into r;

  insert into keeper_jobs (tenant_id, product_id, kind, run_id)
  select p.tenant_id, p.id, 'shop_check', r.id
  from store_products p
  where p.tenant_id = p_tenant
    and p.status = 'draft'
    and p.archived_at is null
    and p.is_sample = false
    and not (coalesce(p.derived_fields, '{}'::jsonb) ? 'rules')
    and not exists (
      select 1 from keeper_jobs j where j.product_id = p.id and j.kind = 'shop_check' and j.state in ('queued', 'working')
    )
    -- The last rehearsal's drafts again, or for a new rehearsal only drafts no rehearsal has taken.
    and (last_rehearsal is null or exists (select 1 from keeper_jobs j where j.run_id = last_rehearsal and j.product_id = p.id))
    and (
      not coalesce(p_rehearsal, false) or last_rehearsal is not null
      or not exists (
        select 1 from keeper_jobs j join keeper_runs k on k.id = j.run_id
        where j.product_id = p.id and k.rehearsal and k.id <> r.id
      )
    )
  order by p.created_at, p.id
  limit coalesce(p_limit, 100000);

  get diagnostics n = row_count;
  if n = 0 then
    if coalesce(p_rehearsal, false) and last_rehearsal is null then
      raise exception 'Every draft has been rehearsed. Rehearse the last ones again, or start for real.' using errcode = 'P0002';
    end if;
    raise exception 'Every draft has been checked already.' using errcode = 'P0002';
  end if;

  update keeper_runs set total = n where id = r.id returning * into r;
  return r;
end;
$$;

revoke all on function start_keeper_run(uuid, text, text, numeric, boolean, integer, text) from public, anon;
grant execute on function start_keeper_run(uuid, text, text, numeric, boolean, integer, text) to authenticated;
