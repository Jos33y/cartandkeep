# Order emails, specification

18 August 2026. Written before building, because the confirmation is a legal
document and the last thing we wrote from instinct was the returns sentence.

Three emails. One of them is a statutory requirement rather than a courtesy,
and that changes both its content and where it sits in the order of work.

---

## 1. Why the confirmation is not optional

Regulation 16 of the Consumer Contracts (Information, Cancellation and
Additional Charges) Regulations 2013 requires the trader to give the consumer
confirmation of the contract on a durable medium, carrying the information in
Schedule 2, no later than the time the goods are delivered. Email counts. A
link to a web page does not, so the order page is not a substitute.

Four consequences that shape the design rather than just the wording.

**A missing cancellation paragraph costs a year.** If the information about the
right to cancel is not given, the cancellation period extends to 14 days from
the day it is eventually given, to a maximum of twelve months from when the
normal period would have ended.

**Silence about return postage means she pays it.** If the trader does not say
the consumer bears the cost of returning goods, the trader bears it.

**Silence also removes her right to deduct.** No deduction for goods handled
beyond what would be reasonable in a shop can be made if the cancellation
information was not provided.

**The burden of proof is on the trader.** In a dispute it is for her to show
the information was given. That makes the send log evidence rather than
bookkeeping, and it is why we store what was sent and when, not a boolean.

**The clock starts on arrival.** For goods, the 14 days run from the day after
the goods come into the consumer's physical possession, not from the order
date. The wording says "after it arrives", never "from today".

### What this means for the build

The cancellation section varies by product. Her catalogue carries three returns
classes, and where there is no cancellation right at all the trader must say
so. A pamper gift set with bath products in it and a five litre drum of white
vinegar cannot carry the same paragraph.

So the rights block is rendered from `returns_class` on the order lines, from
the same source the product page uses. One email with three possible shapes,
not one paragraph that is wrong for a third of the catalogue.

### Schedule 2 items that apply here

```
a  main characteristics of the goods        the line items
b  trading name                             GOLD BLOCK, hers
c  geographic address and email             GOLD BLOCK, hers
f  total price including tax                have it
g  delivery charges                         have it
j  payment and delivery arrangements        dispatch estimate
k  complaint handling policy, if any        one line, or omitted honestly
l  conditions, time limits, procedure        per returns class
m  who pays return postage                  must be stated or she pays
o  where there is no right to cancel         the sealed and consumable classes
p  goods must conform to the contract        one sentence
q  after sales guarantees, if any            omitted, none offered
x  alternative dispute resolution schemes    omitted, none joined
```

Items h, i, n, r, s, t, u, v and w do not apply to a shop selling physical
goods with no subscription and no digital content.

---

## 2. Where each email fires

```
paid,       to the buyer   stripe-webhook, on checkout.session.completed
paid,       to her         same moment, separate send, separate log row
dispatched, to the buyer   when she marks it gone in the portal
```

The first two belong in the webhook because it is the only thing that believes
a payment happened. The success URL is not proof of payment and never was.

The third cannot live there. The portal writes `dispatched_at` directly under
the 0042 column grants and no function is involved.

**That write is not moving into a function.** It works, it has been rendered,
and a column grant is a harder guarantee than a function is. Instead the portal
calls a small `notify` function after a successful write.

The failure mode is real and is handled by being visible: if the notify call
fails, the parcel is marked gone and nothing was sent. So the send log surfaces
on the order row. She sees "confirmation sent 18 Aug 14:02, dispatch email not
sent" with a resend button. A silent failure here is a customer who thinks they
have been ignored.

**Idempotency.** Stripe retries webhooks, and a retry that resends is a
customer receiving three receipts. Unique on `(order_id, kind)`, and a send is
skipped when a row already exists.

**Reply-to is `support@cartandkeep.com`**, not the sending address. A customer
replying to a notification address nobody reads is the oldest failure in
transactional email.

**Sending domain** is `relay.cartandkeep.com`, from `notify@relay.cartandkeep.com`.
Transactional mail on a subdomain keeps her support address clean if anything
is ever marked as spam.

---

## 3. The customer confirmation

The one that matters. Written three times.

### Subject

```
1  Order CK-4K7M-9QX2
2  Thanks for your order            deleted, any shop could send it
3  Order CK-4K7M-9QX2 is paid       shipped
```

The reference is what they search their inbox for in three weeks. "Is paid"
answers the only question they have in the first half second.

### The three

**A, the receipt.** Opens with the items and the total, no greeting. Precise
and cold. The problem is that this is a shop nobody has heard of and the buyer
has just handed it money on trust, so a receipt with no human in it does not
answer what they are actually feeling.

**B, the shopkeeper.** "Thanks, that is paid and it is on my list to pack."
Warm, and closest to the voice. Two problems: "thanks" is the opener every shop
uses, and the first line spends itself on us rather than on them.

**C, what happens next.** Opens with the state and the next event. Shipped.

The question after paying a shop you have never used is whether it worked and
when the thing comes. C answers both in one line before anything else.

**The structural decision matters more than the opener.** The top half is human
and short, then a rule, then the legal payload as a plain block under a heading
that says what it is. Trying to make Schedule 2 charming is how we got the
returns sentence. Separated, both halves get to be good.

