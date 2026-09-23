-- What happened when a candidate went up on eBay.
--
-- Approved has meant "decided and not yet listed" since it was built, and
-- nothing ever left it, so within a month it becomes a pile she cannot tell
-- apart from work already done. A row leaves the moment it publishes, and this
-- is what it leaves behind.

alter table candidates add column if not exists ebay jsonb;

comment on column candidates.ebay is
  'eBay publish result: sku, offer_id, listing_id, category_id, price, quantity, published_at. Null means not listed.';

-- The listings screen reads by presence, so it is worth an index rather than a
-- sequential scan of every candidate the pipeline has ever produced.
create index if not exists candidates_ebay_idx
  on candidates (tenant_id)
  where ebay is not null;
