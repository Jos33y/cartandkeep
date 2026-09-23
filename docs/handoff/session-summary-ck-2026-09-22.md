# Session summary, 8 to 22 September 2026

**Cart & Keep** · what was built, in the order it was built

---

## Before the compaction (8 to 18 September)

- **Home Bargains shelf collector.** Playwright reads `__FLAREACT_DATA` on `home.bargains`. 642 products across 58 categories; seasonal departments excluded by cid.
- **Costing, query building and enrichment.** `cost-shelf.js` bisects on the gate's own `maxGoodsCost`. `shelf-queries.js` reads the product noun from the end of retailer titles. `shelf-product.js` fetches photos, features and unit price for gate passes.
- **Two gate batches:** 298 queries, 55 passes, 38 candidates with real goods costs and listing data.
- **eBay connection.** OAuth through the portal, a preflight that proves listing readiness, credentials in `tenant_credentials` with service-role access only.

## This part (18 to 22 September)

**Traffic.** Built from nothing to a page reading all 407 active listings: account totals, 90-day chart with a sale marked per day, a split of listings by where the chain breaks, value at stake at her own conversion rate, sortable table with thumbnails. Along the way: scope storage fixed, date format fixed, RLS rewritten to `has_tenant()`, and the 200-listing cap removed by listing every active item through the Trading API and asking for traffic by id.

**Design foundations.** `design-standard.md` and `comment-rules.md` written. Tokens extended with elevation, functional washes, data colours, a sequential scale, card, pill and skeleton primitives, and a real three-step ink scale. Shared `primitives.jsx`. A splash in `index.html` that now stays until the page underneath has mounted, the real basket mark in the sidebar, and a page skeleton replacing every bare "Loading" across 13 pages.

**Approved, rebuilt twice.** Header states with counts and filters, a coloured rail per row, one `assess()` feeding both closed and open views. Open, it is a workbench: price scale drawn from the quartiles with a draggable handle, an eBay search tile preview that updates as you type, evidence as three proofs, where the price goes as a stacked bar, a shop card, and the composer. Photos can be reordered, left out, put back and uploaded. Title and description suggestions use the pack photographs, keep suitability limits, never narrow a claim, and refuse with a conflict message when text and packaging disagree.

**Publishing.** `ebay-list` publishes with eBay's suggested category, Brand and MPN, the policies chosen in Settings, and descriptions converted to HTML. It recovers from a failed publish by updating the offer left behind, and updates live listings in place. Quantity is chosen in the confirm step; success shows a confirmation with a link to the listing. First listing live: Cesar Country Stew, `318902688550`.

**Cesar, investigated properly.** The first Home Bargains page carried the 4-pack's copy and photo under an 8-pack title. The unit price (41.58p/100g) proved eight trays. A second HB page matched Pets at Home's current recipes; the older recipe set is discontinued. The live price then moved to £22 through Seller Hub, confirmed by reading the listing back from eBay.

**Listings.** Built from a placeholder: every live product with its channels as coloured chips, price, availability and sales; open, an eBay card with its own funnel and a shop card with what the shop would keep. Update on eBay reads the live listing first and shows on eBay now beside after update.

**Overview.** Rebuilt around the pipeline: a greeting that counts what needs her, four joined stages (to review, approved, live, sold), a Needs you list ordered by value, money from Finance, and 90 days of eBay traffic.

**Finance.** Pull eBay sales reads up to two years of orders with eBay's real fees. All time by default with monthly bars to filter. Kept shows unknown until costs exist. A cost can be added to any product that has sold, shop or not, through `sale_costs`, and applies to past and future sales. The view was made to respect tenant security.

**Settings.** Section navigation that follows the scroll, cards per section, the real gate rules replacing ones from the old composite score, and an eBay policy picker showing handling time, cost and location country.

**Shop clean-up.** `store_products` scoped to its tenant (it was open to every signed-in user). 74 seeded products deleted; four sellers kept live. August test orders and their reviews deleted.

---

## Numbers worth remembering

- 407 active listings; 162,740 shown, 2,708 opened, 30 sold over 90 days
- 357 listings opened and not bought; unrealised about £3,819
- eBay fees 14.6% across her sales; 18.8% on £5 items, because of the 30p per order
- Cesar: bought at £4.99, listed at £22, keeps about £10 a sale; buyers see £23.58
