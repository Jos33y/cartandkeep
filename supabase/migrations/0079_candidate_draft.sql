-- What she changed before publishing.
--
-- Title, description and image order come whole from Home Bargains, written for
-- a shelf label rather than an eBay search. Edits have to survive a page reload
-- or nobody makes them.

alter table candidates add column if not exists draft jsonb;

comment on column candidates.draft is
  'Pre-publish edits: title, description, images, price, quantity. Null means the pipeline version stands.';
