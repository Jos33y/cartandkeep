# Store rules: one place for every category

30 September 2026. Pipeline change; no portal change.

## Why

8 more Google categories are still to run. The filters (own label, not a shelf product, restricted, cannot be posted) used to be three regexes inside `shelf.mjs`, so each fix meant editing a script. They now live in `scripts/store/rules/`: one list per concern, plus an optional file per category.

## Layout

| File | What it stops | Add to it when |
|---|---|---|
| `rules/own-label.mjs` | brands only their own shop sells | a review rejects a card as a shop's own brand |
| `rules/not-shelf.mjs` | made to measure, furniture, plants, experiences, second hand, and calendars or diaries for a past year | a non-shelf product type gets through |
| `rules/restricted.mjs` | prescription and shop-shelf medicines, whitening, lenses, infant formula, prescription pet diets, banned cosmetics, perfume dupes, CBD, nicotine and tobacco, alcohol, weapons | something is not legal for her to sell |
| `rules/post.mjs` | what Royal Mail will not carry: compressed gas (including fire extinguishers), flammables, oxidisers (hydrogen peroxide cleaners), corrosives, non-toiletry aerosols, fireworks | a product cannot go by Royal Mail |
| `rules/categories/<category>.mjs` | extras for one category only | a rule is right for one category and wrong for others |

`post.mjs` also holds **postage limits**. These are not stops: the product goes through, and the import adds a note to her card:

- toiletry aerosols: 500ml max per item, 2 per parcel, ID8000 label;
- perfume: 150ml max per item;
- nail polish: 30ml max per item;
- loose lithium batteries cannot be posted;
- sprays that may be aerosols.

The source is the Post Office "what can I send" guidance, checked 30 September 2026.

## Order

`stopOf({ title, brand, category })` runs the checks in this order: own label, not shelf, restricted, cannot post. The first stop wins. It returns the rule and the words that caught the product, so a wrong stop traces back to one line.

## New category routine

1. Save the exports to `research/google/<category>/`.
2. Run `node scripts/store/rules-check.mjs --google=research/google/<category>`. It lists every stop with its best-ranked examples, plus the postage notes and the need words. It reads only.
3. Fix wrong or missing stops in the rules files. Add `rules/categories/<category>.mjs` and `needs/<category>.mjs` if the category needs them.
4. Then run store-picks, check-picks and import as usual.

## Other changes the same day

- **Coverage:** a new stop reason, `cant_post`. The migration `NNNN_store_coverage_cant_post.sql` must run before the next import.
- **Import:** re-applies the rules to the picks file, so a file made before a rule existed can't bring the product in. It stores `margin.post` and writes the postage note once per card.
- **resource.mjs `--apply`:**
  - Only a barcode match repoints a card.
  - A name match becomes a note with the lead.
  - Nothing found becomes a note, never a rejection (29 September: 9 of 22 name matches were wrong; 30 September: 4 of the 6 "not found" were unsure, not wrong).
- **Need words:** "water repellent" no longer counts as a pest need.
- **Own label added:** MonsterShop, T-Mech, Home Discount, 3 Peaks, Pets at Home.

## Tested

On the Home & Garden exports (20,890 products), the new rules catch exactly the cards the 30 September review rejected by hand:
- the SodaStream gas cylinders;
- the vodka cans;
- T-Mech, Home Discount and 3 Peaks.

On the same exports they also stop:
- 32 compressed gas products (fire extinguishers, cream chargers);
- 4 aerosols;
- 5 flammables;
- 2 corrosives.

False stops found in the test were fixed before delivery: petrol garden tools, "aerosol-free" sprays, smoke alarms with sealed lithium batteries, and perfume-named plants and diffusers.

## First live test (Home & Garden, 49,713 products, 4 exports)

The second pass fixed the false stops the live run showed:

