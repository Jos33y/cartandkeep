// CPC's product pages are closed to readers, but its sitemaps are published for crawlers, and every product
// link carries the brand, the part number and a description:
//   /samsung-electro-mechanics/cl21b105kbfnnne/cap-1uf-50v-mlcc-0805/dp/CA10398
// That is enough to draft a brand-and-part query. No product page is fetched.
//
//   node scripts/shelf-cpc.mjs                 consumer ranges only
//   node scripts/shelf-cpc.mjs --all           every product, components included
//   node scripts/shelf-cpc.mjs --brands=behringer,philips,duracell

import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')).map(([k, ...v]) => [k, v.join('=') || true])
);
const BASE = process.env.CPC_BASE || 'https://cpc.farnell.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const dir = join('research', 'shelf');
const brands = args.brands ? String(args.brands).toLowerCase().split(',').map((b) => b.trim()).filter(Boolean) : null;

// What a household buyer searches for by name. Read against the description words only.
const CONSUMER = /\b(hdmi|usb|cable|cables|lead|leads|adapter|adaptor|charger|chargers|battery|batteries|speaker|speakers|headphone|headphones|earphones|earbuds|headset|microphone|mic|amplifier|soundbar|radio|dab|tv|television|aerial|satellite|remote|bracket|mount|bulb|bulbs|lamp|lamps|led|light|lights|lighting|torch|lantern|extension|plug|plugs|kettle|toaster|heater|fan|vacuum|iron|hairdryer|shaver|trimmer|clock|alarm|doorbell|camera|cctv|smoke|detector|thermostat|timer|drill|screwdriver|spanner|pliers|wrench|multimeter|tester|soldering|solder|glue|tape|printer|ink|toner|keyboard|mouse|webcam|router|hub|powerbank|inverter|solar|controller|turntable|projector|monitor|tablet|phone|intercom|walkie|scale|scales|thermometer|dehumidifier|humidifier|purifier|blender|mixer|shredder|laminator|calculator|stapler|laser|level|ladder|workbench|toolbox|socket|sockets)\b/;
// Parts that go inside other things. Few household buyers, and tiny eBay markets.
const COMPONENT = /\b(mlcc|smd|smt|resistor|res|cap|capacitor|inductor|ic|mcu|transistor|mosfet|diode|crimp|contact|pin|pins|header|pcb|trimmer pot|pot|relay|ferrite|terminal|oscillator|crystal|optocoupler|regulator|rectifier|thyristor|triac|varistor|thermistor|choke|bobbin|heatsink|dil|sip|sod|sot|qfn|bga|tqfp)\b/;

// Trade quantities: packs of 100, 100 metre drums. Her buyer wants one.
const BULK = /\b(pk|pack|box|bag|x)\s?(50|100|200|250|500|1000)\b|\b(50|100|200|250|500|1000)\s?(pk|pack|pcs?)\b|\b\d{3,}\s?m\b|\b(reel|drum)\b/;
// Sized clothing, which the rest of the pipeline also leaves out.
const SIZED_BRAND = /workwear|clothing|footwear|apparel/;

const title = (slug) => slug.split('-').filter(Boolean)
  .map((w) => (/\d/.test(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1))).join(' ');

async function text(url) {
  const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/xml,text/xml,*/*' }, signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`${res.status} on ${url}`);
  return res.text();
}
const locs = (xml) => [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, '&'));

const index = locs(await text(`${BASE}/sitemap.xml`));
// Product detail sitemaps are the "pdpd" ones; categories, brands and custom pages are left alone.
const productMaps = index.filter((u) => /cpc-pdpd-[^/]+\.xml$/i.test(u) || /new-products/i.test(u));
console.log(`\n  ${productMaps.length} product sitemaps of ${index.length} listed`);

const seen = new Set();
const rows = [];
let total = 0, parts = 0, notChosen = 0;
for (const map of productMaps) {
  let urls;
  try { urls = locs(await text(map)); } catch (e) { console.log(`  skipped ${map.split('/').pop()}: ${e.message}`); continue; }
  for (const u of urls) {
    // /brand/part/description/dp/CODE
    const m = u.match(/^https?:\/\/[^/]+\/([^/]+)\/([^/]+)\/([^/]+)\/dp\/([A-Z0-9]+)/i);
    if (!m) continue;
    total += 1;
    const [, brandSlug, part, desc, code] = m;
    if (seen.has(code)) continue;
    seen.add(code);
    const words = desc.toLowerCase().replace(/-/g, ' ');
    const slug = brandSlug.toLowerCase();
    if (brands) {
      // The whole brand, not a piece of one: "lg" was matching "bulgin".
      if (!brands.some((b) => { const w = b.replace(/\s+/g, '-'); return slug === w || slug.startsWith(`${w}-`); })) { notChosen += 1; continue; }
    }
    if (!args.all) {
      if (SIZED_BRAND.test(slug)) { notChosen += 1; continue; }
      if (COMPONENT.test(words)) { parts += 1; continue; }
      if (BULK.test(words)) { parts += 1; continue; }
      if (!brands && !CONSUMER.test(words)) { notChosen += 1; continue; }
    }
    const brand = title(brandSlug);
    rows.push({ shop: 'cpc', url: u, name: `${brand} ${part.toUpperCase()} ${title(desc)}`, brand, price: '', category: '', availability: '' });
  }
  await new Promise((r) => setTimeout(r, 500));
}

const cell = (v) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const cols = ['shop', 'url', 'name', 'brand', 'price', 'category', 'availability'];
await mkdir(dir, { recursive: true });
const out = join(dir, 'shelf-cpc-names.csv');
await writeFile(out, [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\n'));

const byBrand = new Map();
for (const r of rows) byBrand.set(r.brand, (byBrand.get(r.brand) ?? 0) + 1);
console.log(`  ${total} product links read, ${rows.length} kept`);
if (!args.all) console.log(`  ${parts} components or trade packs left out, ${notChosen} not chosen`);
console.log(`  ${out}\n`);
console.log('  Most common brands kept:');
for (const [b, n] of [...byBrand.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log(`    ${String(n).padStart(6)}  ${b}`);
console.log();
for (const r of rows.slice(0, 8)) console.log(`  ${r.name}`);
console.log();
