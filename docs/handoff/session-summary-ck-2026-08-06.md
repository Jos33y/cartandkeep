# Session Summary, Cart & Keep

**5 to 6 August 2026, WAT.** Continues 3 August.

Started: research complete and sitting in a CSV, nothing on screen, the
Candidates ledger never having rendered with data.

Ended: 25 candidates in the portal with images, categories, cost breakdowns, a
supplier form and a second tier, all deployed, plus two days on supplier
sourcing that produced one usable number and a clear negative.

She has still not seen it. That is the next thing.

---

## Shipped

**The research reached the portal.** `import-shortlist.js` takes the Terapeak
shortlist into the same tables `run.js` writes, so the ledger has one code path
and not two. 25 candidates, 16 stock and 9 slipping.

**Product images and eBay categories.** `enrich-candidates.js` looks each
candidate up on the Browse API by its legacy item id and stores the gallery
image, the category id and the full category path. Multi variation listings
needed a fallback to the item group endpoint, which also revealed how many
variations sit behind each figure.

**Coverage.** Every keyword swept is recorded with its outcome and the six
figures off the Terapeak strip. Seven terms, four that produced something and
three killed on first look. This is the page that answers "are we doing pets
only" before she asks it.

**Metrics.** Every figure explained in her language, dated, with terms added in
the last fortnight marked so a change is visible without a status entry.

**Decision history.** A database trigger writes every insert, update and delete
on `decisions` to an append only log with the actor, so a decision taken back is
visible rather than a gap. The Activity page reads it.

**Notes on any product**, not only on a rejection.

**Supplier records.** `candidate_sources` holds many suppliers per candidate with
the fulfilment route, minimum order, inbound freight, duty, origin, transit,
weight and dimensions, and computes `landed_unit_cost` as a generated column. She
adds one herself from a form on the row, picking from a supplier list that grows
from use and comes seeded with the eight found this session.

**Two tiers.** Stock candidates hold against their own history. Slipping ones are
proven and still selling but below the threshold, shown and marked rather than
hidden, because a product that dipped can come back and she may know why.

**The interface was rebuilt twice** after the first version was called lazy and
the second still was. The row is now one object: image left, title and money on
one line, the score labelled beside the bar that explains it, and the actions on
the same line as the bar rather than a full width row of their own.

**Demo mode removed entirely.** Six code paths and a fixture that had drifted
from the schema.

---

## The corrections that mattered

**A writer overwrote fields it did not own, twice.** The importer deleted and
reinserted candidates, cascading her decisions away. The upsert that fixed it
named `image_url`, which enrichment owns, so every image was nulled while
`enriched_at` stayed set and nothing could recover on its own. The rule is that a
writer names only the fields it is the source of.

**A to-one embed read as an array, in three hooks.** `decisions.candidate_id` is
unique, so PostgREST returns an object rather than a list, and `decisions?.[0]`
is undefined. Every decision was invisible on Candidates, Approved and Overview.
Nothing threw. One schema detail broke three places silently.

**A null coalesced to zero, again.** A sourcing request with no answer rendered
as a free product with the best margin on the page. Same shape as
`Number(null)` becoming a zero cost in July.

**Headroom hid its own components.** It was one aggregate, so a dropship route
could not add back the postage the supplier pays. Split into four lines that sum
to it. The split moved some figures by a penny because rounding now happens per
line, which is the right trade: a ledger whose lines do not sum to its total is
worse than a penny.

**Sage fails as a filled shape.** 2.87:1 on the page, under the 3:1 that
graphical objects need. Every bar and chart point moved to a measured darker
step. A track lighter than its fill cannot exist on a cream page at all, so
segments are outlined and the chart columns share a baseline.

**Postgres orders jsonb keys by length.** The verdict bar read left to right in
an order nobody chose, and a rename would have rearranged it.

**The hold threshold left no evidence.** It was computed and only written when it
passed, so nine excluded products carried a blank field and no reason. Now
written either way, with a section in the terminal output.

---

## Supplier sourcing, and what it cost

Two days. One usable number and a clear negative.

**Keyword matching does not work here.** 25 candidates against CJ produced 38
rows and 5 distinct products. One generic Oxford cloth bed was the best match for
fifteen products including four vet bedding rolls and a plastic basket. Every row
carried a plausible cost and a plausible margin and all but one were wrong, which
is what makes it dangerous rather than merely useless. Nothing was confirmed, so
nothing reached a decision.

**Freight is the real finding.** £6.85 goods quoted £5.72 to the UK. Landed cost
is roughly double the goods price on anything with volume, which is why
dropshipping cannot reach beds and bedding at all, and why the products carrying
£10 to £21 of headroom are the ones no catalogue holds.

**The sourcing endpoint is the mechanism that scales.** Instead of matching
against a catalogue, submit the name, image and reference listing and let CJ
answer. Five a day on the free plan. That works at 25 products and at 500.

**Four API attempts against CJ failed before one worked**, each on a single
changed variable. That discipline was right and the diagnostics were not: three
runs were lost to a log line that printed nothing when a value was falsy. A
conditional log that can print nothing is the same as no log.

**Named UK suppliers came from a web search in ten minutes**, after two days of
API work. Crow Recycling at £9.60 per 30kg bale against a product selling 10kg at
£19.93. Vetfleece manufacturing in a Yorkshire mill. That is the lesson: for UK
made bulky goods the answer was never an API.

---

## Decisions

| Decision | Reason |
|---|---|
| Two tiers rather than one list | a product below the hold threshold is not a reject, it is not a buy today, and she may know why it dipped |
| Nothing trusted until confirmed | thirty seven of thirty eight catalogue matches were wrong and all of them looked plausible |
| Landed cost as a generated column | it cannot drift from its inputs, and it is null rather than zero until something is quoted |
| Supplier list grows from use | an admin screen nobody opens, against a datalist that learns |
| Score moved off the display face | two display weight elements beside a product image fought each other, and the number was never labelled |
| Group by eBay category, rank within | a 72 on a cat bowl and a 72 on a dog bed are built the same way and mean different things |
| Demo mode removed | an honestly empty page beats a fixture that has drifted from the schema |
| Coverage recorded from what is on disk | a record that has to be maintained separately is a record that rots |

---

## What I would do differently

**Stop sooner on a negative result.** CJ was answered by the end of the first
hour: one generic bed for every query. Two days went into proving it more
thoroughly. The client said it felt like wasted time and he was right.

**Change one thing and log unconditionally.** Changing one variable at a time was
right. Doing it with a log that prints nothing when the value is falsy meant
three runs told us nothing.

**A writer names only the fields it owns.** The same fault twice in one session,
the second time quieter than the first.

**Check the disk before recording a number.** The handoff said five terms were
killed at the strip stage. It was three, and a correction to that also asserted
two files that did not exist. One directory listing settled it in a second.

**Search the web before building an adapter.** Ten minutes of searching produced
four named UK suppliers with real prices. Two days of API work produced one
freight figure.

**Read what is uploaded.** Five blog files were sent and two were read. The three
skipped contained the eBay shipping performance policy, which is the reason a
transit time is an account risk rather than an inconvenience.