- **Alcohol:** now only the drink itself. A drink word must come with a size, pack, can, bottle or tasting, and the title must not name barware. Whisky smoker kits, "Au Vodka" glasses and cups, and mulled-wine-coloured figures now pass.
- **Fireworks:** only real firework packs. Firework-style lights now pass.
- **Aerosols:** "non aerosol" dispensers now pass, and so does "compressed air" in a vacuum cleaner's description.
- **Hydrogen peroxide:** cleaners move from "whitening" to a new "oxidiser" can't-post rule. Tooth whitening with peroxide stays restricted.
- **Inhalers:** only medicine inhalers are stopped. Herbal and aroma inhalers pass.
- **Postage notes:** no longer added to empty spray bottles, home perfume or battery-powered lights.

## Store rules and the eBay gate (`risk.js`)

`risk.js` is the eBay scan's own filter, and it stays separate: the eBay gate and her shop have different risks. On 30 September the store rules took from it what also applies to her shop, plus a few things neither list had.

**Taken from `risk.js`:**
- **Shop-shelf medicines:** paracetamol, ibuprofen, Nurofen, Calpol, Lemsip, Gaviscon, Imodium, Sudafed, Piriton, hay fever and cold and flu tablets, and so on. Selling any medicine online needs MHRA distance-selling registration. Mixed ranges are stopped only on the medicine itself: Vicks VapoRub, not Vicks humidifiers; Canesten thrush cream, not the intimate wash.
- **Minoxidil and Regaine.**
- **Infant formula:** first and follow-on milks only. Toddler milk passes.
- **Prescription pet diets.**
- **Calendars, diaries and advent calendars for a past year.** This is read against today's year, so it never needs updating.
- **Second hand:** refurbished, pre-owned, renewed.

**New, in neither list before:**
- **Perfume dupes:** "Dupe", "smell-alike", and "inspired by" with a fragrance word. Selling a copy under the original's name is trademark infringement.
- **Banned cosmetics and unlicensed injectables:** hydroquinone, skin bleaching, melanotan, dermal fillers, hyaluron pens, poppers. "Botox effect" serums and lip plumping glosses pass.
- **Tobacco:** cigarette cases and cigarette-scented incense pass.
- **Can't post:** gas and refillable lighters (USB arc lighters pass), matches, and car and lead-acid batteries.
- **Postage note for bladed articles:** kitchen knives and knife sets need an age check at checkout and Royal Mail Tracked Age Verification delivery (Offensive Weapons Act 2019). Sharpeners, racks and razor blades pass without a note.

