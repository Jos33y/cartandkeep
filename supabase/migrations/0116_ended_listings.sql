-- Ended listings on the Traffic page.
--
-- The traffic pull asked eBay for her active listings and fetched traffic for
-- those, so a listing that sold out and ended left the page with its views and
-- sales, and the page showed only what was still up. Now listings that ended
-- inside the window are pulled too. `ended_at` says when; null is still live.
-- `quantity_sold` is eBay's own count of units sold on the listing over its
-- life, so a sold-out listing reads as one worth putting back up.

alter table ebay_traffic add column if not exists ended_at timestamptz;
alter table ebay_traffic add column if not exists quantity_sold integer;

comment on column ebay_traffic.ended_at is
  'When the listing ended, for a listing that ended inside the window. Null for a listing still live, and on the account total.';
comment on column ebay_traffic.quantity_sold is
  'Units sold on the listing over its whole life, as eBay counts them. Set on ended listings.';
