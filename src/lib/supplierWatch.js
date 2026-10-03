/*
 * Her Amazon supplier, as the portal reads it: which Amazon page a card is checked against, what that page says
 * today, and what she needs telling. The reading itself is done by the supplier-read function (Apify) and kept on
 * the card as `supplier_read`; this file only reads it. The page choice mirrors functions/_shared/amazon.ts.
 */
import { formatGbp } from '@utils/formatGbp';

const hostOf = (url) => { try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ''); } catch { return ''; } };
export const isAmazon = (url) => /(^|\.)amazon\.[a-z.]+$/.test(hostOf(String(url ?? '')));
export const isAmazonUk = (url) => hostOf(String(url ?? '')) === 'amazon.co.uk';
export function asinOf(url) {
  const s = String(url ?? '');
  const m = /\/(?:dp|gp\/product|gp\/aw\/d|exec\/obidos\/asin)\/([A-Z0-9]{10})(?=[/?#]|$)/i.exec(s) ?? /[?&]asin=([A-Z0-9]{10})\b/i.exec(s);
  return m ? m[1].toUpperCase() : null;
}

// The Amazon page the card is checked against: the one she sent or chose, else her cheapest Amazon UK supplier.
export function amazonPageOf(row) {
  const chosen = isAmazon(row?.draft?.supplier_url) ? row.draft.supplier_url : null;
  const amazon = (row?.sources ?? []).filter((s) => isAmazon(s.url) && asinOf(s.url));
  const uk = amazon.filter((s) => isAmazonUk(s.url))
    .sort((a, b) => Number(a.landed_unit_cost ?? a.unit_cost ?? 1e9) - Number(b.landed_unit_cost ?? b.unit_cost ?? 1e9));
  const url = chosen ?? uk[0]?.url ?? amazon[0]?.url ?? null;
  if (!url) return null;
  return { url, asin: asinOf(url), uk: isAmazonUk(url) };
}

// The reading, when it is of the page the card is checked against now.
export function readOf(row) {
  const page = amazonPageOf(row);
  const r = row?.supplier_read;
  return page?.asin && r?.asin === page.asin ? r : null;
}

// An Amazon UK page with no facts read yet: Get it ready reads it first.
export function needsRead(row) {
  const page = amazonPageOf(row);
  return Boolean(page?.uk && page.asin && !readOf(row)?.facts);
}

// The reading in the shape the Send to Cart & Keep button sends, for the photo check.
export const sentOf = (r) => (r?.facts ? {
  url: r.url, shop: 'amazon.co.uk', title: r.facts.title, brand: r.facts.brand, bullets: r.facts.bullets,
  details: r.facts.details, images: r.facts.images, text: r.facts.text,
} : null);

/*
 * The facts into her draft's supplier box. Never over words she pasted or edited: only an empty box, or one that
 * still holds exactly what the last reading put there, is filled. `supplier_auto` remembers what that was.
 */
export function supplierPatch(draft, r) {
  const text = r?.facts?.text;
  if (!text) return null;
  const have = String(draft?.supplier_text ?? '');
  if (have.trim() && have !== draft?.supplier_auto) return null;
  if (have === text) return null;
  return { supplier_text: text, supplier_auto: text, ...(draft?.supplier_url ? {} : { supplier_url: r.url }) };
}

const day = (iso) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Europe/London' }) : '');
const when = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const today = new Date().toLocaleDateString('en-GB', { timeZone: 'Europe/London' });
  const time = d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Europe/London' }).replace(/\s/g, '');
  return d.toLocaleDateString('en-GB', { timeZone: 'Europe/London' }) === today ? `today at ${time}` : `${day(iso)} at ${time}`;
};

// What one unit's goods cost by a reading: the price shown today, deal or not (amazon.ts goodsOf).
export function goodsOf(offer) {
  if (!offer || offer.price == null) return null;
  return Number(offer.price);
}

/*
 * Amazon's price offered as her cost: when the reading is of this supplier's page and its price differs from the
 * supplier's cost. A cost that follows Amazon has already been moved by the morning read, so this is left for a
 * cost she set herself, or one that matched no Amazon price.
 */
export function costOffer(r, source) {
  if (!r?.found || !source?.id || r.source_id !== source.id) return null;
  const to = goodsOf(r.offer);
  if (to == null) return null;
  const now = source.price_at_moq ?? source.unit_cost;
  if (now != null && Math.abs(Number(now) - to) < 0.015) return null;
  return { to, shipping: r.offer.shipping ?? source.supplier_shipping ?? null, deal: Boolean(r.offer.deal && r.offer.was) };
}

// Her cost already moved to this price in the same read: "up from" would say the same thing twice.
const followed = (r, cost) => r?.cost_change?.to != null && r.cost_change.at === r.read_at
  && Math.abs(Number(r.cost_change.to) + Number(r.offer?.shipping ?? 0) - cost) < 0.015;

export const STOCK = { in: 'In stock', low: 'Running low', slow: 'Slow to dispatch', out: 'Out of stock', unknown: 'Stock not shown' };

/*
 * What she needs telling about her supplier today, most serious first.
 *   stop  she would sell something she cannot get, or at a loss she did not cost for
 *   warn  it costs more, or may soon
 *   note  worth knowing, nothing to do
 * `costed` is the unit cost she put on the supplier the card prices from.
 */
export function supplierWarnings(r, costed = r?.costed ?? null, now = Date.now()) {
  if (!r) return [];
  const out = [];
  const o = r.offer;
  const b = r.before;
  if (r.found === false) out.push({ level: 'stop', short: 'page gone', text: 'The Amazon page has gone. It may be withdrawn or moved.' });
  if (o) {
    const said = String(o.stock_text ?? '').trim().replace(/\.+$/, '');
    const cost = o.price != null ? Math.round((o.price + (o.shipping ?? 0)) * 100) / 100 : null;
    if (o.stock === 'out' && r.found !== false) out.push({ level: 'stop', short: 'out of stock', text: `Out of stock on Amazon${said ? `: "${said}"` : ''}.` });
    if (o.stock === 'low') out.push({ level: 'warn', short: 'running low', text: `Amazon says "${said}".` });
    if (o.stock === 'slow') out.push({ level: 'warn', short: 'slow to dispatch', text: `Amazon says "${said}". Your buyers would wait.` });
    // Sourced on Amazon whoever sells it (task 02): who sends it is hers to weigh here. Not Amazon means delivery to
    // her is the seller's, not Prime's.
    if (o.sold_by && !/amazon/i.test(String(o.fulfilled_by ?? '')) && !/^amazon/i.test(String(o.sold_by))) {
      out.push({
        level: 'warn',
        short: 'not sent by Amazon',
        text: `Sold and sent by ${o.sold_by}, not Amazon${Number(o.shipping) > 0 ? `: ${formatGbp(Number(o.shipping))} delivery to you, counted in your cost` : ', so delivery may not be free on Prime'}.`,
      });
    }
    if (cost != null && costed != null && cost > costed + 0.01) {
      const up = (cost - costed) / costed;
      out.push({ level: up >= 0.1 ? 'stop' : 'warn', short: `now ${formatGbp(cost)}`, text: `Costs ${formatGbp(cost)} today. You costed it at ${formatGbp(costed)}.` });
    } else if (cost != null && b?.price != null && cost > b.price + 0.01 && !followed(r, cost)) {
      out.push({ level: 'warn', short: `up to ${formatGbp(cost)}`, text: `Up from ${formatGbp(b.price)} on ${day(b.read_at)} to ${formatGbp(cost)}.` });
    }
    // A deal is a cost while it lasts. Its end is what needs telling.
    if (b?.deal && !o.deal && o.price != null && b.price != null && o.price > b.price + 0.01) {
      out.push({ level: 'warn', short: 'deal ended', text: `Amazon's deal has ended: now ${formatGbp(o.price)}, was ${formatGbp(b.price)} on ${day(b.read_at)}.` });
    } else if (o.deal && o.was && o.price != null) {
      out.push({ level: 'note', text: `On a deal at ${formatGbp(o.price)}, usually ${formatGbp(o.was)}. You will be told when it ends.` });
    }
    if (cost != null && b?.price != null && cost < b.price - 0.01) out.push({ level: 'note', text: `Down from ${formatGbp(b.price)} on ${day(b.read_at)}.` });
    if (b?.stock === 'out' && o.stock === 'in') out.push({ level: 'note', text: 'Back in stock.' });
    if (b?.sold_by && o.sold_by && b.sold_by !== o.sold_by) out.push({ level: 'note', text: `Now sold by ${o.sold_by}, not ${b.sold_by}.` });
  }
  // Her cost moved with Amazon's price in a morning read. Up is worth a look for three days, then it is only said.
  const moved = r.cost_change;
  if (moved?.to != null && moved.at) {
    const age = now - Date.parse(moved.at);
    if (age < 14 * 24 * 3600 * 1000) {
      const up = moved.from == null || moved.to > moved.from + 0.01;
      const after = moved.why === 'deal_ended' ? ', when its deal ended' : '';
      out.push({
        level: up && age < 3 * 24 * 3600 * 1000 ? 'warn' : 'note',
        short: `cost now ${formatGbp(moved.to)}`,
        text: moved.from == null
          ? `Your cost is set from Amazon's price: ${formatGbp(moved.to)}${after}.`
          : `Your cost moved from ${formatGbp(moved.from)} to ${formatGbp(moved.to)} with Amazon's price on ${day(moved.at)}${after}.`,
      });
    }
  }
  // A reading that keeps failing: the figures above are old.
  if (r.error && r.read_at && now - Date.parse(r.read_at) > 36 * 3600 * 1000) {
    out.push({ level: 'note', text: `Not read since ${day(r.read_at)}. ${r.error}` });
  }
  const rank = { stop: 0, warn: 1, note: 2 };
  return out.sort((x, y) => rank[x.level] - rank[y.level]);
}

// One line on what the page says today, for the card.
export function offerLine(r) {
  const o = r?.offer;
  if (!o) return null;
  const parts = [];
  if (o.price != null) parts.push(`${formatGbp(o.price)}${o.shipping ? ` plus ${formatGbp(o.shipping)} postage` : ''}`);
  parts.push(STOCK[o.stock] ?? STOCK.unknown);
  if (o.sold_by) parts.push(`sold by ${o.sold_by}${o.fulfilled_by && o.fulfilled_by !== o.sold_by ? `, sent by ${o.fulfilled_by}` : ''}`);
  return { text: parts.join(', '), checked: when(r.read_at) };
}

// What Amazon's buyers complain about: for her, before she lists it. Never customer copy.
export function riskLine(r) {
  const k = r?.risk;
  if (!k) return null;
  const head = k.rating ? `${k.rating} stars from ${Number(k.reviews ?? 0).toLocaleString('en-GB')} Amazon reviews` : null;
  return {
    head,
    concerns: (k.concerns ?? []).map((c) => ({ topic: c.topic, text: `${c.negative} of ${c.mentions} mentions negative`, quote: c.quote })),
  };
}

/*
 * The item's weight from her Amazon page, in kilograms: Amazon's details table first ("Item Weight: 500 Grams"),
 * then a weight in the bullets. Null when nothing says.
 */
const UNIT = [[/^(kg|kilo|kilogram|kilograms)$/i, 1], [/^(g|gram|grams)$/i, 0.001], [/^(lb|lbs|pound|pounds)$/i, 0.4536], [/^(oz|ounce|ounces)$/i, 0.02835]];
export function weightKg(text) {
  const m = /(\d+(?:[.,]\d+)?)\s*(kg|kilograms?|kilo|g|grams?|lbs?|pounds?|oz|ounces?)\b/i.exec(String(text ?? ''));
  if (!m) return null;
  const n = Number(m[1].replace(',', '.'));
  const unit = UNIT.find(([re]) => re.test(m[2]));
  const kg = unit ? n * unit[1] : null;
  return kg && kg > 0 && kg < 100 ? Math.round(kg * 1000) / 1000 : null;
}
export function amazonWeight(r) {
  const details = r?.facts?.details ?? [];
  const line = details.find((d) => /^(item weight|weight|product weight)\s*:/i.test(d))
    ?? details.find((d) => /weight/i.test(d) && !/capacity|max|load/i.test(d));
  return weightKg(line?.split(':').slice(1).join(':')) ?? null;
}
// Packed, it weighs more: 15% for the box and wrapping, rounded up to the next 50g, at least 50g more.
// Rounded to the gram before rounding up: 0.1 + 0.05 is 0.15000000000000002 in floating point, which rounded a 100g
// item up to 200g, not 150g.
export const packedKg = (itemKg) => (itemKg ? Math.ceil(Math.round(Math.max(itemKg * 1.15, itemKg + 0.05) * 20 * 1e6) / 1e6) / 20 : null);
