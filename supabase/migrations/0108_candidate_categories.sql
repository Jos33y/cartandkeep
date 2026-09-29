-- Every product organised by what it is: Google's product taxonomy, stored as the category ID.
-- Where it came from and which channel it is for stay labels on the card, not structure.
-- The same ID is the product's google_product_category in her store feed later: one field, one system.

create table if not exists public.google_categories (
  id         integer primary key,
  path       text     not null,          -- as Google's en-GB file writes it: "Home & Garden > Lighting"
  name       text     not null,          -- the last part of the path
  depth      smallint not null,          -- 1 is a top category (a tab), 2 its filter, and so on
  top_id     integer  not null,
  level2_id  integer,
  level3_id  integer,
  version    text     not null           -- the file's version line, e.g. 2021-09-21
);

alter table public.google_categories enable row level security;

drop policy if exists "google categories are readable" on public.google_categories;
create policy "google categories are readable"
  on public.google_categories for select
  to authenticated
  using (true);

alter table public.candidates
  add column if not exists category_id        integer references public.google_categories (id),
  add column if not exists category_top_id    integer references public.google_categories (id),
  add column if not exists category_level2_id integer references public.google_categories (id),
  -- manual: she set it and no import changes it. ebay: the proving listing's eBay category, mapped.
  -- ai: classified from the title against the allowed list. google_export: the export's top category only.
  -- default: nothing placed it, Home & Garden for her to move.
  add column if not exists category_source    text,
  -- "check_same_product" when the eBay category clashes with the source (a collector's tin for a household product).
  add column if not exists category_flag      text,
  -- Where it came from, as labels: "Google best seller", "B&M", "Care shops", the old batch labels.
  add column if not exists source_labels      text[] not null default '{}';

alter table public.candidates drop constraint if exists candidates_category_source_check;
alter table public.candidates add constraint candidates_category_source_check
  check (category_source is null or category_source in ('manual', 'ebay', 'ai', 'google_export', 'default'));

-- Tabs and filters read by top and level two; one index each, per tenant.
create index if not exists candidates_tenant_category_top_idx on public.candidates (tenant_id, category_top_id);
create index if not exists candidates_tenant_category_l2_idx  on public.candidates (tenant_id, category_level2_id);
