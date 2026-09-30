# Keepr Agent-04: the portal, part two. Approved and listing

Version 2, 30 September 2026 (after going live part 3). Cart & Keep, Brick Dev Commerce. Read after keepr-agent-03.md, which holds the money model and the terms this file uses.

## What this file is for

What happens to a card after she approves it: the Approved page, how a product goes live on eBay and on her shop, how hundreds go at once, the limits that pace it, and the rules about photos and wording that nothing may break. Then the other pages Keepr should read, the known problems, and the decisions still open.

Each part says whether it is **built** (in the portal on 30 September) or **planned** (agreed, not built). Keepr treats planned behaviour as not yet true.

---

## Part 1. The Approved page (built)

Route `/approved`, titled "Going live". Every approved card that still has a channel to start, across all batches. A card stays until every channel it is meant for has started: live on eBay, and on her shop as a draft or on sale. A card live on eBay with the shop still to do stays, with only the shop left.

### The header

- **At proven rates:** a month kept across the approved cards, at each small seller's price and rate.
- **Tabs:** All, Ready to go live, Needs a look, One channel left, Edited, In the eBay queue, Refused by eBay, Held back (after a check sheet), and Find.
- **Above the list:** Select all (or "these" when a tab or Find is on), Ready for eBay (n), Ready for your shop (n), and the eBay queue's state: "eBay queue: 8 waiting, 1 publishing. It carries on with the portal closed."

### A row

72px. A tick box (on a phone, on the photo's corner); a green rail for Ready to go live, amber for Needs a look; the photo; her title (or the card title); the evidence line; **one mark per channel** (Shop: To add, Adding, Draft, On sale; eBay: To list, Queued, Publishing, Live); the first thing still to do, red when it holds the button and amber when it is hers to weigh, with "+n" for the rest (a card eBay refused shows "eBay refused it:" and eBay's words instead); List at with its market status; You keep, amber when under the profit target.

### An opened card

