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
| toolstation.com | supplier list | **collected, 35,705 products.** Rate-limits above 1 worker; collected at 1 worker, 1s pause |
| wickes.co.uk | 8 September probe | **612 priced, 37,117 named from its sitemap.** Serves empty pages after about 260 pages at any speed tried, so collection stopped; prices are checked by link for the cards that pass |
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


### Care and daily living, for older buyers

Added 25 September. The category four of her ten early sales came from, and the one the care files proved again: 53 cards from two files.

| Shop | What it holds | Why it fits | State |
|---|---|---|---|
| essentialaids.com | thousands of daily living aids: grab rails, raised toilet seats, kitchen and dressing aids | the widest care catalogue in the UK, the same shape as Complete Care's best cards | **answered 25 Sept.** 6,600 urls, prices on the page. Collect with the page reader |
| abilitysuperstore.com | mobility, bathing, daily living | a second large care catalogue to price against | to probe |
| connevans.co.uk | hearing: amplified phones, flashing doorbells, TV listeners, vibrating alarms | "big button amplified phone" is an exact search | answered 25 Sept, but no sitemap of products and no product data on the page. Needs its own reader |
| medisave.co.uk | blood pressure monitors, pill organisers, thermometers | named health products an older buyer searches for | to probe |

### Household and gifts, for older buyers

Catalogues written for the same buyer, carrying household, care and Christmas in one place.

| Shop | What it holds | Why it fits | State |
|---|---|---|---|
| easylifegroup.com | problem-solver gadgets, mobility aids, winter warmers, Christmas gifts | household, care and seasonal for one buyer | answered 25 Sept, but its sitemap errors and product data comes from a search service. Needs its own reader |
| coopersofstortford.co.uk | household gadgets, garden, seasonal and Christmas | strong in the weeks before Christmas | refused, Cloudflare challenge |
| jmldirect.com | named "as seen on TV" household products | people search the product name they saw advertised | refused, Cloudflare challenge |
| studio.co.uk | household, Christmas decorations and gifts | mass-market Christmas, useful to compare against | to probe |
| lakeland.co.uk | kitchen and cupboard items, spare lids and parts for its own lines | named kitchen products; "Lakeland replacement lid" is a real search | **answered 25 Sept.** Shopify, about 12,000 products. Collect with the Shopify reader |

### Christmas, where the search is forced

Christmas listings need to be live by early November. Halloween, five weeks out, is too late to source, list and rank.

| Shop | What it holds | Why it fits | State |
|---|---|---|---|
| festive-lights.com | Christmas lights, replacement bulbs, fuses, connectors, tree stands | "replacement fuse for Christmas lights" is the something-broke search, every December | to probe |
| lights4fun.co.uk | fairy lights, battery candles, replacement parts | named, repeat buys; often Shopify | to probe |
| smyths-toys.com | toys and LEGO by set number | the largest named-product Christmas searches; worth buying only on offer | to probe |
| hobbycraft.co.uk | Christmas craft, advent kits, wreath supplies | named craft kits | to probe |

### More household parts

| Shop | What it holds | State |
|---|---|---|
| partmaster.co.uk, espares.co.uk | vacuum bags and filters, washer belts, oven bulbs, cooker hood filters, by model number | to probe (already listed above) |
| plumbworld.co.uk, plumbnation.co.uk | tap cartridges, fill valves, shower parts, by part number | to probe |
| bulbs.co.uk | bulbs by cap and fitting: GU10, B22, oven and fridge | to probe |

### Not worth probing for this buyer

Fireworks and sparklers are explosives. Costumes and clothing are sized. Perfume and aftershave gift sets are the most counterfeit-reported goods on eBay and are held back as account risk by the scan since 25 September.

---

## Collected so far

State at 25 September 2026, evening. Nothing here is a guess; counts are the lines in each shelf's `.jsonl`.

| Shop | Products | How | Barcodes |
|---|---|---|---|
| B&M | 10,416 | pages | no |
| Savers | 6,432 | pages | no |
| QD Stores | 4,717, not drafted yet: its marketplace titles need their own query rule | Shopify feed | no |
| Home Bargains | 4,460 with seasonal | page data | no |
| The Works | 3,386, UK pages only | pages | in the SKU, where it passes the checksum |
| Complete Care Shop | 1,952 | Shopify feed | no |
| Poundland | 1,487 | Shopify feed | yes |
| Toolstation | 35,705 | pages | no |
| Wickes | 612 priced, 37,117 named | pages, then its sitemap | no |
| **Total priced** | **about 68,900** | | |

Refused: The Range, Superdrug, Boots, CareCo, JML, Coopers of Stortford, and B&Q for now.

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

As the Overview read on 25 September, evening.

| | Count |
|---|---|
| Phrases scanned | about 5,000 |
| Waiting for her review | 178 |
| Approved | 13 |
| Live | 5 |
| Queries still drafted and unchecked | about 44,600 |

The slow step is eBay, not the shelves. 5,000 calls a day clears two 450-phrase files with their gates, about 60 to 70 cards. Application Growth Check 260923-000021 for more calls was **declined on 25 September**, so the order the files are scanned in is what decides how fast the best products are found.

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

1. Probe the care and older-buyer shops first, in this order: Essential Aids, Easylife, Connevans, JML, Coopers of Stortford, Lakeland. Then the Christmas shops, while there is still time to list before November.
   `node scripts/probes/shop-probe.mjs --base=<url>` settles each in about a minute.
2. Probe the rest of the forced-search shops. Plumbing and care are done: Toolstation, Wickes and Complete Care Shop answered; Screwfix needs its own reader.
3. Apply to the three trade suppliers that fit the parts side: Geko, UKSM Trade, TB Trade. Record their answers to the three questions in `cksuppliers.csv`.
4. Once a supplier publishes a feed, match it against the candidates the same way the shelves are matched now, so a candidate can arrive with both a shelf to buy from and a supplier to ship from.
