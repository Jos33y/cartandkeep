import { mkdir, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).map(a => a.replace(/^--/, '').split('=')).map(([k, ...v]) => [k, v.join('=') || true])
);
const base = String(args.base || '').replace(/\/$/, '');
if (!base) {
  console.error('usage: node scripts/probes/shop-probe.mjs --base=https://www.therange.co.uk [--tag=range] [--pause=800]');
  process.exit(1);
}
const tag = args.tag || new URL(base).hostname.replace(/^www\./, '').split('.')[0];
const outDir = join('research', 'probes', tag);
const pause = Number(args.pause || 800);
const maxSitemaps = Number(args.maxSitemaps || 80);
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';

const HINTS = {
  shopify: /cdn\.shopify\.com/i,
  sfcc: /demandware|dwvar_|\/on\/demandware\.store/i,
  magento: /Magento_|mage\/cookies|static\/version\d+/,
  hybris: /\/_ui\/responsive|hybris/i,
  bigcommerce: /bigcommerce/i,
  commercetools: /commercetools/i,
  woocommerce: /woocommerce/i,
  nextjs: /__NEXT_DATA__|\/_next\/static/,
  nuxt: /__NUXT__|\/_nuxt\//,
  algolia: /algolia(?:net)?\.(?:com|net)|algoliasearch/i,
  klevu: /klevu/i,
  searchspring: /searchspring/i,
  constructor: /cnstrc|constructor\.io/i,
  bloomreach: /bloomreach|brcdn|brsm/i,
  fredhopper: /attraqt|fredhopper/i,
  doofinder: /doofinder/i,
  mirakl: /mirakl/i
};

const sleep = ms => new Promise(r => setTimeout(r, ms));
const decode = s => s.replace(/&amp;/g, '&').trim();
const report = { base, at: new Date().toISOString(), requests: [] };

