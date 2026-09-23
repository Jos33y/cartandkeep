# Session summary, 18 August 2026

Brand assets finished, then the entire customer-facing storefront from a shell
to a working checkout. Roughly 90 files.

---

## 1. Brand and PWA

**42 PNGs rendered from 24 SVG sources**, byte-identical across two machines
because fonts load by path rather than through the OS. Ampersand extracted from
Inter 700 as path data, so the mark never waits on a webfont.

**The PWA is gated to the shop host.** One build serves `portal.`, `status.` and
the shop, so a static manifest would have made her review tool installable as "a
general store" and an auto-registered worker would have cached a candidate list
that changes on every import. The manifest is injected by hostname before
render, and `registerStore.js` unregisters a worker it finds on the wrong host,
because a worker installed once survives deploys.

**Precache went from 1,323 KiB to 736 KiB.** Font imports moved into the three
app chunks so the shop stops downloading Geist and IBM Plex Mono, and `woff2`
came out of `globPatterns` entirely, because fontsource ships every unicode
subset and precaching them put Vietnamese Archivo on a shopper's first visit.

Three things checked against the package rather than assumed: the family is
`'Archivo Variable'`, the width axis is a separate `wdth.css` import, and it is
set with `font-stretch`, not `font-variation-settings`. All three would have
been silent failures.

---

## 2. The storefront

Built in this order: shell, product card, home page, category page, product
page, cart, checkout, order pages, blog, legal, about, contact, 404.

**Signature elements.** The shelf, a panel that holds still while products
scroll past it, with arrows because snap scrolling says nothing to a trackpad.
Category tiles rather than a chip rail on the shop front, because on a general
store the departments are the merchandising. A hero with search as the primary
action and four products in a window with prices on them, because a window
without prices is a mood board.

**Loading states.** Skeletons in the exact geometry of what is coming, so
nothing shifts when products land, and a branded boot where the mark draws
itself. The sweep is warm to a lighter warm with no white in it, because a white
band on a cream page is the shimmer tell.

**Conversion work.** Quick view with a real focus trap. A mini basket that opens
on add and never navigates, because being thrown to a basket page ends the
browse. Delivery dates rather than durations, with England and Wales bank
holidays. A stock signal that only says what the database knows.

---

## 3. Payments

Three edge functions, self contained because the dashboard editor deploys one
folder.

- `checkout` creates the Stripe session and the order. The browser sends ids and
  quantities, never prices.
- `stripe-webhook` marks it paid. The success URL is not proof of payment.
- `order` reads it back with a reference and a token, compared in constant time,
  with the same 404 for a wrong token and a reference that never existed.

Orders and order items have RLS on and **no policies at all**. Everything
reaches them through a service-role function.

---

## 4. Compliance, which nobody had raised

**The returns sentence was wrong, not weak.** Statutory right is 14 days with
exclusions for sealed hygiene goods and consumables, and her catalogue is full
of both. Returns became a property of the product with three classes, and the
wording went to her.

**Seven products are classified mixtures under GB CLP**: carpet cleaner, Jeyes
Fluid, drain unblocker, herbicide, wasp killer, super glue, a kintsugi kit. Two
are also biocides carrying an HSE registration number. `screens.py` refuses
ingestibles and cosmetics and has no equivalent for chemicals, which is how they
reached the shop.

**Trader identity is legally required and absent.** Twelve "Needs confirming"
blocks now render in gold on the live legal and about pages, three of which stop
the shop trading at all.

**The homepage claimed prices include VAT.** She is not registered.

---

## 5. Data

**`enrich-store.js` was making a Browse call and keeping the category.**
Rewritten to take everything: brand, specifications, condition, GTIN,
availability, the seller's description and the whole GPSR `regulatory`
container.

```
brand                65/78    83%
condition            77/78    99%
gtin                 70/78    90%
source_description   78/78   100%
specifications       78/78   100%
availability         78/78   100%
hazard                0/78     0%
energy label          0/78     0%
```

GTIN on 70 is the sleeper win: it is what makes a Google Shopping feed possible.
Zero hazard data was predicted, because those containers are seller provided and
a GB bulk lister had no reason to fill them.

Brand cleaning caught two values carrying an invisible left-to-right mark from
an Amazon paste, "Unbranded" in two casings plus a bare dash, and three shop
names sitting in a brand field.

---

## 6. Analytics

First party, in Supabase, **storing nothing on the device**. Under PECR any
non-essential storage needs consent including localStorage, and a banner would
cost more than the numbers are worth on a shop this size. The session id is a
module variable that dies on reload, and it reaches Stripe and back by riding on
the order row.

Nine events and a `store_product_funnel` view giving views, adds and purchases
per product, with the add rate null rather than zero when nobody has looked,
because no data and a bad product are different findings.

---

## 7. Multi-tenancy

`docs/scaling-to-fifty-clients-2026-08-18.md`. The short version: the database
is multi-tenant and the front end is not.

```
free delivery threshold    5 components + 1 edge function
postage rate               4 components + 1 edge function
cartandkeep.com            12 files
support@cartandkeep.com    8 files
```

`storeConfig.js` and migration 0040 are the first piece of the fix. Delivery
zones followed: postcode validation through postcodes.io, which is free and
open, with zones derived from the outcode and tested on both sides of every
boundary. Every surcharge defaults to zero, so the mechanism ships and the
numbers come off her rate card. Channel Islands are blocked rather than
surcharged, because that is customs rather than postage.

---

## 8. Migrations

```
0036_store_product_detail    24 columns the product page needs
0037_orders                  orders and order_items
0038_order_dispatch          dispatched_at, carrier, tracking
0039_store_events            analytics, funnel view, prune
0040_tenant_store_config     tenants.store
0041_delivery_zones          zones, all surcharges zero
```

---

## 9. Still blocking, none of it code

- 78 products still `draft` and `is_sample`, so the shop is empty to a stranger
- 12 gold blocks awaiting her, 3 of which stop trading
- 7 chemicals with no hazard data
- 78 empty descriptions
- 4 delivery surcharges at zero
- Visa and Mastercard marks not downloaded, so the footer payment row is empty

---

## 10. Next

The portal orders page. The customer chain works end to end and the first order
that lands is invisible to her unless she opens the Stripe dashboard.
