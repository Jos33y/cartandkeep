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

// When the last refund went back.
export function refundedAtOf(o: Json): string | null {
  const dates = ((o.paymentSummary?.refunds ?? []) as Json[])
    .filter((r) => !r.refundStatus || r.refundStatus === 'REFUNDED')
    .map((r) => r.refundDate).filter(Boolean).sort();
  return dates.at(-1) ?? null;
}

/*
 * Why the money went back, in her words. eBay's codes come from three places: a cancellation on the order, a return
 * (Post-Order returns), or an item-not-received case (Post-Order inquiries).
 */
const REASONS: Record<string, string> = {
  ARRIVED_DAMAGED: 'Arrived damaged',
  DEFECTIVE_ITEM: 'Faulty',
  NOT_AS_DESCRIBED: 'Not as described',
  DIFFERENT_FROM_LISTING: 'Not as described',
  MISSING_PARTS: 'Parts missing',
  WRONG_ITEM: 'Wrong item sent',
  WRONG_SIZE: 'Wrong size',
  ARRIVED_LATE: 'Arrived late',
  ITEM_NOT_RECEIVED: 'Never arrived',
  INR: 'Never arrived',
  NO_LONGER_NEED_ITEM: 'No longer needed',
  ORDERED_ACCIDENTALLY: 'Ordered by mistake',
  ORDERED_WRONG_ITEM: 'Ordered the wrong item',
  ORDERED_DIFFERENT_ITEM: 'Ordered the wrong item',
  FOUND_BETTER_PRICE: 'Found it cheaper',
  BUYER_ASKED_CANCEL: 'Buyer asked to cancel',
  BUYER_CANCEL_OR_ADDRESS_ISSUE: 'Buyer cancelled or address problem',
  ADDRESS_ISSUES: 'Address problem',
  OUT_OF_STOCK: 'Out of stock',
  OUT_OF_STOCK_OR_CANNOT_FULFILL: 'Out of stock',
  UNABLE_TO_FULFILL: 'Could not send it',
  PAYMENT_ISSUE: 'Payment problem',
  OTHER: 'Other',
};

export function reasonText(code: unknown): string | null {
  const c = String(code ?? '').trim().toUpperCase();
  if (!c) return null;
  return REASONS[c] ?? c.toLowerCase().replace(/_/g, ' ').replace(/^\w/, (x) => x.toUpperCase());
}

// Whose doing it was, which decides what to change: the product, her stock, or nothing.
//   product: it arrived damaged, faulty, not as described, or not at all
//   her:     she cancelled, usually out of stock, which eBay counts against her account
//   buyer:   changed their mind
export function faultOf(code: unknown, initiator: unknown = null): 'product' | 'her' | 'buyer' | null {
  const c = String(code ?? '').toUpperCase();
  if (!c) return null;
  if (/DAMAGED|DEFECTIVE|NOT_AS_DESCRIBED|DIFFERENT_FROM_LISTING|MISSING_PARTS|^WRONG_ITEM$|ITEM_NOT_RECEIVED|^INR$|ARRIVED_LATE/.test(c)) return 'product';
  if (/OUT_OF_STOCK|UNABLE_TO_FULFILL/.test(c) || String(initiator ?? '').toUpperCase() === 'SELLER') return 'her';
  return 'buyer';
}

// A cancellation carries its own reason on the order.
export function cancelReasonOf(o: Json): { code: string | null; by: string | null } {
  const r = ((o.cancelStatus?.cancelRequests ?? []) as Json[])[0];
  return r ? { code: r.cancelReason ?? null, by: r.cancelInitiator ?? null } : { code: null, by: null };
}
