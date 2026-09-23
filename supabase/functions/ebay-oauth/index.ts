// Actions: start, finish, preflight, save_settings, status.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EBAY = 'https://api.ebay.com';
// Identity is served from apiz, not api. 404s otherwise.
const EBAY_ID = 'https://apiz.ebay.com';
const AUTH = 'https://auth.ebay.com/oauth2/authorize';

// Asked for in one go: adding one later means asking her to consent again.
const SCOPES = [
  'https://api.ebay.com/oauth/api_scope',
  'https://api.ebay.com/oauth/api_scope/sell.inventory',
  'https://api.ebay.com/oauth/api_scope/sell.account',
  'https://api.ebay.com/oauth/api_scope/sell.fulfillment',
  'https://api.ebay.com/oauth/api_scope/sell.marketing',
  'https://api.ebay.com/oauth/api_scope/sell.finances',
  'https://api.ebay.com/oauth/api_scope/sell.analytics.readonly',
  'https://api.ebay.com/oauth/api_scope/sell.reputation',
  'https://api.ebay.com/oauth/api_scope/sell.return.read',
  'https://api.ebay.com/oauth/api_scope/sell.cancellation.read',
  'https://api.ebay.com/oauth/api_scope/sell.inquiry.read',
  'https://api.ebay.com/oauth/api_scope/commerce.notification.subscription',
  'https://api.ebay.com/oauth/api_scope/commerce.identity.readonly',
];

const CORS = {
  'access-control-allow-origin': '*',
  // supabase-js sends x-client-info on every invoke.
  'access-control-allow-headers':
    'authorization, content-type, apikey, x-client-info, x-supabase-api-version',
  'access-control-allow-methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  });

const env = (name: string) => {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`${name} is not set on this function`);
  return v;
};

const db = () =>
  createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  });

