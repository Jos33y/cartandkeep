# Cart & Keep, handoff

18 August 2026, end of the storefront build. Written because this session got
long enough that I reintroduced a footer bug I had already fixed, which is the
signal to hand over rather than push on.

---

## Where the storefront is

**Customer facing is complete.** Every route renders something real, nothing is
a stub, and no link in the shop goes anywhere that does not exist.

```
/                 hero, trust strip, departments, shelves, promise band
/shop             whole catalogue, sub-sections by department, sort
/c/:slug          department, banner, leaf sub-sections, sort
/p/:slug          gallery, brand, specs, supplier text, terms, sticky buy bar
/search           URL-driven, ranked title over brand over category
/saved            hearts, on device, no account
/cart             lines, quantities, free delivery nudge
/checkout         one page, postcode zone check, Stripe redirect
/order/:reference paid, confirming, dispatched, refunded
/orders           lookup by reference and email
/about            also the SEO landing page
/contact          trader identity, three prefilled subjects
/blog, /blog/:slug markdown from src/content/blog
/legal/:slug      delivery, returns, terms, privacy, cookies, faq
*                 404 with search and departments
```

**Payments work end to end** against Stripe test keys. Three edge functions:
`checkout` creates the session and the order, `stripe-webhook` marks it paid,
`order` reads it back with a reference and a token. Prices are read from the
database and never accepted from the browser.

**Analytics are first party and store nothing on the device**, so there is no
consent banner. Nine events, a `store_product_funnel` view, and a ninety day
prune function.

---

## What is blocking, and none of it is code

**All 78 products are `draft` and `is_sample`.** Anonymous visitors see an empty
shop, correctly, because the read policy excludes both. Nothing can be bought
and the sitemap has no catalogue in it until she approves them.

**Twelve gold "Needs confirming" blocks render on the live legal and about
pages.** Three of them stop the shop trading at all: trading name, geographic
address, company number. Distance selling requires these before an order is
placed.

**Seven products are classified mixtures with no hazard data.** eBay had none
because those containers are seller provided. Somebody reads the labels or they
come off.

**Descriptions are empty on all 78.** Every product page falls back to the
supplier's text in a panel labelled as theirs.

**Delivery zone surcharges are all zero.** The mechanism ships, the numbers come
off her carrier's rate card. Four rows.

---

## Migrations to run, in order

```
0036_store_product_detail.sql    24 columns the product page needs
0037_orders.sql                  orders and order_items, RLS on, no policies
0038_order_dispatch.sql          dispatched_at, carrier, tracking
0039_store_events.sql            analytics, funnel view, prune function
0040_tenant_store_config.sql     tenants.store, seeded with her values
0041_delivery_zones.sql          zones, all surcharges zero
```

0040 before 0041; the second writes into the object the first creates.

---

## Known issues, ranked

**1. `store_events` anon insert accepts any tenant_id.** The id is visible in
the network tab, so at multiple clients anyone can pollute anyone's analytics.
Fix is routing events through an edge function that reads the tenant from the
`Origin` header. Low severity at one client.

**2. Client two is a fork, not a row.** See
`docs/scaling-to-fifty-clients-2026-08-18.md`. The delivery threshold is still
hardcoded in five components even though `storeConfig.js` now exists, because
the call sites have not been swapped over. That swap is the next mechanical
task and it is about an hour.

**3. `useStoreProducts` fetches the whole catalogue on every page.** Right at
78 products, wrong at 2,000. The comment saying so is in the file.

**4. No bot filtering in analytics.** Views will inflate the day the sitemap is
submitted.

**5. No rate limit on the checkout function.** Unlimited pending orders.

---

## What I would do next, in order

1. **The portal orders page.** The customer chain works and the first order that
   lands is invisible to her unless she opens Stripe. `PORTAL_ROUTES.ORDERS`
   exists and points at a page that has never read the table.
2. **Order emails**, through Resend on `relay.cartandkeep.com` with
   `notify@relay.cartandkeep.com`. One to her when an order is paid, one to the
   customer. Both fire from the webhook, which already runs at the right moment.
3. **Swap the five hardcoded delivery thresholds** to `storeConfig`.
4. **Search overlay** from the header, which is the piece that makes browsing
   feel current rather than 2018.
5. **Price filter** on the category page.

---

## Things worth not relearning

- **Afford, not headroom, is the sourcing number.** One answers what margin
  remains, the other what goods are allowed to cost.
- **A route verdict is not a product verdict.** The most repeated correction on
  this project.
- **Never defend a number that was asserted rather than computed.** Check what a
  filter does to a finding before trusting the finding.
- **The mock was worth building once and not twice.** After the direction was
  settled, a parallel HTML file was a second implementation that could drift.
- **Every page appears in the footer exactly once.** This has been broken twice.
