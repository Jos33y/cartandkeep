/*
 * One search call per phrase, to decide which are worth the gate's twenty one.
 *
 * The gate reads ten listings individually, so 4,238 mined phrases would cost
 * about 89,000 calls against a budget of 5,000 a day. A single search already
 * returns the listing count and the price field, which is enough to drop the
 * markets nobody could rank on and the prices that cannot carry the cost base.
 *
 * It refuses, it does not score, and it never decides a pass. Anything that
 * survives goes to the gate to be judged on sales and entry.
 *
 * Usage:
 *   node scripts/scan.js --file=scripts/queries-demand-full.txt
 *   node scripts/scan.js --file=... --max=500 --start=500 --out=scripts/queries-gated.txt
 */

import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import {
  D, BANDS, search, token, stats, maxGoodsCost, priceFloor, loadEnvFiles, pickCredentials,
} from './gate.js';

/*
 * Whole word, and measured against the mined file rather than guessed at.
 *
 * Every word here was counted before it went in: what it cuts, and what it
 * cuts by accident. Words that read as obvious and were dropped on the
 * evidence: card, because it catches graphics card and SD card; car, because
 * it catches ceramic car coating and the boot liner that was one of the best
 * candidates the gate has found; repair, because of puncture repair kit;
 * switch, because of ignition switch; mens and womens, because they catch
 * watches and sunglasses.
 *
 * What is left is markets a new seller cannot source new: second hand by
 * nature, collectables, media, designer labels, whole vehicles and
 * instruments. Ordinary goods sit right beside them in the file, which is why
 * the list is words rather than categories.
 */
// Only what the gate cannot see. Categories went: "cards" and "games" were
// silently dropping birthday cards and board games off The Works' shelf.
const SKIP = [
  // Second hand by nature, and she sells new
  'used', 'vintage', 'antique', 'refurbished', 'preowned', 'secondhand', 'joblot',
  // Clothing, where size drives the return
  'shirt', 'dress', 'jeans', 'trainers', 'jacket', 'hoodie',
  // Account risk: counterfeit reports and brand takedowns land on a young account
  'iphone', 'ipad', 'macbook', 'airpods',
  'rolex', 'omega', 'gucci', 'prada', 'chanel', 'burberry', 'moncler', 'nike', 'adidas', 'ralph',
  // Fragrance: the most counterfeit-reported branded goods on eBay
  'edp', 'edt', 'parfum', 'perfume', 'aftershave', 'cologne', 'fragrance', 'eau', 'homme', 'femme',
  // Alcohol needs eBay's approval; gas canisters cannot go by post; nicotine is restricted
  'whisky', 'whiskey', 'vodka', 'gin', 'rum', 'prosecco', 'champagne', 'liqueur', '70cl', '75cl',
  'butane', 'propane', 'flogas', 'calor',
  'nicorette', 'nicotinell', 'nicotine', 'vape', 'vapes',
];
// Fragrance houses, caught by brand when the shelf name never says EDP: "Hugo Boss Bottled 50ml Spray".
// Only when sold by the millilitre or as a spray, so a Calvin Klein wallet still goes through.
const SCENT_HOUSES = /\b(hugo boss|hugo|boss bottled|jimmy choo|calvin klein|paco rabanne|rabanne|dkny|issey miyake|lacoste|diesel|police|ghost|ariana grande|vera wang|clinique|armaf|afnan|marc jacobs|thierry mugler|mugler|dolce|gabbana|versace|davidoff|azzaro|carolina herrera|ysl|yves saint laurent|guess|britney spears|katy perry|elizabeth arden|lancome|givenchy|dior|tom ford|montblanc|joop|cacharel|nina ricci|kenzo|moschino|michael kors|hollister|jean paul gaultier|playboy|beyonce|rihanna|jennifer lopez|lattafa|eternity|obsession|euphoria|daisy dream|212 ladies|lovestruck)\b/;
const BY_ML = /\b\d+(\.\d+)?\s?ml\b|\bspray\b/;

// The shop's own name is read too: "jimmy choo illicit" says nothing, "Jimmy Choo Illicit 60ml EDP" does.
const risky = (q, seed) => {
  const text = `${q} ${seed ?? ''}`.toLowerCase();
  const words = text.split(/[^a-z0-9]+/);
  // With no shop name to check the size against, the house alone decides: these lines were all scent.
  const scent = SCENT_HOUSES.test(text) && (BY_ML.test(text) || !String(seed ?? '').trim());
  return SKIP.some((w) => words.includes(w)) || scent;
};
let skipped = 0;

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

function readQueries(file) {
  const seen = new Set();
  const out = [];
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const [head, ...rest] = line.split('#');
    const q = head.trim();
    if (!q || seen.has(q)) continue;
    if (risky(q, rest.join('#'))) { skipped += 1; continue; }
    seen.add(q);
    out.push({ q, seed: rest.join('#').trim() || null });
  }
  return out;
}

