-- What people do in the shop.
--
-- First party, in our own database, for two reasons. Nothing off the shelf can
-- join a product view to the product row and then to an order line, which is
-- the only join that answers the question the research pipeline actually asks:
-- which products get looked at and not bought. And nothing off the shelf can
-- do it without dropping an identifier on the visitor's device, which under
-- PECR means a consent banner.
--
-- There is no device storage. The session id is generated in memory, dies on
-- reload, and is carried to Stripe through the order row so a purchase can
-- still be attributed. Nothing here identifies a person across visits and
-- nothing here should ever be made to.

create table if not exists store_events (
  id          bigint generated always as identity primary key,
  tenant_id   uuid not null references tenants (id) on delete cascade,

  -- In memory only, for the length of one visit. Not a visitor id.
  session_id  text not null,

  event       text not null
              check (event in (
                'page_view', 'view_product', 'add_to_basket', 'remove_from_basket',
                'begin_checkout', 'purchase', 'search', 'quick_view', 'save_product'
              )),

  product_id  uuid references store_products (id) on delete set null,
  path        text,

  -- Whatever the event needs and nothing more: a search term, a quantity, an
  -- order reference. Deliberately not a bag for anything that looks personal.
  meta        jsonb not null default '{}'::jsonb,

  -- Host and path only, written by the client with the query string stripped,
  -- because a referrer query string routinely carries an email address.
  referrer    text,

  created_at  timestamptz not null default now()
);

create index if not exists store_events_tenant_time_idx on store_events (tenant_id, created_at desc);
create index if not exists store_events_product_idx on store_events (product_id, event) where product_id is not null;
create index if not exists store_events_session_idx on store_events (session_id);
create index if not exists store_events_event_idx on store_events (tenant_id, event, created_at desc);

alter table store_events enable row level security;

-- Insert only, and only from the browser.
--
-- Anon can write an event and can never read one back. An analytics table a
-- visitor can select from is a list of what every other visitor looked at.
drop policy if exists store_events_anon_insert on store_events;
create policy store_events_anon_insert
  on store_events for insert
  to anon, authenticated
  with check (true);

-- Reading is for the portal, which is authenticated and tenant scoped.
drop policy if exists store_events_read on store_events;
create policy store_events_read
  on store_events for select
  to authenticated
  using (true);

/*
 * The funnel, per product.
 *
 * The question worth asking on a catalogue this size is not how much traffic
 * there is. It is which products people look at and do not buy, because that
 * is either a price problem, a photograph problem or a description problem,
 * and it is the loop back into the research pipeline.
 */
create or replace view store_product_funnel as
select
  p.tenant_id,
  p.id as product_id,
  p.slug,
  p.title,
  p.price,
  count(*) filter (where e.event = 'view_product')   as views,
  count(*) filter (where e.event = 'quick_view')     as quick_views,
  count(*) filter (where e.event = 'add_to_basket')  as adds,
  count(*) filter (where e.event = 'purchase')       as purchases,
  -- Null rather than zero when nobody has looked. A conversion rate of 0%
  -- reads as a failing product; no views reads as no data, which is the truth.
  case when count(*) filter (where e.event = 'view_product') > 0
    then round(
      count(*) filter (where e.event = 'add_to_basket')::numeric
      / count(*) filter (where e.event = 'view_product') * 100, 1)
  end as add_rate_pct
from store_products p
left join store_events e on e.product_id = p.id
group by p.tenant_id, p.id, p.slug, p.title, p.price;

comment on view store_product_funnel is
  'Views to adds to purchases per product. The add rate is null rather than zero when nobody has looked, because no data and a bad product are different findings.';

-- The order carries the session that produced it.
--
-- Nothing is stored on the visitor's device, so without this a purchase cannot
-- be joined to the visit that led to it, and the funnel stops at the basket.
alter table orders add column if not exists session_id text;
create index if not exists orders_session_analytics_idx on orders (session_id) where session_id is not null;

-- Retention.
--
-- Raw events are only useful while they are recent, and a table nobody prunes
-- becomes the biggest thing in the database. Ninety days, run from the portal
-- or a scheduled job.
create or replace function prune_store_events(days integer default 90)
returns integer language plpgsql as $$
declare removed integer;
begin
  delete from store_events where created_at < now() - (days || ' days')::interval;
  get diagnostics removed = row_count;
  return removed;
end;
$$;
