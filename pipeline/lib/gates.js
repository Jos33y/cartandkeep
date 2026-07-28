/*
 * Gates are binary and drop candidates. The ranking score only orders what
 * survives. Mixing them, as the first implementation did, lets a product with a
 * strong demand signal and an unacceptable margin float to the top on one
 * dimension.
 *
 * A gate whose metric is missing is SKIPPED, not failed. Sources come online at
 * different times, and a pipeline that rejects everything because one input is
 * absent delivers nothing on a Monday.
 */

const GATES = [
  {
    key: 'sell_through',
    metric: (c) => c.sell_through,
    test: (v, g) => v >= (g.str_min ?? 0.3),
    why: (v, g) => `sell-through ${(v * 100).toFixed(0)}% below ${((g.str_min ?? 0.3) * 100).toFixed(0)}%`,
  },
  {
    key: 'margin_abs',
    metric: (c) => c.margin?.net,
    test: (v, g) => v >= (g.margin_abs_min ?? 4),
    why: (v, g) => `net £${v.toFixed(2)} below £${(g.margin_abs_min ?? 4).toFixed(2)}`,
  },
  {
    key: 'margin_pct',
    metric: (c) => c.margin?.net_pct,
    test: (v, g) => v >= (g.margin_pct_min ?? 0.25),
    why: (v, g) => `margin ${(v * 100).toFixed(0)}% below ${((g.margin_pct_min ?? 0.25) * 100).toFixed(0)}%`,
  },
  {
    key: 'trend',
    metric: (c) => c.trend,
    test: (v, g) => v >= (g.trend_min ?? 0.8),
    why: (v, g) => `trend ${v.toFixed(2)} below ${(g.trend_min ?? 0.8).toFixed(2)}, demand is falling`,
  },
  {
    key: 'demand',
    metric: (c) => c.sold30,
    test: (v, g) => v >= (g.sold_min ?? 15),
    why: (v, g) => `${v} sold in 30 days, below ${g.sold_min ?? 15}`,
  },
  {
    key: 'competition',
    metric: (c) => c.active_listings,
    test: (v, g) => v <= (g.listings_max ?? 500),
    why: (v, g) => `${v} active listings, above ${g.listings_max ?? 500}`,
  },
  {
    key: 'concentration',
    metric: (c) => c.seller_concentration,
    test: (v, g) => v <= (g.concentration_max ?? 0.7),
    why: (v, g) => `top 3 sellers hold ${(v * 100).toFixed(0)}%, above ${((g.concentration_max ?? 0.7) * 100).toFixed(0)}%`,
  },
  {
    key: 'sources',
    metric: (c) => c.signal_count,
    test: (v, g) => v >= (g.min_sources ?? 1),
    why: (v, g) => `${v} source agreeing, needs ${g.min_sources ?? 1}`,
  },
  {
    key: 'lead_time',
    metric: (c) => c.lead_time_days,
    test: (v, g) => v <= (g.lead_time_max_days ?? 21),
    why: (v, g) => `${v} day lead time, above ${g.lead_time_max_days ?? 21}`,
  },
  {
    key: 'brand',
    metric: (c) => c.brand_flag,
    test: (v, g) => (g.brand_screen === false ? true : !v),
    why: (v) => `brand risk: ${v.brand ?? v.reason}`,
  },
];

export function evaluateGates(candidate, gateConfig = {}) {
  const failed = [];
  const skipped = [];
  const passed = [];

  for (const gate of GATES) {
    const value = gate.metric(candidate);
    if (value === null || value === undefined) {
      skipped.push(gate.key);
      continue;
    }
    if (gate.test(value, gateConfig)) passed.push(gate.key);
    else failed.push({ gate: gate.key, why: gate.why(value, gateConfig) });
  }

  return { ok: failed.length === 0, failed, skipped, passed };
}

export const GATE_KEYS = GATES.map((g) => g.key);
