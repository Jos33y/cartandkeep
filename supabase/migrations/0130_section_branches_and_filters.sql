-- After the first sort on Google's tree (2 October):
--   1. A section keeps only the top of each branch it covers. Naming Home & Garden and also Vases inside it says
--      nothing more about where products go, and made the shop's filters a wall of mixed levels.
--   2. The filters inside a section are chosen from her products: one level below the branch, or deeper while every
--      product there shares the same next level (Pets shows Dog, Cat and Fish rather than one "Pet Supplies").
--      Worked out per section whenever its products or its branches change.
--   3. "checked": a Google category the studio corrected by hand. Protected like hers, never shown as hers.

alter table store_products drop constraint if exists store_products_google_source_check;
alter table store_products add constraint store_products_google_source_check
  check (google_category_source is null or google_category_source in ('manual', 'ebay', 'ai', 'checked', 'default'));

-- 1. Only the top of each branch, in the order given, whoever writes the section.
create or replace function google_branch_tops(p_ids integer[])
returns integer[]
language sql
stable
set search_path = public
as $$
  select coalesce(array_agg(g.id order by x.ord), '{}')
  from unnest(p_ids) with ordinality as x(id, ord)
  join google_categories g on g.id = x.id
  where x.ord = (select min(y.ord) from unnest(p_ids) with ordinality as y(id, ord) where y.id = x.id)
    and not exists (
      select 1 from unnest(p_ids) as z(id) join google_categories a on a.id = z.id
      where a.id <> g.id and left(g.path, length(a.path) + 3) = a.path || ' > '
    );
$$;

create or replace function store_category_names_tops()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.google_ids := google_branch_tops(new.google_ids);
  return new;
end;
$$;

drop trigger if exists store_category_names_tops on store_category_names;
create trigger store_category_names_tops before insert or update of google_ids on store_category_names
for each row execute function store_category_names_tops();

update store_category_names set google_ids = google_ids where cardinality(google_ids) > 0;

-- 2. The filters of one section, or of every section in the shop.
create or replace function refresh_google_subs(p_tenant uuid, p_section text default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  with secs as (
    select n.path as section, n.google_ids from store_category_names n
    where n.tenant_id = p_tenant and n.own and (p_section is null or n.path = p_section)
  ),
  branch as (
    select s.section, cardinality(s.google_ids) as many, g.path, g.depth
    from secs s cross join lateral unnest(s.google_ids) as b(id) join google_categories g on g.id = b.id
  ),
  member as (
    select p.id, p.section, me.path, me.depth, string_to_array(me.path, ' > ') as parts
    from store_products p join google_categories me on me.id = p.google_category_id
    where p.tenant_id = p_tenant and p.status <> 'archived' and p.section in (select section from secs)
  ),
  -- Each product under the deepest branch of its section that holds it.
  held as (
    select distinct on (m.id) m.*, b.path as bpath, b.depth as bdepth, b.many
    from member m join branch b on b.section = m.section
      and (m.path = b.path or left(m.path, length(b.path) + 3) = b.path || ' > ')
    order by m.id, b.depth desc
  ),
  -- How many different categories the products of a branch reach at each of the next three levels.
  spread as (
    select h.section, h.bpath, h.bdepth + d as k,
           count(distinct array_to_string(h.parts[1:h.bdepth + d], ' > ')) filter (where h.depth >= h.bdepth + d) as kinds
    from held h cross join generate_series(1, 3) as d
    group by h.section, h.bpath, h.bdepth + d
  ),
  level as (
    select section, bpath, coalesce(min(k) filter (where kinds >= 2), min(k)) as k from spread group by section, bpath
  ),
  want as (
    select m.id,
      case
        when h.id is null then null
        when h.many > 1 then h.bpath
        when h.depth >= l.k then array_to_string(h.parts[1:l.k], ' > ')
      end as sub
    from member m
    left join held h on h.id = m.id
    left join level l on l.section = h.section and l.bpath = h.bpath
  )
  update store_products p set google_sub = w.sub
  from want w
  where p.id = w.id and p.google_sub is distinct from w.sub;
  get diagnostics n = row_count;

  -- Outside every section, or in one of hers with no Google branch: no filter.
  update store_products p set google_sub = null
  where p.tenant_id = p_tenant and p.google_sub is not null
    and (p_section is null or p.section = p_section)
    and (p.section is null or p.status = 'archived' or p.google_category_id is null
         or not exists (select 1 from store_category_names n where n.tenant_id = p.tenant_id and n.path = p.section and n.own and cardinality(n.google_ids) > 0));
  return n;
end;
$$;

revoke all on function refresh_google_subs(uuid, text) from public, anon, authenticated;

-- The row trigger from 0129 no longer works out the filter: that needs the whole section, so it runs after the change.
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

  if new.section is null and new.google_category_id is not null and new.google_category_source <> 'default'
     and (tg_op = 'INSERT' or new.google_category_id is distinct from old.google_category_id) then
    new.section := section_for_google(new.tenant_id, new.google_category_id);
  end if;
  return new;
end;
$$;

drop function if exists google_sub_for(uuid, text, integer);

-- Once per statement, so a sort that moves two hundred products works each section out once.
create or replace function store_products_subs_after()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  s record;
begin
  -- A statement that touched nothing still fires this; it must not start another.
  if not exists (select 1 from new_rows) then return null; end if;
  if tg_op = 'INSERT' then
    for s in select distinct n.tenant_id, n.section from new_rows n where n.section is not null loop
      perform refresh_google_subs(s.tenant_id, s.section);
    end loop;
  else
    for s in
      select distinct x.tenant_id, x.section from (
        select n.tenant_id, n.section from new_rows n join old_rows o on o.id = n.id
        where n.section is distinct from o.section or n.google_category_id is distinct from o.google_category_id or n.status is distinct from o.status
        union
        select o.tenant_id, o.section from new_rows n join old_rows o on o.id = n.id
        where n.section is distinct from o.section or n.status is distinct from o.status
      ) x where x.section is not null
    loop
      perform refresh_google_subs(s.tenant_id, s.section);
    end loop;
    -- Moved to Odds and ends, or archived: its filter goes.
    if exists (select 1 from new_rows n where n.google_sub is not null and (n.section is null or n.status = 'archived')) then
      update store_products p set google_sub = null
      from new_rows n where p.id = n.id and p.google_sub is not null and (n.section is null or n.status = 'archived');
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists store_products_subs_insert on store_products;
create trigger store_products_subs_insert after insert on store_products
referencing new table as new_rows for each statement execute function store_products_subs_after();
drop trigger if exists store_products_subs_update on store_products;
create trigger store_products_subs_update after update on store_products
referencing old table as old_rows new table as new_rows for each statement execute function store_products_subs_after();

-- A product removed for good: its section's filters are worked out again without it.
create or replace function store_products_subs_deleted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  s record;
begin
  for s in select distinct o.tenant_id, o.section from old_rows o where o.section is not null loop
    perform refresh_google_subs(s.tenant_id, s.section);
  end loop;
  return null;
end;
$$;

drop trigger if exists store_products_subs_delete on store_products;
create trigger store_products_subs_delete after delete on store_products
referencing old table as old_rows for each statement execute function store_products_subs_deleted();

-- A section's branches changed: products with no section are placed, then every filter in the shop is read again.
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
  perform refresh_google_subs(p_tenant, null);
  return n;
end;
$$;

revoke all on function place_by_google(uuid) from public, anon, authenticated;

select refresh_google_subs(t.id, null) from tenants t;
