# 08 — PLP

The product listing page. The department grid. Where a general store is won or lost.

---

## Verdict

The PLP has **no filters at all**. One browser-default select for sort, sitting next to custom pills, and nothing else.

At 6 products that is invisible. At 50 it is a wall. At 200 it is unusable, and the catalogue is going to 1000.

The rest of the audit:

- The category hero is a supplier cutout of a drill bit enlarged roughly 800% and darkened. It is the single most damaging element on the page.
- Six products in a four-across grid leaves two orphans and half a dead row, then a large white gap before the footer.
- Every product carries "Only 5 left", in amber, identically. Uniform urgency is obviously fabricated, and it contradicts the shop's own promise not to use pressure.
- The chip rail clips "Garden & Patio" with no scroll affordance.
- The sort control is unstyled browser chrome beside custom pills.
- Cards have no hover state of any kind, which is the main reason the grid feels dead.

---

## The job

Let someone scan a lot of options quickly and eliminate most of them without opening anything.

That is the whole job. A PLP is an elimination tool. Everything on it either helps someone rule something out or it is in the way.

---

## Anatomy

### 1. Breadcrumb

Group → department → leaf. In group colour. On mobile it becomes a single back control that names the parent.

### 2. Department banner

Replaces the enlarged cutout. Group colour at the deep tone, department name in wide Archivo at 46px, product count and price range set large in tabular figures. Halftone field, department mark quarter-bled.

The banner is 180px tall on desktop and 120px on mobile. It orients, it does not dominate. A category header that takes half the viewport pushes the actual products below the fold, which is the most common category-page mistake in ecommerce.

### 3. Facets

The single largest missing feature. Everything below 24 products can survive without them. Everything above cannot.

**Desktop**: a left rail, 240px, sticky, above the fold.

**Mobile**: a bottom sheet behind a Filter control that shows the active count. Never a full-page interstitial.

The facets a general store needs, in order:

| Facet | Type | Notes |
|---|---|---|
| Price | Range with histogram | The histogram matters. It shows the shape of the range before anyone touches it. |
| Leaf category | Checkbox with counts | The primary facet in most departments |
| Brand | Checkbox with counts, searchable above 15 | |
| In stock | Toggle | Default on. Nobody wants to see what you cannot sell. |
| Delivery | Toggle | "Arrives within 3 days" |
| Attributes | Varies by department | Size, capacity, pack quantity, power. From the feed. |

**Rules**

- Counts on every option. An option with zero results is disabled, never hidden. Hiding it makes the list jump.
- Applied facets appear as removable chips above the grid, with a "Clear all".
- Facets write to the URL. The state must be shareable, bookmarkable and survivable through a back navigation. This is not optional.
- Results update live, no Apply button on desktop. On mobile the sheet has an Apply that states the count: "Show 34 products".
- Facets never reorder themselves based on selection.

### 4. Sort

A proper control, styled to match the facets. Options that mean something:

