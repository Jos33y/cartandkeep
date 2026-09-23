-- The portal shows what won and never what was looked at, so a batch of pet
-- beds reads as the whole scope of the work. Nine terms were swept to produce
-- sixteen candidates and five of them died at the strip stage, which is the
-- most reassuring evidence we have and it lives in CSVs on one machine.

create table research_terms (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,

  term            text not null,
  -- eBay category the term resolved to, once anything from it was enriched.
  -- Null while a term is only known by its aggregate figures.
  ebay_category_id   text,
  ebay_category_path text,

  outcome         text not null default 'swept'
                  check (outcome in ('swept', 'killed_at_strip', 'no_headroom', 'not_holding', 'shortlisted')),
  outcome_note    text,

  listable_count  integer not null default 0,
  stock_count     integer not null default 0,

  first_swept_on  date not null default current_date,
  last_swept_on   date not null default current_date,

  unique (tenant_id, term)
);

create index on research_terms (tenant_id, outcome);

-- The six figures off the Terapeak aggregate strip. They appear nowhere in the
-- row export and are half the answer.
create table research_windows (
  id            uuid primary key default gen_random_uuid(),
  term_id       uuid not null references research_terms(id) on delete cascade,

  window_month  text not null,
  avg_price     numeric(10,2),
  price_min     numeric(10,2),
  price_max     numeric(10,2),
  avg_postage   numeric(10,2),
  free_postage  integer,
  sell_through  numeric(6,2),
  sellers       integer,

  unique (term_id, window_month)
);

-- Terapeak sell-through is the percentage of similar items that sold, a listing
-- hit rate. It is not the same measure as the pipeline gate of the same name
-- and the two must never be fed into each other.
comment on column research_windows.sell_through is 'Terapeak listing hit rate, not the pipeline sell_through gate';
comment on column research_windows.avg_postage is 'average postage charged, excluding free postage listings, so at 96 percent free it describes a small minority';

-- Her boundary, not eBay's. An unmapped category surfaces as outside the agreed
-- scope rather than appearing in her ledger unannounced.
create table category_boundaries (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  ebay_path_prefix text not null,
  label         text not null,
  agreed        boolean not null default true,
  unique (tenant_id, ebay_path_prefix)
);

alter table research_terms       enable row level security;
alter table research_windows     enable row level security;
alter table category_boundaries  enable row level security;

create policy research_terms_rw on research_terms
  for all to authenticated using (has_tenant(tenant_id)) with check (has_tenant(tenant_id));

create policy research_windows_rw on research_windows
  for all to authenticated
  using (exists (select 1 from research_terms t where t.id = term_id and has_tenant(t.tenant_id)))
  with check (exists (select 1 from research_terms t where t.id = term_id and has_tenant(t.tenant_id)));

create policy category_boundaries_rw on category_boundaries
  for all to authenticated using (has_tenant(tenant_id)) with check (has_tenant(tenant_id));

insert into category_boundaries (tenant_id, ebay_path_prefix, label, agreed)
select id, 'Pet Supplies', 'Pet Accessories', true from tenants where slug = 'cart-and-keep';
