-- A conversation that ends in a price.
--
-- Build plan item 7, and the only thing on this platform that is not catching
-- up with somebody else's admin panel. Alibaba's whole mechanism is that you
-- can ask and be quoted. Without this the shop can have the conversation and
-- then has to send somebody back to a fixed price, which is where the sale is
-- lost.
--
-- Three rules, and they are the whole safety of it:
--
--   for one basket   the lines are copied at the moment of quoting, from the
--                    thread's own snapshot, so an offer cannot drift onto
--                    something she did not price
--   once             accepting sets the order, and the unique index means a
--                    second order cannot claim the same offer
--   until it expires the checkout compares against the clock rather than
--                    trusting a status somebody has to remember to update
--
-- And the legal line, which is the reason this is lawful where a struck
-- through was price is not. An offer is a price she chose to give one person
-- in a conversation. It is never shown beside a higher price on a product
-- page, never labelled a saving, and never announced to anybody else. A price
-- claim under the Digital Markets, Competition and Consumers Act 2024 needs
-- the higher price to have actually been charged, which is why `compare_at`
-- stays unused and this does not touch it.

create table if not exists store_offers (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants (id) on delete cascade,
  thread_id  uuid not null references store_threads (id) on delete cascade,

  /*
   * What is being priced, copied rather than referenced.
   *
   * The same shape as store_threads.basket and copied from it at the moment
   * of quoting. A reference would mean an offer that changes if the snapshot
   * ever did, and the whole reason the snapshot is frozen is that a
   * conversation about a moving basket makes both sides wrong.
   */
  lines      jsonb not null,

  /*
   * The goods total, and only that.
   *
   * Delivery stays the checkout's arithmetic, the same as for any basket.
   * Storing a delivery figure here would mean either a browser computing it
   * or a second authenticated function to compute it, and neither is worth a
   * number the checkout already knows how to work out.
   *
   * A price she types is not untrusted input: she is the shop. A price a
   * customer's browser supplies is, and this keeps that line exactly where it
   * already sits.
   */
  price      numeric(10, 2) not null check (price >= 0),

  expires_at timestamptz not null,

  /*
   * Three states and no fourth.
   *
   * Expired is not one of them. It is the clock, compared at the moment
   * somebody tries to use it, because a stored expiry status is a status that
   * needs a job to maintain and is wrong between runs of it.
   */
  status     text not null default 'open'
             check (status in ('open', 'accepted', 'withdrawn')),

  -- The order it produced. Set once, by the checkout, and the constraint below
  -- is what makes "once" true rather than remembered.
  order_id    uuid references orders (id) on delete set null,
  accepted_at timestamptz,

  -- Who quoted it. Null while one person answers, the same call the message
  -- table makes, and the column that assignment reads when there is a second.
  author_id  uuid,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- An accepted offer has an order behind it and an open one does not.
  constraint store_offers_accepted_has_order
    check ((status = 'accepted') = (order_id is not null))
);

/*
 * One live offer per conversation.
 *
 * Quoting again replaces the previous price rather than adding a second, which
 * is what any negotiation does and what stops a customer holding two numbers
 * and choosing. The caller withdraws the old one in the same statement; this
 * is what makes forgetting impossible.
 */
create unique index if not exists store_offers_one_open_per_thread
  on store_offers (thread_id) where status = 'open';

-- One order per offer, which is the whole of "used once".
create unique index if not exists store_offers_one_order
  on store_offers (order_id) where order_id is not null;

create index if not exists store_offers_thread_idx
  on store_offers (thread_id, created_at desc);

drop trigger if exists store_offers_touch on store_offers;
create trigger store_offers_touch
  before update on store_offers
  for each row execute function touch_updated_at();

/*
 * Nothing to anon.
 *
 * A customer sees their own offer through the thread function, which checks a
 * token first, the same as everything else they can reach. She writes these
 * directly under her session, the same as a reply, because a price she types
 * needs no server between her and the row.
 */
alter table store_offers enable row level security;

revoke all on store_offers from anon, authenticated;
grant select, insert, update on store_offers to authenticated;

drop policy if exists store_offers_portal on store_offers;
create policy store_offers_portal on store_offers
  for all to authenticated
  using (has_tenant(tenant_id)) with check (has_tenant(tenant_id));

comment on table store_offers is
  'A price quoted inside one conversation, for the lines copied into it, usable once and only before it expires. Never shown beside a higher price and never labelled a saving: an offer is a price given to one person, which is a different thing in law from a price claim on a shop.';

comment on column store_offers.price is
  'The goods total. Delivery is the checkout arithmetic, as for any basket, because a delivery figure stored here would have to be computed by a browser or by a second function.';

/*
 * What is actually live, so nothing has to remember the rule.
 *
 * Anything reading an offer reads this rather than the table, exactly as
 * anything sending an email reads store_mailing_list rather than the
 * subscribers table. An expiry cannot be missed by an oversight in a query.
 */
drop view if exists store_live_offers;
create view store_live_offers as
select
  o.id,
  o.tenant_id,
  o.thread_id,
  o.lines,
  o.price,
  o.expires_at,
  o.created_at,
  (select count(*) from jsonb_array_elements(o.lines))::bigint as line_count
from store_offers o
where o.status = 'open'
  and o.expires_at > now();

comment on view store_live_offers is
  'Offers that are open and have not expired. Anything that honours an offer reads this rather than the table, so the clock cannot be forgotten in a query.';

grant select on store_live_offers to authenticated;
