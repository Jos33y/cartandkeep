import assert from 'node:assert/strict';
import { toGbp, saturationSignal, supplySignal, normaliseProduct } from './cjDropshipping.js';

// A real listV2 product, trimmed to the fields the adapter reads.
const product = {
  id: '04A22450-67F0-4617-A132-E7AE7F8963B0',
  nameEn: 'Slow Feeder Dog Bowl Anti Gulp',
  sku: 'CJNSSYWY01847',
  bigImage: 'https://cf.cjdropshipping.com/x.jpg',
  sellPrice: '11.85',
  listedNum: 100,
  threeCategoryName: 'Dog Bowls & Feeders',
  addMarkStatus: 1,
  warehouseInventoryNum: 500,
  deliveryCycle: '3-5',
  hasCECertification: 0,
};

const RATE = 0.79;

{
  assert.equal(toGbp('11.85', RATE), 9.36);
  assert.equal(toGbp('11.85', undefined), null, 'no rate, no number');

  // A zero landed cost is maximum apparent margin and would sort first.
  for (const bad of [null, undefined, '', 'n/a', 0, '0', -3, NaN]) {
    assert.equal(toGbp(bad, RATE), null, `${JSON.stringify(bad)} must not become a price`);
  }
  assert.equal(normaliseProduct({ ...product, sellPrice: null, nowPrice: null }, { rate: RATE, shippingEstimate: 0 }), null,
    'a product with no usable price is dropped, not costed at zero');
  console.log('USD 11.85 at 0.79 becomes GBP 9.36, junk prices rejected');
}

// The whole point: a USD figure must never reach the margin maths unconverted.
{
  const [supply] = normaliseProduct(product, { rate: RATE, shippingEstimate: 0, marketplaceCountry: 'GB' });
  assert.notEqual(supply.landedCost, 11.85, 'landed cost must not be the raw USD figure');
  assert.equal(supply.landedCost, 9.36);
  assert.equal(supply.raw.sellPriceUsd, '11.85');
  assert.equal(supply.raw.fxRate, RATE);
  console.log('landed cost converted, USD original kept in raw for audit');
}

// Paid shipping adds the configured estimate, free shipping does not.
{
  const [free] = normaliseProduct(product, { rate: RATE, shippingEstimate: 2.5, marketplaceCountry: 'GB' });
  assert.equal(free.landedCost, 9.36, 'free shipping adds nothing');

  const paid = normaliseProduct({ ...product, addMarkStatus: 0 }, { rate: RATE, shippingEstimate: 2.5, marketplaceCountry: 'GB' });
  assert.equal(paid[0].landedCost, 11.86);
  assert.equal(paid[0].raw.shippingEstimate, 2.5);
  console.log('shipping estimate applied only when not free');
}

// Saturation inverts: more sellers is a worse signal.
{
  assert.ok(saturationSignal(0) > saturationSignal(500));
  assert.ok(saturationSignal(500) > saturationSignal(2000));
  assert.equal(saturationSignal(2000), 0);
  assert.equal(saturationSignal(5000), 0, 'clamps rather than going negative');
  console.log('saturation inverts and clamps');
}

// Supply rewards stock and fast dispatch.
{
  const good = supplySignal({ inventory: 1000, deliveryCycle: '1-2' });
  const slow = supplySignal({ inventory: 1000, deliveryCycle: '10-14' });
  const empty = supplySignal({ inventory: 0, deliveryCycle: '1-2' });
  assert.ok(good > slow, 'fast dispatch beats slow');
  assert.ok(good > empty, 'stock beats none');
  assert.ok(supplySignal({ inventory: 5, deliveryCycle: null }) >= 0);
  console.log(`supply: fast ${good}, slow ${slow}, no stock ${empty}`);
}

// Two signals per product, sharing one identity so grouping merges them.
{
  const pair = normaliseProduct(product, { rate: RATE, shippingEstimate: 0, marketplaceCountry: 'GB' });
  assert.equal(pair.length, 2);
  assert.deepEqual(pair.map((s) => s.kind).sort(), ['depth', 'supply']);
  assert.equal(pair[0].externalRef, pair[1].externalRef);
  assert.equal(pair[0].title, pair[1].title);
  console.log('emits supply and depth under one identity');
}

console.log('\nall assertions passed');

// CJ returns 429 for two unrelated conditions. Treating the transient one as
// fatal wastes a run; treating the fatal one as transient wastes 25 retries.
{
  const { classify429 } = await import('./cjDropshipping.js');

  assert.equal(
    classify429({ message: 'Too Many Requests, QPS limit is 1 time/1second' }, { remaining: 49618 }),
    'rate',
    'QPS message is a rate limit, not points',
  );
  assert.equal(
    classify429({ message: 'Insufficient API points. Used today: 50000, Remaining: 0, Required: 50' }, { remaining: 0 }),
    'points',
  );
  assert.equal(classify429({ message: 'something else' }, { remaining: 0 }), 'points', 'zero remaining is points');
  assert.equal(classify429({ message: '' }, { remaining: 40000 }), 'rate', 'unknown with points left retries');
  console.log('429 causes told apart');
}
