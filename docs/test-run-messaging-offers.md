# Messaging and offers, the test run

Written to be worked through in order. Everything in part one runs today with
no Stripe key. Part two needs the key and nothing else.

Use a real email address you can open. Two if you have them, so the shop's copy
and the customer's copy can sit side by side.

---

## Before anything

```sql
-- Deploy order, if any of this is still outstanding.
-- 0067 to 0071, then notify, thread, checkout, stripe-webhook, then the front end.

-- The fixture orders stay until launch. But the cleanup has changed: threads
-- now restrict an order delete, so this is the order it has to run in.
-- Do not run this yet. It is here so it is not looked up in a hurry later.
--
-- delete from store_threads where order_id in (
--   select id from orders where reference like 'CK-TEST-%' or reference like 'CK-SAMPLE-%'
-- );
-- delete from store_reviews where order_item_id in (...);
-- delete from orders where reference like 'CK-SAMPLE-%';
-- delete from orders where reference like 'CK-TEST-%';
```

**The portal still loads.** 0071 changed how every view resolves, so open
Dashboard, Products, Orders, Reviews, Customers, Requests, Mailing list and
Being found once each. A view that lost a grant fails as an empty screen or a
permission error, not as a leak, so it shows immediately.

**The low stock email.** This path has never sent. It threw on every run before
today.

```sql
select send_low_stock();
```

Expect an email listing whatever is currently below the line, or nothing at all
if nothing is. Check the function logs either way, because a silent success and
a silent nothing look the same from outside.

---

## Part one, no Stripe needed

### 1. Ask about a product

On any live product, below the terms list. Write the question over three short
paragraphs with a blank line between them.

```
her email      subject names the product, the question keeps its paragraphs
their email    "We have your question", carries the link, no price in it
the page       confirms in place, does not navigate, offers the link
the portal     Messages shows 1 waiting, and the nav badge shows 1
```

The paragraph check is the point of writing it that way. Both the write path and
the template used to flatten it.

### 2. Ask again about the same product, same address

One conversation, not two. The second question arrives under the first.

**No second acknowledgement email.** That only goes on the first message in a
thread.

### 3. Ask from the basket

Put three things in, at least one with a variant, then ask from the bottom of
the basket page.

```
her email      "Question about a basket of N things, £X", with the lines listed
the portal     the row reads "Basket, N things, £X", and opening it shows the
               lines with the frozen note under them
```

Then change the basket and reopen the conversation. The snapshot must not move.

### 4. Answer it

From the portal, in place.

```
their email    carries the reply and a link back
the portal     Waiting drops to 0, the nav badge disappears
the row        reads "You: ..." as the last message
```

Write back as the customer from the thread page. It goes back to waiting.

### 5. Quote a price

Answer a basket conversation with **Attach a price**. Try 3 days first.

```
their email    one figure only, the agreed price. No basket total in the
               subject, no former price anywhere
the thread     the offer card, the day it runs to, "Take this price"
the portal     the standing price above the reply box, with Take it back
```

Then quote again at a different figure without withdrawing. The first is
replaced rather than doubled.

### 6. A price on a product conversation

Same control, with a quantity field, because there is no snapshot to price.

### 7. Take the price, up to the point of paying

Follow "Take this price". The checkout page should read the agreement and show:

```
the lines      from the offer, not from the basket
the figure     labelled Agreed price, with the sentence saying where it came from
the basket     untouched. Open it in another tab and check
```

Do not press Pay. Everything above this line is the part that does not need a
key.

### 8. A price that has gone

```sql
-- Expire it by hand rather than waiting three days.
update store_offers set expires_at = now() - interval '1 minute'
where status = 'open';
```

Reload the checkout link. It should say the price has gone and point back at
the shop, and the offer card should disappear from the conversation.

Then withdraw one from the portal and check the same two places.

### 9. The median

Answer five conversations. Below five the figure is absent by design.

```sql
select answered, median_seconds, round(median_seconds / 3600.0, 1) as hours
from store_reply_time;
```

It should appear on the Messages screen once `answered` reaches 5, with the
count printed beside it. It should not appear anywhere on the storefront.

---

## Part two, once the Stripe key is in

### 10. A plain order with a variant

This is the one that has never worked. Buy two sizes of one product in a single
order.

```sql
select oi.title, oi.variant_label, oi.qty, oi.unit_price, oi.line_total
from order_items oi join orders o on o.id = oi.order_id
where o.reference = 'CK-...';
```

```
two lines, not one merged line
variant_label populated on both
unit_price is the variant's price where the variant has one
```

Then check the stock came off the variant rather than the product.

### 11. Take a price properly

Quote, take it, pay.

```sql
select o.reference, o.subtotal, o.delivery, o.total, o.from_thread_id,
       f.status, f.price, f.order_id, f.accepted_at
from orders o
join store_offers f on f.order_id = o.id
where o.reference = 'CK-...';
```

```
subtotal equals the quoted price exactly
the order line totals add up to the subtotal to the penny
from_thread_id points at the conversation
the offer reads accepted, with the order and a time on it
```

Then reload the conversation. The offer card is gone, because it has been used.

### 12. The offer cannot be used twice

Open the same "Take this price" link again after paying. It should say the
price has gone. The view refuses it before the checkout ever runs.

### 13. An abandoned checkout does not spend it

Take a price, reach Stripe, close the tab. The offer must still be live and the
card must still be in the conversation.

---

## What to write down

For anything that fails, the useful record is the same three lines every time:
what was on the screen, what was in the row, and what the function log said.
Two of those three usually disagree, and which two is the whole diagnosis.
