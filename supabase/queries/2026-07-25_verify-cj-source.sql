-- config.usdToGbp must be present or the adapter refuses to run.

select ts.source_id, ts.enabled, ts.weight, ts.credential_ref,
       jsonb_pretty(ts.config) as config,
       ts.last_run_at, ts.last_status, ts.last_error
from tenant_sources ts
join tenants t on t.id = ts.tenant_id
where t.slug = 'cart-and-keep';


| source_id       | enabled | weight | credential_ref          | config                                                                                                                                                | last_run_at | last_status | last_error |
| --------------- | ------- | ------ | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ----------- | ---------- |
| cj_dropshipping | true    | 0.600  | {"apiKey":"CJ_API_KEY"} | {
    "size": 20,
    "maxPrice": 25,
    "usdToGbp": 0.79,
    "countryCode": "GB",
    "freeShippingOnly": false,
    "shippingEstimateGbp": 2.50
} | null        | null        | null       |