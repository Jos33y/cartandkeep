-- Categories for the storefront catalogue.
--
-- `category` was in 0034 and nothing filled it, so the shop is one grid of
-- unrelated things. These come from a Browse lookup against the listing each
-- product was seeded from, which is eBay's own classification of that exact
-- item. A word list guessing category from a title is wrong in a way this
-- cannot be, and inventing keyword lists without data is a mistake this
-- project has already made and recorded.
--
-- The path is kept whole rather than only the leaf. A generalist catalogue
-- fragments badly at leaf level, so the shop groups on a level of the path and
-- the level is a front end decision that should not require a reimport to
-- change. `category` continues to hold the leaf, for display on a product.

alter table store_products add column if not exists category_path text;
alter table store_products add column if not exists ebay_category_id text;
alter table store_products add column if not exists enriched_at timestamptz;

comment on column store_products.category_path is
  'Full eBay category path, pipe separated, broad to narrow. Grouped at read time so the grouping level can change without a reimport.';

create index if not exists store_products_category_idx
  on store_products (tenant_id, category_path) where is_sample = false;
