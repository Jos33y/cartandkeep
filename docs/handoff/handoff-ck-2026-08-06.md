# Handoff, Cart & Keep

**Session close:** 6 August 2026, WAT. Continues 3 August.
**Load with:** this file, `feedback-ck-2026-08-06.md`, plus
`docs/design-system.md`, `docs/supplier-apis.md`, `docs/research-methodology.md`,
`docs/category-research.md`.

---

## Opening message for the new chat

> Continuing Cart & Keep. The research now reaches the portal end to end. The
> 10 August batch holds 25 candidates in two tiers, 16 stock and 9 slipping, with
> images, eBay categories, cost breakdowns and a supplier form she fills in
> herself. Everything is deployed. She has not seen any of it yet, and the batch
> still needs the metrics note and the category conversation before it is sent.
> Next research is a new category direction, her words: older people, leg pain,
> massage guns, baby bassinets, leg rests, aids for people standing all day.
> Read the feedback file first.

---

## What this session did

Portal work, then two days on supplier sourcing that produced one usable number
and a clear negative. Both are covered below because the negative is worth as
much as the positive and cost more to learn.

**The research is on screen.** 25 candidates, grouped by eBay category, ranked
within a group, with product images and a lightbox, the eBay category path she
has to pick when listing, the cost lines itemised, a units-per-window chart, and
a supplier section she can add to.

**Everything is deployed** and the status page is current to 5 August.

---

## Where the work stands

### Live and working

| | |
|---|---|
| Candidates | 25 in the 10 August batch, grouped by category, two tiers |
| Approved | listing packs with supplier records and net once priced |
| Coverage | seven keywords swept, what each found, and what it did not |
| Metrics | every figure explained, dated, new terms marked for 14 days |
| Activity | decision audit log from a database trigger |
| Overview | headroom against units scatter, decision split, source status |
| Status | public, current, 15 of 21 milestones |

### Not built and not needed yet

Listings, Finance and Orders are still empty states. They fill when she lists.

---

## The findings, in order of how much they change

**Dog bed is growing and compressing at the same time.** Units went from 6,452 in
August 2025 to 13,591 in July 2026 while the average price fell from £17.98 to
£12.56 and sellers went from 962 to 1,318. Headroom at the category average
dropped 35% in twelve months. It is still the best category measured, clearing
65% of units against the gate with the strongest sold rate we have seen, but the
direction of travel on margin is real and she should be told rather than shown a
static picture.

**Nine proven sellers are in decline.** Present in every window, still selling,
running below 60% of their own average. They include the two highest headroom
products in the set, the green back vet bedding at £21.79 and the grey vet bed
roll at £21.01, both at about 45%. Those are the ones that look most attractive
for a stock buy and are the most dangerous to buy. They are in the batch as a
second tier, marked, ordered below the holding ones.

**CJ landed cost is roughly double the goods price.** A £6.85 bed quotes £5.72
freight to the UK. Every CJ margin computed before that was wrong by about half.
That, not catalogue size, is why dropshipping does not reach beds and bedding.

**Catalogue matching does not work for this category.** Keyword matching
25 candidates against CJ produced 38 rows and 5 distinct products, with one
generic Oxford cloth bed returned as the best match for fifteen different
products including four vet bedding rolls and a plastic basket. One row was
arguably real and turned out not to be on inspection. Nothing was confirmed, so
nothing reached a decision, which is the unconfirmed default working.

**The products with headroom are the ones nobody can source easily.** Vet
bedding is a UK textile roll, the shredded paper is a UK mill product. That is
why they still carry £10 to £21 of headroom, and it is the argument for buying
stock rather than dropshipping in this category.

**Real UK suppliers exist and are named.** Crow Recycling bale shredded paper at
£9.60 per 30kg including delivery in their area, against a product selling a
10kg bale at £19.93 doing 101 units a month. Vetfleece manufacture in a Yorkshire
mill and sell direct to trade. All eight are seeded into the `suppliers` table so
they survive this chat.

**The honest arithmetic on that paper bale.** Sale £19.93, fees £2.85, ads £1.20,
packaging £0.40, goods about £3.20, and postage on a 10kg parcel is realistically
£8 to £9 rather than the £3.65 assumed. Net lands near £4 a unit, so about £400 a
month from one listing. Real, and a quarter of what the headroom figure suggests.

---

## What is still assumed

**Postage.** Every headroom figure costs a small parcel at £3.65. Eight of the
25 are flagged bulky and the flag carries no magnitude. Real dimensions come from
a supplier, and CJ's product detail endpoint returns weight and per variant
dimensions for anything sourced there.

**Returns.** Not modelled at all. Tolerable for bedding, not for categories with
higher return rates, and the new direction includes some.

**VAT.** Not modelled. Only bites above the £90,000 threshold, so it is a flag
for when she approaches it rather than a line to add now.

**Ads at 6%.** A constant, never measured against what she actually spends.

---

## Defects found and fixed this session

Three faults of the same shape, worth remembering as one lesson rather than
three items.

**A writer overwrote fields it did not own, twice.** The importer deleted and
reinserted candidates, which cascaded her decisions away. Fixed with an upsert,
which then wrote null over `image_url` because the payload named a column
enrichment owns, and left `enriched_at` set so nothing could recover. Both fixed.
`run.js` has the same shape and will do the same thing when the pipeline route
comes back into use.

