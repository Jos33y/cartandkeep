# Keepr Agent-04, Part 14: her Amazon supplier

Adds to keepr-agent-04.md (1 October 2026). Read with it. It also settles Part 8's open decision "A weekly check of cost and stock on live listings": built as a daily check for Amazon UK suppliers.

Amazon refuses to be read by our own functions. Its pages are now read through Apify (the Axesso Amazon reader, about $1.50 per 1,000 pages), by the `supplier-read` function (migration 0118). Only amazon.co.uk: another Amazon prices in another currency.

**When a page is read**
- When she adds a supplier with an Amazon UK link. It is read before Keepr matches, so the match can use the barcode.
- When Get it ready writes a card with an Amazon supplier and no reading yet. In bulk, every Amazon page goes in one run of up to 20.
- When she presses Read again on the card.
- Every morning from 7am London time: each card with an Amazon supplier is read once, 20 per call, at most 240 a shop a day.

**What it gives, kept apart**
- **Facts** (title, brand, model, barcode, colour, Amazon's details table, the seller's bullets and description) go in her supplier box, the first source the writing trusts. Never over words she pasted or edited. The table's figures win over the bullets when the page disagrees with itself. Health claims are never repeated.
- **Photos** go through the photo check like any supplier page.
- **The offer:** price, the struck-through price when on a deal, postage, stock (in, low, slow, out), and who sells and sends it. Every reading is kept in `supplier_checks`, so prices can be followed over weeks.
- **Buyers' concerns:** Amazon's review summary topics where at least four in ten of five or more mentions are negative, with one buyer's words. For her eyes only, never customer copy.

**The warnings**
- Stop: out of stock, the page gone, or dearer than she costed by 10% or more.
- Warn: dearer than costed, up since the last reading, running low, slow to dispatch, or a deal price that ends above her cost.
- Note: down in price, back in stock, a new seller, not read for a day and a half.

These show on the card, as a flag on the closed row, and on the Overview: "Amazon suppliers today" lists every approved card with a stop or warn, live ones included.

Keepr, reading a card: a stop warning on a live listing is reported to her first, with the product and what changed. A deal price is not a cost: until she confirms, the cost after the deal ends is the one to judge the keep by. Buyers' concerns ("Reliability: 9 of 12 negative") are a returns risk to weigh before listing, never something to put in a listing.
