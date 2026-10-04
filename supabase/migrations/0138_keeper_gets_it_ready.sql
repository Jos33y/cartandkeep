-- 0138_keeper_gets_it_ready.sql
-- Keeper task 03 (Joseey, 4 October): Keeper gets approved cards ready for eBay in its office, and Get it ready leaves
-- the Approved page. For each card it fills only what is missing: Amazon's facts, photos, the title and the
-- description, eBay's category and item details, and the parcel. It stops at Ready to go live; it never lists.
--
-- The cards are picked on Approved, where the market is worked out (up to 25% over it, in stock, pack confirmed), or
-- ticked there; this file takes the ids. The worker is keeper-run/ready.ts. Her draft is written only through
-- keeper_ready_fill, which fills a field only while it is still empty, so nothing she wrote is ever replaced.

-- 1. A third kind of run, over candidates like Amazon sourcing --------------------------------------------------

alter table keeper_runs drop constraint if exists keeper_runs_task_check;
alter table keeper_runs add constraint keeper_runs_task_check check (task in ('shop_check', 'amazon_source', 'get_ready'));

alter table keeper_jobs drop constraint if exists keeper_jobs_kind_check;
alter table keeper_jobs add constraint keeper_jobs_kind_check check (kind in ('fill', 'shop_check', 'amazon_source', 'get_ready'));
alter table keeper_jobs drop constraint if exists keeper_jobs_subject_check;
alter table keeper_jobs add constraint keeper_jobs_subject_check check (
  (kind in ('amazon_source', 'get_ready') and candidate_id is not null and product_id is null)
  or (kind not in ('amazon_source', 'get_ready') and product_id is not null)
);

-- 2. Starting a run ------------------------------------------------------------------------------------------------

/*
 * A run over the cards she sent from Approved, in the order sent. Each must still be hers, approved, not live on
 * eBay and not in the eBay queue. A card Keeper got ready before goes again only when she asks (p_again: the cards
 * she ticked, or one moved to another product), since it is paid for again. With a run already going, the cards
 * join it at the back, so sending more never waits on the last lot.
 */
create or replace function start_ready_run(
  p_tenant uuid, p_ids uuid[], p_pace text default 'watch', p_cap_pence numeric default 500, p_again boolean default false
)
returns keeper_runs
language plpgsql
security definer
set search_path = public
as $$
declare
  r keeper_runs;
  n integer;
  joined boolean;
begin
  if not has_tenant(p_tenant) then raise exception 'Not your shop.' using errcode = '42501'; end if;
  if coalesce(p_pace, 'watch') not in ('watch', 'normal') then raise exception 'Unknown pace %.', p_pace; end if;
  if p_ids is null or cardinality(p_ids) = 0 then raise exception 'Choose the cards to get ready.' using errcode = '22023'; end if;
  select * into r from keeper_runs where tenant_id = p_tenant and task = 'get_ready' and state in ('running', 'paused')
  order by created_at desc limit 1 for update;
  joined := found;
  if not joined then
    insert into keeper_runs (tenant_id, task, pace, cap_pence, rehearsal)
    values (p_tenant, 'get_ready', coalesce(p_pace, 'watch'), greatest(coalesce(p_cap_pence, 500), 1), false)
    returning * into r;
  end if;

  -- Taken in the order she sent them: the queue goes by created_at.
  insert into keeper_jobs (tenant_id, candidate_id, kind, run_id, created_at)
  select p_tenant, c.id, 'get_ready', r.id, now() + picked.at * interval '1 millisecond'
  from unnest(p_ids) with ordinality as picked(id, at)
  join candidates c on c.id = picked.id and c.tenant_id = p_tenant
  where exists (select 1 from decisions d where d.candidate_id = c.id and d.action = 'approve')
    and c.ebay ->> 'listing_id' is null
    and not exists (select 1 from listing_jobs l where l.candidate_id = c.id and l.state in ('queued', 'working'))
    and not exists (select 1 from keeper_jobs j where j.candidate_id = c.id and j.kind = 'get_ready' and j.state in ('queued', 'working'))
    and (coalesce(p_again, false) or not exists (
      select 1 from keeper_jobs j where j.candidate_id = c.id and j.kind = 'get_ready' and j.state = 'done'
    ))
  order by picked.at;

  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'None of these can be got ready now: live on eBay, in the eBay queue, no longer approved, already with Keeper, or got ready before.'
      using errcode = 'P0002';
  end if;

  -- Joined: the total grows, the spending limit with it (5p a card), and a run paused at its limit carries on.
  if joined then
    update keeper_runs
    set total = total + n, cap_pence = cap_pence + n * 5,
        state = case when state = 'paused' and paused_reason = 'Reached the spending limit for this check.' then 'running' else state end,
        paused_reason = case when state = 'paused' and paused_reason = 'Reached the spending limit for this check.' then null else paused_reason end
    where id = r.id returning * into r;
  else
    update keeper_runs set total = n where id = r.id returning * into r;
  end if;
  return r;
end;
$$;

revoke all on function start_ready_run(uuid, uuid[], text, numeric, boolean) from public, anon;
grant execute on function start_ready_run(uuid, uuid[], text, numeric, boolean) to authenticated;

-- 3. Writing her draft -----------------------------------------------------------------------------------------------

