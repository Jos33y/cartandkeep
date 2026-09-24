/*
 * Takes a gate run into a batch the portal can render. The gate has written CSV
 * and snapshots since it was built and has never put a row in the database, so
 * the best evidence on this project has never reached the screen she works
 * from.
 *
 * Usage:
 *   node scripts/import-gate.js --csv=gate-forced.csv --dry
 *   node scripts/import-gate.js --csv=gate-forced.csv --term=mobility --label="Mobility and daily living aids"
 *   node scripts/import-gate.js --csv=gate-forced.csv --date=2026-09-04 --min-goods=5
 *   node scripts/import-gate.js --csv=gate-forced.csv --include-fail
 *   node scripts/import-gate.js --csv=gate-hb-1.csv --shelf=scripts/queries-hb-map.csv
 *
 * --shelf takes the map written by shelf-queries.js and attaches the shop, the
 * product link and the price actually on the shelf. With it the card shows
 * profit rather than headroom, because the goods cost stops being unknown.
 *
 * --products takes the JSON written by shelf-product.js and attaches everything
 * a listing needs: images, brand, description, features, the shop's category
 * and its stock position. A candidate then arrives ready to list, rather than
 * needing a step somebody has to remember to run.
 *
 * A date already holding a different term is refused. Pass --replace to mean it.
 *
 * Windows note: cmd does not honour a backslash line continuation. Keep the
 * command on one line or the first half runs alone, without its flags.
 *
 * One row per query, not per listing. The unit of this pipeline is a query she
 * could list against, so external_ref is the query and it stays stable across
 * reruns while the entry listing underneath it changes.
 */

import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

// The cost model is imported rather than restated. Two copies of it is how the
// project came to have a £19.50 floor in one file and a £10.24 one in another.
import { D, BANDS } from './lib/cost.js';
import { parseCsv, readShelf, readShelfProducts, shelfFor, readProducts, shopFromUrl, num, int, yes } from './lib/sources.js';
import { envKey, proposeShops } from './lib/shops.js';
import { entryKeepOf, listingsOf, refusalsOf } from './lib/refusals.js';
import { BAND_LABEL, entryRank, buildRow, listPrice, titleOf } from './lib/row.js';
import { MARKET, refreshMarket, writeCoverage } from './lib/persist.js';

export { listPrice, buildRow, parseCsv, readShelf };

// Titles carry commas, so position-based splitting corrupts every row after
// the first quoted field. Same reader as import-shortlist.

