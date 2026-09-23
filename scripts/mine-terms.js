/*
 * What buyers actually type into eBay, mined from eBay's own suggestion box.
 *
 * Every query file on this project so far has come from one of three places:
 * her catalogue, which is real but exhausted; live listing titles, which are
 * supply and tell you what sellers decided to stock; or my head, which is worth
 * nothing. This is the first one that reads demand.
 *
 * The suggestion service is what the eBay search box calls on every keystroke.
 * It returns phrases real people have typed, ranked, with the long tail
 * attached. No key, no quota published, no cost.
 *
 * Usage:
 *   node scripts/mine-terms.js --probe --url="<paste from DevTools>"
 *   node scripts/mine-terms.js --seeds=scripts/seeds.txt --out=scripts/queries-demand.txt
 *   node scripts/mine-terms.js --alphabet=2 --out=scripts/queries-demand.txt
 *   node scripts/mine-terms.js --alphabet=2 --cats=11778,26395 --out=...
 *
 * Finding the endpoint, once:
 *   ebay.co.uk, F12, Network, filter XHR, type slowly into the search box.
 *   A request fires per keystroke. Copy its URL, put {q} where your typed
 *   letters appear, and pass it as --url. Probe first, always.
 *
 * The URL is a parameter rather than a constant on purpose. It is undocumented,
 * so it will change, and a constant would mean a code change every time rather
 * than a flag.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const D = {
  // A best guess at the current endpoint, and it is a guess. --probe before
  // trusting a run, because a wrong URL returns an empty list rather than an
  // error and a silent zero looks exactly like a category with no demand.
  url: 'https://autosug.ebay.com/autosug?kwd={q}&sId=3&_help=0&_jgs=1&_jgr=1&_ai=0',
  depth: 1,          // 1 is the seed alone, 2 expands with a to z
  delayMs: 250,      // polite, and it is not our service
  minWords: 2,       // one word is a department
  maxWords: 5,
  perSeed: 60,
};

const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');

/*
 * Prefixes, from nothing.
 *
 * Seeds were the weak link. A seed list is somebody choosing what to look for,
 * and on this project both available choosers are compromised: her catalogue
 * never sold, and mine is recall dressed as research.
 *
 * The endpoint takes any prefix, so the alphabet itself is a seed list nobody
 * wrote. One letter is 26 requests and returns the head of the market. Two is
 * 676 and reaches the long tail. What comes back is what people typed, and no
 * opinion has touched it.
 */
