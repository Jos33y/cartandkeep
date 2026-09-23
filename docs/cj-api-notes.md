# CJ Dropshipping API notes

Operational detail that is not obvious from the endpoint reference. Checked
25 July 2026.

Docs: https://developers.cjdropshipping.com/en/api/api2/

---

## Account freeze policy, read this first

CJ revokes API access if an account records **zero transaction amount for 30
consecutive days**. A reminder email goes out after 7 days.

https://developers.cjdropshipping.cn/en/api/api2/standard/points.html#account-freeze-policy

The account was created on 25 July 2026 with no orders against it, so access
lapses around **24 August 2026** unless something is bought through it.

This matters because the failure is quiet. The pipeline loses its cost source
and the symptom is an authentication error that reads like a broken key.

**Mitigation:** place a real order before the deadline. Sample orders count.
Once the storefront is trading, ordinary order flow keeps the account alive.
Until then it is a diary entry, not something to rediscover in September.

---

## Points, live since June 2026

The old daily call count is gone. Each call now deducts points from a daily
allowance.

| | |
|---|---|
| Base allowance | 50,000 points per day, resets 00:00 UTC |
| Order conversion | $1 of transaction in the last 3 months adds 100 points |
| Replenishment | Total / 1440 per minute, roughly 35 points, capped at the daily total |

Costs that concern us:

| Endpoint | Points | Note |
|---|---|---|
| `/product/listV2` | 50 | the search we run |
| `/product/query` | 10 | full product detail |
| `/logistic/freightCalculate` | 10 | real freight |
| `/product/queryProductsByImage` | 1000 | avoid |

**Budget:** 25 search terms per run is 1,250 points, about 2.5% of the daily
allowance. Roughly 1,000 searches a day available. Not a constraint at current
scale, and it stays comfortable at 40 clients on one account.

Every response carries `pointsInfo` with `usedToday`, `remaining` and `total`.
The runner prints it after each run. Exhaustion returns HTTP 429 rather than a
generic error, and the adapter reports it as such.

Replenishment is worth understanding: 35 points a minute against a 50 point
call means an exhausted account recovers at roughly one search every 90
seconds. Not a fast recovery.

---

## Freight is affordable, so the shipping estimate is temporary

`sellPrice` from `listV2` is goods cost only. The adapter currently adds
`config.shippingEstimateGbp` when a product is not flagged free shipping, which
is a guess.

`/logistic/freightCalculate` costs 10 points. Real freight for 500 products is
5,000 points, a tenth of the daily allowance. That is affordable, and it turns
estimated landed cost into actual landed cost.

This is the next accuracy improvement worth making, and it matters because
landed cost drives every margin she reviews.

---

## Rate limits

Frequency is tiered by account level, not flat:

| Tier | Requests per second |
|---|---|
| Free, sales level 0 or 1 | 1 |
| Plus, level 2 | 2 |
| Prime, level 3 | 4 |
| Advanced, level 4 or 5 | 6 |

Base ceilings apply regardless: 10 requests per second per IP, and **each IP is
limited to 3 users**, returning `one ip limit 3 users, Your Ip is XXX`.

The adapter paces at 1 request per second by default. Set
`config.requestsPerSecond` when the account tier improves.

The three-users-per-IP ceiling is the one to remember for multi-tenancy. Running
separate CJ accounts per client from a single server caps at three. One studio
account serving every tenant avoids the problem entirely, and the points budget
supports it.

---

## Authentication

`POST /authentication/getAccessToken` with `{"apiKey": "..."}`. Email and
password is legacy and should not be used for new integrations.

Access tokens last 15 days, refresh tokens 180 days. CJ caches server side, so
repeated token requests within 24 hours return the same token. The adapter
caches to `.cj-token.json`, gitignored, and refreshes rather than re-issuing.

Header on every authenticated call is `CJ-Access-Token`.

---

## Field notes

`sellPrice` and every other price is **USD**. Her margins are GBP. The adapter
converts using `config.usdToGbp` and refuses to run if that value is absent,
because an invented rate would corrupt every margin in the batch silently.

`listedNum` is how many sellers already list a product. That is saturation
evidence, the same shape as eBay listing depth, so it inverts: more sellers is
a worse signal.

`hasCECertification` is present on search results, which is useful for the
electrical items in her range.

`deliveryCycle` arrives as a string like `"3-5"` meaning days.

`countryCode=GB` filters to products with UK warehouse inventory. This is the
parameter that makes landed costs realistic rather than Shenzhen prices.

`addMarkStatus` is 1 for free shipping. Deprecated in favour of
`isFreeShipping` on some endpoints, but still returned by `listV2`.
