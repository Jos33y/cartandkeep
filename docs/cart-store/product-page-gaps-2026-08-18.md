# Product page, what is missing

18 August 2026. Written after the first real product pages rendered against her
catalogue and two of them turned out to be wrong rather than thin.

This is not a design list. Everything here is either data that does not exist
yet or a claim the shop is making that it should not be making.

---

## 1. The returns sentence is wrong, not weak

The page currently says, on every product:

> 30 days to change your mind. Send it back unused and we refund the lot.

Three problems, in order of seriousness.

**It is silent on the exclusions.** The statutory right under the Consumer
Contracts Regulations 2013 does not apply to sealed goods unsuitable for return
on health or hygiene grounds once unsealed, to perishables, or to personalised
items. Her catalogue is full of the first category: a luxury pamper gift set
with bath products in it, jock itch cream, a shampoo and conditioner set,
incontinence pads, suppositories. Offering an unconditional return on those and
then refusing one is worse than never offering it.

**It cannot be true of a consumable.** A 4 litre bottle of carpet cleaner, a
5 litre drum of white vinegar and a pack of super glue cannot come back
"unused" in any meaningful sense once a customer has decided they do not want
them. The sentence reads as though nobody looked at the product it was printed
under, because nobody did.

**"We refund the lot" is ambiguous about return postage.** The regulations
require refunding the standard outbound delivery cost. They do not require the
trader to pay for the return unless the trader failed to say so. As written it
reads like a promise to cover both.

**What has to happen.** Returns text becomes a property of the product rather
than a line in a component, with a default and a per product override. Three
classes cover the whole catalogue:

```
standard   14 day right, extended to 30 as a goodwill term
sealed     returnable only while sealed, on health or hygiene grounds
none       consumable or perishable, statutory rights unaffected
```

The last clause matters on all three. Nothing here removes the right to reject
faulty goods under the Consumer Rights Act 2015, and the page must say so.

**This is hers to sign off, not mine to write.** She is a lawyer, the wording
is a contract term, and the studio should not be drafting one.

---

## 2. Hazardous products, which nobody has raised on this project

Her catalogue includes at least six products that are classified mixtures under
GB CLP: Vax Ultra+ carpet cleaner, Jeyes Fluid, Mr Muscle drain unblocker,
Rootblast herbicide, KARLSTEN wasp and nest killer, and Loctite power gel.

Two separate duties sit behind that.

**Hazard information on the offer.** For online sales, an offer for a hazardous
mixture is expected to carry the label elements, pictograms, signal word and
hazard statements, rather than leaving them to a safety data sheet the buyer
never opens. The EU tightened this for distance sales from 1 July 2026, and
placed the information near the price or the buy button. Great Britain runs its
own GB CLP and the precise GB position needs checking, but Northern Ireland
follows EU CLP and she ships UK wide.

**Biocides.** Jeyes Fluid and the wasp killer are biocidal products. Those
require HSE registration before sale and the registration number on the label.
That is the supplier's duty in the first instance, but a seller placing them on
the market is not outside it.

**What has to happen.** Either the product record carries the hazard fields and
the page renders them, or those six products come off the shop until it does.
The second is a legitimate answer for this week and the first is the answer for
next month.

`screens.py` already refuses ingestibles and cosmetics on the research side.
There is no equivalent screen for hazardous mixtures anywhere, which is how
they reached the seed.

---

## 3. Data the page needs and does not have

Every one of these is empty on all 78 rows, because the seed carried title,
price and image and nothing else.

```
description        the only place a product can persuade. Empty on all 78
brand              on screen in the photograph and nowhere in the data
specifications     size, weight, material, capacity, contents
what is in the box a five piece pan set is five what, exactly
variants           "Size 5, Size 6 and Size 7" is three products in one title
stock              nothing distinguishes in stock from discontinued
dispatch time      the page says same day for everything, on no evidence
sku, mpn, ean      needed for search, for feeds, and for her own records
delivery estimate  "2 to 3 days" converts worse than "arrives Thursday"
hazard data        pictogram, signal word, H and P statements, see above
returns class      see above
energy label       required for lighting. She sells three LED lamps
age restriction    none currently apply, but the field is cheap now
```

**Descriptions are the biggest of these by distance.** The page currently has a
title, a photograph and three promises. Nothing else on it argues for the
purchase. Seventy eight descriptions is a real piece of work and it is hers or
a writer's, not the pipeline's, because a description written from a supplier
feed title is the same feed title with more words.

---

## 4. Discounting, which does not exist

`store_products.compare_at` exists and nothing writes to it. There is no
mechanism at all for:

```
a sale price with an end date
a promo code at checkout
a basket threshold discount, spend 50 save 5
a bundle, buy the pan set and the washing up bowl
free delivery as a promotion rather than a permanent threshold
```

Worth knowing before building any of it: a struck through price is a price
claim, and the Digital Markets, Competition and Consumers Act 2024 tightened
what has to be true for one. The was price has to have been the actual selling
price for a meaningful period. A `compare_at` typed in to make a product look
discounted is the kind of thing Trading Standards writes letters about, and it
is exactly the kind of thing a dropship feed will happily supply.

So `compare_at` needs a companion field recording when that price was actually
charged, or it should not be used at all.

---

## 5. Trader information, which is legally required and missing

The footer carries an email address. Distance selling requires the trader's
identity, geographic address and contact details before the order.

```
trading name and legal status
geographic address, not a PO box
company number, if she is trading through one
VAT number, or nothing if she is not registered
```

She is not VAT registered, so no VAT line should appear anywhere, and the
homepage line about prices including VAT has to go. It said "prices include VAT
where it applies", which is true only in the sense that it applies nowhere.

---

## 6. What I would do about it this week

Month one is due Saturday and none of this is on the deliverables list, so the
honest order is:

**Now.** Fix the returns sentence to something that is true and short, and put
the wording in front of her. Take the six hazardous products off the seed.
Delete the VAT line.

**Before she reviews the shop.** Add the fields in migration 0036 so the page
can render what exists and stay quiet about what does not.

**Next week.** Descriptions. Twenty of the highest afford products first,
because those are the ones that can carry a real margin, and the rest as the
catalogue settles.

**When the catalogue is real.** Variants, stock, delivery estimates,
discounting with a lawful was price.

---

## 7. The copy itself

You were right that it reads like it was written by somebody who had just
finished a course. The tell is that it explains.

Amazon does not write "30 days to change your mind, send it back unused and we
refund the lot". It writes "Returns: Eligible for return within 30 days of
receipt" and links out. John Lewis writes "Free standard UK delivery on orders
over £50". Apple writes "Free delivery. Free returns." and nothing else.

The pattern is a label, a fact, and a link for anyone who wants the detail. No
adjectives, no reassurance, no explaining how generous the terms are. Confidence
in a shop reads as brevity, because a shop that is sure of its terms states them
once.

So the block becomes a specification list rather than three sentences, and
every value in it comes from the product record rather than from a component
that assumes every product is the same.
