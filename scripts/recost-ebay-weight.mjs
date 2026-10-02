/*
 * Postage by weight for the cards already in her queue.
 *
 * Every gate run was costed at one band: store-card runs at Evri to 5kg, shelf-queries runs at a band guessed from
 * the name. On 2 October the Sika jointing compound (14kg on eBay) showed "Evri to 5kg, £2.62" and "You keep £5.08",
 * which at the real band is a loss. The importers now cost by weight (scripts/lib/weight.js); this puts the same
 * figures on the cards made before.
 *
 *   node scripts/recost-ebay-weight.mjs                  # list only, writes research/review/recost-weight-<date>.csv
 *   node scripts/recost-ebay-weight.mjs --apply          # writes
 *   node scripts/recost-ebay-weight.mjs --with-down      # also lowers a band the run chose when the weight is lighter
 *   node scripts/recost-ebay-weight.mjs --apply --decided  # decided cards get the figures too, not only a note
 *   node scripts/recost-ebay-weight.mjs --skip=<id>,<id>   # leave out cards whose weight was misread
 *
 * What it reads, per card:
 * - the eBay reading (an eBay card's margin, or margin.ebay on a store card): weight from the eBay listing title,
 *   then the store card's weight, the shop page name, the title;
 * - the store side of a store card costed with no weight: weight from the shop page name, then the title.
 * What --apply writes:
 * - cards she has not decided: the re-costed figures;
 * - decided cards: a note with the corrected figures; with --decided the figures as well (Joseph, 2 October: the
 *   decisions so far are his own test decisions, so their figures may change);
 * - over 20kg: a "courier only" note on every card, decided or not.
 * Notes are never added twice.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ebayCosts, keepAt, round2 } from '../src/lib/pricing.js';
import { ebayWeight, recostEbay, storeWeight } from './lib/weight.js';
import { priceStore } from './store/price-store.mjs';
import { BAND_LABEL } from './lib/row.js';

const args = process.argv.slice(2);
const arg = (k, d = null) => args.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=') ?? d;
const apply = args.includes('--apply');
const allowDown = args.includes('--with-down');
const withDecided = args.includes('--decided');
// A title can still name a weight that is not the product's; those cards are left out by id.
const skip = new Set(String(arg('skip', '')).split(',').map((v) => v.trim()).filter(Boolean));
const slug = arg('tenant', 'cart-and-keep');
const date = new Date().toISOString().slice(0, 10);
const out = arg('out', path.join('research/review', `recost-weight-${date}.csv`));

const gbp = (v) => (v == null ? '-' : `${v < 0 ? '-' : ''}£${Math.abs(v).toFixed(2)}`);
const kg = (g) => `${Math.round(g / 100) / 10}kg`;
const labelOf = (m) => m.band_label ?? BAND_LABEL[m.band] ?? m.band ?? 'no band';
const decidedOf = (c) => (Array.isArray(c.decisions) ? c.decisions.length > 0 : Boolean(c.decisions));
const isStore = (c) => c.margin?.channel === 'store';
const ebayOf = (c) => (isStore(c) ? c.margin.ebay ?? null : c.margin?.rates ? c.margin : null);
const keepOf = (m, cost) => (m?.sale_price != null && cost != null ? keepAt(Number(m.sale_price), Number(cost), ebayCosts(m)) : null);
// The goods cost behind an eBay keep: the store card's cost, else the shelf the gate matched.
const costOf = (c, m) => (isStore(c) ? c.margin.cost : m?.landed_cost ?? m?.shelf?.price ?? null);

/*
 * Works out the change for one card. Pure, so it can be tested without a database.
 * Returns { ebay, store, lowered } where each side is null when nothing changes.
 */
export function planCard(c, { allowDown: down = false } = {}) {
  const res = { ebay: null, store: null, lowered: false };
  const m = ebayOf(c);
  if (m) {
    const w = ebayWeight({
      listingTitle: c.entry?.title,
      store: isStore(c) ? c.margin.postage_band : null,
      pageName: isStore(c) ? c.margin.cost_from?.product : m.shelf?.product,
      title: c.title,
    });
    const got = recostEbay(m, w, { allowDown: down });
    if (!down && !got.changed && recostEbay(m, w, { allowDown: true }).changed) res.lowered = true;
    if (got.changed) {
      const cost = costOf(c, m);
      res.ebay = {
        margin: got.margin,
        over: got.over,
        down: got.down,
        w,
        before: { band: labelOf(m), postage: Number(m.postage ?? 0), keep: keepOf(m, cost) },
        after: { band: got.margin.band_label, postage: got.margin.postage, keep: keepOf(got.margin, cost) },
        price: m.sale_price ?? null,
        letter: /^letter/.test(String(m.band ?? '')),
      };
    }
  }
  if (isStore(c) && c.margin.postage_band?.basis === 'assumed') {
    const w = storeWeight({ pageName: c.margin.cost_from?.product, title: c.title });
    if (w && w.grams > 2000) {
      const p = priceStore(c.margin.cost, Number(c.margin.google?.min), w.grams);
      res.store = {
        w,
        over: !p.band,
        priced: p,
        before: { band: c.margin.postage_band?.label, postage: Number(c.margin.postage ?? 0), keep: c.margin.keep ?? null, list: c.margin.list_at ?? null },
        after: p.band ? { band: p.band.label, postage: p.band.postage, keep: p.list?.keep ?? null, list: p.list?.price ?? null } : null,
      };
    }
  }
  return res;
}

