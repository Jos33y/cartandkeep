/*
 * Ranks survivors only. Every component is normalised 0..1 and weighted from
 * tenant config, and components with no data are dropped and the remaining
 * weights renormalised. A candidate scored from four components and one scored
 * from seven both produce a usable number, with component_count exposed so the
 * reviewer can see the basis.
 */

const DEFAULT_WEIGHTS = {
  sell_through: 25,
  margin_pct: 20,
  trend: 15,
  competition: 15,
  seller_spread: 10,
  shipping_band: 10,
  supply: 5,
};

const clamp = (n) => Math.max(0, Math.min(1, n));

const COMPONENTS = {
  // Plateaus at 200%. Beyond that it usually means one seller holds stock
  // nobody else can get, which is not an opening.
  sell_through: (c) => (c.sell_through == null ? null : clamp(c.sell_through / 2)),

  // 40% net is excellent in this trade, so that is the top of the scale.
  margin_pct: (c) => (c.margin?.net_pct == null ? null : clamp(c.margin.net_pct / 0.4)),

  // 1.0 is flat, 2.0 or better is a strong climb.
  trend: (c) => (c.trend == null ? null : clamp((c.trend - 0.5) / 1.5)),

  competition: (c) => (c.active_listings == null ? null : clamp(1 - Math.min(c.active_listings, 500) / 500)),

  seller_spread: (c) => (c.seller_concentration == null ? null : clamp(1 - c.seller_concentration)),

  shipping_band: (c) => {
    if (!c.margin?.band) return null;
    return { large_letter: 1, small_parcel: 0.5, medium_parcel: 0.15 }[c.margin.band] ?? 0.3;
  },

  supply: (c) => {
    if (c.stock == null && c.lead_time_days == null) return null;
    const stock = c.stock == null ? 0.5 : clamp(Math.min(c.stock, 500) / 500);
    const speed = c.lead_time_days == null ? 0.5 : clamp(1 - c.lead_time_days / 21);
    return stock * 0.5 + speed * 0.5;
  },
};

export function rankScore(candidate, weights = {}) {
  const w = { ...DEFAULT_WEIGHTS, ...weights };
  const breakdown = {};
  let total = 0;
  let weightUsed = 0;

  for (const [key, fn] of Object.entries(COMPONENTS)) {
    const value = fn(candidate);
    if (value === null) continue;
    const weight = w[key] ?? 0;
    breakdown[key] = { value: Math.round(value * 100) / 100, weight };
    total += value * weight;
    weightUsed += weight;
  }

  return {
    score: weightUsed ? Math.round((total / weightUsed) * 100) : 0,
    component_count: Object.keys(breakdown).length,
    breakdown,
  };
}
