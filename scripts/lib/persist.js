/*
 * Writing to the database: refreshing a live batch and its coverage.
 *
 * Split out of import-gate.js when it passed nine hundred lines. Same
 * functions, same behaviour.
 */

export const MARKET = ['entry', 'competition', 'headroom', 'monthly_headroom', 'sold_30d', 'avg_sold_price',
  'active_listings', 'routes', 'image_url', 'reference_url'];

export async function refreshMarket(db, tenantId, deliveredFor, rows, coverage) {
  const { data: batch } = await db
    .from('batches')
    .select('id, category_label')
    .eq('tenant_id', tenantId)
    .eq('delivered_for', deliveredFor)
    .maybeSingle();
  if (!batch) {
    console.error(`\n  No batch on ${deliveredFor}. Pass the --date it was imported with.\n`);
    process.exit(1);
  }

  const { data: existing, error } = await db
    .from('candidates')
    .select('id, external_ref, margin')
    .eq('batch_id', batch.id);
  if (error) {
    console.error('Candidates not read:', error.message);
    process.exit(1);
  }

  const byRef = new Map(existing.map((c) => [c.external_ref, c]));
  const fresh = new Map(rows.map((r) => [r.external_ref, r]));
  let updated = 0;

  for (const [ref, row] of fresh) {
    const c = byRef.get(ref);
    if (!c) continue;
    const patch = Object.fromEntries(MARKET.map((k) => [k, row[k]]));
    // Shops came from a paid proposal at import and are not re-proposed here.
    patch.margin = { ...row.margin, shops: row.margin.shops ?? c.margin?.shops ?? null };
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
