// eBay's Finances API: every charge eBay made, as eBay booked it. Shared by ebay-account (90 days of charges, by kind)
// and ebay-sales (each order line's real fees, in place of an estimate), so the two can never sum a charge differently.
//
// Read only, with the seller's token. Finances lives on apiz.ebay.com, not api.ebay.com, and for a UK seller every
// call is signed (_shared/ebay/sign.ts).

import { EbayError, MARKETPLACE, readError } from './listing.ts';
import type { Signer } from './sign.ts';

type Json = Record<string, any>;
export type Fetch = typeof fetch;

// Identity and Finances live on eBay's other host.
export const APIZ = 'https://apiz.ebay.com';

const round = (n: number) => Math.round(n * 100) / 100;
const pounds = (a: Json | undefined) => Number(a?.value ?? 0) || 0;

export async function get(f: Fetch, url: string, access: string, sign: Signer | null = null): Promise<Json> {
  const res = await f(url, {
    headers: {
      authorization: `Bearer ${access}`,
      'accept-language': 'en-GB',
      'content-language': 'en-GB',
      'X-EBAY-C-MARKETPLACE-ID': MARKETPLACE,
      ...(sign ? await sign('GET', url) : {}),
    },
  });
  const text = await res.text();
  let body: Json = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = {}; }
  if (!res.ok) throw new EbayError(readError(res.status, body), res.status);
  return body;
}

// -------------------------------------------------------------------- fees

export type Fees = {
  from: string; to: string; days: number;
  sales: number; sold: number;
  charged: Record<string, number>;
  total: number;
};

const SKIP = new Set(['PAYOUT', 'TRANSFER', 'WITHDRAWAL', 'LOAN_REPAYMENT', 'PURCHASE']);

/*
 * What eBay charged, by the kind of charge. A sale carries its fees on its lines; a promoted sale's ad fee, and
 * anything else eBay bills on its own, arrives as a charge of its own; a credit takes one back. Postage labels bought
 * on eBay count, since they are money she paid eBay. Payouts and transfers are her own money moving, so they do not.
 */
export function sumFees(transactions: Json[], from: string, to: string, days: number): Fees {
  const charged: Record<string, number> = {};
  const add = (type: unknown, v: number) => {
    const k = String(type || 'OTHER_FEES');
    charged[k] = (charged[k] ?? 0) + v;
  };
  let sales = 0;
  let sold = 0;

  for (const t of transactions) {
    const type = String(t.transactionType ?? '');
    if (SKIP.has(type)) continue;
    const debit = t.bookingEntry === 'DEBIT';

    if (type === 'SALE' || type === 'REFUND') {
      const back = type === 'REFUND' ? -1 : 1;
      if (type === 'SALE') {
        sales += 1;
        sold += pounds(t.totalFeeBasisAmount) || pounds(t.amount) + pounds(t.totalFeeAmount);
      }
      let lineFees = 0;
      for (const line of (t.orderLineItems ?? []) as Json[]) {
        for (const fee of (line.marketplaceFees ?? []) as Json[]) {
          add(fee.feeType, back * pounds(fee.amount));
          lineFees += pounds(fee.amount);
        }
      }
      // A sale whose fees are given only as a total.
      if (!lineFees && pounds(t.totalFeeAmount)) add('SELLING_FEES', back * pounds(t.totalFeeAmount));
      continue;
    }

    if (type === 'SHIPPING_LABEL') { add('SHIPPING_LABEL', (debit ? 1 : -1) * pounds(t.amount)); continue; }
    if (type === 'NON_SALE_CHARGE' || type === 'CREDIT' || type === 'ADJUSTMENT' || type === 'DISPUTE') {
      add(t.feeType ?? type, (debit ? 1 : -1) * pounds(t.amount));
    }
  }

  for (const k of Object.keys(charged)) {
    charged[k] = round(charged[k]);
    if (charged[k] === 0) delete charged[k];
  }
  const total = round(Object.values(charged).reduce((n, v) => n + v, 0));
  return { from, to, days, sales, sold: round(sold), charged, total };
}

export async function readFees(f: Fetch, access: string, sign: Signer | null, days = 90, now = Date.now()): Promise<Fees> {
  const from = now - days * 86_400_000;
  const all = await transactions(f, access, from, now, sign);
  return sumFees(all, new Date(from).toISOString(), new Date(now).toISOString(), days);
}

