-- terapeak_export should read 1.2 alongside zik_export

select slug, jsonb_pretty(scoring -> 'weights') as weights
from tenants;


| slug          | weights                                                                                                                                                                           |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| cart-and-keep | {
    "aliexpress": 1.0,
    "met_office": 0.4,
    "zik_export": 1.2,
    "ebay_browse": 1.0,
    "google_trends": 0.8,
    "cj_dropshipping": 0.6,
    "terapeak_export": 1.2
} |