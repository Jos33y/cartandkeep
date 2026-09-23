# Which shops will talk to us

**Cart & Keep** · probed 8 September 2026 · `scripts/shelf-probe.js`

A point-in-time result, not a fact about each shop. Blocking changes, and a shop that answers today may not next month, so re-run the probe before planning a crawl rather than trusting this table. Nothing is collected by the probe; it asks for one page and counts the prices on it.

**14 of 28 returned a page with prices.**

---

## Answered

Sorted by how many prices came back on a single page. The count says that page had prices on it, not that the whole shop is crawlable. Home Bargains showed 61 here and then returned 18 items on the first real crawl, because its category links do not sit under the path the crawler expected.

| Shop | Prices | Response | Worth crawling for this model |
|---|---|---|---|
| matalan.co.uk | 181 | 200 | No, clothing |
| superdrug.com | 134 | 200 | Yes |
| qdstores.co.uk | 104 | 200 | Yes |
| savers.co.uk | 88 | 200 | Yes |
| homebargains.co.uk | 61 | 200 | Crawled. See the note below |
| zooplus.co.uk | 45 | 200 | No, online only |
| theworks.co.uk | 40 | 200 | Yes |
| kmsdirect.co.uk | 38 | 200 | No, online only |
| tesco.com | 32 | 200 | No, grocery |
| screwfix.com | 17 | 200 | Thin category pages, trade |
| toolstation.com | 6 | 200, 15s | Thin category pages, trade |
| poundland.co.uk | 5 | 200 | Yes, but the probe page was thin |
| wickes.co.uk | 5 | 200 | Thin category pages, trade |
| sainsburys.co.uk | 1 | 200 | No, grocery |

"Worth crawling for this model" means a shop she can walk into and buy from after something sells. Online-only shops break that, because stock has to be ordered and waited for.

## Refused

| Shop | Response |
|---|---|
| tofs.com | 403 |
| robertdyas.co.uk | 403 |
| ethicalsuperstore.com | 403 |
| therange.co.uk | 403 |
| wilko.com | 403 |
| argos.co.uk | 403 |
| dunelm.com | 406 |
| iceland.co.uk | 403 |
| groceries.asda.com | 403 |
| direct.asda.com | 425 |
| costco.co.uk | 404 |

The Range, Wilko, Argos and Dunelm all refused rather than being skipped. Worth re-probing occasionally, since a 403 is a decision a shop makes and can unmake.

## Answered, no prices found

garden.co.uk, homestoreandmore.co.uk, ocado.com. A page came back and the price selector matched nothing, which usually means prices are rendered after the page loads. Home Bargains turned out to be exactly that, and its data sat in a JSON blob on every page, so these three are worth a second look before writing them off.

---

## What this replaced

The starting point was a list of 73 trade and dropship suppliers. Only five overlapped with the shops that answered: Asda, Matalan, QD Stores, Screwfix and Toolstation. Two different lists for two different businesses. The supplier list is for buying wholesale; this one is for buying off a shelf at a price anybody can check.

## Home Bargains, as crawled

- Site redirects from `www.homebargains.co.uk` to `home.bargains`
- Every page carries its product data in a `__FLAREACT_DATA` JSON blob
- Categories come from `props.ui.menuHierarchy`, each with a cid and a slug
- 642 products collected across 58 categories, from 6 of 21 departments
- 30 categories returned exactly 20 items, which is a page size rather than a count, so those are truncated
- Some products have two pages under the same title at the same price, with different photographs and recipes. That is what put the wrong Cesar copy on a candidate, so deduplicate by title rather than by URL.

## Where this came from

The probe printed to a terminal and was never written to a file. This document is the record. If the probe is re-run, add a dated section rather than overwriting this one, so the direction of travel stays visible.
