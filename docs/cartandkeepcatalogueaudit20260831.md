# Catalogue Audit, eBay Store

**Cart & Keep** | Prepared by The Brick Dev Studios | 31 August 2026

---

## What was examined

Every one of the 282 live listings on the store was pulled from eBay individually and checked against two things: what it has actually sold since it went live, and what the rest of the eBay UK market charges for the same product.

Method, so the figures can be checked independently:

- Each listing was resolved through eBay's own item API by its listing ID, 564 calls in total
- Lifetime units sold were read from eBay's availability data on each listing, not estimated
- Listing age was read from the original listing date, so a sold figure of 1 on a 16 day old listing is a real rate, not an average
- A separate keyword search was run per product to establish the median price the market is currently charging
- Every listing was then costed against the full fee and postage stack to work out the highest price the goods could have been bought at and still returned a profit

Nothing in this document is a projection. It is all measured.

---

## The cost model used

Every figure below rests on this. It is stated in full so it can be argued with.

| Item | Value |
|---|---|
| eBay final value fee | 12.8% of the sale |
| eBay fixed fee per order | £0.30 |
| Promoted listings allowance | 3% of the sale |
| Postage, Evri to 5kg | £2.62 |
| Packaging | £0.40 |
| Returns and losses allowance | £0.30 per order |
| Target profit per unit | £5.00 |

Fixed cost per order before eBay's percentage: **£3.62**

This produces a hard floor. Below a selling price of **£10.24**, the fixed costs plus the £5.00 target consume the entire sale before a single penny is spent on the goods. A listing priced under £10.24 cannot return £5.00 no matter which supplier is used or how cheaply the item is bought.

---

## Headline findings

**272 of the 282 listings, 96.5%, have never sold a single unit.**

Ten listings produced everything the catalogue has done: **12 units and £242.14 gross** over roughly two weeks of trading.

| Verdict | Count | Share | Meaning |
|---|---|---|---|
| Never | 108 | 38.3% | Priced below the floor. No supplier price returns the target. |
| Dead | 167 | 59.2% | Priced viably, but nothing has sold. |
| Price | 1 | 0.4% | Selling, but priced far away from the market. |
| Pass | 6 | 2.1% | Selling, and the margin works. |

These are three separate problems and they need three separate answers.

---

## Problem one: 108 listings are priced below the floor

These are not marginal. The prices run £3.37, £5.71, £7.04, £7.20, £8.30, £9.36. Every one of them sits under the £10.24 line.

The more revealing detail is that most of them are priced **below** the market median, not above it:

| Listing | Listed at | Market median |
|---|---|---|
| 2 Pack Exfoliating Shower Towel | £7.20 | £11.69 |
| Steel Grab Rail 300mm | £8.30 | £12.04 |
| 8L Bin Bags 100 Count | £5.76 | £12.99 |
| Tena Men Active Fit Protector | £9.61 | £20.95 |
| Volufiline 92% Serum | £10.03 | £16.44 |
| Vicloon 24 Pcs Flash Duster Refills | £9.61 | £14.09 |
| World Cup Wall Chart 2026 | £3.71 | £8.64 |

That pattern is the signature of a fixed percentage markup applied to a supplier cost, with no reference to what eBay buyers are actually paying. The Tena protector is listed at less than half what the market charges. The bin bags at 44%. Money was left on the table and the listing still could not pay.

**A small number of these were sold.** Three units went out at £7.20, £8.71 and £8.30. To have broken even at zero profit, the goods behind them would have needed to cost £2.44, £3.71 and £3.37 delivered. For a 300mm steel grab rail that is not realistic. Those three sales are the ones worth examining closely, because a sale on a listing priced below the floor is worse for the business than no sale at all.

---

## Problem two: 167 listings are priced correctly and still do not sell

This is the more important finding, because it cannot be fixed by repricing.

The margin on these is fine. The bin liners, gel pens, over-door hooks, blind valance clips, duster refills, sticky pads and panty liners are all costed to work. Nobody has bought one.

Two things explain it.

**The products are commodities.** A buyer searching for bin liners or over-door hooks is shown forty near-identical listings. eBay ranks the established sellers first, and a buyer choosing between forty identical items has no reason to select a new account. Being cheaper does not fix this, and in several cases the listings already are cheaper.

**The titles carry brand names that carry no search volume.** NANDEYIBI, ilauke, Namvo, Vicloon, YuZhou, OBODING, ASelected, Greadio, McKLords, Aieve. These are Amazon private-label names. On Amazon they are attached to an existing product page with existing reviews. Transplanted to eBay they are dead weight in the title, occupying the character positions where searchable terms should sit.

