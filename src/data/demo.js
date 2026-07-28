// Fixtures for demo mode. Products, prices and sold counts are representative
// of the two agreed categories, not real listings.
//
// Margins are computed here with the same arithmetic as pipeline/lib/margin.js
// rather than typed, so the expanded ledger always adds up. A demo that does not
// reconcile teaches the reader to distrust the real one.

const FEES = { ebay: { pct: 0.128, fixed: 0.3 }, store: { pct: 0.019, fixed: 0.2 } };
const COSTS = {
  ads_pct: 0.06,
  goods_pct_estimate: 0.3,
  shipping: { bands: { large_letter: 1.55, small_parcel: 3.29, medium_parcel: 5.6 }, packaging: 0.35 },
  returns: { default: 0.05, by_category: { beauty: 0.06, pet: 0.035 } },
};

const round = (n) => Math.round(n * 100) / 100;

function returnsRate(category) {
  const hit = Object.entries(COSTS.returns.by_category).find(([k]) =>
    (category ?? '').toLowerCase().includes(k),
  );
  return hit ? hit[1] : COSTS.returns.default;
}

function margin({ salePrice, landedCost, channel = 'ebay', band = 'small_parcel', category, estimated = false }) {
  const schedule = FEES[channel];
  const cost = landedCost ?? round(salePrice * COSTS.goods_pct_estimate);
  const platformFee = round(salePrice * schedule.pct + schedule.fixed);
  const paymentFee = channel === 'store' ? round(salePrice * 0.014 + 0.2) : 0;
  const ads = round(salePrice * COSTS.ads_pct);
  const postage = COSTS.shipping.bands[band];
  const packaging = COSTS.shipping.packaging;
  const returnsProvision = round(salePrice * returnsRate(category));
  const net = round(salePrice - platformFee - paymentFee - ads - postage - packaging - returnsProvision - cost);

  return {
    sale_price: round(salePrice),
    platform_fee: platformFee,
    payment_fee: paymentFee,
    ads,
    postage,
    packaging,
    returns_provision: returnsProvision,
    landed_cost: round(cost),
    cost_source: estimated ? 'estimated' : 'actual',
    net,
    net_pct: round(net / salePrice),
    band,
    channel,
  };
}

const W = { sell_through: 25, margin_pct: 20, trend: 15, competition: 15, seller_spread: 10, shipping_band: 10, supply: 5 };

function score(parts) {
  const breakdown = {};
  let total = 0;
  let used = 0;
  for (const [key, value] of Object.entries(parts)) {
    breakdown[key] = { value, weight: W[key] };
    total += value * W[key];
    used += W[key];
  }
  return { score: Math.round((total / used) * 100), component_count: Object.keys(breakdown).length, breakdown };
}

function signals(sources) {
  return sources.map((source_id) => ({ source_id, signal: 'demand', value: 0.7, weight: 1 }));
}

function make(i, {
  title, category, sale, cost, band, sold, trend, listings, parts, sources, decision = null, estimated = false,
}) {
  const m = margin({ salePrice: sale, landedCost: cost, band, category, estimated });
  const s = score(parts);
  return {
    id: `demo-${i}`,
    title,
    category,
    image_url: null,
    supplier_url: null,
    external_ref: `DEMO-${1000 + i}`,
    classification: trend > 1.4 ? 'trend_spike' : 'evergreen',
    score: s.score,
    component_count: s.component_count,
    breakdown: s.breakdown,
    confidence: Math.min(99, 60 + sources.length * 9),
    signal_count: sources.length,
    signals: signals(sources),
    margin: m,
    sold_30d: sold,
    trend,
    active_listings: listings,
    sell_through: round(sold / listings),
    seller_concentration: 0.38,
    recommended_channels: m.channel === 'store' ? ['store', 'ebay'] : ['ebay', 'tiktok'],
    recommended_volume: null,
    analyst_note: null,
    decision,
  };
}

export const DEMO_BATCH = {
  id: 'demo-batch',
  delivered_for: '2026-07-29',
  status: 'delivered',
  candidate_count: 10,
  sources_used: ['terapeak_export', 'ebay_browse', 'cj_dropshipping'],
};

