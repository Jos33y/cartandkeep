# Data Sources

Reference for the research pipeline. What each source gives, how access is
obtained, and what was decided. Update this file when a source changes state.

Last checked: 25 July 2026.

---

## Status

| Source | Signal | Access | Cost | State |
|---|---|---|---|---|
| eBay Browse API | pricing, depth | Base developer tier | Free | Apply today |
| eBay Marketplace Insights | velocity | Limited Release, rarely granted | Free | Request, expect no |
| Terapeak Product Research | velocity | Free with any seller account | Free | Available now |
| Zik Analytics | velocity, competitor, Shopify spy | Subscription, UI export | Paid | Have it |
| AliExpress Open Platform | demand, supply | Affiliate API, manual review | Free | Apply today |
| CJ Dropshipping | supply, landed cost | Developer account | Free | Apply today |
| Met Office | seasonality | DataHub API key | Free tier | Apply |
| Google Trends UK | demand, seasonality | No official API | n/a | Deferred |

---

## eBay

**Developer programme:** https://developer.ebay.com

No UK IP is required. The marketplace is selected per request by the
`X-EBAY-C-MARKETPLACE-ID: EBAY_GB` header, not by the caller's location. A
developer account registered in Nigeria querying UK data is normal and
supported. `pipeline/sources/ebayBrowse.js` already sends the header, taken
from `tenants.marketplace`.

Register with real details. That account is the foundation of the Monday
delivery, and an account suspended for misrepresented registration details is
not recoverable on a timeline that matters.

**Setup order:**

1. Create the developer account
2. Application Keys, create a **Production** keyset, not Sandbox
3. Subscribe to or opt out of marketplace account deletion notifications. Until
   this is done the keyset shows as disabled and every call fails.

**Browse API** is on the base tier and returns active listings: current pricing
and category depth. That is competition evidence, and it is half of what a
candidate score needs.

**Marketplace Insights** is where sold-listing velocity lives. It is a Limited
Release API approved only for selected partners through the production access
process. There is no self-serve form; the route is a developer support ticket
describing the use case. Individual developers are routinely refused. Send the
request, then plan as though the answer is no.

The old Finding API `findCompletedItems` operation is retired. Anything online
describing that approach predates the change.

### Terapeak

**Docs:** https://www.ebay.com/help/selling/selling-tools/terapeak-research?id=4853

Terapeak Product Research has been free to all sellers since April 2021. No
Store subscription is needed. It gives three years of sold data: sold prices,
sell-through rates, average shipping, listing counts. Access is through Seller
Hub, Research tab.

This is the practical answer to the velocity gap. The data eBay will not expose
through the API is sitting in her Seller Hub for free, exportable.

Sourcing Insights, the category-level tool, is the part that still needs a Basic
Store subscription or above, around £19.99 a month in the UK. Not needed for
month one.

---

## Do we still need Zik?

**Yes, but the reason changed.**

Terapeak now covers sold velocity for free, so Zik is no longer the only route
to the headline signal. What Zik still does that Terapeak does not:

- Competitor tracking across sellers
- Shopify store spy
- Evergreen product filters

All three are named in scope section 4.1, so Zik is a committed source and
dropping it is a conversation with her, not a unilateral cut. It is also the
tool she already reads fluently, which means candidates cross-referenced against
Zik arrive in a vocabulary she trusts.

**But it is no longer a dependency.** If margin gets tight on a £200 retainer,
Terapeak covers the velocity half at no cost, and Zik becomes the thing that
sharpens the filter rather than the thing that feeds it. Worth knowing before
the month two pricing conversation on 17 August.

Neither tool has an inbound public API. Zik's integrations push outward into
listing tools such as AutoDS and DSM Tool. Both are therefore export sources,
handled by `pipeline/sources/csvExport.js`, which reads the latest CSV from a
drop directory and normalises it into the same shape as any API source.

---

## AliExpress

**Open Platform:** https://openservice.aliexpress.com
**Docs:** https://openservice.aliexpress.com/doc/doc.htm
**Affiliate portal:** http://portals.aliexpress.com

There is an official API. The original architecture treated AliExpress as a
scrape source and that was wrong.

Sign in with an AliExpress account, go to App Management, Create App, and choose
**Affiliate API**. Applications are reviewed manually and typically processed
within a couple of days. Fill the fields accurately; the review is by a person.

The affiliate APIs return product catalogue data, and the Dropshipping API
returns product information by product ID, which covers the demand and supply
signals the pipeline needs.

---

## CJ Dropshipping

**Docs:** https://developers.cjdropshipping.com/en/api/start/
**API v2:** https://developers.cjdropshipping.com/en/api/api2/

Proper developer API. Register a CJ account, then My CJ, Authorization, Stores,
select the API option to generate a key. All calls are HTTPS, JSON, UTF-8. The
access token is cached and refreshed rather than requested per call.

Endpoints cover authentication, settings, product, storage, shopping, and
logistics. Product and logistics are what matter here: UK warehouse stock and
landed cost.

---

## Google Trends

No official public API. Every library that appears to offer one is scraping an
internal endpoint, and they break without warning.

It is weighted 0.8 in the seeded scoring config and is not load-bearing. Ship
without it. Revisit if a supported route appears.

---

## Position on scraping and proxies

Rotating residential proxies exist to defeat bot detection. Using them against
AliExpress or Google is a different category of thing from registering an
account honestly, and the argument against is commercial rather than moral.

A pipeline built on evasion breaks silently and at a time nobody chooses. With
fifty clients depending on a Monday delivery, a rule change on a Sunday costs
fifty relationships and the Monday. It is also a poor foundation under a UK
company and a visa application, where the infrastructure gets looked at.

With Terapeak free and AliExpress offering an official API, legitimate coverage
is effectively complete. The only gap is Google Trends, which is not
load-bearing.

**Where proxies are genuinely useful:** verifying the storefront from a UK IP.
Building a UK ecommerce site from Lagos means delivery logic, currency display,
and Core Web Vitals over a UK connection cannot otherwise be checked. Same for
confirming her eBay listings render correctly to a UK buyer. That is real
quality assurance and entirely above board.

---

## Apply today

All free, all queue time outside our control, none blocked by payment settling.

1. eBay developer account, production keyset, deletion-notification compliance
2. eBay Marketplace Insights request through developer support
3. AliExpress Open Platform, Affiliate API application
4. CJ Dropshipping developer account and API key
5. Met Office DataHub key

Terapeak needs no application. It is already available in her Seller Hub.
