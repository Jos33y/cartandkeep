# Brief: the Candidates section of the Cart & Keep portal

Paste this at the start of a new session, with the files listed under "Where it lives" attached or in the repo. It says what the section is for, what every figure means, which rules sit behind them, and how the screen shows them, so later work keeps the meaning intact.

**Updated 29 September 2026, end of day.** Four zips, applied in this order, each holding only the files changed since the one before:
1. `ck-candidates-round-2026-09-29.zip`: the swing tag on the market rail, Try a cost, the till roll, the lanes by blocker.
2. `ck-candidates-ledger-2026-09-29.zip`: ledger rows for 2,000+ cards, category tabs, the sticky toolbar, lanes as chips, paging, selecting many, the two column card, the full supplier form, sampled listings on the rail.
3. `ck-candidates-supplier-2026-09-29.zip`: her supplier's cost always wins; checking the pack is not a supplier. Also fixes a sideways scroll on phones in zip 2.
4. `ck-candidates-postage-2026-09-29.zip`: postage follows who posts the parcel.

---

You are working on the Candidates section of the Cart & Keep operations portal (React 19, Vite, Supabase, CSS modules with design tokens). Read this before changing anything.

## What the section is for

Cart & Keep is a small UK seller, one new account, selling on two channels:
- her own shop (cartandkeep.com)
- eBay

She lists first and buys only after an order comes in. Candidates is her review queue: each card is one product the research pipeline found, and for each she decides Approve (goes to Approved, where she drafts and lists it), Later, or Reject with a reason.

She decides at a glance and opens a card only for the evidence. Every card comes down to one question: is there a price where it both sells and pays? The screen is built around that question, for a queue of 2,000 cards or more across ten or more categories.

## Where the cards come from

**eBay cards (the gate).** A query is gated against live eBay listings. The card carries:
- the median, from the listings that are selling among the 10 the gate opens, when at least 3 are selling; otherwise from all listed (`scripts/lib/market.js`). `competition.price_basis` says which, `selling_seen` how many, `median_listed` the median of everything listed.
- the spread (p25 to p75), from up to 200 search results. The median and the spread come from different sets, so the median can sit outside the middle half; the screen labels each for what it is.
- `competition.listings`: every listing the gate opened, with price, sold, link and title.
- units sold a month across the sample, and the competing listings.
- an entry seller: the smallest-feedback seller converting on a young listing, under about 1,000 feedback. That seller proves a new account can get in.
- a shelf: a UK shop where the product was seen, with a link and usually a price.

**Trusted or not** (`margin.list_trusted`, set by `listPrice()` in `scripts/lib/row.js`). Trusted means a small seller is proved and their price sits inside the p25 to p75 field. Otherwise the price comes from the median. A proved seller outside the field usually means the search pulled a different product.

**Store cards (Google best sellers).** Products in Google Merchant Center's UK best sellers and stocked by a UK shop whose product page was checked as the same product. They carry the Google rank, months ranked, and Google's lowest and highest price.

**One product can be both.** Channel marks show Shop, eBay or both (`recommended_channels`). A store card that also passed the gate keeps its eBay reading under `margin.ebay`. `external_ref` joins the two.

## What the shelf price is, and where the cost comes from

**The shelf price is where the price came from and where the product was found in the UK.** It proves the product exists and can be sourced here. It is not where she buys for eBay: no retailer sourcing is done on eBay.

**Her supplier wins, always.** Decided 29 Sep with Joseph.
- A supplier she adds through "Found it cheaper?" is where it will actually be bought, so its landed cost drives everything: list price, keep, gap, lane, till roll and Approved.
- It wins whether it is cheaper or dearer than the shelf price.
- With several suppliers, the cheapest of hers wins. A supplier asked but not yet priced (no landed cost) does not count.
- Only with no supplier of hers does the shelf price stand in. It is confirmed once the pack is checked, and shown as "est." until then.
- A shelf price is left out only when the gate knows the pack differs.

