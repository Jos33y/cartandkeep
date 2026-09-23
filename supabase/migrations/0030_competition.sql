-- The live market read, from eBay Browse. Sold history answers whether people
-- are buying. It cannot answer how many other sellers are competing for the
-- same search, and two hundred sales across twenty listings is a different
-- proposition from two hundred across four hundred.
--
-- Owned by check-competition.js. active_listings and seller_concentration
-- already exist on the table and were never populated by the Terapeak route.

alter table candidates
  add column if not exists competition jsonb;

comment on column candidates.competition is
  'Browse read: query used, sample size, median, low, high, band, checked_at. '
  'Band is the interquartile range over the median: under 0.15 sellers have '
  'converged and there is no room to position on anything but price.';
