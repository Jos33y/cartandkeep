-- After 0002. aliexpress should read api, not scrape.

select id, name, kind, provides, notes
from sources
order by id;

| id              | name                      | kind   | provides                 | notes                                                                                                            |
| --------------- | ------------------------- | ------ | ------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| aliexpress      | AliExpress                | api    | ["demand","supply"]      | Open Platform Affiliate API. Manual review, roughly two days.                                                    |
| cj_dropshipping | CJ Dropshipping           | api    | ["supply"]               | UK warehouse stock and landed cost.                                                                              |
| ebay_browse     | eBay Browse API           | api    | ["pricing","depth"]      | Active listings. Available on the base developer tier.                                                           |
| ebay_insights   | eBay Marketplace Insights | api    | ["velocity"]             | Sold-listing velocity. Limited Release, rarely granted. Adapter exists so it can be switched on if access lands. |
| google_trends   | Google Trends UK          | scrape | ["demand","seasonality"] | null                                                                                                             |
| met_office      | Met Office                | api    | ["seasonality"]          | Seven day forecast for weather-driven categories.                                                                |
| terapeak_export | Terapeak export           | export | ["velocity"]             | Free to all eBay sellers via Seller Hub. No Store subscription needed.                                           |
| zik_export      | Zik Analytics export      | export | ["velocity","depth"]     | Adds competitor tracking, Shopify spy and evergreen filters over Terapeak. No inbound API.                       |