async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes('--dry');
  const replace = args.includes('--replace');
  // A market that refused is a note in the reasons column, not a product. It
  // goes nowhere by default, because a review queue holding refusals is the
  // thing that made the last four batches unusable.
  const includeFail = args.includes('--include-fail');
  // Writes research_queries for a batch already imported, and nothing else.
  const coverageOnly = args.includes('--coverage-only');
  // Updates the market read on candidates already in a batch, and nothing else.
  const refresh = args.includes('--refresh');

  const arg = (k, d = null) => args.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=') ?? d;

  const csv = arg('csv', 'gate-forced.csv');
  const slug = arg('tenant', 'cart-and-keep');
  const term = arg('term');
  const label = arg('label');
  const deliveredFor = arg('date', new Date().toISOString().slice(0, 10));
  // A market clearing above zero is not a market that can be sourced in this
  // country. The 4 September run passed eleven queries where the goods would
  // have to be bought for under £3, and a water butt tap at £1.21 is not a
  // product, it is a row taking up a decision. Pass --min-goods=0 to see them.
  // Matches the scan and the gate. The real test is the £2 a sale below.
  // No floor unless asked for: a low ceiling means cheap stock is needed, not that none exists.
  const minGoods = arg('min-goods') == null ? null : Number(arg('min-goods'));
  const shelfPath = arg('shelf');
  const shelfProductsPath = arg('shelf-products');
  const productsPath = arg('products');
  const noShops = args.includes('--no-shops');
  const allowDuplicates = args.includes('--allow-duplicates');
  const refreshDecided = args.includes('--refresh-decided');

  // A day holds one batch per term since 0087, so the term is what names the batch.
  if (!term && !dry) {
    console.error('\n  --term is required: a day holds one batch per term.\n');
    process.exit(1);
  }

  if (!fs.existsSync(csv)) {
    console.error(`\n  ${csv} not found. Run the gate first.\n`);
    process.exit(1);
  }

  const checkedAt = new Date(fs.statSync(csv).mtime).toISOString();
  const all = parseCsv(fs.readFileSync(csv, 'utf8'));
  // Early query files carried "# category, £price" comments into the query itself.
  for (const r of all) r.query = String(r.query ?? '').split('#')[0].trim();

  if (!all.length) {
    console.error(`${csv} has no rows.`);
    process.exit(1);
  }

  if (!('max_goods_cost' in all[0])) {
    console.error(`\n  ${csv} predates the cost model change and carries no`);
    console.error('  max_goods_cost column. Re-run the gate before importing,');
    console.error('  or every card will read "no figure".\n');
    process.exit(1);
  }

  const wanted = new Set(includeFail ? ['pass', 'review', 'fail'] : ['pass', 'review']);
  const passed = all.filter((r) => wanted.has((r.outcome || '').trim()));
  const live = minGoods == null ? passed : passed.filter((r) => (num(r.max_goods_cost) ?? 0) >= minGoods);
  const refused = all.length - passed.length;
  const unsourceable = passed.length - live.length;

  // Entry proved first, then what a month is worth. A market she can get into
  // at £40 a month beats one she cannot get into at £300.
  // Three spellings of the same query resolved to one 964 feedback seller's MP3
  // player, so the board carried it three times and the gate had been asked the
  // same question three times at twenty one calls each. Same listing, one row.
  const byEntry = new Map();
  const deduped = [];
  for (const r of live) {
    const id = (r.entry_item_id || '').trim();
    if (!id) { deduped.push(r); continue; }
    const prior = byEntry.get(id);
    if (!prior) { byEntry.set(id, r); deduped.push(r); continue; }
    // Keep the query that found the smaller market, which is the tighter one.
    if ((int(r.competitors) ?? 1e9) < (int(prior.competitors) ?? 1e9)) {
      deduped[deduped.indexOf(prior)] = r;
      byEntry.set(id, r);
    }
  }
  const collapsed = live.length - deduped.length;

  const shelf = readShelf(shelfPath);
  if (shelfPath) {
    const hit = deduped.filter((r) => shelf.has((r.query || '').trim())).length;
    console.log(`\n  ${shelf.size} shelf prices read, ${hit} of ${deduped.length} candidates matched`);
  }
  const products = shelfProductsPath ? readShelfProducts(shelfProductsPath) : [];
  if (products.length) {
    let found = 0;
    for (const r of deduped) {
      const q = (r.query || '').trim();
      if (shelf.has(q)) continue;
      const s = shelfFor(q, products);
      if (s) { shelf.set(q, s); found += 1; }
    }
    console.log(`  ${found} more found by product name across ${products.length} shelf products`);
  }

  // Titles first, because the proposal is one call for the whole batch.
  const pages = readProducts(productsPath);
  if (productsPath) {
    const hit = deduped.filter((r) => {
      const s = shelf.get((r.query || '').trim());
      return s?.url && pages.has(s.url);
    }).length;
    console.log(`  ${pages.size} product pages read, ${hit} of ${deduped.length} candidates matched`);
  }

  const shopsBy = noShops || coverageOnly || refresh
    ? new Map()
    : await proposeShops(deduped.map((r) => titleOf(r.query)), envKey('ANTHROPIC_API_KEY'));
  if (!noShops && !coverageOnly && !refresh && !envKey('ANTHROPIC_API_KEY')) {
    console.log('  ANTHROPIC_API_KEY not in .env.local, so no shops proposed. The card falls back to its fixed list.');
  }

  const built = deduped
    .map((r) => buildRow({
      r,
      tenant: null,
      cluster: label,
      checkedAt,
      shelf: shelf.get((r.query || '').trim()) ?? null,
      shops: shopsBy.get(titleOf(r.query)) ?? null,
      product: pages.get(shelf.get((r.query || '').trim())?.url) ?? null,
    }))
    .sort((a, b) => {
      const [ba, ra] = entryRank(a);
      const [bb, rb] = entryRank(b);
      return ba - bb || rb - ra || (b.monthly_headroom ?? 0) - (a.monthly_headroom ?? 0);
    });

  // The shelf is a lead, not a cost, so nothing is held back on its price.
  const rows = built;

  const sent = new Set(rows.map((r) => r.external_ref));
  const held = new Set();
  const netBy = new Map(built.map((r) => [r.external_ref, r.margin.net]));
  const seen = new Set();
  const coverage = [];
  for (const r of all) {
    if (seen.has(r.query)) continue;
    seen.add(r.query);
    const codes = refusalsOf(r);
    const outcome = sent.has(r.query) ? 'sent'
      : held.has(r.query) ? 'held_back'
        : !passed.includes(r) ? 'refused'
          : !live.includes(r) ? 'no_buy_price'
            : 'duplicate';
    const s = shelf.get((r.query || '').trim());
    coverage.push({
      query: r.query,
      outcome,
      reason: outcome === 'refused' ? (codes[0] ?? 'unknown') : null,
      reasons: codes,
      shelf_product: s?.product ?? null,
      shelf_price: s?.price ?? null,
      competitors: int(r.competitors),
      median_price: num(r.median_price),
      market_per_month: int(r.observed_units_per_month),
      entry_feedback: int(r.entry_seller_feedback),
      max_goods: num(r.max_goods_cost),
      net: netBy.get(r.query) ?? null,
      checked_at: checkedAt,
    });
  }

  console.log(`\n${csv}, read at ${checkedAt.slice(0, 16).replace('T', ' ')}`);
  console.log(`  ${all.length} queries, ${live.length} carried through`);
  console.log(`  ${refused} refused by the gate`
    + (minGoods == null ? '' : `, ${unsourceable} passed but nothing can be bought under £${minGoods.toFixed(2)}`));
  if (collapsed) console.log(`  ${collapsed} folded into another query, same listing underneath`);
  console.log(`  ${rows.filter((r) => r.entry?.proved).length} where a small seller is selling, `
    + `${rows.filter((r) => r.entry && !r.entry.proved).length} selling but only to bigger accounts (*)\n`);

  for (const r of rows.slice(0, 20)) {
    const pay = r.margin.max_goods_cost;
    const ev = r.entry
      ? `${String(r.entry.seller_feedback).padStart(6)}fb at £${(r.entry.price ?? 0).toFixed(2)}`
        + (r.entry.proved ? '  ' : ' *')
      : '     nobody recent selling';
    const mt = r.margin.match;
    const same = !mt ? '' : mt.level === 'same_product_different_pack'
      ? `  shelf ${mt.shelf.n}, eBay ${mt.ebay.n}`
      : `  ${mt.level.replace(/_/g, ' ')}`;
    console.log(`  £${String((pay ?? 0).toFixed(2)).padStart(6)}  ${ev}  ${r.title.slice(0, 46)}${same}`);
  }
  if (rows.length > 20) console.log(`  ... and ${rows.length - 20} more`);
  console.log();

  // Nothing above this line touches the database. A dry run is a read of a CSV
  // and a table on the screen, so it must work with no driver and no
  // credentials, and the first version connected before it parsed anything.
  const tally = (key) => Object.entries(coverage.reduce((o, c) => {
    if (c[key]) o[c[key]] = (o[c[key]] ?? 0) + 1;
    return o;
  }, {})).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(', ');
  console.log(`  Coverage: ${tally('outcome')}`);
  console.log(`  Refused on: ${tally('reason') || 'nothing'}\n`);

  if (dry) {
    console.log('Dry run, nothing written.\n');
    return;
  }

  if (!rows.length && !coverageOnly && !refresh) {
    console.error('Nothing to import. Batch not created.\n');
    process.exit(1);
  }

  const { connect } = await import('../pipeline/lib/db.js');
  const { db } = await connect();

  const { data: tenant } = await db
    .from('tenants')
    .select('id, slug, name')
    .eq('slug', slug)
    .maybeSingle();

  if (!tenant) {
    console.error(`Tenant "${slug}" not found.`);
    process.exit(1);
  }

  for (const r of rows) r.tenant_id = tenant.id;

  if (refresh) {
    await refreshMarket(db, tenant.id, deliveredFor, rows, coverage);
    return;
  }

  if (coverageOnly) {
    const { data: batch } = await db
      .from('batches')
      .select('id, term, category_label')
      .eq('tenant_id', tenant.id)
      .eq('delivered_for', deliveredFor)
      .eq('term', term)
      .maybeSingle();
    if (!batch) {
      console.error(`\n  No batch on ${deliveredFor}. Pass the --date it was imported with.\n`);
      process.exit(1);
    }
    await writeCoverage(db, tenant.id, batch.id, coverage);
    console.log(`Coverage written for "${batch.category_label}", ${coverage.length} queries.\n`);
    return;
  }

  // A date already holding a different term is refused rather than taken over.
  // On 14 August a split command landed a massage import on the mobility batch
  // and removed fifty candidates.
  const { data: existing } = await db
    .from('batches')
    .select('id, term, category_label, candidate_count')
    .eq('tenant_id', tenant.id)
    .eq('delivered_for', deliveredFor)
    .eq('term', term)
    .maybeSingle();

  if (existing && existing.term && term && existing.term !== term && !replace) {
    console.error(`\n  ${deliveredFor} already holds "${existing.category_label}"`);
    console.error(`  (${existing.term}, ${existing.candidate_count} candidates).`);
    console.error('  Pick another date, or pass --replace if it was meant.\n');
    process.exit(1);
  }

  // A query already in another batch is the same card twice in her queue.
  // This batch's own rows are kept, so a re-import still refreshes them.
  if (!allowDuplicates) {
    const { data: prior, error: pErr } = await db
      .from('candidates')
      .select('external_ref, batch_id')
      .eq('tenant_id', tenant.id)
      .in('external_ref', rows.map((r) => r.external_ref));
    if (pErr) {
      console.error(`Duplicate check failed, nothing imported: ${pErr.message}\n`);
      process.exit(1);
    }
    const elsewhere = new Set((prior ?? []).filter((c) => c.batch_id !== existing?.id).map((c) => c.external_ref));
    // A different query can land on the same eBay listing: three Flexitol cards, one seller.
    const listingIds = rows.map((r) => r.entry?.item_id).filter(Boolean);
    if (listingIds.length) {
      const { data: same, error: lErr } = await db
        .from('candidates')
        .select('batch_id, entry')
        .eq('tenant_id', tenant.id)
        .in('entry->>item_id', listingIds);
      if (lErr) {
        console.error(`Duplicate check failed, nothing imported: ${lErr.message}\n`);
        process.exit(1);
      }
      const taken = new Set((same ?? []).filter((c) => c.batch_id !== existing?.id).map((c) => c.entry?.item_id));
      for (const r of rows) if (r.entry?.item_id && taken.has(r.entry.item_id)) elsewhere.add(r.external_ref);
    }
    if (elsewhere.size) {
      console.log(`  ${elsewhere.size} already in another batch, by query or by listing, not imported again:`);
      for (const ref of elsewhere) console.log(`    ${ref}`);
      for (const c of coverage) if (elsewhere.has(c.query)) c.outcome = 'duplicate';
      rows.splice(0, rows.length, ...rows.filter((r) => !elsewhere.has(r.external_ref)));
      console.log();
    }
    if (!rows.length) {
      console.error('Everything that passed is already in her queue. Batch not created.\n');
      process.exit(1);
    }
  }

  const { data: batch, error: bErr } = await db
    .from('batches')
    .upsert(
      {
        tenant_id: tenant.id,
        delivered_for: deliveredFor,
        term,
        category_label: label,
        status: 'delivered',
        delivered_at: new Date().toISOString(),
        sources_used: ['ebay_browse'],
        candidate_count: rows.length,
      },
      { onConflict: 'tenant_id,delivered_for,term' },
    )
    .select()
    .single();

  if (bErr) {
    console.error('Batch failed:', bErr.message);
    process.exit(1);
  }

  // A card she has already decided keeps the figures she decided on. --refresh-decided updates them anyway.
  if (!refreshDecided) {
    const { data: decided, error: dErr } = await db
      .from('candidates')
      .select('external_ref, decisions!inner ( id )')
      .eq('batch_id', batch.id)
      .in('external_ref', rows.map((r) => r.external_ref));
    if (dErr) {
      console.error(`Decision check failed, nothing imported: ${dErr.message}\n`);
      process.exit(1);
    }
    const held = new Set((decided ?? []).map((c) => c.external_ref));
    if (held.size) {
      console.log(`  ${held.size} already decided by her, left exactly as they are`);
      rows.splice(0, rows.length, ...rows.filter((r) => !held.has(r.external_ref)));
    }
  }

  const { error: cErr } = rows.length
    ? await db.from('candidates').upsert(rows.map((r) => ({ ...r, batch_id: batch.id })), { onConflict: 'batch_id,external_ref' })
    : { error: null };

  if (cErr) {
    console.error('Candidate upsert failed:', cErr.message);
    process.exit(1);
  }

  // A second import into the same date adds to the batch, so the count is read back, not assumed.
  const { count: total, error: nErr } = await db
    .from('candidates')
    .select('external_ref', { count: 'exact', head: true })
    .eq('batch_id', batch.id);
  if (nErr) console.error(`Candidate count not refreshed: ${nErr.message}`);
  else if (total !== rows.length) {
    const { error: uErr } = await db.from('batches').update({ candidate_count: total }).eq('id', batch.id);
    if (uErr) console.error(`Candidate count not refreshed: ${uErr.message}`);
  }

  await writeCoverage(db, tenant.id, batch.id, coverage);

  const { error: sErr, count } = await db
    .from('tenant_sources')
    .update({ last_run_at: new Date().toISOString(), last_status: 'ok', last_error: null }, { count: 'exact' })
    .eq('tenant_id', tenant.id)
    .eq('source_id', 'ebay_browse');

  if (sErr) console.error(`Source status not recorded: ${sErr.message}`);
  else if (!count) console.error('No ebay_browse row in tenant_sources. Source panel will read Not run.');

  console.log(`Batch ${deliveredFor} delivered: ${rows.length} imported this run, ${total ?? rows.length} in the batch.\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
