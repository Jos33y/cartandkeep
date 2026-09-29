/*
 * eBay category to Google category, in one table. The first row whose eBay path is a prefix of the card's eBay
 * path wins, so the more specific rows sit above the general ones. Targets are Google paths as written in
 * Google's file; they are turned into IDs when loaded, and a path that is not in the file stops the run.
 *
 * Maps what the product is. Where Google files a thing differs from where she might shelve it (ink sits under
 * Electronics > Print, Copy, Scan & Fax, which her shop may show in an Office section), the Google place stands:
 * it is the google_product_category her feed will carry. Store sections are chosen from these later.
 */
export const EBAY_TO_GOOGLE = [
  // Health & Beauty
  // Healthcare to the third level, so care aids are browsed as walking aids, incontinence, supports and so on.
  ['Health & Beauty|Medical & Mobility|Orthopaedics & Supports', 'Health & Beauty > Healthcare > Supports & Braces'],
  ['Health & Beauty|Medical & Mobility|Daily Living Aids|Incontinence Aids', 'Health & Beauty > Healthcare > Incontinence Aids'],
  ['Health & Beauty|Medical & Mobility|Daily Living Aids|Portable Urinals & Bed Pans', 'Health & Beauty > Healthcare > Incontinence Aids'],
  ['Health & Beauty|Medical & Mobility|Daily Living Aids', 'Health & Beauty > Healthcare > Mobility & Accessibility > Accessibility Equipment'],
  ['Health & Beauty|Medical & Mobility|Mobility/Walking Equipment|Walkers & Canes', 'Health & Beauty > Healthcare > Mobility & Accessibility > Walking Aids'],
  ['Health & Beauty|Medical & Mobility|Mobility/Walking Equipment|Crutches', 'Health & Beauty > Healthcare > Mobility & Accessibility > Walking Aids'],
  ['Health & Beauty|Medical & Mobility|Mobility/Walking Equipment|Parts & Accessories', 'Health & Beauty > Healthcare > Mobility & Accessibility > Accessibility Equipment Accessories'],
  ['Health & Beauty|Medical & Mobility|Mobility/Walking Equipment', 'Health & Beauty > Healthcare > Mobility & Accessibility > Accessibility Equipment'],
  ['Health & Beauty|Medical & Mobility|Mobility Furniture & Fixtures', 'Health & Beauty > Healthcare > Mobility & Accessibility > Accessibility Furniture & Fixtures'],
  ['Health & Beauty|Medical & Mobility', 'Health & Beauty > Healthcare > Mobility & Accessibility'],
  ['Health & Beauty|Health Care|Foot Creams', 'Health & Beauty > Personal Care > Foot Care'],
  ['Health & Beauty|Health Care|Pill Holders', 'Health & Beauty > Healthcare > Pill Boxes'],
  ['Health & Beauty|Health Care|Monitoring & Testing|Thermometers', 'Health & Beauty > Healthcare > Biometric Monitors > Medical Thermometers'],
  ['Health & Beauty|Health Care|Monitoring & Testing', 'Health & Beauty > Healthcare > Biometric Monitors'],
  ['Health & Beauty|Health Care|First Aid|Kits', 'Health & Beauty > Healthcare > First Aid > First Aid Kits'],
  ['Health & Beauty|Health Care|First Aid', 'Health & Beauty > Healthcare > First Aid'],
  ['Health & Beauty|Vitamins & Lifestyle Supplements|Weight Management|Meal Replacement', 'Health & Beauty > Healthcare > Fitness & Nutrition > Meal Replacement Drinks'],
  ['Health & Beauty|Vitamins & Lifestyle Supplements|Weight Management|Weight Loss Programme Foods', 'Health & Beauty > Healthcare > Fitness & Nutrition > Nutrition Bars'],
  ['Business, Office & Industrial|Healthcare, Lab & Dental|Medical & Lab Equipment, Devices|TENS', 'Health & Beauty > Healthcare > Occupational & Physical Therapy Equipment > Electrical Muscle Stimulators'],
  ['Business, Office & Industrial|Healthcare, Lab & Dental|Medical & Lab Equipment, Devices|Medical Thermometers', 'Health & Beauty > Healthcare > Biometric Monitors > Medical Thermometers'],
  ['Health & Beauty|Health Care', 'Health & Beauty > Healthcare'],
  ['Health & Beauty|Natural & Alternative Remedies', 'Health & Beauty > Healthcare'],
  ['Health & Beauty|Vitamins & Lifestyle Supplements', 'Health & Beauty > Healthcare > Fitness & Nutrition > Vitamins & Supplements'],
  ['Health & Beauty|Oral Care', 'Health & Beauty > Personal Care > Oral Care'],
  ['Health & Beauty|Shaving & Hair Removal', 'Health & Beauty > Personal Care > Shaving & Grooming'],
  ['Health & Beauty|Hair Care & Styling', 'Health & Beauty > Personal Care > Haircare'],
  ['Health & Beauty|Vision Care', 'Health & Beauty > Personal Care > Vision Care'],
  ['Health & Beauty|Massage', 'Health & Beauty > Personal Care > Massage & Relaxation'],
  ['Health & Beauty|Fragrances', 'Health & Beauty > Personal Care > Cosmetics > Perfume & Cologne'],
  ['Health & Beauty|Bath & Body', 'Health & Beauty > Personal Care > Cosmetics > Bath & Body'],
  ['Health & Beauty|Skin Care', 'Health & Beauty > Personal Care > Cosmetics > Skincare'],
  ['Health & Beauty|Sun Care & Tanning', 'Health & Beauty > Personal Care > Cosmetics > Skincare'],
  ['Health & Beauty|Make-Up', 'Health & Beauty > Personal Care > Cosmetics > Make-Up'],
  ['Health & Beauty|Nail Care', 'Health & Beauty > Personal Care > Cosmetics > Nail Care'],
  ['Health & Beauty', 'Health & Beauty'],

  // Home, Furniture & DIY: split at the second level between Home & Garden and Hardware
  ['Home, Furniture & DIY|Household & Laundry Supplies|Laundry Supplies', 'Home & Garden > Household Supplies > Laundry Supplies'],
  ['Home, Furniture & DIY|Household & Laundry Supplies|Cleaning', 'Home & Garden > Household Supplies > Household Cleaning Supplies'],
  ['Home, Furniture & DIY|Household & Laundry Supplies', 'Home & Garden > Household Supplies'],
  ['Home, Furniture & DIY|Home Security|Smoke & Gas Detectors', 'Home & Garden > Flood, Fire & Gas Safety > Smoke & Carbon Monoxide Detectors'],
  ['Home, Furniture & DIY|Home Security', 'Home & Garden > Business & Home Security'],
  ['Home, Furniture & DIY|Smart Home & Surveillance', 'Home & Garden > Business & Home Security'],
  ['Home, Furniture & DIY|Cookware, Dining & Bar', 'Home & Garden > Kitchen & Dining'],
  ['Home, Furniture & DIY|Appliances|Small Kitchen Appliances', 'Home & Garden > Kitchen & Dining > Kitchen Appliances'],
  ['Home, Furniture & DIY|Appliances|Coffee, Tea & Espresso', 'Home & Garden > Kitchen & Dining > Kitchen Appliances'],
  ['Home, Furniture & DIY|Appliances', 'Home & Garden > Household Appliances'],
  ['Home, Furniture & DIY|Heating, Cooling & Air', 'Home & Garden > Household Appliances > Climate Control Appliances'],
  ['Home, Furniture & DIY|Bath', 'Home & Garden > Bathroom Accessories'],
  ['Home, Furniture & DIY|Bedding', 'Home & Garden > Linens & Bedding'],
  ['Home, Furniture & DIY|Lighting', 'Home & Garden > Lighting'],
  ['Home, Furniture & DIY|Celebrations & Occasions', 'Home & Garden > Decor > Seasonal & Holiday Decorations'],
  ['Home, Furniture & DIY|Candles & Home Fragrance', 'Home & Garden > Decor > Candles & Home Fragrances'],
  ['Home, Furniture & DIY|Clocks', 'Home & Garden > Decor > Clocks'],
  ['Home, Furniture & DIY|Storage Solutions', 'Home & Garden > Household Supplies > Storage & Organisation'],
  ['Home, Furniture & DIY|Children\'s Home & Furniture', 'Home & Garden > Decor'],
  ['Home, Furniture & DIY|Furniture', 'Furniture'],
  ['Home, Furniture & DIY|Luggage & Travel Accessories', 'Luggage & Bags'],
  ['Home, Furniture & DIY|Food & Drink', 'Food, Beverages & Tobacco'],
  ['Home, Furniture & DIY|Plumbing & Fixtures', 'Hardware > Plumbing'],
  ['Home, Furniture & DIY|DIY Materials|Paint, Stain & Varnish', 'Hardware > Building Consumables > Painting Consumables'],
  ['Home, Furniture & DIY|DIY Materials|Doors & Door Hardware', 'Hardware > Building Materials > Door Hardware'],
  ['Home, Furniture & DIY|DIY Materials|Windows', 'Hardware > Building Materials > Window Hardware'],
  ['Home, Furniture & DIY|DIY Materials|Nails, Screws', 'Hardware > Hardware Accessories > Hardware Fasteners'],
  ['Home, Furniture & DIY|DIY Materials|Roofing', 'Hardware > Building Materials > Roofing'],
  ['Home, Furniture & DIY|DIY Materials', 'Hardware > Building Consumables'],
  ['Home, Furniture & DIY|DIY Tools & Workshop Equipment|Measuring', 'Hardware > Tools > Measuring Tools & Sensors'],
  ['Home, Furniture & DIY|DIY Tools & Workshop Equipment|Power Tool & Air Tool Accessories', 'Hardware > Tool Accessories'],
  ['Home, Furniture & DIY|DIY Tools & Workshop Equipment|Tool Boxes', 'Hardware > Hardware Accessories > Tool Storage & Organisation'],
  ['Home, Furniture & DIY|DIY Tools & Workshop Equipment', 'Hardware > Tools'],
  ['Home, Furniture & DIY', 'Home & Garden'],
  ['Home & Garden|Bath', 'Home & Garden > Bathroom Accessories'],
  ['Home & Garden', 'Home & Garden'],

  // Garden & Patio
  ['Garden & Patio|Garden Power Tools', 'Home & Garden > Lawn & Garden > Outdoor Power Equipment'],
  ['Garden & Patio|Garden Lighting', 'Home & Garden > Lighting'],
  ['Garden & Patio|Bird & Wildlife', 'Home & Garden > Decor > Bird & Wildlife Feeders'],
  ['Garden & Patio', 'Home & Garden > Lawn & Garden'],

  // Pets
  ['Pet Supplies|Dog Supplies', 'Animals & Pet Supplies > Pet Supplies > Dog Supplies'],
  ['Pet Supplies|Cat Supplies', 'Animals & Pet Supplies > Pet Supplies > Cat Supplies'],
  ['Pet Supplies|Small Animal Supplies', 'Animals & Pet Supplies > Pet Supplies > Small Animal Supplies'],
  ['Pet Supplies', 'Animals & Pet Supplies > Pet Supplies'],

  // Toys
  ['Toys & Games|Construction & Building Toys', 'Toys & Games > Toys > Building Toys'],
  ['Toys & Games|Games', 'Toys & Games > Games'],
  ['Toys & Games|Action Figures', 'Toys & Games > Toys > Dolls, Playsets & Toy Figures'],
  ['Toys & Games|Outdoor Toys', 'Toys & Games > Outdoor Play Equipment'],
  ['Toys & Games', 'Toys & Games > Toys'],
  ['Dolls & Bears', 'Toys & Games > Toys > Dolls, Playsets & Toy Figures'],

  // Business, Office & Industrial: split between Office Supplies, Hardware and Business & Industrial
  ['Business, Office & Industrial|Office Equipment & Supplies', 'Office Supplies > Office Equipment'],
  ['Business, Office & Industrial|Cleaning & Janitorial Supplies', 'Home & Garden > Household Supplies > Household Cleaning Supplies'],
  ['Business, Office & Industrial|Hand Tools', 'Hardware > Tools'],
  ['Business, Office & Industrial|Power Tools', 'Hardware > Tools'],
  ['Business, Office & Industrial|Electrical Equipment & Supplies', 'Hardware > Power & Electrical Supplies'],
  ['Business, Office & Industrial|Building Materials & Supplies', 'Hardware > Building Consumables'],
  ['Business, Office & Industrial|Adhesives, Sealants & Tapes', 'Hardware > Building Consumables > Hardware Glue & Adhesives'],
  ['Business, Office & Industrial|Fasteners & Hardware', 'Hardware > Hardware Accessories > Hardware Fasteners'],
  ['Business, Office & Industrial|Hydraulics, Pneumatics, Pumps & Plumbing', 'Hardware > Plumbing'],
  ['Business, Office & Industrial|Healthcare, Lab & Dental', 'Health & Beauty > Healthcare'],
  ['Business, Office & Industrial|Facility Maintenance & Safety|Fire Protection', 'Home & Garden > Flood, Fire & Gas Safety'],
  ['Business, Office & Industrial|Facility Maintenance & Safety', 'Business & Industrial > Work Safety Protective Equipment'],
  ['Business, Office & Industrial', 'Business & Industrial'],

  // Electronics; ink and toner stay where Google files them
  ['Computers/Tablets & Networking|Printers, Scanners & Supplies', 'Electronics > Print, Copy, Scan & Fax > Printer, Photocopier & Fax Machine Accessories > Printer Consumables > Toner & Inkjet Cartridges'],
  ['Computers/Tablets & Networking|Keyboards, Mice & Pointers', 'Electronics > Electronics Accessories > Computer Components > Input Devices'],
  ['Computers/Tablets & Networking|Home Networking', 'Electronics > Networking'],
  ['Computers/Tablets & Networking|Computer Cables', 'Electronics > Electronics Accessories > Cables'],
  ['Computers/Tablets & Networking', 'Electronics > Electronics Accessories > Computer Accessories'],
  ['Sound & Vision|Multipurpose Batteries', 'Electronics > Electronics Accessories > Power > Batteries'],
  ['Sound & Vision|Portable Audio & Headphones', 'Electronics > Audio > Audio Components > Headphones & Headsets'],
  ['Sound & Vision', 'Electronics'],
  ['Mobile Phones & Communication', 'Electronics > Communications > Telephony > Mobile Phone Accessories'],
  ['Video Games & Consoles|Video Game Accessories', 'Electronics > Video-Game Console Accessories'],
  ['Video Games & Consoles', 'Software > Video Games'],
  ['Cameras & Photography', 'Cameras & Optics'],

  // Vehicles, sport, and the rest
  ['Vehicle Parts & Accessories|Car Care', 'Vehicles & Parts > Vehicle Parts & Accessories > Vehicle Maintenance, Care & Decor'],
  ['Vehicle Parts & Accessories', 'Vehicles & Parts > Vehicle Parts & Accessories'],
  ['Sporting Goods|Fitness, Running & Yoga', 'Sporting Goods > Exercise & Fitness'],
  ['Sporting Goods|Camping & Hiking', 'Sporting Goods > Outdoor Recreation > Camping & Hiking'],
  ['Sporting Goods|Cycling', 'Sporting Goods > Outdoor Recreation > Cycling'],
  ['Sporting Goods', 'Sporting Goods'],
  ['Clothes, Shoes & Accessories', 'Clothing & Accessories'],
  ['Clothing, Shoes & Accessories', 'Clothing & Accessories'],
  ['Collectables', 'Arts & Entertainment > Hobbies & Creative Arts > Collectables'],
  ['Sports Memorabilia', 'Arts & Entertainment > Hobbies & Creative Arts > Collectables > Sports Collectibles'],
  ['Crafts', 'Arts & Entertainment > Hobbies & Creative Arts > Arts & Crafts'],
];

