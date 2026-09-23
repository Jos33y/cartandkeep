/*
 * Discovery, not hypothesis testing. Sweeps eBay categories and surfaces the
 * listings that match the profile we are actually looking for, whatever the
 * category. No query list, so no bias from whoever wrote it.
 *
 *   node scripts/sweep.js --tree                     fetch and cache the category tree
 *   node scripts/sweep.js --depth=3 --max-cats=120 --csv=sweep.csv
 *   node scripts/sweep.js --depth=3 --max-cats=120 --queries=scripts/queries-sweep.txt
 *
 * The profile, all overridable:
 *   price between £10 and £60, above the postage floor and inside the band
 *   the seller is small, under the same 1,000 feedback ceiling the gate uses
 *   the listing is not ancient, and it is actually selling
 *
 * Deep rather than wide. At depth two a category is a department with tens of
 * thousands of listings under it, and eBay returns its most popular, which the
 * gate then refuses on the 250 listing ceiling. At depth three and four a
 * category is a shelf, and a small seller selling on a shelf is the entry test
 * run at discovery time instead of after.
 *
 * Titles are not queries. A title is eleven words of the seller's decoration
 * and eBay matches every one of them, so it returns nothing and the gate reads
 * that as a dead market. --queries writes a shortened, deduplicated query file
 * that gate.js can take directly.
 *
 * Needs EBAY_CLIENT_ID and EBAY_CLIENT_SECRET.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const BROWSE = 'https://api.ebay.com/buy/browse/v1';
const TAXONOMY = 'https://api.ebay.com/commerce/taxonomy/v1';
const CACHE = '.gate';

const D = {
  marketplace: 'EBAY_GB',
  minPrice: 10,
  maxPrice: 60,
  // The gate's entry ceiling. Sweeping at 20,000 handed the gate titles held by
  // sellers twenty times larger than anything that counts as proof, and the
  // gate refused them a call later.
  maxFeedback: 1000,
  maxAgeDays: 365,
  minAgeDays: 14,       // younger than this and a rate is noise
  perCategory: 200,     // eBay caps item_summary at 200
  checkPerCategory: 12, // how many survivors to spend a getItem on
  depth: 3,
  maxCats: 120,
  queryWords: 3,        // eBay matches every word, so a query is short or it is nothing
  minProfit: 2.00,
  postage: 2.62, packaging: 0.40,   // Evri to 5kg, the gate's default band
  fvfPct: 0.128, fvfFixed: 0.30, adRate: 0.03,
  returnRate: 0.05, returnCost: 6.00,
};

function parseEnv(text) {
  const out = {};
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).replace(/^export\s+/, '').trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    out[key] = val;
  }
  return out;
}

let lastCall = 0;
const paced = async (fn, gap = 110) => {
  const wait = Math.max(0, gap - (Date.now() - lastCall));
  if (wait) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
  return fn();
};

async function token({ clientId, clientSecret }) {
  const res = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
    },
    body: new URLSearchParams({ grant_type: 'client_credentials', scope: 'https://api.ebay.com/oauth/api_scope' }),
  });
  if (!res.ok) throw new Error(`ebay auth failed: ${res.status} ${await res.text()}`);
  return (await res.json()).access_token;
}

const hdrs = (access, marketplace) => ({
  Authorization: `Bearer ${access}`, 'X-EBAY-C-MARKETPLACE-ID': marketplace,
});

// --------------------------------------------------------------- category tree

// Flattened to (id, name, depth). The tree is large and static, so it is
// fetched once and cached rather than pulled on every sweep.
export function flattenTree(node, depth = 0, out = [], root = null) {
  const c = node?.category;
  const branch = depth === 1 ? c?.categoryName ?? null : root;
  if (c && depth > 0) out.push({ id: c.categoryId, name: c.categoryName, depth, root: branch });
  for (const child of node?.childCategoryTreeNodes ?? []) flattenTree(child, depth + 1, out, branch);
  return out;
}

// eBay's tree is mostly collectables, memorabilia, media and secondhand, none
// of which a dropshipper can source. Sweeping evenly across it returns
// Jukeboxes and Manuscripts, which is what the first run did.
export const NEW_GOODS_ROOTS = [
  'home, furniture', 'garden', 'health & beauty', 'baby', 'pet supplies',
  'sporting goods', 'sound & vision', 'computers', 'mobile phones',
  'vehicle parts', 'crafts', 'business, office', 'toys & games',
  'clothes, shoes', 'jewellery & watches',
];

// Matched on whole words. As substrings, "art" bans Vehicle Parts and "test"
// bans anything Latest, which would quietly delete branches we want.
export const NEVER = [
  'collectables', 'collectable', 'antiques', 'art', 'coins', 'stamps',
  'memorabilia', 'tickets', 'manuscripts', 'comics', 'music', 'films',
  'vintage', 'used', 'everything else', 'motorcycles', 'property',
  'test', 'auctions', 'job lots', 'holidays', 'travel', 'nfts',
];

const wordRe = (term) => new RegExp(`(^|[^a-z])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z])`, 'i');

export function pickBranch(cats, roots = NEW_GOODS_ROOTS, never = NEVER) {
  const low = (x) => String(x ?? '').toLowerCase();
  const wanted = (name) => roots.some((r) => low(name).includes(r));
  const banned = (name) => never.some((r) => wordRe(r).test(String(name ?? '')));
  return cats.filter((c) => c.root && wanted(c.root) && !banned(c.root) && !banned(c.name));
}

async function fetchTree(access, marketplace) {
  const idRes = await paced(() => fetch(
    `${TAXONOMY}/get_default_category_tree_id?marketplace_id=${marketplace}`,
    { headers: hdrs(access, marketplace) },
  ));
  if (!idRes.ok) throw new Error(`taxonomy tree id ${idRes.status}: ${await idRes.text()}`);
  const { categoryTreeId } = await idRes.json();

  const treeRes = await paced(() => fetch(
    `${TAXONOMY}/category_tree/${categoryTreeId}`,
    { headers: hdrs(access, marketplace) },
  ));
  if (!treeRes.ok) throw new Error(`category tree ${treeRes.status}: ${await treeRes.text()}`);
  return { categoryTreeId, tree: await treeRes.json() };
}

// ------------------------------------------------------------------- readings

export function readSeller(item) {
  const s = item?.seller ?? {};
  const n = Number(s.feedbackScore);
  return { username: s.username ?? null, feedback: Number.isFinite(n) ? n : null };
}

export function readAge(item, now = Date.now()) {
  const raw = item?.itemOriginDate ?? item?.itemCreationDate;
  const t = raw ? Date.parse(raw) : NaN;
  if (!Number.isFinite(t)) return null;
  const d = (now - t) / 86400000;
  return d >= 0 ? Math.max(d, 1) : null;
}

export function readSold(detail) {
  for (const a of detail?.estimatedAvailabilities ?? []) {
    const n = Number(a?.estimatedSoldQuantity);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

// One cost model across both files. This is gate.js's, and the 40% goods
// assumption it replaces is what produced a £19.50 floor nobody had measured.
export function headroomAt(price, c = D) {
  if (!Number.isFinite(price) || price <= 0) return null;
  const fvf = price * c.fvfPct + c.fvfFixed;
  return Math.round((price - (fvf + price * c.adRate + c.postage + c.packaging)) * 100) / 100;
}

export function maxGoodsCost(price, c = D) {
  const h = headroomAt(price, c);
  if (h == null) return null;
  return Math.round((h - c.returnRate * c.returnCost - c.minProfit) * 100) / 100;
}

// ------------------------------------------------------------ titles to queries

/*
 * A title is the product plus the seller's decoration. The product words recur
 * across the shelf; the decoration does not. So the split is done by counting
 * rather than by a banned word list.
 *
 * That choice is deliberate. A banned list is how "hot" ended up in a noise
 * list and turned "hot water heater" into "water heater", which is the exact
 * fault that was criticised in keywordFor. Frequency cannot make that mistake:
 * if every seller on the shelf says hot, hot is part of the product.
 *
 * Only three kinds of token are dropped outright, and none of them can carry
 * meaning on their own: grammar, pure measurements, and pack counts.
 */
