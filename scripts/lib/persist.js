/*
 * Writing to the database: refreshing a live batch and its coverage.
 *
 * Split out of import-gate.js when it passed nine hundred lines. Same
 * functions, same behaviour.
 */

import { ebayWeight, recostEbay } from './weight.js';

export const MARKET = ['entry', 'competition', 'headroom', 'monthly_headroom', 'sold_30d', 'avg_sold_price',
  'active_listings', 'routes', 'image_url', 'reference_url'];

// The eBay market read on a store card. Its store figures, shop link and image stay; only the eBay reading moves.
const EBAY_ON_STORE = ['entry', 'competition', 'sold_30d', 'avg_sold_price', 'active_listings', 'routes'];

/*
 * Updates the market read on the cards of one batch.
 * - The batch is found by date and term: a day holds one batch per term, so a date alone failed on any day with two.
 * - A store card that gained eBay keeps its store figures. Replacing the whole margin with the gate row's wiped its
 *   shop price, its channel and its weight.
 * - Cards she has decided keep their figures unless --refresh-decided is passed, as on a normal import.
 */
export async function refreshMarket(db, tenantId, deliveredFor, rows, coverage, term = null, refreshDecided = false) {
  let q = db
    .from('batches')
    .select('id, category_label')
    .eq('tenant_id', tenantId)
    .eq('delivered_for', deliveredFor);
  if (term) q = q.eq('term', term);
  const { data: batch, error: bErr } = await q.maybeSingle();
  if (bErr || !batch) {
    console.error(bErr
      ? `\n  More than one batch on ${deliveredFor}. Pass the --term it was imported with.\n`
      : `\n  No batch on ${deliveredFor}${term ? ` for "${term}"` : ''}. Pass the --date and --term it was imported with.\n`);
    process.exit(1);
  }

  const { data: existing, error } = await db
    .from('candidates')
    .select('id, external_ref, margin, decisions ( id )')
    .eq('batch_id', batch.id);
  if (error) {
    console.error('Candidates not read:', error.message);
    process.exit(1);
  }

  const byRef = new Map(existing.map((c) => [c.external_ref, c]));
  const fresh = new Map(rows.map((r) => [r.external_ref, r]));
  let updated = 0;
  let decidedLeft = 0;
  let storeKept = 0;

  for (const [ref, row] of fresh) {
    const c = byRef.get(ref);
    if (!c) continue;
    const decided = Array.isArray(c.decisions) ? c.decisions.length > 0 : Boolean(c.decisions);
    if (decided && !refreshDecided) { decidedLeft += 1; continue; }
    let patch;
    if (c.margin?.channel === 'store') {
      const w = ebayWeight({
        listingTitle: row.entry?.title,
        store: c.margin.postage_band,
        pageName: c.margin.cost_from?.product,
        title: row.title,
      });
      patch = Object.fromEntries(EBAY_ON_STORE.map((k) => [k, row[k]]));
      patch.margin = {
        ...c.margin,
        ebay: {
          ...recostEbay(row.margin, w).margin,
          shelf: c.margin.ebay?.shelf ?? row.margin.shelf,
          match: c.margin.ebay?.match ?? row.margin.match,
        },
      };
      storeKept += 1;
    } else {
      patch = Object.fromEntries(MARKET.map((k) => [k, row[k]]));
      // Shops came from a paid proposal at import and are not re-proposed here.
      patch.margin = { ...row.margin, shops: row.margin.shops ?? c.margin?.shops ?? null };
    }
    const { error: uErr } = await db.from('candidates').update(patch).eq('id', c.id);
    if (uErr) {
      console.error(`  ${ref}: not updated, ${uErr.message}`);
      continue;
    }
    updated += 1;
  }

  const outcomeOf = new Map(coverage.map((q) => [q.query, q]));
  const changed = existing.filter((c) => !fresh.has(c.external_ref));
  console.log(`Market read refreshed on ${updated} of ${existing.length} in "${batch.category_label}".`);
  if (storeKept) console.log(`  ${storeKept} also on the shop: eBay reading refreshed, shop figures kept`);
  if (decidedLeft) console.log(`  ${decidedLeft} already decided by her, left as they are (--refresh-decided to update them)`);
  if (changed.length) {
    console.log(`\n  ${changed.length} no longer pass on today's read, left as they were:`);
    for (const c of changed) {
      const q = outcomeOf.get(c.external_ref);
      const why = !q ? 'not in this CSV' : q.outcome === 'refused' ? `refused, ${q.reasons.join(', ') || 'no code'}` : q.outcome;
      console.log(`    ${c.external_ref.padEnd(44)} ${why}`);
    }
  }
  console.log();
}

export async function writeCoverage(db, tenantId, batchId, coverage) {
  const { error } = await db
    .from('research_queries')
    .upsert(coverage.map((c) => ({ ...c, tenant_id: tenantId, batch_id: batchId })), { onConflict: 'batch_id,query' });
  if (error) {
    console.error('Coverage not written:', error.message);
    process.exit(1);
  }
}

// Guarded so the pricing rule can be imported and tested without the importer
// running. Comparing import.meta.url to a raw argv path is a Windows trap.
