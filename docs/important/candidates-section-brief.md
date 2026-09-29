# Brief: the Candidates section of the Cart & Keep portal

Paste this at the start of a new session, with the files listed under "Where it lives" attached or in the repo. It explains what the section is for, what every figure means and which rules sit behind them, so visual work keeps the meaning intact. It is not a design brief.

---

You are working on the Candidates section of the Cart & Keep operations portal (React 18, Vite, Supabase, CSS modules with design tokens). Read this before changing anything.

## What the section is for

Cart & Keep is a small UK seller, one new account, selling on two channels:
- her own shop (cartandkeep.com)
- eBay

She dropships. She lists first, and buys the item from a UK source only after an order comes in. A UK shop stocking a product proves it can be sourced; it is not necessarily where she buys.

Candidates is her review queue. Each card is one product the research pipeline found. For each card she decides:
- Approve (goes to Approved, where she drafts and lists it)
- Later
- Reject, with a reason

The whole point of the screen is that she can decide at a glance, and open a card only when she wants the evidence.

## Where the cards come from

**eBay cards (the gate).**
- A query is scanned and gated against live eBay listings. The card carries the market read:
  - the median price and the spread
  - units sold a month across the sampled listings
  - the competing listings
  - an "entry" seller: the smallest-feedback seller who is converting (under about 1,000 feedback, selling on a young listing). That seller proves a new account can get in.
- The card may also carry a "shelf": a UK shop where the product was seen, with a link and sometimes a price.

**Store cards (Google best sellers).**
- Products that rank in Google Merchant Center's UK best sellers (Home & Garden first) and are stocked by a UK shop.
- The shop's product page was opened and checked to be the same product.
- These carry the Google rank, how many months it ranked, and Google's price range (lowest to highest).

**One product can be both.** A card carries channel marks:
- Shop, eBay, or both (`recommended_channels`)
- A store card that also passed the eBay gate keeps its eBay reading under `margin.ebay`.
- The key joining the two is `external_ref`, a short search query made by `queryOf()`.

## The price model (`src/lib/pricing.js`)

One file prices both channels. The portal and the import scripts both read it, so the card and the scripts cannot disagree. Do not duplicate this arithmetic in components.

**Cost.**
- The cheapest real cost wins. It is either:
  - the price where the product was seen, or
  - a supplier she added ("Found it cheaper elsewhere?")
- Confirmed or not:
  - A seen price is **confirmed** when the page check or pack match says it is the same item and pack. A supplier she added is always confirmed.
  - Otherwise the seen price is still used, marked **unconfirmed** ("est."), until she confirms the pack.
  - A seen price is left out only when the pack is known to be different.

