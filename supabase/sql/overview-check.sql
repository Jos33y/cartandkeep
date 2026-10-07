-- Reads only. Run as one; one JSON result.
-- How the Live count is worked out, how long it takes, and what the true counts are, to set against the Overview.
with t as (select id from tenants where slug = 'cart-and-keep')
select jsonb_build_object(
  'live_listing_counts_def', (select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                              where n.nspname = 'public' and p.proname = 'live_listing_counts' limit 1),
  'what_it_returns', (select live_listing_counts(t.id) from t),
  'cards_live_on_ebay_from_portal', (select count(*) from candidates c, t where c.tenant_id = t.id and c.ebay ->> 'listing_id' is not null),
  'approved_cards', (select count(*) from candidates c join decisions d on d.candidate_id = c.id and d.action = 'approve', t where c.tenant_id = t.id),
  'timeouts', (select jsonb_object_agg(rolname, coalesce((select option_value from pg_options_to_table(rolconfig) where option_name = 'statement_timeout'), 'none'))
               from pg_roles where rolname in ('authenticated', 'anon', 'authenticator'))
) as found;

-- Then, on its own, how long the count takes (paste the last lines, "Execution Time"):
-- explain analyze select live_listing_counts((select id from tenants where slug = 'cart-and-keep'));
