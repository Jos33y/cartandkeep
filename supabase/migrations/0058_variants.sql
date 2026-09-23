-- One product, several of a thing.
--
-- "Size 5, 6 and 7" is three products sitting inside one title on her shop
-- today, and so is any bedding in a double and a king. This is the only item on
-- the build plan that is already wrong rather than absent: a buyer cannot
-- choose, she cannot count what is left of each, and the shop cannot refuse the
-- one that has run out.
--
-- A table rather than columns or a jsonb blob. A variant has its own price, its
-- own stock, its own barcode and sometimes its own photograph, and three of
-- those already exist as columns on store_products with checks on them.
-- Duplicating them into a document would mean apply_order_stock learning to
-- decrement inside jsonb, and the atomic single statement decrement that 0047
-- proved is worth more than the tidiness.
--
-- Nothing changes for a product without variants. No rows means the product's
-- own price and stock answer, exactly as they do today, which is what makes
-- this safe to ship against a catalogue of 78 mid week.

create table if not exists store_variants (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants (id) on delete cascade,
  product_id  uuid not null references store_products (id) on delete cascade,

  /*
   * One axis, free text.
   *
   * "Size 5", not "Size 5 / Blue". A second axis means a matrix, a matrix means
   * combinations that do not exist, and her catalogue today is single axis
   * throughout. If a two axis product ever turns up she types "Blue, size 5"
   * and everything below still holds.
   */
  label       text not null check (length(trim(label)) > 0),

  /*
   * Null means "the same as the product".
   *
   * Most variants differ only in stock. A king size duvet costing the same as a
   * double should not require the price typing twice, and a price copied into
   * every row is a price that goes stale in some of them the first time she
   * changes it.
   */
  price       numeric(10, 2) check (price is null or price >= 0),

  -- Same meaning as store_products.stock: null is untracked and always
  -- sellable, a number is counted down on payment.
  stock       integer,

  availability text not null default 'in_stock'
               check (availability in ('in_stock', 'low_stock', 'out_of_stock',
                                       'made_to_order', 'discontinued')),

  sku         text,
  gtin        text,

  -- Its own photograph when the colour differs, and the product's when it does
  -- not. Null rather than a copy, for the same reason as price.
  image_url   text,

  position    integer,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- Two sizes with the same name on one product is a chooser with two identical
  -- buttons, which is a support email rather than a sale.
  unique (product_id, label)
);

create index if not exists store_variants_product_idx
  on store_variants (product_id, position, label);

drop trigger if exists store_variants_touch on store_variants;
create trigger store_variants_touch
  before update on store_variants
  for each row execute function touch_updated_at();

/*
 * Read by a stranger, and the policy is the security boundary rather than a
 * formality.
 *
 * Scoped through the product, so a variant of a draft product is invisible for
 * the same reason the product is. Writing the condition here rather than
 * copying `status` onto the variant keeps one source of truth about what is
 * public, which is the thing that goes wrong when a product is taken down and a
 * denormalised flag is not.
 */
alter table store_variants enable row level security;

drop policy if exists store_variants_public_read on store_variants;
create policy store_variants_public_read on store_variants
  for select to anon
  using (exists (
    select 1 from store_products p
    where p.id = store_variants.product_id
      and p.status = 'live'
      and p.is_sample = false
  ));

drop policy if exists store_variants_portal_all on store_variants;
create policy store_variants_portal_all on store_variants
  for all to authenticated
  using (has_tenant(tenant_id)) with check (has_tenant(tenant_id));

comment on table store_variants is
  'A size, colour or pack size of one product, with its own price and stock. A product with no rows here behaves exactly as it did before variants existed.';

comment on column store_variants.price is
  'Null means the product price applies. Copying it into every row is how one of them goes stale the first time she changes the price.';

-- --- the order record --------------------------------------------------------

/*
 * Which one they bought, and what it was called at the time.
 *
 * `variant_id` is set null on delete for the same reason `product_id` is: an
 * order is a record of what happened and it has to survive a variant being
 * removed. `variant_label` is copied rather than joined, like the title and the
 * price already are, because an invoice that changes when she renames a size is
 * not an invoice.
 */
alter table order_items
  add column if not exists variant_id uuid references store_variants (id) on delete set null,
  add column if not exists variant_label text;

comment on column order_items.variant_label is
  'The variant name as it read when the order was placed. Copied, not joined, so renaming a size does not rewrite an old invoice.';

-- --- stock, applied to whichever row holds it --------------------------------

/*
 * Recreated to count down the variant when a line has one.
 *
 * `create or replace` cannot change a function's return type, and this one
 * gains a column, so it is dropped first. That trap has been walked into twice
 * on this project with views and it is the same rule for functions.
 *
 * Two statements rather than one, because they update two different tables.
 * Each is still a single statement over its own set, which is what keeps the
 * decrement atomic: two payments landing together cannot both read three and
 * both write two.
 */
drop function if exists apply_order_stock(uuid);

create function apply_order_stock(p_order_id uuid)
returns table (product_id uuid, title text, remaining integer, oversold boolean)
language sql
security definer
set search_path = public
as $$
  with variant_lines as (
    select oi.variant_id, sum(oi.qty)::integer as qty
    from order_items oi
    where oi.order_id = p_order_id and oi.variant_id is not null
    group by oi.variant_id
  ),
  variants_applied as (
    update store_variants v
    set stock = v.stock - l.qty,
        availability = case
          when v.stock - l.qty <= 0 then 'out_of_stock'
          else v.availability
        end
    from variant_lines l
    where v.id = l.variant_id
      and v.stock is not null
    returning v.product_id, v.label, v.stock
  ),
  /*
   * Product lines are the ones with no variant on them.
   *
   * A line carrying a variant must not also come off the product's own count,
   * or a single sale is subtracted twice. The variant is the thing being sold
   * and the product count is the fallback for products that have none.
   */
  product_lines as (
    select oi.product_id, sum(oi.qty)::integer as qty
    from order_items oi
    where oi.order_id = p_order_id
      and oi.product_id is not null
      and oi.variant_id is null
    group by oi.product_id
  ),
  products_applied as (
    update store_products p
    set stock = p.stock - l.qty,
        availability = case
          when p.stock - l.qty <= 0 then 'out_of_stock'
          else p.availability
        end
    from product_lines l
    where p.id = l.product_id
      and p.stock is not null
    returning p.id, p.title, p.stock
  )
  -- Named the way her alert email needs to read it: the product title, and the
  -- variant beside it when there is one, so "Bed sheet, king (-1 left)" says
  -- which one she has oversold rather than only that she has.
  select a.id, a.title, a.stock, a.stock < 0 from products_applied a
  union all
  select v.product_id,
         p.title || ', ' || v.label,
         v.stock,
         v.stock < 0
  from variants_applied v
  join store_products p on p.id = v.product_id;
$$;

comment on function apply_order_stock is
  'Decrements tracked stock for one paid order, taking it from the variant where a line has one and from the product where it does not, and reports anything that went below zero. Untracked rows, where stock is null, are left alone.';

revoke all on function apply_order_stock(uuid) from public, anon, authenticated;
grant execute on function apply_order_stock(uuid) to service_role;
