-- Orders.
--
-- Written by the edge functions with the service role, never by the browser.
-- A shopper can create an order only by going through Stripe, and can read one
-- back only with a reference and a token they were given, so there is no anon
-- policy on either table at all.
--
-- Nothing here has a customer account behind it, because there is not going to
-- be one. Email plus reference is the whole identity.

create table if not exists orders (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants (id) on delete restrict,

  -- Human sized, sayable on the phone, and not sequential. A sequential
  -- reference tells a competitor how many orders a shop takes in a week.
  reference       text not null,

  -- Random, and the only thing between a guessed reference and somebody
  -- else's delivery address.
  access_token    text not null,

  status          text not null default 'pending'
                  check (status in ('pending', 'paid', 'failed', 'cancelled', 'refunded')),

  email           text not null,
  name            text,
  phone           text,

  -- One shape, kept whole. An address split into eight columns is eight
  -- columns to get wrong on the day somebody moves to Scotland.
  address         jsonb not null default '{}'::jsonb,

  subtotal        numeric(10, 2) not null check (subtotal >= 0),
  delivery        numeric(10, 2) not null default 0 check (delivery >= 0),
  total           numeric(10, 2) not null check (total >= 0),
  currency        text not null default 'GBP',

  stripe_session_id       text,
  stripe_payment_intent   text,

  customer_note   text,
  internal_note   text,

  paid_at         timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  unique (tenant_id, reference)
);

create unique index if not exists orders_session_idx
  on orders (stripe_session_id) where stripe_session_id is not null;

create index if not exists orders_tenant_status_idx on orders (tenant_id, status, created_at desc);
create index if not exists orders_email_idx on orders (tenant_id, lower(email));

/*
 * Line items, with the price frozen.
 *
 * `product_id` is nullable and set null on delete, because an order is a
 * record of what happened and it has to survive a product being taken down.
 * The title, price and image are copied rather than joined for the same
 * reason: an invoice that changes when she edits a price is not an invoice.
 */
create table if not exists order_items (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references orders (id) on delete cascade,
  product_id  uuid references store_products (id) on delete set null,

  slug        text,
  title       text not null,
  image_url   text,
  unit_price  numeric(10, 2) not null check (unit_price >= 0),
  qty         integer not null check (qty > 0),
  line_total  numeric(10, 2) not null check (line_total >= 0),

  created_at  timestamptz not null default now()
);

create index if not exists order_items_order_idx on order_items (order_id);

drop trigger if exists orders_touch on orders;
create trigger orders_touch
  before update on orders
  for each row execute function touch_updated_at();

-- Row level security, on and empty.
--
-- No policy for anon and none for authenticated. Everything reaches these
-- tables through an edge function holding the service role, which bypasses
-- RLS. Enabling it with no policies is what makes deny-by-default true rather
-- than assumed.
alter table orders enable row level security;
alter table order_items enable row level security;

comment on table orders is
  'Service role only. Created by the checkout function, updated by the Stripe webhook, read back by the order function with a reference and a token.';
 