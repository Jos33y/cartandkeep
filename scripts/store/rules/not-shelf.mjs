/*
 * Not a shelf product she can post from stock: made to measure, personalised, living plants, furniture, large
 * appliances, experiences, second hand.
 *
 * A word stops the thing itself, never its parts: "fridge" stops a fridge freezer, not a fridge water filter,
 * and "radiator" stops a designer radiator, not a radiator valve. Each entry is [word, stop only when, unless]:
 *   word    regex source, matched as whole words anywhere in the title
 *   only    optional: the title must also say this for it to stop (a fridge needs a size, a type or "freezer")
 *   unless  optional: the title saying this lets it through (the part, the accessory, the small version)
 * Test a change with rules-check.mjs on a category's exports before running store-picks.
 */

// Parts and accessories of an appliance or a piece of furniture: sold on their own, posted in a small parcel.
const PARTS = String.raw`filters?|thermometers?|magnets?|bags?|seals?|gaskets?|shel(?:f|ves)|drawers?|parts?|spares?|elements?|gloves?|mitts?|liners?|tablets?|salt|rinse|cleaners?|cleaning|baskets?|racks?|valves?|keys?|covers?|airers?|ign[io]tors?|thermocouples?|bulbs?|lamps?|protectors?|toppers?|encasements?|pads?|stands?|hangers?|hooks?|handles?|knobs?|switch(?:es)?|timers?|thermostats?|probes?|hoses?|pipes?|belts?|motors?|pumps?|brushes?|trays?|mats?|locks?|brackets?|hinges?|throws?|slipcovers?|cushions?|organi[sz]ers?|refills?|pods|capsules|descaler|trv|bleed|reflectors?|boosters?|legs|feet|expansion vessel|pressure gauge|filling loop|pcb|door|wheels?|castors?|lights?|dryers?|stickers?|decals?|paint|treatment|stain|felt|base|repair|window|anchors?|alarm|fittings?|clips?|cords?|chains?|springs?`;

// A pet's bed, sofa or mattress is a pet bed, posted like one: "Crate Mattress", "Dog Sofa", "Cat Sofa".
const PET = String.raw`dogs?|doggy|cats?|pets?|puppy|puppies|kittens?|crate|kennel|ramp|pet stairs`;

// Camping and guest beds that pack into a bag: air beds, self-inflating mats, camping mattresses.
const CAMP = String.raw`air ?beds?|air mattress(?:es)?|blow[- ]up|inflatable|self[- ]inflating|camping|campervan|sleeping (?:mats?|pads?)|roll ?mats?|foam mats?|hiking|backpacking|ultralight`;

// A small or countertop version is a shelf product, whatever its name shares with the big one.
const SMALL = String.raw`portable|mini|compact|camping|travel|slow|rice|pressure|multi|egg|pizza|air fryer|toaster|countertop|table ?top|12v|car|cosmetic|skincare|beauty|oil[- ]filled|electric heater`;

// What makes the word the big appliance: a type, a size, a capacity.
const BIG_APPLIANCE = String.raw`integrated|freestanding|free standing|built[- ]in|under ?counter|slimline|chest|upright|american|side by side|larder|fridge freezer|range|single|double|electric (?:oven|cooker)|gas (?:oven|cooker|hob)|induction|ceramic|\d+ ?(?:l|litres?)\b|\d+(?:\.\d+)? ?kg\b|\d+ ?rpm|place settings|\d+ ?cm\b|\d+\/\d+|energy rating|series \d|wifi`;