**Kept for eBay only, not her shop:**
- perfume and the fragrance houses (eBay's most counterfeit-reported goods);
- the brand takedown list (iPhone, Rolex, Nike and so on);
- sized clothing.

**False holds seen in `risk.js`, not yet fixed:**
- "omega" blocks every Omega-3 supplement;
- "formula" blocks "Advanced Formula" titles;
- "eau" blocks Avène Eau Thermale;
- "homme" and "femme" overreach the same way.

## Not shelf: stop the thing, not its parts (30 September, later)

The not-shelf list came from the old `shelf.mjs` and stopped a word anywhere in the title. So "fridge" stopped fridge water filters, "radiator" stopped radiator valves, "mattress" stopped toppers and protectors, "cooker" stopped slow cookers, and "print" stopped leopard-print throws.

Each entry is now `[word, only, unless]`:
- **word:** the word to look for.
- **only:** a big appliance needs a type or size as well: integrated, freestanding, 60/40, 8kg, 40L, and so on.
- **unless:** the part, accessory or small version lets it through: filters, valves, covers, toppers, gloves, tablets, slow, pizza, portable, oil-filled.

**Checked on the Home & Garden exports:**
- not-shelf stops went from 3,955 to 3,144, freeing 928 good products;
- plurals the old list missed are now caught: live "Plants" and "Trees", and "Photo Prints";
- lawn and bird seed pass: they're shelf products;
- a "double door pent shed" and a "Type 22 compact panel radiator" still stop;
- oil-filled and plug-in electric radiators pass as portable heaters.

**Other fixes the same round:**
- **Exemptions now clear only their own rule.** "Alcohol-free" clears alcohol only, and "nicotine-free" clears nicotine only. A nicotine-free vape still stops as a vape, and neither ever clears a medicine.
- **Nicotine brands added:** NiQuitin, Nicorette, Nicotinell.
- **Shop-shelf medicines added:** Fybogel, Acnecide, Duac, benzoyl peroxide, Olbas, Echinaforce, and "traditional herbal medicinal" (licensed herbal medicines).
- **Health & Beauty diagnostics:** `categories/health-beauty.mjs` stops test strips, reagent strips and test kits in that category only. Meters and monitors pass, and pool test strips in Home & Garden pass.

## Hardware rules (1 October)

Tested on the Hardware export for August 2026: 19,123 products. 13,744 pass the rules, and 5,660 of those are inside the £8 to £60 window.

**New file `rules/categories/hardware.mjs`.** Building materials are not shelf products for her. They're sold by length, area or tonne, they're too long or heavy for a parcel, and people buy them from a builders' merchant. The file stops:
- timber, sheet materials and mouldings;
- fencing, decking, paving and aggregates;
- cement and bricks;
- flooring, carpet, tiles and wall panels;
- doors, windows and roofing sheets;
- baths, shower trays, basins and worktops;
- slab and roll insulation;
- anything over 20kg or sold in 3m lengths;
- consumer units, RCBOs, MCBs and RCDs, which an electrician fits under Part P. Plug-in RCD adaptors pass.

Their fixings, tools, adhesives, fillers, handles and repair products all pass.

**Own label added:**
- B&Q and Screwfix brands: GoodHome, Diall, Mac Allister, Erbauer, Titan, LAP, No Nonsense;
- tile shops: Porcelain Superstore, Tile Mountain, Topps Tiles.

**False stops fixed:**
- "Tobacco" as a colour on carpet and laminate;
- Rennie Tools drill bits;
- shed and fence protector;
- wallpaper primer;
- drain rods and drain machines (only the chemical is corrosive);
- a "CR1306" socket read as a coin battery;
- knife-grade glue;
- battery chargers.

**Can't post added:** Calor and Flogas gas, and propane, butane and MAPP gas.

**New postage note:** paint, varnish and wood stain can go by post only when water-based. Solvent-based is flammable, and the title rarely says which (779 products).

**Query keys (`match.mjs`):**
- electrical ratings (30mA, 6kA, 13A, 100A) are no longer read as models;
- counts are kept: 1 gang or 2 gang, 2 way, 2 socket;
- a short model keeps its battery capacity, so a Milwaukee M18 2.0Ah and a 5.0Ah get separate keys.

Lumped keys on Hardware fell from 21 to 5. On the Home & Garden export, 17 of 19,828 keys changed, all for the better. The import matches cards by title, so no card is duplicated.

**Watch in the Hardware review:**
- **Loose tool batteries** (Makita, DeWalt, Milwaukee): Royal Mail will not carry lithium batteries on their own, so these need a courier. A drill kit with its batteries posts.
- **Paint:** a big share of the category. A 5L tin weighs about 7kg and must be packed leakproof.
- **Bare power tools:** a big brand at a high price. Check the kit against Google's.

## Toys & Games (2 October)

Six exports (October to December 2025, July to September 2026), 43,860 products. 4,950 sit inside the £8 to £60 window after the rules. 1,005 new cards went to her queue, plus 19 eBay cards that gained the Shop label.

**Rules, `rules/categories/toys-games.mjs`:**
- `OWN_TITLE` stops a shop's own range named in the title, even when the Brand column names the maker: Chad Valley (Argos), Early Learning Centre and Happyland.
- `BRANDED` lists real makers (LEGO, Pokemon, Barbie, Jellycat, Bluey and so on). A title naming one passes own label even when Google's Brand column names a shop (Wilko's Pokemon).
- `LINES` maps a maker to its ranges: Epoch to Sylvanian Families, Jazwares to Squishmallows, Zapf to Baby Born, Games Workshop to Warhammer, and about 25 more. Google files toys under the maker, but shops name the range, so store-picks searches under both.
- Own label added: Chad Valley, Addo, Hamleys, The Entertainer, Smyths, ELC, Harrods, Decathlon brands, Ryman, TTS, the museum shops, Mamas & Papas, Sweeek.

