-- 0103_own_sections_only.sql
-- Sections are hers alone; eBay's category becomes a hint the agent reads, never a section the shop shows.
-- Nothing she sees changes when this runs: an eBay department she renamed becomes a section of her own,
-- keeps its address, and keeps its products.

-- Old addresses a section answers to, so a shared link or an indexed page redirects rather than breaks.
alter table store_category_names add column if not exists aliases text[] not null default '{}';

create or replace function section_slug(p text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(replace(lower(coalesce(p, '')), '&', ' and '), '[^a-z0-9]+', '-', 'g'));
$$;

-- An eBay department she renamed becomes her own section, with the eBay address kept as an alias.
do $$
declare
  r record;
  own_path text;
  own_slug text;
begin
  for r in
    select * from store_category_names
    where not own and name is not null and position('|' in path) = 0
  loop
    own_path := 'own:' || substr(md5(r.tenant_id::text || r.path), 1, 8);
    own_slug := coalesce(r.slug, section_slug(r.name));

    insert into store_category_names (tenant_id, path, name, slug, blurb, position, hidden, own, aliases)
    values (
      r.tenant_id, own_path, r.name, own_slug, r.blurb, r.position, r.hidden, true,
      array_remove(array[section_slug(r.path)], own_slug)
    )
    on conflict (tenant_id, path) do nothing;

    update store_products p
    set section = own_path
    where p.tenant_id = r.tenant_id
      and (p.section = r.path or (p.section is null and split_part(coalesce(p.category_path, ''), '|', 1) = r.path));
  end loop;
end $$;

-- A section value that is not one of her sections (an eBay department picked in the old sheet) goes to Odds and ends.
update store_products p
set section = null
where p.section is not null
  and not exists (
    select 1 from store_category_names n
    where n.tenant_id = p.tenant_id and n.path = p.section and n.own
  );

-- Rows that named or hid eBay departments describe sections that no longer exist.
delete from store_category_names where not own;

-- Her section decides the group; no section means Odds and ends. Same columns as 0101, one rule changed.
create or replace view public.store_cards with (security_invoker = true) as
select
  p.id,
  p.tenant_id,
  p.slug,
  p.title,
  p.price,
  p.compare_at,
  p.image_url,
  p.images ->> 1 as image_2,
  p.brand,
  p.section,
  p.category_path,
  coalesce(nullif(p.section, ''), '') as group_key,
  p.availability,
  case when p.variant_count > 0 then p.variant_buyable else p.availability not in ('out_of_stock', 'discontinued') end as buyable,
  p.stock,
  p.dispatch_days,
  p.position,
  p.created_at,
  p.search_doc,
  p.status,
  p.is_sample,
  p.variant_count,
  case when p.variant_count = 0 then p.price else least(coalesce(p.variant_min, p.price), case when p.variant_unpriced then p.price end) end as price_from,
  case when p.variant_count = 0 then p.price else greatest(coalesce(p.variant_max, p.price), case when p.variant_unpriced then p.price end) end as price_to
from public.store_products p;

drop view if exists store_category_map;

create view store_category_map with (security_invoker = on) as
with placed as (
  select p.tenant_id, nullif(p.section, '') as path, p.status, p.is_sample
  from store_products p
  where p.status <> 'archived'
),
paths as (
  select tenant_id, path from store_category_names where own and position('|' in path) = 0
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
  n.hidden,
  n.own,
  n.aliases,
  null::text as ebay_name
from paths x
join store_category_names n on n.tenant_id = x.tenant_id and n.path = x.path
left join placed pl on pl.tenant_id = x.tenant_id and pl.path = x.path
group by x.tenant_id, x.path, n.id, n.name, n.slug, n.blurb, n.position, n.hidden, n.own, n.aliases;

comment on view store_category_map is
  'Her sections, with product counts. Products with no section sit in Odds and ends and are not listed here.';

grant select on store_category_map to authenticated;
