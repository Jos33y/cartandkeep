# Cart & Keep, handoff

20 August 2026. Written at the end of a long session, because the session got
long enough that I walked into a trap I had written the comment explaining, and
that is the signal to hand over rather than push on.

Read alongside, in this order:

- `decisions-2026-08-20.md`, the rules. Read first, nothing in it is open
- `build-plan-2026-08-20.md`, what to build next and in what order
- `messaging-plan-2026-08-20.md`, the chat, the offer, reviews
- `portal-gaps-2026-08-20.md`, the full inventory of what is missing
- `session-summary-ck-2026-08-20.md`, what was built today and why
- `feedback-ck-2026-08-20.md`, the mistakes and the patterns under them

---

## Where the build is

**She can run the shop from the portal.** Every field on a product, orders and
dispatch, stock, her own settings, what people look at, where they came from,
whether Google can find her, and what she makes on each channel.

```
Products     add, photograph, price, describe, categorise, count stock,
             confirm returns class, enter hazard data, take live or draft
Orders       see it land, picking list, copyable address, mark dispatched,
             see exactly which emails the customer got, resend a failed one
Settings     trading identity, delivery rates, postcode surcharges, the
             wording on the shop front
Interest     views, saves, baskets, removals, sales per product, searches that
             found nothing, and where visits came from
Being found  the monthly search report kept as a series, and what state the
             catalogue is in for Google
Finance      the full eight line margin model per channel, per product, per
             month, plus importing eBay and TikTok Shop sales from their own
             exports
```

**The storefront was already complete** at the end of the 18 August session and
is unchanged today except for the checkout function.

---

## The critical thing

**None of it has met a real payment.** No order has been placed, no email has
been sent to anybody, no CSV has met a real eBay export. Every figure quoted in
any document here came from fixtures, checked against arithmetic done by hand
and against real Postgres.

That is a good standard and it is not the same as working. The lifecycle test
below is twenty minutes and it is worth more than another screen.

---

## Migrations

Run and confirmed by Joseph: **through 0049**.

```
0042 orders_portal_access      confirmed run, grants verified
0043 order_emails              confirmed run
0044 trader_identity           confirmed run
0045 funnel_purchases          confirmed run, needed a drop before create
0046 store_images_bucket       not confirmed
0047 stock                     confirmed run
0048 tenant_scoped_policies    confirmed run
0049 store_settings_write      confirmed run
0050 interest                  NOT RUN
0051 seo_reports               NOT RUN
0052 product_cost              NOT RUN
0053 traffic_sources           NOT RUN
0054 channel_sales             NOT RUN
0055 selling_costs             NOT RUN
```

**0054 before 0055.** The second recreates a view the first creates.

Everything from 0050 onward was delivered and not confirmed applied. Ask before
assuming, and check `information_schema` rather than trusting this list.

---

## Edge functions

```
checkout        overwritten, needs redeploy. Reads config from the tenant row,
                resolves the delivery zone server side, refuses short stock
stripe-webhook  overwritten, needs redeploy. Applies stock, calls notify twice
notify          new, needs deploying. Holds all three email templates
feed            new, needs deploying. The Google Shopping feed
```

**Deploy `notify` before `stripe-webhook`**, or a paid order calls a function
that does not exist.

**Secrets required:** `RESEND_API_KEY`, and `relay.cartandkeep.com` verified in
Resend with its SPF, DKIM and DMARC records. Optional: `MAIL_FROM`,
`PORTAL_URL`, `FEED_TENANT_SLUG`.

---

## The lifecycle test, which is the next thing worth doing

Twenty minutes, and it proves six things currently assumed.

```
1  Settings, fill in the trading name, address and the four delivery numbers
2  Products, Ready, tick one, Take live
3  Open the shop in a private window. One product should appear
4  Buy it with 4242 4242 4242 4242
5  Two emails should arrive. The order should appear without a refresh
6  Expand it, pick a carrier, Mark dispatched. Third email
7  Take the product back to draft from the row
```

Expected and not a bug: the confirmation goes out without a trader block and
the row says so, until she fills those in.

---

## Blocking, and none of it is code

```
78 products still draft         the shop is empty to a stranger
12 gold blocks on legal pages   3 of them stop trading
7 chemicals with no hazard data
78 empty descriptions           blocks the shop, the feed and the SEO work
4 delivery surcharges at zero
11 returns classes unconfirmed  a script guessed them and the gate blocks them
trading name and address        required on every confirmation
```

Every one of these has a screen in the portal waiting for it, and she has not
been told any of them exist.

---

## Known issues, ranked

**1. Her trading name lives in two places.** 0044 put it on the tenant row and
`src/data/legal.js` still holds the other copy. Not urgent while both are
empty, a real trap the moment she fills one in. The fix is a refactor of
`legal.js` from a module scope constant into a factory, plus its callers. Half
a day, and it needs files nobody has read yet.

**2. `store_events` anon insert accepts any tenant id.** Known since the
scaling document and still unfixed. `has_tenant()` cannot help, because the
writer is a shopper with no session. The fix is routing events through an edge
function that reads the tenant from the Origin header.

**3. Two migrations numbered 0036.** Flagged on 18 August, still both in the
folder. Delete the `_v1` or rename it out of the sequence.

**4. `useStoreProducts` fetches the whole catalogue on every page.** Right at
78, wrong at 2,000.

**5. No bot filtering in analytics.** Views inflate the day the sitemap goes
in. Said on screen, not fixed.

**6. No rate limit on checkout.** Unlimited pending orders.

---

## Things worth not relearning

Most of these are in `decisions-2026-08-20.md` in full. These are the ones that
cost time today.

- **`create or replace view` cannot rename or reorder columns.** Drop first.
  Walked into twice, the second time having written the comment explaining it
- **A check that can produce a false positive will.** Five times in two days
- **Silencing a build makes a stale bundle pass a test suite.** An entire cycle
  was spent believing checks that were running against code that no longer
  compiled
- **`x && y` yields `false`, and `??` does not fall through `false`.** A match
  chain stopped dead and looked deliberate
- **A grant line that does nothing is worse than none**, because it reads like
  a restriction that is not there
- **`has_tenant()` is in migration 0001.** Look in the whole folder before
  concluding a mechanism does not exist
