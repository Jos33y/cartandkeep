# Change price on Listings

4 October 2026. `ck-price-change.zip`. The groundwork for Keeper task 04, "Find it cheaper".

## What Joseey asked
- Price changes are manual for now. Keeper finds, she presses Update.
- Every eBay listing, not only the 8 listed from Cart & Keep; the "Listed from Cart & Keep" chip still shows which.
- The price only: "to avoid affecting every other changes and also makes it easier for keeper to handle later". Title and description changes come later.
- Both prices follow the cost. Lowering for more sales is her call, so both choices are shown and she picks.

## What it does
- **Change price** on every row in Listings: in the eBay panel, or in the shop panel for a shop-only product.
- **eBay route:**
  - A listing published from Cart & Keep has an offer, and its price is changed on the offer (`bulk_update_price_quantity`, price only). eBay does not let Trading calls revise these.
  - Any other listing goes by item number with `ReviseInventoryStatus`, which changes the price and nothing else.
- **Shop:** `store_products.price`. A was-price (`compare_at`) under the new price is refused with a message rather than cleared, since a was-price is her legal claim. Options with their own price keep it, and the result says so.
- **Pricing:** `src/lib/repricing.js` works both prices out from the card through `assess`.
  - eBay from eBay's fees and postage; the shop from the card fee, with the parcel band from the card's weight.
  - Two picks per channel: "Lowest with your profit" (the floor) and "As it is", each with what it keeps.
  - "Try another cost" shows the prices at another cost. It is kept with the change, never saved to her suppliers.
  - A Seller Hub listing has no card, so it shows eBay's fee alone.
- **After a change:** the row shows the new price at once. The function also writes it to the latest `ebay_traffic` row and to `candidates.ebay.price`, so a reload agrees before the next morning's pull.
- **Log:** every change is kept in `price_changes` (0141), failures too: channel, old and new price, cost, choice (floor, kept, typed), route, by her or Keeper. "Find it cheaper" will read this to learn what a price change did to views and sales.

## Deploy
1. SQL: `0141_price_changes.sql`.
2. `supabase functions deploy price-change --project-ref vtdqrhkjdzkdjmyxrsok`
3. Portal.

## Tests
- 0141 run twice on Postgres; its test twice (insert, zero price refused, bad channel refused).
- `price-change/index_test.ts`: 6 pass (price rounding, XML is price only, eBay answers, route by offer or item number, shop was-price guard).
- Panel rendered at desktop and phone width and checked for legibility.

## Confirmed
- 4 October: the massage gun (318942398301, listed from Cart & Keep, so by its offer) went from £27.49 to £28.50 on eBay.
- First deploy failed with `net::ERR_FAILED`: the function only served under `import.meta.main`, which is false on Supabase. Fixed in `ck-price-change-fix.zip`. The logic now sits in `price.ts` and `index.ts` always serves. Never guard `Deno.serve` in an edge function.
- Same day: a Seller Hub listing (Namvo broadheads, 318730985686, by item number) and its shop price both went from £8.48 to £9.48. Every route confirmed.

## Not yet
- A listing with variations on eBay needs a price per option. eBay refuses the item-number call for those, and the refusal is shown.
- Keeper filling in the price (task 04).
