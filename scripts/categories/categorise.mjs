/*
 * Gives cards their Google category and source labels. Used by the fill command (every card, once) and by both
 * importers (just the cards they wrote), so there is one way a category is chosen.
 *
 * Order of evidence, most specific wins:
 *   1. her choice (category_source = manual) is never changed; the override table counts as hers
 *   2. the eBay category of the listing that proved the card, through scripts/categories/ebay-to-google.mjs
 *   3. the title, classified against the allowed list (classify.mjs)
 *   4. the top category its Google export came from (store cards)
 *   5. Home & Garden, for her to move
 * A card already categorised only changes when the new answer is deeper, or it had only a default or export top.
 * Only the category columns and source_labels are written: decisions, prices, notes and suppliers are untouched.
 */
import fs from 'node:fs';
import { parseCsv } from '../lib/sources.js';
import { envKey } from '../lib/shops.js';
import { loadTaxonomy } from './taxonomy.mjs';
import { makeMapper, refineFor } from './ebay-to-google.mjs';
import { classify } from './classify.mjs';
import { shopName } from '../../src/lib/assess.js';

const TAXONOMY = 'research/google/taxonomy-with-ids.en-GB.txt';
const EBAY_CSV = 'research/categories/ebay-categories.csv';
const CARE_SHOPS = new Set(['completecareshop', 'essentialaids', 'abilitysuperstore', 'manageathome', 'millercare', 'medisave']);
// Shops appear as tags ("completecareshop"), names ("Complete Care Shop") or domains ("www.essentialaids.com").
const shopKey = (v) => String(v ?? '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\.(co\.uk|com|uk|net|org)(\/.*)?$/, '').replace(/[^a-z0-9]/g, '');
const isCareShop = (v) => CARE_SHOPS.has(shopKey(v));
const RANK = { manual: 5, ebay: 4, ai: 3, google_export: 2, default: 1 };

const SELECT = 'id, external_ref, title, margin, recommended_channels, category_id, category_source, category_flag, source_labels, batches ( category_label, term )';

async function loadCards(db, tenantId, { batchIds, ids }) {
  const cards = [];
  for (let from = 0; ; from += 1000) {
    let q = db.from('candidates').select(SELECT).eq('tenant_id', tenantId).order('id').range(from, from + 999);
    if (batchIds?.length) q = q.in('batch_id', batchIds);
    if (ids?.length) q = q.in('id', ids);
    const { data, error } = await q;
    if (error) throw new Error(`Cards not read: ${error.message}`);
    cards.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return cards;
}

function labelsOf(card) {
  const m = card.margin ?? {};
  const store = m.channel === 'store';
  const tags = store ? (m.shops ?? []) : [m.shelf?.shop, m.ebay?.shelf?.shop].filter(Boolean);
  const labels = new Set(card.source_labels ?? []);
  if (store) labels.add('Google best seller');
  for (const t of tags) labels.add(shopName(t));
  if (tags.some(isCareShop)) labels.add('Care shops');
  // The old tab names (General, Care & DIY, H & B) become labels. A store batch's label is a category, not a source.
  const b = card.batches ?? {};
  if (b.category_label && !String(b.term ?? '').startsWith('store-')) labels.add(b.category_label);
  return [...labels].filter(Boolean).sort();
}

export async function categorise(db, tenantId, { batchIds = null, ids = null, dry = false, log = console.log } = {}) {
  const tax = loadTaxonomy(TAXONOMY);
  const map = makeMapper(tax);
  const depth = (id) => (id ? tax.pathOf(id).split(' > ').length : 0);
  const ebayCsv = new Map(fs.existsSync(EBAY_CSV)
    ? parseCsv(fs.readFileSync(EBAY_CSV, 'utf8')).map((r) => [String(r.query).trim().toLowerCase(), r.category_path])
    : []);
  const cards = await loadCards(db, tenantId, { batchIds, ids });

  // First pass: eBay category, override table, export top.
  const plans = cards.map((card) => {
    const m = card.margin ?? {};
    const ref = String(card.external_ref ?? '').trim().toLowerCase();
    const store = m.channel === 'store';
    const ebayPath = m.ebay_category?.path ?? m.ebay?.ebay_category?.path ?? ebayCsv.get(ref) ?? '';
    const mapped = map(ref, ebayPath);
    const exportTop = store ? tax.idOf(m.google?.category ?? card.batches?.category_label ?? '') : null;
    const options = [];
    if (mapped.by === 'override') options.push({ id: mapped.id, source: 'manual' });
    else if (mapped.by === 'eBay category') options.push({ id: mapped.id, source: 'ebay' });
    if (exportTop) options.push({ id: exportTop, source: 'google_export' });
    options.push({ id: tax.idOf('Home & Garden'), source: 'default' });
    return { card, store, exportTop, options, flag: mapped.clash ? 'check_same_product' : null };
  });

  // Titles that no eBay category places below the top level are classified, inside their export's top for store cards.
  const need = plans.filter((p) => !p.options.some((o) => (o.source === 'ebay' || o.source === 'manual') && depth(o.id) >= 2) && p.card.category_source !== 'manual');
  const { result: ai, calls, cached } = await classify(
    // Early cards carry the query file's "# comment" in their title; the product is the part before it.
    need.map((p) => ({ key: p.card.id, title: String(p.card.title ?? p.card.external_ref).split('#')[0].trim(), withinTop: p.exportTop })),
    { tax, taxonomyFile: TAXONOMY, apiKey: envKey('ANTHROPIC_API_KEY'), model: process.env.CLASSIFY_MODEL || 'claude-sonnet-5', log },
  );
  for (const p of need) if (ai.get(p.card.id)) p.options.push({ id: ai.get(p.card.id), source: 'ai' });

  // Choose: Joseph's override table outright; otherwise the deepest answer, and on a tie the stronger evidence.
  const refine = refineFor(tax);
  const healthcare = tax.idOf('Health & Beauty > Healthcare');
  const tally = { cards: cards.length, unchanged: 0, set: 0, deeper: 0, kept_hers: 0, flagged: 0, ai_calls: calls, ai_cached: cached, ai_titles: need.length, refined: 0, care_moved: 0, care_stayed: 0 };
  const cleanTitle = (c) => String(c.title ?? c.external_ref).split('#')[0].trim();
  for (const p of plans) {
    p.best = p.options.find((o) => o.source === 'manual')
      ?? [...p.options].sort((a, b) => depth(b.id) - depth(a.id) || RANK[b.source] - RANK[a.source])[0];
    // Parts and refills filed as appliances, heating part numbers: a rule on the title, never over an override.
    if (p.best.source !== 'manual') {
      const r = refine(p.best.id, cleanTitle(p.card));
      if (r && r.id !== p.best.id) { p.best = { id: r.id, source: p.best.source, rule: r.rule }; tally.refined += 1; }
    }
  }

  // Care-shop products that landed outside Healthcare: asked one narrow question, "is this a care aid, and which?".
  // A yes moves the card into Healthcare; a no leaves it where eBay put it. Store cards keep Google's own top
  // category (their export says where Google files them), and her own choices are never asked about.
  const careShop = (c) => {
    const m = c.margin ?? {};
    const tags = m.channel === 'store' ? (m.shops ?? []) : [m.shelf?.shop, m.ebay?.shelf?.shop].filter(Boolean);
    return tags.some(isCareShop);
  };
  const careAsk = plans.filter((p) => !p.store && p.best.source !== 'manual' && p.card.category_source !== 'manual'
    && careShop(p.card) && tax.level2Of(p.best.id) !== healthcare);
  const care = await classify(
    careAsk.map((p) => ({ key: p.card.id, title: cleanTitle(p.card), withinTop: 'care' })),
    { tax, taxonomyFile: TAXONOMY, apiKey: envKey('ANTHROPIC_API_KEY'), model: process.env.CLASSIFY_MODEL || 'claude-sonnet-5', log },
  );
  tally.ai_calls += care.calls;
  const careMoves = [];
  for (const p of careAsk) {
    const id = care.result.get(p.card.id);
    if (id) { careMoves.push({ title: cleanTitle(p.card), from: tax.pathOf(p.best.id), to: tax.pathOf(id) }); p.best = { id, source: 'ai', rule: 'care aid' }; tally.care_moved += 1; }
    else tally.care_stayed += 1;
  }

  // Then decide whether it changes what the card already has.
  const writes = [];
  for (const p of plans) {
    const c = p.card;
    const best = p.best;
    const labels = labelsOf(c);
    let next = { id: c.category_id, source: c.category_source };
    if (c.category_source === 'manual') tally.kept_hers += 1;
    else if (!c.category_id) { next = best; tally.set += 1; }
    // A rule or Joseph's override table always applies, even when the new place is less deep than the old.
    else if ((best.rule || best.source === 'manual') && best.id !== c.category_id) { next = best; tally.deeper += 1; }
    else if (depth(best.id) > depth(c.category_id) || (['default', 'google_export'].includes(c.category_source) && best.id !== c.category_id && RANK[best.source] > RANK[c.category_source])) { next = best; tally.deeper += 1; }
    else tally.unchanged += 1;
    if (p.flag) tally.flagged += 1;
    const row = {
      id: c.id, title: c.title, ebay: p.options.find((o) => o.source === 'ebay') ? 'yes' : '',
      category_id: next.id, category_source: next.source,
      category_top_id: tax.topOf(next.id), category_level2_id: tax.level2Of(next.id),
      category_flag: p.flag ?? c.category_flag ?? null, source_labels: labels, path: tax.pathOf(next.id), rule: best.rule ?? '',
    };
    const changed = row.category_id !== c.category_id || row.category_source !== c.category_source
      || row.category_flag !== (c.category_flag ?? null) || labels.join('|') !== [...(c.source_labels ?? [])].sort().join('|');
    if (changed) writes.push(row);
    p.row = row;
  }

  if (!dry) {
    let done = 0;
    for (let i = 0; i < writes.length; i += 20) {
      await Promise.all(writes.slice(i, i + 20).map(async (w) => {
        const { error } = await db.from('candidates').update({
          category_id: w.category_id, category_top_id: w.category_top_id, category_level2_id: w.category_level2_id,
          category_source: w.category_source, category_flag: w.category_flag, source_labels: w.source_labels,
        }).eq('id', w.id);
        if (error) log(`  ${w.title}: category not saved, ${error.message}`);
        else done += 1;
      }));
    }
    tally.written = done;
  }
  return { tally, rows: plans.map((p) => p.row), tax, writes: writes.length, careMoves, careStayed: careAsk.filter((p) => !care.result.get(p.card.id)).map((p) => `${cleanTitle(p.card)} (${tax.pathOf(p.best.id)})`) };
}
