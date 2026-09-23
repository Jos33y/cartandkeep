/*
 * Credentials, read from .env files rather than asked for.
 *
 * Split out of gate.js when it passed nine hundred lines. Same functions, same
 * behaviour: the file it came from now imports them.
 */

import { readFile } from 'node:fs/promises';

// ------------------------------------------------------------------- env file

// Node does not read .env.local, and this script deliberately does not import
// the pipeline's db.js, so it loads the file itself. Anything already set in
// the real environment wins.
export function parseEnv(text) {
  const out = {};
  // Windows files arrive with CRLF and a trailing \r silently becomes part of
  // the value, which turns a valid key into a 401 nobody can explain.
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).replace(/^export\s+/, '').trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

export async function loadEnvFiles(explicit) {
  const files = explicit ? [explicit] : ['.env.local', '.env'];
  const loaded = [];
  for (const f of files) {
    try {
      const vars = parseEnv(await readFile(f, 'utf8'));
      for (const [k, v] of Object.entries(vars)) if (process.env[k] === undefined) process.env[k] = v;
      loaded.push(`${f} (${Object.keys(vars).length} keys)`);
    } catch { /* absent is normal */ }
  }
  return loaded;
}

// The credential names are per tenant in this project, so rather than assume
// one spelling, try the usual ones and then say what is actually there.
const ID_KEYS = ['EBAY_CLIENT_ID', 'EBAY_APP_ID', 'EBAY_APPID', 'EBAY_OAUTH_CLIENT_ID', 'VITE_EBAY_CLIENT_ID'];
const SECRET_KEYS = ['EBAY_CLIENT_SECRET', 'EBAY_CERT_ID', 'EBAY_SECRET', 'EBAY_OAUTH_CLIENT_SECRET', 'VITE_EBAY_CLIENT_SECRET'];

export function pickCredentials(env, idKey, secretKey) {
  const find = (names) => names.map((n) => [n, env[n]]).find(([, v]) => v)?.[0] ?? null;
  const id = idKey ?? find(ID_KEYS);
  const secret = secretKey ?? find(SECRET_KEYS);
  return { idKey: id, secretKey: secret, clientId: id ? env[id] : null, clientSecret: secret ? env[secret] : null };
}
