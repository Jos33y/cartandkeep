-- 12 August 2026. Two things, run in order.
--
-- 1. Confirm the five studio test decisions were removed and recorded.
-- 2. Retire the 10 August pet batch. She checked it and could not source most
--    of it, and the shredded paper and vet bedding are UK mill products with
--    no dropship route. Retired rather than deleted, because a category that
--    was measured and did not work is a finding and the reason it was retired
--    is worth more than the rows.

-- ── 1. the removals, from the append only log ──────────────────────────
select actor, from_action, to_action, candidate_title, happened_at
from decision_events
order by happened_at desc
limit 10;

-- to_action null is a deletion. Five rows, all against the studio account.

-- Approved should now be empty.
select count(*) as decisions_remaining from decisions;

-- ── 2. what is in the pet batch ────────────────────────────────────────
select b.id, b.delivered_for, b.status, count(c.id) as candidates
from batches b
left join candidates c on c.batch_id = b.id
group by b.id, b.delivered_for, b.status
order by b.delivered_for;

-- ── 3. retire it ───────────────────────────────────────────────────────
-- Status only. The candidates stay, so Coverage still answers what was swept
-- and why it was dropped, and the ledger filters the batch out.
--
-- Check `status` accepts this value before running. If the check constraint
-- refuses it, send me the constraint rather than widening it blind.

-- update batches
--    set status = 'retired'
--  where delivered_for = '2026-08-10';

-- ── 4. confirm ─────────────────────────────────────────────────────────
-- select delivered_for, status, candidate_count from batches order by delivered_for;
