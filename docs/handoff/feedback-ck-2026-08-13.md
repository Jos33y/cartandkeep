# Feedback, Joseph, Cart & Keep

**Read this before responding to anything.** Every item is a correction he made
or a preference he stated. Reload each session. Supersedes
`feedback-ck-2026-08-06.md`, which is kept for the record. Items from that file
that still bite are carried forward rather than dropped.

Session of 12 to 13 August 2026.

---

## Corrections he made this session, verbatim

| He said | What I was doing |
|---|---|
| "I am not going to rely on your own keywords.. thats like we are guessing" | swept six terms, five of which a previous session invented and I carried forward without checking |
| "we use what they search for to get what they buy without guessing" | proposing terms from my own head instead of finding real buyer queries |
| "is it that hard?" | answered six seed words with 156 browser lookups |
| "lets just continue working for now" (after a client crisis) | offering a menu of message drafts instead of one deliverable |
| "relax... setting up GSC account not submitting link yet" | got ahead of him on rendering architecture and prerendering |
| "its the store build thats essential but lets move with products first" | proposing store work before the product list existed |
| "we selected only one month why?" | traded research quality for speed without saying so |
| "so its to search for the keywords... I have been off for another 2 days" | eighteen page loads when six would answer the question |
| "how about we do last 6 months thats enough data right?" | thirty day windows only, never questioned |
| "so we need the sell through then lets focus on it per months and do the work... no lazy fix to something" | proposed working around a missing metric instead of doing the loads |
| "wait are we finding something thats pricy?" | had not noticed our own gate was selecting for expensive products |
| "wait oo... she ships them in bulk to the uk then what?" | merged parcel freight and bulk freight into one finding |
| "so we are yet to get one product that works? wonderfull" | six dead terms, no deliverable |
| "are you sure it run well cos its same 202?" | did not explain why an expected number was unchanged |
| "which is the best of the best options" | offered three options when he had asked for a decision |
| "are you updating the script?" | described a fix instead of shipping it |
| "does the visual look meaningful?" | shipped a chart that was decoration |
| "zero idea what it means.. visuals and you chose bar... like think" | a three pixel grey tick against a grey band |
| "what differnce did you make?" | fixed a symptom, not the encoding fault |
| "if you can't visually represent it well as the bar chart or something looks detached" | two rows on two tracks pretending to be one axis |
| "the who else is selling this title makes it smh?" | a sentence as a section label where every other section used two words |
| "ours is meant to be better not boring" | correct and lifeless, third session running |
| "and what's the word dearest?" | archaic vocabulary in client-facing copy |
| "no where to increase quantity... you making it feel like people don't use aliexpress successfully" | generalised a whole sourcing route from one bad listing |
| "wait you are doing the maths against one item each" | per-unit arithmetic asserted without checking quantity pricing |
| "I can see it" (Aidapt trade phone number) | said there was no signup route without reading the page properly |
| "today is 13th of August tho" | asserted a date without checking |

---

## Standing preferences

Everything in the 6 August file still applies. The ones breached this session
are marked.

### Delivery

- **Always give the file path and whether it is new or an overwrite.**
- Present the file again rather than referring back to it.
- Say which file is current when more than one version exists.
- No em dashes or en dashes anywhere. Grep before shipping.
- British and Nigerian English. No archaic vocabulary. (breached, "dearest")
- "The Brick Dev Studios", plural. Possessive is `Studios'`.
- Short and action first for fixes. Fuller only when exploring or designing.
- No preamble, no context recaps.
- Push back when he is wrong.
- Own mistakes in one line. No extended apology.
- **Name one next step, not four.** (breached)
- Do not explain a rule he already stated.

### Working style

- **Think twice, code once.** He notices guesswork.
- **Pause means stop.**
- Say something once. He tracks what was said and will quote it back.
- **Read every file he uploads before answering.**
- Timestamped filenames on handoff documents.
- `supabase/queries/` logs what is run by hand. `migrations/` is append only.
- Client-facing: solve obstacles silently.
- **Keep a record.** Scripts take `--record` for a reason.
- **When he asks a question, answer it before doing anything else.** Twice this
  session I built while a direct question sat unanswered.

### Design

- **Restraint is not absence.** Said in four sessions now. Following only the
  prohibitions produces something correct and lifeless.
- **Better than Zik and Hustle Got Real is the bar**, not "clean".
- A visual must be readable at a glance or it should be text.
- Section labels are two or three words, never a sentence.

---

## What I would do differently

### Terms and research

**Broad terms before narrow ones, always.** Seven single-product hypotheses
died. One broad term, `elderly`, returned 38% of its volume clearing the gate
and surfaced four clusters nobody proposed. The narrow terms cost a day. The
broad one cost a page load.

