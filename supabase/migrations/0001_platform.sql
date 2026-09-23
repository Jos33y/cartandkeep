-- 0001_platform.sql
-- Multi-tenant from the start so a second client is an insert, not a migration.

create extension if not exists "pgcrypto";

-- Tenants

create table tenants (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  name          text not null,
  status        text not null default 'active'
                check (status in ('active', 'paused', 'terminated')),
  currency      char(3) not null default 'GBP',
  locale        text not null default 'en-GB',
  marketplace   text not null default 'EBAY_GB',

  palette       jsonb not null default '{}'::jsonb,

  -- keyed by source id; tuning must not need a deploy
  scoring       jsonb not null default '{}'::jsonb,

  -- rates change, so they are data
  fees          jsonb not null default '{}'::jsonb,

  created_at    timestamptz not null default now()
);

-- Access

-- studio staff, cross-tenant
create table platform_admins (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table memberships (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  tenant_id   uuid not null references tenants(id) on delete cascade,
  role        text not null default 'operator'
              check (role in ('operator', 'viewer')),
  created_at  timestamptz not null default now(),
  unique (user_id, tenant_id)
);

create index on memberships (user_id);
create index on memberships (tenant_id);

-- security definer, or the memberships policy recurses into itself
create or replace function is_platform_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from platform_admins where user_id = auth.uid());
$$;

