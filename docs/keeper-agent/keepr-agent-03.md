# Keepr Agent-03: the portal, part one. Candidates

Version 1, 30 September 2026. Cart & Keep, Brick Dev Commerce. Read after keepr-agent-02.md. Part two, the Approved page and listing, is keepr-agent-04.md.

## What this file is for

Agent-02 teaches Keepr to judge a product. This file teaches it how the portal reads the same product: the money model every figure comes from, what each lane on the Candidates page means, what every figure, chip and panel on a card is saying, and what she can do there. Keepr should read a card the way the page reads it, so its notes use the page's own words and never contradict a figure she can see.

Everything here is as built on 30 September 2026. Where the code decides something, the file named is the source of truth: `src/lib/pricing.js` for money, `src/lib/assess.js` for lanes and figures. If this file and the code disagree, the code wins and this file is out of date.

---

## Part 1. The money model

One price model serves both channels. The portal and the import scripts read the same file, so the figure on her card and the figure a script prints cannot disagree.

### The two channels

| | eBay | Her shop (cartandkeep.com) |
|---|---|---|
| Fees | 12.8% final value fee, 3% promoted listing, £0.30 an order | card fee 1.5% + £0.20 (Stripe UK) |
| Postage | Evri bands by weight: to 5kg £2.62, 5 to 10kg £5.87, 10 to 15kg £9.01; Royal Mail medium to 20kg £11.85 | Royal Mail Tracked 48: small parcel to 2kg £3.65, medium to 10kg £7.35, medium to 20kg £11.85 |
| Packing | £0.40 to £0.60 by band | £0.30 to £0.60 by band |
| Returns allowance | £0.30 an order | £0.40 an order |
| Profit target | £3 under £15, £4 from £15 to £30, £5 above | £2 under £15, £3 above |
| The market it is measured against | the cheapest small seller who is converting, else the median | Google's lowest price |

No weight on file means the first band, marked as assumed (a small parcel, up to 2kg, 45 x 35 x 16cm). The card says so, and she checks it fits.

### How a price is set

1. **The cost** (see below).
2. **The floor:** the lowest price that pays the cost, fees, postage, packing, returns and the profit target, rounded up to the next .49 or .99.
3. **The list price:** the market price when it clears the floor, otherwise the floor.
4. **Where it sits:** in the market, or how far over and over what.

So a card "over the market" is not overpriced by choice. Its floor is above the market because its cost is too high. The fix is a cheaper cost, which is what Found it cheaper is for.

### Which cost is used

In this order (`cheapestCost` in pricing.js):

1. **Her supplier always wins.** A supplier she has added with a landed cost is the cost, whether it is above or below the shelf price. With several, the cheapest of hers.
2. **The shelf price stands in** when she has no supplier: the price where it was seen at a UK shop. It is confirmed only when the shelf is the same product and pack as the eBay listing, either by the import's match or by her pressing "Same item and pack".
3. **A shelf known to be another product or pack** (different product, different pack, different barcode) is never used as the cost.
4. **No cost at all (eBay only):** the card is priced on "the most the market allows", everything the market price leaves after fees and postage at no profit. That figure is never a cost. The card says "at the most goods can cost".

### Who posts it

- **She posts it** (she buys stock and posts it, or buys from a shop and it is delivered to her): her postage and packing are costs.
- **Her supplier posts it to the buyer** (dropship): her postage and packing are not costs; the supplier's delivery charge is part of the goods.
- Found it cheaper always assumes she posts: the goods cost is the price plus what the seller charges to deliver to her.

### What she keeps

Keep = price, less the channel's percentage fees, less the per-order costs (fixed fee, postage, packing, returns), less the goods. Break-even is the price where keep is zero.

The profit target is not a cost. It is what the floor is built to pay. A card that keeps less than its target at its price is short of profit.

---

## Part 2. The Candidates page

Route `/candidates`. Every card in a delivered batch that has not been retired. Read in pages of 500, so every card counts, not only the first thousand.

### The header

- **Decided:** how many of all cards she has decided, today's count, and how far to the next milestone.
- **Approved here:** a month kept on the approved cards, at each proving seller's price and rate. Cards without a proved rate are counted separately.

### The filters, top to bottom

1. **Category tabs:** Google's top categories (Home & Garden, Health & Beauty, Hardware...), with a Categories menu for all of them and their sub-levels.
2. **Status:** To review, Approved, Later, Rejected, Every status. To review is undecided cards.
3. **Find**, **From** (the source label a card came in with: a batch or scan label such as "H & B" or "Google best seller"), **Sort**: Nearest to Approve (default), Sold a month, You keep.
4. **Lanes**, below. "Every lane" stacks them in order.

### The lanes

A card sits in exactly one lane: the first thing standing between it and Approve (`assess()` in assess.js). The order below is the order the code tests, so a card that is both short of profit and over the market is in Keeps under the target.

**eBay cards:**

