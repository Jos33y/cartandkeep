-- Dog and cat is the right split for the market, but Dog Supplies currently
-- holds both beds and feeders and those are the two different propositions on
-- the screen. Longest prefix wins, so these override Dog and Cat where they
-- match and anything new in the tree still falls back to them.

insert into category_boundaries (tenant_id, ebay_path_prefix, label, agreed)
select id, v.prefix, v.label, true
from tenants
cross join (values
  ('Pet Supplies|Dog Supplies|Beds', 'Dog beds'),
  ('Pet Supplies|Dog Supplies|Dishes, Feeders & Fountains', 'Dog bowls and feeders'),
  ('Pet Supplies|Cat Supplies|Dishes, Feeders & Fountains', 'Cat bowls and feeders')
) as v(prefix, label)
where slug = 'cart-and-keep'
on conflict (tenant_id, ebay_path_prefix) do nothing;
