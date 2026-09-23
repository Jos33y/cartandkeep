-- Headroom is what is left before goods cost. A source turns it into margin.
-- One candidate can have several, and none of them counts until somebody looks
-- at it, because matching an eBay title to a supplier catalogue is a guess and
-- a wrong guess corrupts every figure downstream.

create table candidate_sources (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  candidate_id  uuid not null references candidates(id) on delete cascade,

  supplier      text not null,
  external_ref  text,
  title         text,
  url           text,
  image_url     text,
  category      text,

  -- goods plus any shipping estimate, in the tenant currency, never the
  -- supplier's own currency
  unit_cost     numeric(10,2),
  currency      char(3) not null default 'GBP',

  inventory     integer,
  lead_time_days integer,
  -- wholesale is the only kind eBay permits to fulfil directly. A retailer
  -- source is a policy problem before it is a price problem.
  supplier_kind text check (supplier_kind in ('wholesale', 'manufacturer', 'marketplace', 'retailer', 'unknown')),

  -- how the match was made, and whether a human has agreed with it
  matched_on    text,
  confirmed     boolean not null default false,
  confirmed_at  timestamptz,

  raw           jsonb not null default '{}'::jsonb,
  found_at      timestamptz not null default now(),

  unique (candidate_id, supplier, external_ref)
);

create index on candidate_sources (tenant_id, candidate_id);
create index on candidate_sources (candidate_id) where confirmed;

alter table candidate_sources enable row level security;

create policy candidate_sources_rw on candidate_sources
  for all to authenticated using (has_tenant(tenant_id)) with check (has_tenant(tenant_id));
