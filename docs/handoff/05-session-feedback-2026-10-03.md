# Cart & Keep, session summary and feedback

**Written 2026-10-03** | The Brick Dev Studios | Internal

The session from 2 to 3 October: what was done, what held, where Joseph had to push, and what to carry into the next chat. Where things stand is in `00-handoff-2026-10-03.md`; how we work is in `02-how-we-work-2026-10-03.md`.

---

## What was done

| Area | Result |
|---|---|
| Sections on Google's tree | 0129 and 0130: every product carries a Google category; sections hold Google branches; filter tabs worked out from her products. The sort rebuilt so the tree decides and Keeper only names. 19 sections applied |
| Categories | Second-opinion script with a review step; 48 corrections saved as `checked`; reading lights to Lighting |
| Keeper on her data | 18 drafts for £0.34, then 50 for £0.85. Report shows what went on sale; batches of 20, 50, 100 or all. 106 live |
| Products | Search; four pills under the title |
| Approved | A supplier's cost can be changed; a cost from Amazon follows Amazon's price daily; Amazon's price offered when hers differs |
| Listings | Timeout found and fixed: index 0131 (1,281 ms to 353 ms), then the view read once and worked in the browser |
| Errors | A tab open across a deploy reloads once to the new build; a proper error page on every route |
| Writer | Questions in plain words, enforced in a shared file |
| Docs | Handoff, task 01 brief and plan, scripts reference, task 02 brief, how we work |

Delivered as `ck-sections-*`, `ck-sort-*`, `ck-keeper-batch-search`, `ck-products-pills`, `ck-small-fixes`, `ck-supplier-cost`, `ck-listings-once` (all 3 October). Everything is deployed.

## What worked

- **Using it on her real data.** The Keeper runs, the order through live Stripe and the Listings plan proved things that tests alone could not.
- **Measuring before claiming.** The Listings `explain` before and after; the browser's filters and counts checked against Postgres on 600 rows (140 of 140 agreed); the cost rule with its own tests.
- **Diagnosing to the cause.** "Needs you 159" traced by query to 157 blanket returns suggestions from old imports; the Listings timeout traced to about 12 view runs per click, not to the data.
- **The deterministic tree for sections,** once Joseph pointed back at the taxonomy he had sent.

## Where Joseph had to push

| Joseph said | What was wrong | The lesson |
|---|---|---|
| "think it thru properly we can't be guessing", "thats why I sent you the tree in the first place" | The first sorts let Keeper group products and guessed twice | Use the source he gave. Decide in code what can be decided in code; give the model only the judgement |
| "nothing has been saved as her choice" | Studio corrections saved as `manual` | Never record the studio's work as hers |
| "you did not see clothing", "review them properly" | Section names reviewed carelessly | Review every row against the source before saying it is right |
| "let it be that keeper can only read draft on products section now" | Keeper read drafts on arrival and on opening | Spend only when she starts it |
| "the tab is meant to be compact actualy" | A large figure band where a strip was wanted | Compact by default; ask the size before building UI |
| "are we inventing errors?" | The portal asked for a new column before the SQL that adds it had run | Ship in the order SQL, functions, portal, and say so loudly |
| "just relax let me give some explanation", "lets disect" | Designing task 02 ahead of his model of how she buys | Listen first; ask one or two questions; then write the brief |
| "about market price don't measure that" | A profit test added to Keeper's approval | Use his bar (a perfect Amazon match), not a stricter one |

The pattern: moving ahead of what Joseph had said, in design as much as in code. Each time the fix was to stop, read what he gave, and ask.

## For the next chat

1. **Start with task 02, pass 1:** the barcode-only Amazon match. First the "To confirm" list in `keeper-task-02-amazon-sourcing.md`, starting with where a candidate's barcode lives and how many have one.
2. **Rehearse before writing:** 20 candidates, nothing written, for Joseph to check by eye.
3. **The two fixes first:** price-follow for suppliers she sends herself (`stock`), and SHAVINGFUN's supplier renamed "Amazon" and marked as hers.
4. **Small items open:** Approved shows "Nothing here" instead of its error; SHAVINGFUN's price against the £17.98 cost; `amazon_test.ts` to run on Joseph's machine.
