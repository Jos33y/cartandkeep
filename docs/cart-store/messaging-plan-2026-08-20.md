# Talking to customers

20 August 2026. The plan for messaging, and for the reviews that sit on the
other side of the same problem.

Written because this is the one thing on the build list that is not catching up
with somebody else's admin panel. Everything else on that list exists in every
Shopify theme. This does not, and it is the reason eBay and Alibaba still work.

---

## The argument, stated once

Her buyers are a diaspora community who already buy through WhatsApp, and the
reason they do is that they can ask before they commit. A supplier photograph
at 300 pixels on a shop nobody has heard of is a trust problem, and no amount
of layout fixes it. A seller who answers does.

Every competing shop at this size has a contact form, which is a way of
receiving an email a day later about a product nobody can identify. That is
not the same thing and it does not convert.

**The single job:** somebody looking at a lamp at nine in the evening can ask
whether it is the wide one, get an answer, and buy it. Without an account,
without leaving the page, and without her having to work out what they meant.

---

## The four decisions

### 1. A thread belongs to a thing, not to a person

This is the whole design. A thread is about a product, an order, or a basket,
and it carries what it is about with it.

```
product   "is this the wide one"          she sees the lamp
order     "where is it"                   she sees the order, the address,
                                          the tracking
basket    "can you do both for £70"       she sees the four things in it
```

A general inbox is what everybody else built and it is worse. It makes her
reconstruct what somebody is talking about on every message, which is the exact
work the software should be doing.

### 2. No accounts, using the mechanism that already works

There is no sign in anywhere in this shop and there is not going to be. A
thread is reached the same way an order already is: an email address and a
token in a link, compared in constant time, same 404 for a wrong token as for a
thread that never existed.

That mechanism is built, deployed and already survives the round trip to
Stripe. Reusing it costs nothing and adds no new way to be wrong.

### 3. Email now, WhatsApp as a link, no SMS

Email is the channel that always works and it is already built: `notify` sends,
logs and can resend.

WhatsApp Business API needs Meta verification and template approval for
anything sent after a 24 hour window. That is weeks, and it is not now. But
`wa.me` opens a customer's own WhatsApp straight into a chat with her, works
today, costs nothing, and is what her community actually does. So the thread
carries a WhatsApp handoff button rather than a WhatsApp integration.

SMS is out. It costs money per message, it needs a number, and nobody in this
community prefers it to WhatsApp.

**Two honest channels beats one half-built one.**

### 4. She has to answer, and the software has to make that impossible to avoid

A chat nobody replies to is worse than no chat, because a slow reply is a
visible one and a missing reply is a decision the customer can see.

```
unanswered count      in the portal navigation, always
an email to her       the moment a message lands, through notify
how fast she replies  computed from her actual median, not promised. "Usually
                      replies within two hours" is a fact when it is measured
                      and a lie when it is typed into a settings box
```

---

## The stages

Each one ships working. Nothing here depends on a later stage existing.

### Stage one, the working chat

Two tables. `threads` with a subject reference, an email, a token and a last
message time. `messages` with a body, who sent it, and whether it has been
read.

```
storefront   an ask button on a product page and on an order page,
             the thread itself at a tokened URL
portal       a Messages screen, threads by most recent, unanswered first
email        to her when a customer writes, to the customer when she replies,
             both through notify, both logged
```

Roughly a day and a half.

### Stage two, the basket thread

The strongest part and nearly free once stage one exists.

A thread opened from the basket carries a snapshot of what was in it. She opens
the message and sees the four things they are deciding on, so she can say the
lamp is back Thursday, or that she can do the pair for seventy.

A snapshot rather than a live basket, deliberately: the conversation is about
what they had when they asked, and a basket that changes underneath a
conversation makes both sides wrong.

Half a day.

### Stage three, the offer

**This is the part that makes it innovative rather than merely present.**

Alibaba's whole mechanism is that a conversation ends in a price. Right now
this shop can have the conversation and then has to send somebody back to a
fixed price, which is where the sale is lost.

```
she quotes         a price for the things in that basket, with an expiry
the customer sees  the offer in the thread, with one button
checkout honours   the quoted price, once, before it expires, for that basket
```

The rules matter. An offer is for one basket, expires, and can be used once.
The checkout reads the price from the offer rather than from the browser, which
is the same rule the checkout already follows for everything else.

**And a caution.** An offer is a price she chose to give one person, which is
lawful and ordinary. A struck through was price on the shop is a price claim
under the Digital Markets, Competition and Consumers Act 2024 and needs the
higher price to have actually been charged. These are different things and only
the first is being built.

A day.

### Stage four, replying from her own inbox

She answers the notification email and it lands in the thread. Inbound routing
to a function that matches the thread by a token in the reply address.

Real, and worth doing after the first ten conversations have shown whether she
answers from the portal or from her phone. Building it before that is guessing
at which one she uses.

---

## Reviews, the other half

Chat is trust before the purchase. Reviews are trust after it, and the store
design document names social proof under the buy button as one of six things
separating shops converting at 5 to 8 per cent from the 2.3 per cent average.
It is the only one of the six not built.

```
who can leave one    somebody with a paid order containing that product, and
                     nobody else. The order gives us that for free
when                 asked once, by email, a week after it was dispatched
what it shows        a rating and a sentence, with a verified mark
her reply            publicly, on the review, which is worth more than the
                     review on a shop this size
moderation           she can hide one, and cannot edit one
```

**No invented ratings.** The schema markup already refuses to emit an aggregate
rating without real reviews behind it, which is deliberate, and a shop showing
four and a half stars from nowhere is the exact thing this project is trying
not to look like.

Roughly a day, after stage one.

---

## What I would cut

**Wishlist threads.** Saved items live on the device and have no server record,
so there is nothing to attach a thread to. What replaces it is better anyway: a
saved item gains a "tell me when it is back" or "ask about this", and giving an
email for that is what creates the record. Identity gets captured when it buys
the customer something rather than as a toll on a heart.

**SMS.** Above.

**A live chat widget.** Presence, typing indicators, a bubble in the corner. It
is a different product, it needs her to be at a screen, and the store design
document already rules out the bubble. Messages that arrive by email and can be
answered whenever are more honest for a shop run between other work.

**Automated replies.** A shop this size is trusted because a person answers. An
auto reply is the fastest way to sound like everybody else.

---

## Where it goes in the order

```
1  shop dashboard        unchanged, it is the screen she opens
2  messaging stage one   the working chat
3  variants and stock    already wrong rather than absent
4  messaging stage two   basket threads
5  reviews
6  messaging stage three the offer
7  customers
8  subscribers           a form, a consent record and an unsubscribe
9  categories
```

Messaging moves above variants because a conversation is what turns the first
visitor into the first customer, and variants matter at the tenth. Subscribers
moves up because it is smaller than I said: an email typed into a box labelled
what it is, a record of when and from where, and a working unsubscribe on every
send. That is the whole compliance requirement.
