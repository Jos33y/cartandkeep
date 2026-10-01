-- 0120_live_listings.sql
-- What is live, worked out in the database, one row per live listing, so the Listings page reads a page of 60 at a
-- time, sorted and filtered here, rather than downloading every listing, product and sale on each visit. Built for
-- 5,000 listings and more.
--
-- Live means: an eBay listing active in the latest traffic pull (eBay's own list of what is on sale, read every
-- morning), or published from the portal since; and a shop product on sale (status live, not archived, not a sample).
-- A shop product copied from an eBay listing, or made from the card that listing was published from, is the same
-- product: one row with both marks. Drafts, ended listings and the eBay queue are never rows here.
-- Runs as the caller (security_invoker), so each tenant sees only its own rows through the tables' own policies.

create index if not exists candidates_ebay_listing_idx on candidates (tenant_id, (ebay ->> 'listing_id')) where ebay is not null;
-- Already made by 0034; repeated so this view never runs without it.
create index if not exists store_products_source_idx on store_products (tenant_id, source_kind, source_ref);
create index if not exists store_products_candidate_idx on store_products (tenant_id, candidate_id) where candidate_id is not null;
create index if not exists ebay_traffic_latest_idx on ebay_traffic (tenant_id, fetched_at desc) where listing_id is not null;
create index if not exists channel_sales_sku_idx on channel_sales (tenant_id, external_sku);

