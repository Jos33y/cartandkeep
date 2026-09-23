-- What eBay shows her listings and what people do with them.
--
-- Her own listing traffic is the only figure on this project that can tell a
-- dead listing apart from a dead market. Browse gives price, seller, age and
-- sold quantity for everyone's listings and no impressions for any of them, so
-- until now a listing that nobody sees and a listing that everybody ignores
-- looked identical. Her 167 dead listings are exactly that question.
--
-- Stored rather than fetched on render, because the traffic report is a report:
-- it covers a window, it is slow, and the same numbers are read many times.

create table if not exists ebay_traffic (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,

  -- The window this row covers. eBay serves up to 90 days and the report is a
  -- total across the window, not a daily series.
  window_start date not null,
  window_end date not null,

  -- null on the account total, set on a listing row. One table rather than two,
  -- because the total is the same measurements at a different grain and
  -- splitting them means keeping two schemas honest with each other.
  listing_id text,
  title text,

  -- Times eBay put it in front of somebody, in search or a browse page.
  impressions integer,
  -- Times somebody opened it.
  views integer,
  -- Opens per impression, as eBay computes it. Kept rather than derived, so a
  -- change in how eBay counts does not silently change history here.
  click_rate numeric,
  -- Sales, and sales per view.
  transactions integer,
  conversion_rate numeric,

  fetched_at timestamptz not null default now(),

  -- One row per listing per window. Re-pulling the same window updates rather
  -- than duplicating, which matters because a window that includes today gets
  -- pulled repeatedly and the figures move.
  unique (tenant_id, window_start, window_end, listing_id)
);

-- The page reads the newest window, then the listings inside it.
create index if not exists ebay_traffic_window_idx
  on ebay_traffic (tenant_id, window_end desc, listing_id);

alter table ebay_traffic enable row level security;

drop policy if exists ebay_traffic_read on ebay_traffic;
create policy ebay_traffic_read on ebay_traffic
  for select to authenticated
  using (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

comment on table ebay_traffic is
  'eBay listing traffic. A row with listing_id null is the account total for that window.';
