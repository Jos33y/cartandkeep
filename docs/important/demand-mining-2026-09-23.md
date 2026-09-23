# Demand mining, and why it is not the route

**The Brick Dev Studios** | 23 September 2026 | Internal

Deleted from the portal rather than retired, because a batch nobody should
act on is still a batch somebody opens. The finding is here instead.

---

## What was tried

eBay's own suggestion box returns the phrases people actually type. Fed the
alphabet at two letters, 676 prefixes with no seed list and nobody's opinion in
it, that produced 6,130 phrases across every category on the site, plus a map
of 234 categories eBay files that demand under.

The appeal was obvious. Every query file before it came from her catalogue,
which never sold, or from listing titles, which are what sellers decided to
stock, or from us, which is recall dressed as research.

## What it cost and what it returned

| Stage | Count |
|---|---|
| Phrases mined | 6,130 |
| Scanned, one call each | 1,000 |
| Survived the scan | 50 |
| Gated, 21 calls each | 50 |
| Passed the gate | 7 |
| Sourceable at a price we could find | 1 |

About 2,000 API calls for one product, an EJEAS V6 Pro motorcycle intercom
with a £12.03 buying ceiling that we could not land under.

The four that passed and should not have were caught by rules written the same
day: a lounge chair and a pressure washer costed as Evri parcels, and a
designer fragrance. That is the goods window and the postage band working, not
a reason to keep mining.

## Why it fails

**The head of the market is closed.** Of 1,000 scanned phrases, 763 were
refused for having over 250 live listings. Two-letter prefixes return what the
whole country searches for, and what the whole country searches for has
thousands of sellers on it already.

**The tail is the wrong kind of cheap.** What survives the crowding test is
either a used market, which she cannot source new, or a product nobody is
buying.

**Nothing arrives with a price.** A mined phrase is a market with a buying
ceiling attached and no supplier. Every one needs somebody to go and find
stock under that number, which is the step that has emptied every batch since
August.

## What replaced it

Collecting a shop's shelf, then testing those products against the market.

| | Mined phrases | Shop shelf |
|---|---|---|
| Survived the scan | 5% | 26% |
| Arrives with a supplier price | no | yes |
| Passed the gate, per slice | 7 of 50 | 4 of 76 |
| Sourceable the same day | 1 | 3 |

The pass rate at the gate is no better. What changes is that a shelf product
already has a price, a unit price, a brand and a quantity cap on it, so a pass
is something she can act on that afternoon rather than a research task.

## What was kept

- `scripts/mine-terms.js`, because it costs no API calls and reads demand
  rather than supply. If a shelf runs dry it is the tool to reach for.
- `scripts/scan.js`, which now carries the shelf route and is the reason a
  slice costs 450 calls instead of 9,000.
- `scripts/queries-demand-az2-categories.txt`, eBay's own map of where demand
  sits in its tree. Free, and not reproducible from a shelf.

## What was deleted

The batch `az-demand`, its 6 candidates, and its 58 coverage rows. None of the
six was sourceable, and the two that looked best were a chair and a pressure
washer that could not have been posted at the rate they were costed at.
