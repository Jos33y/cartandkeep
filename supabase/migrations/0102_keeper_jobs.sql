-- 0102_keeper_jobs.sql
-- Keeper's work as a queue on the server, so it carries on when the portal is closed and every screen reads one progress.
-- The portal adds jobs; the draft function claims and does them, kicked by the portal and by a one minute schedule.

create table if not exists keeper_jobs (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants (id) on delete cascade,
  product_id   uuid not null references store_products (id) on delete cascade,
  kind         text not null default 'fill' check (kind in ('fill')),
  sections     jsonb not null default '[]'::jsonb,
  state        text not null default 'queued' check (state in ('queued', 'working', 'done', 'failed')),
  attempts     integer not null default 0,
  error        text,
  result       jsonb,
  requested_by uuid default auth.uid(),
  created_at   timestamptz not null default now(),
  started_at   timestamptz,
  finished_at  timestamptz
);

-- One open job per product: pressing twice, or two tabs, cannot pay for the same read twice.
create unique index if not exists keeper_jobs_one_open on keeper_jobs (product_id) where state in ('queued', 'working');
create index if not exists keeper_jobs_recent on keeper_jobs (tenant_id, created_at desc);
create index if not exists keeper_jobs_waiting on keeper_jobs (created_at) where state in ('queued', 'working');

alter table keeper_jobs enable row level security;

drop policy if exists keeper_jobs_read on keeper_jobs;
create policy keeper_jobs_read on keeper_jobs
  for select to authenticated
  using (has_tenant(tenant_id));

-- A member can only ask for work on her own shop's products, and only as a fresh request.
drop policy if exists keeper_jobs_ask on keeper_jobs;
create policy keeper_jobs_ask on keeper_jobs
  for insert to authenticated
  with check (
    has_tenant(tenant_id)
    and state = 'queued' and attempts = 0 and error is null and result is null
    and exists (select 1 from store_products p where p.id = product_id and p.tenant_id = keeper_jobs.tenant_id)
  );

revoke all on keeper_jobs from anon, authenticated;
grant select, insert on keeper_jobs to authenticated;

-- Hands out work without two callers taking the same job. A job stuck working for five minutes is taken again, three tries at most.
create or replace function claim_keeper_jobs(p_limit integer, p_tenant uuid default null)
returns setof keeper_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  update keeper_jobs j
  set state = 'failed', finished_at = now(), error = coalesce(j.error, 'Stopped three times without finishing.')
  where j.state = 'working' and j.started_at < now() - interval '5 minutes' and j.attempts >= 3
    and (p_tenant is null or j.tenant_id = p_tenant);

  return query
  update keeper_jobs j
  set state = 'working', started_at = now(), attempts = j.attempts + 1
  where j.id in (
    select w.id from keeper_jobs w
    where (w.state = 'queued' or (w.state = 'working' and w.started_at < now() - interval '5 minutes'))
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

-- The schedule only calls out when something is waiting, so an idle shop costs nothing.
create or replace function kick_keeper()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from keeper_jobs where state in ('queued', 'working')) then return false; end if;
  perform net.http_post(
    url := functions_base() || '/draft',
    body := jsonb_build_object('queue', true),
    headers := scheduler_headers(),
    timeout_milliseconds := 150000
  );
  return true;
end;
$$;

revoke all on function kick_keeper() from public, anon, authenticated;

select cron.unschedule('keeper-queue') where exists (select 1 from cron.job where jobname = 'keeper-queue');
select cron.schedule('keeper-queue', '* * * * *', $$select kick_keeper();$$);
