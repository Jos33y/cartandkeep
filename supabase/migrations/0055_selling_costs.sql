-- The costs the model promised and nothing recorded.
--
-- The finance screen has advertised an eight line margin model since July:
-- revenue, the platform fee, promoted listings, postage, packaging, a returns
-- provision, cost of goods, net. Four of those existed by yesterday. Packaging
-- and a returns provision existed nowhere, and shipping a four line model under
-- an eight line promise is the same fault as a claim the database cannot
-- support, only with more arithmetic in front of it.
--
-- Both are hers, both default to zero, and zero changes no figure until she
-- puts her own numbers in. Same shape as the delivery surcharges: the mechanism
-- ships and the values come off her own costs.

update tenants
set store = coalesce(store, '{}'::jsonb) || jsonb_build_object(
  'selling_costs', coalesce(store -> 'selling_costs', '{}'::jsonb) || jsonb_build_object(
    -- A box, tape, a label and a filler, per parcel rather than per item,
    -- because an order of three things goes in one box.
    'packaging_per_order', coalesce(store -> 'selling_costs' -> 'packaging_per_order', to_jsonb(0)),
    -- Set aside against the ones that come back. A percentage of revenue,
    -- because it is a rate rather than an event: she does not know which sale
    -- will be returned, only roughly how many are.
    'returns_provision_pct', coalesce(store -> 'selling_costs' -> 'returns_provision_pct', to_jsonb(0)),
    -- eBay promoted listings, where the export does not itemise it. Where it
    -- does, the real figure wins.
    'ad_rate_pct', coalesce(store -> 'selling_costs' -> 'ad_rate_pct', to_jsonb(0))
  )
)
where slug = 'cart-and-keep';

/*
 * The whitelist gains one key.
 *
 * `set_store_settings` merges only keys it is willing to accept, so a new
 * settings section is a new key here rather than a policy change. Recreated
 * whole rather than patched, because a function that exists in two versions
 * across two migrations is one nobody can read the current state of.
 */