// The store figures a re-price changes; everything else on the card stays.
export function storeMargin(margin, s) {
  const p = s.priced;
  return {
    ...margin,
    list_at: p.list?.price ?? null,
    floor: p.list?.floor ?? null,
    above_market: p.aboveMarket,
    keep: p.list?.keep ?? null,
    profit_target: p.list?.profit ?? null,
    postage: p.band.postage,
    packaging: p.band.packaging,
    postage_band: { key: p.band.key, label: p.band.label, grams: p.band.grams, basis: p.band.basis, from: s.w.from },
  };
}

export function noteFor(c, plan) {
  const lines = [];
  if (plan.ebay?.over || plan.store?.over) {
    const w = plan.ebay?.w ?? plan.store?.w;
    lines.push(`Postage: about ${kg(w.grams)} (from ${w.from}), over 20kg. Courier only: Royal Mail and Evri won't take it.`);
  }
  if (plan.ebay && !plan.ebay.over) {
    const e = plan.ebay;
    lines.push(`Postage check: about ${kg(e.w.grams)} (from ${e.w.from}). eBay postage is ${e.after.band}, ${gbp(e.after.postage)}, not ${e.before.band}, ${gbp(e.before.postage)}.`
      + (e.after.keep != null ? ` You keep about ${gbp(e.after.keep)} at ${gbp(Number(e.price))}, not ${gbp(e.before.keep)}.` : ''));
  }
  if (plan.store && !plan.store.over) {
    const s = plan.store;
    lines.push(`Postage check: about ${kg(s.w.grams)} (from the shop ${s.w.from}). Shop postage is ${s.after.band}, ${gbp(s.after.postage)}, not ${s.before.band}, ${gbp(s.before.postage)}.`
      + (s.after.keep != null ? ` You keep about ${gbp(s.after.keep)} at ${gbp(s.after.list)}.` : ''));
  }
  return lines.join(' ');
}

const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

