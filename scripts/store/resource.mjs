/*
 * Finds another UK shop for store cards whose linked page is the wrong product, size or pack.
 * A store card proves the product can be sourced; a card pointing at the wrong item proves nothing.
 *
 *   node scripts/store/resource.mjs --review=research/review/store-home-and-garden-review-2026-09-29.csv
 *   node scripts/store/resource.mjs --review=... --no-fetch        judge from the shelf files only
 *   node scripts/store/resource.mjs --review=... --apply            repoint what was found, reject what was not
 *   node scripts/store/resource.mjs --apply --from=research/review/resource-2026-09-29.csv   write a run already made, no searching
 *
 * Reads the rows whose action is "resource". For each: every shop on file with the product's barcode, then the
 * shelf names the tightened name rule confirms, leaving out the wrong link and any page named like it. The best
 * few are opened; the page's barcode decides, else its name. Nothing is written without --apply, and a card she
 * has already decided is left alone unless --override.
 *
 * With --apply: a barcode match repoints the card. A name match is a note with the lead. Nothing found is a note
 * too, never a rejection: an unsure card may be right as it is, and she knows her products.
 *
 * Writes research/review/resource-<date>.csv: what was found for each card and how sure.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseCsv } from '../lib/sources.js';
import { barcodeVerdict, digits, sameProduct, squash, wordCounts } from './match.mjs';
import { fetchPage, paidPrice } from './page.mjs';
import { loadShelves } from './shelf.mjs';
import { priceStore } from './price-store.mjs';

const args = process.argv.slice(2);
const arg = (k, d = null) => args.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=') ?? d;
const reviewPath = arg('review');
const googleDir = arg('google', 'research/google');
const shelfDir = arg('shelves', 'research/shelf');
const slug = arg('tenant', 'cart-and-keep');
const tries = Number(arg('tries', 3));
const pause = Number(arg('pause', 1500));
const noFetch = args.includes('--no-fetch');
const fromPath = arg('from');
const apply = args.includes('--apply');
const override = args.includes('--override');
const date = new Date().toISOString().slice(0, 10);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
if (!reviewPath && !fromPath) { console.error('\n  Pass --review= the review CSV with an action column, or --from= a results file to write.\n'); process.exit(1); }

const results = fromPath ? parseCsv(fs.readFileSync(fromPath, 'utf8')) : await search();
if (!apply) { console.log('\n  Nothing written. --apply repoints barcode matches and notes the rest for her.\n'); process.exit(0); }

async function search() {

const cards = parseCsv(fs.readFileSync(reviewPath, 'utf8')).filter((r) => r.action === 'resource');
if (!cards.length) { console.log('\n  No rows with action "resource".\n'); return []; }

// Google's own record of each product: brand, every GTIN, price range. Matched to the card by title.
const google = new Map();
const titles = [];
const brands = new Set();
for (const f of fs.readdirSync(googleDir).filter((x) => /^best-sellers-.*\.csv$/i.test(x))) {
  for (const g of parseCsv(fs.readFileSync(path.join(googleDir, f), 'utf8').split(/\r?\n/).slice(2).join('\n'))) {
    titles.push(g.Title);
    if (g.Brand) brands.add(squash(g.Brand));
    const k = squash(g.Title);
    const prior = google.get(k);
    const gtins = String(g.GTINs ?? '').split(/\s+/).map(digits).filter(Boolean);
    google.set(k, {
      brand: g.Brand ?? prior?.brand ?? '',
      gtins: [...new Set([...(prior?.gtins ?? []), ...gtins])],
      min: Number(g['Price Range Min']) || prior?.min || null,
      max: Number(g['Price Range Max']) || prior?.max || null,
    });
  }
}
const ctx = { df: wordCounts(titles), brands };

// The review file carries the card's brand and first GTIN, for a product whose export is not in the folder.
const want = cards.map((c) => {
  const g = google.get(squash(c.title)) ?? { brand: '', gtins: [], min: Number(c.google_min) || null, max: Number(c.google_max) || null };
  return { card: c, g: { ...g, brand: g.brand || c.brand || '', gtins: [...new Set([...g.gtins, digits(c.gtin)].filter(Boolean))] } };
});
const shelf = loadShelves({
  dir: shelfDir,
  wantGtins: new Set(want.flatMap((w) => w.g.gtins)),
  wantKeys: new Set(want.flatMap((w) => { const b = squash(w.g.brand); return [b, b.split(' ')[0]]; }).filter(Boolean)),
});
console.log(`\n  ${cards.length} cards to re-source; shelves ${shelf.rows} products from ${shelf.files.length} files, ${shelf.kept} could match`);

const RANK = { barcode: 0, name: 1 };
const blocked = new Set();
const results = [];
for (const [i, { card, g }] of want.entries()) {
  const bad = String(card.shop_url ?? '').trim();
  const badName = squash(card.page_name);
  const brand = squash(g.brand);
  const sane = (s) => s.url !== bad && squash(s.name) !== badName
    && (s.price == null || g.min == null || (s.price >= g.min * 0.4 && (g.max == null || s.price <= g.max * 2)));
  const hits = [];
  const seen = new Set();
  const push = (s, via) => { if (!s.url || seen.has(s.url) || !sane(s)) return; seen.add(s.url); hits.push({ s, via }); };
  for (const code of g.gtins) for (const s of shelf.byGtin.get(code) ?? []) push(s, 'barcode');
  for (const s of shelf.byBrand.get(brand) ?? shelf.byBrand.get(brand.split(' ')[0]) ?? []) {
    if (s.gtin && g.gtins.length && !g.gtins.includes(s.gtin)) continue;
    if (sameProduct(card.title, g.brand, s.name, ctx).startsWith('confirmed')) push(s, 'name');
  }
  hits.sort((a, b) => RANK[a.via] - RANK[b.via] || (a.s.price ?? 1e9) - (b.s.price ?? 1e9));

  let found = null;
  let tried = 0;
  const notes = [];
  for (const h of hits) {
    if (noFetch) { found = { ...h, verdict: h.via === 'barcode' ? 'confirmed, barcode on the shelf' : 'name on the shelf, page not read', price: h.s.price }; break; }
    if (tried >= tries) break;
    let host = '';
    try { host = new URL(h.s.url).host; } catch { continue; }
    if (blocked.has(host)) { notes.push(`${h.s.shop} blocked`); continue; }
    tried += 1;
    const got = await fetchPage(h.s.url);
    await sleep(pause);
    if (got.blocked) { blocked.add(host); notes.push(`${h.s.shop} blocked`); continue; }
    if (!got.page) { notes.push(`${h.s.shop} ${got.gone ? `gone ${got.gone}` : 'unreadable'}`); continue; }
    const v = barcodeVerdict(g.gtins, got.page.gtin) ?? (got.page.name ? sameProduct(card.title, g.brand, got.page.name, ctx) : 'no name on the page');
    if (!v.startsWith('confirmed')) { notes.push(`${h.s.shop}: ${v}`); continue; }
    const paid = paidPrice(got.page, h.s.url);
    found = { ...h, verdict: v, price: paid?.price ?? h.s.price, pageName: got.page.name, image: got.page.image };
    break;
  }
  // Only a barcode is sure enough to repoint a card by itself; a name match, even on a page read, is a lead she checks.
  // (29 September: 9 of 22 name matches were still the wrong item.)
  const sure = Boolean(found && /barcode/.test(found.verdict) && found.verdict.startsWith('confirmed'));
  results.push({
    id: card.id, title: card.title, was: bad, was_page: card.page_name,
    status: found ? (sure ? 'found' : 'found, check it') : 'not found',
    shop: found?.s.shop ?? '', url: found?.s.url ?? '', price: found?.price ?? '', page_name: found?.pageName ?? found?.s.name ?? '',
    how: found?.verdict ?? '', grams: found?.s.grams ?? '', image: found?.image || found?.s.image || '',
    candidates: hits.length, notes: notes.join('; '),
  });
  const r = results.at(-1);
  console.log(`  ${String(i + 1).padStart(2)}/${want.length}  ${r.status.padEnd(15)} ${card.title.slice(0, 42).padEnd(42)}  ${r.shop ? `${r.shop} ${r.price !== '' ? `£${Number(r.price).toFixed(2)}` : ''}` : `${hits.length} on file`}`);
}

fs.mkdirSync('research/review', { recursive: true });
const out = `research/review/resource-${date}.csv`;
const cols = Object.keys(results[0]);
const cell = (v) => (/[",\n]/.test(String(v ?? '')) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? ''));
fs.writeFileSync(out, [cols.join(','), ...results.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\n') + '\n');
const count = (s) => results.filter((r) => r.status === s).length;
console.log(`\n  found ${count('found')}, found but check it ${count('found, check it')}, not found ${count('not found')}`);
if (blocked.size) console.log(`  blocked, not read: ${[...blocked].join(', ')}`);
console.log(`  ${out}`);

return results;
}

const { connect } = await import('../../pipeline/lib/db.js');
const { db } = await connect();
const { data: tenant } = await db.from('tenants').select('id').eq('slug', slug).maybeSingle();
if (!tenant) { console.error(`Tenant "${slug}" not found.`); process.exit(1); }

const ids = results.map((r) => r.id);
const { data: rows, error } = await db.from('candidates').select('id, title, margin, image_url, decisions ( action )').in('id', ids);
if (error) { console.error(`Lookup failed: ${error.message}`); process.exit(1); }
const byId = new Map(rows.map((c) => [c.id, c]));
const decided = (c) => (Array.isArray(c.decisions) ? c.decisions.length > 0 : Boolean(c.decisions));
const tally = { repointed: 0, noted_not_found: 0, left_to_check: 0, decided_by_her: 0, missing: 0, failed: 0 };

for (const r of results) {
  const c = byId.get(r.id);
  if (!c) { tally.missing += 1; continue; }
  if (decided(c) && !override) { tally.decided_by_her += 1; continue; }
  // Not sure enough to repoint: the lead goes on the card as a note, and she decides.
  if (r.status === 'found, check it') {
    const body = `Review ${date}: another shop may have it: ${r.shop}, ${r.page_name || r.url}${r.price ? `, £${Number(r.price).toFixed(2)}` : ''} (${r.url}). ${r.notes || 'Check it is the same item before using it.'}`;
    const { error: e } = await db.from('candidate_notes').insert({ tenant_id: tenant.id, candidate_id: c.id, body });
    if (e) { tally.failed += 1; console.error(`  ${c.title}: note not added, ${e.message}`); } else tally.left_to_check += 1;
    continue;
  }
  if (r.status === 'not found') {
    const body = `Review ${date}: the linked page may not be this item (${r.was_page || 'another product'}), and no other UK shop on file sells it. Check the page; if it is wrong, reject as not sourceable.${r.notes ? ` Tried: ${r.notes}.` : ''}`;
    const { data: have } = await db.from('candidate_notes').select('id').eq('candidate_id', c.id).eq('body', body).limit(1);
    if (have?.length) { tally.noted_not_found += 1; continue; }
    const { error: e } = await db.from('candidate_notes').insert({ tenant_id: tenant.id, candidate_id: c.id, body });
    if (e) { tally.failed += 1; console.error(`  ${c.title}: note not added, ${e.message}`); } else tally.noted_not_found += 1;
    continue;
  }
  const m = c.margin ?? {};
  const cost = Number(r.price) > 0 ? Number(r.price) : null;
  const grams = Number(r.grams) > 0 ? Number(r.grams) : m.postage_band?.grams ?? null;
  const priced = priceStore(cost, Number(m.google?.min), grams);
  if (!priced.band) { tally.failed += 1; console.error(`  ${c.title}: over 20kg at the new shop, left as it was`); continue; }
  const costFrom = { shop: r.shop, url: r.url, product: r.page_name, price: cost };
  const margin = {
    ...m,
    list_at: priced.list?.price ?? null, floor: priced.list?.floor ?? null, above_market: priced.aboveMarket,
    keep: priced.list?.keep ?? null, profit_target: priced.list?.profit ?? null,
    cost, cost_from: costFrom,
    postage: priced.band.postage, packaging: priced.band.packaging,
    postage_band: { key: priced.band.key, label: priced.band.label, grams: priced.band.grams, basis: priced.band.basis, from: Number(r.grams) > 0 ? 'shop' : m.postage_band?.from ?? null },
    shops: [r.shop, ...(m.shops ?? []).filter((s) => s !== r.shop && s !== m.cost_from?.shop)],
    match: { by: r.how.includes('barcode') ? 'barcode' : 'name', verdict: r.how },
    resourced: { from: r.was, from_page: r.was_page, on: date },
    // An eBay reading keeps its market figures; the shop price is a cost only once the pack is confirmed on eBay.
    ...(m.ebay ? { ebay: { ...m.ebay, shelf: { ...costFrom }, match: { level: 'same_product_unknown_pack', via: 'resourced store card' } } } : {}),
  };
  const { error: e } = await db.from('candidates').update({ margin, reference_url: r.url, image_url: r.image || c.image_url }).eq('id', c.id);
  if (e) { tally.failed += 1; console.error(`  ${c.title}: not repointed, ${e.message}`); continue; }
  tally.repointed += 1;
  await db.from('candidate_notes').insert({ tenant_id: tenant.id, candidate_id: c.id, body: `Review ${date}: repointed from ${r.was_page || r.was} to ${r.shop} (${r.how}).` });
}
console.log(`\n  ${Object.entries(tally).filter(([, v]) => v).map(([k, v]) => `${k.replace(/_/g, ' ')} ${v}`).join(', ')}\n`);
