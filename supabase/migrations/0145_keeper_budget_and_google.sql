-- 0145_keeper_budget_and_google.sql
-- Two things, 7 October 2026.
--
-- 1. A monthly budget for Keeper (Joseey: "we can't just be burning tokens"). Every run already has its own spending
--    limit; this is the ceiling over all of them in a calendar month, UK time. Over it, a run pauses with the reason,
--    before it spends more. The budget is the shop's setting tenants.store.keeper.monthly_cap_pence, £20 when unset.
--
-- 2. A product's Google category from Keeper's shop check. A card added to the shop from Approved carries no eBay 
--    category path, so it landed on the stand-in Home & Garden (source 'default') and no section could take it: 199
--    of them on 6 October. The shop check now reads the category from the product and it is saved as 'ai', only over
--    the stand-in. The trigger from 0129 then places the product in its section as the row is saved.

-- What Keeper has spent this calendar month, UK time, in pence: every run started this month.
create or replace function keeper_month_spent(p_tenant uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(r.spent_pence), 0)
  from keeper_runs r
  where r.tenant_id = p_tenant
    and r.created_at >= (date_trunc('month', now() at time zone 'Europe/London') at time zone 'Europe/London');
$$;

-- The shop's monthly budget in pence: its own setting, else £20.
create or replace function keeper_month_cap(p_tenant uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select case when (t.store #>> '{keeper,monthly_cap_pence}') ~ '^\d+(\.\d+)?$'
                 then (t.store #>> '{keeper,monthly_cap_pence}')::numeric end
     from tenants t where t.id = p_tenant),
    2000);
$$;

-- Null while there is budget left; otherwise the sentence the run pauses with.
create or replace function keeper_over_budget(p_tenant uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  spent numeric := keeper_month_spent(p_tenant);
  cap numeric := keeper_month_cap(p_tenant);
begin
  if spent < cap then return null; end if;
  return format(
    'Paused: this month''s Keeper budget of £%s is used (£%s spent). Nothing was lost: the cards not done wait in the queue. Raise the budget to carry on now, or carry on from the 1st.',
    to_char(cap / 100, 'FM999990.00'), to_char(spent / 100, 'FM999990.00'));
end;
$$;

revoke all on function keeper_month_spent(uuid) from public, anon, authenticated;
revoke all on function keeper_month_cap(uuid) from public, anon, authenticated;
revoke all on function keeper_over_budget(uuid) from public, anon, authenticated;
grant execute on function keeper_month_spent(uuid) to service_role;
grant execute on function keeper_month_cap(uuid) to service_role;
grant execute on function keeper_over_budget(uuid) to service_role;

-- As 0123, and once the run's own spend is added, the month is checked too: crossing the budget pauses the run.
create or replace function add_keeper_spend(p_run uuid, p_pence numeric)
returns keeper_runs
language plpgsql
security definer
set search_path = public
as $$
declare
  r keeper_runs;
  why text;
begin
  update keeper_runs
  set spent_pence = spent_pence + greatest(coalesce(p_pence, 0), 0),
      state = case when state = 'running' and spent_pence + greatest(coalesce(p_pence, 0), 0) >= cap_pence then 'paused' else state end,
      paused_reason = case when state = 'running' and spent_pence + greatest(coalesce(p_pence, 0), 0) >= cap_pence
        then 'Reached the spending limit for this check.' else paused_reason end
  where id = p_run
  returning * into r;
  if r.id is null or r.state <> 'running' then return r; end if;

  why := keeper_over_budget(r.tenant_id);
  if why is not null then
    update keeper_runs set state = 'paused', paused_reason = why where id = p_run and state = 'running'
    returning * into r;
  end if;
  return r;
end;
$$;

revoke all on function add_keeper_spend(uuid, numeric) from public, anon, authenticated;
grant execute on function add_keeper_spend(uuid, numeric) to service_role;

-- The category Keeper read, as Google writes it ("Health & Beauty > Health Care > ..."), saved over the stand-in only.
-- The deepest level of the path that exists is used, two levels at least: a top level alone places nothing. Returns
-- the category saved, or null when nothing was saved.
create or replace function set_product_google_ai(p_id uuid, p_path text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  parts text[];
  hit integer;
  i integer;
begin
  if nullif(btrim(coalesce(p_path, '')), '') is null then return null; end if;
  parts := regexp_split_to_array(btrim(p_path), '\s*>\s*');
  if cardinality(parts) < 2 then return null; end if;
  for i in reverse cardinality(parts)..2 loop
    hit := google_id_of(array_to_string(parts[1:i], ' > '));
    exit when hit is not null;
  end loop;
  if hit is null then return null; end if;

  update store_products
  set google_category_id = hit, google_category_source = 'ai'
  where id = p_id and coalesce(google_category_source, 'default') = 'default';
  if not found then return null; end if;
  return hit;
end;
$$;

revoke all on function set_product_google_ai(uuid, text) from public, anon, authenticated;
grant execute on function set_product_google_ai(uuid, text) to service_role;
