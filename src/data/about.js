// Everything here must be true of the shop today. Her own paragraph goes in `herWords`; until it exists, that section does not render.
export const ABOUT = {
  title: 'About Cart & Keep',
  description: 'A small UK general store: the useful things a house runs on, in one basket, with no account needed.',
  herWords: null,
  blocks: [
    { t: 'lede', v: 'Cart & Keep is a general store. Not a brand or a curated edit: the useful things a house runs on, in one place, sent from the UK.' },

    { t: 'h', v: 'Why a general store' },
    { t: 'p', v: 'Most online shops specialise, because specialising is easier to market. The problem is that a house does not specialise. A week needs a light bulb, a dog bed, something for the drain and a birthday present, and buying those from four shops means four deliveries, four minimum spends and four chances of something going wrong.' },
    { t: 'p', v: 'So this is the awkward middle: the things too specific for a corner shop and too dull to make a trip for, in one basket and one delivery.' },

    { t: 'h', v: 'How the stock gets here' },
    { t: 'p', v: 'Much of what is here we already sell elsewhere, so it has been bought, packed and posted by us before it ever reached this shop. We add more as we find things people keep coming back for.' },
    { t: 'p', v: 'If there is something you keep buying somewhere else because it is not here, tell us and we will see if we can get it. It is the oldest thing a shop can offer and it still works.' },

    { t: 'h', v: 'What we will not do' },
    { t: 'refusals', v: [
      { no: 'Make you create an account.', why: 'There is not one, and there is not going to be one.' },
      { no: 'Put a countdown timer on a product.', why: 'If something is nearly gone the page says so, and if it is not, it does not.' },
      { no: 'Invent a was price.', why: 'A price with a line through it has to have been the real price first.' },
      { no: 'Sell your details.', why: 'Stripe takes the payment and your card never reaches us.' },
    ] },

    { t: 'her' },

    { t: 'h', v: 'If something goes wrong' },
    { t: 'p', v: 'Write to us and a person answers. Not a queue, not a bot, and not a form that goes into a folder nobody opens. The returns page sets out your rights in full and none of them depend on us being reasonable, but we would rather sort it out than argue about it.' },
  ],
};
