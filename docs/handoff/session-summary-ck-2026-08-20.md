# Session summary, 20 August 2026

From a portal that reviewed research candidates to one she can run a shop from.
Roughly sixty files and fourteen migrations, 0042 through 0055.

The reasoning is recorded where it is not obvious from the code. Where it is
obvious, it is not repeated here.

---

## 1. Orders, and the emails

**The portal could not read a single order.** 0037 enabled row level security
on `orders` and created no policies, deliberately, because at the time the only
reader was a customer arriving through a service role function. Every other
portal page reads directly under an authenticated session.

0042 opened it with column privileges rather than a policy alone: select on
named columns excluding `access_token`, update on four dispatch columns and
nothing else. So she cannot rewrite a total from a browser because the
privilege does not exist, which is a harder guarantee than an edge function
would have been.

The grants were checked first and the check changed the migration. `anon` and
`authenticated` both held table level select and update on every column,
`access_token` included, with RLS the only thing standing between an anonymous
visitor and every delivery address in the database.

**Three emails**, all templates in `notify`, called by the webhook rather than
duplicated into it, because two copies of a statutory paragraph is two
paragraphs that disagree within a month.

The confirmation is a legal document rather than a courtesy. Regulation 16 of
the Consumer Contracts Regulations requires it on a durable medium no later
than delivery, and four consequences shaped the build rather than the wording:
omitting the cancellation information extends the cancellation period to
fourteen days from whenever it is eventually given, up to twelve months; not
saying the consumer pays return postage means she pays it; not giving the
information removes her right to deduct for goods handled beyond what a shop
would allow; and the burden of proving it was given is on her, which is why the
send log stores what was sent rather than a boolean.

The rights block varies by returns class, because where there is no
cancellation right the trader must say so, and this catalogue holds sealed
hygiene goods and consumables alongside ordinary ones.

**The dispatch email fires only when the parcel is newly gone**, not when a
tracking number is corrected two days later.

---

## 2. Products she controls

**Nothing in the application wrote `store_products.status`.** Not the portal,
not a script, not a function. Grepped rather than assumed. The shop could not
be opened by any route except SQL typed by me.

The release screen is a gate rather than an editor, because `enrich-store.js`
had already classified every returns class and flagged the hazard suspects into
`derived_fields`. Her job is confirming a script's guess, which is lighter than
authoring one and is exactly what the 0036 comment demands.

**The guard blocks on price, photograph, an unconfirmed returns class, missing
hazard data on a flagged product, and zero stock where stock is counted.** The
returns check earns its place: `returns_class` defaults to `standard` at the
column level and the enrichment only ever writes `sealed` or `none` into
`derived_fields`, so a gift set full of bath products currently presents as an
ordinary fourteen day return and nothing stopped it going live saying so.

Tested over twenty titles in the shape of her catalogue in both directions.
Nine release, eleven block, and the photo album passes clean, which was the
false positive worth checking because "album" sits near "pad" and "liner" in
that classifier.

**Then everything else on the record:** title, price, section, brand,
specifications, what is in the box, description, stock, availability, and
photographs.

**Photographs were the substance.** There was no image storage on the project
at all, not a single call to `storage.from`. Resizing happens in the browser to
1600 pixels, WebP where the browser can encode it, with `createImageBitmap` and
`imageOrientation: 'from-image'` so a portrait photograph does not land on its
side, and a white ground painted underneath so a transparent PNG does not
encode to a black box.

---

## 3. Stock

`stock` had been on the table since 0034 and nothing read it, wrote it, or
selected it. Null means untracked and a number means she has that many, so all
78 seeded products behave exactly as before.

**Applied on payment, in one statement, not at session creation.** Reserving at
checkout would let an abandoned basket hold her last item for the hour Stripe
takes to expire it. The cost is that two people can pay for the same last item,
which is allowed to happen and reported by name in her alert email. Refunding
one of two buyers is two minutes; refusing a sale of something that was on the
shelf is worse.

---

## 4. Settings, and a mistake corrected

**`tenants_write` is platform admin only**, so she could not change her own
trading name, and column grants could not narrow it because studio staff
authenticate as the same role. So `set_store_settings`, a security definer
function that checks membership and merges only whitelisted keys, matching the
convention `has_tenant` and `is_platform_admin` already set.

Run against real Postgres with enough of 0001 stood up to exercise the actual
predicate, which found a real bug: `jsonb_set` replaces the object at a key, so
saving only her legal name would have silently wiped the trading name, support
address and complaints URL beside it.

