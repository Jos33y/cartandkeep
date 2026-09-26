-- Catalogue browse: the shop asks for one page of cards at a time, with filters, counts and search done here rather than in the browser.
-- Run after 0100. Idempotent: safe to run twice.

create extension if not exists pg_trgm with schema extensions;

-- Search document: title and brand weigh most, then her section and eBay's path, then the specifications and highlights.
alter table public.store_products
  add column if not exists search_doc tsvector generated always as (
    setweight(to_tsvector('english'::regconfig, coalesce(title, '')), 'A')
    || setweight(to_tsvector('english'::regconfig, coalesce(brand, '')), 'A')
    || setweight(to_tsvector('english'::regconfig, coalesce(section, '') || ' ' || replace(coalesce(category_path, ''), '|', ' ')), 'B')
    || setweight(to_tsvector('english'::regconfig, coalesce(specifications::text, '') || ' ' || coalesce(highlights::text, '')), 'C')
  ) stored;

create index if not exists store_products_search_idx on public.store_products using gin (search_doc);
create index if not exists store_products_title_trgm_idx on public.store_products using gin (title extensions.gin_trgm_ops);
create index if not exists store_products_live_price_idx on public.store_products (tenant_id, price) where status = 'live' and is_sample = false;
create index if not exists store_products_live_position_idx on public.store_products (tenant_id, position, price desc) where status = 'live' and is_sample = false;
create index if not exists store_products_live_brand_idx on public.store_products (tenant_id, brand) where status = 'live' and is_sample = false;

-- Each product carries a summary of its sizes, kept by a trigger, so listing a thousand cards never has to aggregate the sizes table.
alter table public.store_products
  add column if not exists variant_count int not null default 0,
  add column if not exists variant_min numeric(10,2),
  add column if not exists variant_max numeric(10,2),
  add column if not exists variant_unpriced boolean not null default false,
  add column if not exists variant_buyable boolean not null default false;