export function judge({ total, sampled, median, cfg, minResults, minGoods, maxGoods: ceiling }) {
  if (!total) return { outcome: 'no_listings', maxGoods: null };
  // eBay matches every word, so a six word phrase returns almost nothing. That
  // is a failure of the phrase and not of the market.
  if (sampled < minResults) return { outcome: 'too_narrow', maxGoods: null };
  if (total > cfg.maxListings) return { outcome: 'crowded', maxGoods: null };

  const maxGoods = median == null ? null : maxGoodsCost(median, cfg);
  if (maxGoods == null) return { outcome: 'no_price', maxGoods: null };
  // Under the £2 target is ours to argue with. Losing money with the goods free is the market's answer.
  if (maxGoods + cfg.minProfit <= 0) return { outcome: 'below_cost', maxGoods };
  if (minGoods > 0 && maxGoods < minGoods) return { outcome: 'too_cheap', maxGoods };
  // Above the ceiling is stock she is not buying yet, and the postage band
  // underneath the figure is wrong for anything that heavy anyway.
  if (ceiling && maxGoods > ceiling) return { outcome: 'too_dear', maxGoods };
  return { outcome: 'gate', maxGoods };
}

async function main() {
  const argv = process.argv.slice(2);
  const arg = (k, d = null) => argv.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=') ?? d;

  const file = arg('file', 'scripts/queries-demand-full.txt');
  const csvPath = arg('csv', 'scan.csv');
  const outPath = arg('out', 'scripts/queries-gated.txt');
  const start = Number(arg('start', 0));
  const max = Number(arg('max', 0));
  const minResults = Number(arg('min-results', 20));
  /*
   * The floor on what the goods can cost, not on what they do cost.
   *
   * It was £10 while candidates came from mined phrases, where a ceiling
   * arrives with no supplier behind it and had to be generous enough that
   * somebody might find stock under it. On a shelf run the price is known
   * before the market is, so a cheap product in a dearer market is the shape
   * worth having, and £10 refused exactly those. £3 drops the markets where
   * the fee stack takes everything and leaves the £2 a sale target to decide
   * the rest, per product, on figures rather than a guess.
   */
  const minGoods = Number(arg('min-goods', 0));
  const maxGoods = Number(arg('max-goods', 40));
  const fromCsv = arg('from-csv');
  // New and fixed price only. A market of used gear is not one she can source.
  // UK sellers only, matching the gate, or the two count different markets.
  const filter = arg('condition', 'new') === 'any'
    ? 'buyingOptions:{FIXED_PRICE},itemLocationCountry:GB'
    : 'conditions:{NEW},buyingOptions:{FIXED_PRICE},itemLocationCountry:GB';
  const cfg = {
    ...D,
    band: arg('band', D.band),
    maxListings: Number(arg('max-listings', D.maxListings)),
    minProfit: Number(arg('profit', D.minProfit)),
  };

  // Re-judging a scan already paid for. Thresholds move, the market does not.
  if (fromCsv) {
    const rows = readScan(fromCsv).map((r) => ({
      ...r,
      ...judge({
        total: r.total, sampled: r.sampled, median: r.median, cfg, minResults, minGoods, maxGoods,
      }),
    }));
    report(rows, { csvPath, outPath, cfg, minGoods, maxGoods, scanned: rows.length });
    return;
  }

  if (!fs.existsSync(file)) {
    console.error(`\n  ${file} not found.\n`);
    process.exit(1);
  }

  const all = readQueries(file);
  const queries = all.slice(start, max ? start + max : undefined);
  if (skipped) console.log(`\n  ${skipped} queries skipped for a word the gate cannot judge (second hand, sized, or account risk)`);

  const loaded = await loadEnvFiles(arg('env-file'));
  const cred = pickCredentials(process.env, arg('id-key'), arg('secret-key'));
  if (!cred.clientId || !cred.clientSecret) {
    console.error(`\nNo eBay credentials found. Read: ${loaded.join(', ') || 'nothing'}\n`);
    process.exit(1);
  }
  const access = await token(cred);

  console.log(`\n${queries.length} of ${all.length} phrases, ${cfg.marketplace}, one call each`);
  console.log(`  ${BANDS[cfg.band].label}, refusing over ${cfg.maxListings} listings `
    + `or under £${minGoods.toFixed(2)} to buy the goods\n`);

  const rows = [];
  let n = 0;
  let errors = 0;

  for (const { q, seed } of queries) {
    n += 1;
    let body;
    try {
      body = await search({ access, marketplace: cfg.marketplace, q, limit: 100, filter });
    } catch (e) {
      // A 429 is the day's call limit, and every call after it is refused too.
      // Carrying on wrote 700 error rows into a CSV that then looked scanned.
      if (/\b429\b/.test(e.message)) {
        console.error(`\n  eBay refused at phrase ${n}: ${e.message}`);
        console.error('  That is the daily call limit. It resets at 08:00 UK time.');
        console.error(`  Nothing written. Start again here with --start=${start + n - 1}\n`);
        process.exit(2);
      }
      errors += 1;
      rows.push({ q, seed, outcome: 'error', note: e.message });
      console.log(`  ${String(n).padStart(4)}  ERROR  ${q}  ${e.message}`);
      // Something other than the limit, and every call failing means the run
      // is not measuring a market.
      if (errors > 20 && errors === n) {
        console.error('\n  Every call has failed. Stopping rather than writing a file of errors.\n');
        process.exit(2);
      }
      continue;
    }

    const items = body.itemSummaries ?? [];
    const price = stats(items.map((i) => num(i.price?.value)));
    const total = Number(body.total ?? items.length);
    const judged = judge({
      total, sampled: items.length, median: price?.median ?? null, cfg, minResults, minGoods, maxGoods,
    });

    rows.push({
      q,
      seed,
      total,
      sampled: items.length,
      median: price?.median ?? null,
      p25: price?.p25 ?? null,
      p75: price?.p75 ?? null,
      maxGoods: judged.maxGoods,
      outcome: judged.outcome,
    });

    if (judged.outcome === 'gate') {
      console.log(`  ${String(n).padStart(4)}  £${String((judged.maxGoods ?? 0).toFixed(2)).padStart(6)} `
        + ` ${String(total).padStart(4)} listings  ${q}`);
    }
  }

  report(rows, { csvPath, outPath, cfg, minGoods, maxGoods, scanned: queries.length });
}

