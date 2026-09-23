-- Scoping the shop tables by tenant.
--
-- I wrote `using (true)` into the orders and order_emails policies in 0042 and
-- 0043, with a comment saying no membership mechanism existed in migrations
-- 0029 to 0041. It does exist. `memberships`, `platform_admins`,
-- `is_platform_admin()` and `has_tenant()` are all in 0001, every table in that
-- file is scoped with them, and `PortalProtected` has been calling two of them
-- since before the storefront was built. I looked in the wrong range, asked
-- once, did not get an answer, and shipped anyway. This corrects it.
--
-- `has_tenant()` returns true for a platform admin or for a member of that
-- tenant, so studio access is unchanged and nothing in the portal behaves
-- differently at one client. What changes is that at client two, one client's
-- staff cannot read another client's customer names and addresses.

-- --- Mine to correct ---------------------------------------------------------

drop policy if exists orders_portal_read on orders;
create policy orders_portal_read on orders
  for select to authenticated
  using (has_tenant(tenant_id));

drop policy if exists orders_portal_dispatch on orders;
create policy orders_portal_dispatch on orders
  for update to authenticated
  using (has_tenant(tenant_id)) with check (has_tenant(tenant_id));

-- order_items carries no tenant_id, deliberately: it hangs off the order and
-- duplicating the tenant onto every line is a second copy that can disagree
-- with the first. So the predicate reaches through the order.
drop policy if exists order_items_portal_read on order_items;
create policy order_items_portal_read on order_items
  for select to authenticated
  using (exists (
    select 1 from orders o
    where o.id = order_items.order_id and has_tenant(o.tenant_id)
  ));

drop policy if exists order_emails_portal_read on order_emails;
create policy order_emails_portal_read on order_emails
  for select to authenticated
  using (has_tenant(tenant_id));

-- --- Not mine, same fault ----------------------------------------------------
--
-- Found while correcting the above and worth doing in the same pass, because
-- two of the three shop tables scoped properly and one left open is the same
-- exposure with more steps. Named rather than quietly changed.
--
-- store_products in 0034 and store_events in 0039 both carry
-- `to authenticated using (true)`. The anonymous read policy on store_products
-- is the one that actually guards the shop and it is correct and untouched:
-- `status = 'live' and is_sample = false`.

drop policy if exists store_products_authenticated_all on store_products;
create policy store_products_authenticated_all on store_products
  for all to authenticated
  using (has_tenant(tenant_id)) with check (has_tenant(tenant_id));

drop policy if exists store_events_read on store_events;
create policy store_events_read on store_events
  for select to authenticated
  using (has_tenant(tenant_id));

/*
 * The anonymous insert on store_events stays as it is, on purpose.
 *
 * It accepts any tenant_id and the id is visible in the network tab, which is
 * known and recorded in the scaling document. `has_tenant()` cannot fix it,
 * because the writer is a shopper with no session and no membership. The fix is
 * routing events through an edge function that reads the tenant from the Origin
 * header, which is a different piece of work and not this one.
 */
