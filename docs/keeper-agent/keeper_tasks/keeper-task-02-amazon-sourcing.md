# Keeper task 02: sourcing candidates on Amazon

**Draft 4, 3 October 2026 (late)** | The Brick Dev Studios | Internal | Pass 1 built and proved on her data

Keeper goes through her Candidates, finds each product on Amazon UK, and every candidate with a 100% confirmed match gets its Amazon link and cost saved and moves to Approved, because it can be sourced. Read with keepr-agent-04.md (Parts 9, 11 and 14) and keeper-task-01-shop-drafts.md (how a Keeper run works).

**Built in two passes. Pass 1, by barcode alone, is built and proved** (Joseey, 3 October: "this should be the first one to test if its working").

---

## How she buys (Joseey, 3 October)

- **Amazon is her first source.** She buys on her ordinary **Prime** account, not Amazon Business.
- **Prime delivery to her is free,** and holding stock costs her nothing. She repackages in Cart & Keep packaging and posts to the buyer herself. This is the route eBay allows: she sends, not Amazon.
- **Not VAT registered** (well under the £90,000 threshold; GOV.UK). The public Amazon price with VAT is what she pays.

So, per unit:

- **Her cost** = the Amazon price shown today, deal or not (Part 14, version 3).
- **What a sale costs her on top** = her postage to the buyer and packing. The card's receipt already counts these (Evri by weight, packing).

## The decision this changes

keepr-agent-04 Part 9 says Keeper may not approve. **Joseey, 3 October:** Keeper approves a candidate when it can be sourced perfectly on Amazon. Nothing else changes: Keeper still never rejects, never publishes, never prices, never adds to the shop.

**No market or profit test for this approval.** A 100% confirmed match on Amazon is the bar. Joseey: "whether the cost price is way too high or not thats not what matter... we will deal with them in the approved page... we just want to approve all 100% confirmed products that are on amazon." The card still shows the market and what she keeps, and the go-live checks still hold a listing that would sell at a loss. Pricing stays hers.

---

## Pass 1: barcode only (built)

No Keeper judgement, no Claude. Only candidates with a barcode.

### The barcode

As `gtinOf` reads it (`src/lib/golive.js`): the first valid one of `margin.shelf.gtin`, `margin.cost_from.gtin`, `margin.gtin`, `listing.gtin`, `listing.ean`. Valid is 8, 12, 13 or 14 digits with a correct check digit. One difference: a value of 8 to 11 digits that pads to a valid 12-digit UPC counts (a UPC stored as a number lost its leading zeros: `10279904244` is `010279904244`). SQL `keeper_gtin` and TypeScript `keeperGtin` are kept the same by tests.

Measured 3 October (pending candidates, 3,622): 2,967 with a valid barcode (almost all in `margin.gtin`; 2,418 EAN-13, 546 UPC-12), plus 106 zero-dropped UPCs recovered, so about 3,073. 549 have none.

### Which Amazon result is the product (Joseey, 3 October)

1. **Search Amazon UK by the barcode** (Apify, `axesso_data/amazon-search-scraper`, one page, relevance order, sponsored results left out).
2. **One result:** it is the product. The barcode found it.
3. **More than one:** the title picks it. The result whose title carries the card's model number (LEGO's 77260), or most of the card's words, is the product. None matching: left.
4. **Only that page is read in full** (the product reader, Part 14).

Amazon's page need not print the barcode: most do not, and LEGO's never do. A page printing **another** barcode rules it out.

### Then, checked in code

