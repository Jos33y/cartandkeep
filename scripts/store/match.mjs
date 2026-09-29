// Product matching shared by store-picks and check-picks, so both judge a match the same way.

export const digits = (s) => String(s ?? '').replace(/\D/g, '').replace(/^0+/, '');
export const squash = (s) => String(s ?? '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
const UNIT = /^\d+(\.\d+)?(w|v|l|ml|cl|g|kg|mm|cm|m|in|pk|pcs?|x|mah|gb|tb|hz|oz|tog|lm|in1|pack|tier)$/i;
// Specs that read like model numbers but are shared by hundreds of products: IP65, GU10, 3in1, 750lm, 5000 series.
const SPEC = /^(ip\d{2}|gu\d{1,2}|mr\d{2}|e\d{2}|b\d{2}|g\d{1,2}|t\d{1,2}|\d+in\d+|\d+lm|\d+k)$/i;
export function modelsIn(title) {
  return [...new Set(String(title).split(/[\s,()/|]+/).map((t) => t.replace(/[^a-z0-9-]/gi, '').toLowerCase())
    .filter((t) => t.length >= 4 && /\d/.test(t) && !UNIT.test(t) && !SPEC.test(t) && !/^(19|20)\d{2}$/.test(t)
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
const VERSION = ['kids', 'children', 'junior', 'baby', 'mini', 'max', 'pro', 'plus', 'lite', 'xl', 'lightweight', 'heavyweight', 'combination', 'dual', 'single', 'double', 'king', 'cordless', 'corded', 'refill', 'replacement'];

// Same product or not, the one rule both the picks and the page check use.
export function sameProduct(title, brand, name, { df, brands }) {
  const b = squash(brand);
  const n = squash(name);
  const want = modelsIn(title);
  const have = modelsIn(name);
  if (want.length && want.some((m) => have.includes(m))) return 'confirmed, model';
  if (want.length && have.length) return 'wrong, different model';
  const a = measures(title);
  const c = measures(name);
  for (const [unit, sizes] of a) if (c.has(unit) && !sizes.some((x) => c.get(unit).includes(x))) return `wrong, different size (${sizes[0]}${unit})`;
  const tw = new Set(squash(title).split(' '));
  const nw = new Set(n.split(' '));
  const version = VERSION.find((w) => tw.has(w) !== nw.has(w));
  if (version) return `unsure, ${tw.has(version) ? 'no' : 'extra'} ${version}`;
  // A name that opens with another brand (Charles Bentley against Charles Tyrwhitt) is another product.
  const opener = [...brands].find((x) => x !== b && x.length >= 4 && (n === x || n.startsWith(`${x} `)) && !b.startsWith(x) && !` ${squash(title)} `.includes(` ${x} `));
  if (opener && !n.includes(b)) return 'wrong, different brand';
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

/*
 * Why someone has to search for this exact thing: a part for something they own, a refill, or a problem to fix today.
 * These are searched by need rather than browsed by brand, so a small shop is not up against the famous names.
 */
const NEED_RULES = [
  ['safety', /\b(smoke alarm|heat alarm|carbon monoxide|co alarm|key safe|door chain|window lock|security light|fire blanket|extinguisher)\b/i],
  ['pest', /\b(flea|bed ?bugs?|wasps?|rats?|mouse|mice|rodent|bait|slugs?|ants?|moths?|spiders?|fox|cats? repell\w*|repellent|insect|fly (?:killer|trap)|traps?)\b/i],
  ['damp', /\b(mould|mold|damp|moisture absorber|condensation|dehumidifier refills?|dryzone)\b/i],
  ['plumbing', /\b(valve|tap (?:gland|cartridge|washer)|cistern|inhibitor|shower head|shower hose|waste trap|plug and chain)\b/i],
  ['care', /\b(grab rail|toilet seat raiser|raised toilet|commode|bed rail|perching|dressing aid|sock aid|jar opener|reacher|grabber|pill|incontinence|walking|mobility|magnif\w*|big button|amplified)\b/i],
  ['winter', /\b(draught|draft excluder|de-?icer|rock salt|grit|thermal curtain|radiator (?:key|reflector|booster)|heated airer|hot water bottle|electric blanket|heated throw)\b/i],
  ['clean-fix', /\b(limescale|descaler|unblocker|drain|oven cleaner|stain remover|rust|restorer|repair|sealant|filler|grout)\b/i],
  ['part', /\b(replacement|spares?|refills?|cartridges?|compatible|fits)\b/i],
  ['part', /\bfor (?:[a-z]+ )?(?:[a-z]*\d[a-z0-9-]*)\b/i],
  // A filter jug, a lunch bag or a shoe bag is the product itself, so the part word has to stand on its own.
  ['part', /\b(filters?|belts?|seals?|gaskets?|elements?|blades?|nozzles?|brush ?heads?|mop heads?|pads?|glands?|fill valve|flush valve|thermostats?|ignitors?|fuses?|expansion vessel)\b(?! (?:jugs?|tanks?|bottles?|taps?|kettles?|systems?|coffee))/i],
  ['part', /\b(?:vacuum|hoover|dust|hepa) bags?\b|\bbags? for\b/i],
  ['part', /\b(batter(?:y|ies)|chargers?)\b(?! (?:operated|powered))/i],
];
export function needOf(title) {
  for (const [need, rx] of NEED_RULES) if (rx.test(title)) return need;
  return '';
}

/*
 * When it sells. The words settle Christmas and Halloween; the months settle the rest:
 * a best seller in November or December and not in summer is a winter line.
 */
const CHRISTMAS = /\b(christmas|xmas|advent|festive|santa|reindeer|snowman|snowflake|nativity|tinsel|bauble|stocking|elf|gingerbread|mistletoe|wreath|garland|nutcracker|christmas tree|tree lights|fairy lights)\b/i;
const HALLOWEEN = /\b(halloween|pumpkin|spooky|witch|skeleton|ghost|bat decoration|cobweb|trick or treat|zombie|skull)\b/i;
export function seasonOf(title, periods = []) {
  if (HALLOWEEN.test(title)) return 'Halloween';
  if (CHRISTMAS.test(title)) return 'Christmas';
  const winter = periods.some((p) => /^M20\d\d(10|11|12|01|02)$/.test(p));
  const summer = periods.some((p) => /^M20\d\d(05|06|07|08)$/.test(p));
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
export function queryOf(title, brand) {
  // Two brand words at most: "the workplace depot" is found as "workplace depot".
  const b = squash(brand).split(' ').filter((w) => w !== 'the' && w !== 'and').slice(0, 2).join(' ');
  const bw = new Set(squash(brand).split(' '));
  // A size range, an "x in 1" or the brand's own name is not a model: 40-50cm, 6-in-1, Ion8.
  const model = modelsIn(title).find((m) => /[a-z]/.test(m.replace(/in/g, '')) && !/^[\d.-]+(cm|mm|m|kg|g|l|ml|db|mah|lm)$/.test(m) && !bw.has(squash(m)));
  if (model) return squash(`${b} ${model}`);
  const skip = new Set([...QUERY_SKIP, 'with', ...bw]);
  // The name before the first dash, bar, comma, bracket, colon or "with": what follows describes it.
  const head = String(title).split(/\s[-\u2013|]\s|[|,(:\u2013]|\swith\s/i)[0];
  const take = (s) => squash(s).split(' ').filter((w) => w && !skip.has(w) && !/\d/.test(w));
  let rest = take(head);
  // A name that is all brand ("Magic Hose 40m") is searched as the brand; only a bare word reaches for the rest.
  if ([...b.split(' ').filter(Boolean), ...rest].length < 2) rest = take(title);
  return [b, ...rest.slice(0, 3)].filter(Boolean).join(' ').trim();
}
