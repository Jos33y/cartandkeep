-- About in plainer words, agreed 29 September.
-- Replaces the 0105 wording only where it is still untouched, so anything she has written in Settings stays.

update tenants
set store = jsonb_set(store, '{voice,about}', $new${
  "title": "The things a house runs on, in one basket.",
  "lede": "A small UK shop with a very large cupboard. Everyday things for the home, the bathroom and looking after yourself, chosen with care.",
  "sections": [
    {
      "heading": "Why one shop",
      "text": "A house needs many kinds of thing. A bathroom scale, a make-up mirror, a massager and a dressing gown usually mean four orders and four delivery charges. Here they go in one basket, with one delivery charge."
    },
    {
      "heading": "How we choose what we stock",
      "text": "Much of the range we already sell elsewhere, so we know it and how it arrives.\n\nIf you cannot find something, tell us what it is and we will look for it."
    }
  ],
  "refusals": [
    {
      "no": "Ask you to create an account.",
      "why": "You check out with your email and address, and that is all."
    },
    {
      "no": "Put a countdown timer on a product.",
      "why": "If stock is low the page says so. If it is not, it does not."
    },
    {
      "no": "Invent a was price.",
      "why": "A crossed-out price is one we genuinely charged before."
    },
    {
      "no": "Sell your details.",
      "why": "We use them to send your order and to answer you, and for nothing else."
    }
  ],
  "her_words": null,
  "closing": {
    "heading": "If something goes wrong",
    "text": "Write to us and a person replies. Send your order reference and what has happened, and we will put it right. Your rights under UK law are set out in full on the returns page."
  }
}$new$::jsonb)
where slug = 'cart-and-keep'
  and store -> 'voice' -> 'about' = $old${
  "title": "A general store, not a niche.",
  "lede": "Cart & Keep is a general store. Not a brand or a curated edit: the useful things a house runs on, in one place, sent from the UK.",
  "sections": [
    {
      "heading": "Why a general store",
      "text": "Most online shops specialise, because specialising is easier to market. The problem is that a house does not specialise. A week needs a light bulb, a dog bed, something for the drain and a birthday present, and buying those from four shops means four deliveries, four minimum spends and four chances of something going wrong.\n\nSo this is the awkward middle: the things too specific for a corner shop and too dull to make a trip for, in one basket and one delivery."
    },
    {
      "heading": "How the stock gets here",
      "text": "Much of what is here we already sell elsewhere, so it has been bought, packed and posted by us before it ever reached this shop. We add more as we find things people keep coming back for.\n\nIf there is something you keep buying somewhere else because it is not here, tell us and we will see if we can get it. It is the oldest thing a shop can offer and it still works."
    }
  ],
  "refusals": [
    {
      "no": "Make you create an account.",
      "why": "There is not one, and there is not going to be one."
    },
    {
      "no": "Put a countdown timer on a product.",
      "why": "If something is nearly gone the page says so, and if it is not, it does not."
    },
    {
      "no": "Invent a was price.",
      "why": "A price with a line through it has to have been the real price first."
    },
    {
      "no": "Sell your details.",
      "why": "Stripe takes the payment and your card never reaches us."
    }
  ],
  "her_words": null,
  "closing": {
    "heading": "If something goes wrong",
    "text": "Write to us and a person answers. Not a queue, not a bot, and not a form that goes into a folder nobody opens. The returns page sets out your rights in full and none of them depend on us being reasonable, but we would rather sort it out than argue about it."
  }
}$old$::jsonb;
