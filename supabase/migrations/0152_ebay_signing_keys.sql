-- 0152_ebay_signing_keys.sql
-- The key pair eBay asks UK sellers' Finances calls to be signed with (8 October 2026: "Missing x-ebay-signature-key
-- header"). The studio's app has one pair, made by the functions through eBay's Key Management API the first time it
-- is needed (_shared/ebay/sign.ts), and kept here.
--
-- private_key is a secret: row security is on with no rule at all, and every grant is taken from the signed-in and
-- public roles, so only the functions (service role) can read it. eBay never stores it. Safe to run twice.

create table if not exists ebay_signing_keys (
  key_id      text primary key,
  private_key text not null,
  jwe         text not null,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);

alter table ebay_signing_keys enable row level security;
revoke all on ebay_signing_keys from public, anon, authenticated;
grant select, insert on ebay_signing_keys to service_role;

comment on table ebay_signing_keys is
  'eBay digital signature key pairs for Finances API calls. Secret: service role only, no policies on purpose.';
