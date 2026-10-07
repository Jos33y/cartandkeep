-- Step 2, after 0147 and 0148. Reads only. Run as one.
-- All three should be 0.
select
  (select count(*) from (select * from live_listings except select * from ck_check.listings_before) x) as new_rows_not_there_before,
  (select count(*) from (select * from ck_check.listings_before except select * from live_listings) x) as old_rows_now_missing,
  (select count(*) from pg_policies where schemaname = 'public'
     and (qual ~ 'has_tenant\(' or with_check ~ 'has_tenant\(')) as rules_still_row_by_row;
