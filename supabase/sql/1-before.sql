-- Step 1, before 0147 and 0148. Keeps a copy of what Listings shows now, to compare against after.
-- Kept in a schema the portal and the website cannot reach. Run it, then 0147 and 0148 straight after, before the next eBay traffic pull (it changes the figures).
create schema if not exists ck_check;
revoke all on schema ck_check from public, anon, authenticated;
drop table if exists ck_check.listings_before;
create table ck_check.listings_before as select * from live_listings;
select count(*) as rows_kept from ck_check.listings_before;
