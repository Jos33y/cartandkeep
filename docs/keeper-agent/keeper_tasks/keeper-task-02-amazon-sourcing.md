# Keeper task 02: sourcing candidates on Amazon

**Draft 2, 3 October 2026** | The Brick Dev Studios | Internal | Not built

Keeper goes through her Candidates, finds each product on Amazon UK, and every candidate with a perfect match gets its Amazon link and cost saved and moves to Approved, because it can be sourced. Read with keepr-agent-04.md (Parts 9, 11 and 14) and keeper-task-01-shop-drafts.md (how a Keeper run works).

**Built in two passes. Pass 1, by barcode alone, is built and proved first** (Joseey, 3 October: "this should be the first one to test if its working").

---

## How she buys (Joseey, 3 October)

- **Amazon is her first source.** She buys on her ordinary **Prime** account, not Amazon Business.
- **Prime delivery to her is free,** and holding stock costs her nothing. She repackages in Cart & Keep packaging and posts to the buyer herself. This is the route eBay allows: she sends, not Amazon.
- **Not VAT registered** (well under the £90,000 threshold; GOV.UK). The public Amazon price with VAT is what she pays.

So, per unit:

- **Her cost** = the Amazon price only (with VAT, as the public page shows it).
- **What a sale costs her on top** = her postage to the buyer and packing. The card's receipt already counts these (Evri by weight, packing).

## The decision this changes

keepr-agent-04 Part 9 says Keeper may not approve. **Joseey, 3 October:** Keeper approves a candidate when it can be sourced perfectly on Amazon. Nothing else changes: Keeper still never rejects, never publishes, never prices, never adds to the shop.

**No market or profit test for this approval.** A perfect Amazon match is the bar. The card still shows the market and what she keeps, and the existing go-live checks still hold a listing that would sell at a loss. Pricing stays hers.

---

## Pass 1: barcode only (build and prove first)

No Keeper judgement, no Claude. Only candidates with a barcode.

1. **Search Amazon UK by the candidate's barcode** (an EAN or UPC typed into Amazon's search finds the product listed under it).
2. **Read the first results in full** with the product reader (Part 14): up to 2.
3. **Approve only when every one of these holds, checked in code:**
   - the Amazon page's own barcode is the candidate's barcode, digit for digit (a 12-digit UPC and its 13-digit EAN with a leading 0 count as the same);
   - nothing on the page says another pack: Amazon's title or details naming a pack count or size the candidate does not have ("Pack of 3", "x6", "6 x 500ml") rules it out, because third-party sellers sometimes list a multipack under the single item's barcode;
   - amazon.co.uk, new, in stock;
   - free delivery to her (Prime, sold or sent by Amazon). A seller who charges delivery is left for pass 2.
4. **Approved:** as "Perfect, so approved" below, with the reason "Same barcode on Amazon".
5. **Anything else** (no barcode, no result, another barcode, a pack in doubt, not Prime, out of stock): left untouched for pass 2, with what was found noted.

**What it costs:** one search and one or two product reads, under a penny a candidate (to be measured). Nothing for Claude.

**How it is proved:**

1. A **rehearsal** on 20 barcoded candidates, best first, writing nothing: what it would approve, with the Amazon link, price and reason, for Joseey to check by eye.
2. 20 for real, every write read back from the database.
3. Then the rest of the barcoded candidates, in runs.

The figures that come out of it: how many candidates have a barcode, how many of those are on Amazon, how many pass, and the real cost per candidate.

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

**What it costs:** about 1.5p to 2p a candidate (estimate, to be measured).

---

## Perfect, so approved (both passes)

- **Her supplier:** Amazon, the plain product link (`/dp/<ASIN>`), sent by her (fulfilment `stock`, no freight or duty, so the landed cost is the Amazon price), confirmed, `cost_by 'amazon'` so the 7am check follows its price.
- **The cost:** the price, or on a deal the price after the deal ends (Part 14: a deal price is not a cost).
- **The card:** the reading saved as `supplier_read` (the Amazon panel and the daily check start at once); the supplier link as her chosen page; Amazon's facts in her supplier box and Amazon's weight packed for the parcel, only where empty.
- **The decision:** approve, marked as Keeper's, with one line of reason ("Same barcode on Amazon, £12.99, Prime, in stock").

## The trays

| Tray | What happened |
|---|---|
| Sourced on Amazon | Approved, supplier and cost saved |
| Close match (pass 2) | Waiting for her, side by side |
| Left for the full check (pass 1) | No barcode match; untouched |
| Not on Amazon | Noted, left in Candidates |
| Could not read | Amazon or Keeper did not answer; the next run tries again |

## Fixes that come first

1. **Price-follow covers her route.** `costFollow` (built 3 October) only moves dropship suppliers. Hers are `stock` with no freight or duty: it must move those too, or her costs stop following Amazon.
2. **SHAVINGFUN's supplier** is named "Amazon Business" and marked dropship. It should be "Amazon", sent by her (`stock`). A one-off SQL change, shown before it runs.

## What it costs, in all (estimate)

| | Per candidate | Note |
|---|---|---|
| Pass 1 | under 1p | Amazon search and reads only |
| Pass 2 | about 1.5p to 2p | adds Keeper's judgement |
| All 3,622 through both | roughly £40 to £70 | lower the more pass 1 settles |

Every figure is replaced by the measured one after the first 20.

## Limits worth knowing

- **Her eBay limit** stays 300 listings a month, paced 20 a day by the queue. Approval has no cap (Joseey's flow); Approved may grow faster than she can list, and the strongest go first.
- **The public price** is what she pays on Prime; a better price she finds is hers to set with "Change the cost", and then it is never moved.
- **Brand risk** (agent-02, check 9) still applies: an Amazon match does not make a counterfeit-prone or enforcing brand safe.

## To confirm before building

- **Where a candidate's barcode lives** (the research card's fields, or `gtinOf` in `src/lib/golive.js`), and how many of the 3,622 have one: a read-only count first.
- The Apify Amazon **search** actor, that a barcode search works through it, and its price (Part 14 uses the product-details actor only).
- The `decisions` table: how a decision records who made it, so Keeper's approvals are marked and can be listed or undone.
- The Candidates page and hook: where Keeper's approvals and notes show (pass 1), and the close match with one tap (pass 2).
- Files needed (collector): `useCandidates.js`, `CandidatesPage.jsx`, `CandidateRow.jsx`, the `decisions` and `candidates` migrations, `src/lib/golive.js`, `src/lib/pricing.js`, `_shared/same-product.ts`, `_shared/match.ts`, `ebay-match/index.ts`, `keeper-run` and the 0123 to 0128 run functions.

## Afterwards

- **Approved (91):** the same matcher fills an Amazon supplier where a card has none.
- **Live products (105 from eBay, 6 with a cost):** the same matcher fills their missing costs, with a supplier the morning check follows.
