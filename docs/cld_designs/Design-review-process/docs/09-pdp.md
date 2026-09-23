# 09 — PDP

The product detail page. Where the decision is made.

---

## Verdict

The details section is 2016 work, and the comparison the client drew to Amazon and eBay is the right one.

The specifics:

- The DETAILS table has **exactly one row**. On the screwdriver it says "Cordless". That is the entire specification.
- The sticky add-to-basket bar sits on top of the supplier description and cuts words in half.
- The description is raw supplier prose with no structure, no labelling and American spelling.
- The gallery thumbnails are the same low-resolution assets used at 48px in the basket, reused here where they are unreadable.
- There is an empty lower-left column running the full height of the description.

The important diagnosis: **this is an extraction problem wearing a design problem's clothes.** The feed clearly carries structured attributes, because one of them surfaced as "Cordless". The others were never pulled through. No amount of layout work fixes a table with one row in it.

Amazon and eBay are good at this for an unglamorous reason. They render structured attributes from the feed rather than writing prose. That is why their spec tables work across a billion listings and this one does not work across 78.

---

## The job

Answer every question that stands between wanting the thing and buying the thing, in the order those questions arrive.

For a general store, in order:

1. Is this the right object?
2. What size, capacity, quantity is it?
3. Will it arrive in time?
4. What if it is wrong?
5. What does it cost?

Note where price sits. In a general store, price is rarely the blocker. Uncertainty is.

---

## Anatomy

### Above the fold

Two columns on desktop, 58/42.

**Left: gallery.**
- 1:1 primary, on group wash, product at 82% inset
- Thumbnail rail below, four to six, full-resolution assets not basket thumbnails
- Click to zoom. Real zoom, at 2000px master resolution. This is the single most requested PDP feature in every piece of usability research ever run, and it depends entirely on the pipeline in [05](05-imagery-pipeline.md).
- A scale reference where dimension is the question. A printed dimension rule along one edge.

**Right: the decision column.**

In order:
1. Breadcrumb, in group colour
2. **Written title**, Archivo 28px. Not the supplier string.
3. **Price**, Archivo 28px, tabular, in a stamp
4. **Key facts strip.** Four to six attributes that decide the purchase, pulled from the feed. This is the element that is entirely missing today and it is the most valuable addition on the page.
5. **Delivery estimate**, real and specific. "Order in the next 4 hours, arrives Tuesday 26 August."
6. **Quantity and Add to basket.** One primary. 44px minimum. Full width on mobile.
7. **Free delivery progress**, live against the actual basket
8. **Returns line.** "30 days to change your mind. We pay the return postage."

Everything above is visible without scrolling on a 1440 desktop and within one scroll on a 375 phone.

### Below the fold

**Full specification table.** Every attribute in the feed, two columns, ruled rows, monospace values, right-aligned numbers. This is what eBay does well and it is entirely mechanical once the extraction is fixed.

**What is in the box.** A plain list. Removes more pre-purchase doubt than any amount of description.

**Description, labelled.** "Written by whoever supplied this product, not by us." That line already exists in the shop's copy and it is genuinely good. It manages expectation, it is honest, and it lets supplier prose sit on the page without damaging the shop's voice. Keep it. Set the supplier text in a visually distinct block so the boundary is obvious.

**Delivery and returns**, expanded. Pulling the relevant answers from the help centre, in place, rather than linking away.

**Cross-sell**, and be specific about which kind:
- **Goes with this**, same purchase occasion. Highest value in a general store.
- **More in this category.**
- Never "customers also viewed" until there is enough traffic for it to mean anything. A recommendation engine on 78 products with low traffic produces noise, and noise erodes trust.

---

## The key facts strip

Worth its own section, because it is the highest-leverage new element on the page.

Four to six attributes, chosen per department, rendered as a horizontal strip of labelled values under the price.

