// Animals & Pet Supplies only. Tried on six exports (October to December 2025, July to September 2026), 29,122 products.

// Pet shops' own brands: Pets at Home (Wainwright's, AVA vet range) and zooplus (Rocco, Purizon, Concept for Life and so on).
export const OWN_LABEL = ["wainwright's", 'wainwrights', 'ava', 'rocco', 'purizon', 'concept for life', 'lukullus', 'feringa', 'smilla',
  'wolf of wilderness', "rosie's farm", 'zooplus'];

// Veterinary medicines. Selling them online needs a registered vet practice, pharmacy or SQP retailer (Veterinary
// Medicines Regulations); she is none of these. AVM-GSL products (the shop-shelf ones: Frontline Spot On, Bob Martin,
// Johnson's, Beaphar) are legal for her and pass; Keepr notes them to check the category printed on the pack.
export const RESTRICTED = {
  // Prescription only (POM-V): a vet must prescribe them.
  vet_prescription: String.raw`\b(apoquel|cytopoint|librela|solensia|metacam|loxicom|rimadyl|onsior|previcox|galliprant|vetmedin|synulox|surolan|canaural|easotic|otomax|aurizon|aurimic|stromease|isathal|cerenia|incurin|reconcile|felpreva|profender|advocate|prinocate|stronghold|nexgard|frontpro|credelio|bravecto|simparica|revolution (?:plus|spot[- ]on|for (?:cats|dogs))|broadline|milbemax|milpro|terramycin|alamycin|exzolt|zenrelia|numelvi|baytril|prednicortone|propalin|continence (?:\d+ ?mg|syrup)|(?:solution )?for injection|injectable|pom-?vps?|nfa-?vps)\b`,
  // Sold by a vet, pharmacist or SQP only (NFA-VPS or POM-VPS), or not clear from the name: horse wormers, and the
  // vet-counter flea and worm brands. A judgment call: stopped by default, and the count is reported.
  vet_counter: String.raw`\b(horse wormer|equine wormer|equest|eqvalan|equimax|strongid|noromectin|bimectin|panacur|drontal|droncit|dronspot|advantage|advantix|seresto|frontline (?:plus|combo|tri-?act)|zoetis spot on)\b`,
};

// Google's Brand column sometimes names the shop, not the maker: a PetSafe cat flap and Peckish bird food filed under
// Argos, Bamfords bird seed under B&Q. A title naming a maker from this list is that maker's product. Argos' "Hooded
// Pet Bed" and Dunelm's own beds name no maker, so they still stop.
export const BRANDED = String.raw`\b(petsafe|staywell|peckish|chubby|bamfords|snug (?:and|&) cosy|banbury (?:&|and) co|scandinavian pet design|wild for dogs|kong|trixie|ancol|rosewood|beaphar|bob martin|johnson'?s|pedigree|whiskas|felix|dreamies|iams|purina|bakers|winalot|harringtons|lily'?s kitchen|james wellbeloved|burns|applaws|catit|furminator|halti|ruffwear|kurgo|company of animals|petface|danish design|scruffs|zoon|ferplast|fluval|tetra|aqua one|interpet|nutriment|yumove|protexin|feliway|adaptil|pet remedy|vetiq|webbox|forthglade|butcher'?s|sheba|cesar|frontline)\b`;
