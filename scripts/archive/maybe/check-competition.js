/*
 * How deep is the market for each candidate. Reads eBay's live listings rather
 * than its sold data, which is the half sold history cannot answer: two hundred
 * sales across twenty listings is a market, two hundred across four hundred is
 * a knife fight.
 *
 * Writes active_listings, seller_concentration and the price spread. Names no
 * column enrichment or the importer owns.
 *
 * Usage:
 *   node scripts/check-competition.js --date=2026-08-17 --dry
 *   node scripts/check-competition.js --date=2026-08-17
 *   node scripts/check-competition.js --date=2026-08-17 --force
 */

import { connect } from '../pipeline/lib/db.js';
import { token } from '../pipeline/sources/ebayBrowse.js';

const BROWSE = 'https://api.ebay.com/buy/browse/v1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Words that describe a listing rather than a product. A query built from a
// full eBay title returns almost nothing, because the title is stuffed for
// search and no two sellers stuff it the same way.
const NOISE = new Set([
  'new', 'uk', 'free', 'fast', 'ship', 'shipping', 'post', 'postage', 'sale',
  'best', 'top', 'hot', 'quality', 'premium', 'genuine', 'official', 'pack',
  'pcs', 'set', 'for', 'the', 'and', 'with', 'by', 'in', 'on', 'of', 'to',
  'a', 'an', 'elderly', 'disabled', 'disability', 'adults', 'adult', 'seniors',
  'senior', 'aid', 'aids', 'mobility', 'safety', 'heavy', 'duty', 'adjustable',
  'portable', 'foldable', 'folding', 'anti', 'slip', 'non',
]);

/*
 * The query is the first few product words of the title. Keeping it short is
 * deliberate: a long query narrows to one listing and reports a market of one,
 * which is the failure mode that made CJ keyword matching useless. Four words
 * is wide enough to find competitors and narrow enough to stay on the product.
 */
function queryFor(title) {
  const words = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !NOISE.has(w) && !/^\d+$/.test(w));

  // Deduped. 'Bed Rail for Elderly Bed Rail Guard' produced the query
  // 'bed rail bed rail', which spent two of four slots on a repeat and widened
  // the search to 9,522 listings.
  return [...new Set(words)].slice(0, 4).join(' ');
}

// Share held by the top three sellers. Above 70% the methodology reads the
// category as entrenched, because feedback history is not something a new
// seller can match on day one.
function concentration(items) {
  const bySeller = new Map();
  for (const it of items) {
    const s = it.seller?.username;
    if (!s) continue;
    bySeller.set(s, (bySeller.get(s) ?? 0) + 1);
  }
  if (!bySeller.size) return null;

  const counts = [...bySeller.values()].sort((a, b) => b - a);
  const top = counts.slice(0, 3).reduce((a, b) => a + b, 0);
  return Math.round((top / items.length) * 100) / 100;
}

function spread(items) {
  const prices = items
    .map((it) => Number(it.price?.value))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);

  if (prices.length < 4) return null;

  const at = (q) => prices[Math.floor(prices.length * q)];
  const median = at(0.5);
  if (!median) return null;

  // Interquartile range over median. Under 0.15 sellers have converged and
  // there is no room to position on anything but price.
  return {
    median: Math.round(median * 100) / 100,
    low: prices[0],
    high: prices[prices.length - 1],
    band: Math.round(((at(0.75) - at(0.25)) / median) * 100) / 100,
  };
}

