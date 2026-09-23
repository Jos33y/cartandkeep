# Session Summary, Cart & Keep

**15 and 16 August 2026, WAT.** Continues 14 August.

Started: two batches live and undecided, 91 products, the supply half open and
Aidapt unanswered.

Ended: three batches on three dates, 114 candidates, nine windows of history on
a new category, six new screen classes, a deliverables page on her domain, a
recovered data loss, and the arithmetic that explains why nothing on this
project has been profitable.

---

## The research

### Massage, swept to nine windows

`massage`, category 36449 Massagers, nine strip windows and seven row windows.
The deepest history on the project.

```
window     price   sold-rate   sellers
2025-05   £13.95     66.66%      1,417
2025-06   £14.42     67.07%      1,454
2025-08   £13.41     51.81%      1,684
2025-09   £13.66     42.51%      1,669
2025-10   £13.56     41.78%      1,804
2025-12   £16.18     41.75%      2,107
2026-05   £14.32     34.38%      2,419
2026-06   £14.16     31.29%      2,231
2026-07   £13.15     34.58%      2,563
```

**Not seasonal, and the December test proved it.** December lifts price to
£16.18, the highest of the nine, and leaves sold-rate at 41.75%, line for line
with October. Christmas raises the basket and not the odds, because sellers
pile in at the same moment.

**Like for like, same months a year apart, the rate has halved.** May 66.66 to
34.38 with sellers up 71%. June 67.07 to 31.29 with sellers up 53%.

### The tail comparison, which is the session's best method output

Unit totals only compare between windows scraped to the same tail. Filtered to
equal depth, July 2025 excluded on every term:

```
              listings    units    units per listing
elderly   t4    +99%      +49%          -25%
bedding   t4    -22%      -36%          -18%
massage   t3   +121%      +58%          -28%
```

All three commoditising, by different mechanisms. Massage and elderly are
growing categories where supply outruns demand two to one. Bedding is shrinking
with sellers leaving slightly slower than buyers.

I had been building toward saying elderly is the healthy one. It is not.

### Bedding is the category I have been wrong about

```
                    elderly   bedding   massage
units clearing £4     53.0%     88.2%     24.3%
evergreen products        5        29        11
of those, gate clearing   2        20         2
stock candidates          2        18         2
```

Bedding is the only category where products persist **and** clear the gate.
Twenty durable gate clearing products against two and two.

It was closed on 13 August because every route avoiding a container loses
money. That was the route's verdict and I have been repeating it as the
category's verdict for three days, on the category with the strongest evidence
in the pipeline. Sourcing is hers now, so the container question is not mine to
answer and bedding should not have stayed closed on my answer to it.

### Massage verdict

Term passes, category churns. Eleven evergreen products out of 1,675, two
clearing the gate, one of those a brand. 48.3% of products new, 17.5% fading,
7.6% gone. You can make money in massage on a product that will not last.

Competition depth confirmed it independently. Sold per active listing, median
mobility 0.173, massage 0.052. `neck shoulder massager` is 4,593 listings deep
for 63 sales a month.

The two best massage products on competition are the two never mentioned all
day, because ranking was on headroom and sellers: `muscle massage fascia ring`
at 143 listings for 51 sales, and `back massager heat relieve` at 133 for 39.

### Terms closed

`shoe lace` closed in one page load. Strip read £19.99 average, which looked
like a gold mine. The category filter was left on All categories, so the term
matched "Lace Up" in trainer titles. Unit weighted average £8.15, median
listing £3.86, and the top of the file is Adidas Gazelle at £59.24. The actual
lace market is £1.64 to £3.21 with 889 units on one listing, entirely below the
gate. Third time a headline average has been another product: orthopaedic was
mattresses, beauty was piercing jewellery.

---

## The engineering

### Six new screen classes, all found by running it

```
0033  decisions.reason gains not_sourceable and not_profitable
```

- `MEDICAL` widened to any `circulat\w+`, muscle and nerve stimulators, and EMS
  with context words. The narrow version left `Leg Massager for Circulation
  Pain Relief` listable at £51.89 while screening `Circulation Foot Massager
  and EMS TENS` at £51.90.
- New `adult` exclusion. Caught 113 units of magic wand. `Le Wand Wednesday
  Powerful Ladies Wand` had been sitting in the listable list at £52.
- New `condition` exclusion for refurbished and open box stock, on a scrape
  filtered to New.
- `THIRD_PARTY` matched with word boundaries. It was a bare substring test, so
  `etac` fired on de**tac**hable and `dorma` on dormant.