**And the correction.** I wrote `using (true)` into 0042 and 0043 with a
comment saying no membership mechanism existed in migrations 0029 to 0041. It
exists, in 0001, and `PortalProtected` had been calling it since before the
storefront was built. I looked in the wrong range, asked once, got no answer,
and shipped anyway. 0048 corrects every policy I wrote and two that were not
mine.

---

## 5. Interest, and traffic

Nine events had been recorded since the storefront shipped and nothing read
any of them.

**`store_product_funnel.purchases` was always zero and always would be.** The
view joined events to products on `e.product_id = p.id` and counted purchase
events, and the purchase event carries a reference and a total and no product
id. It was also fired from the confirmation page, which a paying customer need
never load. Both fixed by taking purchases from paid `order_items` instead.

**Saves and removals were recorded and unreadable**, and they are what make the
verdicts useful rather than decorative, because they separate a photograph
problem from a price problem. `save_product` had also been in the check
constraint since 0039 and fired by nobody while the hearts worked perfectly.

**Traffic sources were half built already.** `referrer` had carried the host
and path since 0039 with the query string stripped. What was missing was
campaign capture, which is the half that matters here: TikTok's in-app browser
strips the referrer, so the one channel she already has an audience on was the
one that could never be measured. The screen tells her the exact link to use
rather than explaining why the number is wrong.

Classification lives in the view, so a correction applies to visits already
recorded rather than only to future ones. Attribution is per visit, not per
event.

---

## 6. Being found, and the feed

The retainer commits to a monthly SEO report. **The trend is the deliverable**,
so it is a stored series rather than a live read: Search Console drops history
after sixteen months, access can lapse, and each month carries a written read
of what changed which has nowhere to live in an API response.

**Null is not zero.** A month before the property was verified draws as a
hollow outline, and the month on month line only appears when both months could
see, because null to eleven is the day verification landed rather than growth.

**The Google Shopping feed** is a pull URL Merchant Center fetches daily rather
than the Content API, so no credentials live in our infrastructure and a broken
function means Google keeps yesterday's data. A product missing a required
attribute is skipped rather than sent incomplete, because enough disapprovals
put an account under review.

It will carry zero products until descriptions exist, because Google requires
one. That is stated on screen.

---

## 7. Cost, and what she actually makes

**Nothing recorded what a product costs her**, which is why four month one
commitments in Section 5 were sitting as queued when they were not startable.

Landed cost and postage cost on the product, inherited from the cheapest
confirmed supplier quote where the product came from the pipeline. The margin
panel shows three channels rather than one number, because on a £117 pan set
she keeps £49.08 through her own shop against £35.73 through eBay, and that is
the argument for building her a shop made in her own figures.

**Then the other channels.** `orders` holds shop sales only, so the portal
showed none of her eBay or TikTok revenue, which today is all of her revenue.
`channel_sales` takes it from the exports both platforms already give her,
parsed in the browser, with a CSV reader written rather than installed because
quoting and BOMs are forty lines of a specification that has not changed since
2005.

**And the model the finance page had promised since July.** Revenue, platform
fee, promoted listings, postage, packaging, returns provision, cost of goods,
net. Packaging and the returns provision were recorded nowhere, so a four line
model was wearing an eight line promise.

With her real figures: **£46.32 on her shop, £40.66 on TikTok, £28.28 on
eBay**, verified against hand arithmetic before it reached a screen.

---

## 8. The hedging pass

Late in the day Joseph made a point that changed five screens: a zero is not a
failure to report, it is the most motivating number on the page.

I had built hedges everywhere. "Not yet" instead of £0. "Too early to say"
instead of a rate from twelve views. A withheld channel total whenever one
product lacked a cost, which is the normal state and would have shown nothing
for months.

All of it now reports the figure and says what it excludes beside it. The one
hedge kept is the hollow bar, because we could not see and nobody came are
genuinely different facts.

---

## 9. What was checked rather than recalled

- Google's product data specification, before writing the feed
- Regulation 16 and Schedule 2, before writing the confirmation
- The actual grants on `orders`, which changed 0042
- The fee shape on the tenant row, before writing any margin
- Current model pricing, before recommending one
- The binomial arithmetic behind the view thresholds
- `has_tenant()`, eventually, and it should have been sooner

---

## 10. Next

`build-plan-2026-08-20.md`. AI descriptions first, because 78 empty ones block
the shop looking finished, the Google feed and the SEO work at once, and it is
the largest piece of manual work left.

But before any of it: the lifecycle test. Nothing above has met a real payment.
