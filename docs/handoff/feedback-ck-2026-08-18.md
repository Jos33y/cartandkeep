# Feedback, session 18 August 2026

Sixteen mistakes worth recording. Not a self-flagellation exercise: the value
is in the four patterns underneath them, because the individual errors are
cheap and the patterns are not.

---

## The four patterns

### 1. Reintroducing a bug I had already found

**The footer duplication, twice.** Delivery and Returns appeared in both the
Help and Legal columns. I found it, explained why policy pages belong in one
column, fixed it, and then reintroduced it two turns later when adding Track an
order and About us. Joseph found it in a screenshot.

**The dead header link, twice.** I criticised the old header for pointing at
`/c/beauty` and `/c/pet`, which did not exist. Three turns later I added search
and saved icons pointing at `/search` and `/saved`, which did not exist, and
left them for several turns.

This is a context length symptom, not carelessness, and the fix is not trying
harder. It is a rule written into the file so it survives the session:

> Every page appears in the footer exactly once. Anything resolving to /legal/
> belongs in LEGAL_LABELS and nowhere else.

**Do this for every rule that has been broken twice.** A comment in the file
outlives the conversation.

### 2. Adding a column and not adding it to the query

Migration 0036 added brand, specifications, source description, returns class
and eighteen more. The enrichment run filled them. The product page showed none
of it, because `useStoreProducts` had a hand-written select list written before
the migration.

The data was in the database, the page was correct, the query was two days old.
Joseph spotted it from a screenshot showing "Dart Boards" where "Winmau · Dart
Boards" should have been.

**A migration that adds a column has a matching change in whatever reads it,
and they ship together or the feature does not exist.**

The same shape appeared twice more. `enrich-store.js` reported a brand cleaning
it could not apply, because the `set()` helper skips null and so a correction to
null silently wrote nothing, and the coverage table then counted the stale value
as filled. And the `order` edge function needed redeploying after gaining the
dispatch fields, which is easy to forget because the front end looks finished.

### 3. Assuming the deployment path

`_shared/cors.ts` worked on my machine and failed on his, because the Supabase
CLI bundles the whole functions directory and the dashboard editor deploys one
folder. Twenty lines duplicated across two functions was the right answer and I
should have asked how he deploys before writing the import.

Same family: `@fontsource-variable/geist` sat in `devDependencies` while
`PortalApp.jsx` imported it, which is fine locally and fails on any deploy
running `npm ci --omit=dev`. It would have failed on the portal only, which is
the slowest possible way to find out.

### 4. Writing a claim the data does not support

**The returns sentence.** "30 days to change your mind. Send it back unused and
we refund the lot" was printed under a four litre bottle of carpet cleaner and
a gift set full of bath products. It was not weak copy, it was wrong, and the
customer is a lawyer. Returns are a contract term and I wrote them as marketing.

**Same day dispatch on every product**, with `dispatch_days` null on all 78.

Both were caught by Joseph looking at a screenshot and asking what the page was
saying about the actual product underneath it.

> If the database does not know it, the page does not say it. A hedged right
> answer beats a confident wrong one.

---

## The individual errors

```
--i on the card, not the cell        custom properties inherit down, not up,
                                     so the stagger would never have fired
1fr instead of minmax(0, 1fr)        twelve thumbnails set the grid column's
                                     minimum and squeezed the buy button
useAnalytics in lib, not hooks       every other hook is in hooks
ResizeObserver unguarded             an environment without it lost the whole
                                     shelf rather than one measurement
copied an older QuickView            overwrote the ProductTerms version with a
                                     stale one from two turns earlier
build.rollupOptions added            unrequested, and a guess at package names
@pwa alias left as an instruction    described a change instead of making it
```

---

## Two process mistakes

**The parallel HTML mocks.** The first one earned its place: we were arguing
about direction in prose and one file settled it. Everything after that was a
second implementation with the CSS copy-pasted out of the modules, which is the
exact duplication I criticised elsewhere. Joseph called it and he was right.

> Build a static mock only for something that cannot be seen in the app yet,
> because the route or the data does not exist.

**Test harnesses that reported bugs which were not there.** Twice a crude regex
in a verification script produced a false reading: `class="chip"` matched both
the department rail and the sub-section chips because CSS modules were not
hashing in the harness, and an out-of-stock check found an Add button in the
related shelf rather than the buy button. Both wasted a turn.

> A check that can produce a false positive is a check that will.

---

## What worked and should continue

- **Testing classifiers against her real titles before shipping them.** The
  returns classes and hazard suspects were run over all 78 products, which is
  how the photo album false positive was found and consciously kept.
- **Rendering through a real router with effects flushed** before handing
  anything over. It caught the tenant hang, the missing select columns and the
  stagger bug.
- **Checking rather than asserting.** Bank holidays, GB CLP, the Consumer
  Contracts Regulations and the eBay `regulatory` container were all searched
  rather than recalled, and three of the four contained something I would have
  got wrong.
- **Flagging the legal and compliance questions instead of answering them.**
  Twelve gold blocks on live pages, which cannot ship unnoticed.
- **Pushing back on the four requests that deserved it**: install on first page
  load, "can't take your eyes off" as a loading goal, building a fake Stripe
  simulation, and inventing surcharge numbers.

---

## The one thing to change next session

**Ask what has already been applied before writing a file.** Several overwrites
this session went out against a version I had produced hours earlier rather than
the version in his repo, and the QuickView mix-up came directly from that. The
zip he sent halfway through solved it instantly and should have been the first
request rather than the fifteenth.
