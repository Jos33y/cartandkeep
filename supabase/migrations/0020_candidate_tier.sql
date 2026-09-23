-- Stock candidates hold at 60% or better of their own average. Below that a
-- product is not a buy, but it is not a reject either: it is still selling and
-- it can come back. Showing only the first tier made that call for her.

alter table candidates
  add column tier text not null default 'stock'
  check (tier in ('stock', 'slipping'));

comment on column candidates.tier is 'stock holds against its own history, slipping is proven and still selling but below the hold threshold';

create index on candidates (batch_id, tier);