const GRAMMAR = new Set([
  'for', 'with', 'and', 'the', 'a', 'an', 'of', 'in', 'on', 'to', 'or', 'by',
  'from', 'your', 'my', 'our', 'is', 'are', 'no', 'not', 'up', 'off', 'x',
]);

// Measurement, packaging and marketplace furniture. Every one of these is a
// number or a unit or a shipping word: none of them names a product.
const FURNITURE = new Set([
  'pcs', 'pc', 'pack', 'packs', 'pair', 'set', 'sets', 'piece', 'pieces',
  'cm', 'mm', 'm', 'inch', 'inches', 'ft', 'kg', 'g', 'ml', 'l', 'litre',
  'uk', 'gb', 'free', 'fast', 'post', 'postage', 'delivery', 'stock', 'new',
  'genuine', 'quality', 'best', 'top', 'hot', 'sale', 'offer', 'seller',
]);

// One seller writes rail and the next writes rails, and counted separately
// neither reaches the top of the shelf. So words are counted on a stem and
// searched on the word a seller actually typed. Stemming both put "clothe
// airer" and "solar eclipse glasse" in a query file, and neither of those
// appears on any listing on eBay.
const stem = (w) => {
  if (w.length > 4 && w.endsWith('es')) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
};

const words = (title) => String(title ?? '')
  .toLowerCase()
  .replace(/[^a-z0-9\s]/g, ' ')
  .split(/\s+/)
  .filter((w) => w.length > 1
    && !GRAMMAR.has(w)
    && !FURNITURE.has(w)
    && !/^\d/.test(w));

