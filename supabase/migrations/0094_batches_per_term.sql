-- A day held one batch, so a second import on the same day had to borrow a future date.
-- One batch per day and term instead: "H & B, Christmas" and "Care & DIY" can share a date.
--
-- The old constraint is dropped by its default Postgres name. Check yours first:
--
--   select conname from pg_constraint
--    where conrelid = 'batches'::regclass and contype = 'u';
--
-- If it comes back as something else, change the drop line to match.

alter table batches drop constraint if exists batches_tenant_id_delivered_for_key;

-- nulls not distinct, so two untermed batches on one day still collide as before.
alter table batches add constraint batches_tenant_day_term_key
  unique nulls not distinct (tenant_id, delivered_for, term);