- no other pack on the page ("Pack of 3", "24 x 330ml", a number of items over one the card's title does not have).

**That is the whole bar: the right product on Amazon** (Joseey, 3 October: "sourced on amazon whether amazon sends it or not will be determined when we get to approved"). Who sells and sends it, the stock, any delivery charge and the price do not stop the approval. They are saved and decided in Approved:

- **the supplier row** keeps who sells it, who sends it, the stock and Amazon's own words for it (`raw`), and another seller's delivery charge to her as the freight on her route, so the landed cost counts it;
- **no price** (no buy box, out of stock): the supplier is saved as `unavailable` with no cost, so nothing is priced from a guess; the 7am read quotes it again when a price comes back;
- **the card in Approved** warns "Sold and sent by Planszowski-co-uk, not Amazon, so delivery may not be free on Prime", and out of stock or slow to dispatch as before.

### Approved

As "Perfect, so approved" below, with a line that says what was found: "Found by its barcode on Amazon, £41.81, sold by Planszowski-co-uk, in stock" or "Same barcode on Amazon, £16.09, sold by Amazon, in stock".

### Anything else

Nothing found, more than one result and no title matching, another barcode, another pack: left in Candidates. **What was found is saved, so nothing is looked up twice to learn it:**

- a note on the card ("Keeper on Amazon, 3 Oct: Another pack on Amazon. Amazon's page is a pack of 3; this card is a single. https://www.amazon.co.uk/dp/..."), seen in Candidates;
- the full reading kept with the job.

A card Keeper has looked up is never taken by a run again. Ticking it and pressing Look up on Amazon, then "Look up again", is the only way, and is paid again.

### Proved on her data, 3 October

- **First run (the old rule):** 5 looked up for £0.05. 4 LEGO sets were found by their barcode but left, because the rule then also required Amazon's page to print the barcode. Wrong bar: the rule was changed that evening to the one above.
- **After the change:** 4 approved of 4 for £0.08 (Minecraft sticki rolls, LEGO 75444, 11506, 11504), and 4 of 5 in the run before it. Every approval was the right product.
- **Real cost:** about 2p a candidate, not under 1p: the search is paid per result ($10 per 1,000) and some barcodes return several. All 3,068 left: roughly £60.

## How she starts it (built)

- **Keeper's office, Amazon** (`/keeper/amazon`; the office has a Shop drafts / Amazon switch). How many: 5, 20, 50, 100 or all, the ones that would make the most a month first. Watch or normal pace, a spending limit. The in-tray, the desk (searching, reading, deciding), the out-trays, the log.
- **On Candidates:** a line under the header, "N candidates have a barcode Keeper can look up on Amazon", opens the office.
- **Ticked cards:** "Look up on Amazon" in the selection bar starts a run of those only. When none can be looked up, the bar says why, with counts ("2 were looked up already. 1 has no barcode. 1 is decided already."), and offers "Look up the 2 again" (paid again).
- **The report:** Sourced on Amazon, Left for the full check, Could not read; each line with Why and the Amazon page; **Undo the approval** on each of Keeper's, while it is still Keeper's and not on its way to eBay or the shop.

## Pass 2: the full check (after pass 1 is proved)

For what pass 1 left:

1. **Find it on Amazon UK:** brand with model, then the title. The best few results are read in full.
2. **Match, by the Part 11 rule:**
   - a shared barcode is certain;
   - another barcode, model number or pack size rules a result out, whatever else agrees;
   - otherwise Keeper judges from the facts (photos only when the words cannot settle it) and says how sure it is.
3. **Perfect** means: the same product and pack (95% sure or more, brand, model and pack size agreeing), on amazon.co.uk, new, in stock, and free delivery to her (or delivery added to the cost).
4. **Close, not perfect:** stays in Candidates with the Amazon product beside the card, how sure, and what is not confirmed ("pack of 2 here, 3 on Amazon"). One tap approves it on her say.
5. **Not on Amazon:** stays in Candidates with a note, for another supplier later.

**What it costs:** about 1.5p to 2p a candidate on top (estimate, to be measured).

---

## Perfect, so approved (both passes)

- **Her supplier:** Amazon, the plain product link (`/dp/<ASIN>`), sent by her (fulfilment `stock`, no freight or duty, so the landed cost is the Amazon price), confirmed, `matched_on 'keeper_barcode'`, `cost_by 'amazon'` so the 7am check follows its price.
- **The cost:** the price shown today, deal or not (Part 14, version 3), plus another seller's delivery charge to her when the page shows one. No price: `unavailable`, no cost.
- **The card:** the reading saved as `supplier_read` (the Amazon panel and the daily check start at once).
- **The decision:** approve, `made_by 'keeper'` (0133), with one line of reason. Every decision now says who made it: `her`, `keeper` or `studio` (a script or a studio account), and so does its history.

All of it in one database function, `keeper_source_approve` (0133), service only. A card with any decision on it is left alone.

## Built, and where

| Zip | What | SQL | Functions |
|---|---|---|---|
| `ck-keeper-amazon-2026-10-03` | The run, the office, the Candidates line, Undo; who decided; costs follow on her route; SHAVINGFUN's supplier | 0133, `shavingfun-supplier.sql` | `keeper-run`, `supplier-read`, `ebay-match` |
| `ck-keeper-amazon-match-2026-10-03` | One result is the product, more than one the title picks; the page need not print the barcode | `amazon-look-again.sql` | `keeper-run` |
| `ck-keeper-amazon-picked-2026-10-03` | Ticked cards; the office switch | 0134 | none |
| `ck-keeper-amazon-bar-2026-10-03` | The bar says why, with counts, readable; the bar's width on a phone | 0135 | none |
| `ck-keeper-amazon-deal-2026-10-03` | A deal price is a cost; a deal's end warned | none | `keeper-run`, `supplier-read`, `ebay-match` |
| `ck-keeper-amazon-polish-2026-10-03` | Keeper's approvals marked in Approved, its tab; copy; stamp; Undo | none | `keeper-run` |
| `ck-keeper-amazon-fill-2026-10-03` | The card filled from Amazon on approval (facts, link, packed weight); the packed weight rounding | 0136 | `keeper-run` |
| `ck-keeper-amazon-any-seller-2026-10-03` | Sourced whoever sells it; seller, stock, delivery saved; notes on cards left; reading kept | 0137 | `keeper-run`, `supplier-read`, `ebay-match` |

## Left to do

1. **Look up again** the cards left for stock or seller before this change (the 3 October run: 72156, 76345, 77259, 75421, 76334, 42676, Deadfast). Their readings were not kept then. About 1p each.
2. **Undo** has not been pressed on her data.
3. **Keeper's Get it ready** (task 03): to be dissected with Joseey.
4. **Then the rest** of the barcoded candidates, in runs. Measured: about 1.3p a candidate (20 for £0.26).

## Limits worth knowing

- **Her eBay limit** stays 300 listings a month, paced 20 a day by the queue. Approval has no cap (Joseey's flow); Approved may grow faster than she can list, and the strongest go first.
- **The public price** is what she pays on Prime; a better price she finds is hers to set with "Change the cost", and then it is never moved.
- **Brand risk** (agent-02, check 9) still applies: an Amazon match does not make a counterfeit-prone or enforcing brand safe.

## Afterwards

- **Approved (95):** the same matcher fills an Amazon supplier where a card has none.
- **Live products (106, 7 with a cost):** the same matcher fills their missing costs, with a supplier the morning check follows.
