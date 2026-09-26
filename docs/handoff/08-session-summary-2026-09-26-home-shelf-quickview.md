# Session summary: home shelf, quick view, section names

**26 September 2026** | The Brick Dev Studios | Internal

The home page's product row became a shelf of the hero's cupboard. The quick view was rebuilt around the product being lifted off that shelf, with one delivery card. The eBay category tree was taken off the shop, and the delivery promises now read her settings everywhere.

## Delivered in this chat

| Area | What changed |
|---|---|
| Home shelf | Cards stand on a sage board in the hero's colours. The panel is the shelf's end: shaded back, sage upright, name, count and browse link at the top, the section's drawn object standing on the board. On a phone the panel is one line and the board runs to the screen edge. At scale the shelves stack into a cupboard |
| Cards | Equal widths (`min-width: 0`). One photo treatment: every photo on a white mount. Stock line in one typeface, and always shown ("In stock" fills the empty slot). Compact add: a terracotta circle that opens to "+ Add" on hover or keyboard focus, sage tick after adding, 44px circle on touch. On touch only the heart shows over the photo. Quick look is an eye with a tooltip |
| Section label | One function, `shopSectionOf`: her section, else her name for the eBay department, else nothing. Never eBay's words. Hidden when it repeats the shelf's name. Used by the card and the quick view |
| Quick view | The card's photo flies into the dialog and back on every close; its slot stays empty while open. Left half is the cupboard (shelf back, photo standing on a board). Gallery arrows and count on hover, a strip that follows the selection with edge fades. One delivery card: three drawn stops (Order today, Leaves us, With you) with an Estimated tag, and a free delivery bar (solid is the basket, striped is this product before it goes in). Returns in words. Page no longer shifts on open. Desktop and mouse only, by decision |
| Delivery truth | `DeliveryEstimate` and `utils/delivery.js` read her settings: £55 threshold, £3.95, 10am cutoff, 1 to 2 days. "free over" became "free from". The estimate is no longer cached past the cutoff |
| Header | The basket ring says "Basket" only; the announcement bar carries the free delivery words |
| Phone hero | Both buttons full width below 480px. Her wording untouched |
| Tokens | Wood, shelf back, gold text, sage ink and on-action colours added to `store-tokens.css`. The hero unit reads the same wood tokens |

## Decisions made

- **The shop shows her words only.** No eBay department or leaf names on cards or in the quick view. Naming is hers: rename departments in the portal's Categories screen, or set her own sections per product.
- **Her copy stays as she wrote it.** Headline, supporting line and announcement slogans are hers and are not edited.
- **No quick view on phones.** Tapping a card opens the product page; the delivery card goes onto the product page instead.
- **One voice for free delivery:** the announcement bar has the words, the header ring has the ring and the count.
- **The arrival track claims no progress.** The route draws once; nothing fills before anything has happened.
- **Nothing decorative loops.**

## Found and fixed

| Where | Problem | Fix |
|---|---|---|
| Quick view | Promised free delivery over £40 while her terms say £55 | Reads `freeOver()` and `postage()` |
| Delivery estimate | 2pm cutoff and 2 to 3 days hardcoded | Reads her cutoff and transit days |
| Home rail | 16px overhang on desktop: `.rail` lost to `ul.rail` | Override on `ul.rail` |
| Cards | Section label set the Behringer card's width | `min-width: 0` on cell, card and body |
| Quick view | Page shifted about 8px on open (Windows) | Viewport locked with `scrollbar-gutter: stable`; confirmed live |
| Cleanup script | Case-insensitive match flagged `scope-cupboard.module.css` as a user of `Cupboard` | Matches the import path, case sensitive |
| Home count | "6 products" in the studio view against 5 live | Not a bug: a signed-in studio session on a build with `VITE_STORE_SHOW_DRAFTS=true` reads her draft. Customers cannot (anon policy) |

## Not verified

- Safari and real phones on the shelf, the flight and the compact add.
- The other quick view hosts (category, search, saved) were not rendered.
- Whether any script in `scripts/` imports `utils/delivery.js` under plain Node; it now imports `@lib/storeConfig`.
- `VITE_STORE_SHOW_DRAFTS` in the Coolify build environment (should be absent or false).

## Open, not done

- The product page: delivery said twice (green box and a Delivery row), breadcrumb and eyebrow in eBay's words ("Musical Instruments & DJ Equipment", "Interfaces").
- Her department names or sections, so the section label returns in her words.
- Portal: the overview's three "sold" figures and the eBay Traffic page (from the 25 September handoff).
- Saved page "Clear N no longer available", payment marks, eBay feedback as trust.

## Files for the tree

**New files:**

- `src/components/ui/store/ArrivalTrack.jsx`
- `src/components/ui/store/FreeDeliveryBar.jsx`
- `src/styles/ui/store/arrival-track.module.css`
- `src/styles/ui/store/free-delivery-bar.module.css`
- `tools/collectors/collect-ck-home-cards-2026-09-26.ps1`
- `tools/collectors/collect-ck-quickview-2026-09-26.ps1`
- `cleanup-session-2026-09-26.ps1` (repo root, run once)

**Changed files:**

- `src/components/ui/store/Shelf.jsx`
- `src/components/ui/store/ProductCard.jsx`
- `src/components/ui/store/StockSignal.jsx`
- `src/components/ui/store/QuickView.jsx`
- `src/components/ui/store/Gallery.jsx` (shared with the product page)
- `src/components/ui/store/DeliveryEstimate.jsx` (shared with the product page)
- `src/components/ui/store/SectionGlyph.jsx` (adds basket and door)
- `src/components/ui/store/icons.jsx` (adds `EyeIcon`)
- `src/components/layout/store/BasketRing.jsx`
- `src/utils/delivery.js` (settings, `today`, `hourLabel`, `arrivalDays`)
- `src/utils/categoryNames.js` (adds `shopSectionOf`)
- `src/styles/ui/store/shelf.module.css`
- `src/styles/ui/store/product-card.module.css`
- `src/styles/ui/store/stock-signal.module.css`
- `src/styles/ui/store/gallery.module.css`
- `src/styles/ui/store/quick-view.module.css`
- `src/styles/ui/store/shelf-unit.module.css`
- `src/styles/ui/store/store-hero.module.css`
- `src/styles/base/store-tokens.css`

**Deleted:** `src/components/ui/store/TrustStrip.jsx`, `src/styles/ui/store/trust-strip.module.css`, `src/ck_src_tree.txt`. `Cupboard.jsx` and `cupboard.module.css` go on the second run of the fixed cleanup script.

## How the work was verified

A local harness rendered the real components and CSS modules with a stubbed Supabase and Playwright at 1320px, 1024px, 800px and 390px, with touch emulated through Blink settings, reduced motion, one product, six products, 300 products in four departments, and a renamed department. The quick view was driven through open, flight, add and close three ways, with a fixed London clock. The delivery estimate was checked in Node across a weekday before and after the cutoff, a weekend and Christmas. Every round passed a production build. Joseph checked each round live.
