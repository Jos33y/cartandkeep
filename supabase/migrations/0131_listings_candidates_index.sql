-- Listings timed out ("canceling statement due to statement timeout", 3 October).
--
-- The plan of live_listings (3 October, 1.28 s as postgres, 50 rows) spent 0.9 s of it reading every candidate
-- (4,044 rows) to find the 3 whose eBay listing is live and not ended: a full scan that opens each card's `ebay`
-- record. Signed in, the portal runs that view three or four times at once (the page, its count, the tab counts),
-- each under the signed-in time limit.
--
-- An index on exactly that question: candidates with a live eBay listing, by shop and listing. The view's filter
-- (ebay->>'listing_id' is not null and ebay->>'ended_at' is null) matches the index's own condition, so the scan
-- reads the few cards that qualify instead of all of them. Nothing else changes.

create index if not exists candidates_ebay_live_idx
  on candidates (tenant_id, (ebay ->> 'listing_id'))
  where (ebay ->> 'listing_id') is not null and (ebay ->> 'ended_at') is null;

analyze candidates;
