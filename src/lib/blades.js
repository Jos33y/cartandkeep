/*
 * Knives, blades and sharp cutting things are not sold here (Joseey, 6 October). eBay UK sells a bladed item only with
 * an age-checked delivery service and refused the Bosch S644D saw blades for it; UK law asks the same of her shop.
 * Read from the product's name only (the card's, her title, the shop's and the eBay listing's), never a description,
 * where "cuts like a knife" would rule out a chopping board. Its twin for the database is candidate_is_bladed (0144).
 */
const BLADED = /\b(knife|knives|blades?|razors?|scalpels?|machetes?|swords?|daggers?|axe|hatchets?|cleavers?|box cutters?|craft knife|utility knife|stanley knife|multi-?tools?|secateurs|pruning saws?|loppers|scissors|shears)\b/i;
// Blades that are not a cutting edge to hand: on a wiper, a fan or a blender, and the heads of a shaver.
const NOT_BLADED = /\b(wiper|fan|propeller|rotor|blender|turbine)\s+blades?\b|\b(shaver|shaving|trimmer|epilator|clipper)s?\b/i;

export function bladedText(text) {
  const t = String(text ?? '');
  if (!BLADED.test(t)) return false;
  return !NOT_BLADED.test(t);
}

// The card's names, any of which saying it is a blade.
export function isBladed(row, draft = row?.draft ?? {}) {
  return [row?.title, draft?.title, row?.listing?.title, (draft?.entry ?? row?.entry)?.title].some(bladedText);
}
