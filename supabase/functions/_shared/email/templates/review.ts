// deno-lint-ignore-file no-explicit-any
/*
 * Seven days after it left, not after payment, so it asks about a thing they
 * have actually held. A question rather than "Leave a review", which reads as
 * a demand from a company.
 */
import { C, TEXT, button, esc, h1, items, kicker, label, mail, p, row, small, strong } from '../kit.ts';
import { type Shop, customerFooter, lineOf } from '../context.ts';
import { longDay, orderDates } from '../dates.ts';

export function review(order: any, shop: Shop, now = new Date()) {
  const d = orderDates(order, shop.cfg.delivery, now);
  const list = order.items ?? [];
  const base = `${shop.site}/review/${encodeURIComponent(order.reference)}?token=${encodeURIComponent(order.access_token ?? '')}`;

  // Named, so the ask is about things rather than an order number. A comma before the rest, not a second "and".
  const named = list.slice(0, 2).map((i: any) => (i.variant_label ? `${i.title}, ${i.variant_label}` : i.title));
  const rest = list.length - named.length;
  const what = named.length
    ? `${named.join(' and ')}${rest > 0 ? `, and the ${rest === 1 ? 'other one' : `other ${rest}`}` : ''}`
    : 'what you ordered';

  // Each star opens the review page with that rating already chosen.
  const stars = [1, 2, 3, 4, 5].map((n) => `<td style="padding-right:6px;"><a href="${esc(`${base}&rating=${n}`)}" title="${n} out of 5" style="display:block;width:44px;height:44px;border:1.5px solid ${C.lineMid};border-radius:10px;background:${C.paper};text-align:center;text-decoration:none;font:400 24px/44px ${TEXT};color:${C.terra};">&#9733;</a></td>`).join('');

  const body = row(`
  ${kicker('A week on')}
  ${h1('How did you get on?')}
  ${p(`Your parcel should have reached you by ${strong(esc(longDay(d.to)))}. It takes a minute, and it is what decides whether the next person buys. Stars are enough. Words are a bonus.`)}
  ${items(list.map(lineOf), { prices: false })}
  ${label('Tap a star to start', 28)}
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px;"><tr>${stars}</tr></table>
  ${button(base, 'Say how it went')}
  ${small(`Order ${esc(order.reference)}. Nothing goes on the shop until a person has read it. If something went wrong instead, reply to this email and it gets sorted rather than published.`, 18)}
`);

  return mail({
    subject: 'How did you get on?',
    preheader: `How was ${what}? Stars are enough.`,
    body,
    brand: shop.brand,
    footer: customerFooter(shop),
  });
}
