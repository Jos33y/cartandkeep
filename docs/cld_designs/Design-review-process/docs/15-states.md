# 15 — States

Empty, loading, error, out of stock, offline. The screens that decide whether a shop feels finished.

---

## Verdict

Not designed. Which is normal, and which is exactly why they are worth doing properly.

The current build has no visible empty states, no skeletons, no error surfaces beyond browser defaults, and no out-of-stock treatment. The one state that *is* handled, "Only 5 left", is handled wrongly: shown uniformly on every product, in amber, which makes it read as fabricated and contradicts the shop's own promise.

A shop is judged on its unhappy paths more than its happy one. Anyone can design a full basket.

---

## The job

Every state answers three questions, in this order:

1. **What happened?**
2. **Whose fault is it?** Usually the shop's. Say so.
3. **What do I do now?**

A state that answers only the first is a dead end. Most default states answer only the first.

---

## Empty

Empty is not an apology. It is a navigation opportunity, and in a general store it is a merchandising one.

| Surface | Copy | Action |
|---|---|---|
| Basket | "Nothing in the basket yet. The shop is through here." | Six group links |
| Search | "Nothing matches *sellotape*. Try tape, or tell us to stock it." | Nearest matches, department index, pre-filled request |
| Facet result | "Nothing in Garden & Patio under £10. The cheapest is £17.32." | Remove the filter, or show the nearest |
| Department | "Four things in here so far, and more every Monday." | The request prompt, given real scale |
| Order lookup | "No order with that reference. Check the confirmation email, or email us." | Both routes |

**Rules**

- **Name the thing that is empty and why.** Never a generic "No results found".
- **Always offer the nearest real alternative.** A shopper who searched for something has told you what they want. Giving them nothing back is the most wasteful thing a shop can do.
- **The request prompt appears in every empty state.** For a shop growing from 78 to 1000 lines, "tell us what to stock" is a product feature, not a footer link.
- **Visual**: department mark at scale on a halftone field, in group colour. Never a sad face, never a cartoon, never an empty box illustration.

---

## Loading

**Skeletons, not spinners.** A spinner says "wait". A skeleton says "here is what is coming", and it reserves the space so nothing shifts when content lands.

**Rules**

- Skeletons match the real content dimensions exactly. A skeleton that is a different height than the thing it becomes causes layout shift, which is worse than no skeleton at all.
- **Printed blocks in the group wash, not shimmering grey bars.** The shimmer gradient is a 2020 trope and it contradicts the print language.
- Skeletons appear after 200ms, not immediately. Faster than that and they flash for content that was already there.
- **Never a full-page loading state after the first paint.** Sections load independently.
- **Optimistic first, loading second.** If the result can be predicted, show it and reconcile. The add-to-basket action should never show a loading state at all.
- Determinate progress wherever the length is known: image upload, PDF generation, payment processing.

---

## Error

Four classes, each with a different treatment.

### Inline, recoverable

A form field, a failed quantity change. Adjacent to the thing that failed, in ink on a tinted field, with an icon. Never colour alone, because roughly 8% of men cannot rely on it.

Copy says what to do: "Enter a postcode like AB1 2CD", not "Invalid postcode".

### Page-level, recoverable

A failed load, a timeout. The page structure stays, the content area explains and offers a retry. Never blank the whole page for a section failure.

"We could not load this department. Try again, or go back to the shop."

### Page-level, not recoverable

404 and 500.

**404** is a genuine opportunity in a general store. Somebody looked for something that is not there.

> "That page is not here. It might have moved, or the product might have sold out.
> Search 78 products, or tell us what you were looking for."

Search field, six group links, request prompt. Not a joke. Not a cartoon.

**500** states the shop's fault plainly. "Something broke on our side. We have been told. Try again in a minute."

### Payment failure

Its own class because it is the most frightening state in the shop. Covered in [12 — Checkout](12-checkout.md), and the rule bears repeating: **every payment failure message states whether money moved.** That is the only question the shopper has.

---

## Out of stock

Currently handled with a uniform "Only 5 left" on everything, which is the wrong end of the same problem.

**The corrected rules**

- **Under five**: show the count. "5 left". Not "Only 5 left". "Only" is persuasion and the About page ruled it out.
- **Five or more**: show nothing. This is what makes the badge mean something when it appears.
- **Zero**: the product stays visible and browsable, price shown, Add to basket replaced by "Tell me when it is back". Never delete the page. It has search equity, inbound links and a customer who wants it.
- **Out of stock in facets**: "In stock" is a filter, default on, with a count. Never silently hide unavailable items.
- **Stock change while in basket**: adjust, state it, confirm no charge. "There are only 3 of these left, so we have reduced your quantity. Nothing has been charged."

**The back-in-stock capture** is genuinely valuable for a general store buying against demand. An email address, no account, one message when it returns, no marketing.

---

## Offline

Rarely built, and cheap to do.

- A persistent, quiet bar: "You are offline. The basket is saved."
- The basket persists in local storage and survives.
- Previously viewed pages remain readable through the service worker cache.
- Nothing that requires the network shows an enabled control.

---

## Craft

Every state uses the print language rather than generic illustration.

- **Department mark at scale**, group colour, halftone field. Six drawings covering every empty state in the shop.
- **Rules and numerals** in error summaries.
- **Skeletons as printed blocks** in the group wash.
- **No stock imagery of any kind.** No cartoon characters, no 3D blobs, no astronauts, no dogs with tools.

---

## Motion

- Skeletons fade to content on `--dur-settle`. No shimmer loop.
- Errors fade in adjacent to the field on `--dur-settle`. **Nothing shakes.** Shaking a field is an aggressive gesture at a bad moment.
- Empty state marks draw on once with `stroke-dashoffset`.
- Offline bar slides on `--dur-settle`, dismisses on `--ease-exit`.
- Retry controls show determinate progress in place, same dimensions, never a spinner replacing the button.

---

## Copy rules

- **Say what happened.** "We could not reach the payment provider."
- **Say whose fault.** "Something broke on our side."
- **Say what to do.** "Try again in a minute, or email us."
- **Say the consequence.** "Nothing has been charged."
- **Never apologise decoratively.** "We apologise for any inconvenience" is filler. "Sorry, this is our fault" is an apology.
- **Never**: "Oops!", "Uh oh!", "Something went wrong" with no detail, exclamation marks, or any error message that makes the user feel they caused it.

---

## Measure

- **Error rate by type.** A field with high error rates has a format problem.
- **404 traffic and its sources.** These are usually broken internal links or dead product URLs, both fixable.
- **Retry success rate.** If people retry and succeed, the failure was transient and the copy should say so.
- **Back-in-stock signups**, which is a direct purchasing signal for the buyer.
- **Zero-result search rate.** Above 15% means the synonym list is thin.

## Study

- GOV.UK Design System error message and error summary patterns. The best documented accessible error handling available anywhere, and free.
- Nielsen Norman Group on error message design.
- Baymard on out-of-stock handling and back-in-stock notification.
- web.dev on layout shift, which is what skeletons exist to prevent.
- Shopify Polaris on empty states.
- WCAG 2.2, criteria 3.3.1 through 3.3.4, on error identification, suggestion and prevention.
