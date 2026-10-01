// Product matching shared by store-picks and check-picks, so both judge a match the same way.

export const digits = (s) => String(s ?? '').replace(/\D/g, '').replace(/^0+/, '');
// Accents folded first, so Estée is estee, not "est e".
export const squash = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
const UNIT = /^\d+(\.\d+)?(w|v|l|ml|cl|g|kg|mm|cm|m|in|pk|pcs?|x|mah|gb|tb|hz|oz|tog|lm|in1|pack|tier|ltrs?|litres?|liters?|mg|mcg|ug|iu|hr|hrs|caps?|tabs?|softgels?|servings?|days?|months?)$|^\d{1,3}(\.\d+)?(a|ax|ma|ka|ah|amps?)$/i;
// Specs that read like model numbers but are shared by hundreds of products: IP65, GU10, 3in1, 750lm, 5000 series.
const SPEC = /^(ip\d{2}|gu\d{1,2}|mr\d{2}|e\d{2}|b\d{2}|g\d{1,2}|t\d{1,2}|\d+in\d+|\d+lm|\d+k|\d+cct|spf\d+|\d+-\d+v|\d+-\d+w|\d+-?(?:way|gang|pole)|\d+-[a-z]+|dx\d{2,3}|pk\d+|gen\d|a\d{2}|gr\d+q|r7s|g\d+q)$/i;
export function modelsIn(title) {
  return [...new Set(String(title).split(/[\s,()/|]+/).map((t) => t.replace(/[^a-z0-9-]/gi, '').toLowerCase())
    .filter((t) => t.length >= 4 && /\d/.test(t) && !UNIT.test(t) && !SPEC.test(t) && !/^(19|20)\d{2}$/.test(t)
      && !/^\d+(\.\d+)?x\d/.test(t)
      && (/[a-z]/.test(t) || t.length >= 5)))];
}
export const words = (s) => new Set(squash(s).split(' ').filter((w) => w.length >= 3));
// Share of the Google title's words, brand left out, that the shelf name also has.
export function overlap(a, b, brand) {
  const skip = new Set(brand.split(' '));
  const A = new Set([...words(a)].filter((w) => !skip.has(w))); const B = words(b);
  if (!A.size) return 0;
  let n = 0; for (const w of A) if (B.has(w)) n += 1;
  return n / A.size;
}

/*
 * Words that name one product line (Marella, Blackthorn, Pickwick) rather than a kind of thing (water, filter, jug).
 * Measured, not listed: a word used in few best-seller titles names a line, a word used in many describes a kind.
 */
export function wordCounts(titles) {
  const df = new Map();
  for (const t of titles) for (const w of words(t)) df.set(w, (df.get(w) ?? 0) + 1);
  return df;
}
export function lineWords(title, brand, df, rare = 25) {
  const skip = new Set(squash(brand).split(' '));
  return [...words(title)].filter((w) => !skip.has(w) && !/\d/.test(w) && (df.get(w) ?? 0) <= rare);
}

// Sizes stated with a unit: 2.5L against 4L, 0.6L against 1.2L, 10.5 tog against 13.5 tog.
const MEASURE = /(\d+(?:\.\d+)?)\s?(l|ltr|litre|ml|kg|g|tog|cm|oz)\b/gi;
function measures(text) {
  const m = new Map();
  for (const [, n, u] of String(text).toLowerCase().matchAll(MEASURE)) {
    const unit = { ltr: 'l', litre: 'l' }[u] ?? u;
    m.set(unit, [...(m.get(unit) ?? []), Number(n)]);
  }
  return m;
}
// Words that make a different version of the same line: Blast against Blast Max, a kids' blanket, lightweight against heavyweight.
const VERSION = ['kids', 'children', 'junior', 'baby', 'mini', 'max', 'pro', 'plus', 'lite', 'xl', 'lightweight', 'heavyweight', 'combination', 'dual', 'single', 'double', 'king', 'cordless', 'corded', 'refill', 'refills', 'replacement', 'tray', 'saucer', 'spoons', 'station', 'pods', 'powder', 'heated', 'cuckoo', 'shot', 'combo', 'duo', 'insecticide', 'lawn', 'forest', 'meadow'];

