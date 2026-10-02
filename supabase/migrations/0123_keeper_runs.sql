-- 0123_keeper_runs.sql
-- Keeper's runs: a batch of jobs started together, watched together in Keeper's office, and paused, carried on or
-- stopped together. The first task is the shop check (keeper-task-01-shop-drafts.md): returns, label and the shop
-- title for every draft nobody has checked.
--
-- Builds on 0102. A run's jobs are ordinary keeper_jobs rows with a run_id. Writing jobs (kind 'fill') keep working
-- exactly as before. One worker at a time holds a run (a lease), so the pace she chose is the pace she sees.
-- The agent's name is the shop's own setting (tenants.store.agent.name), as the portal already reads it.

create table if not exists keeper_runs (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants (id) on delete cascade,
  task          text not null check (task in ('shop_check')),
  state         text not null default 'running' check (state in ('running', 'paused', 'stopped', 'done')),
  pace          text not null default 'watch' check (pace in ('watch', 'normal')),
  -- A rehearsal does every step except write to her products.
  rehearsal     boolean not null default false,
  total         integer not null default 0,
  -- Pence, with fractions: one check costs well under a penny of some parts.
  cap_pence     numeric(10, 2) not null check (cap_pence > 0),
  spent_pence   numeric(10, 2) not null default 0,
  paused_reason text,
  -- One worker at a time: the lease is taken and renewed by the worker that is working the run.
  lease_until   timestamptz,
  requested_by  uuid default auth.uid(),
  created_at    timestamptz not null default now(),
  finished_at   timestamptz
);

-- One open run per task per shop: pressing twice cannot start two runs over the same drafts.
create unique index if not exists keeper_runs_one_open on keeper_runs (tenant_id, task) where state in ('running', 'paused');
create index if not exists keeper_runs_recent on keeper_runs (tenant_id, created_at desc);

alter table keeper_runs enable row level security;
drop policy if exists keeper_runs_read on keeper_runs;
create policy keeper_runs_read on keeper_runs for select to authenticated using (has_tenant(tenant_id));
revoke all on keeper_runs from anon, authenticated;
grant select on keeper_runs to authenticated;

-- Jobs belong to a run; a run's job can be stopped before it starts.
alter table keeper_jobs add column if not exists run_id uuid references keeper_runs (id) on delete set null;
alter table keeper_jobs drop constraint if exists keeper_jobs_kind_check;
alter table keeper_jobs add constraint keeper_jobs_kind_check check (kind in ('fill', 'shop_check'));
alter table keeper_jobs drop constraint if exists keeper_jobs_state_check;
alter table keeper_jobs add constraint keeper_jobs_state_check check (state in ('queued', 'working', 'done', 'failed', 'stopped'));

-- One open job per product per kind: a product waiting to be written can still be checked, and the reverse.
drop index if exists keeper_jobs_one_open;
create unique index if not exists keeper_jobs_one_open on keeper_jobs (product_id, kind) where state in ('queued', 'working');
create index if not exists keeper_jobs_run on keeper_jobs (run_id, state) where run_id is not null;

-- Her changes to what Keeper set. Read before the next run, so Keeper learns her way rather than repeating itself.
create table if not exists keeper_overrides (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants (id) on delete cascade,
  product_id   uuid references store_products (id) on delete set null,
  field        text not null check (field in ('returns', 'title', 'label', 'chemical')),
  keeper_value jsonb,
  her_value    jsonb,
  created_by   uuid default auth.uid(),
  created_at   timestamptz not null default now()
);
create index if not exists keeper_overrides_recent on keeper_overrides (tenant_id, created_at desc);

alter table keeper_overrides enable row level security;
drop policy if exists keeper_overrides_read on keeper_overrides;
create policy keeper_overrides_read on keeper_overrides for select to authenticated using (has_tenant(tenant_id));
drop policy if exists keeper_overrides_add on keeper_overrides;
create policy keeper_overrides_add on keeper_overrides for insert to authenticated
  with check (
    has_tenant(tenant_id)
    and (product_id is null or exists (select 1 from store_products p where p.id = product_id and p.tenant_id = keeper_overrides.tenant_id))
  );
revoke all on keeper_overrides from anon, authenticated;
grant select, insert on keeper_overrides to authenticated;

