/*
 * Prices one sku, against both endpoints and both body shapes. Testing freight
 * on a product that is not a match tells you nothing, so this uses CJ's own
 * documented sku by default.
 *
 * Usage:
 *   node scripts/cj-freight-test.js
 *   node scripts/cj-freight-test.js --sku=CJGY168034601AZ --dest=GB
 */

import { connect } from '../pipeline/lib/db.js';
import { token } from '../pipeline/sources/cjDropshipping.js';

const BASE = 'https://developers.cjdropshipping.com/api2.0/v1';
const arg = (n) => process.argv.slice(2).find((a) => a.startsWith(`--${n}=`))?.split('=')[1];

// From CJ's own documentation, so a failure here is our request, not the product.
const DOC_SKU = 'CJCF104237201AZ';

async function call(access, endpoint, body) {
  const res = await fetch(`${BASE}/logistic/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CJ-Access-Token': access },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  return {
    status: res.status,
    ok: Boolean(json.result || json.success),
    message: json.message,
    count: Array.isArray(json.data) ? json.data.length : 0,
    first: Array.isArray(json.data) ? json.data[0] : null,
  };
}

async function main() {
  const { db, E } = await connect();
  const sku = arg('sku') ?? DOC_SKU;
  const dest = arg('dest') ?? 'GB';
  const slug = E.VITE_TENANT_SLUG ?? 'cart-and-keep';

  const { data: tenant } = await db.from('tenants').select('id').eq('slug', slug).single();
  const { data: src } = await db
    .from('tenant_sources').select('credential_ref')
    .eq('tenant_id', tenant.id).eq('source_id', 'cj_dropshipping').single();

  const creds = JSON.parse(src?.credential_ref ?? '{}');
  const apiKey = E[creds.apiKey] ?? E.CJ_API_KEY;
  const access = await token(apiKey);

  const dto = {
    srcAreaCode: 'CN',
    destAreaCode: dest,
    length: 0.3,
    width: 0.4,
    height: 0.5,
    volume: 0.06,
    totalGoodsAmount: 12,
    productProp: ['COMMON'],
    freightTrialSkuList: [{ skuQuantity: 1, sku }],
    skuList: [sku],
    platforms: ['Shopify'],
  };

  const attempts = [
    ['freightCalculateTip', { reqDTOS: [dto] }],
    ['freightCalculate', { reqDTOS: [dto] }],
    // The error said products must be not null, so this endpoint takes a
    // different shape from the one the example documents.
    ['freightCalculate', { ...dto, products: [{ quantity: 1, vid: sku }] }],
    ['freightCalculate', { startCountryCode: 'CN', endCountryCode: dest, products: [{ quantity: 1, vid: sku }] }],
  ];

  console.log(`\nsku ${sku} to ${dest}\n`);

  for (const [endpoint, body] of attempts) {
    try {
      const r = await call(access, endpoint, body);
      const shape = Object.keys(body).join(',');
      console.log(`  ${endpoint.padEnd(20)} ${shape.padEnd(34)} ${r.status}  ${r.ok ? 'ok' : 'no'}  ${r.count} options  ${r.message ?? ''}`);
      if (r.first) console.log(`      ${JSON.stringify(r.first).slice(0, 200)}`);
    } catch (e) {
      console.log(`  ${endpoint} threw ${e.message}`);
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  console.log();
}

main();
