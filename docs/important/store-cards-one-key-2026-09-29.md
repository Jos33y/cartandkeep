# Store cards: one key, both directions, postage by weight

29 September 2026 · internal · decisions on the store pipeline

## One key for a product

- `queryOf(title, brand)` in `scripts/store/match.mjs` is the only place a product's key is made. It is the store card's `external_ref`, the line in `research/queries/queries-store-<name>.txt`, and so the query the scan and gate read. The two imports join on this key.
- Shape: brand (two words at most) plus model when there is a real model. Otherwise brand plus the first three words that name the thing. Sizes, colours, sales words and anything after a dash, bar, comma, bracket, colon or "with" are left out. Size ranges (40-50cm), "6-in-1", dB/mAh/lm figures and the brand's own name do not count as models.
- On the August export, 99.99% of queries are five words or fewer. The old version made 2,065 queries of six or more words.
- Scan the query file as written. Do not redraft lines by hand: a changed line no longer joins its store card.
- Two products that draft the same query share one card; the better placed one keeps it. store-picks prints how many.
- Assumption: scan and gate carry each query through unchanged (the comment after `#` is dropped).

## Joins in both directions

- A gate pass on a store card adds eBay (import-gate, as before).
- A store pick whose key is already an undecided eBay card: that card gains the Shop label. It gets the store margin, with its eBay reading kept under `margin.ebay`, and it stays in its eBay batch. It carries `margin.store_import` = the store term, so the next store import refreshes it.
- Re-importing a store batch keeps the eBay label and reading the gate added. Re-importing a gate batch keeps the store figures on any card that has them and refreshes only the eBay reading.
- Decided cards are never touched, in either direction.

## Postage by weight (store)

- Royal Mail Tracked 48 online, from royalmail.com on 29 Sept 2026:
  - Small parcel to 2kg (45x35x16cm): £3.65 + £0.30 packing.
  - Medium parcel to 10kg (61x46x46cm): £7.35 + £0.50.
  - Medium parcel to 20kg: £11.85 + £0.60.
  - Over 20kg: left out of the import.
- The weight comes from the heaviest weight any matching shop gives (grams, weight_g or weight column). Failing that, a weight stated in the title, ignoring capacities ("up to 150kg").
- With no weight the card is costed as a small parcel. It carries a note that postage was assumed, and that note does not block "ready".
- Size is not on file, so a light but long product can still need a medium parcel.
- store-picks prints the median weight per shop, so a unit error shows (as with Festive Lights' prices).

## Not done yet

- The eBay margin on a store card still uses the gate's run band (`--band=evri5`), not the product's weight.
