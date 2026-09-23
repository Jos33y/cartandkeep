# Session summary, 24 to 25 August 2026

From a build plan with one item left to a build plan with none. Five
migrations, 0067 through 0071, one new edge function, four rewritten, and
around thirty front end files.

The reasoning is recorded where it is not obvious from the code. Where it is
obvious, it is not repeated.

---

## 1. Messaging, stage one

Build plan item 3, the largest single thing on the plan and the last one on it.

**A thread belongs to a thing.** Product, order or basket, and it carries what
it is about with it, so answering never means working out what somebody is
referring to. A general inbox is what every shop this size has and it is worse,
because it makes the person answering do the work the software should do.

**One secret per conversation, held as a constraint.** The four decisions in
the messaging plan said the token is the order token, and did not cover a
product thread, which has no order. That was the one gap in a document
otherwise closed.

```
order_id set      the order's token opens it, so nobody who already holds a
                  confirmation link is sent a second thing to lose
order_id null     the thread carries its own, generated the same way
check ((order_id is null) <> (access_token is null))
```

The constraint is what makes that a rule rather than a convention. The
alternative, a fresh token on every thread, is one resolver instead of two and
costs a second tokened link in an inbox that already holds one.

**No open action for an order thread.** Sending on an order with no thread
creates it, because the order token proved who they were before they typed.
The thread takes the address off the order, since that is where the answer has
to go whatever they write.

**Waiting is derived, never stored.** Three timestamps maintained by a trigger,
and a partial index carrying the same predicate for the navigation count. A
stored flag is a thing two code paths can disagree about.

**The reply time is measured and stays in the portal.** Median over answered
threads in the last sixty days, with the count behind it, so a page can refuse
to show a figure computed from two conversations. It does not go on the shop
front until she has seen a number she would defend. That is a change to the
fourth decision and it was raised rather than taken silently.

**Nobody is named.** An earlier draft signed replies with her name and the
copy said "she". The request page had already settled that: a shop that refers
to its own owner in the third person on a page a customer reads sounds like it
is run by somebody else. Everything is "we" and "a person" now, and
`store_messages.author_name` is snapshotted at send rather than joined at read,
so a reply still says who wrote it after they have gone.

**WhatsApp came out entirely.** The plan had a `wa.me` handoff button in the
thread. It is a push channel for alerts once the Business Platform is verified,
not a door out of a conversation, and a conversation that leaves the thread
leaves the record. `store_threads.channel` and `store_messages.sent_via` stay,
because the first message from anywhere else would otherwise arrive as an
untyped row nobody can count.

---

## 2. Basket threads

Item 5, and nearly free because 0067 put `basket` in the check constraint and
left the column out, on the grounds that a nullable jsonb is free to add and a
check is a drop and an add to widen.

**The browser sends ids and quantities and no prices.** The function reads
titles and figures from the catalogue itself. That matters more here than at
the checkout, because the offer is quoted against this snapshot, so a price the
customer supplied would be a price the customer set.

**Frozen on purpose.** The conversation is about what they had when they asked.
A basket that changes underneath it makes both sides wrong, and there is no
version of "which four things did you mean" that is not a worse conversation.

**Anything no longer sold is dropped rather than failing the ask.** They still
have a question about the rest, and a missing line is something she can see is
missing.

---

## 3. The offer

Item 7, and the only thing on the platform that is not catching up with
somebody else's admin panel.

**Attached to a reply, never sent alone.** A price with no sentence beside it
is a shop quoting without speaking. The offer row is written before the
message, because notify reads whatever offer is standing when it runs, and the
other order would email a reply mentioning a price the email does not carry.

**Three rules, all enforced by the database rather than remembered:**

```
one live per thread   a partial unique index. Quoting again withdraws the
                      first, which is what any negotiation does and what stops
                      a customer holding two numbers and choosing
used once             a unique index on order_id, plus a check that accepted
                      and order_id are true together
until it expires      not a status. The clock, compared by store_live_offers,
                      because a stored expiry needs a job and is wrong between
                      runs of it
```

**Spent on payment, never on starting a checkout.** Somebody who reaches Stripe
and closes the tab has not bought anything, and burning her price on that sends
them back to a conversation whose offer vanished with no explanation.

**The agreed price is charged to the penny.** She quotes one figure and the
order still has to itemise, or a return cannot be worked against a line. The
allocation runs in pence, proportionally, remainder a penny at a time to the
largest lines. Seven shapes tested, including a target above list price and
nine lines: every one lands exactly.