const tokenise = (title) => words(title).map(stem);

// Document frequency across one shelf. A word in many titles is the product.
export function shelfFrequency(titles) {
  const df = new Map();
  for (const t of titles) {
    for (const w of new Set(tokenise(t))) df.set(w, (df.get(w) ?? 0) + 1);
  }
  return df;
}

/*
 * The n best words in this title, put back in the order the title used them so
 * the query reads like a thing rather than a bag of words.
 *
 * Two corrections on plain frequency, both from reading the first real run.
 *
 * A word in most of the titles on a shelf is the shelf, not the product. In
 * Fittings, stainless, steel and plastic are in half the listings, so counting
 * alone turned "Stainless Steel Rat Blocker Flap Prevention" into "stainless
 * stop plastic", which does not contain the product. Anything above the
 * ceiling is dropped for being the department's own vocabulary.
 *
 * And sellers front-load. The product is at the start of a title and the
 * adjectives trail off the end, so only the opening words are considered at
 * all. That is what keeps rat blocker and loses flap prevention.
 */
const GENERIC_SHARE = 0.5;
const LEAD_WORDS = 6;

export function queryFor(title, df, n = 3, shelfSize = 0) {
  const surface = words(title);
  const ceiling = shelfSize ? Math.max(2, Math.floor(shelfSize * GENERIC_SHARE)) : Infinity;

  const seen = new Set();
  const lead = [];
  for (const w of surface.slice(0, LEAD_WORDS)) {
    const st = stem(w);
    if (seen.has(st)) continue;
    seen.add(st);
    lead.push({ w, df: df.get(st) ?? 0 });
  }
  if (lead.length < 2) return null;

  // Department words out first, but never all of them: a shelf where every
  // word is common would return nothing at all, and no query is worse than a
  // broad one.
  const specific = lead.filter((t) => t.df <= ceiling);
  const pool = specific.length >= 2 ? specific : lead;

  const keep = new Set([...pool].sort((a, b) => b.df - a.df).slice(0, n).map((t) => t.w));
  const query = pool.filter((t) => keep.has(t.w)).map((t) => t.w).join(' ');
  return query.split(' ').length >= 2 ? query : null;
}

