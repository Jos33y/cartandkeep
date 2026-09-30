/*
 * The Google best sellers funnel for one store batch: one row per Google product in the category's exports,
 * and the stage it stopped at (store_coverage). Shared by import-store, which writes it after every store import,
 * and store-coverage.mjs, which writes it for a batch already imported.
 *
 *   google  own label, not a shelf product, restricted, Royal Mail will not carry it, outside the price range
 *   shelf   no UK shop on file stocks it, only a part or a bigger pack was seen
 *   page    the shop page is another product, unsure, gone, blocked, or not read yet
 *   import  confirmed, then held back: big brand, no price, bigger pack on the page, over 20kg, duplicate,
 *           or null when no rule names it
 *   sent    a card in her queue; candidate_id points at it
 *
 * Sent is decided by her cards, not by today's files: every card in the batch is exactly one sent row, even when
 * the shelves have changed since the import or the card was repointed. A card whose product is no longer in the
 * exports gets a row built from the card itself, so the sent count always equals the batch's cards.
 */
import fs from 'node:fs';
import { parseCsv } from '../lib/sources.js';
import { squash } from './match.mjs';
import { storeBandFor } from '../../src/lib/pricing.js';
import { stopOf } from './rules/index.mjs';

export const keyOf = (brand, title) => `${squash(brand)}|${squash(title)}`;
const num = (v) => (Number(v) > 0 ? Number(v) : null);
const PAGE = [[/^confirmed/, null], [/^wrong/, 'page_wrong'], [/^unsure/, 'page_unsure'], [/^page gone/, 'page_gone'], [/^shop blocked/, 'shop_blocked']];
const GOOGLE_STOPS = new Set(['own_label', 'not_shelf', 'restricted', 'cant_post', 'outside_price']);

export function readCoverageFiles(coveragePath, checkedPath) {
  const rows = parseCsv(fs.readFileSync(coveragePath, 'utf8'));
  const checked = new Map();
  if (checkedPath && fs.existsSync(checkedPath)) for (const r of parseCsv(fs.readFileSync(checkedPath, 'utf8'))) checked.set(keyOf(r.brand, r.title), r);
  return { rows, checked };
}

// Every card of hers, by reference: this batch's are the sent ones; another batch's make a duplicate.
async function loadCards(db, tenantId) {
  const all = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from('candidates').select('id, batch_id, external_ref, title, cluster, margin')
      .eq('tenant_id', tenantId).order('id').range(from, from + 999);
    if (error) throw new Error(`Cards not read: ${error.message}`);
    all.push(...data);
    if (data.length < 1000) return all;
  }
}

