-- A source is not just a price. Who ships decides which costs belong in the
-- margin, and the two routes are computed differently:
--
--   dropship  sale price - platform fees - goods - supplier shipping
--   stock     sale price - platform fees - her postage - packaging
--                        - (goods + inbound freight + duty) per unit
--
-- Comparing them on a unit price alone compares two different things.

alter table candidate_sources
  add column fulfilment text not null default 'dropship'
    check (fulfilment in ('dropship', 'stock')),

  -- What has to be bought to get the quoted price. A unit price without the
  -- quantity behind it is not a cost.
  add column moq integer,
  add column price_at_moq numeric(10,2),

  -- Getting the goods to her, only meaningful on a stock route
  add column inbound_freight_per_unit numeric(10,2),
  add column duty_pct numeric(5,3),

  -- Getting the goods to the buyer, only meaningful on a dropship route
  add column supplier_shipping numeric(10,2),

  add column ships_from char(2),
  add column transit_days integer,

  -- Dimensions decide both the inbound freight and her outbound postage band,
  -- and every headroom figure currently assumes a small parcel.
  add column weight_g integer,
  add column length_mm integer,
  add column width_mm integer,
  add column height_mm integer,

  add column quoted_on date,
  add column note text;

-- What a unit actually costs by the time it is ready to sell. Generated, so it
-- cannot drift from its inputs.
alter table candidate_sources
  add column landed_unit_cost numeric(10,2)
  generated always as (
    case
      when fulfilment = 'stock' then
        coalesce(price_at_moq, unit_cost)
          * (1 + coalesce(duty_pct, 0))
          + coalesce(inbound_freight_per_unit, 0)
      else
        coalesce(unit_cost, 0) + coalesce(supplier_shipping, 0)
    end
  ) stored;

comment on column candidate_sources.landed_unit_cost is 'stock: goods at quantity plus duty plus inbound freight. dropship: goods plus supplier shipping';
comment on column candidate_sources.supplier_kind is 'eBay permits fulfilling from a wholesaler and not from another retailer or marketplace, so this is a policy field before it is a commercial one';

create index on candidate_sources (candidate_id, fulfilment);

-- Cover, not just cost. Fifty units of something selling seven a month is
-- seven months of capital, and that is hers to weigh before approving.
alter table candidates
  add column stock_months_cover numeric(5,1);
