-- tenant_sources held one row, the supplier. So every batch ran supply-first by
-- configuration even after the code was corrected, and the portal reported to
-- the client that the research runs on a supplier catalogue.
--
-- Weights are per source confidence, not importance. Terapeak is eBay's own
-- transactional record, so it carries the most; CJ describes its own warehouse
-- and carries the least.

insert into tenant_sources (tenant_id, source_id, enabled, weight, config)
select t.id, v.source_id, v.enabled, v.weight, v.config
from tenants t
cross join (values
  ('terapeak_export', true,  1.000, '{"role":"discovery"}'::jsonb),
  ('ebay_browse',     false, 0.900, '{"role":"enrichment"}'::jsonb),
  ('zik_export',      true,  0.700, '{"role":"discovery"}'::jsonb),
  ('csv_export',      false, 0.600, '{"role":"discovery"}'::jsonb)
) as v(source_id, enabled, weight, config)
where t.slug = 'cart-and-keep'
  and exists (select 1 from sources s where s.id = v.source_id)
on conflict (tenant_id, source_id) do nothing;

-- Browse stays disabled until the production keyset is active. Enabling it
-- before then means a failing source on the client's status readout every run.