// Every transaction between two times, read 90 days at a time so no one request asks eBay for too long a stretch.
export async function transactions(f: Fetch, access: string, fromMs: number, toMs: number, sign: Signer | null = null): Promise<Json[]> {
  const all: Json[] = [];
  const STEP = 90 * 86_400_000;
  for (let start = fromMs; start < toMs; start += STEP) {
    const from = new Date(start).toISOString();
    const to = new Date(Math.min(start + STEP, toMs)).toISOString();
    for (let offset = 0; offset < 20000; offset += 1000) {
      const q = new URLSearchParams({ filter: `transactionDate:[${from}..${to}]`, limit: '1000', offset: String(offset) });
      const body = await get(f, `${APIZ}/sell/finances/v1/transaction?${q}`, access, sign);
      const page = (body.transactions ?? []) as Json[];
      all.push(...page);
      if (!body.next || page.length < 1000) break;
    }
  }
  // A transaction on the boundary of two stretches comes back in both.
  const seen = new Set<string>();
  return all.filter((t) => {
    const id = t.transactionId ? `${t.transactionType}:${t.transactionId}` : null;
    if (!id) return true;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

// ------------------------------------------------------------ fees by order

export type LineFees = { selling: number; ad: number; detail: Record<string, number> };
// sale: eBay booked the sale itself, so its fees are known. labels: postage labels bought on eBay for the order.
export type OrderFees = { lines: Record<string, LineFees>; order: LineFees; sale: boolean; labels: number };
export type ItemCharge = { item: string; at: string; fee: LineFees };

export const noFees = (): LineFees => ({ selling: 0, ad: 0, detail: {} });

// Promoted listings, whatever eBay names the charge.
export const isAdFee = (type: unknown) => /^AD_FEE|PROMOTED/i.test(String(type ?? ''));

export function addFee(to: LineFees, type: unknown, v: number) {
  const k = String(type || 'OTHER_FEES');
  if (isAdFee(k)) to.ad += v; else to.selling += v;
  to.detail[k] = round((to.detail[k] ?? 0) + v);
}

const refOf = (t: Json, kind: string) => ((t.references ?? []) as Json[]).find((r) => r.referenceType === kind)?.referenceId ?? null;

/*
 * Each order's fees as eBay charged them: on each line where eBay says which line, else on the order. A refund takes
 * back what it credits. A charge billed on its own (a promoted sale's ad fee, most often) goes to the order it names;
 * one naming only the item is returned as an item charge, for the caller to place on that item's sale.
 */
export function feesByOrder(list: Json[]) {
  const orders = new Map<string, OrderFees>();
  const items: ItemCharge[] = [];
  let labelsLoose = 0;
  const at = (id: string) => {
    let o = orders.get(id);
    if (!o) { o = { lines: {}, order: noFees(), sale: false, labels: 0 }; orders.set(id, o); }
    return o;
  };

  for (const t of list) {
    const type = String(t.transactionType ?? '');
    if (type === 'SALE' || type === 'REFUND') {
      if (!t.orderId) continue;
      const o = at(String(t.orderId));
      if (type === 'SALE') o.sale = true;
      const back = type === 'REFUND' ? -1 : 1;
      let placed = 0;
      for (const line of (t.orderLineItems ?? []) as Json[]) {
        const key = String(line.lineItemId ?? '');
        for (const fee of (line.marketplaceFees ?? []) as Json[]) {
          const target = key ? (o.lines[key] ??= noFees()) : o.order;
          addFee(target, fee.feeType, back * pounds(fee.amount));
          placed += 1;
        }
      }
      if (!placed && pounds(t.totalFeeAmount)) addFee(o.order, 'SELLING_FEES', back * pounds(t.totalFeeAmount));
      continue;
    }
    // A postage label bought on eBay names the order it was bought for; a voided label comes back as a credit.
    if (type === 'SHIPPING_LABEL') {
      const order = t.orderId ?? refOf(t, 'ORDER_ID');
      const v = (t.bookingEntry === 'CREDIT' ? -1 : 1) * pounds(t.amount);
      if (order) at(String(order)).labels = round(at(String(order)).labels + v);
      else labelsLoose = round(labelsLoose + v);
      continue;
    }
    if (type === 'NON_SALE_CHARGE' || type === 'CREDIT') {
      const sign = t.bookingEntry === 'CREDIT' ? -1 : 1;
      const v = sign * pounds(t.amount);
      const order = t.orderId ?? refOf(t, 'ORDER_ID');
      if (order) { addFee(at(String(order)).order, t.feeType ?? type, v); continue; }
      const item = refOf(t, 'ITEM_ID');
      if (item) {
        const fee = noFees();
        addFee(fee, t.feeType ?? type, v);
        items.push({ item: String(item), at: String(t.transactionDate ?? ''), fee });
      }
    }
  }
  return { orders, items, labelsLoose };
}
