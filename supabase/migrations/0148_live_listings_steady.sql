-- 0148_live_listings_steady.sql
-- live_listings without the two steps that grew with time (Joseey, 7 October: Listings timing out). Read for read,
-- the same rows and columns as before; only how two of its parts are found changes.
--
--   win    the latest eBay pull per shop: one index lookup (ebay_traffic_latest_idx) per shop, where it read every
--          traffic row ever saved to find the newest. That history grows by about 600 rows a day.
--   cards  the card behind each eBay listing, matched in one pass, where each of 554 listings searched every portal
--          card on its own. Where two cards ever held one listing, the older card is the one used (it was either).
--
-- With 0147: 8 seconds in the portal before; 13 ms on the scratch copy at her size with a year of history added.

create or replace view live_listings with (security_invoker = on) as
 WITH win AS (
         SELECT tn.id AS tenant_id,
            l.window_start,
            l.window_end,
            l.fetched_at
           FROM tenants tn
             CROSS JOIN LATERAL ( SELECT t.window_start,
                    t.window_end,
                    t.fetched_at
                   FROM ebay_traffic t
                  WHERE t.tenant_id = tn.id AND t.listing_id IS NOT NULL
                  ORDER BY t.fetched_at DESC
                 LIMIT 1) l
        ), cards AS (
         SELECT DISTINCT ON (c.tenant_id, (c.ebay ->> 'listing_id'::text)) c.tenant_id,
            c.ebay ->> 'listing_id'::text AS listing_id,
            c.id,
            c.ebay,
            COALESCE(NULLIF(c.draft ->> 'title'::text, ''::text), c.title) AS title
           FROM candidates c
          WHERE c.ebay IS NOT NULL AND (c.ebay ->> 'listing_id'::text) IS NOT NULL
          ORDER BY c.tenant_id, (c.ebay ->> 'listing_id'::text), c.id
        ), active AS (
         SELECT t.tenant_id,
            t.listing_id,
            t.title,
            t.image_url,
            t.price,
            t.quantity_available,
            t.impressions,
            t.views,
            t.transactions,
            w.window_start,
            w.window_end,
            w.fetched_at
           FROM ebay_traffic t
             JOIN win w ON w.tenant_id = t.tenant_id AND t.window_start = w.window_start AND t.window_end = w.window_end
          WHERE t.listing_id IS NOT NULL AND t.ended_at IS NULL
        ), published AS (
         SELECT c.tenant_id,
            c.ebay ->> 'listing_id'::text AS listing_id,
            COALESCE(NULLIF(c.draft ->> 'title'::text, ''::text), c.title) AS title,
            COALESCE((c.draft -> 'images'::text) ->> 0, c.image_url) AS image_url,
            NULLIF(c.ebay ->> 'price'::text, ''::text)::numeric AS price,
            NULLIF(c.ebay ->> 'quantity'::text, ''::text)::integer AS quantity_available,
            NULL::integer AS impressions,
            NULL::integer AS views,
            NULL::integer AS transactions,
            NULL::date AS window_start,
            NULL::date AS window_end,
            NULL::timestamp with time zone AS fetched_at
           FROM candidates c
             LEFT JOIN win w ON w.tenant_id = c.tenant_id
          WHERE (c.ebay ->> 'listing_id'::text) IS NOT NULL AND (c.ebay ->> 'ended_at'::text) IS NULL AND (w.fetched_at IS NULL OR NULLIF(c.ebay ->> 'published_at'::text, ''::text)::timestamp with time zone > w.fetched_at) AND NOT (EXISTS ( SELECT 1
                   FROM active a
                  WHERE a.tenant_id = c.tenant_id AND a.listing_id = (c.ebay ->> 'listing_id'::text)))
        ), ebay_rows AS (
         SELECT active.tenant_id,
            active.listing_id,
            active.title,
            active.image_url,
            active.price,
            active.quantity_available,
            active.impressions,
            active.views,
            active.transactions,
            active.window_start,
            active.window_end,
            active.fetched_at
           FROM active
        UNION ALL
         SELECT published.tenant_id,
            published.listing_id,
            published.title,
            published.image_url,
            published.price,
            published.quantity_available,
            published.impressions,
            published.views,
            published.transactions,
            published.window_start,
            published.window_end,
            published.fetched_at
           FROM published
        ), sale_keys AS (
         SELECT cs.tenant_id,
            cs.status,
            cs.qty,
            COALESCE(cs.listing_id,
                CASE
                    WHEN cs.external_sku ~ '^\d{9,15}$'::text THEN cs.external_sku
                    ELSE NULL::text
                END, ( SELECT sp.source_ref
                   FROM store_products sp
                  WHERE sp.id = cs.product_id AND sp.source_kind = 'ebay_listing'::text)) AS listing_id
           FROM channel_sales cs
          WHERE cs.channel = 'ebay'::text
        ), ebay_sold AS (
         SELECT sale_keys.tenant_id,
            sale_keys.listing_id,
            COALESCE(sum(sale_keys.qty) FILTER (WHERE sale_keys.status = 'paid'::text), 0::bigint)::integer AS sold,
            COALESCE(sum(sale_keys.qty) FILTER (WHERE sale_keys.status <> 'paid'::text), 0::bigint)::integer AS refunded
           FROM sale_keys
          WHERE sale_keys.listing_id IS NOT NULL
          GROUP BY sale_keys.tenant_id, sale_keys.listing_id
        ), shop_sold AS (
         SELECT o.tenant_id,
            oi.product_id,
            sum(oi.qty)::integer AS sold
           FROM orders o
             JOIN order_items oi ON oi.order_id = o.id
          WHERE o.status = 'paid'::text AND oi.product_id IS NOT NULL
          GROUP BY o.tenant_id, oi.product_id
        ), seen AS (
         SELECT e.tenant_id,
            e.product_id,
            count(*) FILTER (WHERE e.event = 'view_product'::text)::integer AS views,
            count(*) FILTER (WHERE e.event = 'quick_view'::text)::integer AS quick_views,
            count(*) FILTER (WHERE e.event = 'save_product'::text)::integer AS saves,
            count(*) FILTER (WHERE e.event = 'add_to_basket'::text)::integer AS adds,
            count(*) FILTER (WHERE e.event = 'remove_from_basket'::text)::integer AS removes
           FROM store_events e
          WHERE e.product_id IS NOT NULL
          GROUP BY e.tenant_id, e.product_id
        ), ebay_live AS (
         SELECT 'e-'::text || e.listing_id AS key,
            e.tenant_id,
            e.listing_id,
            card.id AS candidate_id,
            p.id AS product_id,
            COALESCE(e.title, card.title, p.title) AS title,
            COALESCE(e.image_url, p.image_url) AS image_url,
            e.price,
            e.quantity_available AS available,
            e.impressions,
            e.views,
            e.transactions AS orders_window,
            e.window_start,
            e.window_end,
            COALESCE(es.sold, 0) +
                CASE
                    WHEN p.status = 'live'::text THEN COALESCE(ss.sold, 0)
                    ELSE 0
                END AS sold,
            COALESCE(es.refunded, 0) AS refunded,
            true AS on_ebay,
            COALESCE(p.status = 'live'::text, false) AS on_shop,
            p.status AS shop_state,
            p.slug AS shop_slug,
            p.price AS shop_price,
            NULLIF(card.ebay ->> 'published_at'::text, ''::text)::timestamp with time zone AS since,
                CASE
                    WHEN p.status = 'live'::text THEN COALESCE(sn.views, 0)
                    ELSE NULL::integer
                END AS shop_views,
                CASE
                    WHEN p.status = 'live'::text THEN COALESCE(sn.quick_views, 0)
                    ELSE NULL::integer
                END AS shop_quick_views,
                CASE
                    WHEN p.status = 'live'::text THEN COALESCE(sn.saves, 0)
                    ELSE NULL::integer
                END AS shop_saves,
                CASE
                    WHEN p.status = 'live'::text THEN COALESCE(sn.adds, 0)
                    ELSE NULL::integer
                END AS shop_adds,
                CASE
                    WHEN p.status = 'live'::text THEN COALESCE(sn.removes, 0)
                    ELSE NULL::integer
                END AS shop_removes,
                CASE
                    WHEN p.status = 'live'::text THEN COALESCE(ss.sold, 0)
                    ELSE NULL::integer
                END AS shop_sold,
            COALESCE(e.views, 0) +
                CASE
                    WHEN p.status = 'live'::text THEN COALESCE(sn.views, 0)
                    ELSE 0
                END AS views_all
           FROM ebay_rows e
             LEFT JOIN cards card ON card.tenant_id = e.tenant_id AND card.listing_id = e.listing_id
             LEFT JOIN LATERAL ( SELECT sp.id,
                    sp.status,
                    sp.slug,
                    sp.price,
                    sp.title,
                    sp.image_url,
                    sp.created_at
                   FROM store_products sp
                  WHERE sp.tenant_id = e.tenant_id AND sp.source_kind = 'ebay_listing'::text AND sp.source_ref = e.listing_id AND sp.archived_at IS NULL AND sp.is_sample = false AND (sp.status = ANY (ARRAY['live'::text, 'draft'::text]))
                  ORDER BY (sp.status = 'live'::text) DESC, sp.created_at
                 LIMIT 1) p1 ON true
             LEFT JOIN LATERAL ( SELECT sp.id,
                    sp.status,
                    sp.slug,
                    sp.price,
                    sp.title,
                    sp.image_url,
                    sp.created_at
                   FROM store_products sp
                  WHERE card.id IS NOT NULL AND sp.tenant_id = e.tenant_id AND sp.candidate_id = card.id AND sp.archived_at IS NULL AND sp.is_sample = false AND (sp.status = ANY (ARRAY['live'::text, 'draft'::text]))
                  ORDER BY (sp.status = 'live'::text) DESC, sp.created_at
                 LIMIT 1) p2 ON true
             CROSS JOIN LATERAL ( SELECT x.id,
                    x.status,
                    x.slug,
                    x.price,
                    x.title,
                    x.image_url,
                    x.created_at
                   FROM ( VALUES (p1.id,p1.status,p1.slug,p1.price,p1.title,p1.image_url,p1.created_at), (p2.id,p2.status,p2.slug,p2.price,p2.title,p2.image_url,p2.created_at)) x(id, status, slug, price, title, image_url, created_at)
                  ORDER BY (x.id IS NULL), (x.status = 'live'::text) DESC, x.created_at
                 LIMIT 1) p
             LEFT JOIN ebay_sold es ON es.tenant_id = e.tenant_id AND es.listing_id = e.listing_id
             LEFT JOIN shop_sold ss ON ss.tenant_id = e.tenant_id AND ss.product_id = p.id
             LEFT JOIN seen sn ON sn.tenant_id = e.tenant_id AND sn.product_id = p.id
        )
 SELECT ebay_live.key,
    ebay_live.tenant_id,
    ebay_live.listing_id,
    ebay_live.candidate_id,
    ebay_live.product_id,
    ebay_live.title,
    ebay_live.image_url,
    ebay_live.price,
    ebay_live.available,
    ebay_live.impressions,
    ebay_live.views,
    ebay_live.orders_window,
    ebay_live.window_start,
    ebay_live.window_end,
    ebay_live.sold,
    ebay_live.refunded,
    ebay_live.on_ebay,
    ebay_live.on_shop,
    ebay_live.shop_state,
    ebay_live.shop_slug,
    ebay_live.shop_price,
    ebay_live.since,
    ebay_live.shop_views,
    ebay_live.shop_quick_views,
    ebay_live.shop_saves,
    ebay_live.shop_adds,
    ebay_live.shop_removes,
    ebay_live.shop_sold,
    ebay_live.views_all
   FROM ebay_live
