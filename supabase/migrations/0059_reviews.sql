-- Reviews, and the one rule that shapes the whole table.
--
-- A review is keyed to an order line, not to a product. There is no route from
-- a product page to a review form, and there never will be: the only way to
-- write one is to have bought the thing and to hold the reference and token the
-- confirmation email carried. That is what makes the aggregate rating on the
-- product page a fact rather than a decoration, and it is why the schema markup
-- has been refusing to emit one until now.
--
-- She approves before anything publishes. Same rule as descriptions and drafted
-- replies: a statement on her shop gets a person between the writer and the
-- customer. Not so she can edit them, but because a shop this size gets one
-- abusive review and has no moderation queue to absorb it.
--
-- The cost of both decisions is that the first review arrives weeks after the
-- shop opens, and that is the correct cost.

create table if not exists store_reviews (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants (id) on delete cascade, 

  /*
   * The line, not the order and not the product.
   *
   * An order of three things earns three reviews, and each one is about the
   * thing on that line. Restricted rather than cascaded: a review is a
   * customer's words and deleting an order should not take them, so an order
   * carrying reviews cannot be deleted until they are dealt with deliberately.
   */
  order_item_id uuid not null references order_items (id) on delete restrict,

  -- Denormalised on purpose, so the product page can read reviews without
  -- joining through two tables to reach them, and so a review survives the
  -- line's product_id being nulled when a product is removed.
  product_id    uuid references store_products (id) on delete set null,
  variant_id    uuid references store_variants (id) on delete set null,

  rating        smallint not null check (rating between 1 and 5),

  -- Both optional. A rating with no words is still a rating, and forcing a
  -- sentence out of somebody who wanted to press five stars is how a shop gets
  -- no reviews at all.
  title         text check (title is null or length(trim(title)) > 0),
  body          text check (body is null or length(trim(body)) > 0),

  /*
   * What to call them, and what not to.
   *
   * The email address is already on the order and is never shown. This is a
   * display name she or they chose, defaulting to a first name, because a
   * review signed with a full email is a review nobody would leave twice.
   */
  author        text,

  status        text not null default 'pending'
                check (status in ('pending', 'approved', 'hidden')),

  -- Her reply, published under the review. One shop, one voice, and a review
  -- answered is worth more to the next reader than the review alone.
  reply         text,
  replied_at    timestamptz,

  published_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- One review per line. Somebody who wants to change theirs edits it rather
  -- than leaving a second, which is also what stops a single order becoming
  -- five stars four times.
  unique (order_item_id)
);

create index if not exists store_reviews_product_idx
  on store_reviews (product_id, status, created_at desc);

create index if not exists store_reviews_pending_idx
  on store_reviews (tenant_id, status, created_at desc);

drop trigger if exists store_reviews_touch on store_reviews;
create trigger store_reviews_touch
  before update on store_reviews
  for each row execute function touch_updated_at();

/*
 * Row level security.
 *
 * A stranger reads approved reviews and nothing else. Pending ones are somebody
 * else's words waiting on her, and hidden ones are the whole point of having a
 * hidden state, so both are invisible to the public rather than merely unlinked.
 *
 * Writing is not open to anon at all. The review form goes through an edge
 * function holding the service role, which checks the order reference and token
 * before it writes, for the same reason the checkout is the only thing that can
 * create an order.
 */
alter table store_reviews enable row level security;

/*
 * The grant, then the policy.
 *
 * A policy without a grant is a door with a lock and no handle: PostgREST
 * refuses before RLS is ever consulted, and the error says permission denied
 * rather than no rows, which is a different bug to chase. Select only for anon,
 * and no insert at all, because the review form goes through an edge function
 * that checks the order reference and token first.
 */
revoke all on store_reviews from anon, authenticated;
grant select on store_reviews to anon;
grant select, insert, update, delete on store_reviews to authenticated;

drop policy if exists store_reviews_public_read on store_reviews;
create policy store_reviews_public_read on store_reviews
  for select to anon
  using (status = 'approved');

drop policy if exists store_reviews_portal_all on store_reviews;
create policy store_reviews_portal_all on store_reviews
  for all to authenticated
  using (has_tenant(tenant_id)) with check (has_tenant(tenant_id));

comment on table store_reviews is
  'One review per order line. There is no route from a product page to a review form: the only way in is the reference and token from the confirmation email, which is what makes the rating on a product page a fact rather than a decoration.';

/*
 * What a product page shows.
 *
 * A view rather than arithmetic in the browser, so the product page, the
 * portal and the schema markup cannot disagree about what four and a half
 * stars means. Approved only, which means an unapproved review changes no
 * figure anywhere.
 *
 * `null` rather than zero when there are none. A product with no reviews has
 * no rating, and a shop that renders 0.0 out of 5 on everything it has just
 * listed is telling customers its whole catalogue is bad.
 */
create or replace view store_product_ratings as
select
  p.tenant_id,
  p.id as product_id,
  count(r.id)::bigint as review_count,
  case when count(r.id) > 0
    then round(avg(r.rating)::numeric, 1)
  end as rating,
  count(r.id) filter (where r.rating = 5)::bigint as five,
  count(r.id) filter (where r.rating = 4)::bigint as four,
  count(r.id) filter (where r.rating = 3)::bigint as three,
  count(r.id) filter (where r.rating = 2)::bigint as two,
  count(r.id) filter (where r.rating = 1)::bigint as one
from store_products p
left join store_reviews r
  on r.product_id = p.id and r.status = 'approved'
group by p.tenant_id, p.id;

comment on view store_product_ratings is
  'Approved reviews only, aggregated per product. Rating is null rather than zero when there are none, because a product with no reviews has no rating and 0.0 out of 5 on a new catalogue reads as a shop telling customers its own stock is bad.';

grant select on store_product_ratings to anon, authenticated;
