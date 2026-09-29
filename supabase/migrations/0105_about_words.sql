-- About moves into her Settings, under voice, which set_store_settings (0096) and public_store (0096) already carry.
-- Seeded with the words the page shipped with, so nothing changes on the live page until she edits them.
-- Only where she has none yet: running this twice, or after she has written her own, changes nothing.

update tenants
set store = jsonb_set(
  coalesce(store, '{}'::jsonb),
  '{voice}',
  coalesce(store -> 'voice', '{}'::jsonb) || jsonb_build_object('about', $about${
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
}$about$::jsonb),
  true
)
where slug = 'cart-and-keep'
  and not coalesce(store -> 'voice', '{}'::jsonb) ? 'about';
