-- A sourcing request is not a quote. CJ answers within about 48 hours, so the
-- row exists before there is a price, and a null cost must not read as free.

alter table candidate_sources
  add column status text not null default 'quoted'
  check (status in ('requested', 'quoted', 'unavailable'));

comment on column candidate_sources.status is 'requested means asked and not yet answered, so unit_cost is empty on purpose';

create index on candidate_sources (tenant_id, status);
