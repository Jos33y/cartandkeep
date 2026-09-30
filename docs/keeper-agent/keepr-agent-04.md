# Keepr Agent-04: the portal, part two. Approved and listing

Version 1, 30 September 2026. Cart & Keep, Brick Dev Commerce. Read after keepr-agent-03.md, which holds the money model and the terms this file uses.

## What this file is for

What happens to a card after she approves it: the Approved page, how a product goes live on eBay and on her shop, what is planned for listing hundreds at once, the limits that pace it, and the rules about photos and wording that nothing may break. Then the other pages Keepr should read, the known problems, and the decisions still open.

Each part says whether it is **built** (in the portal on 30 September) or **planned** (agreed, not built). Keepr treats planned behaviour as not yet true.

---

## Part 1. The Approved page (built)

Route `/approved`, titled "Going live". Every approved card that still has a channel to start, across all batches. A card stays until every channel it is meant for has started: live on eBay, and on her shop as a draft or on sale. A card live on eBay with the shop still to do stays, with only the shop left.

### The header

- **At proven rates:** a month kept across the approved cards, at each small seller's price and rate.
- **Tabs:** All, Ready to go live, Needs a look, One channel left, Edited, and Find.

### A row

72px. A green rail for Ready to go live, amber for Needs a look; the photo; her title (or the card title); the evidence line; **one mark per channel** (Shop: To add, Draft, On sale; eBay: To list, Publishing, Live); the first thing still to do, red when it holds the button and amber when it is hers to weigh, with "+n" for the rest; List at with its market status; You keep, amber when under the profit target.

### An opened card

