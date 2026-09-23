# 13 — Post-purchase

Confirmation, tracking, returns. The surfaces nobody designs and everybody uses.

---

## Verdict

Not reviewed, and almost certainly not designed. It rarely is.

This document is included because it is the largest unclaimed opportunity in the project. For a shop with no accounts, no loyalty scheme and no ad budget, **post-purchase is the entire retention strategy.**

The economics are not subtle. Acquiring a customer costs money. The order confirmation email has an open rate above 60%, higher than any marketing email will ever achieve. The tracking page gets visited three to five times per order. Those are the highest-attention surfaces the shop owns, and in most builds they are unstyled system defaults.

---

## The job

Three jobs, in sequence.

1. **Confirm.** Remove all doubt that the order happened and that money moved correctly.
2. **Inform.** Answer "where is it" without an email to Mrs Sowande.
3. **Return.** Bring them back, without a discount code.

The third is the commercial one and it is entirely dependent on the first two being good.

---

## Confirmation page

The moment of maximum goodwill in the entire relationship. Almost every shop wastes it on a receipt.

**Above the fold**
- Order reference, large, in monospace, selectable. `CK-4821`
- What was bought, with proper 72px thumbnails
- What it cost, itemised, ruled table
- **When it arrives**, specific and dated. "Arriving Tuesday 26 August"
- Where it is going

**Below**
- What happens next, in three plain steps
- How to track it, with the link and no account required
- How to change or cancel it, and by when
- How to return it
- The request prompt: "Something we should stock? Tell us."

**No discount code for the next order.** It trains people to wait for one and it devalues the price honesty the shop has built its positioning on.

**No newsletter signup as the primary action.** If there is a newsletter, it is a quiet line at the bottom.

**No social sharing.** Nobody shares a drain unblocker purchase, and asking makes the shop look like it does not know what it sells.

---

## Order tracking

No account. The reference and the email address, or a signed link from the confirmation email.

The page should answer "where is it" in the first screenful, and it should be honest when it does not know.

**States, with real copy:**

| State | Copy |
|---|---|
| Confirmed | "We have your order. It leaves us tomorrow." |
| Packed | "Packed and waiting for the courier." |
| Dispatched | "On its way. Royal Mail has it, tracking below." |
| Out for delivery | "Out for delivery today." |
| Delivered | "Delivered Tuesday at 11:20." |
| Delayed | "This is running late. It was due Tuesday and it has not moved since Monday. We are chasing it and we will email you today." |

The delayed state is the important one. Most shops hide a delay behind a generic "in transit". Stating it plainly, before the customer has to ask, is the single most trust-building thing a small shop can do, and it directly reduces support volume.

**Design it as a printed dispatch record**, not a horizontal progress tracker with a lorry sliding along it. Ruled rows, timestamps in monospace, group-coloured order lines. The print language does real work here.

---

## Returns

The shop gives 30 days where the law requires 14, and pays the return postage. That is genuinely generous and it is currently buried in prose.

**Make it a flow, not an email.**

1. Enter the order reference
2. Pick the items and a reason, optional
3. Get a label, immediately, as a PDF and as an email
4. See the refund timeline plainly stated

Reason codes matter more than they look. They are the highest-quality product data the shop will ever collect, and they feed directly back into [05 — Imagery Pipeline](05-imagery-pipeline.md) and [09 — PDP](09-pdp.md):

- "Not as described" means the title or spec is wrong
- "Wrong size" means the dimensions are missing
- "Looked different" means the image is wrong

Three returns against one product with the same reason is a data defect, not a customer problem.

---

## Transactional email

Part of the design surface, and almost always treated as an afterthought.

Five emails, all of which should carry the shop's design language:

1. Order confirmation
2. Dispatch, with tracking
3. Delivered
4. Return label
5. Refund issued

**Rules**

- Single column, 600px, table-based. Email clients are 2003 and no amount of wishing changes it.
- The shop's actual typefaces with a proper system fallback stack. Archivo will not load in Outlook and that is fine.
- **Department colour** on the order lines, so the email looks like the shop.
- Recanvassed thumbnails at 72px.
- **Everything important is in text, not in an image.** A large share of clients block images by default.
- Plain-text alternative that reads properly.
- Dark mode tested. `prefers-color-scheme` support in email is inconsistent, and a cream background can invert into something unpleasant.
- **No marketing in a transactional email.** It is a legal boundary as well as a design one.

---

## Craft

- **The order reference set as a printed stamp.** Monospace, ruled box, selectable. It is the object the customer will copy into an email, so make it easy to grab.
- **Dispatch record as a ruled table**, timestamps in monospace, one line per event.
- **The delivery mark from [03](03-iconography-and-svg.md)** carries the state, animated once on load.
- **Group colour on every order line**, so a mixed order visibly shows the breadth of the shop. This is quiet merchandising for a general store: it reminds people what else is here.

---

## Motion

- Confirmation: the order reference stamps in, once, on `--ease-spring`. One moment, no confetti.
- Tracking: the state mark draws on with `stroke-dashoffset`, once.
- Nothing else moves. These are pages people visit repeatedly, and animation that was charming the first time is irritating the fourth.

---

## Copy

**Confirmation head**: "Thank you. Order CK-4821 is confirmed."

**Delivery estimate**: "Arriving Tuesday 26 August." Not "3-5 business days".

**Delay**: name it, state what you are doing, give a time you will next make contact. Never "We apologise for any inconvenience".

**Returns**: "30 days to change your mind. We pay the return postage. No reason needed."

**Refund**: "Refunded £26.17 to the card ending 4242. It usually shows within three working days."

**Never**: "Your order is on its way!" with an exclamation mark. "Yay!". "We're so excited for you to receive your order."

---

## Measure

- **Tracking page visits per order.** Above five means the emails are not doing their job.
- **"Where is my order" support volume** as a percentage of orders. This is the direct measure of whether the tracking page works.
- **Repeat purchase rate at 30, 60 and 90 days.** The real post-purchase metric.
- **Return rate by reason code, by product, by department.** The most actionable data the shop produces.
- **Email open and click rates** on the five transactional emails. Confirmation should be above 60%.

## Study

- Baymard on post-purchase and order tracking.
- Really Good Emails (reallygoodemails.com) for transactional email design, filtered to receipts and shipping.
- Litmus and Email on Acid for client testing and the dark-mode problem.
- Shopify's order status page as a baseline of what customers now expect.
- Royal Mail and Evri tracking APIs for what data is actually available to display.
- Consumer Contracts Regulations 2013 and the Consumer Rights Act 2015 for what the returns flow must say. The shop's existing legal copy already handles this well and the flow should match it.
