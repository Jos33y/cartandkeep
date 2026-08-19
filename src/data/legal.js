/*
 * The legal and help pages.
 *
 * Content lives here rather than in the component so a change is one file and
 * one review, and so every page shares a shape: a title, a description for the
 * head, a last reviewed date, and blocks.
 *
 * Drafted by the studio, not approved. Anything marked TO CONFIRM is a
 * decision or a fact only she can supply, and the page renders those in a way
 * nobody can miss on the live site. Nothing here is a legal opinion: the
 * factual lines come from the shop's own settings and the rest is a starting
 * point for her to cut.
 *
 * Block types: p, list, h, note, confirm
 */

export const TRADER = {
  // TO CONFIRM. Distance selling requires the trader's identity, a geographic
  // address and contact details before an order is placed. None of these are
  // in the codebase and the shop cannot go live without them.
  name: 'TO CONFIRM: registered or trading name',
  address: 'TO CONFIRM: geographic address, not a PO box',
  company: 'TO CONFIRM: company number, if trading through a company',
  email: 'support@cartandkeep.com',
  vat: null, // Not VAT registered. No VAT line appears anywhere on the shop.
};

export const TERMS = {
  freeDeliveryOver: 40,
  postage: 3.95,
  returnDays: 30,
  statutoryDays: 14,
  dispatchCutoff: '2pm',
};

const REVIEWED = '2026-08-18';

