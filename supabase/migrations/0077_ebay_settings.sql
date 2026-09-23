-- Which of her policies a listing should use.
--
-- An offer names a postage policy, a payment policy, a returns policy and an
-- inventory location, and eBay refuses to publish without all four. Her account
-- carries sixteen postage policies, three returns policies and four locations,
-- two of which are in Shenzhen, so nothing can pick them automatically and
-- guessing would publish a listing that says it dispatches from China.
--
-- Chosen once, on the settings screen, from the lists the connection already
-- reads back.

alter table tenant_credentials add column if not exists settings jsonb;

comment on column tenant_credentials.settings is
  'Per-provider listing defaults. For eBay: fulfilment, payment and return policy ids, the merchant location key, and the listing condition.';
