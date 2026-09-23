# Handoff, Cart & Keep

**Session close:** 16 August 2026, 18:00 WAT. Continues 14 August.

**Load with:** this file, `feedback-ck-2026-08-16.md`,
`session-summary-ck-2026-08-16.md`, plus `docs/design-system.md`,
`docs/research-process.md`, `docs/terapeak.md`, `docs/supplier-apis.md`, and
the signed scope at `cartandkeep.thebrickdev.com`.

Read the feedback file first.

---

## Opening message for the new chat

> Continuing Cart & Keep. Three batches live and undecided: 50 mobility for 17
> August, 41 bedding for 18 August, 23 massage for 19 August. All enriched, all
> competition checked, nothing decided.
>
> The question is not which category next. It is why nothing is profitable, and
> the answer is arithmetic. Every term this project has swept is a £13 to £18
> market and the gate is £4. Below about £25 the fixed costs eat the margin
> before goods cost exists. The one product that clears is the one that sells
> at £43.21.
>
> Terapeak has a Price filter and it has never been touched on a single sweep.
> That is the first move.
>
> Two things outrank everything else. Month one is due 22 August and 23 of its
> 26 committed items are blocked on a storefront that has not been built. And
> five real products she can source beats fifty she cannot, which is her rule
> and mine now.
>
> Do not raise Aidapt. Paused on 15 August, he will say when.

---

## The finding this session ends on

Every product this project has priced:

```
product                  price    head   landed     net
percussion massage gun   43.21   30.74    12.18   +18.56
raised toilet seat       18.80   10.91    11.83    -0.92
satin bedding set        22.00    9.10    11.01    -1.91
garment rail             12.99    4.30    13.07    -8.77
```

One works. It is the only one above £40.

Headroom as a share of price:

```
£10   37.7%      £25   63.8%
£15   52.2%      £30   66.7%
£18   57.1%      £40   70.3%
£20   59.5%      £50   72.5%
```

Postage, packaging and the fixed 30p come to about £4.35 whatever the sale
price. That is a third of a £12 sale and a tenth of a £45 one.

**Price is not one factor among several. It is the factor.**

Now the terms swept: elderly £14.15 to £18.02, bedding £16.56, massage £13.15,
beauty, orthopaedic, shoe lace. Every one a £13 to £18 market, gated at £4. The
pipeline has been finding products that clear a bar no imported good can pay.

He said this on 14 August, verbatim: *"you really know we can put price at a
higher price and still sell tho?"* It was recorded as a correction and never
acted on structurally.

**The Price filter in Terapeak has never been used.** Every screenshot from
every sweep shows it grey. A £25 floor turns the same terms into a different
market.

Massage at £30+ was 4.5% of units and 313 sales a month across seven windows,
and it has never been looked at on its own.

---

## The three things to do first, in order

**1. The storefront.** Due 22 August, six days. 23 of 26 committed month one
items are blocked on it, including all seventeen SEO items in Section 4. He
told her on 16 August that the build is underway. Nothing else moves a single
row on the deliverables page.

**2. Sweep on price, not on category.** Reload one term already on disk with a
£25 floor before sweeping anything new. Elderly and massage both have nine and
seven windows of history, so the comparison is free.

**3. The routes filter he committed to in writing.** Told her every product
would carry a route before Monday.

```
node scripts/import-shortlist.js --term=elderly --routes=proven,sourceable --date=2026-08-17 --label="Mobility and daily living aids" --replace
node scripts/import-shortlist.js --term=bedding --routes=proven,sourceable --date=2026-08-18 --label="Bedding and duvet covers" --replace
```

`--replace` because the date guard now refuses a collision, and these are
reimports over the same term. Dry both first.

---

## What was established, so it is not rediscovered

**Bedding was closed on a route verdict and should be reopened.** 29 evergreen
products, 20 clearing the gate, 18 stock candidates. More durable gate clearing
stock than the other two categories combined. Sourcing is hers now.

**All three categories are commoditising**, at equal scrape depth, by different
mechanisms. Elderly and massage grow with supply outrunning demand two to one.
Bedding shrinks with sellers leaving slower than buyers.

**Massage churns.** 48.3% new, a quarter fading or gone, eleven evergreen out
of 1,675. Money is available on products that will not last.

**Sold per active listing separates the categories cleanly.** Median mobility
0.173, massage 0.052.

**Specification words make a market measurable and are worth the margin.**
`pintuck` returns 63 listings, `duvet quilt cover` returns 197,150. The words
worth £3.65 a set are the same words that make competition countable.

**Enrichment does not answer the dimensions question.** 138 enriched, zero with
real dimensions. It is a supplier side answer, arriving with a carton spec.

---

## Do not reopen

**`shoe lace`.** All categories, so it matched Lace Up in trainer titles.
Median £3.86, actual laces £1.64 to £3.21, entirely below the gate.

**`disability aids`, `orthopaedic support`, `beauty`.** Closed 14 August.

**July 2025 on any term.** Proven three times now.

**Temu, AliExpress, Homefords and the small Alibaba tier for bedding.**

**Aidapt.** Paused by him on 15 August. Do not raise it.

---

## Rotting

- `candidate_sources` has no import VAT line. The percussion massager reads
  £18.56 net and the true figure is about £16, before a duty rate that has
  never been read off the commodity code
- No VAT registration switch anywhere in the model
- Duty rates of 12% and 6.5% asserted from memory in an earlier session, still
  never verified
- `BULKY` has `bed rail` and not `rail`, so clothes rails, garment racks and
  display stands all cost as small parcels
- Screen vocabularies live in Python. `THIRD_PARTY` has been the fault in four
  categories running. They belong in a tenant scoped table, editable from the
  portal, which is also a lane fix since naming a brand is her call
- `run.js` still deletes then inserts
- The decision trigger writes a null actor on delete
- `monthly_headroom` exists in the database and in no migration
- Delisted candidate `227285805090` still in the mobility batch
- Bedding may be reading the shallow export. `BEDDING_2026-07-FULL.CSV` has
  2,447 rows and the analysis reported 581 listings for that window
- Pet is 25 candidates in the database and absent from coverage entirely
- `check-competition.js` has no test coverage, since the suite is Python
- `listings` and `listing_performance` are empty, so her 67 live listings and
  six sales remain unexplained and unmeasured
- Slimming and cellulite claims have no screen. Flagged, not built, because the
  regime has not been read
- CJ account needed a transaction by roughly 24 August

---

## Client state

She wrote unhappy at 01:11 on 15 August. Two messages have gone since, both
answering rather than explaining. She replied "Communication and updates are
key."

**Committed in writing, and she will hold these:**

- Monday and Thursday updates, news or no news
- New batch every Monday
- Every product carrying a route before Monday 17 August
- Storefront build underway this week
- Which products are UK route and which are China lead time, rather than dates
- A shortlist of recommended products if she does not want to review all 114

**Dates from the signed scope:**

```
22 Aug   month one deliverables live
23 Aug   £80 retainer balance, first renewal review
24 Aug   first SEO progress report, every cycle without exception
```

The month two pricing review was due 17 August and was deliberately left out of
the Sunday message. His call: do not raise money while behind. The document
keeps month two at £200 by default if nothing is agreed by 23 August.

**Her rejection reasons are live.** `not_sourceable` and `not_profitable` went
in on migration 0033 so she can use them tonight. Twenty or thirty tagged
rejections is the first real feedback the pipeline has ever had. Check what she
has rejected and why before the next sweep.
