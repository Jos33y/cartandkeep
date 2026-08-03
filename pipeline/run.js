import { connect } from './lib/db.js';
import { collect } from './sources/index.js';
import { pointsUsed } from './sources/cjDropshipping.js';
import { groupSignals, median } from './lib/match.js';
import { computeMargin, shippingBand } from './lib/margin.js';
import { loadBands } from './lib/rates.js';
import { detectBrand } from './lib/brand.js';
import { evaluateGates } from './lib/gates.js';
import { rankScore } from './lib/rank.js';
import { computeConfidence, classify, isExcluded } from './lib/scoring.js';

function nextMonday(from = new Date()) {
  const d = new Date(from);
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
  return d.toISOString().slice(0, 10);
}

// Credentials never live in the database, only a pointer to the env var holding
// them. A leaked row must not be a leaked key.
function credentialsFor(ref, E) {
  if (!ref) return {};
  const out = {};
  for (const [alias, name] of Object.entries(JSON.parse(ref))) {
    out[alias] = E[name];
  }
  return out;
}

async function main() {
  const { db, E } = await connect();
  const args = process.argv.slice(2);
  const dry = args.includes('--dry');
  const debug = args.includes('--debug');
  const slug = args.find((a) => a.startsWith('--tenant='))?.split('=')[1]
    || E.VITE_TENANT_SLUG || 'cart-and-keep';
  const deliveredFor = args.find((a) => a.startsWith('--date='))?.split('=')[1] || nextMonday();

  // Where exports land is a property of the machine, not of the client, so a
  // tenant row only overrides it.
  const dropDir = E.DROP_DIR || 'drops';

  const { data: tenant, error: tErr } = await db
    .from('tenants')
    .select('id, slug, name, marketplace, currency, fees, scoring, research')
    .eq('slug', slug)
    .single();

  if (tErr || !tenant) {
    console.error(`Tenant "${slug}" not found.`);
    process.exit(1);
  }

  // Without a cost schedule every optional line resolves to zero and the margin
  // comes out flattering. That is the failure mode this pipeline exists to
  // avoid, so it is a preflight error rather than a silent default.
  const configured = tenant.scoring?.costs;
  if (
    !configured?.shipping?.carrier
    || !configured?.shipping?.service
    || configured.ads_pct == null
    || !configured.returns
    || configured.goods_pct_estimate == null
  ) {
    console.error(
      'Missing scoring.costs on the tenant. Needs shipping.carrier, shipping.service, shipping.packaging, ads_pct, returns and goods_pct_estimate.',
    );
    process.exit(1);
  }

  // Priced on the batch date, not today, so a rerun of an old Monday prices that
  // Monday's tariff.
  const bands = await loadBands(db, {
    carrier: configured.shipping.carrier,
    service: configured.shipping.service,
    on: deliveredFor,
  });

  if (!bands) {
    console.error(
      `No ${configured.shipping.carrier} ${configured.shipping.service} rate card in force on ${deliveredFor}. Insert into rate_cards.`,
    );
    process.exit(1);
  }

  const costs = { ...configured, shipping: { ...configured.shipping, bands } };
  const brandConfig = tenant.research?.brands ?? {};

  const gateConfig = {
    ...(tenant.scoring?.gates ?? {}),
    // Older config called this min_signals. Accept both, prefer the gate name.
    min_sources: tenant.scoring?.gates?.min_sources ?? tenant.scoring?.min_signals ?? 1,
  };

  const { data: tenantSources } = await db
    .from('tenant_sources')
    .select('id, source_id, enabled, weight, config, credential_ref')
    .eq('tenant_id', tenant.id)
    .eq('enabled', true);

  if (!tenantSources?.length) {
    console.error(`No enabled sources for ${slug}. Insert rows into tenant_sources.`);
    process.exit(1);
  }

  const query = {
    terms: tenant.research?.terms ?? [],
    categories: tenant.research?.categories ?? [],
    marketplace: tenant.marketplace,
  };

  const bandLine = Object.entries(bands)
    .map(([b, p]) => `${b} £${p.toFixed(2)}`)
    .join(', ');

  console.log(`\n${tenant.name}, batch for ${deliveredFor}`);
  console.log(`  ${tenantSources.length} source(s) enabled, ${query.terms.length} terms`);
  console.log(`  postage ${configured.shipping.service}: ${bandLine}`);
  console.log(`  drops: ${dropDir}\n`);

  const runStatus = [];
  const collected = await collect({
    tenant,
    tenantSources: tenantSources.map((ts) => ({
      ...ts,
      credential_ref: credentialsFor(ts.credential_ref, E),
      config: { dropDir, ...(ts.config ?? {}), debug },
    })),
    query,
    onSourceResult: async (r) => {
      runStatus.push(r);
      const mark = r.status === 'ok' ? 'ok  ' : 'FAIL';
      console.log(`  ${mark} ${r.sourceId}${r.count != null ? ` (${r.count} signals)` : ''}${r.error ? ` ${r.error}` : ''}`);
    },
  });

  // Record what each source did, so a slow decline shows up in the data rather
  // than only in a terminal nobody kept.
  if (!dry) {
    await Promise.all(
      runStatus.map((r) =>
        db.from('tenant_sources')
          .update({
            last_run_at: new Date().toISOString(),
            last_status: r.status,
            last_error: r.error ?? null,
          })
          .eq('tenant_id', tenant.id)
          .eq('source_id', r.sourceId),
      ),
    );
  }

  const cjPoints = pointsUsed();
  if (cjPoints) {
    console.log(`\n  CJ points: ${cjPoints.usedToday} used today, ${cjPoints.remaining} remaining of ${cjPoints.total}`);
  }

  const okSources = runStatus.filter((r) => r.status === 'ok').map((r) => r.sourceId);
  if (!collected.length) {
    console.error('\nNo signals collected. Nothing to deliver.\n');
    process.exit(1);
  }

  const groups = groupSignals(collected);
  console.log(`\n  ${groups.length} distinct products after matching`);

  if (debug) {
    console.log('\n  --- grouping ---');
    for (const g of groups) {
      const titles = [...new Set(g.signals.map((s) => s.sourceId))];
      console.log(`\n  [${g.signals.length} signals from ${titles.join(', ')}]`);
      console.log(`  key: ${g.key}`);
      console.log(`  title: ${g.title}`);
      console.log(`  prices: ${JSON.stringify(g.prices)}  costs: ${JSON.stringify(g.landedCosts)}`);
      for (const t of g.mergedTitles ?? []) console.log(`    + ${t}`);
    }
    console.log('\n  --- end grouping ---\n');
  }

  const rows = [];
  const dropped = { excluded: 0, noPrice: 0, noMargin: 0 };
  const gateFails = new Map();
  const skippedGates = new Map();

  for (const g of groups) {
    if (isExcluded(g.title, tenant.research)) {
      dropped.excluded += 1;
      continue;
    }

    const salePrice = median(g.prices);
    const landedCost = median(g.landedCosts);

    // A price is required. A cost is not, because computeMargin will estimate
    // one and label it, which is a stated assumption rather than a silent zero.
    if (!Number.isFinite(salePrice)) {
      dropped.noPrice += 1;
      continue;
    }

    const channel = salePrice > 20 ? 'store' : 'ebay';
    const band = shippingBand(g.dimensionsMm, g.weightG);

    const margin = computeMargin({
      salePrice,
      landedCost,
      channel,
      band,
      category: g.category,
      fees: tenant.fees,
      costs,
    });

    if (!margin) {
      dropped.noMargin += 1;
      continue;
    }

    const { confidence, signalCount } = computeConfidence({
      signals: g.signals,
      weights: tenant.scoring?.weights,
    });

    // The sources gate asks how many independent sources agree, so it counts
    // distinct sources. Three signals from one source is still one opinion.
    const sourceCount = new Set(g.signals.map((s) => s.sourceId)).size;

    // Every merged title is screened, not just the longest one, and a clean
    // screen is false rather than null so the gate passes instead of skipping.
    const brandFlag = [g.title, ...(g.mergedTitles ?? [])]
      .map((t) => detectBrand(t, brandConfig))
      .find(Boolean) ?? false;

    // Demand metrics arrive with the demand sources. Absent, their gates skip
    // and their components drop out of the score, which the bar then shows.
    const candidate = {
      margin,
      signal_count: sourceCount,
      sell_through: g.sellThrough ?? null,
      sold30: g.sold30 ?? null,
      trend: g.trend ?? null,
      active_listings: g.activeListings ?? null,
      seller_concentration: g.sellerConcentration ?? null,
      stock: g.stock ?? null,
      lead_time_days: g.leadTimeDays ?? null,
      brand_flag: brandFlag,
    };

    const verdict = evaluateGates(candidate, gateConfig);
    for (const key of verdict.skipped) skippedGates.set(key, (skippedGates.get(key) ?? 0) + 1);

    if (!verdict.ok) {
      for (const f of verdict.failed) gateFails.set(f.gate, (gateFails.get(f.gate) ?? 0) + 1);
      continue;
    }

    const ranked = rankScore(candidate, tenant.scoring?.rank_weights);

    rows.push({
      tenant_id: tenant.id,
      external_ref: Object.values(g.externalRefs)[0] ?? g.key,
      title: g.title,
      category: g.category,
      image_url: g.imageUrl,
      supplier_url: g.supplierUrl,
      classification: classify({ signals: g.signals }),

      score: ranked.score,
      component_count: ranked.component_count,
      breakdown: ranked.breakdown,

      confidence,
      signal_count: signalCount,
      signals: g.signals.map(({ source_id, signal, value, weight }) => ({
        source_id, signal, value, weight,
      })),
      margin,

      sold_30d: candidate.sold30,
      avg_sold_price: g.avgSoldPrice ?? null,
      active_listings: candidate.active_listings,
      sell_through: candidate.sell_through,
      trend: candidate.trend,
      seller_concentration: candidate.seller_concentration,
      window_start: g.windowStart ?? null,
      window_end: g.windowEnd ?? null,

      recommended_channels: channel === 'store' ? ['store', 'ebay'] : ['ebay', 'tiktok'],
      recommended_volume: null,
      analyst_note: null,
    });
  }

  // Ranking decides the order she reviews in. Confidence breaks ties, because
  // between two equal scores the one more sources agree on comes first.
  rows.sort((a, b) => b.score - a.score || b.confidence - a.confidence);
  const capped = rows.slice(0, tenant.research?.max_candidates ?? 100);

  console.log(`  ${capped.length} candidates pass`);
  console.log(`  dropped: ${dropped.excluded} out of category, ${dropped.noPrice} no price, ${dropped.noMargin} no computable margin`);

  if (gateFails.size) {
    const detail = [...gateFails.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(', ');
    console.log(`  gates failed: ${detail}`);
  }

  // A gate skipped on every candidate is a missing data source, not a pass.
  if (skippedGates.size) {
    const detail = [...skippedGates.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(', ');
    console.log(`  gates skipped for missing data: ${detail}`);
  }
  console.log();

  if (dry) {
    console.log('Dry run, nothing written.\n');
    for (const r of capped.slice(0, 5)) {
      console.log(
        `  ${String(r.score).padStart(3)}  ${String(r.component_count)}c  £${r.margin.net.toFixed(2)}  ${(r.margin.net_pct * 100).toFixed(0)}%  ${r.title.slice(0, 52)}`,
      );
    }
    console.log();
    return;
  }

  if (!capped.length) {
    console.error('Nothing passed the gates. Batch not created.\n');
    process.exit(1);
  }

  const { data: batch, error: bErr } = await db
    .from('batches')
    .upsert(
      {
        tenant_id: tenant.id,
        delivered_for: deliveredFor,
        status: 'delivered',
        delivered_at: new Date().toISOString(),
        sources_used: okSources,
        candidate_count: capped.length,
      },
      { onConflict: 'tenant_id,delivered_for' },
    )
    .select()
    .single();

  if (bErr) {
    console.error('Batch failed:', bErr.message);
    process.exit(1);
  }

  // Rerunning the same Monday replaces its candidates. Decisions cascade with
  // them, which is intended: a rebuilt batch is a different batch.
  await db.from('candidates').delete().eq('batch_id', batch.id);

  const { error: cErr } = await db
    .from('candidates')
    .insert(capped.map((r) => ({ ...r, batch_id: batch.id })));

  if (cErr) {
    console.error('Candidate insert failed:', cErr.message);
    process.exit(1);
  }

  console.log(`Batch ${deliveredFor} delivered with ${capped.length} candidates.\n`);
}

main();
