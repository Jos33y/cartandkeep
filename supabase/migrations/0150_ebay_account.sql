-- 0150_ebay_account.sql
-- Her eBay account as eBay has it, and the one switch that prices for it (Joseey, 8 October 2026).
--
-- A private seller in the UK pays no selling fee: the buyer pays eBay's Buyer Protection fee on top of her price.
-- What she does pay is the ad rate on a promoted sale, set per campaign. The portal priced every card as a business
-- seller, 12.8% plus 30p an order and a guessed 3% ad rate, so floors and keeps were too low.
--
--   ebay_account  one row a shop: her choice (private or business), what eBay says the account is, her campaigns,
--                 the ad rate she usually runs, and what eBay charged in the last 90 days. Read by the ebay-account
--                 function; she changes only the choice, through set_ebay_seller.
--   ebay_ads      each promoted listing and its ad rate, from her campaigns. Replaced whole on every read.
--
-- Nothing personal is kept from eBay: the account type and the user name, no name, email, phone or address.
-- Members read both tables; only the function writes them. Safe to run twice.

create table if not exists ebay_account (
  tenant_id   uuid primary key references tenants(id) on delete cascade,
  -- Her choice. Null follows what eBay says the account is.
  seller_type text check (seller_type in ('private', 'business')),
  chosen_by   uuid,
  chosen_at   timestamptz,
  -- What eBay says: INDIVIDUAL or BUSINESS.
  ebay_type   text check (ebay_type in ('INDIVIDUAL', 'BUSINESS')),
  username    text,
  -- [{ id, name, status, model, rate, dynamic, auto, ads }], rate as a fraction (0.08 is 8%). Null until eBay has
  -- given them once: until then a card keeps the ad rate it was costed with.
  campaigns   jsonb,
  -- The ad rate a new listing is costed at: the middle rate of her active promoted listings.
  typical_ad  numeric check (typical_ad is null or (typical_ad >= 0 and typical_ad <= 1)),
  -- { from, to, sales, sold, charged: { FEE_TYPE: pounds }, total }
  fees        jsonb,
  read_at     timestamptz,
  read_error  text,
  tried_at    timestamptz
);

create table if not exists ebay_ads (
  tenant_id     uuid not null references tenants(id) on delete cascade,
  listing_id    text not null,
  campaign_id   text not null,
  campaign_name text,
  rate          numeric not null check (rate >= 0 and rate <= 1),
  status        text,
  read_at       timestamptz not null default now(),
  primary key (tenant_id, listing_id)
);

alter table ebay_account enable row level security;
alter table ebay_ads enable row level security;

-- The 0147 form: worked out once a request, not once a row.
drop policy if exists ebay_account_read on ebay_account;
create policy ebay_account_read on ebay_account for select to authenticated
  using ((SELECT is_platform_admin()) OR tenant_id = ANY ((SELECT my_tenant_ids())::uuid[]));

drop policy if exists ebay_ads_read on ebay_ads;
create policy ebay_ads_read on ebay_ads for select to authenticated
  using ((SELECT is_platform_admin()) OR tenant_id = ANY ((SELECT my_tenant_ids())::uuid[]));

revoke all on ebay_account, ebay_ads from anon;
revoke insert, update, delete on ebay_account, ebay_ads from authenticated;
grant select on ebay_account, ebay_ads to authenticated;

-- Her switch. 'private', 'business', or null to follow eBay.
create or replace function set_ebay_seller(p_tenant uuid, p_type text)
returns ebay_account
language plpgsql
security definer
set search_path = public
as $$
declare
  r ebay_account;
begin
  if not has_tenant(p_tenant) then raise exception 'Not your shop.' using errcode = '42501'; end if;
  if p_type is not null and p_type not in ('private', 'business') then
    raise exception 'The account is private or business.' using errcode = '22023';
  end if;
  insert into ebay_account (tenant_id, seller_type, chosen_by, chosen_at)
  values (p_tenant, p_type, auth.uid(), now())
  on conflict (tenant_id) do update
    set seller_type = excluded.seller_type, chosen_by = excluded.chosen_by, chosen_at = excluded.chosen_at
  returning * into r;
  return r;
end;
$$;

revoke all on function set_ebay_seller(uuid, text) from public, anon;
grant execute on function set_ebay_seller(uuid, text) to authenticated;

/*
 * What the ebay-account function read, saved in one go. p_read carries any of ebay_type, username, campaigns,
 * typical_ad and fees, and error when a part of the read failed: a part not sent keeps its last good value. Error
 * alone, when eBay did not answer at all, keeps everything and says why. p_ads is
 * [{ listing_id, campaign_id, campaign_name, rate, status }] and replaces the listings' rates whole; null keeps them.
 * Her choice is never touched here.
 */
create or replace function put_ebay_read(p_tenant uuid, p_read jsonb, p_ads jsonb default null)
returns ebay_account
language plpgsql
security definer
set search_path = public
as $$
declare
  r ebay_account;
begin
  insert into ebay_account (tenant_id) values (p_tenant) on conflict (tenant_id) do nothing;

  if p_read ? 'error' and not (p_read ?| array['ebay_type', 'campaigns', 'fees']) then
    update ebay_account set read_error = p_read ->> 'error', tried_at = now()
    where tenant_id = p_tenant returning * into r;
    return r;
  end if;

  update ebay_account set
    ebay_type  = case when p_read ->> 'ebay_type' in ('INDIVIDUAL', 'BUSINESS') then p_read ->> 'ebay_type' else ebay_type end,
    username   = coalesce(p_read ->> 'username', username),
    campaigns  = coalesce(p_read -> 'campaigns', campaigns),
    typical_ad = case when not p_read ? 'typical_ad' then typical_ad
                      when (p_read ->> 'typical_ad') ~ '^\d+(\.\d+)?$' then least((p_read ->> 'typical_ad')::numeric, 1) end,
    fees       = coalesce(p_read -> 'fees', fees),
    read_at    = now(),
    read_error = p_read ->> 'error',
    tried_at   = now()
  where tenant_id = p_tenant
  returning * into r;

  if p_ads is not null then
    delete from ebay_ads where tenant_id = p_tenant;
    insert into ebay_ads (tenant_id, listing_id, campaign_id, campaign_name, rate, status)
    select distinct on (a ->> 'listing_id')
      p_tenant, a ->> 'listing_id', a ->> 'campaign_id', a ->> 'campaign_name',
      least((a ->> 'rate')::numeric, 1), a ->> 'status'
    from jsonb_array_elements(p_ads) a
    where coalesce(a ->> 'listing_id', '') <> ''
      and coalesce(a ->> 'campaign_id', '') <> ''
      and (a ->> 'rate') ~ '^\d+(\.\d+)?$'
    -- One rate a listing: the highest, the cost if more than one campaign holds it.
    order by a ->> 'listing_id', (a ->> 'rate')::numeric desc;
  end if;
  return r;
end;
$$;

revoke all on function put_ebay_read(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function put_ebay_read(uuid, jsonb, jsonb) to service_role;

-- Cart & Keep sells as a private seller (8 October). Every shop already connected to eBay starts private, which
-- she can change in Settings; a shop that has chosen keeps its choice.
insert into ebay_account (tenant_id, seller_type, chosen_at)
select distinct tenant_id, 'private', now() from tenant_credentials where provider = 'ebay'
on conflict (tenant_id) do nothing;