create or replace function has_tenant(t uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select is_platform_admin()
      or exists (
        select 1 from memberships
        where user_id = auth.uid() and tenant_id = t
      );
$$;

-- Sources

create table sources (
  id          text primary key,
  name        text not null,
  kind        text not null check (kind in ('api', 'export', 'scrape')),
  -- What this source can contribute: velocity, pricing, depth, demand,
  -- supply, seasonality
  provides    text[] not null default '{}',
  notes       text
);

-- a source going dark is an update here, never a code change
create table tenant_sources (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  source_id       text not null references sources(id),
  enabled         boolean not null default true,
  weight          numeric(4,3) not null default 1.000,
  config          jsonb not null default '{}'::jsonb,
  -- pointer to the secret store, never the secret
  credential_ref  text,
  last_run_at     timestamptz,
  last_status     text,
  last_error      text,
  unique (tenant_id, source_id)
);

create index on tenant_sources (tenant_id) where enabled;

-- Batches and candidates

create table batches (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  delivered_for   date not null,
  status          text not null default 'building'
                  check (status in ('building', 'delivered', 'failed')),
  sources_used    text[] not null default '{}',
  candidate_count integer not null default 0,
  created_at      timestamptz not null default now(),
  delivered_at    timestamptz,
  unique (tenant_id, delivered_for)
);

create index on batches (tenant_id, delivered_for desc);

create table candidates (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references tenants(id) on delete cascade,
  batch_id              uuid not null references batches(id) on delete cascade,

  external_ref          text,
  title                 text not null,
  category              text,
  image_url             text,
  supplier_url          text,

  classification        text default 'unknown'
                        check (classification in ('evergreen', 'trend_spike', 'unknown')),
  confidence            integer check (confidence between 0 and 100),
  -- shown next to confidence so the reviewer can see the basis
  signal_count          integer not null default 0,
  -- [{ source_id, signal, value, weight }]
  signals               jsonb not null default '[]'::jsonb,
  -- { sale_price, platform_fee, payment_fee, landed_cost, net }
  margin                jsonb not null default '{}'::jsonb,

  recommended_channels  text[] not null default '{}',
  recommended_volume    integer,
  analyst_note          text,

  created_at            timestamptz not null default now()
);

create index on candidates (tenant_id, batch_id);
create index on candidates (batch_id, confidence desc);

-- Rejection reasons are the training signal, so the constraint lives here and
-- not in a form that can forget to validate.

create table decisions (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  candidate_id  uuid not null unique references candidates(id) on delete cascade,

  action        text not null check (action in ('approve', 'reject', 'defer')),
  reason        text check (reason in (
                  'too_much_competition',
                  'wrong_category',
                  'margin_thin',
                  'previous_underperformer',
                  'other'
                )),
  note          text,

  decided_by    uuid references auth.users(id),
  decided_at    timestamptz not null default now(),

  constraint reject_requires_reason
    check (action <> 'reject' or reason is not null)
);

create index on decisions (tenant_id, action);

-- Listings and performance

create table listings (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  candidate_id  uuid references candidates(id) on delete set null,
  channel       text not null check (channel in ('ebay', 'tiktok', 'store')),
  external_ref  text,
  title         text,
  listed_at     timestamptz,
  created_at    timestamptz not null default now()
);

create index on listings (tenant_id, channel);

create table listing_performance (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  listing_id    uuid not null references listings(id) on delete cascade,
  measured_on   date not null,
  day_offset    integer not null check (day_offset in (7, 14, 30)),
  units_sold    integer not null default 0,
  revenue       numeric(12,2) not null default 0,
  fees          numeric(12,2) not null default 0,
  landed_cost   numeric(12,2) not null default 0,
  net           numeric(12,2) generated always as (revenue - fees - landed_cost) stored,
  unique (listing_id, day_offset)
);

create index on listing_performance (tenant_id, measured_on);

-- RLS

alter table tenants             enable row level security;
alter table memberships         enable row level security;
alter table platform_admins     enable row level security;
alter table tenant_sources      enable row level security;
alter table batches             enable row level security;
alter table candidates          enable row level security;
alter table decisions           enable row level security;
alter table listings            enable row level security;
alter table listing_performance enable row level security;

alter table sources enable row level security;
create policy sources_read on sources
  for select to authenticated using (true);

create policy tenants_read on tenants
  for select to authenticated using (has_tenant(id));
create policy tenants_write on tenants
  for all to authenticated using (is_platform_admin()) with check (is_platform_admin());

create policy memberships_read on memberships
  for select to authenticated using (user_id = auth.uid() or is_platform_admin());
create policy memberships_write on memberships
  for all to authenticated using (is_platform_admin()) with check (is_platform_admin());

create policy platform_admins_read on platform_admins
  for select to authenticated using (is_platform_admin());

create policy tenant_sources_rw on tenant_sources
  for all to authenticated using (has_tenant(tenant_id)) with check (has_tenant(tenant_id));

create policy batches_rw on batches
  for all to authenticated using (has_tenant(tenant_id)) with check (has_tenant(tenant_id));

create policy candidates_rw on candidates
  for all to authenticated using (has_tenant(tenant_id)) with check (has_tenant(tenant_id));

create policy decisions_rw on decisions
  for all to authenticated using (has_tenant(tenant_id)) with check (has_tenant(tenant_id));

create policy listings_rw on listings
  for all to authenticated using (has_tenant(tenant_id)) with check (has_tenant(tenant_id));

create policy listing_performance_rw on listing_performance
  for all to authenticated using (has_tenant(tenant_id)) with check (has_tenant(tenant_id));

-- Seed

insert into sources (id, name, kind, provides, notes) values
  ('ebay_browse',    'eBay Browse API',      'api',    '{pricing,depth}',
   'Active listings. Available on the base developer tier.'),
  ('ebay_insights',  'eBay Marketplace Insights', 'api', '{velocity}',
   'Sold-listing velocity. Limited Release, rarely granted. Adapter exists so it can be switched on if access lands.'),
  ('zik_export',     'Zik Analytics export', 'export', '{velocity,depth}',
   'CSV export. No inbound public API exists.'),
  ('terapeak_export','Terapeak export',      'export', '{velocity}',
   'CSV export from Seller Hub. Requires an eBay Store subscription on the seller account.'),
  ('aliexpress',     'AliExpress',           'scrape', '{demand,supply}',
   'Review count acceleration as a demand proxy.'),
  ('cj_dropshipping','CJ Dropshipping',      'api',    '{supply}',
   'UK warehouse stock and landed cost.'),
  ('google_trends',  'Google Trends UK',     'scrape', '{demand,seasonality}', null),
  ('met_office',     'Met Office',           'api',    '{seasonality}',
   'Seven day forecast for weather-driven categories.');

insert into tenants (slug, name, currency, locale, marketplace, palette, fees, scoring)
values (
  'cart-and-keep',
  'Cart & Keep',
  'GBP',
  'en-GB',
  'EBAY_GB',
  '{
     "base":   "#FAF6EF",
     "ink":    "#2A2723",
     "brand":  "#7A9575",
     "action": "#C4674A"
   }'::jsonb,
  '{
     "ebay":    { "pct": 0.128, "fixed": 0.30 },
     "payment": { "pct": 0.029, "fixed": 0.30 },
     "tiktok":  { "pct": 0.065, "fixed": 0.00 },
     "store":   { "pct": 0.015, "fixed": 0.20 }
   }'::jsonb,
  '{
     "weights": {
       "ebay_browse":     1.0,
       "aliexpress":      1.0,
       "google_trends":   0.8,
       "cj_dropshipping": 0.6,
       "zik_export":      1.2,
       "met_office":      0.4
     },
     "margin_floor": 4.00,
     "min_signals":  2
   }'::jsonb
);
