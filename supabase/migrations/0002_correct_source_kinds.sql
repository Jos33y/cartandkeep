-- 0002_correct_source_kinds.sql
-- AliExpress has an official Affiliate API, so it was never a scrape source.
-- Terapeak Product Research has been free to all sellers since 2021, so it does
-- not depend on a Store subscription.

update sources
set kind = 'api',
    notes = 'Open Platform Affiliate API. Manual review, roughly two days.'
where id = 'aliexpress';

update sources
set notes = 'Free to all eBay sellers via Seller Hub. No Store subscription needed.'
where id = 'terapeak_export';

update sources
set notes = 'Adds competitor tracking, Shopify spy and evergreen filters over Terapeak. No inbound API.'
where id = 'zik_export';
