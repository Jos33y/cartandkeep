# Session Summary, Cart & Keep

**12 to 13 August 2026, WAT.** Continues 6 August.

Started: a portal with 25 pet products she could not source, a dead category,
and two weeks of client frustration.

Ended: 178 mobility candidates on screen in seven clusters, seven months of
sales history behind them, a live competition read on every row, the supply
route identified and named, and a pipeline that refuses to print a verdict it
cannot support.

---

## The research, in the order it happened

### Eight terms died before one worked

The direction was hers: older people, leg pain, massage guns, baby bassinets,
leg rests, aids for people standing all day.

Eight single-product terms were swept and eight failed.

```
term              units/mo  sell-through  avg price  volume clearing £4
pill organiser       3,892        41.00%      £4.32          0%
insoles              6,580        46.36%      £5.66          2%
reacher grabber      1,846        19.94%      £7.41         11%
sock aid               715        16.36%      £6.75         13%
bed raisers            218        12.85%      £8.77          8%
massager               thin           n/a        n/a   contaminated term
blanket lifter         thin        18.75%     £25.64    7 sellers only
over bed table         thin         8.38%     £19.42   fails the sold rate floor
```

Five were properly sourced from eBay leaf names, Amazon UK bestsellers, a
council guidance page and a UK trade catalogue. Two were my own picks off the
tail of other terms. All eight were the wrong instrument.

`massager` is worth remembering as a trap: the top rows are adult products and
Sex Toys is a named leaf in the dropdown. The term measures a market she cannot
list in.

### One broad term answered it

`elderly`, one page load, all categories.

38% of its volume cleared the £4 gate at medium parcel, against 0 to 13% for
every narrow term. It surfaced four clusters nobody had proposed: raised toilet
seats, half steps, shower and bath seating, bed rails.

**This is the correction that matters most from this session.** A narrow term
tests one guess. A broad term asks the category what it sells.

### The deep scrape

398 rows on one window, then seven windows total.

```
window    listings   units   avg price   sell-through   sellers
2025-07        202   2,898      £16.49         66.70%     1,354   outlier, distrust
2025-08        173   2,845      £15.40          7.16%     1,396
2025-09        302   3,309      £17.91          8.96%     1,328
2025-10        250   3,719      £14.72         10.37%     1,361
2026-05        420   4,891      £12.18         22.47%     1,538
2026-06        477   4,883      £13.16         20.25%     1,443
2026-07        439   3,697      £12.28         20.32%     1,063
```

**The category is widening.** 202 distinct products sold in July 2025 down to a
4-unit tail. 439 did in July 2026 at the same depth. Sell-through roughly
doubled year on year while seller count fell. Entering a widening category is
easier than a consolidating one.

**July 2025 sell-through of 66.70% is not believable** and should not be quoted.
It sits against 7.16% the following month on the same sellers at the same price.
`terapeak.md` already records that series as untrusted and this is the proof.

### Two hypotheses tested and both wrong

Worth recording because both were plausible and both cost time.

**Relisting inflating the churn.** 794 of 1,196 products marked `new`. Tested
with `check-identity.py`, which groups by normalised title and looks for several
item ids that never overlap in a window. Result: 7%, and only two products
recover a full history. The eBay item ID holds as an identity.

**Unequal scrape depth.** The 2026 windows have twice the listings of August
2025. Tested by reading the minimum units per window: 2 to 4 across all seven.
Depth was equal. He confirmed he stopped at 3 to 4 sales in every window.

So the churn is real, and it is the category growing rather than an artefact.

---

## What is now on screen

**178 candidates in the 17 August batch**, grouped by cluster:

```
54  Handles & Rails          22  Toilet Seats
22  Steps & Stairs           21  Shower & Bath Seats
14  Walkers & Canes          10  Incontinence Aids
 9  Other Mobility Equipment  5  Toilet Frames & Commodes
```

Ordered by monthly worth, so the £1,287 raised toilet seat leads and the
three-unit rows sit at the bottom of their cluster.

**Every row carries** image, eBay category path, cluster, itemised cost lines,
headroom, units sold per window across seven months, a live competition read,
and a supplier form she fills in herself.

**Two stock candidates out of 1,196 products.** That is the hold test doing its
job across seven windows, and it is the thing one window could not tell us.

