-- Portal access to orders.
--
-- 0037 enabled RLS on both tables and created no policies, because the only
-- reader was a customer arriving through a service-role function. The portal is
-- the second reader and it is a browser holding an authenticated session, so it
-- needs a way in that does not involve giving the front end a service role.
--
-- Checked before writing this rather than assumed: `anon` and `authenticated`
-- both hold table level SELECT and UPDATE on every column of both tables,
-- `access_token` included. RLS with no policies is the only thing stopping an
-- anonymous read today, which is one accidental permissive policy away from
-- publishing every delivery address in the database. So the grants are
-- corrected here rather than left for RLS to carry on its own. Nothing in
-- either front end queries these tables directly, so anon loses nothing that
-- works: the customer order page goes through the `order` function.

-- --- Grants -------------------------------------------------------------------

revoke all on orders from anon, authenticated;
revoke all on order_items from anon, authenticated;

-- `access_token` is deliberately absent.
--
-- It is the only thing between a guessed reference and somebody else's
-- delivery address, and a portal session has no use for it. Left out of the
-- grant rather than out of the query, because a query is a decision somebody
-- can change later and a grant is not. A query naming it now fails outright,
-- which is the behaviour I want.
grant select (
  id, tenant_id, reference, status,
  email, name, phone, address,
  subtotal, delivery, total, currency,
  delivery_zone, delivery_surcharge,
  stripe_session_id, stripe_payment_intent,
  customer_note, internal_note, session_id,
  paid_at, dispatched_at, carrier, tracking_number, tracking_url,
  created_at, updated_at
) on orders to authenticated;

grant select on order_items to authenticated;

-- The only four columns the portal writes.
--
-- She marks a parcel gone and records how it went. She does not set a total, a
-- status or a paid date, and after this she cannot, because the privilege does
-- not exist. A mistake in the front end fails at the database rather than
-- rewriting an invoice. 0037 said an invoice that changes when a price is
-- edited is not an invoice, and this is that promise held in the schema instead
-- of in a component.
--
-- `status` stays out on purpose: money moves in Stripe and the webhook records
-- it, so a refund is not something a button in the portal performs.
-- `internal_note` stays out until there is a screen that writes one.
grant update (dispatched_at, carrier, tracking_number, tracking_url)
  on orders to authenticated;

-- --- Policies -----------------------------------------------------------------

-- Same shape as store_products and store_events: authenticated means studio or
-- client staff, and the tenant is filtered in the query.
--
-- This is looser than it should be and it is worth naming rather than burying.
-- Scoping the tenant inside the policy needs a membership mechanism tying an
-- auth user to a tenant, and there is none in migrations 0029 to 0041. At one
-- client the exposure is nil: one tenant, two people who can sign in. At client
-- two it is a cross-client read of customer names and addresses, so it is fixed
-- before the second tenant rather than after.
drop policy if exists orders_portal_read on orders;
create policy orders_portal_read on orders
  for select to authenticated
  using (true);

-- `using` as well as `with check`. A row the policy cannot see cannot be
-- updated whatever the column grants say, so an update policy with only a check
-- clause matches nothing and the button does nothing.
drop policy if exists orders_portal_dispatch on orders;
create policy orders_portal_dispatch on orders
  for update to authenticated
  using (true) with check (true);

drop policy if exists order_items_portal_read on order_items;
create policy order_items_portal_read on order_items
  for select to authenticated
  using (true);

comment on table orders is
  'Created by the checkout function and updated by the Stripe webhook, both service role. Read by the portal under an authenticated session, which can write the four dispatch columns and nothing else.';