export const DEMO_CANDIDATES = [
  make(1, {
    title: 'Slow Feeder Dog Bowl Anti Gulp Non Slip',
    category: 'Pet Accessories', sale: 15.99, cost: 3.1, band: 'small_parcel',
    sold: 412, trend: 2.14, listings: 186,
    parts: { sell_through: 0.94, margin_pct: 0.82, trend: 1, competition: 0.63, seller_spread: 0.66, shipping_band: 0.5, supply: 0.8 },
    sources: ['terapeak_export', 'ebay_browse', 'cj_dropshipping'],
  }),
  make(2, {
    title: 'Stainless Steel Jade Roller And Gua Sha Set',
    category: 'Beauty Tools', sale: 18.5, cost: 3.85, band: 'large_letter',
    sold: 268, trend: 1.36, listings: 240,
    parts: { sell_through: 0.55, margin_pct: 0.86, trend: 0.57, competition: 0.52, seller_spread: 0.61, shipping_band: 1, supply: 0.72 },
    sources: ['terapeak_export', 'ebay_browse', 'cj_dropshipping'],
  }),
  make(3, {
    title: 'Cat Grooming Deshedding Brush Self Cleaning',
    category: 'Pet Accessories', sale: 14.25, cost: 2.6, band: 'small_parcel',
    sold: 331, trend: 1.62, listings: 302,
    parts: { sell_through: 0.55, margin_pct: 0.74, trend: 0.75, competition: 0.4, seller_spread: 0.58, shipping_band: 0.5 },
    sources: ['terapeak_export', 'ebay_browse'],
  }),
  make(4, {
    title: 'Heatless Curling Rod Headband Silk Set',
    category: 'Beauty Tools', sale: 16.75, cost: 2.95, band: 'large_letter',
    sold: 189, trend: 1.88, listings: 214,
    parts: { sell_through: 0.44, margin_pct: 0.9, trend: 0.92, competition: 0.57, seller_spread: 0.7, shipping_band: 1, supply: 0.66 },
    sources: ['terapeak_export', 'ebay_browse', 'cj_dropshipping'],
  }),
  make(5, {
    title: 'Dog Lick Mat Slow Feeder Suction Base',
    category: 'Pet Accessories', sale: 14.99, cost: 2.4, band: 'large_letter',
    sold: 224, trend: 1.21, listings: 268,
    parts: { sell_through: 0.42, margin_pct: 0.88, trend: 0.47, competition: 0.46, seller_spread: 0.54, shipping_band: 1 },
    sources: ['terapeak_export', 'ebay_browse'],
    decision: { action: 'approve', reason: null, note: null, decided_at: '2026-07-29T09:12:00Z' },
  }),
  make(6, {
    title: 'Facial Cleansing Brush Silicone Waterproof',
    category: 'Beauty Tools', sale: 21.99, cost: 5.2, band: 'small_parcel', 
    sold: 146, trend: 1.04, listings: 410,
    parts: { sell_through: 0.18, margin_pct: 0.72, trend: 0.36, competition: 0.18, seller_spread: 0.41, shipping_band: 0.5, supply: 0.58 },
    sources: ['terapeak_export', 'ebay_browse', 'cj_dropshipping'],
    decision: { action: 'reject', reason: 'too_much_competition', note: null, decided_at: '2026-07-29T09:15:00Z' },
  }),
  make(7, {
    title: 'Pet Hair Remover Roller Reusable',
    category: 'Pet Accessories', sale: 14.5, cost: null, band: 'large_letter',
    sold: 178, trend: 1.11, listings: 233, estimated: true,
    parts: { sell_through: 0.38, margin_pct: 0.63, trend: 0.41, competition: 0.53, seller_spread: 0.5, shipping_band: 1 },
    sources: ['terapeak_export', 'zik_export'],
  }),
  make(8, {
    title: 'Eyelash Curler Heated Rechargeable',
    category: 'Beauty Tools', sale: 19.25, cost: 4.4, band: 'large_letter',
    sold: 132, trend: 1.44, listings: 176,
    parts: { sell_through: 0.38, margin_pct: 0.74, trend: 0.63, competition: 0.65, seller_spread: 0.72, shipping_band: 1, supply: 0.55 },
    sources: ['terapeak_export', 'ebay_browse', 'cj_dropshipping'],
  }),
  make(9, {
    title: 'Dog Paw Cleaner Cup Silicone Bristles',
    category: 'Pet Accessories', sale: 15.5, cost: 3.05, band: 'small_parcel',
    sold: 97, trend: 0.94, listings: 289,
    parts: { sell_through: 0.17, margin_pct: 0.66, trend: 0.29, competition: 0.42, seller_spread: 0.47, shipping_band: 0.5 },
    sources: ['terapeak_export', 'ebay_browse'],
    decision: { action: 'defer', reason: null, note: null, decided_at: '2026-07-29T09:18:00Z' },
  }),
  make(10, {
    title: 'Scalp Massager Shampoo Brush Soft Silicone',
    category: 'Beauty Tools', sale: 14.75, cost: 2.15, band: 'large_letter',
    sold: 205, trend: 1.29, listings: 198,
    parts: { sell_through: 0.52, margin_pct: 0.94, trend: 0.53, competition: 0.6, seller_spread: 0.68, shipping_band: 1, supply: 0.74 },
    sources: ['terapeak_export', 'ebay_browse', 'cj_dropshipping'],
  }),
].sort((a, b) => b.score - a.score);

export const DEMO_SOURCES = [
  { id: 'terapeak_export', name: 'Terapeak export', lastRunAt: '2026-07-29T06:02:00Z', lastStatus: 'ok' },
  { id: 'ebay_browse', name: 'eBay Browse', lastRunAt: '2026-07-29T06:02:00Z', lastStatus: 'ok' },
  { id: 'cj_dropshipping', name: 'CJ Dropshipping', lastRunAt: '2026-07-29T06:03:00Z', lastStatus: 'ok' },
  { id: 'zik_export', name: 'Zik Analytics export', lastRunAt: '2026-07-27T21:40:00Z', lastStatus: 'error' },
];

export const DEMO_LISTINGS = 6;
export const DEMO_PERFORMANCE = { units: 41, revenue: 638.5, net: 173.2 };
