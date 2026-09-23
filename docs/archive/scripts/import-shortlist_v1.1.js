/*
 * Takes the Terapeak shortlist into a batch the portal can render. Writes the
 * same table run.js writes, so the ledger has one code path and not two.
 *
 * Usage:
 *   node scripts/import-shortlist.js --dry
 *   node scripts/import-shortlist.js --date=2026-08-10
 *   node scripts/import-shortlist.js --all       every listable product
 *
 * Two tiers by default. Stock candidates hold against their own history.
 * Slipping ones are proven and still selling but below the hold threshold, and
 * they are hers to rule on rather than ours to hide.
 */

import fs from 'node:fs';
import path from 'node:path';
import { connect } from '../pipeline/lib/db.js';
import { rankScore } from '../pipeline/lib/rank.js';

// Titles carry commas, so position-based splitting corrupts every row after
// the first quoted field.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; } else quoted = false;
      } else field += ch;
      continue;
    }

    if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (ch !== '\r') field += ch;
  }

  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return [];

  const header = rows[0].map((h) => h.replace(/^\uFEFF/, '').trim());
  return rows.slice(1)
    .filter((r) => r.length === header.length)
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}

const num = (v) => {
  if (v == null || String(v).trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const int = (v) => {
  const n = num(v);
  return n == null ? null : Math.round(n);
};

// Every merged file, keyed by eBay item id, so a product found under one term
// still finds its series if the shortlist recorded a different term.
function loadSeries(mergedDir) {
  const byItem = new Map();
  if (!fs.existsSync(mergedDir)) return byItem;

  const files = fs.readdirSync(mergedDir)
    .filter((f) => f.endsWith('_merged.csv') && !f.startsWith('competitor'));

  for (const file of files) {
    const rows = parseCsv(fs.readFileSync(path.join(mergedDir, file), 'utf8'));
    for (const r of rows) {
      const id = r.item_id?.trim();
      if (!id) continue;

      const series = Object.keys(r)
        .filter((k) => /^units_\d{4}-\d{2}$/.test(k))
        .map((k) => k.slice(6))
        .sort()
        .map((w) => ({ window: w, units: int(r[`units_${w}`]), price: num(r[`price_${w}`]) }))
        .filter((p) => p.units != null || p.price != null);

      // Later files win only if they carry more windows.
      const held = byItem.get(id);
      if (!held || series.length > held.length) byItem.set(id, series);
    }
  }

  return byItem;
}

const HOLD_FLOOR = 0.6;

// The absolute margin gate, same figure the analysis uses. Admission there is
// on the optimistic large letter bound, so the shortlist carries rows below
// this at the displayed small parcel band.
const GATE_ABS = 4.00;

// Proven across every window and still selling, but running below its own
// average. Not a buy today, not a reject either.
const isSlipping = (r) => r.pattern === 'evergreen'
  && r.stock_candidate?.trim() !== 'yes'
  && num(r.hold) != null
  && num(r.hold) < HOLD_FLOOR;

function buildRow({ r, series, tenant, batchId, tier }) {
  const price = num(r.price);
  const headroom = num(r.headroom);
  const recentUnits = int(r.recent_units);
  const bulky = r.bulky?.trim() === 'yes';

  // The shortlist headroom is the small parcel figure, which is the
  // conservative display. Bulky means the real band is worse than that.
  const band = bulky ? 'medium_parcel' : 'small_parcel';

  const facts = {
    headroom,
    hold: num(r.hold),
    recent_units: recentUnits,
    same_sku_sellers: int(r.same_sku_sellers),
    margin: { band },
  };

  // Scored only where the components exist to score with. On a single window
  // there is no trend, no sell-through and no competition read, so four
  // components fire and one of them, same_sku, points the wrong way: many
  // sellers on one SKU is competition for a stock buy and a findable supplier
  // for a dropship listing. A number built on that is asserted, not computed.
  const scorable = facts.hold != null;
  const ranked = scorable
    ? rankScore(facts, tenant.scoring?.rank_weights)
    : { score: null, component_count: 0, breakdown: {} };

  // What the product would be worth in a month at the going rate. No weights,
  // nothing hidden, and she can check it against the two figures beside it.
  const monthly = recentUnits != null && headroom != null
    ? Math.round(recentUnits * headroom * 100) / 100
    : null;
  const latest = series.at(-1);

  return {
    tenant_id: tenant.id,
    batch_id: batchId,
    external_ref: r.item_id,
    title: r.title,
    category: r.term,
    // image_url and supplier_url are not ours. An upsert that names them writes
    // null over whatever enrichment or sourcing already put there.
    reference_url: r.item_url || null,
    classification: r.pattern || 'unknown',
    tier,

    score: ranked.score,
    component_count: ranked.component_count,
    breakdown: ranked.breakdown,
    monthly_headroom: monthly,

    // One source, so source agreement is not a question this route can answer.
    confidence: null,
    signal_count: 1,
    signals: [],

    // No supplier quote yet, so there is no net. The cost lines are carried
    // individually because who pays each one depends on how the product is
    // fulfilled: on a dropship order the supplier posts it, so the postage line
    // is not hers.
    margin: {
      sale_price: price,
      headroom,
      platform_fee: num(r.platform_fee),
      ads: num(r.ads),
      postage: num(r.postage),
      packaging: num(r.packaging),
      cost_to_sell: price != null && headroom != null
        ? Math.round((price - headroom) * 100) / 100
        : null,
      band,
      headroom_band: r.postage_band || 'small_parcel',
      landed_cost: null,
      cost_source: 'not_quoted',
      net: null,
      net_pct: null,
    },

    headroom,
    hold: num(r.hold),
    same_sku_sellers: int(r.same_sku_sellers),
    bulky,
    routes: r.routes || null,
    window_series: series,

    sold_30d: recentUnits,
    avg_sold_price: price,
    active_listings: null,
    sell_through: null,
    trend: null,
    seller_concentration: null,
    window_start: latest ? `${latest.window}-01` : null,
    window_end: null,

    recommended_channels: price != null && price > 20 ? ['store', 'ebay'] : ['ebay', 'tiktok'],
    recommended_volume: null,
    analyst_note: null,
  };
}

function nextMonday(from = new Date()) {
  const d = new Date(from);
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
  return d.toISOString().slice(0, 10);
}

async function main() {
  const { db, E } = await connect();
  const args = process.argv.slice(2);
  const dry = args.includes('--dry');
  const all = args.includes('--all');
  const keepAmber = args.includes('--amber');
  const slug = args.find((a) => a.startsWith('--tenant='))?.split('=')[1]
    || E.VITE_TENANT_SLUG || 'cart-and-keep';
  const deliveredFor = args.find((a) => a.startsWith('--date='))?.split('=')[1] || nextMonday();
  const dropDir = args.find((a) => a.startsWith('--dir='))?.split('=')[1] || E.DROP_DIR || 'drops';

  const mergedDir = path.join(dropDir, 'merged');
  const shortlistPath = path.join(mergedDir, 'shortlist.csv');

  if (!fs.existsSync(shortlistPath)) {
    console.error(`No shortlist at ${shortlistPath}.`);
    process.exit(1);
  }

  const { data: tenant, error: tErr } = await db
    .from('tenants')
    .select('id, slug, name, scoring')
    .eq('slug', slug)
    .single();

  if (tErr || !tenant) {
    console.error(`Tenant "${slug}" not found.`);
    process.exit(1);
  }

  const shortlist = parseCsv(fs.readFileSync(shortlistPath, 'utf8'));
  const live = shortlist.filter((r) => r.status === 'listable' && !r.dropped_reason?.trim());
  const stock = live.filter((r) => r.stock_candidate?.trim() === 'yes');
  const slipping = live.filter(isSlipping);
  // Below the gate at small parcel. These were admitted on the optimistic
  // large letter bound, and in a category of frames and stools almost none of
  // them ship flat. Kept in the shortlist, out of the batch unless asked for.
  const amber = live.filter((r) => (num(r.headroom) ?? 0) < GATE_ABS);
  const solid = keepAmber ? live : live.filter((r) => (num(r.headroom) ?? 0) >= GATE_ABS);

  // With one window there is no stock verdict, so tiering would select nothing
  // and the batch would be empty. Everything that cleared the gate goes.
  const tiered = [...stock, ...slipping];
  const chosen = all || !tiered.length
    ? solid
    : solid.filter((r) => tiered.includes(r));

  // A row with no hold figure was never tested against its own history, so it
  // is neither stock nor slipping. Calling it stock would assert a verdict the
  // analysis refused to compute on a single window.
  const tierOf = (r) => {
    if (r.stock_candidate?.trim() === 'yes') return 'stock';
    if (isSlipping(r)) return 'slipping';
    return 'candidate';
  };

  const seriesByItem = loadSeries(mergedDir);

  console.log(`\n${tenant.name}, batch for ${deliveredFor}`);
  console.log(`  ${shortlist.length} rows in shortlist, ${live.length} live`);
  console.log(`  ${stock.length} stock candidates, ${slipping.length} proven but slipping`);
  if (amber.length) {
    console.log(`  ${amber.length} below £${GATE_ABS.toFixed(2)} at small parcel${keepAmber ? ', included (--amber)' : ', held back'}`);
  }
  console.log(`  importing ${chosen.length}${all ? ' (--all)' : ''}`);

  if (!tiered.length) {
    console.log('  no stock verdict in the shortlist. Needs three windows, so every');
    console.log('  row imports as a candidate for her to rule on.');
  }

  const withoutSeries = chosen.filter((r) => !seriesByItem.get(r.item_id)?.length).length;
  if (withoutSeries) console.log(`  ${withoutSeries} without a window series`);

  const rows = chosen
    .map((r) => buildRow({
      r, series: seriesByItem.get(r.item_id) ?? [], tenant, batchId: null, tier: tierOf(r),
    }))
    .sort((a, b) => {
      const rank = { stock: 0, candidate: 1, slipping: 2 };
      if (a.tier !== b.tier) return rank[a.tier] - rank[b.tier];
      if (a.score != null && b.score != null && a.score !== b.score) return b.score - a.score;
      return (b.monthly_headroom ?? 0) - (a.monthly_headroom ?? 0)
        || (b.headroom ?? 0) - (a.headroom ?? 0);
    });

  console.log();
  for (const r of rows.slice(0, dry ? 20 : 5)) {
    console.log(
      `  £${String(Math.round(r.monthly_headroom ?? 0)).padStart(5)}/mo  ${r.tier.padEnd(9)}  £${(r.headroom ?? 0).toFixed(2)}  ${String(r.sold_30d ?? 0).padStart(3)}u  ${r.title.slice(0, 42)}`,
    );
  }
  console.log();

  if (dry) {
    console.log('Dry run, nothing written.\n');
    return;
  }

  if (!rows.length) {
    console.error('Nothing to import. Batch not created.\n');
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
        sources_used: ['terapeak_export'],
        candidate_count: rows.length,
      },
      { onConflict: 'tenant_id,delivered_for' },
    )
    .select()
    .single();

  if (bErr) {
    console.error('Batch failed:', bErr.message);
    process.exit(1);
  }

  // Upsert rather than replace. A rerun used to delete the batch's candidates
  // and cascade her decisions away with them.
  const { error: cErr } = await db
    .from('candidates')
    .upsert(rows.map((r) => ({ ...r, batch_id: batch.id })), { onConflict: 'batch_id,external_ref' });

  if (cErr) {
    console.error('Candidate upsert failed:', cErr.message);
    process.exit(1);
  }

  // Anything that dropped out of the shortlist goes, unless she has already
  // ruled on it. A decided row is a record and stays.
  const keep = rows.map((r) => r.external_ref);
  const { data: stale } = await db
    .from('candidates')
    .select('id, title, decisions ( action )')
    .eq('batch_id', batch.id)
    .not('external_ref', 'in', `(${keep.join(',')})`);

  const removable = (stale ?? []).filter((c) => {
    const d = Array.isArray(c.decisions) ? c.decisions[0] : c.decisions;
    return !d;
  });

  if (removable.length) {
    await db.from('candidates').delete().in('id', removable.map((c) => c.id));
    console.log(`  ${removable.length} dropped from the batch`);
  }

  const held = (stale ?? []).length - removable.length;
  if (held) console.log(`  ${held} no longer on the shortlist but kept, already decided`);

  // Without this the portal shows Terapeak as never run on the same morning the
  // batch it produced lands in front of her.
  const { error: sErr, count } = await db
    .from('tenant_sources')
    .update({ last_run_at: new Date().toISOString(), last_status: 'ok', last_error: null }, { count: 'exact' })
    .eq('tenant_id', tenant.id)
    .eq('source_id', 'terapeak_export');

  if (sErr) console.error(`Source status not recorded: ${sErr.message}`);
  else if (!count) console.error('No terapeak_export row in tenant_sources. Source panel will read Not run.');

  console.log(`Batch ${deliveredFor} delivered with ${rows.length} candidates.\n`);
}

main();
