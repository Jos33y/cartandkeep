-- Sections on Google's tree (keeper-task-01-build-plan.md, sections):
--   1. Every product carries a Google category, read from its eBay category by the same table the research uses
--      (scripts/categories/ebay-to-google.mjs, loaded by load-ebay-map.mjs). Her own choice is never changed.
--   2. A section names the Google branches it covers. A product with no section goes to the section whose branch
--      holds it, deepest first; a product she placed, or sent to Odds and ends, stays where it is.
--   3. Inside a section, the next level of Google's tree is the filter (google_sub), for the shop and the feed.
--   4. Keeper opens a section when three or more products share a branch no section covers.
--   5. The sort reads the Google mix of her products and her research cards.

-- Google's taxonomy is in google_categories (load-taxonomy.mjs). Looked up by path when the eBay table is loaded.
create index if not exists google_categories_path_idx on google_categories (lower(path));

create or replace function google_id_of(p_path text)
returns integer
language sql
stable
set search_path = public
as $$
  select id::integer from google_categories where lower(path) = lower(trim(p_path)) limit 1;
$$;

-- 1. The eBay table, in the order it is written: the first row whose eBay path starts the listing's wins.
create table if not exists google_from_ebay (
  position integer primary key,
  ebay_prefix text not null,
  google_id integer not null
);
alter table google_from_ebay enable row level security;
comment on table google_from_ebay is
  'scripts/categories/ebay-to-google.mjs, row for row. Loaded by load-ebay-map.mjs; edit the script, never this table.';

alter table store_products
  add column if not exists google_category_id integer,
  add column if not exists google_category_source text,
  add column if not exists google_sub text;
alter table store_products drop constraint if exists store_products_google_source_check;
alter table store_products add constraint store_products_google_source_check
  check (google_category_source is null or google_category_source in ('manual', 'ebay', 'ai', 'default'));
comment on column store_products.google_category_id is
  'Google product category, sent to Merchant as google_product_category. Source: manual (hers), ebay (the table), ai (the title), default (Home & Garden, nothing better known).';
comment on column store_products.google_sub is
  'The Google category the shop filters this product by inside its section, one level below the section''s branch.';

/*
 * The same rule as makeMapper and refineFor in ebay-to-google.mjs, kept the same by test/google_parity_test.ts:
 * the first matching eBay row, else Home & Garden; then the title rules for heating parts, and for refills and
 * parts eBay files as appliances. The title overrides there are keyed by research query and do not apply here.
 */
create or replace function google_for_listing(p_ebay_path text, p_title text)
returns table (google_id integer, source text, rule text)
language plpgsql
stable
set search_path = public
as $$
declare
  hit integer;
  src text;
  why text;
  ebay text := trim(coalesce(p_ebay_path, ''));
  t text := split_part(coalesce(p_title, ''), '#', 1);
begin
  if ebay <> '' then
    select m.google_id into hit from google_from_ebay m
    where left(ebay, length(m.ebay_prefix)) = m.ebay_prefix
    order by m.position limit 1;
  end if;
  if hit is not null then src := 'ebay'; else hit := google_id_of('Home & Garden'); src := 'default'; end if;
  if hit is null then return; end if;

  if t ~* '\y(baxi|ideal|worcester|vaillant|glow-?worm|potterton|viessmann|ariston|biasi|vokera)\y(?:\s+[^\s#]+){0,3}?\s+\d{5,}\y' then
    hit := google_id_of('Hardware > Heating, Ventilation & Air Conditioning'); why := 'heating part number';
  elsif (select g.level2_id from google_categories g where g.id = hit) = google_id_of('Home & Garden > Household Appliances') then
    if t ~* '\y(refills?|sachets?|crystals?|tablets?|salt|descaler|pouches)\y' then
      hit := google_id_of('Home & Garden > Household Supplies'); why := 'appliance consumable';
    elsif t ~* '\y(filters?|bags?|belts?|brush(?:es)?|hoses?|nozzles?|parts?|spares?|replacements?|elements?|seals?|gaskets?|valves?|pumps?|motors?|thermostats?|ignitors?)\y' then
      hit := google_id_of('Home & Garden > Household Appliance Accessories'); why := 'appliance part';
    end if;
  end if;
  return query select hit, src, why;
end;
$$;

-- 2. Each section's Google branches.
alter table store_category_names
  add column if not exists google_ids integer[] not null default '{}',
  add column if not exists opened_by text;
