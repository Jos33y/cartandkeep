-- A landed cost of zero is not a cheap product, it is an unanswered question.
-- coalesce to zero made a sourcing request render as free with the best margin
-- on the page.
alter table candidate_sources drop column landed_unit_cost;

alter table candidate_sources
  add column landed_unit_cost numeric(10,2)
  generated always as (
    case
      when coalesce(price_at_moq, unit_cost) is null then null
      when fulfilment = 'stock' then
        coalesce(price_at_moq, unit_cost)
          * (1 + coalesce(duty_pct, 0))
          + coalesce(inbound_freight_per_unit, 0)
      else
        coalesce(price_at_moq, unit_cost) + coalesce(supplier_shipping, 0)
    end
  ) stored;

comment on column candidate_sources.landed_unit_cost is 'null until somebody has quoted a price. stock: goods at quantity plus duty plus inbound freight. dropship: goods plus supplier shipping';

-- Typed by hand every time, one supplier becomes three spellings and the ones
-- found in one session are lost by the next.
create table suppliers (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,

  name          text not null,
  kind          text not null default 'unknown'
                check (kind in ('wholesale', 'manufacturer', 'marketplace', 'retailer', 'unknown')),
  country       char(2),
  url           text,
  note          text,

  created_at    timestamptz not null default now(),
  unique (tenant_id, name)
);

create index on suppliers (tenant_id, name);

alter table suppliers enable row level security;

create policy suppliers_rw on suppliers
  for all to authenticated using (has_tenant(tenant_id)) with check (has_tenant(tenant_id));

-- Found on 5 August against this batch. Manufacturers and wholesalers only,
-- because eBay permits fulfilling from a wholesaler and not from a retailer.
insert into suppliers (tenant_id, name, kind, country, url, note)
select t.id, v.name, v.kind, v.country, v.url, v.note
from tenants t
cross join (values
  ('Vetfleece', 'manufacturer', 'GB', 'https://vetfleece.com',
   'Yorkshire mill, vet bedding by the roll, trade pricing on enquiry'),
  ('Bronte Glen', 'wholesale', 'GB', 'https://www.bronteglen.co.uk',
   'Vet bedding rolls by the square metre, part loads to containers'),
  ('SoulPet', 'manufacturer', 'GB', null,
   'UK woven vet bedding and pet mats, trade prices'),
  ('Pet Beds Direct', 'manufacturer', 'GB', null,
   'UK made waterproof and orthopaedic beds, wholesale packs'),
  ('Crow Recycling', 'wholesale', 'GB', null,
   'Shredded paper bedding, 30kg bales, Coventry and Warwickshire'),
  ('Norfolk Industries', 'wholesale', 'GB', null,
   'Food grade shredded paper bedding, 10kg bales, pallets nationally'),
  ('Datec Packaging', 'wholesale', 'GB', null,
   'Shredded paper bedding, 30kg bales, pallet quantities'),
  ('CJ Dropshipping', 'marketplace', 'CN', 'https://cjdropshipping.com',
   'China warehouses, freight runs about the same as the goods')
) as v(name, kind, country, url, note)
where t.slug = 'cart-and-keep'
on conflict (tenant_id, name) do nothing;
