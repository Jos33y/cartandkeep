-- 0137_keeper_sources_whoever_sends.sql
-- Sourced on Amazon means the right product is on Amazon (Joseey, 3 October: "sourced on amazon whether amazon sends
-- it or not will be determined when we get to approved"). Keeper's approval now saves the supplier whoever sells it:
--   status 'quoted' with today's price, or 'unavailable' with no cost when Amazon shows no price (no buy box, out of
--   stock), so nothing is priced from a guess;
--   another seller's delivery charge to her as the freight on her route, so the landed cost counts it;
--   who sells and sends it, the stock and its wording in the supplier row's raw, for Approved.
-- The same function as 0136 otherwise: the card filled where empty, Undo takes back only Keeper's.

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
    unit_cost, price_at_moq, moq, fulfilment, matched_on, confirmed, confirmed_at, status, quoted_on, cost_by, note, raw,
    inbound_freight_per_unit
  ) values (
    c.tenant_id, c.id, 'Amazon', 'unknown', p_source ->> 'asin', p_source ->> 'title', p_source ->> 'url', p_source ->> 'image_url',
    (p_source ->> 'cost')::numeric, (p_source ->> 'cost')::numeric, 1, 'stock', 'keeper_barcode', true, now(),
    coalesce(p_source ->> 'status', 'quoted'),
    current_date, 'amazon', p_source ->> 'note', coalesce(p_source -> 'raw', '{}'::jsonb),
    nullif(p_source ->> 'delivery', '')::numeric
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
