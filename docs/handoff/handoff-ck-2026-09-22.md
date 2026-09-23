# Handoff, 22 September 2026

**Cart & Keep** · where things stand, and how to pick up

Load order: `feedback`, then this file, then `todo`, then `session-summary`.

---

## In one paragraph

The pipeline now runs end to end. A product found on a Home Bargains shelf was gated, approved, priced against a seller who is converting, written, and published to eBay from the portal: Cesar Country Stew 8 x 150g, listing `318902688550`. The portal reads her whole eBay account: all 407 active listings with 90 days of traffic, and every order with eBay's real fees. Finance, Overview, Listings, Traffic and Approved were rebuilt to `design-standard.md`. Nothing on the shop has sold for real yet; the August orders were tests and were removed.

---

## State at close

**Cesar listing.** Live at £22.00, which she set in Seller Hub (published at £18.70). Buyers see £23.58 because eBay adds a charge on a private seller account. Updated in place from the portal at close: description now sent as HTML, parcel 1.5 kg and 28 x 18 x 10 cm (an estimate, to replace with the measured box). Her postage policy uses eBay's Standard Tracked and Click & Collect, which require a parcel; the update worked with weight and dimensions and no package type.

**Her account.** 407 active listings. Over 24 June to 21 September: 162,740 shown, 2,708 opened (1.7%), 30 sold. 357 listings opened and not bought, 31 shown and not opened, 2 never shown, 17 selling. Unrealised at her own conversion rate: about £3,819. eBay fees came to 14.6% of sales, in line with the board's budget.

**Shop.** Four products live, all from her earlier eBay listings: bed rails, Salter scale, Behringer UCA222, LED mirror. None has a cost recorded. The 74 other seeded products were deleted. Test orders and their two reviews were deleted.

**Approved queue.** Cesar Classic Terrine (median priced, untrusted), Febreze 3Volution, Comfort Pure. 34 candidates to review.

**Her seller account is set to Private.** Buying to resell is trading. Not yet raised with her.

---

## Deploy checklist

Everything below was delivered this session. If any is not yet in the repo or deployed, do it before new work.

**Migrations, in order:** `0075_ebay_traffic`, `0076_ebay_traffic_daily`, `0077_ebay_settings`, `0078_candidate_ebay`, `0079_candidate_draft`, `0080_store_products_tenant_scope`, `0081_listing_images`, `0082_sale_costs`. Then `alter view store_channel_profit set (security_invoker = true);` and confirm Finance still loads.

**Edge functions**, each with `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`:
`ebay-oauth`, `ebay-traffic`, `ebay-list`, `ebay-sales`, `ebay-item`, and `ebay-compose` (also needs `ANTHROPIC_API_KEY`).

**Scripts:** `scripts/replace-loading.mjs` (already run; all 8 pages fixed), `scripts/import-gate.js` (writes `competition.p25/p75` and `margin.rates`; re-import both HB batches if not done).

---

## Where each thing lives

| Area | Files |
|---|---|
| Tokens and primitives | `src/styles/base/tokens.css`, `src/components/ui/portal/primitives.jsx`, `Skeleton.jsx`, icons in `src/components/ui/icons/index.jsx` |
| Boot | `index.html` splash, `src/lib/boot.js`, `App.jsx` (`Booted` inside `Suspense`), `main.jsx` |
| Approved | `ApprovedPage.jsx`, `PriceScale.jsx`, `ListingComposer.jsx`, `SearchTile.jsx`, `Breakdown.jsx`, `useApproved.js`, `useDraft.js` |
| Listings | `ListingsPage.jsx`, `useListings.js` |
| Traffic | `EbayTrafficPage.jsx`, `useEbayTraffic.js`, `ebay-traffic` |
| Overview | `OverviewPage.jsx`, `useOverview.js` (money comes from `useFinance`) |
| Finance | `FinancePage.jsx`, `useFinance.js`, `ChannelImport.jsx` (TikTok only now), `ebay-sales` |
| Settings | `SettingsPage.jsx`, `EbayConnection.jsx` (policy picker) |

---

## How the pieces connect

- **Publish:** Approved → `ebay-list` dry run (category from eBay Taxonomy) → confirm → inventory item, offer, publish → `candidates.ebay`. The row then leaves Approved and appears on Listings.
- **Update:** Listings → `ebay-item` reads the live listing through the Trading API → comparison table → `ebay-list` with `update: true` revises in place.
- **Traffic:** `ebay-traffic` lists every active listing through `GetMyeBaySelling`, then asks the analytics report for them 200 at a time by id.
- **Sales:** `ebay-sales` reads orders for up to two years into `channel_sales` with eBay's real fee, split by line.
- **Costs:** a cost on a shop product lives on `store_products`; anything else lives in `sale_costs` by title. `store_channel_profit` reads both.

---

## Known limits, stated plainly

- Listings only offers Update for listings published from the portal. The other 400 can be read but not yet edited from here.
- Listings shows eBay as published, not live. `ebay-item` reads live state on demand only.
- Traffic counts active listings only; listings that ended in the window are in the totals but not the per-listing breakdown.
- `sale_costs` matches by title, so a listing retitled on eBay loses its cost.

---

## Opening prompt for the next chat

```
Continuing Cart & Keep. The pipeline runs end to end: Cesar Country Stew is live
on eBay from the portal, and the portal reads all 407 of her listings and every
order. Finance, Overview, Listings, Traffic and Approved are rebuilt.

Read the feedback file first, then the handoff, then the todo list. First job:
[pick from the top of the todo list].
```

Attach: `feedback-ck-2026-09-22.md`, `handoff-ck-2026-09-22.md`, `todo-ck-2026-09-22.md`, `session-summary-ck-2026-09-22.md`, `design-standard.md`, `comment-rules.md`, `approved-page-spec.md`, plus the files for whichever page comes first.