// Pairs where one word on each side means two different products.
const KINDS = [['rat', 'mouse'], ['cat', 'dog'], ['indoor', 'outdoor'], ['left', 'right'], ['blanket', 'bag'], ['throw', 'duvet'], ['wasp', 'fly'], ['smoke', 'heat'], ['mains', 'battery'],
  ['goose', 'duck'], ['liquid', 'pods'], ['liquid', 'powder'], ['liquid', 'kit'], ['liquid', 'spray'], ['candle', 'spray'], ['oil', 'stain'], ['wine', 'beer'], ['frying', 'saute'], ['wall', 'alarm'], ['travel', 'large'], ['medium', 'tall'], ['flat', 'spin'], ['ball', 'candle'], ['pot', 'can'], ['trimmer', 'battery'], ['hooks', 'fixings']];

/*
 * The barcode settles it when both sides have one: the page's own GTIN against every GTIN Google lists for the
 * product. Null when either side has none, and the name rule decides. Leading zeros are dropped on both sides,
 * so a 12-digit UPC and its 13-digit EAN compare equal.
 */
export function barcodeVerdict(gtins, pageGtin) {
  const p = digits(pageGtin);
  const want = (gtins ?? []).map(digits).filter(Boolean);
  if (!p || !want.length) return null;
  return want.includes(p) ? 'confirmed, barcode' : 'wrong, different barcode';
}

