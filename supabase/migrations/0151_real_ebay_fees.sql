-- 0151_real_ebay_fees.sql
-- Finance on eBay's real charges (Joseey, 8 October 2026). Needs 0150.
--
-- Before this, 37 of her 39 eBay sale lines carried no fee from eBay, so the profit view estimated every one at
-- 12.8% plus 30p. She sells on a private account, which pays no selling fee: Finance showed fees she was never charged.
--
--   channel_sales   ad_fees, the promoted listing's charge on the line, apart from the selling fee in fees; and
--                   fee_detail, each charge as eBay named it. Both written by ebay-sales from eBay's Finances API.
--   store_channel_profit
--                   ads are the line's real ad fee where eBay booked one, else the Finance setting as before. An
--                   eBay line with no fee from eBay is estimated for the account she sells on: nothing on private.
--   store_product_margin
--                   the eBay fee for the account: on private, the ad rate she usually runs and nothing else.
--
-- The views keep every column, name and grant. Recreating a view drops its options, so each view's options
-- (security_invoker) are read first and put back after. Safe to run twice.

drop table if exists pg_temp.keep_options;
create temporary table keep_options as
  select c.relname, c.reloptions
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname in ('store_revenue_lines', 'store_channel_profit', 'store_product_margin');

alter table channel_sales add column if not exists ad_fees numeric;
alter table channel_sales add column if not exists fee_detail jsonb;

comment on column channel_sales.ad_fees is
  'Promoted listings fee on this line, from eBay''s Finances API. Null when eBay has not booked the order: Finance then uses the ad rate setting.';
comment on column channel_sales.fee_detail is
  'Each charge on this line as eBay named it (FINAL_VALUE_FEE, AD_FEE and so on), in pounds.';

-- As before, with ad_fees on the end: a shop order has none.
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
    NULL::numeric AS ad_fees
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
    c.ad_fees
   FROM channel_sales c
  WHERE c.status = 'paid'::text;

-- The account a shop sells on, as the portal reads it (lib/ebayAccount.js): her choice, else what eBay says.
create or replace function ebay_seller_type(p_tenant uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select coalesce(a.seller_type, case a.ebay_type when 'INDIVIDUAL' then 'private' when 'BUSINESS' then 'business' end)
     from ebay_account a where a.tenant_id = p_tenant),
    'business');
$$;

revoke all on function ebay_seller_type(uuid) from public, anon;
grant execute on function ebay_seller_type(uuid) to authenticated, service_role;

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
            COALESCE(p.postage_cost, sc.postage_cost) IS NOT NULL AS postage_known,
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
    sum(postage_cost * qty::numeric) AS postage,
        CASE
            WHEN bool_and(landed_cost IS NOT NULL) THEN sum(landed_cost * qty::numeric)
            ELSE NULL::numeric
        END AS cost_of_goods,
        CASE
            WHEN bool_and(landed_cost IS NOT NULL) THEN sum(gross - fee_applied - ads - packaging - returns_provision - postage_cost * qty::numeric - landed_cost * qty::numeric)
            ELSE NULL::numeric
        END AS net,
    bool_and(landed_cost IS NOT NULL) AS costed,
    bool_and(postage_known) AS postage_known,
    bool_or(fees_estimated) AS fees_estimated,
    count(*) FILTER (WHERE product_id IS NULL) AS unmatched_lines
   FROM priced
  GROUP BY tenant_id, channel, (date_trunc('month'::text, sold_at)::date), product_id, (COALESCE(product_title, title));

