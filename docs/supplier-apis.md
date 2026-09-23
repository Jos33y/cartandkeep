# Supplier APIs, for later

Written 5 August 2026, after two days on CJ. Neither of these is being built
now. This is what is known so the decision can be made quickly when it matters,
without repeating the search.

## Why this is parked

Supplier discovery by API did not work for beds and bedding. CJ's catalogue
returned one generic dog bed as the best match for fifteen different products,
and freight from China ran about the same as the goods cost, which removes the
margin on anything with volume. The products carrying real headroom are UK made
and bulky, and no dropship catalogue holds them.

The client sources her own suppliers and vets products with Hustle Got Real. Our
side records what she finds and computes the margin from it. CJ stays because it
is already wired and costs nothing to ask.

Both APIs below are worth having when the category mix moves toward small, light
goods, which is where dropshipping economics actually work.

---

## Avasam

UK based dropship marketplace. Suppliers are verified and UK located, which is
the reason to look at it: the freight problem that killed CJ does not exist when
the goods are already in the country.

**Why it fits.** UK stock means next day delivery is possible, which matters
under eBay's item not received policy. No import duty, no customs delay, no
fifty day transit.

**What to check before paying.**

Whether the API is on the tier being bought, or only on a higher one.

Whether the catalogue actually holds pet bedding and beds, since that is the
whole question and a general dropship marketplace may not carry bulky textiles
either.

Whether suppliers are wholesalers rather than retailers, because eBay allows
fulfilling from a wholesaler and not from another retailer.

Minimum commitment and whether it is monthly.

**Effort to add.** Small. `pipeline/sources/` already has an adapter shape and
`candidate_sources` already holds many suppliers per candidate with a fulfilment
route, so an Avasam adapter is a new file and a mapping row, not a rework.

---

## AliExpress

Real dropshipping API on AliExpress Open Platform. Bigger catalogue than CJ and
the same China freight problem, so it is worth having for small light goods and
not for anything bulky.

**Access.** Register as a developer on the Open Platform, submit the application
form, approval takes two to five working days. Then create an app with the
dropshipping option selected and take the App Key and App Secret. Start the
application before it is needed, since the wait is days.

**The call that matters.** `aliexpress.ds.product.get` returns product detail by
product id, and takes `ship_to_country` and `target_currency`, so UK pricing and
UK shipping come back directly rather than being estimated. That is better than
CJ, where freight needed a separate call and a variant id.

**The open question.** The documented dropshipping calls are product by id and
order placement. Whether the approved plan includes a text or image search
endpoint decides whether it can match at volume or only price a product already
identified by other means. Answerable once the keys exist, not before.

**SDK.** A maintained Node package, `ae_sdk`, handles the request signing, so
the authentication work is not ours.

---

## Ruled out

**Amazon.** The Product Advertising API is being deprecated through 2026 and is
closed to new customers, with new integrations pushed to the Creators API. It is
an affiliate API whose terms require the application to direct sales to Amazon,
and access depends on an Associates account holding qualifying sales. It is not
a sourcing API and there is no route in.

**Walmart.** United States only.

**Alibaba.** Business to business with request for quotation, no buyer side
product search API. The right route for buying stock at quantity, and that is a
manual relationship rather than an integration.

---

## What is already built and does not need repeating

`candidate_sources` holds many suppliers per candidate with fulfilment route,
minimum order, inbound freight, duty, origin, transit days, weight and
dimensions, and computes `landed_unit_cost` as a generated column so it cannot
drift from its inputs.

Nothing is trusted until confirmed, because matching an eBay title to a supplier
catalogue is a guess and thirty seven of thirty eight guesses were wrong.

CJ's sourcing request endpoint works and is the mechanism that scales:
`POST /product/sourcing/create` with `productName`, `productImage`,
`productUrl`, `expectPrice` and `remark`, returning a sourcing id and a source
number. Answers arrive in their app within about 48 hours. No query endpoint has
been found for reading the answers back, so checking them is manual.

CJ freight is `POST /logistic/freightCalculate` with `startCountryCode`,
`endCountryCode` and a `products` array keyed on `vid`, where the vid is a
variant id from `/product/query` and not the SKU string.