// The shape we are hunting, applied before any getItem is spent on a listing.
export function looksPromising(item, c = D, now = Date.now()) {
  const price = Number(item?.price?.value);
  if (!Number.isFinite(price) || price < c.minPrice || price > c.maxPrice) return false;
  const { feedback } = readSeller(item);
  if (feedback == null || feedback > c.maxFeedback) return false;
  const age = readAge(item, now);
  if (age == null || age < c.minAgeDays || age > c.maxAgeDays) return false;
  return true;
}

// ---------------------------------------------------------------------- sweep

async function searchCategory({ access, marketplace, categoryId, limit }) {
  const url = new URL(`${BROWSE}/item_summary/search`);
  url.searchParams.set('category_ids', categoryId);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('filter', 'buyingOptions:{FIXED_PRICE}');
  const res = await paced(() => fetch(url, { headers: hdrs(access, marketplace) }));
  if (!res.ok) return { error: `${res.status}`, itemSummaries: [] };
  return res.json();
}

async function getItem({ access, marketplace, itemId }) {
  const res = await paced(() => fetch(`${BROWSE}/item/${encodeURIComponent(itemId)}`, { headers: hdrs(access, marketplace) }));
  if (!res.ok) return null;
  return res.json();
}

async function main() {
  const argv = process.argv.slice(2);
  const get = (k, d) => argv.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=') ?? d;
  const cfg = {
    ...D,
    marketplace: get('marketplace', D.marketplace),
    minPrice: Number(get('min-price', D.minPrice)),
    maxPrice: Number(get('max-price', D.maxPrice)),
    maxFeedback: Number(get('max-feedback', D.maxFeedback)),
    minAgeDays: Number(get('min-age', D.minAgeDays)),
    maxAgeDays: Number(get('max-age', D.maxAgeDays)),
    depth: Number(get('depth', D.depth)),
    maxCats: Number(get('max-cats', D.maxCats)),
    checkPerCategory: Number(get('check', D.checkPerCategory)),
    queryWords: Number(get('query-words', D.queryWords)),
    minProfit: Number(get('profit', D.minProfit)),
  };
  const csv = get('csv', null);
  const queriesFile = get('queries', null);
  const only = get('cats', null);

  for (const f of ['.env.local', '.env']) {
    try {
      const vars = parseEnv(await readFile(f, 'utf8'));
      for (const [k, v] of Object.entries(vars)) if (process.env[k] === undefined) process.env[k] = v;
    } catch { /* absent is normal */ }
  }
  const clientId = process.env.EBAY_CLIENT_ID ?? process.env.EBAY_APP_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET ?? process.env.EBAY_CERT_ID;
  if (!clientId || !clientSecret) {
    console.error('eBay credentials not found in the environment or .env.local');
    process.exit(1);
  }

  const access = await token({ clientId, clientSecret });
  await mkdir(CACHE, { recursive: true });
  const treeFile = `${CACHE}/categories-${cfg.marketplace}.json`;

  // The cached shape has to match what this build expects. A tree written
  // before the branch field existed matched nothing and said only "no
  // categories", which is a silent failure wearing a helpful message.
  const CACHE_SHAPE = ['id', 'name', 'depth', 'root'];
  const stale = (c) => !Array.isArray(c) || !c.length || CACHE_SHAPE.some((k) => !(k in c[0]));

  let cats = null;
  if (!argv.includes('--tree')) {
    try {
      const raw = JSON.parse(await readFile(treeFile, 'utf8'));
      if (stale(raw)) console.log('\ncached category tree is from an older build, refetching');
      else cats = raw;
    } catch { /* not cached yet */ }
  }
  if (!cats) {
    console.log('\nfetching the category tree, this is a few megabytes and happens once');
    const { categoryTreeId, tree } = await fetchTree(access, cfg.marketplace);
    cats = flattenTree(tree.rootCategoryNode);
    await writeFile(treeFile, JSON.stringify(cats));
    console.log(`  tree ${categoryTreeId}, ${cats.length} categories cached to ${treeFile}`);
    const byDepth = cats.reduce((m, c) => ({ ...m, [c.depth]: (m[c.depth] ?? 0) + 1 }), {});
    console.log(`  by depth: ${Object.entries(byDepth).map(([d, n]) => `${d}:${n}`).join('  ')}`);
    if (argv.includes('--tree')) return;
  }

  if (argv.includes('--list-roots')) {
    const roots = [...new Set(cats.filter((c) => c.depth === 1).map((c) => c.name))].sort();
    console.log(`\n${roots.length} top level categories:\n`);
    for (const r of roots) console.log(`  ${NEW_GOODS_ROOTS.some((x) => r.toLowerCase().includes(x)) ? 'IN ' : '   '} ${r}`);
    console.log('\nOverride with --roots=a,b,c using any part of a name.\n');
    return;
  }

  const roots = get('roots', null)?.split(',').map((x) => x.trim().toLowerCase());
  let pool = only
    ? cats.filter((c) => only.split(',').includes(c.id))
    : pickBranch(cats.filter((c) => c.depth === cfg.depth), roots ?? NEW_GOODS_ROOTS);

  if (!pool.length) {
    console.error('\nNo categories matched. Run --list-roots to see what is actually there.\n');
    process.exit(1);
  }

  if (pool.length > cfg.maxCats) {
    // Even stride rather than the first N, so the sweep is not all one branch
    // of the tree on the first run.
    const stride = pool.length / cfg.maxCats;
    pool = Array.from({ length: cfg.maxCats }, (_, i) => pool[Math.floor(i * stride)]);
  }

  const branches = [...new Set(pool.map((c) => c.root))];
  console.log(`\nsweeping ${pool.length} categories at depth ${cfg.depth} under ${branches.length} branches`);
  console.log(`  ${branches.join(', ')}`);
  console.log(`  £${cfg.minPrice} to £${cfg.maxPrice}, seller under ${cfg.maxFeedback} feedback\n`);

  const found = [];
  let scanned = 0; let promising = 0; let calls = 1;
  let stopped = false;

  // Ctrl-C on the first run threw away everything it had found. A partial
  // sweep is still a result.
  const report = () => {
    found.sort((a, b) => b.monthly - a.monthly);
    console.log(`\n${scanned} scanned, ${promising} in band, ${found.length} selling. ${calls} API calls.\n`);
    console.log('BEST 30, by what one listing is worth a month at our cost base\n');
    for (const f of found.slice(0, 30)) {
      console.log(`  £${String(f.monthly).padStart(4)}/mo  £${f.price.toFixed(2).padStart(6)}  `
        + `${String(f.perMonth).padStart(3)}/mo  pay up to £${f.maxGoods.toFixed(2).padStart(5)}  `
        + `${String(f.ageDays).padStart(4)}d  fb ${String(f.sellerFeedback).padStart(6)}  ${f.title.slice(0, 42)}`);
      console.log(`             ${f.query ?? 'no query'}   ·   ${f.category}`);
    }
  };

  const writeCsv = async () => {
    if (!csv) return;
    const head = 'query,monthly_headroom,price,units_per_month,headroom,max_goods_cost,'
      + 'age_days,sold_lifetime,seller_feedback,branch,category,category_id,title,item_id\n';
    await writeFile(csv, head + found.map((f) => [
      JSON.stringify(f.query ?? ''), f.monthly, f.price, f.perMonth, f.headroom, f.maxGoods,
      f.ageDays, f.sold, f.sellerFeedback,
      JSON.stringify(f.root ?? ''), JSON.stringify(f.category), f.categoryId,
      JSON.stringify(f.title), f.itemId,
    ].join(',')).join('\n') + '\n');
    console.log(`\n${csv} written, ${found.length} rows.`);
  };

  /*
   * The query file the gate reads. One line per distinct query, best first,
   * with the shelf it came off as a comment so a bad query can be traced back
   * to the category that produced it rather than argued about in the abstract.
   *
   * Deduplicated, which is most of the value: four sellers of the same boot
   * liner produce one query, not four, and the gate is not asked the same
   * question four times at twenty one calls each.
   */
  const writeQueries = async () => {
    if (!queriesFile) return;
    const best = new Map();
    for (const f of found) {
      if (!f.query) continue;
      const prior = best.get(f.query);
      if (!prior || f.monthly > prior.monthly) best.set(f.query, f);
    }
    const rows = [...best.values()].sort((a, b) => b.monthly - a.monthly);

    const lines = [
      `# ${rows.length} queries from a sweep of ${pool.length} categories at depth ${cfg.depth}.`,
      '#',
      '# Every one is a real listing from a seller under '
        + `${cfg.maxFeedback} feedback that is really selling. Nothing here came`,
      '# out of anybody\'s head. The gate decides whether the market behind the',
      '# query is one she can enter, which is a different question.',
      '#',
      `#   node scripts/gate.js --file=${queriesFile} --csv=gate-sweep.csv --show`,
      '',
      ...rows.map((f) => `${f.query}${' '.repeat(Math.max(1, 34 - f.query.length))}# ${f.category}, £${f.maxGoods.toFixed(2)}`),
      '',
    ];
    await writeFile(queriesFile, lines.join('\n'));
    console.log(`${queriesFile} written, ${rows.length} distinct queries from ${found.length} listings.`);
  };

  process.on('SIGINT', () => {
    if (stopped) process.exit(130);
    stopped = true;
    console.log('\n\ninterrupted, reporting what was found so far');
    report();
    writeCsv().then(writeQueries).finally(() => process.exit(0));
  });

  for (const cat of pool) {
    if (stopped) break;
    const body = await searchCategory({ access, marketplace: cfg.marketplace, categoryId: cat.id, limit: cfg.perCategory });
    calls += 1;
    const items = body.itemSummaries ?? [];
    scanned += items.length;

    const shortlist = items.filter((i) => looksPromising(i, cfg)).slice(0, cfg.checkPerCategory);
    promising += shortlist.length;

    // Counted across everything the category returned, not across the twelve
    // that survived the price band. Twelve titles is too thin a shelf to tell
    // a product word from a seller's adjective.
    const df = shelfFrequency(items.map((i) => i.title));

    let hits = 0;
    for (const it of shortlist) {
      const detail = await getItem({ access, marketplace: cfg.marketplace, itemId: it.itemId });
      calls += 1;
      const sold = readSold(detail);
      if (sold == null || sold <= 0) continue;
      const age = readAge(it);
      const price = Number(it.price.value);
      const perDay = sold / age;
      const maxGoods = maxGoodsCost(price, cfg);
      // Nothing can be bought for nothing. A market clearing below the cost
      // base is not a discovery, it is a price the fixed stack already ate.
      if (maxGoods == null || maxGoods <= 0) continue;
      hits += 1;
      found.push({
        root: cat.root, category: cat.name, categoryId: cat.id,
        title: it.title, query: queryFor(it.title, df, cfg.queryWords, items.length),
        price, ageDays: Math.round(age), sold,
        perMonth: Math.round(perDay * 30), maxGoods,
        headroom: headroomAt(price, cfg),
        monthly: Math.round(perDay * 30 * headroomAt(price, cfg)),
        sellerFeedback: readSeller(it).feedback,
        itemId: it.itemId,
      });
    }
    console.log(`  ${String(items.length).padStart(3)} scanned  ${String(shortlist.length).padStart(2)} in band  `
      + `${String(hits).padStart(2)} selling   ${cat.name}`);
  }

  report();
  await writeCsv();
  await writeQueries();

  console.log('\nReal listings, really selling, held by small sellers. The queries are '
    + 'shortened from their titles because eBay matches every word.\n');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(`\nsweep failed: ${e?.stack ?? e}\n`); process.exit(1); });
}
