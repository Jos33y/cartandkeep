/*
 * The About page.
 *
 * Everything here is true of the shop. Nothing here is about her, because I do
 * not know her story and an About page full of invented biography is worse
 * than no About page at all: it is the one page a suspicious visitor reads
 * closely, and a paragraph of warm nothing is exactly what a scam site has.
 *
 * The `confirm` blocks are the parts only she can write. They render in gold
 * on the live page, same as the legal pages, so they cannot ship unnoticed.
 */
export const ABOUT = {
  title: 'About Cart & Keep',
  description:
    'A small UK general store. Eight departments, one basket, no account, and a cupboard that grows when somebody asks for something.',
  reviewed: '2026-08-18',
  blocks: [
    { t: 'lede', v: 'Cart & Keep is a general store. Not a niche, not a brand, not a curated lifestyle edit. The boring, useful things a house runs on, in one place, sent from the UK.' },

    { t: 'h', v: 'Why a general store' },
    { t: 'p', v: 'Most online shops specialise, because specialising is easier to market. The problem is that a house does not specialise. A week needs a light bulb, a dog bed, something for the drain and a birthday present, and buying those from four shops means four deliveries, four minimum spends and four chances of something going wrong.' },
    { t: 'p', v: 'So this is the awkward middle: the things too specific for a corner shop and too dull to make a trip for. Eight departments, one basket, one delivery.' },

    { t: 'h', v: 'How the stock gets here' },
    { t: 'p', v: 'New products land every Monday. Some are chosen because the numbers say people keep buying them. A fair number are here because somebody asked.' },
    { t: 'p', v: 'That is the part a big shop cannot do. If there is something you keep buying somewhere else because it is not here, write and say so, and we will price it up. It is the oldest thing a shop can offer and it still works.' },

    { t: 'h', v: 'What we will not do' },
    { t: 'list', v: [
      'Make you create an account. There is not one, and there is not going to be one.',
      'Put a countdown timer on a product. If something is nearly gone the page says so and if it is not, it does not.',
      'Invent a was price. A price with a line through it has to have been the real price first.',
      'Sell your details. Stripe takes the payment and your card never reaches us.',
    ] },

    { t: 'h', v: 'Who runs it' },
    { t: 'confirm', v: 'Her words, not mine. Two or three sentences: who she is, where she is, and why she started this. It is the paragraph a visitor who is not sure about the shop will read twice, and it is the one thing on this page I cannot write for her.' },

    { t: 'h', v: 'Where we are' },
    { t: 'trader', v: null },

    { t: 'h', v: 'If something goes wrong' },
    { t: 'p', v: 'Write to us and a person answers. Not a queue, not a bot, and not a form that goes into a folder nobody opens. The returns page sets out your rights in full and none of them depend on us being reasonable, but we would rather sort it out than argue about it.' },
  ],
};