- Thirty massage brands added over two passes. Theragun appeared five times at
  the top of the listable list at up to £293 of headroom.
- `POWERED` did not know `vibration`, the second highest gate clearing word in
  the scrape at 662 units, so mains driven massagers read as unpowered with no
  import obligation.
- `foot spa` into `BULKY` and `RIGID`. A water filled tub was costing as a
  small parcel.
- `massage oil` into the cosmetic pattern, and `oil` into `FORMULATION` so a
  roller bottle is not released as a dry tool.

Test suite 33 to 43, corpus 62 to 83 titles.

### Band basis, instead of an exemption

`Neck & Shoulder Massager ... Electric Pillow` was costed at medium parcel on
the word pillow, losing £1.90 on a moulded device nothing like a bed pillow.

An exemption would have meant guessing a carton size from memory. Instead the
band stays conservative and records why: `band_word` names what pushed it up,
`band_measure` says whether every deciding word does two jobs.

The first ambiguous list was mobility vocabulary and fired on 67 of 196 elderly
rows. A toilet frame is furniture, not a device. Ambiguity is contextual, so
the word now needs a device context word beside it.

Enrichment was expected to answer this and did not. 138 candidates enriched,
**zero with real dimensions**. Sellers in these categories do not publish them,
which `postage_band` already says in its own docstring.

### The parse fault

`eBay delivery` carried £19.84 of headroom through all seven massage windows.
It is a postage service name, thirteen characters, and the title picker takes
the first value over twelve. `JUNK` now matches case insensitively and knows
carrier and service vocabulary.

### Competition floor raised

`half step platform extra` returned four listings and wrote a seller
concentration of 1.00 with a price band of 6.52. The guard tested
`items.length >= 4`, so a query finding exactly four passed it, and 1.00 reads
as one seller owning the market. Floor is eight.

### New tooling

- `scripts/backup.js`, thirteen tables with parent scoped children, paging at
  1,000 because Supabase caps a select there silently. `--against` compares two
  backups keyed on `external_ref`, because a reimport changes every id.
- `scripts/terapeak-url.py`, generates window URLs. Computes boundaries in the
  zone so a window spanning a clock change keeps both real ends, and refuses
  July 2025 on any term with the reason printed.
- `--routes=proven,sourceable` on the importer.
- A date collision guard on the importer, running before the dry run exit.

### The incident

A backslash line continuation, which cmd does not honour, split a command and
ran the first half alone. No `--date`, no `--label`, no `--dry`. A massage
import landed on the mobility batch's date, relabelled it, and deleted fifty
candidates.

Fully recovered. `0 of 116 not restored`, verified against the backup taken
ninety minutes earlier. Two `candidate_sources` rows were lost and deliberately
not restored: both were CJ sourcing requests with no price, on a route that is
closed.

It was cheap only because `decisions` was empty. The importer protects decided
rows and would have kept them. After the first approvals it stops being cheap.

---

## The client

She wrote at 01:11 on 15 August, unhappy. Not satisfied, always incommunicado,
nothing tangible in three weeks.

She was right about the communication and wrong that nothing existed. The
disconnect has a precise cause, found by reading the signed scope:

**Section 2 puts cross-channel product research and sourcing intelligence in
month two.** All the research, the pipeline, the batches, the screening, is
month two work delivered in month one. Meanwhile month one's own list is 23 of
26 items blocked on a storefront that had not been started.

She is paying for a shop and has been shown a research system.

### What went out

A full reply on 15 August with the real figures, the plan with dates, and a
commitment to Monday and Thursday updates. A Sunday follow up with the
deliverables link, the headroom explanation, and the new rejection reasons.

### Deliverables page

`status.cartandkeep.com/deliverables`, a second route on the status app, not a
new site. Reads its counts off the data so a shipped item moves the tally, the
sentence and the row together. 2 done, 1 in build, 23 waiting, 2 with her.

Also caught: the two counts contradicted each other. Status said 21 of 26
complete, deliverables said 2 of 26. Both true, neither said what it counted.
Status now says build milestones.

Two stale rows fixed on the live status page. It was advertising 178 products
in an active batch. It is 114 across three, delivered.

---

## Where the batches stand

```
2026-08-17   Mobility and daily living aids   50 products   1 stock
2026-08-18   Bedding and duvet covers         41 products  11 stock
2026-08-19   Massage and recovery             23 products   2 stock
```

139 candidates in the database, 114 across the three live batches, 25 on a
retired pet batch. Nothing decided.

All three enriched and competition checked. Bedding has five rows with no
market reading, because in that category the product is the category and
`duvet quilt cover` returns 197,150 listings.
