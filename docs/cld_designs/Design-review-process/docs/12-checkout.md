# 12 — Checkout

---

## Verdict

Not reviewed. It was not in the material supplied, and it is the single most important surface in the shop.

Everything in this document is therefore direction rather than audit. It should be read as the standard to build against, and the checkout should be reviewed against it before launch.

One structural note from what *was* visible: the order-reference placeholder on the Contact page is dark enough to look prefilled, and the email placeholder is uppercase while nothing else is. Both are small, and both are exactly the class of defect that costs money at checkout.

---

## The job

Take the money without introducing a single new thought.

Checkout is the only surface in the shop where the design goal is **absence**. Everything in [02 — Craft & Material](02-craft-and-material.md) that earns attention on the way in must get out of the way here. Every device, every colour field, every piece of motion is a source of doubt at the point of payment.

The shop's promise, "no account, ever", is a genuine competitive advantage at checkout. Most of the industry's abandonment comes from forced registration. Cart & Keep has already made the right call and should build the checkout that proves it.

---

## Structure

**Single page, three sections, no steps.** Not a multi-step wizard. Not an accordion that collapses completed sections out of sight.

```
1. Delivery      where it goes, when it arrives
2. Payment       how it is paid
3. Review        what is being bought, what it costs
```

The order summary is sticky on desktop and a collapsible drawer at the top on mobile, showing the total collapsed and the full breakdown expanded.

### Rules

- **No account creation. No guest checkout toggle.** There is only one path, and the copy should say so: "No account needed. We do not create one."
- **Nothing is a step.** Progress indicators on a three-section form make it feel longer than it is.
- **The total is visible at every scroll position.** Sticky summary on desktop, sticky bar on mobile.
- **Delivery cost is stated before any field is filled.** It is already known from the basket.
- **No upsell, no cross-sell, no promotional band, no newsletter checkbox.** Checkout sells nothing.
- **One primary control on the page.** Pay.

---

## Forms

The single largest source of avoidable abandonment. Almost all of this is solved, documented and free to copy.

### Fields

- **Labels above inputs, always.** Never placeholder-as-label. It fails on autofill, on zoom, on translation, and for anyone who looks away mid-entry.
- **Placeholders show format, not instruction.** `AB1 2CD`, not "Enter your postcode".
- **Autocomplete attributes on every field.** `given-name`, `family-name`, `email`, `tel`, `postal-code`, `address-line1`, `cc-number`. This is a five-minute change that measurably increases completion.
- **Correct mobile keyboards.** `inputmode="numeric"` for postcodes and card numbers, `type="email"`, `type="tel"`.
- **Postcode lookup.** In the UK this is expected. Type a postcode, pick the address. It removes four fields and a large share of the delivery errors.
- **Field height 48px minimum**, 16px text. Anything under 16px triggers zoom on iOS, which is jarring and reads as broken.
- **Never split a phone number or a card number across multiple inputs.**

### Validation

- **On blur, not on keystroke.** Validating as someone types tells them they are wrong before they have finished being right.
- **Errors adjacent to the field**, in ink on a tinted field, with an icon. Never colour alone.
- **A summary at the top on submit failure**, linked to each field. This is the GOV.UK pattern and it is the best documented accessible error handling available.
- **Errors say what to do.** "Enter a postcode like AB1 2CD", not "Invalid postcode".
- **Never clear a field on error.** Particularly card fields.

---

## Payment

Stripe takes the payment and the shop never sees a card. That is already true and it should be stated plainly on the page, because it is reassuring and most shops bury it.

- **Payment Request API first.** Apple Pay and Google Pay above the card form. On mobile this converts substantially better than any card entry, and it is a one-line integration.
- **Card fields inline**, not in an iframe that looks foreign. Stripe Elements can be styled to the shop's tokens and should be.
- **Accepted cards shown as marks**, small, below the field.
- **No CVV explanation modal.** A short inline hint.

---

## Craft

The restrained end of the material language.

- **Rules only.** No colour fields, no halftone, no overprint, no department colour.
- **Neutral base**, cream, with the summary on the warm sunk tone.
- **Tabular figures throughout.** Every number in the summary aligns.
- **One accent**, terracotta, on the Pay control, and nowhere else on the page.
- **Elevation 0 or 1.** Nothing floats at checkout.

---

## Motion

Almost none, and that is the design.

- Field focus: border thickens on `--dur`.
- Validation: error message fades in on `--dur-settle`. The field does not shake. Shaking a field is an aggressive gesture at the worst possible moment.
- Pay control: on submit it becomes a determinate progress state, in place, same dimensions. It never disappears, never becomes a spinner on a blank page.
- Summary total: rolls on change with tabular figures.
- Section completion: a quiet ink tick. Nothing bounces.

**No page transitions. No stagger. No reveal animations.** Motion at the point of payment reads as instability, and instability at that moment reads as risk.

---

## Failure

The most under-designed surface in ecommerce, and it happens to a meaningful percentage of orders.

- **Declined card**: state it plainly, keep every other field intact, offer another method. "Your bank declined this card. Nothing has been charged. Try another card or use Apple Pay."
- **Network failure mid-payment**: the most frightening state a shopper can be in. The page must state clearly whether money moved. "We could not reach the payment provider. Nothing has been charged."
- **Item went out of stock during checkout**: adjust, state it, do not silently proceed. "There are only 2 of these left. We have adjusted your order and the total. Nothing has been charged."
- **Every failure message states the charge status.** Whether money moved is the only question the shopper actually has.

---

## Copy

Plainest register in the shop. Nothing clever.

**Section heads**: "Where it goes". "How you pay". "What you are buying".

**Reassurance line**: "No account needed. We do not create one."

**Pay control**: "Pay £58.65". State the amount on the button. This is a small, well-evidenced improvement.

**After pay**: "Thank you. Order CK-4821 is confirmed."

**Never**: "Complete your purchase", "Secure checkout" with a padlock icon (if it needs saying, something else is wrong), "Almost there!", or any progress encouragement.

---

## Mobile

- Summary collapsed at the top, total always visible.
- Payment Request buttons above everything.
- Single column, no side-by-side fields, not even first and last name.
- Sticky Pay control at the bottom with the total on it.
- Postcode lookup rather than manual address entry.
- Never a keyboard that covers the field being filled. Test this on a real device.

---

## Measure

- **Completion rate by section.** Where people leave is where the design is failing, and it is almost always delivery address.
- **Field-level error rate.** A field with a high error rate has a format or label problem.
- **Payment method distribution.** Low Apple Pay usage on iOS means it is not prominent enough.
- **Time to complete.** Under 90 seconds for a returning shopper with autofill is achievable.
- **Failure recovery rate.** Of the people who hit a declined card, how many complete on a second attempt? This number is entirely determined by the failure copy.

## Study

- Baymard's checkout research. Their public work on the 130+ checkout usability guidelines is the most valuable free resource in ecommerce, and their finding on visible delivery cost is worth more than any other single input in this document.
- GOV.UK Design System, form and error patterns. The best documented, most thoroughly tested accessible form guidance anywhere, and it is free.
- Stripe Elements and Payment Request API documentation.
- Ideal Postcodes or Loqate for UK address lookup.
- Nielsen Norman Group on form design.
- WCAG 2.2 success criteria 3.3.7 and 3.3.8, both new and both directly about reducing redundant entry at checkout.
