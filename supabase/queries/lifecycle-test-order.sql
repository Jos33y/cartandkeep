-- A fixture order, so the three emails can be proven before Stripe exists.
--
-- The buying path splits into two halves that fail independently: the checkout
-- and the webhook, which need a Stripe key, and the notify function and Resend,
-- which do not. This makes an order row directly so the second half can be run
-- today rather than waiting on the first.
--
-- Written as `paid`, because that is the state notify's templates are for and
-- it is what puts the row into the sending pile on the Orders screen. Nothing
-- here touches Stripe, so no money moves and no session exists.
--
-- Run block one, do the test, then run block two. Both are in this file so the
-- cleanup is not something to remember later.
--
-- Every column named below appears in the checkout function's own insert, so
-- the shape is taken from deployed code rather than from a schema read.

-- ============================================================================
-- BLOCK ONE, make it
-- ============================================================================
-- Replace the email address before running. It is who the confirmation and the
-- dispatch email go to, so it has to be an inbox you can open.

with tenant as (
  select id from tenants where slug = 'cart-and-keep'
),
picked as (
  -- One product per confirmed returns class, so the paragraphs that vary by
  -- class get exercised rather than three ordinary items proving one branch.
  -- Today this will probably return a single standard row, because the
  -- enrichment only ever wrote its guesses into derived_fields and the real
  -- column still sits at its default. That is the honest state and it is worth
  -- seeing rather than staging around.
  select distinct on (p.returns_class)
    p.id, p.slug, p.title, p.image_url, p.price, p.returns_class
  from store_products p, tenant
  where p.tenant_id = tenant.id
    and p.price > 0
  order by p.returns_class, p.title
),
totals as (
  select sum(price)::numeric(10, 2) as subtotal from picked
),
made as (
  insert into orders (
    tenant_id, reference, access_token, email, name, address,
    subtotal, delivery, total, currency,
    delivery_zone, delivery_surcharge, status, paid_at
  )
  select
    tenant.id,
    -- Named so nobody mistakes it for a sale, and timestamped so running this
    -- twice does not collide on the reference.
    'CK-TEST-' || to_char(now(), 'HH24MISS'),
    -- Two uuids with the dashes taken out, rather than gen_random_bytes, so
    -- this does not depend on pgcrypto being in the search path.
    replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
    'REPLACE_WITH_YOUR_INBOX',
    'Lifecycle Test',
    jsonb_build_object(
      'line1', '14 Wilmslow Road',
      'city', 'Manchester',
      'postcode', 'M14 5TQ'
    ),
    totals.subtotal,
    3.95,
    totals.subtotal + 3.95,
    'GBP',
    'mainland',
    0,
    'paid',
    now()
  from tenant, totals
  returning id, reference
)
insert into order_items (
  order_id, product_id, slug, title, image_url, unit_price, qty, line_total
)
select
  made.id, picked.id, picked.slug, picked.title, picked.image_url,
  picked.price, 1, picked.price
from made, picked
returning order_id;

-- ============================================================================
-- BLOCK TWO, take it back out
-- ============================================================================
-- Run this once the emails have arrived. order_items and order_emails both
-- cascade from orders, so the one delete clears all three tables. Checked
-- against a real Postgres rather than assumed.

delete from orders where reference like 'CK-TEST-%';
