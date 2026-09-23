# 10 — Quick View

---

## Verdict

The quick-view modal is the **strongest component in the entire build**. Real hierarchy, the delivery estimate placed correctly, a sensible information order. It is the one place where somebody clearly thought about what a shopper needs at that moment.

Two defects, both mechanical:

- The title truncates to "Pamp"
- The thumbnail rail is cut mid-thumbnail

Neither is a design failure. Both are container sizing.

---

## The job

Let someone check a product without losing their place in the grid.

That is the entire value proposition, and it is worth stating because quick view is frequently built for the wrong reason. It is not a faster PDP. It is a **grid-preservation device**. Everything about it should serve staying on the list.

The corollary: **if a quick view has to be scrolled, it has failed.** A shopper who needs more should be going to the PDP, and the quick view should make that easy rather than trying to be one.

---

## When not to use one

Worth being direct, because quick view is often the wrong answer.

- **Never on mobile.** There is no grid position to preserve on a 375px screen, and a modal that fills the viewport is just a worse PDP with no URL. On touch, the card goes straight to the PDP with a view transition. The transition is what makes the return feel free.
- **Never as the only route to a product.** The card must still link to a real, shareable, indexable URL.
- **Never for a product whose decision needs the full spec.** A drill bit set with fourteen relevant attributes is a PDP product.

---

## Anatomy

Fixed size, roughly 880 × 560. It does not grow with content, because a modal that resizes per product is disorienting in a grid.

Two columns, 45/55.

**Left: image.** 1:1, on group wash, product at 82% inset. A thumbnail rail beneath, maximum five, and it must fit. If a product has more images, the rail shows four and a "+3 more" that goes to the PDP.

**Right: the decision.**

1. Leaf category, in group colour
2. **Written title, two lines maximum, never truncated.** If the title does not fit in two lines at 22px, the title is too long, and that is a content problem to fix at source rather than a container to widen.
3. Price, 22px, stamp
4. Three key facts. Three, not six. The full strip belongs on the PDP.
5. Delivery estimate, specific
6. Quantity and Add to basket
7. **"See full details" as a clear secondary route to the PDP**

Group colour tab across the top edge, so the modal is department-coded like the card it came from.

### The rules

- **Fixed height. No scrolling. Ever.** If content does not fit, content gets cut, not the container extended.
- **Close on Escape, on backdrop click, and on an explicit control.** All three.
- **Focus trapped**, returned to the originating card on close. This is the accessibility failure most quick views ship with.
- **Does not change the URL**, but does push a history entry so the back gesture closes it. On mobile this matters enormously, and it is another reason quick view should simply not exist there.
- **Arrow keys move to the previous and next product in the grid** without closing. This turns quick view from a lookup into a genuine comparison tool, and almost nobody builds it.

---

## Craft

- The backdrop is **ink at 40%**, not a blur. Blur is expensive, it is a 2020 trope, and it fights the print language.
- **Registration offset** in group colour behind the modal, 3px. Depth without a heavy shadow.
- **Elevation 4.** The only surface in the shop at that level besides the basket drawer.
- The image frame carries the **halftone field** so an awkwardly proportioned product still fills its space.

---

## Motion

- **Opens from the card**, not from the centre of the screen. The card's image scales and translates into the modal position on `--dur-large` with `--ease-spring`. This is a shared-element transition and it is what makes the component feel expensive.
- **Backdrop fades** on `--dur-settle`, slightly behind the modal so the modal leads.
- **Closes on `--ease-exit`** at 60% of the entrance duration, returning to the originating card position.
- **Arrow navigation** cross-fades the content while the container holds still. The container never resizes between products.
- **Add to basket** runs the same optimistic animation as everywhere else, and the modal stays open. Closing it would lose the grid position, which is the one thing this component exists to protect.

Under reduced motion, the modal fades in place at 120ms with no shared element.

---

## Copy

**"See full details"**, not "View product" or "Learn more". It names what is on the other side.

**The three key facts** are labelled values, not prose.

**Delivery estimate** identical in wording to the PDP and the basket. A different phrasing for the same fact in three places is how a shop starts feeling untrustworthy.

---

## Measure

- **Quick view open rate** on desktop. Under 10% means it is not discoverable, which usually means it only appears on hover with no other affordance.
- **Add to basket rate from quick view versus PDP.** Quick view typically converts lower, which is fine. It is a filter, not a closer.
- **"See full details" click rate.** High means the quick view is under-informed. Very low means it is doing its job.
- **Arrow navigation usage.** If people use it, build more of it. If not, the component is being treated as a lookup rather than a comparison tool.
- **Close-without-action rate.** This is healthy. It means people are eliminating options quickly, which is exactly what a PLP is for.

## Study

- Baymard on quick view. Their finding is worth internalising: quick views frequently *harm* usability when they are treated as miniature PDPs, and help when they are treated as elimination aids.
- ASOS and Zalando for the desktop grid-preservation pattern.
- Radix UI Dialog and Base UI for the focus, escape and scroll-lock behaviour. Do not hand-roll modal accessibility, it is a solved problem and hand-rolled versions are almost always broken.
- WAI-ARIA Authoring Practices, dialog pattern.
- Emil Kowalski on shared-element modal transitions, which is the specific technique that makes this component feel considered.
