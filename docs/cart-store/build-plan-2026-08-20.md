# The build plan, agreed 20 August 2026

Everything settled in conversation on 20 August, written down so the decisions
survive the session that made them. Supersedes the ordering in
`portal-gaps-2026-08-20.md` and the ordering in `messaging-plan-2026-08-20.md`.
The reasoning in both of those still stands; only the sequence changed.

---

## The order

```
1  AI descriptions and titles     unblocks the shop, the feed and the SEO work
2  shop dashboard                 the screen she opens
3  messaging, stage one           the working chat
4  variants and stock per variant already wrong rather than absent
5  basket threads                 the snapshot
6  reviews
7  the offer                      the part that is not catching up with anybody
8  customers
9  subscribers
10 categories she controls
11 low stock, archive, export
```

Messaging sits above variants because a conversation is what turns the first
visitor into the first customer, and variants matter at the tenth.

---

## 1. AI descriptions and titles

**Why first.** Seventy eight empty descriptions block three separate things at
once: the shop looking finished, the Google Shopping feed, which will not list a
product without a description, and the SEO work. One feature unblocks all
three, and it is the largest piece of manual work left on the project.

**What it reads.** Everything already in the database from the enrichment run:
title, brand at 83 per cent, specifications at 100 per cent, condition at 99
per cent, category path, price. A cheap model is the right model here, because
the work is rewriting facts that already exist rather than knowing anything.

**Two rules, and they are the whole safety of it.**

**It drafts, she publishes.** Never written straight to the product. A
description shipped unread is the same fault as the returns sentence with
better grammar.

**It may only use what it is given.** No invented dimensions, no invented
materials, no safety claims, no returns claims, no superlatives about quality
nobody has verified. If the specifications do not carry the capacity, the
description does not mention the capacity.

**Titles too.** Her titles are supplier feed strings running past eighty
characters, which costs her in search and in how the shop reads. The slug
deliberately does not follow the title, so a retitle breaks no link that has
ever been shared.

---

## 2. Shop dashboard

Unchanged from the gaps document. Assembly rather than new machinery, and it is
the screen she opens. Everything on it already exists in the database.

Zero is a starting point rather than something to hide behind, per the pass
already made across Interest and Finance.

---

## 3. Messaging, stage one

The working chat. Threads against a product or an order, reached by an email
and a token the way an order already is. A Messages screen in the portal,
unanswered first. Email both ways through `notify`.

**The notification layer is built channel agnostic from the start**, which is
the change from the earlier plan. Email always on, and a channel that lights up
when WhatsApp verification lands rather than a rewrite when it does.

### WhatsApp, corrected

An alert from the shop to a customer is a business initiated message, and those
require the WhatsApp Business Platform API: a verified Meta business, a
registered number, and a pre approved template for each kind of alert. There is
no lighter version of this. `wa.me` only opens a chat from the customer's side
and cannot push anything.

```
code            about half a day, once verification exists
verification    one to two weeks with Meta, and not ours to hurry
```

So the application starts in parallel with everything else, because the waiting
is the long pole and nothing else waits on it.

**No SMS.** It costs per message, needs a number, and nobody in this community
prefers it to WhatsApp.

### AI in the thread, decided

**It drafts a reply and she sends it. It never answers as the shop.**

The whole proposition of this shop is that a real person answers, which is what
eBay has and a template does not. An AI answering as the shop and getting a
fact wrong is not an embarrassment, it is a statement about goods made by a
trader.

The draft has the product, the specifications, the order and the thread history,
so it can write "yes, the wide one, 45cm across the shade, it goes out
tomorrow" and she taps send. She keeps the two seconds of judgement and the
customer keeps a real person. All of the speed and none of the risk.

---

## 4. Variants and stock per variant

Unchanged. The only item on the list that is already wrong rather than absent:
"Size 5, 6 and 7" is three products inside one title on her shop today. Touches
the storefront, the basket, the checkout, the order record and the products
screen, which makes it the most expensive thing here to add later.

Two days, not one.

---

## 5, 6, 7. Basket threads, reviews, the offer

As specified in `messaging-plan-2026-08-20.md`. The offer is the part that is
not catching up with anybody else's admin panel: a conversation that ends in a
price, honoured once, before it expires, read by the checkout rather than from
the browser.

---

## The wishlist, changed

**Joseph's pattern, and it is better than what is built.**

A visitor id in `localStorage`, the list itself in the database, keyed by that
id. Clearing the browser clears the list, which is the behaviour anybody
expects. When they buy, the id is matched onto the email and the list becomes
theirs properly.

**One constraint that has to hold or it breaks something built on purpose.**

That id is for the wishlist and nothing else, and it must never be attached to
an event. A stored identifier is exempt from consent when it delivers something
the person explicitly asked for, which saving an item is. The moment the same id
also tags their browsing it stops being strictly necessary, and the shop needs a
cookie banner, which the analytics were designed from the ground up to avoid.

```
wishlist id       persistent, localStorage, wishlist only
analytics session module variable, dies on reload, never persisted
```

Those two never meet. `store_events` never sees the wishlist id.

**No wishlist thread.** With a basket thread and an "ask about this" on a saved
item, a thread on the list itself has nothing left to do.

**Sharing a wishlist** so other people can buy from it becomes possible the
moment the list is server side. Not now, and the shape does not block it.

**Identity is captured when it buys the customer something**, not as a toll on
a heart. A save costs nothing. "Tell me when it is back" costs an email, and
that is a fair trade the customer is making knowingly.

---

## Subscribers, resolved

Smaller than I first said.

An email typed into a box labelled what it is, a record of when and from where,
and a working unsubscribe on every send. That is the whole compliance
requirement, and the label doing its job is what makes it consent.

---

## What stays cut

**A live chat widget.** Presence, typing indicators, a bubble in the corner.
Different product, needs her at a screen, and the store design document already
rules out the bubble. Messages that arrive by email and are answered whenever
are more honest for a shop run between other work.

**Automated replies.** A shop this size is trusted because a person answers.

**SMS.** Above.

**A struck through was price.** `compare_at` stays unused until there is a
companion field proving the higher price was actually charged, per the Digital
Markets, Competition and Consumers Act 2024. An offer in a thread is a
different thing and is lawful: a price she chose to give one person.

---

## The two rules underneath all of it

**Zero is a starting point.** No hedging, no "not yet", no withheld totals. She
is not asking whether a number is statistically significant, she is asking
whether anything is happening. The only exception is the difference between
nobody came and we could not see, which are genuinely different facts.

**The AI drafts and she ships.** Descriptions, titles, replies. Every one of
them is a statement made by a trader about goods, and every one of them gets a
person between the model and the customer.