comment on column store_category_names.google_ids is
  'The Google categories this section covers. A product goes to the section with the deepest branch that holds it.';
comment on column store_category_names.opened_by is
  'Null when she made it; keeper when Keeper opened it for three or more products no section covered.';

-- Her section for a Google category: the deepest branch that holds it, then her order.
create or replace function section_for_google(p_tenant uuid, p_google integer)
returns text
language sql
stable
set search_path = public
as $$
  select n.path
  from store_category_names n
  cross join lateral unnest(n.google_ids) as b(id)
  join google_categories node on node.id = b.id
  join google_categories me on me.id = p_google
  where n.tenant_id = p_tenant and n.own and position('|' in n.path) = 0
    and (me.path = node.path or left(me.path, length(node.path) + 3) = node.path || ' > ')
  order by node.depth desc, n.position asc nulls last, n.path
  limit 1;
$$;

/*
 * The filter inside a section: one level below the branch that holds the product. A section of several branches
 * filters by the branch itself. A product on the branch itself, or outside every branch, has none.
 */
create or replace function google_sub_for(p_tenant uuid, p_section text, p_google integer)
returns text
language sql
stable
set search_path = public
as $$
  select case
    when cardinality(n.google_ids) > 1 then node.path
    when me.depth > node.depth then array_to_string((string_to_array(me.path, ' > '))[1:node.depth + 1], ' > ')
  end
  from store_category_names n
  cross join lateral unnest(n.google_ids) as b(id)
  join google_categories node on node.id = b.id
  join google_categories me on me.id = p_google
  where n.tenant_id = p_tenant and n.path = p_section
    and (me.path = node.path or left(me.path, length(node.path) + 3) = node.path || ' > ')
  order by node.depth desc
  limit 1;
$$;

-- On every product: the Google category from eBay unless hers or the title's, a section when it has none, its filter.
create or replace function store_products_google()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  if (tg_op = 'INSERT' or new.category_path is distinct from old.category_path or new.title is distinct from old.title)
     and coalesce(new.google_category_source, 'default') in ('ebay', 'default') then
    select * into r from google_for_listing(new.category_path, new.title);
    if r.google_id is not null then
      new.google_category_id := r.google_id;
      new.google_category_source := r.source;
    end if;
  end if;

  -- Only a known category places a product; Home & Garden by default is a guess, so it waits.
  if new.section is null and new.google_category_id is not null and new.google_category_source <> 'default'
     and (tg_op = 'INSERT' or new.google_category_id is distinct from old.google_category_id) then
    new.section := section_for_google(new.tenant_id, new.google_category_id);
  end if;

  new.google_sub := case when new.section is not null and new.google_category_id is not null
    then google_sub_for(new.tenant_id, new.section, new.google_category_id) end;
  return new;
end;
$$;

drop trigger if exists store_products_google on store_products;
create trigger store_products_google before insert or update of category_path, title, google_category_id, google_category_source, section
on store_products for each row execute function store_products_google();

