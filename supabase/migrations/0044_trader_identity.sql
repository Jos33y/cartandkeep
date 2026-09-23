-- Trader identity, where the edge functions can read it.
--
-- Schedule 2 items b and c require the trading name, the geographic address and
-- contact details in the confirmation of a distance contract. Those currently
-- live in `src/data/legal.js`, a file in the repository, which means the
-- webhook cannot see them and she cannot correct them without a deploy.
--
-- They go on the tenant row instead, inside the `store` object 0040 created, so
-- one source feeds the legal pages, the contact page and the confirmation
-- email. The alternative was importing the file into the email template, which
-- puts her identity in two places and guarantees they disagree eventually.
--
-- Seeded null on purpose. Three of these are gold blocks still with her, and a
-- placeholder that reads like a value is worse than an empty one: the email
-- template omits the block when it is absent and records that it did, rather
-- than sending a customer the words "Needs confirming".

update tenants
set store = coalesce(store, '{}'::jsonb) || jsonb_build_object(
  'trader', jsonb_build_object(
    'legal_name', null,        -- GOLD BLOCK. Registered or trading name.
    'trading_as', 'Cart & Keep',
    'address', null,           -- GOLD BLOCK. Geographic, not a PO box.
    'company_number', null,    -- GOLD BLOCK. Null if she trades as a sole trader.
    'vat_number', null,        -- She is not registered. Stays null.
    'email', 'support@cartandkeep.com',
    'complaints_url', null     -- Schedule 2 item k, if she adopts a policy.
  )
)
where slug = 'cart-and-keep'
  and store is not null;

comment on column tenants.store is
  'Storefront configuration read by the front end and by the edge functions. Holds delivery, voice, socials, zones and trader identity, so a figure or a legal detail cannot disagree between the basket, the payment and the confirmation email.';