**Floor.**
- Floor = (cost + per-order costs + profit) ÷ (1 − the channel's percentage fees), rounded up to .49 or .99.
- Per-order costs:
  - eBay: 12.8% final value fee + 3% promoted listings, 30p per order, postage and packing for the product's weight band (Evri), and a 30p returns allowance.
  - Shop: card fee 1.5% + 20p, Royal Mail Tracked 48 by weight, packing, and a 40p returns allowance.
- Profit steps:
  - eBay: £3 under £15, £4 from £15 to £30, £5 over £30.
  - Shop: £2 under £15, £3 from £15.
  - Keeper may later suggest more, up to £10, never below the floor.

**List at.**
- The market price when it clears the floor, otherwise the floor.
  - eBay market price: the converting small seller's price when trusted, else the median.
  - Shop market price: Google's lowest.

**No shop price at all (eBay only).**
- The goods are taken to cost everything the market price leaves after fees and postage, at no profit ("the most the eBay price allows").
- The price built on that always sits slightly above the market.
- This figure is never stored or treated as a cost: `a.goods` stays empty, so approval and shop listing never see it.

**Position.**
- One reference per channel:
  - eBay: the cheapest converting small seller, else the median.
  - Shop: Google's lowest.
- `position.inMarket`, `position.short` ("In the market" / "+£6.38 over") and `position.text` (the full sentence) come from `positionOf()`.

## What the card must say at a glance (collapsed row)

**eBay card, three figures:**
1. **Sold a month**: units a month across the sampled market. The size of the market, not her expected sales.
2. **List at**: her price, with one chip underneath:
   - "In the market" (green)
   - "+£x over" (amber)
3. **You keep**: per sale at that price.
   - Green when the cost is confirmed.
   - Grey with "est." when it isn't.
   - Underneath: where the cost comes from ("Toolstation £39.99", or "No shop price").

**Shop card:** Google rank (and months ranked), List at with its chip, You keep with the cost source.

**Also on the row:**
- The evidence line: "A 798 feedback seller is converting at £50.61", or "Google best seller #45, in 4 of the months checked".
- Pills: "Same pack as eBay", "Check pack", "Branded", season, need (Safety, Pest, Part and so on).
- The channel marks.

**Colour carries meaning, so keep it consistent:**
- Green: good, confirmed, in the market.
- Amber: look at this (over the market, unconfirmed).
- Red: loses money.
- The price itself is neutral ink. Never colour it green just because it is a price.

## Lanes (how the list is grouped)

| Lane | Rule |
|---|---|
| Worth approving | A small seller converting, her price in the market, **and** the cost confirmed. |
| Your call | Over the market, cost unconfirmed, or no small seller proved selling. The chip and "est." say which. |
| To list on the shop | Store cards. |
| Keeps under the target | A confirmed cost that keeps less than the profit step at the current price. |

Confirming the pack or adding a cheaper supplier recalculates the card, and it can move up a lane.

## The opened card (evidence)

**eBay card:**
- **Where it sells, and where it pays.** The market band: the top rail is the market, the bottom rail is what she keeps across those prices. It marks the loss line, the profit line and her price, with the position sentence underneath.
- **Who is selling it.** The seller gauge (small seller to large account), plus feedback, sold, rate a month and listings competing. There is a link to the proving listing.
- **Where the money goes.** Fees, postage and packing with returns, goods, and keep. The goods are labelled with their source, "(unconfirmed)", or "at most" on the no-price path.
- **Where it was seen.**
  - The shop link and price.
  - One sentence saying what the price is built on.
  - One action: "Same item and pack, confirm £x". This saves the seen price as a supplier, which confirms it.
  - "Found it cheaper elsewhere?" to add another source.

**Shop card:**
- Google's price band against her keep.
- "Your price", split into cost, Royal Mail and packing with returns, card fee, and keep.
- Where it was seen, with other shops stocking it.
- "On eBay", if the gate passed it.

## Rules that must survive any redesign

- Every figure on the card comes from `assess(row)` in `src/lib/assess.js`, which uses `pricing.js`. Components display; they do not calculate prices or keeps.
- The "est." state must stay visible wherever a keep figure appears, on the collapsed row and when opened. A guessed cost must never look confirmed.
- The market-allowance figure (no shop price) must never appear as "cost" or feed approval, the shop listing or Keeper as a fact.
- The shop thumbnail is for her to recognise the product only. It is never published to her shop or eBay (copyright). Listing photos come from the brand, Icecat or her own.
- Decided cards (Approved, Later, Rejected) keep the figures she decided on. Imports never overwrite them.
- Plain British English on screen, no jargon: "sold a month", not "30-day velocity". Small print must fit its column; truncate, never overlap.
- Keyboard: A approves, R rejects (1 to n picks the reason), L is Later. The active row must stay visible.
- Layouts are checked on a large monitor and a 13-inch laptop.

## Where it lives

| File | What it does |
|---|---|
| `src/lib/pricing.js` | Fees, postage bands, profit steps, floor, list at, cheapest cost, position. |
| `src/lib/assess.js` | Turns a candidate row into everything the card shows: `price`, `keep`, `goods`, `costBasis` (seen, supplier, market), `costConfirmed`, `costFrom`, `assumed`, `floor`, `breakEven`, `target`, `position`, `lane`, `warnings`, `entry`, `month`, `channels`. |
| `src/components/ui/portal/CandidateRow.jsx` | The row and the opened card (`StoreWork` for store cards, `Split` and `KeepCell` helpers). |
| `src/pages/portal/CandidatesPage.jsx` | Batches, filters, lanes, column heads, keyboard. |
| Also used | `MarketBand`, `SellerGauge`, `SourceList`, `ChannelMarks`, `PriceScale`, `Breakdown`, `primitives`. |
| `src/pages/portal/ApprovedPage.jsx` | The next step: the price editor and listing, using the same `assess()`. |
| `src/hooks/useCandidates.js` | Loads rows with decisions, notes and sources (her suppliers, cheapest first). |

## How to work

- Before changing a figure's appearance, find which `assess()` field it shows and what that field means (above). If a design needs a figure that `assess()` does not provide, add it to `assess()`, not the component.
- Test a redesign against these cards:
  - a confirmed in-market card (Lego 21277: B&M £20, lists £45.41, keeps £14.62)
  - an unconfirmed in-market card (Ariel: B&M £15.99, lists £29.65, keeps about £5.36 est.)
  - an unconfirmed over-market card (Philips Hue: Toolstation £39.99, lists £57.99, +£7.38 over)
  - a no-shop-price card (Samsung filter: no price, lists £34.99, +£6.22 over, est.)
  - a store card
