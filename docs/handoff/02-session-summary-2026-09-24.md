# Session summary: portal, Your shop section

**24 September 2026** | The Brick Dev Studios | Internal

Every page in the portal's Your shop section was redesigned, its SQL checked against a real Postgres 16, rendered in a local harness with realistic data (her data shape, an empty shop, and 300 products or 10,000 visits), and deployed. All migrations and edge functions below are live.

## Pages finished

| Page | What changed |
|---|---|
| Products | Readiness grid: a mark per step to going live, biggest gap named with a button, side sheet per product, deep links `?open=<id>&step=<key>` |
| Dashboard | Fourteen day pulse chart, three tiles, "What needs you" ranked by what it blocks |
| Sections | Cards with photos and a 3-product threshold, her own sections, rename in place, move products, delete with confirm |
| Orders | Dark dispatch desk, oldest first queue, five stop order track, one tap carriers, celebration on dispatch |
| Packing slip | Its own A4 layout, no prices anywhere (the old one printed line prices), tick-box contents, packed and checked lines |
| Messages | Two pane inbox, reply score ring, subject icons, quick replies, quiet-thread prompt |
| Reviews | Dark score panel with fractional stars and distribution, cut at six lines, two real examples on first use |
| Customers | Dark summary with came-back ring, per-person order dots and timeline |
| Requests | Stage flow, grouped demand by meaning, first-use example |
| Mailing list | Growth line, sources, consent wording per person |
| Interest | Visit-based funnel drawn as one shape, sources with share, searches, product verdicts, search, sort and paging |
| Being found | Readiness ring, gap filters, grouped grid, honest not-connected state for Google |
| Settings (shop) | Live previews beside fields, time and day pickers, complaints validation |

## Bugs found and fixed

| Where | Problem | Fix |
|---|---|---|
| Category names | Hiding a section silently renamed it; clearing a name unhid it; `LIKE` wildcards miscounted | 0088 |
| Messages | One malformed basket line broke the whole inbox and the menu badge | 0089 |
| Review requests | Never recorded, so every buyer would have been emailed hourly for three weeks | 0090, `notify` |
| Order emails | Readable across every tenant | 0090 |
| Mailing list | Mixed case duplicates meant an unsubscribe might not stick | 0091, `subscribe` |
| Interest | Checkout counted page loads, so checkouts exceeded baskets; visits readable across tenants | 0092 |
| Delivery settings | Shop read camel case keys, checkout read snake case, so a changed threshold was promised on one and charged on the other | 0093, `storeConfig.js` |
| Analytics | Sources view took 4.9s at 10,000 visits (now 28ms); four views readable across tenants | 0094 |
| Requests | No double-submit guard, no alert cap, no email check | `request` |
| Reviews | Paragraph breaks flattened | `review` |

## Open, not done

- Rename the `Journey` component in `OrderRow.jsx` to `Track`. "Journey" is on the house banned list.
- Confirm the shop's search, save and begin-checkout events actually fire (search for a term on the live shop and watch Interest).
- Sole trader legal name on receipts: confirm with her.
- Four products need descriptions before Google can list them.
- Search Console verification.
- Scale work not yet done on Customers, Reviews and Messages lists beyond a few hundred rows.
- `statusItems.js` and `deliverables.js` updated to 24 September; keep them in step after each storefront page ships.

## How the work was verified

A local harness (`/home/claude/harness`) renders the real components with stubbed Supabase and Playwright screenshots. SQL is tested by installing Postgres 16 in the sandbox and replaying each migration and each write the page makes. Neither survives between chats; rebuild when needed.
