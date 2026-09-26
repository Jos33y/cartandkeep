# Handoff: Cart & Keep, status page, portal overview and storefront

Paste everything below the line into a new chat in this Project.

---

I am Joseph, The Brick Dev Studios. We are continuing the Cart & Keep build. The storefront's legal pages, help desk, header, home page and footer were rebuilt and deployed on 25 September 2026. This chat starts with the status page and the portal's first screen, then returns to the storefront.

Read before doing anything: the `brick-dev` skill, `design-standard.md`, `comment-rules.md` and `03-how-we-work.md`. The last one is how this collaboration runs. Follow it exactly, together with the rules below, which were settled in the last chat.

## The bar

Deliver as if this were a £100,000 engagement. The platform is built multi-tenant so it can be sold again to clients in the US and Europe, so every screen is also a portfolio piece.

The last chat proved why this matters: most of what the client says is missing is built and live. She did not notice it because it did not look finished. Presentation is how a client knows the work exists.

Senior level, creative, modern, never bland and never generated. Every section needs one idea you would recognise with the logo covered: a shape that explains, a drawn object, a live preview, a track that fills. Gamified where it tells the truth (the basket ring filling towards free delivery is the model), never gimmicky.

Colour: ink, cream and sage. Terracotta only on the action that means buy, send or submit.

## How we work

1. **Audit first.** Senior visual audit, numbered, specific, every point checked against the code. No guessing and no hallucination: if a cause cannot be confirmed from the files, say so and say how to check it.
2. **Propose one direction,** with reasons. Ask at most one or two questions. Build on my yes.
3. **Words before code.** I approve copy before it ships. Give distinct angles, not variations of one sentence. No filler, nothing untrue today, British English, no dashes, no contractions in client-facing copy.
4. **Build in the real components,** tokens and primitives only. No throwaway HTML, no mock-ups.
5. **Render and check on your side, but never send me image previews.** I preview live and send screenshots.
6. **Deliver a zip of only the files changed in that round,** with exact repo paths, what to deploy, and what was not verified.
7. **Never guess a file.** Send a PowerShell collector (`tools/collectors/collect-ck-<area>-<date>.ps1`, run from the repo root) for anything you have not seen. Filter secrets by whole file name only (the old filter withheld `tokens.css`).
8. **Watch the reset:** `ul[class] { padding: 0 }` outranks a plain class, so padded lists need `ul.className`.

## Order of work

1. **Status page and portal first screen.** Redesign both to present delivered work: every item with its date, grouped by what it does for her business, new since her last visit marked as new, and what is waiting on her made unmissable. Data comes from `statusItems.js` and `deliverables.js` (both updated 25 September). No count written into these files that the portal also shows.
2. **Home page product cards.** The Behringer card is wider than the rest: its section label is `white-space: nowrap` and flex items do not shrink below content (fix `min-width: 0` on `.cell`, the card and its body). One photo treatment per row. The stock line mixes two typefaces. The shelf panel is mostly empty below its heading.
3. **Product pages,** in this order: department page, product page, search, basket, checkout.
4. **Help pages still to design:** contact, the request page (`/request`), order tracking, receipt, unsubscribe.

## First thing to do

Do not design yet. Ask me for:

- a collector for the status page and the portal overview (dashboard) files, including their CSS, `statusItems.js`, `deliverables.js` and whatever renders them,
- screenshots of the live status page and the portal dashboard at desktop (about 1320px) and phone (390px).

Then audit and propose one direction.

## Facts to carry

- **Stack:** React 19 and Vite, React Router 7, Supabase (Postgres, edge functions), CSS Modules with design tokens. Portal and store share one repo. Hosting: Hostinger VPS in France running Coolify, behind Cloudflare. Database: Supabase in London.
- **Store settings** come from `tenants.store` through `src/lib/storeConfig.js`, loaded by `StoreShell` before anything renders. Snake case in the database, mapped to camel case on load. `loadStoreConfig` retries three times and logs "[store] settings did not load" if all fail. Nothing client-specific in code.
- **Promises, all from settings:** free UK delivery from £40, otherwise £3.95; order by 1pm for same-day dispatch; 1 to 2 working days; 30 days to change your mind, return postage paid by the shop; a reply within 24 hours (`storeConfig().support.reply`).
- **Legal:** six policy pages at `/legal/:slug` (terms, privacy, returns, delivery, cookies, reviews) from `src/data/legal.js`, and the FAQ at `/faq` from `src/data/help.js`. The review pack for her is generated from `legal.js`. Migrations 0096 (returns and privacy settings) and 0097 (review hold reasons) are live.
- **Her legal name** in Settings currently reads "Cart and Keep Ltd" with no company number. As a sole trader it must be her own name. The Settings screen flags it. It is hers to change.
- **Sections:** she has none yet, so the header rail, footer Shop column and hero shelves show their no-section states. We agreed to revisit when her real products move over from eBay.
- **Header:** rotating promises ticker, command-palette search (Ctrl K), saved heart counting only products still on sale, basket ring towards free delivery, drawer menu with drawn section tiles on phones.
- **Home:** hero "One small shop. / A very large cupboard." with the drawn shelving unit on a wall and floor scene; line "If it is not on the shelf yet, tell us and we will find it."; buttons "Shop the cupboard" and "Tell us what you need"; proof row; requests band as a paper request slip; compact footer.
- **Engagement:** Engagement Scope v2.1, 23 July 2026. The client sent a formal notice dated 22 September 2026. An acknowledgement promises her a full written response by the end of Monday 28 September. That response is handled outside this chat unless I bring it here.

## Loose ends

- Delete `Cupboard.jsx`, `cupboard.module.css` and the home `TrustStrip` if nothing else uses them.
- Saved page: add "Clear N no longer available". Needs `SavedPage.jsx`.
- Payment marks: the card scheme SVGs go in `public/payment/` (visa, mastercard, amex, apple-pay).
- Her eBay feedback as trust on the shop needs an edge function. Collect `supabase/functions/ebay-sales/index.ts` and `ebay-oauth/index.ts` first.