| Lane | Test | What it asks her |
|---|---|---|
| Keeps under the target | a real cost, and keep is under the profit target | find it cheaper, or list higher |
| Over the market | her price is above the reference price | find it cheaper; the gap panel shows by how much |
| Entry untested | no small seller is proved selling it | can a new account get in? |
| Check the price | a small seller is selling, but at a price outside this search's range | is their listing the same product? It is priced at the median meanwhile |
| Over the market (again) | the small seller's own price would lose money at her cost | their price cannot be matched yet |
| Confirm the pack | the cost is the shelf price and the pack is not confirmed, or the eBay price is over 3.5 times the shelf price | is the shelf the same item and pack as the eBay listing? |
| Sells slowly | everything checks, but under 5 sold a month across the sample | is a slow seller worth it? |
| Worth approving | everything checks | approve it |

**Shop cards** (the store route, from Google best sellers):

| Lane | Test |
|---|---|
| To list on the shop | within 10% of Google's lowest price |
| Over Google's price | more than 10% over Google's lowest price |

"Over Google's price" was added on 30 September after a count found 885 of 915 waiting shop cards more than 10% over Google's lowest, and 498 whose shop cost was itself above it. Most are a size or variant mismatch between the Google product and the shop page (a 2.5L tin against a 750ml one). The research side is fixing the match. When it is fixed, cards move back to To list on the shop by themselves: the lane is worked out from the figures, not stored.

### Terms the lanes rely on

- **Small seller:** a seller with feedback at or under the ceiling that proves a new account can get in (1,000 by default, carried on each card).
- **Proved:** a small seller who is converting (selling, not just listing).
- **Trusted:** the small seller's price sits inside the search's price range, so it is the reference. Untrusted means it is priced at the median.
- **Entry thin:** a small seller is listed but has sold too few to prove anything.
- **Reference price:** the trusted small seller's price, else the eBay median. On a shop card, Google's lowest.
- **Pack ratio:** the eBay price divided by the shelf price. Over 3.5 usually means the eBay listing is a bigger pack.
- **Ready (sold a month):** 5. A setting in assess.js (`READY_MIN_SOLD`).

---

## Part 3. A card, closed

Each row is 72px, in this order.