async function search({ access, marketplace, q }) {
  const url = new URL(`${BROWSE}/item_summary/search`);
  url.searchParams.set('q', q);
  url.searchParams.set('limit', '100');
  url.searchParams.set('filter', 'conditions:{NEW},buyingOptions:{FIXED_PRICE}');

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${access}`,
      'X-EBAY-C-MARKETPLACE-ID': marketplace,
    },
  });

  if (!res.ok) throw new Error(`browse ${res.status} for "${q}"`);

  const body = await res.json();
  return { total: body.total ?? 0, items: body.itemSummaries ?? [] };
}

async function main() {
  const { db, E } = await connect();
  const args = process.argv.slice(2);
  const dry = args.includes('--dry');
  const force = args.includes('--force');
  const slug = args.find((a) => a.startsWith('--tenant='))?.split('=')[1]
    || E.VITE_TENANT_SLUG || 'cart-and-keep';
  const date = args.find((a) => a.startsWith('--date='))?.split('=')[1];

  if (!E.EBAY_CLIENT_ID || !E.EBAY_CLIENT_SECRET) {
    console.error('Missing EBAY_CLIENT_ID or EBAY_CLIENT_SECRET.');
    process.exit(1);
  }

  const { data: tenant, error: tErr } = await db
    .from('tenants').select('id, name, marketplace').eq('slug', slug).single();

  if (tErr || !tenant) {
    console.error(`Tenant "${slug}" not found.`);
    process.exit(1);
  }

  let q = db
    .from('candidates')
    .select('id, title, active_listings, batches!inner ( delivered_for )')
    .eq('tenant_id', tenant.id);

  if (date) q = q.eq('batches.delivered_for', date);
  if (!force) q = q.is('active_listings', null);

  const { data: rows, error } = await q;

  if (error) {
    console.error('Could not read candidates:', error.message);
    process.exit(1);
  }

  if (!rows?.length) {
    console.log('\nNothing to check.\n');
    return;
  }

  const access = await token({ clientId: E.EBAY_CLIENT_ID, clientSecret: E.EBAY_CLIENT_SECRET });
  const marketplace = E.EBAY_MARKETPLACE_ID || tenant.marketplace || 'EBAY_GB';

  console.log(`\n${tenant.name}, ${rows.length} to check on ${marketplace}\n`);
  console.log('  listings  top3  band  query');

  let done = 0;
  let thin = 0;
  let failed = 0;

  for (const row of rows) {
    const query = queryFor(row.title);

    // A title that reduces to nothing cannot be searched, and searching the
    // raw title would return one listing and report a market of one.
    if (!query) {
      failed += 1;
      console.error(`  no query from title: ${row.title.slice(0, 50)}`);
      continue;
    }

    try {
      const { total, items } = await search({ access, marketplace, q: query });

      // Both ends are failed queries rather than findings. A handful of
      // results means the query narrowed onto one seller's wording. A count
      // in the tens of thousands means it collapsed into a whole department:
      // 'bathtub handle bath handle' returned 112,202, which is bath fittings
      // and not a market for a grab handle. Recorded as unusable either way,
      // because a wrong number here would be read as a real one.
      //
      // The floor was four and four was not enough. On the mobility batch,
      // 'half step platform extra' returned exactly four listings, cleared the
      // test, and wrote a seller concentration of 1.00 and a price band of
      // 6.52. That reads as one seller owning the entire market, which is the
      // strongest competition signal there is, off a query that found nothing.
      // Eight, because concentration over a top three needs more than three
      // listings under it before it means anything.
      const usable = items.length >= 8 && total <= 20000;

      // Below the floor the concentration and spread are noise, so they are
      // left null rather than computed from a handful of listings.
      const conc = usable ? concentration(items) : null;
      const prices = usable ? spread(items) : null;
      if (!usable) thin += 1;

      console.log(
        `  ${String(total).padStart(8)}  ${String(conc ?? '-').padStart(4)}  `
        + `${String(prices?.band ?? '-').padStart(4)}  ${usable ? ' ' : '?'} ${query}`,
      );

      if (dry) continue;

      const { error: uErr } = await db
        .from('candidates')
        .update({
          // Null rather than a figure that would be read as real.
          active_listings: usable ? total : null,
          seller_concentration: conc,
          competition: {
            query,
            sampled: items.length,
            raw_total: total,
            usable,
            checked_at: new Date().toISOString(),
            ...(prices ?? {}),
          },
        })
        .eq('id', row.id);

      if (uErr) throw new Error(uErr.message);
      done += 1;
    } catch (e) {
      failed += 1;
      console.error(`  FAIL  ${query}  ${e.message}`);
    }

    await sleep(250);
  }

  console.log(
    dry
      ? '\nDry run, nothing written.\n'
      : `\n${done} checked, ${thin} unusable, ${failed} failed.\n`,
  );
}

main();
