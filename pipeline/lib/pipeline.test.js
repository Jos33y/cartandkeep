import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { parse, dedupe, toSignals } from '../sources/zikExport.js';
import { computeMargin, shippingBand } from './margin.js';
import { velocityTrend, sellThrough, sellerConcentration, priceStability } from './metrics.js';
import { detectBrand } from './brand.js';
import { evaluateGates } from './gates.js';
import { rankScore } from './rank.js';
import { isExcluded } from './scoring.js';

// Any Zik drop in the project. The end to end section skips if there is none,
// so a fresh clone still runs the whole suite.
function findFixture() {
  for (const dir of ['drops', 'drops/raw']) {
    if (!existsSync(dir)) continue;
    const hit = readdirSync(dir)
      .filter((f) => /^zik.*\.(txt|csv|tsv)$/i.test(f))
      .sort()
      .pop();
    if (hit) return `${dir}/${hit}`;
  }
  return null;
}

const fees = {
  ebay: { pct: 0.128, fixed: 0.30 },
  payment: { pct: 0.029, fixed: 0.30 },
  store: { pct: 0.015, fixed: 0.20 },
};

const costs = {
  ads_pct: 0.06,
  goods_pct_estimate: 0.30,
  shipping: {
    bands: { large_letter: 1.55, small_parcel: 3.29, medium_parcel: 5.50 },
    default_band: 'small_parcel',
    packaging: 0.30,
  },
  returns: { default: 0.05, by_category: { Beauty: 0.06, Pet: 0.035 } },
};

// --- margin -----------------------------------------------------------------
{
  const m = computeMargin({ salePrice: 20, landedCost: 6, channel: 'ebay', band: 'large_letter', fees, costs });
  const lines = m.platform_fee + m.ads + m.postage + m.packaging + m.returns_provision + m.landed_cost;
  assert.equal(Math.round((m.sale_price - lines) * 100) / 100, m.net, 'lines must sum to net');
  assert.ok(m.ads > 0, 'promoted listings must be charged');
  assert.ok(m.returns_provision > 0, 'returns must be provisioned');
  assert.equal(m.cost_source, 'actual');
  console.log(`£20 large letter: net £${m.net} (${(m.net_pct*100).toFixed(0)}%)`);
}
{
  // Same product, one band up. This is the difference people forget.
  const ll = computeMargin({ salePrice: 14, landedCost: 4, channel: 'ebay', band: 'large_letter', fees, costs });
  const sp = computeMargin({ salePrice: 14, landedCost: 4, channel: 'ebay', band: 'small_parcel', fees, costs });
  assert.ok(ll.net - sp.net > 1.5, 'band should be worth more than £1.50');
  console.log(`shipping band on a £14 item: £${ll.net} vs £${sp.net}`);
}
{
  const est = computeMargin({ salePrice: 20, landedCost: null, channel: 'ebay', fees, costs });
  assert.equal(est.cost_source, 'estimated', 'an assumed cost must say so');
  assert.equal(computeMargin({ salePrice: 20, landedCost: null, channel: 'ebay', fees, costs: {} }), null,
    'no cost and no estimate configured means no candidate');
  console.log('estimated cost is labelled, not silent');
}
{
  assert.equal(shippingBand([300, 200, 20], 400), 'large_letter');
  assert.equal(shippingBand([300, 200, 30], 400), 'small_parcel', '5mm thicker changes the band');
  assert.equal(shippingBand([300, 200, 20], 900), 'small_parcel', 'over 750g changes the band');
  console.log('shipping bands classified');
}

// --- metrics ----------------------------------------------------------------
{
  assert.equal(velocityTrend({ sold7: 0, sold30: 382 }), 0);
  assert.equal(velocityTrend({ sold7: 10, sold30: 43 }), 1);
  assert.equal(velocityTrend({ sold7: 20, sold30: 43 }), 1.99);
  assert.equal(velocityTrend({ sold7: 5, sold30: 0 }), null);
  assert.equal(sellThrough({ sold: 100, activeListings: 25 }), 4);
  assert.equal(sellerConcentration([50, 30, 15, 3, 2]), 0.95);
  assert.equal(priceStability([10, 12, 14, 16, 18, 20]), 0.38);
  console.log('metrics computed');
}

// --- brand ------------------------------------------------------------------
{
  const cfg = { known: ['ICONSIGN', 'La Roche-Posay', 'Naipo', 'Chipsi'], allow: [] };
  assert.ok(detectBrand('ICONSIGN Lash Lift Kit Eyelash Perming', cfg), 'known brand caught');
  assert.ok(detectBrand('La Roche-Posay Anthelios SPF50', cfg), 'known brand caught');
  assert.ok(detectBrand('Collagen Powder by Wellgard', cfg), 'attributed brand caught');
  assert.ok(detectBrand('Gua Sha Set®', cfg), 'trademark symbol caught');
  assert.equal(detectBrand('Slow Feeder Dog Bowl Anti Gulp Pet Food Dish', cfg), null, 'generic passes');
  assert.equal(detectBrand('Gel Cooling Mat for Dog Cat Pet Self Cooling', cfg), null, 'generic passes');
  console.log('brand screen behaves');
}

