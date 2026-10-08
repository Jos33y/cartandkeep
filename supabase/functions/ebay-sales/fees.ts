// Each sale line's fees from eBay's own books (ebay-sales/index.ts uses them). Kept apart so the tests can load them.
//
// Where eBay's Finances API has the order, its line carries what eBay actually charged: the selling fee (none on a
// private account), and the ad fee when the sale came through a promoted listing. Where it does not, the line keeps
// the order's own fee figure, marked estimated, as before.

import { addFee, type ItemCharge, type LineFees, noFees, type OrderFees } from '../_shared/ebay/finances.ts';

type Json = Record<string, any>;

const round = (n: number) => Math.round(n * 100) / 100;

// A line's fees: its own, and its share of what eBay charged on the order as a whole.
export function lineFees(o: OrderFees, lineItemId: string | null, share: number): LineFees {
  const own = (lineItemId && o.lines[lineItemId]) || noFees();
  const out = noFees();
  for (const [k, v] of Object.entries(own.detail)) addFee(out, k, v);
  for (const [k, v] of Object.entries(o.order.detail)) addFee(out, k, v * share);
  return { selling: round(out.selling), ad: round(out.ad), detail: Object.fromEntries(Object.entries(out.detail).map(([k, v]) => [k, round(v)])) };
}

/*
 * A charge that names only the item, placed on that item's latest sale on or before the charge. Rows are changed in
 * place; returns how many charges found no sale, which are left out rather than guessed.
 */
export function placeItemCharges(rows: Json[], items: ItemCharge[]) {
  let unplaced = 0;
  for (const c of items) {
    const when = Date.parse(c.at) || Infinity;
    const hit = rows
      .filter((r) => r.listing_id === c.item && r.fees_estimated === false && Date.parse(r.sold_at) <= when)
      .sort((a, b) => Date.parse(b.sold_at) - Date.parse(a.sold_at))[0];
    if (!hit) { unplaced += 1; continue; }
    const detail = { ...(hit.fee_detail ?? {}) };
    const f: LineFees = { selling: Number(hit.fees ?? 0), ad: Number(hit.ad_fees ?? 0), detail };
    for (const [k, v] of Object.entries(c.fee.detail)) addFee(f, k, v);
    hit.fees = round(f.selling);
    hit.ad_fees = round(f.ad);
    hit.fee_detail = f.detail;
  }
  return unplaced;
}