export const LEGAL = {
  delivery: {
    title: 'Delivery',
    description: 'What UK delivery costs, how long it takes, and where we send to.',
    reviewed: REVIEWED,
    blocks: [
      { t: 'p', v: `Delivery within the UK is £${TERMS.postage.toFixed(2)}, and free once your basket passes £${TERMS.freeDeliveryOver}.` },
      { t: 'h', v: 'How long it takes' },
      { t: 'p', v: `Orders placed before ${TERMS.dispatchCutoff} on a working day are sent the same day. Most arrive in two to three working days after that.` },
      { t: 'confirm', v: 'Which carrier, and whether the same day cut off holds for every product. Some are sent by a supplier rather than by us and their cut off may differ.' },
      { t: 'h', v: 'Where we deliver' },
      { t: 'p', v: 'Mainland UK, Northern Ireland, and the Scottish Highlands and Islands.' },
      { t: 'confirm', v: 'Whether the Highlands, Islands, Isle of Man and Channel Islands carry a surcharge. Most carriers charge more and a flat rate that quietly loses money on those postcodes is worse than a stated surcharge.' },
      { t: 'h', v: 'Tracking your order' },
      { t: 'p', v: 'Your confirmation email carries the order reference. Once the parcel leaves us you get a second email with the tracking link in it.' },
      { t: 'p', v: `If it has not arrived when it should have, reply to that email or write to ${TRADER.email} with the order reference and we will chase it.` },
      { t: 'note', v: 'Nothing has shipped yet, so if you are reading this before your first order there is nothing to track.' },
    ],
  },

  returns: {
    title: 'Returns and refunds',
    description: 'How long you have, what can come back, and how the refund works.',
    reviewed: REVIEWED,
    blocks: [
      { t: 'p', v: `You have ${TERMS.statutoryDays} days from delivery to change your mind, which is your statutory right, and we extend that to ${TERMS.returnDays} days as a term of sale.` },
      { t: 'h', v: 'What can come back' },
      { t: 'p', v: 'Most things, unused and in their packaging.' },
      { t: 'h', v: 'What cannot' },
      { t: 'list', v: [
        'Sealed goods that are not suitable for return for health or hygiene reasons, once the seal is broken. Bath and body sets, creams, incontinence products and similar.',
        'Consumables, once opened. Cleaning products, adhesives, food and drink.',
        'Anything made to your specification or clearly personalised.',
      ] },
      { t: 'p', v: 'Each product page states which of these applies before you buy it.' },
      { t: 'h', v: 'What we refund' },
      { t: 'p', v: 'The price you paid, plus the standard delivery charge on the outbound order. We refund within 14 days of receiving the goods back, or of you showing us proof of postage, whichever is sooner.' },
      { t: 'confirm', v: 'Who pays return postage. The regulations put it on the customer if the trader has said so before the sale, and on the trader if they have not. This has to be decided and stated here, and it is stated nowhere at the moment.' },
      { t: 'confirm', v: 'The return address, which is not the same question as the trading address.' },
      { t: 'h', v: 'Faulty or not as described' },
      { t: 'p', v: 'Nothing above affects your rights under the Consumer Rights Act 2015. If a product is faulty, not as described, or not fit for purpose, tell us and we will sort it out regardless of how long you have had it or whether it has been opened.' },
      { t: 'h', v: 'How to start a return' },
      { t: 'p', v: `Write to ${TRADER.email} with your order reference and what you are sending back. You do not need a form and you do not need to give a reason.` },
    ],
  },

  terms: {
    title: 'Terms of sale',
    description: 'The terms you buy under, in plain English.',
    reviewed: REVIEWED,
    blocks: [
      { t: 'h', v: 'Who you are buying from' },
      { t: 'p', v: `${TRADER.name}, at ${TRADER.address}. ${TRADER.company}. Contact us at ${TRADER.email}.` },
      { t: 'confirm', v: 'All three of those are placeholders. The shop cannot go live with them on the page.' },
      { t: 'h', v: 'Prices' },
      { t: 'p', v: 'Prices are in pounds sterling and are what you pay. We are not VAT registered, so no VAT is charged and none is shown separately.' },
      { t: 'p', v: 'If a price is wrong on the site we will tell you before we take the order any further, and you can confirm at the correct price or cancel.' },
      { t: 'h', v: 'Your order' },
      { t: 'p', v: 'Placing an order is an offer to buy. The contract starts when we email you to say the order has been dispatched, not when you pay.' },
      { t: 'p', v: 'We can decline an order. If we do, you are not charged, and if you already have been you are refunded in full.' },
      { t: 'h', v: 'Cancelling' },
      { t: 'p', v: 'See returns and refunds. Your cancellation rights are set out there in full.' },
      { t: 'h', v: 'If something goes wrong' },
      { t: 'p', v: 'Write to us first. We would rather fix it than argue about it.' },
      { t: 'confirm', v: 'Governing law and jurisdiction. The retainer is under English and Welsh law and this should presumably match, but that is her call.' },
      { t: 'confirm', v: 'Whether a liability clause is wanted. Most shops carry one and it must not exclude anything that cannot lawfully be excluded, which is exactly the kind of clause worth her drafting rather than mine.' },
    ],
  },

  privacy: {
    title: 'Privacy',
    description: 'What we collect, why, and how long we keep it.',
    reviewed: REVIEWED,
    blocks: [
      { t: 'p', v: 'We collect as little as we can and we do not sell any of it.' },
      { t: 'h', v: 'What we collect' },
      { t: 'list', v: [
        'When you order: your name, email, delivery address and what you bought. We need these to send you the thing.',
        'When you pay: nothing. Stripe handles the payment and your card details never reach us.',
        'When you browse: what your browser stores on your own device, which is your basket and your saved items. That stays on your device and is never sent to us.',
        'While you browse: which pages and products were looked at in this visit, with a reference that exists only in memory and disappears when you close the tab. No name, no email, no device identifier, and nothing that could be tied back to you.',
      ] },
      { t: 'h', v: 'What we do not do' },
      { t: 'p', v: 'No account, no password, no marketing emails unless you ask for them, no cookies, no advertising trackers, no third party analytics, and no selling or sharing your details with anyone who is not delivering your order.' },
      { t: 'h', v: 'How long we keep it' },
      { t: 'confirm', v: 'A retention period. Six years is the usual answer because of tax record keeping, but it should be stated rather than assumed.' },
      { t: 'h', v: 'Your rights' },
      { t: 'p', v: `You can ask what we hold, ask us to correct it, and ask us to delete it. Write to ${TRADER.email} and we will answer within a month. If you are not happy with how we have handled it you can complain to the Information Commissioner's Office at ico.org.uk.` },
      { t: 'confirm', v: 'Whether a data controller registration with the ICO is required. Most small ecommerce traders need one and it is an annual fee.' },
    ],
  },

  cookies: {
    title: 'Cookies',
    description: 'What this site stores on your device.',
    reviewed: REVIEWED,
    blocks: [
      { t: 'p', v: 'This shop sets no cookies of any kind, and no advertising or tracking technology at all, so there is no banner asking you to accept any.' },
      { t: 'h', v: 'What is stored on your device' },
      { t: 'list', v: [
        'Your basket, so it survives a refresh.',
        'Anything you have saved with the heart button.',
      ] },
      { t: 'p', v: 'Both are kept in your browser on your own device and neither is sent to us. Clearing your browser data removes them.' },
      { t: 'h', v: 'How we count visits' },
      { t: 'p', v: 'We count which pages and products get looked at, so we know what to stock more of. It is our own counting rather than a third party, and it stores nothing on your device: the reference that ties one page view to the next is held in memory by the tab you are reading this in and is gone the moment you close or reload it.' },
      { t: 'p', v: 'That means we cannot tell that you have been here before, cannot follow you to another website, and have nothing to hand anyone who asks. It also means the numbers are rougher than a shop using Google Analytics would have, which is a trade we are happy with.' },
      { t: 'h', v: 'When you pay' },
      { t: 'p', v: 'Stripe sets its own cookies at the point of checkout, for fraud prevention. Those are theirs and their policy covers them.' },
      { t: 'confirm', v: 'True as written today. It stops being true the moment anything is added that stores an identifier: Google Analytics, a Meta pixel, a chat widget, an affiliate tag. Any of those needs a consent banner under PECR and needs this page rewritten first. Google Search Console itself is fine, because it reads the site rather than the visitor.' },
    ],
  },

  faq: {
    title: 'Frequently asked',
    description: 'Delivery, returns, payment and how to reach a person.',
    reviewed: REVIEWED,
    blocks: [
      { t: 'h', v: 'Do I need an account?' },
      { t: 'p', v: 'No, and there is not one to make. Email, address, pay.' },
      { t: 'h', v: 'How much is delivery?' },
      { t: 'p', v: `£${TERMS.postage.toFixed(2)} within the UK, free once your basket passes £${TERMS.freeDeliveryOver}.` },
      { t: 'h', v: 'How do I track my order?' },
      { t: 'p', v: 'Your dispatch email carries the tracking link. Reply to it if the parcel has not turned up.' },
      { t: 'h', v: 'Can I return something?' },
      { t: 'p', v: `${TERMS.returnDays} days, unused and in its packaging, with some exceptions for sealed and consumable products. Every product page says which applies to it.` },
      { t: 'h', v: 'Is my card safe?' },
      { t: 'p', v: 'Stripe takes the payment. Your card details never reach this shop.' },
      { t: 'h', v: 'You do not stock what I need. Can you get it?' },
      { t: 'p', v: `Often, yes. That is what a general store is for. Write to ${TRADER.email} with what you are after and we will price it up.` },
      { t: 'h', v: 'Who am I actually buying from?' },
      { t: 'p', v: `${TRADER.name}, a small shop in the UK. See the terms of sale for the full details.` },
    ],
  },
};

export const LEGAL_SLUGS = Object.keys(LEGAL);

// What appears in the footer's legal column. FAQ is help rather than legal and
// lives in the other column, but both resolve through the same route.
export const LEGAL_COLUMN = ['terms', 'privacy', 'returns', 'delivery', 'cookies'];

export const legalPage = (slug) => LEGAL[slug] ?? null;
