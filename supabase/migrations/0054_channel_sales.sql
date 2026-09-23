-- What sold on the other channels.
--
-- `orders` holds sales from her shop and nothing else, because the checkout
-- function is the only thing that writes to it. So the portal shows none of her
-- eBay or TikTok revenue, which today is all of her revenue.
--
-- That is not a screen that is late. Section 5 commits to revenue by channel,
-- margin per product per channel and net profit per product per channel, all
-- plural, and two of the three channels have never been recorded anywhere. No
-- first order on the shop would have fixed it.
--
-- Deliberately not stored in `orders`. That table is a distance selling
-- contract record: an access token so a customer can look their own order up, a
-- delivery address, a Stripe session, and policies written around all three. An
-- eBay sale has none of it, and putting one in there would leave half the
-- columns null and make the guarantees on the rest meaningless.

create table if not exists channel_sales (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,

  channel text not null check (channel in ('ebay', 'tiktok', 'other')),

  -- Their order number, and which line of it. One row per line rather than per
  -- order, because margin per product needs to know which product.
  external_ref text not null,
  line_no integer not null default 1 check (line_no > 0),

  sold_at timestamptz not null,

  -- Kept as it appeared on their platform. Her eBay title and her shop title
  -- for the same thing are routinely different, and the one that was actually
  -- shown to the buyer is the one worth keeping.
  title text not null,
  external_sku text,

  /*
   * The match to her own catalogue, where there is one.
   *
   * Null is a real answer and it is common. A product she sells on eBay and has
   * never put on the shop cannot be matched to anything, and it still counts
   * towards revenue by channel. What it cannot do is contribute to margin,
   * because margin needs a landed cost and the cost lives on the product.
   *
   * `on delete set null` rather than cascade: deleting a product must not
   * quietly remove last quarter's revenue.
   */
  product_id uuid references store_products(id) on delete set null,

  qty integer not null check (qty > 0),
  unit_price numeric(10, 2) not null check (unit_price >= 0),
  gross numeric(10, 2) not null check (gross >= 0),
  postage_charged numeric(10, 2) not null default 0,

  /*
   * What the platform actually took, where the export says.
   *
   * Preferred over anything computed. eBay's final value fee varies by category
   * and by whether she has a shop subscription, so a flat 12.8 per cent is an
   * approximation and the file often knows better. `fees_estimated` records
   * which of the two a row is, so a margin built on an estimate can never be
   * mistaken for one built on a receipt.
   */
  fees numeric(10, 2) check (fees is null or fees >= 0),
  fees_estimated boolean not null default false,

  status text not null default 'paid'
    check (status in ('paid', 'refunded', 'cancelled')),

  source_file text,
  imported_at timestamptz not null default now(),

  -- Re-importing the same export must not double her revenue, and it will be
  -- re-imported, because the obvious way to catch up a missed week is to export
  -- a wider date range.
  unique (tenant_id, channel, external_ref, line_no)
);

create index if not exists channel_sales_month_idx
  on channel_sales (tenant_id, sold_at desc);
create index if not exists channel_sales_product_idx
  on channel_sales (product_id) where product_id is not null;

alter table channel_sales enable row level security;

revoke all on channel_sales from anon;
grant select, insert, update, delete on channel_sales to authenticated;

drop policy if exists channel_sales_rw on channel_sales;
create policy channel_sales_rw on channel_sales
  for all to authenticated
  using (has_tenant(tenant_id)) with check (has_tenant(tenant_id));

comment on table channel_sales is
  'Line level sales from eBay and TikTok Shop, imported from their own exports. Separate from orders because an order is a distance selling contract we hold and this is a record of one somebody else held.';

/*
 * Every channel's revenue in one shape.
 *
 * The shop reads from `orders` and the rest from `channel_sales`, and a screen
 * asking what sold this month should not have to know that. Refunded and
 * cancelled are excluded from both sides by the same rule.
 */
create or replace view store_revenue_lines as
select
  o.tenant_id,
  'store'::text as channel,
  o.reference as external_ref,
  o.paid_at as sold_at,
  oi.title,
  oi.product_id,
  oi.qty,
  oi.line_total as gross,
  -- Delivery sits on the order rather than the line, so it is deliberately not
  -- spread across lines. A product's revenue is what the product sold for.
  null::numeric as fees,
  true as fees_estimated
from orders o
join order_items oi on oi.order_id = o.id
where o.status = 'paid'

union all

select
  c.tenant_id,
  c.channel,
  c.external_ref,
  c.sold_at,
  c.title,
  c.product_id,
  c.qty,
  c.gross,
  c.fees,
  c.fees_estimated
from channel_sales c
where c.status = 'paid';

comment on view store_revenue_lines is
  'One row per sold line across the shop, eBay and TikTok Shop. Refunds and cancellations excluded on both sides.';

/*
 * Net profit per product per channel, which is the Section 5 line.
 *
 * Fees come from the export where the platform told us and from the tenant fee
 * rates otherwise, and `fees_estimated` says which. Net is null rather than
 * optimistic wherever the landed cost is unknown, the same rule the margin view
 * already uses, because a profit figure that assumes a product was free is
 * worse than no profit figure.
 */
create or replace view store_channel_profit as
with rate as (
  select
    t.id as tenant_id,
    coalesce((t.fees -> 'store'  ->> 'pct')::numeric, 0.015) as store_pct,
    coalesce((t.fees -> 'store'  ->> 'fixed')::numeric, 0.20) as store_fixed,
    coalesce((t.fees -> 'ebay'   ->> 'pct')::numeric, 0.128) as ebay_pct,
    coalesce((t.fees -> 'ebay'   ->> 'fixed')::numeric, 0.30) as ebay_fixed,
    coalesce((t.fees -> 'tiktok' ->> 'pct')::numeric, 0.065) as tiktok_pct,
    coalesce((t.fees -> 'tiktok' ->> 'fixed')::numeric, 0.00) as tiktok_fixed
  from tenants t
),
priced as (
  select
    l.*,
    coalesce(l.fees, case l.channel
      when 'store'  then round(l.gross * r.store_pct  + r.store_fixed, 2)
      when 'ebay'   then round(l.gross * r.ebay_pct   + r.ebay_fixed, 2)
      when 'tiktok' then round(l.gross * r.tiktok_pct + r.tiktok_fixed, 2)
      else 0
    end) as fee_applied,
    p.landed_cost,
    p.title as product_title
  from store_revenue_lines l
  join rate r on r.tenant_id = l.tenant_id
  left join store_products p on p.id = l.product_id
)
select
  tenant_id,
  channel,
  date_trunc('month', sold_at)::date as month,
  product_id,
  coalesce(product_title, title) as title,
  sum(qty)::bigint as units,
  sum(gross) as revenue,
  sum(fee_applied) as fees,

  -- Only where every line in the group has a cost. A group half costed would
  -- otherwise report a profit that silently treats the rest as free.
  case when bool_and(landed_cost is not null)
    then sum(gross - fee_applied - landed_cost * qty)
  end as net,

  bool_and(landed_cost is not null) as costed,
  bool_or(fees_estimated) as fees_estimated,
  count(*) filter (where product_id is null)::bigint as unmatched_lines
from priced
group by tenant_id, channel, date_trunc('month', sold_at)::date, product_id,
         coalesce(product_title, title);

comment on view store_channel_profit is
  'Units, revenue, fees and net per product per channel per month. Net is null unless every line in the group has a landed cost, because a half costed group would report a profit that treats the rest as free.';
