/*
 * Refunded sales, read together: how much went back, why, and which products keep coming back.
 *
 * A row is one line of an eBay order with money back: refunded in full or cancelled (status), or a part refund on a
 * paid sale (refunded set, status paid). Whose doing it was decides what to change: the product (damaged, faulty,
 * not as described, never arrived), her (a cancellation, usually out of stock, which eBay counts against her
 * account) or the buyer (changed their mind).
 */

export const FAULT = {
  product: { label: 'Product problem', note: 'Damaged, faulty, not as described or never arrived. Check the supplier or the listing.' },
  her: { label: 'Your cancellation', note: 'eBay counts these against your account. Usually out of stock at the supplier.' },
  buyer: { label: 'Buyer changed their mind', note: 'Nothing to fix on the product.' },
};

const squash = (t) => String(t ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export const refundKey = (r) => r.product_id ?? (r.external_sku ? `sku:${r.external_sku}` : `t:${squash(r.title)}`);

// What came back in full (not a sale) against what was only partly refunded (still a sale).
export const isFull = (r) => r.status !== 'paid';
export const moneyBack = (r) => Number(r.refunded ?? (isFull(r) ? r.gross : 0) ?? 0);

/*
 * Comes back: a product with two or more units refunded in full, or half or more of its units back with a product
 * problem among the reasons. `soldOf(key, title)` gives the units still counted as sold, for the share.
 */
export function summariseRefunds(rows = [], soldOf = () => 0) {
  const full = rows.filter(isFull);
  const by = new Map();
  for (const r of rows) {
    const k = refundKey(r);
    const at = by.get(k) ?? { key: k, title: r.title, product_id: r.product_id ?? null, units: 0, part: 0, back: 0, reasons: new Map(), faults: new Set() };
    if (isFull(r)) at.units += Number(r.qty ?? 1); else at.part += 1;
    at.back += moneyBack(r);
    if (r.refund_reason) at.reasons.set(r.refund_reason, (at.reasons.get(r.refund_reason) ?? 0) + 1);
    if (r.refund_fault) at.faults.add(r.refund_fault);
    by.set(k, at);
  }
  const products = [...by.values()].map((p) => {
    const sold = Number(soldOf(p.key, p.title) ?? 0);
    const share = p.units + sold ? p.units / (p.units + sold) : 0;
    return {
      ...p,
      back: Math.round(p.back * 100) / 100,
      sold,
      share,
      reasons: [...p.reasons.entries()].sort((a, b) => b[1] - a[1]).map(([r, n]) => (n > 1 ? `${r} (${n})` : r)),
      comesBack: p.units >= 2 || (p.faults.has('product') && share >= 0.5),
    };
  }).sort((a, b) => b.units - a.units || b.back - a.back);
  return {
    orders: new Set(full.map((r) => r.external_ref)).size,
    units: full.reduce((a, r) => a + Number(r.qty ?? 1), 0),
    partOrders: new Set(rows.filter((r) => !isFull(r)).map((r) => r.external_ref)).size,
    back: Math.round(rows.reduce((a, r) => a + moneyBack(r), 0) * 100) / 100,
    unexplained: rows.filter((r) => !r.refund_reason).length,
    hers: rows.filter((r) => r.refund_fault === 'her').length,
    products,
    comesBack: products.filter((p) => p.comesBack),
  };
}
