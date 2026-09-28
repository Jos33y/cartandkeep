// What the scan holds back before spending a call: second hand, sized clothing, and account risk.
// Shared by scan.js, which holds these lines back, and ledger.mjs, which counts them as dealt with.
export const SKIP = [
  // Second hand by nature, and she sells new
  'used', 'vintage', 'antique', 'refurbished', 'preowned', 'secondhand', 'joblot',
  // Clothing, where size drives the return
  'shirt', 'dress', 'jeans', 'trainers', 'jacket', 'hoodie',
  // Account risk: counterfeit reports and brand takedowns land on a young account
  'iphone', 'ipad', 'macbook', 'airpods',
  'rolex', 'omega', 'gucci', 'prada', 'chanel', 'burberry', 'moncler', 'nike', 'adidas', 'ralph',
  // Fragrance: the most counterfeit-reported branded goods on eBay
  'edp', 'edt', 'parfum', 'perfume', 'aftershave', 'cologne', 'fragrance', 'eau', 'homme', 'femme',
  // Alcohol needs eBay's approval; gas canisters cannot go by post; nicotine is restricted
  'whisky', 'whiskey', 'vodka', 'gin', 'rum', 'prosecco', 'champagne', 'liqueur', '70cl', '75cl',
  'butane', 'propane', 'flogas', 'calor',
  'nicorette', 'nicotinell', 'nicotine', 'vape', 'vapes',
  // Pharmacy medicines, which eBay restricts
  'canesten', 'thrush', 'ibuprofen', 'paracetamol', 'nurofen', 'anadin', 'piriton', 'gaviscon', 'imodium', 'sudafed',
  // Slimming and hair-regrowth medicines
  'xls', 'minoxidil', 'regaine', 'regrowth',
  // More alcohol, CBD, and infant formula (restricted to sell and to promote)
  'lager', 'carling', 'stella', 'budweiser', 'prosecco', 'red wine', 'white wine', 'rose wine', 'cbd',
  'aptamil', 'formula', 'infant milk', 'follow on milk', 'comfort milk',
];
// Fragrance houses, caught by brand when the shelf name never says EDP: "Hugo Boss Bottled 50ml Spray".
// Only when sold by the millilitre or as a spray, so a Calvin Klein wallet still goes through.
const SCENT_HOUSES = /\b(hugo boss|hugo|boss bottled|jimmy choo|calvin klein|paco rabanne|rabanne|dkny|issey miyake|lacoste|diesel|police|ghost|ariana grande|vera wang|clinique|armaf|afnan|marc jacobs|thierry mugler|mugler|dolce|gabbana|versace|davidoff|azzaro|carolina herrera|ysl|yves saint laurent|guess|britney spears|katy perry|elizabeth arden|lancome|givenchy|dior|tom ford|montblanc|joop|cacharel|nina ricci|kenzo|moschino|michael kors|hollister|jean paul gaultier|playboy|beyonce|rihanna|jennifer lopez|lattafa|eternity|obsession|euphoria|daisy dream|212 ladies|lovestruck|ck|sarah jessica parker|missguided|air du temps|giorgio beverly hills|anais anais|nina ricci|cacharel|davidoff|cool water|coolwater|mont blanc|montblanc|ckin2u|ted baker|x2o|intimately|tyson fury|michael buble|by invitation|elle soleil)\b/;
const BY_ML = /\b\d+(\.\d+)?\s?ml\b|\bspray\b/;

// The shop's own name is read too: "jimmy choo illicit" says nothing, "Jimmy Choo Illicit 60ml EDP" does.
// A dated calendar, diary or planner from before this year has no buyer: "Busy B 2023 family calendar".
const DATED = /\b(calendar|calendars|diary|diaries|planner|planners|organiser)\b/;
const staleYear = (text) => DATED.test(text)
  && [...text.matchAll(/\b(20\d\d)\b/g)].some((m) => Number(m[1]) < new Date().getFullYear());

export const risky = (q, seed) => {
  const text = `${q} ${seed ?? ''}`.toLowerCase();
  const words = text.split(/[^a-z0-9]+/);
  // With no shop name to check the size against, the house alone decides: these lines were all scent.
  const scent = SCENT_HOUSES.test(text) && (BY_ML.test(text) || !String(seed ?? '').trim());
  const joined = ` ${words.join(' ')} `;
  // Two-word entries ("infant milk") match as a phrase, single words as a whole word.
  return SKIP.some((w) => (w.includes(' ') ? joined.includes(` ${w} `) : words.includes(w))) || scent || staleYear(text);
};
