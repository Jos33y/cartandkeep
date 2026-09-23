# Feedback, 21 to 23 August 2026

The mistakes, and the pattern under each one. Written for the next session
rather than as an apology.

---

## 1. A pattern that finds nothing must fail loudly

**`isArchived is not defined`, in production, on the Products screen.**

The import in `ProductsPage.jsx` is split across two lines:

```jsx
import {
  useCatalogue, categoryCounts, isLive, isReady, isBlocked,
} from '@hooks/useCatalogue';
```

Both of my replacement patterns wrote it as one line, so neither matched and the
edit silently did nothing. Two patterns failing quietly rather than one asserting
is what let it through, and every other edit that day survived only because I had
put an `assert` on it.

**The rule:** every string replacement asserts first. A replace that finds
nothing is a failed edit, not a no-op.

**And the check that would have caught it did not exist.** I run a callback check
that walks every `on*` prop both ways. It has caught two real bugs. It does not
look at imported helpers, so this walked straight past it. There is now a sweep
for helpers called but not imported, and it found nothing else.

---

## 2. Four failing checks this week were the check

```
the extraction diff      compared against the original repo file rather than
                         the one in WebStorm, so it reported the returns copy
                         rewrite as an extraction failure
the save flow render     never simulated the reload, so the field read dirty
                         forever and the label never changed
the CSV line endings     called CRLF wrong because a quoted field legitimately
                         contains a bare newline
the customers date       my stub built 2026-08--19 by subtracting forty from
                         twenty one, and the page threw on it
```

Every one cost a round trip. The pattern is that a check written in the same
breath as the code inherits the same assumption.

**One of them was worth keeping though.** The customers date fixture was
nonsense, and the page threw a `RangeError` on it, which is exactly what one bad
`paid_at` in a real database would do. The formatter is hardened now. A bad
fixture found a real fragility.

---

## 3. Rendering finds what reading does not

Three faults this week were invisible in the source and obvious the moment
something was drawn.

```
"Tell us by replying to this email or by replying to this email"
   the clause and its fallback were written as the same words

the dispatch cutoff was an hour late from late March to late October
   getUTCHours against a wall clock cutoff

"1 products with things to check"
   no plural handling, which is written in the previous feedback file as a
   mistake already made once
```

The third is the worst of the three, because it was already recorded and I made
it again.

---

## 4. I invented three design tokens

```
--c-rule    does not exist. It is --c-line
--ts-page   does not exist. The store defines --ts-title
#f0ece5     not in store-footer.module.css. The footer uses #fff
```

All three would have rendered as nothing or as an inherited value. All three were
caught by sweeping every `var()` against the files that define them, which now
runs on every stylesheet before it is handed over.

The pattern: I reached for a name that sounded like the system rather than
reading the system.

---

## 5. Solving my own problem instead of asking the question

**The subscribe box.** The band promised "no newsletter". Asked to put a box in
the footer, I said the footer contradicts that line, and then rather than saying
the box had nowhere to live, I attached it to the request confirmation and argued
for it.

The argument was not bad. It was an answer to my placement problem rather than to
the actual question, which was whether the shop wants a mailing list at all.

**And the band underneath it.** I designed it as a subscribe box in an earlier
session, then in a later session replaced it with a request and wrote a comment
justifying the change as though the earlier version had been somebody else's
mistake. Having built both and defended both, my argument for either was worth
less than it sounded, and I should have said so rather than presenting the second
as obvious.

---

## 6. Fixing one side and reasoning past the other

Found the eBay policy ids in `specifications`, patched `Specifications.jsx` so a
customer never sees `Payment Policies: 264890263011`, and reasoned that the
portal should show her the raw record because it is her editor.

Said that out loud and moved on rather than asking whether it was right. It was
not. She is deciding what a product is, not auditing an eBay export, and
`Returns Po` sitting three lines under an actual returns policy is the field most
likely to be misread on that screen.

There is one list now, in `utils/specs.js`, read by both. The edge function keeps
a second copy because the dashboard editor deploys one folder, with a comment
pointing at the first.

---

## 7. Presenting a small result as a large one

Extracted the description panel out of `ProductRow`, proved the markup was byte
identical across three product shapes, and presented it as a result. It removed
thirty five lines from a file of seven hundred.

Joseph's response was accurate. The proof was worth doing; the framing was not.

---

## 8. Three attempts at structured output, and the useful part is the order

```
"respond with JSON only"    declined by writing a sentence first
prefill the reply with {    this model refuses a conversation that does not end
                            with a user message
a forced tool schema        works, because there is no format to disobey
```

The first attempt threw the reply away in its catch block, so the one thing
needed to diagnose it was the one thing discarded. That cost a round trip on its
own.

**The rule:** a failure that hides its own evidence is worse than a failure that
is loud and ugly.

---

## 9. What worked, and should keep happening

**Running SQL against a real Postgres before shipping a migration.** Four
migrations changed after being run this week.

```
apply_order_stock is not idempotent, so placement in the webhook is the whole
  safety of it
store_reviews had a policy and no grant, which fails as permission denied
  rather than as no rows
`returning` is a reserved word and broke the customers view on the column name
alter database needs superuser, which Supabase does not give you
```

**Rendering the thing before handing it over.** Every visual fault above was
found this way and none of them by reading.

**Sweeping tokens, callbacks and now imports.** Three separate checks, each of
which has caught something the others do not see.

**Testing guards as attacks rather than as edge cases.** The checkout refuses a
variant belonging to another product and a made up variant id, because both were
tested as somebody trying rather than as somebody mistyping.
