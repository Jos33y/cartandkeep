-- 0141_price_changes.sql
-- Changing a live price (Joseey, 4 October): from Listings, the price alone, on eBay and on her shop, for every
-- listing, whether it was listed from Cart & Keep or in Seller Hub. Nothing else on the listing changes.
--
-- Each change is kept: what it was, what it became, the cost it was worked from and which of the prices she took
-- (the lowest that keeps her profit, the price as it was, or one she typed). Keeper's "Find it cheaper" reads this
-- later: what a price change did to the views and the sales is how it learns which way to move a price.
-- Written by the price-change function only (service role); she reads her own shop's rows.

create table if not exists price_changes (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants (id) on delete cascade,
  channel       text not null check (channel in ('ebay', 'shop')),
  -- eBay's item number, the shop product, and the card, whichever the change was on.
  listing_id    text,
  product_id    uuid references store_products (id) on delete set null,
  candidate_id  uuid references candidates (id) on delete set null,
  old_price     numeric(10, 2),
  new_price     numeric(10, 2) not null check (new_price > 0),
  -- The cost the prices were worked from when she changed it, if the listing has one.
  cost          numeric(10, 2),
  -- floor: the lowest price that keeps her profit; kept: the price as it was; typed: her own.
  choice        text not null default 'typed' check (choice in ('floor', 'kept', 'typed')),
  -- How eBay was told: the route a listing from Cart & Keep was made with, or the item number for Seller Hub's.
  route         text check (route in ('inventory', 'trading', 'shop')),
  by            text not null default 'her' check (by in ('her', 'keeper')),
  user_id       uuid,
  ok            boolean not null,
  error         text,
  created_at    timestamptz not null default now()
);

create index if not exists price_changes_listing_idx on price_changes (tenant_id, listing_id, created_at desc);
create index if not exists price_changes_product_idx on price_changes (tenant_id, product_id, created_at desc) where product_id is not null;

alter table price_changes enable row level security;
drop policy if exists price_changes_read on price_changes;
create policy price_changes_read on price_changes for select to authenticated using (has_tenant(tenant_id));
