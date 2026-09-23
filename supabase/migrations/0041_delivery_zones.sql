-- Delivery zones.
--
-- One flat rate to the whole UK loses money on every parcel to the Scottish
-- Highlands, the islands and Northern Ireland, because most carriers surcharge
-- those postcodes and Royal Mail is the exception rather than the rule.
--
-- Every surcharge below is zero. That is deliberate: the mechanism ships, the
-- behaviour does not change, and the numbers come off her carrier's rate card
-- rather than out of a developer's head. Fill them in and the checkout applies
-- them the same hour.
--
-- The Channel Islands are blocked rather than surcharged. Guernsey and Jersey
-- sit outside the UK customs and VAT territory, so an order there is an export
-- with a customs declaration attached. That is a different business, not a
-- different postage rate.

update tenants
set store = jsonb_set(
  store,
  '{delivery,zones}',
  jsonb_build_object(
    'mainland',         jsonb_build_object('surcharge', 0),
    'highlands',        jsonb_build_object('surcharge', 0, 'extraDays', 2),
    'northern_ireland', jsonb_build_object('surcharge', 0, 'extraDays', 1),
    'isle_of_man',      jsonb_build_object('surcharge', 0, 'extraDays', 2),
    'isles_of_scilly',  jsonb_build_object('surcharge', 0, 'extraDays', 2),
    'channel_islands',  jsonb_build_object('blocked', true)
  ),
  true
)
where slug = 'cart-and-keep';

-- The zone the order was placed into, so a surcharge that was charged can be
-- checked later against what the carrier actually billed.
alter table orders add column if not exists delivery_zone text;
alter table orders add column if not exists delivery_surcharge numeric(10, 2) not null default 0
  check (delivery_surcharge >= 0);
