/*
 * The entry gate. Asks one question per query: can she rank on this, and is
 * anybody buying. Standalone, no database, so it runs before the pipeline
 * rework rather than after it.
 *
 *   node scripts/gate.js --probe "pet water fountain"
 *   node scripts/gate.js --file=queries.txt --csv=gate-2026-08-30.csv
 *   node scripts/gate.js --file=queries.txt --sample=20
 *
 * Run it weekly. Each run writes a snapshot to .gate/, and from the second run
 * on it reports units sold since the last one, which is the velocity figure the
 * base developer tier does not otherwise give us.
 *
 * Needs EBAY_CLIENT_ID and EBAY_CLIENT_SECRET.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

import { D, BANDS, bandOf, headroomAt, maxGoodsCost, priceFloor, stats, unitsNeeded } from './lib/cost.js';
import { parseEnv, loadEnvFiles, pickCredentials } from './lib/env.js';
import { token, search, getItem } from './lib/ebay.js';
import { readSeller, readBrand, brandIsOpen, routeOf, readSold, readAge } from './lib/listing.js';
import { verdict, worthOf } from './lib/verdict.js';
import { assess, entryOf } from './lib/market.js';
import { SNAP_DIR, priorSnapshot, deltas } from './lib/snapshot.js';

/*
 * Everything the other scripts import from here, still available from here.
 * scan.js, limits.js and the probes were written against gate.js and should
 * not have to change because a file was split.
 */
export {
  D, BANDS, bandOf, headroomAt, maxGoodsCost, priceFloor, stats, unitsNeeded,
  parseEnv, loadEnvFiles, pickCredentials,
  token, search, getItem,
  readSeller, readBrand, brandIsOpen, routeOf, readSold, readAge,
  verdict, worthOf, assess, deltas,
};

// ----------------------------------------------------------------------- main

function parseArgs(argv) {
  const get = (k, d) => {
    const hit = argv.find((a) => a.startsWith(`--${k}=`));
    return hit === undefined ? d : hit.split('=').slice(1).join('=');
  };
  return {
    probe: argv.includes('--probe'),
    show: argv.includes('--show'),
    file: get('file', null),
    csv: get('csv', null),
    envFile: get('env', null),
    idKey: get('id-key', null),
    secretKey: get('secret-key', null),
    queries: argv.filter((a) => !a.startsWith('--')),
    // Re-judge a finished run instead of reading the market again.
    fromSnapshot: get('from-snapshot'),
    out: get('out'),
    cfg: {
      ...D,
      marketplace: get('marketplace', D.marketplace),
      sample: Number(get('sample', D.sample)),
      maxFeedback: Number(get('max-feedback', D.maxFeedback)),
      minProfit: Number(get('profit', get('min-profit', D.minProfit))),
      maxListings: Number(get('max-listings', D.maxListings)),
      minMarketPerMonth: Number(get('min-market', D.minMarketPerMonth)),
      minEntrySold: Number(get('min-entry-sold', D.minEntrySold)),
      requireEntry: get('entry', 'proved') !== 'any',
      goodsFloor: Number(get('min-goods', D.goodsFloor)),
      goodsCeiling: Number(get('max-goods', D.goodsCeiling)),
      bandTrustAbove: Number(get('band-trust', D.bandTrustAbove)),
      filter: get('condition', 'new') === 'any' ? 'buyingOptions:{FIXED_PRICE},itemLocationCountry:GB' : D.filter,
      untestedMaxListings: Number(get('untested-max-listings', D.untestedMaxListings)),
      minEntryPerMonth: Number(get('min-entry-rate', D.minEntryPerMonth)),
      youngDays: Number(get('young-days', D.youngDays)),
      minAgeDays: Number(get('min-age', D.minAgeDays)),
      band: get('band', D.band),
      categoryIds: get('category', null),
    },
  };
}

