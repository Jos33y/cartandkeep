// What an eBay order counts for: paid, refunded or cancelled, and how much of it was given back.
//
// Before 1 October any refund marked the whole order refunded, and the money views count paid sales only, so a
// postage refund of £2.99 took a £25 sale and its units out of every total. Now only an order refunded in full
// leaves the totals; a part refund stays a sale and comes off the takings, line by line.

type Json = Record<string, any>;

const money = (a: { value?: string } | undefined) => Number(a?.value ?? 0);
const round = (n: number) => Math.round(n * 100) / 100;

// Only money that actually went back counts; a pending or failed refund has not.
export function refundedOf(o: Json) {
  return round(((o.paymentSummary?.refunds ?? []) as Json[])
    .filter((r) => !r.refundStatus || r.refundStatus === 'REFUNDED')
    .reduce((s, r) => s + money(r.amount), 0));
}

export function statusOf(o: Json): 'paid' | 'refunded' | 'cancelled' {
  if (o.cancelStatus?.cancelState === 'CANCELED') return 'cancelled';
  const refunded = refundedOf(o);
  const total = money(o.pricingSummary?.total) || money(o.paymentSummary?.totalDueSeller);
  // Refunded in full (a penny's rounding allowed): the sale did not stand.
  return refunded > 0 && total > 0 && refunded >= total - 0.01 ? 'refunded' : 'paid';
}

// A part refund taken off each line's takings in proportion to its share of the order, never below nothing.
export function lineGross(o: Json, lineGrossBefore: number, orderGross: number) {
  if (statusOf(o) !== 'paid') return round(lineGrossBefore);
  const refunded = refundedOf(o);
  if (!refunded || !orderGross) return round(lineGrossBefore);
  return round(Math.max(0, lineGrossBefore - refunded * (lineGrossBefore / orderGross)));
}
