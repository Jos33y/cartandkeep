-- A sample review, so the section can be seen before anybody has bought
-- anything.
--
-- A review is keyed to an order line and there is no other way to make one, so
-- this makes the order line too. Both are named CK-SAMPLE and both come out
-- with block two, the same shape as the lifecycle test order.
--
-- Run block one, look at the product page, run block two. Nothing here is meant
-- to survive to launch: it is two customers who do not exist saying things they
-- did not say, on a shop that has not sold either of them anything.

-- ============================================================================
-- BLOCK ONE, make it
-- ============================================================================

with tenant as (
  select id from tenants where slug = 'cart-and-keep'
),
-- The first live product, because a review on a draft product is invisible to
-- exactly the page it was made to check.
target as (
  select p.id, p.title, p.price
  from store_products p, tenant
  where p.tenant_id = tenant.id
    and p.status = 'live'
    and p.is_sample = false
  order by p.title
  limit 1
),
made as (
  insert into orders (
    tenant_id, reference, access_token, email, name, address,
    subtotal, delivery, total, currency, status, paid_at
  )
  select
    tenant.id,
    'CK-SAMPLE-' || to_char(now(), 'HH24MISS'),
    replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
    'sample@example.com',
    'Sample Review',
    jsonb_build_object('line1', '1 Sample Street', 'city', 'Manchester', 'postcode', 'M1 1AA'),
    target.price, 0, target.price, 'GBP', 'paid', now() - interval '12 days'
  from tenant, target
  returning id, tenant_id
),
-- Two lines, because two reviews on one product is what shows the average
-- doing any work. One line each: the unique index is per line.
lines as (
  insert into order_items (order_id, product_id, slug, title, unit_price, qty, line_total)
  select made.id, target.id, 'sample', target.title, target.price, 1, target.price
  from made, target
  union all
  select made.id, target.id, 'sample', target.title, target.price, 1, target.price
  from made, target
  returning id, product_id, order_id
),
numbered as (
  select id, product_id, row_number() over () as n from lines
)
insert into store_reviews (
  tenant_id, order_item_id, product_id, rating, title, body, author, status, published_at, reply, replied_at
)
select
  (select tenant_id from made),
  numbered.id,
  numbered.product_id,
  case numbered.n when 1 then 5 else 4 end,
  case numbered.n when 1 then 'Arrived when they said it would' else null end,
  case numbered.n
    when 1 then 'Ordered on the Monday and it was here Wednesday morning. Packed properly, no damage.'
    else 'Does the job. The photograph is a little brighter than the real colour.'
  end,
  case numbered.n when 1 then 'Ada' else 'Ben' end,
  'approved',
  now() - interval '10 days',
  -- One reply, so the reply block can be seen too. A review answered is worth
  -- more to the next reader than the review on its own.
  case numbered.n when 2 then 'Thank you, that is fair. I have taken a new photograph in daylight.' end,
  case numbered.n when 2 then now() - interval '9 days' end
from numbered
returning order_item_id, rating, status;

-- ============================================================================
-- BLOCK TWO, take it back out
-- ============================================================================
-- Reviews first. `order_item_id` is on delete restrict on purpose, so an order
-- carrying reviews cannot be deleted until they are dealt with deliberately,
-- and that guard is exactly what would stop the second statement here.

delete from store_reviews
where order_item_id in (
  select oi.id from order_items oi
  join orders o on o.id = oi.order_id
  where o.reference like 'CK-SAMPLE-%'
);

delete from orders where reference like 'CK-SAMPLE-%';
