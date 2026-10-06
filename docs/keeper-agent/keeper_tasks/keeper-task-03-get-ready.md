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

## Keeper asks Keepr to match (4 October, `ck-keeper-match-2026-10-04`, migration 0139)
Joseey: "some product are not the exact ebay listings so we have different ebay listings that can be matched and switched to the products itself".
- New step after Amazon, eBay cards only, when no listing has been chosen and none is suggested: ebay-match, as "Ask Keepr to match" on the card.
- Keepr sure enough (its auto level, 95%): the card moves to that listing through `keeper_ready_move` (0139). Another product: the old writing is kept in `before` and cleared, and Keeper writes the card again. Never to a listing she turned down; never over a listing already chosen.
- Less sure: the listing is put on the card as Keepr's suggestion, for her to choose.
- About 1p a card. This zip carries everything since `ck-keeper-shop-cards` (writes anyway, reads the size, matches).
Deploy: SQL 0139; keeper-run, ebay-compose, photo-check; portal.

## Keeper learns (4 October, `ck-keeper-learns-2026-10-04`, migration 0140)
Joseey: "keeper learn shouldn't be about my corrections but also its own"; "no need to always wait for approval".
- **Looks back** once a get-ready run ends (done, or stopped by her): `keeper-run/review.ts`. It gathers what it has not seen: the run's Needs you cards and why, cards it could not finish, eBay's refusals of cards it got ready (listing_jobs failed), her changes to what it wrote (draft vs `keeper_ready.wrote`), and Keepr matches she turned down (`entry_dismissed`). Claude writes up to 8 short lessons, each for a brand, a category or everything, with an area (writing, photos, details, match, parcel, general) and a count of cards for and against. About 1p a look. Each change and refusal is counted once (`keeper_seen`).
- **Lessons** live in `keeper_lessons`, written only through `keeper_learn`. In use once two cards back one and more are for than against; no approval needed. She removes one with `keeper_lesson_remove`; a removed lesson stays removed.
- **Used while it works:** the lessons for the card's brand, category and everything go to the writer (titles, descriptions) and to eBay's item details. A photos lesson with action `catalogue_photos_first` for a brand puts eBay's catalogue photos in first for eBay cards. Each card records the lessons it used.
- **Office:** "What Keeper has learned" on the Get it ready tab: each lesson, its scope, where it came from (its own work, eBay, your changes), the cards behind it, and Remove. Lessons seen once are shown on request.
Deploy: SQL 0140; keeper-run, ebay-compose, ebay-list; portal.

## 100% over, and Amazon's price as the cost (4 October, `ck-keeper-cost-2026-10-04`)
Joseey: "regardless of the price a product is not too expensive even at 50% over or 100% over... we can list to even know the product analytics, if people are truly searching for it and opening it but not buying, then we will work on the price"; "the keeper match will reduce it when its match to the real product". And: a shop dearer than Amazon (CompleteCare) kept its price on a card, and she had to add the Amazon link in Found it cheaper herself.
- `OVER_OK` in golive.js is 100% (was 25%). Shop cards keep no market rule beyond not selling at a loss.
- Keeper's Amazon step now puts Amazon's price from the reading on the Amazon supplier when it has no cost or an old one, by the morning read's rule (costFollow): a cost she set, or an import's, is never moved. The card then costs from the cheapest supplier, Amazon included.
Deploy: keeper-run; portal.

## Fixes round (4 October, ck-keeper-fixes.zip)

Joseey: "yes for everything lets fix them properly".
- **Impossible details left out.** The writer (KEEPER_MODE) and the item details fill (`_shared/aspects.ts`) leave out a detail that cannot belong to the kind of product, even when the supplier's table states it (Aico module with "Fluorescent / 600 Lumens").
- **Different product judged from the card and her supplier only.** In Keeper's mode the research's search words are no longer given to the writer (Kylie bed pad false alarm).
- **Keepr matches only on eBay cards.** The portal asks Keepr after a supplier or page change only when the card wants eBay. ebay-match reads `draft.supplier_url` first. Its fallback to her newest supplier ordered by `created_at`, which `candidate_sources` does not have (`found_at`), so the fallback had never worked; fixed.
- **One Amazon supplier per product.** Adding an Amazon link whose ASIN is already on the card updates that row instead of adding a second. `check-duplicate-amazon.sql` (read only) lists cards that already have two.
- **Postage from the card's parcel.** `atParcel` (pricing.js): a weight on `draft.package` picks the band, up or down, for shop and eBay cards. The "No weight on file" note and the eBay "bulky" note go once a weight is on the card. Over 20kg: courier, costed at the 20kg price as the least, with a note. "You keep" moves with it.
- **Chart: no change.** The break-even rail and "You keep" read the same cost and costs. The Aico "loses under £58.06" was before Amazon's price was on the card (City Plumbing's £52.64); the Amazon-cost step fixed the cause.