**A to-one embed read as an array, in three hooks.** `decisions.candidate_id` is
unique, so PostgREST returns an object and `decisions?.[0]` is undefined. Every
decision was invisible in `useCandidates`, `useApproved` and `useOverview`, and
none of them threw.

**A null cost coalesced to zero.** A CJ sourcing request with no answer rendered
as a free product with the best margin on the page. `landed_unit_cost` now
returns null when nothing has been quoted.

---

## Schema added this session

`0020` candidate tier, stock or slipping.
`0021` candidate_sources, many suppliers per candidate, nothing trusted until
confirmed.
`0022` supplier_categories, mapping an eBay leaf to CJ category ids.
`0023` fulfilment route, minimum order, freight, duty, origin, transit,
dimensions, and `landed_unit_cost` as a generated column.
`0024` candidate_notes, notes on any product rather than only rejections.
`0025` source status, requested against quoted.
`0026` suppliers table seeded with the eight found today, and the landed cost
null guard.
`0027` marketplace suppliers, with `kind` recording wholesale against retailer,
because eBay permits fulfilling from one and not the other.

---

## Scripts

New this session:

`enrich-candidates.js` images and eBay categories by Browse lookup, self healing
where an image is missing.
`import-coverage.js` records every term swept and its outcome.
`source-cj.js` per product CJ lookup with real freight.
`explore-cj.js` the reverse, what CJ stocks and what it would need to sell for.
`request-cj-sourcing.js` bulk sourcing requests, five a day on the free plan.
`add-source.js` records a quote against a candidate from the command line.
`cj-categories.js`, `cj-freight-test.js`, `cj-sourcing-test.js` diagnostics.

`analyse-terapeak.py` changed twice: hold is now written whether it passes or
fails so an exclusion leaves evidence, and the cost lines are written
individually so the row breakdown sums to the headroom.

---

## CJ, what is settled

Freight is `POST /logistic/freightCalculate` with `startCountryCode`,
`endCountryCode` and a `products` array keyed on `vid`. The vid is a variant id
from `/product/query`, not the SKU string.

Sourcing is `POST /product/sourcing/create` with `productName`, `productImage`,
`productUrl`, `expectPrice`, `remark`. Five a day on the free plan. Four were
sent, twenty-one carry over, and the script now stops at the cap.

`countryCode` on search restricts to that warehouse's stock, which is a small
fraction of the catalogue. `keyWord` is a best match search across the whole
catalogue, so a category id is required or a dog bed search returns human
furniture.

No image search in the API. It is a website feature only.

---

## Client state

**She has not seen any of this.** The batch, the metrics note and the category
conversation are all outstanding, and they should go together.

**Three things in the batch contradict the signed scope**, and all three are hers
to rule on:

The £14 price floor is gone, replaced by computed headroom.

Beds and bedding is the working category, which is neither of the two originally
agreed, and three of the 25 are feeders rather than beds.

The compliance exclusions are cutting the top item from several terms. Cat bowl's
screened-out list is almost entirely electrical, including the highest volume
product in the term.

**Her question from this session**, which set the standard for what a product
sheet has to answer: sales and whether they fluctuate, the source and where it
is, and margin over the last fourteen days. Sales and source are answered. The
fourteen day window is a per product vetting step for the shortlist, not a sweep
step, and margin needs a supplier.

**Her price preference.** She is comfortable at £60, £80 and £200 goods because
fixed costs do not scale with price and those absorb a postage error that would
wipe out a £12 product. Two things in the pipeline work against that: the ten
unit volume gate excluded two evergreen products at £48 and £50 headroom for
selling under ten a month, and the headroom component in `rank.js` tops out at
£15 so everything above scores the same. Both need changing and both change what
reaches her, so they need confirming first.

**Her sourcing position.** She vets with Hustle Got Real and handles suppliers
herself. Our side records what she finds and computes the margin. CJ stays
because it is wired and free. No further supplier API work without her asking.

---

## Next research, her words

> old people, leg pain, massage gun, baby bassinets, leg rests, aid people
> working for long

Soft before hard, her instruction.

**What is clean.** Leg rests, footstools, wedge and bolster pillows, bed raisers,
over bed tables, anti fatigue mats, kneeling stools. Homeware, no electricals, no
therapeutic claims, and they sit at the price point she wants.

**What needs care.** Massage guns are electrical and the screen removes them.
Anything framed as pain relief risks being a medical device under UK rules the
moment it carries a therapeutic claim, and eBay restricts that category
separately. There is no medical screen in the pipeline at all. Baby bassinets
carry safety standards and are bulky.

**Terms to sweep first, strips before rows:** `leg rest`, `footstool`,
`wedge pillow`, `bed raisers`, `over bed table`, `anti fatigue mat`.

**One thing to settle with her.** Whether she wants products for older people,
which is homeware, or products for pain, which is regulated. Her note points at
both and they are different businesses.

**Before any of it,** add a medical and therapeutic claims screen, and add
`supplier_categories` rows for the new eBay leaves or the sourcing step searches
the wrong corner.

---

## Rotting

- CJ account needs a transaction by roughly 24 August
- `run.js` still deletes then inserts, and still names columns enrichment owns
- 21 CJ sourcing requests still to send, five a day
- No query endpoint found for reading CJ sourcing answers back, so checking them
  is manual in their app
- `missing_adapter` is still silently non-fatal
- `Number(ts.weight)` is still unguarded against NaN
- The brand list is a word list and will keep missing things
- Terapeak sell-through and the pipeline `str_min` gate share a name and are
  different measures. Still true, still a trap
