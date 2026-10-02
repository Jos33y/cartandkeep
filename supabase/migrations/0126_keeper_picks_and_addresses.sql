-- Keeper, after the second rehearsal (keeper-task-01-shop-drafts.md):
--   1. The shop's own principles, read by Keeper as facts about every product (store.principles).
--   2. A check of the products she picks on Products, skipping any already checked unless she asks again.
--   3. Short addresses: the same rule as Keeper's (shop-check.ts slugFor), in SQL, for the products already live.
--   4. Old addresses lead to the new one: every address change is remembered, and the shop asks where it went.

-- 1. Principles live in the tenant's own settings, so another shop sets its own. Cart & Keep's, as Joseph gave them.
update tenants
set store = jsonb_set(coalesce(store, '{}'::jsonb), '{principles}', '["Everything we sell is brand new and genuine. We do not sell fakes."]'::jsonb)
where slug = 'cart-and-keep' and not (coalesce(store, '{}'::jsonb) ? 'principles');

-- 2. The check, for every unchecked draft, the next drafts to rehearse, or the drafts she picked.
drop function if exists start_keeper_run(uuid, text, text, numeric, boolean, integer, text);

create or replace function start_keeper_run(
  p_tenant uuid, p_task text, p_pace text, p_cap_pence numeric, p_rehearsal boolean default false,
  p_limit integer default null, p_pick text default 'next', p_ids uuid[] default null, p_again boolean default false
)
returns keeper_runs
language plpgsql
security definer
set search_path = public
as $$
declare
  r keeper_runs;
  n integer;
  last_rehearsal uuid;
  picked boolean := p_ids is not null and cardinality(p_ids) > 0;
begin
  if not has_tenant(p_tenant) then raise exception 'Not your shop.' using errcode = '42501'; end if;
  if p_task is distinct from 'shop_check' then raise exception 'Unknown task %.', p_task; end if;
  if coalesce(p_pick, 'next') not in ('next', 'again') then raise exception 'Unknown pick %.', p_pick; end if;
  if exists (select 1 from keeper_runs where tenant_id = p_tenant and task = p_task and state in ('running', 'paused')) then
    raise exception 'A check is already going. Open it to carry on or stop it.' using errcode = '23505';
  end if;

  if not picked and coalesce(p_rehearsal, false) and p_pick = 'again' then
    select id into last_rehearsal from keeper_runs
    where tenant_id = p_tenant and task = p_task and rehearsal
    order by created_at desc limit 1;
    if last_rehearsal is null then raise exception 'There is no rehearsal to run again.' using errcode = 'P0002'; end if;
  end if;

  insert into keeper_runs (tenant_id, task, pace, cap_pence, rehearsal)
  values (p_tenant, p_task, coalesce(p_pace, 'watch'), p_cap_pence, coalesce(p_rehearsal, false))
  returning * into r;

  insert into keeper_jobs (tenant_id, product_id, kind, run_id)
  select p.tenant_id, p.id, 'shop_check', r.id
  from store_products p
  where p.tenant_id = p_tenant
    and p.status = 'draft'
    and p.archived_at is null
    and p.is_sample = false
    and not exists (
      select 1 from keeper_jobs j where j.product_id = p.id and j.kind = 'shop_check' and j.state in ('queued', 'working')
    )
    -- Picked: those drafts, and the ones checked before only when she asks again.
    and (not picked or p.id = any(p_ids))
    and ((picked and coalesce(p_again, false)) or not (coalesce(p.derived_fields, '{}'::jsonb) ? 'rules'))
    -- Not picked, rehearsing: the last rehearsal's drafts again, or only drafts no rehearsal has taken.
    and (picked or last_rehearsal is null or exists (select 1 from keeper_jobs j where j.run_id = last_rehearsal and j.product_id = p.id))
    and (
      picked or not coalesce(p_rehearsal, false) or last_rehearsal is not null
      or not exists (
        select 1 from keeper_jobs j join keeper_runs k on k.id = j.run_id
        where j.product_id = p.id and k.rehearsal and k.id <> r.id
      )
    )
  order by p.created_at, p.id
  limit coalesce(p_limit, 100000);

  get diagnostics n = row_count;
  if n = 0 then
    if picked then
      raise exception 'Every draft you picked has been checked already. Tick "Check them again" to check them again.' using errcode = 'P0002';
    end if;
    if coalesce(p_rehearsal, false) and last_rehearsal is null then
      raise exception 'Every draft has been rehearsed. Rehearse the last ones again, or start for real.' using errcode = 'P0002';
    end if;
    raise exception 'Every draft has been checked already.' using errcode = 'P0002';
  end if;

  update keeper_runs set total = n where id = r.id returning * into r;
  return r;
end;
$$;

