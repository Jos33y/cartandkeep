-- Letting her change her own shop settings.
--
-- Everything Settings needs to write lives in `tenants.store`: the trading name
-- and address the confirmation email is legally required to carry, the delivery
-- threshold, the postage rate, the cutoff hour, the zone surcharges. Today she
-- cannot write any of it, because `tenants_write` from 0001 is
-- `is_platform_admin()` and nothing else, so her trading name reaches the
-- database through me typing SQL.
--
-- Three ways to open that, and the first two are wrong.
--
-- Adding a permissive update policy for members would let her write the whole
-- row, including `fees` and `scoring`, which are studio work and which she
-- should not be able to break by accident from a settings screen.
--
-- Column grants would fix that, except platform admins authenticate as the same
-- `authenticated` role, so revoking update on `tenants` to narrow it would take
-- studio editing of the palette and the scoring weights with it.
--
-- So: one security definer function that checks membership and merges only the
-- keys it is willing to accept. Same pattern as `has_tenant` and
-- `is_platform_admin`, which is the convention this project already settled on,
-- and the whitelist means a key nobody thought about cannot arrive through it.

create or replace function set_store_settings(p_tenant uuid, p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed text[] := array['trader', 'delivery', 'voice', 'socials', 'email'];
  merged jsonb;
  key text;
begin
  if not has_tenant(p_tenant) then
    raise exception 'Not your shop' using errcode = '42501';
  end if;

  select coalesce(store, '{}'::jsonb) into merged from tenants where id = p_tenant;
  if merged is null then
    raise exception 'No such shop' using errcode = 'P0002';
  end if;

  /*
   * Merged one key at a time rather than with `||` over the whole patch.
   *
   * A single merge would accept anything the caller sent, so a payload
   * carrying `reference_prefix` or a key invented next year would be written
   * without anybody deciding it should be. Refused silently rather than with an
   * error, because the caller is our own screen and a key it does not send is
   * not a key it can be surprised about.
   *
   * `domain` and `reference_prefix` are deliberately not on the list. Changing
   * the order prefix halfway through a shop's life makes two references that
   * look like they came from different businesses, and the domain is a
   * deployment fact rather than a preference.
   */
  foreach key in array allowed loop
    if p_patch ? key then
      /*
       * Merged into, not replaced.
       *
       * `jsonb_set` on its own overwrites the whole object at that key, so a
       * screen saving only the legal name would silently wipe the trading name,
       * the support address and the complaints URL beside it. Found by running
       * this against a database rather than by reading it, which is the only
       * way that class of bug shows up.
       *
       * One level deep is enough and is deliberate. `trader` and `delivery` are
       * flat maps of values. Going deeper would mean a nested key could never
       * be cleared, because a merge cannot express a removal.
       */
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

comment on function set_store_settings is
  'Merges whitelisted keys into tenants.store for a tenant the caller belongs to. The only write path an operator has to their own shop settings, because tenants_write is platform admin only and column grants cannot separate the two, since studio staff authenticate as the same role.';

revoke all on function set_store_settings(uuid, jsonb) from public, anon;
grant execute on function set_store_settings(uuid, jsonb) to authenticated;

/*
 * The shape Settings reads and writes.
 *
 * Seeded here so the screen renders every field on the first load rather than
 * only the ones that happen to exist, and so a missing key is a blank box she
 * can fill rather than a row that is not there.
 *
 * Trader identity stays null. Three of those are gold blocks and a placeholder
 * that reads like a value is worse than an empty one: the confirmation email
 * omits the block when it is absent and records that it did, which is what
 * makes an order that went out short findable later.
 */
update tenants
set store = coalesce(store, '{}'::jsonb)
  || jsonb_build_object(
    'trader', coalesce(store -> 'trader', '{}'::jsonb) || jsonb_build_object(
      'legal_name', coalesce(store -> 'trader' -> 'legal_name', 'null'::jsonb),
      'trading_as', coalesce(store -> 'trader' -> 'trading_as', to_jsonb('Cart & Keep'::text)),
      'address', coalesce(store -> 'trader' -> 'address', 'null'::jsonb),
      'company_number', coalesce(store -> 'trader' -> 'company_number', 'null'::jsonb),
      'vat_number', 'null'::jsonb,
      'email', coalesce(store -> 'trader' -> 'email', to_jsonb('support@cartandkeep.com'::text)),
      'complaints_url', coalesce(store -> 'trader' -> 'complaints_url', 'null'::jsonb)
    )
  )
where slug = 'cart-and-keep';
