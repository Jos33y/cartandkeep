import { connect } from './lib/db.js';
import { computeMargin, computeConfidence, classify, passesFilter } from './lib/scoring.js';

const PRODUCTS = [
  ['Jade Roller and Gua Sha Facial Set', 'Beauty', 12.99, 2.4],
  ['Heatless Curling Rod Headband Kit', 'Beauty', 9.99, 1.85],
  ['LED Makeup Mirror with Touch Dimmer', 'Beauty', 24.99, 7.2],
  ['Silk Hair Scrunchies, 12 Pack', 'Beauty', 8.49, 1.1],
  ['Makeup Brush Cleaning Mat and Soap', 'Beauty', 7.99, 1.45],
  ['Reusable Bamboo Makeup Remover Pads', 'Beauty', 9.49, 1.7],
  ['Matte Hair Claw Clips, 6 Pack', 'Beauty', 10.99, 1.95],
  ['Stainless Steel Facial Ice Roller', 'Beauty', 11.99, 2.65],
  ['Scalp Massager and Shampoo Brush', 'Beauty', 6.99, 1.2],
  ['Silicone Facial Cleansing Brush', 'Beauty', 12.49, 2.8],
  ['Electric Nail Drill and File Set', 'Beauty', 26.99, 8.4],
  ['Eyelash Curler with Silicone Pads', 'Beauty', 6.99, 0.95],
  ['Bamboo Makeup Organiser with Drawers', 'Beauty', 17.99, 4.8],
  ['Detangling Hair Brush, Wet and Dry', 'Beauty', 8.99, 1.4],
  ['Eyebrow Stamp and Stencil Kit', 'Beauty', 11.49, 2.2],
  ['Slow Feeder Dog Bowl, Anti Gulp', 'Pet', 11.99, 2.3],
  ['Cat Window Hammock with Suction Cups', 'Pet', 14.99, 3.4],
  ['Dog Car Seat Belt Harness Clip', 'Pet', 8.99, 1.35],
  ['Reusable Pet Hair Remover Roller', 'Pet', 12.49, 2.55],
  ['Interactive Dog Treat Puzzle Toy', 'Pet', 15.99, 4.1],
  ['Waterproof Dog Raincoat with Hood', 'Pet', 18.99, 5.3],
  ['Snuffle Mat for Dogs, Foraging', 'Pet', 16.49, 4.45],
  ['Automatic Pet Water Fountain 2L', 'Pet', 27.99, 9.1],
  ['Electric Pet Nail Grinder, Quiet', 'Pet', 19.99, 5.85],
  ['Calming Donut Bed for Cats and Dogs', 'Pet', 22.99, 7.4],
  ['Silicone Dog Paw Cleaner Cup', 'Pet', 10.99, 1.9],
  ['Pet Grooming Glove, Deshedding', 'Pet', 8.49, 1.25],
  ['Cat Scratching Post with Sisal Rope', 'Pet', 21.99, 6.9],
  ['Collapsible Travel Pet Bowl, 2 Pack', 'Pet', 7.49, 1.05],
  ['Cat Tunnel with Crinkle Lining', 'Pet', 13.49, 3.25],
];

// Deterministic, so a reseed produces the same batch and diffs stay readable.
function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const SOURCE_KINDS = {
  ebay_browse: ['depth', 'pricing'],
  zik_export: ['velocity'],
  terapeak_export: ['velocity'],
  aliexpress: ['demand', 'supply'],
  cj_dropshipping: ['supply'],
  google_trends: ['demand', 'seasonality'],
};

function buildSignals(rand, index) {
  // Vary how many sources saw each product. Real batches are uneven and the
  // interface has to look right when a candidate is thin.
  const pool = Object.keys(SOURCE_KINDS);
  const count = 2 + Math.floor(rand() * 4);
  const chosen = pool.slice().sort(() => rand() - 0.5).slice(0, count);

  const signals = [];
  for (const sourceId of chosen) {
    for (const kind of SOURCE_KINDS[sourceId]) {
      if (rand() < 0.35) continue;
      signals.push({
        sourceId,
        source_id: sourceId,
        kind,
        signal: kind,
        value: Math.round((0.35 + rand() * 0.62) * 100) / 100,
        weight: 1,
      });
    }
  }

  if (!signals.length) {
    signals.push({ sourceId: 'ebay_browse', source_id: 'ebay_browse', kind: 'depth', signal: 'depth', value: 0.5, weight: 1 });
  }
  return signals;
}

