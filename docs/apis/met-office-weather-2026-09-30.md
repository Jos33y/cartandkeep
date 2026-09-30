# Met Office weather signal

30 September 2026 · internal · brief for the build

## Why

The scope promised the Met Office weather API: a 7-day forecast as a seasonal signal for weather-driven products. It has not been used yet. Heated airers, electric blankets, dehumidifiers, moisture absorbers, de-icer, fans and cool mats all sell with the weather, and the eBay gate and Google best sellers already hold many of them.

## Which Met Office product

- **Subscribed, 30 September: Global Spot, free plan.** 10,000 requests a month, 360 a day, standard terms. The API key is in `.env` as `METOFFICE_KEY`. Never in chat or code.
- Not the Atmospheric data product (raw model data by the gigabyte), and not the Blended Probabilistic Forecast (probabilities; worth a look later if the simple triggers prove useful).
- From the Met Office overview (datahub.metoffice.gov.uk/docs/f/category/site-specific/overview): Global Spot takes a latitude and longitude and returns GeoJSON. The daily API returns 41 parameters covering 7 days: **one day past and six days ahead**. It updates hourly. Parameters cannot be subset.
- Build from the Global Spot **API documentation** and **sample download code** pages linked from that overview: endpoint, the key's header name and the parameter names come from there, not from memory.

## What to fetch

- About ten UK points, once a day: London, Birmingham, Manchester, Leeds, Newcastle, Glasgow, Cardiff, Bristol, Belfast, Norwich.
- The daily forecast: the six days ahead (skip the day past), taking minimum and maximum temperature, chance and amount of rain, and wind from the 41 parameters.
- About ten calls a day. Save each day's answers to `research/weather/<date>.json`.

## Triggers

Worked out across the points, so a trigger means most of the UK, not one city.

| Trigger | Fires when | Product groups it lifts |
|---|---|---|
| Cold week | minimum under 3°C on 3 or more of the six days ahead, in most points | heated airers, electric blankets and throws, draught excluders, de-icer, heated wearables, hot water bottles |
| Wet week | rain likely on 3 or more of the six days ahead, in most points | dehumidifiers, moisture absorbers and refills, mould remover, indoor airers, shoe dryers |
| Heat spell | maximum over 25°C on 3 or more days, in most points | fans, cool mats, portable air coolers |
| Frost | minimum under 0°C on any day | de-icer, windscreen covers, pipe lagging |

Product groups are matched by the need and season tags the store picks already carry (winter, damp) and by title words, kept in one table in one file.

## What it changes

- The rotation: on a day a trigger fires, the matching lines move to the front of the scan and gate order.
- The card: one line, for example "Cold week forecast across the UK: demand for this usually rises". It never refuses a card and never changes a price.
- The Overview: one line naming any trigger live today.

## Cost and cadence

- Free plan, about ten calls a day against a limit of 360.
- Run once a day, early morning, before the eBay budget resets.

## Caveats

- A forecast is a nudge for timing, not demand. Demand comes from Google best sellers and the eBay gate.
- Thresholds above are a first guess. Record when a trigger fired and what sold in the fortnight after, and tune from that.

## Status page

Once live, the scope's "Met Office UK weather API" line moves from not started to delivered, with this method named. Until then it reads not started.