| Department | Key facts |
|---|---|
| Tools | Power source, chuck size, pieces included, warranty |
| Kitchen | Capacity, material, dishwasher safe, pieces |
| Cleaning | Volume, surface type, contains bleach, pack size |
| Pet | Animal, size, washable, material |
| Garden | Capacity, material, assembly required, dimensions |

Each is a label above a value. Icon from the family at 20px where one genuinely clarifies. Never an icon for the sake of a row.

The rule: **if a shopper would need to open the full spec table to answer it, and most shoppers would ask it, it belongs in the strip.**

---

## Craft

- **Gallery frame in group wash**, with a registration offset in group colour. Depth without shadow, department coding at the same time.
- **Spec table as a ruled print table.** Hairline rules, monospace values, no zebra striping, no card container.
- **Price stamp** with the half-degree optical rotation.
- **The supplier description block** takes a tinted paper background and a printed rule above, so it is visibly a different voice.
- **The delivery estimate gets the drawn mark** from [03](03-iconography-and-svg.md).

---

## Motion

- **Image continuity from PLP.** View Transitions on the product image. It persists into the gallery.
- **Gallery**: thumbnails cross-fade the primary on `--dur`. Zoom opens on `--dur-large` with `--ease-spring`.
- **Add to basket**: optimistic. Ghost of the image lifts, arcs to the basket mark, scales in. Count changes before the request returns. Delivery bar fills.
- **Sticky bar** appears on `--dur-settle` when the primary Add control scrolls out of view. It must never overlap content, which is the current bug. Reserve its height.
- **Spec sections** expand on `--dur-settle`, one at a time, height animated on transform not on height.
- **Quantity stepper** springs on `--ease-spring`, and the price updates with a tabular figure roll.

---

## Copy

**Title.** Object, then the qualifier that decides it. "Cordless electric screwdriver, 24 bits". 60 characters or fewer.

**Delivery.** Specific and honest. "Arrives Tuesday 26 August if you order in the next 4 hours." Never "Fast delivery".

**Returns.** "30 days to change your mind. We pay the return postage." Never "Hassle-free returns", which raises the question of who mentioned hassle.

**Stock.** "5 left" only under five. Nothing otherwise.

**The supplier label.** "Written by whoever supplied this product, not by us." Already written, already good.

**Never** "Premium quality", "Perfect for", "Say goodbye to", "Whether you are... or...", "Look no further". Every one of these is a supplier-feed tell.

---

## Mobile

- Gallery is a swipe carousel with a real page indicator, not dots that vanish.
- Key facts strip becomes a two-column grid.
- Sticky add bar from first scroll, carrying price and Add. Height reserved so nothing is covered.
- Spec table collapses to a two-line-per-row layout, label above value. Never a horizontally scrolling table.
- Zoom is pinch, and it is full-screen.

---

## Measure

- **Add to basket rate by department.** A department significantly below the others usually has a data problem, not a design problem.
- **Gallery interaction rate.** Low zoom usage on a category where size matters means the scale reference is missing.
- **Spec table expansion rate.** High expansion means the key facts strip has the wrong facts in it.
- **Scroll depth to cross-sell.** If nobody reaches it, the page above is too long.
- **Return rate by department**, correlated against spec completeness. This is the direct commercial argument for fixing extraction: incomplete specifications cause returns, and returns cost more than any design work in this document.

## Study

- eBay item specifics and Amazon's product information tables. Both ugly, both extremely well researched, both driven entirely by structured data. Study the information architecture, not the styling.
- Baymard on PDP. Their image, specification and delivery-information research is the most rigorous in the field.
- IKEA product pages for dimension communication.
- Screwfix for trade-grade specification density on a small screen.
- Schema.org `Product`, `Offer` and `AggregateRating`. Structured data on the PDP is free search visibility and the markup mirrors the spec table you are already building.
- Google Merchant Center product data specification, which is a good checklist of the attributes worth extracting.
