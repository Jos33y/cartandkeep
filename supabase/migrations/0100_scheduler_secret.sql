-- 0100_scheduler_secret.sql
-- The scheduled calls prove themselves with a secret of their own, not by matching one Supabase key against another.
-- The key inside the functions stopped matching the one stored here, so every scheduled call was refused.
-- After running: copy the value into the functions' secrets as SCHEDULER_SECRET (see the run steps).

-- Two random UUIDs, hyphens removed: 64 hex characters from the database's own secure random source.
insert into app_config (key, value)
values ('scheduler_secret', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
on conflict (key) do nothing;

-- The service key still goes in Authorization, because Supabase checks that before our code runs.
create or replace function scheduler_headers()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  fn_key text;
  secret text;
begin
  select value into fn_key from app_config where key = 'service_key';
  select value into secret from app_config where key = 'scheduler_secret';
  if fn_key is null then raise exception 'app_config service_key is missing'; end if;
  if secret is null then raise exception 'app_config scheduler_secret is missing'; end if;
  return jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || fn_key,
    'x-scheduler-secret', secret
  );
end;
$$;

revoke all on function scheduler_headers() from public, anon, authenticated;

-- Sales look back 60 days each morning, so a refund or cancellation on an older order is picked up.
create or replace function start_daily_pulls(p_force boolean default false)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  base   text;
  t      record;
  n      integer := 0;
  hdrs   jsonb;
begin
  if not p_force and not is_london_hour(8) then return 0; end if;

  base := functions_base();
  hdrs := scheduler_headers();

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
  select value into to_addr from app_config where key = 'studio_alert_email';
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
        headers := scheduler_headers()
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
