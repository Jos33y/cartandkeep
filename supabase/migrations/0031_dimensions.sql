-- Real package dimensions, from the eBay seller's own listing.
--
-- The bulky flag is a word list guessing from titles and it is set on 101 of
-- 178 rows with no magnitude behind it. Postage is the largest unmodelled cost
-- in this batch: the band is decided by size rather than weight, and the jump
-- from large letter to small parcel is 80p while the jump to a courier is five
-- pounds on a product selling for twelve.
--
-- Owned by enrich-candidates.js. Null where the seller used flat rate postage
-- and never entered a size, which is most of them, and null is the honest
-- answer there rather than an estimate.

alter table candidates
  add column if not exists dimensions jsonb;

comment on column candidates.dimensions is
  'length_mm, width_mm, depth_mm sorted longest first, weight_g, package_type, '
  'source. Royal Mail bands: large letter 353x250x25mm and 750g, small parcel '
  '450x350x160mm and 2kg, medium parcel above that.';