Deploy: ebay-compose, ebay-match, ebay-list, then the portal. No SQL.

## Fixes 1 to 3 (4 October, ck-fixes-1-3.zip)

The run of 4 October went on through about 68 cards after Claude's credit ran out, filing each as Needs you ("Your credit balance is too low"). The Salus card showed Ready with no real cost. Ready for eBay only ticked cards, so there was no way to see them alone.
- **Pause on credit:** `_shared/credit.ts` tells a credit refusal (Anthropic or Apify) from an ordinary failure; a busy moment is not one.
  - Every call Keeper makes goes through one guarded call. A credit refusal puts the card back in the queue where it got to, its tries untouched, and pauses the run with a reason she sees: whose credit, where to top up, and that Carry on picks up from there.
  - photo-check no longer swallows a credit refusal as "no photos passed".
  - The look-back leaves out cards held up by credit.
  - The office shows a reason starting "Paused:" to her as well as the studio.
- **No real cost means not ready:**
  - Portal (golive): an eBay card priced from what the market leaves (`costBasis 'market'`) gets a profit check that fails, though it is not hard: "No cost yet: keeps £5.02 only if it costs you under £41.87". So it is not Ready and not in Ready for eBay, but she can still list it knowingly.
  - Keeper (`costKnown`): such a card needs "what you pay for it" and goes to Needs you.
- **Ready for eBay / Ready for your shop** now show those cards alone and tick them; pressed again, back to every card. `?only=readyEbay` and `?only=readyShop` open them.
- Also found: migration 0140 (Keeper learns) had not been run. Run it with the zip it came in; `reviewed_at` was then set on the 4 October run so nothing is learned from the credit failures.

Deploy: `keeper-run`, `photo-check`, then the portal. No SQL. Tests: ready_test 24 pass (with the credit stop, Apify credit, busy moment is not credit, no-cost card needs her, costKnown), review_test 3.

## Fixes 4 to 7 (4 October, ck-fixes-4-7.zip)

