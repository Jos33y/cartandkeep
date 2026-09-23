# Feedback, session 20 August 2026

Fifteen mistakes worth recording. As with the last one, the value is in the
patterns rather than the individual errors, and this time the patterns are
different from yesterday's, which is worth something on its own.

The dominant one is new and it is uncomfortable: **most of the errors today
were in the checks rather than in the code.** That is a better failure than the
reverse and it is still a failure, because a wrong check either wastes a cycle
or, worse, passes.

---

## The five patterns

### 1. A check that can produce a false positive will

Written into the last feedback document as a lesson learned. It happened five
times today.

**Selectors by index in a growing component.** The description checks reached
for `textarea[0]`, which was correct when written and became the title field
the moment a title field was added above it. Three checks failed against code
that was entirely fine. They now scope by panel heading.

**Asserting an initial state after a previous check had changed it.** Twice.
Once on the trader gaps, which had been filled in by an earlier check, and once
on a delivery figure that two earlier tests had already moved. Both reran clean
against a fresh state.

**Reading two adjacent elements as prose.** A value and its denominator are
separate spans with a flex gap, so `textContent` runs them together and every
regex expecting a space failed. Three checks, all wrong, the counts correct
throughout.

**Reaching into a label for a nested input**, which only worked because the
markup was wrong. When the markup was fixed the check broke, which is the right
outcome, but it means the check had been validating the bug rather than the
behaviour.

**Dispatching a native input event through jsdom**, which does not reach React
19's delegated listener. It reported a broken component that worked perfectly.

> When a check fails, work out whether the code or the check is wrong before
> touching either. The instinct to fix the code first is what makes a good test
> suite dangerous.

### 2. Knowing about a trap does not stop you walking into it

**`create or replace view` cannot rename or reorder columns.** I hit this on
0045, fixed it, and wrote a comment in the file explaining exactly why the drop
was necessary. Six migrations later I hit it again on 0055, adding four columns
in the middle of `store_channel_profit`.

The comment in 0045 was in a file I was not reading at the time, which is the
whole problem with putting a lesson in a comment: it only reaches somebody
already looking at that line.

> A rule that has been broken twice belongs in the decisions file, not only in
> the file where it was learned.

### 3. Silencing output turns a broken build into a passing suite

I ran `node make6.mjs >/dev/null 2>&1 && node run6.mjs` out of habit, to keep
the transcript clean. The build had failed on a JSX comment placed inside an
expression container, so the tests ran against the previous bundle. Everything
passed, including checks I had just written to assert new behaviour, against
code that no longer compiled.

An entire cycle was spent reasoning about why edits had not taken effect when
the answer was that they never got built.

> Never silence a build. A failure that looks like a pass is worse than a
> failure.

### 4. Asserting a mechanism does not exist without reading the whole folder

I wrote `using (true)` into two migrations with a comment stating that no
membership mechanism existed in migrations 0029 to 0041. It exists in 0001.
`memberships`, `platform_admins`, `is_platform_admin()` and `has_tenant()` are
all there, every table in that file is scoped with them, and `PortalProtected`
had been calling two of them since before the storefront was built.

I looked in the range I happened to have, asked Joseph once whether one existed
earlier, got no answer, and shipped anyway rather than pressing.

The result was four policies looser than the project already supported, on
tables holding customer names and addresses.

> An absence found in a partial view is not an absence. Either see the whole
> thing or say the question is open.

### 5. Claims in comments that nobody checks

Two examples and they are the same fault in different places.

**A grant line that did nothing**, justified by a comment saying 0042 had
narrowed grants on `store_products`. It narrowed them on `orders`.
`store_products` still carried a full table grant. So the line was a no-op
wearing an explanation, which is worse than no line at all because it reads
like a restriction that is there.

**A section reference invented on a client facing page.** I wrote "Section 5
puts performance reporting in month two" into the deliverables data without
having the scope document. The scope in fact puts analytics in month one. That
went onto the one page she can hold against her contract.

> A comment is a claim. If it cannot be checked, it should not be written.

---

## The individual errors

```
&& before ??                     the guard yields false, ?? does not fall
                                 through false, so a match chain stopped at
                                 the barcode step and never reached the title.
                                 It matched nothing and looked deliberate
JSX comment in an expression     {cond && ( {/* ... */} <p> )} does not parse
side effect in a state updater   React double invokes under StrictMode, so
                                 every save would have fired two events
tenant_id null on a not null     the failure log row could never have written
column                           itself
"already sent" tested existence  a failed row would have made Stripe's retry
rather than status               skip, turning one outage into a customer who
                                 is never told anything
one class doing two jobs         .sent was the row state and the dispatch
                                 panel; .failed was the error text and a row
                                 state. styles[state] picked the wrong one
input nested inside its label    every field became a row with a shrunken box
                                 beside its own name. The page's own account
                                 section had the right pattern and I did not
                                 read it before writing forty fields
"1 products have no cost"        no plural handling
Café Crème slugged to caf-cr-me  no accent normalisation
```

---

## Two things I got wrong in conversation, not in code

**"What remains is small."** Said an hour before being shown a competitor's
admin panel that surfaced ten features with no equivalent here. The list was
not small and I had not looked hard enough before summarising.

**"Zero is bad."** I had built hedging into five screens on the reasoning that
a zero can mislead. Joseph's argument is better: a zero says plainly that
nothing is happening, which is the most actionable thing a screen can say, and
softening it makes the screen say nothing. That reasoning had propagated into
verdicts, empty states and withheld totals before anybody questioned it.

> A principle applied consistently across five screens is not evidence that the
> principle is right.

---

## What worked and should continue

- **Running SQL against real Postgres before shipping it.** Found the
  `jsonb_set` overwrite, proved the settings function refused a cross tenant
  write, and verified every margin figure to the penny before it reached a
  screen
- **Checking rather than recalling.** Google's product data specification,
  Regulation 16 and Schedule 2, the actual grants on `orders`, the fee shape on
  the tenant row, and current model pricing were all read rather than
  remembered, and three of the five contained something I would have got wrong
- **Computing thresholds rather than picking round numbers.** The forty and one
  hundred view thresholds came from binomial arithmetic, which is also what
  made it possible to abandon them cleanly when the reasoning changed
- **Testing classifiers against titles in the shape of her catalogue**, in both
  directions, which is how the photo album false positive was checked
- **Writing the reasoning into the file rather than into the chat.** Most of
  what is worth keeping from today survives because it is in a comment or a
  migration, not because it is in this document

---

## The one thing to change next session

**Stop, and run the lifecycle test, before building anything.**

Sixty files in two days and not one of them has met a real payment. The
temptation to keep building is strong precisely because building is going well,
and the risk is concentrated entirely in the part that has never run.

Yesterday's version of this note said the same thing about handing over. It was
right then and it was ignored today until the context was heavy enough to force
it.
