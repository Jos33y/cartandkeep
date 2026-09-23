-- Every query a batch was built from, not only the ones that reached her.

create table research_queries (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references tenants(id) on delete cascade,
  batch_id         uuid not null references batches(id) on delete cascade,
  query            text not null,

  outcome          text not null
                   check (outcome in ('sent', 'held_back', 'no_buy_price', 'duplicate', 'refused')),
  reason           text
                   check (reason is null or reason in (
                     'no_listings', 'crowded', 'young_not_selling', 'nothing_sold',
                     'market_small', 'below_cost', 'unknown'
                   )),
  reasons          text[] not null default '{}',

  shelf_product    text,
  shelf_price      numeric(10,2),
  competitors      integer,
  median_price     numeric(10,2),
  market_per_month integer,
  entry_feedback   integer,
  max_goods        numeric(10,2),
  net              numeric(10,2),
  checked_at       timestamptz,

  unique (batch_id, query)
);

create index on research_queries (tenant_id, batch_id, outcome);

comment on column research_queries.reason is
  'First market refusal from gate.js, set only when outcome is refused. unknown means the gate gave no code.';

alter table research_queries enable row level security;

create policy research_queries_rw on research_queries
  for all to authenticated using (has_tenant(tenant_id)) with check (has_tenant(tenant_id));
