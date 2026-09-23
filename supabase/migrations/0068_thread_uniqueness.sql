-- Two uniqueness rules the thread function assumes, made true by the database.
--
-- Written as a separate migration rather than folded into 0067 because 0067
-- has already run. Both are additions, neither rewrites a row.
--
-- The function reads an existing thread with `maybeSingle`, which throws on a
-- second row rather than returning one. Without these, two requests arriving
-- in the same second create two conversations about one thing, and from then
-- on every read of that thread is a 500. That is the failure mode worth
-- preventing: not the duplicate, the permanent error afterwards.

/*
 * An order has one conversation.
 *
 * Partial, because product and basket threads carry a null order_id and a
 * plain unique index would allow only one of those in the whole table.
 */
create unique index if not exists store_threads_one_per_order
  on store_threads (order_id)
  where order_id is not null;

/*
 * One open conversation per person per product.
 *
 * Somebody asking a second question about the same lamp is continuing a
 * conversation, not starting one, and she should not receive two threads about
 * one product from one address. Scoped to open, so a closed conversation does
 * not stop a new one months later.
 */
create unique index if not exists store_threads_one_open_per_product
  on store_threads (tenant_id, product_id, email)
  where product_id is not null and status = 'open';