**Checking the pack is not a supplier.**
- "Same item and pack, confirm £x" (key C) saves a `candidate_sources` row with `matched_on: 'shelf'`, `supplier_kind: 'retailer'`, `confirmed: true`. It marks the shelf price as the same pack as eBay and never counts as a supplier.
- Rows saved by that button before 29 Sep are recognised by the note it wrote ("checked by eye"). `isPackCheck()` in `pricing.js` covers both.
- Pack checks are hidden from the supplier list; the shelf ticket shows "Same pack".

**Landed cost** (`landedOf()` in `pricing.js`, the same sum as the generated column `candidate_sources.landed_unit_cost` from migration 0026):
- dropship: (price at quantity, else unit cost) plus supplier postage
- stock: (price at quantity, else unit cost) times (1 + duty) plus freight per unit
- no price: null, never zero

## Who posts the parcel

Decided 29 Sep, following migration 0023's own rule.

- **Supplier posts it (dropship):** her Evri postage and packing are not a cost; the supplier's postage is inside the landed cost. The 30p returns allowance stays. (`dropshipCosts()` in `pricing.js`.)
- **She buys stock and posts it:** her postage and packing stay.
- **Shelf price only:** her postage stays, as the stand-in, since nobody has said who posts yet.
- The shop channel follows the same rule, with Royal Mail in place of Evri.
- A cost typed into the quick field counts as delivered to the buyer. In the full form, "I buy stock and post it" brings her postage back.
- `assess()` returns `postedBy`: `'supplier'` or `'you'`.
- Effect on the string lights (£29.99 seller): a £20.13 dropship supplier lists at £29.99 and keeps £4.52; the same cost posted by her lists at £34.49 and keeps £5.29. At the same price, dropship keeps £3.02 more.

## The price model (`src/lib/pricing.js`)

One file prices both channels; the portal and the import scripts both read it. Do not duplicate this arithmetic in components.

