# Settled decisions

20 August 2026. Read this first.

Everything here has been decided, argued through, or learned by getting it
wrong. None of it is open. If a session finds itself reasoning towards a
different answer on any of these, the answer is already here and the reasoning
has gone astray somewhere upstream.

Sequence and what to build lives in `build-plan-2026-08-20.md`. This file is
the rules, not the order.

---

## The two that govern everything else

**Zero is a starting point.** No hedging, no "not yet", no withheld totals, no
"too early to say". She is not asking whether a figure is statistically
significant, she is asking whether anything is happening. A zero says plainly
that nothing is, which is the most actionable thing on a screen.

The one exception, and it is narrow: **nobody came and we could not see are
different facts.** A month before Search Console was verified is not a month of
zero clicks. Drawing those the same way tells her she failed at something she
was not running. That is why the Being found trend has a hollow bar.

**The model drafts, she ships.** Descriptions, titles, replies. Every one is a
statement made by a trader about goods, and every one gets a person between the
model and the customer. Nothing written by a model reaches a customer without
her having read it.

---

## What the database does not know, the page does not say

The most expensive rule on this project, learned from a returns sentence
printed under a four litre bottle of carpet cleaner.

- A margin with no landed cost is null, not optimistic
- A rate over zero views is null, not zero per cent
- Dispatch does not claim a day the record does not hold
- A confirmation omits the trader block when it is absent, and records that it
  did, rather than printing a placeholder
- A hedged right answer beats a confident wrong one

---

## A migration ships with the change to whatever reads it

Broken four times on this project and it will be broken a fifth unless it is
checked every time.

```
0036 added 24 columns          the page could not see them for two days
0040 added tenants.store       loadTenant did not select it, so the config
                               silently ran on defaults for a week
0041 added delivery zones      checkout ignored the zone the browser sent
0039 declared save_product     nothing fired it while the hearts worked
```

**And `create or replace view` cannot rename or reorder columns.** Adding one in
the middle reads as renaming everything after it. Drop first. This has now been
walked into twice, the second time by somebody who had written the comment
explaining it.

---

## Money and the law

**Terms are hers, not ours.** Returns wording, trading identity, complaints
policy. She is a lawyer, they are contract terms, and the studio does not draft
one. We flag, we render, she signs off.

**Trader identity is required on every order confirmation.** Regulation 16 of
the Consumer Contracts Regulations, Schedule 2 items b and c. Until it is
filled in, every confirmation goes out short, and the send log records which
ones did.

**Margin is against the selling price.** Never against cost. Only one of the
two appears anywhere on this platform, because the pair get confused
constantly.

**No struck through was price.** `compare_at` stays unused until there is a
companion field proving the higher price was actually charged, per the Digital
Markets, Competition and Consumers Act 2024. An offer in a thread is a
different thing and is lawful: a price she chose to give one person.

**No invented ratings.** The schema markup already refuses to emit an aggregate
rating with nothing behind it. It stays that way until there are real reviews
from verified purchases.

**Refunds happen in Stripe.** A button that only changes a status is a lie
about money.

---

## Privacy, and the banner we are not building

The analytics store nothing on the visitor's device. The session id is a module
variable that dies on reload. That is deliberate: under PECR any non essential
storage needs consent, and a banner would cost more than the numbers are worth
on a shop this size.

**The wishlist id is the one persistent identifier and it is for the wishlist
alone.** A stored id is exempt when it delivers something the person explicitly
asked for, which saving an item is. The moment the same id also tags browsing,
it stops being strictly necessary and the shop needs a banner.

```
wishlist id        persistent, localStorage, wishlist only
analytics session  module variable, dies on reload, never persisted
```

**`store_events` never sees the wishlist id.** One line to get wrong and a
compliance change to undo.

**Identity is captured when it buys the customer something.** A save costs
nothing. "Tell me when it is back" costs an email, and that is a trade the
customer makes knowingly.

---

## Architecture

**Guest checkout, no accounts, anywhere in the buying path.** A thread is
reached the way an order is: an email and a token, compared in constant time,
same 404 for a wrong token as for one that never existed.

**Prices are never trusted from the browser.** The checkout reads every figure
from the database. An offer is read from the offer record, not from a payload.

**The Supabase dashboard editor deploys one folder.** No `_shared` imports.
Duplication across functions is deliberate and there is a comment saying so in
each one. This cost a turn once already.

