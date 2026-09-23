-- CJ's keyword search is best match across the whole catalogue, so a search for
-- a dog bed returns furniture unless a category bounds it. The right category
-- depends on the product, so it is mapped from the eBay leaf the candidate is
-- already filed under rather than passed by hand per run.

create table supplier_categories (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references tenants(id) on delete cascade,
  supplier             text not null,
  ebay_path_prefix     text not null,
  supplier_category_id text not null,
  supplier_category    text,
  unique (tenant_id, supplier, ebay_path_prefix, supplier_category_id)
);

create index on supplier_categories (tenant_id, supplier);

insert into supplier_categories (tenant_id, supplier, ebay_path_prefix, supplier_category_id, supplier_category)
select t.id, 'cj_dropshipping', v.prefix, v.cat_id, v.cat_name
from tenants t
cross join (values
  ('Pet Supplies|Dog Supplies|Beds', '2410110358051626100', 'Pet Bedding | Pet Beds'),
  ('Pet Supplies|Dog Supplies|Beds', '2410110357391611900', 'Pet Bedding | Pet Mats'),
  ('Pet Supplies|Dog Supplies|Beds', '2410110357511615700', 'Pet Bedding | Pet Nests'),
  ('Pet Supplies|Dog Supplies|Beds', '2410110358191601900', 'Pet Bedding | Pet Blankets & Quilts'),

  ('Pet Supplies|Dog Supplies|Dishes, Feeders & Fountains', '2410110341061612000', 'Pet Drinking & Feeding | Pet Bowls'),
  ('Pet Supplies|Dog Supplies|Dishes, Feeders & Fountains', '2410110341331606800', 'Pet Drinking & Feeding | Pet Drinking Tools'),
  ('Pet Supplies|Dog Supplies|Dishes, Feeders & Fountains', '2410110341451628800', 'Pet Drinking & Feeding | Pet Feeding Tools'),

  ('Pet Supplies|Cat Supplies|Dishes, Feeders & Fountains', '2410110341061612000', 'Pet Drinking & Feeding | Pet Bowls'),
  ('Pet Supplies|Cat Supplies|Dishes, Feeders & Fountains', '2410110341331606800', 'Pet Drinking & Feeding | Pet Drinking Tools'),
  ('Pet Supplies|Cat Supplies|Dishes, Feeders & Fountains', '2410110341451628800', 'Pet Drinking & Feeding | Pet Feeding Tools')
) as v(prefix, cat_id, cat_name)
where t.slug = 'cart-and-keep';

alter table supplier_categories enable row level security;

create policy supplier_categories_rw on supplier_categories
  for all to authenticated using (has_tenant(tenant_id)) with check (has_tenant(tenant_id));
