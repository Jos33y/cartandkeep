-- Letting a shopper read the shop they are standing in.
--
-- `tenants_read` from 0001 is `has_tenant(id)`, which is correct and which no
-- anonymous visitor can ever satisfy. So `loadTenant` did `.single()` against
-- zero rows, threw, and the storefront rendered "No shop is configured for this
-- address". It never showed up before because every load this project has had
-- was a signed in one. The first private window found it.
--
-- Three ways to open it and two are wrong.
--
-- A permissive anon policy on `tenants` hands a shopper's browser `fees`,
-- `scoring`, `research` and, since 0055, `selling_costs`, which holds her ad
-- rate and her platform fee assumptions. At client two it hands one shop's
-- visitor another client's fee card.
--
-- Column grants narrow the columns but not `store`, and `store` is one jsonb
-- carrying both the delivery terms a shopper needs and the selling costs they
-- must not have.
--
-- So: a security definer function returning only what a shopfront renders,
-- keyed by slug. Same pattern as `set_store_settings` and `has_tenant`, which
-- is the convention this project already settled on.

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
    /*
     * A whitelist rather than `store - 'selling_costs'`.
     *
     * Subtracting the one key that is sensitive today means any key added to
     * this object next year is public the moment it is written, and nobody
     * adding it will be reading this file. Listing what may leave is the same
     * choice `set_store_settings` makes about what may arrive.
     *
     * `reference_prefix` is deliberately absent. The shop never renders it and
     * an order reference is generated server side.
     */
    'store', (
      select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
      from jsonb_each(coalesce(t.store, '{}'::jsonb))
      where key in ('trader', 'delivery', 'voice', 'socials', 'email', 'domain')
    )
  )
  from tenants t
  where t.slug = p_slug;
$$;

comment on function public_store is
  'The shopfront half of a tenant row, for a visitor with no session. Security definer because tenants_read is membership scoped and a shopper is not a member. The store whitelist is what keeps fees, scoring, research and selling costs out of a browser.';

revoke all on function public_store(text) from public;
grant execute on function public_store(text) to anon, authenticated;
