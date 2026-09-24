-- store_source_days checked every visit for a basket with a subquery of its own, which is one lookup
-- per visit per page load: fine at a hundred visits, slow at ten thousand. Baskets are now found once
-- and joined. Visits are also counted once each, where a visit with two orders used to count twice.
create or replace view store_source_days with (security_invoker = on) as
with baskets as (
  select distinct session_id
  from store_events
  where event = 'add_to_basket'
),
paid as (
  select session_id, count(*)::bigint as orders, sum(total) as revenue
  from orders
  where status = 'paid' and session_id is not null
  group by session_id
)
select
  v.tenant_id,
  v.day,
  v.source,
  count(*)::bigint as visits,
  count(b.session_id)::bigint as visits_with_a_basket,
  coalesce(sum(p.orders), 0)::bigint as orders,
  coalesce(sum(p.revenue), 0) as revenue
from store_visit_sources v
left join baskets b on b.session_id = v.session_id
left join paid p on p.session_id = v.session_id
group by v.tenant_id, v.day, v.source;

-- 0071 made the other views run as the person asking; these analytics views were missed, so any signed
-- in account could read another shop's visits through them.
alter view store_visit_sources set (security_invoker = on);
alter view store_days set (security_invoker = on);
alter view store_searches set (security_invoker = on);
alter view store_product_funnel set (security_invoker = on);
