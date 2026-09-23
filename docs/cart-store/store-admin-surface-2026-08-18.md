# What she needs to run the shop

18 August 2026. Written because the orders page exposed a screen that does not
exist, and the way to stop finding those one at a time is to list all of them
once.

This is the whole surface, not a plan. The order is at the end.

Status against each item:

```
built        exists and works
partial      exists, does less than the name suggests
schema only  the column is there, nothing writes it and nothing reads it
nothing      does not exist in any form
hers         waiting on her, not on code
```

---

## The test

She is in control of the shop when she can do all of the following without
asking me and without opening a database client:

put a product on sale, take it off, change what it costs, change what it says,
say whether it is in stock, see what sold, send it, tell the buyer it has gone,
know what she was paid, and change what the shop says about itself.

Nine things. Six of them have no screen today.

---

## 1. Catalogue

The largest gap by distance, and the one blocking everything else.

```
take a product live               nothing      no screen writes store_products.status
take it back to draft             nothing      same
clear is_sample at launch         nothing      one flag, 78 rows, no control
edit price                        nothing      set by her in the scope, editable by nobody
edit title                        nothing      feed titles run past 80 characters
write a description               nothing      empty on all 78, the biggest single gap
edit specifications               schema only  filled 78/78 by enrichment, not editable
brand                             partial      65/78 from enrichment, no correction path
what is in the box                schema only  in_the_box, empty
choose the primary photograph     nothing      images jsonb exists, no ordering control
upload her own photographs        nothing      no storage bucket, no upload path
category and sub-section          schema only  set at seed, not editable
merchandising order               schema only  position column, nothing sets it
availability                      partial      enrichment sets it, she cannot
stock count                       schema only  stock column, deliberately nullable
dispatch days                     schema only  null on all 78, page currently silent
returns class                     hers         classified into three, wording with her
hazard data                       hers         7 classified mixtures, zero data
energy label                      hers         3 LED lamps, required for lighting
sku, mpn, gtin                    partial      gtin on 70/78, no edit
variants                          nothing      "Size 5, 6 and 7" is three products in one title
bulk actions                      nothing      78 rows one at a time is a week, not an afternoon
```

Two notes worth keeping.

**Nothing in the application writes `store_products.status`.** Not the portal,
not a script, not an edge function. The only writers are `seed-store.js` and
`enrich-store.js`, and neither touches status. So the shop cannot be opened
today by any means except a SQL statement, and that is the single fact that
makes everything below it theoretical.

**`derived_fields` is enforced nowhere.** The 0036 comment says a row carrying
`returns_class` in `derived_fields` has not been confirmed by anyone and must
not go live. Nothing checks it. Whatever screen takes a product live has to,
or a script's guess at a contract term ships on a lawyer's shop.

---

## 2. Orders

Nearly done, and the rest is small.

```
see an order                      built        the page shipped today
picking list                      built
address, copyable                 built
mark dispatched, tracking         built
confirmation email to the buyer   nothing      legally required, see below
notification email to her         nothing      today the first sale is silent
cancel before dispatch            nothing      status is not writable from the portal, correctly
refund                            hers         Stripe, and the webhook records it
resend a confirmation             nothing
internal note                     schema only  column exists, no screen
packing slip or label             nothing
find an order by email            nothing      fine at ten orders, not at four hundred
```

**The confirmation email is the legal one.** Regulation 16 of the Consumer
Contracts Regulations 2013 requires confirmation of the contract on a durable
medium, no later than delivery, and a web page is not one. The order page is
not a substitute. Until that email sends, every sale is non compliant, and it
is the reason it sits above the admin work rather than after it.

---

## 3. Delivery

```
free delivery threshold           partial      in tenants.store, no screen, see the bug below
postage rate                      partial      same
cutoff hour and transit days      partial      same
zone surcharges                   hers         four rows, all zero, numbers off her rate card
blocked destinations              built        Channel Islands, correctly
```

**Two bugs sit under this and neither is hers.** `loadTenant` does not select
`store`, so `storeConfig` falls back to its built in defaults on every load and
migrations 0040 and 0041 are dead in the browser. And the checkout function
drops the zone the browser sends it and computes delivery from its own
literals, so `delivery_zone` and `delivery_surcharge` will be null and zero on
every order until that is fixed. Nothing looks wrong today because the defaults
happen to match the row and every surcharge is zero.