- **Same model number, same product** (`_shared/match.ts`): the Salus card's brand "Salus Controls" against eBay's "Salus" read as another brand and scored 0.15, so Keepr called the same RT310RF another product. That dropped the card's cost and rewrote it. Now:
  - one brand name inside the other (or the brand's first word) is the same maker;
  - a shared model number with no brand against it scores 0.85.
- **The listing that sells is kept** (ebay-match `keep_proved`, ready.ts): when the research's listing is proved and Keepr's find is the same product and unsold, Keeper does not move the card. It notes "Kept the eBay listing that sells…". She still sees Keepr's find when she asks on the card.
- **A reading with no price is never fresh**, in supplier-read and in Keeper: it is read again whatever its age.
- **No Buy Box, step one** (`_shared/amazon.ts priceFieldsOf`): a reading with no price keeps the reader's price, seller and variation fields under `offer.seen` (at most 1,500 characters). After one Read again on the Salus (B071GR4FS3), read `supplier_read->offer->seen` to see where Apify puts the other sellers' price, then build the rest.
- **No Amazon price** button on Approved: cards whose Amazon page was found with no price, shown alone and ticked; `?only=noAmazonPrice`.
- **eBay's Type**: the item details request now gives a required classification specific its closest honest value (its plain name when free text), and leaves it out only when nothing could answer it.
- **Titles over 80** (KSR, FireAngel "none came back"): every suggestion over 80 was dropped. Now:
  - the writer asks once more, saying how long they were;
  - if they are still too long, it cuts the shortest at a word (`cutTitle`).
- **Parcel sense** (`sensibleParcel`, parcel.ts): under 2g a litre of parcel (from the weight, or the title's "150ml" / "2kg" when there is none), the size is left out and the weight kept, with a note. It catches the 150ml gel at 165 x 51 x 51cm and the umbrella at 110cm each way; a 148cm shovel at 3.1kg and a 300g lampshade in a 40cm box pass.

Deploy: ebay-compose, ebay-list, ebay-match, keeper-run, photo-check, supplier-read (all load a changed shared file), then the portal. No SQL. Tests: match 4, parcel 10, parcel-read 3, ready 25, review 3, source 13, amazon-source 23. amazon_test needs its fixture (`_shared/fixtures/axesso-shavingfun.json`), which is not in the studio copy.

## The second run, and lessons (4 October, ck-keeper-lessons.zip)

69 cards for £2.85: 53 ready, 16 need her (the first run: 25 of 118). The 16:
- **Real variant or size differences**, hers to settle (the right Amazon page, or reject): Aico ei208, Bedec, Charles Taylor planter, d-c-fix, Eco Solutions, Miracle-Gro, Nikwax, Virbac, Zero In.
- **False alarms, now fixed in the writer:** Gravitas HydroSnake (brand written differently) and Tonies (figures left out). KEEPER_MODE now says a brand written differently, other words for the same thing, or details left out are not a different product.
- **No photos passed** on shop cards, which have no eBay catalogue to fall back on: ASOBU, Dreamland, Fresh, Ion8, Jovikids. Reasons asked for; not yet known.

Lessons:
- **Merging (`mergeAlike`, review.ts):** a new lesson that reads like one Keeper has (half the shorter one's words shared, same area and scope) takes its key, so it is counted there, and a removed one stays removed. Two alike in one look back become one.
- **Matching lessons reach Keepr:** ready.ts sends the `match` area lessons to ebay-match, which gives them to `judgeSame` (same-product.ts). Before this, a match lesson showed "In use" but nothing read it.
- Joseey removes the near-copies by hand: 1, 3 and the second LEGO lesson.

Deploy: keeper-run, ebay-match, ebay-compose. No SQL. Tests: review 4, ready 25.

## Claude's cost (4 October, ck-claude-cost.zip)

Her usage export: 4 October was 6.15M input tokens (not cached) and 0.25M output, about $22 and 85% of the month. That is about 30,000 input tokens, 11 to 12p, a card. Keeper's meter said 4 to 7p, because it estimated. Most of the input was photos.
- **The writer works from words** (ebay-compose): no photos when there is supplier text, a shop page or eBay's details. It used to send up to 4 photos with the title and again with the description. Photos only when there are no words, at most 2.
- **Photos looked at 800px** (`_shared/look-size.ts forLooking`): Amazon (`._SL800_`), eBay (`s-l800`) and Shopify (`width=`) serve a smaller copy. photo-check sends that to Claude, and still measures and saves the full photo. Keepr's match asks for 500px.
- **Keepr reads the words first** (same-product.ts `judgeSame`): photos are sent only when a listing is left between 50 and 94% sure.
- **Keeper counts real usage** (`_shared/usage.ts`): claude.ts `post` notes every reply's `usage`, collected per request and per card (AsyncLocalStorage). The four functions Keeper calls are wrapped in `metered` and send `x-claude-usage` back; keeper-run's callFunction reads it, and `pence` prices it at `PRICE` in model.ts ($3 in, $15 out, $3.75 cache write, $0.30 cache read per million) times KEEPER_GBP_PER_USD. The old per-step estimates count only where a function reported nothing. The look back is counted the same way.
- Expected: about 4 to 5p a card, down from 11 to 12p. To be checked on the next run against the Anthropic console.

Deploy: ebay-compose, ebay-list, ebay-match, keeper-run, photo-check, shop-rules (all load claude.ts). No SQL. Tests: usage 3, look-size 1, ready 26, review 4, source 13, match 4, parcel 10, amazon-source 23.

## The eBay queue's schedule, and the Overview Amazon panel (5 October, ck-queue-overview.zip)

- **The queue had never run on its schedule.** Since 0100, scheduled calls prove themselves with `x-scheduler-secret` (the service key stored for the schedule no longer matches the functions'). ebay-queue only accepted the service key, so every minute's call got 401 "Not authorised for this shop". Cards listed only when the portal kicked the queue on queueing. ebay-queue now accepts the scheduler secret (constant-time compare, as supplier-read). Confirmed 5 October: the next call answered 200 and listed the two waiting since the 4th (Croydex, LEGO 75440); `net._http_response` showed the 401s before it.
- **Overview, Amazon suppliers:** 123 warnings in one column, mostly approved cards with readings from when they were sourced. Now two groups:
  - **Live on eBay** first: the 7am check reads only these, and a supplier out of stock is an order she cannot fill.
  - **Approved, not listed yet:** settle these before listing.
  - Five each, with "Show all" and "Open Approved". The header's "Live checked" comes from live cards only.
  - The Needs you line leads with live listings.
