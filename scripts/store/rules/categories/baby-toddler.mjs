// Baby & Toddler only. Tried on six exports (October to December 2025, July to September 2026), 14,761 products.

// Accessories that go with a car seat, a pushchair or a cot pass when the big product does not. The accessory has
// to be the product: named after the big product ("Pushchair Footmuff", "Car Seat Cover") with no "with", "and" or "&" between,
// or just before it or with "for" ("Hood Trim Pram", "Cup Holder for Buggy"). "Pushchair with Rain Cover & Cup Holder" is a pushchair.
const KIT_WORDS = String.raw`covers?|raincovers?|rain ?covers?|footmuffs?|cosy ?toes|liners?|inserts?|mirrors?|organi[sz]ers?|protectors?|kick mats?|mats?|sun ?shades?|shades?|parasols?|nets?|bags?|caddy|caddies|hooks?|clips?|pegs?|holders?|fans?|boards?|arch(?:es)?|canop(?:y|ies)|spirals?|accessor(?:y|ies)|replacements?|spares?|blankets?|ponchos?|mits|mitts|mittens?|gloves?|muffs?|straps?|adjusters?|supports?|pillows?|snack|trays?|lights?|weights?|wheels?|tyres?|inner tubes?|handlebars?|bumper bars?|charms?|chains?|rattles?|mobiles?|sheets?|bunting|storage|pockets?|adapters?|adaptors?|suits?|trims?|hoods?|wraps?|stands?|top changers?|changers?|projectors?|teething rails?|tidy|tidies|soothers?|monitors?|sensors?|toys?`;
const NO_WITH = String.raw`(?:(?!\b(?:with|and|inc|incl|including|includes|plus)\b|[&+])[^|])*?`;
const kit = (product) => String.raw`(?:${product})\b${NO_WITH}\b(?:${KIT_WORDS})|(?:${KIT_WORDS})\b[^|]*?\bfor\b[^|]*?\b(?:${product})|(?:${KIT_WORDS})\s+(?:${product})\b|universal[^|]*\b(?:${KIT_WORDS})|over[- ]the[- ]cot`;
// Toy prams and dolls' car seats are toys whatever they come with.
const TOY = String.raw`dolls?|doll'?s|toy (?:prams?|pushchairs?|strollers?|car ?seats?)|role ?play|pretend`;
const CAR = String.raw`car ?seats?|isofix|r129|r44|i-?size|travel systems?|boosters?(?: seats?| cushions?)?`;
const PUSH = String.raw`pushchairs?|prams?|strollers?|buggy|buggies|carrycots?`;
const COT = String.raw`cot ?beds?|cots?|cribs?|bedside cribs?`;

export const NOT_SHELF = [
  // Car seats and car booster seats: a child-safety product sold with fitting checks, out of her range (handoff,
  // 2 October). Their covers, toys, mirrors and kick mats pass.
  [String.raw`car ?seats?|isofix|r129|r44|i-?size|travel systems?`, null, String.raw`${kit(CAR)}|${TOY}`],
  // A booster is a car seat only when it says so; a dining or floor booster seat is a feeding product and passes.
  [String.raw`boosters?(?: seats?| cushions?)?`, String.raw`car|group ?[123]|high ?back|backless|\d{3} ?cm|isofix|r129|r44|harness|seat belt`, String.raw`${kit(CAR)}|${TOY}|dining|feeding|table|eating|high ?chairs?|floor seats?|potty|toilet|steps?|bath`],
  // Pushchairs, prams and strollers: bulky, courier only, not her range. Their accessories pass, and so do toy prams.
  [PUSH, null, String.raw`${kit(PUSH)}|${TOY}`],
  // Cots, cot beds and bedside cribs are nursery furniture; cot and crib mattresses are bulky and a sleep-safety
  // product. Travel cots, cot mobiles, sheets and toys pass, and so do Moses baskets.
  [String.raw`cot ?beds?|cots?|cribs?|bedside cribs?|next ?2 ?me|nursery furniture|changing (?:units?|tables?|stations?)|wardrobes?|chests? of drawers`, null, String.raw`${kit(COT)}|${TOY}|travel|music|wedge|changing mats?|mattress protectors?`],
  [String.raw`(?:cot|crib|cot ?bed|moses|pram|bedside|travel cot|baby|nursery) mattress(?:es)?`, null, String.raw`protectors?|covers?|sheets?|fitted|changing`],
];

