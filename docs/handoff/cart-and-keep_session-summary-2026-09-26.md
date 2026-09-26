# Cart & Keep, session summary

**26 September 2026** | The Brick Dev Studios | Internal

Storefront session: product page finished, the catalogue rebuilt for 1,000+ products, the department page, the header and search, every page moved onto the new foundation, a layout standard with a checker, and a repo clean-up. Portal audit at the end sets the next chat.

---

## What was delivered, in order

| Zip | What it did |
|---|---|
| `ck-product-fixes` | Section names looked up in her names; Look closer fits tall photos; repeated supplier sentences shown once; tall right column holds at its bottom edge |
| `ck-foundation-phase1` | Migration `0101_catalogue_browse.sql` plus the data layer (see below) |
| `ck-department-phase2` | Department page on the foundation: filter rail, sticky toolbar, fluid cards, load track, everything in the address |
| `ck-layout` | Layout checker, header height published live, header rail on the database, header search panel closes on keyboard exit |
| `ck-compact` | Slim header rail with a sliding shelf board, no rail tucking (the scroll glitch), tighter cards, filter rail is filters only |
| `ck-audit-fixes` | Footer marks small, footer sections from the database, Add label only on wide cards, no drawn ledge on the page head, arrival said once, filters only when they can narrow |
| `ck-quickview-fit`, `ck-quickview-photos` | Quick view fits a 13-inch laptop; quick view loads the full product (every photo, real sizes) |
| `ck-phase3` | Home, product page, header search, saved count, saved page and search all off the whole-catalogue load; drafts no longer leak into previews |
| `ck-finish` | Quieter add buttons, one search with a section chip, slimmer header and announcement line, phone search pill, shorter hero title on short screens, shelves end with their products, sitemap from the database, `0011` fixed |
| `ck-0040` | `0040` guarded: skips when `email_events` does not exist (it never did) |
| `ck-rename-fix` | My hook and data module renamed so they cannot collide with the portal's (see Incident) |
| `ck-search-chip` | Rotating examples give way to a plain prompt when the section chip shows |
| `ck-portal-drafts` | Draft function: customer copy never mentions the supplier or photograph; empty answers are empty; one-off clean-up SQL |

All deployed and building. Repo cleaned with knip and `cleanup-repo-2026-09-26.ps1`.

---

## The catalogue foundation

**Migration `0101_catalogue_browse.sql`**, replayed on Postgres 16 over all migrations and run live.

- `search_doc` generated column with a GIN index, plus trigram on title: prefix and typo-tolerant search
- Size summary on each product (`variant_count`, `variant_min`, `variant_max`, `variant_unpriced`, `variant_buyable`), kept by a trigger on `store_variants`
- `store_cards` view (security invoker): what a card needs
- `store_card_matches`: the one filter test shared by pages and counts
- `store_browse`: one page of cards, six sorts, capped at 96, plpgsql with literal values so each request is planned for its own filters
- `store_facets`: counts per section, brand, in stock, dispatch days, and a 12-band price histogram; each count excludes its own filter
- `store_groups`: each group's count, price range, first three photos
- Live and not a sample, whoever is signed in. "In stock" uses the same rule as the Add buttons.

Timed at 10,000 products: first page 15 to 23 ms, filtered 7 ms, search 93 ms, counts 62 ms.

**Client side**

- `src/lib/storeCatalogue.js`: pages, counts, groups, one product, cards by id
- `src/hooks/useStoreCatalogue.js`: `useGroups`, `useBrowse` (with `limit` and `enabled`), `useFacets`, `useProduct`, `useCards`, `prefetchProduct`
- `src/hooks/useBrowseParams.js`: every filter in the address
- `src/utils/categories.js`: `groupsFromCounts`, `addressOf`, `LEFTOVER_NAME`

No page loads the whole catalogue any more. `useStoreProducts.js` stays for its buyable rules only.

---

## Settled, do not reopen

- Addresses come from her names; old eBay addresses redirect. The catch-all group is **Odds and ends** on the shop; its key stays `Everything else`.
- Groups with the same name merge into one shelf.
- The header rail is the section navigation; the department page has no second row of tabs and no breadcrumb.
- One search, in the header, scoped to the section you are on by a removable chip. `/search` redirects to `/shop?q=`.
- The filter rail stays, even for small catalogues.
- A filter only shows when it can narrow the list. Under 12 products, no price histogram.
- The arrival day most products share is said once in the page head; a card only states its own when it differs.
- Add buttons are white with a terracotta plus and fill terracotta on hover, focus or press.
- Short laptops (under 700px tall) get smaller cards, a smaller hero title and a leaner return window.
- Header: 32px announcement line, 60px bar (56px on phones), 44px rail that never tucks.
- Customer copy never mentions the supplier, the photograph, the source or any doubt.
- Every new listing starts with a stock of 5 unless she changes it.
- Portal first, then basket and checkout.

---

## Incident: a file overwritten

Phase 1 created `src/hooks/useCatalogue.js`, a path the portal already used for readiness (`checksFor`). The collector had not picked the file up and the path was not checked. The build failed on `readiness.js`.

Fixed: the portal's file restored from `c008b85`, mine renamed to `useStoreCatalogue.js` and `storeCatalogue.js`, my stray `src/lib/catalogue.js` removed. Rule added to the ways-of-working file: never create a file at a path without proving it is free.

---

## Open

**Next chat, in this order**

1. **Product sheet.** One AI pass that fills every field; three title options to tap (search-first, short, feature-led; private-label brands never lead); checks split into *Decide* (one-tap choices, e.g. 50 kg or 150 kg) and *Done for you*; details cleaned and completed from the supplier text; one review, one save, pinned footer; panels and chips in one order (what it is, selling it, the rules, the checks).
2. **Bring to the shop.** On Traffic, mark *On your shop* or *Not yet*; "Add to shop" per row and in bulk; import from the eBay listing with the AI pass run at once; a *New from eBay* review queue; careful goods routed (biocides, supplements, electricals, branded, sealed); price-floor note; stock 5 by default.
3. **Stock decision before anything goes live:** A, one shared count across eBay and the shop; or B, a split.
4. Then basket and checkout.

**Collect first:** the product sheet and its panels, the Products page, the Traffic page and its hook, `supabase/functions/ebay-item` and `ebay-list`, `readiness.js`.

**Portal fixes seen in the audit**

- Returns options say 30 days; her shop says 14. Returns wording must come from her settings.
- A product shows Live with checks unread in red: either reading gates going live or the badge should not look like a blocker.
- The cost panel says "No cost yet" and still shows earnings bars.
- The description placeholder still says "anything the photograph does not show".
- A draft identical to what is saved is shown twice; two terracotta buttons stacked.

**Still to check on real hardware:** a real iPhone and Safari.

**Parked by Joseph:** her data (bed rail load, Behringer details, Halloween kit price, official payment marks).
