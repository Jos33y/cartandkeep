-- The day by day series, and what the listings actually are.
--
-- 0075 stored a window total and a row per listing. Two things were missing.
--
-- The total is one number for ninety days, so nothing can be drawn: whether
-- impressions are climbing or collapsing is invisible, and that is most of what
-- a traffic page is for. eBay returns it daily and 0075 summed it away.
--
-- And the traffic report names a listing by id and nothing else, so the page
-- read as a column of twelve digit numbers. The title and the photograph come
-- from Browse, which is the same API the gate already uses.

create table if not exists ebay_traffic_daily (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,

  day date not null,

  impressions integer,
  views integer,
  transactions integer,

  fetched_at timestamptz not null default now(),

  unique (tenant_id, day)
);

create index if not exists ebay_traffic_daily_idx
  on ebay_traffic_daily (tenant_id, day desc);

alter table ebay_traffic_daily enable row level security;

drop policy if exists ebay_traffic_daily_rw on ebay_traffic_daily;
create policy ebay_traffic_daily_rw on ebay_traffic_daily
  for all to authenticated
  using (has_tenant(tenant_id));

-- What the listing is, rather than what it is called in eBay's database.
alter table ebay_traffic add column if not exists image_url text;
alter table ebay_traffic add column if not exists price numeric;
alter table ebay_traffic add column if not exists currency text;

-- 0075 used a JWT path invented rather than read. Every other tenant table on
-- this project uses has_tenant(), so the rows were written and never readable.
drop policy if exists ebay_traffic_read on ebay_traffic;
drop policy if exists ebay_traffic_rw on ebay_traffic;
create policy ebay_traffic_rw on ebay_traffic
  for all to authenticated
  using (has_tenant(tenant_id));
