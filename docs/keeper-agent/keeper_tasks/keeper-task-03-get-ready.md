# Keeper task 03: getting approved cards ready to go live

Built 4 October 2026, zips `ck-keeper-ready-2026-10-04` and `ck-keeper-shop-cards-2026-10-04`. Migration 0138. Functions: keeper-run, supplier-read, ebay-compose.

## What Joseey decided (4 October)
- Get it ready leaves the Approved page. Keeper does it in its office (`/keeper/ready`), so there is one way, not two.
- Up to 25% over the market counts as fine ("lets use 25% thats safer"). Over the market is not wrong in itself; many eBay listings sell over it.
- The cards from the Google research are for her shop only. Keeper gets them ready as shop drafts. "Whats important is ebay", so eBay cards go first.
- A card's Amazon page is read again when its reading is more than 48 hours old.
- The 7am Amazon check reads only cards live on eBay with an Amazon supplier. It was reading every approved Amazon card (up to 240 a day) and used up the Apify free plan.
- The title and description should be as strong as they can be. The parcel size and weight come from Amazon's details where they exist.

## A correction on the numbers
On 4 October I counted 39 cards "up to 25% over the eBay market". Most of those were store cards from the Google research, whose "over" is against Google's lowest shop price, not eBay's, and which are meant for her shop only. Only 6 eBay cards passed. The rest go to Keeper as shop cards.

## How cards reach Keeper
- **Approved, the Keeper strip:** "Keeper can get N more cards ready: E for eBay first, then S for your shop."
  - eBay cards: still to list on eBay and missing something, the price check passing (in the market or up to 25% over), the pack confirmed.
  - Shop cards: meant for her shop only, still to add and missing something, not at a loss.
  - Both: in stock on Amazon, no "check the pack" or "a bundle" warning, not approved twice, not got ready by Keeper before.
- **Ticked cards:** "Get N ready with Keeper" in the bulk bar, eBay cards first. Any ticked card goes, including one got ready before.
- **One card:** "Get ready with Keeper" on the card. Shows "With Keeper, getting it ready" while it waits.
- **A card moved to another product:** goes to Keeper by itself. Its old note and parcel are cleared.
- Cards sent while a run is going join that run at the back (`start_ready_run`, 0138).

## What Keeper does to each card (keeper-run/ready.ts)
Only what is missing. Every write goes through `keeper_ready_fill`, which fills a field only while it is still empty at the moment of writing.
1. **Amazon:** reading older than 48 hours is read again through supplier-read. If Apify fails, the saved reading is used and the card says so.
2. **Photos:** the photo check of the Amazon gallery; if nothing passes, the shop page, other UK shops and eBay's catalogue, once. Passed photos go in after hers, plain shots first, up to 12.
3. **Words:** title and description through ebay-compose.
   - Title: brand, model number, plain product words, key spec, pack, 70 to 80 characters, using the words in the titles of listings selling the same product (most sold first), never copying one.
   - Description: what it is and who it is for, then Key features, What's in the box, Size and weight, Good to know.
4. **eBay (eBay cards only):** a dry run of ebay-list fills the category and the item details.
5. **Parcel:** Amazon's package size and weight as they are; else the product size plus 2cm each way and the item weight packed; else a size or weight in the page's words. Her own size or weight is never replaced. The card says where it came from.

It never lists and never adds to the shop. Each call does the steps it has time for (30 seconds a card) and keeps its place; a failing step is tried three times from where it stopped. A shop card that is ready is added with "Add N to your shop" in Approved, and Keeper task 01 then checks the draft.

## Out-trays
- **Ready to go live:** everything Keeper can fill is in. List it on eBay, or add it to the shop.
- **Needs you:** what Keeper could not fill, said on the card ("Still needs a title, eBay's Brand").
- **Could not finish:** stopped three times; send it again from Approved.

Each card carries Keeper's note (`draft.keeper_ready`: when, what it added, notes, what is still needed), shown on the card in Approved.

## Cost
About 5p a card when every step runs: Apify page read 0.12p, photo check 2p, title 0.6p, description 0.9p, item details 0.8p (eBay cards only). Spending limit per run 8p a card, at least £1.

## Deploy order
1. Run `supabase/migrations/0138_keeper_gets_it_ready.sql` in the SQL editor.
2. Deploy keeper-run, supplier-read, ebay-compose.
3. Turn the 7am check back on: `select cron.alter_job(jobid, active := true) from cron.job where jobname = 'supplier-daily-checks';`
4. Redeploy the portal in Coolify.

## Keeper writes anyway (4 October, `ck-keeper-writes-2026-10-04`)
The first run sent 16 of 27 to Needs you, 10 of them refused by the writer's "sources disagree" rule over details (a coverage figure, a battery line, a finish, a minifigure count). Joseey: "when things are too complicated or strict it causes error".
- **ebay-compose, Keeper's mode** (`keeper: true`): never refuses. Her supplier's page, matched by barcode, settles disagreements; where it disagrees with itself the table's figure is used, else the detail is left out. A different product (Chappie: Amazon Chicken, card Beef) is written from Amazon with a `DIFFERENT:` note; the card goes to Needs you with "a check: ...". The portal's own calls keep the old rule.
- **photo-check:** the brand list no longer skips a brand's photos (LEGO had none). The brand is kept as `brand_listed`. Checks made before are made again by Keeper.
- **eBay's catalogue photos** go in for an eBay card when no other photo passes.
- **An empty title or description** is asked for once more.
- **Item Height, Width, Length, Weight** are filled from Amazon's product size when eBay asks for them.
- **Office:** "Carry on with N cards" sends the ones that need her (again) and the ones not started, in their first order.
Deploy: keeper-run, ebay-compose, photo-check; portal.

## Keeper reads the size and weight (4 October, `ck-keeper-reads-2026-10-04`)
Joseey: "regardless of how the weight and co is measured or done, its meant to read and understand". The FireAngel SCB10-R gave Depth, Width and Height on separate lines and its weight in pounds; the pattern reader missed them and the band's 45 x 35 x 16cm stayed.
- `_shared/parcel-read.ts`: Claude reads the page's facts (table, bullets, description) once per card, in any units and any layout, and gives the product and package size and weight in cm and kg (0.4p a card). The packing rules stay in code: package as it is, else product plus 2cm each way, weight packed. The pattern reader is used if this fails.
- The same reading fills eBay's Item Height, Width, Length and Weight.
- ebay-compose writes sizes and weights in metric (0.44 lb is 200 g) in titles and descriptions.
- Cards already got ready keep their parcel until they go round again (tick, Get ready with Keeper); only the empty size is filled.
Deploy: keeper-run, ebay-compose, photo-check; portal.