**Stripe shows one line.** Allocating £130 across three lines produces unit
prices like £43.33 that nobody agreed to, on the last page before paying. The
order itemises; the payment page shows the figure they accepted.

**Never a saving.** Not beside a higher price, not labelled, not announced. A
price claim needs the higher price to have actually been charged, and a price
given to one person in a conversation is a different thing in law. `compare_at`
is untouched.

**Extended past the plan's wording, once.** The plan said an offer is for one
basket. A product conversation is the more common one and the lines column
already carried it, so a product thread can be quoted at a quantity she picks.
Order threads get no control, because the money has already moved.

---

## 4. Every view on the platform read past row level security

Found while wiring the offers view into the thread function, and it was not
only the views written this week. All ten granted to a signed in role.

A view runs as its owner unless told otherwise, so the policy underneath is
checked against the migration role and passes every time. The tables were
correct. The views walked around them.

```
before   a session with has_tenant false read 6 threads and a live offer
         through the views, and 0 rows from the tables directly
after    the same session reads 0 through the views, and a member still
         reads all 6
```

Two reasons it was live rather than latent. Any authenticated session was
enough, not a member of the shop, only signed in. And the portal filters by
tenant in the browser, which was always a convenience and never the boundary.

`store_customers` is every address the shop has ever delivered to and
`store_mailing_list` is a consent record, so those two mattered more than
anything in messaging. 0071 is ten `alter view` lines and no definitions
rewritten.

---

## 5. The receipt and the packing slip

Not on any plan, and asked for mid session.

**A live document, not a snapshot of the moment of payment.** Same URL, same
token, and it reads the order as it stands. That is the argument for a page
over an emailed PDF: it says dispatched next week and refunded if a refund goes
through.

**Payment and fulfilment are separate facts.** A stamp for one, a line for the
other. A receipt that collapses them is the thing people email about.

**A refund does not rewrite the charge.** Lines and total stand, the refund
sits underneath. A receipt that quietly becomes zero is not a record of
anything.

**No delivered state, because the schema has none.** Confirmed, Dispatched,
Refunded or Cancelled. A receipt claiming delivered on a courier's word, when
nothing on the shop recorded it, is one that is wrong in front of somebody
holding an undelivered parcel.

**Colour twice and nowhere else**, at his instruction: three on the payment
stamp, one word on the status line, all existing tokens.

**One component, two copies.** A slip that disagrees with the receipt in the
box is how a dispute starts. The slip drops the money and the returns terms,
because a price left in a parcel is a price shown to whoever was given the
gift.

---

## 6. The Stripe simulator

Because everything downstream of a payment was untestable while the key was
outstanding, and those are the parts nobody can fix in a hurry on a launch
morning.

**It cannot survive the key arriving.** `!STRIPE_KEY && CHECKOUT_SIMULATE ===
'on'`, identical in both functions. The first condition shuts it permanently,
so there is no window where a shop can both take money and simulate it.

**It replays through the real webhook rather than a copy.** A second
implementation of the paid handler would drift inside a week, at which point
the test proves the copy. The simulator posts an unsigned event with the
service key in a header, compared in constant time, and the browser never holds
that key.

**A decline moves nothing**, because that is what a decline does. A refund is
two events in order, which is the only route to a refunded receipt.

Both functions now build the Stripe client lazily. `new Stripe(undefined)`
throws at module scope, which is why `checkout` and `stripe-webhook` were
written and not deployed for a fortnight.

---

## 7. Four faults in code that was already live

None of these were in this session's work.

```
lowStock(items) against a function declared (items, cfg), reading cfg.domain.
  Every hourly run threw, returned 500, and the cron job never looked. That
  email had never once sent

CheckoutPage sent { id, qty } and never a variant id, while the checkout
  function has handled variants correctly since 0058. Two sizes merged into
  one line, were charged the product price, and took stock off the product

every view reading past RLS, above

PortalShell never mounted ScrollToTop, which StoreShell has had since it was
  built, so scrolling to the foot of one portal screen and opening another
  landed at the foot of the next
```

---

## 8. Comments

The house rule is one line, plain, only where the why is non-obvious. Six files
were between 32% and 48% comment lines and `notify` was 38% across 996 lines.

```
notify        996 to 748 lines, 38% to 14%, 29 block comments to none
thread        32% to 13%
useThreads    36% to 10%
four others   down to between 10% and 28%
```

Code identical once comments are stripped, checked both ways. The trim also
found an orphaned paragraph sitting over the wrong function in `useThreads`,
which only surfaced because a replacement asserted and failed.
