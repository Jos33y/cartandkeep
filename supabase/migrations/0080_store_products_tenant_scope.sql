-- store_products was open to every signed-in user of every tenant.
--
-- 0034 granted authenticated sessions `using (true)`, so a second client could
-- read and edit the first client's shop. Every other tenant table uses
-- has_tenant(); this one now does too. The anonymous read policy is unchanged.

drop policy if exists store_products_authenticated_all on store_products;

create policy store_products_tenant_rw on store_products
  for all to authenticated
  using (has_tenant(tenant_id))
  with check (has_tenant(tenant_id));