// Same product or not, the one rule both the picks and the page check use.
export function sameProduct(title, brand, name, { df, brands }) {
  const b = squash(brand);
  const n = squash(name);
  // A brand with a digit in it (Ion8, F10, 3M) names the maker, not the model.
  const bw = new Set(b.split(' ').filter(Boolean));
  const notBrand = (m) => !bw.has(m) && !bw.has(m.replace(/-/g, ''));
  const want = modelsIn(title).filter(notBrand);
  const have = modelsIn(name).filter(notBrand);
  if (want.length && want.some((m) => have.includes(m))) return 'confirmed, model';
  if (want.length && have.length) return 'wrong, different model';
  const a = measures(title);
  const c = measures(name);
  for (const [unit, sizes] of a) if (c.has(unit) && !sizes.some((x) => c.get(unit).includes(x))) return `wrong, different size (${sizes[0]}${unit})`;
  const tw = new Set(squash(title).split(' '));
  const nw = new Set(n.split(' '));
  const version = VERSION.find((w) => tw.has(w) !== nw.has(w));
  if (version) return `unsure, ${tw.has(version) ? 'no' : 'extra'} ${version}`;
  // Words that make it a different thing altogether: a rat trap is not a mouse trap, a dog blanket is not a dog bag.
  for (const [x, y] of KINDS) {
    if ((tw.has(x) && nw.has(y) && !nw.has(x)) || (tw.has(y) && nw.has(x) && !nw.has(y))) return `wrong, ${tw.has(x) ? x : y} not ${tw.has(x) ? y : x}`;
  }
  // A name that opens with another brand (Charles Bentley against Charles Tyrwhitt) is another product.
  const opener = [...brands].find((x) => x !== b && x.length >= 4 && (n === x || n.startsWith(`${x} `)) && !b.startsWith(x) && !` ${squash(title)} `.includes(` ${x} `));
  if (opener && !n.includes(b)) return 'wrong, different brand';
  // Plain numbers name the product as much as words do: PG 10 against PG 20, 5000 Series against 7000, a set of 2 against 3.
  // Whole numbers standing alone: 1.7L, 1/2 pint, 18/250 and "2 in 1" are sizes or specs, not names.
  // Counts written as words (Two Tier, Three Piece) are the same numbers as 2 and 3.
  const WORDNUM = { one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9', ten: '10', twelve: '12' };
  const numsIn = (t) => String(t).toLowerCase().replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten|twelve)\b(?=\s+(?:tier|piece|pack|drawer|shelf|shelves|cup|set|pairs?)\b)/g, (w) => WORDNUM[w]).replace(/\d+\s?-?in-?\s?\d+/g, ' ')
    .split(/[\s,()|+&:;!?"']+/).filter((w) => /^\d+$/.test(w) && !/^(19|20)\d\d$/.test(w));
  const tn = numsIn(title);
  const nn = new Set(numsIn(name));
  // Present when the page shows it anywhere not inside a longer number: iCON15, 23cm and 10-Year all count.
  const pageText = String(name).toLowerCase().replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten|twelve)\b(?=\s+(?:tier|piece|pack|drawer|shelf|shelves|cup|set|pairs?)\b)/g, (w) => WORDNUM[w]);
  const lostNum = tn.find((x) => !nn.has(x) && !new RegExp(`(^|[^0-9.])${x}(?![0-9.])`).test(pageText));
  if (lostNum && nn.size) return `wrong, different number (${lostNum})`;
  if (lostNum) return `unsure, no ${lostNum} on the page`;
  // Short capital codes (CP, PG, TFP) are model names too: NOPE! CP is not NOPE! CT.
  const CODE_SKIP = new Set(['UK', 'LED', 'USB', 'XL', 'XXL', 'DIY', 'TV', 'PC', 'AC', 'DC', 'UV', 'EU', 'US', 'GB', 'THE', 'AND', 'FOR', 'NEW', 'SET', 'OF']);
  const codes = [...new Set(String(title).match(/\b[A-Z]{2,3}\b/g) ?? [])].filter((x) => !CODE_SKIP.has(x) && !b.split(' ').includes(x.toLowerCase()));
  const lostCode = codes.find((x) => !nw.has(x.toLowerCase()));
  if (lostCode) return `unsure, no ${lostCode} on the page`;
  // A model number Google names but the page does not show can't be confirmed from the name alone.
  if (want.length) return 'unsure, no model on the page';
  const line = lineWords(title, brand, df);
  const missing = line.filter((w) => !n.split(' ').includes(w));
  if (line.length && missing.length) return overlap(title, name, b) >= 0.5 ? `unsure, no ${missing[0]}` : 'wrong, different product';
  const share = overlap(title, name, b);
  if (share >= 0.75) return 'confirmed, name';
  if (share < 0.4) return 'wrong, different product';
  return 'unsure, look at it';
}

// Need words live per Google category in ./needs, so a word that means a fix in one category (repair,
// inhibitor, refill) is not read as one in another. needOf(title, category) picks the category's list.
export { needOf } from './needs/index.mjs';

/*
 * When it sells. The words settle Christmas and Halloween; the months settle the rest:
 * a best seller in November or December and not in summer is a winter line.
 */
const CHRISTMAS = /\b(christmas|xmas|advent|festive|santa|reindeer|snowman|snowflake|nativity|tinsel|bauble|stocking|elf|gingerbread|mistletoe|wreath|garland|nutcracker|christmas tree|tree lights|fairy lights)\b/i;
const HALLOWEEN = /\b(halloween|pumpkin|spooky|witch|skeleton|ghost|bat decoration|cobweb|trick or treat|zombie|skull)\b/i;
// exported: every period the exports cover. Winter or Summer is said only when both halves of the year were
// exported; a product seen only in August when only August was exported says nothing about winter.
const WINTER = /^M20\d\d(10|11|12|01|02)$/;
const SUMMER = /^M20\d\d(05|06|07|08)$/;
const monthOf = (p) => (/^W\d{8}$/.test(p) ? `M${p.slice(1, 7)}` : p);
export function seasonOf(title, periods = [], exported = null) {
  if (HALLOWEEN.test(title)) return 'Halloween';
  if (CHRISTMAS.test(title)) return 'Christmas';
  if (exported) {
    const months = exported.map(monthOf);
    if (!months.some((p) => WINTER.test(p)) || !months.some((p) => SUMMER.test(p))) return 'All year';
  }
  const winter = periods.map(monthOf).some((p) => WINTER.test(p));
  const summer = periods.map(monthOf).some((p) => SUMMER.test(p));
  if (winter && !summer) return 'Winter';
  if (summer && !winter) return 'Summer';
  return 'All year';
}

