// Direction beats level. A product selling 80 a month and falling is worse than
// one selling 50 and climbing, because the fall continues through the four to
// six week sourcing lead time.
export function velocityTrend({ sold7, sold30 }) {
  if (!(sold30 > 0)) return null;
  if (sold7 == null) return null;
  return Math.round(((sold7 * 30) / 7 / sold30) * 100) / 100;
}

// The single most useful number in eBay research. 100 sold against 25 listings
// and 100 sold against 500 look identical if you only count sales.
export function sellThrough({ sold, activeListings }) {
  if (!(activeListings > 0) || sold == null) return null;
  return Math.round((sold / activeListings) * 100) / 100;
}

// High volume owned by three sellers is not a market a newcomer can enter.
export function sellerConcentration(salesBySeller) {
  if (!salesBySeller?.length) return null;
  const total = salesBySeller.reduce((a, b) => a + b, 0);
  if (!total) return null;
  const top3 = [...salesBySeller].sort((a, b) => b - a).slice(0, 3).reduce((a, b) => a + b, 0);
  return Math.round((top3 / total) * 100) / 100;
}

// A narrow band means sellers have converged and it is a price war. A wide one
// means there is room to sell on presentation rather than on being cheapest.
export function priceStability(prices) {
  if (!prices || prices.length < 4) return null;
  const s = [...prices].sort((a, b) => a - b);
  const at = (q) => s[Math.floor(s.length * q)];
  const median = at(0.5);
  if (!median) return null;
  return Math.round(((at(0.75) - at(0.25)) / median) * 100) / 100;
}
