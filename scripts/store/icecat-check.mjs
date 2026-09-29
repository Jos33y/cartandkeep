/*
 * How many store picks have brand-approved photos in Open Icecat, the free catalogue brands sponsor for online shops.
 * Looks each up by barcode, else by brand and model number. Reads one product a second; no eBay calls.
 *
 *   node scripts/store/icecat-check.mjs --top=200
 *
 * Writes research/picks/icecat.csv. Prints the first reply's shape, so the fields it reads can be confirmed.
 */
import fs from 'node:fs';
import { parseCsv } from '../lib/sources.js';
import { modelsIn } from './match.mjs';

const arg = (k, d = null) => process.argv.slice(2).find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=') ?? d;
const picksPath = arg('picks', fs.existsSync('research/picks/checked.csv') ? 'research/picks/checked.csv' : 'research/picks/all.csv');
const out = arg('out', 'research/picks/icecat.csv');
const top = arg('top', 'all') === 'all' ? Infinity : Number(arg('top'));
const user = arg('user', 'openIcecat-live');
const pause = Number(arg('pause', 1000));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Every string under a key that names a picture, wherever the reply keeps it.
function picturesIn(node, found = []) {
  if (Array.isArray(node)) { for (const n of node) picturesIn(n, found); return found; }
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (typeof v === 'string' && /pic|image/i.test(k) && /^https?:\/\/.+\.(jpe?g|png|webp)/i.test(v)) found.push(v);
      else picturesIn(v, found);
    }
  }
  return found;
}
const statusOf = (body) => body?.StatusCode ?? body?.statusCode ?? body?.data?.StatusCode ?? null;
const titleOf = (body) => body?.data?.GeneralInfo?.Title ?? body?.data?.GeneralInfo?.ProductName ?? '';

function shape(node, depth = 0) {
  if (depth > 2 || !node || typeof node !== 'object') return typeof node;
  return Object.fromEntries(Object.entries(node).slice(0, 12).map(([k, v]) => [k, shape(v, depth + 1)]));
}

const rows = parseCsv(fs.readFileSync(picksPath, 'utf8'))
  .filter((r) => !/^wrong/.test(r.verdict ?? ''))
  .slice(0, top);
const results = [];
const tally = { looked_up: 0, photos: 0, no_photos: 0, full_icecat_only: 0, not_found: 0, no_identifier: 0, failed: 0 };
let shown = false;

for (const [i, r] of rows.entries()) {
  const gtin = String(r.gtin ?? '').replace(/\D/g, '');
  const model = modelsIn(r.title)[0];
  const by = gtin ? `GTIN=${gtin}` : model && r.brand ? `Brand=${encodeURIComponent(r.brand)}&ProductCode=${encodeURIComponent(model.toUpperCase())}` : null;
  if (!by) { tally.no_identifier += 1; results.push({ ...r, icecat: 'no barcode or model', icecat_title: '', icecat_images: 0, icecat_image: '' }); continue; }

  let verdict = 'failed';
  let pics = [];
  let title = '';
  try {
    const res = await fetch(`https://live.icecat.biz/api?lang=EN&shopname=${encodeURIComponent(user)}&${by}`, { signal: AbortSignal.timeout(20000) });
    const body = await res.json().catch(() => null);
    if (!shown && body) { console.log('\n  First reply, top of its structure:\n', JSON.stringify(shape(body), null, 1).slice(0, 1500), '\n'); shown = true; }
    const code = Number(statusOf(body));
    pics = [...new Set(picturesIn(body?.data ?? {}))];
    title = titleOf(body);
    if (code === 9) verdict = 'full icecat only';
    else if (code === 4 || res.status === 404) verdict = 'not found';
    else if (pics.length) verdict = 'photos';
    else if (body?.data) verdict = 'no photos';
  } catch (e) {
    verdict = `failed (${e.name})`;
  }
  tally.looked_up += 1;
  const key = verdict.startsWith('failed') ? 'failed' : verdict.replace(/ /g, '_');
  tally[key] = (tally[key] ?? 0) + 1;
  results.push({ ...r, icecat: verdict, icecat_title: title, icecat_images: pics.length, icecat_image: pics[0] ?? '' });
  console.log(`  ${String(i + 1).padStart(4)}/${rows.length}  ${verdict.padEnd(18)} ${String(r.title).slice(0, 50)}`);
  await sleep(pause);
}

const cols = Object.keys(results[0] ?? { title: '' });
const cell = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
fs.writeFileSync(out, [cols.join(','), ...results.map((x) => cols.map((c) => cell(x[c])).join(','))].join('\n') + '\n', 'utf8');

console.log(`\n  ${rows.length} picks: ${Object.entries(tally).filter(([, v]) => v).map(([k, v]) => `${k.replace(/_/g, ' ')} ${v}`).join(', ')}`);
console.log(`  ${out}\n`);