// Where eBay files a thing but the product is something else. Kept through every re-import.
export const OVERRIDES = {
  'male washable front briefs': 'Health & Beauty > Healthcare > Incontinence Aids',
  'derby luxury walking stick': 'Health & Beauty > Healthcare > Mobility & Accessibility',
  'fulton birdcage umbrella': 'Home & Garden > Parasols & Rain Umbrellas',
  'universal poly sling s': 'Health & Beauty > Healthcare > Mobility & Accessibility',
  'back wheelchair gloves': 'Health & Beauty > Healthcare > Mobility & Accessibility',
  'disposable urine bags': 'Health & Beauty > Healthcare > Incontinence Aids',
  'soxon sock stocking aid': 'Health & Beauty > Healthcare > Mobility & Accessibility',
  'wednesday adams doll': 'Toys & Games > Toys > Dolls, Playsets & Toy Figures',
  'dylon renew colour detergent': 'Home & Garden > Household Supplies > Laundry Supplies',
  'gloss floor varnish': 'Hardware > Building Consumables > Painting Consumables',
  // Care aids eBay files under bath brushes, ostomy or remedies.
  'long handled back washer': 'Health & Beauty > Healthcare > Mobility & Accessibility > Accessibility Equipment',
  'long handled backwasher': 'Health & Beauty > Healthcare > Mobility & Accessibility > Accessibility Equipment',
  'long handled body washer': 'Health & Beauty > Healthcare > Mobility & Accessibility > Accessibility Equipment',
  'long handled hair washer': 'Health & Beauty > Healthcare > Mobility & Accessibility > Accessibility Equipment',
  'hand exercise putty medium': 'Health & Beauty > Healthcare > Occupational & Physical Therapy Equipment',
  'lavender wheat warmer fleece': 'Health & Beauty > Healthcare > First Aid > Hot & Cold Therapies',
  'neom wellbeing reed diffuser': 'Home & Garden > Decor > Candles & Home Fragrances',
  'abena premium maternity pads': 'Health & Beauty > Personal Care > Feminine Sanitary Supplies',
  'usn protein cookie bar': 'Health & Beauty > Healthcare > Fitness & Nutrition > Nutrition Bars',
  // Dog food eBay files under Food & Drink.
  'butchers tins 6 x': 'Animals & Pet Supplies > Pet Supplies > Dog Supplies > Dog Food',
  'butchers dog food tins': 'Animals & Pet Supplies > Pet Supplies > Dog Supplies > Dog Food',
  // Parts eBay files under garden, appliances or nowhere (review of 29 Sept).
  'dewalt dt20658-qz': 'Hardware > Tool Accessories',
  'baxi 720222901': 'Hardware > Heating, Ventilation & Air Conditioning',
  'absodry absorber refill bags': 'Home & Garden > Household Supplies',
  'stanley tra705t': 'Hardware > Tool Accessories',
  // Review of the care-shop pass (29 Sept): the model said "not a care aid" to a swivel car seat.
  'economy swivel car seat': 'Health & Beauty > Healthcare > Mobility & Accessibility > Accessibility Equipment',
  // eBay filed a plug-in timer under hair colourants.
  'countdown timer plug': 'Hardware > Power & Electrical Supplies',
};

