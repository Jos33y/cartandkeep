-- The mailing list.
--
-- Single opt in: the address goes on the list the moment somebody types it.
-- Double opt in is cleaner and it is machinery guarding nothing on a list of
-- zero, so it is not here. If she ever sends a campaign it becomes worth the
-- extra email and the third of sign ups it costs, and this table already has
-- the column for it.
--
-- What the law actually requires is not the double opt in, it is the record.
-- Consent has to be freely given and it has to be provable, so the row stores
-- when, from which page, and what the box said at the time. A tick box whose
-- wording changed in October is not evidence about somebody who signed up in
-- August.
--
-- A customer is not a subscriber. Buying something is not consent to be
-- emailed, and adding buyers to this table would be the soft opt in route,
-- which needs its own separately worded box at checkout. Deliberately absent:
-- one list, one box, one deliberate act.

create table if not exists store_subscribers (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants (id) on delete cascade,

  -- Stored lowercased and trimmed, the same rule store_customers groups on, so
  -- the same person cannot appear twice with different capitals.
  email       text not null check (position('@' in email) > 1),

  -- What they typed, if anything. The box asks for it and does not require it.
  name        text,

  /*
   * The consent record.
   *
   * `source` is the page it came from and `wording` is what the box said, both
   * captured at the moment rather than looked up later. Without the wording,
   * proving consent means proving what the site said months ago, which is not
   * something a database can do after the copy has changed.
   */
  source      text,
  wording     text,
  consented_at timestamptz not null default now(),

  /*
   * Leaving.
   *
   * A row rather than a delete, because the record of having unsubscribed is
   * the thing that stops them being added again by an import and is the only
   * evidence that the opt out worked. Deleting them loses both.
   */
  unsubscribed_at timestamptz,

  -- Unused today. Here so single opt in can become double without a migration
  -- that has to backfill a column onto a live list.
  confirmed_at timestamptz,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- One row per address. Somebody signing up twice is somebody who forgot, not
  -- a second subscriber, and the second attempt should reopen the first row
  -- rather than making a duplicate.
  unique (tenant_id, email)
);

create index if not exists store_subscribers_active_idx
  on store_subscribers (tenant_id, unsubscribed_at, consented_at desc);

drop trigger if exists store_subscribers_touch on store_subscribers;
create trigger store_subscribers_touch
  before update on store_subscribers
  for each row execute function touch_updated_at();

/*
 * Nothing about this table is readable from a browser.
 *
 * A visitor's own address is not worth a read path, and a list of everybody who
 * ever signed up is the single most abusable thing in this database. Writing
 * goes through an edge function holding the service role, the same as reviews,
 * so an address arriving from a form is checked before it lands.
 */
alter table store_subscribers enable row level security;

revoke all on store_subscribers from anon, authenticated;
grant select, update on store_subscribers to authenticated;

drop policy if exists store_subscribers_portal on store_subscribers;
create policy store_subscribers_portal on store_subscribers
  for all to authenticated
  using (has_tenant(tenant_id)) with check (has_tenant(tenant_id));

comment on table store_subscribers is
  'The mailing list, single opt in. The row is the consent record: when, from which page, and what the box said at the time. Unsubscribing sets a date rather than deleting the row, because the record of having left is the evidence the opt out worked.';

comment on column store_subscribers.wording is
  'What the sign up box said when this person agreed to it. Captured at the moment because proving consent later means proving what the site said months ago, which nothing else here can do.';

/*
 * Who can actually be emailed.
 *
 * A view so nothing has to remember the rule. Anyone reading this to send
 * something reads this and not the table, and somebody who unsubscribed cannot
 * be included by an oversight.
 */
create or replace view store_mailing_list as
select id, tenant_id, email, name, consented_at, source
from store_subscribers
where unsubscribed_at is null;

comment on view store_mailing_list is
  'Subscribers who have not unsubscribed. Anything that sends reads this rather than the table, so an opt out cannot be missed by an oversight in a query.';

grant select on store_mailing_list to authenticated;
