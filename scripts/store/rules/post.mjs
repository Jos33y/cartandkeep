/*
 * What Royal Mail will and will not carry inside the UK (Post Office "what can I send" guidance, checked
 * 30 September 2026). CANT_POST stops a product; POST_CHECK lets it through with a note for her card.
 */
export const CANT_POST = {
  // Compressed gas is prohibited outright, including CO2 cylinders and fire extinguishers
  compressed_gas: String.raw`\b(?:gas|co2|butane|propane|camping gas|helium|nitrous) (?:cylinders?|canisters?|cartridges?|bottles?|refills?)\b|\bsodastream (?:gas|cylinder|quick connect)|\blighter (?:gas|fluid|refills?)\b|\bcream chargers?\b|\b(?:calor|flogas)\b.*\b(?:propane|butane|patio gas)\b|\b(?:propane|butane|mapp?) gas\b(?! (?:regulators?|hoses?|torch(?:es)?|heaters?|bbq|barbecues?|burners?|fittings?|valves?))|\bfire extinguishers?\b|\b(?:gas|butane|jet|torch|windproof|refillable|clipper|cook's) lighters?\b|\bzippo\b|\b(?:safety|kitchen|cook's|extra long|long) matches\b`,
  // Flammable liquids and solids
  flammable: String.raw`\b(petrol (?:fuel|cans? filled)|paraffin (?:oil|fuel)|kerosene|white spirit|methylated spirits?|meths|turpentine|paint thinners?|acetone|nail (?:polish|varnish) remover|lamp oil|firelighters?(?! (?:box|holder|tin|storage|case))|firelighter gel|bioethanol fuel|isopropyl alcohol)\b`,
  // Corrosives
  // Oxidisers
  oxidiser: String.raw`\bhydrogen peroxide\b(?![^,|]*\b(?:teeth|tooth|whitening)\b)|\bcalcium hypochlorite\b|\bpool (?:chlorine|shock)\b|\boxidi[sz]ing\b`,
  corrosive: String.raw`\b(car batter(?:y|ies)|leisure batter(?:y|ies)|lead[- ]acid|drain (?:unblocker|cleaner|opener)(?![^,|]*\b(?:\d+(?:\.\d+)? ?m\b|metres?|rods?|augers?|snakes?|springs?|\d+v\b|cordless|machine|plungers?|tools?|pump|cable)\b)|caustic soda|sodium hydroxide|hydrochloric|sulphuric|sulfuric|brick acid|patio acid|oven cleaner)\b`,
  // Aerosols that are not toiletries or medicines (paint, air freshener, insect sprays) are prohibited
  aerosol: String.raw`(?<!\bnon[- ])\baerosol\b(?![- ]free)|\bspray paint\b|^(?!.*\b(?:rechargeable|cordless|electric|vacuum)\b).*\bcompressed air (?:dusters?|cans?|sprays?)\b|\bwd-?40\b|\b(?:fly|wasp|flying insect) (?:killer )?spray\b|\bfurniture polish spray\b|\bstarch spray\b`,
  // Explosives
  explosive: String.raw`\bfireworks? (?:selection|display|packs?|box|barrage|rockets?|cakes?)\b|\brockets? (?:pack|set)\b|\bsparklers? (?:pack|sticks?|box)\b|\bparty poppers?\b|\broman candles?\b`,
};
// Toiletry and medicinal aerosols are allowed, so the aerosol stop skips these.
export const TOILETRY_AEROSOL = String.raw`\b(deodorant|anti-?perspirant|dry shampoo|hair ?spray|body spray|shaving (?:foam|gel)|mousse|spray tan|sun ?(?:cream|screen|spray)|spf|freeze spray|cooling spray|plaster spray)\b`;

export const POST_CHECK = [
  ['toiletry aerosol: 500ml max per item, 2 per parcel, ID8000 label, handed in at a Post Office', String.raw`\b(?:deodorant|anti-?perspirant) (?:spray|aerosol)\b|\b(dry shampoo|hair ?spray|body spray|shaving foam|spray tan)\b(?! (?:bottles?|atomi[sz]ers?|empty))`],
  ['perfume: 150ml max per item, 4 per parcel', String.raw`^(?!.*\b(?:diffusers?|laundry|home scent\w*|room|candles?|wax melts?|atomi[sz]ers?|advent|incense|home perfume|making kit|pearls of perfume|bare roots?)\b).*\b(eau de (?:parfum|toilette|cologne)|edp|edt|perfume|parfum|cologne|body mist)\b`],
  ['nail polish: 30ml max per item, 4 per parcel', String.raw`\bnail (?:polish|varnish|lacquer)\b(?! remover)|\bgel polish\b`],
  ['loose lithium batteries cannot be posted; inside a device is fine', String.raw`(?<!\b(?:with|sealed[- ]in|built[- ]in|internal|integrated|rechargeable|and)(?: 10 year)? )\b(?:lithium|li-?ion) (?:batter(?:y|ies)|cells?)\b(?![- ](?:powered|operated|included|chargers?|charging))|\bcr\d{4}\b(?=[^,|]*\b(?:batter(?:y|ies)|coin|cells?|3v)\b)|\b18650\b`],
  ['may be an aerosol: aerosols other than toiletries cannot be posted', String.raw`\b(?:flea|mould|mold|bed ?bug|moth|ant|insect|crawling insect) (?:killer )?spray\b|\bspray (?:polish|starch)\b|\bair freshener spray\b`],
  // Offensive Weapons Act 2019: bladed articles need an age check at checkout and age-verified delivery.
  ['bladed article: age check at checkout and Royal Mail Tracked Age Verification delivery (Offensive Weapons Act)', String.raw`^(?!.*\b(?:sharpeners?|sharpening|magnetic (?:strip|rack)|knife (?:rack|holder|block empty)|butter|razors?|blades? refills?|cartridges?|shaver|knife grade|glue|filler|putty)\b).*\b(knife|knives|cleavers?|axes?|hatchets?|machetes?|craft knife|stanley knife|utility knife|scalpel)\b`],
  // Liquid paint, varnish and wood stain: water-based can be posted in a leakproof tin and sealed bag; solvent-based
  // (oil-based gloss, many metal paints and wood stains) is flammable and cannot. The title rarely says which.
  ['paint, varnish or stain: water-based only by post; solvent-based is flammable, check the tin', String.raw`^(?!.*\b(?:brush(?:es)?|rollers?|trays?|kettles?|pads?|scrapers?|strippers?|masking|tape|pens?|markers?|sticks?|mixers?|sprayers?)\b).*\b(paint|emulsion|gloss|varnish|wood ?stain|lacquer|primer|undercoat|creosote|wood (?:protector|preserver|treatment)|fence (?:paint|treatment|protector|life)|decking (?:oil|stain)|teak oil|danish oil)\b`],
  ['alcohol hand gel is flammable: check the limits', String.raw`\bhand (?:sanitiser|sanitizer|gel)\b`],
];
