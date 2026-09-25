-- Returns and privacy terms become settings the shop can read and she can write.
-- Before this, neither key was in either whitelist, so the legal pages could only ever show the defaults.

-- Seeded from what every receipt already tells customers: 30 days, shop pays return postage.
update tenants
set store = jsonb_set(
  coalesce(store, '{}'::jsonb),
  '{returns}',
  jsonb_build_object('days', 30, 'statutory_days', 14, 'postage_paid_by', 'us')
    || coalesce(store -> 'returns', '{}'::jsonb)
)
where slug = 'cart-and-keep';

update tenants
set store = jsonb_set(coalesce(store, '{}'::jsonb), '{privacy}', coalesce(store -> 'privacy', '{}'::jsonb))
where slug = 'cart-and-keep';

create or replace function set_store_settings(p_tenant uuid, p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed text[] := array['trader', 'delivery', 'voice', 'socials', 'email', 'selling_costs', 'returns', 'privacy'];
  merged jsonb;
  key text;
  days numeric;
  paid text;
begin
  if not has_tenant(p_tenant) then
    raise exception 'Not your shop' using errcode = '42501';
  end if;

  select coalesce(store, '{}'::jsonb) into merged from tenants where id = p_tenant;
  if merged is null then
    raise exception 'No such shop' using errcode = 'P0002';
  end if;

  -- The law sets 14 days as the floor; a shorter window would print an unlawful term on the returns page.
  if p_patch ? 'returns' then
    days := nullif(p_patch -> 'returns' ->> 'days', '')::numeric;
    if days is not null and (days < 14 or days > 365 or days <> trunc(days)) then
      raise exception 'Return window must be a whole number of days from 14 to 365' using errcode = '22023';
    end if;
    paid := p_patch -> 'returns' ->> 'postage_paid_by';
    if paid is not null and paid not in ('us', 'customer') then
      raise exception 'Return postage is paid by us or customer' using errcode = '22023';
    end if;
  end if;

  foreach key in array allowed loop
    if p_patch ? key then
      if jsonb_typeof(merged -> key) = 'object' and jsonb_typeof(p_patch -> key) = 'object' then
        merged := jsonb_set(merged, array[key], (merged -> key) || (p_patch -> key), true);
      else
        merged := jsonb_set(merged, array[key], p_patch -> key, true);
      end if;
    end if;
  end loop;

  update tenants set store = merged where id = p_tenant;
  return merged;
end;
$$;

revoke all on function set_store_settings(uuid, jsonb) from public, anon;
grant execute on function set_store_settings(uuid, jsonb) to authenticated;

create or replace function public_store(p_slug text)
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  select jsonb_build_object(
    'id',       t.id,
    'slug',     t.slug,
    'name',     t.name,
    'currency', t.currency,
    'locale',   t.locale,
    'palette',  coalesce(t.palette, '{}'::jsonb),
    -- A whitelist, so a key added to store later stays private until someone lists it here.
    'store', (
      select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
      from jsonb_each(coalesce(t.store, '{}'::jsonb))
      where key in ('trader', 'delivery', 'voice', 'socials', 'email', 'domain', 'returns', 'privacy')
    )
  )
  from tenants t
  where t.slug = p_slug;
$$;

revoke all on function public_store(text) from public;
grant execute on function public_store(text) to anon, authenticated;
