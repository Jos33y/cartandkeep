-- 0010_rate_cards_and_scoring_config.sql

-- Postage is a carrier fact, not a client fact. Every UK tenant pays the same
-- Royal Mail price, so it lives in one dated table rather than in every tenant's
-- config where the next tariff change would be N updates and one forgotten row
-- quietly overstating margin for a year.

create extension if not exists btree_gist;

create table rate_cards (
  id              uuid primary key default gen_random_uuid(),
  carrier         text not null,
  service         text not null,
  band            text not null,
  price           numeric(6,2) not null check (price >= 0),
  currency        char(3) not null default 'GBP',
  effective_from  date not null,
  effective_to    date,
  source          text,
  created_at      timestamptz not null default now(),

  check (effective_to is null or effective_to >= effective_from)
);

-- Two rows in force for the same band on the same day is a silent wrong price,
-- so the database refuses it rather than the loader picking one.
alter table rate_cards add constraint rate_cards_no_overlap
  exclude using gist (
    carrier with =,
    service with =,
    band with =,
    daterange(effective_from, effective_to, '[]') with &&
  );

create index on rate_cards (carrier, service, effective_from desc);

alter table rate_cards enable row level security;

create policy rate_cards_read on rate_cards
  for select to authenticated using (true);
create policy rate_cards_write on rate_cards
  for all to authenticated using (is_platform_admin()) with check (is_platform_admin());

-- Royal Mail online prices, tariff effective 7 April 2026. Tracked rather than
-- standard because eBay seller protection effectively needs tracking, so pricing
-- the untracked rate models a service she would not use.
insert into rate_cards (carrier, service, band, price, effective_from, source) values
  ('royal_mail', 'tracked_48', 'large_letter',  2.85, '2026-04-07', 'Royal Mail online prices, 7 April 2026'),
  ('royal_mail', 'tracked_48', 'small_parcel',  3.65, '2026-04-07', 'Royal Mail online prices, 7 April 2026'),
  ('royal_mail', 'tracked_48', 'medium_parcel', 5.55, '2026-04-07', 'Royal Mail online prices, 7 April 2026'),
  ('royal_mail', 'tracked_24', 'large_letter',  3.80, '2026-04-07', 'Royal Mail online prices, 7 April 2026'),
  ('royal_mail', 'tracked_24', 'small_parcel',  4.65, '2026-04-07', 'Royal Mail online prices, 7 April 2026'),
  ('royal_mail', 'tracked_24', 'medium_parcel', 6.55, '2026-04-07', 'Royal Mail online prices, 7 April 2026');

-- Tenant config. Only what genuinely differs by client: which service they post
-- with, their packaging, their ads budget, their returns tolerance, their gates.

update tenants
set scoring = scoring || '{
  "costs": {
    "shipping": {
      "carrier": "royal_mail",
      "service": "tracked_48",
      "default_band": "small_parcel",
      "packaging": 0.40
    },
    "ads_pct": 0.06,
    "returns": {
      "default": 0.05,
      "by_category": {
        "pet supplies": 0.04,
        "beauty":       0.07,
        "health":       0.07,
        "electr":       0.10,
        "pet":          0.04
      }
    },
    "goods_pct_estimate": 0.40
  },
  "gates": {
    "str_min":            0.30,
    "margin_abs_min":     4.00,
    "margin_pct_min":     0.25,
    "trend_min":          0.80,
    "sold_min":           15,
    "listings_max":       500,
    "concentration_max":  0.70,
    "min_sources":        2,
    "lead_time_max_days": 21,
    "brand_screen":       true
  },
  "rank_weights": {
    "sell_through":  25,
    "margin_pct":    20,
    "trend":         15,
    "competition":   15,
    "seller_spread": 10,
    "shipping_band": 10,
    "supply":         5
  }
}'::jsonb
where slug = 'cart-and-keep';