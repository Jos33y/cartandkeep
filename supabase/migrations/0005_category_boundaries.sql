-- Two categories, both bounded by their own names.
--
-- Beauty Tools & Accessories excludes cosmetics. Anything applied to the body
-- makes the importer the Responsible Person under the UK Cosmetics Regulation,
-- which carries SCPN notification, a Product Information File, a safety
-- assessment and the RP name on the label. Not a boundary to cross by accident.
--
-- Pet Accessories excludes food, treats and health products, which fall under
-- animal feed rules or stray toward veterinary medicines.
--
-- Both are config. The day she sets up as an RP, this is an update.

update tenants
set research = research
  || '{
    "categories": ["Beauty Tools & Accessories", "Pet Accessories"],
    "terms": [
      "gua sha facial set",
      "jade roller face",
      "heatless curling rod",
      "led makeup mirror",
      "silk hair scrunchies",
      "makeup brush set",
      "makeup brush cleaner",
      "reusable makeup remover pads",
      "hair claw clips",
      "facial ice roller",
      "scalp massager brush",
      "eyelash curler",
      "silicone face cleansing brush",
      "makeup organiser",
      "slow feeder dog bowl",
      "cat window hammock",
      "dog seat belt harness",
      "pet hair remover roller",
      "dog treat puzzle toy",
      "dog raincoat waterproof",
      "snuffle mat dog",
      "pet water fountain",
      "calming donut pet bed",
      "cat scratching post",
      "collapsible pet bowl"
    ],
    "exclude": {
      "reason": "Regulatory boundaries. See docs/data-sources.md.",
      "terms": [
        "serum", "cream", "lotion", "moisturiser", "moisturizer", "cleanser",
        "toner", "mask", "peel", "exfoliant", "shampoo", "conditioner",
        "foundation", "concealer", "lipstick", "lip gloss", "mascara",
        "eyeliner", "eyeshadow", "blusher", "bronzer", "primer", "nail polish",
        "nail varnish", "sunscreen", "spf", "fragrance", "perfume", "deodorant",
        "patches", "collagen", "retinol", "hyaluronic", "vitamin c",
        "pet food", "dog food", "cat food", "treats", "supplement", "vitamin",
        "flea", "wormer", "dewormer", "medication"
      ],
      "allow": [
        "treat puzzle", "treat dispenser", "treat ball", "treat mat",
        "treat pouch", "treat bag", "treat toy", "snuffle", "brush cleaner",
        "mask brush", "nail file", "nail drill"
      ]
    }
  }'::jsonb
where slug = 'cart-and-keep';
