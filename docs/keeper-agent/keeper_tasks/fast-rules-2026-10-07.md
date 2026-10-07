# Fast row security and steady Listings, 7 October 2026

Why: Listings failed with "canceling statement due to statement timeout"; the Overview's Live count showed 0.

## Diagnosis (from the plan run as the portal's signed-in role)
- 8,058 ms total. has_tenant() ran once per row touched, about 61,000 times at about 0.12 ms.
- 6.35 s matching each of 554 eBay rows to its card (lateral scan of all portal cards, check on each).
- 1.12 s finding the latest traffic pull (DISTINCT ON over every traffic row ever saved, growing about 600 a day).
- Planner estimated 7 live rows against 554 real, so it picked the slow index.

## Fix (ck-fast-rules.zip)
- 0147_fast_row_security.sql: every rule's has_tenant(x) becomes
  `((SELECT is_platform_admin()) OR x = ANY ((SELECT my_tenant_ids())::uuid[]))`, worked out once per request.
  Same meaning as has_tenant. ALTER POLICY in place, names and roles unchanged. 55 rules. Safe to run twice.
- 0147_fast_row_security_undo.sql: puts every rule back word for word. Kept for need, not run.
- 0148_live_listings_steady.sql: latest pull by one index lookup per shop; cards matched in one pass. Same columns.
- Check scripts: 1-before (copy in a private schema), 2-after (0, 0, 0), 3-timing, 4-tidy.

## Proof on scratch copies
- Every rule from production loaded into a scratch database; 1,640 probes (rows seen, inserts, updates, deletes on all
  58 tables as member, stranger, admin and public): identical before and after. Undo restores the same.
- Listings at her size: 2,821 ms before, 36 ms after 0147, 13 ms after 0148; a year of traffic history added keeps it at 13 ms.
- Rows compared both ways: 0 differences.

## Deploy
1-before.sql, 0147, 0148, 2-after.sql, 3-timing.sql, 4-tidy.sql. No functions, no portal change.