**store-picks:** when a brand had no shelf rows, it used to fall back to every row under the brand's first word ("The Witcher" to everything opening "The"). A first-word row now counts only if it names the whole brand, or the shop's brand column is that word. A best seller with no brand is searched under any best-seller brand its title names; everyday words like Wooden or Classic are skipped.

**Big brands:** 89% of toy picks are big brands (LEGO 608, Mattel 261, Jellycat 234). The page check and import hold big brands back by default, which removed the category. Toys run with `--with-big-brands` and `--big-brands`. Cards still carry `big_brand`.

**Shops added:**
- The Entertainer, names from the sitemap (5,021);
- The Kid Collective (2,433) and Wigwam Toys (969), both Shopify;
- Zatu, 96,841 names. board-game.co.uk is now Zatu: filter the sitemap to `^https://zatu\.com/products/` or the five locale copies come in too;
- Element Games, 91,491 names. Use `--maps=products`, or the category pages come in as products.

**Skipped:** Smyths serves Imperva's "Pardon Our Interruption" page even for its sitemaps. Magic Madhouse's products.json returns 404.

**Page reader (`page.mjs`):**
- The Entertainer has no product data: price from `data-pricePDP`, stock from `data-productavailable`.
- Studio: price from the analytics "detail" block, never a related-products list.
- A `<title>` loses its " | Shop name" ending.
- `save-page.mjs` saves a page exactly as the checker reads it. curl gets refused by The Entertainer's Akamai.

**Page check:** 1,099 confirmed (637 by barcode), 713 wrong (668 by barcode). The barcode gate caught loose name matches such as a Jellycat Amuseable pointed at a Bartholomew Bear page.

**Price:** 994 of 1,024 sit above Google's lowest. The cost is a shop's retail price, so post, fees and profit put the floor over Google. Toys is mostly supplier work for her: work it by Google rank and months ranked.

**Watch in the Toys review:**
- LEGO and Jellycat titles match loosely by name: "LEGO Cute Animals" or "Jellycat Heart Dragon" can land on a sister set.
- Bundles: B&M sells LEGO bundles (Rustic Charm, Bohemian) that read as the single set.
- Bulky toys (slides, see saws, garden kitchens, trampolines, ride-ons, hobby horses) are too big for a Royal Mail parcel: courier only.
- Retired LEGO sets: buy only against an order.

## Baby & Toddler (2 October)

Six exports (October to December 2025, July to September 2026), 14,761 products. 1,402 sit inside the £8 to £60 window after the rules. 255 new cards went to her queue.

**Rules, `rules/categories/baby-toddler.mjs`:**
- **Not shelf:**
  - car seats and car boosters;
  - pushchairs, prams, strollers, buggies and carrycots;
  - cots, cot beds, bedside cribs and nursery furniture;
  - cot and crib mattresses.
- **What still passes:**
  - An accessory passes when it is the product itself: named after the big product ("Pushchair Footmuff", "Car Seat Raincover"), just before it ("Hood Trim Pram"), or with "for" ("Cup Holder for Buggy"). "Pushchair with Rain Cover & Cup Holder" is still a pushchair.
  - Toy prams, dining booster seats, travel cots and Moses baskets pass.
