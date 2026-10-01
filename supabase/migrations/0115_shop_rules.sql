-- Returns and label warnings for shop drafts, checked by Keepr when a card goes to her shop.
--
-- 0036 made returns a property of the product and asked for a hazard record on
-- every classified mixture, and said a script's guess must never go live
-- unconfirmed. Drafts from the Approved page skipped both: they landed as
-- standard with no hazard check at all, which is a blanket "no hazard" nobody
-- made.
--
-- Now Keepr reads each one. What it found goes in derived_fields.rules. A
-- standard return is the default the law already gives, so it is confirmed as
-- it lands. Sealed only and no return are exceptions to a customer's right, so
-- they wait for her (derived_fields.returns_class, the flag 0036 set up). A
-- chemical is flagged (hazard_suspect) with the label elements Keepr could read
-- in hazard_draft, for her to check against the bottle and save. Nothing is
-- written to `hazard` itself: that column is her statement.
--
-- A function for the same reason as set_product_draft in 0057: derived_fields
-- holds several keys written by different hands, and `||` merges in one
-- statement. It never changes a returns class she has saved (returns_by =
-- 'her'), and only touches drafts.

create or replace function set_product_rules(p_id uuid, p_derived jsonb, p_returns text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  update store_products
  set derived_fields = coalesce(derived_fields, '{}'::jsonb) || p_derived,
      returns_class = case
        when p_returns in ('standard', 'sealed', 'none')
          and coalesce(derived_fields ->> 'returns_by', '') <> 'her'
        then p_returns
        else returns_class
      end
  where id = p_id and status = 'draft'
  returning derived_fields;
$$;

comment on function set_product_rules is
  'Merges Keepr''s returns and label check into store_products.derived_fields and sets a returns class she has not saved herself. Drafts only. Called by the shop-rules edge function under the service role.';

revoke all on function set_product_rules(uuid, jsonb, text) from public, anon, authenticated;
grant execute on function set_product_rules(uuid, jsonb, text) to service_role;
