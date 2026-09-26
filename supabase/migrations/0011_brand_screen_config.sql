-- 0011_brand_screen_config.sql

-- brand.js was written after the first supplier run returned 58 of 62 signals as
-- one branded lash kit, and has never been called. The known list is
-- authoritative and grows as brands are met; the heuristics in the module cover
-- what it has not seen yet.

update tenants
set research = coalesce(research, '{}'::jsonb) || '{
  "brands": {
    "known": [
      "iconsign"
    ],
    "allow": []
  }
}'::jsonb
where slug = 'cart-and-keep';

-- Verify (run by hand; the pasted result that used to sit here broke a fresh rebuild)
-- select research->'brands' from tenants where slug = 'cart-and-keep';
