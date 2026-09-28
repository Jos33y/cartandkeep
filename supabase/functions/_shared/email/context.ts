// deno-lint-ignore-file no-explicit-any
/*
 * What every template needs to know about the shop, read once off the tenant's
 * `store` row: its name, its site, where its logo lives, and the legal line.
 */
import { type Brand, type Line, footer } from './kit.ts';

export type Shop = {
  brand: Brand;
  site: string;
  portal: string;
  cfg: Record<string, any>;
  trader: Record<string, any>;
};

export function shopFrom(cfg: Record<string, any> = {}, portal = 'https://portal.cartandkeep.com'): Shop {
  const site = cfg.domain ? `https://${cfg.domain}` : 'https://cartandkeep.com';
  const trader = cfg.trader ?? {};
  const name = String(trader.trading_as ?? 'Cart & Keep');
  // Served by the shop's own site from public/email, so a second shop brings its own.
  return {
    brand: { name, site, logo: `${site}/email/logo.png`, mark: `${site}/email/mark.png` },
    site, portal, cfg, trader,
  };
}

// "Jane Smith, trading as Corner Shop". Mirrors traderIdentity in src/data/legal.js.
export function identity(t: Record<string, any>) {
  if (!t.legal_name) return t.trading_as ?? null;
  const as = t.trading_as && t.trading_as !== t.legal_name ? `, trading as ${t.trading_as}` : '';
  return t.company_number ? `${t.legal_name}, company number ${t.company_number}${as}` : `${t.legal_name}${as}`;
}

export const identityComplete = (t: Record<string, any>) => Boolean(t.legal_name && t.address);

// Schedule 2 items b and c, whatever is present and never a placeholder.
export const identityLine = (t: Record<string, any>) =>
  [identity(t), t.address, t.email].filter(Boolean).map((l) => String(l).replace(/\s*\n\s*/g, ', ')).join(', ');

export const firstName = (n: unknown) => String(n ?? '').trim().split(/\s+/)[0] || null;

// Whose name goes on the parcel: the recipient's on a gift, the buyer's otherwise.
export const deliverTo = (order: any) => order.recipient_name || order.name || '';

export function addressOf(order: any) {
  const a = order.address ?? {};
  return {
    lines: [a.line1, a.line2, a.city].filter(Boolean).map(String),
    postcode: String(a.postcode ?? ''),
    town: String(a.city ?? '') || null,
    outcode: String(a.postcode ?? '').toUpperCase().trim().split(/\s+/)[0] || null,
  };
}

export const orderLink = (shop: Shop, order: any) =>
  `${shop.site}/order/${encodeURIComponent(order.reference)}?token=${encodeURIComponent(order.access_token ?? '')}`;

// eBay photographs come in sizes by URL. A 60px thumbnail does not need the 500px one.
const small = (url: unknown) => (url ? String(url).replace(/\/s-l\d+\./, '/s-l140.') : null);

export const lineOf = (i: any): Line => ({
  title: String(i.title ?? ''),
  variant: i.variant_label ?? null,
  qty: Number(i.qty ?? 1),
  unit: Number(i.unit_price ?? i.price ?? 0),
  total: Number(i.line_total ?? Number(i.qty ?? 1) * Number(i.price ?? i.unit_price ?? 0)),
  image: small(i.image_url),
});

export const thumbOf = small;

export const units = (list: any[]) => list.reduce((n, i) => n + Number(i.qty ?? 0), 0);
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export const customerFooter = (shop: Shop, note = '') => footer({
  brand: shop.brand,
  identity: identityLine(shop.trader),
  note,
  links: [[shop.site, 'Shop'], [`${shop.site}/orders`, 'Track an order'], [`${shop.site}/legal/returns`, 'Returns']],
});

export const shopFooter = (shop: Shop, note: string) => footer({
  brand: shop.brand, note, links: [[shop.portal, 'Open the portal']],
});

/*
 * What a conversation is about, three ways: one product, a basket, or an
 * order. `name` is the words for a subject line, `block` the picture of it.
 */
export type Topic = { product?: any | null; basket?: any[] | null; order?: any | null };

export function topicName(t: Topic, { withTotal = false } = {}) {
  if (t.product?.title) return String(t.product.title);
  if (t.basket?.length) {
    const n = units(t.basket);
    const sum = t.basket.reduce((s, l) => s + Number(l.qty ?? 0) * Number(l.price ?? 0), 0);
    return `a basket of ${plural(n, 'thing')}${withTotal ? `, £${sum.toFixed(2)}` : ''}`;
  }
  if (t.order?.reference) return `order ${t.order.reference}`;
  return 'the shop';
}

export const basketTotal = (basket: any[]) => basket.reduce((s, l) => s + Number(l.qty ?? 0) * Number(l.price ?? 0), 0);
