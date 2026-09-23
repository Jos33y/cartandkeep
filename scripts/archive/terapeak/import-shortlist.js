/*
 * Takes the Terapeak shortlist into a batch the portal can render. Writes the
 * same table run.js writes, so the ledger has one code path and not two.
 *
 * Usage:
 *   node scripts/import-shortlist.js --dry
 *   node scripts/import-shortlist.js --date=2026-08-10
 *   node scripts/import-shortlist.js --term=bedding --date=2026-08-18
 *   node scripts/import-shortlist.js --term=bedding --label="Bedding and duvet covers"
 *   node scripts/import-shortlist.js --all       every listable product
 *   node scripts/import-shortlist.js --term=massage --routes=proven,sourceable
 *
 * A date already holding a different term is refused. Pass --replace to mean it.
 *
 * Windows note: cmd does not honour a backslash line continuation. Keep each
 * command on one line or the first half runs alone, without its flags.
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

// The same product identity the analysis uses, ported word for word. If the
// two drift apart, `same_sku_sellers` stops describing the group this collapses
// on, and the number on the row stops matching the rows behind it.
const NOISE = new Set([
  'the', 'and', 'for', 'with', 'set', 'pack', 'new', 'uk', 'pcs',
  'of', 'in', 'to', 'pet', 'dog', 'cat', 'puppy', 'food', 'water',
  'bowl', 'bowls', 'best', 'quality', 'premium', 'free', 'sale',
]);

function fingerprint(title) {
  const words = String(title || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/);
  const keep = words.filter((w) => w.length > 3 && !NOISE.has(w) && !/^\d+$/.test(w));
  return [...new Set(keep)].sort().slice(0, 8).join(' ');
}

// Clusters, per term, applied in order so the first match wins.
//
// The eBay leaf is the cluster wherever a sweep crossed several leaves. It is
// useless where the sweep was one leaf: every bedding row comes back
// "Bedding Sets & Duvet Covers". These patterns are taken from the vocabulary
// the mining pass produced, not proposed, and ordered so the specific beat the
// general: a satin duvet cover set is satin, and a coverless tog duvet is not
// a duvet cover at all.
const CLUSTER_RULES = {
  bedding: [
    ['Coverless duvets', /\btog\b|coverless/i],
    ['Satin and silk', /\bsatin\b|\bsilk\b/i],
    ['Complete sets', /\b\d\s?(?:pcs?|piece)\b|complete\s+bedding|with\s+fitted/i],
    ['Fitted sheets', /fitted\s+sheet|\bsheets?\b/i],
    ['Pillowcases', /pillow\s?cases?\b/i],
    ['Duvet cover sets', /duvet|quilt\s+cover/i],
  ],
};

function clusterFor(term, title) {
  for (const [name, pattern] of CLUSTER_RULES[term] ?? []) {
    if (pattern.test(title)) return name;
  }
  // Null rather than a catch-all, so enrichment still fills it from the eBay
  // leaf and nothing is labelled Other on a guess.
  return null;
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

function buildRow({ r, series, tenant, batchId, tier, peers = [], cluster = null }) {
  const price = num(r.price);
  const headroom = num(r.headroom);
  const recentUnits = int(r.recent_units);
  const bulky = r.bulky?.trim() === 'yes';

  // The analysis picks the band off the title and writes it per row, so read
  // it rather than deriving it from the bulky flag. Deriving it here meant a
  // king size duvet set costed at small parcel, because nothing in the bulky
  // vocabulary knows what a king size is.
  const band = r.postage_band?.trim() || (bulky ? 'medium_parcel' : 'small_parcel');

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
    cluster,
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
      headroom_band: band,
      landed_cost: null,
      cost_source: 'not_quoted',
      net: null,
      net_pct: null,

      // What the same product sells for elsewhere on the marketplace right
      // now. Present only where other sellers carry it, so a lone product
      // shows nothing rather than a range of one.
      peer_listings: peers.length || null,
      peer_price_min: peers.length ? Math.min(...peers.map((p) => num(p.price) ?? Infinity)) : null,
      peer_price_max: peers.length ? Math.max(...peers.map((p) => num(p.price) ?? -Infinity)) : null,
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
  // The shortlist accumulates across every term ever run, so without this a
  // second category silently joins the batch she is already reviewing.
  const term = args.find((a) => a.startsWith('--term='))?.split('=')[1] || null;
  // A batch is a recommendation, not an export. In bedding, 53 products carry
  // half the category's monthly headroom and the remaining 255 carry about £90
  // each, so shipping all of them asks her to make 255 decisions for a tenth
  // of the return. Off by default, because it changes what she sees.
  const minUnits = Number(args.find((a) => a.startsWith('--min-units='))?.split('=')[1]) || 0;
  // Routes carry evidence and the other columns carry arithmetic. `sourceable`
  // means several sellers list the same product, so a supplier SKU is in
  // circulation. `proven` means it survived every window without collapsing.
  // In a category where 48% of products are new and a quarter are fading or
  // gone, a row with neither is a product that sells today and may not exist
  // in six months.
  //
  // Off by default. It narrows what she sees, so it is asked for, never assumed.
  // Says the collision was meant. Never defaulted on, and never implied by
  // --all or --dry, because the whole point is that it has to be typed.
  const replace = args.includes('--replace');
  const routes = (args.find((a) => a.startsWith('--routes='))?.split('=')[1] || '')
    .split(',').map((r) => r.trim()).filter(Boolean);
  // What she reads on the batch. Defaults are here rather than in the database
  // so a new term names itself on the command line and nothing has to be
  // remembered later.
  const LABELS = {
    elderly: 'Mobility and daily living aids',
    bedding: 'Bedding and duvet covers',
    beauty: 'Beauty tools and accessories',
  };
  const label = args.find((a) => a.startsWith('--label='))?.split('=')[1]
    || (term ? LABELS[term] : null)
    || (term ? term[0].toUpperCase() + term.slice(1) : null);
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
  const live = shortlist
    .filter((r) => r.status === 'listable' && !r.dropped_reason?.trim())
    .filter((r) => !term || r.term?.trim() === term);

  if (term && !live.length) {
    console.error(`No live rows for term "${term}" in the shortlist.`);
    process.exit(1);
  }
  const stock = live.filter((r) => r.stock_candidate?.trim() === 'yes');
  const slipping = live.filter(isSlipping);
  // Below the gate at small parcel. These were admitted on the optimistic
  // large letter bound, and in a category of frames and stools almost none of
  // them ship flat. Kept in the shortlist, out of the batch unless asked for.
  const amber = live.filter((r) => (num(r.headroom) ?? 0) < GATE_ABS);
  const gated = keepAmber ? live : live.filter((r) => (num(r.headroom) ?? 0) >= GATE_ABS);

  // Any of the named routes, not all of them, because proven and sourceable are
  // two different kinds of evidence and a product needs one, not both.
  const hasRoute = (r) => {
    const own = (r.routes || '').split('+').map((x) => x.trim());
    return routes.some((want) => own.includes(want));
  };
  const routeless = routes.length ? gated.filter((r) => !hasRoute(r)) : [];
  const solid = routes.length ? gated.filter(hasRoute) : gated;

  if (routes.length && !solid.length) {
    console.error(`No rows carry any of: ${routes.join(', ')}.`);
    process.exit(1);
  }

  // Everything that cleared the gate goes. Stock is a tier inside the
  // shortlist, not a filter on it: the shortlist is the dropship list and she
  // rules on what she can source, while stock marks the few that also hold
  // against their own history. Filtering to those two would throw away the
  // 200 rows the volume floor was moved to admit.
  const tiered = [...stock, ...slipping];

  // Several sellers list the same product under different item ids, which is
  // correct in the shortlist and wrong in a review queue: twelve listings of
  // one reversible duvet set is one decision, not twelve. Collapse to the
  // strongest row per product and carry the rest onto it as a price range.
  //
  // Nothing is deleted. The shortlist keeps every row, and the group size is
  // already on the row as same_sku_sellers, so what was collapsed stays
  // visible and countable rather than quietly disappearing.
  const worthOf = (r) => (num(r.recent_units) ?? 0) * (num(r.headroom) ?? 0);

  const byProduct = new Map();
  for (const r of solid) {
    // product_key is computed by the analysis, which compares whole titles
    // with rare words weighted, and it is the authority. The local
    // fingerprint is only a fallback for rows written before that column
    // existed, so an older shortlist still collapses rather than erroring.
    const key = r.product_key?.trim() || fingerprint(r.title) || r.item_id;
    const group = byProduct.get(key);
    if (group) group.push(r);
    else byProduct.set(key, [r]);
  }

  const grouped = [];
  for (const group of byProduct.values()) {
    // Sorted so the representative is the row worth the most in a month, and
    // ties fall to the higher unit headroom rather than to file order.
    const ordered = [...group].sort(
      (a, b) => worthOf(b) - worthOf(a) || (num(b.headroom) ?? 0) - (num(a.headroom) ?? 0),
    );
    grouped.push({ row: ordered[0], peers: ordered.slice(1) });
  }

  const duplicatesRemoved = solid.length - grouped.length;

  // The floor is applied to the product, after the collapse, not to each
  // listing before it. Applied first it removed listings before they could be
  // peers, so a product selling sixty a month across four sellers at fifteen
  // each vanished, and the price range on every surviving row was measured
  // only over the listings that had themselves cleared the floor.
  const thin = minUnits
    ? grouped.filter(({ row }) => (int(row.recent_units) ?? 0) < minUnits)
    : [];
  const collapsed = minUnits
    ? grouped.filter(({ row }) => (int(row.recent_units) ?? 0) >= minUnits)
    : grouped;

  const chosen = collapsed;

  // A row with no hold figure was never tested against its own history, so it
  // is neither stock nor slipping. Calling it stock would assert a verdict the
  // analysis refused to compute on a single window.
  const tierOf = (r) => {
    if (r.stock_candidate?.trim() === 'yes') return 'stock';
    if (isSlipping(r)) return 'slipping';
    return 'candidate';
  };

  // stock beats slipping beats candidate, taken across the whole group.
  const tierOfGroup = (group) => {
    if (group.some((r) => tierOf(r) === 'stock')) return 'stock';
    if (group.some((r) => tierOf(r) === 'slipping')) return 'slipping';
    return 'candidate';
  };

  const seriesByItem = loadSeries(mergedDir);

  console.log(`\n${tenant.name}, batch for ${deliveredFor}`
    + (label ? `, ${label}` : ''));
  console.log(`  ${shortlist.length} rows in shortlist, ${live.length} live`
    + (term ? `, filtered to term "${term}"` : ', every term'));
  if (routes.length) {
    console.log(`  routes ${routes.join(' or ')}: kept ${solid.length}, `
      + `held back ${routeless.length} with neither`);
  }
  console.log(`  ${stock.length} stock candidates, ${slipping.length} proven but slipping`);
  if (amber.length) {
    console.log(`  ${amber.length} below £${GATE_ABS.toFixed(2)} at small parcel${keepAmber ? ', included (--amber)' : ', held back'}`);
  }
  if (duplicatesRemoved) {
    console.log(`  ${solid.length} listings collapse to ${grouped.length} products, `
      + `${duplicatesRemoved} duplicate listings folded in`);
  }
  if (thin.length) {
    console.log(`  ${thin.length} products under ${minUnits} units a month, held in the shortlist`);
  }
  // Counted over what is actually being imported, not over the shortlist. A
  // stock candidate below the gate, or under the volume floor, is held back
  // like any other row, and reporting it as imported states something that
  // did not happen.
  const stockImported = chosen
    .filter(({ row, peers }) => tierOfGroup([row, ...peers]) === 'stock').length;
  console.log(`  importing ${chosen.length}, ${stockImported} as stock`);

  if (!tiered.length) {
    console.log('  no stock verdict in the shortlist. Needs three windows, so every');
    console.log('  row imports as a candidate for her to rule on.');
  }
  if (all) console.log('  --all is now the default and changes nothing.');

  const withoutSeries = chosen.filter(({ row }) => !seriesByItem.get(row.item_id)?.length).length;
  if (withoutSeries) console.log(`  ${withoutSeries} without a window series`);

  const rows = chosen
    .map(({ row, peers }) => buildRow({
      r: row,
      series: seriesByItem.get(row.item_id) ?? [],
      tenant,
      batchId: null,
      // Tier is a property of the product, not of the listing that happened
      // to represent it. Two sellers carrying the same duvet set are one
      // product, and if either has seven windows of history showing it holds,
      // that history describes the product. Choosing the representative on
      // monthly worth was silently discarding the stock verdict on eleven of
      // eighteen bedding candidates.
      tier: tierOfGroup([row, ...peers]),
      peers,
      cluster: clusterFor(row.term?.trim(), row.title),
    }))
    // By what the product is worth in a month, whatever its tier. Stock is a
    // property of a row under two routes, not a rank: it says safe to buy
    // inventory in, not look at this first. Sorting by it puts a £100 product
    // above a £1,287 one, which answers the page's only question wrongly.
    // Slipping still sinks, because a product below its own average is not
    // one to open with.
    .sort((a, b) => {
      const sinks = (r) => (r.tier === 'slipping' ? 1 : 0);
      return sinks(a) - sinks(b)
        || (b.monthly_headroom ?? 0) - (a.monthly_headroom ?? 0)
        || (b.headroom ?? 0) - (a.headroom ?? 0);
    });

  console.log();
  for (const r of rows.slice(0, dry ? 20 : 5)) {
    console.log(
      `  £${String(Math.round(r.monthly_headroom ?? 0)).padStart(5)}/mo  ${r.tier.padEnd(9)}  £${(r.headroom ?? 0).toFixed(2)}  ${String(r.sold_30d ?? 0).padStart(3)}u  ${r.title.slice(0, 42)}`,
    );
  }
  console.log();

  /*
   * One batch per delivery date, upserted on (tenant_id, delivered_for). So an
   * import aimed at a date that already holds a different term takes that
   * batch over, relabels it, and deletes every undecided candidate on it.
   *
   * That happened on 14 August. A backslash line continuation, which cmd does
   * not honour, split the command and ran the first half alone: no --date, no
   * --dry, so a massage import landed on the mobility batch and removed fifty
   * candidates. They all came back from the shortlist because nothing had been
   * decided. After Monday that will not be true, and a decided row that gets
   * cascaded away is not recoverable from any CSV.
   *
   * So the collision is refused rather than performed. --replace is the way to
   * say it was meant.
   */
  const { data: existing } = await db
    .from('batches')
    .select('id, term, category_label, candidate_count')
    .eq('tenant_id', tenant.id)
    .eq('delivered_for', deliveredFor)
    .maybeSingle();

  const collision = existing && existing.term && term && existing.term !== term;
  if (collision && !replace) {
    console.error(`\n  ${deliveredFor} already holds "${existing.category_label}"`
      + ` (${existing.term}, ${existing.candidate_count} candidates).`);
    console.error(`  Importing "${term}" here would take that batch over and`);
    console.error('  delete every candidate on it that has not been decided.');
    console.error('');
    console.error('  Pick another date, or pass --replace if it was meant.');
    console.error('');
    process.exit(1);
  }

  if (collision && replace) {
    console.log(`  --replace: taking over "${existing.category_label}" on ${deliveredFor}`);
  }

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
        term,
        category_label: label,
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
