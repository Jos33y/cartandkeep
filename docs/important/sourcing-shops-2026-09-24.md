# Where to look next

**Cart & Keep** · 24 September 2026 · internal

Two lists. The first is shops whose shelves hold forced-search products: things a buyer searches for by name because something broke or somebody needs help. The second is suppliers who ship straight to her buyer from UK stock.

Names marked **from memory** come from general knowledge, not a check. Shops change owners, close and block crawlers, so every one is probed before it is planned around. `node scripts/probes/shop-probe.mjs --base=<url>` settles each in about a minute.

---

## 1. Forced-search shops

"In the supplier list" means it is already in `docs/cksuppliers.csv`.

### Plumbing, electrical and DIY parts

The core of the category. Fill valves, cartridges, seals, fuses, hinges, fixings. Most offer collection within the hour, which suits buying after the sale.

| Shop | Where the name came from | State |
|---|---|---|
| screwfix.com | supplier list | answers, but its sitemap lists 599 category pages and no products; product data sits in page state. Needs its own reader |
| toolstation.com | supplier list | **collecting.** 35,744 product urls. Rate-limits at 4 workers (429); running at 2 workers, 800ms |
| wickes.co.uk | 8 September probe | **349 priced, 37,117 named from its sitemap.** Served empty pages from 4am to evening, answering again at 18:20. Running at 2 workers, 800ms |
| selcobw.com | supplier list | to probe |
| howetools.co.uk | supplier list | to probe |
| diy.com (B&Q) | from memory | 503 on everything, 24 September. Try again another day |
| plumbbase.co.uk | from memory | to probe |
| cityplumbing.co.uk | from memory | to probe |
| cef.co.uk | from memory | to probe |
| tlc-direct.co.uk | from memory | to probe |
| robertdyas.co.uk | supplier list | refused 8 September |

### Appliance spares

Replacement belts, filters, seals and bulbs for named machines. The model number is the search.

| Shop | Where the name came from | State |
|---|---|---|
| espares.co.uk | from memory | to probe |
| partmaster.co.uk | from memory | to probe |

### Care, mobility and daily living aids

Where four of the ten products that ever sold on her store came from.

| Shop | Where the name came from | State |
|---|---|---|
| boots.com | from memory | refused, Incapsula bot wall |
| completecareshop.co.uk | from memory | **collected, 1,952 products.** Shopify. Tags its CareCo lines `Dropship`, so CareCo dispatches for sellers |
| careco.co.uk | from memory | refused, 403. Approach for a trade account instead: it dropships for Complete Care Shop |
| mobilitysmart.cc | from memory | to probe |
| garden.co.uk (Garden Pharmacy) | supplier list | answered 8 September, prices not read. To probe |
| savers.co.uk | 8 September probe | **collected, 6,432** |

### Pets

Where Cesar and the Dentastix 105 were actually found for sale.

| Shop | Where the name came from | State |
|---|---|---|
| petsathome.com | from memory | to probe |
| petshop.co.uk | seen selling Dentastix 105 at £16.49 | to probe |
| vetshop.co.uk | seen selling Dentastix 105 at £16.49 | to probe |
| zooplus.co.uk | supplier list | answered 8 September. To probe |
| tack24.co.uk | supplier list | to probe |

### Caravan, camping and pond

Replacement pumps, fittings and parts for equipment people already own.

| Shop | Where the name came from | State |
|---|---|---|
| towsure.com | from memory | to probe |
| leisureshopdirect.com | from memory | to probe |
| maidenhead-aquatics.co.uk | from memory | to probe |
| swelluk.com | from memory | to probe |

### Garden, security and car care

| Shop | Where the name came from | State |
|---|---|---|
| longacres.co.uk | supplier list | to probe |
| garden4less.co.uk | supplier list | to probe |
| safe.co.uk | supplier list | to probe |
| kmsdirect.co.uk | supplier list | answered 8 September. To probe |
| halfords.com | from memory | to probe. Car care only: parts that fit a named vehicle are car sizing and stay out |

---

## Collected so far

State at 24 September 2026, evening. Nothing here is a guess; counts are the lines in each shelf's `.jsonl`.

| Shop | Products | How | Barcodes |
|---|---|---|---|
| B&M | 10,416 | pages | no |
| Savers | 6,432 | pages | no |
| QD Stores | 4,717 | Shopify feed | no |
| Home Bargains | 4,460 with seasonal | page data | no |
| The Works | 3,386, UK pages only | pages | in the SKU, where it passes the checksum |
| Complete Care Shop | 1,952 | Shopify feed | no |
| Poundland | 1,487 | Shopify feed | yes |
| Toolstation | 1,118 so far, of about 35,700 | pages, running | no |
| Wickes | 349 priced, 37,117 named | pages, then its sitemap | no |
| **Total priced** | **about 34,300** | | |

