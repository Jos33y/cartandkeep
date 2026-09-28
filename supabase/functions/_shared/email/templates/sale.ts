// deno-lint-ignore-file no-explicit-any
/*
 * A sale, to the shop. Every paid order, straight after the customer's
 * confirmation.
 *
 * The subject carries the whole thing, because she reads this between other
 * work and should not have to open it to know what happened. Inside: the
 * figure, when to pack by, and anything that needs her before she packs.
 */
import { button, buttons, esc, figure, items, kicker, lines as brLines, mail, money, p, panel, parcel, row, ticket, totals, C } from '../kit.ts';
import { type Shop, addressOf, deliverTo, firstName, identityComplete, lineOf, plural, shopFooter, units } from '../context.ts';
import { orderDates, shortDay } from '../dates.ts';

export function sale(order: any, shop: Shop, now = new Date()) {
  const d = orderDates(order, shop.cfg.delivery, now);
  const list = order.items ?? [];
  const n = units(list);
  const where = addressOf(order);
  const gift = Boolean(order.is_gift);
  const buyer = firstName(order.name) ?? 'the buyer';

  // Anything that went below zero, named, so she knows before the customer does.
  const oversold = list.filter((i: any) => typeof i.stock === 'number' && i.stock < 0);
  const missing = !identityComplete(shop.trader);
  const red = (html: string, top = 12) => panel(html, 'terra', top);

  const warnings = [
    ...oversold.map((i: any) => `<b style="color:${C.terraText};">Sold more than you have.</b> ${esc(i.title)} is now at ${Number(i.stock)}. Somebody else bought the last one. Refund one of them from Stripe, or tell this customer it follows when you restock.`),
    missing ? `<b style="color:${C.terraText};">The confirmation went out without your trading name and address.</b> Both are required on it. Add them in Settings and the next one is complete.` : '',
  ].filter(Boolean);

  const giftPanel = gift ? panel(
    `<b>A gift from ${esc(buyer)}.</b> Pack the slip, never the receipt.${order.gift_message
      ? ` Their message, printed on the slip:<span style="display:block;margin-top:8px;font:italic 400 16px/24px Georgia,serif;color:${C.ink};">&ldquo;${brLines(order.gift_message)}&rdquo;</span>`
      : ''}`, 'warm', warnings.length ? 12 : 24) : '';

  const packBy = d.leaves === d.today ? 'Today' : shortDay(d.leaves);
  const body = row(`
  ${kicker(warnings.length ? 'New sale, read before packing' : 'New sale', warnings.length ? 'terra' : 'sage')}
  ${figure(money(order.total))}
  ${p(`${plural(n, 'item')} to ${esc(where.town ?? where.outcode ?? 'the customer')}, paid at ${esc(d.paidTime)}.${gift ? ' It is a gift, so it goes out with the slip and no prices.' : ''}`, { top: 10 })}
  ${ticket({ label: 'Order', reference: order.reference, sub: `Paid by ${order.name ?? 'the customer'}`, rightLabel: 'Pack by', rightValue: packBy })}
  ${warnings.map((w, i) => red(w, i ? 12 : 24)).join('')}
  ${giftPanel}
  ${items(list.map(lineOf))}
  ${totals([
    { label: 'Items', value: money(order.subtotal) },
    { label: 'Delivery charged', value: Number(order.delivery) > 0 ? money(order.delivery) : 'Free', free: !(Number(order.delivery) > 0) },
    { label: 'Paid', value: money(order.total), grand: true },
  ])}
  ${parcel({ shop: shop.brand.name, name: deliverTo(order), address: where.lines, postcode: where.postcode, gift })}
  ${missing
    ? buttons(button(`${shop.portal}/orders`, 'Open it in the portal'), button(`${shop.portal}/settings`, 'Settings', { tone: 'ghost' }))
    : button(`${shop.portal}/orders`, 'Open it in the portal')}
`);

  return mail({
    subject: `Sale: ${money(order.total)}, ${order.reference}, ${plural(n, 'item')} to ${where.outcode ?? 'UK'}${gift ? ', a gift' : ''}`,
    preheader: [
      `Pack by ${packBy === 'Today' ? 'today' : shortDay(d.leaves)}.`,
      oversold.length ? 'Sold more than you have, read before packing.' : '',
      gift ? 'A gift: slip, not receipt.' : '',
    ].filter(Boolean).join(' '),
    body,
    brand: shop.brand,
    footer: shopFooter(shop, 'Sent to you by your portal for every paid order.'),
  });
}
