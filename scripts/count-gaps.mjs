/*
 * How far over the market the waiting cards are, counted with the same assess() the portal uses, so the figures match
 * the screen to the card. Read only: it selects, never writes.
 *
 *   node scripts/count-gaps.mjs
 *
 * Reads VITE_SUPABASE_URL and SUPABASE_SECRET_KEY from .env.local (the secret key, because the portal's reads sit behind
 * a signed-in user). Prints counts only, never a key.
 *
 *   node scripts/count-gaps.mjs --file rows.json   the same count over rows saved as JSON, for a check without a database
 */

import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { assess } from '../src/lib/assess.js';

const PAGE = 500;
const gbp = (v) => `${Number(v) < 0 ? '-' : ''}£${Math.abs(Number(v)).toFixed(2)}`;

async function envOf(file) {
  const text = await readFile(file, 'utf8').catch(() => '');
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
  return { ...env, ...process.env };
}

// The same rows the Candidates page reads: every card in a delivered batch that has not been retired.
async function readRows() {
  const env = await envOf('.env.local');
  const url = env.VITE_SUPABASE_URL;
  const key = env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('VITE_SUPABASE_URL and SUPABASE_SECRET_KEY are needed in .env.local');
  const db = createClient(url, key, { auth: { persistSession: false } });

  const { data: batches, error: be } = await db.from('batches').select('id')
    .eq('status', 'delivered').is('retired_at', null);
  if (be) throw be;
  const ids = batches.map((b) => b.id);

  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.from('candidates')
      .select(`id, title, margin, listing, entry, draft, competition, sold_30d, avg_sold_price, variation_count, bulky,
        decisions ( action ),
        candidate_sources ( id, supplier, fulfilment, status, landed_unit_cost, confirmed, matched_on, note )`)
      .in('batch_id', ids).order('id').range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  return rows;
}

const one = (d) => (Array.isArray(d) ? d[0] ?? null : d ?? null);

function summarise(raw) {
  const rows = raw.map(({ decisions, candidate_sources: sources, ...c }) => ({ ...c, sources: sources ?? [], decision: one(decisions) }));
  const waiting = rows.filter((r) => !r.decision);
  const out = { cards: rows.length, waiting: waiting.length };

  // eBay cards over the market, with what they would keep listed level with it.
  const ebay = [];
  const store = [];
  for (const r of waiting) {
    const a = assess(r);
    const p = a.position;
    if (!p || p.inMarket || a.price == null) continue;
    const pct = p.ref > 0 ? p.over / p.ref : null;
    if (a.store) {
      store.push({ r, a, pct, over: p.over, costOver: r.margin?.cost != null && a.g?.min != null ? r.margin.cost > a.g.min : null });
    } else {
      const atRef = assess({ ...r, draft: { ...(r.draft ?? {}), price: p.ref } }, { holdPrice: true });
      ebay.push({ r, a, pct, over: p.over, keepAtRef: atRef.keep, target: a.target });
    }
  }

  const lines = [];
  const say = (s = '') => lines.push(s);
  say(`Cards in live batches: ${out.cards.toLocaleString('en-GB')}, waiting for a decision: ${out.waiting.toLocaleString('en-GB')}`);
  say();

  say(`EBAY CARDS OVER THE MARKET, waiting: ${ebay.length}`);
  const byPence = [0.1, 0.25, 0.5, 1, 2, 5, Infinity];
  let prev = 0;
  for (const cap of byPence) {
    const n = ebay.filter((x) => x.over > prev && x.over <= cap).length;
    say(`  over by ${cap === Infinity ? `more than ${gbp(prev)}` : `${gbp(prev)} to ${gbp(cap)}`}: ${n}`);
    prev = cap;
  }
  const byPct = [0.01, 0.03, 0.05, 0.1];
  for (const cap of byPct) say(`  within ${cap * 100}% of the market: ${ebay.filter((x) => x.pct != null && x.pct <= cap).length}`);
  say();

  const rule = (x) => x.over <= 0.5 || (x.pct != null && x.pct <= 0.03);
  const near = ebay.filter(rule);
  say(`  Nearly in, within 50p or 3%: ${near.length}`);
  say(`    listed level with the market, still keep the full target: ${near.filter((x) => x.keepAtRef != null && x.target != null && x.keepAtRef >= x.target).length}`);
  say(`    keep within £1 of the target: ${near.filter((x) => x.keepAtRef != null && x.target != null && x.keepAtRef < x.target && x.keepAtRef >= x.target - 1).length}`);
  say(`    keep less than that, still above £0: ${near.filter((x) => x.keepAtRef != null && x.target != null && x.keepAtRef < x.target - 1 && x.keepAtRef > 0).length}`);
  say(`    lose money at the market price: ${near.filter((x) => x.keepAtRef != null && x.keepAtRef <= 0).length}`);
  const keeps = near.map((x) => x.keepAtRef).filter((v) => v != null).sort((a, b) => a - b);
  if (keeps.length) say(`    keep at the market price, lowest ${gbp(keeps[0])}, middle ${gbp(keeps[Math.floor(keeps.length / 2)])}, highest ${gbp(keeps.at(-1))}`);
  say();

  say(`SHOP CARDS OVER THE GOOGLE LOW, waiting: ${store.length}`);
  prev = 0;
  for (const cap of [0.05, 0.1, 0.25, 0.5, 1, Infinity]) {
    const n = store.filter((x) => x.pct != null && x.pct > prev && x.pct <= cap).length;
    say(`  ${cap === Infinity ? `more than ${prev * 100}%` : `${prev * 100}% to ${cap * 100}%`} over: ${n}`);
    prev = cap;
  }
  say(`  over by more than 10%: ${store.filter((x) => x.pct != null && x.pct > 0.1).length}`);
  say(`  where the shop's cost is above the Google low itself: ${store.filter((x) => x.costOver).length}`);
  say();

  const worst = [...store].sort((a, b) => b.pct - a.pct).slice(0, 10);
  if (worst.length) {
    say('  Ten furthest over, to check by eye:');
    for (const x of worst) {
      say(`    ${String(x.r.title ?? x.r.id).slice(0, 48).padEnd(48)} ${gbp(x.a.price)} against ${gbp(x.a.position.ref)}, cost ${x.r.margin?.cost != null ? gbp(x.r.margin.cost) : '?'} at ${x.r.margin?.cost_from?.shop ?? '?'}`);
    }
  }
  return lines.join('\n');
}

const fileAt = process.argv.indexOf('--file');
const rows = fileAt > 0 ? JSON.parse(await readFile(process.argv[fileAt + 1], 'utf8')) : await readRows();
console.log(summarise(rows));
