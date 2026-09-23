-- Clearing the test approvals on the 10 August batch.
--
-- Three dog beds show on Approved. She read that as us having approved
-- products on her behalf, which is hers to do and not ours.
--
-- Run the select first. The delete is written against the actor rather than
-- the candidate ids, so it cannot take one of her decisions by accident.
-- The trigger on decisions writes every delete to the append only log with the
-- actor, so this is recorded rather than erased.

-- 1. What is on Approved, and who put it there
select
  d.id,
  d.action,
  d.actor,
  d.created_at,
  c.title,
  b.delivered_for
from decisions d
join candidates c on c.id = d.candidate_id
join batches b on b.id = c.batch_id
order by d.created_at;

-- 2. Same rows, counted by actor, so the delete below can be checked first
select actor, action, count(*)
from decisions
group by actor, action
order by actor;

-- 3. The delete. Replace the actor string with whatever step 2 shows for the
-- studio account, and never with hers.
-- delete from decisions
-- where actor = 'developer@cartandkeep.com';

-- 4. Confirm Approved is empty and the audit log holds the removals
-- select count(*) from decisions;
-- select actor, action, changed_at from decision_log order by changed_at desc limit 10;
