# Handoff: Cart & Keep, the product page

Paste everything below the line into a new chat in this Project.

---

I am Joseph, The Brick Dev Studios. We are continuing the Cart & Keep build. On 26 September 2026 we finished the home page shelf, the quick view and the section names (see `08-session-summary-2026-09-26-home-shelf-quickview.md`). This chat does the product page.

Read before doing anything: the `brick-dev` skill, `03-how-we-work.md`, `design-standard.md` and `comment-rules.md`. Follow them exactly, with the rules below.

## The bar

Deliver as if this were a £100,000 engagement. The platform is multi-tenant and will be sold again in the US and Europe, so every screen is a portfolio piece. One idea per screen you would recognise with the logo covered. Never bland, never generated. Colour: ink, cream and sage; terracotta only on buy, send or submit; green done, amber waiting, red broken. Simple beats clever.

## How we work

1. Collect, never guess a file. Collectors go in `tools/collectors/collect-ck-<area>-<date>.ps1`, run from the repo root, zips written entry by entry with `System.IO.Compression`, secrets withheld by whole file name, Vite aliases resolved.
2. Check the data: the SQL behind the page, replayed with realistic rows.
3. Audit, numbered, each point marked confirmed in code or seen in the screenshot only.
4. Propose one direction, at most two questions, build on yes. Joseph may delegate decisions: then decide, and list the words chosen so he can veto.
5. Words before code. British English, no dashes, no contractions in client-facing copy.
6. Real components, tokens only. Render at 1320, 1024 and 390, empty, busy, at scale, reduced motion. Never send image previews.
7. Deliver a zip of only the files changed, exact paths, what was not verified.
8. `ul[class] { padding: 0 }` outranks a plain class: use `ul.className`. Grid and flex items need `minmax(0, 1fr)` or `min-width: 0`. Keyframes are scoped per module. Search matches in PowerShell are case sensitive on purpose (`-CaseSensitive`).

## Order of work

1. **Product page.** Phones land here instead of a quick view, so it carries the quick view's best parts.
   - Delivery is said twice: the `DeliveryEstimate` green box and the Delivery row in `ProductTerms`. Replace with the quick view's delivery card (`ArrivalTrack` and `FreeDeliveryBar`) and state delivery once.
   - The breadcrumb and the eyebrow use eBay's words ("Shop > Musical Instruments & DJ Equipment > Interfaces", eyebrow "Interfaces"). Apply the rule: her words only, through `shopSectionOf` and her category names, or nothing.
   - The gallery is shared with the quick view and already has arrows, a hover count and a following strip.
   - One idea for the page. The shelf and cupboard language should carry through (the related products `Shelf` already stands on its board).
   - Check the returns line against her setting: she set return postage paid by the customer; `ProductTerms` showed "Free return postage" in the harness default.
2. **Department page,** then search, basket, checkout.
3. **Help pages:** contact, request, order tracking, receipt, unsubscribe.
4. **Portal, when the store allows:** the overview's three "sold" figures (replay `store_channel_profit` first), then the eBay Traffic page.

## Settled, do not reopen

- **The shop shows her words only.** `shopSectionOf(product, names)` in `utils/categoryNames.js`: her section, else her name for the eBay department, else nothing. A card hides the label when it repeats the shelf's name.
- **Her copy is hers.** Headline, supporting line and announcement slogans are not edited.
- **No quick view on phones.** Quick look is hidden on touch; the card opens the product page.
- **Free delivery has one voice:** the announcement bar has the words; the header ring shows only the ring and the count, labelled "Basket".
- **The quick view:** the photo flies from the card and back, the left half is the cupboard, one delivery card, desktop and mouse only.
- **Cards:** white photo mount, stock line always shown, compact round add that opens to "+ Add" on hover, eye for quick look.
- **Delivery words:** "Order today", "Leaves us", "With you", "Estimated" with the tooltip "Worked out from our usual dispatch times", "With this, £X more and delivery is free.", "Add this and delivery is free.", "Delivery is free on this basket.", "Delivery £3.95", "14 days to change your mind."
- **Delivered means functional. A measured zero is data; an unknown is never zero. Estimates are labelled.**

## Facts to carry

- **Stack:** React 19, Vite 6, React Router 7, Supabase (Postgres, edge functions), CSS Modules with tokens. Store UI font Inter, display Archivo. Hosting: Hostinger VPS in France on Coolify behind Cloudflare. Supabase in London.
- **Her settings,** always read through `storeConfig()`: free UK delivery from £55, otherwise £3.95; order by 10am; 1 to 2 working days; 14 days to change their mind, return postage paid by the customer; postcode surcharges £0 (her decision).
- **Products:** 5 live, 1 draft, no samples. The studio view shows 6 because a signed-in session on a build with `VITE_STORE_SHOW_DRAFTS=true` reads drafts; customers cannot. Check that flag in Coolify.
- **Shared parts:** `Gallery`, `DeliveryEstimate`, `ProductTerms` and `StockSignal` are used by both `QuickView` and `ProductPage`. `QuickView` is also used by the category, search and saved pages.
- **Her legal name** in Settings still reads "Cart and Keep Ltd"; hers to change.
- **Engagement:** Engagement Scope v2.1, 23 July 2026. A full written response to her notice of 22 September was due by the end of Monday 28 September and is handled outside these chats.

## Loose ends

- Second run of `cleanup-session-2026-09-26.ps1` to remove `Cupboard.jsx` and `cupboard.module.css`.
- Saved page "Clear N no longer available" (needs `SavedPage.jsx`).
- Payment marks in `public/payment/`.
- eBay feedback as trust (collect `supabase/functions/ebay-sales/index.ts` and `ebay-oauth/index.ts` first).
- Unverified: Safari and real phones; category, search and saved quick views; any Node script importing `utils/delivery.js`.

## First thing to do

Do not design yet. Send a collector for the product page (`ProductPage.jsx`, its CSS module, everything it imports, and the migrations behind its queries, including reviews), and ask for screenshots of a live product page at about 1320px and 390px, one product with several photos and one with one. Then audit and propose one direction.
