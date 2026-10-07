-- 0146_overview_counts.sql
-- The Overview's figures, counted fast enough for the portal (Joseey, 7 October: Live showed 0 every time and
-- Approved most times). As the portal's signed-in role, live_listing_counts took 7.7 seconds of its 8 second limit:
-- the row security on the view is checked row by row. Over the limit the read fails, and the page showed the failure
-- as 0. Both functions now check once that the caller belongs to the shop, then count without the row checks.

-- What is on her eBay and her shop, as 0122 counted it, unchanged apart from the one check up front.
create or replace function live_listing_counts(p_tenant uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  out jsonb;
begin
  if not has_tenant(p_tenant) then raise exception 'Not your shop.' using errcode = '42501'; end if;
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
  ) into out
  from live_listings
  where tenant_id = p_tenant;
  return out;
end;
$$;

revoke all on function live_listing_counts(uuid) from public, anon;
grant execute on function live_listing_counts(uuid) to authenticated;

/*
 * The two figures at the top of the Overview that follow the portal's own work:
 *   approved     approved cards with a channel still to start, the Approved page's list (golive.js channelStates):
 *                eBay when the card is for eBay and has no listing yet, her shop when it has no shop product yet
 *   listed_here  cards listed on eBay from the portal
 */
create or replace function overview_counts(p_tenant uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  out jsonb;
begin
  if not has_tenant(p_tenant) then raise exception 'Not your shop.' using errcode = '42501'; end if;
  select jsonb_build_object(
    'approved', count(*) filter (where d.action = 'approve' and (
        (candidate_for_ebay(c) and c.ebay ->> 'listing_id' is null)
        or not exists (select 1 from store_products s where s.candidate_id = c.id))),
    'listed_here', count(*) filter (where c.ebay ->> 'listing_id' is not null)
  ) into out
  from candidates c
  left join decisions d on d.candidate_id = c.id
  where c.tenant_id = p_tenant;
  return out;
end;
$$;

revoke all on function overview_counts(uuid) from public, anon;
grant execute on function overview_counts(uuid) to authenticated;
