/*
 * Reading the shop shelves (research/shelf/shelf-*.csv), shared by store-picks and resource.
 * Only products that could match what is wanted are kept, by barcode or brand key: holding all 730,000 rows,
 * and copying a brand's list on every add, ran Node out of memory.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseCsv } from '../lib/sources.js';
import { digits, squash } from './match.mjs';


// The filters live in rules/ (one list per concern, one file per category when needed); re-exported here for
// the scripts that read them from shelf.mjs.
export { OWN_LABEL, NOT_SHELF, RESTRICTED, CANT_POST } from './rules/index.mjs';

// Shop names compared without case, spaces or hyphens, so festive-lights, festivelights and "Festive Lights" all match.
export const normShop = (v) => String(v ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

/*
 * Weight in grams, for the postage band. Shopify shelves carry grams; other readers may write "1.2 kg" or "500g".
 * A bare number is grams, unless it has a decimal point and is under 100, which is kilograms. Nought is unknown.
 */
export function gramsOf(r) {
  const raw = String([r.grams, r.weight_g, r.weight].find((v) => String(v ?? '').trim() !== '') ?? '').trim().toLowerCase();
  const m = raw.match(/^(\d+(?:\.\d+)?)\s*(kg|g|grams?|lb|lbs)?$/);
  if (!m) return null;
  const n = Number(m[1]);
  const g = m[2] === 'kg' ? n * 1000 : /^lb/.test(m[2] ?? '') ? n * 453.6 : !m[2] && m[1].includes('.') && n < 100 ? n * 1000 : n;
  return g > 0 ? Math.round(g) : null;
}
// A weight in the title ("Paving Sand 20kg") when no shop gave one; a capacity ("holds up to 150kg") is not its weight.
export function titleGrams(title) {
  let best = null;
  for (const m of String(title).matchAll(/(up to|max(?:imum)?|capacity|holds|supports|load|user weight)?\s*(\d+(?:\.\d+)?)\s?(kg|g)\b/gi)) {
    if (m[1]) continue;
    const g = Number(m[2]) * (m[3].toLowerCase() === 'kg' ? 1000 : 1);
    if (g > 0 && (best == null || g > best)) best = g;
  }
  return best;
}

const OWN_SHOP_BRAND = /^(b and m|home bargains|savers|poundland|the works|home discount|monstershop)$/;
const add = (map, key, s) => { const list = map.get(key); if (list) list.push(s); else map.set(key, [s]); };

// Names-only shelves count: seeing the product listed is the proof, a price is not needed.
export function loadShelves({ dir = 'research/shelf', wantGtins, wantKeys, wantBrands = null, skipShops = new Set() }) {
  // A names-only shelf has no brand column, and some shops put the brand last ("Biotin Solgar", "Plantago Drops
  // A Vogel"). The longest wanted brand named anywhere in the name is its key; otherwise its first word, as before.
  const brandIn = (n) => {
    if (!wantBrands?.size) return null;
    const w = n.split(' ');
    for (let len = 4; len >= 1; len -= 1) {
      for (let i = 0; i + len <= w.length; i += 1) {
        const gram = w.slice(i, i + len).join(' ');
        if (wantBrands.has(gram) && (len > 1 || gram.length >= 4)) return gram;
      }
    }
    return null;
  };
  const files = fs.readdirSync(dir).filter((f) => /^shelf-.*\.csv$/.test(f));
  const byGtin = new Map();
  const byBrand = new Map();
  const weighed = new Map();
  let rows = 0;
  let kept = 0;
  for (const f of files) {
    const tag = f.replace(/^shelf-|(-names)?\.csv$/g, '');
    for (const r of parseCsv(fs.readFileSync(path.join(dir, f), 'utf8'))) {
      const name = String(r.name ?? r.product ?? r.title ?? '').trim();
      if (!name) continue;
      const shop = r.shop || tag;
      if (skipShops.has(normShop(shop)) || skipShops.has(normShop(tag))) continue;
      rows += 1;
      const price = Number(r.price);
      const grams = gramsOf(r);
      if (grams) { const w = weighed.get(shop) ?? []; w.push(grams); weighed.set(shop, w); }
      const s = { shop, name, brand: squash(r.brand), price: price > 0 ? price : null, url: r.url ?? '', image: String(r.image ?? r.image_url ?? '').split(/[|\s]/)[0], grams };
      // Shops name the barcode differently: Shopify calls it barcode, others ean or gtin13.
      const g = digits(r.gtin || r.barcode || r.ean || r.gtin13 || r.upc);
      if (g) s.gtin = g;
      const key = s.brand && !OWN_SHOP_BRAND.test(s.brand) ? s.brand : (brandIn(squash(name)) ?? squash(name).split(' ')[0]);
      const byCode = g && wantGtins.has(g);
      const byName = key && wantKeys.has(key);
      if (!byCode && !byName) continue;
      kept += 1;
      if (byCode) add(byGtin, g, s);
      if (byName) add(byBrand, key, s);
    }
  }
  return { files, byGtin, byBrand, weighed, rows, kept };
}
