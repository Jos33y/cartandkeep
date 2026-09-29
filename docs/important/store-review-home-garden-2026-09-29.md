# Store cards review: Home & Garden, 29 Sept 2026

Source: export-store.mjs over the store batch (578 cards, none decided yet), rerun with the shop's page name. Reviewed file: research/review/store-home-and-garden-review-2026-09-29.csv (action, reason and note per card).

## Frame (decided by Joseey)
A store card's job is to prove the product is sourceable in the UK. The price where it was seen is a starting cost, not the target. "Found it cheaper" is how the price comes into the market. Being over Google's lowest is not a problem to fix at import.

## What the review checks (decided by Joseey)
Right product, fit for her store, can she ship it, duplicates and variants.

## Actions on her live cards (applied 29 Sept, 272 written)
- keep 252: nothing written
- note 160: courier-only, fragile, bulky, check by eye, low-priority decor, and 7 cards whose linked size sits inside Google's range (list that size)
- reject 77: not her shop 45 (wrong_category), duplicates 15 (other), wrong-linked decor and premium brand 17 (not_sourceable)
- defer 35: premium brands, Later
- resource 54: see below

## Re-sourcing the 54 (resource.mjs over 836,704 shelf products, 42 files)
- The script found 28 at another shop, 26 not found.
- Checked by eye: all 4 barcode matches and both model matches right; 9 of the 22 name matches wrong again (Brita 3 pack, Aurora GU10 in white, Croydex two tier, Luceco regressed, Villeroy gourmet plate, Xpelair Standard, Vanish powder, CareCo corner mat, Resolva 5L).
- Corrected results: 17 repointed, 2 left as a note for her (Fairy Platinum gel; Crosswater brushed steel at £92.57), 35 rejected not_sourceable with the nearest find in the note.
- Lesson: a name match alone is still wrong about 4 times in 10 on these hard cases. Barcode and model matches were right every time. Candidate change: resource applies only barcode or model matches automatically and turns name matches into notes. Not yet decided.
- Added after the check: counts written as words (Two Tier) compare as numbers; liquid against powder is a kind clash.

## Right product: findings
- 57 of 578 "confirmed" matches link a different product; 26 more link another size, pack or design.
- Wrong on name matches (45 of 522) and on model matches (12 of 56).
- Causes: brands with a digit (Ion8) counted as a model number; generic Google titles matching any page with those words; the page's barcode read but never compared.

## Build, 29 Sept (approved by Joseey)
- match.mjs: brand words are not models; more version words and kind pairs; counts as words; barcodeVerdict(). Tested on the 578 labelled cards: catches 30 of 57 wrong products (was 2), no good card newly flagged.
- page.mjs: barcode from offers, itemprop, meta tags and page data.
- check-picks.mjs: the barcode decides first; page_gtin column; --refetch to re-read pages for barcodes.
- shelf.mjs: shared shelf loader (store-picks output unchanged). price-store.mjs: shared priceStore.
- resource.mjs: --no-fetch, --apply, --from; a "check it" find becomes a note with the link; a reject note names the nearest find.
- apply-review.mjs: writes a review's rejections, Later and notes; list-only by default; never overrides her decisions.

## Other open items
- Postage: 516 have no weight and were costed as a 2kg small parcel; about 50 bulky items are really medium parcels.
- eBay join flaw: addEbay marks the store item as the same pack as eBay without checking. resource.mjs sets unknown pack on cards it repoints; addEbay itself still to fix.
- 73 have no subcategory.
- Google's price range is before delivery; charging delivery separately would put 79 in the market instead of 32. Open decision.
- export-store found 0 eBay cards that gained the shop. To check.