- Most useful first (the default, and the shop's own merchandising)
- Price, low to high
- Price, high to low
- Newest in

Not "Featured", which means nothing and implies paid placement. And say so: "Sorted by what people keep buying. Nothing here is boosted or sponsored."

### 5. The grid

**4 across desktop, 3 at tablet, 2 on phone.** Never 1.

24 per page, then a Load more control. Not infinite scroll: it breaks the back navigation, it makes the footer unreachable, and it destroys the ability to return to a position. Load more, with the URL updating, is the correct pattern for a catalogue.

### 6. Merchandising break

Every twelve rows, a full-width band. Rotating between:

- A related department cross-link
- The ask-us-to-stock prompt
- One piece of editorial: how to choose, what the sizes mean
- The delivery threshold reminder

This is what gives a long grid a pulse. Without it, 200 products is 200 products.

### 7. The end of the department

For short departments, and there will be many, the end of the grid becomes the request prompt rather than 400px of dead cream. Every thin category gets a purpose while the catalogue grows.

---

## The card

Two treatments were built. **The Shopfront** is the recommendation: image on the department wash, no border, price in a solid stamp, elevation rather than outline.

Anatomy, top to bottom:

1. **Group colour tab**, 4px, top edge
2. **Image**, 1:1, on group wash, product at 82% inset
3. **Leaf category**, 12px, 600 weight, tracked, uppercase, in group deep tone
4. **Written title**, 15px, 500 weight, two lines maximum, never truncated mid-word
5. **Price**, 19px, Archivo, tabular figures, in a stamp
6. **One signal, conditionally**

### Card rules

**Price outranks title.** 19 against 15. In a general store the price is the pitch.

**One signal per card, maximum.** This was an error in an earlier draft and it is worth stating plainly: "Free over £40" was repeated on nine cards, which turns a conditional into wallpaper and puts it in direct competition with the price for the one slot the eye lands on. The delivery threshold belongs **once**, in the persistent bar, where it is doing live arithmetic against the actual basket.

**Stock shows only when genuinely low.** Under five shows a count. Everything else shows nothing, so the badge means something when it appears.

**Drop the word "only".** "5 left" is a fact. "Only 5 left" is persuasion, and the About page promised not to do that.

**Titles are written, not fed.** "Cordless electric screwdriver, 24 bits", not "WORKPRO 3.6V Electric Screwdriver Set with Offset Drive, 24-Piece Cordless". Object, then the one qualifier that decides the purchase. See [16 — Voice & Content](16-voice-and-content.md) for how to do this across 1000 products.

**Quick view on hover**, desktop only, appearing over the image. Never a permanent button taking vertical space.

**The whole card is the target**, not just the title.

---

## Motion

- **Card hover**: 2px lift, elevation 1 to 2, group-colour registration offset slides in behind, quick view fades up. All 120ms.
- **Facet application**: grid redraws in place at identical dimensions. Skeletons in the group wash, never shimmering grey. Scroll position holds. Results cross-fade on `--dur-settle` with a stagger capped at eight.
- **Load more**: new items stagger in below. The page does not jump.
- **Sort**: FLIP the existing cards into their new positions. You watch the shop reorder itself rather than blink. This is the single most impressive and least expensive motion on the page.
- **Card to PDP**: View Transitions API on the product image, so it persists into the gallery.
- **Facet chips**: spring in on `--ease-spring`, exit on `--ease-exit` at 60% duration.

---

## Copy

**Empty facet result**: "Nothing in Garden & Patio under £10. The cheapest is £17.32." Name what they filtered, give them the nearest real answer, do not make them undo it themselves.

**Result count**: "34 products" plainly. Not "Showing 1–24 of 34 results".

**Merchandising bands**: keep the register. "That is all eight. Want something else in here? Tell us what it is and what you pay for it now. One person reads these."

---

## Mobile

- Two across, always. Price at 19px still reads at arm's length.
- Filter and Sort as a sticky pair at the bottom of the viewport, above the tab bar, with the active filter count on the Filter control.
- Facet sheet is a bottom sheet at 90% height with a drag handle, not a full-screen takeover.
- Department colour does the wayfinding, because there is no breadcrumb worth reading at 375.
- Delivery threshold bar persistent once the basket is non-empty.

---

## Measure

- **Facet engagement rate.** Under 20% on a department with 50+ products means the facets are wrong or invisible.
- **Zero-result facet combinations.** Log them. They indicate either a taxonomy gap or a stock gap.
- **Pagination depth.** If nobody reaches page two, sort is doing its job. If everybody does, the default sort is wrong.
- **Card click distribution.** Heavy clustering on the first row means people are not scanning, which usually means the cards are too similar to differentiate.
- **PLP to PDP rate**, and PDP bounce back to PLP. A high bounce-back means the card is promising something the PDP does not deliver, and that is usually a title or image problem.

## Study

- Baymard on product list usability. Their category and filtering research is extensive and directly applicable.
- Screwfix and Toolstation. Genuinely excellent trade PLPs: dense, fast, honest, filterable. Ugly, and they convert extremely well.
- Decathlon for facet design across a very broad general catalogue.
- IKEA for how scale and dimension information is surfaced in a listing.
- Zalando for filter interaction quality at scale, particularly the mobile sheet.
- Algolia's InstantSearch patterns for faceted refinement behaviour.
- Nielsen Norman Group on infinite scroll versus pagination. The research is unambiguous for catalogues.