1. **The strip:** Ready to go live or Needs a look, the date approved, and one sentence of what is left per channel ("Before eBay: write a title, add photos, write the description and set the parcel."). The buttons: "Add to your shop, keep £X" and "List on eBay at £Y". Only one channel works at a time; while one is working, the other is locked and says why.
2. **Going live:** a column per channel. A started channel says where it stands (live at £X with a link; a shop draft that goes on sale from Products). A channel still to do lists its checks, each marked met (green), hers to weigh (amber) or holding the button (red), with the one thing that fixes it: Write it, Add photos, Write a title, Set the parcel (or "Use 0.25kg, large letter to 250g" from the card's postage band), Match £X, Compare.
3. **Same item and pack?** On an eBay card whose pack is not confirmed: the compare panel from Candidates, with "Same item and pack, confirm £X" and "Different pack, find the right one".
4. **Price:** her price with 50p steps, what she keeps, one-press prices, and the Market chart.
5. **The listing:** title, photos, description, then the parcel. The shop's name for the product, and the shop's photos, show for reference only and never go up. A photo in the draft that is the shop's or another seller's is marked "Not yours".
6. **Right column:** the receipt; Where to buy it (her supplier or the shelf as a label, other shops, "Found it cheaper?" behind a button, her other suppliers when she has more than one); Why this one; In search results.

### The checks, as built (`src/lib/golive.js`)

| eBay | Hard (holds the button) | Soft (not Ready until met) |
|---|---|---|
| price | | in the market |
| profit | keeps more than £0, and has a cost | keeps the profit target |
| pack | | confirmed, and not over 3.5 times the shelf price |
| title | present, 80 characters or fewer | |
| photos | at least one, none the shop's or another seller's | |
| description | present, not the shop's wording, names no shop | |
| parcel | a weight | |

| Your shop | Hard | Soft |
|---|---|---|
| photos | as eBay | |
| description | as eBay | |
| price | a price, not at a loss | at or above her floor |

**Ready to go live** means every check, hard and soft, passes on every channel left. A card can go up with soft checks unmet; it cannot with a hard one.

---

## Part 2. Going live (built)

### eBay

1. **List on eBay** sends the card to the `ebay-list` function as a dry run. It asks eBay's category suggestions for the title and returns the first one, with the price and photo count. Nothing is sent to eBay as a listing, so the dry run does not catch a listing eBay would refuse; that only shows at Publish.
2. The confirmation shows the category (the one field nobody can check in advance), price, quantity (5 by default, capped by the shop's per-order limit), photographs, what she keeps and the parcel.
3. **Publish** lists it through eBay's Inventory API: an inventory item (title, description, photos, brand, MPN, condition New, parcel), an offer (price, quantity, category, her postage, payment and returns policies, dispatch location), then publish. The result is saved on the card's `ebay` column. The card stays on Approved if the shop is still to do.
4. From Listings she can revise the price, quantity and parcel of a live listing, read eBay's own copy, and add it to her shop.

### Her shop

1. **Add to your shop** creates a shop product as a **draft**, with her title, description and photos only. The price is the card's price.
2. A draft goes on sale only from **Products**, once its returns and hazard fields are confirmed.

### Still true in the eBay function (fixed in part 2 of the build)

The function itself still falls back to the shop's title, photos and description when it is sent none. The portal never sends it a card without her own, because the checks hold the button. Only Brand and MPN go as item specifics, no barcode, and the category is eBay's first suggestion for the title.

---

## Part 3. Going live (planned)

Agreed with Joseey on 30 September.

- **The eBay function:** no fallback to the shop's copy; the category from the card, with eBay's suggestion only as a fallback and any difference flagged; the barcode, and a link to eBay's catalogue where eBay has the product (its photos and item specifics); the item specifics each category requires. The catalogue is tested with one listing first.
- **Bulk listing:** tick cards, then "List 40 on eBay" or "Add 40 to your shop". Only cards that pass the channel's hard checks can be ticked.
- **Category check before publishing:** title against the category eBay would choose, flagging any that disagree with the card's own.
- **A publishing queue** built like keeper_jobs: server-side, in batches of 25, with a monthly counter against her 300, progress on Listings, and any refusal sent back to Approved with eBay's message in full.

## Part 4. Limits

| Limit | Figure | What it means |
|---|---|---|
| Her eBay selling limit | 300 items a month, no money limit (Joseey, 30 September) | the publishing queue counts against it and paces listings daily, so a new account does not jump from 25 to 300 overnight |
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
- Built: both buttons are held while a title or description names a shop, while the description is the shop's own wording, and while any photo is the shop's or another seller's.
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
5. **Needs a look is broad by design now:** until a card has her photos, her words and a parcel, it needs a look. Expect most approved cards there until photos are sorted (Part 5).

---

## Part 8. Decisions still open

| Decision | Who | Status |
|---|---|---|
| Where listing photos come from | Joseey | eBay's catalogue to be tested with one listing; her own photos for anything it lacks |
| Channel states, lock, checklists | Joseey | built 30 September |
| eBay function changes, bulk, category check, queue | Joseey | agreed; next |
| Returns and hazard defaults for shop drafts ("30-day returns, no hazard" set once) | Joseey | suggested |
| A weekly check of cost and stock on live listings | Joseey | suggested |
| Market chart scale starting at £0.00 | Joseey | agreed; next build |

---

## Part 9. What Keepr may and may not do here

**May:**
- read every page above;
- write notes on cards, through apply-review with `--apply` after a list-only run;
- flag a card for the checks it fails, in the page's words ("No parcel weight yet", "Names Home Bargains", "£1.33 over the market at £8.66");
- suggest the order to list in, strongest first, within her selling limit;
- report patterns upstream: a shop whose copy keeps leaking into drafts, a band that keeps mis-costing parcels.

**May not:**
- approve, reject, confirm a pack, publish to eBay, add to the shop, or take a draft live;
- change a price, a title, a photo or a description;
- treat a planned behaviour in Part 3 as built;
- count the "Kept" figure on Overview as her profit.

Plain British English, no em dashes, no emojis, no filler. Notes are for her, not for an engineer.
