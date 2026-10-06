# Amazon pages with no main price: the sellers' list

5 October 2026. `ck-amazon-offers.zip`.

## Why
41 approved cards still showed no Amazon price after reading again. Their pages have no Buy Box ("No featured offers available"); the only offers are under "See all buying options". Axesso's product reader returns nothing for these (`seen` was all zeros). Examples: LEGO City F1 (39 offers, £27.99 sent by Amazon for other sellers), Firehawk FHB10 (one offer, Semantic UK, 66% positive, £21.99), Luceco 2D lamp (one offer, Electrical Merchant, 71%, £21.50).

## What it does
- When a reading comes back with no price, Axesso's offers reader (`axesso_data~amazon-product-offers-scraper`, activated by Joseey) reads page one of the sellers' list, for those pages only. From $0.35 per 1,000 offers.
- Rule, decided 5 October:
  - new only;
  - a seller under 80% positive is never her supplier; a seller with no rating counts only when Amazon sends it;
  - the cheapest with postage, but one Amazon sends wins when it is within 10% of that.
- The pick becomes the reading's price, seller and sender. The cost follows it as any Amazon price does, and the card prices from it (Amazon always, Joseey 5 October).
- The card says so: "No main offer on Amazon: the price is the best of N sellers", and "Sold and sent by X (85% positive), not Amazon" when it is not sent by Amazon.
- None good enough: no price, and a red warning names the cheapest refused seller and its rating.
- Runs everywhere the Amazon reader runs: Read again (one or bulk), the morning check, Keeper's Amazon steps.

## Deploy
1. No SQL.
2. `supplier-read`, `keeper-run`, `ebay-match` (all import `_shared/amazon.ts`).
3. Portal: `src/lib/supplierWatch.js`.

## Tests
`_shared/amazon_offers_test.ts`: 6 pass (floor, used ignored, Amazon within 10%, unrated, reading marked, second call only for priceless pages). Keeper's source, ready and review tests still pass.
