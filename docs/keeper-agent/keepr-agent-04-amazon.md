# Keepr Agent-04, Part 14: her Amazon supplier

Adds to keepr-agent-04.md. Version 2, 1 October 2026: Amazon's readings are now used on the card, and Send to Cart & Keep reads Amazon and any other shop. Read with keepr-agent-04.md.

This part also settles the old open decision "A weekly check of cost and stock on live listings": it is built as a daily check for Amazon UK suppliers. Joseey: "daily price is very important... we will come back to that extensively later".

Amazon refuses to be read by our own functions. Its pages are read two ways:

- **Through Apify** (the Axesso Amazon reader, about $1.50 per 1,000 pages), by the `supplier-read` function (migration 0118). Only amazon.co.uk: another Amazon prices in another currency.
- **By her own browser,** when she presses Send to Cart & Keep on the Amazon page (keepr-agent-04, Part 5).

## When a page is read

- When she adds a supplier with an Amazon UK link. It is read before Keepr matches, so the match can use the barcode.
- When Get it ready writes a card with an Amazon supplier and no reading yet. In bulk, every Amazon page goes in runs of up to 20.
- When she presses Read again on the card.
- Every morning from 7am London time: each card with an Amazon supplier is read once, 20 per call, at most 240 a shop a day.
- **Reuse:** a reading under 6 hours old is used, not read again.

**Which page:** the supplier link she chose for the card, else her cheapest Amazon UK supplier.

## What it gives, kept apart

- **Facts:** title, brand, model, barcode, colour, Amazon's details table, the seller's bullets and description.
  - They go in her supplier box, the first source the writing trusts.
  - A reading already there is used the moment she opens the card, before Get it ready and in bulk. It is never written over words she pasted or edited.
  - The table's figures win over the bullets when the page disagrees with itself. Health claims are never repeated.
- **Weight:** Amazon's item weight is offered for the parcel, packed: 15% more, at least 50g more, rounded up to the next 50g. The card shows "Amazon gives the item as 500g. Packed, about 0.6kg. Use 0.6kg", and Get it ready fills it in.
- **Photos:** Amazon's gallery goes through the photo check like any supplier page, and the passed photos go into her listing by themselves (keepr-agent-04, Part 5).
- **The offer:** price, the struck-through price when on a deal, postage, stock (in, low, slow, out), and who sells and sends it. Every reading is kept in `supplier_checks`, so prices can be followed over weeks.
- **Buyers' concerns:** Amazon's review summary topics where at least four in ten of five or more mentions are negative, with one buyer's words. For her eyes only, never customer copy.

**Proved on her real data on 1 October:** SHAVINGFUN read at £15.28 (was £17.98, on a deal), in stock, sold by ZYFJD and sent by Amazon, costed at £15.28. Barcode 734730596013, a 12-digit UPC: the code that taught the eBay function to send each barcode in its right field (keepr-agent-04, Part 2).

## The warnings

- **Stop:** out of stock, the page gone, or dearer than she costed by 10% or more.
- **Warn:** dearer than costed, up since the last reading, running low, slow to dispatch, or a deal price that ends above her cost.
- **Note:** down in price, back in stock, a new seller, or not read for a day and a half.

These show on the card, as a flag first on the closed row ("Amazon: out of stock"), and on the Overview. "Amazon suppliers today" lists every approved card with a stop or warn, live ones included.

Warnings inform; they do not stop a listing. Whether an Amazon stop should hold List on eBay is suggested, not decided.

## Keepr, reading a card

- A stop warning on a live listing is reported to her first, with the product and what changed.
- A deal price is not a cost: until she confirms, the cost after the deal ends is the one to judge the keep by.
- Buyers' concerns ("Reliability: 9 of 12 negative") are a returns risk to weigh before listing, never something to put in a listing.
- An Amazon supplier with no reading yet, or a reading that keeps failing, is reported as needing Read again or Send to Cart & Keep.