-- Empty, as a draft field: missing, null, blank text, an empty list or an empty object.
create or replace function draft_empty(v jsonb)
returns boolean
language sql
immutable
as $$
  select v is null or v = 'null'::jsonb
    or (jsonb_typeof(v) = 'string' and btrim(v #>> '{}') = '')
    or (jsonb_typeof(v) = 'array' and jsonb_array_length(v) = 0)
    or (jsonb_typeof(v) = 'object' and v = '{}'::jsonb);
$$;

-- A draft measure as a number, or 0 when it is not one: a parcel field can hold text typed by hand.
create or replace function draft_num(v jsonb)
returns numeric
language sql
immutable
as $$
  select case when jsonb_typeof(v) = 'number' then (v #>> '{}')::numeric
    when jsonb_typeof(v) = 'string' and (v #>> '{}') ~ '^\s*\d+(\.\d+)?\s*$' then btrim(v #>> '{}')::numeric
    else 0 end;
$$;

/*
 * The only way Keeper writes a card it is getting ready. Read at the moment of writing, so a field she filled while
 * Keeper worked is kept:
 *   most fields          only while still empty;
 *   images               only adds after the photos she has (the patch must start with them), up to 12;
 *   photos_offered       added to, never taken from (a photo she took out stays out);
 *   aspects              each item detail only where she has none;
 *   package              each measure only where her parcel has none; a size of hers stays whole;
 *   supplier_text        only into an empty box, or one still holding exactly what the last reading put there;
 *   keeper_ready         Keeper's own note of what it did, always written.
 * Not written at all once the card is no longer approved, or is live on eBay. Returns what was written.
 */
create or replace function keeper_ready_fill(p_candidate uuid, p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c candidates;
  d jsonb;
  k text;
  v jsonb;
  have jsonb;
  applied text[] := '{}';
  merged jsonb;
  sub text;
  size_hers boolean;
begin
  select * into c from candidates where id = p_candidate for update;
  if not found then return jsonb_build_object('status', 'gone'); end if;
  if not exists (select 1 from decisions where candidate_id = c.id and action = 'approve') then return jsonb_build_object('status', 'decided'); end if;
  if c.ebay ->> 'listing_id' is not null then return jsonb_build_object('status', 'live'); end if;

  d := coalesce(c.draft, '{}'::jsonb);
  for k, v in select key, value from jsonb_each(coalesce(p_patch, '{}'::jsonb)) loop
    have := d -> k;
    if k = 'keeper_ready' then
      d := jsonb_set(d, array[k], v);
    elsif k = 'images' then
      -- Only more photos after hers, never a different set.
      if jsonb_typeof(v) = 'array' and jsonb_array_length(v) <= 12
        and (draft_empty(have) or (jsonb_typeof(have) = 'array' and jsonb_array_length(v) > jsonb_array_length(have)
          and (select bool_and(v -> (o - 1)::int = e) from jsonb_array_elements(have) with ordinality as h(e, o)))) then
        d := jsonb_set(d, array[k], v);
        applied := applied || k;
      end if;
    elsif k = 'photos_offered' then
      d := jsonb_set(d, array[k], coalesce((
        select jsonb_agg(distinct e) from (
          select jsonb_array_elements(case when jsonb_typeof(have) = 'array' then have else '[]'::jsonb end) e
          union select jsonb_array_elements(case when jsonb_typeof(v) = 'array' then v else '[]'::jsonb end)
        ) u), '[]'::jsonb));
    elsif k = 'aspects' then
      merged := case when jsonb_typeof(have) = 'object' then have else '{}'::jsonb end;
      for sub in select jsonb_object_keys(v) loop
        if draft_empty(merged -> sub) and not draft_empty(v -> sub) then
          merged := jsonb_set(merged, array[sub], v -> sub);
          applied := applied || ('aspects.' || sub);
        end if;
      end loop;
      d := jsonb_set(d, array[k], merged);
    elsif k = 'package' then
      merged := case when jsonb_typeof(have) = 'object' then have else '{}'::jsonb end;
      size_hers := draft_num(merged -> 'length_cm') > 0 or draft_num(merged -> 'width_cm') > 0 or draft_num(merged -> 'height_cm') > 0;
      for sub in select jsonb_object_keys(v) loop
        if sub in ('length_cm', 'width_cm', 'height_cm') and size_hers then continue; end if;
        if draft_num(merged -> sub) <= 0 and not draft_empty(v -> sub) then
          merged := jsonb_set(merged, array[sub], v -> sub);
          applied := applied || ('package.' || sub);
        end if;
      end loop;
      d := jsonb_set(d, array[k], merged);
    elsif k in ('supplier_auto', 'supplier_url') then
      -- Written with supplier_text below, or where empty.
      if k = 'supplier_url' and draft_empty(have) then d := jsonb_set(d, array[k], v); applied := applied || k; end if;
    elsif k = 'supplier_text' then
      if draft_empty(have) or have = d -> 'supplier_auto' then
        if have is distinct from v then
          d := jsonb_set(d, '{supplier_text}', v);
          d := jsonb_set(d, '{supplier_auto}', v);
          applied := applied || k;
        end if;
      end if;
    elsif draft_empty(have) and not draft_empty(v) then
      d := jsonb_set(d, array[k], v);
      applied := applied || k;
    end if;
  end loop;

  if d is distinct from coalesce(c.draft, '{}'::jsonb) then
    update candidates set draft = d where id = c.id;
  end if;
  return jsonb_build_object('status', 'ok', 'applied', to_jsonb(applied), 'draft', d);
end;
$$;

revoke all on function keeper_ready_fill(uuid, jsonb) from public, anon, authenticated;
grant execute on function keeper_ready_fill(uuid, jsonb) to service_role;