// The CSV the importer reads. Shared, because a re-judged run has to produce
// the same file a measured run does or its new verdicts reach nobody.
async function writeCsv(csvPath, results, cfg) {

    // CSV quoting doubles the quote; JSON.stringify escapes it, which breaks JSON and titles with inches.
    const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const head = 'query,competitors,median_price,headroom,max_goods_cost,band,observed_units_per_month,'
      + 'entry_proved,entry_age_days,entry_seller_feedback,entry_sold,entry_price,entry_per_day,'
      + 'entry_item_id,image_url,price_low,price_high,price_band,price_p25,price_p75,'
      + 'lowest_feedback,sold_lifetime,listings_with_sold,route,'
      + 'unbranded_share,top_brands,outcome,best_price,best_units_per_month,best_max_goods,reasons,'
      + 'entry_title,entry_ceiling,refusal,listings,median_listed,price_basis,selling_seen\n';
    const rows = results.map((r) => [
      JSON.stringify(r.q), r.competitors, r.price?.median ?? '',
      r.headroom ?? '', r.maxGoods ?? '', r.band ?? '',
      r.observedPerMonth ?? '', r.entry?.proved ?? '', r.entry?.ageDays ?? '',
      r.entry?.sellerFeedback ?? '', r.entry?.soldLifetime ?? '',
      r.entry?.priceGbp ?? '', r.entry?.soldPerDay ?? '',
      r.entry?.itemId ?? '', JSON.stringify(r.imageUrl ?? ''),
      r.price?.min ?? '', r.price?.max ?? '',
      // The interquartile range over the median. Under 0.15 the sellers have
      // converged and there is nothing to position on but price.
      r.price && r.price.median ? Math.round(((r.price.p75 - r.price.p25) / r.price.median) * 1000) / 1000 : '',
      r.price?.p25 ?? '', r.price?.p75 ?? '',
      r.feedback?.min ?? '',
      r.soldTotal ?? '', r.soldKnown,
      r.sourcing?.route ?? '', r.sourcing?.openShare ?? '', JSON.stringify((r.sourcing?.top ?? []).join(' / ')),
      r.verdict.outcome,
      r.worth?.price ?? '', r.worth?.perMonth ?? '', r.worth?.monthlyProfit ?? '',
      JSON.stringify(r.verdict.reasons.join('; ')),
      cell(r.entry?.title), cfg.maxFeedback, r.verdict.codes.join('|'),
      cell(JSON.stringify((r.listings ?? []).map((l) => ({
        item_id: l.itemId,
        title: l.title,
        brand: l.brand,
        gtin: l.gtin ?? null,
        price: l.priceGbp,
        per_month: l.rateTrusted && l.soldPerDay != null ? Math.round(l.soldPerDay * 300) / 10 : null,
        sold: l.soldLifetime,
        age_days: l.ageDays,
        feedback: l.sellerFeedback,
      })))),
      r.price?.listedMedian ?? '', r.price?.basis ?? '', r.price?.sellingSeen ?? '',
    ].join(','));
    await writeFile(csvPath, head + rows.join('\n') + '\n');
}