- **`sleep_safety`:** baby nests, pods, positioners, wedges, baby pillows, cot bumpers and weighted sleep products (DockATot, Sleepyhead, SleepCarrier, DreamCradle), against Lullaby Trust advice. Anti-roll changing mats pass (an exemption in `restricted.mjs`).
- **`infant_formula_more`:**
  - comfort, hungry, anti-reflux, lactose-free and allergy formulas (Nutramigen, Aptamil Pepti, SMA Althera, Neocate);
  - ready-to-feed infant milk.
  - Toddler and growing-up milks pass.
- **`baby_medicines`:** Infacol, Anbesol, Calgel, Dentinox teething and colic products, Ashton & Parsons, gripe water, teething gels, and Metanium nappy rash ointment.
- **`BRANDED`:** baby makers (Kendamil, Momcozy, Tommee Tippee, MAM, Joie, Hubble, Littlelife and others). Kendamil toddler milk under ASDA's or Boots' name is Kendamil, not own label. Cuggl (Argos), Little Angels (ASDA) and Little Ones (Sainsbury's) still stop.
- **Shared change:** Sudocrem now stops only on the medicine. Care & Protect, My Little Sudocrem and Sudosalve pass. Antiseptic Healing Cream and Skin Care Cream still stop.

**Need words, `needs/baby-toddler.mjs`:**
- safety: gates, locks, guards, bed rails, bath seats;
- monitor: baby monitors, thermometers;
- part: teats, pump parts, nappy bin refills.

**In the window, before and after the rules:** not shelf 45 to 149, sleep safety 0 to 4, formula 24 to 46, own label 160 to 147, passing 1,519 to 1,402. Mamas & Papas stays own label: 196 stopped, 34 in the window.

**Shops:**
- **Natural Baby Shower** (Shopify, 6,760 products, 11,530 variant rows). `shelf-barcodes.mjs` read 4,955 barcodes, and barcode matches went from 2 to 116. Its weights are unreliable on pram accessories: a Bugaboo snack tray at 11.3kg, a bumper bar at 6.4kg.
- **Blocked:** Kiddies Kingdom. Its sitemap answers 202 with an empty page, a bot check. Don't retry.
- **Gaps:** gate specialists. Safetots, Bright Starts, Dreambaby, Babylo and BabyDan are the most-missed brands, and no shop on file stocks them.

**Page check:** 730 picks; 261 confirmed (228 by barcode), 105 wrong (all on a different barcode), 364 unsure. 346 of the unsure were "names too far apart, not read". A sample of 45 was 45 wrong (Crystals baby gate against BWT boiler crystals), so `--read-all` is not worth it here.

**Big brands:** 455 of 1,411 picks. Baby runs with `--with-big-brands` and `--big-brands`, like Toys.

**Price:** 254 of 256 cards sit above Google's lowest. John Lewis and Natural Baby Shower are full retail, so this is supplier work for her.

**Review:** 122 keep, 127 notes, 5 rejects, 1 re-source (MAM Perfect soother, not found).
- **Rejects:** two duplicate pages, a Pampers title with no size, the Babymoov Cosymorpho (a sleep positioner the rule missed), and the Obaby cot bed under-drawer.
- **Judgment call, 22 cards:** Bugaboo, Stokke, UPPAbaby, Nuna, Doona and Joolz (authorised retailers only) went in as notes, not rejects.

**Still to add to the rules:** Cosymorpho and "morpho mattress" in `sleep_safety`.

## Animals & Pet Supplies (3 October)

Six exports (October to December 2025, July to September 2026), 29,122 products. 1,314 picks were seen in a shop; 378 new cards went to her queue.

**Rules, `rules/categories/animals-pet-supplies.mjs`:**
- **Own label:** Wainwright's (Pets at Home), AVA, and the zooplus brands. Own-label stops went from 823 to 1,005.
- **`vet_prescription`** (189 stopped, 37 in the window): POM-V brands and words (Exzolt, Zenrelia, Numelvi, Baytril, Prednicortone, Propalin, Continence, injections, "POM-V", "NFA-VPS"). These need a vet's prescription or an SQP.
- **`vet_counter`** (124 stopped, 33 in the window): horse wormers, Panacur, Drontal, Droncit, Dronspot, Advantage, Advantix, Seresto, Frontline Plus, Combo and Tri-Act, and Zoetis spot-ons. **Judgment call:** several are AVM-GSL and legal for anyone to sell, but the line between GSL and NFA-VPS packs of the same brand is hard to read from a title. Stopped by default; one line to lift if she wants them.
- **`BRANDED`:** pet makers, so a maker's product under a shop's name in the Brand column is not own label.

**Need words, `needs/animals-pet-supplies.mjs`:** pest (flea, tick, worm), care (dental, joint, ear, skin), safety (gates, crates, harnesses, reflective kit), part (filters, refills, litter liners).

**Shared changes:**
- `not-shelf.mjs`: pet sofas and pet mattresses pass; plant-fibre litter passes the plant rule.
- `post.mjs`: the aerosol stop skips spacer chambers; the paint note skips rakes, combs, shampoo, aquariums, cabinets and Fluval.
- `restricted.mjs`: the tobacco exclusion now passes toys, plush, chews and pet products (a "tobacco" coloured toy); the alcohol exclusion passes vinegar; poppers no longer match waistbands and press studs.

**Shops:**
- **Lords & Labradors** (Shopify, 1,072 products, 1,980 barcodes). Its weights are ignored: the median is 7kg on beds and toys. Its own range (the Comfort Cube and others) is own label: 10 cards rejected in review. Add it to `own-label.mjs` before the next pet run.
- **Reptile Centre** (Shopify, 1,805 products, 261 barcodes). The Shopify vendor is the distributor (Peregrine), not the maker, so the brand reads wrong. Fix: read the `Brand:` tag in `shelf-shopify.mjs`.
- **Blocked:** Jollyes (Cloudflare 403). Monster Pet Supplies and Pet Supermarket return 404 on products.json. Don't retry.

**Query keys (`match.mjs`), 3 October:**
- VERSION gained: ageing, active, sensitive, hypoallergenic, urinary, digestive, gastrointestinal, renal, satiety, orthopaedic, broth, topper, multipack, value.
- KINDS gained: wet/dry; jelly, gravy, broth, loaf, mousse and pâté; puppy, kitten, adult and senior; and the protein pairs (chicken, beef, lamb, salmon, turkey, duck, tuna, rabbit, venison, pork, trout, herring).
- Kept out of VERSION on purpose: calming, working, puppy, kitten, senior (they flipped right matches to unsure).
- `check-picks --recheck` defaults to `--top=100`. Use `--recheck --top=all`.

**Page check:** confirmed 483 before the match fix, 423 after (unsure 674, wrong 213, page gone 4). The 60 lost were real wrong matches, mostly Royal Canin breed and diet pages.

**Import:** 378 kept; 213 wrong, 669 unsure, 18 bigger pack, 1 over 20kg. 345 of 378 sit above Google's lowest.

**Review:** 193 keep, 132 notes, 29 re-source, 27 rejects (17 other, 10 not sourceable).
- **Rejects:** the 10 Lords & Labradors own-range cards; shared-page duplicates; Indorex flea spray (two cards) and Pet Corrector, both compressed gas; Royal Canin Glycobalance (vet diet); generic "Royal Canin Cat Food" and "Feliway Diffuser".
- **Re-source:** 26 leads found by name, 12 right. The 14 wrong ones were turned to "not found" before `--apply` (`resource-animals-and-pet-supplies-2026-10-03-checked.csv`): 17 noted not found, 12 left to check.

**Fixed in `match.mjs` the same day (`ck-pet-match2-2026-10-03`):** breeds (two different breeds are wrong), dog sizes and life stages on food titles, fish and mixed in the recipe pairs, tins against pouches, and supplement types. Before the fix, "Royal Canin Adult Dry Dog Food" overlaps enough words with any breed or size page to confirm. The re-source search sent Medium, Giant, Maxi, Bulldog and Dachshund all to the Boxer page. On re-test all 12 right leads still confirmed and none of the 14 wrong ones did.

## Sporting Goods (4 to 5 October)

Six exports (October to December 2025, July to September 2026), 33,731 products. 3,386 considered in the £8 to £60 window after the rules; 2,254 seen in a shop; 609 new cards went to her queue.

**Decided 3 to 4 October:**
- Sized clothing and footwear stop (wetsuits, rash vests, swimwear, riding tights and breeches, waders, surf and sailing boots, skates). Gloves, socks, caps, helmets, life jackets and swim vests pass, and so do adjustable skates.
- Fixed-blade, hunting, bushcraft, survival and tactical knives stop (`knives_fixed`). Pocket knives and multi-tools pass with the age-check postage note.
- Fishing tackle is hers. Only what can't go by parcel stops: rods, poles, whips and combos (1.8m or more), holdalls, bivvies, brollies, shelters, bedchairs, seat boxes and barrows, and frozen or live bait. Telescopic and travel rods, quiver tips, elastic kits, rigs and shelf-life bait pass. The rod rule fires only on a fishing title, so a riding whip or a trekking pole passes.
- Equestrian is left alone: feed in 15 to 20kg sacks needs feed registration, rugs are bulky, riding wear is sized.

**Rules, `rules/categories/sporting-goods.mjs`:**
- **Not shelf:** complete pedal bikes and e-bikes (balance bikes, trikes and 2 in 1 training bikes pass); gym machines and benches; trampolines (not trampoline scooters); pool, snooker, football and air hockey tables (table-top versions pass); roof tents; paddleboards, kayaks and canoes; the sized kit and the fishing items above.
- **Own label:** Decathlon's ranges (Quechua, Forclaz, Kalenji, Nabaiji, Kuikma, Canaveral, Rockrider, Triban, Van Rysel, Oxelo, Caperlan and the rest), Argos's Zinc, Hy-Pro, Pro Fitness and Opti, Myprotein's MP, Mountain Warehouse, Angling Direct's Advanta, and Go Outdoors' Eurohike, OEX and Hi Gear. `OWN_TITLE` catches the same names in the title.
- **`BRANDED`:** real makers sold through B&Q's marketplace or listed under Argos (Gym Sets, RDX, Winmau, Target and Unicorn darts, and others), so they pass own label.
- **Need words, `needs/sporting-goods.mjs`:** safety (helmets, life jackets, lights, locks, mouthguards), care (supports, foam rollers, resistance bands), part (tyres, tubes, chains, lines, hooks, spools), pest (midge and insect repellent).

**Shared changes:** camping air beds and self-inflating mats pass the mattress rule; dumbbell trees pass the plant rule; fly-strip door curtains pass the blinds rule; air rifle targets and pumps pass the weapons rule; CO2 cartridge holders and Zippo hand warmers pass the gas rule; fishing, bubble and fidget poppers pass; "Gloss" in bike colours no longer adds the paint note; Condor "Axe" dart flights and herb "Cleavers" no longer add the knife note. None changed a Baby or Pet result.

**`shelf-shopify.mjs` (4 October, `ck-shopify-brand-gbp`):**
- Asks the shop for its UK market in pounds and reads `cart.js` before keeping anything. A shop that still answers in another currency stops (Yogamatters served naira to a request from Nigeria: a bra at 89,000.00). `--any-currency` skips the check.
- Brand: `--brand=` for a single-brand shop; a "Brand:" or "Manufacturer:" tag when present; otherwise the vendor without a shop trailer ("RDX Sports | UK") or a stock-code number ("VARLEY01").

**Shops:**
- **Shopify, with barcodes:** Darts Corner (6,214 products, 5,426 barcodes), Red Dragon Darts (992, 1,310), Peaty's (104, 614), Core Balance (49, 229, `--brand="Core Balance"`), RDX Sports (1,027, 5,380), Yogamatters (1,570, 866).
- **Angling Direct, names from the sitemap:** 41,547 products. Products are one level deep; category pages are nested. Filter: `--match="^https://www\.anglingdirect\.co\.uk/(?![a-z-]*fishing-tackle(?:-brands)?$)[^/?#]+$"`. No barcodes or weights; the page check reads the price.
- **Blocked or not Shopify, don't retry:** Mirafit (Cloudflare 403), Burgtec (404), Fishing Tackle and Bait (403), Tacklebox (no products.json, sitemap is a web page), Matchman Supplies (fetch failed).

**Picks:** barcode matches went from 5 to 127 and not-seen from 1,646 to 1,107 as the shops came in. The gap left is mostly equestrian, golf (Titleist, TaylorMade), Mirafit and Specialized.

**Page check:** 657 confirmed (265 barcode, 382 name, 10 model), 297 wrong (289 by barcode, mostly Studio and Halfords), 1,288 unsure (1,188 "names too far apart, not read": genuine misses on a sample). Angling Direct gave 232 confirmed, a price read on 229.

**Import:** 609 kept; 12 bigger pack, 4 no price, 2 over 20kg. 495 had no weight and were costed as a small parcel (mostly Angling Direct). 580 of 609 sit above Google's lowest.

**Review:** 395 keep, 137 notes, 37 re-source, 40 rejects (26 not sourceable, 14 other).
- **Rejects:** 22 Frasers Group own brands sold at Studio (Slazenger, Everlast, Gelert, Pinnacle, Karrimor, Donnay; judgment call), 4 Yogamatters own range, 4 generic titles, 5 shared-page duplicates, 2 freezer boilies, a fishing umbrella and a game rod (can't post), and a Nash work box on two pages.
- **Re-source:** 29 leads, 15 right (1 by barcode, repointed: the Kickmaster 6ft goal). The 14 wrong ones were spare spools, bar tape plugs, brake pads and sister models; turned to "not found" before `--apply`: 1 repointed, 14 left to check, 22 noted not found.

**Fixed 5 October (`ck-sport-fixes-2026-10-05`):**
- **Own label, shared:** Slazenger, Karrimor, Everlast, Donnay, Lonsdale, Muddyfox, Pinnacle, Sports Direct, Yogamatters. Everlast, Slazenger and Eurohike came out of Sporting's `BRANDED`, which would have let them back through.
- **Own label, Sporting only:** Gelert. Gelert pet food is another company, and the shared list stopped 4 of its pet titles.
- **Freezer and frozen bait:** its own entry, so "boilies" or "pop ups" in the title no longer exempts it. Only cool bags, bait bags, freezer bags and imitation bait pass. Shelf-life boilies and pop-ups still pass.
- **Rod rule:** "light" lets a rod through only when it isn't "Ultra Light" and isn't followed by game, lure, spin or rod. The Savage Gear Ultra Light Game Rod stops; a bite alarm rod light passes.
- **store-picks:** a brand of two or more words is also searched written as one ("Ridge Monkey" and "RidgeMonkey"). Google files the brand spaced while shops and 35 of 37 titles write it joined, so the shop rows were dropped before matching. The name check already tolerated the spelling.

**Tested on the Sporting exports:** new own-label stops Slazenger 68 (17 in the window), Everlast 60 (10), Yogamatters 44 (7), Pinnacle 16 (5), Gelert 12 (4), Karrimor 8 (2), Donnay 7 (1), Lonsdale 5, Muddyfox 1; 6 rods; 1 freezer boilie. Nothing freed. Baby and Pet: 0 changes.

**Not covered:** the reverse case, Google writing a brand joined while a shop spaces it. None seen yet.