-- Security definer so the summary stays right whoever edits a size; it only ever writes these four columns.
create or replace function public.store_variants_rollup(p_product uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.store_products p
  set variant_count = coalesce(v.n, 0),
      variant_min = v.lo,
      variant_max = v.hi,
      variant_unpriced = coalesce(v.unpriced, false),
      variant_buyable = coalesce(v.buyable, false)
  from (select count(*)::int as n, min(price) as lo, max(price) as hi, bool_or(price is null) as unpriced,
               -- The same rule as variantBuyable in useStoreProducts.js.
               bool_or(availability not in ('out_of_stock', 'discontinued')) as buyable
        from public.store_variants where product_id = p_product) v
  where p.id = p_product
    and (p.variant_count, p.variant_min, p.variant_max, p.variant_unpriced, p.variant_buyable)
        is distinct from (coalesce(v.n, 0), v.lo, v.hi, coalesce(v.unpriced, false), coalesce(v.buyable, false));
$$;

create or replace function public.store_variants_rollup_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then perform public.store_variants_rollup(old.product_id); end if;
  if tg_op in ('INSERT', 'UPDATE') and (tg_op = 'INSERT' or new.product_id is distinct from old.product_id or new.price is distinct from old.price or new.availability is distinct from old.availability) then
    perform public.store_variants_rollup(new.product_id);
  end if;
  return null;
end;
$$;

drop trigger if exists store_variants_rollup on public.store_variants;
create trigger store_variants_rollup
  after insert or update or delete on public.store_variants
  for each row execute function public.store_variants_rollup_trigger();

-- Backfill every product that already has sizes.
select public.store_variants_rollup(product_id) from (select distinct product_id from public.store_variants) s;

revoke all on function public.store_variants_rollup(uuid) from public, anon, authenticated;

-- What a card needs and nothing more. Security invoker, so the table's policies decide who sees what.
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
  -- The group a product falls in: her section key, else the top of eBay's path, else none ('').
  coalesce(nullif(p.section, ''), nullif(split_part(coalesce(p.category_path, ''), '|', 1), ''), '') as group_key,
  p.availability,
  -- The same rule as anyBuyable in useStoreProducts.js: a product with sizes is buyable when any size is.
  case when p.variant_count > 0 then p.variant_buyable else p.availability not in ('out_of_stock', 'discontinued') end as buyable,
  p.stock,
  p.dispatch_days,
  p.position,
  p.created_at,
  p.search_doc,
  p.status,
  p.is_sample,
  p.variant_count,
  -- A size with no price of its own sells at the product's price.
  case when p.variant_count = 0 then p.price else least(coalesce(p.variant_min, p.price), case when p.variant_unpriced then p.price end) end as price_from,
  case when p.variant_count = 0 then p.price else greatest(coalesce(p.variant_max, p.price), case when p.variant_unpriced then p.price end) end as price_to
from public.store_products p;

-- A search box string to a prefix query: "salt bath" finds "Salter bathroom". Empty or stopwords only gives null, which means no search.
create or replace function public.store_tsquery(q text)
returns tsquery
language sql
immutable
-- Stopword-only searches raise a notice per call; this keeps them out of the logs.
set client_min_messages = warning
as $$
  select case when numnode(tq) > 0 then tq end
  from (
    select to_tsquery('english', string_agg(t || ':*', ' & ')) as tq
    from regexp_split_to_table(lower(coalesce(q, '')), '[^a-z0-9]+') as t
    where t <> ''
  ) s;
$$;

-- One test for every filter, so browse and facets can never disagree about what matches.
-- p_skip names the one dimension a facet leaves out, so its own options keep their counts.
create or replace function public.store_card_matches(
  c public.store_cards,
  p_keys text[], p_q text, p_tq tsquery, p_min numeric, p_max numeric, p_brands text[],
  p_in_stock boolean, p_dispatch_max int, p_dispatch_default int,
  p_skip text default null
)
returns boolean
language sql
stable
-- No SET clause and fully qualified names, so the planner can inline it into the queries that call it.
as $$
  select
    (p_skip = 'group' or p_keys is null or c.group_key = any (p_keys))
    and (p_tq is null
         or c.search_doc @@ p_tq
         or extensions.word_similarity(lower(p_q), lower(c.title)) > 0.45)
    and (p_skip = 'price' or p_min is null or c.price_to >= p_min)
    and (p_skip = 'price' or p_max is null or c.price_from <= p_max)
    and (p_skip = 'brand' or p_brands is null or c.brand = any (p_brands))
    and (p_skip = 'stock' or not coalesce(p_in_stock, false) or c.buyable)
    and (p_skip = 'dispatch' or p_dispatch_max is null or coalesce(c.dispatch_days, p_dispatch_default) <= p_dispatch_max);
$$;

-- One page of cards. Live and not a sample, whoever is asking, so the studio sees exactly what a customer sees.
-- plpgsql with one ORDER BY per sort, so each request is planned for the sort it asked for and can use the position index.
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
  p_offset int default 0
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
  -- Chosen from a fixed list, never from the caller's text, so nothing they send reaches the SQL. Every order ends on id, so paging never repeats or skips a card.
  v_order text := case p_sort
    when 'price-asc' then 'c.price_from asc, c.position asc nulls last, c.id'
    when 'price-desc' then 'c.price_to desc, c.position asc nulls last, c.id'
    when 'newest' then 'c.created_at desc, c.id'
    when 'name' then 'lower(c.title) asc, c.id'
    when 'relevance' then 'ts_rank(c.search_doc, q.tq) desc nulls last, extensions.word_similarity(lower(coalesce($3, '''')), lower(c.title)) desc, c.position asc nulls last, c.id'
    else 'c.position asc nulls last, c.price desc, c.id'
  end;
begin
  -- Values go in as quoted literals rather than parameters, so every request gets a plan made for its own filters.
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
    order by %12$s
    limit %10$s offset %11$s
  $q$,
    p_tenant, p_keys, p_q, p_min, p_max, p_brands, coalesce(p_in_stock, false), p_dispatch_max, coalesce(p_dispatch_default, 0),
    least(greatest(coalesce(p_limit, 48), 1), 96), greatest(coalesce(p_offset, 0), 0),
    replace(v_order, '$3', format('%L::text', p_q)));
end;
$fn$;

-- The counts behind the filters, each with its own filter left out, so choosing one brand still shows how many the others have.
create or replace function public.store_facets(
  p_tenant uuid,
  p_keys text[] default null,
  p_q text default null,
  p_min numeric default null,
  p_max numeric default null,
  p_brands text[] default null,
  p_in_stock boolean default false,
  p_dispatch_max int default null,
  p_dispatch_default int default 0
)
returns jsonb
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with q as (select store_tsquery(p_q) as tq),
  live as (
    select c.*
    from public.store_cards c
    where c.tenant_id = p_tenant and c.status = 'live' and c.is_sample = false
  ),
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
        -- Twelve equal bands across the range the other filters allow, for the histogram behind the slider.
        'buckets', coalesce((
          select jsonb_agg(jsonb_build_object('band', b, 'count', n) order by b)
          from (select least(width_bucket(price_from, s.lo, s.hi + 0.01, 12), 12) as b, count(*) as n
                from priced group by 1) h), '[]'::jsonb))
      from span s)
  );
$$;

-- Every group with its count, price range and first three photographs. The shop names and addresses them from her names table.
create or replace function public.store_groups(p_tenant uuid)
returns table (group_key text, products bigint, price_min numeric, price_max numeric, images text[])
language sql
stable
security invoker
set search_path = public
as $$
  select
    c.group_key,
    count(*) as products,
    min(c.price_from) as price_min,
    max(c.price_to) as price_max,
    (array_agg(c.image_url order by c.position asc nulls last, c.price desc, c.id)
       filter (where c.image_url is not null))[1:3] as images
  from public.store_cards c
  where c.tenant_id = p_tenant and c.status = 'live' and c.is_sample = false
  group by c.group_key;
$$;

grant select on public.store_cards to anon, authenticated;
grant execute on function public.store_tsquery(text) to anon, authenticated;
grant execute on function public.store_card_matches(public.store_cards, text[], text, tsquery, numeric, numeric, text[], boolean, int, int, text) to anon, authenticated;
grant execute on function public.store_browse(uuid, text[], text, numeric, numeric, text[], boolean, int, int, text, int, int) to anon, authenticated;
grant execute on function public.store_facets(uuid, text[], text, numeric, numeric, text[], boolean, int, int) to anon, authenticated;
grant execute on function public.store_groups(uuid) to anon, authenticated;
