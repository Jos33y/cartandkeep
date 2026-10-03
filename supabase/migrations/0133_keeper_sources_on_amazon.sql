-- 0133_keeper_sources_on_amazon.sql
-- Keeper task 02, pass 1 (keeper-task-02-amazon-sourcing.md): Keeper finds a candidate on Amazon UK by its barcode,
-- and approves it when the Amazon page carries the same barcode, the same pack, is in stock and sent by Amazon.
--
--   1. Who decided: every decision says whether she made it, Keeper made it, or the studio did (a script, or a
--      studio account). Its history says so too. Keeper's approvals can be listed and undone.
--   2. A run can work on candidates as well as shop products: keeper_jobs gains candidate_id, and the task
--      'amazon_source' joins 'shop_check'.
--   3. The candidate's barcode, as gtinOf reads it (src/lib/golive.js), with one difference: a UPC stored as a number
--      lost its leading zeros (10279904244); padded back to 12 digits it is the real barcode, so it counts.
--   4. Starting a sourcing run, counting what it would take, approving (service only) and undoing (hers).
--
-- Nothing here touches a card she has decided: a decision already on the card stops Keeper's approval.

-- 1. Who decided --------------------------------------------------------------------------------------------------

alter table decisions add column if not exists made_by text;
alter table decisions drop constraint if exists decisions_made_by_check;
alter table decisions add constraint decisions_made_by_check check (made_by is null or made_by in ('her', 'keeper', 'studio'));
comment on column decisions.made_by is
  'her (signed in to her portal), keeper (task 02, through keeper_source_approve), studio (a script, or a studio account). '
  'Null on decisions made before 3 October 2026.';

-- Who is deciding now. Keeper says so for its own write only (set_config, local to the transaction).
create or replace function decider_now()
returns text
language sql
stable
set search_path = public
as $$
  select case
    when current_setting('ck.decided_by', true) = 'keeper' then 'keeper'
    when auth.uid() is null or is_platform_admin() then 'studio'
    else 'her'
  end;
$$;

-- Set on every insert and change, so a portal upsert that turns Keeper's approval into her reject becomes hers.
create or replace function stamp_decision_maker()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.made_by := decider_now();
  return new;
end;
$$;

drop trigger if exists decisions_made_by on decisions;
create trigger decisions_made_by
  before insert or update on decisions
  for each row execute function stamp_decision_maker();

alter table decision_events add column if not exists made_by text;
comment on column decision_events.made_by is 'Who made this change: her, keeper or studio. Null before 3 October 2026.';

-- As 0013, with who made the change.
create or replace function log_decision_event()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  c record;
  target uuid;
