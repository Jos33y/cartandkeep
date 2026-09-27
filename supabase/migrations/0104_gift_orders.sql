-- Orders that go to somebody else.
--
-- Until now one name did two jobs: the person paying and the person on the
-- parcel. A gift splits them. `name`, `email` and `phone` stay the buyer's, so
-- nothing that already reads them changes meaning. The recipient gets their own
-- columns, and `address` is where the parcel goes, whoever that is for.
--
-- The recipient's email is kept only when the buyer ticked to tell them it has
-- been sent, and the check below makes that a rule rather than a habit.

alter table orders add column if not exists is_gift boolean not null default false;
alter table orders add column if not exists recipient_name text;
alter table orders add column if not exists recipient_phone text;
alter table orders add column if not exists recipient_email text;
alter table orders add column if not exists notify_recipient boolean not null default false;
alter table orders add column if not exists gift_message text;

alter table orders drop constraint if exists orders_gift_shape;
alter table orders add constraint orders_gift_shape check (
  (is_gift or (recipient_name is null and recipient_phone is null and recipient_email is null
               and gift_message is null and not notify_recipient))
  and (not is_gift or nullif(trim(recipient_name), '') is not null)
  and (recipient_email is null or notify_recipient)
  and (not notify_recipient or recipient_email is not null)
  and (gift_message is null or char_length(gift_message) <= 300)
);

comment on column orders.recipient_email is
  'Only when the buyer asked for the recipient to be told it has been sent, and used for that one email.';

-- The dispatch note to a gift's recipient is its own send, with its own proof.
alter table order_emails drop constraint if exists order_emails_kind_check;
alter table order_emails add constraint order_emails_kind_check
  check (kind in ('confirmation', 'dispatch', 'seller_alert', 'review_request', 'recipient_dispatch'));

-- A customer's address is where they had their own orders sent, never a friend's.
create or replace view store_customers as
with paid as (
  select
    o.tenant_id,
    lower(trim(o.email)) as email,
    o.id,
    o.reference,
    o.name,
    o.address,
    o.is_gift,
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
  (array_agg(p.name ORDER BY p.paid_at DESC))[1] as name,
  (array_agg(p.address ORDER BY p.paid_at DESC) filter (where not p.is_gift))[1] as address,
  count(*)::bigint as orders,
  sum(p.total)::numeric(10, 2) as spent,
  round(avg(p.total)::numeric, 2) as average,
  min(p.paid_at) as first_order,
  max(p.paid_at) as last_order,
  count(*) filter (where p.dispatched_at is null)::bigint as to_send,
  (count(*) > 1) as is_returning
from paid p
group by p.tenant_id, p.email;

alter view store_customers set (security_invoker = on);

comment on view store_customers is
  'One row per email that has paid for something. Name is the most recent one given; address is the most recent one they had sent to themselves, so a gift never shows as the buyer''s own address.';
