# 14 — Help & Legal

---

## Verdict

**Five pages share one template, and only two of them are legal documents.**

Terms, Privacy, Delivery, Returns and FAQ all render through the same shell: same breadcrumb, same h1, same "Last reviewed 18 August 2026" line, same floating "THE REST" rail. A contract and a shop assistant should not look alike, and right now they are indistinguishable.

The FAQ page specifically:

- Questions set at nearly the same size and weight as answers, so nothing scans
- Seven questions in no groups at all
- The rail card stops at 390px while the content runs to 900, leaving a 500px empty column
- Roughly 400px of dead space before the footer
- No search, no anchors, no interaction of any kind

At seven questions it is merely poor. At thirty it collapses entirely, and the cost lands directly on one person's inbox.

---

## The job

Two different jobs that have been forced into one template.

**Help** is a shop assistant. It answers "how do I", it is searched rather than read, and its success measure is how few emails it generates.

**Legal** is a reference document. It answers "what am I owed", it is cited rather than browsed, and its success measure is that it can be read in full and pointed at precisely.

Neither should pretend to be the other.

---

## Help centre

### Structure

**Search first.** At thirty answers this is the primary control and everything else is secondary. A single field that filters as you type, with a live count. Nothing loads, nothing navigates.

**Four to six groups, not thirty rows.** Delivery, Returns & refunds, Ordering, Payment, Products & stock, The shop itself. Counts visible so the shape of the page is readable before a word is read.

**The five most-asked open by default.** Not all closed. A page of closed rows communicates nothing, and it is why nobody reads FAQ pages.

**Deep links per answer.** Every question gets its own anchor and a visible "copy link to this answer".

This is the highest-value feature on the page and almost nobody builds it. Mrs Sowande pastes one link instead of retyping an answer. For a one-person operation it is worth more than the entire visual pass.

**Answers placed where the question happens.** The best help centre is short because the answers moved to the point of doubt. Delivery answers on the PDP and in the basket. Returns answers near the returns row. The no-account answer at checkout. Thirty questions in one bucket is a symptom that the product and delivery pages are not answering them.

**Live values inside answers.** The free-delivery answer shows the real gap in the reader's actual basket. A help page that knows your state stops being a document and becomes part of the shop.

**Instrumented.** Yes and No on each answer, plus a log of searches that returned nothing. That list is next month's writing brief, which turns this page into a recurring deliverable rather than something that ships once and rots.

**FAQPage structured data** so answers surface directly in search results. Free traffic, small amount of work.

### Support rail

Sticky, three cards:
- **Still stuck**, with the honest promise: one person reads these, she replies herself, usually within a few hours on a weekday
- **Find an order**, no account needed
- **Legal, not help**, routing to the reference set, so the two are visibly separate

---

## Legal

### Structure

Deliberately duller. Deliberately denser.

**No search. No accordion. Nothing collapsed.** A contract you cannot read in full is not a contract.

**Numbered clauses and sub-clauses**, so `clause 4.2` is a thing that can be pointed at. This is the entire structural device of the page and it is why the numeral column has to be perfect.

**A contents rail, not a floating card.** Full height, in its own tinted column, carrying both the clause list and the version block. This is what fixes the 500px empty gutter on the current page.

**Versioned, not "last reviewed".** `v3, 18 August 2026, supersedes v2, 4 March 2026`, with a diff and a PDF. A reviewed date tells a reader nothing. A version they can retrieve is the difference between a page and a record.

**Cross-linked both ways.** Clause 5 points at the nine delivery answers. The returns answer points back at clause 7. Help handles "how do I", terms handle "what am I owed", and neither pretends to be the other.

### The reference set

Terms of sale, Privacy, Cookies, Accessibility. Four documents, one template, one rail.

**Delivery and Returns move out** and become groups in the help centre, where the questions already are.

Five pages become two templates. That is one fewer template than exists today.

---

## Craft

Both surfaces use the quiet end of the material language: rules, numerals, tinted paper. No colour fields, no halftone, no department colour.

The distinction between them is made through **density and typography**, not decoration.

| | Help | Legal |
|---|---|---|
| Question / clause | 22px Archivo 620 | 22px Archivo 620 |
| Body | 17px, measure 66 | 16px, measure 68 |
| Row rhythm | Generous, 22px padding | Tight, 26px between clauses |
| Numerals | Group counts, monospace | Clause numbers, monospace, hung in the margin |
| Interaction | Expand, search, copy link | None |
| Rail | Support cards, sticky | Contents, full height, tinted |

---

## Motion

**Help**
- Search filters live, results FLIP into position, the count animates
- One row expands at a time, on `--dur-settle`, height animated on transform
- Copy link confirms in place with a quiet ink tick. Never a toast
- Group chips spring on `--ease-spring`

**Legal**
- Contents rail highlights the clause in view on scroll, on `--dur`
- Nothing else. A contract does not animate

---

## Copy

**Help questions are written the way people ask them.** "Nothing has arrived. What now?" not "Non-receipt of goods". "It arrived damaged." not "Damaged item policy".

**Help answers lead with the answer.** Two to four working days, then the qualifications. Never a paragraph of context before the fact.

**Legal clauses stay exact.** Plain, but exact. "Nothing in this clause reduces your rights under the Consumer Rights Act 2015" is not a sentence to make friendlier.

**Both carry the shop's voice.** The existing writing is the strongest asset in the project and neither page should sound like a template.

---

## Mobile

**Help**: search under the headline, group chips scrolling horizontally with a visible edge, rows at 44px minimum, one expanded at a time.

**Legal**: contents becomes a jump control at the top, clauses run in full, numerals inline rather than hung.

---

## Measure

- **Support email volume** as a percentage of orders. The only number that matters here.
- **Search terms returning nothing.** Next month's writing brief.
- **Yes and No rates per answer.** An answer with a high No rate is wrong, not just unclear.
- **Copy-link usage**, which measures whether the shop is actually using its own tool.
- **Answers opened per session.** Above three means the answers are not answering.

## Study

- GOV.UK content design guidance. The best public writing on making complex information plain, and their accordion and error patterns are directly applicable.
- Stripe and Shopify help centres for search-first architecture at scale.
- Nielsen Norman Group on FAQ pages, particularly the finding that most FAQ pages exist because the product failed to explain itself.
- Schema.org FAQPage.
- The Consumer Rights Act 2015 and Consumer Contracts Regulations 2013 for what the terms must contain.
- Terms of service pages at Basecamp and Ghost, both of which manage exactness and plainness at once.
