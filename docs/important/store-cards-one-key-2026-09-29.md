# Store cards: one key, both directions, postage by weight, one price model

29 September 2026 · internal · decisions on the store and eBay pricing

## One key for a product

- `queryOf(title, brand)` in `scripts/store/match.mjs` is the only place a product's key is made. It is the store card's `external_ref`, the line in `research/queries/queries-store-<name>.txt`, and so the query the scan and gate read. The two imports join on this key.
- Shape: brand (two words at most) plus model when there is a real model. Otherwise brand plus the first three words that name the thing. Sizes, colours, sales words and anything after a dash, bar, comma, bracket, colon or "with" are left out. Size ranges (40-50cm), "6-in-1", dB/mAh/lm figures and the brand's own name do not count as models.
- On the August export, 99.99% of queries are five words or fewer. The old version made 2,065 queries of six or more words.
- Scan the query file as written. Do not redraft lines by hand: a changed line no longer joins its store card.
- Two products that draft the same query share one card; the better placed one keeps it. store-picks prints how many.
- Assumption: scan and gate carry each query through unchanged (the comment after `#` is dropped).
- Known limit: eBay cards drafted by the shelf drafter for products without a model use other wording, so some products can show as two cards. Measure after the first import before building a separate product key.

## Joins in both directions

- A gate pass on a store card adds eBay (import-gate, as before).
- A store pick whose key is already an undecided eBay card: that card gains the Shop label. It gets the store margin, with its eBay reading kept under `margin.ebay`, and it stays in its eBay batch. It carries `margin.store_import` = the store term, so the next store import refreshes it.
- Re-importing a store batch keeps the eBay label and reading the gate added. Re-importing a gate batch keeps the store figures on any card that has them and refreshes only the eBay reading.
- Decided cards are never touched, in either direction.

## One price model: `src/lib/pricing.js`

The portal and every script read this one file, so the card and the scripts cannot disagree.

**Cost**
- The cost is the cheapest real price. On a store card that is the price where it was seen, or a supplier she added. On an eBay card it is the shelf price when the match is the same product and pack, or a supplier she added.
- A seen price that is not matched to the eBay seller's pack is shown as a lead. The card offers "Same item, use £x as my cost", which saves it as a supplier.

