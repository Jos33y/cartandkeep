-- A batch is one category. It has been true since the importer gained
-- --term, and nothing in the schema said so.
--
-- The category badge was removed from the candidate row in August because
-- categories moved when one stopped working, and a badge that changes under
-- her is worse than no badge. That reasoning holds for the row and not for
-- the batch: a batch is delivered once, on a date, out of one sweep, and what
-- it is about does not change afterwards.
--
-- label is what she reads. term is what produced it, which is the analysis
-- term and ours, so the two are kept apart rather than one being made to
-- serve both.

alter table batches
  add column if not exists category_label text,
  add column if not exists term text;

comment on column batches.category_label is
  'What she sees, e.g. Bedding and duvet covers. Written by import-shortlist.';

comment on column batches.term is
  'The Terapeak term the batch came from, e.g. bedding. Ours, not hers.';

-- Existing batches predate the column. The mobility batch is named rather
-- than left null, because a null here renders as an unlabelled batch beside a
-- labelled one and that reads as a fault.
update batches
   set category_label = coalesce(category_label, 'Mobility and daily living aids'),
       term = coalesce(term, 'elderly')
 where delivered_for <= date '2026-08-17'
   and category_label is null;
