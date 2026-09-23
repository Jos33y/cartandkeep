-- Costs for products sold without a shop product behind them.
-- Most eBay sales have no store_products row, so there was nowhere to record a
-- cost and Kept could never be worked out. Keyed by title, which is how the
-- finance view already groups a sale with no product.

create table if not exists sale_costs (
  tenant_id    uuid not null references tenants (id) on delete cascade,
  title        text not null,
  landed_cost  numeric(10, 2) check (landed_cost is null or landed_cost >= 0),
  postage_cost numeric(10, 2) check (postage_cost is null or postage_cost >= 0),
  updated_at   timestamptz not null default now(),
  primary key (tenant_id, title)
);

alter table sale_costs enable row level security;

drop policy if exists sale_costs_tenant_rw on sale_costs;
create policy sale_costs_tenant_rw on sale_costs
  for all to authenticated
  using (has_tenant(tenant_id))
  with check (has_tenant(tenant_id));

-- Before replacing the view, note its options so they can be checked after.
-- select reloptions from pg_class where relname = 'store_channel_profit';

-- Same view, one change: a sale with no shop product falls back to sale_costs.
create or replace view store_channel_profit as
with rate as (
  select t.id as tenant_id,
    coalesce(((t.fees -> 'store') ->> 'pct')::numeric, 0.015) as store_pct,
    coalesce(((t.fees -> 'store') ->> 'fixed')::numeric, 0.20) as store_fixed,
    coalesce(((t.fees -> 'ebay') ->> 'pct')::numeric, 0.128) as ebay_pct,
    coalesce(((t.fees -> 'ebay') ->> 'fixed')::numeric, 0.30) as ebay_fixed,
    coalesce(((t.fees -> 'tiktok') ->> 'pct')::numeric, 0.065) as tiktok_pct,
    coalesce(((t.fees -> 'tiktok') ->> 'fixed')::numeric, 0.00) as tiktok_fixed,
    coalesce(((t.store -> 'selling_costs') ->> 'packaging_per_order')::numeric, 0) as packaging,
    coalesce(((t.store -> 'selling_costs') ->> 'returns_provision_pct')::numeric, 0) as returns_pct,
    coalesce(((t.store -> 'selling_costs') ->> 'ad_rate_pct')::numeric, 0) as ad_pct
  from tenants t
), priced as (
  select l.tenant_id,
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
    coalesce(l.fees,
      case l.channel
        when 'store' then round(l.gross * r.store_pct + r.store_fixed, 2)
        when 'ebay' then round(l.gross * r.ebay_pct + r.ebay_fixed, 2)
        when 'tiktok' then round(l.gross * r.tiktok_pct + r.tiktok_fixed, 2)
        else 0
      end) as fee_applied,
    case when l.channel = 'ebay' then round(l.gross * r.ad_pct, 2) else 0 end as ads,
    round(l.gross * r.returns_pct, 2) as returns_provision,
    case when l.line_no = 1 then r.packaging else 0 end as packaging,
    coalesce(p.postage_cost, sc.postage_cost, 0) as postage_cost,
    coalesce(p.postage_cost, sc.postage_cost) is not null as postage_known,
    coalesce(p.landed_cost, sc.landed_cost) as landed_cost,
    p.title as product_title
  from store_revenue_lines l
    join rate r on r.tenant_id = l.tenant_id
    left join store_products p on p.id = l.product_id
    left join sale_costs sc on sc.tenant_id = l.tenant_id and sc.title = l.title
)
select tenant_id,
  channel,
  date_trunc('month', sold_at)::date as month,
  product_id,
  coalesce(product_title, title) as title,
  sum(qty) as units,
  sum(gross) as revenue,
  sum(fee_applied) as fees,
  sum(ads) as ads,
  sum(packaging) as packaging,
  sum(returns_provision) as returns_provision,
  sum(postage_cost * qty::numeric) as postage,
  case when bool_and(landed_cost is not null) then sum(landed_cost * qty::numeric) else null end as cost_of_goods,
  case when bool_and(landed_cost is not null)
    then sum(gross - fee_applied - ads - packaging - returns_provision - postage_cost * qty::numeric - landed_cost * qty::numeric)
    else null end as net,
  bool_and(landed_cost is not null) as costed,
  bool_and(postage_known) as postage_known,
  bool_or(fees_estimated) as fees_estimated,
  count(*) filter (where product_id is null) as unmatched_lines
from priced
group by tenant_id, channel, (date_trunc('month', sold_at)::date), product_id, (coalesce(product_title, title));
