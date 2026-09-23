# Session Summary, Cart & Keep

**26 July 2026, WAT.** Continues 24 July.

Started: v2.1 scope live, payment settling, nothing built.
Ended: schema, auth, review interface, scoring pipeline, design system. Demand
layer blocked on Terapeak.

---

## Shipped

**Scope v2.2.** Governing law Nigeria to England and Wales, exclusive
jurisdiction, good faith and mediation before proceedings. GDPR left out
deliberately: a one line compliance assertion does not satisfy Article 28, and
Nigeria has no UK adequacy decision, so transfers need an IDTA. Committing to a
DPA as a schedule is the honest version.

**Studio skill.** `brick-dev.skill`, three files. House style, client register,
multi-tenant rules, design conventions. Cart & Keep is tenant one.

**Database.** 10 tables, RLS throughout, migrations 0001 to 0006.

| | |
|---|---|
| 0001 | schema, RLS, seeds, tenant one |
| 0002 | AliExpress is api not scrape, Terapeak needs no Store subscription |
| 0003 | terapeak_export weight, omitted from the original seed |
| 0004 | tenant research config, categories and terms as data |
| 0005 | category boundaries, 44 exclusion terms, 12 allow overrides |
| 0006 | CJ source config, apiKey only, USD rate required |

**Portal.** Hostname chunk split, store 3.4kB and portal 236kB, verified no
operator data in the shopper bundle. Auth by email code. Membership and admin
gate. Error boundary. Candidate review ledger.

**Pipeline.** `run.js`, `seed.js`, `tidy-zik.js`. Libraries for margin, metrics,
gates, ranking, brand, matching. Adapters for CJ, Zik, eBay Browse, CSV export.
5 test suites.

**Design system.** Rebuilt around one thesis: a trading terminal that went to
finishing school. Numbers are the display face, IBM Plex Mono at 2.75rem. The
signature is a segmented verdict bar showing why a score is what it is. Ledger
rows expanding in place, not cards.

---

## The big correction

**Built supply-first, should have been demand-first.**

Searched CJ's catalogue by keyword, then tried to attach demand. Result: a food
mixer from beauty search terms, 58 of 62 signals one branded lash kit line, 14 of
25 terms empty.

A supplier warehouse decides its own contents and has no opinion about what UK
buyers want. Correct order is demand, competition, trend, supply, economics,
risk, score. Written up in `docs/research-methodology.md`.

Same error twice: reached for CJ before Zik because CJ had a clean API, then
reached for Zik before Terapeak because Zik had a nicer UI. Both times the harder
thing came before the easy complete thing.

---

## Issues and fixes

### Code

| Issue | Cause | Fix |
|---|---|---|
| `destroy is not a function` | `useEffect(() => window.scrollTo(0,0))` implicit return became the cleanup | braces |
| Blank page on `?portal` | lazy chunk threw, no error boundary, `fallback={null}` | `AppError.jsx`, visible fallback |
| Node 20 WebSocket crash | supabase-js builds a realtime client on createClient | `lib/db.js`, native check with ws fallback |
| `SUPABASE_SERVICE_KEY` | Supabase renamed to publishable and secret | renamed, old name still read |
| Code rejected as expired | `maxLength={6}`, OTP set to 8, silently truncated | accept 6 to 10 |
| Wrong error text | Supabase says "expired or is invalid", regex picked one | say neither |
| Admin locked out | gate checked `memberships` only, studio staff have no row | check both tables |
| `toGbp(null)` returned 0 | `Number(null)` is 0 and `isFinite(0)` is true | reject non-positive, drop the product |
| Matcher merged 31 into 3 | overlap coefficient divides by the smaller set, and groups grew their token sets, becoming attractors | fixed threshold, no growth, min 2 shared |
| "Dog Treat Puzzle Toy" excluded | `treats` matched a food term | allow list, word boundaries |
| CJ 429 misread | rate limit and points exhaustion share a status code | `classify429`, retry one, fail the other |
| One term killed the batch | adapter threw mid loop | per term capture, continue |
| Test failed on Windows | fixture path from the container | search `drops/`, skip if absent |