| Part | What it says |
|---|---|
| Tick box | select for bulk decisions |
| Photo | the eBay listing's photo; hover to enlarge, click for full size |
| Name | the card title |
| Evidence line | eBay: the small seller's price and feedback ("£12.39 small seller, 103 feedback"). Shop: "£28.00 Google low · Medisave £28.99" |
| Channel marks | SHOP EBAY, or SHOP alone. An eBay-route card is for both. A shop-route card is for the shop, and eBay too when the gate also passed it |
| Flag (amber, with a flag icon) | the one thing to check, such as "Check pack", "Check pack size", "Check it is the same product", "Shelf 19, eBay 113". "+1" means more |
| Facts (quiet chips) | "Same pack as eBay", "Branded", "Open market", "Import, from CN", a shop card's need ("Pain relief", "Part or refill") and season |
| Caution chip (red or amber) | "Price loses money" (the small seller's price loses money at her cost), "Outside search range" (the small seller's price is outside the search's range) |
| Sells / On Google | eBay: sold a month across the sample, with a bar scaled to the busiest card on screen. Shop: Google rank and the months it ranked, as dots |
| Your price | her list price, and "In the market" or "£0.34 over £16.15" |
| You keep | the figure and one word: confirmed, estimate, pack to confirm, if you pay that, at the most goods can cost, loses money |
| Actions | Later (clock), Reject (cross), Approve. Decided: the verdict and Undo |

Colour meanings, used the same everywhere: green is confirmed or in the market; amber is something to check; red is a loss; blue is a figure she is trying; grey is an estimate.

---

## Part 4. A card, opened

### The strip

Across the top, in the lane's colour: "Why it is here", one or two sentences built from the same figures as the row, and the one action that moves it.

| Lane | Strip action |
|---|---|
| Worth approving, To list on the shop | Approve |
| Confirm the pack | Same item and pack, confirm £X. Over 3.5 times the shelf price it steps down to an outlined button, with "Different pack" beside it |
| Over the market, Keeps under the target | Try a cost |
| Over Google's price | See Google's prices (a Google Shopping search), Try a cost |
| Check the price, Entry untested | Open their listing |
| Sells slowly | Approve, outlined |

Under it, **Also check** lists every flag and warning in full, once. Anything the strip's own sentence already says is left out.

A decided card's strip says what was decided, when, and the reason and note.

### The lane panel

| Lane | Panel |
|---|---|
| Over the market | **Gap to the market:** a ruler zoomed on the gap, her price against the reference; "Goods now" (what the goods cost her now, delivered to her) against "To be in the market: under £X" (goods, delivery to her included); a Try button that puts that figure into Found it cheaper |
| Over Google's price | the same, as **Gap to Google's lowest** |
| Confirm the pack | **Same item and pack?** The eBay listing (photo, title, price) beside the shelf (the shop's name for it, price), sizes and counts highlighted in both titles, and a line saying whether the packs in the titles agree |
| Entry untested | **Can a new account get in?** A gauge from 10 to a million feedback, with the line that proves entry and the smallest seller selling as the dot |
| Sells slowly | **How fast it sells:** sold a month on a bar, with the mark at 5 |
| Keeps under the target | **Short of your profit:** keep now against the target, then two routes: find it for under £X, or list at the floor and where that sits |

Where the lane's question is the cost (over, short, over Google's price), **Found it cheaper** sits inside the panel. Elsewhere it is on the Market tab.

### Found it cheaper

One line: **Where** (shop or supplier), **Link**, **Price** + **Delivery to you** = **Goods cost**. Delivery is what that seller charges to deliver to her, not to the buyer, and may be £0. Typing moves every figure on the card at once. "Save as <name>" saves it as her supplier (bought and delivered to her, one at a time); "More details" opens the full supplier form. Once saved, her supplier is the cost from then on.

### The tabs

- **Market:** where it sits in the Google taxonomy and how that was set (from the eBay listing, from the title, by her, a default), with Move to; the source labels; the Market chart; who is selling; Found it cheaper when the lane has no panel for it.
- **Where it was seen:** the shop's shelf label (the shop, its name for the product, its price, and "Same pack", "Pack not checked", "Page checked" or "Your supplier's cost is used"), other shops to look at as search links, and her suppliers with what each would keep.
- **Notes:** her notes and the studio's, with an add line.

### The Market chart

Two rails on one price scale:

- **Where it sells:** the middle half of all listings as a band, the median as a tick, each listing opened as a dot (filled if it sold), and the small seller as a ring.
- **Where it pays:** red where the price loses money, amber where it keeps less than the profit target, green from the floor up.
- Her price is a kraft tag with its string dropping through both rails. A green ghost tag shows where it would hang at a cost that lists in the market.
- The legend is three lines: the market, the small seller, and where it pays. Prices off the scale are named at the end they fall past.

### The receipt ("One sale")

Every line of a sale from the same figures: sale, fees, postage, packing, returns allowance, goods, what she keeps, the profit target, and a month at the small seller's rate where there is one. The stamp says how sure the goods line is: Same pack confirmed, Page checked confirmed, Pack not checked estimate, No shop price at most, or "If it costs" while she is trying a cost.

---

## Part 5. What she can do on Candidates

| Action | Where | Key |
|---|---|---|
| Move down and up | anywhere | J K, or the arrows |
| Open the card | row | O |
| Approve | row, strip | A |
| Later | row | L |
| Reject with a reason | row, then pick | R, then 1 to 7 |
| Undo a decision | decided row | U |
| Confirm the pack | strip | C. Over 3.5 times the shelf price, the first C opens the card to compare and the second confirms |
| Try a cost | strip | T, focuses Found it cheaper |
| Select | tick box | X, Shift X for a run |
| Find | header | / |
| Move to another category | Market tab | |
| Add a supplier | Found it cheaper | |
| Add a note | Notes tab | |

Selecting several cards gives a bulk bar: Approve, Later, Reject with a reason.

The rejection reasons, and when Keepr should suggest each:

| Reason | Use when |
|---|---|
| Cannot source it | own label, selective distribution, no route to buy |
| Not profitable once sourced | the real cost leaves nothing at the market price |
| Too much competition | big accounts own it and no small seller gets in |
| Margin too thin | it pays, but too little to be worth the work |
| Wrong category | the product is not what the search was for |
| Previous underperformer | she listed it or its family before and it sat |
| Other | anything else, with a note; also duplicates, naming the card |

---

## Part 6. How Keepr works with this page

1. **Use the page's words.** Say "over the market by £0.34", "confirm the pack", "find it cheaper under £4.73", "keeps £2.17, under your £4 target". Never invent a figure the card does not show.
2. **Respect the lanes.** A card's lane is a fact from the figures. Keepr may say the lane is misleading (the shop page is the wrong size), never that the card is in a different lane.
3. **Over the market is a cost question first.** Suggest where to find it cheaper before suggesting a reject. Price alone never rejects (agent-02, rule 2).
4. **Confirm the pack is where wrong packs slip through.** Over 3.5 times the shelf price, assume a bigger pack on eBay until the titles or photos prove otherwise. Pedigree chewy cubes at £1.29 on the shelf against £12.39 on eBay was confirmed with one click on 30 September; that is the mistake to prevent.
5. **Over Google's price with the cost above Google's lowest** means no price can reach the market. Say which is likely wrong: the Google product's size or the shop page's.
6. **Her supplier always wins** the cost. Never suggest a shelf price in place of a supplier she has added, even when the shelf is cheaper; note it instead.
7. **Duplicates:** the same title approved twice (Fairy Platinum 19 Washes, Pedigree Dentastix on 30 September) should be caught here, before Approved. Note the other card's id.
8. **Notes go on the card**, through apply-review (agent-02). Keepr never presses Approve, Reject or Confirm for her.
