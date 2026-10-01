-- 0118_supplier_checks.sql
-- Her Amazon suppliers, read through Apify: the latest reading on each card, and every reading kept, so the daily
-- price and stock check can say what changed and, later, how a price has moved over weeks.
-- Written only by the supplier-read function. Nothing here touches her draft.

-- The latest reading of the card's Amazon page: facts, today's offer, the one before it, and buyers' concerns.
alter table candidates add column if not exists supplier_read jsonb;

create table if not exists supplier_checks (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants (id) on delete cascade,
  candidate_id  uuid not null references candidates (id) on delete cascade,
  asin          text not null,
  url           text not null,
  checked_at    timestamptz not null default now(),
  started_by    text not null check (started_by in ('schedule', 'portal')),
  found         boolean not null,
  price         numeric(10, 2),
  was           numeric(10, 2),
  deal          boolean not null default false,
  shipping      numeric(10, 2),
  stock         text not null check (stock in ('in', 'low', 'slow', 'out', 'unknown')),
  stock_text    text,
  sold_by       text,
  -- What she costed the card from at the time, so a warning can be read back later as it was given.
  costed        numeric(10, 2),
  error         text
);

create index if not exists supplier_checks_card on supplier_checks (candidate_id, checked_at desc);
create index if not exists supplier_checks_recent on supplier_checks (tenant_id, checked_at desc);

alter table supplier_checks enable row level security;

drop policy if exists supplier_checks_read on supplier_checks;
create policy supplier_checks_read on supplier_checks
  for select to authenticated
  using (has_tenant(tenant_id));

revoke all on supplier_checks from anon, authenticated;
grant select on supplier_checks to authenticated;

/*
 * Every shop with an Amazon supplier link, every five minutes from 7am to 7:55am London time. Each call reads the
 * next 20 cards not yet read today, so a long list is spread over the hour and no call runs out of time. A call
 * with nothing left to read costs nothing: Apify is only called when there is a page to read.
 */
create or replace function start_supplier_checks(p_force boolean default false)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  base text;
  hdrs jsonb;
  t    record;
  n    integer := 0;
begin
  if not p_force and not is_london_hour(7) then return 0; end if;

  base := functions_base();
  hdrs := scheduler_headers();

  for t in
    select distinct s.tenant_id
    from candidate_sources s
    join tenants x on x.id = s.tenant_id
    where x.status = 'active' and s.url ilike '%amazon.co.uk%'
    union
    select distinct c.tenant_id
    from candidates c
    join tenants x on x.id = c.tenant_id
    where x.status = 'active' and c.draft ->> 'supplier_url' ilike '%amazon.co.uk%'
  loop
    perform net.http_post(
      url := base || '/supplier-read',
      body := jsonb_build_object('tenant_id', t.tenant_id, 'daily', true),
      headers := hdrs,
      timeout_milliseconds := 150000
    );
    n := n + 1;
  end loop;

  return n;
end;
$$;

revoke all on function start_supplier_checks(boolean) from public, anon, authenticated;

-- pg_cron is on UTC; 6 and 7 UTC cover 7am London in winter and summer, and the hour check picks the right one.
select cron.unschedule('supplier-daily-checks') where exists (select 1 from cron.job where jobname = 'supplier-daily-checks');
select cron.schedule('supplier-daily-checks', '*/5 6,7 * * *', $$select start_supplier_checks();$$);
