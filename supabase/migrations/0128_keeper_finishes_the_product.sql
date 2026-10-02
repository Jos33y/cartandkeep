-- Keeper finishes the product (keeper-task-01-shop-drafts.md, after the first real run):
--   1. Write first, then check. A run gives a draft with nothing written for it the writing job first, and the check
--      applies what it wrote where the box is empty: the description, the brand, what is in the box, the section.
--   2. The writer never undoes the check. When the writing job runs again on a product already checked (opening it,
--      Ask Keeper again), a check is queued after it, so its new questions are answered and the product stays ready.
--   3. set_keeper_check takes the writer's work (p_fill) and fills only empty boxes.

-- The shop's sections, as the writer is given them: path and name.
create or replace function sections_for(p_tenant uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('path', m.path, 'label', coalesce(nullif(m.name, ''), m.ebay_name)) order by m.path), '[]'::jsonb)
  from store_category_map m
  where m.tenant_id = p_tenant;
$$;

revoke all on function sections_for(uuid) from public, anon, authenticated;

drop function if exists set_keeper_check(uuid, timestamptz, jsonb, text, text, text, jsonb, text, text, jsonb);

create or replace function set_keeper_check(
  p_id uuid, p_seen timestamptz, p_derived jsonb, p_returns text, p_title text, p_slug text,
  p_hazard jsonb default null, p_biocide_reg text default null, p_description text default null, p_specs jsonb default null,
  p_fill jsonb default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  cur store_products;
  new_title text;
  new_slug text;
  new_description text;
  extra jsonb := '{}'::jsonb;
begin
  select * into cur from store_products where id = p_id for update;
  if not found then return 'gone'; end if;
  if cur.status <> 'draft' or cur.archived_at is not null then return 'not_draft'; end if;
  if cur.updated_at is distinct from p_seen then return 'changed'; end if;

  new_title := cur.title;
  if nullif(btrim(p_title), '') is not null
     and coalesce(cur.derived_fields ->> 'title_by', '') = ''
     and btrim(p_title) <> cur.title then
    new_title := btrim(p_title);
    extra := jsonb_build_object('title_before', cur.title, 'title_by', 'keeper');
  end if;

  new_slug := cur.slug;
  if nullif(btrim(p_slug), '') is not null and btrim(p_slug) <> cur.slug then
    new_slug := btrim(p_slug);
    if exists (select 1 from store_products o where o.tenant_id = cur.tenant_id and o.slug = new_slug and o.id <> cur.id) then
      new_slug := new_slug || '-' || left(replace(cur.id::text, '-', ''), 6);
    end if;
    if new_slug <> cur.slug then
      extra := extra || jsonb_build_object('slug_before', coalesce(cur.derived_fields ->> 'slug_before', cur.slug));
    else
      new_slug := cur.slug;
    end if;
  end if;

  -- Only ever added to the end: the text Keeper sends has to start with what is saved.
  new_description := cur.description;
  -- An empty description takes the one Keeper wrote for it.
  if nullif(btrim(coalesce(cur.description, '')), '') is null and nullif(btrim(p_fill ->> 'description'), '') is not null then
    new_description := btrim(p_fill ->> 'description');
  end if;
  if p_description is not null and cur.description is not null
     and length(p_description) > length(cur.description)
     and left(p_description, length(cur.description)) = cur.description then
    new_description := p_description;
  end if;

  update store_products
  set derived_fields = coalesce(derived_fields, '{}'::jsonb) || coalesce(p_derived, '{}'::jsonb) || extra,
      returns_class = case
        when p_returns in ('standard', 'sealed', 'none') and coalesce(derived_fields ->> 'returns_by', '') <> 'her' then p_returns
        else returns_class
      end,
      hazard = case when hazard is null and p_hazard is not null and jsonb_typeof(p_hazard) = 'object' then p_hazard else hazard end,
      biocide_reg_no = coalesce(biocide_reg_no, nullif(btrim(p_biocide_reg), '')),
      description = new_description,
      specifications = case when p_specs is not null and jsonb_typeof(p_specs) = 'object' then p_specs else specifications end,
      -- The writer's draft, applied where the box is empty: nothing she typed is replaced.
      brand = case when nullif(btrim(brand), '') is null then coalesce(nullif(btrim(p_fill ->> 'brand'), ''), brand) else brand end,
      in_the_box = case when nullif(btrim(in_the_box), '') is null then coalesce(nullif(btrim(p_fill ->> 'in_the_box'), ''), in_the_box) else in_the_box end,
      section = case when nullif(btrim(section), '') is null then coalesce(nullif(btrim(p_fill ->> 'section'), ''), section) else section end,
      title = new_title,
      slug = new_slug
  where id = p_id;

  return 'written';
end;
$$;

revoke all on function set_keeper_check(uuid, timestamptz, jsonb, text, text, text, jsonb, text, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function set_keeper_check(uuid, timestamptz, jsonb, text, text, text, jsonb, text, text, jsonb, jsonb) to service_role;

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

  -- Write first, then check: a draft Keeper has written nothing for, with a box still empty, gets the writing job,
  -- and its check waits for it (claim_run_jobs). Her sections go with it, as the portal sends them.
  if n > 0 and not coalesce(p_rehearsal, false) then
    insert into keeper_jobs (tenant_id, product_id, kind, sections)
    select p.tenant_id, p.id, 'fill', sections_for(p.tenant_id)
    from keeper_jobs j join store_products p on p.id = j.product_id
    where j.run_id = r.id
      and coalesce(p.derived_fields -> 'draft' ->> 'version', '') <> '2'
      and (nullif(btrim(coalesce(p.description, '')), '') is null or nullif(btrim(coalesce(p.section, '')), '') is null)
      and not exists (select 1 from keeper_jobs f where f.product_id = p.id and f.kind = 'fill' and f.state in ('queued', 'working'));
  end if;
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

-- 2. A writing job finished on a product Keeper has checked before: check it again, on its own, after the writer.
create or replace function check_after_writing()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.kind = 'fill' and new.state = 'done' and old.state is distinct from 'done'
     and exists (
       select 1 from store_products p
       where p.id = new.product_id and p.status = 'draft' and p.archived_at is null
         and coalesce(p.derived_fields, '{}'::jsonb) ? 'rules'
     )
     and not exists (
       select 1 from keeper_jobs j where j.product_id = new.product_id and j.kind = 'shop_check' and j.state in ('queued', 'working')
     ) then
    insert into keeper_jobs (tenant_id, product_id, kind) values (new.tenant_id, new.product_id, 'shop_check');
  end if;
  return new;
end;
$$;

drop trigger if exists keeper_jobs_check_after_writing on keeper_jobs;
create trigger keeper_jobs_check_after_writing after update of state on keeper_jobs
for each row execute function check_after_writing();
