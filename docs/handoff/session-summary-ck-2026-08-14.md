# Session Summary, Cart & Keep

**14 August 2026, WAT.** Continues 13 August.

Started: 178 mobility candidates on screen, a supplier route identified and
nobody contacted, and a research pipeline in one 916 line file.

Ended: two categories live in the portal on their own batches, 91 products,
postage honest for the first time, product identity that groups duplicates, a
test suite that caught six faults on its first run, and the supply question
answered for bedding with numbers rather than hope.

---

## The engineering, in the order it happened

### The script became a package

`scripts/analyse-terapeak.py` went from 916 lines to 18, with the work in
`scripts/terapeak/`: `console`, `parse`, `screens`, `costs`, `rules`,
`analyse`, `report`, `shortlist`, `run`. The entry point stayed where it was so
no written down command changed.

Six `chr()` expressions spelling out `price`, `headroom`, `recent`, `total`,
`hold` and `screens` one character at a time were removed. They made the file
unsearchable and one of them had hidden a null defaulting to zero.

### The electrical screen was wrong and he called it

`category-research.md` excluded powered goods because "electrical compliance
sits with the importer". That reason is a release condition: it binds whoever
imports, not whoever sells. Bought from a UK trade supplier she is a
distributor, and a distributor checks the marking is present and keeps the
paperwork. Shipped direct from China she is the importer and the UK responsible
person, holding a declaration of conformity for ten years.

So powered is a route constraint, not a rejection. Twelve rows carry a `uk`
flag now. Medical devices took the exclusion's place, on the UK MDR rather than
the electrical regime.

### Postage stopped being a flat rate

`postage_band()` reads the band off the title. King, super king, tog, filled
duvets, pillows, toppers, hoists and everything the bulky list already caught
go to medium parcel at £5.55. Everything else stays small at £3.65.

That closed the 118 row defect from 13 August and it cost real candidates. The
half steps went from £5.11 and £5.73 to £3.21 and £3.83 and dropped out of the
batch. Elderly's evergreen set went from 4 of 5 clearing the gate to 2 of 5.

Admission allows exactly one band of optimism against what the title implies,
rather than testing everything against large letter. A duvet set is not a 25mm
letter.

### Product identity, three attempts

The old fingerprint took the alphabetically first eight tokens of words longer
than three characters. So `lid` was invisible, and which eight survived
depended on incidental words.

Attempt one, union find over token overlap: chained 206 bedding listings into
one product. Attempt two, leader clustering: fused 47 reversible duvet designs,
because seven boilerplate words agreed before either title said anything.
Attempt three, leader clustering with rarity weighting: worked, then needed
audience words treating as noise because `elderly`, `disabled`, `mobility` and
`adult` were separating five listings of one toilet seat.

Threshold set at 0.62 by sweeping 0.55 to 0.70 across both real shortlists.
Result: elderly 202 listings to 135 products, bedding 488 to 326.

`product_key` is written to `shortlist.csv` so the importer groups on the
analysis rather than reimplementing it.

### The test suite

`scripts/run-tests.py`, 33 tests, stdlib unittest, runs on 3.10. A labelled
corpus of 62 real titles in CSV so adding a case is one line.

It found six faults on its first run. `SOFT_PRODUCT` had no bedding vocabulary
at all, so most bedding rows only read soft if they happened to contain the
word cover. `RIGID` knew no beauty tools. `MEDIUM_BAND` had no hoist or patient
lift. The identity threshold was tuned against unweighted overlap and never
re-tuned. Audience words were being treated as identity. And the tool exemption
was letting impregnated cosmetics through: `Rinse Free Bath Wipes| No Water
Body Wash Sponge` was screening as cosmetic and then being released because
sponge is a tool noun. Four cosmetics were live in the mobility batch.

Two properties are recorded rather than fixed: grouping depends on the
population, because rarity is measured across the run, and `riser` against
`elevated` is a synonym the matcher cannot see.

### The portal

`batches` gained `category_label` and `term`. Candidates gained a batch
switcher. Overview aggregates across every live batch, and its headroom figure
became units times headroom rather than a sum of per unit ceilings that nobody
can earn. One scatter per category, because a £134 patient lift plotted against
£5 duvet covers sets the scale on the outlier.

The importer gained `--term`, `--label`, `--min-units` and a collapse to one
row per product. Tier is taken across the group, since a stock verdict belongs
to the product rather than to the listing that represents it.

---

## The research

### Bedding, found and worked through

`beauty` as a broad term turned out to be a piercing jewellery market with
cosmetics underneath: 11,866 units on `piercing`, gate zero. Bedding surfaced
inside it as a clean, gate clearing, correctly shaped cluster nobody proposed.

Seven windows on `Bedding Sets & Duvet Covers`:

```
window    avg      sell-through   sellers
2025-07  £16.24        81.96%      1,072   distrust
2025-08  £16.86        43.66%      1,189
2025-09  £17.26        38.11%      1,217
2025-10  £17.14        50.35%      1,296
2026-01  £17.06        40.51%      1,209
2026-05  £17.12        35.41%      1,107
2026-06  £16.82        45.63%      1,077
2026-07  £16.56        47.11%      1,082
```

