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
