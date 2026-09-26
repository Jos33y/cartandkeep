-- Pulls eBay traffic and sales for every connected tenant at 8am UK time, and tells the studio when a pull fails.
-- Needs pg_cron and pg_net (enabled for 0060), and two app_config rows: notify_url and service_key (from 0060),
-- plus studio_alert_email, added in the run steps.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Every pull, scheduled or pressed in the portal. A row with ok null never finished.
create table if not exists data_pulls (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants (id) on delete cascade,
  source      text not null check (source in ('ebay_traffic', 'ebay_sales')),
  started_by  text not null check (started_by in ('schedule', 'portal')),
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  ok          boolean,
  error       text,
  summary     jsonb
);

create index if not exists data_pulls_recent on data_pulls (tenant_id, source, started_at desc);

alter table data_pulls enable row level security;

-- Readable by the tenant, so a page can say when its figures were last updated. Written only by the functions.
drop policy if exists data_pulls_read on data_pulls;
create policy data_pulls_read on data_pulls
  for select to authenticated
  using (has_tenant(tenant_id));

revoke all on data_pulls from anon, authenticated;
grant select on data_pulls to authenticated;

create or replace view data_pulls_latest
with (security_invoker = on) as
select distinct on (tenant_id, source) *
from data_pulls
order by tenant_id, source, started_at desc;

revoke all on data_pulls_latest from anon, authenticated;
grant select on data_pulls_latest to authenticated;

-- What the studio was last told, so a pull failing for a week is one email, not seven.
create table if not exists data_pull_alerts (
  tenant_id  uuid not null references tenants (id) on delete cascade,
  source     text not null check (source in ('ebay_traffic', 'ebay_sales')),
  state      text not null check (state in ('failing', 'ok')),
  changed_at timestamptz not null default now(),
  primary key (tenant_id, source)
);

alter table data_pull_alerts enable row level security;
revoke all on data_pull_alerts from anon, authenticated;

-- pg_cron runs in UTC; the check is on London time, so the clock change never moves the pull.
create or replace function is_london_hour(p_hour integer, p_at timestamptz default now())
returns boolean
language sql
immutable
as $$
  select extract(hour from p_at at time zone 'Europe/London') = p_hour;
$$;

create or replace function functions_base()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  url text;
begin
  select value into url from app_config where key = 'notify_url';
  if url is null or url !~ '/functions/v1/notify/?$' then
    raise exception 'app_config notify_url must be the notify function URL, got %', coalesce(url, 'nothing');
  end if;
  return regexp_replace(url, '/notify/?$', '');
end;
$$;

revoke all on function functions_base() from public, anon, authenticated;

-- Sales look back 60 days each morning, so a refund or cancellation on an older order is picked up.
create or replace function start_daily_pulls(p_force boolean default false)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  base   text;
  fn_key text;
  t      record;
  n      integer := 0;
  hdrs   jsonb;
begin
  if not p_force and not is_london_hour(8) then return 0; end if;

  base := functions_base();
  select value into fn_key from app_config where key = 'service_key';
  if fn_key is null then raise exception 'app_config service_key is missing'; end if;

  hdrs := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || fn_key);

  for t in
    select c.tenant_id
    from tenant_credentials c
    join tenants x on x.id = c.tenant_id
    where c.provider = 'ebay' and x.status = 'active'
  loop
    perform net.http_post(
      url := base || '/ebay-traffic',
      body := jsonb_build_object('tenant_id', t.tenant_id, 'days', 90),
      headers := hdrs,
      timeout_milliseconds := 150000
    );
    perform net.http_post(
      url := base || '/ebay-sales',
      body := jsonb_build_object('tenant_id', t.tenant_id, 'days', 60),
      headers := hdrs,
      timeout_milliseconds := 150000
    );
    n := n + 1;
  end loop;

  return n;
end;
$$;

revoke all on function start_daily_pulls(boolean) from public, anon, authenticated;

-- 45 minutes after the start. Nothing recorded today, or a run that never finished, counts as failed.
create or replace function check_daily_pulls(p_force boolean default false)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  fn_key  text;
  to_addr text;
  base    text;
  today   date := (now() at time zone 'Europe/London')::date;
  t       record;
  src     text;
  latest  data_pulls%rowtype;
  last_ok timestamptz;
  prev    text;
  failing boolean;
  sent    integer := 0;
begin
  if not p_force and not is_london_hour(8) then return 0; end if;

  base := functions_base();
  select value into fn_key from app_config where key = 'service_key';
  select value into to_addr from app_config where key = 'studio_alert_email';
  if fn_key is null then raise exception 'app_config service_key is missing'; end if;
  if to_addr is null then raise exception 'app_config studio_alert_email is missing'; end if;

  for t in
    select c.tenant_id, x.name
    from tenant_credentials c
    join tenants x on x.id = c.tenant_id
    where c.provider = 'ebay' and x.status = 'active'
  loop
    foreach src in array array['ebay_traffic', 'ebay_sales'] loop
      latest := null;
      select * into latest
      from data_pulls p
      where p.tenant_id = t.tenant_id
        and p.source = src
        and (p.started_at at time zone 'Europe/London')::date = today
      order by p.started_at desc
      limit 1;

      failing := latest.id is null or latest.ok is not true;

      select max(p.finished_at) into last_ok
      from data_pulls p
      where p.tenant_id = t.tenant_id and p.source = src and p.ok;

      select a.state into prev from data_pull_alerts a where a.tenant_id = t.tenant_id and a.source = src;
      prev := coalesce(prev, 'ok');

      if failing = (prev = 'failing') then continue; end if;

      perform net.http_post(
        url := base || '/notify',
        body := jsonb_build_object(
          'kind', 'pull_alert',
          'to', to_addr,
          'tenant', t.name,
          'source', src,
          'state', case when failing then 'failing' else 'recovered' end,
          'error', case
            when not failing then null
            when latest.id is null then 'No pull was recorded this morning. The schedule may not have run.'
            when latest.ok is null then 'The pull started and did not finish.'
            else latest.error
          end,
          'last_ok_at', last_ok
        ),
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || fn_key)
      );

      -- Recorded after the post, as 0066 does: a send pg_net loses is not retried, the same trade as every email here.
      insert into data_pull_alerts (tenant_id, source, state, changed_at)
      values (t.tenant_id, src, case when failing then 'failing' else 'ok' end, now())
      on conflict (tenant_id, source) do update set state = excluded.state, changed_at = excluded.changed_at;

      sent := sent + 1;
    end loop;
  end loop;

  return sent;
end;
$$;

revoke all on function check_daily_pulls(boolean) from public, anon, authenticated;

-- Both UTC hours, because 8am London is 07:00 UTC in summer and 08:00 in winter. The London check keeps one of them.
select cron.unschedule('ebay-daily-pulls') where exists (select 1 from cron.job where jobname = 'ebay-daily-pulls');
select cron.schedule('ebay-daily-pulls', '0 7,8 * * *', $$select start_daily_pulls();$$);

select cron.unschedule('ebay-daily-check') where exists (select 1 from cron.job where jobname = 'ebay-daily-check');
select cron.schedule('ebay-daily-check', '45 7,8 * * *', $$select check_daily_pulls();$$);
