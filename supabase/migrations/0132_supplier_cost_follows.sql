-- Her supplier's cost follows Amazon's price (keepr-agent-04, Part 14, as changed on 3 October).
--
-- The daily Amazon read only warned: "Costs £17.98 today. You costed it at £15.28." The card had no way to take the
-- new price, and no way to change a supplier's cost at all after it was added. Now:
--   a cost that came from Amazon moves with Amazon's price in the read (supplier-read, costFollow), the price after a
--   deal never the deal price, and the shop product's cost follows where it came from the supplier;
--   a cost she sets herself is marked hers and never moved: she is told, and offered Amazon's price.
-- cost_by says which: 'amazon', 'her', or null (as before this; read as Amazon's when it matches a price Amazon showed).

alter table candidate_sources add column if not exists cost_by text;
alter table candidate_sources drop constraint if exists candidate_sources_cost_by_check;
alter table candidate_sources add constraint candidate_sources_cost_by_check check (cost_by is null or cost_by in ('amazon', 'her'));

comment on column candidate_sources.cost_by is
  'Who set unit_cost: amazon (follows the daily read), her (never moved by a read), or null (set before 3 October).';

-- She changes a supplier's cost from the card. Only her own shop's rows, as with adding one.
grant update on candidate_sources to authenticated;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'candidate_sources' and cmd in ('UPDATE', 'ALL') and 'authenticated' = any (roles)
  ) then
    create policy candidate_sources_update on candidate_sources
      for update to authenticated
      using (has_tenant(tenant_id))
      with check (has_tenant(tenant_id));
  end if;
end;
$$;
