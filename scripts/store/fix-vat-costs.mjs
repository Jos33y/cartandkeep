/*
 * Store cards costed from a shop that shows prices without VAT (page.mjs: EX_VAT_HOSTS, VAT_RELIEF_HOSTS) are
 * under-costed by a sixth. This re-costs them with VAT and re-prices them (floor, list price, what she keeps), and
 * marks each so it is never done twice. Her decisions are not touched. Lists only, unless --apply.
 *
 *   node scripts/store/fix-vat-costs.mjs
 *   node scripts/store/fix-vat-costs.mjs --apply
 */
import { EX_VAT_HOSTS, VAT, VAT_RELIEF_HOSTS } from './page.mjs';
import { priceStore } from './price-store.mjs';

const args = process.argv.slice(2);
const arg = (k, d = null) => args.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=') ?? d;
const apply = args.includes('--apply');
const slug = arg('tenant', 'cart-and-keep');
const hostOf = (url) => { try { return new URL(url).hostname; } catch { return ''; } };
const needsVat = (url) => { const h = hostOf(url); return EX_VAT_HOSTS.test(h) || VAT_RELIEF_HOSTS.test(h); };

const { connect } = await import('../../pipeline/lib/db.js');
const { db } = await connect();
const { data: tenant } = await db.from('tenants').select('id').eq('slug', slug).maybeSingle();
if (!tenant) { console.error(`Tenant "${slug}" not found.`); process.exit(1); }

const cards = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await db.from('candidates').select('id, title, margin, reference_url, decisions ( action )').eq('tenant_id', tenant.id).order('id').range(from, from + 999);
  if (error) { console.error(error.message); process.exit(1); }
  cards.push(...data);
  if (data.length < 1000) break;
}

const fix = [];
const ebayOnly = [];
for (const c of cards) {
  const m = c.margin ?? {};
  if (m.vat_added) continue;
  if (m.channel === 'store' && m.cost > 0 && needsVat(m.cost_from?.url ?? c.reference_url)) fix.push(c);
  else if (m.channel !== 'store' && needsVat(c.reference_url ?? m.shelf?.url ?? '')) ebayOnly.push(c);
}

console.log(`\n  ${fix.length} store cards costed without VAT${ebayOnly.length ? `; ${ebayOnly.length} eBay cards point at such a shop and are listed, not changed` : ''}\n`);
let n = 0;
for (const c of fix) {
  const m = c.margin;
  const cost = Math.round(m.cost * VAT * 100) / 100;
  const priced = priceStore(cost, Number(m.google?.min), m.postage_band?.grams);
  if (!priced.band) continue;
  const margin = {
    ...m,
    cost, cost_from: { ...m.cost_from, price: cost },
    list_at: priced.list?.price ?? null, floor: priced.list?.floor ?? null, above_market: priced.aboveMarket,
    keep: priced.list?.keep ?? null, profit_target: priced.list?.profit ?? null,
    vat_added: { was: m.cost, on: new Date().toISOString().slice(0, 10), why: 'shop shows prices without VAT' },
  };
  if (n < 25) console.log(`  £${m.cost.toFixed(2).padStart(6)} > £${cost.toFixed(2).padStart(6)}  list £${String(m.list_at ?? '-').padStart(6)} > £${String(margin.list_at ?? '-').padStart(6)}  ${(c.decisions?.length ? 'decided ' : '').padEnd(8)}${c.title.slice(0, 50)}`);
  n += 1;
  if (apply) {
    const { error } = await db.from('candidates').update({ margin }).eq('id', c.id);
    if (error) console.error(`  ${c.title}: not changed, ${error.message}`);
  }
}
if (n > 25) console.log(`  ... and ${n - 25} more`);
for (const c of ebayOnly.slice(0, 10)) console.log(`  eBay card, check its shop cost by hand: ${c.title.slice(0, 60)}`);
console.log(apply ? `\n  Re-costed ${n} cards.\n` : '\n  List only. Run again with --apply to write it.\n');
