-- Keeper decides like a seller (keeper-task-01-shop-drafts.md, after the first rehearsal).
--
-- The check now settles what a seller would settle without asking: the returns, the label warnings it can read off
-- the photos, the safety line a biocide's advert needs, the questions an earlier pass left, and a detail the sources
-- disagree on (left out, never guessed). So its one write takes those too. The rules that keep her work safe are
-- the same as 0123's: drafts only, nothing written if she saved since Keeper read it, her returns and her title
-- never replaced. Added here:
--   the address alone can be made shorter on a draft, the first one kept in slug_before;
--   the label warnings and the biocide number are filled only where nothing is saved;
--   the description only ever grows at the end (the safety line), so her words are never changed;
--   the details are replaced whole, from the copy Keeper read, which the updated_at check makes safe.

drop function if exists set_keeper_check(uuid, timestamptz, jsonb, text, text, text);

create or replace function set_keeper_check(
  p_id uuid, p_seen timestamptz, p_derived jsonb, p_returns text, p_title text, p_slug text,
  p_hazard jsonb default null, p_biocide_reg text default null, p_description text default null, p_specs jsonb default null
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
      title = new_title,
      slug = new_slug
  where id = p_id;

  return 'written';
end;
$$;

revoke all on function set_keeper_check(uuid, timestamptz, jsonb, text, text, text, jsonb, text, text, jsonb) from public, anon, authenticated;
grant execute on function set_keeper_check(uuid, timestamptz, jsonb, text, text, text, jsonb, text, text, jsonb) to service_role;