---

## 4. Money

```
what was taken                    built        on the orders page, this month
Stripe fees                       nothing      not in the database at all
what landed in the bank           nothing      payout reconciliation, month two in the scope
cost of goods                     nothing      no cost column on store_products
margin per order                  nothing      follows from the above, not before
refund record                     partial      status only, no amount, no reason
VAT                               hers         not registered, and no line should appear anywhere
```

Margin per order is worth naming as absent rather than late. `store_products`
has no cost column and `candidate_id` is null on all 78 seeded rows, because
they came off her eBay listings rather than out of the pipeline. Until goods
cost reaches a product row, profit on the shop is not a number this database
can produce, and no screen should imply otherwise.

---

## 5. What the shop says about itself

```
legal pages                       nothing      src/data/legal.js, a file in the repo
about page                        nothing      src/data/about.js
blog posts                        nothing      markdown files, one folder for everybody
trader identity                   hers         3 of the 12 gold blocks stop trading
homepage voice                    partial      in tenants.store.voice, no screen
announcement bar                  nothing      hardcoded
support email                     partial      in tenants.store, hardcoded in 8 files
```

The legal pages are the awkward one. They are her contract terms sitting in a
shared repository, which is a confidentiality problem the moment a second
client can see the codebase, and it means she cannot correct her own terms
without me. `store_pages` with `(tenant_id, slug, title, blocks jsonb)` is in
the scaling document and it is the fix.

---

## 6. Customers and demand

```
who bought what                   nothing      no account system, correctly, but no list either
repeat buyers                     nothing
product requests                  built        a mailto, deliberately, and it says so
marketing list                    nothing      no table, no consent record
what people searched for          nothing      search events fire, nothing reads them
what was viewed and not bought    partial      store_product_funnel exists, no screen reads it
```

The funnel view is the loop back into the research pipeline and it is the one
thing on this list that makes the shop worth more than the sum of its orders.
A product with views and no adds is a price, photograph or description problem,
and that is a finding she can act on. It has no screen.

---

## 7. Access and configuration

```
who can sign in                   partial      auth exists, no management screen
notification address              nothing      where order emails go
palette, fees, scoring            partial      on the tenant row, no screen
data export                       nothing      promised in the scope, CSV, Excel, PDF
```

Export is worth building earlier than it feels. Built now it demonstrates the
ownership commitment is real. Built at the end it is a scramble under time
pressure during a termination.

---

## The order

Everything above is real. This is what it costs to ignore each one, which is
what actually decides the sequence.

**Before the shop can lawfully take one order from a stranger.**

1. A screen that takes a product live, with the `derived_fields` guard in it.
   Nothing else on this list matters until this exists.
2. The confirmation email to the buyer. Regulation 16, not a preference.
3. Trader identity in the legal pages. Three gold blocks, hers.
4. Returns wording signed off. Hers.
5. The seven chemicals: hazard data entered, or those products stay draft.

**Before she would show it to anybody.**

6. Descriptions. Twenty of the highest afford products first, because those are
   the ones that can carry a real margin.
7. The order notification email to her.
8. Price and title editing. A shop she cannot reprice is a catalogue.

**Before it is a business rather than a shop.**

9. Availability and stock control.
10. The funnel screen, which is the research loop.
11. Fees and payouts, which is month two in the scope anyway.
12. Legal and about content into tables.

**The two bugs go in with whatever ships next**, because they are ten minutes
each and both are the same mistake: a migration that shipped without the change
to whatever reads it.

---

## What is deliberately not on this list

Named so nobody adds them back by accident.

**Discounting.** `compare_at`, `compare_at_from` and `compare_at_to` are all in
the schema, so the lawful version is buildable. It is not needed to open a
shop, and a was price that was never charged is what Trading Standards writes
letters about.

**Customer accounts.** No account anywhere in the buying path is a design
decision, not an omission. Order history can exist later. It cannot exist
between a buyer and a payment.

**A packing slip.** Real, and it is a printing problem with its own decisions.
After the first ten orders have taught us what she actually writes on the box.

**Anything eBay.** Her eBay orders stay in eBay. The scope has her listing
products herself in month one so the pipeline proves itself against her
existing rhythm, and a half-built bridge between the two would undo that.
