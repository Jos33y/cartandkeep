import { toObjects, money, whole, whenSold } from '@lib/csv';

/*
 * Turning an eBay or TikTok Shop export into sales rows.
 *
 * Column names are matched against a list of candidates per field rather than
 * hardcoded, because both platforms rename headers between report versions and
 * a hardcoded name fails silently by importing a column of nulls. When a
 * required column cannot be found, the import stops and names the column and
 * the headers it did see, which is the difference between a fixable problem and
 * a mysterious one.
 */

const PROFILES = {
  ebay: {
    label: 'eBay',
    // Seller Hub, Orders report.
    fields: {
      ref: ['order number', 'sales record number', 'order id'],
      soldAt: ['sale date', 'paid on date', 'order creation date', 'transaction creation date'],
      title: ['item title', 'title', 'product name'],
      sku: ['custom label', 'sku', 'seller sku'],
      qty: ['quantity', 'qty', 'quantity sold'],
      unitPrice: ['sold for', 'item subtotal', 'price', 'sold price'],
      postage: ['postage and packaging', 'shipping and handling', 'postage'],
      fees: ['final value fee fixed', 'total fees', 'ebay collected fees', 'fees'],
      status: ['order status', 'status'],
    },
    required: ['ref', 'soldAt', 'title', 'qty', 'unitPrice'],
  },
  tiktok: {
    label: 'TikTok Shop',
    fields: {
      ref: ['order id', 'order number'],
      soldAt: ['paid time', 'created time', 'order time'],
      title: ['product name', 'item name', 'title'],
      sku: ['seller sku', 'sku id', 'sku'],
      qty: ['quantity', 'qty'],
      unitPrice: ['sku unit original price', 'unit price', 'original price'],
      postage: ['shipping fee after discount', 'shipping fee', 'buyer paid shipping fee'],
      fees: ['tiktok shop commission fee', 'platform commission', 'total fees'],
      status: ['order status', 'order substatus', 'status'],
    },
    required: ['ref', 'soldAt', 'title', 'qty', 'unitPrice'],
  },
};

export const channelLabel = (c) => PROFILES[c]?.label ?? c;

/*
 * Refunded and cancelled must not count as revenue, and every platform words it
 * differently. Anything unrecognised is treated as paid, because an export of
 * orders is an export of things that sold, and the alternative is dropping real
 * revenue on the strength of a word we have not seen before.
 */
function statusOf(raw) {
  const s = String(raw ?? '').toLowerCase();
  if (!s) return 'paid';
  if (s.includes('refund') || s.includes('returned')) return 'refunded';
  if (s.includes('cancel')) return 'cancelled';
  return 'paid';
}

function findColumn(headers, candidates) {
  // Exact first, then a contains match, because "sale date" and "sale date
  // time" are the same column two report versions apart.
  for (const c of candidates) if (headers.includes(c)) return c;
  for (const c of candidates) {
    const near = headers.find((h) => h.includes(c) || c.includes(h));
    if (near) return near;
  }
  return null;
}

export function readExport({ channel, text, fileName }) {
  const profile = PROFILES[channel];
  if (!profile) throw new Error('That channel is not one we can read.');

  const { headers, rows } = toObjects(text);
  if (!rows.length) throw new Error('That file has no rows in it.');

  const map = {};
  for (const [field, candidates] of Object.entries(profile.fields)) {
    map[field] = findColumn(headers, candidates);
  }

  const missing = profile.required.filter((f) => !map[f]);
  if (missing.length) {
    throw new Error(
      `Could not find ${missing.join(', ')} in that file. The columns it has are: ${headers.filter(Boolean).join(', ')}.`,
    );
  }

  const get = (row, field) => (map[field] ? row[map[field]] : null);

  /*
   * One row per line, and a line number per order.
   *
   * An order with three items appears as three rows sharing one order number.
   * Without a line number the unique constraint would treat them as one sale
   * repeated and keep only the last, which would quietly lose two thirds of a
   * multi item order.
   */
  const seen = new Map();
  const lines = [];
  const skipped = [];

  for (const row of rows) {
    const ref = String(get(row, 'ref') ?? '').trim();
    const title = String(get(row, 'title') ?? '').trim();
    const qty = whole(get(row, 'qty'));
    const unitPrice = money(get(row, 'unitPrice'));
    const soldAt = whenSold(get(row, 'soldAt'));

    if (!ref || !title || !qty || qty <= 0 || unitPrice === null || !soldAt) {
      skipped.push({ ref: ref || '(no order number)', title: title || '(no title)' });
      continue;
    }

    const lineNo = (seen.get(ref) ?? 0) + 1;
    seen.set(ref, lineNo);

    const fees = money(get(row, 'fees'));

    lines.push({
      channel,
      external_ref: ref,
      line_no: lineNo,
      sold_at: soldAt,
      title,
      external_sku: String(get(row, 'sku') ?? '').trim() || null,
      qty,
      unit_price: unitPrice,
      gross: Math.round(unitPrice * qty * 100) / 100,
      postage_charged: money(get(row, 'postage')) ?? 0,
      fees,
      // Recorded so a margin built on a rate can never be mistaken for one
      // built on what the platform actually charged.
      fees_estimated: fees === null,
      status: statusOf(get(row, 'status')),
      source_file: fileName ?? null,
    });
  }

  return { lines, skipped, headers, map };
}

/*
 * Matching a sold line to something in her catalogue.
 *
 * In order of how much the match can be trusted. Her own SKU is a decision she
 * made, a barcode identifies the manufactured thing, and a title is a guess
 * that happens to be right most of the time.
 *
 * Unmatched is a real and common answer: everything she sells on eBay and has
 * never put on the shop matches nothing. Those lines still count as revenue.
 * What they cannot do is carry a margin, because the cost lives on the product.
 */
export function matchProducts(lines, products) {
  const bySku = new Map();
  const byGtin = new Map();
  const byTitle = new Map();

  const flatten = (s) => String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();

  for (const p of products) {
    if (p.sku) bySku.set(flatten(p.sku), p.id);
    if (p.gtin) byGtin.set(String(p.gtin).replace(/\D/g, ''), p.id);
    if (p.title) byTitle.set(flatten(p.title), p.id);
  }

  let matched = 0;

  const out = lines.map((line) => {
    const sku = flatten(line.external_sku);
    const digits = String(line.external_sku ?? '').replace(/\D/g, '');

    /*
     * Each step returns null when it does not apply, never false.
     *
     * The first version guarded with `&&`, which yields `false` when the guard
     * fails, and `??` falls through null and undefined but not false. So any
     * line whose SKU held fewer than eight digits stopped at the barcode step
     * and never reached the title match. It matched nothing and looked
     * deliberate.
     */
    const bySkuHit = sku ? bySku.get(sku) ?? null : null;
    const byGtinHit = digits.length >= 8 ? byGtin.get(digits) ?? null : null;
    const byTitleHit = byTitle.get(flatten(line.title)) ?? null;

    const id = bySkuHit ?? byGtinHit ?? byTitleHit;

    if (id) matched += 1;
    return { ...line, product_id: id || null };
  });

  return { lines: out, matched, unmatched: out.length - matched };
}
