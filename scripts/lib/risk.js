// What the scan holds back before spending a call: second hand, sized clothing, and account risk.
// Shared by scan.js, which holds these lines back, and ledger.mjs, which counts them as dealt with.
export const SKIP = [
  // Clothing, where size drives the return
  'shirt', 'dress', 'jeans', 'trainers', 'jacket', 'hoodie',
  // Account risk: counterfeit reports and brand takedowns land on a young account
  'iphone', 'ipad', 'macbook', 'airpods',
  'rolex', 'omega', 'gucci', 'prada', 'chanel', 'burberry', 'moncler', 'nike', 'adidas', 'ralph',
  // Gas canisters cannot go by post; nicotine is restricted
  'butane', 'propane', 'flogas', 'calor',
  'nicorette', 'nicotinell', 'nicotine', 'vape', 'vapes',
  // Pharmacy medicines, which eBay restricts
  'canesten', 'thrush', 'ibuprofen', 'paracetamol', 'nurofen', 'anadin', 'piriton', 'gaviscon', 'imodium', 'sudafed',
  // Slimming and hair-regrowth medicines
  'xls', 'minoxidil', 'regaine', 'regrowth',
  // CBD, and infant formula (restricted to sell and to promote)
  'cbd',
  // Vet-prescribed pet food: sold for animals under a vet's care
  'prescription diet', 'veterinary diet', 'vet diet', 'hills prescription',
  'aptamil', 'formula', 'infant milk', 'follow on milk', 'comfort milk',
];
// Fragrance houses, caught by brand when the shelf name never says EDP: "Hugo Boss Bottled 50ml Spray".
// Only when sold by the millilitre or as a spray, so a Calvin Klein wallet still goes through.
const SCENT_HOUSES = /\b(hugo boss|hugo|boss bottled|jimmy choo|calvin klein|paco rabanne|rabanne|dkny|issey miyake|lacoste|diesel|police|ghost|ariana grande|vera wang|clinique|armaf|afnan|marc jacobs|thierry mugler|mugler|dolce|gabbana|versace|davidoff|azzaro|carolina herrera|ysl|yves saint laurent|guess|britney spears|katy perry|elizabeth arden|lancome|givenchy|dior|tom ford|montblanc|joop|cacharel|nina ricci|kenzo|moschino|michael kors|hollister|jean paul gaultier|playboy|beyonce|rihanna|jennifer lopez|lattafa|eternity|obsession|euphoria|daisy dream|212 ladies|lovestruck|ck|sarah jessica parker|missguided|air du temps|giorgio beverly hills|anais anais|nina ricci|cacharel|davidoff|cool water|coolwater|mont blanc|montblanc|ckin2u|ted baker|x2o|intimately|tyson fury|michael buble|by invitation|elle soleil)\b/;
const BY_ML = /\b\d+(\.\d+)?\s?ml\b|\bspray\b/;
// A Ted Baker mug is sold by the ml too.
const NOT_SCENT = /\b(mug|mugs|cup|cups|tumbler|flask|bottle|jug|bowl|plate|tray|lunch|glass|glasses|towel|towels)\b/;

// Second hand: read from the query alone. A shop's long title for a new product says "can be used",
// and "vintage" or "antique" in homeware is a style ("Typhoon Vintage Kitchen tin"), not a condition.
const SECOND_HAND = ['used', 'refurbished', 'preowned', 'secondhand', 'joblot'];

// Alcohol needs eBay's approval. Glassware and bar kit do not: champagne flutes, gin glasses, a wine
// saver, a toaster in the colour "Royal Champagne".
const ALCOHOL = ['whisky', 'whiskey', 'vodka', 'gin', 'rum', 'prosecco', 'champagne', 'liqueur', '70cl', '75cl',
  'lager', 'carling', 'stella', 'budweiser', 'red wine', 'white wine', 'rose wine'];
// Fragrance: the most counterfeit-reported branded goods on eBay. Home fragrance is not: a scented
// candle, a reed diffuser or wax melts are ordinary home goods.
const PERFUME = ['edp', 'edt', 'parfum', 'perfume', 'aftershave', 'cologne', 'fragrance', 'eau', 'homme', 'femme'];
const HOME_SCENT = /\b(candle|candles|diffuser|diffusers|reed|reeds|wax|melts|room spray|oil burner|incense|potpourri|pot pourri|air freshener|plug in|refill oil)\b/;

const BARWARE = /\b(punchbowl|punch bowl|ladle|server|servers|knife|knives|fork|forks|spoon|spoons|cutlery|glass|glasses|flute|flutes|tumbler|tumblers|decanter|carafe|cooler|chiller|saver|stopper|bucket|rack|opener|corkscrew|shaker|jigger|toaster|kettle|cabinet|holder|coaster|coasters|stones|set|sets|pourer|aerator|trolley|cart|jug|paddle|serving|saucer|saucers|cocktail|tray|stirrer|ice|tower|connoisseur|goblet|goblets|coupe|coupes)\b/;
// A bottle size or strength means drink, whatever else the title says: "Gin Gift Set 70cl".
const DRINK_SIZE = /\b\d+(\.\d+)?\s?cl\b|\babv\b|\b\d+(\.\d+)?\s?%\s?vol\b/;

// The shop's own name is read too: "jimmy choo illicit" says nothing, "Jimmy Choo Illicit 60ml EDP" does.
// A dated calendar, diary or planner from before this year has no buyer: "Busy B 2023 family calendar".
const DATED = /\b(calendar|calendars|diary|diaries|planner|planners|organiser)\b/;
const staleYear = (text) => DATED.test(text)
  && [...text.matchAll(/\b(20\d\d)\b/g)].some((m) => Number(m[1]) < new Date().getFullYear());

export const risky = (q, seed) => {
  const text = `${q} ${seed ?? ''}`.toLowerCase();
  const words = text.split(/[^a-z0-9]+/);
  // With no shop name to check the size against, the house alone decides: these lines were all scent.
  const scent = SCENT_HOUSES.test(text) && (BY_ML.test(text) || !String(seed ?? '').trim()) && !NOT_SCENT.test(text);
  const joined = ` ${words.join(' ')} `;
  // Two-word entries ("infant milk") match as a phrase, single words as a whole word.
  const has = (w) => (w.includes(' ') ? joined.includes(` ${w} `) : words.includes(w));
  const qWords = String(q).toLowerCase().split(/[^a-z0-9]+/);
  const secondHand = SECOND_HAND.some((w) => qWords.includes(w));
  const alcohol = ALCOHOL.some(has) && (DRINK_SIZE.test(text) || !BARWARE.test(text));
  const perfume = PERFUME.some(has) && !HOME_SCENT.test(text);
  return SKIP.some(has) || scent || perfume || secondHand || alcohol || staleYear(text);
};
