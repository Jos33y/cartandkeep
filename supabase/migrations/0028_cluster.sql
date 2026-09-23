-- Cluster is the product type. It travels across marketplaces where an eBay
-- category does not, so it is what survives a move to TikTok Shop or Vinted.
--
-- Owned by enrich-candidates.js, derived from the eBay category path. Never
-- from the title: a title word list is what the brand screen is, and the brand
-- screen missed Helping Hand on a term where Helping Hand was the top row.

alter table candidates
  add column if not exists cluster text;

create index if not exists candidates_cluster_idx
  on candidates (tenant_id, cluster);

-- A third tier. Stock and slipping both compare a product against its own
-- history, which needs three windows. A candidate is a row that cleared the
-- margin gate and has not been tested against history at all.
alter table candidates
  drop constraint if exists candidates_tier_check;

alter table candidates
  add constraint candidates_tier_check
  check (tier in ('stock', 'slipping', 'candidate'));


-- Units times headroom. What the product would be worth in a month at the
-- going rate, before goods cost. Sorted on where the score has too few
-- components to be honest.
alter table candidates
  add column if not exists monthly_headroom numeric(10,2);