begin
  target := coalesce(new.candidate_id, old.candidate_id);
  select title, external_ref into c from candidates where id = target;

  insert into decision_events (
    tenant_id, candidate_id, candidate_title, external_ref,
    from_action, to_action, from_reason, to_reason, note, actor, made_by
  ) values (
    coalesce(new.tenant_id, old.tenant_id),
    target,
    c.title,
    c.external_ref,
    case when tg_op in ('UPDATE', 'DELETE') then old.action end,
    case when tg_op = 'DELETE' then null else new.action end,
    case when tg_op in ('UPDATE', 'DELETE') then old.reason end,
    case when tg_op = 'DELETE' then null else new.reason end,
    case when tg_op = 'DELETE' then old.note else new.note end,
    auth.uid(),
    decider_now()
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

-- 2. Runs over candidates -----------------------------------------------------------------------------------------

alter table keeper_jobs add column if not exists candidate_id uuid references candidates (id) on delete cascade;
alter table keeper_jobs alter column product_id drop not null;
alter table keeper_jobs drop constraint if exists keeper_jobs_kind_check;
alter table keeper_jobs add constraint keeper_jobs_kind_check check (kind in ('fill', 'shop_check', 'amazon_source'));
alter table keeper_jobs drop constraint if exists keeper_jobs_subject_check;
alter table keeper_jobs add constraint keeper_jobs_subject_check check (
  (kind = 'amazon_source' and candidate_id is not null and product_id is null)
  or (kind <> 'amazon_source' and product_id is not null)
);

-- One open job per candidate per kind, as for products.
create unique index if not exists keeper_jobs_one_open_candidate on keeper_jobs (candidate_id, kind)
  where candidate_id is not null and state in ('queued', 'working');
create index if not exists keeper_jobs_candidate on keeper_jobs (candidate_id, kind) where candidate_id is not null;

alter table keeper_runs drop constraint if exists keeper_runs_task_check;
alter table keeper_runs add constraint keeper_runs_task_check check (task in ('shop_check', 'amazon_source'));

-- 3. The barcode --------------------------------------------------------------------------------------------------

-- A barcode as Keeper searches it: 8, 12, 13 or 14 digits with a correct check digit. A value of 8 to 11 digits that
-- is not valid as it stands is tried again padded to 12, which recovers a UPC that lost its leading zeros.
create or replace function keeper_gtin(p_value text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  s text := regexp_replace(coalesce(p_value, ''), '\s', '', 'g');
  tries text[];
  t text;
  total integer;
  i integer;
begin
  if s !~ '^\d{8,14}$' then return null; end if;
  tries := array[s];
  if length(s) between 8 and 11 then tries := tries || lpad(s, 12, '0'); end if;
  foreach t in array tries loop
    if length(t) in (8, 12, 13, 14) then
      total := 0;
      for i in 1 .. length(t) - 1 loop
        total := total + substr(t, i, 1)::int * case when (length(t) - i) % 2 = 1 then 3 else 1 end;
      end loop;
      if (10 - total % 10) % 10 = right(t, 1)::int then return t; end if;
    end if;
  end loop;
  return null;
end;
$$;

-- The candidate's barcode: the first good one, in gtinOf's order.
create or replace function candidate_gtin(p_margin jsonb, p_listing jsonb)
returns text
language sql
immutable
set search_path = public
as $$
  select coalesce(
    keeper_gtin(p_margin #>> '{shelf,gtin}'),
    keeper_gtin(p_margin #>> '{cost_from,gtin}'),
    keeper_gtin(p_margin ->> 'gtin'),
    keeper_gtin(p_listing ->> 'gtin'),
    keeper_gtin(p_listing ->> 'ean')
  );
$$;

-- 4. Starting, counting, approving, undoing ------------------------------------------------------------------------

-- The candidates a sourcing run takes: on her Candidates page (a delivered batch, not retired), undecided, with a
-- barcode, and not already looked up by Keeper. A lookup that could not be read is tried again.
create or replace function amazon_source_pool(p_tenant uuid)
returns table (id uuid, gtin text, monthly_headroom numeric, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, candidate_gtin(c.margin, c.listing), c.monthly_headroom, c.created_at
  from candidates c
  join batches b on b.id = c.batch_id and b.status = 'delivered' and b.retired_at is null
  where c.tenant_id = p_tenant
    and not exists (select 1 from decisions d where d.candidate_id = c.id)
    and candidate_gtin(c.margin, c.listing) is not null
    and not exists (
      select 1 from keeper_jobs j
      where j.candidate_id = c.id and j.kind = 'amazon_source' and j.state in ('queued', 'working', 'done')
    );
$$;

revoke all on function amazon_source_pool(uuid) from public, anon, authenticated;

create or replace function amazon_source_waiting(p_tenant uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not has_tenant(p_tenant) then raise exception 'Not your shop.' using errcode = '42501'; end if;
  return (select count(*)::int from amazon_source_pool(p_tenant));
end;
$$;

revoke all on function amazon_source_waiting(uuid) from public, anon;
grant execute on function amazon_source_waiting(uuid) to authenticated;

-- Starts a sourcing run on the best p_limit candidates (by what they would make a month), or all of them.
create or replace function start_amazon_run(p_tenant uuid, p_cap_pence numeric, p_limit integer default null, p_pace text default 'watch')
returns keeper_runs
language plpgsql
security definer
set search_path = public
as $$
declare
  r keeper_runs;
  n integer;
begin
  if not has_tenant(p_tenant) then raise exception 'Not your shop.' using errcode = '42501'; end if;
  if coalesce(p_pace, 'watch') not in ('watch', 'normal') then raise exception 'Unknown pace %.', p_pace; end if;
  if exists (select 1 from keeper_runs where tenant_id = p_tenant and task = 'amazon_source' and state in ('running', 'paused')) then
    raise exception 'A look on Amazon is already going. Open it to carry on or stop it.' using errcode = '23505';
  end if;

  insert into keeper_runs (tenant_id, task, pace, cap_pence, rehearsal)
  values (p_tenant, 'amazon_source', coalesce(p_pace, 'watch'), p_cap_pence, false)
  returning * into r;

  insert into keeper_jobs (tenant_id, candidate_id, kind, run_id)
  select p_tenant, x.id, 'amazon_source', r.id
  from amazon_source_pool(p_tenant) x
  order by x.monthly_headroom desc nulls last, x.created_at, x.id
  limit coalesce(p_limit, 100000);

  get diagnostics n = row_count;
  if n = 0 then raise exception 'Every candidate with a barcode has been looked up already.' using errcode = 'P0002'; end if;

  update keeper_runs set total = n where id = r.id returning * into r;
  return r;
end;
$$;

revoke all on function start_amazon_run(uuid, numeric, integer, text) from public, anon;
grant execute on function start_amazon_run(uuid, numeric, integer, text) to authenticated;

/*
 * Keeper's approval, the only way task 02 writes a card. Service only (keeper-run). In one transaction:
 *   her supplier: Amazon, the product link, sent by her (stock), confirmed, cost_by 'amazon' so the 7am read
 *     follows its price. A row she already has for the same page is kept as it is;
 *   the reading on the card, so the Amazon panel and the daily check start at once;
 *   the approval, marked as Keeper's, with its one line of reason.
 * A card with any decision on it is left alone and 'decided' comes back.
 */
create or replace function keeper_source_approve(p_candidate uuid, p_source jsonb, p_read jsonb, p_note text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c candidates;
  sid uuid;
  n integer;
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

  update candidates set supplier_read = coalesce(p_read, '{}'::jsonb) || jsonb_build_object('source_id', sid)
  where id = c.id;

  perform set_config('ck.decided_by', 'keeper', true);
  insert into decisions (tenant_id, candidate_id, action, note)
  values (c.tenant_id, c.id, 'approve', left(p_note, 500))
  on conflict (candidate_id) do nothing;
  get diagnostics n = row_count;
  perform set_config('ck.decided_by', '', true);
  if n = 0 then return jsonb_build_object('status', 'decided', 'source_id', sid); end if;

  return jsonb_build_object('status', 'approved', 'source_id', sid);
end;
$$;

revoke all on function keeper_source_approve(uuid, jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function keeper_source_approve(uuid, jsonb, jsonb, text) to service_role;

/*
 * Undo one of Keeper's approvals: the approval goes, the Amazon supplier Keeper added goes (unless she has set its
 * cost herself since), and the reading goes with it. The card is back in Candidates, undecided, and is not looked up
 * again by the next run. Refused once she has changed the decision, or once the card is on its way to eBay or the shop.
 */
create or replace function keeper_source_undo(p_candidate uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  d decisions;
  asins text[];
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

  delete from decisions where candidate_id = p_candidate;

  update keeper_jobs set result = coalesce(result, '{}'::jsonb) || jsonb_build_object('undone', true, 'undone_at', now())
  where candidate_id = p_candidate and kind = 'amazon_source' and state = 'done';

  return 'undone';
end;
$$;

revoke all on function keeper_source_undo(uuid) from public, anon;
grant execute on function keeper_source_undo(uuid) to authenticated;

-- 5. One worker, two kinds of run ---------------------------------------------------------------------------------

-- As 0123, with runs to pass over: a sourcing run works one batch per call, so the same call can go on to a shop
-- check rather than take the sourcing run again.
drop function if exists lease_keeper_run(integer, uuid);
create or replace function lease_keeper_run(p_seconds integer, p_tenant uuid default null, p_skip uuid[] default null)
returns setof keeper_runs
language sql
security definer
set search_path = public
as $$
  update keeper_runs r
  set lease_until = now() + make_interval(secs => p_seconds)
  where r.id = (
    select k.id from keeper_runs k
    where k.state = 'running'
      and (k.lease_until is null or k.lease_until < now())
      and (p_tenant is null or k.tenant_id = p_tenant)
      and (p_skip is null or not (k.id = any (p_skip)))
    order by k.created_at
    limit 1
    for update skip locked
  )
  returning r.*;
$$;

revoke all on function lease_keeper_run(integer, uuid, uuid[]) from public, anon, authenticated;
grant execute on function lease_keeper_run(integer, uuid, uuid[]) to service_role;
