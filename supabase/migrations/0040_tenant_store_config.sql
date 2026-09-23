-- Everything about a shop that is not its catalogue.
--
-- The free delivery threshold currently lives in five React components and one
-- edge function, and the postage rate in four and one. Nothing checks they
-- agree, so the basket and the payment could show different numbers, and the
-- only reason they never have is that nobody has edited them.
--
-- Same shape as `palette`, `fees`, `scoring` and `research`, which are already
-- on this table and already read at runtime. This is that pattern working
-- rather than a new one.

alter table tenants add column if not exists store jsonb not null default '{}'::jsonb;

comment on column tenants.store is
  'Shop configuration, read by the front end and by the checkout function. Delivery thresholds, voice, contact, order reference prefix. Empty falls back to the built in defaults, which are Cart and Keep''s.';

-- Cart & Keep's current values, so nothing changes behaviour on the day this
-- runs. Every one of these was previously only in code.
update tenants
set store = jsonb_build_object(
  'domain', 'cartandkeep.com',
  'email', 'support@cartandkeep.com',
  'referencePrefix', 'CK',
  'delivery', jsonb_build_object(
    'freeOver', 40,
    'postage', 3.95,
    'cutoffHour', 14,
    'transitMin', 2,
    'transitMax', 3
  ),
  'voice', jsonb_build_object(
    'tagline', 'A small UK shop with a very large cupboard'
  ),
  'socials', jsonb_build_object(
    'instagram', 'cartandkeep',
    'tiktok', 'cartandkeep'
  )
)
where slug = 'cart-and-keep' and store = '{}'::jsonb;
