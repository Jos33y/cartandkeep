# Handoff, Cart & Keep

**Session close:** 13 August 2026, WAT. Continues 6 August.

**Load with:** this file, `feedback-ck-2026-08-13.md`,
`session-summary-ck-2026-08-13.md`, plus `docs/design-system.md`,
`docs/research-process.md`, `docs/research-process-update-2026-08-10.md`,
`docs/terapeak.md`, `docs/supplier-apis.md`,
`docs/supplier-leads-2026-08-13.md`.

Read the feedback file first.

---

## Opening message for the new chat

> Continuing Cart & Keep. The 17 August batch holds 178 mobility and daily
> living aid candidates, grouped into seven clusters, with seven months of sales
> history, a live competition read and itemised costs on every row. All
> deployed. She has seen it and engaged with it.
>
> The supply answer is settled: these are UK manufacturer goods sold through
> trade accounts, which is why a product selling 118 a month has four sellers
> and £10 of headroom. Aidapt on 01744 745020 make the strongest product in the
> batch. No UK supplier has been called yet and she has been told they have,
> so that gap closes first.
>
> Next research direction is his: sweep for products that can actually be
> sourced from AliExpress, Temu, CJ or Amazon, aiming at 300 to 500 candidates
> on the understanding that sourcing will cut it down. Demand still leads. The
> new screen is shape, because flat and compressible is what decides whether a
> Chinese route works at all.
>
> Two things are open and both are postage: 118 of 178 rows are costed at £3.65
> when the real band is worse, and her courier rate is unknown.

---

## Where the work stands

### Live and working

| | |
|---|---|
| Candidates | 178 in the 17 August batch, seven clusters, sorted by monthly worth |
| Coverage | 10 terms recorded, `elderly` shortlisted, 9 killed |
| Metrics | every figure explained, six entries added 12 and 13 August |
| Activity | decision audit log |
| Status | public, 21 of 24 milestones |
| Approved | empty, and correctly so |

### Retired

The 10 August pet batch, 25 candidates. She checked it and could not source
most of it. `retired_at` and `retired_reason` are on `batches`, the ledger
filter is not yet written, so it still appears.

---

## The three things to do first, in order

**1. Email or call Aidapt and one other supplier.** She was told on 13 August
that calls and emails have gone out to most suppliers. Five CJ sourcing
requests went out and no UK supplier has been contacted. Aidapt trade sales,
01744 745020. Ask: do they supply an online seller paying upfront, what is the
minimum order, do they post direct to the customer or does she hold stock, and
what are the pack dimensions.

**2. Check the CJ sourcing answers.** Five went out on 13 August, source
numbers CJSPU958406723, 725, 726, 727, 728. Answers arrive in their app in
about 48 hours and there is no query endpoint, so it is manual. Also: the CJ
account needs a transaction by roughly 24 August or access goes.

**3. Start the sourceable sweep.** See below.

---

## The next research direction, his words

> lets go back to ebay terapeak and look for products that can be gotten either
> on aliexpress, temu, cj supplier, amazon and co... we can have over 500
> products it doesnt matter when we start sourcing suppliers products will
> reduce

**The trap to avoid.** Selecting products because a supplier has them is
supply-first, and that is what produced a food mixer from a beauty search and
fourteen empty terms from twenty-five. Demand still leads.

**The way to get what he wants without the trap.** Keep sweeping demand broadly,
and add a **shape screen** before anything reaches her. Shape is what decides
whether a Chinese route works at all, and it is knowable from the title and the
category before any supplier is contacted.

```
works from China      flat, light, compressible, under about 40cm
                      textiles, cushions, wipes, small plastics, insoles
does not work         rigid moulded, tubular, framed, over 40cm
                      seats, stools, frames, rails, walkers, steps
```

Evidence for that split, from this session: an AliExpress cushion shipped for
80p, a rigid toilet seat from another seller for £28.50, and a bed assist bar
for £40.72 against goods of £24.19. It tracks compressibility, not country.

**One caution on the volume target.** 300 to 500 rows is a filtering exercise,
not a review session. The ledger works at 40 and not at 500. Bulk actions and a
way to work a whole cluster at once are a portal change that has not been made.

---

## What one window buys and what it does not

The pipeline now refuses to assert what it cannot compute, and this is worth
knowing before the next batch.

```
one window     units, price, headroom, sellers on the SKU, eBay category
three windows  trend, season, proven, holding, the stock verdict, the score
```

`MIN_WINDOWS_FOR_STOCK` is 3. Under that the stock block prints "not computed"
and the score is null on every row, and the ledger shows monthly headroom in
its place. That is correct behaviour, not a bug to fix.

---

## Rotting

- CJ account needs a transaction by roughly 24 August
- 16 CJ sourcing requests still to send, five a day
- No query endpoint for CJ sourcing answers, checking is manual
- `run.js` still deletes then inserts, and still names columns enrichment owns
- The decision trigger writes a null actor on delete, so a decision she takes
  back will not record who did it
- `monthly_headroom` exists in the database and in no migration
- 118 rows costed at £3.65 postage that will not post at £3.65
- The retired pet batch still appears in the ledger
- `Handles & Rails` at 54 rows merges bathroom grab rails with bed rails, which
  are different products for different rooms
- Six of the nine dead terms are recorded as `killed_at_strip` when they were
  actually scraped, because their files were never named `{term}_{YYYY-MM}.csv`
- VAT relief on disability aids is a real listing mechanic in this category and
  is not modelled anywhere
- Terapeak sell-through and the pipeline `str_min` gate share a name and are
  different measures

---

## Closed this session, do not reopen

**eBay package dimensions.** `packageWeightAndSize` returned zero of 177.
Sellers in this category all use flat rate postage and never fill it. The code
stays because it costs nothing and another category may differ. Do not retry it
here.

**Daily living aids as a narrow-term category.** Eight single-product terms
died. The category works, but only when found through a broad sweep.

**AliExpress and CJ for rigid mobility products.** Freight equals or exceeds
goods on anything that does not compress. Three catalogues now agree.

**Relisting as an explanation for product churn.** Tested at 7%, and the eBay
item ID holds as an identity.

**Unequal scrape depth as an explanation for churn.** Depth was equal at 2 to 4
units across all seven windows.
