# Handoff: Coverage for the Google best sellers route

29 September 2026 · for the design chat · goes with `candidates-section-brief-2026-09-29.md`

Paste this with `NNNN_store_coverage.sql` and the Coverage page files (`CoveragePage.jsx` and its components) attached.

## Why

Coverage today shows one route: eBay queries through the gate (`research_queries`). Store cards come another way: Google Merchant Center best sellers, then a UK shop that stocks the product, then that shop's page checked, then the import. None of that shows. For Home & Garden alone, 26,534 ranked products led to 578 cards, and she cannot see why the rest stopped.

## What the database gives the page

**`store_coverage`**: one row per Google product per store batch.
- Identity: `key` (brand and title), `title`, `brand`, `gtin`, `query` (the card's `external_ref` when it became one), `candidate_id`.
- Trend: `rank` (best across the exports), `months` (how many exported periods it ranked in), `periods` (for example `M202511 M202512 M202608`), `season` (All year, Winter, Summer, Christmas, Halloween), `need` (safety, pest, damp, part and so on).
- Price: `google_min`, `google_max`; `cost`, `shop`, `shop_url` once a shop was seen.
- Where it stopped: `stage` and `reason`.

| stage | reason | Say it as | Whose limit |
|---|---|---|---|
| google | own_label | A shop's own brand: only that shop sells it | ours |
| google | not_shelf | Not a shelf product: plants, furniture, made to measure | ours |
| google | outside_price | Outside the £8 to £60 range | ours |
| shelf | not_seen | No UK shop on file stocks it | the market (the gap: shops to collect) |
| shelf | part_only | Only a part or refill of it was seen | the market |
| shelf | bigger_pack | Only a bigger pack was seen | the market |
| page | page_wrong | The shop's page is another product | the check |
| page | page_unsure | Could not be sure it is the same product | the check |
| page | page_gone, shop_blocked, page_unread | Page gone, shop blocked us, not read yet | the check |
| import | big_brand | A big brand the large shops fight over | ours |
| import | no_price, bigger_pack_page, over_20kg | No price on the page, a bigger pack on the page, over 20kg | ours |
| import | duplicate | Already in her queue under another card | ours |
| import | (none) | Confirmed, not imported | ours |
| sent | (none) | Sent to you | |

**`store_coverage_summary`** (a view): counts by `batch_id`, `stage`, `reason`, `season`, plus `ranked_more_than_once` and `searched_by_need`. Draw the funnel from this. Never page through 26,000 rows.

## What to build

- **A route switch on Coverage:** "eBay searches" (today's page) and "Google best sellers". Batches for the Google route are the store batches (`term` starting `store-`), named by their category.
- **The same funnel shape, new stages:** Ranked on Google → Worth a look (after our filters) → Stocked by a UK shop → Page checked → Sent to you, then her decisions, exactly as the eBay funnel ends (join `candidate_id` to `decisions`).
- **Why the rest stopped:** the same bar list, reasons from the table above, keyed "Our own limits" and "What the market said" as now.
- **The trend:**
  - a season filter (All year, Winter, Christmas and so on) that redraws the funnel;
  - "Ranked in 2 or more months" as a count on the Sent stage;
  - the Winter and Christmas products that were sent, as a short list: they need listing by late October.
- **The gap:** "No UK shop on file stocks it" is the biggest bar. Opening it lists the brands with the most unseen best sellers (group `not_seen` rows by `brand`). That list decides which shop to collect next.
- **A product's row opens its card** when `candidate_id` is set.

## Rules

- Counts come from the view; the page never counts rows itself.
- Reason codes are stored; the wording above lives in one map in the page code.
- The season is only as good as the exports: Winter and Summer are said only when both halves of the year were exported. Until last October to December is exported, most products read All year, and that is correct.
