-- "Why one shop" as a list, which the About page draws as a notepad ticked off line by line.
-- Replaces the 0106 wording only where it is still untouched, so anything she has written in Settings stays.

update tenants
set store = jsonb_set(store, '{voice,about}', $new${
  "title": "The things a house runs on, in one basket.",
  "lede": "A small UK shop with a very large cupboard. Everyday things for the home, the bathroom and looking after yourself, chosen with care.",
  "sections": [
    {
      "heading": "Why one shop",
      "text": "A house needs many kinds of thing, and most shops sell one kind.\n\n- A bathroom scale\n- A make-up mirror\n- A massager\n- A dressing gown\n\nUsually that is four orders and four delivery charges. Here it is one basket, with one delivery charge."
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
}$old$::jsonb;
