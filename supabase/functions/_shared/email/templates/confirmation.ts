// deno-lint-ignore-file no-explicit-any
/*
 * Paid. The moment Stripe says so.
 *
 * The one customer email that carries the rights section, because it is the
 * durable medium. It also carries the order link, which is the way back to the
 * order page and the receipt: the site tells people it is here.
 */
import { button, esc, h1, items, journey, kicker, label, link, mail, money, p, parcel, row, rule, small, strong, ticket, totals } from '../kit.ts';
import { type Shop, addressOf, customerFooter, deliverTo, firstName, lineOf, orderLink, plural, units } from '../context.ts';
import { longDay, orderDates, shortDay, stamp, weekday, windowLong, windowShort } from '../dates.ts';
import { rights } from '../rights.ts';

export function confirmation(order: any, shop: Shop, now = new Date()) {
  const d = orderDates(order, shop.cfg.delivery, now);
  const lines = (order.items ?? []).map(lineOf);
  const where = addressOf(order);
  const gift = Boolean(order.is_gift);
  const them = firstName(order.recipient_name);
  const first = firstName(order.name);
  const link_ = orderLink(shop, order);
  const today = d.leaves === d.today;

  const leaves = today ? 'today' : `on ${strong(esc(longDay(d.leaves)))}`;
  const reach = gift && them ? esc(them) : esc(where.outcode ?? 'you');

  // Said once in the buyer's email, so they know exactly what the recipient will and will not see.
  const giftNote = gift
    ? [
      `It is a gift, so the slip in the box carries no prices${order.gift_message ? ', only your message' : ''}.`,
      order.notify_recipient ? `We will email ${esc(them ?? 'them')} when it leaves us, without saying what it is.` : '',
    ].filter(Boolean).join(' ')
    : '';

  const body = `
${row(`
  ${kicker('Paid')}
  ${h1(`Thank you${first ? `, ${esc(first)}` : ''}.<br>Your order is in.`)}
  ${p(`We pack on weekday mornings. Yours leaves us ${leaves} and should reach ${reach} ${esc(windowLong(d.from, d.to))}.`)}
  ${ticket({ label: 'Your order', reference: order.reference, sub: `Placed ${stamp(d.paid)}`, rightLabel: 'Paid', rightValue: money(order.total) })}
  ${journey([
    { label: 'Paid', date: `${d.paidIso === d.today ? 'Today' : shortDay(d.paidIso)}, ${d.paidTime}`, state: 'done' },
    { label: 'Leaves us', date: today ? 'Today' : shortDay(d.leaves), state: 'next' },
    { label: gift ? 'With them' : 'With you', date: windowShort(d.from, d.to), state: 'later' },
  ])}
  ${button(link_, 'Track your order')}
  ${small(`Or keep the ${link(`${shop.site}/receipt/${encodeURIComponent(order.reference)}?token=${encodeURIComponent(order.access_token ?? '')}`, 'receipt')} for your records. The link is yours alone, so keep this email.`, 14)}
`, { bottom: 0 })}
${row(`
  ${rule()}
  ${label('What you bought', 26)}
  ${items(lines)}
  ${totals([
    { label: 'Items', value: money(order.subtotal) },
    Number(order.delivery) > 0
      ? { label: 'Delivery', value: money(order.delivery) }
      : { label: 'Delivery', value: 'Free', free: true },
    { label: 'Paid', value: money(order.total), grand: true },
  ])}
  ${parcel({ shop: shop.brand.name, name: deliverTo(order), address: where.lines, postcode: where.postcode, gift })}
  ${giftNote ? small(giftNote, 14) : ''}
  ${small(today
    ? 'If any of that is wrong, reply now and we will fix it before it goes.'
    : `If any of that is wrong, reply before ${esc(weekday(d.leaves))} morning and we will fix it before it goes.`, giftNote ? 8 : 14)}
`, { top: 30 })}
${rights(order.items ?? [], shop.trader, shop.cfg)}`;

  const n = units(order.items ?? []);
  return mail({
    subject: `Paid: order ${order.reference}`,
    preheader: `${plural(n, 'item')}, ${money(order.total)}. It leaves us ${today ? 'today' : weekday(d.leaves)} and should be with ${gift ? them ?? 'them' : 'you'} ${windowLong(d.from, d.to)}.`,
    body,
    brand: shop.brand,
    footer: customerFooter(shop),
  });
}