// eBay places a household, care or DIY product almost never belongs in: a card landing here is usually a
// collector's item, a game or a garment matched by name. Flagged "check this is the same product".
export const CLASH = /^(Collectables|Sports Memorabilia|Coins|Stamps|Video Games & Consoles\|Video Games|Clothes, Shoes & Accessories|Clothing, Shoes & Accessories)/;

// With no eBay category (the listing ended) or no row that fits: Home & Garden, for her to move.
export const UNPLACED = 'Home & Garden';

/*
 * Parts and refills eBay files as appliances. Applied after the category is chosen, to eBay, title and export
 * placements alike: under Household Appliances, a refill or consumable is a household supply and a part is an
 * appliance accessory; a heating brand with a part number is a heating part, wherever it landed.
 */
// The brand then, within three words, a part number of five or more digits: "Baxi 720222901", "Ideal Logic 175593".
const HEATING = /\b(baxi|ideal|worcester|vaillant|glow-?worm|potterton|viessmann|ariston|biasi|vokera)\b(?:\s+[^\s#]+){0,3}?\s+\d{5,}\b/i;
const CONSUMABLE = /\b(refills?|sachets?|crystals?|tablets?|salt|descaler|pouches)\b/i;
const PART = /\b(filters?|bags?|belts?|brush(?:es)?|hoses?|nozzles?|parts?|spares?|replacements?|elements?|seals?|gaskets?|valves?|pumps?|motors?|thermostats?|ignitors?)\b/i;
export function refineFor(tax) {
  const appliances = tax.idOf('Home & Garden > Household Appliances');
  const supplies = tax.idOf('Home & Garden > Household Supplies');
  const accessories = tax.idOf('Home & Garden > Household Appliance Accessories');
  const heating = tax.idOf('Hardware > Heating, Ventilation & Air Conditioning');
  return function refine(id, title) {
    const t = String(title ?? '').split('#')[0];
    if (HEATING.test(t)) return { id: heating, rule: 'heating part number' };
    if (tax.level2Of(id) === appliances) {
      if (CONSUMABLE.test(t)) return { id: supplies, rule: 'appliance consumable' };
      if (PART.test(t)) return { id: accessories, rule: 'appliance part' };
    }
    return null;
  };
}

export function makeMapper(tax) {
  const resolve = (path) => {
    const id = tax.idOf(path);
    if (id == null) throw new Error(`Not in Google's taxonomy: "${path}"`);
    return id;
  };
  const rows = EBAY_TO_GOOGLE.map(([ebay, google]) => ({ ebay, id: resolve(google) }));
  const overrides = Object.fromEntries(Object.entries(OVERRIDES).map(([q, p]) => [q, resolve(p)]));
  const unplaced = resolve(UNPLACED);
  return function mapCard(query, ebayPath) {
    const q = String(query ?? '').trim().toLowerCase();
    const path = String(ebayPath ?? '').trim();
    const clash = CLASH.test(path);
    if (overrides[q] != null) return { id: overrides[q], by: 'override', clash: false, row: null };
    if (!path) return { id: unplaced, by: 'no eBay category', clash: false, row: null };
    // A row's last part may be the start of eBay's name ("Fire Protection" for "Fire Protection Equipment").
    const hit = rows.find((r) => path.startsWith(r.ebay));
    return hit ? { id: hit.id, by: 'eBay category', clash, row: hit.ebay } : { id: unplaced, by: 'no row fits', clash, row: null };
  };
}
