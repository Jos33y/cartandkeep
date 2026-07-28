// Fee schedule comes from tenants.fees, so a rate change is an update not a deploy.
export function computeMargin({ salePrice, landedCost, channel, fees }) {
  const schedule = fees?.[channel];
  if (!schedule) throw new Error(`no fee schedule for channel ${channel}`);

  const round = (n) => Math.round(n * 100) / 100;

  const platformFee = round(salePrice * schedule.pct + schedule.fixed);
  // Store checkout fee is already the channel fee, so no second charge.
  const paymentFee =
    channel === 'store' ? 0 : round(salePrice * fees.payment.pct + fees.payment.fixed);

  return {
    sale_price: round(salePrice),
    platform_fee: platformFee,
    payment_fee: paymentFee,
    landed_cost: round(landedCost),
    net: round(salePrice - platformFee - paymentFee - landedCost),
    channel,
  };
}

// Weighted mean, not a sum against a fixed denominator, so a source being down
// does not drag every candidate toward zero.
export function computeConfidence({ signals, weights }) {
  if (!signals.length) return { confidence: 0, signalCount: 0 };

  // Best signal per source, or a chatty source wins on volume alone.
  const bySource = new Map();
  for (const s of signals) {
    const current = bySource.get(s.sourceId);
    if (!current || s.value > current.value) bySource.set(s.sourceId, s);
  }

  let weighted = 0;
  let totalWeight = 0;
  for (const [sourceId, signal] of bySource) {
    const w = weights?.[sourceId] ?? 1;
    weighted += signal.value * w;
    totalWeight += w;
  }

  const mean = totalWeight > 0 ? weighted / totalWeight : 0;

  return {
    confidence: Math.round(Math.max(0, Math.min(1, mean)) * 100),
    signalCount: bySource.size,
  };
}

// Unknown beats a guess here, because wrong-category rejections are training data.
export function classify({ signals }) {
  const kinds = new Set(signals.map((s) => s.kind));
  const spikey = kinds.has('seasonality') || kinds.has('demand');
  const steady = kinds.has('velocity') || kinds.has('depth');

  if (steady && !spikey) return 'evergreen';
  if (spikey && !steady) return 'trend_spike';
  if (steady && spikey) {
    const demand = signals.find((s) => s.kind === 'demand');
    return demand && demand.value > 0.8 ? 'trend_spike' : 'evergreen';
  }
  return 'unknown';
}

// Single-source candidates are a guess with a number on it. She reads velocity
// graphs for a living and will spot them.
export function passesFilter({ margin, signalCount, scoring }) {
  return (
    margin.net >= (scoring?.margin_floor ?? 0) &&
    signalCount >= (scoring?.min_signals ?? 1)
  );
}

// Category boundaries are regulatory, not commercial: cosmetics make the
// importer the Responsible Person, pet food and health products carry their own
// regimes. Cheaper to drop them here than to surface something she cannot sell.
//
// Matching is on whole words. The allow list exists because single words are
// ambiguous: "dog treats" is food, "treat puzzle toy" is an accessory.
function pad(text) {
  return ` ${String(text).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;
}

export function isExcluded(title, research) {
  const terms = research?.exclude?.terms ?? [];
  if (!terms.length || !title) return false;

  const haystack = pad(title);
  const allow = research?.exclude?.allow ?? [];
  if (allow.some((a) => haystack.includes(pad(a)))) return false;

  return terms.some((t) => haystack.includes(pad(t)));
}
