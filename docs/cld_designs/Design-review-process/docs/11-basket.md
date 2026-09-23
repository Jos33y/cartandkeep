# 11 — Basket

---

## Verdict

The basket is clean and correct. Along with the quick view, it is one of only two components in the build that does not need rethinking.

Three things hold it back, and all three are inherited rather than local:

- Product thumbnails at 48px are the same inconsistent supplier assets, and at that size they are unreadable. A basket line where you cannot recognise the object is a basket line people delete.
- No motion. Adding, removing and changing quantity all happen instantly and silently, which is the least reassuring possible behaviour at the exact moment reassurance matters.
- The free-delivery threshold is stated but not worked out. It is presented as a fact rather than as live arithmetic.

---

## The job

Two jobs, and they are in tension.

1. **Reassure.** Show that the right things are in the basket, at the right prices, arriving at the right time.
2. **Increase the basket honestly.** Not through pressure. Through arithmetic the shopper would want to know.

The tension is that every element serving job two is a distraction from job one. The resolution is the delivery threshold, which is the only device that serves both: it reassures about the total *and* raises it.

---

## Two surfaces

**The drawer** for adding. Slides from the right on desktop, from the bottom on mobile. Opens on add, closes on Escape, backdrop click, or an explicit control. Never navigates away from what the shopper was doing.

**The page** for reviewing. Reached from the header, before checkout. More room, editable quantities, delivery detail, and the route to pay.

Do not build one and route both to it. The drawer that persists after adding is an interruption. The page that opens on every add destroys the shopping flow.

---

## Anatomy

### Line item

- **Thumbnail at 72px minimum**, on group wash, recanvassed. Not 48. Not the raw supplier asset.
- Written title, two lines maximum
- Leaf category in group colour
- Quantity stepper, 44px targets, with a Remove at zero
- Line price, tabular, right-aligned
- Per-item delivery note only where it differs from the order

### Summary

Ruled, not carded. Monospace tabular figures, right-aligned, in a print table.

```
Subtotal                    £58.65
Delivery                     £0.00
                          ────────
Total                       £58.65
```

**Every number stated.** Never "Delivery calculated at checkout". That is the single largest cause of basket abandonment in every study ever run on the subject, and for a shop with one flat rate and one threshold there is no excuse for it.

### The delivery threshold

The shop's only persuasion device, and the one its own About page permits.

A bar that fills toward £40, with the gap stated plainly: "£21.35 to go for free delivery." When it crosses, the fill completes, the colour steps to sage, and the label becomes a plain sentence: "Delivery is free on this order."

No confetti. No "You saved £4.95!". The shopper knows.

Below the bar, and only when the gap is under about £15, **three suggestions that would close it**, priced. Not a carousel. Three products, from departments already in the basket, each within the remaining gap. This is the single highest-value merchandising surface in the shop and it is honest, because it is solving a problem the shopper already has.

### Continue

Two controls, with real hierarchy. One primary, "Checkout". One quiet, "Keep shopping". The current Contact page has three equal rust primaries in a stack, which is the failure mode to avoid.

---

## Craft

- **Summary as a ruled print table.** Hairline rules, tabular figures, no card container, no zebra striping.
- **The threshold bar gets the drawn mark** from [03](03-iconography-and-svg.md). A filling vessel or a stacking crate. This is the one place in the shop that earns a piece of character animation.
- **Line thumbnails on group wash**, so the basket is department-coded and a mixed basket visibly shows the breadth of the shop.
- **Empty state** uses a department mark at scale with a halftone field, not a sad trolley.

---

## Motion

The basket is where optimistic interaction pays for itself most visibly.

- **Add**: the ghost image arcs from the card or PDP, scales into the basket mark, the count increments before the request returns, the drawer slides on `--dur-large` with `--ease-spring`.
- **Quantity change**: the line price rolls with tabular figures, the subtotal rolls, the threshold bar fills. All on `--dur-settle`, all simultaneously, because they are one fact changing.
- **Remove**: the line collapses on `--ease-exit`, siblings FLIP up, totals roll down. An Undo appears for eight seconds. **Never a confirmation dialogue for removing a basket line.** Undo is faster, kinder and more respectful than a modal asking whether they meant it.
- **Threshold crossed**: the bar completes, the colour steps to sage on `--dur-settle`, the label cross-fades. One moment, no celebration.
- **Failure**: the optimistic change reverts on `--ease-exit` and a plain sentence explains what happened. Never a toast that disappears before it is read.

---

## Copy

**Empty**: "Nothing in the basket yet. The shop is through here." Then the six group links. An empty basket is a navigation opportunity, not an apology.

**Threshold, below**: "£21.35 to go for free delivery."
**Threshold, met**: "Delivery is free on this order."

**Removal undo**: "Removed the saucepan set. Undo."

**Stock change while in basket**: "There are only 3 of these left, so we have reduced your quantity. Nothing has been charged."

**Never**: "Your cart is empty!" with an exclamation mark. "Oops!". "Looks like you have not added anything yet."

---

## Mobile

- Drawer is a bottom sheet at 92% height with a drag handle.
- The threshold bar is persistent above the tab bar on every page once the basket is non-empty. It is the most valuable fixed element on mobile.
- Quantity steppers at 44px minimum with real spacing between minus and plus. This is the most commonly mis-tapped control in mobile commerce.
- Checkout is a full-width primary, fixed at the bottom, with the total stated on it.

---

## Recovery

Not strictly design, but it sits here because it is where the money is.

- Basket persists in local storage with no account. It survives a refresh, a tab close and a return the next day.
- On return, an unobtrusive line: "You left three things in your basket." Never a modal, never on the first paint.
- Email recovery only where an address was given in a previous order or explicitly entered. Do not harvest.

---

## Measure

- **Basket abandonment rate**, split by whether the delivery threshold had been crossed. This will show, in numbers, whether the bar is working.
- **Average basket value against the £40 threshold.** Cluster just above it means the mechanic is doing its job. Cluster just below means the suggestions are wrong.
- **Suggestion click rate** in the threshold section. This is measurable, isolatable merchandising value.
- **Quantity edit rate** in the basket. High rates mean the PDP is not communicating pack sizes.
- **Removal rate by product.** A product removed disproportionately often has a title, image or price problem upstream.

## Study

- Baymard on cart usability. Their work on visible delivery cost is the most commercially important research in ecommerce, and it says the same thing every time.
- Amazon's basket for delivery threshold mechanics. Crude, effective, and the model everyone else copied.
- Stripe's Elements documentation for how a summary should present numbers.
- GOV.UK Design System on error and confirmation patterns. Their "undo rather than confirm" thinking is directly applicable.
- Nielsen Norman Group on shopping cart design.