---

## Her seven variables, answered

She asked directly: competitors, profits, sold out, evergreen, suppliers, free
delivery, postage.

```
sold out        yes    sell-through per window, seven of them
evergreen       yes    real now, seven windows behind it
postage         yes    band per product, though see the postage problem below
free delivery   yes    93 to 95% across the series
competitors     yes    live listing depth, price spread, seller concentration
profits         no     needs a supplier price
suppliers       no     needs a trade account, and that account is hers
```

---

## The supply answer, which is the biggest finding of the session

She checked the products and could not find them on Amazon or AliExpress. She
was right, and the reason is the finding.

**The products with margin are UK manufacturer goods sold through trade
accounts.** Aidapt, Croydex, Drive DeVilbiss, Helping Hand, Homecraft. A product
selling 118 a month with four sellers on it is the signature of that. A product
anyone can buy has thirty sellers and no margin, which is exactly what the half
step looks like at 31 sellers and £5.11.

**Named and traced:**

The raised toilet seat with lid selling 118 a month at £18.80 is the Aidapt or
Senator 4 inch seat. Aidapt manufacture it in St Helens, trade sales on
**01744 745020**, trade site is login only with no self-serve signup.
Mobility2You carry the same seat as `M2YRT-TS-4`, wholesale at
`mobility2you.trade` on **020 8807 0702**, and their retail site prices it at
£22.95. Amazon carries it at £24.95 sold by a reseller, not by Aidapt.

**Other UK routes found, not yet contacted:**

```
Wholesale Mobility   01752 345678   proforma per order, £6.75 ex VAT dropship fee
Tenura                              free trade account, dropship, free samples
Putnams                             British made, dropship, no minimum order
```

Mobility2You is owned by Millbrook Healthcare, an NHS contractor, and their
trade form is a credit application asking for a VAT number and two trade
references. Aidapt direct is the easier call.

**AliExpress and CJ, what the numbers say:**

```
product              goods    inbound   landed   she sells   verdict
swivel cushion       £5.34    £5.57     £10.91     £10.36    loses money
raised toilet seat  £10.69   £28.50     £39.19     £18.80    loses money
bed assist bar      £24.19   £40.72     £64.91     £12.68    loses money
adult bib qty 1      £3.00    £2.33      £5.33      £4.30    loses money
adult bib qty 20     £2.51    £2.05      £4.56      £4.30    loses money
padded seat cushion £12.39    £0.80     £13.19     £16.56    under the gate
```

**Freight is per listing, not per country.** One seller quotes £28.50 on a
toilet seat, another quotes 80p on a cushion. It tracks whether the product
compresses: soft goods go as a packet on subsidised postal rates, rigid moulded
goods go as a parcel.

**AliExpress freight is per unit.** Twenty bibs cost twenty times the freight,
£41.01. Buying deeper does not fix it. Only sea freight by the pallet does, and
that is Alibaba and a container.

**Five CJ sourcing requests were sent** on 13 August against generic products
only. Source numbers CJSPU958406723, 725, 726, 727, 728. Answers arrive in their
app in about 48 hours and there is no query endpoint, so checking is manual.

---

## The postage problem, still open and now the largest unknown

**118 of 178 rows carry the bulky flag and the flag has no magnitude.** Every
headroom figure charges £3.65 for a small parcel. The real band is £5.55 medium
or £8 to £9 courier on most of them.

Amazon publishes the Aidapt seat at 40 x 35.5cm, which sorts to 400 x 355mm and
is over small parcel on both length and width. That one product has been costed
£1.90 too cheap all session, which is £224 a month of headroom that does not
exist.

`enrich-candidates.js` now reads `packageWeightAndSize` off the same Browse call
it already makes, normalises to millimetres and grams, and writes a `dimensions`
column. Sellers only populate it on calculated postage, so expect nulls. **The
run has not happened yet and its output is the next real number needed.**

Her courier rate is the other half and only she has it.

---

## Defects found and fixed

**Three verdicts printed that the data could not support.** The stock block
computed `hold 1.0` on a single window where every product passes by
construction. The importer tiered all 178 rows as stock because `tierOf`
defaulted to it. The row rendered `SCORE 0` where the score was null. All three
now refuse rather than assert.

