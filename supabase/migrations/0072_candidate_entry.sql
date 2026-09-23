-- The test that decides whether she can enter a market is the smallest seller
-- who is actually selling on it, and there is no column for it.
-- same_sku_sellers and seller_concentration answer how crowded a market is,
-- which the audit already showed is a different question: a 628 feedback seller
-- took 68 units in 13 days against 3,869 competing listings.
--
-- Owned by import-gate.js. Null where no listing in the sample was both young
-- enough and small enough to prove anything, and null is the honest answer
-- there rather than the largest seller stood in for the smallest.
--
-- Price and rate come off the same listing as the feedback score. Pairing one
-- listing's price with another listing's volume is the error that produced the
-- £652 diesel pump, so the whole object is written together or not at all.

alter table candidates
  add column if not exists entry jsonb;

comment on column candidates.entry is
  'seller_feedback, price, sold_lifetime, age_days, per_day, item_id, image_url, '
  'checked_at. All from one listing. The smallest-feedback seller in the sample '
  'who is selling. per_day is lifetime sold over listing age and is null under '
  '7 days, where a rate is noise.';

-- The market read the gate produces and the Terapeak route does not: how many
-- are competing, on what query, and what the sample cost. competition already
-- exists for the Browse read from check-competition.js and carries the same
-- shape, so the gate writes into it rather than beside it.

comment on column candidates.competition is
  'Browse read: query used, sample size, median, low, high, band, checked_at. '
  'Band is the interquartile range over the median: under 0.15 sellers have '
  'converged and there is no room to position on anything but price. '
  'Written by check-competition.js or by import-gate.js, whichever ran last.';
