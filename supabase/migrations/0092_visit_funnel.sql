-- store_days counted events, so one person loading checkout three times was three checkouts and
-- the page showed more checkouts than baskets. This counts visits at each stage instead.
create or replace view store_visit_funnel with (security_invoker = on) as
select
  e.tenant_id,
  (e.created_at at time zone 'Europe/London')::date as day,
  count(distinct e.session_id)::bigint as visits,
  count(distinct e.session_id) filter (where e.event in ('view_product', 'quick_view'))::bigint as viewed,
  count(distinct e.session_id) filter (where e.event = 'add_to_basket')::bigint as basket,
  count(distinct e.session_id) filter (where e.event = 'begin_checkout')::bigint as checkout
from store_events e
group by e.tenant_id, (e.created_at at time zone 'Europe/London')::date;

grant select on store_visit_funnel to authenticated;

-- The read policy was using (true); every signed in account could read every shop's visits.
drop policy if exists store_events_read on store_events;
create policy store_events_read on store_events
  for select to authenticated
  using (has_tenant(tenant_id));
