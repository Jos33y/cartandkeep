-- Customers.
--
-- A view, not a table. Every order already carries the name, the email and the
-- address, so a customer is what you get when you group orders by email. A
-- separate record would be a second copy of an address that goes stale the
-- first time somebody moves house, and it would create a row for everybody who
-- abandoned a checkout.
--
-- Grouped on the email, lowercased. The same person with two addresses is two
-- customers and a shared household email is one customer who is two people.
-- Both are wrong occasionally and both are the standard answer. The alternative
-- is asking her to merge records, which is work invented for a shop that has
-- eleven customers.
--
-- Paid orders only. A pending row is somebody who reached Stripe and did not
-- come back, and counting them would tell her she has customers she does not.

create or replace view store_customers as
with paid as (
  select
    o.tenant_id,
    lower(trim(o.email)) as email,
    o.id,
    o.reference,
    o.name,
    o.address,
    o.total,
    o.paid_at,
    o.dispatched_at
  from orders o
  where o.status = 'paid'
    and o.email is not null
    and trim(o.email) <> ''
)
select
  p.tenant_id,
  p.email,

  /*
   * The most recent name and address, not the first.
   *
   * Somebody who married, moved, or typed their name in a hurry the first time
   * is best represented by what they last told the shop. The older ones stay on
   * their own orders, which is where an invoice needs them.
   */
  (array_agg(p.name ORDER BY p.paid_at DESC))[1] as name,
  (array_agg(p.address ORDER BY p.paid_at DESC))[1] as address,

  count(*)::bigint as orders,
  sum(p.total)::numeric(10, 2) as spent,
  round(avg(p.total)::numeric, 2) as average,

  min(p.paid_at) as first_order,
  max(p.paid_at) as last_order,

  -- Waiting to be packed. This is the reason to open the screen when somebody
  -- writes in, so it is on the row rather than behind an expand.
  count(*) filter (where p.dispatched_at is null)::bigint as to_send,

  /*
   * More than one paid order, which is the definition the scope commits to
   * reporting against.
   *
   * Named `is_returning` rather than `returning`, which is a reserved word in
   * Postgres: it parses as the start of a RETURNING clause and the whole query
   * fails on a syntax error at the column name.
   */
  (count(*) > 1) as is_returning
from paid p
group by p.tenant_id, p.email;

comment on view store_customers is
  'One row per email that has paid for something. A view rather than a table, because every order already carries the name and address and a second copy of an address goes stale the first time somebody moves. Name and address are the most recent ones given.';

grant select on store_customers to authenticated;
