/*
 * Office Supplies (7 October). Most of the category sells under £8; what lands in the window is diaries, planners,
 * calendars, pens, binders, storage, packing and desk kit.
 */

// Office Depot's own ranges (Viking, Niceday, 5 Star), Staples, and the print shops: Google often files them
// under another brand or none, so OWN_TITLE catches the names in the title too.
export const OWN_LABEL = ['viking', 'niceday', '5 star', 'office depot', 'staples'];
export const OWN_TITLE = String.raw`\b(office depot|niceday|viking|5 star office|snapfish|vistaprint|photobox|printerpix|instantprint|helloprint|solopress)\b`;

export const NOT_SHELF = [
  // Printed to order: business cards, custom labels and anything carrying her customer's own design.
  ['business cards?', null, String.raw`holders?|cases?|blank|stands?|organi[sz]ers?|files?|books?|albums?|scanners?|wallets?|boxes?|paper|card ?stock|perforated|printable|inkjet|laser`],
  [String.raw`custom printed|custom made|printed with your|your (?:own )?(?:logo|design|photo|text)|photo upload|upload (?:your )?(?:photo|logo|image|design)|engraved`],
  // Meal kits filed under Office Supplies (Gousto recipe boxes).
  [String.raw`gousto|hellofresh|recipes? per week|meal kits?`],
];

// Real makers a shop lists under its own name in Google's brand column (a Casio calculator under Sainsbury's): a title
// naming one passes own label. The print shops and Office Depot's ranges in OWN_TITLE still stop.
export const BRANDED = String.raw`\b(casio|texas instruments|sharp|parker|pilot|uni[- ]ball|stabilo|faber[- ]castell|sharpie|bic|pentel|staedtler|paper ?mate|zebra|tombow|posca|lamy|cross|waterman|moleskine|leuchtturm\w*|filofax|collins|letts|fellowes|rexel|leitz|avery|dymo|brother|scotch|post-it|pritt|tipp-ex|tippex|crayola|derwent|winsor|q-connect|oxford|pukka|five star|helix|maped)\b`;