export async function buildCoverage({ db, tenantId, batchId, rows, checked }) {
  const cards = await loadCards(db, tenantId);
  const byRef = new Map();
  for (const c of cards) { const l = byRef.get(c.external_ref) ?? []; l.push(c); byRef.set(c.external_ref, l); }
  // A card kept on an older key (import-store matches by title when the key rule changes) is found by its title too.
  const byTitle = new Map();
  for (const c of cards) { const l = byTitle.get(c.title) ?? []; l.push(c); byTitle.set(c.title, l); }
  const batchCards = cards.filter((c) => c.batch_id === batchId);
  const now = new Date().toISOString();
  const claimed = new Set();
  const out = new Map();
  const put = (row) => { const prior = out.get(row.key); if (!prior || (row.stage === 'sent' && prior.stage !== 'sent')) out.set(row.key, row); };
  const shopOfCard = (c) => ({ shop: c.margin?.cost_from?.shop ?? null, shop_url: c.margin?.cost_from?.url ?? null, cost: num(c.margin?.cost) });

  // Best ranked first, so when several Google products share one short query, the best one owns the card.
  const sorted = [...rows].sort((a, b) => (Number(a.rank) || 1e9) - (Number(b.rank) || 1e9));
  for (const r of sorted) {
    const base = {
      tenant_id: tenantId, batch_id: batchId, key: r.key, query: r.query || null, title: r.title, brand: r.brand || null, gtin: r.gtin || null,
      rank: num(r.rank), months: num(r.months), periods: String(r.periods ?? '').split(/\s+/).filter(Boolean), season: r.season || null,
      need: r.need || null, google_min: num(r.google_min), google_max: num(r.google_max), checked_at: now,
      shop: null, shop_url: null, cost: null, page_verdict: null, candidate_id: null, reason: null,
    };
    const p = checked.get(r.key);
    const page = p ? { shop: String(p.seen_at ?? '').split(/\s+/)[0] || null, shop_url: p.seen_link || null, page_verdict: p.verdict || null, cost: num(p.seen_price) ?? num(p.page_price) } : {};
    const same = byRef.get(r.query) ?? byTitle.get(r.title) ?? [];
    const mine = same.find((c) => c.batch_id === batchId && !claimed.has(c.id));
    if (mine) {
      claimed.add(mine.id);
      put({ ...base, ...page, ...Object.fromEntries(Object.entries(shopOfCard(mine)).filter(([, v]) => v != null)), stage: 'sent', candidate_id: mine.id });
      continue;
    }
    if (r.stop !== 'picked') { put({ ...base, stage: GOOGLE_STOPS.has(r.stop) ? 'google' : 'shelf', reason: r.stop }); continue; }
    // A rule added after store-picks ran stops it at the import; it shows under that rule, as if stopped first.
    const ruled = stopOf({ title: r.title, brand: r.brand, category: r.category });
    if (ruled) { put({ ...base, ...page, stage: 'google', reason: ruled.stop }); continue; }
    if (/^big brand/.test(String(p?.verdict ?? ''))) { put({ ...base, ...page, stage: 'import', reason: 'big_brand' }); continue; }
    const pageStop = PAGE.find(([rx]) => rx.test(String(p?.verdict ?? '')));
    if (!p || !pageStop) { put({ ...base, ...page, stage: 'page', reason: 'page_unread' }); continue; }
    if (pageStop[1]) { put({ ...base, ...page, stage: 'page', reason: pageStop[1] }); continue; }
    // Confirmed, no card of its own: the import's rules, in its order.
    let reason = null;
    if (same.length) reason = 'duplicate';
    else if (p.big_brand === 'yes' && !p.need) reason = 'big_brand';
    else if (page.cost == null) reason = 'no_price';
    else if (num(p.google_max) && page.cost > num(p.google_max) * 2) reason = 'bigger_pack_page';
    else if (!storeBandFor(p.grams)) reason = 'over_20kg';
    else if (sorted.some((o) => o !== r && o.query === r.query)) reason = 'duplicate';
    put({ ...base, ...page, stage: 'import', reason, candidate_id: same[0]?.id ?? null });
  }

  // Cards no export row reached: one sent row each, built from the card.
  let fromCards = 0;
  for (const c of batchCards) {
    if (claimed.has(c.id)) continue;
    const m = c.margin ?? {};
    const g = m.google ?? {};
    let key = keyOf(m.brand, c.title);
    // Another card already owns that product's row: this card keeps a row of its own.
    if (out.get(key)?.stage === 'sent') key = `${key}|${c.id}`;
    const prior = out.get(key);
    claimed.add(c.id);
    fromCards += 1;
    out.set(key, {
      ...(prior ?? {}), tenant_id: tenantId, batch_id: batchId, key, query: c.external_ref, title: c.title, brand: m.brand ?? prior?.brand ?? null,
      gtin: m.gtin ?? prior?.gtin ?? null, rank: num(g.rank) ?? prior?.rank ?? null, months: num(g.months) ?? prior?.months ?? null,
      periods: g.periods ?? prior?.periods ?? [], season: prior?.season ?? c.cluster ?? null, need: m.need ?? prior?.need ?? null,
      google_min: num(g.min) ?? prior?.google_min ?? null, google_max: num(g.max) ?? prior?.google_max ?? null,
      ...shopOfCard(c), page_verdict: m.match?.verdict ?? prior?.page_verdict ?? null,
      stage: 'sent', reason: null, candidate_id: c.id, checked_at: now,
    });
  }

  const list = [...out.values()];
  const sent = list.filter((o) => o.stage === 'sent').length;
  return { list, sent, batchCards: batchCards.length, fromCards };
}

export async function writeCoverage(db, list) {
  for (let i = 0; i < list.length; i += 500) {
    const { error } = await db.from('store_coverage').upsert(list.slice(i, i + 500), { onConflict: 'batch_id,key' });
    if (error) throw new Error(`Coverage not written after ${i} rows: ${error.message}. Rerun; written rows are refreshed, not doubled.`);
  }
}

export function printCoverage(label, list, { sent, batchCards, fromCards }) {
  const tally = {};
  for (const o of list) { const k = `${o.stage}${o.reason ? `: ${o.reason}` : ''}`; tally[k] = (tally[k] ?? 0) + 1; }
  console.log(`\n  Coverage, "${label}": ${list.length} Google products`);
  for (const [k, v] of Object.entries(tally).sort((a, b) => b[1] - a[1])) console.log(`    ${k.padEnd(26)}${String(v).padStart(7)}`);
  console.log(`  sent ${sent} of the batch's ${batchCards} cards${sent === batchCards ? ', every card accounted for' : ' (MISMATCH)'}${fromCards ? `; ${fromCards} built from the card, its product no longer in the exports` : ''}`);
}
