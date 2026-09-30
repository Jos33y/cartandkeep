# Keepr Agent-04: the portal, part two. Approved and listing

Version 1, 30 September 2026. Cart & Keep, Brick Dev Commerce. Read after keepr-agent-03.md, which holds the money model and the terms this file uses.

## What this file is for

What happens to a card after she approves it: the Approved page, how a product goes live on eBay and on her shop, what is planned for listing hundreds at once, the limits that pace it, and the rules about photos and wording that nothing may break. Then the other pages Keepr should read, the known problems, and the decisions still open.

Each part says whether it is **built** (in the portal on 30 September) or **planned** (agreed, not built). Keepr treats planned behaviour as not yet true.

---

## Part 1. The Approved page (built)

Route `/approved`. Every approved card not yet published to eBay, across all batches.

### The header

- **At proven rates:** a month kept across the approved cards, at each small seller's price and rate. Cards with no proved rate add nothing to it.
- **Tabs:** All, Ready to publish, Needs a look, Edited (cards she has changed), and Find.

### A row

Built like a Candidates row, 72px: a green rail for Ready to publish, amber for Needs a look; the photo; the name; the evidence line; the channel marks; the first thing to check, in amber or red; List at with its market status; You keep with its word.

### An opened card

1. **The strip:** Ready to publish or Needs a look, the date approved, one sentence, every check in full under "Also check", a link to the listing the card came from, and the actions:
   - eBay card: "Add to your shop, keep £X" (outlined) and "Review and list at £Y" (the main button).
   - Shop card: "Add to your shop, keep £X" as the main button, stepping down to outlined when the price is more than 10% over Google's lowest.
   - A card the gate also passed for eBay has a switch at the top: Your shop or eBay, each with its own price.