**July 2025 is an eBay artefact and it is now proven twice.** Elderly read
66.70% that month and 7.16% the next. Bedding read 81.96% and 43.66%. Two
unrelated categories, same month, same implausible spike, stable prices and
seller counts either side. Distrust any July 2025 window on any term.

**Not seasonal.** January came back at 40.51%, below October and below July.
Duvet covers are replaced year round.

**Units are down about 30% year on year at equal scrape depth.** Tails read 4,
4, 4, 5, 5, 4, 4 across all seven windows, so it is not a depth artefact. Price
moved £1.02 across thirteen months and seller count is flat, so the same
sellers are splitting less demand.

`disability aids` and `orthopaedic support` were both swept and both closed
inside one page load each. The first returned the elderly batch under a
different name. The second averaged £40.46 only because mattresses were in it;
the pillow leaf alone is £12.30 with 22% sell-through.

`wedge pillow` returned 16.08% sell-through, the lowest measured, with £6.36 of
average charged postage, which is the sellers saying it is bulky.

---

## The supply answer for bedding, which is the session's real output

The six piece satin set selling on eBay at £22 to £24 was traced to its
factory. Four routes were tested and priced:

```
route                    goods    landed    net    verdict
Homefords, open trade    £5.05    £6.06    -£0.60  no account needed, entry tier
Temu, UK warehouse      £15.79   £15.79    -£3.91  retail with a UK warehouse
AliExpress                £2.15       ?        ?   1 to 3 week transit
Alibaba, 10 to 999      £12.73   £20.41    -£5.28  duty, freight, import VAT
Alibaba, 1,000+          £7.12   £11.01    +£2.62  the tier HADI are on
Alibaba, 20 set MOQ      £6.18       ?        ?    freight must beat £4.44
```

**The margin in bedding belongs to whoever imports.** Every route that avoids
the container has been tested and closed. HADI LONDON UK sell it at £19.99 and
drop to £17.99 on four, which puts them at or below the £7.12 tier.

**Not being VAT registered costs 20% of landed value, unrecoverable.** On the
1,000 tier that is £1.84 a set, 41% of the margin. She is not registered. The
threshold is £90,000 of turnover, which one product in the batch would reach on
its own at 310 sales a month.

**The same test on mobility gave the opposite answer.** A raised toilet seat at
£5.62 from Zhengzhou costs £3.88 a unit to ship, which is 69% of the goods
price, because a moulded seat is mostly air. Landed £11.83 against £9.01 of
headroom. That is the third confirmation of the shape rule, and it is the whole
argument for Aidapt: UK supply removes freight, duty and import VAT in one go.

---

## Her own listings

67 live, exported and analysed.

```
Home and hardware        14   £5.50 to £128.46
Beauty tools              9   £5.45 to £38.70
Kids clothing             9   £6.02 to £23.58
Mobility and daily living 9   £12.78 to £28.58
Pamper and gift sets      7   £7.05 to £42.29
Pet                       3   £43.26 to £54.23
Unclustered              13
```

**She is already selling mobility.** Bed rails, half door step, gait belt, grab
rail, scoop plate, incontinence pads, rinse free wipes. Several are the same
products in our shortlist. The mobility batch is not a new direction for her.

**The £20 headroom he asked for twice is already in her shop.** The birthday
pamper hamper at £42.29 carries £29.99, and the raised cooling dog bed at
£43.26 carries £30.77. Gift sets are assembled rather than sourced, so the
margin is constructed rather than negotiated.

**Six sales from 67 listings.** He could not get the sold report, so this is
unexplained and it is the largest open question in the project. Adding fifty
products to a shop converting at that rate does not fix it.

**Two flags on live listings.** A Disney Monsters Inc pyjama set, which is the
licensed exposure our screen exists for. And five cosmetics by our own
boundary: two rinse free bathing packs, a hair washing basin, a makeup box and
a hair serum.

---

## Schema added this session

```
0032  batches.category_label, batches.term
```

`shortlist.csv` gained `product_key`, `powered` and `shape`, and
`postage_band` now varies per row.

---

## Where the batches stand

```
2026-08-17   Mobility and daily living aids   50 products    1 stock
2026-08-18   Bedding and duvet covers         41 products   11 stock
```

Nothing decided on either.

---

## Rotting

- Aidapt emailed on 14 August, no reply. Tenura unsent.
- CJ account needed a transaction by roughly 24 August
- 16 CJ sourcing requests still to send
- `run.js` still deletes then inserts
- The decision trigger writes a null actor on delete
- `monthly_headroom` exists in the database and in no migration
- The raised toilet seat still costed at small parcel, needs a carton spec
- Six of the nine dead terms recorded as `killed_at_strip` when they were scraped
- VAT relief on disability aids is not modelled
- `candidate_sources.landed_unit_cost` has no import VAT line
- No VAT registration switch anywhere in the model
- `BatchScatter` prints the `£4 floor` label over the two highest volume dots
- `useLatestBatch` is now dead code
- Duty rates asserted at 12% and 6.5% from memory, never read off the tariff
