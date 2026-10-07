/*
 * Not hers to sell, whatever the price. Each entry is a regex source, matched case-insensitively on the title.
 * Supplements pass: they need free food business registration with her council, which is her decision.
 */
export const RESTRICTED = {
  // Prescription and pharmacy medicines
  medicines: String.raw`\b(fluconazole|duraphat|period delay|norethisterone|sildenafil|viagra|tadalafil|cialis|finasteride|codeine|co-codamol|levonorgestrel|morning after pill|ellaone|ulipristal|naproxen|omeprazole|lansoprazole|esomeprazole|propranolol|antibiotics?|ciprofloxacin|orlistat|alli \d+ ?mg|mounjaro|wegovy|semaglutide|tirzepatide|(?:asthma|salbutamol|ventolin|blue|brown|steroid) inhalers?|salbutamol|orlos|(?:weekend|night|contraceptive|diet|slimming) pills?)\b|(?<!\bno )\bprescription\b`,
  // Shop-shelf (GSL) medicines too: selling any medicine online needs MHRA distance-selling registration she does
  // not have. Brands whose whole range is medicine are named; mixed ranges (Savlon, Vicks) only by the medicine.
  shelf_medicines: String.raw`\b(fybogel|acnecide|duac|benzoyl peroxide|olbas|echinaforce|traditional herbal (?:medicinal|medicine|remedy)|thr registered|paracetamol|ibuprofen|aspirin|nurofen|anadin|calpol|lemsip|beechams|night nurse|day nurse|benylin|strepsils|gaviscon|rennie(?! tools)|imodium|loperamide|senokot|dulcolax|bisacodyl|lactulose|sudafed|pseudoephedrine|phenylephrine|otrivine|xylometazoline|beconase|piriton|chlorphenamine|cetirizine|loratadine|fexofenadine|acrivastine|clarityn|benadryl|nytol|sominex|zovirax|aciclovir|anusol|preparation h|(?<!my little )sudocrem(?![^|,]*\b(?:care (?:(?:&|and) )?protect|sudosalve|assuraderm)\b)|bonjela|voltarol|ibuleve|diclofenac|hydrocortisone|vaporub|minoxidil|regaine|daktarin|(?:thrush|cystitis) (?:treatment|cream|tablets?|capsules?|pessar(?:y|ies))|canesten (?:thrush|cream|oral|combi|duo|once|pessary)|(?:hay ?fever|antihistamine|allergy relief|pain ?relief|painkiller|travel sickness|sleep ?aid|laxative) (?:tablets?|capsules?|caplets?|liquid|syrup)|cough (?:syrup|medicine|mixture|linctus)|cold (?:and|&) flu (?:tablets?|capsules?|sachets?|relief))\b`,
  // Infant formula: its promotion is restricted by law, and it is the most counterfeited baby product
  infant_formula: String.raw`\b(infant (?:formula|milk)|baby formula|first (?:infant )?milk|follow[- ]on milk|(?:aptamil|kendamil|hipp|sma|cow (?:&|and) gate)\b[^|,]*\b(?:first|infant|follow[- ]on|stage 1|stage 2))\b`,
  // Prescription pet diets, sold for animals under a vet's care
  vet_diet: String.raw`\b(prescription diet|veterinary diet|vet diet|hill'?s (?:prescription|[a-z]/d)|royal canin veterinary|pro plan veterinary|renal diet)\b`,
  // Illegal in UK cosmetics or unlicensed injectables
  banned_cosmetics: String.raw`\b(hydroquinone|skin bleaching|mercury cream|melanotan|tanning (?:injection|nasal spray)|(?:dermal|injectable) fillers?|hyaluron(?:ic)? pen|teosyal|redensity|profhilo|juvederm|restylane|skin boosters? (?:injection|injectable)|botox(?! (?:effect|alternative|in a bottle|like))|(?<!(?:bubble|bait|pop|predator|fidget|sensory|pimple|pill|push) )poppers(?![^|]*\b(?:waistband|press studs?|snaps?|vests?|bodysuits?|sleepsuits?|rompers?|pliers|tool|kit|fidget|toy|bubbles?|sensory|bait|lures?|fishing|pike|perch)\b)|amyl nitrite)\b`,
  // Smell-alikes that name the original: using another brand's name to sell a copy is trademark infringement
  dupes: String.raw`\b(dupe|smell-?alike|replica fragrance)\b|\binspired by\b[^|]*\b(?:perfume|fragrance|parfum|edp|edt|scent)\b|\b(?:perfume|fragrance|parfum|scent)\b[^|]*\binspired by\b`,
  // Peroxide tooth whitening over the legal strength; whitening toothpaste and PAP whitening pass
  whitening: String.raw`\b(whitestrips?|carbamide|polanight|poladay|nitewhite|daywhite|opalescence)\b|\bhydrogen peroxide\b[^,|]*\b(?:teeth|tooth|whitening)\b|\b(?:teeth|tooth) whitening\b[^,|]*\bhydrogen peroxide\b|\d+(\.\d+)?%[^,|]*\bwhitening\b|\bwhitening\b[^,|]*\b\d+(\.\d+)?%`,
  // Contact lenses need a prescription check
  lenses: String.raw`\b(contact lens(es)?(?! (?:cases?|solution|suckers?|removers?|tweezers|holders?|inserters?|applicators?|cleaners?|travel kit))|daily lenses|monthly lenses|dailies|acuvue|air optix|biofinity)\b`,
  // Licensed or banned for general sale
  nicotine: String.raw`\b(nicotine|niquitin|nicorette|nicotinell)\b`,
  // Age-restricted or licensed whatever they contain: a nicotine-free vape is still a vape
  licensed: String.raw`\b(melatonin|vapes?|e-liquids?|cbd|shisha|rolling tobacco)\b|^(?!.*\b(?:candles?|scents?|scented|fragrance|diffusers?|wax|melts?|bins?|ashtrays?|incense|carpets?|flooring|laminate|vinyl|rugs?|paint|colou?r|leather|oak|tiles?|fabric|sofa|curtains?|toys?|plush|chew|squeaky|teething|dogs?|cats?|pets?)\b).*\b(?:tobacco|cigarettes?|cigars?)\b(?! (?:cases?|holders?|box(?:es)?|tins?|lighters?|cutters?|humidors?))`,
  // Alcohol needs a premises licence. Only the drink itself: a drink word with a size, a pack or a tasting, and no
  // barware in the title (glasses, cups, smoker kits, barrels, figures and lights named after a drink all pass).
  alcohol: String.raw`^(?!.*\b(?:glass(?:es|ware)?|cups?|tumblers?|goblets?|flutes?|decanters?|smoker|smoking|barrels?|kegs?|racks?|openers?|coolers?|chillers?|stoppers?|pourers?|carriers?|holders?|stands?|displays?|figures?|ornaments?|leds?|lights?|candles?|scented|signs?|mugs?|stones?|molds?|moulds?|making kit|essence|flavou?rings?|cake|fudge|truffles?|chocolates?|sauce|vinegar|note ?books?|journals?|diar(?:y|ies)|log ?books?|planners?|cards?)\b).*\b(vodka|gin|whisk(?:e)?y|rum|tequila|liqueur|prosecco|champagne|cava|cider|brandy|cognac|bourbon|sake|(?:red|white|ros[eé]|sparkling|mulled) wine|pre-?mixed|cocktail cans?)\b.*\b(\d+(?:\.\d+)? ?(?:cl|ml|l|litres?)|cans?|\d+ ?(?:x|pack|pk)|tasting|miniatures?|bottles?|abv|vol)\b|\b\d+(\.\d+)?% (?:abv|vol)\b`,
  // No blades, knives or sharp cutting tools (Joseey, 6 October): neither eBay nor her shop has an age check. The same
  // words as src/lib/blades.js and candidate_is_bladed (0144), so nothing reaches her queue that golive would block.
  bladed: String.raw`\b(knife|knives|blades?|razors?|scalpels?|machetes?|swords?|daggers?|axe|hatchets?|cleavers?|box cutters?|craft knife|utility knife|stanley knife|multi-?tools?|secateurs|pruning saws?|loppers|scissors|shears)\b`,
  // Laser pointers over 1mW are not legal to sell to the public in the UK, and the green "303" kind run far above it.
  // Presenters and clickers pass, and so do laser labels, levels and engravers (the word "pointer" or "pen" is needed).
  laser_pointer: String.raw`^(?!.*\b(?:presenters?|presentation|clickers?|remotes?|page turners?)\b).*\b(?:laser|lazer) (?:pointers?|pens?|torch(?:es)?)\b|\b(?:green|303|532 ?nm|high power|burning) (?:laser|lazer)\b(?!.*\b(?:levels?|line|labels?|printers?|engrav\w+)\b)`,
  // Weapons and knives need age checks she is not set up for
  weapons: String.raw`^(?!.*\b(?:crossbow education|irlen|reading rulers?|overlays?|notebooks?|toys?|games?|catapults?|suction|foam|nerf|darts?|rc|truck|truggy|lego|fake|prop|plastic|costume|cosplay|kids?|children'?s?)\b).*\b(crossbows?|machetes?)\b|\b(air (?:rifles?|pistols?)(?![^|]*\b(?:targets?|spinners?|knock ?downs?|pellet traps?|compressors?|pumps?|scopes?|mounts?|slings?|bags?|cases?|cleaning|stands?|holders?)\b)|pepper spray|stun guns?|tasers?|knuckle dusters?|flick knives?)\b`,
};
// Titles that name alcohol but are not it.
// Titles that name alcohol or nicotine but are not it. They clear only that one rule: a nicotine-free vape still
// stops as a vape, and "alcohol-free" never clears a medicine.
export const NOT_RESTRICTED = {
  alcohol: String.raw`\b(alcohol[- ]free|non[- ]alcoholic|0\.0%|0% abv)\b`,
  nicotine: String.raw`\b(nicotine[- ]free|0 ?mg nicotine)\b`,
  // Baby & Toddler: an anti-roll wedge on a changing mat is not a sleep product.
  sleep_safety: String.raw`\bchang(?:e|ing)\b`,
  // The same exceptions as src/lib/blades.js: blades that are not a cutting edge, and shaver heads.
  bladed: String.raw`\b(wiper|fan|propeller|rotor|blender|turbine)\s+blades?\b|\b(shaver|shaving|trimmer|epilator|clipper)s?\b`,
  // A case, bag or log for a medicine is not the medicine (a Mounjaro pen case, a medication log book).
  medicines: String.raw`\b(?:pen|injection|insulin|medication|medicine|pill) (?:cases?|bags?|cool(?:er|ing) (?:bags?|cases?)|travel cases?|holders?|pouch(?:es)?|wallets?)\b|\b(?:log ?books?|trackers?|journals?|planners?|record books?)\b`,
};