### The copy

Square brackets are values from the database or from her. Nothing in brackets
ships as literal text.

```
Subject: Order [reference] is paid

Paid. We pack on weekday mornings, so this goes out [tomorrow] and should
reach [outcode] by [Thursday 21 August].

Order [reference]

[title]                              [qty]    [line total]
[title]                              [qty]    [line total]
Delivery                                      [delivery]
Total                                         [total]

Going to [name], [line1], [line2], [city], [postcode].
Reply to this email if any of that is wrong and we will fix it before it goes.

----

Your rights

You can cancel this order for any reason within 14 days of the day it
arrives, and you do not have to give a reason. Tell us by replying to this
email or writing to [address]. We refund everything you paid including the
standard delivery charge, within 14 days of the goods coming back to us.

Send the goods back within 14 days of telling us. You pay the return
postage. If an item comes back showing more handling than it would have had
in a shop, we may reduce the refund by the amount of value lost.

[if any line is returns_class = sealed]
[title] can be returned only while sealed. Once opened, the 14 day right
does not apply to it, on health and hygiene grounds.

[if any line is returns_class = none]
[title] cannot be returned once opened.

None of this affects your right to a refund, repair or replacement if
something arrives faulty or is not as described. That right is separate and
it does not expire in 14 days.

[trading name], [geographic address]. [Company number]. support@cartandkeep.com

A cancellation form, if you would rather use one: [url]/legal/returns
```

What is deliberately absent: no "we're thrilled", no exclamation marks, no
explanation of how generous the terms are, and no delivery promise beyond what
`deliveryFor` and the bank holiday calendar can actually compute.

---

## 4. The notification to her

She is asleep, or in court, or on a school run. The subject carries the whole
thing so she does not have to open it.

```
Subject: Sale: [total], [reference], [n] items to [outcode]

[title]  [qty]
[title]  [qty]

[name]
[line1]
[line2]
[city]
[postcode]

Open it: [portal url]/orders
```

Nothing else. No encouragement, no running total, no streak. This is an
operational alert and it is read in eight seconds.

---

## 5. The dispatch email

```
Subject: Order [reference] is on its way

It left today by [carrier].
[if tracking_number] Tracking: [tracking_number]
[if tracking_url] [tracking_url]

It should reach you by [date].

If it has not arrived by [date + 3 working days], reply to this email and we
will chase it.
```

No repeat of the rights block. They already have it, and a second copy trains
people to ignore both.

---

## 6. Files this becomes

```
supabase/migrations/0043_order_emails.sql       send log, unique on (order_id, kind)
supabase/functions/_mail/                        NOT THIS, see below
supabase/functions/stripe-webhook/index.ts       overwrite, sends two
supabase/functions/notify/index.ts               new, dispatch and resend
src/hooks/useOrders.js                           overwrite, calls notify, reads the log
src/components/ui/portal/OrderRow.jsx            overwrite, send status and resend
supabase/migrations/0044_funnel_purchases.sql    the funnel fix, see below
```

**No shared module.** The Supabase dashboard editor deploys one folder and
uploads nothing outside it, so `_shared` imports fail to resolve. That cost us
a turn on `cors.ts` already. The template code is duplicated across the two
functions on purpose, and there is a comment in both saying why.

---

## 7. The funnel fix, which rides along

`store_product_funnel.purchases` is always zero and always will be. The view
joins events to products on `e.product_id = p.id` and counts rows where the
event is `purchase`. The purchase event is fired with a reference and a total
and no `product_id`, so it never matches the join.

It is also fired from the confirmation page, which is the wrong moment for the
same reason the success URL is not proof of payment. A buyer who closes the tab
after paying is a sale with no event.

Both problems have one fix and it is order data rather than event data:
purchases per product come from `order_items` joined to `orders` where the
status is paid. That survives a closed tab and it cannot disagree with the
money.

Related and separate: `save_product` is in the events check constraint and is
fired by nobody, while the saving feature works. One line, and it belongs to
whoever next touches `useSaved`.

---

## 8. Blocked on her, and not a reason to wait

**Trading name, geographic address, company number.** Three of the twelve gold
blocks, and Schedule 2 items b and c. The email pulls them from the same source
the legal pages use, so it becomes compliant the day she fills them in rather
than needing a deploy. Until then it sends and it is incomplete, and the send
log shows exactly which orders went out short if that ever matters.

**Returns wording.** The rights block above is a draft for her to approve. She
is a lawyer, it is a contract term, and the studio does not draft one.

**`RESEND_API_KEY`** as a function secret, and `relay.cartandkeep.com` verified
in Resend with the SPF, DKIM and DMARC records it issues.

---

## 9. What is not in this piece of work

Named so nobody adds them back.

**A refund email.** Refunds happen in Stripe and Stripe emails the customer
itself. A second one from us saying the same thing is noise.

**An abandoned basket email.** No consent, no legitimate interest argument
worth making at this size, and it is the first step towards the shop that
nudges rather than the shop that charges properly.

**A review request.** Same reasoning, plus there is nowhere to leave one.

**Order status polling or a tracking page.** The carrier has one and it is
better than ours would be.
