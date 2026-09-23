-- Talking to customers, stage one.
--
-- A thread belongs to a thing rather than to a person. It is about a product,
-- an order or a basket, and it carries what it is about with it, so opening a
-- message never means working out what somebody is referring to. A general
-- inbox is what every shop this size has and it is worse, because it makes the
-- person answering do the work the software should be doing.
--
-- There is one secret per conversation and the constraint below is what keeps
-- that true. Where an order exists the order's token opens the thread, which is
-- the token the confirmation email already carried, so nobody is sent a second
-- link to lose. Where there is no order the thread carries its own, generated
-- the same way and compared the same way.
--
-- Nothing here is readable from a browser. Every customer read and write goes
-- through the thread function holding the service role, the same arrangement
-- reviews, requests and the mailing list already use.

create table if not exists store_threads (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants (id) on delete cascade,

  subject_kind  text not null
                check (subject_kind in ('product', 'order', 'basket')),

  /*
   * What it is about.
   *
   * `product_id` nulls when a product goes, the same call store_reviews makes,
   * because a conversation is a customer's words and it should outlive the row
   * it was about. There is deliberately no check requiring a product thread to
   * hold a product: a constraint like that turns deleting a product into an
   * error rather than a tidy up, and archiving is a status here anyway.
   *
   * `order_id` restricts rather than cascades, for the same reason the review
   * table does. Deleting an order should not silently take the conversation
   * about it. That means the fixture cleanup in the handoff needs a third
   * delete against this table before the two order deletes.
   *
   * 'basket' is in the check now and its snapshot column is not, because
   * adding a nullable jsonb column in stage two is free and widening a check
   * constraint later is a drop and an add.
   */
  product_id    uuid references store_products (id) on delete set null,
  order_id      uuid references orders (id) on delete restrict,

  /*
   * How it arrived.
   *
   * Everything is 'store' today. It exists now because the first message from
   * anywhere else arrives as an untyped row nobody can filter or count, and
   * because the notification layer was specified channel agnostic from the
   * start rather than rewritten when a second channel lands.
   */
  channel       text not null default 'store'
                check (channel in ('store', 'whatsapp', 'ebay')),

  -- Null when there is an order, because the order's token opens it. Set
  -- otherwise. The constraint at the foot of the table is what makes that
  -- readable as a rule rather than remembered as a convention.
  access_token  text,

  email         text not null check (position('@' in email) > 1),
  name          text,

  status        text not null default 'open'
                check (status in ('open', 'closed')),

  /*
   * Three timestamps rather than an answered flag.
   *
   * A flag is a thing two code paths can disagree about. These are written by
   * the trigger below and by nothing else, and whether a thread is waiting is
   * derived from them wherever it is asked.
   */
  last_message_at  timestamptz not null default now(),
  last_customer_at timestamptz,
  last_reply_at    timestamptz,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint store_threads_one_secret
    check ((order_id is null) <> (access_token is null))
);

/*
 * What is waiting, as a partial index rather than a scan.
 *
 * The navigation carries this count on every portal screen, so it is the most
 * repeated query in the portal. The predicate is the same expression the inbox
 * view reports, written once here and once there, which is a duplication worth
 * knowing about: change one and change both.
 */
create index if not exists store_threads_awaiting_idx
  on store_threads (tenant_id, last_message_at desc)
  where last_customer_at is not null
    and (last_reply_at is null or last_customer_at > last_reply_at);

create index if not exists store_threads_recent_idx
  on store_threads (tenant_id, last_message_at desc);

create index if not exists store_threads_product_idx
  on store_threads (product_id, created_at desc);

drop trigger if exists store_threads_touch on store_threads;
create trigger store_threads_touch
  before update on store_threads
  for each row execute function touch_updated_at();

comment on table store_threads is
  'One conversation, about a product, an order or a basket. One secret per conversation: an order thread is opened by the order token the confirmation email already carried, everything else carries its own.';

comment on column store_threads.access_token is
  'Null when order_id is set, because the order token opens it. The check constraint is what stops a thread ending up with two ways in or none.';

-- --- messages ----------------------------------------------------------------

