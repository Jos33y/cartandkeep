-- Counting stock.
--
-- Nothing on this project has counted anything. `stock` has been on
-- store_products since 0034 and is nullable on purpose, and nothing reads it,
-- writes it, or even selects it. That was fine while the whole catalogue was
-- her eBay listings, which she reorders. It stops being fine the moment she
-- adds a casserole dish she has one of.
--
-- Null means untracked and a number means she has that many. Only a number is
-- enforced, so all 78 seeded products behave exactly as they do today and
-- nothing about this migration changes the shop until she types a figure in.

/*
 * Applied on payment, not when a checkout session opens.
 *
 * Reserving stock at session creation would mean an abandoned basket holds her
 * last item hostage until Stripe expires the session, which is an hour. On a
 * shop selling ones and twos that trades a rare problem for a common one.
 *
 * The cost is that two people can pay for the same last item within the same
 * few seconds. That is allowed to happen, and it is reported rather than
 * prevented: refunding one of two buyers is a two minute job, and explaining
 * to somebody why the shop refused a sale of something that was actually on
 * the shelf is worse. `oversold` is what carries that back to her alert email.
 *
 * One statement rather than a read and a write. Two payments landing together
 * would both read three, both write two, and one sale would vanish. The
 * `returning` is what makes this atomic rather than merely quick.
 */
create or replace function apply_order_stock(p_order_id uuid)
returns table (product_id uuid, title text, remaining integer, oversold boolean)
language sql
security definer
set search_path = public
as $$
  with lines as (
    select oi.product_id, sum(oi.qty)::integer as qty
    from order_items oi
    where oi.order_id = p_order_id and oi.product_id is not null
    group by oi.product_id
  ),
  applied as (
    update store_products p
    set stock = p.stock - l.qty,
        -- Marked out of stock rather than left at zero, because the checkout
        -- already refuses `out_of_stock` and this keeps one rule in one place.
        availability = case
          when p.stock - l.qty <= 0 then 'out_of_stock'
          else p.availability
        end
    from lines l
    where p.id = l.product_id
      and p.stock is not null
    returning p.id, p.title, p.stock
  )
  select a.id, a.title, a.stock, a.stock < 0
  from applied a;
$$;

comment on function apply_order_stock is
  'Decrements tracked stock for one paid order in a single statement, and reports anything that went below zero. Untracked products, where stock is null, are left alone.';

-- Called by the webhook under the service role. Nothing else needs it, and a
-- browser that could call it could empty her shelves.
revoke all on function apply_order_stock(uuid) from public, anon, authenticated;
grant execute on function apply_order_stock(uuid) to service_role;

-- No grant needed for the portal to write stock. 0042 narrowed the grants on
-- `orders` only; `store_products` still carries a full table grant for
-- `authenticated` and the `store_products_authenticated_all` policy from 0034,
-- which is what every write on the products screen already goes through.
-- Checked rather than assumed, because a grant line that does nothing is worse
-- than none: it reads like a restriction that is not there.

comment on column store_products.stock is
  'Null means untracked and always sellable. A number is counted down on payment by apply_order_stock, and is allowed to go below zero so an oversell is visible rather than silently prevented.';