async function main() {
  const a = parseArgs(process.argv.slice(2));

  let queries = a.queries;
  if (a.file) {
    const text = await readFile(a.file, 'utf8');
    // A trailing comment is part of the line, not part of the query. Without
    // this the 4 September sweep run searched eBay for "hedgehog house habitat
    // # Hedgehog Houses, £11.21" and the comment ended up in the product title
    // on her review screen.
    queries = text.split(/\r?\n/)
      .map((x) => x.split('#')[0].trim())
      .filter(Boolean);
  }
  if (!queries.length && !a.fromSnapshot) {
    console.error('Give queries as arguments or with --file=queries.txt');
    process.exit(1);
  }

  /*
   * Re-judging what a run already measured.
   *
   * A snapshot holds every listing the gate read, so moving a threshold does
   * not need the market read again. Changing the goods floor from £10 to £3
   * would otherwise have meant re-running 164 queries at 7 calls each to learn
   * what was already on disk.
   *
   * It writes no snapshot of its own: the market was measured once, and a
   * second file at today's timestamp would make the next run's sold-since
   * figures compare a market with itself.
   */
  if (a.fromSnapshot) {
    const snap = JSON.parse(await readFile(a.fromSnapshot, 'utf8'));
    const was = snap.cfg ?? {};
    const rows = (snap.results ?? []).map((saved) => {
      // Entry is worked out again from the listings the snapshot kept, under today's rules.
      const r = saved.listings?.length ? { ...saved, entry: entryOf(saved.listings, a.cfg) } : saved;
      const v = verdict(r, a.cfg);
      return { ...r, verdict: v, worth: worthOf(r, a.cfg) };
    });

    console.log(`\n${rows.length} queries re-judged from ${a.fromSnapshot}, read ${String(snap.at).slice(0, 16)}`);
    console.log(`  goods £${(was.goodsFloor ?? 0).toFixed(2)} to £${(was.goodsCeiling ?? 0).toFixed(2)} `
      + `then, £${a.cfg.goodsFloor.toFixed(2)} to £${a.cfg.goodsCeiling.toFixed(2)} now. No calls spent.\n`);

    let changed = 0;
    for (const r of rows) {
      const before = (snap.results.find((x) => x.q === r.q)?.verdict ?? {}).outcome;
      const now = r.verdict.outcome;
      if (before !== now) changed += 1;
      if (now !== 'pass' && before === now) continue;
      const mark = now === 'pass' ? 'PASS ' : now === 'review' ? 'SET ASIDE' : 'FAIL ';
      const move = before === now ? '' : `  (was ${before})`;
      console.log(`  ${mark}  ${r.q.padEnd(34)}  ${r.maxGoods == null ? '' : `pay up to £${r.maxGoods.toFixed(2)}`}${move}`);
      for (const reason of r.verdict.reasons) console.log(`         ${reason}`);
    }

    const tally = rows.reduce((o, r) => ({ ...o, [r.verdict.outcome]: (o[r.verdict.outcome] ?? 0) + 1 }), {});
    console.log(`\n  ${Object.entries(tally).map(([k, v]) => `${k} ${v}`).join(', ')}, ${changed} changed verdict`);

    if (a.out) {
      const keep = rows.filter((r) => r.verdict.outcome === 'pass').map((r) => r.q);
      await writeFile(a.out, `${keep.join('\n')}\n`);
      console.log(`  ${keep.length} passing queries written to ${a.out}`);
    }
    // The same file a measured run writes, so the importer sees the new
    // verdicts. Without it a re-judge changed the screen and nothing else.
    if (a.csv) {
      await writeCsv(a.csv, rows, a.cfg);
      console.log(`  ${a.csv} written, ready to import`);
    }
    console.log('');
    return;
  }

  const loaded = await loadEnvFiles(a.envFile);
  const cred = pickCredentials(process.env, a.idKey, a.secretKey);

  if (!cred.clientId || !cred.clientSecret) {
    console.error(`\nNo eBay credentials found. Read: ${loaded.join(', ') || 'nothing'}`);
    // Names only, never values. A "not set" with no evidence is what cost the
    // last run, so this says what it can actually see.
    const seen = Object.keys(process.env).filter((k) => /ebay/i.test(k)).sort();
    console.error(seen.length
      ? `\nKeys containing "ebay" that are present:\n  ${seen.join('\n  ')}\n\nRe-run naming them:\n  node scripts/gate.js --id-key=NAME --secret-key=NAME "your query"\n`
      : '\nNothing containing "ebay" is set at all. Check the file is at the repo root and try --env=path/to/file\n');
    process.exit(1);
  }

  console.log(`\ncredentials: ${cred.idKey} and ${cred.secretKey}, from ${loaded.join(', ') || 'the environment'}`);

  const access = await token(cred);
  const results = [];

  console.log(`\n${queries.length} queries, ${a.cfg.marketplace}, sampling ${a.cfg.sample} listings each\n`);

  let limited = null;
  // Ctrl+C used to throw the whole run away, calls and all. The first press now finishes the
  // query in hand and saves; a second one quits outright.
  let interrupted = false;
  process.on('SIGINT', () => {
    if (interrupted) process.exit(130);
    interrupted = true;
    console.log('\n  Stopping after this query and saving what is done. Ctrl+C again to quit without saving.');
  });
  for (const [i, q] of queries.entries()) {
    if (interrupted) { limited = { at: i, message: 'stopped with Ctrl+C', byHand: true }; break; }
    let r;
    try {
      r = await assess({ access, marketplace: a.cfg.marketplace, q, cfg: a.cfg, probe: a.probe });
    } catch (e) {
      // Every call after a 429 is refused too, and carrying on left those queries silently ungated.
      if (/\b429\b/.test(e.message)) { limited = { at: i, message: e.message }; break; }
      console.log(`  ERROR  ${q}  ${e.message}`);
      continue;
    }
    const v = verdict(r, a.cfg);
    const worth = worthOf(r, a.cfg);
    results.push({ ...r, verdict: v, worth });

    const mark = v.outcome === 'pass' ? (v.unknown ? 'PASS?' : 'PASS ')
      : v.outcome === 'review' ? 'SET ASIDE' : 'FAIL ';
    const rate = r.observedPerMonth == null ? 'rate unknown' : `~${r.observedPerMonth}/month in the top ${r.sampled}`;
    const pr = r.price ? `median £${r.price.median.toFixed(2)}` : 'no prices';
    const pf = r.maxGoods == null ? '' : `pay up to £${r.maxGoods.toFixed(2)}`;

    const rt = r.sourcing?.route && r.sourcing.route !== 'unknown' ? r.sourcing.route : '?';

    console.log(`  ${mark}  ${q.padEnd(34)}  ${String(r.competitors).padStart(6)} listings  ${rate.padEnd(26)}  ${pr.padEnd(16)}  ${String(pf).padEnd(14)}  ${rt}`);
    for (const reason of v.reasons) console.log(`         ${reason}`);

    if (a.show) {
      for (const l of r.listings) {
        console.log(`           £${String(l.priceGbp ?? '?').padStart(6)}  ${String(l.ageDays ?? '?').padStart(4)}d  `
          + `${String(l.soldLifetime ?? '?').padStart(5)} sold  ${String(l.soldPerDay ?? '?').padStart(5)}/day  `
          + `fb ${String(l.sellerFeedback ?? '?').padStart(6)}  ${String(l.brand ?? '?').slice(0, 14).padEnd(14)}  ${String(l.title ?? '').slice(0, 46)}`);
      }
    }
  }

  // Nothing is dropped for breaking a rule we chose without saying what it cost.
  const aside = results.filter((r) => r.verdict.outcome === 'review')
    .sort((a2, b2) => (b2.worth?.monthlyProfit ?? -1) - (a2.worth?.monthlyProfit ?? -1));

  if (aside.length) {
    console.log(`\nSET ASIDE, ${aside.length}. Broke a threshold we set, market may be fine.\n`);
    for (const r of aside) {
      const w = r.worth;
      console.log(`  ${r.q}`);
      console.log(`    ${r.verdict.policy.join('; ')}`);
      if (w) {
        console.log(`    best listing: £${w.price.toFixed(2)}, ${w.ageDays} days old, `
          + `${w.perMonth}/month, seller feedback ${w.sellerFeedback}`);
        console.log(`    at our cost base that is £${w.unitProfit?.toFixed(2)} a unit, `
          + `about £${w.monthlyProfit} a month from one listing`);
      } else {
        console.log('    no listing in the sample is selling, so there is no figure to weigh');
      }
    }
    console.log('\n  Review these before the next run. Raise the floor or take them, but decide.');
  }

  const snapshot = { at: new Date().toISOString(), marketplace: a.cfg.marketplace, cfg: a.cfg, results };
  await mkdir(SNAP_DIR, { recursive: true });
  const name = `${snapshot.at.replace(/[:.]/g, '-')}.json`;
  const prior = await priorSnapshot();
  await writeFile(path.join(SNAP_DIR, name), JSON.stringify(snapshot, null, 1));

  const d = deltas(snapshot, prior);
  if (d) {
    console.log(`\nSOLD SINCE THE LAST RUN, ${d.sincePriorDays} days ago\n`);
    for (const row of d.rows) {
      const v = row.movedSincePrior == null ? 'no listings matched' : `${row.movedSincePrior} units over ${row.listingsMatched} listings`;
      console.log(`  ${row.q.padEnd(34)}  ${v}`);
    }
  } else {
    console.log('\nFirst run, so no velocity yet. Run it again in seven days.');
  }

  if (a.csv) {
    await writeCsv(a.csv, results, a.cfg);
    console.log(`\n${a.csv} written.`);
  }

  const n = (o) => results.filter((r) => r.verdict.outcome === o).length;
  console.log(`\n${n('pass')} passed, ${n('review')} set aside, ${n('fail')} failed, of ${results.length}. `
    + `Snapshot in ${SNAP_DIR}/${name}\n`);
  console.log('Nothing here is sourced. A pass means she can rank and somebody is buying.\n');

  if (limited) {
    const rest = queries.slice(limited.at);
    const restFile = `${String(a.file || 'queries').replace(/\.txt$/i, '')}-rest.txt`;
    await writeFile(restFile, rest.join('\n') + '\n');
    if (limited.byHand) {
      console.error(`Stopped at query ${limited.at + 1} of ${queries.length}. ${rest.length} not gated, written to ${restFile}.`);
      console.error('Gate that file when ready, with a different --csv so this one is kept.\n');
    } else {
      console.error(`eBay refused at query ${limited.at + 1} of ${queries.length}: ${limited.message}`);
      console.error(`That is the daily limit. ${rest.length} not gated, written to ${restFile}.`);
      console.error('Gate that file after the reset, with a different --csv so this one is kept.\n');
    }
    process.exit(2);
  }
}

// Comparing import.meta.url to a raw argv path is a Windows trap: file:///C:/...
// against C:\... never matches, so main never ran and the script exited silently.
const invokedDirectly = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  main().catch((e) => {
    console.error(`\ngate failed: ${e?.stack ?? e}\n`);
    process.exit(1);
  });
}
