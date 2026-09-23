-- What a product costs her.
--
-- Nothing on this project has recorded it, which is why four month one
-- commitments in Section 5 have been sitting as queued when they are in fact
-- not startable: margin per product per channel, net profit per product per
-- channel, category profit and loss, and the alerts when something goes
-- negative. None of them can begin without this one column.
--
-- It is also why the orders page carries no net figure and the finance page is
-- a shell. Every research conversation on this engagement has been about what a
-- product can afford to cost, and there has been nowhere to write down the
-- answer when a supplier finally gives one.

alter table store_products
  -- What one unit costs her delivered to her door, in pounds. Landed rather
  -- than ex works: the pipeline already reasons in landed cost, and a figure
  -- that excludes freight and duty is a figure that flatters every margin on
  -- the platform.
  add column if not exists landed_cost numeric(10, 2)
    check (landed_cost is null or landed_cost >= 0),

  -- What it costs her to send one, which is not what she charges for postage.
  -- Left null rather than assumed, and margin says so when it is missing
  -- instead of quietly reporting a better number.
  add column if not exists postage_cost numeric(10, 2)
    check (postage_cost is null or postage_cost >= 0),

  -- Where the figure came from and when it was quoted. A cost with no
  -- provenance is a number nobody will trust in November, and a supplier price
  -- from August is not a supplier price in December.
  add column if not exists cost_note text,
  add column if not exists cost_updated_at timestamptz;

comment on column store_products.landed_cost is
  'What one unit costs to reach her, including freight and duty. Null means unknown, and every margin figure is null rather than optimistic when it is.';

comment on column store_products.postage_cost is
  'What it costs her to send one. Not what she charges the customer for delivery.';

/*
 * Inherited from the pipeline where the pipeline already knows.
 *
 * A product created from an approved candidate has a confirmed source with a
 * landed unit cost on it, and asking her to type that in again would be asking
 * her to copy a number from one screen of ours to another. Cheapest confirmed
 * source wins, which is the same rule useCandidates already sorts by.
 *
 * Only where it is empty, so this can be re-run and will never overwrite a
 * figure somebody entered by hand.
 */
update store_products p
set landed_cost = s.cost,
    cost_note = 'From the confirmed supplier quote on the research candidate.',
    cost_updated_at = now()
from (
  select cs.candidate_id, min(cs.landed_unit_cost) as cost
  from candidate_sources cs
  where cs.confirmed is true and cs.landed_unit_cost is not null
  group by cs.candidate_id
) s
where p.candidate_id = s.candidate_id
  and p.landed_cost is null;

/*
 * Margin, per product, per channel.
 *
 * The fee shape comes off the tenant row rather than being written here, so a
 * rate change is a data change. eBay's percentage covers managed payments, so
 * no separate payment fee is applied to it; the store sells through Stripe, so
 * the store rate is the Stripe rate. If that mapping is wrong the fix is one
 * line here rather than a rewrite, and it is written out explicitly rather than
 * buried in arithmetic for exactly that reason.
 *
 * Every figure is null when the landed cost is unknown. A margin computed
 * without knowing what something cost is not a cautious estimate, it is a
 * made up number, and this project has spent a fortnight learning not to
 * defend one.
 */
create or replace view store_product_margin as
with fee as (
  select
    t.id as tenant_id,
    coalesce((t.fees -> 'store'   ->> 'pct')::numeric, 0.015) as store_pct,
    coalesce((t.fees -> 'store'   ->> 'fixed')::numeric, 0.20) as store_fixed,
    coalesce((t.fees -> 'ebay'    ->> 'pct')::numeric, 0.128) as ebay_pct,
    coalesce((t.fees -> 'ebay'    ->> 'fixed')::numeric, 0.30) as ebay_fixed,
    coalesce((t.fees -> 'tiktok'  ->> 'pct')::numeric, 0.065) as tiktok_pct,
    coalesce((t.fees -> 'tiktok'  ->> 'fixed')::numeric, 0.00) as tiktok_fixed
  from tenants t
)
select
  p.tenant_id,
  p.id as product_id,
  p.slug,
  p.title,
  p.status,
  p.is_sample,
  p.price,
  p.landed_cost,
  p.postage_cost,
  p.cost_updated_at,

  -- Stated rather than inferred from a null further down the row, because a
  -- screen showing three empty margin columns should be able to say why in one
  -- word instead of leaving her to work it out.
  (p.landed_cost is null) as cost_unknown,
  (p.postage_cost is null) as postage_unknown,

  round(p.price * f.store_pct + f.store_fixed, 2)   as store_fee,
  round(p.price * f.ebay_pct + f.ebay_fixed, 2)     as ebay_fee,
  round(p.price * f.tiktok_pct + f.tiktok_fixed, 2) as tiktok_fee,

  case when p.landed_cost is not null then
    round(p.price - (p.price * f.store_pct + f.store_fixed)
          - p.landed_cost - coalesce(p.postage_cost, 0), 2)
  end as store_net,

  case when p.landed_cost is not null then
    round(p.price - (p.price * f.ebay_pct + f.ebay_fixed)
          - p.landed_cost - coalesce(p.postage_cost, 0), 2)
  end as ebay_net,

  case when p.landed_cost is not null then
    round(p.price - (p.price * f.tiktok_pct + f.tiktok_fixed)
          - p.landed_cost - coalesce(p.postage_cost, 0), 2)
  end as tiktok_net,

  -- Margin against the price she sells at, which is the figure a shopkeeper
  -- means by margin. Against cost would be markup and the two get confused
  -- constantly, so only one of them appears anywhere on this platform.
  case when p.landed_cost is not null and p.price > 0 then
    round((p.price - (p.price * f.store_pct + f.store_fixed)
           - p.landed_cost - coalesce(p.postage_cost, 0)) / p.price * 100, 1)
  end as store_margin_pct,

  case when p.landed_cost is not null and p.price > 0 then
    round((p.price - (p.price * f.ebay_pct + f.ebay_fixed)
           - p.landed_cost - coalesce(p.postage_cost, 0)) / p.price * 100, 1)
  end as ebay_margin_pct,

  case when p.landed_cost is not null and p.price > 0 then
    round((p.price - (p.price * f.tiktok_pct + f.tiktok_fixed)
           - p.landed_cost - coalesce(p.postage_cost, 0)) / p.price * 100, 1)
  end as tiktok_margin_pct

from store_products p
join fee f on f.tenant_id = p.tenant_id;

comment on view store_product_margin is
  'Net and margin per product per channel, from the landed cost on the product and the fee rates on the tenant row. Every figure is null where the landed cost is unknown, because a margin computed without a cost is invented rather than estimated. Margin is against the selling price, not against cost.';
