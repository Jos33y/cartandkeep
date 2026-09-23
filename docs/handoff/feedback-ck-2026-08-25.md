# Feedback, 24 to 25 August 2026

The mistakes, and the pattern under each one. Written for the next session
rather than as an apology.

---

## 1. I shipped a page nobody could reach

The receipt route was live, styled, tested and linked from nowhere. The only
way in was typing the URL. My own plan said "the links from the confirmation
and order pages" and I built twelve files without ever checking that line
against what I had written.

The packing slip would have gone the same way if he had not asked for a control
on the order row.

**The pattern:** every check I run is internal to a file. Every class has a
rule, every prop is passed both ways, every token exists. Nothing I run asks
whether a thing can be found.

**The rule:** every route in `STORE_ROUTES` and `PORTAL_ROUTES` is either
linked from somewhere in `src`, or is deliberately unreachable and named as
such. `THREAD`, `RECEIPT` and `PAY_SIMULATOR` are legitimate: tokened links
from emails, and a redirect. Anything else with no inbound link is a page
nobody can find.

**And when I did add the link**, I put it inside a caption styled `--c-faint`
with no class, because I had not read `order-confirmation.module.css`. Faint
grey inside faint grey. It rendered and was invisible, and he reloaded twice
before I asked the right question. Refusing to invent a class name in a sheet I
have not read was correct. Putting the link there anyway was not.

---

## 2. A print stylesheet that printed the whole website, then one that printed nothing

The receipt's print rules hid the page's own two controls and nothing else, so
it printed with the announcement bar, the header, the footer and the mini
basket, and the sticky header landed on top of the returns block.

I had written the comment in the slip file explaining exactly this problem, and
then shipped a receipt page with no answer to it.

**The fix was worse.** `body:has(.page) *` at specificity [0,2,0] against
`.page` at [0,1,0], so the hide rule beat the show rule and the sheet printed
blank. Two shipped versions of the same file, neither checked.

**The rule:** a CSS rule that overrides another one has its specificity
compared before it is handed over, not after somebody prints an empty page.
Both selectors are written out and scored. That check now exists and takes
seconds.

---

## 3. The UI said one thing and the table said another

A reply that had been emailed showed "Saved, but not emailed yet" indefinitely.
`reply` appended the row it had just inserted, with `sent_at` null at that
instant, called notify, then reloaded the thread list and never refetched that
thread's messages.

He asked "so we are good?" and I diagnosed a notify failure with a confident
list of two candidates. The table said both messages had sent two seconds after
being written.

**The pattern:** the row is the truth and the screen is a cache of it. When a
screen reports a state, the first question is what the row says, not which of
my theories fits the screen.

**What made it recoverable:** the line existed at all. A build that showed
nothing would have had her believing emails were not going out when they were,
and the fix for the wrong diagnosis costs far more than the fix for this one.

---

## 4. A guard I invented against a column I had never read

`.neq('status', 'draft')` in the thread function. The values happened to be
right, so it was not the cause of the failure it was blamed for, but
`status <> 'draft'` is NULL when status is NULL, so any row with an unset
status is dropped silently.

This is the same shape as the three invented design tokens in the previous
feedback file. I reached for a value that sounded like the system rather than
reading the system.

---

## 5. The simulator hid its own failure

`replay` logged a refusal and returned nothing, so the checkout answered `ok`
and the page navigated cheerfully to an order that had not moved. He had to ask
why the order was unpaid.

That is the rule already written in the last feedback file, in the same words:
a failure that hides its own evidence is worse than one that is loud and ugly.
I wrote it down and then built a test tool that lied about the test.

It now returns the refusal, reads the order back afterwards, and refuses to
navigate when nothing moved.

---

## 6. Rendering found three things reading found none

```
a three paragraph question arrived as one run-on line, and it was broken in
  two places at once: clean() collapsed the breaks at write time and the
  template would not have rendered them either

the customer's offer email carried the basket total in the subject and the
  quoted price in the body, so the higher figure sat directly above the lower
  one in an inbox. That is a price claim assembled by accident out of two
  honest halves, and it is invisible in the source

the packing slip showed two identical lines and a paid date before the placed
  date, which turned out to be fixture nonsense rather than a rendering bug,
  and looked exactly like one
```

Rendering before handing over has now found something in every session it has
been used in.

---

## 7. Essays instead of comments

Six files between 32% and 48% comment lines, `notify` at 38% across 996 lines,
migrations between 51% and 80%. The house rule is one line, plain, only where
the why is non-obvious, and no multi-line preamble blocks. It is written down
and I ignored it in every file I wrote.

He asked which other files were heavy, which is the right question, and the
measurement took one command that I should have been running all along.

**The trim also found a real fault.** An earlier patch had inserted
`withdrawOffer` between a comment block and the `setStatus` it described, so a
paragraph had been sitting over the wrong function since I wrote it. It
surfaced only because a replacement asserted and failed.

---

## 8. Scope creep dressed as thoroughness

The `verify_jwt` finding is the counter-example and it was worth the detour: it
would have surfaced on the first live payment as money taken with no
confirmation, no seller alert and no stock movement.

But I also spent a turn on tenant literals and origin lists as if client two
were imminent, and he corrected it: tenant two will be a separate company on
its own database, so the origin list is not a defect at all. Two of the three
things I flagged as blockers were tidiness.

**The pattern:** I extrapolate an architecture from a rule in a document
rather than asking what the next client actually looks like.

---

## 9. What worked, and should keep happening

**Running SQL against a real Postgres before shipping a migration.** Postgres
16 installed in the container, five migrations run and asserted against real
rows, and 0068 exists at all because writing the thread function against a real
schema exposed a `maybeSingle` with no uniqueness behind it.

**Testing guards as attacks.** The offer's three rules were each tested by
trying to break them, not by using them.

**Asserting every anchor in a patch.** Two failed this session, and both
failures were real: the orphaned comment, and a status guard whose surrounding
text had moved.

**Arithmetic proved rather than reasoned about.** The offer allocation was run
against seven shapes including a target above list price and nine lines. All
exact.

**The compress pattern.** Three collectors this session. Naming files in prose
cost a round trip the one time I did it.