create or replace view live_listings
with (security_invoker = on) as
with win as (
  -- The latest pull per shop: the window its listing rows were written for.
  select distinct on (tenant_id) tenant_id, window_start, window_end, fetched_at
  from ebay_traffic
  where listing_id is not null
  order by tenant_id, fetched_at desc
),
active as (
  select t.tenant_id, t.listing_id, t.title, t.image_url, t.price, t.quantity_available,
         t.impressions, t.views, t.transactions, w.window_start, w.window_end, w.fetched_at
  from ebay_traffic t
  join win w on w.tenant_id = t.tenant_id and t.window_start = w.window_start and t.window_end = w.window_end
  where t.listing_id is not null and t.ended_at is null
),
published as (
  -- Published from the portal after the last pull: live, though the pull has not seen it yet.
  select c.tenant_id, c.ebay ->> 'listing_id' as listing_id,
         coalesce(nullif(c.draft ->> 'title', ''), c.title) as title,
         coalesce(c.draft -> 'images' ->> 0, c.image_url) as image_url,
         nullif(c.ebay ->> 'price', '')::numeric as price,
         nullif(c.ebay ->> 'quantity', '')::integer as quantity_available,
         null::integer as impressions, null::integer as views, null::integer as transactions,
         null::date as window_start, null::date as window_end, null::timestamptz as fetched_at
  from candidates c
  left join win w on w.tenant_id = c.tenant_id
  where c.ebay ->> 'listing_id' is not null
    and c.ebay ->> 'ended_at' is null
    and (w.fetched_at is null or nullif(c.ebay ->> 'published_at', '')::timestamptz > w.fetched_at)
    and not exists (select 1 from active a where a.tenant_id = c.tenant_id and a.listing_id = c.ebay ->> 'listing_id')
),
ebay_rows as (
  select * from active
  union all
  select * from published
),
sale_keys as (
  -- Which listing each eBay sale was on: the item number kept on the sale, else a SKU that is the item number, else
  -- the shop product the sale was matched to when that product was copied from the listing.
  select cs.tenant_id, cs.status, cs.qty,
         coalesce(
           cs.listing_id,
           case when cs.external_sku ~ '^\d{9,15}$' then cs.external_sku end,
           (select sp.source_ref from store_products sp where sp.id = cs.product_id and sp.source_kind = 'ebay_listing')
         ) as listing_id
  from channel_sales cs
  where cs.channel = 'ebay'
),
ebay_sold as (
  select tenant_id, listing_id,
         coalesce(sum(qty) filter (where status = 'paid'), 0)::integer as sold,
         coalesce(sum(qty) filter (where status <> 'paid'), 0)::integer as refunded
  from sale_keys
  where listing_id is not null
  group by tenant_id, listing_id
),
shop_sold as (
  select o.tenant_id, oi.product_id, sum(oi.qty)::integer as sold
  from orders o
  join order_items oi on oi.order_id = o.id
  where o.status = 'paid' and oi.product_id is not null
  group by o.tenant_id, oi.product_id
),
ebay_live as (
  select
    'e-' || e.listing_id as key,
    e.tenant_id,
    e.listing_id,
    card.id as candidate_id,
    p.id as product_id,
    coalesce(e.title, card.title, p.title) as title,
    coalesce(e.image_url, p.image_url) as image_url,
    e.price,
    e.quantity_available as available,
    e.impressions,
    e.views,
    e.transactions as orders_window,
    e.window_start,
    e.window_end,
    coalesce(es.sold, 0) + case when p.status = 'live' then coalesce(ss.sold, 0) else 0 end as sold,
    coalesce(es.refunded, 0) as refunded,
    true as on_ebay,
    coalesce(p.status = 'live', false) as on_shop,
    p.status as shop_state,
    p.slug as shop_slug,
    p.price as shop_price,
    nullif(card.ebay ->> 'published_at', '')::timestamptz as since
  from ebay_rows e
  left join lateral (
    select c.id, c.ebay, coalesce(nullif(c.draft ->> 'title', ''), c.title) as title
    from candidates c
    where c.tenant_id = e.tenant_id and c.ebay ->> 'listing_id' = e.listing_id
    limit 1
  ) card on true
  -- The shop product for this listing, looked up two ways on their own indexes (one OR here scanned the table for
  -- every row): copied from the listing, or made from the card it was published from. On sale before a draft.
  left join lateral (
    select sp.id, sp.status, sp.slug, sp.price, sp.title, sp.image_url, sp.created_at
    from store_products sp
    where sp.tenant_id = e.tenant_id and sp.source_kind = 'ebay_listing' and sp.source_ref = e.listing_id
      and sp.archived_at is null and sp.is_sample = false and sp.status in ('live', 'draft')
    order by (sp.status = 'live') desc, sp.created_at
    limit 1
  ) p1 on true
  left join lateral (
    select sp.id, sp.status, sp.slug, sp.price, sp.title, sp.image_url, sp.created_at
    from store_products sp
    where card.id is not null and sp.tenant_id = e.tenant_id and sp.candidate_id = card.id
      and sp.archived_at is null and sp.is_sample = false and sp.status in ('live', 'draft')
    order by (sp.status = 'live') desc, sp.created_at
    limit 1
  ) p2 on true
  cross join lateral (
    select x.* from (values (p1.id, p1.status, p1.slug, p1.price, p1.title, p1.image_url, p1.created_at),
                            (p2.id, p2.status, p2.slug, p2.price, p2.title, p2.image_url, p2.created_at))
      as x (id, status, slug, price, title, image_url, created_at)
    order by (x.id is null), (x.status = 'live') desc, x.created_at
    limit 1
  ) p
  left join ebay_sold es on es.tenant_id = e.tenant_id and es.listing_id = e.listing_id
  left join shop_sold ss on ss.tenant_id = e.tenant_id and ss.product_id = p.id
)
select * from ebay_live
union all
-- Her shop: products on sale that are not already a row with their eBay listing.
select
  's-' || sp.id as key,
  sp.tenant_id,
  null::text as listing_id,
  sp.candidate_id,
  sp.id as product_id,
  sp.title,
  sp.image_url,
  sp.price,
  sp.stock as available,
  null::integer as impressions,
  null::integer as views,
  null::integer as orders_window,
  null::date as window_start,
  null::date as window_end,
  coalesce(ss.sold, 0) as sold,
  0 as refunded,
  false as on_ebay,
  true as on_shop,
  sp.status as shop_state,
  sp.slug as shop_slug,
  sp.price as shop_price,
  sp.created_at as since
from store_products sp
left join shop_sold ss on ss.tenant_id = sp.tenant_id and ss.product_id = sp.id
where sp.status = 'live'
  and sp.archived_at is null
  and sp.is_sample = false
  and not exists (select 1 from ebay_live el where el.product_id = sp.id);

revoke all on live_listings from anon;
grant select on live_listings to authenticated;

/*
 * The counts for the page's header, tabs and filters, and the Overview, in one call. The same rows the page lists,
 * so a count and its list can never disagree. pulled_at is when eBay was last read.
 */
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
    'pulled_at', (select max(fetched_at) from ebay_traffic t where t.tenant_id = p_tenant and t.listing_id is not null)
  )
  from live_listings
  where tenant_id = p_tenant;
$$;

revoke all on function live_listing_counts(uuid) from public, anon;
grant execute on function live_listing_counts(uuid) to authenticated;
