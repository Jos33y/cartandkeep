import { storeConfig, supportEmail, trader, returnsTerms, privacyTerms, replyPromise } from '@lib/storeConfig';

// Block types: h, p, list, note, form, control, confirm.
// `basis` is the law a block answers to; the page ignores it, the review pack prints it.
// `review` is a note for the trader; it renders in development and in the review pack, never to a customer.
// A confirm block is a missing fact: its note is for the trader, its `show` is what a customer sees meanwhile.

export const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
export const word = (n) => WORDS[n] ?? String(n);
export const gbp = (n) => (Number.isInteger(Number(n)) ? `£${Number(n)}` : `£${Number(n).toFixed(2)}`);
const hour12 = (h) => (h === 12 ? '12pm' : h > 12 ? `${h - 12}pm` : `${h}am`);

const ZONE_LABEL = {
  mainland: 'mainland Great Britain',
  highlands: 'the Scottish Highlands and Islands',
  northern_ireland: 'Northern Ireland',
  isle_of_man: 'the Isle of Man',
  isles_of_scilly: 'the Isles of Scilly',
  channel_islands: 'the Channel Islands',
};
export const zoneLabel = (key) => ZONE_LABEL[key] ?? key.replace(/_/g, ' ');

export const joinOr = (items, last = 'and') =>
  items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} ${last} ${items.at(-1)}`;

const keep = (...blocks) => blocks.flat().filter(Boolean);

const CRA = 'Consumer Rights Act 2015';
const CCR = 'Consumer Contracts (Information, Cancellation and Additional Charges) Regulations 2013';
const ECR = 'Electronic Commerce (EC Directive) Regulations 2002';

export function legalTerms() {
  const c = storeConfig();
  const r = returnsTerms();
  const d = c.delivery;
  return {
    freeDeliveryOver: d.freeOver,
    postage: d.postage,
    transitMin: d.transitMin ?? 2,
    transitMax: d.transitMax ?? 3,
    returnDays: r.days ?? 30,
    statutoryDays: r.statutoryDays ?? 14,
    dispatchCutoff: hour12(d.cutoffHour ?? 14),
    postagePaidBy: r.postagePaidBy ?? null,
    retentionYears: privacyTerms().retentionYears ?? null,
  };
}

export function legalTrader() {
  const t = trader();
  const tradingAs = t.tradingAs || storeConfig().shopName || null;
  return {
    name: t.name || null,
    tradingAs,
    address: t.address || null,
    company: t.company || null,
    // Returns go to the trading address unless she has given a separate one.
    returnAddress: t.returnAddress || t.address || null,
    vat: t.vat || null,
    complaintsUrl: t.complaintsUrl || null,
    email: supportEmail(),
  };
}

// Read through on every access: settings resolve after this module loads.
export const TRADER = new Proxy({}, {
  get: (_, key) => legalTrader()[key],
  has: (_, key) => key in legalTrader(),
  ownKeys: () => Reflect.ownKeys(legalTrader()),
  getOwnPropertyDescriptor: (_, key) => ({ value: legalTrader()[key], enumerable: true, configurable: true }),
});

// A name ending Ltd or Limited says company, whether or not the number has been entered yet.
const COMPANY_SUFFIX = /\b(ltd|limited|plc|llp)\.?\s*$/i;
export const claimsCompany = (tr) => Boolean(tr.company) || COMPANY_SUFFIX.test(String(tr.name ?? '').trim());

// Where a company is registered, read from its number: SC is Scotland, NI is Northern Ireland, the rest England and Wales.
export function registeredIn(number) {
  const n = String(number ?? '').trim().toUpperCase();
  if (n.startsWith('SC') || n.startsWith('SO')) return 'Scotland';
  if (n.startsWith('NI') || n.startsWith('NC') || n.startsWith('R')) return 'Northern Ireland';
  return 'England and Wales';
}

// "Jane Smith, trading as Corner Shop", or the company, or null until the trader sets it.
export function traderIdentity(tr = legalTrader()) {
  if (!tr.name) return null;
  const as = tr.tradingAs && tr.tradingAs !== tr.name ? `, trading as ${tr.tradingAs}` : '';
  if (tr.company) return `${tr.name}, a company registered in ${registeredIn(tr.company)}, number ${tr.company}${as}`;
  return `${tr.name}${as}`;
}

// The address, named for what the law calls it: a company's is its registered office.
const addressOf = (tr) => (tr.company ? `whose registered office is at ${tr.address}` : `of ${tr.address}`);

const ask = (v, show = null, extra = {}) => ({ t: 'confirm', v, show, ...extra });

function deliveryPage(T, tr) {
  const zones = storeConfig().delivery.zones ?? {};
  const open = Object.entries(zones).filter(([, z]) => !z.blocked);
  const blocked = Object.entries(zones).filter(([, z]) => z.blocked).map(([k]) => zoneLabel(k));
  const charged = open.filter(([, z]) => Number(z.surcharge) > 0);
  const slower = open.filter(([, z]) => Number(z.extraDays) > 0);
  const transit = T.transitMin === T.transitMax ? word(T.transitMax) : `${word(T.transitMin)} to ${word(T.transitMax)}`;

  return keep(
    { t: 'p', v: `UK delivery costs ${gbp(T.postage)}. It is free when the goods in your order come to ${gbp(T.freeDeliveryOver)} or more. The delivery charge is shown in your basket and again before you pay, and nothing is added after that.`,
      basis: `${CCR}, reg. 13 and Sch. 2` },
    charged.length > 0 && { t: 'p', v: `A surcharge applies where the carrier charges us more to deliver: ${joinOr(charged.map(([k, z]) => `${gbp(z.surcharge)} to ${zoneLabel(k)}`))}. It applies whatever your order total, and it is added at the checkout before you pay.` },
    charged.length === 0 && open.length > 1 && ask(
      'Whether the Highlands, Islands, Isle of Man and Isles of Scilly carry a surcharge. Every zone is at zero, so the shop absorbs what the carrier charges extra. Set in Settings; this page follows it.',
      null, { owner: 'trader' }),

    { t: 'h', v: 'How long it takes' },
    { t: 'p', v: `Orders placed before ${T.dispatchCutoff} on a working day are dispatched that day. Orders placed later, or on a weekend or bank holiday, are dispatched the next working day. Most arrive ${transit} working days after dispatch.`,
      basis: `${CRA}, s. 28` },
    slower.length > 0 && { t: 'p', v: `Allow longer for ${joinOr(slower.map(([k, z]) => `${zoneLabel(k)} (up to ${word(Number(z.extraDays))} more working ${Number(z.extraDays) === 1 ? 'day' : 'days'})`))}.` },
    { t: 'p', v: 'A working day is Monday to Friday, other than a bank holiday.' },

    { t: 'h', v: 'Where we deliver' },
    { t: 'p', v: `We deliver to ${joinOr(open.map(([k]) => zoneLabel(k)))}.${blocked.length ? ` We cannot deliver to ${joinOr(blocked, 'or')}, and the checkout will not accept an address there.` : ''} We do not deliver anywhere else.` },

    { t: 'h', v: 'Tracking your order' },
    { t: 'p', v: 'Your order confirmation email carries your order reference. When the parcel leaves us you receive a second email with the carrier and the tracking link.' },

    { t: 'h', v: 'If your parcel is late or does not arrive' },
    { t: 'p', v: 'The parcel is our responsibility until it reaches you, or a person or safe place you have named to receive it.',
      basis: `${CRA}, s. 29` },
    { t: 'p', v: `If it has not arrived five working days after the dispatch email, write to ${tr.email} with your order reference and we will trace it. If the carrier cannot find it, we send a replacement or refund you in full, whichever you prefer.`,
      review: 'Five working days before tracing, and replacement or refund at the customer\u2019s choice, are promises. The law puts the risk on you until delivery, so the outcome is the same; the five days is yours to change.' },
    { t: 'p', v: 'If we have not delivered within 30 days of your order, you may cancel it and we will refund everything you have paid.',
      basis: `${CRA}, s. 28`,
      review: 'Slightly more generous than s. 28, which lets the customer set a further period before ending the contract. Simpler to state and to honour.' },
  );
}

function returnsPage(T, tr) {
  const extended = T.returnDays > T.statutoryDays;

  const postage = T.postagePaidBy === 'customer'
    ? { t: 'p', v: 'If you return something because you have changed your mind, the cost of sending it back is yours. If it is faulty or not as described, we pay.',
        basis: `${CCR}, reg. 35 and Sch. 2` }
    : { t: 'p', v: 'We pay the cost of sending it back, whether you have changed your mind or something is wrong with it.',
        basis: `${CCR}, reg. 35`,
        review: T.postagePaidBy === 'us' ? 'Free return postage on a change of mind is a commercial choice, not a legal requirement. It costs roughly £3 a return on items that often clear £3 to £5. The receipt already promises it; changing the setting changes both.' : null };

  return keep(
    { t: 'h', v: 'Changing your mind' },
    { t: 'p', v: `You can cancel your order within ${T.statutoryDays} days of the day you receive it, without giving any reason. That is your legal right.${extended ? ` We extend it to ${T.returnDays} days, on exactly the same terms.` : ''}`,
      basis: `${CCR}, regs. 29 and 30` },
    { t: 'p', v: 'If your order arrives in more than one parcel, the time runs from the day the last one arrives. You can also cancel before it has been dispatched.',
      basis: `${CCR}, reg. 30` },

    { t: 'h', v: 'How to cancel' },
    { t: 'p', v: `Tell us clearly that you want to cancel. The simplest way is an email to ${tr.email} with your order reference. You can use the form at the foot of this page if you prefer, but you do not have to.`,
      basis: `${CCR}, reg. 32 and Sch. 3` },
    { t: 'p', v: `Once you have told us, send the goods back within 14 days.`,
      basis: `${CCR}, reg. 35` },

    { t: 'h', v: 'Handling what you receive' },
    { t: 'p', v: 'You can handle what you receive as you would in a shop, to see what it is and check that it works. If it has been handled more than that and has lost value as a result, we may reduce your refund by that loss. Returning it in its original packaging, where you can, helps us sell it again, but it is not a condition of your refund.',
      basis: `${CCR}, reg. 34` },

    { t: 'h', v: 'What cannot be returned if you change your mind' },
    { t: 'list', v: [
      'Goods sealed for health or hygiene reasons, such as incontinence products, creams and toiletries, once you have broken the seal.',
      'Goods made to your specification or clearly personalised.',
      'Goods that deteriorate or expire rapidly.',
    ], basis: `${CCR}, reg. 28` },
    { t: 'p', v: 'Each product page says before you buy whether the first of these applies to it. None of this affects your rights if something is faulty.',
      review: 'The hygiene exception only holds if the customer was told before buying. That depends on every sealed product carrying its returns class on the product page, which is checked when the product page is built.' },

    { t: 'h', v: 'Your refund' },
    { t: 'p', v: 'We refund what you paid for the goods, and the delivery charge you paid on the order. If you return only part of an order, the delivery charge is refunded only when the whole order comes back. The refund goes back to the card you paid with, and there is no fee.',
      basis: `${CCR}, reg. 34`,
      review: 'Outbound delivery must be refunded when a whole order is cancelled. On a part return it need not be, which is the usual reading of the regulations and of the government guidance on them.' },
    { t: 'p', v: 'We refund within 14 days of receiving the goods back, or of you sending us proof that you have posted them, whichever is sooner. If you cancel before we have dispatched, we refund within 14 days of you telling us.',
      basis: `${CCR}, reg. 34` },

    { t: 'h', v: 'Return postage' },
    postage,

    { t: 'h', v: 'Where to send it' },
    tr.returnAddress
      ? { t: 'p', v: `Send returns to ${tr.returnAddress}. Please include your order reference inside the parcel.` }
      : ask('Your address. Returns go to your trading address unless you set a separate return address, and a customer cannot complete a return without one.',
          { t: 'p', v: `Write to ${tr.email} with your order reference and we will send you the address to use.` },
          { owner: 'trader' }),

    { t: 'h', v: 'If something is faulty or not as described' },
    { t: 'p', v: 'Goods must be of satisfactory quality, fit for purpose and as described. If they are not, you have these rights whether or not you have changed your mind, and whatever we say anywhere else.',
      basis: `${CRA}, ss. 9 to 11 and 31` },
    { t: 'list', v: [
      'Within 30 days of delivery, you can reject the goods and have a full refund.',
      'After 30 days, you can ask for a repair or a replacement. If that is not possible, or it does not fix the problem, you can have a refund or a reduction in price.',
      'Within the first six months, a refund is in full. After six months it may be reduced to reflect the use you have had, and we may ask you to show the fault was there when the goods were delivered.',
      'You can make a claim for up to six years from delivery, or five years in Scotland.',
    ], basis: `${CRA}, ss. 19 to 24; Limitation Act 1980, s. 5; Prescription and Limitation (Scotland) Act 1973` },
    { t: 'p', v: `Tell us at ${tr.email} what has gone wrong, with a photograph if you can. We pay the cost of returning faulty goods.`,
      basis: `${CRA}, s. 20` },

    { t: 'h', v: 'Cancellation form' },
    { t: 'p', v: 'Copy this into an email, or print it and post it to us. Complete and return it only if you want to cancel.' },
    { t: 'form',
      to: [traderIdentity(tr) ?? tr.tradingAs, tr.address, tr.email].filter(Boolean),
      lines: [
        'I/We* hereby give notice that I/We* cancel my/our* contract of sale of the following goods:',
        'Order reference:',
        'Ordered on* / received on*:',
        'Name of consumer(s):',
        'Address of consumer(s):',
        'Signature of consumer(s) (only if this form is sent on paper):',
        'Date:',
      ],
      foot: '* Delete as appropriate.',
      basis: `${CCR}, Sch. 3, Part B (model cancellation form)` },
  );
}

function termsPage(T, tr) {
  const who = traderIdentity(tr);
  const identity = who && tr.address
    ? { t: 'p', v: `This shop is run by ${who}, ${addressOf(tr)}. You can contact us at ${tr.email}.${tr.vat ? ` Our VAT number is ${tr.vat}.` : ''}`,
        basis: `${ECR}, reg. 6; ${CCR}, Sch. 2; Companies Act 2006, s. 1202` }
    : ask('Your legal name and a geographic address. The law requires both before an order is placed, and as a sole trader your own name has to appear beside the trading name. Entered once in Settings.',
        { t: 'p', v: `${tr.tradingAs ? `This shop trades as ${tr.tradingAs}. ` : ''}You can contact us at ${tr.email}.` },
        { owner: 'trader', basis: `${ECR}, reg. 6; Companies Act 2006, s. 1202` });

  return keep(
    { t: 'h', v: 'About us' },
    identity,

    { t: 'h', v: 'These terms' },
    { t: 'p', v: 'These terms apply to every order placed through this website by a consumer in the UK. The terms that apply to your order are the ones shown here when you placed it. We may change them for future orders.' },

    { t: 'h', v: 'How an order works' },
    { t: 'list', v: [
      'You add products to your basket. You can change quantities or remove anything there.',
      'At the checkout you enter your email and delivery address. You can check and correct them before you continue to payment.',
      'You pay on a secure page run by Stripe, our payment provider. Your card details are entered there and never reach us.',
      'We email you to confirm we have received your order. That email is not yet acceptance of it.',
      'The contract between us is made when we email you to say your order has been dispatched.',
    ], basis: `${ECR}, regs. 9 and 11` },
    { t: 'p', v: 'Your confirmation emails hold a copy of your order. You can also look it up at any time with your order reference. These terms are available in English only.',
      basis: `${ECR}, reg. 9(1)(b) and (d)` },
    { t: 'p', v: 'We may decline an order, for example if a product is out of stock or a price is wrong. If we do, we tell you and you are not charged, or are refunded in full if you already have been.' },

    { t: 'h', v: 'Products' },
    { t: 'p', v: 'Photographs are of the product, but colours on screen vary and packaging can change between batches. Sizes, weights and limits are given on each product page.' },
    { t: 'p', v: 'Some of what we sell is used in caring for someone. Before use, check the dimensions, weight limits and instructions against the person and the space it is for, and follow the manufacturer\u2019s instructions. If you are unsure whether a product is suitable, an occupational therapist, GP or pharmacist can advise.',
      review: 'Guidance, not an exclusion of liability, so it cannot be unfair under Part 2 of the Consumer Rights Act. It matters most for bed rails, where entrapment is a known risk.' },

    { t: 'h', v: 'Prices and payment' },
    { t: 'p', v: tr.vat
      ? 'Prices are in pounds sterling and include VAT.'
      : 'Prices are in pounds sterling and are the full price you pay. We are not registered for VAT, so no VAT is charged.',
      basis: 'Price Marking Order 2004' },
    { t: 'p', v: 'Delivery is shown separately in your basket and before you pay. Payment is taken when you place your order.' },
    { t: 'p', v: 'If a price on the site is wrong, we tell you before dispatching and you can go ahead at the correct price or cancel for a full refund.' },

    { t: 'h', v: 'Delivery' },
    { t: 'p', v: 'Delivery charges, times and areas are set out on the delivery page. The goods are our responsibility until they reach you, and they become yours once we have received payment in full.',
      basis: `${CRA}, s. 29` },

    { t: 'h', v: 'Cancelling and returns' },
    { t: 'p', v: `You can cancel within ${T.statutoryDays} days of receiving your order${T.returnDays > T.statutoryDays ? `, which we extend to ${T.returnDays} days` : ''}. How to cancel, what cannot be returned and how refunds work are set out in full on the returns page, together with a cancellation form.`,
      basis: `${CCR}, Sch. 2` },

    { t: 'h', v: 'If something is wrong' },
    { t: 'p', v: 'We must supply goods that are of satisfactory quality, fit for purpose and as described. Your rights if they are not are summarised on the returns page. Nothing in these terms affects them.',
      basis: `${CRA}, ss. 9 to 11 and 31` },

    { t: 'h', v: 'Our responsibility for loss or damage' },
    { t: 'p', v: 'If we fail to comply with these terms, we are responsible for loss or damage you suffer that is a foreseeable result of our breaking them or of our failing to use reasonable care and skill. Loss or damage is foreseeable if it is obvious it will happen, or if both of us knew it might happen when the contract was made.',
      review: 'Drafted to the standard structure the CMA accepts for consumer contracts. Please review it in full. It is live because a shop with no liability clause is worse off than one with a fair one.' },
    { t: 'p', v: 'We do not exclude or limit our liability for death or personal injury caused by our negligence, for fraud or fraudulent misrepresentation, for breach of your legal rights in relation to the goods, or for defective products under the Consumer Protection Act 1987.',
      basis: `${CRA}, ss. 31 and 65; Consumer Protection Act 1987, s. 7` },
    { t: 'p', v: 'We sell for domestic and private use. If you use a product for a business, we have no liability to you for loss of profit, loss of business, business interruption or loss of business opportunity.' },

    { t: 'h', v: 'Events outside our control' },
    { t: 'p', v: 'If something outside our control delays your order, we tell you as soon as we can and do what we can to reduce the delay. If the delay is long, you can cancel and we refund you for anything you have paid for and not received.' },

    { t: 'h', v: 'Reviews' },
    { t: 'p', v: 'How reviews are collected and published is set out on the reviews page.' },

    { t: 'h', v: 'Complaints' },
    { t: 'p', v: `If you are unhappy with anything, write to ${tr.email}. We reply ${replyPromise()} and aim to resolve it within 14 days.`,
      basis: `${CCR}, Sch. 2`,
      review: 'A reply within 24 hours and a resolution within 14 days are your own promises, not legal minimums. The studio covers replies when you cannot.' },
    { t: 'p', v: 'If we cannot resolve it, we will tell you in writing, give you the details of an alternative dispute resolution provider, and say whether we will use it. Free, impartial advice is available from the Citizens Advice consumer helpline on 0808 223 1133 in England and Wales, from Consumer Advice Scotland, and from Consumerline in Northern Ireland.',
      basis: 'Alternative Dispute Resolution for Consumer Disputes (Competent Authorities and Information) Regulations 2015, reg. 19' },

    { t: 'h', v: 'Other terms' },
    { t: 'p', v: 'The contract is between you and us. No one else has any rights under it. If a court finds part of these terms unlawful, the rest still applies. If we do not insist straight away that you do something you should, we can still insist on it later.',
      basis: 'Contracts (Rights of Third Parties) Act 1999' },

    { t: 'h', v: 'Which law applies' },
    { t: 'p', v: 'These terms are governed by the law of England and Wales, and you can bring proceedings in the courts of England and Wales. If you live in Scotland you can also bring proceedings in Scotland, and if you live in Northern Ireland, in Northern Ireland.',
      basis: `${CRA}, s. 62 and Sch. 2` },
  );
}

function reviewsPage(tr) {
  return keep(
    { t: 'h', v: 'How we collect them' },
    { t: 'p', v: 'After an order is dispatched, we send the buyer one email asking for a review. The link in it only works for that order. We do not pay for reviews, offer anything in return for them, or ask only the people we expect to be pleased.',
      basis: 'Digital Markets, Competition and Consumers Act 2024, Part 4 and Sch. 20' },
    { t: 'h', v: 'What we publish' },
    { t: 'p', v: 'We publish every genuine review, good or bad, as it was written. We do not edit reviews. We only hold one back if it:' },
    { t: 'list', v: [
      'is abusive, discriminatory or unlawful,',
      'contains someone\u2019s personal details,',
      'is not about the product or the order, or',
      'advertises something.',
    ] },
    { t: 'p', v: 'Reviews appear once we have checked them against those points, usually within two working days. A product with no reviews shows no rating.',
      review: 'Concealing negative reviews is now a banned practice. This commits you to approving reviews only against the four reasons above, never on whether a review is favourable, and the two working days is a promise you should be sure of.' },
    { t: 'h', v: 'Replies and questions' },
    { t: 'p', v: `We may reply publicly under a review. If you think a review breaks these rules, write to ${tr.email}.` },
  );
}

function privacyPage(T, tr) {
  const who = traderIdentity(tr);
  const controller = who && tr.address
    ? { t: 'p', v: `The shop is run by ${who}, ${addressOf(tr)}, who is responsible for your information. Contact us about it at ${tr.email}.`,
        basis: 'UK GDPR, art. 13(1)(a)' }
    : ask('Your legal name and address as the person responsible for customer data. The same entry as the terms page; nothing extra to fill in.',
        { t: 'p', v: `${tr.tradingAs ?? 'This shop'} is responsible for your information. Contact us about it at ${tr.email}.` },
        { owner: 'trader', basis: 'UK GDPR, art. 13(1)(a)' });

  const retention = T.retentionYears
    ? { t: 'p', v: `Order records are kept for ${word(T.retentionYears)} years after the order, because tax law requires it. Messages, questions and requests are kept for as long as they are needed to deal with them and then deleted. Your mailing list address is kept until you unsubscribe, after which we keep your address only so that you are never added again by mistake.`,
        basis: 'UK GDPR, art. 13(2)(a)' }
    : ask('How long order records are kept. Six years is usual because HMRC can ask for records going back that far. Stating a period is a promise, so it goes in only once the deletion behind it runs.',
        { t: 'p', v: 'Order records are kept for as long as tax law requires us to keep them. Messages, questions and requests are kept for as long as they are needed to deal with them. Your mailing list address is kept until you unsubscribe, after which we keep your address only so that you are never added again by mistake.',
          basis: 'UK GDPR, art. 13(2)(a)' },
        { owner: 'trader' });

  return keep(

    { t: 'h', v: 'Who we are' },
    controller,

    { t: 'h', v: 'What we collect, and why' },
    { t: 'list', v: [
      'Your order: your name, email, delivery address, what you bought and any note you add. We need these to fulfil the contract with you, and we keep the records because tax law requires it.',
      'Payment: Stripe takes your payment on its own page. We receive confirmation that you have paid, never your card details.',
      'Gifts: if you send an order to someone else, we take their name and delivery address, and their phone number if you give it for the courier. We take their email only if you ask us to tell them it is on its way, and use it for that one email and nothing else. Give us their details only if you think they would be happy for you to.',
      'Messages and questions: what you write to us and your email address, so we can reply.',
      'Product requests: what you asked us to find and your email, so we can tell you if we find it.',
      'Reviews: what you write and the name you give, which is published with the review. If you leave the name blank, your first name from the order is shown. We rely on our legitimate interest in showing honest feedback to other shoppers.',
      'The review request: one email after dispatch asking for a review of your order. We rely on our legitimate interest, and you can tell us not to send it.',
      'Our mailing list, only if you join it: your email, and the wording you agreed to and when, as a record of your consent. You can unsubscribe from any email.',
      'On your device: after you order, your name, email, phone and your own address are remembered in your browser so the next checkout is quicker, and links to orders you open are kept so you can find them again. These stay on your device and are not sent to us. You can switch either off on the cookies page.',
      'How the shop is used: which pages and products are viewed during a visit, and the website that sent you here. This is tied together by a reference held in your browser tab\u2019s memory, which is gone when you close or reload it. If you place an order, the visit that led to it is linked to the order, so we can see which pages lead to sales. We rely on our legitimate interest in running and improving the shop.',
    ], basis: 'UK GDPR, arts. 6(1) and 13(1)(c)' },
    { t: 'p', v: 'You do not have to give us any of this, but we cannot take or deliver an order without your name, email and address.',
      basis: 'UK GDPR, art. 13(2)(e)' },
    { t: 'p', v: 'We do not make any decision about you by automated means.',
      basis: 'UK GDPR, art. 13(2)(f)' },

    { t: 'h', v: 'Who we share it with' },
    { t: 'p', v: 'Only the companies that help us run the shop, each under contract to use it only for that:' },
    { t: 'list', v: [
      'Stripe, which takes payments. Stripe is also responsible for the data it uses to prevent fraud, under its own privacy notice.',
      'The companies that host this website and our database, and send our emails.',
      'The delivery company carrying your parcel, which receives your name and address.',
    ], basis: 'UK GDPR, art. 13(1)(e) (recipients or categories of recipients)' },
    { t: 'p', v: 'Some of these companies are based outside the UK, in the United States or Europe. Where your information goes to them, it is protected either by the UK Extension to the EU-US Data Privacy Framework, by UK adequacy regulations, or by the International Data Transfer Agreement approved by Parliament.',
      basis: 'UK GDPR, arts. 13(1)(f), 45 and 46; Data Protection (Adequacy) (United States of America) Regulations 2023' },

    { t: 'h', v: 'How long we keep it' },
    retention,

    { t: 'h', v: 'Your rights' },
    { t: 'p', v: 'You have the right to ask for a copy of the information we hold about you, to have it corrected, to have it deleted, to restrict how we use it, to object to how we use it, and to receive it in a form you can take elsewhere. Where we rely on your consent, you can withdraw it at any time.',
      basis: 'UK GDPR, arts. 15 to 21' },
    { t: 'p', v: `Write to ${tr.email}. We reply within one month.` },

    { t: 'h', v: 'Complaints' },
    { t: 'p', v: `If you are unhappy with how we have handled your information, write to us first at ${tr.email}. We acknowledge a complaint within 30 days and tell you what we are doing about it. You can also complain to the Information Commissioner\u2019s Office at ico.org.uk or on 0303 123 1113.`,
      basis: 'Data Protection Act 2018, s. 164A' },

    { t: 'h', v: 'Changes' },
    { t: 'p', v: 'If we change how we use your information, we update this page and the date at the top.' },

    ask('Whether you need to pay the ICO data protection fee. Many online sole traders do; the ICO self-assessment takes five minutes at ico.org.uk/fee.',
      null, { owner: 'trader', basis: 'Data Protection (Charges and Information) Regulations 2018' }),
  );
}

function cookiesPage() {
  return keep(
    { t: 'p', v: 'The shop does keep a few things in your browser, so it works as you expect. This page lists every one.',
      basis: 'Privacy and Electronic Communications (EC Directive) Regulations 2003, reg. 6 and Sch. A1' },

    { t: 'h', v: 'What is kept in your browser' },
    { t: 'list', v: [
      'Your basket, so it is still there if you refresh or come back later. Strictly necessary for the shop to work.',
      'Products you have saved with the heart button. Strictly necessary, because you asked us to keep them.',
      'Products you have recently viewed, up to twelve, so you can find them again. This makes the shop easier to use, and you can switch it off at the top of this page.',
      'Your details, once you have ordered: your name, email and phone, and your own address, so the next checkout is filled in for you. A gift\u2019s address is never kept. You can switch this off at the top of this page, or choose \u201cNot you? Forget them\u201d at the checkout.',
      'Your orders: links to orders you have opened on this device, so Track an order can list them. Switch it off at the top of this page, or choose \u201cForget these orders on this device\u201d on the tracking page.',
      'A checkout in progress, so a declined card or a trip back to the basket does not lose what you typed. Strictly necessary, and gone when you close the tab.',
      'How many products you choose to see across a section page, because you asked for it.',
      'A copy of the shop\u2019s own files, so pages load quickly. It holds no information about you.',
    ] },
    { t: 'p', v: 'None of these is sent to us. Clearing your browser\u2019s site data removes them all.',
      basis: 'Privacy and Electronic Communications (EC Directive) Regulations 2003, Sch. A1 (functionality exception: clear information and a simple, free means to object, given by the switch at the top of the page)' },

    { t: 'h', v: 'How we count visits' },
    { t: 'p', v: 'We count which pages and products are viewed, so we know what to stock. We do this ourselves and store nothing on your device for it. A visit is tied together by a reference held in your browser tab\u2019s memory, which is gone when you close or reload the tab. We cannot tell that you have been here before, and we cannot follow you to other websites.' },

    { t: 'h', v: 'When you pay' },
    { t: 'p', v: 'Payment happens on Stripe\u2019s own page, which sets its own cookies to prevent fraud. Stripe\u2019s cookie policy covers them.' },

    { t: 'h', v: 'Our emails' },
    { t: 'p', v: 'Our emails contain no tracking pixels, so we cannot see whether you have opened them.',
      basis: 'Privacy and Electronic Communications (EC Directive) Regulations 2003, reg. 6' },

    { t: 'h', v: 'If this changes' },
    { t: 'p', v: 'If we ever add anything that needs your consent, such as advertising or third party analytics, we will ask for it before it runs and update this page first.' },
  );
}

// The dark panel at the top of each page. Every figure is read from the same settings as the text below it.
function factsFor(slug, T, tr) {
  const transit = T.transitMin === T.transitMax ? word(T.transitMax) : `${word(T.transitMin)} to ${word(T.transitMax)}`;
  const who = traderIdentity(tr);
  const facts = {
    returns: {
      eyebrow: 'Changing your mind',
      figure: `${T.returnDays} days`,
      caption: 'from the day it arrives, for any reason.',
      shape: { type: 'window', law: T.statutoryDays, total: T.returnDays },
      items: [
        { v: T.postagePaidBy === 'customer' ? 'Return postage is yours unless it is faulty' : 'We pay the return postage' },
        { v: 'Refunded within 14 days of it reaching us' },
        { v: 'Cancellation form on this page', href: '#cancellation-form' },
      ],
    },
    delivery: {
      eyebrow: 'UK delivery',
      figure: gbp(T.postage),
      caption: `free when your goods come to ${gbp(T.freeDeliveryOver)} or more.`,
      shape: { type: 'track', cutoff: T.dispatchCutoff, transit: T.transitMin === T.transitMax ? `${T.transitMax}` : `${T.transitMin} to ${T.transitMax}` },
      items: [
        { v: 'Tracking link by email when it leaves us' },
        { v: 'Our responsibility until it reaches you' },
        { v: 'Lost or late parcels', href: '#if-your-parcel-is-late-or-does-not-arrive' },
      ],
    },
    terms: {
      eyebrow: 'You are buying from',
      figure: tr.tradingAs ?? tr.name ?? 'This shop',
      kind: 'name',
      caption: tr.name && tr.name !== tr.tradingAs ? `run by ${tr.name}` : 'a UK business.',
      shape: { type: 'slip', lines: [who ?? tr.tradingAs, tr.address, tr.email].filter(Boolean) },
      items: [
        { v: tr.email, href: `mailto:${tr.email}` },
        { v: `A reply ${replyPromise()}` },
        who && tr.company && { v: `Company number ${tr.company}` },
        who && !claimsCompany(tr) && { v: 'Sole trader' },
      ].filter(Boolean),
    },
    privacy: {
      eyebrow: 'Your information',
      figure: 'Never sold',
      caption: 'We keep only what an order needs.',
      shape: {
        type: 'flow',
        held: 'Kept by us',
        to: [['Payment', 'by Stripe'], ['Emails', 'about your order'], ['Delivery', 'of your parcel']],
      },
      items: [
        { v: 'Your card details go to Stripe, never to us' },
        { v: 'Ask for a copy, or for deletion, at any time', href: '#your-rights' },
        { v: 'Who we share it with', href: '#who-we-share-it-with' },
      ],
    },
    cookies: {
      eyebrow: 'This shop sets',
      figure: 'No cookies',
      caption: 'and no advertising or third party tracking.',
      shape: { type: 'storage' },
      items: [
        { v: 'No banner, because nothing here needs your consent' },
        { v: 'Visits counted in memory, never on your device' },
        { v: 'What each one does', href: '#what-is-kept-in-your-browser' },
      ],
    },
    reviews: {
      eyebrow: 'Reviews on this shop',
      figure: 'Verified',
      caption: 'Every one is from someone who bought the product from us.',
      shape: { type: 'stars' },
      items: [
        { v: 'Good or bad, published as written' },
        { v: 'Held back for four reasons only', href: '#what-we-publish' },
        { v: 'Never paid for or rewarded' },
      ],
    },
  };
  return facts[slug];
}

// Anchors come from the heading text, not the clause number, so a link sent to a customer survives a clause being added.
export const anchorFor = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const REVIEWED = '2026-09-29';

export const LEGAL_LINKS = {
  terms: 'Terms of sale',
  privacy: 'Privacy',
  returns: 'Returns and refunds',
  delivery: 'Delivery',
  cookies: 'Cookies',
  reviews: 'How reviews work',
};

// Built on every read: trading details come from settings that can change while the shop runs.
export function buildLegal() {
  const T = legalTerms();
  const tr = legalTrader();
  const page = (slug, title, description, blocks, numbered = false) =>
    ({ title, description, reviewed: REVIEWED, numbered, blocks, facts: factsFor(slug, T, tr) });

  return {
    delivery: page('delivery', 'Delivery', 'What UK delivery costs, how long it takes, and where we deliver.', deliveryPage(T, tr)),
    returns: page('returns', 'Returns and refunds', 'Changing your mind, faulty goods, refunds and the cancellation form.', returnsPage(T, tr), true),
    terms: page('terms', 'Terms of sale', 'The terms you buy under, in plain English.', termsPage(T, tr), true),
    privacy: page('privacy', 'Privacy', 'What we collect, why, who we share it with and your rights.', privacyPage(T, tr), true),
    cookies: page('cookies', 'Cookies', 'What this shop keeps in your browser, and how to switch it off.', cookiesPage()),
    reviews: page('reviews', 'How reviews work', 'Who can review, what we publish, and what we do not.', reviewsPage(tr)),
  };
}

export const LEGAL_SLUGS = Object.keys(LEGAL_LINKS);

export const LEGAL_COLUMN = ['terms', 'privacy', 'returns', 'delivery', 'cookies', 'reviews'];

export const legalPage = (slug) => buildLegal()[slug] ?? null;

// Lines still waiting on a decision, for the portal and the review pack.
export const openConfirmations = () =>
  Object.entries(buildLegal()).flatMap(([slug, p]) =>
    p.blocks.filter((b) => b.t === 'confirm').map((b) => ({ slug, owner: b.owner ?? 'trader', note: b.v })));