create table if not exists store_messages (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants (id) on delete cascade,
  thread_id  uuid not null references store_threads (id) on delete cascade,

  sender     text not null check (sender in ('customer', 'shop')),

  body       text not null check (length(trim(body)) > 0),

  /*
   * Who wrote it, snapshotted.
   *
   * `author_name` is copied at send rather than joined at read, the same call
   * order_items makes about a title: a reply written in September should still
   * say who wrote it after they have left or changed what they are called.
   * Null falls back to the shop name, which is the state today.
   *
   * `author_id` is a plain uuid rather than a reference into the auth schema.
   * Nothing joins it yet, and a foreign key into auth is a thing to add
   * deliberately on the day there is a second person answering rather than
   * inherited from a table that guessed. These two columns are also most of
   * what assignment and read state need later.
   */
  author_id   uuid,
  author_name text,

  -- Her read of a customer message. Never set on a message the shop sent.
  read_at    timestamptz,

  /*
   * How the other side was told, and whether they were.
   *
   * Named for the channel rather than for email, because `emailed_at` bakes
   * today's only channel into a column name and renaming a column on a live
   * table is the sort of tidying that gets deferred and never done.
   *
   * A null `sent_at` with no error is a message nobody has been told about
   * yet. That is the state a retry looks for, and it is why this is not a
   * boolean.
   */
  sent_via   text not null default 'email'
             check (sent_via in ('email', 'whatsapp', 'none')),
  sent_at    timestamptz,
  send_error text,

  created_at timestamptz not null default now()
);

create index if not exists store_messages_thread_idx
  on store_messages (thread_id, created_at);

-- What she has not read, for a count that does not walk the table.
create index if not exists store_messages_unread_idx
  on store_messages (tenant_id, created_at desc)
  where sender = 'customer' and read_at is null;

comment on table store_messages is
  'One message. The author name is snapshotted at send rather than joined at read, so a reply still says who wrote it after they have gone.';

/*
 * The thread's clocks, maintained by the database.
 *
 * A trigger rather than three updates in the function, because a second caller
 * is a second place to forget one, and the whole of whether a thread is
 * waiting is derived from these.
 */
create or replace function touch_thread_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update store_threads set
    last_message_at  = new.created_at,
    last_customer_at = case when new.sender = 'customer'
                         then new.created_at else last_customer_at end,
    last_reply_at    = case when new.sender = 'shop'
                         then new.created_at else last_reply_at end,
    updated_at       = now()
  where id = new.thread_id;
  return new;
end;
$$;

drop trigger if exists store_messages_touch_thread on store_messages;
create trigger store_messages_touch_thread
  after insert on store_messages
  for each row execute function touch_thread_on_message();

-- --- row level security ------------------------------------------------------

/*
 * Nothing to anon on either table.
 *
 * A customer reads their own thread through the thread function, which checks
 * a token first. Opening either table to anon would put every conversation the
 * shop has had in a browser, and at client two it would put one shop's
 * conversations in another shop's visitor's network tab.
 *
 * The grant before the policy. A policy with no grant fails as permission
 * denied rather than as no rows, which is a different bug to chase, and it has
 * already cost a turn on this project once.
 */
alter table store_threads enable row level security;
alter table store_messages enable row level security;

revoke all on store_threads from anon, authenticated;
revoke all on store_messages from anon, authenticated;

grant select, update on store_threads to authenticated;
grant select, insert, update on store_messages to authenticated;

drop policy if exists store_threads_portal on store_threads;
create policy store_threads_portal on store_threads
  for all to authenticated
  using (has_tenant(tenant_id)) with check (has_tenant(tenant_id));

drop policy if exists store_messages_portal on store_messages;
create policy store_messages_portal on store_messages
  for all to authenticated
  using (has_tenant(tenant_id)) with check (has_tenant(tenant_id));

-- --- the inbox ---------------------------------------------------------------

/*
 * Columns named rather than `t.*`.
 *
 * `create or replace view` cannot rename or reorder columns, and a star
 * expands at creation, so adding a column to the table above would make this
 * replace read as a rename of everything after it. That has been walked into
 * twice on this project, the second time by somebody who had written the
 * comment warning about it.
 */
