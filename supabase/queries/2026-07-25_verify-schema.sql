-- Sanity check after applying 0001_platform.sql

select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;

| table_name          |
| ------------------- |
| batches             |
| candidates          |
| decisions           |
| listing_performance |
| listings            |
| memberships         |
| platform_admins     |
| sources             |
| tenant_sources      |
| tenants             |

-- Every operational table must report rowsecurity = true
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;

| tablename           | rowsecurity |
| ------------------- | ----------- |
| batches             | true        |
| candidates          | true        |
| decisions           | true        |
| listing_performance | true        |
| listings            | true        |
| memberships         | true        |
| platform_admins     | true        |
| sources             | true        |
| tenant_sources      | true        |
| tenants             | true        |

select slug, name, currency, marketplace, fees, scoring from tenants;

| slug          | name        | currency | marketplace | fees                                                                                                                                      | scoring                                                                                                                                                   |
| ------------- | ----------- | -------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| cart-and-keep | Cart & Keep | GBP      | EBAY_GB     | {"ebay":{"pct":0.128,"fixed":0.3},"store":{"pct":0.015,"fixed":0.2},"tiktok":{"pct":0.065,"fixed":0},"payment":{"pct":0.029,"fixed":0.3}} | {"weights":{"aliexpress":1,"met_office":0.4,"zik_export":1.2,"ebay_browse":1,"google_trends":0.8,"cj_dropshipping":0.6},"min_signals":2,"margin_floor":4} |

select id, name, kind, provides from sources order by id;
| id              | name                      | kind   | provides                 |
| --------------- | ------------------------- | ------ | ------------------------ |
| aliexpress      | AliExpress                | api    | ["demand","supply"]      |
| cj_dropshipping | CJ Dropshipping           | api    | ["supply"]               |
| ebay_browse     | eBay Browse API           | api    | ["pricing","depth"]      |
| ebay_insights   | eBay Marketplace Insights | api    | ["velocity"]             |
| google_trends   | Google Trends UK          | scrape | ["demand","seasonality"] |
| met_office      | Met Office                | api    | ["seasonality"]          |
| terapeak_export | Terapeak export           | export | ["velocity"]             |
| zik_export      | Zik Analytics export      | export | ["velocity","depth"]     |
