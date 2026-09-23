-- CJ returns listedNum, how many sellers already list a product, which is
-- saturation evidence and the same shape as eBay listing depth.
update sources
set provides = '{supply,depth}',
    notes = 'listV2 with countryCode filter. Prices are USD. Goods cost only, freight is a separate endpoint.'
where id = 'cj_dropshipping';

-- Auth takes apiKey alone. Email is legacy and unused.
-- usdToGbp has no default on purpose: the adapter refuses to run without it
-- rather than invent a rate and quietly corrupt every margin in the batch.
update tenant_sources ts
set config = '{
      "countryCode": "GB",
      "size": 20,
      "usdToGbp": 0.79,
      "shippingEstimateGbp": 2.50,
      "freeShippingOnly": false,
      "maxPrice": 25
    }'::jsonb,
    credential_ref = '{"apiKey":"CJ_API_KEY"}'
from tenants t
where t.id = ts.tenant_id
  and t.slug = 'cart-and-keep'
  and ts.source_id = 'cj_dropshipping';
