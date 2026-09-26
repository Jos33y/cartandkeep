# Handoff: Cart & Keep, back to the storefront

Paste everything below the line into a new chat in this Project.

---

I am Joseph, The Brick Dev Studios. We are continuing the Cart & Keep build. On 25 September 2026 we finished the portal shell, visit tracking, the status page and the Deliverables page. This chat returns to the storefront.

Read before doing anything: the `brick-dev` skill, `design-standard.md`, `comment-rules.md` and `03-how-we-work.md`. Follow them exactly, with the rules below.

## The bar

Deliver as if this were a £100,000 engagement. The platform is multi-tenant and will be sold again in the US and Europe, so every screen is a portfolio piece. Every section needs one idea you would recognise with the logo covered. Never bland, never generated. Colour: ink, cream and sage; terracotta only on the action that means buy, send or submit; green done, amber ageing or waiting, red broken.

## How we work

1. Audit first, numbered, every point checked against the code. If a cause cannot be confirmed from the files, say so.
2. Propose one direction with reasons, at most one or two questions, build on my yes.
3. Words before code. British English, no dashes, no contractions in client-facing copy.
4. Real components, tokens and primitives only. Render on your side, never send me image previews.
5. Deliver a zip of only the files changed, exact repo paths, what was not verified.
6. Never guess a file. Send a collector (`tools/collectors/collect-ck-<area>-<date>.ps1`, run from the repo root). Write zips entry by entry with `System.IO.Compression` so paths use forward slashes; `Compress-Archive` on Windows PowerShell 5.1 writes backslashes. Filter secrets by whole file name only.
7. Imports use Vite aliases (`@app`, `@components`, `@context`, `@pages`, `@pwa`, `@styles`, `@hooks`, `@utils`, `@lib`, `@data`, `@` for `src`). CSS modules live under `src/styles/`, mirroring `src/components` and `src/pages`, not beside the component.
8. `ul[class] { padding: 0 }` in the reset outranks a plain class: padded lists use `ul.className`. A grid item will not shrink below its content without `minmax(0, 1fr)` or `min-width: 0`.

## Order of work

1. **Home page product cards.** The Behringer card is wider than the rest: its section label is `white-space: nowrap` and flex items do not shrink below content (fix `min-width: 0` on `.cell`, the card and its body). One photo treatment per row. The stock line mixes two typefaces. The shelf panel is mostly empty below its heading.
2. **Product pages,** in this order: department page, product page, search, basket, checkout.
3. **Help pages:** contact, request (`/request`), order tracking, receipt, unsubscribe.
4. **Portal, when the store round allows:** the overview's three "sold" figures disagree (Sold 4 from live listings, eBay 33 in 90 days, Money 27 units all time, from `store_channel_profit`). Replay the SQL on Postgres before designing around it. Then the eBay Traffic page: the Open rate column does not match opened divided by shown (160 of 22,532 shows 1.0%), "Unrealised £3,765" must be labelled as an estimate, terracotta on the At stake figures and row wash, titles cut mid word with no ellipsis, the mono "Opened, not bought" pill. `useListings.js` does not compute that rate; collect the Traffic page and its hook first.

## Settled in the last chat, do not reopen

- **Portal shell:** sticky rail with its own scroll, no scrollbar, edge fades, 12px gutters both sides, active item ink icon and sage bar, Messages count in ink. Desktop topbar: crumb, Ctrl K palette to any screen, account menu with her own last visit, and for studio accounts only a client visits line (green up to 3 days, amber to 13, red at 14) opening a 14 day strip with the screens she opened.
- **Visit tracking:** migration 0098 `portal_visits`, one row per person, tenant and London day: first and last time, visit count (a new visit after 30 minutes away), screens opened in order with open counts. No clicks, typing or time on screen. Studio visits recorded but excluded through `portal_member_visits`. She sees her own last visit.
- **Delivery rule:** an item is delivered if it is functional, it works and can be used today. Dates show where known and are not required. Two states only on the public pages: Delivered or Not yet, with one plain reason for Not yet.
- **Status page:** dark hero "32 of 42 delivered." beside a drawn cupboard, one shelf per part of the scope (Month two early on its own top shelf, then Month one, SEO, Analytics), one box per item. Then Waiting on you (legal review, her own legal name) with Done by you chips, Delivered grouped by what it does for her business with a "When it arrived" dot chart, Not yet with reasons, and the link to the scope.
- **Deliverables page:** the checklist. "The signed scope." One line per item, ticked or not, sections with their scope reference. Prints on A4. Deliberately not a repeat of the status page.
- **Her day to day work is not a delivery item:** product decisions and product descriptions were removed from her list.
- **A measured zero is data** and is shown as zero. Only an unknown must never be written as zero. Estimates are labelled as estimates.
- **The "Getting started" guide and guided tour** are parked until later.

## Facts to carry

- **Stack:** React 19, Vite 6, React Router 7, Supabase (Postgres, edge functions), CSS Modules with tokens, `motion` available. Hosting: Hostinger VPS in France running Coolify, behind Cloudflare. Database: Supabase in London. Fonts: Geist for the interface, IBM Plex Mono for figures in the portal.
- **cartandkeep.com points at the live store.** Five products are on sale.
- **Store settings** come from `tenants.store` through `src/lib/storeConfig.js`, loaded by `StoreShell` before render. She has set them herself: free UK delivery from £55, otherwise £3.95; order by 10am; 1 to 2 working days; 14 days to change their mind, return postage paid by the customer; headline "Great Finds, Made Easy"; postcode surcharges at £0, which is her decision. Never hardcode these; always read them from settings.
- **Her legal name** in Settings still reads "Cart and Keep Ltd" with no company number. As a sole trader it must be her own name. It is hers to change.
- **Engagement:** Engagement Scope v2.1, 23 July 2026. The client sent a formal notice dated 22 September 2026; a full written response is due by the end of Monday 28 September and is handled outside this chat unless I bring it here.

## Loose ends

- Delete `Cupboard.jsx`, `cupboard.module.css` and the home `TrustStrip` if nothing else uses them.
- Saved page: add "Clear N no longer available". Needs `SavedPage.jsx`.
- Payment marks: card scheme SVGs go in `public/payment/` (visa, mastercard, amex, apple-pay).
- Her eBay feedback as trust on the shop needs an edge function. Collect `supabase/functions/ebay-sales/index.ts` and `ebay-oauth/index.ts` first.
- Still unverified from the last chat: Safari and Windows Chrome on the new portal shell and both public pages, and the `status.` to `portal.` links on the live hosts.

## First thing to do

Do not design yet. Send a collector for the home page product cards and the shelf panel (the cards, their CSS modules, the home page and whatever renders the shelf), and ask me for screenshots of the live home page at about 1320px and 390px. Then audit and propose one direction.
