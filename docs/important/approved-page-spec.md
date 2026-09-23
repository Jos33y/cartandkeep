# Approved page, rebuild spec

**Cart & Keep** · written 20 September 2026 · for continuation in a new chat

The page that decides whether this business works. Everything upstream produces
candidates; this is where a candidate becomes a listing, and the listing is what
buyers actually see.

Today it publishes what the pipeline decided. It should be where a person
improves on what the pipeline decided, then publishes.

---

## What is wrong with it now

**The price is often wrong, and wrong in the expensive direction.** Cesar
Classics shows £24.45, taken from the market median because no small seller was
proved to be converting. A real listing is selling the same product at £17.17.
Listing at the median means listing above everybody who is actually selling.

**Nothing can be edited.** Title, description, images and price are all taken
whole from Home Bargains and eBay. The one moment where a human could improve
the listing is a Publish button.

**The listing that goes up is the shop's, not hers.** Home Bargains writes for
a shelf. eBay buyers search differently, and the title is the single biggest
lever on whether a listing is ever shown.

---

## The three jobs of this page

1. **Set the price**, against what is actually selling rather than against a median.
2. **Compose the listing**: title, description, image order, item specifics.
3. **Publish**, and move the row to Listings.

Currently it does 3, badly, and shows some of the inputs to 1.

---

## 1. Price

### What is wrong

`margin.sale_price` comes from `listPrice()` in `import-gate.js`: the proving
seller's price where entry is proved, the market median where it is not. The
median is the middle of everybody listed, including the ones selling nothing.

### What it should show

The prices of listings that are **actually moving units**, not the field.

The gate already collects this. `gate-hb-1.csv` carries `price_low`,
`price_high`, `price_p25`, `price_p75`, `entry_price` and the full entry block.
Confirm whether `import-gate.js` writes all of them into `margin`; the card
currently reads `price_p25` and `price_p75` only.

### Design

A price line, not a number. Something like:

- A horizontal scale from `price_low` to `price_high`
- The interquartile range marked as the body of the market
- **Dots for the listings that sold**, sized or coloured by units moved
- Her proposed price as a draggable marker
- Live recalculation of what she keeps as the marker moves, using the same
  `maxGoodsCost` model, so the trade-off between price and margin is visible
  rather than computed afterwards

Undercutting is the obvious move and should be one click: "match the cheapest
seller who is moving units" as a button.

### Not AI

Price comes from evidence. A model asked to suggest a price has none, and this
project has already paid twice for confident invented numbers: the £652 diesel
pump and the £3,734 caravan pump.

---

## 2. The listing

### Title

80 characters, and eBay ranks full ones better. Home Bargains titles are written
for a shelf label.

- Editable field with a live character count
- **Generate** produces candidates from data already held: brand, product type,
  pack size, weight, variant, plus the words that appear in the titles of
  listings that are selling in the same search
- Never invents product attributes. Only rearranges and selects from known facts.

### Description

- Editable, seeded from the Home Bargains description and features
- **Generate** rewrites for an eBay buyer rather than a shelf: what it is, what
  is in the pack, what it fits, postage and dispatch
- Keeps the factual lines (contents, weight, ingredients) verbatim

### Images

- The seven Home Bargains photographs, reorderable by drag
- The first one is the search tile, which is most of why a listing gets opened,
  so it should be chosen deliberately rather than inherited
- No AI enhancement. These are already studio shots on white; generation risks
  altering the product, which is a listing that does not match the item

### Item specifics

- eBay returns required aspects per category
- Prefill Brand from the product, everything else editable
- A missing required aspect is the most likely publish failure

---

## 3. Publish

Unchanged in behaviour: dry pass, confirm, publish, row moves to Listings. The
confirm panel should show the edited values rather than the pipeline's.

---

## AI, where it is allowed

Generating **text from facts already held**. Titles, descriptions, item
specifics.

Not price. Not image content. Not product attributes that are not in the source
data. The rule is the same one the research pipeline runs on: no invented
figures, and anything generated is a draft a person accepts.

---

## Data still needed

| Thing | State |
|---|---|
| Price distribution in `margin` | Check `import-gate.js` writes low, high, p25, p75 |
| Which competing listings are selling, and at what | In the gate sample; not currently imported per listing |
| Required item specifics per category | eBay Taxonomy API, not yet called |
| Edited title, description, image order | Needs a column: `candidates.draft jsonb` |

---

## Design direction

Follows `design-standard.md`. Specifically:

- This is the hardest screen on the product, so it is the one the system should
  be proved on
- The price scale is the signature element of the page and should be drawn, not
  tabulated
- Editing states need real craft: focus, dirty state, save, revert
- One card per job, with the jobs in order, rather than five equal blocks

---

## Open questions

- Does she want to edit before every publish, or accept the pipeline's version
  by default with editing available?
- Should a draft be saved as she types, or only on publish?
- Does the title generator run on demand or when the row is opened?
