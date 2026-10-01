// Need words for Toys & Games. Toys are browsed, not searched for by need, so almost nothing here is a need:
// only parts that keep a toy a child already owns going (a ride-on's battery, a remote, a charger).
// Home & Garden's pest and care words matched bugs, spiders and dolls' care sets in toy titles.
export const RULES = [
  ['part', /\b(replacement (?:parts?|batter(?:y|ies)|chargers?|remotes?|wheels?|tyres?)|spare parts?|charging cable for)\b/i],
];
export const NOT_NEED = /^$/;
