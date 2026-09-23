/*
 * Asks CJ to source products she has approved, rather than hoping their
 * catalogue already holds something similar. Matching by keyword found one real
 * product in twenty five. This sends the name, the image and the listing it
 * sells on, and CJ answers within about 48 hours.
 *
 * Usage:
 *   node scripts/request-cj-sourcing.js --date=2026-08-10 --dry
 *   node scripts/request-cj-sourcing.js --date=2026-08-10 --approved
 *   node scripts/request-cj-sourcing.js --date=2026-08-10 --limit=10
 */

import { connect } from '../pipeline/lib/db.js';
import { token } from '../pipeline/sources/cjDropshipping.js';

const BASE = 'https://developers.cjdropshipping.com/api2.0/v1';
const arg = (n) => process.argv.slice(2).find((a) => a.startsWith(`--${n}=`))?.split('=')[1];
const flag = (n) => process.argv.slice(2).includes(`--${n}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const round2 = (n) => Math.round(n * 100) / 100;

// The absolute margin gate. Below this the picking, packing and support time
// is not covered, so it is what has to survive after goods and freight.
const GATE_ABS = 4.00;

// CJ quotes goods only. On the July run freight to the UK ran roughly equal to
// the goods price, so the ask is set at about a third of the ceiling to leave
// room for it. Asking at the full ceiling guarantees a landed cost above it.
const FREIGHT_SHARE = 0.35;

// Below this no supplier answers, and a request spent is a request gone.
const ASK_MIN = 1.50;

// Above this the product is furniture rather than a parcel, and freight
// decides it long before the goods price does.
const ASK_MAX = 20.00;

/*
 * Brands seen in this category, from the eBay brand facet and from our own
 * scrapes. A word list is wrong in both directions and will keep missing
 * things, which is why it excludes rather than approves: a product wrongly
 * held back costs one request, a branded copy costs the selling account.
 */
const BRAND = new RegExp(
  '\\b(' + [
    'medokare', 'helping hand', 'croydex', 'aidapt', 'homcraft', 'homecraft',
    'nrs', 'drive devilbiss', 'devilbiss', 'invacare', 'etac', 'vive',
    'performance health', 'patterson', 'days healthcare', 'ticco', 'hyfive',
    'levede', 'homcom', 'vevor', 'scrubzz', 'eazy', 'taili', 'dyna-living',
    'jobst', 'ossur', 'donjoy', 'breg', 'procare', 'convatec', 'coloplast',
    'senator', 'viscount', 'kylie', 'tena',
  ].join('|') + ')\\b',
  'i',
);

async function main() {
  const { db, E } = await connect();
  const dry = flag('dry');
  const approvedOnly = flag('approved');
  const date = arg('date');
  const limit = Number(arg('limit') ?? 0);
  const slug = arg('tenant') ?? E.VITE_TENANT_SLUG ?? 'cart-and-keep';

  const { data: tenant } = await db.from('tenants').select('id, name').eq('slug', slug).single();
  const { data: src } = await db
    .from('tenant_sources').select('credential_ref')
    .eq('tenant_id', tenant.id).eq('source_id', 'cj_dropshipping').single();

  const creds = JSON.parse(src?.credential_ref ?? '{}');
  const apiKey = E[creds.apiKey] ?? E.CJ_API_KEY;
  if (!apiKey) {
    console.error('CJ API key not found in the environment.');
    process.exit(1);
  }

  let q = db
    .from('candidates')
    .select(`
      id, title, image_url, reference_url, margin, headroom, monthly_headroom,
      same_sku_sellers, external_ref, bulky,
      batches!inner ( delivered_for ),
      decisions ( action ),
      candidate_sources ( id, supplier, status )
    `)
    .eq('tenant_id', tenant.id)
    // CJ fetches the image server side, so a null one is a request they cannot
    // answer. The gone-from-eBay rows carry a null image for exactly this
    // reason and are excluded here rather than failing at their end.
    .not('image_url', 'is', null)
    // Score is null on a batch with no history behind it, so ordering on it
    // alone leaves the sequence to the query planner. Five a day means the
    // five that go first have to be chosen rather than arrive.
    .order('score', { ascending: false, nullsFirst: false })
    .order('monthly_headroom', { ascending: false, nullsFirst: false });

  if (date) q = q.eq('batches.delivered_for', date);

  const { data: rows, error } = await q;
  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  const one = (d) => (Array.isArray(d) ? d[0] ?? null : d ?? null);

  const eligible = (rows ?? []).filter((c) => {
    if (approvedOnly && one(c.decisions)?.action !== 'approve') return false;
    // Asking twice for the same product wastes their time and clutters ours.
    return !(c.candidate_sources ?? []).some(
      (s) => s.supplier === 'cj_dropshipping' && s.status === 'requested',
    );
  });

  /*
   * Five requests a day is the scarce resource, so a request is only spent on
   * a product CJ could plausibly answer.
   *
   * Too thin: the ask works out under a pound, which nobody quotes. The first
   * dry run offered a shower chair at $1.10 and a half step at $0.61.
   *
   * Too big: freight is the constraint above a parcel, not goods. A patient
   * hoist priced a $46 ask, and the freight on it is a pallet at any goods
   * price. The bulky flag is the best signal we have for that until a supplier
   * gives real dimensions.
   */
  const askFor = (c) => {
    const head = Number(c.headroom ?? c.margin?.headroom) || 0;
    const ceiling = head - GATE_ABS;
    return ceiling > 0 ? round2(ceiling * FREIGHT_SHARE) : 0;
  };

  const skipped = { thin: 0, big: 0, brand: 0, bulky: 0 };

  const affordable = eligible.filter((c) => {
    // Asking CJ to source a branded product is asking them to supply a copy of
    // it. Listing that invites a VeRO takedown, and repeat reports put the
    // selling account at risk, which is a larger loss than any margin here.
    if (BRAND.test(c.title)) { skipped.brand += 1; return false; }

    // The ask ceiling misses furniture that is cheap per unit. A folding
    // wheelchair priced a $16.81 ask and is still a wheelchair.
    if (c.bulky) { skipped.bulky += 1; return false; }

    const ask = askFor(c);
    if (ask < ASK_MIN) { skipped.thin += 1; return false; }
    if (ask > ASK_MAX) { skipped.big += 1; return false; }
    return true;
  });

  if (skipped.thin) console.log(`  ${skipped.thin} skipped, ask under $${ASK_MIN.toFixed(2)} and nobody quotes that`);
  if (skipped.big) console.log(`  ${skipped.big} skipped, ask over $${ASK_MAX.toFixed(2)}`);
  if (skipped.bulky) console.log(`  ${skipped.bulky} skipped, flagged bulky and freight decides those before goods does`);
  if (skipped.brand) console.log(`  ${skipped.brand} skipped, branded and sourcing a copy is a VeRO risk`);

  const chosen = limit ? affordable.slice(0, limit) : affordable;

  console.log(`\n${tenant.name}, ${rows?.length ?? 0} candidates, ${chosen.length} to ask about\n`);

  if (!chosen.length) return;

  const access = await token(apiKey);
  let sent = 0;
  let failed = 0;

  for (const c of chosen) {
    /*
     * expectPrice was the sale price, which asks CJ to supply at what she
     * sells for. The number that means something is the ceiling: goods plus
     * their shipping has to land under the headroom or the product does not
     * clear the four pound gate whatever CJ quotes.
     *
     * A margin is left below the ceiling because CJ's quote is goods only and
     * freight is a separate call. On the July run freight ran roughly equal to
     * goods, so asking at the full ceiling guarantees a landed cost above it.
     */
    const sale = Number(c.margin?.sale_price) || null;
    const head = Number(c.headroom ?? c.margin?.headroom) || null;
    const ceiling = head != null ? head - GATE_ABS : null;
    const ask = ceiling != null ? Math.max(round2(ceiling * FREIGHT_SHARE), 0.5) : null;

    if (dry) {
      console.log(
        `  ask $${String(ask ?? '?').padStart(6)}  `
        + `ceiling £${String(ceiling?.toFixed(2) ?? '?').padStart(6)}  `
        + `sells £${String(sale?.toFixed(2) ?? '?').padStart(6)}  `
        + `${String(c.same_sku_sellers ?? '-').padStart(3)} sku  ${c.title.slice(0, 42)}`,
      );
      continue;
    }

    const res = await fetch(`${BASE}/product/sourcing/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CJ-Access-Token': access },
      body: JSON.stringify({
        productName: c.title,
        productImage: c.image_url,
        productUrl: c.reference_url,
        expectPrice: ask,
        remark: 'UK seller. Need goods cost and UK shipping cost separately. '
          + 'Repeat monthly volume if the landed cost works.',
      }),
    });

    const json = await res.json().catch(() => null);

    if (!json?.result && !json?.success) {
      // Five a day on the free plan. Carrying on prints the same refusal
      // twenty times and tells you nothing new.
      if (/daily source limit/i.test(json?.message ?? '')) {
        console.log(`\n  Daily sourcing limit reached after ${sent}. The rest carry over.`);
        break;
      }
      failed += 1;
      console.error(`  FAIL  ${json?.message ?? res.status}  ${c.title.slice(0, 48)}`);
      await sleep(1500);
      continue;
    }

    const { cjSourcingId, sourceNumber } = json.data ?? {};

    // Written with no cost and status requested, so nothing downstream reads an
    // empty price as a free product.
    const { error: wErr } = await db.from('candidate_sources').upsert({
      tenant_id: tenant.id,
      candidate_id: c.id,
      supplier: 'cj_dropshipping',
      external_ref: cjSourcingId ?? sourceNumber,
      title: c.title,
      supplier_kind: 'marketplace',
      fulfilment: 'dropship',
      ships_from: 'CN',
      status: 'requested',
      matched_on: 'sourcing request',
      note: sourceNumber ? `CJ source number ${sourceNumber}` : null,
      raw: json.data ?? {},
    }, { onConflict: 'candidate_id,supplier,external_ref' });

    if (wErr) console.error(`        write failed: ${wErr.message}`);

    sent += 1;
    console.log(`  asked  ${sourceNumber ?? cjSourcingId ?? ''}  ${c.title.slice(0, 50)}`);
    await sleep(1500);
  }

  const left = chosen.length - sent - failed;
  console.log(`\n${sent} asked, ${failed} failed${left > 0 ? `, ${left} still to ask` : ''}.${dry ? ' Dry run, nothing sent.' : ''}`);
  console.log('CJ answer inside about 48 hours. Check the sourcing page in their app.\n');
}

main();
