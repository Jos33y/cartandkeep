# Approved by channel, and Amazon read again in bulk

5 October 2026. `ck-approved-channels.zip`. Portal only.

## What Joseey asked
- Approved shows no way to see the shop cards apart from the eBay ones, or live from not live on eBay. It should be easier to review by hand.
- 72 cards showed "No Amazon price" though their Amazon pages had one. Their readings were from 3 October, before the 4 October fix. Read again on ZURU picked up £12.99 and the card switched to Amazon from B&M on its own.
- Read them all again for the cost only, without Keeper's Claude spend.

## What changed
- **Channel switch** at the top of Approved: Every card, eBay, Your shop.
  - eBay: Not listed / Live (live on eBay, waiting only for the shop).
  - Your shop: To add / In your shop (a draft or on sale, still to list on eBay).
  - Every tab, count and quick pick reads within the channel picked. Ready and Needs a look mean ready for that channel.
  - `?side=ebay|shop&where=todo|done` opens Approved on one.
- **Read again on Amazon**: with the "No Amazon price" chip pressed, one button reads them all, 20 a call, Apify only, no Claude. A reading with no price is always read again whatever its age. Stop at any time. A notice says how many now show a price and how many are now costed from Amazon.
- Where Amazon's price becomes the supplier's cost and it is cheapest, the card prices from Amazon. B&M or Home Bargains stays on the card. A cost she set herself is never moved.

## Not built yet (waiting on Joseey)
- Amazon dearer than the old supplier: switch only if it still keeps £3 within the market, up to 50% dearer; flag above that.
- Deal cards priced from the usual price, not the deal price (ZURU: £12.99 deal, usually £19.99).

## Deploy
Portal only: `src/pages/portal/ApprovedPage.jsx`, `src/hooks/useApproved.js`, `src/styles/pages/portal/approved-page.module.css`.
