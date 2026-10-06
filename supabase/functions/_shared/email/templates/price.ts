// deno-lint-ignore-file no-explicit-any
/*
 * Her cost moved on something live on eBay (Joseey, 5 October: "lets only price change alert reach one by email").
 * One email for what the morning check found, never one per listing. Each line: what Amazon charges now against
 * before, and the price her listing sells at, with a link straight to Change price for it. No `to` here: the caller
 * sends to the shop's own address.
 *
 *   moved   her cost followed Amazon's price (it came from Amazon)
 *   dearer  Amazon now charges more than a cost she set herself, which is left alone
 */
import { C, TEXT, button, esc, h1, kicker, mail, money, row, small } from '../kit.ts';
import { type Shop, shopFooter } from '../context.ts';

export type PriceAlert = {
  title: string;
  listing_id: string;
  from: number | null;
  to: number;
  price: number | null;
  why: 'moved' | 'dearer';
  deal_ended?: boolean;
};

const up = (i: PriceAlert) => i.from == null || i.to > i.from;

function line(i: PriceAlert, n: number, portal: string) {
  const dearer = up(i);
  const said = i.why === 'dearer'
    ? `Amazon ${money(i.to)}, your cost ${money(i.from)}`
    : `Cost ${i.from == null ? '' : `${money(i.from)} to `}${money(i.to)}${i.deal_ended ? ', deal ended' : ''}`;
  const href = `${portal}/listings?find=${encodeURIComponent(i.listing_id)}&price=1`;
  return `<tr>
  <td style="padding:${n ? 14 : 0}px 12px 0 0;">
    <p style="margin:0;font:500 15px/21px ${TEXT};color:${C.ink};">${esc(i.title)}</p>
    <p style="margin:2px 0 0;font:400 13px/18px ${TEXT};color:${dearer ? C.terraText : C.soft};">${esc(said)}${i.price != null ? `. Sells at ${money(i.price)} on eBay` : ''}.</p>
  </td>
  <td align="right" valign="top" style="padding:${n ? 14 : 0}px 0 0;white-space:nowrap;">
    <a href="${esc(href)}" style="font:600 13px/18px ${TEXT};color:${C.terraText};text-decoration:underline;text-underline-offset:3px;">Change price</a>
  </td>
</tr>`;
}

export function price(list: PriceAlert[], shop: Shop) {
  const sorted = [...list].sort((a, b) => Number(up(b)) - Number(up(a)));
  const count = sorted.length;
  const ups = sorted.filter(up).length;
  const body = row(`
  ${kicker('Price change', ups ? 'terra' : 'sage')}
  ${h1(count === 1 ? 'A live listing\'s cost has changed.' : `${count} live listings' costs have changed.`)}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:22px;">${sorted.map((i, n) => line(i, n, shop.portal)).join('')}</table>
  ${button(`${shop.portal}/alerts`, 'Open Alerts')}
  ${small('Change price shows the lowest price that keeps your profit at the new cost. You hear about each change once; a cost you set yourself is never changed for you.', 16)}
`);
  const first = sorted[0]?.title ?? '';
  return mail({
    subject: count === 1 ? `Cost changed: ${first.slice(0, 60)}` : `${count} live listings changed cost`,
    preheader: sorted.slice(0, 3).map((i) => `${i.title}: ${money(i.to)}`).join('. '),
    body,
    brand: shop.brand,
    footer: shopFooter(shop, 'Sent to you by the morning supplier check.'),
  });
}
