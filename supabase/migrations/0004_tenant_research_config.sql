-- What to research each week is tenant config, not code. Categories and terms
-- change as she moves into new lines, and that must not need a deploy.

alter table tenants
  add column if not exists research jsonb not null default '{}'::jsonb;

update tenants
set research = '{
  "categories": ["Beauty", "Pet"],
  "terms": [
    "gua sha facial set",
    "heatless curling rod",
    "led makeup mirror",
    "silk hair scrunchies",
    "vitamin c face serum",
    "makeup brush cleaner",
    "reusable makeup pads",
    "hair claw clips",
    "facial ice roller",
    "scalp massager brush",
    "slow feeder dog bowl",
    "cat window hammock",
    "dog seat belt harness",
    "pet hair remover roller",
    "dog treat puzzle toy",
    "dog raincoat waterproof",
    "snuffle mat dog",
    "pet water fountain",
    "pet nail grinder",
    "calming donut pet bed"
  ],
  "max_candidates": 100
}'::jsonb
where slug = 'cart-and-keep';
