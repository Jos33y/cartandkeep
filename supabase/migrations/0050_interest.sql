-- Making the rest of the signal readable.
--
-- 0045 fixed the purchase column and left two events out that were already
-- being recorded. Both answer a question the view could not.
--
-- A save is the strongest intent short of a basket. Somebody looked at a
-- product, decided they wanted it, and decided not now. A product with saves
-- and no sales is a price or a delivery cost problem, not a desire problem, and
-- that is a completely different fix from a product nobody looks at twice.
--
-- A removal is the most diagnostic event in the shop. They wanted it enough to
-- put it in the basket and then took it out again, which almost always happens
-- at the point the postage or the total appears.
--
-- `save_product` was in the check constraint from 0039 and fired by nobody
-- until this week, so its history starts now. Worth knowing before reading a
-- zero in that column as a finding.

drop view if exists store_product_funnel;

create view store_product_funnel as
with sold as (
  -- Refunded orders are out of both. A refunded sale is not demand evidence,
  -- it is usually the opposite, and leaving it in would make the products that
  -- disappoint people look like the products that work.
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
    count(*) filter (where e.event = 'view_product')      as views,
    count(*) filter (where e.event = 'quick_view')        as quick_views,
    count(*) filter (where e.event = 'save_product')      as saves,
    count(*) filter (where e.event = 'add_to_basket')     as adds,
    count(*) filter (where e.event = 'remove_from_basket') as removes
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
  p.image_url,
  p.status,
  p.is_sample,
  coalesce(s.views, 0)       as views,
  coalesce(s.quick_views, 0) as quick_views,
  coalesce(s.saves, 0)       as saves,
  coalesce(s.adds, 0)        as adds,
  coalesce(s.removes, 0)     as removes,
  coalesce(d.orders, 0)      as purchases,
  coalesce(d.units, 0)       as units_sold,
  coalesce(d.revenue, 0)     as revenue,

  -- Null rather than zero when nobody has looked. A conversion rate of 0%
  -- reads as a failing product; no views reads as no data, which is the truth.
  case when coalesce(s.views, 0) > 0
    then round(coalesce(s.adds, 0)::numeric / s.views * 100, 1)
  end as add_rate_pct,

  case when coalesce(s.views, 0) > 0
    then round(coalesce(d.orders, 0)::numeric / s.views * 100, 1)
  end as buy_rate_pct,

  /*
   * How many of the baskets it reached it then left.
   *
   * Against adds rather than against views, because the question is not how
   * many people saw it, it is how many of the people who wanted it changed
   * their mind. Null when nothing was ever added, for the same reason as above.
   */
  case when coalesce(s.adds, 0) > 0
    then round(coalesce(s.removes, 0)::numeric / s.adds * 100, 1)
  end as abandon_rate_pct

from store_products p
left join seen s on s.product_id = p.id
left join sold d on d.product_id = p.id;

comment on view store_product_funnel is
  'Views, saves, adds, removals and purchases per product. Purchases come from paid order_items rather than from an event, because the purchase event carries no product id. Rates are null rather than zero when there is nothing to divide by. save_product was fired by nobody before 19 August 2026, so a zero in that column before then is absence of recording rather than absence of interest.';

/*
 * What people asked for.
 *
 * A search that returned nothing is the single most actionable line in the
 * whole analytics table: somebody came to the shop wanting a specific thing,
 * typed it in, and left with nothing. Every one of those is either a product to
 * stock or a word the catalogue does not use for something it already sells.
 *
 * Grouped case insensitively and trimmed, because "Kettle", "kettle " and
 * "kettle" are one person's question asked three ways and counting them
 * separately buries all three.
 */
create or replace view store_searches as
select
  e.tenant_id,
  lower(btrim(e.meta ->> 'q')) as term,
  count(*)::bigint as searches,
  count(distinct e.session_id)::bigint as visits,
  max((e.meta ->> 'results')::integer) as best_result_count,
  bool_and(coalesce((e.meta ->> 'results')::integer, 0) = 0) as never_found,
  max(e.created_at) as last_searched
from store_events e
where e.event = 'search'
  and coalesce(btrim(e.meta ->> 'q'), '') <> ''
group by e.tenant_id, lower(btrim(e.meta ->> 'q'));

comment on view store_searches is
  'Search terms with how often they were asked and whether they ever returned anything. never_found true is a product to stock or a word the catalogue does not use for something it already sells.';

/*
 * The shop, by day.
 *
 * Deliberately visits rather than people. The session id is a module variable
 * that dies on reload, so somebody who refreshes twice counts three times. That
 * is the price of storing nothing on the visitor's device and needing no
 * consent banner, and the number has to be labelled honestly rather than
 * dressed up as a headcount.
 *
 * Nothing filters crawlers either, so views inflate from the day the sitemap is
 * submitted. Also said on screen rather than only here.
 */
create or replace view store_days as
select
  e.tenant_id,
  date_trunc('day', e.created_at)::date as day,
  count(distinct e.session_id)::bigint as visits,
  count(*) filter (where e.event = 'view_product')  as product_views,
  count(*) filter (where e.event = 'add_to_basket') as adds,
  count(*) filter (where e.event = 'begin_checkout') as checkouts,
  count(*) filter (where e.event = 'search')        as searches
from store_events e
group by e.tenant_id, date_trunc('day', e.created_at)::date;

comment on view store_days is
  'The shop by day. Visits rather than people: the session id dies on reload, so a refresh counts twice, and nothing filters crawlers.';
