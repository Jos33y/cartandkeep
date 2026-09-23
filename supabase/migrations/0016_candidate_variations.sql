-- A listing with 237 variations reports one sold count and one average price
-- across every size and colour in it. Headroom computed from that average is a
-- blend, not a per-unit figure, and she cannot see that unless we say so.

alter table candidates add column variation_count integer;

comment on column candidates.variation_count is 'variations on the reference listing, so a blended average price is visible as blended';
