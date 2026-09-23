-- A partial unique index cannot serve on conflict through PostgREST, which
-- cannot attach the index predicate to the statement.
drop index if exists candidates_batch_ref_key;

alter table candidates
  add constraint candidates_batch_ref_key unique (batch_id, external_ref);