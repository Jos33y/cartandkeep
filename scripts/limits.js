/*
 * What eBay says is left today, from eBay rather than from our own counting.
 *
 * The growth check form asks for real usage against the limit, and a number
 * somebody remembered is not evidence. This reads the Developer Analytics API,
 * which reports the limit, what is left and when it resets, per call family.
 *
 * Usage:
 *   node scripts/limits.js
 *   node scripts/limits.js --context=buy
 */

import { pathToFileURL } from 'node:url';
import { token, loadEnvFiles, pickCredentials } from './gate.js';

const ANALYTICS = 'https://api.ebay.com/developer/analytics/v1_beta/rate_limit/';

const pct = (used, limit) => (limit ? `${Math.round((used / limit) * 100)}%` : '');
const when = (iso) => (iso
  ? new Date(iso).toLocaleString('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })
  : '');

export function rows(body) {
  const out = [];
  for (const group of body?.rateLimits ?? []) {
    for (const resource of group.resources ?? []) {
      for (const rate of resource.rates ?? []) {
        const limit = Number(rate.limit ?? 0);
        const remaining = Number(rate.remaining ?? 0);
        out.push({
          api: group.apiName ?? group.apiContext ?? '?',
          resource: resource.name ?? '?',
          limit,
          used: limit - remaining,
          remaining,
          window: Number(rate.timeWindow ?? 0),
          reset: rate.reset ?? null,
        });
      }
    }
  }
  return out.sort((a, b) => b.used - a.used || b.limit - a.limit);
}

async function main() {
  const argv = process.argv.slice(2);
  const arg = (k, d = null) => argv.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=') ?? d;

  const loaded = await loadEnvFiles(arg('env-file'));
  const cred = pickCredentials(process.env, arg('id-key'), arg('secret-key'));
  if (!cred.clientId || !cred.clientSecret) {
    console.error(`\nNo eBay credentials found. Read: ${loaded.join(', ') || 'nothing'}\n`);
    process.exit(1);
  }

  const access = await token(cred);
  const url = new URL(ANALYTICS);
  if (arg('context')) url.searchParams.set('api_context', arg('context'));
  if (arg('name')) url.searchParams.set('api_name', arg('name'));

  const res = await fetch(url, { headers: { authorization: `Bearer ${access}`, accept: 'application/json' } });
  const body = await res.json();

  if (!res.ok) {
    // eBay's own words rather than a status code: the message names the scope
    // when the keyset is not entitled to the Analytics API.
    console.error(`\n  ${res.status} from eBay:`);
    console.error(`  ${JSON.stringify(body?.errors ?? body).slice(0, 400)}\n`);
    process.exit(1);
  }

  const all = rows(body);
  if (!all.length) {
    console.error('\n  Nothing came back. The keyset may not be entitled to the Analytics API.\n');
    process.exit(1);
  }

  console.log('');
  console.log('  used   limit  left    resets        call');
  for (const r of all) {
    if (!r.limit) continue;
    console.log(`  ${String(r.used).padStart(6)} ${String(r.limit).padStart(7)} ${String(r.remaining).padStart(6)}`
      + `  ${when(r.reset).padEnd(14)}${r.api} ${r.resource} ${pct(r.used, r.limit)}`);
  }

  // Browse is what the research spends, so it is named whether or not it is
  // the busiest. Sorting on usage picked a two million call quota nobody uses
  // on a morning when everything read zero.
  const daily = all.filter((r) => r.window >= 86400 && r.limit);
  const browse = daily.find((r) => r.resource === 'buy.browse') ?? daily[0];
  if (browse) {
    console.log('');
    console.log(`  ${browse.api} ${browse.resource}: ${browse.used} of ${browse.limit} used, `
      + `${browse.remaining} left, resets ${when(browse.reset)}.`);
    console.log(`  About ${Math.floor(browse.remaining / 7)} gated queries at a sample of six, `
      + `or ${browse.remaining} phrases scanned.\n`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(`\nlimits failed: ${e?.stack ?? e}\n`);
    process.exit(1);
  });
}
