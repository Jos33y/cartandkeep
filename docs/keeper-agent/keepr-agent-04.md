# Keepr Agent-04: the portal, part two. Approved and listing

Version 5, 1 October 2026, after the first listing went live: item 318942398301, SHAVINGFUN. Changes since version 4:

- photos no longer hold a listing back;
- passed photos go in by themselves;
- the barcode goes in the right field;
- Listings shows only what is live.

Cart & Keep, Brick Dev Commerce. Read after keepr-agent-03.md, which holds the money model and the terms this file uses. Part 14 (her Amazon supplier) is in keepr-agent-04-amazon.md.

## What this file is for

What happens to a card after she approves it:

- the Approved page;
- how a product goes live on eBay and on her shop, and how hundreds go at once;
- the limits that pace it;
- the rules about photos and wording;
- the other pages Keepr should read, the known problems, and the decisions still open.

Each part says whether it is **built** (in the portal on 1 October) or **planned** (agreed, not built). Keepr treats planned behaviour as not yet true.

**The rule over every part, from Joseey on 1 October:** the goal is her products live. Only eBay's own refusals stop a listing. Price, weight and photo concerns are for her to weigh, never blockers that Keepr adds. In his words: "we are not to make this overly complicated or strict... we need to act human" and "let it list successfully, that's what matters".

---

## Part 1. The Approved page (built)

Route `/approved`, titled "Going live". It holds every approved card that still has a channel to start, across all batches.

- A card stays until every channel it is meant for has started: live on eBay, and on her shop as a draft or on sale.
- A card live on eBay with the shop still to do stays, with only the shop left.

### The header

- **At proven rates:** a month kept across the approved cards, at each small seller's price and rate.
- **This month on eBay:** "1 of 300 listed on eBay this month".
- **Tabs:** All, Ready to go live, Needs a look, One channel left, Edited, In the eBay queue, Refused by eBay, Held back (after a check sheet), and Find.
- **Above the list:**
  - Select all (or "these" when a tab or Find is on), Ready for eBay (n) and Ready for your shop (n);
  - the eBay queue's state: "eBay queue: 8 waiting, 1 publishing. It carries on with the portal closed."
- **From your supplier's page:** a banner when she has pressed Send to Cart & Keep on a supplier's page (Part 5). It lists what came and the card it is likely for, with "Add to this card" and "Not now".

### A row

72px. In order:

