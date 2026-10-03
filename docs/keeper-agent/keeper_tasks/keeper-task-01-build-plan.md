# Keeper task 01: the build plan

**Draft 3, 3 October 2026** | The Brick Dev Studios | Internal

How task 01 (`keeper-task-01-shop-drafts.md`) was built. First built and tested on 2 October as `ck-keeper-check-2026-10-02.zip`. Section 8 says what changed from the plan while building, and section 9 what changed after it met her data.

---

## 1. What already exists, and is reused

All confirmed in the code.

| Part | What it does today | Used for |
|---|---|---|
| `keeper_jobs` (0102) | Keeper's work queue on the server: one row per product job, states queued, working, done, failed; three tries; carries on with the portal closed | Every draft in a run is one job |
| `claim_keeper_jobs` (0102) | Hands out jobs safely, so two callers never take the same one; retakes a job stuck for 5 minutes | Hands out fill jobs only; checks have their own claim |
| `kick_keeper` and the `keeper-queue` schedule (0102) | Every minute, calls the `draft` function when work is waiting; an idle shop costs nothing | Also calls `keeper-run` when check work is waiting |
| `draft` function, `workQueue` | Claims 4 jobs a call, 2 at a time, and runs them | The writing job a run gives a draft with nothing written (0128) |
| `useKeeper` and `KeeperDock` | The portal reads the queue every 2.5 seconds and shows progress wherever she is | Unchanged; the office has its own hook |
| `_shared/shop-rules.ts` | Keeper's returns and label check: the prompt, the tool, tidying, and `derivedPatch` | The returns and label part of the check |
| `store_products.updated_at` and its trigger (0034) | Moves on every change to a product | Detects her editing a draft while Keeper works on it |
| `derived_fields.returns_by = 'her'` (ProductSheet) | Marks a returns class she saved | The same pattern marks a title she saved |
| `tenants.store.agent.name` | The shop's name for its agent | The name on every Keeper screen |

## 2. The database

Every migration was run twice on Postgres here, with test rows, before shipping.

### `0123_keeper_runs.sql`

1. **`keeper_runs`**, one row per run: shop, task (`shop_check`), state (running, paused, stopped, done), pace (watch, normal), rehearsal, total, cap and spend in pence, paused reason, a lease (one worker per run), start and finish. Readable by the shop's members; changed only through the functions below. One open run per shop and task.
2. **`keeper_jobs` gains** `run_id`, the `shop_check` kind, a `stopped` state, and one open job per product **per kind**.
3. **`start_keeper_run`:** one job for every draft not archived, not a sample and not yet checked, oldest first, up to `p_limit`. Refuses a second open run, and says so when every draft is checked.
4. **`set_keeper_run(run, state, pace)`:** pause, carry on, stop (queued jobs become stopped), change pace.
5. **Worker functions (service only):** `lease_keeper_run`, `claim_run_jobs` (only while running; waits for an open fill job on the same product; a retry waits 20 seconds), `claim_check_jobs`, `add_keeper_spend` (pauses at the cap), `close_keeper_run`.
6. **`set_keeper_check`,** the only way the check writes a product: drafts only; only if `updated_at` still matches what Keeper read, otherwise the job is read again; the title only when `title_by` is empty, keeping `title_before` and `slug_before`; a slug clash gets 6 id characters; never her saved returns, never `hazard`, never the status.
7. **`keeper_overrides`:** one row each time she changes a returns class, title or label Keeper set. The last 20 go into Keeper's next check.

### Since 0123

| Migration | What it adds |
|---|---|
| `0124_keeper_acts_like_a_seller.sql` | The check settles what a seller settles without asking: returns, label warnings read off the photos, the biocide safety line, questions an earlier pass left, a disputed detail left out. `set_keeper_check` takes those too, and can shorten a draft's address. |
| `0125_keeper_rehearse_next.sql` | A rehearsal takes the next drafts nobody has rehearsed, or the last rehearsal's again. A real run is unchanged. |
| `0126_keeper_picks_and_addresses.sql` | The shop's principles (`store.principles`) read as facts; a check of the drafts she picks on Products (`p_ids`, `p_again`); short addresses in SQL for products already live; old addresses remembered so the shop can lead to the new one. |
| `0127_keeper_slug_refined.sql` | Two refinements to the short address rule, kept equal to `slugFor` by `slug_parity_test.ts`. |
| `0128_keeper_finishes_the_product.sql` | Write first, then check: a draft with nothing written gets the writing job first, and the check fills only empty boxes from it (`p_fill`). The writer running again on a checked product queues a check after it. |

## 3. The functions

- **`_shared/shop-check.ts`:** the prompt, the tool and everything after Claude in code: title rules (length, hashtags, seller wording, emoji, dashes, capitals, repeats, numbers not in the facts), duplicates (same barcode, or same numbers and near-same words), the trays, the cost from Claude's own token count.
- **`_shared/keeper-check.ts`:** one draft, end to end. Words first; a second call with up to 3 photos only for a chemical or an unclear product; settle; write through `set_keeper_check` unless rehearsal.
- **`keeper-run`:** works runs at the chosen pace (watch: one at a time, at least 3.5 seconds each; normal: three at a time), within 50 seconds a call, renewing its lease. Five failures in a row pause the run. Called by the schedule (scheduler secret) and by the portal (signed-in member of that shop).
- **`shop-rules`:** the sheet's "Check now" uses the same check as a run.
- **`ebay-import`:** writes the `returns_class` column as standard and queues **nothing**. A copy waits in Products as an unchecked draft until a check is started there (changed 3 October; see section 9).
- **`draft`:** the writing job, unchanged in itself.

