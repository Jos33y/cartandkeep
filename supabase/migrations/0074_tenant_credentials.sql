-- Per-tenant OAuth tokens and API credentials.
--
-- Her eBay refresh token is her credential, not the studio's, so it is scoped
-- by tenant like everything else. The application keys stay studio level and
-- live in the edge function's environment: those identify Cart & Keep the
-- application, and are the same for every tenant.
--
-- Nothing in the browser ever reads this table. The refresh token is only ever
-- handled by an edge function using the service role, which is why the policies
-- below grant nothing to anon or authenticated: a token readable from the
-- client is a token that can be exfiltrated from the client.

create table if not exists tenant_credentials (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,

  -- ebay, stripe, royal_mail. A row per tenant per provider.
  provider text not null,

  -- Long lived, exchanged for short lived access tokens as needed. Encrypted
  -- at rest by the database; never returned to a browser.
  refresh_token text not null,

  -- What consent actually granted, which is not always what was asked for.
  -- Worth storing: a failing call is quicker to diagnose against the scopes
  -- that were granted than against the ones in the request.
  scopes text[] not null default '{}',

  -- eBay's refresh tokens run about eighteen months. Knowing when it lapses is
  -- the difference between reconnecting on a quiet Tuesday and finding out
  -- because listings stopped publishing.
  expires_at timestamptz,

  -- Which eBay account the consent belongs to, so a reconnection under the
  -- wrong login is visible rather than silent.
  account_ref text,

  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (tenant_id, provider)
);

create index if not exists tenant_credentials_tenant_idx
  on tenant_credentials (tenant_id, provider);

alter table tenant_credentials enable row level security;

-- No policy for anon or authenticated, deliberately. Row level security denies
-- by default, so the absence of a policy is the policy. The service role used
-- by edge functions bypasses this.
drop policy if exists tenant_credentials_no_client_read on tenant_credentials;

comment on table tenant_credentials is
  'Per-tenant OAuth tokens. Service role only. Never selected from the browser.';
