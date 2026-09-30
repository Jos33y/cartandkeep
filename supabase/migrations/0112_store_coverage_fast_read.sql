-- Coverage for Google best sellers timed out: the read policy called has_tenant() once per row, and a security
-- definer function cannot be folded into the query, so one summary of 50,000 products ran two lookups per product.
-- The tenants she may read are now worked out once per query and each row is a lookup in that short list.
-- Same rule as before: a platform admin reads every tenant, anyone else reads only the tenants they belong to.

drop policy if exists store_coverage_read on public.store_coverage;

create policy store_coverage_read on public.store_coverage
  for select to authenticated using (
    (select public.is_platform_admin())
    or tenant_id in (select m.tenant_id from public.memberships m where m.user_id = (select auth.uid()))
  );