async function ebayToken(form: Record<string, string>) {
  const basic = btoa(`${env('EBAY_CLIENT_ID')}:${env('EBAY_CLIENT_SECRET')}`);
  const res = await fetch(`${EBAY}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      authorization: `Basic ${basic}`,
    },
    body: new URLSearchParams(form).toString(),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error_description ?? body.error ?? `eBay returned ${res.status}`);
  }
  return body;
}

async function accessFor(tenantId: string) {
  const { data, error } = await db()
    .from('tenant_credentials')
    .select('refresh_token')
    .eq('tenant_id', tenantId)
    .eq('provider', 'ebay')
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error('This account is not connected to eBay yet.');

  // No scope on refresh: sending one breaks the moment a scope is added here.
  const t = await ebayToken({
    grant_type: 'refresh_token',
    refresh_token: data.refresh_token,
  });

  return {
    access: t.access_token as string,
    granted: String(t.scope ?? '').split(' ').filter(Boolean),
  };
}

async function identity(access: string) {
  const res = await fetch(`${EBAY_ID}/commerce/identity/v1/user/`, {
    headers: { authorization: `Bearer ${access}` },
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

async function sell(path: string, access: string) {
  const res = await fetch(`${EBAY}${path}`, {
    headers: {
      authorization: `Bearer ${access}`,
      'content-type': 'application/json',
      'X-EBAY-C-MARKETPLACE-ID': 'EBAY_GB',
    },
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const { action, tenant_id: tenantId, code, settings } = await req.json();
    if (!tenantId) return json({ error: 'tenant_id is required' }, 400);

    if (action === 'start') {
      const url = new URL(AUTH);
      url.searchParams.set('client_id', env('EBAY_CLIENT_ID'));
      url.searchParams.set('response_type', 'code');
      // eBay wants the RuName here, not the callback URL.
      url.searchParams.set('redirect_uri', env('EBAY_RU_NAME'));
      url.searchParams.set('scope', SCOPES.join(' '));
      url.searchParams.set('state', tenantId);
      return json({ url: url.toString() });
    }

    if (action === 'finish') {
      if (!code) return json({ error: 'code is required' }, 400);

      const t = await ebayToken({
        grant_type: 'authorization_code',
        code: decodeURIComponent(code),
        redirect_uri: env('EBAY_RU_NAME'),
      });

      let account: string | null = null;
      try {
        const who = await identity(t.access_token);
        if (who.ok) account = who.body.username ?? who.body.userId ?? null;
      } catch { /* a name is not worth failing the connection over */ }

      const expiresAt = t.refresh_token_expires_in
        ? new Date(Date.now() + t.refresh_token_expires_in * 1000).toISOString()
        : null;

      const { error } = await db()
        .from('tenant_credentials')
        .upsert({
          tenant_id: tenantId,
          provider: 'ebay',
          refresh_token: t.refresh_token,
          scopes: t.scope ? String(t.scope).split(' ') : SCOPES,
          expires_at: expiresAt,
          account_ref: account,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'tenant_id,provider' });

      if (error) return json({ error: error.message }, 500);
      return json({ connected: true, account, expires_at: expiresAt });
    }

    if (action === 'preflight') {
      const { access, granted } = await accessFor(tenantId);

      const [who, postage, payment, returns, locations] = await Promise.all([
        identity(access),
        sell('/sell/account/v1/fulfillment_policy?marketplace_id=EBAY_GB', access),
        sell('/sell/account/v1/payment_policy?marketplace_id=EBAY_GB', access),
        sell('/sell/account/v1/return_policy?marketplace_id=EBAY_GB', access),
        sell('/sell/inventory/v1/location?limit=25', access),
      ]);

      const list = (r: { ok: boolean; body: Record<string, unknown> }, key: string) =>
        (r.ok ? (r.body[key] as unknown[] ?? []) : []);

      const policies = {
        postage: list(postage, 'fulfillmentPolicies').map((p: Record<string, never>) => {
          const services = (p.shippingOptions ?? []) as Array<Record<string, never>>;
          const domestic = services.find((o) => o.optionType === 'DOMESTIC');
          const first = ((domestic?.shippingServices ?? []) as Array<Record<string, never>>)[0];
          const cost = Number((first?.shippingCost as { value: string })?.value ?? 0);

          return {
            id: p.fulfillmentPolicyId,
            name: p.name,
            // Every price on the board assumes postage is absorbed.
            free: cost === 0,
            // Under three days leaves no time to buy it after it sells.
            handling: (p.handlingTime as { value: number })?.value ?? null,
            service: first?.shippingServiceCode ?? null,
            international: services.some((o) => o.optionType === 'INTERNATIONAL'),
          };
        }),
        payment: list(payment, 'paymentPolicies').map((p: Record<string, string>) => ({
          id: p.paymentPolicyId, name: p.name,
        })),
        returns: list(returns, 'returnPolicies').map((p: Record<string, never>) => ({
          id: p.returnPolicyId,
          name: p.name,
          accepted: p.returnsAccepted === true,
          days: (p.returnPeriod as { value: number })?.value ?? null,
        })),
        locations: list(locations, 'locations').map((l: Record<string, never>) => {
          const a = (l.location as { address: Record<string, string> })?.address ?? {};
          return {
            key: l.merchantLocationKey,
            name: l.name,
            where: [a.city, a.postalCode, a.country].filter(Boolean).join(', '),
            country: a.country ?? null,
          };
        }),
      };

      const username = who.ok ? (who.body.username ?? who.body.userId ?? null) : null;

      await db().from('tenant_credentials')
        .update({
          ...(username ? { account_ref: username } : {}),
          ...(granted.length ? { scopes: granted } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', tenantId).eq('provider', 'ebay');

      // eBay omits scope on a refresh, so an empty list means unknown, not none.
      const missingScopes = granted.length
        ? SCOPES
          .filter((s) => s !== 'https://api.ebay.com/oauth/api_scope')
          .filter((s) => !granted.includes(s))
          .map((s) => s.split('/').pop())
        : [];

      const { data: saved } = await db()
        .from('tenant_credentials')
        .select('settings')
        .eq('tenant_id', tenantId)
        .eq('provider', 'ebay')
        .maybeSingle();

      const missing = [
        !policies.postage.length && 'a postage policy',
        !policies.payment.length && 'a payment policy',
        !policies.returns.length && 'a returns policy',
        !policies.locations.length && 'an inventory location, which needs her trading address',
      ].filter(Boolean);

      return json({
        token: true,
        granted,
        missing_scopes: missingScopes,
        account: username,
        settings: saved?.settings ?? null,
        can_list: missing.length === 0,
        missing,
        ...policies,
        errors: [
          !who.ok && `identity ${who.status}: ${
            who.body?.errors?.[0]?.message ?? who.body?.message ?? 'no detail'
          }`,
          !postage.ok && `postage ${postage.status}`,
          !payment.ok && `payment ${payment.status}`,
          !returns.ok && `returns ${returns.status}`,
          !locations.ok && `locations ${locations.status}`,
        ].filter(Boolean),
      });
    }

    if (action === 'save_settings') {
      if (!settings || typeof settings !== 'object') {
        return json({ error: 'settings is required' }, 400);
      }

      const { error } = await db()
        .from('tenant_credentials')
        .update({ settings, updated_at: new Date().toISOString() })
        .eq('tenant_id', tenantId)
        .eq('provider', 'ebay');

      if (error) return json({ error: error.message }, 500);
      return json({ saved: true, settings });
    }

    if (action === 'status') {
      const { data, error } = await db()
        .from('tenant_credentials')
        .select('expires_at, connected_at, scopes, account_ref, settings')
        .eq('tenant_id', tenantId)
        .eq('provider', 'ebay')
        .maybeSingle();

      if (error) return json({ error: error.message }, 500);
      if (!data) return json({ connected: false });

      const lapsed = data.expires_at ? new Date(data.expires_at) < new Date() : false;
      return json({
        connected: !lapsed,
        lapsed,
        expires_at: data.expires_at,
        connected_at: data.connected_at,
        account: data.account_ref,
        scopes: data.scopes,
        settings: data.settings ?? null,
      });
    }

    return json({ error: `unknown action: ${action}` }, 400);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