drop view if exists store_thread_inbox;
create view store_thread_inbox as
select
  t.id,
  t.tenant_id,
  t.subject_kind,
  t.channel,
  t.status,
  t.email,
  t.name,
  t.created_at,
  t.last_message_at,
  t.last_customer_at,
  t.last_reply_at,

  -- The same predicate as the partial index above. If one changes, both do.
  (t.last_customer_at is not null
   and (t.last_reply_at is null or t.last_customer_at > t.last_reply_at)) as awaiting,

  t.product_id,
  p.title     as product_title,
  p.slug      as product_slug,
  p.image_url as product_image,

  t.order_id,
  o.reference as order_reference,

  (select count(*) from store_messages m where m.thread_id = t.id)::bigint as messages,

  /*
   * The last line, for the list.
   *
   * Trimmed to 160 here rather than in the browser, so the inbox query does
   * not carry a two thousand character message per row for a preview that
   * shows one line of it.
   */
  (select left(m.body, 160) from store_messages m
    where m.thread_id = t.id order by m.created_at desc limit 1) as last_body,
  (select m.sender from store_messages m
    where m.thread_id = t.id order by m.created_at desc limit 1) as last_sender
from store_threads t
left join store_products p on p.id = t.product_id
left join orders o on o.id = t.order_id;

comment on view store_thread_inbox is
  'Threads with what they are about attached, and whether each is waiting on a reply. Waiting is derived from the three timestamps rather than stored, so nothing can disagree about it.';

grant select on store_thread_inbox to authenticated;

-- --- how fast the shop actually replies --------------------------------------

/*
 * Measured, never typed into a settings box.
 *
 * "Usually replies within two hours" is a fact when it is computed and a claim
 * when it is configured, and it is a claim the shop then has to keep. This
 * reports the median and the number of threads behind it, so nothing has to
 * decide on its own whether there is enough to say anything.
 *
 * Sixty days, because a median over the whole history stops moving after a
 * year and stops describing how the shop answers today.
 *
 * The first reply to the first question, not the mean gap between messages. A
 * conversation that goes back and forth six times is one wait from the point
 * of view of the person who asked.
 */
drop view if exists store_reply_time;
create view store_reply_time as
select
  tenant_id,
  count(*)::bigint as answered,
  round(percentile_cont(0.5) within group (order by seconds)::numeric)::bigint as median_seconds
from (
  select
    t.tenant_id,
    extract(epoch from (
      min(m.created_at) filter (where m.sender = 'shop')
      - min(m.created_at) filter (where m.sender = 'customer')
    )) as seconds
  from store_threads t
  join store_messages m on m.thread_id = t.id
  where t.created_at > now() - interval '60 days'
  group by t.id, t.tenant_id
) x
-- Null drops a thread nobody has answered. Zero or less drops one where the
-- shop wrote first, which is not a reply to anything.
where seconds > 0
group by tenant_id;

comment on view store_reply_time is
  'Median time from a customer first asking to the shop first replying, over sixty days, with the number of threads behind it. The count is there so a page can decide whether the figure is worth showing rather than showing one computed from two conversations.';

grant select on store_reply_time to authenticated;

-- --- where an order came from ------------------------------------------------

/*
 * The conversation an order came out of, which is the only way this feature is
 * ever measured.
 *
 * Named `from_thread_id` rather than `thread_id` on purpose. A thread carries
 * `order_id`, meaning the order it is about, and this carries the opposite
 * relation, meaning the conversation the sale came from. Two columns called
 * the same thing pointing opposite ways is a query somebody writes backwards
 * once a month.
 *
 * Empty until the checkout passes it, which is one line in a function that has
 * to be touched for Stripe anyway.
 */
alter table orders add column if not exists from_thread_id uuid
  references store_threads (id) on delete set null;

create index if not exists orders_from_thread_idx
  on orders (from_thread_id) where from_thread_id is not null;

/*
 * The grant a new column does not inherit.
 *
 * 0042 granted specific columns on this table rather than the table itself, so
 * a column added afterwards is invisible to the portal until it is named here.
 * This is the fourth time a migration on this project has added something the
 * reader could not see, and it is the one the decisions file says to check
 * every time.
 */
grant select (from_thread_id) on orders to authenticated;

comment on column orders.from_thread_id is
  'The conversation this sale came out of, where there was one. store_threads.order_id is the opposite relation: the order a conversation is about.';