create or replace function set_store_settings(p_tenant uuid, p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed text[] := array['trader', 'delivery', 'voice', 'socials', 'email', 'selling_costs'];
  merged jsonb;
  key text;
begin
  if not has_tenant(p_tenant) then
    raise exception 'Not your shop' using errcode = '42501';
  end if;

  select coalesce(store, '{}'::jsonb) into merged from tenants where id = p_tenant;
  if merged is null then
    raise exception 'No such shop' using errcode = 'P0002';
  end if;

  foreach key in array allowed loop
    if p_patch ? key then
      -- Merged into rather than replaced, so saving one field does not wipe
      -- the fields beside it.
      if jsonb_typeof(merged -> key) = 'object' and jsonb_typeof(p_patch -> key) = 'object' then
        merged := jsonb_set(merged, array[key], (merged -> key) || (p_patch -> key), true);
      else
        merged := jsonb_set(merged, array[key], p_patch -> key, true);
      end if;
    end if;
  end loop;

  update tenants set store = merged where id = p_tenant;
  return merged;
end;
$$;

revoke all on function set_store_settings(uuid, jsonb) from public, anon;
grant execute on function set_store_settings(uuid, jsonb) to authenticated;

/*
 * `store_revenue_lines` gains the line number.
 *
 * Packaging is charged once per order and the view had no way to say which line
 * starts one. Appended at the end because `create or replace view` will add a
 * column there and refuses to insert one in the middle.
 *
 * Orders from the shop have no line number of their own, so one is derived per
 * order. It only has to be stable within an order, which it is.
 */
create or replace view store_revenue_lines as
select
  o.tenant_id,
  'store'::text as channel,
  o.reference as external_ref,
  o.paid_at as sold_at,
  oi.title,
  oi.product_id,
  oi.qty,
  oi.line_total as gross,
  null::numeric as fees,
  true as fees_estimated,
  row_number() over (partition by oi.order_id order by oi.id)::integer as line_no
from orders o
join order_items oi on oi.order_id = o.id
where o.status = 'paid'

union all

select
  c.tenant_id,
  c.channel,
  c.external_ref,
  c.sold_at,
  c.title,
  c.product_id,
  c.qty,
  c.gross,
  c.fees,
  c.fees_estimated,
  c.line_no
from channel_sales c
where c.status = 'paid';

/*
 * Net, with every line the model promised.
 *
 * Packaging is per order rather than per line, so it is charged once against
 * the order and not once against each thing in it. Spreading it over lines
 * would make a three item order look three times as expensive to pack as it is.
 *
 * The returns provision is a rate on revenue. She does not know which sale will
 * come back, only roughly how many do, and pretending otherwise would be a
 * number dressed up as a fact.
 *
 * Postage cost is what she pays a carrier, which the shop knows per product
 * from 0052 and which eBay's export does not tell us at all. Where it is
 * unknown it is zero and `postage_known` says so, rather than the net quietly
 * assuming delivery was free.
 */
-- Dropped rather than replaced. `create or replace view` can only add columns
-- at the end, and this adds ads, packaging, returns and postage in the middle,
-- which it reads as renaming the columns that were already there. Same trap as
-- 0045, and knowing about it did not stop me walking into it a second time.
drop view if exists store_channel_profit;

create view store_channel_profit as
with rate as (
  select
    t.id as tenant_id,
    coalesce((t.fees -> 'store'  ->> 'pct')::numeric, 0.015) as store_pct,
    coalesce((t.fees -> 'store'  ->> 'fixed')::numeric, 0.20) as store_fixed,
    coalesce((t.fees -> 'ebay'   ->> 'pct')::numeric, 0.128) as ebay_pct,
    coalesce((t.fees -> 'ebay'   ->> 'fixed')::numeric, 0.30) as ebay_fixed,
    coalesce((t.fees -> 'tiktok' ->> 'pct')::numeric, 0.065) as tiktok_pct,
    coalesce((t.fees -> 'tiktok' ->> 'fixed')::numeric, 0.00) as tiktok_fixed,
    coalesce((t.store -> 'selling_costs' ->> 'packaging_per_order')::numeric, 0) as packaging,
    coalesce((t.store -> 'selling_costs' ->> 'returns_provision_pct')::numeric, 0) as returns_pct,
    coalesce((t.store -> 'selling_costs' ->> 'ad_rate_pct')::numeric, 0) as ad_pct
  from tenants t
),
priced as (
  select
    l.*,
    coalesce(l.fees, case l.channel
      when 'store'  then round(l.gross * r.store_pct  + r.store_fixed, 2)
      when 'ebay'   then round(l.gross * r.ebay_pct   + r.ebay_fixed, 2)
      when 'tiktok' then round(l.gross * r.tiktok_pct + r.tiktok_fixed, 2)
      else 0
    end) as fee_applied,

    -- Only on the channel that sells them. Her shop does not run promoted
    -- listings, so charging the rate against it would understate the one
    -- channel this whole comparison exists to favour.
    case when l.channel = 'ebay' then round(l.gross * r.ad_pct, 2) else 0 end as ads,

    round(l.gross * r.returns_pct, 2) as returns_provision,

    -- Once per order, on the first line of it, rather than once per item.
    case when l.line_no = 1 then r.packaging else 0 end as packaging,

    coalesce(p.postage_cost, 0) as postage_cost,
    (p.postage_cost is not null) as postage_known,
    p.landed_cost,
    p.title as product_title
  from store_revenue_lines l
  join rate r on r.tenant_id = l.tenant_id
  left join store_products p on p.id = l.product_id
)
select
  tenant_id,
  channel,
  date_trunc('month', sold_at)::date as month,
  product_id,
  coalesce(product_title, title) as title,
  sum(qty)::bigint as units,
  sum(gross) as revenue,
  sum(fee_applied) as fees,
  sum(ads) as ads,
  sum(packaging) as packaging,
  sum(returns_provision) as returns_provision,
  sum(postage_cost * qty) as postage,
  case when bool_and(landed_cost is not null) then sum(landed_cost * qty) end as cost_of_goods,

  case when bool_and(landed_cost is not null) then
    sum(gross - fee_applied - ads - packaging - returns_provision
        - postage_cost * qty - landed_cost * qty)
  end as net,

  bool_and(landed_cost is not null) as costed,
  bool_and(postage_known) as postage_known,
  bool_or(fees_estimated) as fees_estimated,
  count(*) filter (where product_id is null)::bigint as unmatched_lines
from priced
group by tenant_id, channel, date_trunc('month', sold_at)::date, product_id,
         coalesce(product_title, title);

comment on view store_channel_profit is
  'The full margin model per product per channel per month: revenue, platform fee, promoted listings, packaging, returns provision, postage and cost of goods. Net is null unless every line has a landed cost. Packaging is charged once per order rather than per item.';
