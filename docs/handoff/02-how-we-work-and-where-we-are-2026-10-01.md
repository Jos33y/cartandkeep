# Cart & Keep, how we work and where we are

**Written 2026-10-01** | The Brick Dev Studios | Internal

The rules in force and the current position of each part of the portal. The handoff (`00-handoff-2026-10-01.md`) says what to do first. The earlier position of the shop's public pages is in `02-state-2026-09-29.md` and still holds.

---

## How we work

### House rules (Joseph's words, all in force)

- British English. No em or en dashes anywhere, code included. No AI-tell words.
- Customer copy says "you".
- Her words are never edited: "Shop it! Love it! Keep it!", "A small UK shop with a very large cupboard".
- No street address outside the legal pages. No dev notes on public pages.
- Secrets never in files, zips or collectors.
- Scripts never touch her work in the portal: her decisions, notes, sources, or the figures on cards she has decided.
- Premium and calm, never lazy or generated-looking. The bar is to beat Cloudflare's designs.
- Push back when he is wrong, once, with evidence.
- Portal copy never says "she" or "her". It says "you", or states the fact.

### Working method

- **Audit first,** with confirmed and inferred marked.
- **Collectors, never guesses.** PowerShell, house format, zip plus MANIFEST, as tight as the work. If a file is needed, ask for it.
- **"Don't code" means answer only.** Build only on "build", "yes" or "go".
- **Test by using it:** clicks, keys, typed values, all 13 sizes (320 to 1920), and the build.
- **Deliver a zip of only the changed files,** named `ck-<what>-<date>.zip`, with the functions to deploy and any SQL named.
- **Commits** end with the Co-Authored-By and Claude-Session lines.
- **Never send renders or previews of UI work.** He previews live and sends screenshots.
- Comments are short and only where the why is not obvious.

### Product rules decided this session

- **Listing on eBay:** only eBay's own refusals block a listing. Warnings about price, weight or photos inform and never stop it.
- **Photos:** any photo may go up except another eBay seller's raw `i.ebayimg.com` photo. Callouts, lifestyle shots and overlays are fine after the first photo, which should be a plain shot. Passed photos go in by themselves; she removes what she does not want.
- **Keepr** moves a card to an eBay listing on its own at 95% sure or more. Below that it suggests.
- **Model:** `claude-sonnet-5-5` for every function and script.
- **Amazon buyer complaints** are an internal risk note on the card, never put in a listing.
- **Listings** means live: active on eBay or on sale in the shop. Drafts live in Products.

### Stack

- **Front end:** React 19, Vite 6, react-router 7, CSS Modules. One build serves the shop, `portal.` and `status.`.
- **Supabase** (London), project `vtdqrhkjdzkdjmyxrsok`:
  - Postgres with RLS through `has_tenant()`, and `security_invoker` views;
  - Deno edge functions, deployed by hand in the dashboard;
  - pg_cron jobs through `functions_base()` and `scheduler_headers()`.
- **Outside services:**
  - eBay Inventory API, marketplace EBAY_GB, category tree 3;
  - Apify Axesso actor for Amazon UK, secret `APIFY_TOKEN`, $1.50 per 1,000 pages;
  - Stripe for the shop, still in test mode; Resend for email.
- **Hosting:** Coolify on a Hostinger VPS, behind Cloudflare.
- **Joseph's setup:** Windows, PowerShell and WebStorm.

---

## Where we are

### eBay listing (`_shared/ebay/listing.ts`, `ebay-list`, `ebay-queue`)

- **The flow:** inventory item, then offer, then publish.
  - SKU is `CK-` plus the first 16 hex characters of the card id, stable across relists.
  - Monthly limit 300, daily pace 20 through the queue.
- **Blockers left:**
  - a title, a description, a price and a category;
  - required item details;
  - New allowed in the category;
  - a duplicate of another live card;
  - her policies set;
  - weight only when postage is calculated by weight.
- **Status:** no card listed from the portal yet. SHAVINGFUN (Massagers #36449, £27.49, quantity 5, 8 photos, keeps £4.25) failed with Product not found. The fix is delivered, not deployed.

### Approved page

- **The card:** Get it ready writes the title and description, finds photos, reads Amazon, sets the category and fills the item details.
- **Parcel:** takes kg or g, and offers Amazon's weight packed (×1.15, at least +50g, rounded up to 50g).
- **Photos:** go in by themselves (once deployed), and open large.
- **Amazon panel:** today's offer, warnings, and the risk note.

### Amazon suppliers (`supplier-read`, `0118`)

- **When it reads:** on add, before Get it ready, on Read again, and every morning at 7am London time (cron every 5 minutes from 6 to 7, gated to the London hour, 20 a call, 240 a day at most).
- **What it keeps:** the reading on `candidates.supplier_read`, and each check as a row in `supplier_checks`. A reading under 6 hours old is reused.
- **Supplier choice:** the card's chosen supplier URL first, else the cheapest Amazon UK source.
- **Later:** the daily price watch is to be discussed in depth.

### Listings (`live_listings`, `0119` to `0122`)

- Live on 1 October: 452 listings; 22 on both, 430 eBay only; 192 shop drafts and 238 not on the shop.
- **Draft blocker:** 186 of the 192 drafts wait only on Returns to confirm. A grouped returns screen was proposed, not confirmed.
- Her eBay averages: 1 in 99 opens bought, 1.6% of times shown opened.

### Shop and Stripe

- As in `02-state-2026-09-29.md`. Still to do before real orders: the refund test and switching Stripe to live.

### Pending deploy

- `ck-publish-photos-2026-10-01.zip`: deploy `ebay-list` and `ebay-queue`, plus the 6 portal files. No SQL.
