-- Everything the product page needs and does not have.
--
-- The page currently shows a title, a photograph and three sentences that are
-- the same on every product, and two of those sentences are wrong on some of
-- them. See docs/product-page-gaps-2026-08-18.md.
--
-- Nothing here is required. Every column is nullable and the page renders only
-- what exists, because a specification list with eight empty rows in it is
-- worse than four filled ones.

-- --- What the product actually is -------------------------------------------

alter table store_products add column if not exists brand text;
alter table store_products add column if not exists highlights jsonb not null default '[]'::jsonb;
alter table store_products add column if not exists specifications jsonb not null default '{}'::jsonb;
alter table store_products add column if not exists in_the_box text;

-- The seller's own copy from eBay, kept apart from `description`.
--
-- eBay descriptions are usually a template with the lister's boilerplate,
-- postage tables and a logo in them. Writing that into `description` would put
-- somebody else's HTML on her shop and make her own words impossible to tell
-- apart from a feed. This holds the raw text so it can be read and rewritten;
-- `description` stays empty until a person has written one.
alter table store_products add column if not exists source_description text;
alter table store_products add column if not exists condition text;

comment on column store_products.highlights is
  'Three to five short lines, the reasons to buy. Rendered as a list above the description.';
comment on column store_products.specifications is
  'Label to value. Size, weight, material, capacity. Rendered in order of insertion.';

-- --- Identifiers -------------------------------------------------------------

alter table store_products add column if not exists sku text;
alter table store_products add column if not exists mpn text;
alter table store_products add column if not exists gtin text;

create unique index if not exists store_products_sku_idx
  on store_products (tenant_id, sku) where sku is not null;

-- --- Availability ------------------------------------------------------------
--
-- Nothing currently distinguishes in stock from discontinued, so every product
-- reads as infinitely available. `stock` stays null for a dropship line where
-- the number is not ours to know, and `availability` is what the page says.

alter table store_products add column if not exists availability text
  not null default 'in_stock'
  check (availability in ('in_stock', 'low_stock', 'made_to_order', 'out_of_stock', 'discontinued'));

alter table store_products add column if not exists stock integer
  check (stock is null or stock >= 0);

alter table store_products add column if not exists dispatch_days integer
  check (dispatch_days is null or dispatch_days between 0 and 90);

comment on column store_products.dispatch_days is
  'Working days before it leaves. 0 means same day. The page currently claims same day for everything on no evidence.';

-- --- Returns -----------------------------------------------------------------
--
-- A property of the product, not a line in a component. The catalogue contains
-- sealed hygiene goods and consumables, and an unconditional return offered on
-- those and then refused is worse than never offering it.
--
--   standard  the statutory 14 day right, extended to 30 as a goodwill term
--   sealed    returnable only while sealed, on health or hygiene grounds
--   none      consumable or perishable
--
-- None of these touches the right to reject faulty goods under the Consumer
-- Rights Act 2015, and the page has to say so whichever class applies.

alter table store_products add column if not exists returns_class text
  not null default 'standard'
  check (returns_class in ('standard', 'sealed', 'none'));

alter table store_products add column if not exists returns_note text;

-- --- Hazardous mixtures ------------------------------------------------------
--
-- At least six products in the current seed are classified mixtures under GB
-- CLP: carpet cleaner, Jeyes Fluid, drain unblocker, herbicide, wasp killer,
-- super glue. Online offers for these are expected to carry the label elements
-- near the price rather than leaving them to a safety data sheet nobody opens.
--
-- Two of them are also biocidal products, which carry an HSE registration
-- number that belongs on the page.
--
-- Until these are filled, those products should not be live. There is no
-- screen for hazardous mixtures anywhere in the pipeline, which is how they
-- reached the seed in the first place.

alter table store_products add column if not exists hazard jsonb;
alter table store_products add column if not exists safety_data_sheet_url text;
alter table store_products add column if not exists biocide_reg_no text;

comment on column store_products.hazard is
  'GB CLP label elements: { pictograms: [], signal: "Warning", h: [], p: [], supplier: "" }. Null means not a classified mixture, which is a claim someone has to have checked.';

-- --- Discounting -------------------------------------------------------------
--
-- `compare_at` has existed since 0034 and nothing writes to it. Before anything
-- does: a struck through price is a price claim, and the was price has to have
-- been the actual selling price for a meaningful period. A number typed in to
-- make a product look reduced is what Trading Standards writes letters about,
-- and a dropship feed will supply one happily.
--
-- So the was price now has to carry the dates it was charged, or it does not
-- render at all.

alter table store_products add column if not exists compare_at_from date;
alter table store_products add column if not exists compare_at_to date;
alter table store_products add column if not exists sale_ends timestamptz;

comment on column store_products.compare_at_from is
  'When compare_at was the actual selling price. The page must refuse to strike a price through without this.';

-- --- Energy labelling --------------------------------------------------------
--
-- Required for lighting, and she sells three LED lamps.

alter table store_products add column if not exists energy_class text;
alter table store_products add column if not exists energy_label_url text;

-- --- Provenance --------------------------------------------------------------
--
-- Which fields came from eBay, which were derived, and when. Without this there
-- is no way to tell a hazard record a supplier supplied from one a script
-- guessed off a category name, and the difference is the whole point.

alter table store_products add column if not exists enriched_fields jsonb not null default '{}'::jsonb;
alter table store_products add column if not exists derived_fields jsonb not null default '{}'::jsonb;

comment on column store_products.derived_fields is
  'Anything a script inferred rather than read. A row with returns_class in here has not been confirmed by anyone and must not go live.';

create index if not exists store_products_availability_idx
  on store_products (tenant_id, availability) where is_sample = false;
