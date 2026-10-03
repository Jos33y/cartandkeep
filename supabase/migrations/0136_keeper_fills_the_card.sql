-- 0136_keeper_fills_the_card.sql
-- When Keeper approves a candidate from Amazon (keeper-task-02), the card is filled from the Amazon reading at once,
-- so it is not empty and Get it ready has less to do. Code only, no Claude:
--   Amazon's facts into her supplier box, the first source the writing trusts (as supplierPatch does on opening);
--   the supplier link as her chosen page;
--   Amazon's item weight, packed, as the parcel weight (as Get it ready does).
-- Only where empty: never over words she pasted or a weight she set. What Keeper filled is remembered
-- (draft.keeper_filled), so Undo takes back exactly that and nothing she changed since.

drop function if exists keeper_source_approve(uuid, jsonb, jsonb, text);

create or replace function keeper_source_approve(p_candidate uuid, p_source jsonb, p_read jsonb, p_note text, p_fill jsonb default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c candidates;
  sid uuid;
  n integer;
  d jsonb;
  filled jsonb := '{}'::jsonb;
  kg numeric;
begin
  select * into c from candidates where id = p_candidate for update;
  if not found then return jsonb_build_object('status', 'gone'); end if;
  if exists (select 1 from decisions where candidate_id = p_candidate) then return jsonb_build_object('status', 'decided'); end if;

  insert into candidate_sources (
    tenant_id, candidate_id, supplier, supplier_kind, external_ref, title, url, image_url,
    unit_cost, price_at_moq, moq, fulfilment, matched_on, confirmed, confirmed_at, status, quoted_on, cost_by, note, raw
  ) values (
    c.tenant_id, c.id, 'Amazon', 'unknown', p_source ->> 'asin', p_source ->> 'title', p_source ->> 'url', p_source ->> 'image_url',
    (p_source ->> 'cost')::numeric, (p_source ->> 'cost')::numeric, 1, 'stock', 'keeper_barcode', true, now(), 'quoted',
    current_date, 'amazon', p_source ->> 'note', coalesce(p_source -> 'raw', '{}'::jsonb)
  )
  on conflict (candidate_id, supplier, external_ref) do nothing
  returning id into sid;

  if sid is null then
    select id into sid from candidate_sources
    where candidate_id = c.id and supplier = 'Amazon' and external_ref = p_source ->> 'asin';
  end if;

  -- The card, filled from the reading where empty.
  d := coalesce(c.draft, '{}'::jsonb);
  if nullif(btrim(coalesce(p_fill ->> 'supplier_text', '')), '') is not null
     and nullif(btrim(coalesce(d ->> 'supplier_text', '')), '') is null then
    d := d || jsonb_build_object('supplier_text', p_fill ->> 'supplier_text', 'supplier_auto', p_fill ->> 'supplier_text');
    filled := filled || jsonb_build_object('supplier_text', true);
  end if;
  if nullif(p_fill ->> 'supplier_url', '') is not null and nullif(d ->> 'supplier_url', '') is null then
    d := d || jsonb_build_object('supplier_url', p_fill ->> 'supplier_url');
    filled := filled || jsonb_build_object('supplier_url', p_fill ->> 'supplier_url');
  end if;
  kg := nullif(p_fill ->> 'weight_kg', '')::numeric;
  if kg > 0 and coalesce(nullif(d #>> '{package,weight_kg}', '')::numeric, 0) <= 0 then
    d := d || jsonb_build_object('package', coalesce(d -> 'package', '{}'::jsonb) || jsonb_build_object('weight_kg', kg));
    filled := filled || jsonb_build_object('weight_kg', kg);
  end if;
  if filled <> '{}'::jsonb then d := d || jsonb_build_object('keeper_filled', filled); end if;

  update candidates
  set supplier_read = coalesce(p_read, '{}'::jsonb) || jsonb_build_object('source_id', sid),
      draft = case when filled <> '{}'::jsonb then d else draft end
  where id = c.id;

  perform set_config('ck.decided_by', 'keeper', true);
  insert into decisions (tenant_id, candidate_id, action, note)
  values (c.tenant_id, c.id, 'approve', left(p_note, 500))
  on conflict (candidate_id) do nothing;
  get diagnostics n = row_count;
  perform set_config('ck.decided_by', '', true);
  if n = 0 then return jsonb_build_object('status', 'decided', 'source_id', sid); end if;

  return jsonb_build_object('status', 'approved', 'source_id', sid, 'filled', filled);
end;
$$;

revoke all on function keeper_source_approve(uuid, jsonb, jsonb, text, jsonb) from public, anon, authenticated;
grant execute on function keeper_source_approve(uuid, jsonb, jsonb, text, jsonb) to service_role;

-- Undo, as 0133, now also taking back what Keeper filled on the card, where it is still as Keeper left it.
create or replace function keeper_source_undo(p_candidate uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  d decisions;
  asins text[];
  dr jsonb;
  f jsonb;
begin
  select * into d from decisions where candidate_id = p_candidate for update;
  if not found or not has_tenant(d.tenant_id) then raise exception 'Nothing to undo on this card.' using errcode = 'P0002'; end if;
  if d.made_by is distinct from 'keeper' or d.action <> 'approve' then
    raise exception 'This card has been decided since. Change it from the card instead.' using errcode = '42501';
  end if;
  if exists (select 1 from candidates where id = p_candidate and ebay is not null)
     or exists (select 1 from listing_jobs where candidate_id = p_candidate)
     or exists (select 1 from store_products where candidate_id = p_candidate) then
    raise exception 'This card is already on its way to eBay or your shop. Change it from Approved instead.' using errcode = '42501';
  end if;

  with gone as (
    delete from candidate_sources
    where candidate_id = p_candidate and matched_on = 'keeper_barcode' and coalesce(cost_by, '') <> 'her'
    returning external_ref
  )
  select array_agg(external_ref) into asins from gone;

  update candidates set supplier_read = null
  where id = p_candidate and supplier_read ->> 'asin' = any (coalesce(asins, '{}'))
    and not exists (select 1 from candidate_sources s where s.candidate_id = p_candidate and s.url ilike '%' || (supplier_read ->> 'asin') || '%');

  -- What Keeper filled, taken back only where it is still as Keeper left it.
  select draft into dr from candidates where id = p_candidate for update;
  f := dr -> 'keeper_filled';
  if f is not null then
    if (f ->> 'supplier_text')::boolean and dr ->> 'supplier_text' = dr ->> 'supplier_auto' then
      dr := dr - 'supplier_text' - 'supplier_auto';
    end if;
    if f ? 'supplier_url' and dr ->> 'supplier_url' = f ->> 'supplier_url' then
      dr := dr - 'supplier_url';
    end if;
    if f ? 'weight_kg' and (dr #>> '{package,weight_kg}')::numeric = (f ->> 'weight_kg')::numeric then
      dr := jsonb_set(dr, '{package}', (dr -> 'package') - 'weight_kg');
      if dr -> 'package' = '{}'::jsonb then dr := dr - 'package'; end if;
    end if;
    dr := dr - 'keeper_filled';
    update candidates set draft = case when dr = '{}'::jsonb then null else dr end where id = p_candidate;
  end if;

  delete from decisions where candidate_id = p_candidate;

  update keeper_jobs set result = coalesce(result, '{}'::jsonb) || jsonb_build_object('undone', true, 'undone_at', now())
  where candidate_id = p_candidate and kind = 'amazon_source' and state = 'done';

  return 'undone';
end;
$$;

revoke all on function keeper_source_undo(uuid) from public, anon;
grant execute on function keeper_source_undo(uuid) to authenticated;
