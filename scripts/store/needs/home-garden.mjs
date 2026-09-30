// Need words for Home & Garden: what people search for because something broke, ran out or turned up.
// A title matching one of these is sorted first; the first rule that matches names the need.
export const RULES = [
  ['safety', /\b(smoke alarm|heat alarm|carbon monoxide|co alarm|key safe|door chain|window lock|security light|fire blanket|extinguisher)\b/i],
  ['pest', /\b(flea|bed ?bugs?|wasps?|rats?|mouse|mice|rodent|bait|slugs?|ants?|moths?|spiders?|fox (?:repell\w*|deterrent)|cats? repell\w*|(?<!water[ -])repellent|insect|fly (?:killer|trap)|traps?)\b/i],
  ['damp', /\b(mould|mold|damp|moisture absorber|condensation|dehumidifier refills?|dryzone)\b/i],
  ['plumbing', /\b(valve|tap (?:gland|cartridge|washer)|cistern|inhibitor(?! spray)|shower head|shower hose|waste trap|plug and chain)\b/i],
  ['care', /\b(grab rail|toilet seat raiser|raised toilet|commode|bed rail|perching|dressing aid|sock aid|jar opener|reacher|grabber|pill|incontinence|walking|mobility|magnif\w*|big button|amplified)\b/i],
  ['winter', /\b(draught|draft excluder|de-?icer|rock salt|grit|thermal curtain|radiator (?:key|reflector|booster)|heated airer|hot water bottle|electric blanket|heated throw)\b/i],
  ['clean-fix', /\b(limescale|descaler|unblocker|drain|oven cleaner|stain remover|rust|restorer|repair (?:kit|tape|putty|paste|patch|compound|connector|plate)|sealant|filler|grout)\b/i],
  ['part', /\b(replacement|spares?|refills?|cartridges?|compatible|fits)\b/i],
  ['part', /\bfor (?:[a-z]+ )?(?:[a-z]*\d[a-z0-9-]*)\b/i],
  // A filter jug, a lunch bag or a shoe bag is the product itself, so the part word has to stand on its own.
  ['part', /\b(filters?|belts?|seals?|gaskets?|elements?|blades?|nozzles?|brush ?heads?|mop heads?|pads?|glands?|fill valve|flush valve|thermostats?|ignitors?|fuses?|expansion vessel)\b(?! (?:jugs?|tanks?|bottles?|taps?|kettles?|systems?|coffee))/i],
  ['part', /\b(?:vacuum|hoover|dust|hepa) bags?\b|\bbags? for\b/i],
  ['part', /\b(batter(?:y|ies)|chargers?)\b(?! (?:operated|powered))/i],
];

// Browsed, not needed, even when a word above appears: fragrance and beauty refills, meal replacements.
export const NOT_NEED = /\b(meal replacements?|foundation|perfume|parfum|eau de|fragrance|cologne|molecule|lipstick|mascara|serum|shampoo|conditioner)\b/i;