-- A section's branches changed: products with no section are placed, and every filter in the shop is read again.
create or replace function place_by_google(p_tenant uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  update store_products p
  set section = section_for_google(p.tenant_id, p.google_category_id)
  where p.tenant_id = p_tenant and p.section is null and p.status <> 'archived'
    and p.google_category_id is not null and p.google_category_source <> 'default'
    and section_for_google(p.tenant_id, p.google_category_id) is not null;
  get diagnostics n = row_count;

  update store_products p
  set google_sub = google_sub_for(p.tenant_id, p.section, p.google_category_id)
  where p.tenant_id = p_tenant and p.section is not null and p.google_category_id is not null
    and p.google_sub is distinct from google_sub_for(p.tenant_id, p.section, p.google_category_id);
  return n;
end;
$$;

create or replace function store_category_names_google()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.google_ids is distinct from old.google_ids then
    perform place_by_google(new.tenant_id);
  end if;
  return null;
end;
$$;

drop trigger if exists store_category_names_google on store_category_names;
create trigger store_category_names_google after insert or update of google_ids on store_category_names
for each row execute function store_category_names_google();

revoke all on function place_by_google(uuid) from public, anon, authenticated;

-- Every product the trigger has not seen yet: written once, so the trigger reads its eBay category.
create or replace function fill_product_google(p_tenant uuid default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  -- The trigger reads the eBay category only when it changes, so rows already there are read here.
  update store_products p
  set google_category_id = g.google_id, google_category_source = g.source
  from (select s.id, (google_for_listing(s.category_path, s.title)).* from store_products s
        where (p_tenant is null or s.tenant_id = p_tenant)
          and coalesce(s.google_category_source, 'default') in ('ebay', 'default')) g
  where p.id = g.id and g.google_id is not null
    and (p.google_category_id is distinct from g.google_id or p.google_category_source is distinct from g.source);
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function fill_product_google(uuid) from public, anon, authenticated;

-- The portal lists her sections from this view; it gains each section's branches and who opened it.
create or replace view store_category_map with (security_invoker = on) as
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
  count(pl.path) as products,
  count(pl.path) filter (where pl.status = 'live' and not pl.is_sample) as live,
  n.id as name_id,
  n.name,
  n.slug,
  n.blurb,
  n.position,
  n.hidden,
  n.own,
  n.aliases,
  null::text as ebay_name,
  n.google_ids,
  n.opened_by
from paths x
join store_category_names n on n.tenant_id = x.tenant_id and n.path = x.path
left join placed pl on pl.tenant_id = x.tenant_id and pl.path = x.path
group by x.tenant_id, x.path, n.id, n.name, n.slug, n.blurb, n.position, n.hidden, n.own, n.aliases, n.google_ids, n.opened_by;

-- 3. The shop reads the filter through store_cards and the two browsing functions.
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
  case when p.variant_count = 0 then p.price else greatest(coalesce(p.variant_max, p.price), case when p.variant_unpriced then p.price end) end as price_to,
  p.google_sub
from public.store_products p;

-- Google's names are public: the shop shows them as filters, and they say nothing about her.
grant select on google_categories to anon, authenticated;
do $$
begin
  if (select relrowsecurity from pg_class where oid = 'public.google_categories'::regclass)
     and not exists (select 1 from pg_policies where tablename = 'google_categories' and policyname = 'google_categories_read') then
    create policy google_categories_read on google_categories for select using (true);
  end if;
end $$;

drop function if exists public.store_browse(uuid, text[], text, numeric, numeric, text[], boolean, int, int, text, int, int);
drop function if exists public.store_facets(uuid, text[], text, numeric, numeric, text[], boolean, int, int);

-- As 0101, with one more filter: p_subs, the Google categories chosen inside a section.
create or replace function public.store_browse(
  p_tenant uuid,
  p_keys text[] default null,
  p_q text default null,
  p_min numeric default null,
  p_max numeric default null,
  p_brands text[] default null,
  p_in_stock boolean default false,
  p_dispatch_max int default null,
  p_dispatch_default int default 0,
  p_sort text default 'featured',
  p_limit int default 48,
  p_offset int default 0,
  p_subs text[] default null
)
returns table (
  id uuid, slug text, title text, price numeric, compare_at numeric, image_url text, image_2 text,
  brand text, section text, category_path text, group_key text, availability text, buyable boolean, stock int,
  dispatch_days int, "position" int, variant_count int, price_from numeric, price_to numeric, total bigint
)
language plpgsql
stable
security invoker
set search_path = public, extensions
as $fn$
declare
  v_order text := case p_sort
    when 'price-asc' then 'c.price_from asc, c.position asc nulls last, c.id'
    when 'price-desc' then 'c.price_to desc, c.position asc nulls last, c.id'
    when 'newest' then 'c.created_at desc, c.id'
    when 'name' then 'lower(c.title) asc, c.id'
    when 'relevance' then 'ts_rank(c.search_doc, q.tq) desc nulls last, extensions.word_similarity(lower(coalesce($3, '''')), lower(c.title)) desc, c.position asc nulls last, c.id'
    else 'c.position asc nulls last, c.price desc, c.id'
  end;
begin
  return query execute format($q$
    select
      c.id, c.slug, c.title, c.price, c.compare_at, c.image_url, c.image_2,
      c.brand, c.section, c.category_path, c.group_key, c.availability, c.buyable, c.stock,
      c.dispatch_days, c.position, c.variant_count, c.price_from, c.price_to,
      count(*) over () as total
    from public.store_cards c
    cross join (select public.store_tsquery(%3$L::text) as tq) q
    where c.tenant_id = %1$L::uuid
      and c.status = 'live'
      and c.is_sample = false
      and public.store_card_matches(c, %2$L::text[], %3$L::text, q.tq, %4$L::numeric, %5$L::numeric, %6$L::text[], %7$L::boolean, %8$L::int, %9$L::int)
      and (%13$L::text[] is null or c.google_sub = any (%13$L::text[]))
    order by %12$s
    limit %10$s offset %11$s
  $q$,
    p_tenant, p_keys, p_q, p_min, p_max, p_brands, coalesce(p_in_stock, false), p_dispatch_max, coalesce(p_dispatch_default, 0),
    least(greatest(coalesce(p_limit, 48), 1), 96), greatest(coalesce(p_offset, 0), 0),
    replace(v_order, '$3', format('%L::text', p_q)), p_subs);
end;
$fn$;

-- As 0101, with p_subs and one more count: subs, every filter inside the one section shown, its own choice left out.
create or replace function public.store_facets(
  p_tenant uuid,
  p_keys text[] default null,
  p_q text default null,
  p_min numeric default null,
  p_max numeric default null,
  p_brands text[] default null,
  p_in_stock boolean default false,
  p_dispatch_max int default null,
  p_dispatch_default int default 0,
  p_subs text[] default null
)
returns jsonb
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with q as (select store_tsquery(p_q) as tq),
  everything as (
    select c.*
    from public.store_cards c
    where c.tenant_id = p_tenant and c.status = 'live' and c.is_sample = false
  ),
  live as (select * from everything c where p_subs is null or c.google_sub = any (p_subs)),
  hits as (
    select * from live c, q
    where store_card_matches(c, p_keys, p_q, q.tq, p_min, p_max, p_brands, p_in_stock, p_dispatch_max, p_dispatch_default)
  ),
  priced as (
    select * from live c, q
    where store_card_matches(c, p_keys, p_q, q.tq, p_min, p_max, p_brands, p_in_stock, p_dispatch_max, p_dispatch_default, 'price')
  ),
  span as (select min(price_from) as lo, max(price_to) as hi from priced)
  select jsonb_build_object(
    'total', (select count(*) from hits),
    'groups', coalesce((
      select jsonb_agg(jsonb_build_object('key', group_key, 'count', n) order by n desc, group_key)
      from (select group_key, count(*) as n from live c, q
            where store_card_matches(c, p_keys, p_q, q.tq, p_min, p_max, p_brands, p_in_stock, p_dispatch_max, p_dispatch_default, 'group')
            group by group_key) g), '[]'::jsonb),
    'subs', case when cardinality(p_keys) = 1 then coalesce((
      select jsonb_agg(jsonb_build_object('path', google_sub, 'name', split_part(google_sub, ' > ', array_length(string_to_array(google_sub, ' > '), 1)), 'count', n)
                       order by n desc, google_sub)
      from (select google_sub, count(*) as n from everything c, q
            where google_sub is not null
              and store_card_matches(c, p_keys, p_q, q.tq, p_min, p_max, p_brands, p_in_stock, p_dispatch_max, p_dispatch_default)
            group by google_sub) s), '[]'::jsonb) else '[]'::jsonb end,
    'brands', coalesce((
      select jsonb_agg(jsonb_build_object('brand', brand, 'count', n) order by n desc, brand)
      from (select brand, count(*) as n from live c, q
            where brand is not null and brand <> ''
              and store_card_matches(c, p_keys, p_q, q.tq, p_min, p_max, p_brands, p_in_stock, p_dispatch_max, p_dispatch_default, 'brand')
            group by brand) b), '[]'::jsonb),
    'in_stock', (select count(*) from live c, q
                 where store_card_matches(c, p_keys, p_q, q.tq, p_min, p_max, p_brands, true, p_dispatch_max, p_dispatch_default)),
    'dispatch', coalesce((
      select jsonb_agg(jsonb_build_object('days', d, 'count', n) order by d)
      from (select coalesce(dispatch_days, p_dispatch_default) as d, count(*) as n from live c, q
            where store_card_matches(c, p_keys, p_q, q.tq, p_min, p_max, p_brands, p_in_stock, p_dispatch_max, p_dispatch_default, 'dispatch')
            group by 1) x), '[]'::jsonb),
    'price', (
      select jsonb_build_object(
        'min', s.lo, 'max', s.hi,
        'buckets', coalesce((
          select jsonb_agg(jsonb_build_object('band', b, 'count', n) order by b)
          from (select least(width_bucket(price_from, s.lo, s.hi + 0.01, 12), 12) as b, count(*) as n
                from priced group by 1) h), '[]'::jsonb))
      from span s)
  );
$$;

grant select on public.store_cards to anon, authenticated;
grant execute on function public.store_browse(uuid, text[], text, numeric, numeric, text[], boolean, int, int, text, int, int, text[]) to anon, authenticated;
grant execute on function public.store_facets(uuid, text[], text, numeric, numeric, text[], boolean, int, int, text[]) to anon, authenticated;

-- 4. Keeper opens a section for a branch no section covers, once three or more products wait in it. Only after she
-- has sorted by Google (some section names a branch), so it never builds a second set beside hers.
create or replace function keeper_open_sections(p_tenant uuid default null)
returns table (tenant_id uuid, name text, google_id integer, placed integer)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  t uuid;
  g record;
  want text;
  slug_base text;
  slug_try text;
  k integer;
  have text;
  new_path text;
begin
  for t in
    select distinct n.tenant_id from store_category_names n
    where (p_tenant is null or n.tenant_id = p_tenant) and n.own and cardinality(n.google_ids) > 0
  loop
    for g in
      select gc.level2_id as node, count(*) as n,
             mode() within group (order by nullif(trim(p.derived_fields -> 'draft' ->> 'new_section'), '')) as asked
      from store_products p
      join google_categories gc on gc.id = p.google_category_id
      where p.tenant_id = t and p.section is null and p.status <> 'archived' and not p.is_sample
        and p.google_category_source <> 'default' and gc.level2_id is not null
        and section_for_google(t, p.google_category_id) is null
      group by gc.level2_id
      having count(*) >= 3
    loop
      want := replace(coalesce(g.asked, (select gn.name from google_categories gn where gn.id = g.node)), ' & ', ' and ');
      select n.path into have from store_category_names n
      where n.tenant_id = t and n.own and lower(n.name) = lower(want) limit 1;
      if have is not null then
        update store_category_names n set google_ids = array_append(n.google_ids, g.node::integer)
        where n.tenant_id = t and n.path = have and not (g.node::integer = any (n.google_ids));
      else
        slug_base := left(nullif(section_slug(want), ''), 60);
        slug_try := slug_base;
        k := 1;
        while exists (select 1 from store_category_names n where n.tenant_id = t and (n.slug = slug_try or slug_try = any (n.aliases))) loop
          k := k + 1;
          slug_try := slug_base || '-' || k;
        end loop;
        new_path := 'own:' || substr(md5(gen_random_uuid()::text), 1, 8);
        insert into store_category_names (tenant_id, path, name, slug, own, google_ids, opened_by)
        values (t, new_path, want, slug_try, true, array[g.node::integer], 'keeper');
        have := new_path;
      end if;
      tenant_id := t; name := want; google_id := g.node; placed := (select count(*) from store_products p where p.tenant_id = t and p.section = have);
      return next;
    end loop;
  end loop;
end;
$$;

revoke all on function keeper_open_sections(uuid) from public, anon, authenticated;

-- 5. What the sort reads: every Google branch to four levels with her products and her research cards in it.
create or replace function google_mix(p_tenant uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with mine as (
    select gc.path from store_products p join google_categories gc on gc.id = p.google_category_id
    where p.tenant_id = p_tenant and p.status <> 'archived' and not p.is_sample and p.google_category_source <> 'default'
  ),
  cards as (
    select gc.path, d.action from candidates c
    join google_categories gc on gc.id = c.category_id
    left join decisions d on d.candidate_id = c.id
    where c.tenant_id = p_tenant and coalesce(d.action, '') <> 'reject'
  ),
  up as (
    select array_to_string((string_to_array(m.path, ' > '))[1:k], ' > ') as node, 1 as mine, 0 as card, 0 as approved
    from mine m, generate_series(1, least(4, array_length(string_to_array(m.path, ' > '), 1))) k
    union all
    select array_to_string((string_to_array(c.path, ' > '))[1:k], ' > '), 0, 1, (c.action = 'approve')::int
    from cards c, generate_series(1, least(4, array_length(string_to_array(c.path, ' > '), 1))) k
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', gc.id, 'path', gc.path, 'products', s.mine, 'cards', s.card, 'approved', s.approved)
                            order by gc.path), '[]'::jsonb)
  from (select node, sum(mine) as mine, sum(card) as card, sum(approved) as approved from up group by node) s
  join google_categories gc on gc.path = s.node
  where s.mine > 0 or s.card >= 5;
$$;

revoke all on function google_mix(uuid) from public, anon, authenticated;