revoke all on function start_keeper_run(uuid, text, text, numeric, boolean, integer, text, uuid[], boolean) from public, anon;
grant execute on function start_keeper_run(uuid, text, text, numeric, boolean, integer, text, uuid[], boolean) to authenticated;

-- 3. The short address, as shop-check.ts makes it: up to six words that say what it is, fifty characters at most,
-- no counts like "10pcs", no listing numbers. Kept the same as the TypeScript by a test (slug_parity_test.ts).
create or replace function keeper_slug(p_title text)
returns text
language plpgsql
immutable
as $$
declare
  w text;
  out_words text[] := '{}';
  cleaned text;
begin
  cleaned := translate(lower(coalesce(p_title, '')),
    'àáâãäåāçćčèéêëēėęìíîïīįñńòóôõöōùúûüūýÿžźż', 'aaaaaaaccceeeeeeeiiiiiinnoooooouuuuuyyzzz');
  cleaned := replace(cleaned, '&', ' and ');
  for w in select regexp_replace(regexp_replace(x, '[^a-z0-9]+', '-', 'g'), '^-+|-+$', '', 'g')
           from regexp_split_to_table(cleaned, '[\s,/|]+') as x
  loop
    continue when w = '' or w = any(array['a', 'an', 'and', 'the', 'of', 'with', 'for', 'in', 'on', 'to', 'by', 'from', 'uk', 'new', 'pcs', 'pc', 'x'])
      or w ~ '^\d+(pcs|pc|pk|x)$';
    exit when cardinality(out_words) >= 6 or length(array_to_string(out_words || w, '-')) > 50;
    out_words := out_words || w;
  end loop;
  return coalesce(nullif(array_to_string(out_words, '-'), ''), 'product');
end;
$$;

-- 4. Every address a product has had, so an old link still finds it. Written by a trigger, whoever changes it.
create table if not exists store_slug_moves (
  tenant_id uuid not null references tenants (id) on delete cascade,
  old_slug text not null,
  product_id uuid not null references store_products (id) on delete cascade,
  moved_at timestamptz not null default now(),
  primary key (tenant_id, old_slug)
);
alter table store_slug_moves enable row level security;

create or replace function remember_slug_move()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.slug is distinct from old.slug then
    -- The new address is in use again: it no longer points anywhere else.
    delete from store_slug_moves where tenant_id = new.tenant_id and old_slug = new.slug;
    insert into store_slug_moves (tenant_id, old_slug, product_id)
    values (new.tenant_id, old.slug, new.id)
    on conflict (tenant_id, old_slug) do update set product_id = excluded.product_id, moved_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists store_products_slug_move on store_products;
create trigger store_products_slug_move after update of slug on store_products
for each row execute function remember_slug_move();

-- Where an old address went: the live product's address now, or null. For the shop, so open to anyone.
create or replace function store_slug_now(p_tenant uuid, p_slug text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.slug
  from store_slug_moves m
  join store_products p on p.id = m.product_id
  where m.tenant_id = p_tenant and m.old_slug = p_slug
    and p.status = 'live' and not p.is_sample and p.slug <> p_slug
  limit 1;
$$;

revoke all on function store_slug_now(uuid, text) from public;
grant execute on function store_slug_now(uuid, text) to anon, authenticated;

/*
 * The products already on sale, given short addresses once. Run from the SQL editor: first with p_apply false to
 * see every old and new address, then with true to change them. Only the address changes; the old one keeps
 * working through store_slug_moves. Products whose address is already short are left alone.
 */
create or replace function shorten_live_slugs(p_tenant uuid, p_apply boolean default false)
returns table (product_id uuid, title text, old_slug text, new_slug text)
language plpgsql
security definer
set search_path = public
as $$
declare
  p record;
  want text;
  taken text[] := '{}';
begin
  for p in
    select s.id, s.title, s.slug from store_products s
    where s.tenant_id = p_tenant and s.status = 'live' and not s.is_sample
      and (s.slug ~ '-\d{8,}$' or length(s.slug) > 50)
    order by s.created_at, s.id
  loop
    want := keeper_slug(p.title);
    if want = p.slug then continue; end if;
    if want = any(taken) or exists (select 1 from store_products o where o.tenant_id = p_tenant and o.slug = want and o.id <> p.id) then
      want := want || '-' || left(replace(p.id::text, '-', ''), 6);
    end if;
    taken := taken || want;
    product_id := p.id; title := p.title; old_slug := p.slug; new_slug := want;
    if p_apply then
      update store_products s
      set slug = want,
          derived_fields = coalesce(s.derived_fields, '{}'::jsonb)
            || jsonb_build_object('slug_before', coalesce(s.derived_fields ->> 'slug_before', p.slug))
      where s.id = p.id;
    end if;
    return next;
  end loop;
end;
$$;

revoke all on function shorten_live_slugs(uuid, boolean) from public, anon, authenticated;
