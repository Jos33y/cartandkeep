# Session Summary, Cart & Keep

**3 August 2026, WAT.** Continues 28 July, with a weekend break in the middle.

Started: pipeline blocked on a missing config row, no demand source, no research
that survived contact with the data.

Ended: Terapeak access through Team Access delegation, two analysis scripts,
four categories researched to depth across five monthly windows each, and 214
listable products with 13 stock candidates in an accumulating file.

Nothing reached the portal. That is the next session.

---

## Shipped

**Migration 0010, rate cards and scoring config.** Postage moved out of tenant
config into a dated `rate_cards` table with an exclusion constraint, so two
prices cannot be in force for the same band on the same day. The runner prices
the batch date rather than today, so rerunning an old Monday prices that
Monday. Royal Mail Tracked 48, April 2026 tariff.

**Migration 0011, brand screen config.** `brand.js` was written after the first
supplier run and had never been called.

**`pipeline/lib/rates.js`**, new. Loads the band prices in force on a date.

**`run.js`**, patched. Calls the brand screen. Counts distinct sources rather
than distinct signals for the sources gate, which had been passing
single-source candidates for weeks. Resolves the drop directory from env.

**`match.js`**, patched. Group tokens frozen at the seed title, and demand
facts carried through to the group.

**`scripts/analyse-competitor.py`**, new. Reads scraped Zik competitor
catalogues.

**`scripts/analyse-terapeak.py`**, new. The main instrument. Reads scraped
Terapeak windows, merges on eBay item ID, classifies products across windows,
computes headroom, applies the screens, and writes an accumulating shortlist.

Both scripts take `--slow` for screen recording and `--record` for a
timestamped log.

---

## The corrections that mattered

**The £14 price floor was never computed.** It was asserted early and then
defended by nothing. Worse, a $12 filter sat inside the saved Zik search that
produced the finding that nothing cleared £14, so the conclusion was partly
manufactured by its own filter. Removed, and replaced by headroom: what is left
of the sold price after platform fee, ads, postage and packaging, before goods
cost.

**Zik competitor figures are lifetime totals, not windowed.** Confirmed in the
UI: 14, 21 and 30 day columns read identically even on recently uploaded
listings. Velocity trend is not derivable from that source at all, and raw units
favour older listings. The competitor script now reports units per month
listed.

**The scrape has no stable column layout.** Seven Zik files contained three
different layouts, with title and item URL swapping places and a varying number
of sales columns. Terapeak added two more. Both scripts now identify every
field by what it contains rather than where it sits. This was only caught
because he asked where the image URL had gone.

**Presence in every window was the wrong test for a young category.** In
`raised dog bowl`, 60% of units were listings that did not exist a year ago,
and the best product in the set had 127 units in July against zero in both 2025
windows. The persistence test was selecting old listings rather than good
products. Fixed by making recent volume the entry requirement.

**And then the opposite mistake.** `sourceable`, the count of sellers listing
the same product, was briefly a route in on its own. It admitted 132 products,
most selling two or four a month. A product with four sales and forty lookalikes
is still a product with four sales. It is now an annotation.

**The screens were wrong in both directions.** `sized` was catching "various
sizes" in vet bedding titles and removing the two highest-headroom products in
the best category. `cosmetic` was firing on "cream stripe polycotton", a colour.
`ingestible` was catching "chew resistant" on beds. Meanwhile timer-driven
feeders were passing while identical water fountains were caught. All four
rewritten and tested against the actual misfires.

**Screened products are now visible.** A SCREENED OUT BUT WOULD BE LISTABLE
section prints anything that cleared headroom and volume but failed a screen,
with the reason. Screens are word lists, they are wrong in both directions, and
silently dropping their output is how a good product disappears without anyone
knowing it existed.

---

## Method that emerged

**Strips before rows.** The aggregate strip costs one page load and kills two
terms in three. Scraping rows costs an hour. Five terms died at the strip stage
this session, at a cost of five page loads.

**Terms come from titles, not from imagination.** The 25 terms in
`tenants.research.terms` were invented in an earlier session and fourteen of
them returned nothing. The terms that worked came out of results: a `hair brush`
search returned pet grooming rakes, and `dog bowl` results contained the word
`raised`, which turned out to be the segment carrying the margin.

**The category is where the volume is, the segment inside it is where the
margin is.** `Dishes, Feeders & Fountains` averages £7.98 with £1.94 of
headroom. `raised dog bowl` inside it averages £10.28 with £4.00. A category
sweep would have hidden that inside an average.

**Equal-length windows or the comparison is meaningless.** An early comparison
put a 61 day window against a 30 day one and read the difference as growth. Two
matched three-month blocks in each year is the shape to use.

---

## Decisions

| Decision | Reason |
|---|---|
| Price floor removed, headroom used instead | the floor was asserted; headroom is computed from the actual cost lines |
| Admission on the large letter band, display on small parcel | the real band is unknown until a supplier gives dimensions, and missing a flat product is worse than carrying one into vetting |
| 10 units in the latest window as the entry gate | matches the scraping floor, and a wrongly excluded product is invisible while a wrongly included one gets caught in vetting |
| Stock candidates require a hold ratio, not momentum | momentum compares two windows and is noisy; hold compares the latest window against the product's own history |
| Screened products printed with their reason | screens are word lists and get things wrong in both directions |
| Shortlist accumulates and marks dropped rows | a product that stopped selling is a finding worth keeping |
| Postage in `rate_cards`, not tenant config | a carrier price is not a client fact, and the next tariff change should be one update rather than N |
| Exemption over an endpoint for eBay compliance | an endpoint is infrastructure that has to stay up forever, and the declaration is simply true |

---

## Client

Team Access to her Seller Hub arrived this session, research areas only, which
removed the blocker that had held the engagement up for two weeks. Everything
after that ran on eBay's own transaction data.

Her category list from 25 July, five categories plus a sub-list, was found in
the WhatsApp history mid-session. It had been sitting there while research
continued against the two originally agreed. Worth noting as a process failure:
the client had already widened the boundary and the work had not caught up.

Her own listings were reviewed. Thirty listings, ten categories, average around
£13, two sales. Two Disney items in there, which is licensed character IP and
the fastest route to a VeRO takedown. That needs raising, framed as protecting
the account.

---

## What I would do differently

**Compute the constraint before defending it.** The £14 floor survived weeks of
work because nobody asked where it came from. When the data contradicted it
there was nothing to check the number against.

**Check what a filter is doing to the finding.** The saved search that produced
"nothing clears £14" had a price filter in it. That is the same shape as the
supply-first error: the answer was bounded by a choice made before the question.

**Read the tool's own definitions before using its numbers.** Sell-through,
average postage and average sold price all mean something different from what
they appear to mean, and two of them were being read wrongly for most of the
session.

**Do not widen a screen without testing it.** The `sized` rewrite was intended
to fix a bug and instead removed the best products in the best category. It ran
for two sessions before it was caught, and it was caught by reading the output
rather than by any test.