-- Starts a run over every draft nobody has checked, or the first p_limit of them (a rehearsal on five).
create or replace function start_keeper_run(
  p_tenant uuid, p_task text, p_pace text, p_cap_pence numeric, p_rehearsal boolean default false, p_limit integer default null
)
returns keeper_runs
language plpgsql
security definer
set search_path = public
as $$
declare
  r keeper_runs;
  n integer;
begin
  if not has_tenant(p_tenant) then raise exception 'Not your shop.' using errcode = '42501'; end if;
  if p_task is distinct from 'shop_check' then raise exception 'Unknown task %.', p_task; end if;
  if exists (select 1 from keeper_runs where tenant_id = p_tenant and task = p_task and state in ('running', 'paused')) then
    raise exception 'A check is already going. Open it to carry on or stop it.' using errcode = '23505';
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
  order by p.created_at, p.id
  limit coalesce(p_limit, 100000);

  get diagnostics n = row_count;
  if n = 0 then raise exception 'Every draft has been checked already.' using errcode = 'P0002'; end if;

  update keeper_runs set total = n where id = r.id returning * into r;
  return r;
end;
$$;

revoke all on function start_keeper_run(uuid, text, text, numeric, boolean, integer) from public, anon;
grant execute on function start_keeper_run(uuid, text, text, numeric, boolean, integer) to authenticated;

-- Pause, carry on, stop, or change pace. Stopping marks the jobs not yet started as stopped; a job in hand finishes.
create or replace function set_keeper_run(p_run uuid, p_state text default null, p_pace text default null)
returns keeper_runs
language plpgsql
security definer
set search_path = public
as $$
declare
  r keeper_runs;
begin
  select * into r from keeper_runs where id = p_run for update;
  if not found or not has_tenant(r.tenant_id) then raise exception 'No such check.' using errcode = '42501'; end if;
  if r.state in ('stopped', 'done') then return r; end if;

  if p_pace is not null then
    if p_pace not in ('watch', 'normal') then raise exception 'Unknown pace %.', p_pace; end if;
    update keeper_runs set pace = p_pace where id = p_run;
  end if;

  if p_state = 'stopped' then
    update keeper_jobs set state = 'stopped', finished_at = now() where run_id = p_run and state = 'queued';
    update keeper_runs set state = 'stopped', finished_at = now(), lease_until = null where id = p_run;
  elsif p_state = 'paused' then
    update keeper_runs set state = 'paused', paused_reason = null where id = p_run;
  elsif p_state = 'running' then
    update keeper_runs set state = 'running', paused_reason = null where id = p_run;
  elsif p_state is not null then
    raise exception 'Unknown state %.', p_state;
  end if;

  select * into r from keeper_runs where id = p_run;
  return r;
end;
$$;

revoke all on function set_keeper_run(uuid, text, text) from public, anon;
grant execute on function set_keeper_run(uuid, text, text) to authenticated;

-- Writing jobs only (kind 'fill'), for the draft function. Checks are handed out by keeper-run below.
create or replace function claim_keeper_jobs(p_limit integer, p_tenant uuid default null)
returns setof keeper_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  update keeper_jobs j
  set state = 'failed', finished_at = now(), error = coalesce(j.error, 'Stopped three times without finishing.')
  where j.run_id is null and j.kind = 'fill' and j.state = 'working' and j.started_at < now() - interval '5 minutes' and j.attempts >= 3
    and (p_tenant is null or j.tenant_id = p_tenant);

  return query
  update keeper_jobs j
  set state = 'working', started_at = now(), attempts = j.attempts + 1
  where j.id in (
    select w.id from keeper_jobs w
    where w.run_id is null and w.kind = 'fill'
      and (w.state = 'queued' or (w.state = 'working' and w.started_at < now() - interval '5 minutes'))
      and (p_tenant is null or w.tenant_id = p_tenant)
    order by w.created_at
    limit greatest(p_limit, 0)
    for update skip locked
  )
  returning j.*;
end;
$$;

revoke all on function claim_keeper_jobs(integer, uuid) from public, anon, authenticated;
grant execute on function claim_keeper_jobs(integer, uuid) to service_role;

-- Takes the lease on a running run that nobody is working, for p_seconds. Returns nothing when there is none.
create or replace function lease_keeper_run(p_seconds integer, p_tenant uuid default null)
returns setof keeper_runs
language sql
security definer
set search_path = public
as $$
  update keeper_runs r
  set lease_until = now() + make_interval(secs => p_seconds)
  where r.id = (
    select k.id from keeper_runs k
    where k.state = 'running'
      and (k.lease_until is null or k.lease_until < now())
      and (p_tenant is null or k.tenant_id = p_tenant)
    order by k.created_at
    limit 1
    for update skip locked
  )
  returning r.*;