If the reported view figures of 50 to 100 per listing are accurate, the catalogue has generated somewhere near 21,000 page views and converted 12 sales. That is roughly 0.06%. A functioning eBay listing converts between 1% and 3%. The traffic is not the problem. Buyers are arriving, looking, and choosing somebody else.

---

## What actually sold

All ten listings that have made a sale:

| Verdict | Listed at | Market | Sold | Days | Product |
|---|---|---|---|---|---|
| Pass | £34.67 | £26.87 | 2 | 16 | Behringer UCA222 USB Audio Interface |
| Pass | £22.55 | £26.64 | 2 | 16 | Rice Water Shampoo and Conditioner Set |
| Pass | £23.41 | £22.99 | 1 | 18 | Bed Rails for Elderly Adults, Adjustable |
| Pass | £14.05 | £14.73 | 1 | 16 | Blagdon Minipond Hosetail Fittings |
| Pass | £13.47 | £14.00 | 1 | 16 | TENA Lights Light Liner, 140 |
| Pass | £13.34 | £16.18 | 1 | 18 | Elderly Disabled Scoop Plate, Suction Base |
| Price | £39.22 | £10.99 | 1 | 27 | LED Makeup Mirror 10X Magnifying |
| Never | £8.71 | £9.52 | 1 | 16 | Mineral Powder Sunscreen Brush SPF 50 |
| Never | £8.30 | £12.04 | 1 | 16 | Steel Grab Rail 300mm Healthcare |
| Never | £7.20 | £11.69 | 1 | 16 | 2 Pack Exfoliating Shower Towel |

The six that clear the target account for 8 units and £178.71.

---

## What the sold list is telling us

Four of the ten are care and mobility products: the grab rail, the bed rails, the scoop plate and the TENA liners. Three of the six profitable listings sit in that group. Out of 282 listings covering everything from face paint to CD players, the sales concentrated in one place.

That is not a coincidence, and it fits the buying behaviour exactly. Nobody browses for a scoop plate. Somebody caring for a parent with dementia searches for one, today, because they need it today. Brand loyalty is low, price sensitivity is low, and the buyer wants the problem solved rather than the best deal found.

The Blagdon Minipond hosetail is the same mechanism in a different category. It is a replacement part. Nobody wakes up wanting one. A pond pump fails, the owner searches for the exact fitting, and whoever has it gets the sale.

The Behringer UCA222 is the third example, and the most instructive on price. It is a named model number with genuine search demand, and it sold **above** the market median at £34.67 against £26.87. A buyer who knows what they want does not spend an hour comparing.

The common factor across all four is that the buyer arrives already knowing what they need. Nothing in the 167 dead listings has that property.

---

## What we recommend

**1. Retire the 108 listings priced below the floor.**
They cannot be repaired by repricing alone, because the price rise required would take most of them above what the market pays. Each sale one of them makes is a sale that returns nothing.

**2. Leave the 167 dead listings running.**
They cost nothing to keep live, and on a young account they are the only route to the feedback that makes future listings convert. There is no case for spending time on them beyond that.

**3. Rebuild the catalogue around forced-search products.**
Replacement parts, care and mobility aids, and specific named models. The test for every candidate is whether a buyer would search for it by name rather than stumble on it while browsing. The store's own data has already identified this category without anybody planning it.

**4. Apply the price floor before a listing goes live, not after.**
This is the single change that removes 38% of the current catalogue's problem permanently. Every candidate now runs through an automated check that establishes the maximum the goods can cost and rejects anything that cannot clear it. That check is already built and was used to produce this document.

---

## Limits of this analysis

Stated plainly, so the figures are used at the right confidence.

- **Market median is derived from a keyword search per product.** For branded items, multipacks and unusual variants, that comparison can match the wrong set of listings. The LED Makeup Mirror showing 257% above market is more likely a mismatched comparison than a genuine finding. Where a listing is judged solely on its own price against the cost stack, the arithmetic is exact and independent of any matching.
- **Most listings are 16 to 18 days old.** For a slow-moving product that is short. It is not short for 282 listings collectively, where the expected sale count at a normal conversion rate would be in the hundreds.
- **The £5.00 target profit is our assumption, not eBay's.** Lower it and the floor moves down. At a £3.00 target the floor falls to roughly £7.86, which rescues a portion of the 108 but not most of them.
- **The view figures are as reported, not measured by us.** Seller-level traffic data requires account access and has not been read directly.

---

*Underlying data: 282 rows with per-listing verdicts, sold quantities, market medians and maximum viable buying prices, available as CSV on request.*
