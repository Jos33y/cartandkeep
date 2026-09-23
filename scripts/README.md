# scripts

The tools. What they produce lives in research/.

## The chain

A shop's shelf becomes a queue she can work, in five steps:

```
shelf-hb.js        collect a shop            no eBay calls
shelf-queries.js   draft queries from it     no eBay calls
scan.js            1 call a phrase           refuses crowded, cheap and dead markets
gate.js            7 to 21 calls a query     reads sales, age and seller size, decides
import-gate.js     writes the batch          no eBay calls
```

Only two of those spend the daily limit, which is why the scan exists: it costs
one call to refuse what the gate would spend twenty one on.

## The ones that get run

| Script | Does |
|---|---|
| shelf-hb.js | Collects a shop's whole catalogue: price, unit price, brand, quantity cap |
| shelf-queries.js | Drafts eBay queries from a shelf, split by postage band, skipping what is already scanned |
| scan.js | One call per phrase. Refuses over 250 listings, under £3 of goods, over £40, and prices the fee stack eats |
| gate.js | Samples the live listings and refuses: no small seller converting, market under 10 a month, nothing selling |
| import-gate.js | Puts what passed in front of her with its shelf price, buying ceiling and evidence |
| import-coverage.js | Writes what was checked and why the rest stopped |
| refresh-queries.js | Rebuilds a query file from the undecided rows in the database |
| limits.js | What eBay says is left today, and what that buys in scans or gated queries |
| audit.js | Audits her live listings against their sold data |
| sweep.js | Category discovery across the eBay UK tree |
| mine-terms.js | Mines eBay's autocomplete. Costs no eBay calls |
| ebay-auth.js | The OAuth dance |
| backup.js | Snapshots the tenant's tables |

## lib/

gate.js and import-gate.js were 928 and 906 lines. Split on 23 September into
modules that each do one thing. Behaviour is unchanged, and gate.js still
re-exports everything the other scripts import from it.

| Module | Holds |
|---|---|
| cost.js | The cost model: the fee stack, the postage bands, headroom, max goods, the floor |
| verdict.js | Every refusal. Each test refuses on its own; no score is blended |
| market.js | One query measured: search, sample, read |
| listing.js | Reading one listing: seller, brand, sales, age |
| ebay.js | Every call to eBay, paced, because a burst returns 429 for the rest of the run |
| env.js | Credentials, read from .env files |
| snapshot.js | Snapshots, and what sold between two of them |
| sources.js | Reading a run's CSV, the shelf map, the product JSON |
| row.js | One candidate row, including what to list at |
| refusals.js | Turning the gate's sentences back into codes |
| shops.js | Which shops might carry a product |
| persist.js | Refreshing a live batch and writing its coverage |

## Changing a threshold costs nothing

Both the scan and the gate can re-judge what they already measured, so moving a
number never means paying for the market again:

```
node scripts/scan.js --from-csv=research/scans/<file>.csv --csv=<same> --out=<queries>
node scripts/gate.js --from-snapshot=.gate/<file>.json --band=<band> --csv=<same> --out=<queries>
```

The gate needs the band passed, because a row does not carry its own and every
ceiling depends on it. Neither writes a new snapshot: a second file at today's
timestamp would make the next run compare a market with itself.

## probes/

Written while working out how a shop serves its catalogue. Home Bargains keeps
its products in a script tag as page data, twenty a page, with a total page
count beside them, and pages by URL parameters that are all lowercase:
`?sortby=newest&currentpage=2&perpage=40`. Query names it ignores return page
one, which is how a six page category read as twenty products for a month.

The next shop starts here.

## store/

The shop itself rather than the research: seeding, enrichment, sitemap.

## archive/

- **cj/** CJ Dropshipping. API access is disabled on the account, and sourcing
  has been UK only since 2 September.
- **terapeak/** and **terapeak-package/** The July and August method: monthly
  exports read by hand, merged and shortlisted. Replaced by reading the live
  market through Browse, which gives a rate on the first run.
- **shelf/** The first shop collectors, which scraped the rendered grid and
  read a price out of card text. A 69p lip balm came through with a £17.25 RRP
  because that was the largest number on the card.
- **maybe/** Not obviously dead. Move one back if a run needs it.

Updated 23 September 2026.
