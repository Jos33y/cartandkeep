-- 0114_photo_checks.sql
-- The shop's photos may go up on eBay and her shop once Keepr has checked them (Joseey, 30 September 2026): no
-- watermark, logo or shop name, no price stickers or text laid over, a plain product shot, the same pack as the card,
-- and big enough for eBay. eBay's catalogue comes first on eBay; her own uploads come first everywhere.
--
-- The check's answer sits on the card, so the portal, the eBay function and the queue all read one verdict.

alter table public.candidates
  -- { checked_at, page, shop, brand, brand_rule, gtin, catalogue: {epid,title,images} | null,
  --   images: [{ url, ok, reasons[], width, height }] }
  add column if not exists photo_checks jsonb;

-- Brands whose shop photos are not used, only eBay's catalogue or her own: those known to report listings on eBay.
-- A starting list to measure against, not a verdict. tenant_id null applies to every shop; a shop can add its own.
create table if not exists public.photo_brand_rules (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid references public.tenants (id) on delete cascade,
  brand       text not null,
  rule        text not null default 'catalogue_only' check (rule in ('catalogue_only')),
  note        text,
  created_at  timestamptz not null default now()
);

create unique index if not exists photo_brand_rules_one
  on public.photo_brand_rules (coalesce(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(brand));

alter table public.photo_brand_rules enable row level security;

drop policy if exists photo_brand_rules_read on public.photo_brand_rules;
create policy photo_brand_rules_read on public.photo_brand_rules
  for select to authenticated
  using (tenant_id is null or has_tenant(tenant_id));

-- A shop adds or removes its own; the shared list changes by migration.
drop policy if exists photo_brand_rules_own on public.photo_brand_rules;
create policy photo_brand_rules_own on public.photo_brand_rules
  for all to authenticated
  using (tenant_id is not null and has_tenant(tenant_id))
  with check (tenant_id is not null and has_tenant(tenant_id));

revoke all on public.photo_brand_rules from anon;
grant select, insert, delete on public.photo_brand_rules to authenticated;

insert into public.photo_brand_rules (tenant_id, brand, note)
select null, b, 'Starting list, 30 September 2026: brands widely reported to enforce on eBay. Adjust from takedowns.'
from unnest(array['Lego', 'Dyson', 'Apple', 'Nike', 'Adidas', 'Pandora']) as b
on conflict do nothing;
