// eBay's digital signature, which it asks for on every Finances API call for a UK or EU seller (8 October 2026: "Missing
// x-ebay-signature-key header"). Each call carries the public key eBay issued (x-ebay-signature-key, a JWE), and a
// signature over the method, path, host and that key, made with the private key that goes with it (RFC 9421).
//
// The key pair is the studio's app's, not a seller's: one serves every shop. It is made here the first time it is
// needed, through eBay's Key Management API with the app's own token, and kept in ebay_signing_keys (0152), which no
// signed-in user or visitor can read. eBay never stores the private key; nothing else ever sees it. A key lasts three
// years; a new one is made a month before the old one runs out.

import { appToken } from './listing.ts';

type Json = Record<string, any>;
// deno-lint-ignore no-explicit-any
type Client = any;

export type Signer = (method: string, url: string) => Promise<Record<string, string>>;
export type SigningKey = { jwe: string; key: CryptoKey };

const KEYS = 'https://apiz.ebay.com/developer/key_management/v1/signing_key';
const MONTH = 30 * 86_400_000;

const b64 = (bytes: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

// eBay gives the private key as base64 PKCS#8, with or without the PEM lines around it.
export function importPrivate(text: string): Promise<CryptoKey> {
  const body = text.replace(/-----(BEGIN|END)[^-]+-----/g, '').replace(/\s+/g, '');
  return crypto.subtle.importKey('pkcs8', unb64(body), { name: 'Ed25519' }, false, ['sign']);
}

// The text signed, as RFC 9421 lays it out, for a call with no body: the key, the method, the path, the host.
export function signatureBase(method: string, url: string, jwe: string, created: number) {
  const u = new URL(url);
  const params = `("x-ebay-signature-key" "@method" "@path" "@authority");created=${created}`;
  return {
    params,
    base: [
      `"x-ebay-signature-key": ${jwe}`,
      `"@method": ${method.toUpperCase()}`,
      `"@path": ${u.pathname}`,
      `"@authority": ${u.host}`,
      `"@signature-params": ${params}`,
    ].join('\n'),
  };
}

export async function signedHeaders(k: SigningKey, method: string, url: string, now = Date.now()) {
  const created = Math.floor(now / 1000);
  const { params, base } = signatureBase(method, url, k.jwe, created);
  const sig = await crypto.subtle.sign({ name: 'Ed25519' }, k.key, new TextEncoder().encode(base));
  return {
    'x-ebay-signature-key': k.jwe,
    'Signature-Input': `sig1=${params}`,
    Signature: `sig1=:${b64(sig)}:`,
  };
}

let cached: SigningKey | null = null;

// The key pair in use, made if there is none fit to use. A race between two calls keeps whichever was saved first.
export async function signingKey(client: Client, f: typeof fetch = fetch): Promise<SigningKey> {
  if (cached) return cached;
  const fresh = async () => {
    const { data, error } = await client.from('ebay_signing_keys').select('private_key, jwe')
      .gt('expires_at', new Date(Date.now() + MONTH).toISOString())
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (error) throw new Error(`Signing key not readable: ${error.message}`);
    return data as Json | null;
  };

  let row = await fresh();
  if (!row) {
    const token = await appToken();
    const res = await f(KEYS, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ signingKeyCipher: 'ED25519' }),
    });
    const made = await res.json().catch(() => ({}));
    if (!res.ok || !made.privateKey || !made.jwe) {
      throw new Error(`eBay did not issue a signing key: ${made?.errors?.[0]?.message ?? res.status}`);
    }
    const { error } = await client.from('ebay_signing_keys').insert({
      key_id: made.signingKeyId,
      private_key: made.privateKey,
      jwe: made.jwe,
      expires_at: new Date(Number(made.expirationTime) * 1000).toISOString(),
    });
    if (error && !/duplicate/i.test(error.message)) throw new Error(`Signing key not saved: ${error.message}`);
    row = (await fresh()) ?? { private_key: made.privateKey, jwe: made.jwe };
  }
  cached = { jwe: row.jwe, key: await importPrivate(row.private_key) };
  return cached;
}

export const signerFor = (client: Client): Signer => async (method, url) => signedHeaders(await signingKey(client), method, url);
