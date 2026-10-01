-- 0119_listing_quantities.sql
-- The Listings page shows what is live and how it sells. Two things it needs were read from eBay and thrown away:
--   how many each active listing has left (GetMyeBaySelling QuantityAvailable), now kept on its traffic row;
--   which eBay listing each sale was on. external_sku holds her SKU when she set one, so the item number goes in a
--   column of its own, filled by the next sales pull (the portal's pull reads every order, so history fills too).

alter table ebay_traffic add column if not exists quantity_available integer;

alter table channel_sales add column if not exists listing_id text;
create index if not exists channel_sales_listing on channel_sales (tenant_id, listing_id) where listing_id is not null;
