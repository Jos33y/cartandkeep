// deno-lint-ignore-file no-explicit-any
/*
 * The shop has answered. Each time she writes back.
 *
 * The price panel only when she gave one, and it carries the figure and the
 * day it runs to and nothing else. A former price beside it turns a price
 * given to one person into a price claim about the shop.
 */
import { C, DISPLAY, TEXT, button, buttons, esc, h1, kicker, mail, money, row, small, bubble } from '../kit.ts';
import { type Shop, type Topic, customerFooter, topicName } from '../context.ts';
import { isoOf, longDay, when } from '../dates.ts';
import { topicBlock } from './topic.ts';

export function reply(message: any, topic: Topic, link: string, offer: any, shop: Shop) {
  const name = topicName(topic);
  const until = offer?.expires_at ? longDay(isoOf(new Date(offer.expires_at))) : null;

  const price = offer ? `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:22px;"><tr><td style="padding:20px 22px;background:${C.paper};border:1.5px dashed ${C.terra};border-radius:14px;">
    <p style="margin:0;font:700 11px/14px ${TEXT};letter-spacing:0.12em;text-transform:uppercase;color:${C.terraText};">A price for you</p>
    <p style="margin:6px 0 0;font:700 34px/38px ${DISPLAY};letter-spacing:-0.01em;color:${C.ink};">${money(offer.price)} <span style="font:400 16px/20px ${TEXT};color:${C.soft};letter-spacing:0;">for this</span></p>
    <p style="margin:6px 0 0;font:400 14px/21px ${TEXT};color:${C.soft};">${until ? `Yours until ${esc(until)}. ` : ''}Open the conversation to take it.</p>
  </td></tr></table>` : '';

  const body = row(`
  ${kicker('A reply from the shop')}
  ${h1('Here is your answer.')}
  ${topicBlock(topic)}
  ${bubble({ who: message.author_name || shop.brand.name, when: when(new Date(message.created_at ?? Date.now())), body: message.body, shop: true })}
  ${price}
  ${offer
    ? buttons(button(link, 'Take this price'), button(link, 'Write back', { tone: 'ghost' }))
    : button(link, 'Write back')}
  ${small('Only you have this link. Nothing in the conversation appears anywhere else on the shop.', 18)}
`);

  const said = String(message.body ?? '').replace(/\s+/g, ' ').trim();
  return mail({
    subject: `About ${name}`,
    preheader: offer
      ? `${money(offer.price)} for you${until ? ` until ${until}` : ''}. ${said}`.slice(0, 140)
      : said.slice(0, 140),
    body,
    brand: shop.brand,
    footer: customerFooter(shop, 'Write back from the conversation page, so everything stays in one place.'),
  });
}
