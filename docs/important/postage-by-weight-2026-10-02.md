# Postage by weight on eBay cards

2 October 2026. Scripts only; no portal or `src/lib` change. Closes open item 1 in `00-research-handoff-2026-10-02.md`.

## The problem

Every gate run was costed at one postage band:
- store-card runs (`queries-store-<category>.txt`) at the gate default, Evri to 5kg (`cost.js`, `band: 'evri5'`);
- shelf-queries runs at a band guessed from the name (`bandOf` in `shelf-queries.js`: bulky words to evri15, light words to letter500, the rest evri5).

`ebayAtWeight` only re-costed an eBay reading when the store card had `grams`, and eBay-only cards were never re-costed. The Sika paving jointing compound (14kg on eBay, 15kg on the shelf) was an eBay-only card costed at Evri to 5kg, £2.62: "You keep £5.08" was really about -£1.51.

## The fix (`ck-postage-weight-2026-10-02.zip` and two follow-ups)

- **`scripts/lib/weight.js` (new):** finds the weight, re-costs eBay postage and the figures worked out from it (headroom, max goods cost, net).
  - eBay postage reads, in order: the eBay listing title, the store card's weight, the shop page name, the card title. The eBay pack wins because it is what she sells there (Joseph, 2 October).
  - A weight read from text gets 5% for packing; a weight the shop states does not.
  - Packs multiply ("24 x 400g" is 9.6kg).
  - Litres count only for liquids (1.2kg a litre) and loose fills like compost (0.45kg a litre); never a container's litres (cool box, incinerator), a filter's litres filtered or a gas cylinder's litres of gas.
  - A pet or person size ("medium dogs 10-25kg", "max 10kg") and a rate ("45g/min") are not weights.
  - A weight raises a band, never lowers one the run chose.
  - Over 20kg: courier only, costed at Royal Mail's 20kg price as the least it will cost.
- **`import-gate.js`:** every gate row is re-costed by weight after `buildRow`; a store card gaining eBay uses the same helper.
- **`import-store.mjs`:** with no weight from the shop or title, the shop page name is read ("25kg bag"); the eBay side uses the helper.
- **`persist.js` (`--refresh`):** store cards keep their store figures, shop link and image; only the eBay reading moves. The batch is found by date and term. Decided cards are left unless `--refresh-decided`.
- **`scripts/recost-ebay-weight.mjs` (new):** the same for cards already in the queue. List only by default; `--apply`; `--decided` writes figures on decided cards too; `--with-down` also lowers bands; `--skip=<id>,...` leaves out misreads. Writes `research/review/recost-weight-<date>.csv` with the text each weight was read from.

## The run (2 October)

3,411 cards, 896 with an eBay reading. 52 changed, 50 re-costed, 18 notes.
- eBay: 11 Evri to 5kg to 5 to 10kg, 5 to 10 to 15kg, 2 to courier only, 1 large letter to Evri, 1 to Royal Mail 20kg.
- Store side: 36 cards with no weight were over 2kg by the page name or title.
- Courier only: Dansand paving sand and Firm Fix (20kg), Hydrosoft salt (25kg), Drybase slurry (20kg), Miracle-Gro compost 50L.
- Keep turned negative: Drybase slurry (£3.48 to -£5.95), Butchers tins 24 x 400g (£0.61 to -£5.98), Everbuild 402 Water Seal 5L (£2.70 to -£0.65).
- Skipped: the Tower Ceraglide steam iron (a damaged-box eBay listing whose title read as 22kg).

Joseph, 2 October: the decisions on cards so far are his own, so their figures may change (`--decided`).

## Still open

- `titleGrams` in `scripts/store/shelf.mjs` (used by store-picks) still reads every litre as liquid. A store card for a 20L container could be costed as a medium parcel. Switch store-picks to `textGrams` from `weight.js` if it shows up in a review.
- SodaStream gas cylinders on eBay are compressed gas: reject as eBay cards.
- Check in the portal: Butchers tins, Everbuild 402, Drybase slurry.
