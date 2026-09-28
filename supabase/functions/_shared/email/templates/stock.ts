// deno-lint-ignore-file no-explicit-any
/*
 * Nearly out. One email per drop rather than one per order, which is what
 * store_stock_alerts is for. No `to` here: the caller supplies the shop's own
 * address, so a stock report cannot reach a shopper.
 */
import { C, TEXT, button, esc, h1, kicker, mail, row, small } from '../kit.ts';
import { type Shop, shopFooter, thumbOf } from '../context.ts';

const nameOf = (i: any) => (i.label ? `${i.title}, ${i.label}` : String(i.title ?? ''));

export function stock(list: any[], shop: Shop) {
  const rows = list.map((i, n) => {
    const left = Number(i.stock);
    const low = left <= 1;
    const img = thumbOf(i.image_url);
    return `<tr>
  <td width="58" style="padding:${n ? 12 : 0}px 14px 0 0;">${img
    ? `<img src="${esc(img)}" width="44" height="44" alt="" style="display:block;width:44px;height:44px;border-radius:8px;border:1px solid ${C.line};object-fit:cover;">`
    : `<div style="width:44px;height:44px;border-radius:8px;background:${C.line};"></div>`}</td>
  <td style="padding:${n ? 12 : 0}px 0 0;font:500 15px/21px ${TEXT};color:${C.ink};">${esc(nameOf(i))}</td>
  <td align="right" style="padding:${n ? 12 : 0}px 0 0 12px;white-space:nowrap;"><span style="display:inline-block;padding:4px 10px;border-radius:999px;background:${low ? C.terraWash : C.goldWash};font:600 13px/18px ${TEXT};color:${low ? C.terraText : C.gold};">${left <= 0 ? 'None left' : `${left} left`}</span></td>
</tr>`;
  }).join('');

  const count = list.length;
  const body = row(`
  ${kicker('Stock', 'gold')}
  ${h1(count === 1 ? 'One thing is nearly out.' : `${count} things are nearly out.`)}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:22px;">${rows}</table>
  ${button(`${shop.portal}/products?filter=live`, 'Open Products')}
  ${small('You will not hear about the same thing again until it has been restocked and runs low a second time. Anything without a count is left alone.', 16)}
`);

  const first = list[0] ? nameOf(list[0]) : '';
  return mail({
    subject: count === 1 ? `Nearly out: ${first.slice(0, 60)}` : `${count} things are nearly out`,
    preheader: list.slice(0, 3).map((i) => `${nameOf(i)}: ${Number(i.stock)} left`).join('. '),
    body,
    brand: shop.brand,
    footer: shopFooter(shop, 'Sent to you by your portal when stock runs low.'),
  });
}
