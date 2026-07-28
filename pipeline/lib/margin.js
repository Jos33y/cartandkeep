const round = (n) => Math.round(n * 100) / 100;

// Royal Mail prices by size before weight. Large Letter is 353 x 250 x 25mm up
// to 750g, and the step up to a parcel is often more than a pound. On a £14 item
// that is most of the margin, so the band is a property worth carrying.
export function shippingBand(dimensionsMm, weightG) {
  if (!dimensionsMm) return null;
  const [l, w, d] = [...dimensionsMm].sort((a, b) => b - a);
  if (l <= 353 && w <= 250 && d <= 25 && (weightG ?? 0) <= 750) return 'large_letter';
  if (l <= 450 && w <= 350 && d <= 160 && (weightG ?? 0) <= 2000) return 'small_parcel';
  return 'medium_parcel';
}

export function postageFor(band, costs) {
  const bands = costs?.shipping?.bands ?? {};
  return bands[band] ?? bands[costs?.shipping?.default_band ?? 'small_parcel'] ?? 0;
}

export function returnsRate(category, costs) {
  const r = costs?.returns ?? {};
  if (!category) return r.default ?? 0;
  const hit = Object.entries(r.by_category ?? {}).find(([k]) =>
    category.toLowerCase().includes(k.toLowerCase()),
  );
  return hit ? hit[1] : (r.default ?? 0);
}

/*
 * Every line is returned, not just the total. A margin she cannot take apart is
 * a margin she cannot trust, and the omitted lines are the ones that matter:
 * promoted listings, because new listings are close to invisible without ads,
 * and returns, because the outbound postage is already spent when one comes back.
 */
export function computeMargin({
  salePrice,
  landedCost,
  channel = 'ebay',
  band = null,
  category = null,
  fees,
  costs,
}) {
  const schedule = fees?.[channel];
  if (!schedule) throw new Error(`no fee schedule for channel ${channel}`);
  if (!(salePrice > 0)) return null;

  let cost = landedCost;
  let costSource = 'actual';

  // Estimating a cost is a stated assumption, never a silent one.
  if (!(cost > 0)) {
    const pct = costs?.goods_pct_estimate;
    if (!(pct > 0)) return null;
    cost = round(salePrice * pct);
    costSource = 'estimated';
  }

  const effectiveBand = band ?? costs?.shipping?.default_band ?? 'small_parcel';

  const platformFee = round(salePrice * schedule.pct + schedule.fixed);
  const paymentFee =
    channel === 'store' ? round(salePrice * fees.payment.pct + fees.payment.fixed) : 0;
  const ads = round(salePrice * (costs?.ads_pct ?? 0));
  const postage = round(postageFor(effectiveBand, costs));
  const packaging = round(costs?.shipping?.packaging ?? 0);
  const returnsProvision = round(salePrice * returnsRate(category, costs));

  const net = round(
    salePrice - platformFee - paymentFee - ads - postage - packaging - returnsProvision - cost,
  );

  return {
    sale_price: round(salePrice),
    platform_fee: platformFee,
    payment_fee: paymentFee,
    ads,
    postage,
    packaging,
    returns_provision: returnsProvision,
    landed_cost: round(cost),
    cost_source: costSource,
    net,
    net_pct: round(net / salePrice),
    band: effectiveBand,
    channel,
  };
}
