# Google Trends UK, through Apify

30 September 2026 · internal · brief for the build

## Why

The scope promised Google Trends UK: search interest over 30 and 90 days. It has not been used yet. Google's own Trends API is application-only, so this goes through Apify's Google Trends Scraper (`apify/google-trends-scraper`, maintained by Apify, from $3 per 1,000 results). Joseph has access to it in the Apify console.

Trends is a timing signal, not a demand list. Demand comes from Google Merchant Center best sellers and the eBay gate. Trends answers: is interest in this product rising or falling now, and when does it peak?

## Before building

1. Check the account can run the actor: the console showed "Limited permissions". Confirm the Start button works and billing is set up.
2. API token: Apify console, Settings, API & Integrations. Store it in `.env` as `APIFY_TOKEN`. Never in chat, never in code.
3. The actor's input format: its Input tab, switched to JSON. Build from those real field names (search terms, country, time range), not from memory.
4. What counts as one "result" for billing: one search term, or one data point. Measure on a run of 5 terms before a run of hundreds.

## What to run it on

Only products already worth a decision, never the whole shelf pool (about 730,000 products):

- the passes and set-asides from each eBay gate
- the store cards (Google best sellers confirmed at a UK shop)

A few hundred terms a run. Use the card's key (`queryOf()`, the same string as `external_ref`) as the search term, so results join back to cards with no mapping. Very short or generic keys ("bin", "mop") return noise; skip keys of one word.

## What to measure

- Country: United Kingdom only.
- Windows: last 90 days, and last 12 months for season.
- One term per request. Trends scales every term in a request against the others, so batching several terms in one comparison distorts them.

From each series:

| Reading | How |
|---|---|
| Direction | mean of the last 30 days against the 60 days before: rising (+20% or more), falling (-20% or less), otherwise steady |
| Season | from the 12-month series: the month it peaks, and whether the peak is more than twice the yearly mean |
| Too little data | Trends returns zeros for low-volume terms. Mark "too few searches to read", never "falling" |

Save the raw series to `research/trends/<date>/<query>.json` and one summary row per query to `research/trends/trends-<date>.csv`: query, direction, change %, peak month, seasonal yes or no, read at.

## On the card

One line under the evidence, for example:

- "UK searches rising, up 40% in 30 days"
- "UK searches steady"
- "Seasonal: peaks in January, rising now"
- "Too few UK searches to read"

It never refuses a card and never changes a price. It helps her decide what to buy now and what to hold for its season.

## Cost and cadence

- A few hundred terms per run, so a dollar or two.
- Monthly for the store cards; after each gate for new passes. Not daily.
- Record every run's term count and cost, so the spend is visible.

## Caveats

- Collecting Google Trends through a third party is a grey area under Google's terms. Apify does the collecting; the use here is internal research. Nothing customer-facing depends on it.
- Trends shows relative interest, 0 to 100, not search volumes. Compare a term only with itself over time, never one product against another.
- Low-volume products (many forced-search part numbers) often read as zero. That says nothing about demand; the eBay gate does.

## Status page

Once live, the scope's "Google Trends UK" line moves from not started to delivered, with this method named. Until then it reads not started.