**Never carry forward a term list without checking where it came from.** Five of
six terms in my first sweep file were invented by a previous session. This is
the exact fault `research-process.md` already documents.

**Amazon bestseller counts are not an eBay demand signal.** They prove a product
type sells somewhere. Raised toilet seats run 900+ a month on Amazon and are
thin on eBay, because urgent single purchases go to Prime.

**A single window kills a term. Direction is only worth buying for survivors.**
Two of the four kill signals need no history.

**Terapeak does not compute sell-through over six months.** A long window buys
depth and loses one of the four kill signals.

**A closed window is not frozen.** The same July strip read differently on the
10th and the 12th. Sales settle late. Take the strip and the scrape in one
sitting.

**Distrust an outlier before building a story on it.** July 2025 read 66.70%
sell-through against 7.16% the next month. I read a decline into it and had to
withdraw that an hour later when five more windows arrived.

### Numbers and honesty

**A null must never render as a real figure.** Fourth and fifth appearances this
session: `SCORE 0` where the score was null, and `sell_through` defaulting to
the string zero inside an obfuscated `chr()` expression no grep would find.

**Do not print a verdict the data cannot support.** The stock block computed
`hold 1.0` on one window, where every product passes by construction. The
importer then tiered all 178 rows as stock. Both removed.

**Suppress the score when its components do not exist.** Four components fired,
one of them, `same_sku`, points the wrong way for a dropship route. A number
built on that is asserted, not computed.

**A default reason is a wrong reason.** Six screened pagers were recorded as
`headroom below gate` when their headroom was fine. Check the actual cause
before falling through to the last branch.

**Never write a wrong outcome to a page she reads.** Four pet terms would have
been recorded as having found nothing, because the shortlist had been rebuilt.
Caught in a dry run and nearly written anyway.

### Screens and word lists

**A flag that fires on everything carries no information**, which is the same
failure as one that fires on nothing. My first bulky rewrite matched 50 of 50
rows.

**Test a screen against real titles in both directions before shipping.** The
electrical screen missed a caregiver pager, an alert alarm and a wifi panic
button because the list was pet vocabulary.

**The brand screen is the one that ends accounts.** It was absent from the CJ
sourcing script entirely, and would have asked CJ to source copies of Medokare
and Helping Hand products.

### Debugging and environment

**My container is Python 3.12 and his is older.** Nested same-quote f-strings
parse here and crash there. Every script now gets an explicit pre-3.12 grammar
check.

**When a fault of a given shape appears, scan the file for that shape.** Fixing
the one line that threw left a second identical fault that would have surfaced
days later on a rerun.

**Check the column exists before writing SQL against it.** `decisions.actor` and
`decisions.created_at` do not exist. Two errors in a row from asserting a schema
instead of reading it.

**A migration must include every column the code writes.** `monthly_headroom`
was added to the importer payload and to no migration.

### Charts

**Four attempts at one chart is three too many.** The lesson: if the space is a
row in a list and the data is a range plus a point, it is a ledger, not a chart.
The page already had a pattern that worked eight lines above.

**Do not compare a position against a length.** The market band was drawn
between quartiles and the product as a bar from zero, which made the cheaper
product the longest shape on the row.

**Outliers set the scale and destroy it.** One £89 listing squashed a market
living between £14 and £30 into the left fifth.

### Sourcing

**Search before building, and read before asserting.** I said Aidapt had no
signup route. The trade phone number was on the page.

**Do not generalise a route from one listing.** One AliExpress seller quoted
£28.50 shipping on a toilet seat. Another quoted 80p on a cushion. Freight is
per listing and per product shape, not per country.

**Check quantity pricing before quoting a per-unit figure.** AliExpress freight
is per unit, so twenty units is twenty times the freight. That is a real
finding and I asserted the opposite shape first.

---

## Recurring failure modes to watch

1. **Building before verifying.** Every significant rework traced to assuming.
2. **Optimism in defaults.** A null must never become a zero, a free product,
   or a score.
3. **Printing a verdict the data cannot support.** New this session and it
   appeared three times in one day.
4. **Generalising from one row.** CJ from one bed, AliExpress from one seller,
   the category decline from one bad strip.
5. **Asserting a schema, a date, a page or an API instead of reading it.**
6. **Answering a narrow question with a wide answer.**
7. **Repeating a point he has already made.**
8. **Correct and lifeless design.** Following the prohibitions is not the job.
9. **Continuing past a negative result.**
10. **Saying a thing is done when it is queued.** Watch this in client-facing
    messages especially.