$$;

revoke all on function lease_keeper_run(integer, uuid) from public, anon, authenticated;
grant execute on function lease_keeper_run(integer, uuid) to service_role;

-- The run's next jobs, while it is running. A job stuck working for five minutes is taken again, three tries at most;
-- one that failed waits 20 seconds before its next try, so a busy moment at Anthropic is not spent in one go.
-- A product still being written (an open 'fill' job) waits, so the check reads Keeper's own draft once it exists.
create or replace function claim_run_jobs(p_run uuid, p_limit integer)
returns setof keeper_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  update keeper_jobs j
  set state = 'failed', finished_at = now(), error = coalesce(j.error, 'Stopped three times without finishing.')
  where j.run_id = p_run and j.state = 'working' and j.started_at < now() - interval '5 minutes' and j.attempts >= 3;

  if not exists (select 1 from keeper_runs where id = p_run and state = 'running') then return; end if;

  return query
  update keeper_jobs j
  set state = 'working', started_at = now(), attempts = j.attempts + 1
  where j.id in (
    select w.id from keeper_jobs w
    where w.run_id = p_run
      and ((w.state = 'queued' and (w.error is null or w.started_at < now() - interval '20 seconds'))
        or (w.state = 'working' and w.started_at < now() - interval '5 minutes'))
      and not exists (select 1 from keeper_jobs f where f.product_id = w.product_id and f.kind = 'fill' and f.state in ('queued', 'working'))
    order by w.created_at, w.id
    limit greatest(p_limit, 0)
    for update skip locked
  )
  returning j.*;
end;
$$;

revoke all on function claim_run_jobs(uuid, integer) from public, anon, authenticated;
grant execute on function claim_run_jobs(uuid, integer) to service_role;

-- Checks outside a run: a new copy from eBay is checked as it arrives, once Keeper has written its draft.
create or replace function claim_check_jobs(p_limit integer, p_tenant uuid default null)
returns setof keeper_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  update keeper_jobs j
  set state = 'failed', finished_at = now(), error = coalesce(j.error, 'Stopped three times without finishing.')
  where j.run_id is null and j.kind = 'shop_check' and j.state = 'working' and j.started_at < now() - interval '5 minutes' and j.attempts >= 3
    and (p_tenant is null or j.tenant_id = p_tenant);

  return query
  update keeper_jobs j
  set state = 'working', started_at = now(), attempts = j.attempts + 1
  where j.id in (
    select w.id from keeper_jobs w
    where w.run_id is null and w.kind = 'shop_check'
      and ((w.state = 'queued' and (w.error is null or w.started_at < now() - interval '20 seconds'))
        or (w.state = 'working' and w.started_at < now() - interval '5 minutes'))
      and (p_tenant is null or w.tenant_id = p_tenant)
      and not exists (select 1 from keeper_jobs f where f.product_id = w.product_id and f.kind = 'fill' and f.state in ('queued', 'working'))
    order by w.created_at
    limit greatest(p_limit, 0)
    for update skip locked
  )
  returning j.*;
end;
$$;

revoke all on function claim_check_jobs(integer, uuid) from public, anon, authenticated;
grant execute on function claim_check_jobs(integer, uuid) to service_role;

-- What a check cost, added to its run. At the cap the run pauses and says why.
create or replace function add_keeper_spend(p_run uuid, p_pence numeric)
returns keeper_runs
language sql
security definer
set search_path = public
as $$
  update keeper_runs
  set spent_pence = spent_pence + greatest(coalesce(p_pence, 0), 0),
      state = case when state = 'running' and spent_pence + greatest(coalesce(p_pence, 0), 0) >= cap_pence then 'paused' else state end,
      paused_reason = case when state = 'running' and spent_pence + greatest(coalesce(p_pence, 0), 0) >= cap_pence
        then 'Reached the spending limit for this check.' else paused_reason end
  where id = p_run
  returning *;
$$;

revoke all on function add_keeper_spend(uuid, numeric) from public, anon, authenticated;
grant execute on function add_keeper_spend(uuid, numeric) to service_role;

-- Done when nothing is waiting or in hand. Lets the lease go either way.
create or replace function close_keeper_run(p_run uuid, p_pause_reason text default null)
returns keeper_runs
language plpgsql
security definer
set search_path = public
as $$
declare
  r keeper_runs;