**Floor** = (cost + per-order costs + profit) ÷ (1 − the channel's percentage fees), rounded up to .49 or .99.
- eBay: 12.8% final value fee + 3% promoted, 30p an order, Evri postage and packing for the weight band, 30p returns allowance.
- Shop: card fee 1.5% + 20p, Royal Mail Tracked 48 by weight, packing, 40p returns allowance.
- Profit steps: eBay £3 under £15, £4 from £15 to £30, £5 over £30. Shop £2 under £15, £3 from £15. Keeper may later suggest more, up to £10.
- Known and left alone: the rounding up can land up to 1p under the true floor for a price in the last penny below .49 or .99.

**There is always a price.** List at is the market price when it clears the floor, otherwise the floor, however far over that is.

**No shop price and no supplier (eBay only).** The goods are taken as everything the market price leaves after fees and postage at no profit ("the most the eBay price allows"). Never stored or treated as a cost.

**Position: one reference for the price and the gap.** The gap is measured against the number the price is built from: the small seller when trusted, else the median; Google's lowest on the shop. A card is never priced from one number and judged against another. `positionOf()` returns `inMarket`, `over`, `short`, `text`, `ref`, `refName` and `pct` (the gap as a share of the reference).

**Helpers:** `goodsToList()` (the most delivered goods can cost and still list on the reference price with the full profit), `downToPrice()`, `landedOf()`, `dropshipCosts()`, `isPackCheck()`.

## What `assess()` returns that the screen relies on

`assess(row, { tryCost, tryPosted, holdPrice })` in `src/lib/assess.js`:
- `tryCost`: a cost to try, never saved. `tryPosted`: `'supplier'` (default) or `'you'`. `holdPrice` keeps her draft price (Approved and the supplier lines use it).
- `trying` is true when figures come from a tried cost.

| Field | Meaning |
|---|---|
| `lane` | ready, pack, slow, over, price, untested, short or store |
| `costBasis`, `costFrom` | seen, supplier, market or try; `costFrom.from`, `.cost`, `.shelf`, `.fulfilment` |
| `shelfIsCost` | the shelf is the same pack, by the gate's match or her check |
| `postedBy` | who posts, which decides whether her postage counts |
| `landsUnder` | the most delivered goods can cost to list on the reference; null when none can |
| `refLeaves`, `refProfit` | what the reference leaves for delivered goods and profit after fees; the profit it asks |
| `marketRead` | basis of the median, selling count, median of all listed, the sampled listings |
| `median`, `sold` | the stored median; `sold_30d` for sorting |

`READY_MIN_SOLD = 5`: Worth approving needs 5 sold a month across the sample. A named constant for now; it belongs in the tenant's research config before client two.

`shopName()` reads tags ("hb") and web addresses ("lakeland.co.uk", "bmstores.co.uk") as shop names.

## Lanes (by what stands between the card and Approve)

Checked in this order; the first that applies wins. Worked out from saved figures, so a lane does not move while she tries a cost.

| Lane | Rule | Sorted by (Nearest to Approve) |
|---|---|---|
| Keeps under the target | a confirmed cost keeps less than the profit step | sold a month |
| Over the market | her price is above the reference | the gap, smallest first |
| Entry untested | no small seller proved | sold a month |
| Check the price | a small seller is proved but outside the field | sold a month |
| Confirm the pack | in the market, cost not confirmed or pack ratio in doubt | sold a month |
| Sells slowly | everything checks out, under 5 a month | sold a month |
| Worth approving | all clear | month at the seller's rate, then keep |
| To list on the shop | store cards | need, months ranked, rank |

## The page

**Categories along the top, as the shop's card index.** Kraft divider tabs standing on one rule (`CategoryTabs`), each with its count. One line however many: the strip scrolls sideways, and "All 10" opens a searchable list. The chosen one is remembered (`ck.portal.category`).
- Today the tabs group batches by `category_label`. The categories decided on 29 Sep (`categories-2026-09-29.md`, `categories-build-2026-09-29.md`) make Google's top category the tab and the second level the filter inside it. Switching the tabs to `category_top_id` and `category_level2_id` is the next build.

**One toolbar that stays at the top on laptop and desktop** (it scrolls away on phones):
- decided so far with a thin bar; status as one segmented control (To review, Approved, Later, Rejected, All); Find
- the lanes as chips with colour and count; she works one lane at a time, the first with cards chosen for her; "Every lane" stacks them with lane headings
- sort: Nearest to Approve, Sold a month, You keep

**Built for 2,000 cards.**
- `useCandidates` loads in pages of 500 ordered by id, so the API's row ceiling (1,000 by default) cannot cut a category short, with a ceiling on pages so it can never loop.
- The list draws 60 rows and adds more as the end comes into view, or through "Show more".
- `assess()` runs once per load, not per keystroke in Find.
- Tested with 2,000 cards over 10 categories and a 1,200 card category (three pages).

**Choosing many.** A checkbox on each row; X toggles, Shift and X selects a run. A bar at the foot approves, saves for later, or rejects them all with one reason; A, L and R act on the selection while it exists; Undo covers all of them.

## The row: one ruled ledger line, about 55px

- One sheet per lane, hairline rules, no card per row. The lane's colour is the left edge; the active row is warm; a chosen row is kraft.
- Columns (`--cand-cols`): select, thumb, product, sold a month, list at on the market, gap, you keep, actions.
- Product: the name on one line with the eBay / Shop / both mark, always shown. Under it the evidence on one line, ending in one pill (the one that asks something of her first). For example "Small seller, 212 feedback, sells at £19.49" or "Small seller at £26.57, outside this search's prices".
- List at: her price as a small kraft tag sitting on the rail (`GapRail`). The rail runs from 30% under the reference to twice it, the same on every row. The middle of the field is shaded sage, the reference is a ring (seller) or tick (median), and when over, a dotted amber string runs back to the reference.
- Gap: "+£4.00" in amber, or a green tick when in the market.
- You keep: the figure, green when confirmed, ink with "est" in amber when not, blue with "if" while trying, red on a loss. "Pack?" when the pack ratio is in doubt.
- Actions: Later and Reject as 30px icons, Approve 30px tall; all 44px on touch screens. Approve is filled terracotta only in Worth approving.

## The opened card: two columns, about 790px

**Left:**
- The headline: "List at £29.99, in the market, level with the seller at £29.99" or "+£4.00 over the seller at £29.99", and "if the goods cost £x" while trying.
- `MarketBand`: the tag above the market rail with its string down to where the price lands on the pays rail. Every sampled listing is a dot on the market rail, filled if it has sold, each opening its listing. The median is labelled for what it is, for example "median of 3 selling, £8.95; all listed £14.50". The pays rail is keyed red, amber and green. When over the market and a cost could land it, a pale sage ghost tag hangs below at the reference. The scale is held to the saved figures, so trying a cost moves the tag, not the rails.
- Who is selling, in one line: the feedback scale, sold in days, a month, competing, and the listing. On a shop card, On Google: rank, months, shops, floor, and the eBay price and keep when the gate passed it.
- `CostTry`:
  - what would change this, in one sentence: "Find it for £20.65 or less, delivered to your buyer, and it lists at £29.99, level with the seller", with a "Try £20.65" button; or "At £7.40, fees leave £x for the delivered goods and your profit... No cost lists it there"; or, on Check the price, "open that listing before you trust this price".
  - **Found it cheaper?** (her favourite part): one quick field, "Delivered to your buyer, their postage in". The card moves as she types.
  - **Save as a supplier** opens the full form: supplier (from her saved list), kind (Not sure, Wholesaler, Manufacturer, Shop, Marketplace), how it reaches the buyer, then for dropship cost per unit and their postage, or for stock price at quantity, minimum order, freight per unit and duty; ships from, days to arrive, link, note. It shows the landed cost as the database will store it, and the card follows that figure while the form is open.
- Notes, as a slim strip.

**Right:**
- **Where the money goes, as the shop's till roll** (`TillRoll`): Sale, eBay fees with rates, Postage with its band and Packing (or one line "Postage and packing: your supplier posts it, in the goods"), Returns allowance, Goods ("priced from Home Bargains", or "your supplier, Trade Wholesale" with "What you will pay; seen at £15.99"), then You keep, Profit at this price, and "At £x and their rate" a month, marked est. when the pack is not confirmed. One stamp, the only colour: CONFIRMED (Same pack, or Page checked on the shop), ESTIMATE (Pack not checked), AT MOST (No shop price), or the tried cost.
- **Where it was seen**, as a shelf-edge ticket: the shop in capitals, its product name, the price on a kraft lip, and a corner state: Same pack, Pack not checked, or "Your supplier's cost is used". Then the confirm button while the pack is unchecked, "Also look at" (never the shop already seen, never eBay), and her suppliers, each with what it keeps at the card's price.

## Colour and shop materials

- Green: good, confirmed, in the market. Amber: look at this. Red: loses money. Blue (`--c-info`): a cost she is only trying. Prices are neutral ink on kraft. Terracotta is the Approve action only.
- The portal does not load `store-tokens.css`; `src/styles/ui/shared/shop-ink.module.css` supplies `--c-kraft`, `--c-kraft-deep`, `--c-kraft-ink` and `--c-paper` through `composes`. The slip page carries its own copy.

## Rules that must survive any redesign

- Every figure comes from `assess()`, which uses `pricing.js`. Components display; they never calculate prices, keeps or landed costs.
- Her supplier's cost wins over the shelf price, cheaper or dearer. A pack check is never a supplier.
- Her postage counts only when she posts it.
- The price and the gap use one reference. There is always a price.
- "est." stays visible wherever an unconfirmed keep appears; a tried cost reads "if".
- The market-allowance figure never appears as a cost or feeds approval, the shop listing or Keeper.
- Unknown is drawn as unknown: no dot when nobody is seen, a median that says how few listings it came from.
- The shop thumbnail and the shop's wording are for recognising the product only, never published (copyright).
- Decisions never change when a card is re-imported or moves category.
- Plain British English, portal copy says "you", a price is never the part that truncates.
- Keyboard: J and K move, O opens, A approves, L is Later, R rejects then 1 to 7, U undoes, C checks the pack, T tries a cost, X selects, Shift and X selects a run. Typing in a field never triggers a shortcut; Escape clears the cost field, then a selection, then an open card.
- Checked at 13 sizes (320 by 568 to 1920 by 1080) with no sideways scroll, on a 13-inch laptop at 1280 by 720, and on phones. The list is a size container, so rows follow the room they have.

## Where it lives

| File | What it does |
|---|---|
| `src/lib/pricing.js` | fees, bands, profit steps, floor, list at, `cheapestCost` (her supplier wins), `isPackCheck`, `landedOf`, `dropshipCosts`, `positionOf`, `goodsToList`, `downToPrice` |
| `src/lib/assess.js` | everything the card shows; `tryCost`, `tryPosted`, `holdPrice`; `shopName`; `READY_MIN_SOLD` |
| `src/hooks/useCandidates.js` | loads in pages of 500; sources include `matched_on` |
| `src/hooks/useApproved.js` | the same source columns for Approved |
| `src/pages/portal/CandidatesPage.jsx` | category tabs, toolbar, lanes as chips, sort, paging, selection and the bulk bar, keyboard, toast |
| `src/components/ui/portal/CategoryTabs.jsx` | the kraft divider tabs and the All list |
| `src/components/ui/portal/CandidateRow.jsx` | the ledger line and the opened card; `confirmSource()` for the C key |
| `src/components/ui/portal/GapRail.jsx` | the row's rail and tag, and the Gap figure |
| `src/components/ui/portal/PriceTag.jsx` | the kraft swing tag, small, row and big |
| `src/components/ui/portal/MarketBand.jsx` | the two rails, sampled listings, tag, string and ghost |
| `src/components/ui/portal/CostTry.jsx` | what would change this, Found it cheaper, the full supplier form |
| `src/components/ui/portal/TillRoll.jsx` | the till roll and its stamp |
| `src/components/ui/portal/SellerGauge.jsx` | the feedback scale; `compact` in the Who is selling line |
| `src/components/ui/portal/SourceList.jsx` | her suppliers, each with its keep from `assess()`; pack checks hidden |
| `src/pages/portal/ApprovedPage.jsx` | the next step, on the same `assess()` |
| `src/styles/ui/shared/shop-ink.module.css` | the shop's kraft and paper for the portal |

## Open

- **Category tabs on Google's taxonomy.** Tabs from `category_top_id`, the filter from `category_level2_id` (Healthcare one level deeper), names from `google_categories`, source and channel as labels on the card. Needs the migration file, `scripts/categories` and any change to `useCandidates` from the categories chat.
- **Migration number clash.** `0108_orders_portal_grant.sql` and `0108_candidate_categories.sql` share a version; one needs renumbering. (`0040` already has two files.)
- **One median set.** The gate could take the median and the spread from the same listings. A scripts job; the screen labels both honestly meanwhile.
- **`READY_MIN_SOLD`** moves to the tenant's research config.
- **The shop-ink tokens** and the slip page's copy should become one shared file.
- **The 1p floor rounding** noted above.

## How to work

- Before changing a figure's appearance, find which `assess()` field it shows. If a design needs a figure `assess()` does not provide, add it to `assess()`.
- Agree the understanding before building, then test by using it: open a card, press Try, fill the supplier form both ways, check the pack with C, select with X and act on many, undo, T into the cost field, and run the 13 sizes and the build.
- Test cards:
  - Worth approving: a confirmed, in-market card selling 5 or more a month
  - Sells slowly: Lego 21277 (B&M £20, £45.41, keeps £14.62, 1 a month)
  - Confirm the pack: Ariel (B&M £15.99, £29.65, keeps about £5.36 est.); with an £18 dropship supplier it stays in the market and keeps £6.37
  - Over the market: string lights (£33.99, +£4.00; lands at £20.65 or less delivered); Philips Hue (+£7.38)
  - No shop price: Samsung filter (£34.99, +£6.22, est.)
  - Floor far over: Wickes coping saw (£18.99, +£11.59 over the £7.40 median; lands at £2.28 or less delivered)
  - Check the price: Sleigh pet bed (£48.66 median, small seller at £26.57 outside the field)
  - Thin median: Steel mop refill (median £8.95 against a field of £11.99 to £20.99; read `selling_seen` and `median_listed` on the card to see why)
  - Keeps under the target, and a store card
