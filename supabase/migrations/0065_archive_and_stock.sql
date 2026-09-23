-- Taking a product out of the shop without losing it.
--
-- Deleting is not an option. `order_items` copies the title and the price so an
-- invoice survives an edit, but an order still points at the product row, and a
-- shop that has stopped stocking something still has to be able to say what it
-- was when somebody asks about an order from March.
--
-- So: a third state beside draft and live.
--
--   draft     never been on sale, or taken back off to be worked on
--   live      on sale
--   archived  was on sale, is not coming back, and the record stays
--
-- The difference between draft and archived is intent, and it matters on a
-- screen: a draft is work in progress and belongs in her queue, an archived
-- product is finished business and should not be in it.

alter table store_products
  drop constraint if exists store_products_status_check;

alter table store_products
  add constraint store_products_status_check
  check (status in ('draft', 'live', 'archived'));

alter table store_products
  add column if not exists archived_at timestamptz,
  -- Why it went. "Supplier stopped making it" and "it never sold" are different
  -- facts and the second one is research she paid for.
  add column if not exists archived_reason text;

comment on column store_products.archived_at is
  'When it was taken out of the shop for good. Distinct from draft, which is work in progress: an archived product is finished business and should not sit in her queue.';

/*
 * The public read policy has to learn about it.
 *
 * 0034 admits `status = 'live'`, so an archived product already disappears from
 * the shop with no change here. That is correct for the grid and wrong for a
 * link somebody saved: a dead page is worse than a page saying the shop has
 * moved on, and it throws away whatever Google has already indexed.
 *
 * So archived rows become readable, and the storefront decides what to render.
 * The grid filters on live, the product page does not.
 */
drop policy if exists store_products_public_read on store_products;
create policy store_products_public_read on store_products
  for select to anon
  using (
    is_sample = false
    and status in ('live', 'archived')
  );

-- --- low stock ---------------------------------------------------------------

/*
 * What she has already been told about.
 *
 * Without this the alert fires on every order for a product that is low, which
 * is three emails on a Saturday for the same shelf. One row per product per
 * time it crosses the line downward, cleared when the count goes back above it,
 * so restocking arms the alert again.
 */
create table if not exists store_stock_alerts (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants (id) on delete cascade,
  product_id  uuid not null references store_products (id) on delete cascade,
  variant_id  uuid references store_variants (id) on delete cascade,

  -- What the count was when it fired, so the email can say it and so a second
  -- alert at a lower number is distinguishable from a repeat of the first.
  at_stock    integer not null,
  sent_at     timestamptz not null default now(),

  -- One live alert per thing. Cleared by deleting the row when stock recovers,
  -- rather than by a flag, because an alert that is not outstanding is not a
  -- record of anything.
  unique (product_id, variant_id)
);

comment on table store_stock_alerts is
  'One row per product or variant currently below the low stock threshold and already reported. Deleted when the count recovers, which arms the alert again.';

alter table store_stock_alerts enable row level security;
revoke all on store_stock_alerts from anon, authenticated;
grant select on store_stock_alerts to authenticated;

drop policy if exists store_stock_alerts_portal on store_stock_alerts;
create policy store_stock_alerts_portal on store_stock_alerts
  for select to authenticated using (has_tenant(tenant_id));

/*
 * What is low and has not been reported.
 *
 * Three at or below, which is the same threshold the dashboard uses. Written
 * here as a literal rather than read from settings, and that is a decision
 * rather than laziness: a threshold she can change is a threshold that changes
 * what "nearly out" means on two screens and in an email, and until she asks
 * for it the cost of one number in two places is lower than the cost of a
 * setting nobody sets.
 *
 * Live products only. A draft running low is not urgent and an archived one is
 * not coming back.
 */
create or replace view store_low_stock as
select
  p.tenant_id,
  p.id as product_id,
  null::uuid as variant_id,
  p.title,
  null::text as label,
  p.stock
from store_products p
where p.status = 'live'
  and p.is_sample = false
  and p.stock is not null
  and p.stock <= 3
  -- A product with variants sells through them, so its own count says nothing.
  and not exists (select 1 from store_variants v where v.product_id = p.id)

union all

select
  v.tenant_id,
  v.product_id,
  v.id,
  p.title,
  v.label,
  v.stock
from store_variants v
join store_products p on p.id = v.product_id
where p.status = 'live'
  and p.is_sample = false
  and v.stock is not null
  and v.stock <= 3
  and v.availability not in ('discontinued');

comment on view store_low_stock is
  'Anything on sale with three or fewer left. A product with variants is excluded in favour of its variants, because the product count says nothing once it sells through them.';

grant select on store_low_stock to authenticated;

/*
 * The ones to email about.
 *
 * Left joined against what has already been sent, so a shelf that has been low
 * all week is reported once rather than every time somebody buys the last but
 * one.
 */
create or replace view store_stock_to_report as
select l.*
from store_low_stock l
left join store_stock_alerts a
  on a.product_id = l.product_id
  and a.variant_id is not distinct from l.variant_id
where a.id is null;

comment on view store_stock_to_report is
  'Low stock that has not been reported yet. `is not distinct from` rather than `=`, because a product line has a null variant_id and null never equals null.';

grant select on store_stock_to_report to authenticated;

/*
 * Clearing an alert once the count recovers.
 *
 * Called after stock is applied, so restocking arms the alert again. A trigger
 * would be tidier and would also fire on every unrelated update to the table,
 * so this is called deliberately from the one place stock changes.
 */
create or replace function clear_recovered_stock_alerts()
returns integer
language sql
security definer
set search_path = public
as $$
  with gone as (
    delete from store_stock_alerts a
    where not exists (
      select 1 from store_low_stock l
      where l.product_id = a.product_id
        and l.variant_id is not distinct from a.variant_id
    )
    returning 1
  )
  select count(*)::integer from gone;
$$;

revoke all on function clear_recovered_stock_alerts() from public, anon, authenticated;
grant execute on function clear_recovered_stock_alerts() to service_role;
