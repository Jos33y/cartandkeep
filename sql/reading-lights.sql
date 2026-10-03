-- The two reading lights, into Lighting (Google: Home & Garden > Lighting > Lamps, 4636), saved as checked by hand.
-- Run 1 first and check it lists exactly the two lights and that "to" names your Lighting section. Then run 2.

-- 1. Preview: what moves, and where to.
select p.id, p.title, p.status, p.section as now_in, g.path as now_category,
       section_for_google(p.tenant_id, 4636) as to_section
from store_products p
left join google_categories g on g.id = p.google_category_id
where p.status <> 'archived'
  and p.title ~* '\y(reading|book)\s*(light|lamp)s?\y';

-- 2. Move them. The section comes from the Lighting branch; the shop's filter tabs follow by themselves.
update store_products p
set google_category_id = 4636,
    google_category_source = 'checked',
    section = coalesce(section_for_google(p.tenant_id, 4636), p.section)
where p.status <> 'archived'
  and p.title ~* '\y(reading|book)\s*(light|lamp)s?\y'
returning p.id, p.title, p.section, p.google_category_id;