/*
 * The one key for a product: the store card's reference, the eBay query that is scanned and gated, and so the
 * string import-gate and import-store join on. Short, because eBay matches every word and a long query comes
 * back too narrow. Brand and model when there is a model; otherwise brand and the first three words that name
 * the thing, with sizes, colours and sales words left out.
 */
const QUERY_SKIP = new Set(['a', 'an', 'and', 'the', 'of', 'to', 'in', 'on', 'for', 'by', 'x', 'uk', 'new', 'premium', 'luxury', 'professional', 'quality', 'genuine', 'original', 'official', 'best', 'ideal', 'perfect', 'pack', 'packs', 'pcs', 'pc', 'piece', 'pieces', 'inch', 'size', 'compatible', 'black', 'white', 'grey', 'gray', 'silver', 'gold', 'blue', 'red', 'green', 'pink', 'cream', 'beige', 'brown', 'clear', 'natural', 'multicolour', 'multicolor']);
// A short model straight after the brand: Omron M2, Omron RS1, Braun IRT6520 is long enough already. Two or three
// characters, letters then digits, so a size (5L, 2kg) or a spec (E27, GU10) is never read as one.
function shortModelAfterBrand(title, brand) {
  const bw = squash(brand).split(' ').filter(Boolean);
  if (!bw.length) return null;
  const t = squash(title).split(' ');
  for (let i = 0; i + bw.length < t.length; i += 1) {
    if (bw.every((w, k) => t[i + k] === w)) {
      const next = t[i + bw.length];
      if (isShortModel(next)) return next;
    }
  }
  // Anywhere else in the name before the first dash, bar or comma: Xpelair Simply Silent Contour C4.
  const head = String(title).split(/\s[-\u2013|]\s|[|,(]/)[0];
  // Never the brand's own name (Ion8, F10): that was the bug that lumped every Ion8 bottle.
  return squash(head).split(' ').find((w) => isShortModel(w) && !bw.includes(w)) ?? null;
}
// Two or three characters, letters then digits: M2, RS1, C4, V15. Not a paper size (A4), a pack (X2), a spec (E27)
// or a vitamin (B5, B12, D3, K2, Q10).
function isShortModel(w) {
  return /^[a-z]{1,3}\d{1,3}[a-z]?$/.test(w) && !UNIT.test(w) && !SPEC.test(w) && !/^(a\d|x\d+|no\d+|b\d{1,2}|d[23]|k[12]|q10)$/.test(w);
}
// The kind of thing a beauty or health product is, when the name puts it late: kept in the key (see queryOf).
const KINDS_OF = new Set(['foundation', 'concealer', 'powder', 'primer', 'serum', 'shampoo', 'conditioner', 'mascara',
  'lipstick', 'gloss', 'eyeliner', 'bronzer', 'blusher', 'highlighter', 'palette', 'cleanser', 'toner', 'moisturiser',
  'moisturizer', 'makeup', 'tint', 'stick', 'fluid', 'gel', 'balm', 'mask', 'gummies', 'drops', 'capsules', 'tablets',
  'softgels', 'spray', 'refill', 'trimmer', 'razor', 'shaver', 'blades', 'bundle', 'set', 'kit', 'usb', 'dimmer',
  'thumbturn']);
// Initials joined by "&" stay one word, as shops and eBay write them: A&D, B&Q, M&S (not "a d").
const initials = (brand) => { const m = String(brand ?? '').trim().match(/^([a-z])\s*&\s*([a-z])$/i); return m ? `${m[1]}&${m[2]}`.toLowerCase() : null; };

export function queryOf(title, brand) {
  // Two brand words at most: "the workplace depot" is found as "workplace depot".
  const b = initials(brand) ?? squash(brand).split(' ').filter((w) => w !== 'the' && w !== 'and').slice(0, 2).join(' ');
  const bw = new Set(squash(brand).split(' '));
  // A size range, an "x in 1" or the brand's own name is not a model: 40-50cm, 6-in-1, Ion8.
  const long = modelsIn(title).find((m) => /[a-z]/.test(m.replace(/in/g, '')) && !/^[\d.-]+(cm|mm|m|kg|g|l|ml|db|mah|lm)$/.test(m) && !bw.has(squash(m)));
  const model = long ?? shortModelAfterBrand(title, brand);
  // A short model is a range, not one product, when a capacity sets the item: Milwaukee M18 2.0Ah and 5.0Ah.
  const ah = !long && String(title).match(/\b(\d+)(?:\.(\d))?\s*ah\b/i);
  if (model) return `${b} ${squash(model)}${ah ? ` ${ah[1]}${ah[2] ?? ''}ah` : ''}`.trim();
  const skip = new Set([...QUERY_SKIP, 'with', ...bw]);
  // The name before the first dash, bar, comma, bracket, colon or "with": what follows describes it.
  const head = String(title).split(/\s[-\u2013|]\s|[|,(:\u2013]|\swith\s/i)[0];
  // Words with digits are sizes and codes and are dropped, but a vitamin name is the product: D3, K2, B12, Q10.
  // So is a count that makes it another product: 1 gang or 2 gang, 2 way, 4 socket, a 2.0Ah or 5.0Ah battery.
  const counted = (s) => String(s).replace(/\b([1-6])g\b(?=.*\b(?:switch|socket|dimmer|plate)\b)/gi, '$1gang').replace(/\b(\d+)\s*-?\s*(gang|way|sockets?|pole|slice|door|tier|light|speed|drawer|section|pin|spray|burner|ring|seater|shelf|zone)s?\b/gi, '$1$2').replace(/\b(\d+)\.(\d)\s*ah\b/gi, '$1$2ah');
  const take = (s) => squash(counted(s)).split(' ').filter((w) => w && !skip.has(w) && (!/\d/.test(w) || /^(b(?:[1-9]|1[0-2])|d[23]|k[12]|q10|\d+(?:gang|way|sockets?|pole|slice|door|tier|light|speed|drawer|section|pin|spray|burner|ring|seater|shelf|zone)|\d+ah|\d{1,3}t|(?!13a$)\d{1,2}a)$/.test(w)));
  // A range number the name depends on: Braun Series 7, not Series 5 (the number alone is dropped as a size).
  const seriesHit = String(title).match(/\b(series|gen|generation|mk|mark|version)\s*(\d{1,4})\b/i);
  // "MK 2-Pole" is the brand MK, not a mark 2.
  const series = seriesHit && !bw.has(seriesHit[1].toLowerCase()) ? seriesHit : null;
  let rest = take(head);
  // A name that is all brand ("Magic Hose 40m") is searched as the brand; only a bare word reaches for the rest.
  if ([...b.split(' ').filter(Boolean), ...rest].length < 2) rest = take(title);
  // Past the first three words, a vitamin or the kind of thing still tells products apart: Double Wear makeup and
  // Double Wear concealer, Vitamin D capsules and Vitamin D drops.
  const first = rest.slice(0, 3);
  const later = rest.slice(3);
  const extra = [
    ...later.filter((w) => /^(b(?:[1-9]|1[0-2])|d[23]|k[12]|q10|\d{1,3}t|(?!13a$)\d{1,2}a|\d+ah)$/.test(w)),
    ...(first.some((w) => KINDS_OF.has(w)) ? [] : later.filter((w) => KINDS_OF.has(w)).slice(0, 1)),
  ];
  return [b, ...first, ...[...new Set(extra)].filter((w) => !first.includes(w)), ...(series && !first.includes(series[2]) ? [series[2]] : [])].filter(Boolean).join(' ').trim();
}
