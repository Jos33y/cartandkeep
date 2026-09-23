/*
 * Submits one sourcing request and prints the raw response. Matching against a
 * catalogue found one real product in twenty five. Asking CJ to source a named
 * product with its image and the listing it sells on is the other direction,
 * and it is the one that scales past a few hundred products.
 *
 * One request, several body shapes, because the docs are thin on this endpoint.
 *
 * Usage:
 *   node scripts/cj-sourcing-test.js --find="2 in1 Feeder"
 */

import { connect } from '../pipeline/lib/db.js';
import { token } from '../pipeline/sources/cjDropshipping.js';

const BASE = 'https://developers.cjdropshipping.com/api2.0/v1';
const arg = (n) => process.argv.slice(2).find((a) => a.startsWith(`--${n}=`))?.split('=')[1];

async function post(access, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CJ-Access-Token': access },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, ok: Boolean(json?.result || json?.success), json };
}

async function main() {
  const { db, E } = await connect();
  const find = arg('find');
  if (!find) {
    console.error('Need --find="part of a candidate title".');
    process.exit(1);
  }

  const slug = E.VITE_TENANT_SLUG ?? 'cart-and-keep';
  const { data: tenant } = await db.from('tenants').select('id').eq('slug', slug).single();

  const { data: hits } = await db
    .from('candidates')
    .select('id, title, image_url, reference_url, margin, headroom')
    .eq('tenant_id', tenant.id)
    .ilike('title', `%${find}%`);

  if (!hits?.length) {
    console.error(`Nothing matches "${find}".`);
    process.exit(1);
  }
  if (hits.length > 1) {
    console.error(`Matches ${hits.length}. Narrow it:`);
    for (const h of hits) console.error(`  ${h.title}`);
    process.exit(1);
  }

  const c = hits[0];
  if (!c.image_url) {
    console.error('That candidate has no image. Run enrich-candidates first.');
    process.exit(1);
  }

  const { data: src } = await db
    .from('tenant_sources').select('credential_ref')
    .eq('tenant_id', tenant.id).eq('source_id', 'cj_dropshipping').single();

  const creds = JSON.parse(src?.credential_ref ?? '{}');
  const access = await token(E[creds.apiKey] ?? E.CJ_API_KEY);

  const price = Number(c.margin?.sale_price) || null;

  console.log(`\n${c.title}`);
  console.log(`  image     ${c.image_url}`);
  console.log(`  reference ${c.reference_url}`);
  console.log(`  sells at  £${price ?? '?'}\n`);

  const attempts = [
    ['/product/sourcing/create', {
      thirdProductId: c.id,
      thirdProductName: c.title,
      thirdProductSku: c.id,
      thirdProductImage: c.image_url,
      thirdProductUrl: c.reference_url,
      thirdProductPrice: price,
      remark: 'UK marketplace, quoting for regular volume',
    }],
    ['/product/sourcing/create', {
      productName: c.title,
      productImage: c.image_url,
      productUrl: c.reference_url,
      expectPrice: price,
      remark: 'UK marketplace',
    }],
    ['/product/sourcing/create', {
      sourcingList: [{
        thirdProductName: c.title,
        thirdProductImage: c.image_url,
        thirdProductUrl: c.reference_url,
      }],
    }],
  ];

  for (const [path, body] of attempts) {
    const r = await post(access, path, body);
    console.log(`  ${Object.keys(body).join(',').slice(0, 60).padEnd(62)} ${r.status}  ${r.ok ? 'ok' : 'no'}  ${r.json?.message ?? ''}`);
    if (r.ok) {
      console.log(`      ${JSON.stringify(r.json?.data ?? {}).slice(0, 240)}`);
      break;
    }
    await new Promise((x) => setTimeout(x, 1500));
  }

  console.log('\nA sourcing request is a question, not a quote. CJ answer inside 48 hours.\n');
}

main();
