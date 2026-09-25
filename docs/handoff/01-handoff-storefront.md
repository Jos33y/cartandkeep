# Handoff: Cart & Keep storefront, marketing, legal and help pages

Paste everything below the line into a new chat in this Project.

---

I am Joseph John, The Brick Dev Studios. We are continuing the Cart & Keep build. The portal's Your shop section was finished and deployed on 24 September 2026 (summary in `02-session-summary-2026-09-24.md`). This chat is the storefront at cartandkeep.com, what customers see.

Read before doing anything: the `brick-dev` skill, `design-standard.md`, `comment-rules.md` and `03-how-we-work.md`. The last one is how this collaboration runs. Follow it exactly.

## The bar

The storefront has to be visually better than the portal, not equal to it. The portal is a tool she opens daily; the shop is what a stranger judges in three seconds before deciding whether to trust a card number to it. Every screen should pass the design standard's test: a screenshot with no explanation makes someone assume an expensive team built it.

The customer is someone buying a care or mobility aid for a parent, a replacement part because something broke, or a specific named model. They arrive knowing what they need, often worried or in a hurry, often on a phone. Trust, calm and speed beat novelty. The shop has to feel like a real, careful British business, not a dropshipping template.

## Order of work, one page at a time

1. **Marketing sections**: home page (hero, shelves, the band promising requests), About, the footer with the mailing list box, the blog index and a post.
2. **Legal pages**: delivery, returns and refunds, terms of sale, privacy, cookies. Points still needing her confirmation are marked on each page and must stay visible to her, not to customers.
3. **Help pages**: frequently asked questions, contact, the request page (`/request`), order tracking and the receipt page a customer keeps, unsubscribe.
4. **Only then product**: department pages, product page, search, basket, checkout.

## First thing to do

Do not design yet. Ask me for:

- a tree of `src/pages/store`, `src/components/ui/store` and `src/styles/pages/store`, so a collector script can request exact paths,
- screenshots of the live home page, About, one legal page and the FAQ at desktop (about 1320px) and phone (390px) width,
- the store router file, so routes and page names are exact.

Then send a collector script for the home page files only, audit what exists against the design standard (a senior frontend audit, specific and numbered), propose one visual direction for the whole storefront in a few sentences, and wait for my yes before building.

## Facts to carry

- Stack: React and Vite, Supabase (Postgres, edge functions), CSS Modules with design tokens. Portal and store share one repo.
- Store config comes from `tenants.store` through `src/lib/storeConfig.js`. Delivery keys are now snake case in the database (`free_over`, `cutoff_hour`, `transit_min`, `transit_max`) and mapped for the shop on load. Nothing client-specific is written into code.
- Delivery promise today: free UK delivery over £40, otherwise £3.95, order by 2pm for same day dispatch, 2 to 3 working days. Channel Islands blocked. Always read these from config, never type them into a page.
- Returns: 30 days to change your mind, return postage paid by the shop (the receipt says this; check the legal page agrees).
- Her own sections: products carry a `section` that overrides the eBay department; a section appears on the shop once it holds 3 live products.
- Reviews appear on product pages only when she has approved them. A product with no reviews shows no rating, never 0.0.
- Google Search Console is not connected yet. Do not claim search reports or dates anywhere.
- Trading details: she is a sole trader; the legal name on receipts should be her own name with Cart & Keep as the trading name. Confirm with me before any legal page states it.
