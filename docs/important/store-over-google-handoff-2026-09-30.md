# Shop cards priced over the Google low: handoff to research

30 September 2026. From `node scripts/count-gaps.mjs`, run against live batches, same assess() as the portal.

## What the count found

- 1,420 cards wait for a decision. 915 of them are shop-route cards priced over the Google low.
- 885 are more than 10% over. Only 30 are within 10%.
- 498 have a shop cost that is itself above the Google low, so no price can put them in the market.

| Over the Google low | Cards |
|---|---|
| 0% to 5% | 20 |
| 5% to 10% | 10 |
| 10% to 25% | 120 |
| 25% to 50% | 269 |
| 50% to 100% | 344 |
| More than 100% | 152 |

## The ten furthest over

| Product | Her price | Google low | Cost, shop |
|---|---|---|---|
| Osmo UV Protection Oil Extra | £93.99 | £13.00 | £85.00, Wickes |
| Crosswater MPRO Toilet Roll Holder | £107.99 | £20.00 | £98.81, City Plumbing |
| Kilian Angels' Share On The Rocks EDP | £193.49 | £39.00 | £182.75, John Lewis |
| Ideal 175593 Ignitor Unit | £60.99 | £13.00 | £52.49, Toolstation |
| Osmo Door Oil | £51.49 | £11.00 | £43.00, Wickes |
| Vaillant 181051 Expansion Vessel | £146.99 | £36.00 | £136.99, City Plumbing |
| Croydex Shower Curtain Telescopic Rod | £39.99 | £10.00 | £31.59, City Plumbing |
| Mason Cash In The Meadow Daisy Mixing Bowl | £35.49 | £9.00 | £26.95, Harts of Stur |
| Miele Active AirClean Filter SF AA 50 | £33.49 | £9.00 | £24.99, John Lewis |
| Cuprinol 5 Star Complete Wood Treatment | £73.99 | £20.00 | £64.99, B&M |

## Likely cause

The Google low and the shop page are not the same variant. Osmo and Cuprinol come in tins from 125ml to 2.5L. The perfume comes as a 50ml bottle and as a travel spray. A £13 "ignitor unit" against £52 is a different part or a listing error. The Google price range's minimum takes the cheapest variant of the product group, and the shop match takes whichever page matched the name.

## Asks for the research side

1. Match the size or variant, not just the name, between the Google product and the shop page. Where the Google product has several variants, record the price of the variant that matched, not the group minimum.
2. Flag at import any card whose shop cost is above the Google low, as `cost_over_google`, so it never reaches her as "To list on the shop".
3. Re-run the 498 cost-over cards through the size check before the next import.

## What the portal will do meanwhile (pending Joseph's yes)

Shop cards more than 10% over the Google low move out of "To list on the shop" into their own lane, with the gap to the Google low on the strip and Approve no longer the main button.
