-- 0153_postage_from_labels.sql
-- Postage on eBay sales from the labels she bought on eBay (Joseey, 8 October 2026). Needs 0151.
--
-- eBay's Finances API books every postage label bought on eBay against the order it was for: £84.38 in 90 days,
-- while Finance counted £3.99, from the few products with a postage cost typed in. ebay-sales now writes the label's
-- cost on each line (postage_paid); the profit view takes it over the product's postage wherever there is one, and
-- says on how many lines it did (labelled_lines, a new column on the end). Everything else is as 0151 left it.
--
-- Recreating a view drops its options, so each one's options are read first and put back. Safe to run twice.

drop table if exists pg_temp.keep_options;
create temporary table keep_options as
  select c.relname, c.reloptions
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname in ('store_revenue_lines', 'store_channel_profit');

alter table channel_sales add column if not exists postage_paid numeric;

comment on column channel_sales.postage_paid is
  'Postage labels bought on eBay for this line''s order, its share, from eBay''s Finances API. Null when no label was bought on eBay.';

create or replace view store_revenue_lines as
 SELECT o.tenant_id,
    'store'::text AS channel,
    o.reference AS external_ref,
    o.paid_at AS sold_at,
    oi.title,
    oi.product_id,
    oi.qty,
    oi.line_total AS gross,
    NULL::numeric AS fees,
    true AS fees_estimated,
    row_number() OVER (PARTITION BY oi.order_id ORDER BY oi.id)::integer AS line_no,
    NULL::numeric AS ad_fees,
    NULL::numeric AS postage_paid
   FROM orders o
     JOIN order_items oi ON oi.order_id = o.id
  WHERE o.status = 'paid'::text
UNION ALL
 SELECT c.tenant_id,
    c.channel,
    c.external_ref,
    c.sold_at,
    c.title,
    c.product_id,
    c.qty,
    c.gross,
    c.fees,
    c.fees_estimated,
    c.line_no,
    c.ad_fees,
    c.postage_paid
   FROM channel_sales c
  WHERE c.status = 'paid'::text;

create or replace view store_channel_profit as
 WITH rate AS (
         SELECT t.id AS tenant_id,
            COALESCE(((t.fees -> 'store'::text) ->> 'pct'::text)::numeric, 0.015) AS store_pct,
            COALESCE(((t.fees -> 'store'::text) ->> 'fixed'::text)::numeric, 0.20) AS store_fixed,
            -- A private seller pays no selling fee and no per-order fee.
            CASE WHEN ebay_seller_type(t.id) = 'private' THEN 0::numeric
                 ELSE COALESCE(((t.fees -> 'ebay'::text) ->> 'pct'::text)::numeric, 0.128) END AS ebay_pct,
            CASE WHEN ebay_seller_type(t.id) = 'private' THEN 0::numeric
                 ELSE COALESCE(((t.fees -> 'ebay'::text) ->> 'fixed'::text)::numeric, 0.30) END AS ebay_fixed,
            COALESCE(((t.fees -> 'tiktok'::text) ->> 'pct'::text)::numeric, 0.065) AS tiktok_pct,
            COALESCE(((t.fees -> 'tiktok'::text) ->> 'fixed'::text)::numeric, 0.00) AS tiktok_fixed,
            COALESCE(((t.store -> 'selling_costs'::text) ->> 'packaging_per_order'::text)::numeric, 0::numeric) AS packaging,
            COALESCE(((t.store -> 'selling_costs'::text) ->> 'returns_provision_pct'::text)::numeric, 0::numeric) AS returns_pct,
            COALESCE(((t.store -> 'selling_costs'::text) ->> 'ad_rate_pct'::text)::numeric, 0::numeric) AS ad_pct
           FROM tenants t
        ), priced AS (
         SELECT l.tenant_id,
            l.channel,
            l.external_ref,
            l.sold_at,
            l.title,
            l.product_id,
            l.qty,
            l.gross,
            l.fees,
            l.fees_estimated,
            l.line_no,
            COALESCE(l.fees,
                CASE l.channel
                    WHEN 'store'::text THEN round(l.gross * r.store_pct + r.store_fixed, 2)
                    WHEN 'ebay'::text THEN round(l.gross * r.ebay_pct + r.ebay_fixed, 2)
                    WHEN 'tiktok'::text THEN round(l.gross * r.tiktok_pct + r.tiktok_fixed, 2)
                    ELSE 0::numeric
                END) AS fee_applied,
                -- eBay's own ad fee on the line where it booked one; the setting only where it has not.
                CASE
                    WHEN l.channel = 'ebay'::text THEN COALESCE(l.ad_fees, round(l.gross * r.ad_pct, 2))
                    ELSE 0::numeric
                END AS ads,
            round(l.gross * r.returns_pct, 2) AS returns_provision,
                CASE
                    WHEN l.line_no = 1 THEN r.packaging
                    ELSE 0::numeric
                END AS packaging,
            COALESCE(p.postage_cost, sc.postage_cost, 0::numeric) AS postage_cost,
            -- The label she bought on eBay for this sale when there was one, else the product's postage per unit.
            COALESCE(l.postage_paid, COALESCE(p.postage_cost, sc.postage_cost, 0::numeric) * l.qty::numeric) AS postage_line,
            l.postage_paid IS NOT NULL AS labelled,
            l.postage_paid IS NOT NULL OR COALESCE(p.postage_cost, sc.postage_cost) IS NOT NULL AS postage_known,
            COALESCE(p.landed_cost, sc.landed_cost) AS landed_cost,
            p.title AS product_title
           FROM store_revenue_lines l
             JOIN rate r ON r.tenant_id = l.tenant_id
             LEFT JOIN store_products p ON p.id = l.product_id
             LEFT JOIN sale_costs sc ON sc.tenant_id = l.tenant_id AND sc.title = l.title
        )
 SELECT tenant_id,
    channel,
    date_trunc('month'::text, sold_at)::date AS month,
    product_id,
    COALESCE(product_title, title) AS title,
    sum(qty) AS units,
    sum(gross) AS revenue,
    sum(fee_applied) AS fees,
    sum(ads) AS ads,
    sum(packaging) AS packaging,
    sum(returns_provision) AS returns_provision,
    sum(postage_line) AS postage,
        CASE
            WHEN bool_and(landed_cost IS NOT NULL) THEN sum(landed_cost * qty::numeric)
            ELSE NULL::numeric
        END AS cost_of_goods,
        CASE
            WHEN bool_and(landed_cost IS NOT NULL) THEN sum(gross - fee_applied - ads - packaging - returns_provision - postage_line - landed_cost * qty::numeric)
            ELSE NULL::numeric
        END AS net,
    bool_and(landed_cost IS NOT NULL) AS costed,
    bool_and(postage_known) AS postage_known,
    bool_or(fees_estimated) AS fees_estimated,
    count(*) FILTER (WHERE product_id IS NULL) AS unmatched_lines,
    count(*) FILTER (WHERE labelled) AS labelled_lines
   FROM priced
  GROUP BY tenant_id, channel, (date_trunc('month'::text, sold_at)::date), product_id, (COALESCE(product_title, title));

do $$
declare
  v record;
begin
  for v in select relname, reloptions from keep_options where reloptions is not null loop
    execute format('alter view %I set (%s)', v.relname, array_to_string(v.reloptions, ', '));
  end loop;
end $$;

drop table if exists pg_temp.keep_options;