2. **Price:** her list price in a box with 50p steps; what she keeps beside it (green, amber under the target, red at a loss); one-press prices: Match the seller, Undercut £1, Median, Your floor (shop: Google's lowest, Your floor); and the Market chart, where the tag moves as she changes the price.
3. **The listing:** title (80 characters, with Suggest), photographs (the first is the search tile), description (with Rewrite for eBay). Saved as she types.
4. **Right column:** the receipt; Where to buy it (the chosen supplier as a shelf label, other shops, Found it cheaper, her suppliers); Why this one (sales, a month kept, competing listings; shop: rank, Google's price range, shop count); In search results (a preview of the eBay tile).

### Ready to publish, as built

An eBay card is Ready when assess() finds no warnings, a small seller is proved selling, and it keeps more than £0. A shop card is Ready when it has no warnings (an assumed postage band aside), a price, and photos. **Known gap:** Ready does not yet check that the price is in the market or that she keeps her profit target. On 30 September a card £1.33 over the seller, keeping £2.04 against a £3 target, showed as Ready. Keepr must check both itself and say so.

---

## Part 2. Going live (built)

### eBay

1. **Review and list** sends the card to the `ebay-list` function as a dry run. It asks eBay's category suggestions for the title and returns the first one, with the price and the photo count. Nothing is sent to eBay as a listing, so the dry run does not catch a listing eBay would refuse; that only shows at Publish.
2. The confirmation shows the category (the one field nobody can check in advance), price, quantity (5 by default, capped by the shop's per-order limit), photographs, what she keeps, and the parcel: weight, length, width and height. eBay's tracked services refuse a listing without a parcel.
3. **Publish** lists it through eBay's Inventory API: an inventory item (title, description, photos, brand, MPN, condition New, parcel), an offer (price, quantity, category, her postage, payment and returns policies, dispatch location), then publish. The result is saved on the card's `ebay` column. The card leaves Approved and appears on **Listings**.

**What it sends when she has not edited the card (confirmed in code):** the title, photos and description fall back to the shop's own (`listing`). So an unedited card goes to eBay with the shop's photos and wording. Only Brand and MPN are sent as item specifics, and no barcode. The category is eBay's first suggestion for the title, not the category the proving listing sat in.
4. From Listings she can revise the price, quantity and parcel of a live listing, read eBay's own copy of it, and add it to her shop.

### Her shop

1. **Add to your shop** creates a shop product as a **draft**, never live. The price is the card's price.
2. The card stays on Approved, showing "On your shop as a draft", and also shows on Listings as a shop draft.
3. A draft goes on sale only from **Products**, once its returns and hazard fields are confirmed.

### Both channels

Allowed, one after the other. There is no single action that lists to both, and there must not be one.

### Known problems in going live (30 September)

- **A shop-only card added to the shop never leaves Approved.** Approved only drops a card once it is on eBay.
- **The same card sits on two pages** (Approved and Listings) once it is a shop draft.
- **Nothing stops both buttons being pressed** while one channel is still working.

---

## Part 3. Going live (planned)

Agreed with Joseey on 30 September. Not built until he has reviewed the eBay function code.

- **Two channel states on every approved card:** eBay (not listed, publishing, live) and Shop (not added, draft, on sale), shown as two marks on the row.
- **A card stays on Approved until every channel it is meant for has started**, then moves to Listings. Shop-only cards leave once added.
- **One channel at a time:** while one is publishing, the other is locked, and the button says why.
- **A checklist per channel, on every row:**

| eBay ready | Shop ready |
|---|---|
| price in the market, or accepted | photos |
| keeps at least the profit target | description |
| pack confirmed | price at or above her floor |
| title, 80 characters or fewer | returns set |
| at least one photo she may use | hazard set |
| description with no shop's name in it | |
| parcel weight and size | |

- **Parcel filled from the postage band** each card already carries, so she only corrects the odd one.
- **Bulk listing:** tick cards, then "List 40 on eBay" or "Add 40 to your shop". Only cards that pass that channel's checklist can be ticked; the bar says how many were left out and why.
- **Category check before publishing:** one screen, title against the category eBay would choose, flagging any that disagree with the card's own category.
- **A publishing queue** that runs in the background in batches of 25, shows progress on Listings, and sends any refusal back to Approved with eBay's message in full.

---

## Part 4. Limits

| Limit | Figure | What it means |
|---|---|---|
| Her eBay selling limit | 300 (Joseey, 30 September; whether it is a month, and whether there is also a money limit, is still to confirm) | the publishing queue counts against it and paces listings daily, so a new account does not jump from 25 to 300 overnight |
| eBay Inventory API (listing) | 2,000,000 calls a day; bulk calls take 25 items at a time | not a constraint |
| eBay API, Browse (research) | 5,000 a day; 4,560 used on 30 September | the research pipeline can run out mid-run; it resets at 08:00 UK time |
| Found it cheaper saves | one at a time | fine at this volume |

Keepr's order of keeps matters most here: with 300 listings to spend, the strongest products go first (agent-02, Part 4, Order of keeps).

---

## Part 5. Photos and wording (a hard rule)

**The shop's photo and wording are never used on her listings.** The Candidates page tells her so. The import reads a card's `listing` (title, images, description) straight off the shop's product page, so that copy is where a draft starts.

- On 30 September the Flexitol draft's description read "...at Home Bargains", and its one photo was set to go up.
- Confirmed in code: `ebay-list` falls back to the shop's photos and description when the draft has none, and "Add to your shop" does the same for her shop. Rewrite for eBay (`ebay-compose`) writes new wording from the facts and refuses when the text and the pack disagree; nothing yet makes her use it.
- Keepr flags any title or description that names a shop, and any photo it cannot show is hers, a supplier's she may use, or eBay's catalogue image for that barcode.
- Planned: publishing blocked while a description names a shop on file.
- Open: where her photos come from at volume. Her own shots, a supplier's with permission, or eBay's catalogue by barcode. This decides how fast 300 listings can really go live.

Brand risk (agent-02, check 9) applies here too: brands that enforce their listings on eBay, and counterfeit-prone products, which she should source only from authorised shops.

---

## Part 6. The other pages Keepr should read

| Page | What it holds | Why it matters to Keepr |
|---|---|---|
| Overview | to review, approved, live, sold; what needs her, most valuable first; money taken and kept; eBay traffic; why products were rejected | the rejection reasons are her taste, counted. "Kept" covers only sales with a cost recorded (5 of 28 on 30 September), so it is not a profit figure |
| Listings | everything live or drafted, eBay and shop, with traffic from the last pull | what sells raises a product family; what sits for 60 to 90 days lowers it (agent-02, Part 7) |
| Products | her shop's catalogue, drafts and live | a draft is not on sale |
| Coverage | the research funnel: ranked on Google, worth a look, stocked by a UK shop, page checked, sent; and why products stopped at each stage | explains why a product never reached her; patterns there are fixed upstream, not by Keepr |
| Traffic | eBay impressions, views and sales per listing | her sales history (agent-02, Part 2) |

The Overview counts every card in the live batches, read in pages. Before 30 September it read only the first 1,000 rows and showed 829 to review against the real 1,415. If Overview and Candidates ever disagree, trust Candidates and report the difference.

---

## Part 7. Known problems to watch for (30 September)

1. **Shop cards over Google's price:** 885 of 915 waiting were more than 10% over; 498 had a cost above Google's lowest. Usually the size or variant. Handoff: `store-over-google-handoff-2026-09-30.md`.
2. **Wrong-pack pricing reaching Approved:** Fairy Platinum 19 washes priced from a 113-tablet listing (£20.42 for 19 tablets). Any "Shelf pack holds X, the listing this price came from holds Y" warning means the price is wrong, not only the cost.
3. **Duplicates approved twice:** Fairy Platinum 19 Washes Lemon (£20.42 and £19.47); Pedigree Dentastix Daily Dental Chews (twice). Note the other card.
4. **Pack confirmed at a large ratio:** Pedigree chewy cubes, £1.29 shelf against £12.39 eBay (9.6 times), confirmed with one click and moved to Worth approving. Treat as unconfirmed until the titles or photos agree.
5. **Needs a look is too broad:** 10 of 11 approved cards on 30 September, mostly the pack question.
6. **Ready ignores price and profit** (Part 1).
7. **Shop copy in drafts** (Part 5).

---

## Part 8. Decisions still open

| Decision | Who | Status |
|---|---|---|
| Her selling limit: 300 a month? A money limit too? | Joseey, from Seller Hub | asked |
| Where listing photos come from | Joseey and Mrs Sowande | asked |
| Channel states, lock, checklists, bulk, queue | Joseey | agreed; waiting on the eBay function code (ck-listing collector) |
| Returns and hazard defaults for shop drafts ("30-day returns, no hazard" set once) | Joseey | suggested |
| A weekly check of cost and stock on live listings | Joseey | suggested |
| Market chart scale starting at £0.00 | Joseey | agreed; next build |

---

## Part 9. What Keepr may and may not do here

**May:**
- read every page above;
- write notes on cards, through apply-review with `--apply` after a list-only run;
- flag a card for the checklist items it fails, in the page's words ("no parcel", "description names Home Bargains", "£1.33 over the seller");
- suggest the order to list in, strongest first, within her selling limit;
- report patterns upstream: a shop whose copy keeps leaking into drafts, a band that keeps mis-costing parcels.

**May not:**
- approve, reject, confirm a pack, publish to eBay, add to the shop, or take a draft live;
- change a price, a title, a photo or a description;
- treat a planned behaviour in Part 3 as built;
- count the "Kept" figure on Overview as her profit.

Plain British English, no em dashes, no emojis, no filler. Notes are for her, not for an engineer.