create or replace view store_product_margin as
 WITH fee AS (
         SELECT t.id AS tenant_id,
            COALESCE(((t.fees -> 'store'::text) ->> 'pct'::text)::numeric, 0.015) AS store_pct,
            COALESCE(((t.fees -> 'store'::text) ->> 'fixed'::text)::numeric, 0.20) AS store_fixed,
            -- A private seller pays no selling fee: the ad rate she usually runs stands in, as on the portal.
            CASE WHEN ebay_seller_type(t.id) = 'private'
                 THEN COALESCE((SELECT a.typical_ad FROM ebay_account a WHERE a.tenant_id = t.id), 0::numeric)
                 ELSE COALESCE(((t.fees -> 'ebay'::text) ->> 'pct'::text)::numeric, 0.128) END AS ebay_pct,
            CASE WHEN ebay_seller_type(t.id) = 'private' THEN 0::numeric
                 ELSE COALESCE(((t.fees -> 'ebay'::text) ->> 'fixed'::text)::numeric, 0.30) END AS ebay_fixed,
            COALESCE(((t.fees -> 'tiktok'::text) ->> 'pct'::text)::numeric, 0.065) AS tiktok_pct,
            COALESCE(((t.fees -> 'tiktok'::text) ->> 'fixed'::text)::numeric, 0.00) AS tiktok_fixed
           FROM tenants t
        )
 SELECT p.tenant_id,
    p.id AS product_id,
    p.slug,
    p.title,
    p.status,
    p.is_sample,
    p.price,
    p.landed_cost,
    p.postage_cost,
    p.cost_updated_at,
    p.landed_cost IS NULL AS cost_unknown,
    p.postage_cost IS NULL AS postage_unknown,
    round(p.price * f.store_pct + f.store_fixed, 2) AS store_fee,
    round(p.price * f.ebay_pct + f.ebay_fixed, 2) AS ebay_fee,
    round(p.price * f.tiktok_pct + f.tiktok_fixed, 2) AS tiktok_fee,
        CASE
            WHEN p.landed_cost IS NOT NULL THEN round(p.price - (p.price * f.store_pct + f.store_fixed) - p.landed_cost - COALESCE(p.postage_cost, 0::numeric), 2)
            ELSE NULL::numeric
        END AS store_net,
        CASE
            WHEN p.landed_cost IS NOT NULL THEN round(p.price - (p.price * f.ebay_pct + f.ebay_fixed) - p.landed_cost - COALESCE(p.postage_cost, 0::numeric), 2)
            ELSE NULL::numeric
        END AS ebay_net,
        CASE
            WHEN p.landed_cost IS NOT NULL THEN round(p.price - (p.price * f.tiktok_pct + f.tiktok_fixed) - p.landed_cost - COALESCE(p.postage_cost, 0::numeric), 2)
            ELSE NULL::numeric
        END AS tiktok_net,
        CASE
            WHEN p.landed_cost IS NOT NULL AND p.price > 0::numeric THEN round((p.price - (p.price * f.store_pct + f.store_fixed) - p.landed_cost - COALESCE(p.postage_cost, 0::numeric)) / p.price * 100::numeric, 1)
            ELSE NULL::numeric
        END AS store_margin_pct,
        CASE
            WHEN p.landed_cost IS NOT NULL AND p.price > 0::numeric THEN round((p.price - (p.price * f.ebay_pct + f.ebay_fixed) - p.landed_cost - COALESCE(p.postage_cost, 0::numeric)) / p.price * 100::numeric, 1)
            ELSE NULL::numeric
        END AS ebay_margin_pct,
        CASE
            WHEN p.landed_cost IS NOT NULL AND p.price > 0::numeric THEN round((p.price - (p.price * f.tiktok_pct + f.tiktok_fixed) - p.landed_cost - COALESCE(p.postage_cost, 0::numeric)) / p.price * 100::numeric, 1)
            ELSE NULL::numeric
        END AS tiktok_margin_pct
   FROM store_products p
     JOIN fee f ON f.tenant_id = p.tenant_id;

-- Each view's options as they were.
do $$
declare
  v record;
begin
  for v in select relname, reloptions from keep_options where reloptions is not null loop
    execute format('alter view %I set (%s)', v.relname, array_to_string(v.reloptions, ', '));
  end loop;
end $$;

drop table if exists pg_temp.keep_options;