// --- gates ------------------------------------------------------------------
{
  const strong = {
    sell_through: 1.5, trend: 1.4, sold30: 60, signal_count: 2,
    margin: { net: 6.2, net_pct: 0.31, band: 'large_letter' },
  };
  assert.equal(evaluateGates(strong, {}).ok, true);

  const dying = { ...strong, trend: 0.2 };
  const r = evaluateGates(dying, {});
  assert.equal(r.ok, false);
  assert.ok(r.failed.some((f) => f.gate === 'trend'), 'a dying product must fail');

  // Missing metrics skip rather than fail, or a partial pipeline delivers nothing.
  const thin = { sold30: 60, signal_count: 1, margin: { net: 6.2, net_pct: 0.31 } };
  const t = evaluateGates(thin, { min_sources: 1 });
  assert.equal(t.ok, true, 'absent metrics must not reject');
  assert.ok(t.skipped.includes('sell_through'), 'missing sell-through is skipped');
  console.log(`gates: ${t.passed.length} applied, ${t.skipped.length} skipped on partial data`);
}

// --- ranking ----------------------------------------------------------------
{
  const full = rankScore({ sell_through: 1.6, trend: 1.5, active_listings: 80,
    seller_concentration: 0.3, stock: 400, lead_time_days: 5,
    margin: { net_pct: 0.32, band: 'large_letter' } });
  const partial = rankScore({ trend: 1.5, margin: { net_pct: 0.32, band: 'large_letter' } });
  assert.ok(full.score > 0 && full.score <= 100);
  assert.ok(partial.score > 0, 'partial data still scores');
  assert.ok(full.component_count > partial.component_count);
  console.log(`rank: full ${full.score} from ${full.component_count} components, partial ${partial.score} from ${partial.component_count}`);
}

// --- end to end on the real Zik file ---------------------------------------
const FIXTURE = findFixture();
if (!FIXTURE) {
  console.log('\n  no Zik drop found, skipping the end to end section');
} else {
  const rows = dedupe(parse(readFileSync(FIXTURE, 'utf8')));
  assert.ok(rows.length > 0, 'fixture parsed nothing');
  console.log(`\n  fixture: ${FIXTURE}`);

  const research = {
    exclude: {
      terms: ['serum','cream','lotion','shampoo','lipstick','mascara','polish','perfume',
              'collagen','creatine','protein','supplement','vitamin','powder','tablets',
              'capsules','gummies','cbd','piriton','food','treats'],
      allow: ['treat puzzle','treat ball','snuffle'],
    },
  };
  const brandCfg = { known: ['ICONSIGN','La Roche-Posay','Naipo','Chipsi','Maltbys','Wellgard','Warrior'], allow: [] };

  let excluded = 0, branded = 0;
  const candidates = [];

  for (const s of toSignals(rows)) {
    if (isExcluded(s.title, research)) { excluded += 1; continue; }
    const brand = detectBrand(s.title, brandCfg);
    if (brand) { branded += 1; continue; }

    const margin = computeMargin({ salePrice: s.price, landedCost: null, channel: 'ebay', fees, costs });
    if (!margin) continue;

    candidates.push({
      title: s.title,
      sold30: s.demand.sold30,
      sold7: s.demand.sold7,
      trend: s.demand.trend,
      signal_count: 1,
      margin,
    });
  }

  const surviving = candidates.filter((c) => evaluateGates(c, { min_sources: 1 }).ok);
  const dyingRejected = candidates.filter((c) => evaluateGates(c, { min_sources: 1 })
    .failed.some((f) => f.gate === 'trend'));

  console.log(`  ${rows.length} unique listings`);
  console.log(`    ${excluded} excluded by category, ${branded} flagged as branded`);
  console.log(`    ${surviving.length} pass gates, ${dyingRejected.length} rejected for declining demand`);

  // The cooling mat is the case that proves the trend gate.
  const mat = candidates.find((c) => c.title.includes('Cooling Mat'));
  if (mat) {
    const g = evaluateGates(mat, { min_sources: 1 });
    assert.equal(g.ok, false, 'the cooling mat must not pass');
    assert.ok(g.failed.some((f) => f.gate === 'trend'));
    console.log(`    cooling mat, 382 sold in 30d, correctly rejected: ${g.failed.find(f=>f.gate==='trend').why}`);
  }

  assert.ok(surviving.length > 0, 'something must survive or the gates are wrong');
  assert.ok(surviving.length < candidates.length, 'everything surviving means the gates do nothing');

  const ranked = surviving
    .map((c) => ({ ...c, ...rankScore(c) }))
    .sort((a, b) => b.score - a.score);

  console.log('\n  top 8 by rank:');
  for (const c of ranked.slice(0, 8)) {
    console.log(`    ${String(c.score).padStart(3)}  ${String(c.sold30).padStart(3)} sold  trend ${c.trend.toFixed(2)}  £${c.margin.sale_price.toFixed(2)}  net £${c.margin.net.toFixed(2)}  ${c.title.slice(0, 44)}`);
  }
}

console.log('\nall assertions passed');
