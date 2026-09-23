-- What was sent to whom, and when.
--
-- Three reasons this table exists, and only one of them is engineering.
--
-- Stripe retries webhooks. A retry that resends is a customer receiving three
-- receipts, so the unique constraint below is what makes sending idempotent.
--
-- The Consumer Contracts Regulations put the burden of proving the required
-- information was given on the trader, not on the consumer. So this is
-- evidence, which is why it keeps the rendered subject and the recipient rather
-- than a success flag.
--
-- And a send that failed has to be visible. The portal writes `dispatched_at`
-- directly and then calls the notify function, so a parcel can be marked gone
-- with nothing sent. The order row reads this table and offers a resend rather
-- than leaving a customer wondering why nobody told them.

create table if not exists order_emails (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  order_id uuid not null references orders(id) on delete cascade,

  -- `confirmation` is the statutory one under regulation 16. `dispatch` and
  -- `seller_alert` are ours.
  kind text not null check (kind in ('confirmation', 'dispatch', 'seller_alert')),

  recipient text not null,
  subject text not null,

  -- Whether the trader identity required by Schedule 2 items b and c was
  -- present when this went out. Three of the twelve gold blocks are still with
  -- her, and an email that went out short is worth being able to find later
  -- rather than discovering in a dispute.
  identity_complete boolean not null default false,

  provider_id text,
  status text not null default 'sent' check (status in ('sent', 'failed')),
  error text,

  created_at timestamptz not null default now()
);

-- One send per kind per order. The webhook checks for a row before sending, so
-- a Stripe retry finds one and does nothing.
--
-- Failed rows are deleted rather than kept alongside a later success, because a
-- partial unique index on status would let a failure and a success coexist and
-- then the check before sending has to reason about which one it found.
create unique index if not exists order_emails_once
  on order_emails (order_id, kind);

create index if not exists order_emails_order_idx
  on order_emails (order_id, created_at desc);

alter table order_emails enable row level security;

-- Written only by the service role, from the notify function. Read by the
-- portal so the order row can show what the customer was told.
revoke all on order_emails from anon, authenticated;
grant select on order_emails to authenticated;

drop policy if exists order_emails_portal_read on order_emails;
create policy order_emails_portal_read on order_emails
  for select to authenticated
  using (true);

comment on table order_emails is
  'One row per email sent about an order. The unique index makes sending idempotent under Stripe retries, and the row is the evidence that regulation 16 information was given.';
