-- Her words over eBay's.
--
-- A category on this shop is `store_products.category_path`, which is an eBay
-- string like "Home, Furniture & DIY|Storage Solutions|Storage Bags". The shop
-- derives its departments by grouping on the first segment, which is why the
-- navigation reads "Vehicle parts & accessories" next to "Pet supplies": that
-- is a marketplace taxonomy, not a shopkeeper's.
--
-- This maps a path to a name she chose. It renames rather than reorganises,
-- and that is the whole design:
--
--   the path stays          so the Google feed keeps saying what Google wants
--   the products stay       78 rows are not touched and cannot be broken
--   the mapping is additive an absent row means the eBay name, exactly as now
--
-- What it cannot do is put a product in a section its path does not lead to. A
-- "Gifts" department pulling from six eBay branches needs products assigned to
-- her own categories, which is a bigger change and this does not stand in its
-- way: every row here is a name, and names survive that change.

create table if not exists store_category_names (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants (id) on delete cascade,

  /*
   * The eBay path, or a prefix of it.
   *
   * A row for "Home, Furniture & DIY" renames the whole department. A row for
   * "Home, Furniture & DIY|Storage Solutions" renames one shelf inside it.
   * Longest match wins, so she can rename a department and then override one
   * shelf within it without the two fighting.
   */
  path        text not null check (length(trim(path)) > 0),

  -- What a customer reads. The only required field, because renaming is the
  -- entire point of the table.
  name        text not null check (length(trim(name)) > 0),

  /*
   * The web address, and why it is optional.
   *
   * Changing a slug changes a URL somebody may have shared and Google may have
   * indexed. Left null the shop keeps the slug it already generates, so
   * renaming a department is safe by default and moving its address is a
   * deliberate second act.
   */
  slug        text check (slug is null or slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),

  -- Shown under the heading on a category page. Her chance to say what the
  -- section is for, which a marketplace path never can.
  blurb       text,

  -- Where it sits in the navigation. Null sorts last and then alphabetically,
  -- so an unordered shop is still predictable.
  position    integer,

  -- Off the navigation without deleting the row. A department she is not ready
  -- to show is different from one she never named.
  hidden      boolean not null default false,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- One name per path. Two rows for one path is two names for one department
  -- and no way to say which wins.
  unique (tenant_id, path)
);

create index if not exists store_category_names_idx
  on store_category_names (tenant_id, position, name);

drop trigger if exists store_category_names_touch on store_category_names;
create trigger store_category_names_touch
  before update on store_category_names
  for each row execute function touch_updated_at();

/*
 * Read by everybody, written by her.
 *
 * These are the words on the shop front, so anon reads them for the same
 * reason it reads a product title. Nothing here is private and nothing here is
 * about a person.
 */
alter table store_category_names enable row level security;

revoke all on store_category_names from anon, authenticated;
grant select on store_category_names to anon;
grant select, insert, update, delete on store_category_names to authenticated;

drop policy if exists store_category_names_public_read on store_category_names;
create policy store_category_names_public_read on store_category_names
  for select to anon using (true);

drop policy if exists store_category_names_portal on store_category_names;
create policy store_category_names_portal on store_category_names
  for all to authenticated
  using (has_tenant(tenant_id)) with check (has_tenant(tenant_id));

comment on table store_category_names is
  'Her name for an eBay category path. Renames rather than reorganises: the path stays on the product so the Google feed is untouched, and an absent row means the eBay name. Longest matching path wins, so a department can be renamed and one shelf inside it overridden separately.';

comment on column store_category_names.slug is
  'Null keeps the slug the shop already generates. Changing it changes a URL somebody may have shared, so it is a deliberate second act rather than a side effect of renaming.';

/*
 * What is actually in the catalogue, and what she has named.
 *
 * Every distinct path in her live products, at both levels the shop groups on,
 * with her name beside it where she has given one. The portal reads this so
 * the screen lists what exists rather than asking her to type paths from
 * memory, and so a name for a path that no longer has products in it is
 * visible as such.
 */
create or replace view store_category_map as
with paths as (
  select distinct
    p.tenant_id,
    split_part(p.category_path, '|', 1) as path,
    1 as depth
  from store_products p
  where p.category_path is not null and p.category_path <> ''
  union
  select distinct
    p.tenant_id,
    split_part(p.category_path, '|', 1) || '|' || split_part(p.category_path, '|', 2) as path,
    2 as depth
  from store_products p
  where p.category_path is not null
    and split_part(p.category_path, '|', 2) <> ''
),
counted as (
  select
    x.tenant_id,
    x.path,
    x.depth,
    (
      select count(*)
      from store_products p
      where p.tenant_id = x.tenant_id
        and (p.category_path = x.path or p.category_path like x.path || '|%')
    )::bigint as products,
    (
      select count(*)
      from store_products p
      where p.tenant_id = x.tenant_id
        and p.status = 'live' and p.is_sample = false
        and (p.category_path = x.path or p.category_path like x.path || '|%')
    )::bigint as live
  from paths x
)
select
  c.tenant_id,
  c.path,
  c.depth,
  c.products,
  c.live,
  n.id as name_id,
  n.name,
  n.slug,
  n.blurb,
  n.position,
  coalesce(n.hidden, false) as hidden,
  -- The last segment of the path, which is what the shop shows today when she
  -- has not named it.
  split_part(c.path, '|', greatest(c.depth, 1)) as ebay_name
from counted c
left join store_category_names n
  on n.tenant_id = c.tenant_id and n.path = c.path;

comment on view store_category_map is
  'Every category path in the catalogue at both levels the shop groups on, with product counts and her name where she has given one. The portal lists this so she renames what exists rather than typing paths from memory.';

grant select on store_category_map to authenticated;