Refused: The Range, Superdrug, Boots, CareCo, and B&Q for now.

### Where the records are

| What | Where | Re-creatable |
|---|---|---|
| Every product, written as it is fetched | `research/shelf/shelf-<shop>.jsonl` | yes, slowly: Wickes and Toolstation both rate-limit |
| The same as a table | `research/shelf/shelf-<shop>.csv` | from the `.jsonl` |
| Each shop's sitemap list | `research/shelf/<shop>-urls.txt` | yes |
| Names read from a sitemap, no pages fetched | `research/shelf/shelf-<shop>-names.csv` | yes, in seconds |
| Every gate verdict | `research/gates/*.csv` | **no, it cost eBay calls** |
| Every listing the gate read | `.gate/*.json` | **no, it cost eBay calls** |
| What was checked and why it stopped | the portal's Coverage page | from the gate files |

`research/` is kept out of version control. The shelves can be collected again; the gate files and snapshots cannot, so those two folders are backed up separately.

To count the shelves at any time:

```powershell
Get-ChildItem research\shelf\shelf-*.jsonl | ForEach-Object { '{0,-40} {1}' -f $_.Name, (Get-Content $_.FullName).Count }
```

### eBay, so far

| | Count |
|---|---|
| Queries checked | 1,000 |
| Sent to her | 93 |
| Waiting for review | 72 |
| Approved | 3 |
| Live | 1 |
| Rejected | 17 |

The slow step is eBay, not the shelves: 5,000 calls a day clears three or four 450-query files. Application Growth Check 260923-000021 asks for 25,000.

---

## 2. UK suppliers that ship to her buyer

eBay permits a **wholesale supplier** dispatching to her buyer. It does not permit a **retailer** doing it, so none of the shops above can ship to her customer; she buys from them and posts herself.

Every row in the supplier list reads `not applied`, with no terms, feed or neutral-packaging answer recorded. So nothing below is set up yet, and each needs an account, their terms, and a yes to three questions before it is used:

1. Is the stock held in the UK?
2. Do they ship in plain packaging with no invoice or their branding?
3. Do they publish a product feed, so matching can be automatic?

### Trade dropship suppliers in the supplier list

| Supplier | Domain | Categories | Note |
|---|---|---|---|
| Dropshiptraders | dropship-traders.co.uk | Beauty, DIY, Electronics and more | |
| Geko Products | dropship.gekoproducts.co.uk | DIY, Garden, Home | fits the parts and tools side |
| UKSM Trade | uksmtrade.co.uk | DIY, Home, Tools | fits the parts and tools side |
| TB Trade | tbtrade.co.uk | Building, DIY, Home | fits the parts and tools side |
| GoDropship | godropship.co.uk | Beauty, DIY, Electronics and more | |
| DK Wholesale | dkwholesale.com | Beauty, Decor, Gifts | |
| Manchester Wholesale | m8w.co.uk | Beauty, Fashion, Gifts | |
| Puckator | puckator-dropship.co.uk | Decor, Gifts, Home | gifts, seasonal |
| Ancient Wisdom | aw-dropship.com | Beauty, Gifts, Health | gifts |
| XTrader | xtrader.co.uk | listed as Electronics, Home, Tools | check the range before applying: this may be an adult-products supplier, which is an account risk |
| DropXL | b2b.dropxl.com | Furniture, Home | vidaXL's dropship arm. Check where UK orders ship from |
| CJ Dropshipping | cjdropshipping.com | wide | API access disabled. Mostly China stock, so out under the UK-only rule unless a UK warehouse covers the product |

### Retailers in the list that also run a dropship programme

These sell to the public, and some also run a separate programme for sellers. Only the programme, not the shop, can ship to her buyer. Check each has one before counting it.

| Supplier | Domain |
|---|---|
| vidaXL | vidaxl.co.uk |
| Aosom (HOMCOM brand) | aosom.co.uk |
| Costway | costway.co.uk |
| VonHaus, VonShef | vonhaus.com, vonshef.com |

### Not in the list

| Supplier | Note |
|---|---|
| Avasam | from memory. A UK marketplace of dropship suppliers, one account covering many. Worth checking first |

### Out, under the UK-only rule

AliExpress, Banggood, LightInTheBox, MiniInTheBox and SaleYee ship from China.

---

## Order of work

1. Probe the rest of the forced-search shops. Plumbing and care are done: Toolstation, Wickes and Complete Care Shop answered; Screwfix needs its own reader.
2. Apply to the three trade suppliers that fit the parts side: Geko, UKSM Trade, TB Trade. Record their answers to the three questions in `cksuppliers.csv`.
3. Once a supplier publishes a feed, match it against the candidates the same way the shelves are matched now, so a candidate can arrive with both a shelf to buy from and a supplier to ship from.
