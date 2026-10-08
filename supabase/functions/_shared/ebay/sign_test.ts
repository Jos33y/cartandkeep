// eBay's digital signature (0152). Run with
//   deno test supabase/functions/_shared/ebay/sign_test.ts

function assertEquals(a: unknown, b: unknown) {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
import { importPrivate, signatureBase, signedHeaders, signingKey } from './sign.ts';

const b64 = (bytes: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(bytes)));

async function pair() {
  const k = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']) as CryptoKeyPair;
  return { pub: k.publicKey, pkcs8: b64(await crypto.subtle.exportKey('pkcs8', k.privateKey)) };
}

Deno.test('the signature base is RFC 9421 over the key, method, path and host, query left out', () => {
  const { base, params } = signatureBase('get', 'https://apiz.ebay.com/sell/finances/v1/transaction?filter=x&limit=1', 'JWE', 1658440308);
  assertEquals(params, '("x-ebay-signature-key" "@method" "@path" "@authority");created=1658440308');
  assertEquals(base, [
    '"x-ebay-signature-key": JWE',
    '"@method": GET',
    '"@path": /sell/finances/v1/transaction',
    '"@authority": apiz.ebay.com',
    '"@signature-params": ("x-ebay-signature-key" "@method" "@path" "@authority");created=1658440308',
  ].join('\n'));
});

Deno.test('headers carry a signature the public key verifies; PEM or bare base64 both import', async () => {
  const { pub, pkcs8 } = await pair();
  for (const text of [pkcs8, `-----BEGIN PRIVATE KEY-----\n${pkcs8}\n-----END PRIVATE KEY-----`]) {
    const key = await importPrivate(text);
    const h = await signedHeaders({ jwe: 'JWE', key }, 'GET', 'https://apiz.ebay.com/sell/finances/v1/transaction?x=1', 1658440308000);
    assertEquals(h['x-ebay-signature-key'], 'JWE');
    assertEquals(h['Signature-Input'], 'sig1=("x-ebay-signature-key" "@method" "@path" "@authority");created=1658440308');
    const sig = Uint8Array.from(atob(h.Signature.slice(6, -1)), (c) => c.charCodeAt(0));
    const { base } = signatureBase('GET', 'https://apiz.ebay.com/sell/finances/v1/transaction', 'JWE', 1658440308);
    assertEquals(await crypto.subtle.verify({ name: 'Ed25519' }, pub, sig, new TextEncoder().encode(base)), true);
  }
});

Deno.test('a key is made once, saved, and read back after', async () => {
  const { pkcs8 } = await pair();
  const saved: Record<string, unknown>[] = [];
  const client = {
    from: () => ({
      select: () => ({ gt: () => ({ order: () => ({ limit: () => ({ maybeSingle: async () => ({ data: saved[0] ?? null, error: null }) }) }) }) }),
      insert: async (row: Record<string, unknown>) => { saved.push(row); return { error: null }; },
    }),
  };
  const calls: string[] = [];
  const f = (async (url: string) => {
    calls.push(String(url));
    if (String(url).includes('oauth2/token')) return new Response(JSON.stringify({ access_token: 'app' }));
    return new Response(JSON.stringify({ signingKeyId: 'k1', privateKey: pkcs8, jwe: 'JWE1', expirationTime: Math.floor(Date.now() / 1000) + 3 * 365 * 86400 }));
  }) as typeof fetch;
  Deno.env.set('EBAY_CLIENT_ID', 'id');
  Deno.env.set('EBAY_CLIENT_SECRET', 'secret');
  const real = globalThis.fetch;
  globalThis.fetch = f;
  try {
    const k = await signingKey(client, f);
    assertEquals(k.jwe, 'JWE1');
    assertEquals(saved.length, 1);
    assertEquals(saved[0].key_id, 'k1');
    assertEquals(calls.filter((u) => u.includes('signing_key')).length, 1);
    assertEquals((await signingKey(client, f)).jwe, 'JWE1');
    assertEquals(calls.filter((u) => u.includes('signing_key')).length, 1);
  } finally {
    globalThis.fetch = real;
  }
});
