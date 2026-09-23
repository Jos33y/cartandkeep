-- Everything a listing needs, read off the shop's own product page: images,
-- brand, description, features, the shop's category and its stock position.
-- One column rather than a dozen, because what eBay wants from it is still
-- settling and a jsonb blob does not need a migration each time it changes.
--
-- useCandidates.js and useApproved.js select an explicit column list, so this
-- has to be added to both. Without that line the card renders as though no
-- product page was ever read, the same way `entry` did in 0072.

alter table candidates add column if not exists listing jsonb;