**A null rendered as a real figure, twice more.** `sell_through` defaulted to
the string zero inside a `chr()` expression no grep would find. `SCORE 0` on 178
rows. Fourth and fifth appearance of this shape in the project.

**A wrong drop reason.** Six screened pagers recorded as `headroom below gate`
when their headroom was fine. The reason chain fell through to its last branch.

**Nested same-quote f-strings** parsed on Python 3.12 here and crashed on his
older runtime. Two instances, the second only reachable on a rerun.

**The competition query returned a department.** `bathtub handle bath handle`
matched 112,202 listings. Both ends of the range are now marked unusable rather
than stored, with `raw_total` kept so the reason is visible.

**The importer would have failed silently.** Its selection was
`[...stock, ...slipping]`, both empty once the stock verdict was suppressed.

**Four pet terms nearly written to Coverage as `no_headroom`.** Their products
had left the rebuilt shortlist, so the outcome logic fell through. Caught in a
dry run.

**Five studio test decisions were showing on Approved**, which she read as us
approving products on her behalf. Deleted, and the audit log recorded the
removals. The trigger logs `actor` as null on delete, which is a defect: when
she takes back a decision it will not record who did it.

---

## Schema added this session

```
0028  candidates.cluster, plus the candidate tier value
0029  batches.retired_at and retired_reason
0030  candidates.competition jsonb
0031  candidates.dimensions jsonb
      candidates.monthly_headroom numeric, added by hand, needs folding in
```

`batches_status_check` allows building, delivered, failed only. Retirement is a
separate axis and got its own column rather than a fourth status word.

---

## Scripts changed

```
analyse-terapeak.py      two floors, medium parcel band, rebuilt bulky list,
                         cluster column, stock verdict refuses under three
                         windows, screen recorded as the drop reason
import-shortlist.js      candidate tier, amber gate, monthly_headroom, sorts by
                         worth, full shortlist is the default
enrich-candidates.js     cluster from the eBay leaf, package dimensions
import-coverage.js       a term with listable products succeeded, whatever its
                         stock count
check-competition.js     new, Browse listing depth and price spread
check-identity.py        new, diagnostic only, tests item id stability
request-cj-sourcing.js   ceiling not sale price, ask floor and ceiling, brand
                         screen, bulky skip
```

---

## Portal changed

Candidates group by cluster and sort by monthly worth. The category badge is
gone, since categories move when one stops working. The score is absent where
nothing computed it and `A month before goods` takes its place with the
arithmetic underneath. The verdict bar hides when it has no components. The
competition block is a ledger matching the cost breakdown, ending in what the
pricing gap is worth per unit and per month, net of fees.

Metrics gained six entries and lost three that were no longer true. Status
reads 21 of 24.

---

## Client state

**She has seen the batch and engaged with it.** She asked what variables we
compare on, listing seven. She checked products against Amazon and AliExpress
herself and reported back. That is a different footing from two weeks ago.

**What she was told on 13 August:** that the products come from specific UK
suppliers, that this is why competition is low and margin is real, that
`aidapt.co.uk` is one of them, and that calls and emails have gone out to most
suppliers awaiting wholesale prices.

**That last claim is ahead of the work.** Five CJ requests went out. No UK
supplier has been called or emailed. Close that gap before she asks.

**Do not tell her these are dropship products without qualifying it.** Aidapt
are a manufacturer and manufacturers usually sell cases. The likely answer is a
small stock buy, which is a different model from what she has been told.

---

## Rotting

- CJ account needs a transaction by roughly 24 August
- 16 CJ sourcing requests still to send, five a day
- No query endpoint for reading CJ sourcing answers, so checking is manual
- `run.js` still deletes then inserts, and still names columns enrichment owns
- The decision trigger writes a null actor on delete
- `monthly_headroom` exists in the database and in no migration
- 118 rows costed at £3.65 postage that will not post at £3.65
- The eight dead terms are recorded as `killed_at_strip` in Coverage, which is
  generous to the six that were actually scraped
- Terapeak sell-through and the pipeline `str_min` gate share a name and are
  different measures
- VAT relief on disability aids is not modelled and is a real listing mechanic
  in this category
