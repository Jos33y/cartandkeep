# What the portal does not have yet

20 August 2026. Written after looking at a competing admin built for a single
category hair shop, which surfaced a list of features Cart & Keep has no
equivalent of.

This is for you to review and cut. Nothing here is started. Ordered by what I
would do first, with the reasoning, so disagreeing with the order is a
one-line answer rather than an argument.

Two things I said earlier that were wrong and are corrected below. I said what
remained was small, and it is not. I said the shop dashboard comes last, and
looking at a good one, it should be first.

---

## 1. Shop dashboard

**Nothing like it exists.** Overview belongs to the research pipeline, not to
the shop. There is no screen that answers what to do this morning before she
has clicked anything.

```
what needs doing        orders to send, low stock, products blocked from
                        going live, returns classes still unconfirmed
money                   taken today, this week, this month, across all channels
what is happening       recent orders, newest customers
what needs her          the gold blocks, the seven chemicals, empty
                        descriptions, all with a link straight to the screen
quick actions           add a product, take products live, import channel sales
```

Everything on it already exists in the database. This is assembly rather than
new machinery, and it is the screen that makes a portal feel like an instrument
rather than a filing cabinet.

**Why first.** It is the screen she opens. Every other screen on this list is
one she navigates to, and a portal whose front door is somebody else's tool is
a portal that feels like it was built for somebody else.

---

## 2. Variants, and stock per variant

**The one her own catalogue already needs.** "Size 5, 6 and 7" is three
products sitting inside one title on her shop right now, and the same is true
of any bedding in a double and a king.

Today a product has one price, one stock number and one photograph set. So a
buyer cannot choose a size, she cannot count what is left of each, and the
shop cannot refuse the one that has run out.

```
variant                  a size, a colour, a length, a pack size
per variant              its own price, stock, barcode and sometimes photograph
on the product page      a chooser that does not let somebody buy what is gone
on the basket line       which one they picked, carried onto the order
in the portal            stock per variant, low stock per variant
```

**Why second.** It is the only item on this list that is already wrong rather
than merely absent, and it touches the storefront, the basket, the checkout,
the order record and the products screen. That makes it the most expensive
thing to add later and the cheapest to add now.

**Honest size.** This is the largest single item here. Two days rather than
one, and it changes tables that orders already point at.

---

## 3. Customers

**Orders exist, customers do not.** There is no way to see that somebody has
bought three times, and no list of who has ever bought anything.

```
who bought               name, email, where, first order, last order
how much                 total spent, order count, average
what they bought         their orders, in one place
returning against new    Section 5, month one, currently unbuildable
```

**Why third.** It is a month one commitment in the scope rather than a nice
addition, and it is the asset a marketplace never lets a seller keep. On eBay
the buyer belongs to eBay. On her own shop the buyer belongs to her, and right
now the portal does nothing with that.

No account system needed. Grouping orders by email address gives all of it.

---

## 4. Categories she controls

**Sections are derived, not managed.** Grouping comes from eBay's category path
and folds anything under three products into "Everything else". She cannot
create a section, rename one, reorder them, or decide which appear in the
navigation. She can only file a product into one that already exists.

```
create and name          a section that is hers rather than eBay's wording
order                    which comes first on the shop front
what shows in the nav    currently a hardcoded list of six in three files
an image                 the category tiles use a product photograph today
hide                     a section that exists but is not ready to show
```

**Why fourth.** It unlocks merchandising she currently cannot touch, and the
hardcoded navigation is a landmine: a new section exists in the shop and is
unreachable from the header until somebody edits three source files.

---

## 5. Low stock and alerts

```
a threshold per product   or one figure for the whole shop
a count on the dashboard  2 low, 0 out
a warning before zero     rather than after
negative margin alert     Section 5 commits to this, and the margin figures
                          now exist to build it on
```

Small. Mostly a query and a place to put the answer.

---

## 6. Archive

Draft and live is the whole vocabulary. A product she has stopped selling has
to be deleted, which takes its sales history with it, or left as a draft
alongside the ones she has not finished. Those are different states and the
screen cannot tell them apart.

One column and a filter.

---

## 7. Coupons

```
a code                    percentage or an amount off
conditions                minimum spend, first order only, one product,
                          one category
limits                    total uses, uses per customer, an end date
tracking                  what each code cost and what it brought in
```

**Worth saying about this one.** In a diaspora community a referral code is the
growth mechanism rather than a discount, and it is the difference between a
customer telling one friend and a customer telling ten.

**And a caution.** A code is safe. A struck through was price is not: the
Digital Markets, Competition and Consumers Act 2024 requires the higher price
to have actually been charged for a meaningful period. That is why
`compare_at` is still deliberately unused.

---

## 8. Subscribers

The promise band on the shop is a `mailto:` today, deliberately, because there
was nowhere to put an address and no consent record. So there is no list, no
export, and no way to tell anybody a product is back.

```
capture                  homepage, footer, checkout, with a source on each
consent                  when, from where, and a working unsubscribe
export                   CSV, so the list is hers rather than ours
```

**The compliance part is the whole part.** Under PECR a marketing email needs
consent or a narrow soft opt-in, and the record of that consent is what makes
the list usable rather than a liability. Getting this wrong is worse than not
having it.

---

## 9. Messages

A customer replies to an order email and it lands in Zoho with no link back to
the order. A thread against an order, visible in the portal, would put the
conversation where the parcel is.

Real, and the least urgent thing here at her volume.

---

## 10. Export

The scope commits to CSV, Excel and PDF. None exists.

Worth building earlier than it feels. Built now it demonstrates the ownership
commitment is real. Built at the end it is a scramble under time pressure
during a termination.

---

## Also outstanding, from before today

Not from the competitor list, and not superseded by it.

```
reviews                  social proof under the buy button. The store design
                         document names it as one of six things separating
                         shops converting at 5 to 8 per cent from the 2.3
                         per cent average, and it is the only one not built
bulk description editing 78 descriptions, one at a time
order search             by email or reference. Furniture at ten orders,
                         needed at four hundred
internal note on order   the column exists, no screen writes it
packing slip             both platforms print one, she copies an address
shipping labels          Royal Mail Click and Drop takes a CSV
her trading name         lives in two places since I put it on the tenant row,
                         and legal.js still holds the other copy
anonymous event writes   still accept any tenant id, known since the scaling
                         document and unfixed
```

---

## What I would do, in order

```
1  shop dashboard          assembly, and it is the screen she opens
2  variants and stock      already wrong rather than absent, and the most
                           expensive thing on this list to add later
3  customers               month one in the scope, and the asset a
                           marketplace never lets a seller keep
4  categories              unlocks merchandising, and defuses the hardcoded
                           navigation
5  low stock and alerts    small, and completes a Section 5 line
6  archive                 one column
7  coupons                 growth rather than discounting
8  subscribers             build the consent record properly or not at all
9  export                  earlier than it feels
10 messages                least urgent at this volume
```

---

## What this list does not change

The shop is still dark, the emails have never sent, and no payment has been
made. Every item above is worth building and none of it is worth building
instead of proving that the chain works.

Both can be true. This is the build list; the lifecycle test is a separate
twenty minutes and it does not compete with any of it.