function readScan(path) {
  const [head, ...lines] = fs.readFileSync(path, 'utf8').trim().split(/\r?\n/);
  const cols = head.split(',');
  return lines.map((line) => {
    // Only the query and the seed are quoted, and neither carries a newline.
    const cells = line.match(/("([^"]|"")*"|[^,]*)/g).filter((_, k) => k % 2 === 0);
    const row = Object.fromEntries(cols.map((c, k) => [c, (cells[k] ?? '').replace(/^"|"$/g, '').replace(/""/g, '"')]));
    return {
      q: row.query,
      seed: row.seed || null,
      total: num(row.listings),
      sampled: num(row.sampled),
      median: num(row.median),
      p25: num(row.p25),
      p75: num(row.p75),
    };
  });
}

function report(rows, { csvPath, outPath, cfg, minGoods, maxGoods, scanned }) {
  // Applied again here so a re-judge from an old scan drops them too.
  for (const r of rows) if (r.outcome === 'gate' && risky(r.q, r.seed)) r.outcome = 'account_risk';
  const tally = rows.reduce((o, r) => ({ ...o, [r.outcome]: (o[r.outcome] ?? 0) + 1 }), {});
  const keep = rows.filter((r) => r.outcome === 'gate');

  const head = 'query,seed,listings,sampled,median,p25,p75,max_goods,outcome\n';
  fs.writeFileSync(csvPath, head + rows.map((r) => [
    cell(r.q), cell(r.seed), r.total ?? '', r.sampled ?? '',
    r.median ?? '', r.p25 ?? '', r.p75 ?? '', r.maxGoods ?? '', r.outcome,
  ].join(',')).join('\n') + '\n');

  const header = [
    `# ${keep.length} of ${scanned} phrases worth the gate, scanned ${new Date().toISOString().slice(0, 10)}.`,
    `# New, fixed price listings only, goods between £${minGoods.toFixed(2)} and £${maxGoods.toFixed(2)}.`,
    '#',
    `# Refused here: ${Object.entries(tally).filter(([k]) => k !== 'gate').map(([k, v]) => `${k} ${v}`).join(', ')}`,
    '#',
    `#   node scripts/gate.js --file=${outPath} --csv=gate-demand.csv --show`,
    '',
  ].join('\n');
  fs.writeFileSync(outPath, `${header}${keep.map((r) => `${r.q.padEnd(38)}# ${r.seed ?? ''}`.trimEnd()).join('\n')}\n`);

  console.log(`\n  ${Object.entries(tally).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  console.log(`\n  ${csvPath} written, and ${keep.length} phrases to ${outPath}.`);
  console.log(`  The gate on those costs about ${keep.length * 21} calls.`);
  console.log(`  The floor at ${BANDS[cfg.band].label} is £${priceFloor(cfg).toFixed(2)}.\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(`\nscan failed: ${e?.stack ?? e}\n`);
    process.exit(1);
  });
}
