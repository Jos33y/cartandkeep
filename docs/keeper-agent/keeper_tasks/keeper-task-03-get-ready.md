# Keeper task 03: getting approved cards ready for eBay

Built 4 October 2026, zip `ck-keeper-ready-2026-10-04`. Migration 0138. Functions: keeper-run, supplier-read, ebay-compose.

## What Joseey decided (4 October)
- Get it ready leaves the Approved page. Keeper does it in its office (`/keeper/ready`), so there is one way, not two.
- Up to 25% over the market counts as fine ("lets use 25% thats safer"). Over the market is not wrong in itself; many eBay listings sell over it.
- A card's Amazon page is read again when its reading is more than 48 hours old.
- The 7am Amazon check reads only cards live on eBay with an Amazon supplier. It was reading every approved Amazon card (up to 240 a day) and used up the Apify free plan. Paused on 4 October; turn it back on after supplier-read is deployed.
- The title and description should be as strong as they can be. The parcel size and weight come from Amazon's details where they exist.

## How cards reach Keeper
- **Approved, the Keeper strip:** "Keeper can get N more cards ready for eBay". The cards picked are those still to list on eBay and missing something, with the price check passing (in the market or up to 25% over), the pack confirmed, in stock on Amazon, no "check the pack" or "a bundle" warning, not approved twice, and not got ready by Keeper before. On 4 October that was 39 of 281.
- **Ticked cards:** "Get N ready with Keeper" in the bulk bar. Any ticked card still to list on eBay goes, including one got ready before.
- **One card:** "Get ready with Keeper" on the card. Shows "With Keeper, getting it ready" while it waits.
- **A card moved to another product:** goes to Keeper by itself. Its old note and parcel are cleared.
- Cards sent while a run is going join that run (`start_ready_run`, 0138).

## What Keeper does to each card (keeper-run/ready.ts)
Only what is missing. Every write goes through `keeper_ready_fill`, which fills a field only while it is still empty at the moment of writing.
1. **Amazon:** reading older than 48 hours is read again through supplier-read. If Apify fails, the saved reading is used and the card says so.
2. **Photos:** the photo check of the Amazon gallery; if nothing passes, the shop page, other UK shops and eBay's catalogue, once. Passed photos go in after hers, plain shots first, up to 12.
3. **Words:** title and description through ebay-compose.
   - Title: brand, model number, plain product words, key spec, pack, 70 to 80 characters, using the words in the titles of listings selling the same product (most sold first), never copying one.
   - Description: what it is and who it is for, then Key features, What's in the box, Size and weight, Good to know.
4. **eBay:** a dry run of ebay-list fills the category and the item details.
5. **Parcel:** Amazon's package size and weight as they are; else the product size plus 2cm each way and the item weight packed; else a size or weight in the page's words. Her own size or weight is never replaced. The card says where it came from.

It never lists. Each call does the steps it has time for (30 seconds a card) and keeps its place; a failing step is tried three times from where it stopped.

## Out-trays
- **Ready to list:** title, description, photos, category and item details in.
- **Needs you:** what Keeper could not fill, said on the card ("Still needs a title, eBay's Brand").
- **Could not finish:** stopped three times; send it again from Approved.

Each card carries Keeper's note (`draft.keeper_ready`: when, what it added, notes, what is still needed), shown on the card in Approved.

## Cost
About 5p a card when every step runs: Apify page read 0.12p, photo check 2p, title 0.6p, description 0.9p, item details 0.8p. Spending limit per run 8p a card, at least £1.

## Deploy order
1. Run `supabase/migrations/0138_keeper_gets_it_ready.sql` in the SQL editor.
2. Deploy keeper-run, supplier-read, ebay-compose.
3. Turn the 7am check back on: `select cron.alter_job(jobid, active := true) from cron.job where jobname = 'supplier-daily-checks';`
4. Redeploy the portal in Coolify.