**Statutory wording lives in one place.** The webhook calls `notify` rather
than holding a second copy of the confirmation, because two copies of a legal
paragraph is two paragraphs that disagree within a month.

**Sales from other channels do not go in `orders`.** That table is a distance
selling contract record with a token, an address and policies written round
both. eBay sales go in `channel_sales`.

**Overselling is reported, not prevented.** Stock comes off on payment, not on
session creation, because reserving at checkout lets an abandoned basket hold
her last item for an hour. Two people can both pay for the last one, and her
alert names it.

**Every policy scopes on `has_tenant(tenant_id)`.** Not `using (true)`. The
mechanism is in migration 0001 and I missed it once already.

---

## The shop

**Breadth is the feature.** A general store that is not embarrassed about it.
Designing it as a boutique is a lie that collapses at the Jeyes Fluid.

**Terracotta means one thing:** the action that moves a buyer forward. Never
decoration, never a heading.

**Numbers are the display face in the portal and recede in the shop.** A mono
price reads as a database field.

**No portal furniture in the shop and no shop furniture in the portal.** No
verdict bars on a product page, no card grids in the portal.

**Never:** countdown timers, fake stock counts, "43 people are viewing this",
exit intent overlays, a chat bubble, trust badge clusters, an account wall.
They convert once and cost the second visit, and she is selling to a community
where the second visit is the whole business.

**No live chat widget.** Messages arrive by email and are answered whenever,
which is honest for a shop run between other work.

**No automated replies.** A shop this size is trusted because a person answers.

---

## Notifications

**Email always. WhatsApp when Meta verification lands. No SMS.**

A business initiated WhatsApp message needs the Business Platform API, a
verified Meta business, a registered number and a pre approved template per
alert type. One to two weeks, and not ours to hurry. `wa.me` only opens a chat
from the customer's side and cannot push anything.

So the notification layer is built channel agnostic from the start, and the
Meta application runs in parallel with everything else.

---

## The model

**Sonnet 5 for anything a customer or she reads.** Descriptions, titles, draft
replies. Not Haiku, and the reason is that cost is not the deciding factor:
across all 78 products the gap is about fourteen pence once, seven batched.
At that spread the only question is which writes better English, and this is
her shop voice on a lawyer's storefront.

`claude-sonnet-5`, $2 in and $10 out per million tokens. Batch API halves both
and every one of these jobs is a batch.

Haiku earns its place on high volume mechanical work if any appears.

**Images in, with a rule.** Initially argued against on the grounds that 300
pixel feed shots invite invention. That was too cautious. At that size colour,
form and how many things are in the shot are all plainly visible, and the
stronger argument is that **the image catches errors the fields cannot**: a
title saying five piece over a photograph showing three pans and two lids, a
brand field reading Unbranded over a box with Vax printed on it. Her catalogue
is a bulk lister's data that nobody has checked, and only vision finds that.

An 800 by 800 image is around 850 tokens, so all 78 add roughly thirteen pence.

```
may     describe what is plainly visible
may not infer material, dimensions or quality from a photograph
must    flag where the photograph and the fields disagree, rather than
        quietly picking one
```

**And the standing rule for anything generated:** it may only use what it is
given. No invented dimensions, no invented materials, no safety claims, no
returns claims, no superlatives about quality nobody has verified. If the
specifications do not carry the capacity, the description does not mention the
capacity.

---

## Working

**Ask for the current file before overwriting it.** Every drop names its paths
and marks each new or overwrite.

**Render it before handing it over.** Not "this should work".

**Verify a rule against the real rows before shipping it.** Run it over the
data and show the counts.

**A check that can produce a false positive will.** This has happened five
times in two days: selectors by index in a growing component, an assertion
against a state a previous check had already changed, a regex reading two
adjacent elements as prose, and a silenced build making a stale bundle pass.
When a check fails, work out whether the code or the check is wrong before
touching either.

**Push back once, then move.** And own a mistake in one line rather than a
paragraph.

**No em dashes, British and Nigerian English, contractions in client messages
and never in formal deliverables.** Comments explain why, not what.

---

## What is deliberately not built

Named so nobody adds them back thinking they were forgotten.

```
SMS                       costs per message, nobody here prefers it
a live chat widget        needs her at a screen
automated replies         the person answering is the product
wishlist threads          a basket thread and "ask about this" cover it
a refund button           money moves in Stripe
customer accounts         no account between a buyer and a payment
a struck through price    see above
packing slips             after ten orders have shown what she writes on a box
```
