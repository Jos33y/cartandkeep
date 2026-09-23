-- The storefront's catalogue.
--
-- Nothing on this project has held products before. `candidates` are research
-- rows: things that might be worth selling, carrying a market reading and no
-- customer facing copy. A store product is a thing on sale, with a price she
-- set, an image a buyer sees and a URL. Putting the two in one table would
-- mean a rejected candidate is a broken product page.
--
-- `is_sample` is not a badge. It is a visibility boundary, and the read policy
-- at the bottom of this file is what makes it one. A sample row cannot be seen
-- by the public no matter what the front end does or forgets to do, so the
-- build can run against real products all week without any chance of one
-- reaching a customer. Clearing them at launch is one delete, and forgetting
-- to clear them is not a live incident.
--
-- `source_kind` and `source_ref` record where a product came from. The first
-- catalogue is seeded from her own live eBay listings, which are real products
-- with real images at prices she already chose, so the shop opens with stock
-- rather than with an empty state and an apology.

create table if not exists store_products (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants (id) on delete cascade,

  slug          text not null,
  title         text not null,
  description   text,

  -- Set by her, not derived. The store's arithmetic differs from eBay's by
  -- about 17.7% of the sale price, because there is no marketplace fee and no
  -- ad rate, so a price carried straight over from a marketplace listing is
  -- leaving that difference on the table. Carried over anyway on seed, because
  -- a price she recognises is a better starting point than one we invented.
  price         numeric(10, 2) not null check (price >= 0),
  compare_at    numeric(10, 2) check (compare_at is null or compare_at >= price),

  image_url     text,
  images        jsonb not null default '[]'::jsonb,
  category      text,
  postage_band  text,

  -- draft is the working state, live is on sale, archived is off sale and kept.
  -- Nothing is ever deleted by the application.
  status        text not null default 'draft'
                check (status in ('draft', 'live', 'archived')),

  is_sample     boolean not null default false,

  source_kind   text check (source_kind in ('ebay_listing', 'candidate', 'manual')),
  source_ref    text,
  -- A candidate that becomes a product keeps the link, and losing the candidate
  -- must not take the product with it.
  candidate_id  uuid references candidates (id) on delete set null,

  position      integer,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  unique (tenant_id, slug)
);

create index if not exists store_products_tenant_status_idx
  on store_products (tenant_id, status) where is_sample = false;

create index if not exists store_products_source_idx
  on store_products (tenant_id, source_kind, source_ref);

comment on column store_products.is_sample is
  'Build scaffolding. Excluded from the public read policy, so a sample row is invisible to customers regardless of front end behaviour.';

-- Same trigger the other tables use. If the function is named differently in
-- this schema, change the name here rather than creating a second one.
drop trigger if exists store_products_touch on store_products;
create trigger store_products_touch
  before update on store_products
  for each row execute function touch_updated_at();

-- Row level security.
--
-- Every other table on this project is read by an authenticated session. This
-- is the first one a stranger reads, so the policy is the security boundary
-- rather than a formality. Anonymous readers see live, non sample rows and
-- nothing else. Drafts, archived rows and samples are invisible to them even
-- if a query asks for them by id.
alter table store_products enable row level security;

drop policy if exists store_products_public_read on store_products;
create policy store_products_public_read on store_products
  for select to anon
  using (status = 'live' and is_sample = false);

drop policy if exists store_products_authenticated_all on store_products;
create policy store_products_authenticated_all on store_products
  for all to authenticated
  using (true) with check (true);
