# Keeper budget and Google categories, 7 October 2026

Why: Claude credit ran out again ($31 spent, no sales yet, listings under a week old). Joseey: "we can't just be burning tokens". And 199 products added to the shop from Approved on 6 October landed on the stand-in Google category (Home & Garden, source `default`), so no section took them.

## Cause of the unsorted products
A card from Approved has no eBay category path (ebay_category_path empty on all 199; 105 carry only eBay's leaf name in the draft). `shopProduct` sends no category_path, so `store_products_google` falls back to 536 `default`, which `section_for_google` never places.

## What changed (ck-keeper-budget.zip)
- `0145_keeper_budget_and_google.sql`
  - `keeper_month_spent`, `keeper_month_cap` (tenants.store.keeper.monthly_cap_pence, £20 when unset), `keeper_over_budget`.
  - `add_keeper_spend` also pauses a run once the month crosses the budget.
  - `set_product_google_ai(p_id, p_path)`: the deepest existing level of Google's path, two levels at least, saved as `ai` over `default` only. The 0129 trigger places the product as it saves.
  - Run twice locally; tested: deep path walks up, hers left alone, top level refused, budget pauses at £20.01, last month not counted.
- `_shared/shop-check.ts`: the shop check asks for `google_category` (no extra call); `googlePath` tidies it.
- `_shared/keeper-check.ts`: after a written check, calls `set_product_google_ai`.
- `keeper-run/work.ts`: budget checked before a run works; out of credit pauses shop checks and Amazon lookups with the top-up message and puts the jobs back untouched (get ready already did).

## Deploy
1. SQL 0145.
2. Functions: `keeper-run`, `shop-rules`.
No portal change.

## Raise the budget (pence)
```sql
update tenants set store = coalesce(store, '{}') || jsonb_build_object('keeper', coalesce(store -> 'keeper', '{}') || '{"monthly_cap_pence": 3000}')
where slug = 'cart-and-keep';
```

## Limits
- Counts Keeper runs only. One-off presses in the portal (Check now, Write it, photo check on one card) are not in the month total.
- Drafts only: the 199 already live need `second-opinion.mjs` (after a top-up).

## Haiku test (no code)
Set the secret `CLAUDE_LIGHT_MODEL=claude-haiku-4-5-20251001`, Get ready on 10 cards, compare photo verdicts and item details with Sonnet's. Unset it to go back.