function tint(category) {
  const fill = category === 'Beauty' ? '%23eef2ec' : '%23faeee9';
  const ink = category === 'Beauty' ? '%237a9575' : '%23c4674a';
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Crect width='200' height='200' fill='${fill}'/%3E%3Ccircle cx='100' cy='100' r='42' fill='none' stroke='${ink}' stroke-width='6'/%3E%3C/svg%3E`;
}

function nextMonday(from = new Date()) {
  const d = new Date(from);
  const shift = (8 - d.getDay()) % 7 || 7;
  d.setDate(d.getDate() + shift);
  return d.toISOString().slice(0, 10);
}

async function main() {
  const { db, E } = await connect();
  const SLUG = E.VITE_TENANT_SLUG || 'cart-and-keep';
  const args = process.argv.slice(2);
  const clear = args.includes('--clear');
  const dateArg = args.find((a) => a.startsWith('--date='))?.split('=')[1];
  const deliveredFor = dateArg || nextMonday();

  const { data: tenant, error: tErr } = await db
    .from('tenants')
    .select('id, slug, fees, scoring')
    .eq('slug', SLUG)
    .single();

  if (tErr || !tenant) {
    console.error(`Tenant "${SLUG}" not found. Has 0001_platform.sql run?`);
    process.exit(1);
  }

  if (clear) {
    await db.from('batches').delete().eq('tenant_id', tenant.id);
    console.log('Cleared existing batches. Candidates and decisions cascade.');
  }

  const { data: batch, error: bErr } = await db
    .from('batches')
    .upsert(
      {
        tenant_id: tenant.id,
        delivered_for: deliveredFor,
        status: 'delivered',
        delivered_at: new Date().toISOString(),
        sources_used: Object.keys(SOURCE_KINDS),
        candidate_count: 0,
      },
      { onConflict: 'tenant_id,delivered_for' },
    )
    .select()
    .single();

  if (bErr) {
    console.error('Batch insert failed:', bErr.message);
    process.exit(1);
  }

  await db.from('candidates').delete().eq('batch_id', batch.id);

  const rand = rng(20260810);
  const rows = [];
  let filtered = 0;

  PRODUCTS.forEach(([title, category, salePrice, landedCost], i) => {
    const signals = buildSignals(rand, i);
    const channel = salePrice > 20 ? 'store' : 'ebay';
    const margin = computeMargin({ salePrice, landedCost, channel, fees: tenant.fees });
    const { confidence, signalCount } = computeConfidence({
      signals,
      weights: tenant.scoring?.weights,
    });

    if (!passesFilter({ margin, signalCount, scoring: tenant.scoring })) {
      filtered += 1;
      return;
    }

    rows.push({
      tenant_id: tenant.id,
      batch_id: batch.id,
      external_ref: `SEED-${String(i + 1).padStart(3, '0')}`,
      title,
      category,
      image_url: tint(category),
      supplier_url: null,
      classification: classify({ signals }),
      confidence,
      signal_count: signalCount,
      signals: signals.map(({ source_id, signal, value, weight }) => ({
        source_id,
        signal,
        value,
        weight,
      })),
      margin,
      recommended_channels: channel === 'store' ? ['store', 'ebay'] : ['ebay', 'tiktok'],
      recommended_volume: 5 + Math.floor(rand() * 20),
      analyst_note:
        confidence >= 75
          ? 'Strong multi source agreement. Worth listing early in the week.'
          : null,
    });
  });

  const { error: cErr } = await db.from('candidates').insert(rows);
  if (cErr) {
    console.error('Candidate insert failed:', cErr.message);
    process.exit(1);
  }

  await db.from('batches').update({ candidate_count: rows.length }).eq('id', batch.id);

  const avg = Math.round(rows.reduce((a, r) => a + r.confidence, 0) / rows.length);
  const net = rows.reduce((a, r) => a + r.margin.net, 0);

  console.log(`\nBatch ${deliveredFor}`);
  console.log(`  ${rows.length} candidates inserted, ${filtered} filtered out`);
  console.log(`  average confidence ${avg}`);
  console.log(`  combined net if all sold once: £${net.toFixed(2)}`);
  console.log(`  evergreen ${rows.filter((r) => r.classification === 'evergreen').length}`);
  console.log(`  trend ${rows.filter((r) => r.classification === 'trend_spike').length}`);
  console.log(`  unknown ${rows.filter((r) => r.classification === 'unknown').length}\n`);
}

main();
