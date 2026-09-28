// deno-lint-ignore-file no-explicit-any
/*
 * A customer's message, to the shop. Each one they send.
 *
 * Answered in the portal rather than by reply: an email answered directly
 * never reaches the thread, so the record splits and the customer's link
 * shows a conversation with no answer in it.
 */
import { button, esc, h1, kicker, mail, money, p, row, small, strong, bubble } from '../kit.ts';
import { type Shop, type Topic, basketTotal, firstName, shopFooter, topicName } from '../context.ts';
import { when } from '../dates.ts';
import { topicBlock } from './topic.ts';

export function toShop(message: any, thread: any, topic: Topic, shop: Shop) {
  const who = thread.name || thread.email || 'Someone';
  const first = firstName(thread.name) ?? 'Someone';
  const said = String(message.body ?? '').replace(/\s+/g, ' ').trim();

  const body = row(`
  ${kicker('A question')}
  ${h1(`${esc(first)} has a question.`)}
  ${topicBlock(topic, { forShop: true })}
  ${bubble({ who, when: when(new Date(message.created_at ?? Date.now())), body: message.body })}
  ${topic.basket?.length ? p(`Their basket comes to ${strong(money(basketTotal(topic.basket)))} before delivery.`, { size: 15, top: 16 }) : ''}
  ${button(`${shop.portal}/messages`, 'Answer it')}
  ${small(`Answer in the portal rather than replying here, so your reply reaches ${esc(first === 'Someone' ? 'them' : first)} and stays with the conversation. You can give a price from there.`, 16)}
`);

  return mail({
    subject: `Question about ${topicName(topic, { withTotal: true })}`,
    preheader: `${first}: ${said}`.slice(0, 140),
    body,
    brand: shop.brand,
    footer: shopFooter(shop, 'Sent to you by your portal for each customer message.'),
  });
}
