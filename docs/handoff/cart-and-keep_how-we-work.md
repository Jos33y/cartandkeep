# How we work

**The Brick Dev Studios** | Cart & Keep | living document, 26 September 2026

The rules this project runs on, each learned the hard way. Read before any build. Edit when something stops being true.

---

## 1. The loop

1. **Audit first.** Screenshots or collected files, read properly. Say what is confirmed in code and what is inferred.
2. **Propose, then build.** One direction, the reasons, what it trades off. Build on a yes. When Joseph says "no code", answer in words only.
3. **Test for real** (section 4), then deliver.
4. **Report plainly:** what changed, what was measured, what was not verified.

Short answers for short questions. Push back when something is wrong, including when it was my own work.

---

## 2. Delivery

- **Zips of changed files at their repo paths**, named `ck-<what>-YYYY-MM-DD.zip`. Never a zip name a collector also uses.
- Say what each zip needs: frontend deploy only, a migration to run, a function to deploy.
- **Migrations:** numbered after the last one in the repo, idempotent (safe to run twice), replayed before delivery.
- **One-off SQL** goes in `supabase/queries/`, clearly marked "run by hand, not a migration".
- **Deletions** go in a script that refuses to delete anything still imported, dry run by default, `-Apply` to act.
- **Never create a file at a path without proving it is free.** The Phase 1 hook overwrote the portal's `useCatalogue.js` and broke the build. Collect the target folder or check git before adding a file.
- No handoff documents unless Joseph asks.

---

## 3. Collectors

- One PowerShell collector per job, run from the repo root, producing a zip and a MANIFEST.
- Seeds, then every import they reach, then a usage report of who else uses the shared parts.
- MANIFEST lists anything missing and anything withheld. Secrets are withheld by pattern.
- Collectors are single-use: they are regenerated when needed and are not kept in the repo.

---

## 4. Testing

- **Database:** replay every migration on Postgres 16 with a Supabase shim (roles, `auth.uid()`, storage, cron, net), load realistic data (1,500 products, and 10,000 for timings), run the new migration twice.
- **As Supabase serves it:** PostgREST over the replayed database, and the real client code calling it in a browser.
- **Visibility:** check as anon, as a signed-in member, and across two tenants.
- **Every figure checked twice:** counts must equal totals, pages must never repeat or skip.
- **Build** with `vite build` before any zip.
- `knip --include files` stays clean. Its config is `knip.json`; scripts and the pipeline are entry points.

---

## 5. The layout standard

Design from the smallest phone and the shortest laptop up. Measure, do not eyeball.

**Screens** (real headless Chromium):

| Group | Sizes |
|---|---|
| Phones | 360 x 640, 390 x 844 |
| iPads | 768 x 1024, 820 x 1180, 1024 x 768, 1024 x 1366, 1180 x 820 |
| Laptops | 1272 x 588 (13-inch HP Spectre at 150%), 1280 x 720, 1280 x 800, 1280 x 900, 1366 x 640 |
| Monitor | 1920 x 1000 |

**Four rules, at every screen:**

1. The main action is visible without scrolling.
2. Nothing clipped or overlapping.
3. No sideways scroll.
4. A focused field is never hidden behind a pinned bar.

**The checker:** `python tools/layout/check-layout.py <url> --main="<selector>"`

| Page | Main action selector |
|---|---|
| Department | `article h3` |
| Product | `button[class*=addBtn]` |
| Home | `a[class*=primary]` |

It waits for the main action and fails a screen where it never appears. A row that scrolls sideways on purpose and a pinned bar over content are not failures.

**Sizing rules that came out of it**

- The header publishes its real height as `--store-header-h`; anything pinned sits below it.
- Short laptops (under 700px tall) get smaller cards, tighter heads and leaner panels.
- Photos in dialogs are sized by the height available, not the column width.
- Joseph previews on a large monitor and on the 13-inch Spectre; screenshots arrive at 1.5x.

---

## 6. Design

Read with `design-standard.md`.

- **The bar:** would a screenshot make somebody assume the team is expensive. Apple-level care, never generated-looking.
- **Restraint means decide more, not use less.** Every effect does a job or goes.
- **The cupboard is the signature,** used where it explains something, never as wallpaper. No drawn objects for decoration.
- **Terracotta only for buy, send and submit.** Links and navigation are ink.
- **Her words everywhere.** eBay's words never reach a card, a tab, a breadcrumb or a filter.
- **One number, one place.** Never the same count three times on one screen.
- **Say a shared fact once** (the arrival day in the head), and on an item only when it differs.
- **A control only appears when it can do something.** A filter with one option is not a choice.
- **Every state designed:** loading shapes, empty with the one fix, errors in plain words.
- **Motion:** springs, under 300ms, off under reduced motion.
- **Tokens only.** No raw colours in modules. Tabular figures for numbers.

---

## 7. Data and copy

- **Live means live, whoever is looking.** The shop never shows drafts or samples, signed in or not.
- **Unknown is never zero.** A measured zero is data; a missing value is said to be missing.
- **Customer copy never mentions** the supplier, the photograph, the source or any doubt. Doubts go to the checks.
- **Returns and delivery wording come from her settings,** never from fixed text.
- **Every new listing starts with a stock of 5** unless she changes it.

---

## 8. The portal

- **Easier, never harder.** If a tool is not easier than doing it by hand, she will abandon it, and ease is what she is paying for.
- **The default is done; her job is to approve.** Fields arrive filled, choices are taps, one review, one save.
- **Only true decisions reach her.** Anything the AI can fix, it proposes.
- **Portal first,** because it fills the shop, then basket and checkout.

---

## 9. Code style

- Comments per `comment-rules.md`: one line, the why, only where it is not obvious.
- No em dashes or en dashes in anything delivered.
- Names do the work. If a name needs a comment, rename it.