## 4. The portal

1. **Products:** the Keeper card ("N drafts to check", "Let Keeper check them", or "See Keeper at work" during a run) opens the office. Ticked drafts can be checked straight from the selection bar ("Check N with Keeper"), with "Check them again" for ones checked before.
2. **Keeper's office, `/keeper`,** read every 2 seconds while a run is open: in-tray, desk (the draft in hand, then its verdict with the stamp), out-trays that filter the log, the log, done, time left, spent against the cap, Watch or Normal, Pause or Carry on, Stop with a confirm. Reduced motion shows the same without movement.
3. **After a run, the report says where each draft is now:**
   - **On sale** (blue): checked drafts that have gone live since, from here or from Products.
   - **Ready for sale, Warnings added, Needs you, Could not read:** only what is still a draft in that tray.
   - Drafts archived since leave the trays, with one line saying how many.
   - Statuses are read again on coming back to the page (focus or the tab showing), so the counts follow what she did elsewhere.
   - **"Put N on sale"** offers only drafts still in a sellable tray that pass the shop's release check, and counts what the database actually changed.
4. **Start form:**
   - **How many:** 20, 50, 100 or All N (sizes smaller than what is waiting; hidden at 20 or fewer). The first ones to come in go first, through `p_limit`. The time, the button and her spending limit follow the number chosen.
   - **Studio only:** pace, spending limit (default £5, at least 50p), "Rehearse, write nothing" on the next 5 or the last ones again.
5. **Product sheet:** a title she saves is marked hers; "Before Keeper" among the title choices; Keeper's notes (suggested title with "Use it", duplicate, seller-looking brand, corrections); a save merges with a check that landed while the sheet was open; her changes go to `keeper_overrides`. Opening a product no longer starts a read by itself; the button reads "Ask Keeper to fill it in" or "Ask Keeper again".

## 5. Tested before delivery

- **SQL** on Postgres 16: each migration runs twice cleanly; the 0123 to 0128 assertions pass.
- **Deno:** the keeper-run tests, including a full run against real Postgres with a stand-in for Claude (every tray, writes, rehearsal, retries, stop, watch pace). Type check clean on `keeper-run`, `shop-rules`, `ebay-import`.
- **The office in a browser** against a stand-in database: start, the batch picker by mouse and keys, rehearsal, reading, stamped, cap pause, tray filter, stop confirm, pause, pace change, report, On sale after putting on sale and after a change made elsewhere, archived since. All 13 widths from 320 to 1920 in start, floor and report states, no sideways scroll.
- **`vite build`** clean.

## 6. On her data

| When | What | Result |
|---|---|---|
| 2 October | Rehearsals on 5, Joseph watching, nothing written | Found the faults listed in the spec; fixed in 0124 to 0128 |
| 3 October | First real run, 18 drafts | £0.34: 16 ready, 1 warnings added, 1 needs you |
| 3 October | 50 drafts with the batch picker | £0.85: 48 ready, 2 needs you (both pamper sets, "same as another draft") |
| 3 October | After putting them on sale | 106 live, 108 drafts left to check |

About 1.7p a draft. The whole catalogue once is about £3. New imports cost about 2p each to check.

## 7. Delivery

| Zip | Holds | SQL | Deploy |
|---|---|---|---|
| `ck-keeper-check-2026-10-02` | The first build | 0123 | `keeper-run`, `shop-rules`, `ebay-import` |
| `ck-keeper-seller-2026-10-02` and the later 2 October zips | Seller decisions, rehearse next, picks and addresses, slugs, finishing the product | 0124 to 0128 | as each zip said |
| `ck-keeper-batch-search-2026-10-03` | Report shows On sale, batch picker, Products search | none | none |
| `ck-products-pills-2026-10-03` | The four figures under Products as pills (includes the search) | none | none |

Optional env: `KEEPER_PRICE_*`, `KEEPER_GBP_PER_USD` (defaults: Sonnet list prices, 0.75).

## 8. What changed from draft 1 while building

- The check runs in its own function, `keeper-run`, not inside `draft`, which avoids shared imports and keeps the fill queue untouched.
- No `tenants.agent_name` column: the name already lives in `tenants.store.agent.name`.
- Retries wait 20 seconds, so one slow answer does not burn all three tries at once.
- A run whose drafts are all waiting on a fill job stops for that call rather than spinning.
- The report lists each tray in place rather than linking to Products filters, which do not map one to one onto the trays.
- `KeeperDock` was not changed; the office is reached from Products.

## 9. What changed after it met her data

- **Keeper reads only from Products.** The import no longer queues a fill job or a check, and opening a product no longer starts a read. Joseph's call: nothing is paid for until a check is started on purpose.
- **The report follows the product, not the verdict.** After the first real run, 16 drafts stayed under "Ready for sale" once they were live. Keeper's verdict stays on the job; the report now reads the product's status over it.
- **Batches.** "Check all" was the only choice. She can now take 20, 50 or 100 at a time.
- **"Needs you" on Products counts unchecked drafts.** 157 of the 158 unchecked drafts on 3 October carried `derived_fields.returns_class: 'standard'`, written by the import before the first build fixed it. The portal reads that as a returns question. Keeper's check replaces it with its own call, so the count falls as the drafts are checked; no SQL or code change was made, by Joseph's choice.
- **Still stale:** the comment on `returns_class` in `ebay-import/index.ts` (line 177) still says a check is "queued below". Fix it the next time that file is touched.
- **Inferred, still to check:** the cause of the "5 inch" description error in the draft function; whether AI answer engines see the shop's script-added product markup.
