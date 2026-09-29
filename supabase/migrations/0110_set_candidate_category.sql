-- Her choice of category for one card, the only way the portal writes a category.
-- One function, so no screen can write the wrong columns: it checks the card is hers, takes the tab and the
-- filter from Google's taxonomy, marks the choice as hers (manual, which no import or script changes), and
-- clears the clash flag, since she has looked. Decisions are not touched.
-- Undo passes the card's previous source and flag back, so undoing a move restores "from the eBay listing" rather
-- than leaving "you set this". Nothing else may pass them.

drop function if exists public.set_candidate_category(uuid, integer);

create or replace function public.set_candidate_category(
  p_candidate uuid,
  p_category integer,
  p_restore_source text default null,
  p_restore_flag text default null
)
returns table (category_id integer, category_top_id integer, category_level2_id integer, category_source text, category_flag text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
  v_top integer;
  v_level2 integer;
  v_source text := coalesce(p_restore_source, 'manual');
  v_flag text := case when p_restore_source is null then null else p_restore_flag end;
begin
  if v_source not in ('manual', 'ebay', 'ai', 'google_export', 'default') then
    raise exception 'Not a category source: %', v_source using errcode = '22023';
  end if;
  if v_flag is not null and v_flag <> 'check_same_product' then
    raise exception 'Not a category flag: %', v_flag using errcode = '22023';
  end if;

  select c.tenant_id into v_tenant from candidates c where c.id = p_candidate;
  if v_tenant is null then
    raise exception 'No such card' using errcode = 'P0002';
  end if;
  if not has_tenant(v_tenant) then
    raise exception 'Not your card' using errcode = '42501';
  end if;

  select g.top_id, g.level2_id into v_top, v_level2 from google_categories g where g.id = p_category;
  if v_top is null then
    raise exception 'No Google category %', p_category using errcode = 'P0002';
  end if;

  update candidates c
     set category_id = p_category,
         category_top_id = v_top,
         category_level2_id = v_level2,
         category_source = v_source,
         category_flag = v_flag
   where c.id = p_candidate;

  return query select p_category, v_top, v_level2, v_source, v_flag;
end;
$$;

revoke all on function public.set_candidate_category(uuid, integer, text, text) from public, anon;
grant execute on function public.set_candidate_category(uuid, integer, text, text) to authenticated;