### Accessibility, all measured not assumed

| Pairing | Was | Now |
|---|---|---|
| white on terracotta | 3.90 | 4.55, `--c-action-strong` |
| terracotta text | 3.36 | 4.75, `--c-action-text` |
| `--c-ink-faint` | 2.95 | 4.83 |
| warning amber | 3.44 | 4.53 |
| control borders | 1.50 | 3.20, `--c-control` |

Her brand terracotta stays wherever it is seen as colour. The darkened variants
appear only where something must be read against it.

Also: skip links, 44px targets, `aria-pressed`, real `role="progressbar"`,
labelled controls, per row context so a screen reader does not hear "Approve"
three times, `noindex` on portal and status since all three hosts share one HTML
document.

### Process

**Edited an applied migration.** Corrected 0001 after it had run, breaking the
append-only rule written two hours earlier. Reverted, moved the change to 0002.

**Own architecture doc was wrong.** Handoff said provision a Supabase project per
client. That is the single-tenant instinct and does not survive client three. One
platform database, tenant column, and the scope promises database export not
transfer, so it is compliant.

---

## Data findings

**Zik trial is not usable as a data layer.** No export, 100 rows per search, 5
searches, 30 day window, third party. Advised four exports before noticing the
counter, which would have burned 80% of them.

**Terapeak is eBay's own data.** Acquired 2017, free to all sellers since April
2021. Same day transactional data, up to 6 million events daily across roughly 2
billion documents. Three years of history, no search cap, full category tree,
Best Offer accepted prices which public search never shows. Zik is a third party
crawling what eBay gives her for free.

Access route is MUAA with the **Terapeak Research** permission, which exists for
exactly this.

**From 120 pasted rows, 70 unique:**

| | |
|---|---|
| duplicates in the paste | 50 |
| supplements, not beauty tools | 45 of 120 |
| declining or stopped | 51, with 34 selling nothing in 7 days |
| passed all gates | 4 |

The clearest case: **Large Pet Self Cooling Mat, 382 sales in 30 days, zero in
the last 14.** Sort by 30 day sales, the default, and it is the top product. It
has stopped selling. Three cooling mat listings show the same collapse. Now a
regression test.

**Average price on the generic pet search was £5.16.** At £6 with a small parcel
that is minus £1.12 per sale. The 337% sell-through was real and irrelevant.

**Derived price floor:** £14 large letter, £20 small parcel, from net £4 absolute
and 25%, with eBay 12.8% + 30p, ads 6%, returns 5%, goods 30%.

**The four survivors were a denture cleaner, a massage gun, a sweetener and eye
drops.** Gates correct, input wrong. One search sorted by volume at £12 and above
surfaces consumables and supplements by construction.

---

## Decisions

| Decision | Reason |
|---|---|
| Demand first, supply second | supplier catalogues decide their own contents |
| Terapeak as demand layer | first party, free, unlimited, three years |
| Zik reduced to VeRO and cross-platform | her subscription already covers it |
| Beauty Tools & Accessories, Pet Accessories | each name draws its own boundary |
| No cosmetics | importer becomes Responsible Person under UK Cosmetics Regulation |
| No pet food or health | animal feed rules, veterinary medicines |
| No scraping with residential proxies | evasion breaks silently at a time nobody chooses, and it is a poor foundation under a UK company |
| One studio CJ account for all tenants | three users per IP ceiling, points budget covers roughly 40 clients |
| Gates separate from ranking | otherwise one strong dimension carries an unacceptable candidate |
| Mono as display face | in a product where data is the content, data gets the voice |
| Ledger not cards | cards make 40 candidates feel like 40 pages |

---

## Client

Agreed beauty accessories and pet accessories as the start. Her framing on the
cosmetics line was sharper than the regulatory one: things, not chemistry.

She sent competitor research across five categories. It contained portable
heaters and fans in the same list, which is the signature of a twelve month
aggregate rather than a seasonal read. That is the argument for the pipeline,
made with her own research.

She noticed a Zik contradiction and quoted it back. She tracks what is said.

She already has Zik and granted access, so no second subscription.
