// Need words for Animals & Pet Supplies: pest control for pets (flea, tick, worm), care and health, safety and
// containment, hygiene, and the parts and refills owners reorder. Toys, treats, food, beds and clothes are browsed.
export const RULES = [
  ['pest', /\b(flea|fleas|tick|ticks|lice|mites?|wormer|worming|worms?|de-?wormer|flea combs?|tick (?:removers?|twisters?|tweezers?))\b/i],
  ['care', /\b(cones?|recovery (?:collars?|suits?)|buster collars?|e-?collars?|inflatable collars?|joint (?:care|supplements?)|glucosamine|calming|anxiety|probiotics?|digestive|dental (?:care|chews|gel|sprays?)|toothbrush(?:es)?|toothpaste|ear (?:cleaners?|drops)|eye (?:wipes|drops)|wound|first aid|nail (?:clippers?|grinders?)|claw clippers?|ramps?|pet stairs|dog steps|orthopaedic|orthopedic|heated pad|heat pads?|pill (?:pockets?|poppers?|givers?))\b/i],
  ['safety', /\b(pet gates?|dog gates?|crates?|cages?|playpens?|car (?:barriers?|seat covers?|harness(?:es)?)|seat belts?|dog guards?|cat flaps?|dog flaps?|pet doors?|microchip|gps trackers?|trackers?|anti[- ]pull|no[- ]pull|muzzles?|hi[- ]?vis|led collars?|reflective)\b/i],
  ['part', /\b(filters?|filter (?:cartridges?|sponges?|media|pads?)|replacement (?:filters?|cartridges?|pads?|bags?|heads?|blades?|parts?|bulbs?|batter(?:y|ies))|refills?|cartridges?|carbon (?:filters?|pads?)|fountain (?:filters?|pumps?)|uv (?:bulbs?|lamps?)|heat (?:lamps?|bulbs?|mats?)|air pumps?|airline|clipper blades?|litter (?:liners?|bags?|refills?)|poo bags?|waste bags?|training pads?|puppy pads?)\b/i],
];
export const NOT_NEED = /\b(toys?|plush|squeaky|treats?|chews?(?! dental)|biscuits?|costumes?|outfits?|jumpers?|sweaters?|christmas jumper|advent|birthday|gift sets?|hampers?)\b/i;