1. **The queue note**, when the card is in the eBay queue: waiting since a date ("Take it out of the queue"), publishing now, or refused with eBay's words ("Back in the queue", which sends her current draft with the category she chose before).
2. **The strip:** Ready to go live or Needs a look, the date approved, and one sentence of what is left per channel ("Before eBay: write a title, add photos, write the description and set the parcel."). The buttons: "Add to your shop, keep £X" and "List on eBay at £Y". Only one channel works at a time; while one is working, or the card is in the eBay queue, the other is locked and says why.
3. **Going live:** a column per channel. A started channel says where it stands (live at £X with a link; a shop draft that goes on sale from Products). A channel still to do lists its checks, each marked met (green), hers to weigh (amber) or holding the button (red), with the one thing that fixes it: Write it, Add photos, Write a title, Set the parcel (or "Use 0.25kg, large letter to 250g" from the card's postage band), Match £X, Compare.
4. **Same item and pack?** On an eBay card whose pack is not confirmed: the compare panel from Candidates, with "Same item and pack, confirm £X" and "Different pack, find the right one".
5. **Price:** her price with 50p steps, what she keeps, one-press prices, and the Market chart. The chart's scale is drawn from the market and her price only; a loss line or floor off the scale is named on the axis ("loses under £11.43") rather than stretching it to £0.00.
6. **The listing:** title, photos, description, then the parcel. The shop's name for the product, and the shop's photos, show for reference only and never go up. A photo in the draft that is the shop's or another seller's is marked "Not yours".
7. **Right column:** the receipt; Where to buy it (her supplier or the shelf as a label, other shops, "Found it cheaper?" behind a button, her other suppliers when she has more than one); Why this one; In search results.

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

1. **List on eBay** sends the card to the `ebay-list` function as a check (a dry run). It returns the category (the card's, where the proving listing sits), eBay's own suggestion for her title when it differs, the item details the category requires and any still missing, where the photos come from, the barcode and catalogue match, her month's count, and every problem that would stop it. Nothing is listed.
2. The publish step shows all of that: category with "Use eBay's" when they differ, price, quantity (5 by default, capped by the shop's per-order limit), photographs, what she keeps, the parcel, the barcode, and fields for any missing detail with "Check again". Publish stays off while any problem remains.
3. **Publish** lists it through eBay's Inventory API: an inventory item (title, description, photos, brand, MPN, condition New, parcel), an offer (price, quantity, category, her postage, payment and returns policies, dispatch location), then publish. The result is saved on the card's `ebay` column. The card stays on Approved if the shop is still to do.
4. From Listings she can revise the price, quantity and parcel of a live listing, read eBay's own copy, and add it to her shop.

### Her shop

1. **Add to your shop** creates a shop product as a **draft**, with her title, description and photos only. The price is the card's price.
2. A draft goes on sale only from **Products**, once its returns and hazard fields are confirmed.

### What the eBay function sends (part 2, `_shared/ebay/listing.ts`)

- Her title, description and photos only. With none, it refuses; it never falls back to the shop's. The one other source of photos is eBay's catalogue, matched by the card's barcode, and only when she chooses it on the card.
- The category the proving listing sits in, from the research. When eBay's suggestion for her title disagrees, the publish step says so and she can take eBay's.
- The barcode (EAN), when the card carries a valid one, and the catalogue's ePID when its photos are used.
- Brand, MPN and every item detail the category requires. A missing required detail is asked for at the publish step and holds Publish.
- Her monthly limit: 300 a month. The function refuses once the month's count is used; the queue also paces at 20 a day.
- A listing already live from before this rule is still revised with what it went up with, so a price change is not held back.

## Part 3. Going live in bulk (built)

Built 30 September (part 3). One rule under all of it: a card listed with forty others is sent the same fields and held by the same checks as a card listed on its own (`src/lib/bulk.js`).

### Ticking cards

- Tick any card, shift-click for a range, "Select all" for what is shown, or the quick picks "Ready for eBay" and "Ready for your shop" (every check met on that channel, and not already in the queue). Escape clears.
- The bar along the bottom counts, per channel, how many of the ticked cards can go, and says why the rest cannot: "Left out of eBay: no parcel weight yet (12), already in the queue (2)." Only hard checks leave a card out; a soft one (over the market, under the profit target) is hers to weigh, and she ticked it.
- One channel at a time holds in bulk too: a card in the eBay queue is left out of a shop add ("eBay is listing it first").

### eBay: the check sheet, then the queue

1. **Check and list N on eBay** opens a sheet. eBay checks each card, three at a time, exactly as the single publish step does. Progress shows as it goes; she can stop it and check the rest later.
2. Each card shows its category. Where eBay would file it elsewhere from the title, both are shown and she picks, per card or "Use eBay's for all". A card she moves is checked again, because another category can need other details.
3. A card held only for an item detail eBay requires (Type, Colour) gets the fields on its row: "Save and check again" writes them to her draft, as the card would, and asks eBay again. Anything else that holds a card (no photos of hers, the shop's wording) is named; she fixes it on the card. "Show the N held" filters the page to them.
4. Room is her month's limit less what is listed and what is already waiting. Cards past it are marked "Next month" and not queued. The sheet says when the last should go up at her daily pace.
5. **Queue N for eBay** adds one `listing_jobs` row per card, carrying what she checked: her title, description, photos, item details, parcel, the eBay price, quantity and the category she chose. The queue lists them strongest first, up to 20 a day and 300 a month, with the portal closed.
6. A card eBay refuses in the queue fails at once with eBay's words, shown on the row and under "Refused by eBay". A hiccup (eBay down, a timeout) is tried again, three times at most.

### Her shop in bulk

**Add N to your shop** adds each as a draft, one by one, with a progress bar and Stop. Her copy and photos only. Drafts go on sale from Products once returns and hazard details are confirmed.

### What Keepr can read from this

- `listing_jobs`: every card's latest job, its state, attempts, eBay's words when it failed, and the request as queued.
- A card with a failed job and eBay still to do is a card eBay said no to. The words are eBay's; Keepr reports them to her in plain terms and suggests the fix, and never requeues.

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
- Fixed 30 September (part 2): `ebay-list` and the queue refuse a card with no title, description or photos of hers, refuse the shop's own wording and any photo that is the shop's or another seller's, and never fall back to the shop's. "Add to your shop" sends her copy only. Rewrite for eBay (`ebay-compose`) writes new wording from the facts and refuses when the text and the pack disagree.
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
| Where listing photos come from | Joseey | eBay's catalogue to be tested with one listing; her own photos for anything it lacks. This now decides how fast the bulk queue can really fill |
| Channel states, lock, checklists | Joseey | built 30 September |
| eBay function changes and the queue | Joseey | built 30 September (part 2) |
| Bulk selection, category check sheet, queue states | Joseey | built 30 September (part 3) |
| Returns and hazard defaults for shop drafts ("30-day returns, no hazard" set once) | Joseey | suggested |
| A weekly check of cost and stock on live listings | Joseey | suggested |
| Market chart scale starting at £0.00 | Joseey | fixed 30 September (part 3) |

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
- requeue a refused card, take a card out of the queue, or tick cards for a bulk action;
- count the "Kept" figure on Overview as her profit.

Plain British English, no em dashes, no emojis, no filler. Notes are for her, not for an engineer.