export const RESTRICTED = {
  // Sleep products against safe-sleep advice (The Lullaby Trust): nests, pods, positioners, wedges, pillows, bumpers
  // and weighted sleep products. Anti-roll changing mats are not sleep products and pass (NOT_RESTRICTED in
  // ../restricted.mjs).
  sleep_safety: String.raw`\b(baby ?nests?|babynests?|sleep ?(?:positioners?|wedges?|nests?)|positioners?|dock ?a ?tot|sleepyhead|cocoonababy|purflo|sleepcarrier|dreamcradle|cosymorpho|morpho ?mattress|anti[- ]?roll (?:pillows?|cushions?|wedges?)|weighted (?:sleep ?(?:bags?|sacks?|suits?)|swaddles?|blankets?)|reflux (?:sleep|wedges?|pillows?|cradles?)|baby (?:sleep )?pillows?|(?:cot|crib) bumpers?|bumpers? for (?:cots?|cribs?)|(?:cot|crib) wedges?|flat head pillows?|head shaping pillows?)\b`,
  // Baby medicines the shared list does not name: teething gels and powders, colic drops, gripe water and licensed
  // nappy rash ointment. Probiotic and vitamin drops are food supplements and pass.
  // First and follow-on milks the shared rule misses: comfort, hungry, anti-reflux and allergy formulas (FSMP, used
  // under medical advice) and ready-to-feed infant milk. Toddler and growing-up milks pass.
  infant_formula_more: String.raw`^(?!.*\b(?:toddler|growing up|stage 3|12\+ ?months?)\b)(?=.*\b(?:milk|formula|kendamil|aptamil|sma|hipp|cow (?:&|and) gate|nutricia|enfamil)\b).*?\b(ready to feed|ready made|comfort (?:baby |first |infant )?(?:milk|formula)|hungry (?:baby |first |infant )?milk|(?:milk|formula)\\b[^|]*\\bfrom birth|from birth\\b[^|]*\\b(?:milk|formula)|anti[- ]?reflux|lactose free|nutramigen|pepti|althera|alfamino|neocate|puramino|hypoallergenic formula)\b`,
  baby_medicines: String.raw`\b(anbesol|calgel|teejel|infacol|dentinox (?:teething|colic|infant colic)|ashton (?:&|and) parsons|gripe water|woodward'?s|teething (?:gels?|powders?|granules?)|metanium nappy rash ointment)\b`,
};

// Google's Brand column sometimes names the shop, not the maker: Kendamil under ASDA, M&S and Boots, a Momcozy pump
// under Boots, a Dreambaby holder under Argos. A title naming a maker from this list is that maker's product, so the
// shop's name in the Brand column does not make it own label. Cuggl (Argos), Little Angels (ASDA) and Little Ones
// (Sainsbury's) are the shops' own and still stop.
export const BRANDED = String.raw`\b(kendamil|little dish|petits filous|ella'?s kitchen|organix|hipp|momcozy|elvie|medela|lansinoh|tommee tippee|philips avent|avent|mam|nuk|nuby|dr\.? brown'?s|munchkin|dreambaby|lindam|safety 1st|bebeconfort|clevamama|angelcare|joie|graco|chicco|maxi-?cosi|cybex|silver cross|ickle bubba|my babiie|bababing|cosatto|hauck|kinderkraft|bugaboo|uppababy|icandy|miniuno|littlelife|hubble|motorola|vtech|nanit|owlet|clair de lune|love to dream|ergopouch|grobag|ergobaby|babybj[oö]rn|baby bj[oö]rn|skip hop|fisher[- ]price|lamaze|tiny love|infantino|sophie la girafe|nattou|done by deer|lascal|waterwipes|pampers|huggies|johnson'?s|totter (?:\+|and|&) tumble|jellycat)\b`;
