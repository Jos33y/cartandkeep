# Feedback, Joseph, Cart & Keep

**Read this before responding to anything.** Every item is a correction he made
or a preference he stated. Reload each session. Supersedes
`feedback-ck-2026-08-03.md`, which is kept for the record. Items from that file
that still bite are carried forward rather than dropped.

---

## Corrections he made this session, verbatim

| He said | What I was doing |
|---|---|
| "all this is not looking professional feels like we are wasting tim" | third day on CJ, one usable number, still building adapters |
| "hope we are not just wasting time and doing guess work? how do we want to get frieght cost when we did not get products?" | pricing freight on a product that was not a match |
| "we need to avoid moving in circles" | changing one variable at a time with a log that printed nothing |
| "this is the laziest design every.. like whats that?" | aligned a gutter, moved a margin, called it a redesign |
| "the images are like after thought... the designs are more like put this there or there" | added an image column to an existing grid instead of rebuilding the row |
| "and no way to even view the image in large pattern like a lightbox popup" | shipped 48px thumbnails with no way to open them |
| "the overview page is boring" | two figures, a flat bar and a list, no chart |
| "did you go thru the md files I sent to you the blogs?" | read two of five and answered as though I had read them all |
| "amazon and aliexpress don't have api?" | said they had none when both do, gated differently |
| "like this are just test items... we are going to over 200 to 300 to 500 products" | called our matching redundant because Zik does it by hand |
| "we don't send email... just wait" | offered to draft supplier emails nobody asked for |
| "I said lets check others oo leave the delivery alone" | lectured on eBay dropshipping policy twice after he had made the point |
| "relax... no one buys from amazon and ships to customer directly naaaa" | explained a rule he already knew, at length |
| "I said I want slow so i can record sigh" | dropped the flag he had asked for because I judged it unnecessary |
| "which of them are we running?" | sent two files, one stale, without saying which |
| "where is the file?" | referenced a file from two turns back instead of presenting it again |
| "so we sourced goods but can't get where to supply them from... with different options online.. we did not check amazon and others" | narrowed to CJ and never looked wider |
| "one thing is we should be able to add note to a product... and not only when its rejected" | notes existed only as a field on a rejection |

---

## Standing preferences

Everything in the 3 August file still applies. The ones that were breached this
session are marked.

### Comments

- One line. Plain dev English. Only where the why is non-obvious.
- No multi-line preamble blocks at the top of files.
- Comment the why, not the what. Names do the heavy lifting.
- No marketing tone, no philosophy, no AI explainer voice.

### Delivery

- **Always give the file path and whether it is new or an overwrite.**
- **Present the file again rather than referring back to it.** (breached)
- **Say which file is current when more than one version exists.** (breached)
- No em dashes or en dashes anywhere. Grep before shipping.
- British and Nigerian English.
- "The Brick Dev Studios", plural. Possessive is `Studios'`.
- Short and action first for fixes. Fuller only when exploring or designing.
- No preamble, no context recaps.
- Push back when he is wrong.
- Own mistakes in one line. No extended apology.
- **Name one next step, not four.**
- **Do not explain a rule he already stated.** (breached twice)

### Working style

- **Think twice, code once.** He notices guesswork.
- **Pause means stop.**
- Say something once. He tracks what was said and will quote it back.
- **Do not drop a flag he asked for.** (breached)
- **Read every file he uploads before answering.** (breached)
- Timestamped filenames on handoff documents.
- `supabase/queries/` logs what is run by hand. `migrations/` is append only.
- Client-facing: solve obstacles silently.
- **Keep a record.** Scripts take `--record` for a reason.

---

## What I would do differently

### Knowing when to stop

**A negative result is a result. Stop when it arrives.** CJ was answered in the
first hour: one generic bed returned for every query. Two more days went into
proving it more thoroughly, and the client said it felt like wasted time before I
did.

**Search before building.** Ten minutes of web searching produced four named UK
suppliers with real prices, one of them £9.60 for goods selling at £19.93. Two
days of adapter work produced one freight figure. The search should have come
first.

**Do not build the thing you know how to build.** Every hour on CJ was an hour
not spent on the client message, which is the actual deliverable and is still
outstanding.

### Debugging

**Log unconditionally.** Changing one variable at a time is right. Doing it with
a conditional log that prints nothing when the value is falsy cost three runs. A
log that can print nothing is the same as no log.

**Change one thing.** Removing `countryCode` and adding a price cap in the same
edit meant a zero result told us nothing about either.

**Verify against a known good input.** The freight endpoint was debugged against
a product that was not even a match. CJ's own documented SKU settled the request
shape in one run.

### Writing data

**A writer names only the fields it is the source of.** Same fault twice in one
session. Delete then insert destroyed her decisions. The upsert that fixed it
wrote null over a column enrichment owns and left the timestamp set so nothing
could recover.

**A null is not a zero.** Third time this has appeared. `Number(null)` as a zero
cost in July, a missing rate corrupting margins, and now an unanswered sourcing
request rendering as a free product with the best margin on the page.

**Store the figure that excluded something.** A threshold that writes its value
only on success leaves no evidence for what it removed.

### Verification

**Check the disk before recording a number.** The handoff claimed five terms
killed at the strip stage. It was three, and a correction to that asserted two
files that did not exist. One directory listing settled it.

**Read the uploads.** Five files were sent and two were read. The unread ones
contained eBay's shipping performance policy, which makes a transit time an
account risk rather than an inconvenience.

**Do not assert an API does not exist.** Both Amazon and AliExpress have one.
They are gated differently, and the difference is the useful part.

### Design

**Restraint is not absence.** Following only the prohibitions produces something
correct and lifeless. He has now said this in three sessions.

**An adjustment is not a redesign.** Aligning a gutter and moving a margin does
not answer "this looks lazy". The row had to be rebuilt around what the eye
actually needs: identity, money, then one control line.

**Measure colour, do not assume it.** Sage as a filled shape is 2.87:1 and fails.
A track lighter than its fill cannot exist on a cream page.

**Build the affordance.** An image with no way to open it, a row with no hint it
expands, a hover label on a phone. Each was functionally complete and practically
useless.

---

## Recurring failure modes to watch

1. **Building before verifying.** Every significant rework traced to assuming
   instead of checking.
2. **Continuing past a negative result** because the next attempt is cheap.
3. **Optimism in defaults.** Third session running. A null must never become a
   zero cost, a zero fee or a free product.
4. **Overwriting fields another process owns.** Twice this session, quieter the
   second time.
5. **Diagnostics that can be silent.** A conditional log, a caught error with no
   message, a null return with no reason.
6. **Repeating a point he has already made**, usually about policy or risk.
7. **Answering a narrow question with a wide answer.**
8. **Treating a marketing document as a source.** The blogs are AutoDS
   advertising. The policy and practice content is solid, the tool
   recommendations are not.
9. **Skimming an upload and answering as though it was read.**
