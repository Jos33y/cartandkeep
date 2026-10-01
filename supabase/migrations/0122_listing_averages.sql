-- 0122_listing_averages.sql
-- Her eBay totals across live listings over the pull's 90 days, returned with the Listings counts, so each listing's
-- open rate and order rate can be shown against her own average. Only the counts function changes.

create or replace function live_listing_counts(p_tenant uuid)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'all',       count(*),
    'ebay',      count(*) filter (where on_ebay),
    'shop',      count(*) filter (where on_shop),
    'both',      count(*) filter (where on_ebay and on_shop),
    'ebay_only', count(*) filter (where on_ebay and not on_shop),
    'shop_only', count(*) filter (where on_shop and not on_ebay),
    'no_shop',   count(*) filter (where on_ebay and shop_state is null),
    'drafts',    count(*) filter (where on_ebay and shop_state = 'draft'),
    'out',       count(*) filter (where available = 0),
    'low',       count(*) filter (where available between 1 and 2),
    'quiet',     count(*) filter (where on_ebay and views = 0),
    'selling',   count(*) filter (where sold > 0),
    'wanted',    count(*) filter (where on_shop and coalesce(shop_sold, 0) = 0 and (shop_adds > 0 or shop_saves > 0)),
    -- Her eBay averages over the same 90 days, so a listing's open and order rates can be read against them.
    'ebay_impressions', coalesce(sum(impressions) filter (where on_ebay), 0),
    'ebay_views',       coalesce(sum(views) filter (where on_ebay), 0),
    'ebay_orders',      coalesce(sum(orders_window) filter (where on_ebay), 0),
    'pulled_at', (select max(fetched_at) from ebay_traffic t where t.tenant_id = p_tenant and t.listing_id is not null)
  )
  from live_listings
  where tenant_id = p_tenant;
$$;

revoke all on function live_listing_counts(uuid) from public, anon;
grant execute on function live_listing_counts(uuid) to authenticated;
