# Handoff, Cart & Keep

**Session close:** 26 July 2026, WAT
**Load with:** this file, the session summary, the feedback file, plus
`docs/research-methodology.md` and `docs/design-system.md` from the repo.

---

## Opening message for the new chat

> Continuing Cart & Keep. Portal auth, review interface and scoring pipeline are
> built and tested. Demand layer is blocked on Terapeak access. Next: eBay Browse
> keyset, then Terapeak ingest. Context in attached files. House rules in the
> feedback file, read it first.

---

## Repo state

```
cartandkeep/
  docs/            data-sources, cj-api-notes, research-methodology, design-system
  drops/           manual exports, raw/ holds the untouched paste
  pipeline/
    run.js         batch runner, demand -> match -> score -> gate -> write
    seed.js        30 synthetic candidates for interface work
    tidy-zik.js    pasted table to readable CSV
    lib/           db, margin, metrics, gates, rank, brand, match, scoring
    sources/       index (registry), zikExport, cjDropshipping, ebayBrowse, csvExport
  src/             React 19, react-router 7, Vite 6, CSS modules
  supabase/        migrations 0001-0006, queries/, AUTH.md, README.md
```

`npm test` gives 5 suites passing. `npm run build` clean.

## Built and working

- Multi-tenant schema, RLS on all 10 tables, Cart & Keep as tenant one
- Portal auth, six to ten digit email code, `platform_admins` and `memberships`
- Candidate review ledger with the verdict bar, mobile first, WCAG AA verified
- Scoring: gates separated from ranking, both skip missing metrics rather than failing
- Margin model: platform fee, promoted listings, postage by band, packaging,
  returns provision, goods, with estimated costs labelled
- Brand screen, category exclusion, cross-source matching
- CJ adapter: token cache, points tracking, 429 classification, USD to GBP
- Zik adapter: reads raw paste or tidy CSV

## Stubbed

Every portal page except Candidates. Entire store. Status page items are
hand-maintained in `src/pages/status/statusItems.js`.

## Blocked

**Demand data.** Zik trial is exhausted and capped. Terapeak is the replacement:
first-party eBay data, free, three years, unlimited searches, full category tree.

---

## Do these first

**1. eBay account registration, Nigeria.** Basic buyer account, not seller.
Needed for MUAA. Test it before asking her, so one message goes out not two.

**2. MUAA.** She goes My eBay, Account, Permissions, Add user, ticks **Terapeak
Research**. That permission exists specifically for this. She keeps her password,
every action is logged, revocable instantly. If registration fails, she runs the
exports herself.

**3. eBay developer keyset.** developer.ebay.com, **Production** not Sandbox.
Then subscribe to or opt out of marketplace account deletion notifications or the
keyset stays disabled. Browse API is the competition layer and unblocks
sell-through, which was skipped on all 70 listings tonight.

**4. AliExpress affiliate application.** openservice.aliexpress.com, App
Management, Create App, Affiliate API. Two days review. She already sources
there.

**5. CJ account freeze, before 24 August.** Zero transactions for 30 consecutive
days revokes API access. Account created 25 July with no orders. One small order
resets it. Failure mode is an auth error that reads like a broken key.

---

## Then build

**Terapeak ingest adapter.** Same shape as `zikExport.js`. Check whether the free
Seller Hub version exports CSV before building against it.

**Wire sell-through.** `sellThrough({ sold, activeListings })` exists in
`metrics.js` and the gate is written. It needs active listing counts from Browse.

**Reorder `run.js` to demand-first.** Currently supplier-led. Demand produces the
product list, supply becomes a targeted per-product lookup.

**Freight instead of the estimate.** `/logistic/freightCalculate` costs 10 points
of a 50,000 daily allowance. 500 products is a tenth of the budget. Replaces
`shippingEstimateGbp`.

---

## Open strategic question

Category boundary is agreed: **Beauty Tools & Accessories** and **Pet
Accessories**. Cosmetics out, pet food and health out.

But the one real Zik search showed almost nothing in those categories clears the
£14 price floor. At £12 and above, Health & Beauty is supplements and Pet
Supplies is consumables. Below £14 the margin does not work.

Three routes, hers to choose:

1. **Bundle.** Sets rather than singles. Same goods at £18 instead of £7, and the
   postage band often survives it. Standard answer to exactly this problem.
2. **Look past the top 100.** Volume ranking surfaces consumables by
   construction. Terapeak has no cap, so this becomes testable.
3. **Widen the categories** toward Home & Kitchen or Fashion Accessories, both on
   her own research list, both at higher price points.

Terapeak makes route 2 answerable without guessing. Do that before raising it
with her.

---

## Numbers

| | |
|---|---|
| Retainer | £200/month, setup £50 |
| Paid | £170 upfront, £80 due 23 August |
| Month two review | 17 August, £500 discussed verbally only |
| First pipeline delivery | Monday 10 August |
| Month one complete | 22 August |
| SEO report | 24 August, then 22nd monthly |
| Price floor | £14 large letter, £20 small parcel |
| Gates | net £4 absolute and 25%, sell-through 30%, trend 0.8 |
| eBay fees | 12.8% + 30p |
| Promoted listings | 6% budgeted |
| Returns provision | 5% default, 6% beauty, 3.5% pet |
| CJ points | 50,000/day, listV2 costs 50 |
| Governing law | England and Wales, scope v2.2 |
