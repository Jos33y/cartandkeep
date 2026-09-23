-- What people asked her to stock.
--
-- A table rather than an email, and that is the whole argument for this being
-- built at all. A request is the cheapest research this shop will ever get:
-- somebody saying, unprompted, what they would buy. In an inbox it is one
-- message among forty. In a list with a count beside it, three people asking
-- for the same thing is a product to source.
--
-- It also feeds the thing the retainer is actually for. The research pipeline
-- pays for demand signal; this arrives free and it is from her own visitors
-- rather than from a marketplace average.
--
-- Not a support ticket. Somebody with a problem replies to their order email,
-- which reaches her the same day. This is only for things the shop does not
-- sell yet.

create table if not exists store_requests (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants (id) on delete cascade,

  -- What they want. The only required field, because every extra box is a
  -- percentage of people who do not finish.
  wanted      text not null check (length(trim(wanted)) > 0),

  /*
   * The two fields that turn a wish into something she can price.
   *
   * `paying` is what they pay for it now, which tells her the ceiling before
   * she opens a supplier tab. `seen_at` is where they buy it today, which is
   * often a link to the exact product.
   */
  paying      numeric(10, 2) check (paying is null or paying >= 0),
  seen_at     text,

  -- Optional. Somebody who leaves it can still be answered by the list going
  -- live, and somebody who gives it can be told directly.
  email       text,
  name        text,

  /*
   * Where they were standing.
   *
   * A request from a product page is a different signal from one off the home
   * page: it usually means the thing they found was nearly right. The path is
   * captured by the form rather than read from a referrer, which in app
   * browsers strip.
   */
  source      text,

  status      text not null default 'new'
              check (status in ('new', 'looking', 'sourced', 'declined')),

  -- Hers, and never shown to the person who asked. Where she records the
  -- supplier she found, or why it is not worth stocking.
  note        text,

  -- Set when a request turns into a product, so the list can show which asks
  -- actually became stock. That figure is the argument for keeping the band on
  -- the home page.
  product_id  uuid references store_products (id) on delete set null,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists store_requests_open_idx
  on store_requests (tenant_id, status, created_at desc);

drop trigger if exists store_requests_touch on store_requests;
create trigger store_requests_touch
  before update on store_requests
  for each row execute function touch_updated_at();

/*
 * Nothing readable from a browser.
 *
 * A list of what everybody has asked for is a list of what the shop does not
 * stock and what her visitors are shopping for, which is competitor research
 * she paid for. Writing goes through an edge function holding the service role,
 * the same as reviews and the mailing list.
 */
alter table store_requests enable row level security;

revoke all on store_requests from anon, authenticated;
grant select, update on store_requests to authenticated;

drop policy if exists store_requests_portal on store_requests;
create policy store_requests_portal on store_requests
  for all to authenticated
  using (has_tenant(tenant_id)) with check (has_tenant(tenant_id));

comment on table store_requests is
  'Things visitors asked the shop to stock. Demand signal rather than support: somebody with a problem replies to their order email instead. What they pay now and where they buy it are the two fields that turn a wish into something she can price.';

/*
 * The same thing asked for more than once.
 *
 * Grouped on a rough normalisation of the text, because "bed rails" and
 * "Bed Rails " are the same request and nobody will merge them by hand. It is
 * deliberately crude: it will not join "bed rail" to "bed rails", and a
 * stemmer here would be a lot of machinery for a shop that has had no requests
 * at all. If the list ever gets long enough for that to hurt, this is the one
 * place to change.
 */
create or replace view store_request_demand as
select
  tenant_id,
  lower(regexp_replace(trim(wanted), '\s+', ' ', 'g')) as wanted,
  count(*)::bigint as asks,
  count(*) filter (where status = 'new')::bigint as unanswered,
  round(avg(paying)::numeric, 2) as paying,
  max(created_at) as last_asked
from store_requests
group by tenant_id, lower(regexp_replace(trim(wanted), '\s+', ' ', 'g'))
having count(*) > 1;

comment on view store_request_demand is
  'Anything asked for more than once, with the average of what people say they pay now. Two people asking is a coincidence; four is a product.';

grant select on store_request_demand to authenticated;
