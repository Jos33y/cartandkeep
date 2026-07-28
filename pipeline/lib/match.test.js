import assert from 'node:assert/strict';
import { tokenise, similarity, groupSignals, median } from './match.js';

// Same product, wildly different titles.
{
  const a = tokenise('Slow Feeder Dog Bowl Anti Gulp Pet Food Dish UK');
  const b = tokenise('Anti-Gulp Slow Feeder Bowl for Dogs');
  const s = similarity(a, b);
  assert.ok(s >= 0.6, `expected a match, got ${s.toFixed(2)}`);
  console.log('cross source match:', s.toFixed(2));
}

// Plurals must not split a product.
{
  assert.ok(similarity(tokenise('Silk Hair Scrunchies'), tokenise('Silk Hair Scrunchy')) >= 0.6);
  console.log('plural handled');
}

// Different products must stay apart.
{
  assert.equal(similarity(tokenise('Cat Window Hammock Suction Cups'), tokenise('Dog Car Seat Belt Harness')), 0);
  console.log('distinct products stay distinct');
}

// One shared word is a coincidence, not a match.
{
  assert.equal(similarity(tokenise('Dog Raincoat Waterproof'), tokenise('Dog Nail Grinder')), 0);
  console.log('single shared word rejected');
}

{
  const grouped = groupSignals([
    {
      sourceId: 'ebay_browse',
      weight: 1,
      signals: [
        { externalRef: 'EB1', title: 'Snuffle Mat for Dogs Foraging Slow Feed', kind: 'depth', value: 0.6, price: 16.49 },
        { externalRef: 'EB2', title: 'Cat Window Hammock with Suction Cups', kind: 'depth', value: 0.5, price: 14.99 },
      ],
    },
    {
      sourceId: 'cj_dropshipping',
      weight: 0.6,
      signals: [
        { externalRef: 'CJ9', title: 'Dog Snuffle Foraging Mat', kind: 'supply', value: 0.8, landedCost: 4.45 },
      ],
    },
  ]);

  assert.equal(grouped.length, 2, `expected 2 products, got ${grouped.length}`);
  const snuffle = grouped.find((g) => g.title.toLowerCase().includes('snuffle'));
  assert.equal(snuffle.signals.length, 2, 'both sources must attach to the snuffle mat');
  assert.equal(snuffle.prices[0], 16.49);
  assert.equal(snuffle.landedCosts[0], 4.45);
  assert.deepEqual(snuffle.externalRefs, { ebay_browse: 'EB1', cj_dropshipping: 'CJ9' });
  console.log('price from one source, cost from another, merged into one candidate');
}

{
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 2, 3]), 2.5);
  assert.equal(median([]), null);
  console.log('median ok');
}

console.log('\nall assertions passed');
