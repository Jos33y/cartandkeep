-- The shortlist carries no image and no eBay category. Both come from a Browse
-- lookup against the reference listing. The category id is worth as much as the
-- picture, because it is what she has to pick when she lists.

alter table candidates
  add column ebay_category_id   text,
  add column ebay_category_path text,
  add column enriched_at        timestamptz;

comment on column candidates.image_url is 'gallery image from the reference listing, for identification only, not for reuse in her own listing';
comment on column candidates.enriched_at is 'last successful Browse lookup, so a rerun can skip what it already has';