export function prefixes(depth) {
  let out = [''];
  for (let i = 0; i < depth; i += 1) {
    out = out.flatMap((p) => LETTERS.map((l) => p + l));
  }
  return out;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/*
 * The live response, confirmed 2026-09-07:
 *
 *   /**\/vjo.darwin.domain.finding.autofill.AutoFill._do({"prefix":"bed rail",
 *     "res":{"sug":["bed rail for elderly", ...],
 *            "categories":[[11778,"Medical & Mobility"]]}})
 *
 * So res.sug is read directly where it exists. The walk is kept as a fallback
 * because the shape is undocumented and will move, and a scraper that only
 * knows one field returns silent zeros the day it changes.
 *
 * categories is the useful accident: eBay saying which part of its own tree the
 * demand sits in. Those ids go straight into sweep.js --cats.
 */
export function extract(body) {
  let text = String(body ?? '').trim();

  // JSONP: a callback name wrapped round the payload.
  const open = text.indexOf('(');
  const close = text.lastIndexOf(')');
  if (open > 0 && close > open && !text.startsWith('{') && !text.startsWith('[')) {
    text = text.slice(open + 1, close);
  }

  let data;
  try { data = JSON.parse(text); } catch { return { phrases: [], categories: [] }; }

  const prefix = String(data?.prefix ?? '').trim().toLowerCase();

  const categories = Array.isArray(data?.res?.categories)
    ? data.res.categories
      .filter((c) => Array.isArray(c) && c.length >= 2)
      .map(([id, name]) => ({ id: String(id), name: String(name) }))
    : [];

  // Category names are not search phrases. "Medical & Mobility" was being
  // collected as if somebody had typed it.
  const categoryNames = new Set(categories.map((c) => c.name.toLowerCase()));

  const clean = (list) => {
    const seen = new Set();
    return list
      .map((x) => String(x).trim())
      .filter((x) => {
        const k = x.toLowerCase();
        // The prefix is what was typed, not a suggestion, and it comes back in
        // the list as well as in its own field.
        if (!x || k === prefix || categoryNames.has(k) || seen.has(k)) return false;
        if (x.length >= 60 || !/\s/.test(x)) return false;
        if (!/^[a-z0-9][a-z0-9 '&+.-]*$/i.test(x)) return false;
        seen.add(k);
        return true;
      });
  };

  if (Array.isArray(data?.res?.sug)) {
    return { phrases: clean(data.res.sug), categories };
  }

  const out = [];
  const walk = (node) => {
    if (typeof node === 'string') { out.push(node); return; }
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (node && typeof node === 'object') { Object.values(node).forEach(walk); }
  };
  walk(data);
  return { phrases: clean(out), categories };
}

async function suggest(seed, url) {
  const target = url.replace('{q}', encodeURIComponent(seed));
  const res = await fetch(target, {
    headers: {
      // Without a browser-shaped request the service answers differently.
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      accept: '*/*',
      'accept-language': 'en-GB,en;q=0.9',
    },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return extract(await res.text());
}

const arg = (args, k, d = null) =>
  args.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=') ?? d;

async function main() {
  const args = process.argv.slice(2);
  const url = arg(args, 'url', D.url);

  if (args.includes('--probe')) {
    const seed = arg(args, 'seed', 'bed rail');
    console.log(`\nprobing with "${seed}"`);
    console.log(url.replace('{q}', encodeURIComponent(seed)), '\n');
    try {
      const res = await fetch(url.replace('{q}', encodeURIComponent(seed)), {
        headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', accept: '*/*' },
      });
      const body = await res.text();
      console.log(`HTTP ${res.status}, ${body.length} bytes\n`);
      console.log(body.slice(0, 600));
      const { phrases: found, categories } = extract(body);
      console.log(`\nphrases recognised: ${found.length}`);
      found.slice(0, 15).forEach((p) => console.log('  ', p));
      if (categories.length) {
        console.log('\ncategory eBay puts this demand in:');
        categories.forEach((c) => console.log(`   ${c.id}  ${c.name}`));
      }
      if (!found.length) {
        console.log('\n  Nothing recognised. Either the URL is wrong, or the shape has');
        console.log('  changed and extractPhrases needs to learn it. The raw body is');
        console.log('  printed above, which is the thing to read.\n');
      }
    } catch (e) {
      console.error('\nfailed:', e.message);
      console.error('Check the URL, and that {q} marks where the typed letters go.\n');
    }
    return;
  }

  const alphabet = arg(args, 'alphabet');
  const seedsFile = arg(args, 'seeds');
  if (!alphabet && !seedsFile) {
    console.error('\n  --alphabet=2 to mine the market from nothing, or');
    console.error('  --seeds=file to expand terms you already have. --probe first.\n');
    process.exit(1);
  }

  // Keep only phrases eBay files under these categories. Nothing is refused on
  // its way in: the whole marketplace is collected and then cut, because a
  // filter applied before collection is a choice about what to look for and
  // that is the thing being avoided.
  const keepCats = new Set((arg(args, 'cats', '') || '').split(',').map((x) => x.trim()).filter(Boolean));

  const out = arg(args, 'out', 'scripts/queries-demand.txt');
  // Alphabet mode is already a full traversal, so the a to z expansion on top
  // would be 676 times 27 requests to say the same thing.
  const depth = alphabet ? 1 : Number(arg(args, 'depth', D.depth));
  const perSeed = Number(arg(args, 'per-seed', D.perSeed));

  const seeds = alphabet
    ? prefixes(Number(alphabet))
    : (await readFile(seedsFile, 'utf8'))
      .split(/\r?\n/)
      .map((x) => x.split('#')[0].trim())
      .filter(Boolean);

  if (alphabet) console.log(`\nmining the alphabet at ${alphabet} letters, no seed list`);
  console.log(`\n${seeds.length} seeds, depth ${depth}`);
  if (depth > 1) console.log(`  ${seeds.length * 27} requests, roughly ${Math.round(seeds.length * 27 * D.delayMs / 1000)}s\n`);
  else console.log(`  ${seeds.length} requests\n`);

  // Which seed produced a phrase is worth keeping. A seed that returns nothing
  // is a seed nobody searches, which is itself a finding.
  const found = new Map();
  // eBay's own answer to which part of the tree each seed lives in. Free with
  // every response, and the ids feed sweep.js --cats directly.
  const cats = new Map();
  let empty = 0;

  for (const seed of seeds) {
    // Depth 2 walks the alphabet after the seed, which is where the long tail
    // lives: "bed rail" gives the head, "bed rail f" gives folding.
    const probes = depth > 1 ? [seed, ...LETTERS.map((l) => `${seed} ${l}`)] : [seed];
    let got = 0;

    for (const p of probes) {
      try {
        const { phrases, categories } = await suggest(p, url);
        for (const c of categories) {
          if (!cats.has(c.id)) cats.set(c.id, { ...c, seeds: new Set() });
          cats.get(c.id).seeds.add(seed);
        }
        for (const phrase of phrases) {
          const words = phrase.split(/\s+/).length;
          if (words < D.minWords || words > D.maxWords) continue;
          if (!found.has(phrase)) {
            // The categories come per request, not per phrase, so they are the
            // categories of the prefix that produced it. Good enough to filter
            // on, not good enough to quote as the product's category.
            found.set(phrase, { seed, cats: categories.map((c) => c.id) });
            got += 1;
          }
          if (got >= perSeed) break;
        }
      } catch (e) {
        console.error(`  ${p}: ${e.message}`);
      }
      await sleep(D.delayMs);
      if (got >= perSeed) break;
    }

    if (!got) empty += 1;
    // 676 lines of nothing is not a report. In alphabet mode only the prefixes
    // that returned something are worth printing.
    if (got || !alphabet) console.log(`  ${String(got).padStart(3)}  ${seed}`);
  }

  if (!found.size) {
    console.error('\n  Nothing came back at all. Run --probe before assuming there is');
    console.error('  no demand: an endpoint that has moved returns an empty list, and');
    console.error('  an empty list looks exactly like a dead category.\n');
    process.exit(1);
  }

  const kept = [...found.entries()]
    .filter(([, v]) => !keepCats.size || v.cats.some((c) => keepCats.has(c)));
  const cut = found.size - kept.length;

  const rows = kept.sort((a, b) => a[1].seed.localeCompare(b[1].seed) || a[0].localeCompare(b[0]));
  const lines = [
    `# ${rows.length} phrases real people typed into eBay.`,
    `# ${alphabet ? `Mined from the alphabet at ${alphabet} letters, no seed list.` : `From ${seeds.length} seeds at depth ${depth}.`}`,
    '#',
    '# Demand, not supply. Listing titles tell you what sellers decided to',
    '# stock, which is a crowd following each other. This is what buyers went',
    '# looking for.',
    '#',
    '# There is no volume here. The suggestion box ranks but does not count, so',
    '# a phrase near the top is searched more than one near the bottom and',
    '# nobody can say how much more. Terapeak carries the numbers.',
    '#',
    `#   node scripts/gate.js --file=${out} --csv=gate-demand.csv --show`,
    '',
    ...rows.map(([phrase, v]) => `${phrase}${' '.repeat(Math.max(1, 36 - phrase.length))}# ${v.seed}`),
    '',
  ];

  await writeFile(out, lines.join('\n'));
  console.log(`\n${out} written, ${rows.length} phrases.`);

  if (cats.size) {
    const ranked = [...cats.values()].sort((a, b) => b.seeds.size - a.seeds.size);
    const catFile = out.replace(/\.txt$/, '-categories.txt');
    await writeFile(catFile, [
      `# ${ranked.length} categories eBay associates with these seeds, most seeds first.`,
      '#',
      '# Not guessed at and not chosen from the tree by hand: this is eBay saying',
      '# where the demand for each seed sits. A sweep pointed here is looking',
      '# where buyers already are rather than where the tree happens to be deep.',
      '#',
      `#   node scripts/sweep.js --cats=${ranked.slice(0, 12).map((c) => c.id).join(',')} --csv=sweep.csv --queries=scripts/queries-sweep.txt`,
      '',
      ...ranked.map((c) => `${c.id}${' '.repeat(Math.max(1, 10 - c.id.length))}# ${c.name}, from ${[...c.seeds].join(', ')}`),
      '',
    ].join('\n'));
    console.log(`${catFile} written, ${ranked.length} categories.`);
  }
  if (cut) console.log(`${cut} phrases cut, outside the categories asked for.`);
  if (empty) console.log(`${empty} prefixes returned nothing.`);
  console.log(`\nAt 21 calls a query the gate would spend about ${rows.length * 21}. Split it.\n`);
}

// Guarded so extractPhrases can be tested without the miner running. Comparing
// import.meta.url to a raw argv path never matches on Windows.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
