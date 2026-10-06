-- 0143_supplier_remove.sql
-- She takes a supplier off a card from Where to buy it (Joseey, 6 October: a Christmas Stories Tonie carried a second
-- Amazon supplier, Sleepy Friends, that its barcode had found). Her own shop's rows only, as with adding or changing
-- one; the policy candidate_sources_rw (0021) already covers every command for her tenant, so only the grant is new.

grant delete on candidate_sources to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'candidate_sources' and cmd in ('DELETE', 'ALL') and 'authenticated' = any (roles)
  ) then
    create policy candidate_sources_delete on candidate_sources
      for delete to authenticated
      using (has_tenant(tenant_id));
  end if;
end;
$$;
