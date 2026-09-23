-- Somewhere for a draft to sit before she has read it.
--
-- Nothing written by a model goes into `description` or `title`. Those are
-- statements a trader makes about goods, and the rule on this project is that
-- the model drafts and she ships. So a draft lands in `derived_fields`, beside
-- the returns guess and the hazard flag, which is the pattern this screen
-- already uses for "a script thought this and nobody has confirmed it".
--
-- A function rather than a plain update, for one reason: `derived_fields`
-- already carries `returns_class` and `hazard_suspect`, and a service role
-- write that read the object, changed one key and wrote it back would clobber
-- whichever of those changed in between. `||` merges in one statement.
--
-- No new column. `derived_fields` is jsonb and has been since 0036.

create or replace function set_product_draft(p_id uuid, p_draft jsonb)
returns jsonb
language sql
security definer
set search_path = public
as $$
  update store_products
  set derived_fields = coalesce(derived_fields, '{}'::jsonb) || jsonb_build_object('draft', p_draft)
  where id = p_id
  returning derived_fields;
$$;

comment on function set_product_draft is
  'Merges a model draft into store_products.derived_fields under the draft key, leaving the returns and hazard flags beside it alone. Called by the draft edge function under the service role. Never writes description or title.';

-- Written only by the draft function. The portal clears a draft through the
-- normal authenticated update on store_products, which 0048 already scopes with
-- has_tenant, so nothing here needs to be granted to a browser.
revoke all on function set_product_draft(uuid, jsonb) from public, anon, authenticated;
grant execute on function set_product_draft(uuid, jsonb) to service_role;
