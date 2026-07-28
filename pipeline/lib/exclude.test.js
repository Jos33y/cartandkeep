import assert from 'node:assert/strict';
import { isExcluded } from './scoring.js';

const research = {
  exclude: {
    terms: [
      'serum', 'cream', 'mascara', 'eyeliner', 'collagen', 'patches', 'patch',
      'vitamin c', 'retinol', 'shampoo', 'nail polish',
      'pet food', 'dog food', 'cat food', 'treats', 'supplement', 'flea',
    ],
    allow: [
      'treat puzzle', 'treat dispenser', 'treat ball', 'treat mat',
      'treat pouch', 'treat bag', 'treat toy', 'snuffle',
    ],
  },
};

const cases = [
  // Cosmetics, must be excluded
  ['Vitamin C Brightening Face Serum 30ml', true],
  ['Collagen Under Eye Gel Patches, 30 Pairs', true],
  ['Magnetic Eyelashes with Eyeliner Kit', true],
  ['Retinol Night Cream 50ml', true],
  ['Waterproof Mascara Black', true],
  ['Argan Oil Shampoo 250ml', true],

  // Beauty tools and accessories, must pass
  ['Jade Roller and Gua Sha Facial Set', false],
  ['Heatless Curling Rod Headband Kit', false],
  ['LED Makeup Mirror with Touch Dimmer', false],
  ['Silk Hair Scrunchies, 12 Pack', false],
  ['Makeup Brush Cleaning Mat and Soap', false],
  ['Stainless Steel Facial Ice Roller', false],
  ['Electric Nail Drill and File Set', false],

  // Pet food and health, must be excluded
  ['Grain Free Dog Food 12kg', true],
  ['Joint Supplement for Dogs', true],
  ['Flea and Tick Spot On Treatment', true],

  // Pet accessories, must pass, including the ambiguous ones
  ['Interactive Dog Treat Puzzle Toy', false],
  ['Slow Treat Dispenser Ball for Dogs', false],
  ['Snuffle Mat for Dogs Foraging', false],
  ['Slow Feeder Dog Bowl, Anti Gulp', false],
  ['Cat Window Hammock with Suction Cups', false],
  ['Waterproof Dog Raincoat with Hood', false],
];

let failed = 0;
for (const [title, expect] of cases) {
  const got = isExcluded(title, research);
  if (got !== expect) {
    failed += 1;
    console.log(`FAIL  expected ${expect}, got ${got}  ${title}`);
  }
}

assert.equal(failed, 0, `${failed} title(s) classified wrongly`);
console.log(`${cases.length} titles classified correctly`);