**Forward path: a real cost is known**
- Floor = (cost + per-order costs + profit) / (1 - the channel's percentage fees), rounded up to .49 or .99.
- It lists at the market price when that clears the floor, otherwise at the floor.
  - Store: the market price is Google's lowest.
  - eBay: the market price is the small seller converting when trusted, otherwise the median.

**Market path: eBay, no real cost yet**
- The goods are taken to cost everything the market price leaves after fees and postage at no profit ("the most the eBay price allows").
- The price is built from that, so it sits above the market price by about profit / 0.842.
- The card shows this in amber: "Priced as if it costs £x, the most the eBay price allows. Price it at <shop> to bring this down."
- The figure is never stored or treated as a cost: `a.goods` stays empty, so the shop listing and approval steps never see it.

**Profit steps**
- Store: £2 under £15, £3 from £15.
- eBay: £3 under £15, £4 from £15 to £30, £5 over £30.
- Keeper may later suggest up to £10, never below the floor.

**Position against the market, no lanes**
- Each card has one line saying where its price sits: green when in the market, amber when over it.
  - Store: against Google's lowest.
  - eBay: against the median and the cheapest converting seller.
- The "Above the market" store lane is removed.

**The card header**
- Store: Google rank; List at, with its position; You keep a sale, with the cost.
- eBay: Sold a month; List at, with its position; You keep a sale, with the cost or "if it costs £x or less".
- "No cost yet", "Needs a cost" and "buy under" are gone.

**Worked check**
- Cesar at a £15 cost, eBay: floor £26.99 on the £4 step. She had moved it from £17 to £27 herself.
- Bosch laser level, no cost, converting at £109.99: lists at £115.99.

## Postage by weight

- **Store, Royal Mail Tracked 48** online prices from royalmail.com on 29 Sept 2026:
  - Small parcel to 2kg (45x35x16cm): £3.65 + £0.30 packing.
  - Medium parcel to 10kg (61x46x46cm): £7.35 + £0.50.
  - Medium parcel to 20kg: £11.85 + £0.60.
  - Over 20kg: left out of the import.
- **eBay, the gate's Evri bands** by weight:
  - To 5kg: £2.62 + £0.40.
  - 5 to 10kg: £5.87 + £0.50.
  - 10 to 15kg: £9.01 + £0.60.
  - Over 15kg: Royal Mail medium parcel to 20kg.
  - This applies when the store card knows the weight. Without it, the gate's run band stands.
- **Where the weight comes from:** the heaviest weight any matching shop gives (grams, weight_g or weight column). Failing that, a weight stated in the title, ignoring capacities ("up to 150kg").
- **No weight:** the card is costed as the smallest band and carries a note, which does not block "ready".
- Size is not on file, so a light but long product can still need a medium parcel.
- store-picks prints the median weight per shop, so a unit error shows (as with Festive Lights' prices).

## Prices read from shop pages

- `scripts/store/page.mjs` is the one page reader, used by check-picks and fill-costs.
- VAT: CPC, Farnell, RS, CEF and TLC pages, or any page whose structured data says VAT is not included, gain 20%.
- Price fallbacks when structured data has none: meta tags, itemprop, Magento's `data-price-amount` (Harts of Stur), and a GBP "price" field in page data (Studio).
  - These patterns are not yet confirmed against the live pages.
- check-picks reads a page again when an earlier run got its name but no price.
- `scripts/fill-costs.mjs` fills prices on eBay cards seen at sitemap-only shops. It then re-checks the match with the brand and barcode read from the page.
- A card whose match becomes the same product and pack moves to the forward path. The rest keep the price as a lead with the one-click confirm.
- CPC blocks the page reader (403 on all 61 links in the 29 Sept run), so CPC costs come only from the one-click confirm or a supplier she adds.

## Page check, first full run (29 Sept 2026, 3,770 Home & Garden picks)

**Verdicts**
- As run: 1,123 confirmed, 2,521 unsure, 57 wrong, 61 blocked (all CPC), 8 page gone.
- A sample of the unsure matches showed they are mostly different products (a David Austin rose against a children's book). Keeping them out of the import is right.

**Rules added after sampling the confirmed matches**
- About 1 in 4 of a sampled 25 "confirmed by name" were wrong: Stihl PG 10 against PG 20, Philips 5000 Series against 7000, set of 2 against set of 3, NOPE! CP against CT, Miele GN bags against CO.
- Whole numbers must match. A number shown anywhere on the page counts (iCON15, 23cm, 10-Year); a different number means wrong. Decimals, fractions and "2 in 1" are ignored.
- Short capital codes in Google's title (CP, GN, PG) must appear on the page.
- Rechecking the same file moves 46 confirmed to wrong or unsure; confirmed goes from 1,123 to 1,051.

**What the import would bring**
- 357 cards: confirmed, with a price, and not a big brand without a need.
- 62 of those are need products (safety 24, part 16, then damp, plumbing, pest).
- Harts of Stur (236) and Studio (219) pages gave names but no price. The new fallbacks target these.

## Finding: retail cost does not clear Google's price

At the price seen in UK shops:
- Only 20 of 357 store cards clear Google's lowest price.
- The median floor is 67% above Google's lowest. Only 3 of 62 need products are in the market.
- Buying at retail after the order cannot compete on the store for most products.
- For the median product, the cost has to fall to about half the shop price to list at Google's lowest. That is trade-account territory (see `store-trade-routes-2026-09-29.md`), which is where "Found it cheaper" pays.

**Caveat**
- Google's lowest is the item price. Many of those sellers add delivery below a spend threshold, so the real gap for a shopper can be smaller than the figure shows.

## Open

- Store every price change she makes (suggested, set, sold) so the profit steps can be tuned from real results.
- Festive Lights prices are stored at a thousandth; fix the collector before November.
- store-picks takes the cost from the best-matched shop, not the cheapest matching one. Taking the cheapest barcode or model match would lower some costs.
