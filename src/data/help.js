import { replyPromise, storeConfig } from '@lib/storeConfig';
import { anchorFor, gbp, joinOr, legalTerms, legalTrader, traderIdentity, word, zoneLabel } from '@data/legal';

// Every answer restates something the terms, the returns page or Settings already say. Nothing here is a new promise.

export const TOPICS = [
  { key: 'delivery', label: 'Delivery', short: 'Delivery' },
  { key: 'returns', label: 'Returns and problems', short: 'Returns' },
  { key: 'ordering', label: 'Ordering and payment', short: 'Ordering' },
  { key: 'shop', label: 'About the shop', short: 'The shop' },
];

export function faq() {
  const T = legalTerms();
  const tr = legalTrader();
  const who = traderIdentity(tr);
  const zones = storeConfig().delivery.zones ?? {};
  const open = Object.entries(zones).filter(([, z]) => !z.blocked).map(([k]) => zoneLabel(k));
  const blocked = Object.entries(zones).filter(([, z]) => z.blocked).map(([k]) => zoneLabel(k));
  const transit = T.transitMin === T.transitMax ? word(T.transitMax) : `${word(T.transitMin)} to ${word(T.transitMax)}`;
  const customerPays = T.postagePaidBy === 'customer';

  const items = [
    {
      topic: 'delivery',
      q: 'How much is delivery, and how fast is it?',
      chip: `${gbp(T.postage)}, free from ${gbp(T.freeDeliveryOver)}`,
      a: [
        `${gbp(T.postage)} to anywhere we deliver in the UK, and free when the goods in your order come to ${gbp(T.freeDeliveryOver)} or more.`,
        `Order before ${T.dispatchCutoff} on a working day and it is sent that day. Most parcels arrive ${transit} working days later.`,
      ],
      link: { label: 'Delivery in full', to: '/legal/delivery' },
    },
    {
      topic: 'delivery',
      q: 'Can I send it to someone else?',
      chip: 'Yes',
      a: [
        'Yes. Put their name and address at the checkout and your own email, so the confirmation and the tracking link come to you.',
        open.length ? `We deliver to ${joinOr(open)}${blocked.length ? `, but not to ${joinOr(blocked, 'or')}` : ''}.` : null,
      ],
    },
    {
      topic: 'delivery',
      q: 'How do I track my order?',
      chip: 'From your dispatch email',
      a: ['Your dispatch email has the tracking link. You can also look your order up on the tracking page with its order reference.'],
      link: { label: 'Track an order', to: '/orders' },
    },
    {
      topic: 'returns',
      q: 'Can I return something?',
      chip: `${T.returnDays} days`,
      a: [
        `Yes, within ${T.returnDays} days of receiving it, for any reason. ${customerPays ? 'Return postage is yours to pay unless it is faulty.' : 'We pay the return postage.'}`,
        'Sealed hygiene products cannot come back once opened unless they are faulty, and each product page says whether this applies.',
      ],
      link: { label: 'Returns and refunds', to: '/legal/returns' },
    },
    {
      topic: 'returns',
      q: 'What if it arrives damaged or faulty?',
      chip: 'Full refund in 30 days',
      a: [
        'Tell us within 30 days of delivery, with a photograph if you can, and you can have a full refund. After that you can ask for a repair or a replacement.',
        'We pay the postage on anything faulty or not as described.',
      ],
      link: { label: 'Your rights if something is wrong', to: '/legal/returns#if-something-is-faulty-or-not-as-described' },
    },
    {
      topic: 'returns',
      q: 'Can I change or cancel my order?',
      chip: 'Until it is sent',
      a: [
        'Yes, until it has been dispatched, and you are refunded in full. Write to us with your order reference as soon as you can.',
        `Once it has been sent, you can still return it within ${T.returnDays} days.`,
      ],
      link: { label: 'How to cancel', to: '/legal/returns#how-to-cancel' },
    },
    {
      topic: 'ordering',
      q: 'Do I need an account?',
      chip: 'No account',
      a: ['No. You give your email and delivery address at the checkout, and your order reference lets you look the order up later.'],
    },
    {
      topic: 'ordering',
      q: 'When am I charged?',
      chip: 'When you order',
      a: ['When you place your order. If we cannot send it, for example because it has sold out, we tell you and refund you in full.'],
      link: { label: 'Terms of sale', to: '/legal/terms#how-an-order-works' },
    },
    {
      topic: 'ordering',
      q: 'Is my card safe?',
      chip: 'Yes, Stripe takes it',
      a: ['Payment is taken by Stripe on its own secure page. Your card details never reach this shop.'],
    },
    {
      topic: 'ordering',
      q: 'Do you charge VAT?',
      chip: tr.vat ? 'Included in prices' : 'No VAT',
      a: [tr.vat
        ? 'Prices include VAT, so the price you see is the price you pay.'
        : 'No. We are not registered for VAT, so the price you see is the full price.'],
    },
    {
      topic: 'shop',
      q: 'You do not stock what I need. Can you find it?',
      chip: 'Often, yes',
      a: ['Often, yes. Tell us what you are looking for and we will let you know if we can get it.'],
      link: { label: 'Ask for something', to: '/request' },
    },
    {
      topic: 'shop',
      q: 'Who am I buying from?',
      chip: tr.tradingAs ?? undefined,
      // No street address here: it is an online shop, and the terms carry the address the law asks for.
      a: [`${who ?? tr.tradingAs ?? 'A UK business'}${who || tr.tradingAs ? ', a UK business' : ''}. The terms of sale give our full details.`],
      link: { label: 'Terms of sale', to: '/legal/terms' },
    },
    {
      topic: 'shop',
      q: 'How do I reach a person?',
      chip: replyPromise().replace(/^./, (c) => c.toUpperCase()),
      a: [`Write to ${tr.email}. A person reads every message and replies ${replyPromise()}.`],
      link: { label: 'Contact us', to: '/contact' },
    },
  ];

  return items.map((item) => ({ ...item, id: anchorFor(item.q), a: item.a.filter(Boolean) }));
}