export const NOT_SHELF = [
  // Made to order and print on demand
  ['blinds?', null, String.raw`brackets?|cords?|chains?|cleaner|fittings?|clips?|springs?|parts?|wands?|box(?:es)?|bags?|series|figures?|mystery|pendant|fly|bug|insect|strip|door curtain`],
  ['made to measure'], ['personali[sz]ed'], ['photo ?book'], ['poster'], ['wallpaper', null, String.raw`cover[- ]up|strippers?|steamers?|paste|adhesive|scrapers?|scorers?|primer|remover|smoothers?|brush(?:es)?|cutters?|tools?|kit`], ['mural'],
  // "Print" only as a picture: leopard print and bow print bedding pass.
  [String.raw`(?:art|framed|photo|canvas|giclee|fine art|wall) prints?|prints? (?:a[1-5]|framed|unframed)`],
  ['prints?', String.raw`wall art|posters?|framed|unframed|a[1-5]|canvas|giclee|wall decor`],
  // Living plants and trees. Pots, feed, stands, lights, artificial plants and Christmas trees pass.
  ['plants?', null, String.raw`pots?|planters?|food|feed|fertili[sz]ers?|stands?|hangers?|labels?|supports?|saucers?|misters?|spray|lights?|lamps?|artificial|fake|faux|silk|troughs?|covers?|fleece|trays?|ties|cages?|watering|mats?|protection|shel(?:f|ves)|compost|nutrients?|plant[- ]based|powered|milk|protein|lego|botanicals?|bricks?|building|toys?|plush|zombies|jigsaws?|playsets?|plant fibre|plant-based litter|litter`],
  ['trees?', null, String.raw`artificial|christmas|cat|lights?|skirts?|stands?|toppers?|decorations?|ornaments?|shoes?|coat|hat|jewell?ery|baubles?|guards?|ties?|stakes?|feed|pruners?|loppers?|saw|family tree|tree of life|pre-?lit|led|fibre optic|pop[- ]up|tinsel|pvc|tea tree|shoe tree|playsets?|play ?sets?|toys?|lego|tree ?house|figures?|jigsaws?|plush|bluey|sylvanian|dumbbells?|kettlebells?|weights?|racks?|barbells?`],
  ['bulbs? for planting'], ['bare roots?'],
  // Furniture and garden buildings
  // A shed's own parts: a "double door pent shed" is still a shed.
  ['shed', null, String.raw`felt|shed base|paint|treatment|locks?|hasps?|hinges?|shelving|shel(?:f|ves)|roof(?:ing)?|repair|stain|anchors?|lights?|alarm|guttering|storage bags?|grid|protectors?|preserver|fence|wood ?care`], ['sofa', null, `${PARTS}|${PET}`], ['bed frame', null, PARTS],
  ['wardrobe', null, String.raw`${PARTS}|portable|fabric|canvas|stackable|foldable|rails?`],
  ['mattress', null, `${PARTS}|${PET}|${CAMP}`],
  // Large appliances: only the appliance itself
  ['fridges?', BIG_APPLIANCE, `${PARTS}|${SMALL}`],
  ['freezers?', BIG_APPLIANCE, `${PARTS}|${SMALL}`],
  ['washing machine', null, `${PARTS}|${SMALL}`],
  ['dishwasher', BIG_APPLIANCE, `${PARTS}|${SMALL}|finish|fairy|ecover|smol|all in one`],
  ['ovens?', BIG_APPLIANCE, `${PARTS}|${SMALL}`],
  ['hob', BIG_APPLIANCE, `${PARTS}|${SMALL}|scraper`],
  ['cookers?', BIG_APPLIANCE, `${PARTS}|${SMALL}|hood`],
  ['boilers?', String.raw`combi|system boiler|regular boiler|\d+ ?kw|gas boiler|oil boiler|water boiler`, PARTS],
  // A plumbed radiator; oil-filled and plug-in electric radiators are portable heaters and pass.
  ['radiators?', String.raw`designer|column|panel|towel|double|single|vertical|horizontal|convector|type \d\d|\d+ ?(?:x|mm)`, `${PARTS}|oil[- ]filled|electric|portable|plug[- ]in`],
  // Services, vouchers and experiences
  ['meal plan'], ['gift card'], ['voucher'], ['spa day'], ['spa experience'], ['bath experience'], ['valid monday'],
  [String.raw`experience (?:for|with|day|voucher)`], [String.raw`\d+[- ]?(?:min(?:ute)?s?|hours?) massage`], ['hour perfume experience'],
  // Tickets, subscriptions and made to order under other names
  [String.raw`(?:entry|tickets?|admission) for (?:two|2|one|1|a family|four|4)`], ['subscription(?: box| crate)?'],
  ['customi[sz]ed'], [String.raw`custom (?:name|photo|made|design|wooden)`], [String.raw`photo (?:jigsaws?|puzzles?|blocks?)`], ['create your own design'],
  // Second hand
  ['refurbished'], ['pre-?owned'], ['second[- ]hand'], ['renewed'],
];

// Calendars, diaries, planners and advent calendars for a year already past have no buyer: "Beauty Advent Calendar 2025"
// in 2026. Read against today's year when the rules load, so it never needs updating.
export const DATED = /\b(calendars?|diar(?:y|ies)|planners?|organisers?|advent)\b/i;
export const staleYear = (title) => DATED.test(title) && [...String(title).matchAll(/\b(20\d\d)\b/g)].some((m) => Number(m[1]) < new Date().getFullYear());
