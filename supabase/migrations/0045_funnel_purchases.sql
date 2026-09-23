-- The funnel counted purchases that could never be counted.
--
-- 0039 joined events to products on `e.product_id = p.id` and counted rows
-- where the event was `purchase`. The purchase event is fired with a reference
-- and a total and no product id, so it never matched the join. Every row in
-- that view has reported zero purchases since the day it was created, and it
-- is the column the view exists for.
--
-- It was also fired from the confirmation page, which is the wrong moment for
-- the same reason the success URL is not proof of payment: a buyer who closes
-- the tab after paying is a sale with no event.
--
-- Both problems have one fix and it is order data rather than event data.
-- Purchases per product come from `order_items` joined to `orders` where the
-- status is paid. That survives a closed tab, it cannot disagree with the
-- money, and it counts units rather than events.

-- Dropped rather than replaced. `create or replace view` can only replace a
-- definition whose columns match the existing one in name and order, and this
-- adds units_sold and revenue in the middle, which Postgres reads as an attempt
-- to rename add_rate_pct.
--
-- No cascade. Nothing reads this view yet, so a plain drop succeeds, and if it
-- does not then something depends on it that is not in the migrations and that
-- is worth finding out from an error rather than from a silent removal.
drop view if exists store_product_funnel;

create view store_product_funnel as
with sold as (
  -- Units and revenue per product, from what was actually paid for.
  --
  -- Refunded orders are excluded from both. A refunded sale is not demand
  -- evidence: it is usually the opposite, and leaving it in would make the
  -- products that disappoint people look like the products that work.
  select
    oi.product_id,
    sum(oi.qty)::bigint as units,
    sum(oi.line_total)  as revenue,
    count(distinct oi.order_id)::bigint as orders
  from order_items oi
  join orders o on o.id = oi.order_id
  where o.status = 'paid'
  group by oi.product_id
),
seen as (
  select
    e.product_id,
    count(*) filter (where e.event = 'view_product')  as views,
    count(*) filter (where e.event = 'quick_view')    as quick_views,
    count(*) filter (where e.event = 'add_to_basket') as adds
  from store_events e
  where e.product_id is not null
  group by e.product_id
)
select
  p.tenant_id,
  p.id as product_id,
  p.slug,
  p.title,
  p.price,
  coalesce(s.views, 0)       as views,
  coalesce(s.quick_views, 0) as quick_views,
  coalesce(s.adds, 0)        as adds,
  coalesce(d.orders, 0)      as purchases,
  coalesce(d.units, 0)       as units_sold,
  coalesce(d.revenue, 0)     as revenue,

  -- Null rather than zero when nobody has looked. A conversion rate of 0%
  -- reads as a failing product; no views reads as no data, which is the truth.
  case when coalesce(s.views, 0) > 0
    then round(coalesce(s.adds, 0)::numeric / s.views * 100, 1)
  end as add_rate_pct,

  -- The one that answers what to do next. A product with views and no sales is
  -- a price, photograph or description problem, and that is a finding she can
  -- act on. Same null rule for the same reason.
  case when coalesce(s.views, 0) > 0
    then round(coalesce(d.orders, 0)::numeric / s.views * 100, 1)
  end as buy_rate_pct

from store_products p
left join seen s on s.product_id = p.id
left join sold d on d.product_id = p.id;

comment on view store_product_funnel is
  'Views to adds to purchases per product. Purchases come from paid order_items rather than from a purchase event, because the event carries no product id and is fired from a page a paying customer need never load. Rates are null rather than zero when nobody has looked.';