function blockedBy(res, text) {
  if (res.status === 429) return 'rate limited';
  if (/cf-chl|challenge-platform|Just a moment/i.test(text)) return 'cloudflare challenge';
  if (/px-captcha|perimeterx/i.test(text)) return 'perimeterx';
  if (/_Incapsula_|incap_ses/i.test(text)) return 'incapsula';
  if (res.status === 403 && /Access Denied|Reference #/i.test(text)) return 'akamai';
  if (res.status === 403) return '403';
  return null;
}

async function get(url) {
  await sleep(pause);
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': UA, 'accept-language': 'en-GB,en;q=0.9', accept: 'text/html,application/xml;q=0.9,*/*;q=0.8' },
      redirect: 'follow'
    });
    let buf = Buffer.from(await res.arrayBuffer());
    // .xml.gz sitemaps arrive as raw gzip, not content-encoded.
    if (buf[0] === 0x1f && buf[1] === 0x8b) buf = gunzipSync(buf);
    const text = buf.toString('utf8');
    const row = {
      url, status: res.status, final: res.url, bytes: buf.length,
      server: res.headers.get('server'), cdn: res.headers.get('cf-ray') ? 'cloudflare' : res.headers.get('x-akamai-transformed') ? 'akamai' : null,
      blocked: blockedBy(res, text)
    };
    report.requests.push(row);
    console.log(`${res.status} ${row.blocked ? '[' + row.blocked + '] ' : ''}${url}`);
    return { status: res.status, text };
  } catch (e) {
    report.requests.push({ url, error: e.message });
    console.log(`ERR ${url} ${e.message}`);
    return { status: 0, text: '' };
  }
}

const save = (name, body) => writeFile(join(outDir, name), body);
const locs = xml => [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map(m => decode(m[1]));
const abs = href => { try { return new URL(href, base).href; } catch { return null; } };

function inspect(html) {
  const ld = [...html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].flatMap(m => {
    try {
      const j = JSON.parse(m[1].trim());
      return Array.isArray(j) ? j : j['@graph'] || [j];
    } catch { return [{ unparsed: m[1].slice(0, 200) }]; }
  });
  const products = ld.filter(x => [].concat(x['@type'] || []).includes('Product')).map(p => {
    const o = [].concat(p.offers || [])[0] || {};
    return {
      name: p.name, sku: p.sku, gtin: p.gtin13 || p.gtin || p.gtin8 || p.gtin14, mpn: p.mpn,
      brand: p.brand?.name || p.brand, price: o.price ?? o.lowPrice, currency: o.priceCurrency,
      availability: o.availability, seller: o.seller?.name, offerType: o['@type'], weight: p.weight
    };
  });
  const jsonScripts = [...html.matchAll(/<script([^>]*)type=["']application\/json["']([^>]*)>([\s\S]*?)<\/script>/gi)]
    .map(m => ({ attrs: (m[1] + m[2]).trim().slice(0, 120), bytes: m[3].length }));
  const globals = ['__NEXT_DATA__', '__NUXT__', '__INITIAL_STATE__', '__PRELOADED_STATE__', '__APOLLO_STATE__', 'dataLayer', 'utag_data']
    .filter(g => html.includes(g));
  const apis = [...new Set([...html.matchAll(/https?:\/\/[^"'\s<>\\]*(?:api|graphql|search)[^"'\s<>\\]*/gi)].map(m => m[0].slice(0, 160)))].slice(0, 40);
  const unitPrice = [...html.matchAll(/£\s?\d+(?:\.\d{1,2})?\s*(?:per|\/)\s*(?:\d+\s*)?(?:kg|g|ml|l|litre|m|each|100g|100ml)\b/gi)].map(m => m[0]).slice(0, 5);
  const soldBy = [...html.matchAll(/(?:sold|dispatched|fulfilled|delivered) by[^<]{0,60}/gi)].map(m => m[0].trim()).slice(0, 5);
  const paging = [...new Set([...html.matchAll(/href=["']([^"']*[?&](?:page|p|pg|currentpage|start|offset|pageNumber)=\d+[^"']*)["']/gi)].map(m => decode(m[1])))].slice(0, 8);
  const relNext = html.match(/<link[^>]*rel=["']next["'][^>]*href=["']([^"']+)/i)?.[1] || null;
  const productLinks = [...new Set([...html.matchAll(/href=["']([^"'#?]+)["']/gi)].map(m => m[1]).filter(h => /\/p\/|\/product|\d{6,}/i.test(h)))].slice(0, 10);
  return {
    title: html.match(/<title>([^<]*)/i)?.[1]?.trim(),
    ldTypes: [...new Set(ld.flatMap(x => [].concat(x['@type'] || [])))],
    products, jsonScripts, globals,
    platform: Object.entries(HINTS).filter(([, re]) => re.test(html)).map(([k]) => k),
    apis, unitPrice, soldBy, paging, relNext, productLinks
  };
}

await mkdir(outDir, { recursive: true });

const robots = await get(`${base}/robots.txt`);
await save('robots.txt', robots.text);
let roots = robots.status === 200 ? [...robots.text.matchAll(/^\s*sitemap:\s*(\S+)/gim)].map(m => m[1]) : [];
if (!roots.length) roots = [`${base}/sitemap.xml`, `${base}/sitemap_index.xml`];
report.robots = {
  sitemaps: roots,
  disallow: [...robots.text.matchAll(/^\s*disallow:\s*(\S*)/gim)].map(m => m[1]).slice(0, 60),
  crawlDelay: robots.text.match(/crawl-delay:\s*(\d+)/i)?.[1] || null
};

const sitemaps = [];
const tsv = [];
const queue = [...roots];
const seen = new Set();
while (queue.length && sitemaps.length < maxSitemaps) {
  const url = queue.shift();
  if (seen.has(url)) continue;
  seen.add(url);
  const r = await get(url);
  if (r.status !== 200) { sitemaps.push({ url, status: r.status }); continue; }
  const found = locs(r.text);
  if (/<sitemapindex/i.test(r.text)) {
    queue.push(...found);
    sitemaps.push({ url, kind: 'index', children: found.length });
  } else {
    sitemaps.push({ url, kind: 'urlset', urls: found.length, sample: found.slice(0, 3) });
    for (const u of found) tsv.push(`${url}\t${u}`);
  }
}
report.sitemaps = sitemaps;
report.sitemapsUnvisited = queue.length;
report.sitemapUrlTotal = tsv.length;
await save('sitemap-urls.tsv', tsv.join('\n'));

const urlsets = sitemaps.filter(s => s.kind === 'urlset' && s.urls);
const productSet = urlsets.filter(s => /product|pdp/i.test(s.url)).sort((a, b) => b.urls - a.urls)[0] || [...urlsets].sort((a, b) => b.urls - a.urls)[0];
const categorySet = urlsets.find(s => /categor|department|collection|plp|listing/i.test(s.url));
const urlsOf = s => (s ? tsv.filter(l => l.startsWith(s.url + '\t')).map(l => l.split('\t')[1]) : []);

const home = await get(base + '/');
await save('home.html', home.text);
report.home = inspect(home.text);

const pUrls = urlsOf(productSet);
const picks = pUrls.length
  ? [pUrls[0], pUrls[Math.floor(pUrls.length / 2)], pUrls[pUrls.length - 1]]
  : report.home.productLinks.slice(0, 3).map(abs).filter(Boolean);
report.productPages = [];
for (const [i, u] of picks.entries()) {
  const r = await get(u);
  await save(`product-${i + 1}.html`, r.text);
  report.productPages.push({ url: u, status: r.status, ...inspect(r.text) });
}

const cUrls = urlsOf(categorySet);
const catPicks = cUrls.length ? [cUrls[0], cUrls[Math.floor(cUrls.length / 2)]] : [];
report.categoryPages = [];
for (const [i, u] of catPicks.entries()) {
  const r = await get(u);
  await save(`category-${i + 1}.html`, r.text);
  report.categoryPages.push({ url: u, status: r.status, ...inspect(r.text) });
}

await save('report.json', JSON.stringify(report, null, 2));

const blocked = report.requests.filter(r => r.blocked);
const p = report.productPages[0] || {};
console.log('\n' + [
  `shop            ${base}`,
  `sitemaps        ${sitemaps.length} read, ${report.sitemapsUnvisited} unvisited, ${report.sitemapUrlTotal} urls`,
  `product sitemap ${productSet ? `${productSet.url} (${productSet.urls})` : 'none identified'}`,
  `blocked         ${blocked.length ? blocked.map(b => `${b.blocked} on ${b.url}`).join('; ') : 'no'}`,
  `platform        ${[...new Set([...(report.home.platform || []), ...(p.platform || [])])].join(', ') || 'unknown'}`,
  `product ld+json ${report.productPages.map(x => (x.products.length ? `${x.products[0].price ?? '?'} ${x.products[0].gtin ? 'gtin' : 'no gtin'} ${x.products[0].seller ?? 'no seller'}` : 'none')).join(' | ')}`,
  `page globals    ${p.globals?.join(', ') || 'none'}`,
  `sold by         ${report.productPages.flatMap(x => x.soldBy).slice(0, 3).join(' | ') || 'not seen'}`,
  `paging          ${report.categoryPages.flatMap(x => x.paging).slice(0, 3).join(' | ') || 'not seen'}`,
  `out             ${outDir}`
].join('\n'));
