-- 0113_listing_jobs.sql
-- Listing to eBay as a queue on the server, the way keeper_jobs (0102) runs Keeper: she picks the cards, the queue
-- lists them at a steady pace under her monthly limit, and it carries on with the portal closed.
--
-- The portal adds jobs; ebay-queue claims and does them, kicked by the portal and by a one minute schedule. The pace
-- and the limit are read by ebay-queue from tenant_credentials.settings (daily_pace, monthly_limit), defaulting to
-- 20 a day and 300 a month.

create table if not exists listing_jobs (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants (id) on delete cascade,
  candidate_id  uuid not null references candidates (id) on delete cascade,
  channel       text not null default 'ebay' check (channel in ('ebay')),
  -- What she chose at the time, over her draft: quantity, the catalogue, a category.
  request       jsonb not null default '{}'::jsonb,
  state         text not null default 'queued' check (state in ('queued', 'working', 'done', 'failed', 'cancelled')),
  attempts      integer not null default 0,
  error         text,
  result        jsonb,
  requested_by  uuid default auth.uid(),
  created_at    timestamptz not null default now(),
  started_at    timestamptz,
  finished_at   timestamptz
);

-- One open job per card and channel: two clicks, or two tabs, cannot list it twice.
create unique index if not exists listing_jobs_one_open
  on listing_jobs (candidate_id, channel) where state in ('queued', 'working');
create index if not exists listing_jobs_recent on listing_jobs (tenant_id, created_at desc);
create index if not exists listing_jobs_waiting on listing_jobs (tenant_id, created_at) where state in ('queued', 'working');

alter table listing_jobs enable row level security;

drop policy if exists listing_jobs_read on listing_jobs;
create policy listing_jobs_read on listing_jobs
  for select to authenticated
  using (has_tenant(tenant_id));

-- A member can only queue her own shop's approved cards that are not already on eBay, and only as a fresh request.
drop policy if exists listing_jobs_ask on listing_jobs;
create policy listing_jobs_ask on listing_jobs
  for insert to authenticated
  with check (
    has_tenant(tenant_id)
    and state = 'queued' and attempts = 0 and error is null and result is null
    and exists (
      select 1 from candidates c
      join decisions d on d.candidate_id = c.id and d.action = 'approve'
      -- Qualified: decisions has a candidate_id too, and a bare name would match that one, letting any card through.
      where c.id = listing_jobs.candidate_id and c.tenant_id = listing_jobs.tenant_id and c.ebay is null
    )
  );

-- She can take a job back while it is still waiting, and nothing else.
drop policy if exists listing_jobs_cancel on listing_jobs;
create policy listing_jobs_cancel on listing_jobs
  for update to authenticated
  using (has_tenant(tenant_id) and state = 'queued')
  with check (has_tenant(tenant_id) and state = 'cancelled');

revoke all on listing_jobs from anon, authenticated;
grant select, insert on listing_jobs to authenticated;
grant update (state) on listing_jobs to authenticated;

-- Hands out a tenant's work without two callers taking the same job, oldest first, up to the number the caller
-- may list now. A job stuck working for five minutes is taken again, three tries at most.
create or replace function claim_listing_jobs(p_tenant uuid, p_limit integer)
returns setof listing_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  update listing_jobs j
  set state = 'failed', finished_at = now(), error = coalesce(j.error, 'Stopped three times without finishing.')
  where j.tenant_id = p_tenant and j.state = 'working' and j.started_at < now() - interval '5 minutes' and j.attempts >= 3;

  return query
  update listing_jobs j
  set state = 'working', started_at = now(), attempts = j.attempts + 1
  where j.id in (
    select w.id from listing_jobs w
    where w.tenant_id = p_tenant
      and (w.state = 'queued' or (w.state = 'working' and w.started_at < now() - interval '5 minutes'))
    order by w.created_at
    limit greatest(p_limit, 0)
    for update skip locked
  )
  returning j.*;
end;
$$;

revoke all on function claim_listing_jobs(uuid, integer) from public, anon, authenticated;
grant execute on function claim_listing_jobs(uuid, integer) to service_role;

-- The schedule only calls out when something is waiting, so an idle shop costs nothing.
create or replace function kick_listing()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from listing_jobs where state in ('queued', 'working')) then return false; end if;
  perform net.http_post(
    url := functions_base() || '/ebay-queue',
    body := jsonb_build_object('queue', true),
    headers := scheduler_headers(),
    timeout_milliseconds := 150000
  );
  return true;
end;
$$;

revoke all on function kick_listing() from public, anon, authenticated;

select cron.unschedule('listing-queue') where exists (select 1 from cron.job where jobname = 'listing-queue');
select cron.schedule('listing-queue', '* * * * *', $$select kick_listing();$$);
