# Handoff, Cart & Keep

**Session close:** 3 August 2026, WAT. Continues 28 July.
**Load with:** this file, `feedback-ck-2026-07-26.md`, plus `docs/research-methodology.md`,
`docs/design-system.md`, `docs/category-research.md`.

---

## Opening message for the new chat

> Continuing Cart & Keep. The research pipeline now works end to end and has
> produced 214 listable products and 13 stock candidates, in
> `drops/merged/shortlist.csv`. Nothing has reached the portal. The Candidates
> ledger has still never rendered with data and the status page is showing a
> date that has passed. This session is portal work: get the research onto the
> screen she reviews, then hand her something to give feedback on. Read the
> feedback file first, then the design note at the end of this file.

---

## What this session did

Research, not code. The pipeline was left where it was and the work happened in
two Python scripts that read scraped Terapeak and Zik exports.

Four terms researched to depth, across four or five monthly windows each:
`dog bowl`, `raised dog bowl`, `cat bowl`, `dog bed`. Five more killed at the
strip stage without scraping, which is the point of the strip.

**The output is `drops/merged/shortlist.csv`.** 214 listable products, 13 stock
candidates. It accumulates across every run and dedupes on eBay item ID.

---

## The findings, in order of how much they change

**The £14 price floor was wrong and is gone.** It was asserted, never computed.
The real constraint is postage plus fees, and it moves with the shipping band.
A £14 filter on a Zik search had also been shaping the research that concluded
nothing cleared £14, which was circular.

**Dog beds is the category. Bowls are not.**

| term | units clearing the gate | stock candidates |
|---|---|---|
| dog bed | 65.2% | 12 |
| raised dog bowl | 50.9% | 1 |
| cat bowl | 32.4% | 1 |
| dog bowl | 25.6% | 3 |

Dog bed also has the best sold-rate of anything measured, 29.59% in July and
rising across five windows, on 1,318 sellers.

**Vet bedding is the strongest product group.** Fleece kennel bedding sold by
the roll, £18 to £32, £10 to £22 of headroom, steady across a year. Bought by
breeders and kennels, which is a need rather than a fashion.

**Postage is the largest unmodelled cost.** Every headroom figure assumes a
small parcel at £3.65. Most dog beds are not small parcels. The figures are
optimistic until real dimensions arrive from a supplier, and the script now
flags bulky items rather than hiding it.

**Cooling mats are the trap.** They dominate the July listable table with 120
sellers each. It is August, sourcing runs four to six weeks, and stock would
land after the season. The `proven` test excludes them from stock candidates,
which is the whole reason that test exists.

---

## What is on the screen versus what exists

Nothing from this session has reached the portal.

- Candidates ledger has still never rendered with data
- Status page carries the 30 July review date, which has passed
- No Categories section, still designed and not built
- The five defects in `CandidatesPage.jsx` from 28 July are unfixed

That gap is the whole job for the next session.

---

## Defects found and not yet fixed

**`CandidatesPage.jsx`, five, all from 28 July and all still live.**

Deferred candidates vanish from every filter, because `pending` is
`!r.decision` and there is no chip for defer. The progress track counts a defer
as reviewed. The empty state flashes before the batch loads, because `tenant`
starts null. `potential` turns a missing margin into a confident zero.
`new Date(batch.delivered_for)` is unguarded.

**Dead files.** `CandidateDetailPage.jsx`, `ScreenStub.jsx` and
`screen-stub.module.css`. The router dropped the detail page when rows moved to
expand in place.

**Pipeline, from the 31 July run.** `pipeline/sources/index.js` is still
supply-first, so `collect()` runs every source as a peer and the demand and
supply lists never intersect. Product identity in `match.js` is still derived
from titles, so nothing can be tracked across runs. `--dry` still spends CJ
points.

**Migrations.** `0011_brand_screen_config.sql` and `0011_source_drop_dir.sql`
share a number. The drop-dir one was reverted and may be a no-op, so deleting
it is cleaner than renumbering.

---

## Scripts

`scripts/analyse-terapeak.py` and `scripts/analyse-competitor.py`. Both take
`--slow` for screen recording and `--record` to write a timestamped log to
`records/`. Merged output goes to `drops/merged/`.

**Terapeak file naming is load bearing:**

```
drops/terapeak/{term}_{YYYY-MM}.csv
drops/terapeak/{term}_strips.csv
```

The strips file holds the six figures from the aggregate strip, which appear
nowhere in the row export and are half the answer.

