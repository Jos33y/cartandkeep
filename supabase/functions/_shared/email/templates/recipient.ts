// deno-lint-ignore-file no-explicit-any
/*
 * The one email a gift's recipient can get, and only when the buyer asked.
 *
 * No prices, no list of what is inside, and no receipt: it says who sent
 * something and when it should arrive, so the surprise is the parcel.
 */
import { button, esc, footer, h1, kicker, mail, p, parcel, row, small, strong } from '../kit.ts';
import { type Shop, addressOf, firstName, identityLine } from '../context.ts';
import { orderDates, windowLong } from '../dates.ts';

export function recipient(order: any, shop: Shop, now = new Date()) {
  const d = orderDates({ ...order, dispatched_at: order.dispatched_at ?? now.toISOString() }, shop.cfg.delivery, now);
  const from = firstName(order.name) ?? 'Someone';
  const where = addressOf(order);
  const today = d.leaves === d.today;

  const body = row(`
  ${kicker('Something for you', 'terra')}
  ${h1(`${esc(from)} has sent you something.`)}
  ${p(`It left us ${today ? 'today' : 'recently'} and should reach you ${strong(esc(windowLong(d.from, d.to)))}. We will not say what it is. That part is ${esc(from)}&#39;s.`)}
  ${parcel({
    shop: shop.brand.name, name: order.recipient_name ?? '', address: where.lines, postcode: where.postcode,
    gift: true, heading: 'On its way to', from: `${from}${order.gift_message ? ', with a note inside' : ''}`,
  })}
  ${order.tracking_url ? button(order.tracking_url, 'Follow the parcel') : ''}
  ${small(`There are no prices in the box.${order.gift_message ? ` The slip inside carries ${esc(from)}&#39;s message.` : ''}`, 14)}
`);

  return mail({
    subject: `${from} has sent you something`,
    preheader: `It should reach you ${windowLong(d.from, d.to)}. We will not say what it is.`,
    body,
    brand: shop.brand,
    footer: footer({
      brand: shop.brand,
      identity: identityLine(shop.trader),
      note: `We only have your email because ${esc(from)} asked us to tell you it was coming. We will not use it again.`,
    }),
  });
}