UNION ALL
 SELECT 's-'::text || sp.id AS key,
    sp.tenant_id,
    NULL::text AS listing_id,
    sp.candidate_id,
    sp.id AS product_id,
    sp.title,
    sp.image_url,
    sp.price,
    sp.stock AS available,
    NULL::integer AS impressions,
    NULL::integer AS views,
    NULL::integer AS orders_window,
    NULL::date AS window_start,
    NULL::date AS window_end,
    COALESCE(ss.sold, 0) AS sold,
    0 AS refunded,
    false AS on_ebay,
    true AS on_shop,
    sp.status AS shop_state,
    sp.slug AS shop_slug,
    sp.price AS shop_price,
    sp.created_at AS since,
    COALESCE(sn.views, 0) AS shop_views,
    COALESCE(sn.quick_views, 0) AS shop_quick_views,
    COALESCE(sn.saves, 0) AS shop_saves,
    COALESCE(sn.adds, 0) AS shop_adds,
    COALESCE(sn.removes, 0) AS shop_removes,
    COALESCE(ss.sold, 0) AS shop_sold,
    COALESCE(sn.views, 0) AS views_all
   FROM store_products sp
     LEFT JOIN shop_sold ss ON ss.tenant_id = sp.tenant_id AND ss.product_id = sp.id
     LEFT JOIN seen sn ON sn.tenant_id = sp.tenant_id AND sn.product_id = sp.id
  WHERE sp.status = 'live'::text AND sp.archived_at IS NULL AND sp.is_sample = false AND NOT (EXISTS ( SELECT 1
           FROM ebay_live el
          WHERE el.product_id = sp.id));
