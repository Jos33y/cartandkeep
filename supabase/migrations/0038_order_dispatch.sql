-- Dispatch.
--
-- The order page can show paid and pending and nothing else, so a customer who
-- comes back after their parcel has left sees the same screen they saw at the
-- moment they paid. These are the fields that let it say something true.
--
-- Nothing writes to them yet. They are filled from the portal when that page
-- exists, and the interface renders whatever is there.

alter table orders add column if not exists dispatched_at timestamptz;
alter table orders add column if not exists carrier text;
alter table orders add column if not exists tracking_number text;
alter table orders add column if not exists tracking_url text;

-- `dispatched` is not a payment state, which is why it is a timestamp rather
-- than another value in the status check. An order can be paid and not sent,
-- and it can be refunded after being sent, and one column cannot say both.
comment on column orders.dispatched_at is
  'When it left. Deliberately separate from status, because dispatch and payment are two different facts about the same order.';

comment on column orders.tracking_url is
  'The carrier link, whole. Not a template with a number substituted in, because every carrier changes theirs eventually.';
