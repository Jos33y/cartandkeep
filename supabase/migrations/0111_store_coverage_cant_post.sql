-- Coverage gains a stop for products Royal Mail will not carry (compressed gas, flammable liquids, corrosives,
-- non-toiletry aerosols, fireworks): rules/post.mjs in the pipeline. Existing rows are unchanged.
alter table public.store_coverage drop constraint if exists store_coverage_reason_check;
alter table public.store_coverage add constraint store_coverage_reason_check check (reason is null or reason in (
  'own_label', 'not_shelf', 'restricted', 'cant_post', 'outside_price',
  'not_seen', 'part_only', 'bigger_pack',
  'page_wrong', 'page_unsure', 'page_gone', 'shop_blocked', 'page_unread',
  'big_brand', 'no_price', 'bigger_pack_page', 'over_20kg', 'duplicate'
));
