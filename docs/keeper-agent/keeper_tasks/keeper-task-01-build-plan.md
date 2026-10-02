# Keeper task 01: the build plan

**Draft 2, 2 October 2026** | The Brick Dev Studios | Internal

How task 01 (`keeper-task-01-shop-drafts.md`) gets built. **Built and tested here on 2 October; delivered as `ck-keeper-check-2026-10-02.zip`.** Section 8 says what changed from the plan while building.

---

## 1. What already exists, and is reused

All confirmed in the code.

| Part | What it does today | Used for |
|---|---|---|
| `keeper_jobs` (0102) | Keeper's work queue on the server: one row per product job, states queued, working, done, failed; three tries; carries on with the portal closed | Every draft in a run is one job |
| `claim_keeper_jobs` (0102) | Hands out jobs safely, so two callers never take the same one; retakes a job stuck for 5 minutes | Now hands out fill jobs only; checks have their own claim |
| `kick_keeper` and the `keeper-queue` schedule (0102) | Every minute, calls the `draft` function when work is waiting; an idle shop costs nothing | Now also calls `keeper-run` when check work is waiting |
| `draft` function, `workQueue` | Claims 4 jobs a call, 2 at a time, and runs them | Unchanged |
| `useKeeper` and `KeeperDock` | The portal reads the queue every 2.5 seconds and shows progress wherever she is | Unchanged; the office has its own hook |
| `_shared/shop-rules.ts` | Keeper's returns and label check: the prompt, the tool, tidying, and `derivedPatch` | The returns and label part of the new check |
| `store_products.updated_at` and its trigger (0034) | Moves on every change to a product | Detects her editing a draft while Keeper works on it |
| `derived_fields.returns_by = 'her'` (ProductSheet) | Marks a returns class she saved | The same pattern marks a title she saved |
| `tenants.store.agent.name` | The shop's name for its agent | The name on every Keeper screen |

## 2. The database: migration `0123_keeper_runs.sql`

Run twice on Postgres here, with test rows, before shipping.

1. **`keeper_runs`**, one row per run: shop, task (`shop_check`), state (running, paused, stopped, done), pace (watch, normal), rehearsal, total, cap and spend in pence, paused reason, a lease (one worker per run), start and finish. Readable by the shop's members; changed only through the functions below. One open run per shop and task.
2. **`keeper_jobs` gains** `run_id`, the `shop_check` kind, a `stopped` state, and one open job per product **per kind**.
3. **`start_keeper_run(tenant, task, pace, cap, rehearsal, limit)`:** one job for every draft not archived, not a sample and not yet checked. Refuses a second open run, and says so when every draft is checked.
4. **`set_keeper_run(run, state, pace)`:** pause, carry on, stop (queued jobs become stopped), change pace.
5. **Worker functions (service only):** `lease_keeper_run`, `claim_run_jobs` (only while running; waits for an open fill job on the same product; a retry waits 20 seconds), `claim_check_jobs` (checks queued by the import), `add_keeper_spend` (pauses at the cap), `close_keeper_run`.
6. **`set_keeper_check`,** the only way the check writes a product: drafts only; only if `updated_at` still matches what Keeper read, otherwise the job is read again; the title only when `title_by` is empty, keeping `title_before` and `slug_before`; a slug clash gets 6 id characters; never her saved returns, never `hazard`, never the status.
7. **`keeper_overrides`:** one row each time she changes a returns class, title or label Keeper set. The last 20 go into Keeper's next check.

## 3. The functions

- **`_shared/shop-check.ts` (new):** the prompt, the tool and everything after Claude in code: title rules (length, hashtags, seller wording, emoji, dashes, capitals, repeats, numbers not in the facts), duplicates (same barcode, or same numbers and near-same words), the trays, the cost from Claude's own token count.
- **`_shared/keeper-check.ts` (new):** one draft, end to end. Words first; a second call with up to 3 photos only for a chemical or an unclear product; settle; write through `set_keeper_check` unless rehearsal.
- **`keeper-run` (new function):** works runs at the chosen pace (watch: one at a time, at least 3.5 seconds each; normal: three at a time), within 50 seconds a call, renewing its lease. Five failures in a row pause the run. Called by the schedule (scheduler secret) and by the portal (signed-in member of that shop).
- **`shop-rules`:** the sheet's "Check now" now uses the same check as a run.
- **`ebay-import`:** no longer writes `returns_class: 'standard'`; queues a fill job and a check job for each new copy.
- **`draft`:** unchanged.

## 4. The portal

1. **Products:** "Let Keeper check N drafts" (or "See Keeper at work" during a run) in the Biggest gap panel, opening the office.
2. **Keeper's office, `/keeper`,** read every 2 seconds while a run is open: in-tray, desk (the draft in hand, then its verdict with the stamp), five out-trays that filter the log, the log, done, time left, spent against the cap, Watch or Normal, Pause or Carry on, Stop with a confirm. Reduced motion shows the same without movement.
3. **After a run:** what landed in each tray, each listed in place with Open links; "Put N on sale" for ready drafts that pass the shop's own release check, with a confirm. Then the start form for anything left.
4. **Start form:** pace, spending limit (default £5, at least 50p), "Start checking N drafts", and "Rehearse on 5, write nothing".
5. **Product sheet:** a title she saves is marked hers; "Before Keeper" among the title choices; Keeper's notes (suggested title with "Use it", duplicate, seller-looking brand, corrections); a save merges with a check that landed while the sheet was open; her changes go to `keeper_overrides`.

## 5. Tested before delivery

- **SQL** on Postgres 16: migration runs twice cleanly; every assertion in the 0123 test passes.
- **Deno:** 21 tests, including a full run against real Postgres with a stand-in for Claude (every tray, writes, rehearsal, retries, stop, watch pace). Type check clean on `keeper-run`, `shop-rules`, `ebay-import`.
- **The office in a browser** against a stand-in database: start, rehearsal, reading, stamped, cap pause, tray filter, stop confirm, pause, pace change, report, show each tray, put on sale. All 13 widths from 320 to 1920 in start, floor and report states, no sideways scroll.
- **`vite build`** clean.

## 6. On her data, in order

1. A rehearsal on 5 drafts, Joseph watching, nothing written.
2. 5 for real, every write read back from the database.
3. 20 more to measure time and cost per draft, and to check the prices against the Anthropic console. That sets the cap.
4. The rest, with her watching.

## 7. Delivery

- **Zip:** `ck-keeper-check-2026-10-02.zip`, changed files only.
- **SQL first:** `0123_keeper_runs.sql`.
- **Deploy:** `keeper-run` (new), `shop-rules`, `ebay-import`. `draft` unchanged.
- **Optional env:** `KEEPER_PRICE_*`, `KEEPER_GBP_PER_USD` (defaults: Sonnet list prices, 0.75).

## 8. What changed from draft 1 while building

- The check runs in its own function, `keeper-run`, not inside `draft`, which avoids shared imports and keeps the fill queue untouched.
- No `tenants.agent_name` column: the name already lives in `tenants.store.agent.name`.
- Retries wait 20 seconds, so one slow answer does not burn all three tries at once.
- A run whose drafts are all waiting on a fill job stops for that call rather than spinning.
- The report lists each tray in place rather than linking to Products filters, which do not map one to one onto the trays.
- `KeeperDock` was not changed; the office is reached from Products.
- **Inferred, still to check:** the cause of the "5 inch" description error in the draft function; whether AI answer engines see the shop's script-added product markup.
