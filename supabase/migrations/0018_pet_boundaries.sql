-- Dog and cat are different markets inside one tree. Dog bed cleared 65.2% of
-- units against the gate and cat bowl cleared 32.4%, so grouping them together
-- averages into a figure that describes neither.
--
-- Longest prefix wins at read time, so these sit alongside the coarse row and
-- override it where they match.

insert into category_boundaries (tenant_id, ebay_path_prefix, label, agreed)
select id, v.prefix, v.label, true
from tenants
cross join (values
  ('Pet Supplies|Dog Supplies', 'Dog'),
  ('Pet Supplies|Cat Supplies', 'Cat'),
  ('Pet Supplies|Small Animal Supplies', 'Small animals'),
  ('Pet Supplies|Bird Supplies', 'Birds'),
  ('Pet Supplies|Fish & Aquariums', 'Fish')
) as v(prefix, label)
where slug = 'cart-and-keep'
on conflict (tenant_id, ebay_path_prefix) do nothing;