1. A tick box (on a phone, on the photo's corner).
2. A green rail for Ready to go live, amber for Needs a look.
3. The photo.
4. Her title, or the card title.
5. The evidence line.
6. **One mark per channel:** Shop is To add, Adding, Draft or On sale; eBay is To list, Queued, Publishing or Live.
7. **The first thing still to do:** red when it holds the button, amber when it is hers to weigh, with "+n" for the rest. An Amazon stop or warning comes first ("Amazon: out of stock"). A card eBay refused shows "eBay refused it:" and eBay's words instead.
8. List at, with its market status.
9. You keep, amber when under the profit target.

### An opened card

1. **The queue note**, when the card is in the eBay queue: waiting since a date (with "Take it out of the queue"), publishing now, or refused with eBay's words (with "Back in the queue", which sends her current draft with the category she chose before).
2. **The strip:** Ready to go live or Needs a look, the date approved, and one sentence per channel on what is left. The buttons are "Add to your shop, keep £X" and "List on eBay at £Y". Only one channel works at a time; while one is working, or the card is in the eBay queue, the other is locked and says why.
3. **Going live:** a column per channel.
   - A started channel says where it stands: live at £X with a link, or a shop draft that goes on sale from Products.
   - A channel still to do lists its checks, each marked met (green), hers to weigh (amber) or holding the button (red), with the one thing that fixes it: Write it, Add photos, Write a title, Set the parcel, Match £X, Compare.
4. **Same item and pack?** On an eBay card whose pack is not confirmed: the compare panel from Candidates, with "Same item and pack, confirm £X" and "Different pack, find the right one".
5. **Price:** her price with 50p steps, what she keeps, one-press prices, and the Market chart. The chart's scale is drawn from the market and her price only; a loss line or floor off the scale is named on the axis.
6. **The listing:**
   - title, photos, description, then the parcel;
   - the shop's name for the product, shown for reference;
   - photos as in Part 5: every passed photo already in, removable, and any photo opens large;
   - the parcel takes kg or g ("0.5" and "500g" both work) and offers Amazon's weight packed (Part 14).
7. **Right column:**
   - the receipt;
   - the Amazon panel when her supplier is Amazon (Part 14);
   - Where to buy it, with her supplier box and the Send to Cart & Keep button under it;
   - Why this one;
   - In search results.

### The checks, as built (`src/lib/golive.js`)

| eBay | Hard (holds the button) | Soft (not Ready until met) |
|---|---|---|
| price | | in the market |
| profit | keeps more than £0, and has a cost | keeps the profit target |
| pack | | confirmed, and not over 3.5 times the shelf price |
| title | present, 80 characters or fewer | |
| photos | at least one, and none that is another eBay seller's own photo | |
| description | present, not the shop's wording, names no shop | |
| duplicate | not the same product as another approved card (barcode or title) | |
| parcel | | a size or a weight; eBay asks for a weight only when her postage policy is calculated by weight, and hers is flat or free |

| Your shop | Hard | Soft |
|---|---|---|
| photos | as eBay | |
| description | as eBay | |
| price | a price, not at a loss | at or above her floor |

**Ready to go live** means every check, hard and soft, passes on every channel left. A duplicate holds both channels, and "Show both" filters the page to the pair so she rejects one.

**Get it ready** (on a card, and "Get N ready" in the bulk bar) writes what the card can write itself, only where it is missing:

- a title (the first suggestion) and the description;
- the photos (Part 5) and eBay's category with the item details;
- Amazon's facts and weight, where the supplier is Amazon (Part 14).

It stops on anything the sources disagree about and says what still needs her. It costs about $0.05 of Claude per card.

**Also checked before eBay:** a category that does not take New, and a card already live on eBay under the same barcode or title. A card can go up with soft checks unmet; it cannot with a hard one.

---

## Part 2. Going live (built)

### eBay

1. **List on eBay** sends the card to the `ebay-list` function as a check (a dry run). Nothing is listed. It returns:
   - the category (the card's, where the proving listing sits), and eBay's own suggestion for her title when it differs;
   - the item details the category requires, and any still missing;
   - where the photos come from, the barcode and the catalogue match;
   - her month's count, and every problem that would stop it.
2. **The publish step** shows all of that: the category (with "Use eBay's" when they differ), price, quantity (5 by default, capped by the shop's per-order limit), photographs, what she keeps, the parcel, the barcode, and fields for any missing detail with "Check again". Publish stays off while any problem remains.
3. **Publish** lists it through eBay's Inventory API:
   - an inventory item: title, description, photos, brand, MPN, condition New, the barcode, and the parcel when it has a weight;
   - an offer: price, quantity, category, her postage, payment and returns policies, and dispatch location;
   - then publish. The result is saved on the card's `ebay` column, and the card stays on Approved if the shop is still to do.
4. **From Listings** she can revise the price, quantity and parcel of a live listing, read eBay's own copy, and add it to her shop.

### Her shop

1. **Add to your shop** creates a shop product as a **draft**, with her title, description and photos only. The price is the card's price.
2. A draft goes on sale only from **Products**, once its returns and hazard fields are confirmed (Part 12), or with Put on sale on Listings once nothing is left.

### What the eBay function sends (`_shared/ebay/listing.ts`)

- **Wording:** her title and description only. With none, it refuses; it never falls back to the shop's wording.
- **Photos:** by the rule in Part 5.
- **Category:** the one the proving listing sits in, from the research. When eBay's suggestion for her title disagrees, the publish step says so and she can take eBay's.
- **The barcode, in eBay's right field:** 12 digits go as a UPC, 8 or 13 digits as an EAN, and 14 digits are left off. Before 1 October every barcode was sent as an EAN, and eBay refused a 12-digit one at publish with "Product not found".
- **"Product not found" at publish** (eBay error 25604): the item is put up again once with no barcode, no ePID and no code details (EAN, UPC, ISBN, GTIN), then published. The card's record notes `barcode_dropped`. The barcode is optional on eBay, so the listing goes up without it. Any other refusal goes through unchanged, never retried.
- **The catalogue's ePID**, only when the catalogue's photos are used.
- **Brand, MPN and every item detail the category requires.** A missing required detail is asked for at the publish step and holds Publish.
- **No package type.** eBay UK refuses MAILING_BOX (error 216305), and no parcel goes without a weight.
- **Her monthly limit:** 300 a month. The function refuses once the month's count is used; the queue also paces at 20 a day.
- **Listings from before these rules** are revised with what they went up with, so a price change is not held back.

### eBay's refusals so far

| Date | eBay said | Cause | Now |
|---|---|---|---|
| 30 Sep | 216305 | MAILING_BOX package type on the UK site | none sent |
| 1 Oct | 25604, "Product not found" | inferred: a 12-digit UPC sent as an EAN | the right field, and one retry without codes |

**The first listing:** SHAVINGFUN, Massagers (36449), £27.49, quantity 5, 8 photos, keeps £4.25. Live on 1 October as item 318942398301.

---

## Part 3. Going live in bulk (built)

Built 30 September. One rule under all of it: a card listed with forty others is sent the same fields and held by the same checks as a card listed on its own (`src/lib/bulk.js`).

### Ticking cards

- **How she ticks:** any card, shift-click for a range, "Select all" for what is shown, or the quick picks "Ready for eBay" and "Ready for your shop" (every check met on that channel, and not already in the queue). Escape clears.
- **The bar along the bottom** counts, per channel, how many of the ticked cards can go, and says why the rest cannot.
- **What leaves a card out:** only hard checks. A soft one (over the market, under the profit target) is hers to weigh, and she ticked it.
- **One channel at a time** holds in bulk too: a card in the eBay queue is left out of a shop add ("eBay is listing it first").

### eBay: the check sheet, then the queue

1. **Check and list N on eBay** opens a sheet. eBay checks each card, three at a time, exactly as the single publish step does. Progress shows as it goes; she can stop it and check the rest later.
2. **Category:** each card shows its category. Where eBay would file it elsewhere from the title, both are shown and she picks, per card or with "Use eBay's for all". A card she moves is checked again, because another category can need other details.
3. **Missing item details:** a card held only for an item detail eBay requires gets the fields on its row. "Save and check again" writes them to her draft and asks eBay again. Anything else that holds a card is named; she fixes it on the card. "Show the N held" filters the page to them.
4. **Room** is her month's limit, less what is listed and what is already waiting. Cards past it are marked "Next month" and not queued. The sheet says when the last should go up at her daily pace.
5. **Queue N for eBay** adds one `listing_jobs` row per card, carrying what she checked. The queue lists them strongest first, up to 20 a day and 300 a month, with the portal closed.
6. **Refusals and hiccups:** a card eBay refuses in the queue fails at once with eBay's words. A hiccup (eBay down, a timeout) is tried again, three times at most. The barcode retry in Part 2 runs in the queue too.

### Her shop in bulk

**Add N to your shop** adds each as a draft, one by one, with a progress bar and Stop.

### What Keepr can read from this

- `listing_jobs`: every card's latest job, its state, attempts, eBay's words when it failed, and the request as queued.
- A card with a failed job and eBay still to do is a card eBay said no to. Keepr reports eBay's words to her in plain terms and suggests the fix, and never requeues.

---

## Part 4. Limits

| Limit | Figure | What it means |
|---|---|---|
| Her eBay selling limit | 300 items a month, no money limit (Joseey, 30 September) | the queue counts against it and paces listings daily |
| eBay Inventory API (listing) | 2,000,000 calls a day | not a constraint |
| eBay API, Browse (research) | 5,000 a day | the research pipeline can run out mid-run; it resets at 08:00 UK time |
| Apify, Amazon pages | about $1.50 per 1,000 | up to 240 a shop a day in the morning check (Part 14) |
| Photos checked from a page she sends | 12 | eBay's gallery size |

Keepr's order of keeps matters most here: with 300 listings to spend, the strongest products go first (agent-02, Part 4).

---

## Part 5. Photos and wording (the rule, changed 1 October)

**Wording is always hers.** The shop's wording never goes up. Write for eBay (`ebay-compose`) writes new copy from the facts. When the supplier's page disagrees with itself, it uses the details table and does not call it a conflict. It never makes a health claim.

**Photos, as agreed with Joseey on 1 October.** The 30 September rule (only her photos, eBay's catalogue, or a shop's photo that passed every check) stopped the first listing for over twelve hours. It is replaced by how a person selling on eBay works:

- **Any photo may go up, except another eBay seller's own photo** (an `i.ebayimg.com` address that is not eBay's catalogue entry). Photos from her supplier's page, other UK shops, Amazon and her own uploads are all usable.
- **The check still runs, and informs.** Keepr's photo check (`photo-check`) still looks at each photo and notes a shop's name or logo, a watermark, prices or offers laid over it, a callout or diagram, a styled scene, and a different pack. Its notes show on each photo; they do not stop a listing.
- **The first photo, the search tile, should be a plain product shot.** Callouts, lifestyle shots and diagrams pass as "Passed, not first" and are placed after the plain shots.
- **The brand list** (`photo_brand_rules`: Lego, Dyson, Apple, Nike, Adidas, Pandora) no longer blocks. Each listing still records where its photos came from (`ebay.images_from`), so takedowns can be counted by brand later.

**On the page:**

- **Every photo that passed goes in by itself,** plain shots first, up to 12. She takes out the ones she does not want with the ×. A photo she takes out is remembered (`draft.photos_offered`), stays out after "Check again", and shows faded with "Put back".
- **Any photo opens large:** in her gallery, the ones taken out, and the shop and supplier grids. Arrows, the arrow keys and a strip of small photos step through the set. The card's main photo opens her listing's photos in order.
- **A passed photo is copied** into her listing-images folder, so eBay and her shop read it from there.

**Send to Cart & Keep (built, 1 October).** A bookmark she drags to her bookmarks bar once, then presses on a supplier's product page on any shop. Her browser reads the page and opens the portal with what it found; she picks the card.

- **On Amazon:** the gallery of the colour chosen at full size, the bullets, the details tables and the description. Sponsored products and other colours are left out.
- **On any other shop:** every large product photo at its biggest size, the specifications and the description. The header, footer, logos, badges, reviews and "you may also like" strips are left out.
- **Pressed on the portal or her own shop,** it tells her to open the supplier's page first.
- **What comes back** goes through the photo check (up to 12) and into her supplier box.

**What Keepr does here:**

- reports cards with no photos at all, and suggests her supplier's page through Send to Cart & Keep;
- notes a photo it would not lead with, in her words ("Has a price laid over it, keep it after the first photo").

It never blocks a listing for a photo, never passes or changes a photo itself, and never puts another eBay seller's own photo up.

**Planned, not built (noted by Joseey on 1 October; build only when he says so):**

- **Photos from the same product's eBay listing:** copied into her folder under her own names, some of them listed ("pull 8, list 5"), as dropshippers do. This changes the one rule left above.
- **AliExpress as a photo source,** even when the cost comes from Amazon. He judges it safer than eBay listings. Send to Cart & Keep already reads AliExpress pages.

Brand risk (agent-02, check 9) still applies: brands that enforce their listings on eBay, and counterfeit-prone products, which she should source only from authorised shops.

---

## Part 6. The other pages Keepr should read

| Page | What it holds | Why it matters to Keepr |
|---|---|---|
| Overview | to review, approved, live, sold; what needs her, most valuable first; money taken and kept; eBay traffic; "Amazon suppliers today"; why products were rejected | the rejection reasons are her taste, counted. "Kept" covers only sales with a cost recorded, so it is not a profit figure |
| Listings | what is live only (Part 15) | what sells raises a product family; what sits for 60 to 90 days lowers it (agent-02, Part 7) |
| Products | her shop's catalogue, drafts and live | a draft is not on sale |
| Coverage | the research funnel, and why products stopped at each stage | patterns there are fixed upstream, not by Keepr |
| Traffic | eBay impressions, views and sales per listing, ended listings included | her sales history (agent-02, Part 2) |
| Finance, Refunded | each refunded order, why, and products that keep coming back | a product refunded again and again is a returns risk before it is relisted |

If Overview and Candidates ever disagree, trust Candidates and report the difference.

---

## Part 7. Known problems to watch for

1. **Shop cards over Google's price:** 885 of 915 waiting were more than 10% over on 30 September; 498 had a cost above Google's lowest. Usually the size or variant. Handoff: `store-over-google-handoff-2026-09-30.md`.
2. **Wrong-pack pricing reaching Approved:** Fairy Platinum 19 washes priced from a 113-tablet listing (£20.42 for 19 tablets). Any "Shelf pack holds X, the listing this price came from holds Y" warning means the price is wrong, not only the cost.
3. **Duplicates approved twice:** Fairy Platinum 19 Washes Lemon (£20.42 and £19.47); Pedigree Dentastix Daily Dental Chews (twice). Note the other card.
4. **Pack confirmed at a large ratio:** Pedigree chewy cubes, £1.29 shelf against £12.39 eBay (9.6 times), confirmed with one click. Treat as unconfirmed until the titles or photos agree.
5. **Needs a look is broad by design:** until a card has a title, a description, photos and a parcel, it needs a look.
6. **Shop drafts waiting on returns:** 186 of 192 shop drafts wait only on "Returns to confirm" (1 October). A grouped returns screen is suggested, not built.
7. **Store cards with no eBay link:** store cards that gained eBay show no link to the listing that proved them. Brief: `ebay-link-handoff-2026-10-01.md`.

---

## Part 8. Decisions

| Decision | Who | Status |
|---|---|---|
| Where listing photos come from | Joseey | changed 1 October: anything except another eBay seller's own photo; the check informs, never blocks (Part 5) |
| Passed photos go in by themselves, she removes | Joseey | built 1 October |
| Photos from the same eBay listing, copied and renamed | Joseey | noted, not to be built until he says |
| AliExpress as a photo source | Joseey | noted; Send to Cart & Keep reads AliExpress |
| Price over the market | Joseey | never blocks: "let it list successfully" |
| Weight | Joseey | never blocks while her postage is flat or free |
| Channel states, lock, checklists; the eBay function and queue; bulk | Joseey | built 30 September |
| Returns and hazard for shop drafts | Joseey | built 1 October (Part 12); a grouped returns screen suggested |
| A daily check of cost and stock | Joseey | built 1 October for Amazon UK suppliers (Part 14); "we will come back to that extensively later" |
| Amazon out of stock holding List on eBay | Joseey | suggested |
| Listings shows only what is live | Joseey | built 1 October (Part 15) |

---

## Part 9. What Keepr may and may not do here

**May:**
- read every page above;
- write notes on cards, through apply-review with `--apply` after a list-only run;
- flag a card for the checks it fails, in the page's words ("Names Home Bargains", "£1.33 over the market at £8.66");
- suggest the order to list in, strongest first, within her selling limit;
- report patterns upstream: a shop whose copy keeps leaking into drafts, a band that keeps mis-costing parcels;
- move a card to the eBay listing that sells the product she buys, when it is 95% sure or more (Part 11), and write the listing again for it; under 95%, suggest the listing for her to take or turn down;
- check a shop draft's returns and label warning (Part 12);
- note photos it would not lead with, and report cards with no photos.

**May not:**
- approve, reject, confirm a pack, publish to eBay, add to the shop, or take a draft live;
- change a price, a title, a photo or a description, except by moving a card to another listing as Part 11 allows (she can always undo it with Switch back);
- add a rule that stops a listing; only eBay's own refusals stop one;
- move a card through a barcode, model number or pack size that disagrees, or to a listing she turned down;
- write a product's hazard record, mark a product "no warning label", or change a returns class she has saved;
- requeue a refused card, take a card out of the queue, or tick cards for a bulk action;
- count the "Kept" figure on Overview as her profit.

Plain British English, no em dashes, no emojis, no filler. Notes are for her, not for an engineer. Portal copy addresses her as "you", never "she".

---

## Part 10. Listing on 100 (built, 30 September, late)

- **Parcel:** eBay UK refuses the MAILING_BOX package type (error 216305), so none is sent. No parcel goes to eBay without a weight; flat and free postage need none.
- **Category and item details:** eBay's check saves the category and the details it still needs on the card, shown as a checklist line. Keepr fills required and recommended details (Type, Colour) from the card's facts, choosing only from eBay's own values; a specification the facts do not state is left for her.
- **Photo galleries:** shop pages are read for every product photo, not only the main one. A card read before this is read again on its next photo check.
- **Her supplier's page:** when the shelf product is not the product she will send, "Write it from [supplier]'s page" moves the listing to her supplier's page: facts, photos and barcode follow it, and copy written from the old product is cleared (her own photos stay).
- **The shelf product as it is:** "List the shelf product as it is" reads that product's own market on eBay UK (new, fixed price, UK sellers, brand and model in the title), shows what she keeps at its median, and prices from it. The price check then judges against that market, not the one that proved the card.
- **Descriptions:** a photo the model cannot read no longer fails the writing; doubt and backstage sentences ("please check the photographs", "not confirmed") are removed from buyer copy.

Keepr, reading a card: a card priced from another product's market (pack "not confirmed" at a large ratio, titles naming different models) is flagged to her with the shelf product's own market, never listed at the other product's price.

---

## Part 11. Moving a card to the listing she sources (built, 1 October)

The research proves a market with one eBay listing. The product she can actually buy may be a different listing on the same chart, or another product altogether.

- **The chart:** each dot on "Where it sells" is a listing and opens it on eBay. The key says so, and the listings are listed under the chart: the one the card prices from first, the research's under it as "Replaced" once moved, then the rest, each with "Use this listing".
- **Use this listing:** the listing is read in full from eBay (price with postage, sold, age, seller feedback, and the proof rule the research uses). Price, keep, the market and the checks are worked out from it.
- **Another product:** when the listing is not the product the card is written for, the title, description, photos, category, item details, parcel and price are set aside (kept for Switch back), and the listing is written again from what eBay holds for that product: brand, model, barcode, item details, and its seller's description as facts only, never its wording. Photos come from her supplier's checked page, eBay's catalogue (by barcode or the listing's catalogue id), or her own, under the photo rule in Part 5. The other seller's own photos never go up. The old shelf, its page and its stockists no longer price or describe the card.
- **Switch back:** returns the card to the research's listing with everything that was set aside.
- **Keepr's match:** her supplier's product (its page read, Amazon's through Part 14) against the chart's listings and an eBay search. A shared barcode is certain; another barcode, model number or pack size rules a listing out whatever else agrees. Otherwise Keepr judges from the text and photos and says how sure it is. At 95% or more it moves the card and says so, with the reason; under 95% it shows the listing with how sure it is and why, and she uses it or turns it down. Keepr looks when she adds a supplier with a link, when she writes the listing from a supplier's page, and when she presses "Ask Keepr to match".
- **What it costs:** one eBay search, up to four listings read, and one Sonnet 5.5 judgement with photos per look.

---

## Part 12. Returns and label warnings for shop drafts (built, 1 October)

Drafts from the Approved page used to land as standard returns with no hazard check at all. Now Keepr checks each one as it lands (`shop-rules`, migration 0115), and a draft nobody has checked cannot go on sale ("Returns and label not checked yet"; opening it in Products runs the check).

- **Returns:** standard is the default the law already gives, so it is confirmed as it lands, with Keepr's one-line reason shown. Sealed only and no return take a right away from the customer, so they wait for her to choose and save, as before. Once she saves a returns class, Keepr never changes it.
- **Chemicals:** a cleaner, drain unblocker, glue, paint, pest killer and the like is flagged for the label. The signal word, hazard and precaution statements with their codes, the GHS symbols and any HSE number are filled in only when printed in the facts or legible on a photograph, and say where they were read. A statement without its code is dropped. Nothing is guessed: with no readable label the boxes stay empty for her to copy from the bottle.
- **Hers to confirm:** a label read for her counts as a question for her, not a gap. Saving the sheet makes it the product's hazard record. "No warning label on this bottle" is only ever her tick.
- **On sale already:** never touched.

Keepr, reading the shop: a flagged chemical with an empty label is reported as needing the bottle in hand; a sealed or no-return suggestion is reported with its reason, never confirmed for her.

---

## Part 13. Sonnet 5.5, and other UK shops (built, 1 October)

**Model.** Every function and script uses Claude Sonnet 5.5 (`claude-sonnet-5-5`), at the same price as Sonnet 5. Calls go through `_shared/claude.ts` (copied into `draft`): a tool is offered rather than forced, marked strict, and asked for in the prompt; thinking is kept to its lowest setting; no sampling settings are sent.

**Other UK shops.** When fewer than three of the first shop's photos pass, or she presses "Look in other shops", Keepr searches the web for up to four other UK shops selling the same product. Amazon, eBay and other marketplaces are never used by this search (Amazon is read through Part 14 instead). Each page is read and must match on its own: a shared barcode, or the brand with the model number, or nearly the whole name with the same pack. A different barcode, model or pack rules a page out. Pages that did not match are listed with the reason.

- Their photos go through the same check as the first shop's, and passed ones are copied into her folder and go into the listing by themselves (Part 5).
- Their facts go to Keepr's writing as facts, never as wording.
- One search per card is kept and reused; "Look again" searches afresh. Each search costs about a cent.

Keepr, reading a card: photos from another shop are as usable as the first shop's. A card with no certain match anywhere is pointed to Send to Cart & Keep on her supplier's page, or her own photos.

---

## Part 15. Listings: what is live (built, 1 October)

Listings shows only what is live:

- active eBay listings from the latest morning pull;
- listings published from the portal since that pull;
- shop products on sale.

Drafts, the queue and ended listings are never rows; drafts live in Products. One product on both channels is one row with both marks.

- **The data:** the `live_listings` view (migrations 0119 to 0122), read 60 rows at a time, sorted and filtered in the database, built for 5,000. `live_listing_counts` gives every count from the same rows, so a tab and its list always agree.
- **Tabs:** All, On both, eBay only, Shop only.
- **Filters:** Selling, Not on your shop, Out of stock, Low (1 or 2 left), Quiet (no views in 90 days), Wanted (on sale on her shop, saved or put in a basket, never bought).
- **A row:**
  - the eBay mark links to the listing;
  - the shop mark says what the shop saw ("12 views", "no views yet", "3 baskets, no sale");
  - Left, Sold (with refunds), and Opened with "1 in N bought", green when above her average.
- **Opened, the eBay panel:** shown, opened and orders as rates against her own average, Sold on eBay, and Update on eBay.
- **Opened, the shop panel**, one of three:
  - on sale: a funnel (viewed, saved, in a basket, taken out, bought);
  - a draft: its gaps, each linking to the step, the money case, and Put on sale when nothing is left;
  - not there: Add to your shop.

**Her figures on 1 October:**

| Measure | Figure |
|---|---|
| Live | 452: 22 on both, 430 eBay only |
| Shop drafts | 192 |
| Not on the shop at all | 238 |
| Out of stock / low / quiet / wanted / selling | 26 / 82 / 35 / 4 / 22 |
| Her eBay average | 1 in 99 opens bought; 1.6% of times shown opened |

Keepr, reading Listings:

- the strongest eBay listings not on her shop are the first to suggest adding;
- a Wanted product on her shop is a price or trust question worth raising;
- a Quiet listing for 90 days lowers its product family.