async function main() {
  const { connect } = await import('../pipeline/lib/db.js');
  const { db } = await connect();
  const { data: tenant } = await db.from('tenants').select('id').eq('slug', slug).maybeSingle();
  if (!tenant) { console.error(`Tenant "${slug}" not found.`); process.exit(1); }

  // Read 1,000 at a time: the server stops at 1,000 rows a request.
  const cards = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from('candidates')
      .select('id, external_ref, title, margin, entry, recommended_channels, decisions ( id )')
      .eq('tenant_id', tenant.id).order('id').range(from, from + 999);
    if (error) { console.error(`Cards not read: ${error.message}`); process.exit(1); }
    cards.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }

  const plans = [];
  let ebayRead = 0;
  let storeAssumed = 0;
  let lowered = 0;
  let skipped = 0;
  for (const c of cards) {
    if (skip.has(c.id)) { skipped += 1; continue; }
    if (ebayOf(c)) ebayRead += 1;
    if (isStore(c) && c.margin.postage_band?.basis === 'assumed') storeAssumed += 1;
    const plan = planCard(c, { allowDown });
    if (plan.lowered) lowered += 1;
    if (plan.ebay || plan.store) plans.push({ c, plan, decided: decidedOf(c) });
  }

  const eb = plans.filter((p) => p.plan.ebay);
  const st = plans.filter((p) => p.plan.store);
  const moves = {};
  for (const p of eb) {
    const k = `${p.plan.ebay.before.band}  ->  ${p.plan.ebay.after.band}`;
    moves[k] = (moves[k] ?? 0) + 1;
  }
  const courier = plans.filter((p) => p.plan.ebay?.over || p.plan.store?.over);
  const letters = eb.filter((p) => p.plan.ebay.letter);
  const negative = plans.filter((p) => {
    const e = p.plan.ebay; const s = p.plan.store;
    return (e && e.after.keep != null && e.after.keep < 0 && !(e.before.keep < 0))
      || (s?.after && s.after.keep != null && s.after.keep < 0 && !(s.before.keep < 0));
  });

  console.log(`\n  ${cards.length} cards read: ${ebayRead} with an eBay reading, ${storeAssumed} store cards with no weight`);
  if (skip.size) console.log(`  Left out by --skip: ${skipped} of ${skip.size}${skipped < skip.size ? ' (check the ids)' : ''}`);
  console.log(`\n  eBay postage re-costed for weight: ${eb.length}`);
  for (const [k, n] of Object.entries(moves).sort((a, b) => b[1] - a[1])) console.log(`    ${String(n).padStart(4)}  ${k}`);
  if (lowered) console.log(`    (${lowered} would be cheaper by weight; left at the run's band. --with-down to lower them)`);
  console.log(`  Large letter but over the letter weight: ${letters.length}`);
  console.log(`  Store side, no weight but over 2kg by the page name or title: ${st.length}`);
  console.log(`  Over 20kg, courier only: ${courier.length}`);
  for (const p of courier) {
    const w = p.plan.ebay?.over ? p.plan.ebay.w : p.plan.store.w;
    console.log(`    ${p.c.id}  ${String(p.c.title).slice(0, 44).padEnd(44)}  ${kg(w.grams)} from "${String(w.text).slice(0, 70)}"`);
  }
  console.log(`\n  "You keep" turns negative: ${negative.length}`);
  for (const p of negative) {
    const e = p.plan.ebay; const s = p.plan.store;
    const x = e && e.after.keep < 0 ? e : s;
    const side = `${x === e ? 'eBay' : 'shop'} ${gbp(x.before.keep)} -> ${gbp(x.after.keep)}, ${kg(x.w.grams)} from "${String(x.w.text).slice(0, 60)}"`;
    console.log(`    ${p.decided ? 'decided ' : '        '}${p.c.id}  ${String(p.c.title).slice(0, 48).padEnd(48)}  ${side}`);
  }
  const decided = plans.filter((p) => p.decided).length;
  console.log(`\n  Decided cards among them: ${decided} (${withDecided ? 'figures and a note' : 'a note only; --decided writes their figures too'})`);

  const head = ['id', 'title', 'decided', 'side', 'weight_kg', 'weight_from', 'band_before', 'band_after', 'postage_before', 'postage_after', 'keep_before', 'keep_after', 'price', 'courier_only', 'write', 'read_from_text'];
  const lines = [head.join(',')];
  for (const { c, plan, decided: d } of plans) {
    for (const [side, x] of [['ebay', plan.ebay], ['store', plan.store]]) {
      if (!x) continue;
      lines.push([
        c.id, c.title, d ? 'yes' : '', side, Math.round(x.w.grams / 100) / 10, x.w.from,
        x.before.band, x.after?.band ?? 'over 20kg', x.before.postage, x.after?.postage ?? '',
        x.before.keep ?? '', x.after?.keep ?? '', side === 'ebay' ? x.price ?? '' : x.after?.list ?? '',
        x.over ? 'yes' : '', d && !withDecided ? 'note' : x.over && side === 'store' ? 'note' : 'figures', x.w.text,
      ].map(csvCell).join(','));
    }
  }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${lines.join('\n')}\n`, 'utf8');
  console.log(`  Written ${out} (${lines.length - 1} rows)\n`);

  if (!apply) { console.log('  List only, nothing written to her queue. Add --apply to write.\n'); return; }

  let figures = 0;
  let failed = 0;
  for (const [i, { c, plan, decided: d }] of plans.entries()) {
    if (d && !withDecided) continue;
    let margin = c.margin;
    let topLevel = {};
    if (plan.ebay) {
      if (isStore(c)) margin = { ...margin, ebay: plan.ebay.margin };
      else {
        margin = plan.ebay.margin;
        const perDay = c.entry?.proved ? c.entry.per_day : null;
        topLevel = { headroom: margin.headroom, monthly_headroom: perDay != null && margin.headroom != null ? round2(perDay * 30 * margin.headroom) : null };
      }
    }
    // Over 20kg on the shop side stays as it is: the note tells her, and Keepr decides.
    if (plan.store && !plan.store.over) margin = storeMargin(margin, plan.store);
    if (margin === c.margin) continue;
    const { error } = await db.from('candidates').update({ margin, ...topLevel }).eq('id', c.id);
    if (error) { failed += 1; console.error(`  ${c.id}: not written, ${error.message}`); } else figures += 1;
    if ((i + 1) % 50 === 0) console.log(`  ${i + 1} of ${plans.length}`);
  }

  // Notes: every decided card, and every card over 20kg. Never twice.
  const toNote = plans.filter((p) => p.decided || p.plan.ebay?.over || p.plan.store?.over)
    .map((p) => ({ c: p.c, body: noteFor(p.c, p.plan) })).filter((n) => n.body);
  let noted = 0;
  for (let i = 0; i < toNote.length; i += 100) {
    const slice = toNote.slice(i, i + 100);
    const { data: have } = await db.from('candidate_notes').select('candidate_id, body').in('candidate_id', slice.map((n) => n.c.id));
    const known = new Set((have ?? []).map((n) => `${n.candidate_id}|${n.body}`));
    const add = slice.filter((n) => !known.has(`${n.c.id}|${n.body}`)).map((n) => ({ tenant_id: tenant.id, candidate_id: n.c.id, body: n.body }));
    if (!add.length) continue;
    const { error } = await db.from('candidate_notes').insert(add);
    if (error) console.error(`  Notes not added: ${error.message}`); else noted += add.length;
  }
  console.log(`\n  Re-costed ${figures} cards${failed ? `, ${failed} failed (rerun to finish)` : ''}; ${noted} notes added.\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