**How a product qualifies.** Headroom at or above £4.00 and 10 or more units in
the latest window. `proven` and `sourceable` are annotations on a product that
already qualified, never routes in. A product with four sales and forty
lookalikes is still a product with four sales.

**Stock candidates are stricter:** proven across every window, still selling,
and holding at 60% or more of its own average. That last test is what excluded
the cooling mats.

---

## What the tools actually do, verified this session

**Terapeak Product Research** is free in Seller Hub, no Store subscription. It
is the demand source. Date ranges go to three years with arbitrary custom
windows, which is what made trend and seasonality computable for the first
time. No export anywhere, so every ingest is a scrape.

**Terapeak Sourcing Insights** is the category-level tool and needs a paid
Store subscription. It appears in the sidebar for everyone and gates on click,
so its presence proves nothing.

**Terapeak strip definitions, from eBay's own tooltips.** Avg sold price
excludes postage and Buyer Protection fees. Avg postage is the average charged
and **excludes free postage listings**, so at 95% free it describes a small
minority. Sell-through is the percentage of similar items that sold, which is a
listing hit rate and **not** the same metric as `gates.str_min` in the
pipeline. The two must not be fed into each other.

**Zik competitor figures are lifetime totals**, not windowed, confirmed in the
UI. Velocity trend is not derivable from that source. Zik is also not an
independent check on Terapeak: it crawls eBay, so agreement between them is one
fact counted twice.

**Category selection needs a keyword.** Terapeak will not search a category
alone, so the sweep stays keyword-driven with the category as a filter.

---

## Access state, 3 August

| | |
|---|---|
| eBay developer account | live, username `thebrickdev` |
| Production keyset | `cartandkeep`, compliant, exemption granted |
| Marketplace account deletion | exempted, on the basis that no eBay user data is stored |
| Terapeak | via Team Access on her Seller Hub, research areas only |
| Own eBay seller account | blocked, UK identity verification |
| Zik | 4 of 5 trial searches left, Bulk Scanner uncapped |
| CJ | account needs a transaction by roughly 24 August |

**The exemption is a constraint, not a formality.** Seller usernames must never
be persisted. Concentration figures are derived and stored as a percentage;
the identities behind them are not stored at all. If that ever stops being
true the exemption is void, and it is on the studio to notice.

---

## Rotting

- CJ account freezes around late August without an order
- `missing_adapter` is still silently non-fatal
- `Number(ts.weight)` is still unguarded against NaN
- `--t-sm` and `--w-bold` are undefined and used in six files
- `docs/tools/` and `docs/access-state.md` were agreed and never written; this
  file is carrying that content instead
- The brand list is a word list and will keep missing things. Two Skylos exist
  on eBay, one selling dog food and one selling beds; the bed one is the brand
  that matters

---

## Client state

The 30 July review session is past and this file does not record what happened
in it. Establish that before anything is sent.

**The research contradicts the signed scope in three places**, and all three are
hers to sign off rather than ours to apply:

The £14 floor is gone. The category boundary widened from two to five on 25
July, in her own WhatsApp list, and the research has since found the money in a
sixth. Beds and bedding is the working category, which is neither of the two
originally agreed.

**The compliance exclusions cut roughly a third of a working seller's
catalogue.** Branded 22.8%, electrical 16.8%, ingestible 5.2%, measured against
a real UK seller doing £181k a month. Her own list included portable heaters,
electric blankets and dash cams, which are all electrical and all excluded. That
argument has to be made to her rather than silently applied, or she will ask why
the heaters never appeared.

---

## Design, read this before touching any interface

He has pushed back on visual quality repeatedly and the pushback has been
correct every time. The pattern: designing against the design system's
prohibitions rather than towards a standard. Follow only the prohibitions and
the result is correct and lifeless.

In his words: the interfaces are too basic and visually zero, this is 2001
design in 2026, icons are not a SaaS tell, do not kill what makes a page worth
looking at in the name of avoiding templates.

**Open action, still open from 28 July:** he was asked for two or three
reference screens he considers top level. Until they arrive the standard is
undefined and the same loop repeats.

What worked: the charcoal and cream slab login, mono display numbers on the
status page, the star field, the sunk rail with the active item raised. What
did not: centred cards, large empty panels, numbered lists, four zeros in a
row, anything where restraint became absence.

The terminal output from the analysis scripts is worth looking at as a
reference for the ledger. Sage bars, cream figures, traffic-lit competitor
counts. It is the same data the Candidates screen has to show and it reads well
at a glance.
