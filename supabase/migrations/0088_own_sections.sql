-- Sections she makes herself, and a section on each product that overrides the eBay department.
-- category_path is untouched, so the Google feed keeps the eBay category.

-- Hiding or ordering a section no longer has to invent a name for it.
alter table store_category_names alter column name drop not null;
alter table store_category_names drop constraint if exists store_category_names_name_check;
alter table store_category_names
  add constraint store_category_names_name_check check (name is null or length(trim(name)) > 0);

alter table store_category_names add column if not exists own boolean not null default false;
alter table store_category_names drop constraint if exists store_category_names_own_named;
alter table store_category_names
  add constraint store_category_names_own_named check (not own or name is not null);

comment on column store_category_names.own is
  'True for a section she made. Its path is a key of her own, not an eBay path, so it has no eBay name to fall back to.';

alter table store_products add column if not exists section text;
alter table store_products drop constraint if exists store_products_section_check;
alter table store_products
  add constraint store_products_section_check check (section is null or length(trim(section)) > 0);

comment on column store_products.section is
  'Where the shop shows it: a path from store_category_names, or an eBay department. Null means the eBay department from category_path.';

create index if not exists store_products_section_idx
  on store_products (tenant_id, section) where section is not null;

-- Departments only: the shop has never grouped below the top level, so shelf rows here renamed nothing.
drop view if exists store_category_map;

create view store_category_map with (security_invoker = on) as
with placed as (
  select
    p.tenant_id,
    coalesce(p.section, nullif(split_part(p.category_path, '|', 1), '')) as path,
    p.status,
    p.is_sample
  from store_products p
),
paths as (
  select distinct tenant_id, path from placed where path is not null
  union
  -- A section with nothing in it yet, or a name whose products have gone, so it can still be managed.
  select tenant_id, path from store_category_names where position('|' in path) = 0
)
select
  x.tenant_id,
  x.path,
  1 as depth,
  count(pl.path)::bigint as products,
  count(pl.path) filter (where pl.status = 'live' and not pl.is_sample)::bigint as live,
  n.id as name_id,
  n.name,
  n.slug,
  n.blurb,
  n.position,
  coalesce(n.hidden, false) as hidden,
  coalesce(n.own, false) as own,
  case when coalesce(n.own, false) then null else x.path end as ebay_name
from paths x
left join placed pl on pl.tenant_id = x.tenant_id and pl.path = x.path
left join store_category_names n on n.tenant_id = x.tenant_id and n.path = x.path
group by x.tenant_id, x.path, n.id, n.name, n.slug, n.blurb, n.position, n.hidden, n.own;

comment on view store_category_map is
  'Every department the shop can show, eBay or her own, with product counts and her name where she has given one.';

grant select on store_category_map to authenticated;
