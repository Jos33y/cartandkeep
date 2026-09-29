/*
 * Fills the cost on eBay cards seen at a shop whose file had names but no prices (CPC, John Lewis, City
 * Plumbing and the other sitemap shops). Opens the shop's product page, reads its price with VAT, its brand
 * and barcode, and checks again whether it is the same product and pack as the eBay seller's. The same
 * pack makes that price her cost, and the card works forward from it; anything else stays a lead, and the
 * card keeps pricing from the market. No eBay calls.
 *
 *   node scripts/fill-costs.mjs --dry            what it would read, nothing written
 *   node scripts/fill-costs.mjs --max=200        first 200 cards with no price
 *   node scripts/fill-costs.mjs --refresh        read prices already on file again too
 *
 * Cards she has decided are left exactly as they are. One page every 1.5s; a shop that blocks is left alone.
 */
import { fetchPage, paidPrice } from './store/page.mjs';
import { matchOf } from './lib/row.js';

const args = process.argv.slice(2);
const arg = (k, d = null) => args.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=') ?? d;
const dry = args.includes('--dry');
const refresh = args.includes('--refresh');
const max = Number(arg('max', Infinity));
const pause = Number(arg('pause', 1500));
const slug = arg('tenant', 'cart-and-keep');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const { connect } = await import('../pipeline/lib/db.js');
const { db } = await connect();
const { data: tenant } = await db.from('tenants').select('id').eq('slug', slug).maybeSingle();
if (!tenant) { console.error(`Tenant "${slug}" not found.`); process.exit(1); }

// Every card with a shop link on its eBay reading, a page at a time.
const cards = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await db.from('candidates')
    .select('id, title, margin, entry, competition, decisions ( id )')
    .eq('tenant_id', tenant.id)
    .not('margin->shelf->>url', 'is', null)
    .range(from, from + 999);
  if (error) { console.error(`Cards not read: ${error.message}`); process.exit(1); }
  cards.push(...(data ?? []));
  if (!data || data.length < 1000) break;
}

const decided = (c) => (Array.isArray(c.decisions) ? c.decisions.length > 0 : Boolean(c.decisions));
const todo = cards
  .filter((c) => c.margin?.channel !== 'store' && !decided(c))
  .filter((c) => refresh || c.margin?.shelf?.price == null)
  .filter((c) => /^https?:\/\//.test(c.margin?.shelf?.url ?? ''))
  .slice(0, max);

console.log(`\n  ${cards.length} cards with a shop link, ${todo.length} to read${dry ? ' (dry run)' : ''}\n`);
if (dry) {
  const byHost = todo.reduce((o, c) => { const h = new URL(c.margin.shelf.url).host; o[h] = (o[h] ?? 0) + 1; return o; }, {});
  for (const [h, n] of Object.entries(byHost).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(5)}  ${h}`);
  console.log(`\n  About ${Math.round((todo.length * (pause + 1500)) / 60000)} minutes at one page every ${pause / 1000}s.\n`);
  process.exit(0);
}

const blocked = new Set();
const tally = { priced: 0, now_her_cost: 0, still_a_lead: 0, no_price_on_page: 0, gone: 0, blocked: 0, failed: 0 };
for (const [i, c] of todo.entries()) {
  const m = c.margin;
  const url = m.shelf.url;
  const host = new URL(url).host;
  if (blocked.has(host)) { tally.blocked += 1; continue; }
  const got = await fetchPage(url);
  await sleep(pause);
  let line;
  if (got.blocked) { blocked.add(host); tally.blocked += 1; line = `blocked (${got.blocked}), leaving ${host} alone`; }
  else if (got.gone) { tally.gone += 1; line = `page gone (${got.gone})`; }
  else if (got.failed) { tally.failed += 1; line = `could not read (${got.failed})`; }
  else {
    const paid = paidPrice(got.page, url);
    if (!paid) { tally.no_price_on_page += 1; line = 'no price on the page'; }
    else {
      const shelf = {
        ...m.shelf,
        price: paid.price,
        product: m.shelf.product ?? got.page.name,
        brand: m.shelf.brand ?? (got.page.brand || null),
        gtin: m.shelf.gtin ?? (got.page.gtin || null),
        price_read_at: new Date().toISOString().slice(0, 10),
        vat_added: paid.vatAdded,
      };
      // Brand and barcode from the page can settle a match the names-only file could not.
      const listing = (c.competition?.listings ?? []).find((l) => l.item_id && l.item_id === c.entry?.item_id) ?? null;
      const match = matchOf(shelf, listing, c.entry?.title) ?? m.match;
      const { error } = await db.from('candidates').update({ margin: { ...m, shelf, match } }).eq('id', c.id);
      if (error) { tally.failed += 1; line = `not saved: ${error.message}`; }
      else {
        tally.priced += 1;
        const cost = match?.level === 'same_product_same_pack';
        tally[cost ? 'now_her_cost' : 'still_a_lead'] += 1;
        line = `£${paid.price.toFixed(2)}${paid.vatAdded ? ' (VAT added)' : ''}, ${cost ? 'her cost' : `a lead (${String(match?.level ?? 'unknown').replace(/_/g, ' ')})`}`;
      }
    }
  }
  console.log(`  ${String(i + 1).padStart(4)}/${todo.length}  ${String(c.title).slice(0, 44).padEnd(44)}  ${line}`);
}

console.log(`\n  ${Object.entries(tally).filter(([, v]) => v).map(([k, v]) => `${k.replace(/_/g, ' ')} ${v}`).join(', ')}`);
if (blocked.size) console.log(`  Blocked, left alone: ${[...blocked].join(', ')}`);
console.log();
