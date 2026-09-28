// deno-lint-ignore-file no-explicit-any
/*
 * On its way. When she marks it sent in the portal.
 *
 * No repeat of the rights section. They already have it, and a second copy
 * trains people to ignore both.
 */
import { C, MONO, TEXT, button, esc, h1, items, journey, kicker, label, mail, p, panel, row, rule, strong, ticket } from '../kit.ts';
import { type Shop, customerFooter, firstName, lineOf, orderLink, plural, units } from '../context.ts';
import { addWorkingDays, longDay, orderDates, shortDay, windowLong, windowShort } from '../dates.ts';

export function dispatch(order: any, shop: Shop, now = new Date()) {
  const d = orderDates({ ...order, dispatched_at: order.dispatched_at ?? now.toISOString() }, shop.cfg.delivery, now);
  const gift = Boolean(order.is_gift);
  const who = gift ? esc(firstName(order.recipient_name) ?? 'them') : 'you';
  const carrier = order.carrier ? String(order.carrier) : null;
  const chase = addWorkingDays(d.to, 3);
  const today = d.leaves === d.today;
  const n = units(order.items ?? []);

  const tracking = order.tracking_number || order.tracking_url ? panel(`
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td class="stack" valign="middle">
        <p style="margin:0;font:700 11px/14px ${TEXT};letter-spacing:0.12em;text-transform:uppercase;color:${C.sage};">${esc(carrier ? `${carrier} tracking` : 'Tracking')}</p>
        ${order.tracking_number ? `<p style="margin:4px 0 0;font:600 18px/24px ${MONO};letter-spacing:0.04em;color:${C.ink};">${esc(order.tracking_number)}</p>` : ''}
      </td>
      ${order.tracking_url ? `<td class="stack stack-gap" valign="middle" align="right" style="padding-left:12px;white-space:nowrap;">
        <a href="${esc(order.tracking_url)}" style="font:600 15px/20px ${TEXT};color:${C.sage};text-decoration:underline;text-underline-offset:3px;">${esc(carrier ? `Follow it with ${carrier}` : 'Follow the parcel')}</a>
      </td>` : ''}
    </tr></table>`, 'sage', 26) : '';

  const body = `
${row(`
  ${kicker('On its way')}
  ${h1(today ? 'It left us today.' : `It left us on ${esc(longDay(d.leaves))}.`)}
  ${p(`${carrier ? `${esc(carrier)} has it now` : 'It is with the carrier now'}, and it should be with ${who} ${esc(windowLong(d.from, d.to))}.`)}
  ${ticket({ label: 'Your order', reference: order.reference, sub: `${plural(n, 'item')}, sent ${shortDay(d.leaves)}` })}
  ${journey([
    { label: 'Paid', date: shortDay(d.paidIso), state: 'done' },
    { label: 'Left us', date: `${today ? 'Today' : shortDay(d.leaves)}${carrier ? `, ${carrier}` : ''}`, state: 'done' },
    { label: gift ? 'With them' : 'With you', date: windowShort(d.from, d.to), state: 'next' },
  ])}
  ${tracking}
  ${button(orderLink(shop, order), 'Your order page', { tone: 'ghost', top: 24 })}
`, { bottom: 0 })}
${row(`
  ${rule()}
  ${label('In the parcel', 26)}
  ${items((order.items ?? []).map(lineOf), { prices: false })}
  ${panel(`Nothing by ${strong(esc(longDay(chase)))}? Reply to this email and we will chase it${carrier ? ` with ${esc(carrier)}` : ''} for you.`, 'plain', 24)}
`, { top: 30 })}`;

  return mail({
    subject: `On its way: order ${order.reference}`,
    preheader: `${carrier ? `${carrier} has it` : 'It has left us'}. Due with ${gift ? firstName(order.recipient_name) ?? 'them' : 'you'} ${windowLong(d.from, d.to)}${order.tracking_number ? ', tracking inside' : ''}.`,
    body,
    brand: shop.brand,
    footer: customerFooter(shop),
  });
}