begin
  if p_pause_reason is not null then
    update keeper_runs set state = 'paused', paused_reason = p_pause_reason, lease_until = null
    where id = p_run and state = 'running';
  elsif not exists (select 1 from keeper_jobs where run_id = p_run and state in ('queued', 'working')) then
    update keeper_runs set state = 'done', finished_at = now(), lease_until = null
    where id = p_run and state in ('running', 'paused');
  else
    update keeper_runs set lease_until = null where id = p_run;
  end if;
  select * into r from keeper_runs where id = p_run;
  return r;
end;
$$;

revoke all on function close_keeper_run(uuid, text) from public, anon, authenticated;
grant execute on function close_keeper_run(uuid, text) to service_role;

/*
 * The only way the shop check writes a product. Drafts only, and only when the draft has not changed since Keeper
 * read it (p_seen is the updated_at it read): if she saved meanwhile, nothing is written and 'changed' comes back,
 * so the job is read again at the end of the run. A returns class she saved and a title she saved are never
 * replaced. A new title keeps the old one in title_before, and the address is made again from it, drafts only.
 */
create or replace function set_keeper_check(
  p_id uuid, p_seen timestamptz, p_derived jsonb, p_returns text, p_title text, p_slug text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  cur store_products;
  new_title text;
  new_slug text;
  extra jsonb := '{}'::jsonb;
begin
  select * into cur from store_products where id = p_id for update;
  if not found then return 'gone'; end if;
  if cur.status <> 'draft' or cur.archived_at is not null then return 'not_draft'; end if;
  if cur.updated_at is distinct from p_seen then return 'changed'; end if;

  new_title := cur.title;
  new_slug := cur.slug;
  if nullif(btrim(p_title), '') is not null
     and coalesce(cur.derived_fields ->> 'title_by', '') = ''
     and btrim(p_title) <> cur.title then
    new_title := btrim(p_title);
    extra := jsonb_build_object('title_before', cur.title, 'title_by', 'keeper');
    if nullif(btrim(p_slug), '') is not null then
      new_slug := btrim(p_slug);
      if exists (select 1 from store_products o where o.tenant_id = cur.tenant_id and o.slug = new_slug and o.id <> cur.id) then
        new_slug := new_slug || '-' || left(replace(cur.id::text, '-', ''), 6);
      end if;
      extra := extra || jsonb_build_object('slug_before', cur.slug);
    end if;
  end if;

  update store_products
  set derived_fields = coalesce(derived_fields, '{}'::jsonb) || coalesce(p_derived, '{}'::jsonb) || extra,
      returns_class = case
        when p_returns in ('standard', 'sealed', 'none') and coalesce(derived_fields ->> 'returns_by', '') <> 'her' then p_returns
        else returns_class
      end,
      title = new_title,
      slug = new_slug
  where id = p_id;

  return 'written';
end;
$$;

revoke all on function set_keeper_check(uuid, timestamptz, jsonb, text, text, text) from public, anon, authenticated;
grant execute on function set_keeper_check(uuid, timestamptz, jsonb, text, text, text) to service_role;

-- The schedule calls out for writing jobs waiting (the draft function), and for checks waiting with nobody on them
-- (the keeper-run function). An idle shop costs nothing.
create or replace function kick_keeper()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  fill boolean;
  check_work boolean;
begin
  fill := exists (select 1 from keeper_jobs where run_id is null and kind = 'fill' and state in ('queued', 'working'));
  check_work := exists (select 1 from keeper_jobs where run_id is null and kind = 'shop_check' and state in ('queued', 'working'))
    or exists (
      select 1 from keeper_runs r
      where r.state = 'running' and (r.lease_until is null or r.lease_until < now())
        and exists (select 1 from keeper_jobs j where j.run_id = r.id and j.state in ('queued', 'working'))
    );
  if fill then
    perform net.http_post(url := functions_base() || '/draft', body := jsonb_build_object('queue', true),
      headers := scheduler_headers(), timeout_milliseconds := 150000);
  end if;
  if check_work then
    perform net.http_post(url := functions_base() || '/keeper-run', body := jsonb_build_object('queue', true),
      headers := scheduler_headers(), timeout_milliseconds := 150000);
  end if;
  return fill or check_work;
end;
$$;

revoke all on function kick_keeper() from public, anon, authenticated;
