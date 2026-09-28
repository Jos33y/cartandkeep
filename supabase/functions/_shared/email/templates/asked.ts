// deno-lint-ignore-file no-explicit-any
/*
 * We have your question. Once, on the first message of a conversation.
 *
 * It answers nothing, so it is not an automated reply. It carries the only
 * route back to the conversation, which is why it goes at all.
 */
import { button, h1, kicker, mail, p, panel, row, bubble } from '../kit.ts';
import { type Shop, type Topic, customerFooter, topicName } from '../context.ts';
import { when } from '../dates.ts';
import { topicBlock } from './topic.ts';

export function asked(message: any, topic: Topic, link: string, shop: Shop) {
  const name = topicName(topic);
  const body = row(`
  ${kicker('Question received')}
  ${h1('We have your question.')}
  ${p('A person reads every one of these and answers it themselves, so this is not the answer. You will get an email when there is one.')}
  ${topicBlock(topic)}
  ${bubble({ who: 'You', when: when(new Date(message.created_at ?? Date.now())), body: message.body })}
  ${button(link, 'See your question')}
  ${panel(`<b>Keep this email.</b> That link is the way back to the conversation, and only you have it.`, 'gold', 24)}
`);

  return mail({
    subject: 'We have your question',
    preheader: `About ${name}. A person answers every one. Keep this email: its link is the way back.`,
    body,
    brand: shop.brand,
    footer: customerFooter(shop, 'Write back from the conversation page, so everything stays in one place.'),
  });
}
