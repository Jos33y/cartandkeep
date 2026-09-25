// Reads the shop's own product page for cards that have none, so the listing composer can draft.
// Only fills an empty listing; nothing she has decided, noted or edited is touched.
//
//   node scripts/read-listings.mjs                    approved cards, list only
//   node scripts/read-listings.mjs --apply            approved cards, written
//   node scripts/read-listings.mjs --scope=all        every open card with a shop link
//   node scripts/read-listings.mjs --match="leg lifter" --apply

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')).map(([k, ...v]) => [k, v.join('=') || true])
);
const apply = Boolean(args.apply);
const scope = args.scope || 'approved';
const pause = Number(args.pause || 1500);
const slug = args.tenant || 'cart-and-keep';
const match = args.match ? String(args.match).toLowerCase() : null;
const fixBrands = Boolean(args['fix-brands']);
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const text = (html) => String(html ?? '')
  .replace(/<(br|\/p|\/li|\/h\d)\s*\/?>/gi, '\n')
  .replace(/<li[^>]*>/gi, '- ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, "'").replace(/&quot;/g, '"')
  .replace(/[ \t]+/g, ' ').replace(/\n\s+/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

// Bullet lines in a description are the features, kept apart as the composer expects.
// A shop's own name in the brand field (Shopify's vendor) would put another retailer's name in her title.
const squash = (v) => String(v ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const brandOf = (brand, url) => {
  const host = squash(new URL(url).hostname.replace(/^www\./, '').split('.')[0]);
  const b = squash(brand);
  return b && host && (b === host || host.includes(b) || b.includes(host)) ? null : brand || null;
};

const featuresOf = (desc) => desc.split('\n').filter((l) => l.startsWith('- ')).map((l) => l.slice(2).trim()).filter(Boolean);

async function get(url, accept) {
  const res = await fetch(url, {
    headers: { 'user-agent': UA, 'accept-language': 'en-GB,en;q=0.9', accept },
    redirect: 'follow',
    signal: AbortSignal.timeout(30000),
  });
  return { status: res.status, body: res.ok ? await res.text() : '' };
}

// Shopify shops publish every product as JSON beside its page.
async function fromShopify(url) {
  const clean = url.split('?')[0].replace(/\/$/, '');
  if (!/\/products\//.test(clean)) return null;
  const r = await get(`${clean}.json`, 'application/json');
  if (r.status !== 200) return null;
  const p = JSON.parse(r.body)?.product;
  if (!p) return null;
  const description = text(p.body_html);
  const variant = p.variants?.[0] ?? {};
  return {
    title: p.title,
    brand: p.vendor || null,
    images: (p.images ?? []).map((i) => i.src).filter(Boolean),
    description,
    features: featuresOf(description),
    shop_category: p.product_type || null,
    product_code: variant.sku || null,
    in_stock: variant.available ?? null,
  };
}

// Everyone else: the structured product data most shops put in the page for search engines.
async function fromPage(url) {
  const r = await get(url, 'text/html');
  if (r.status !== 200) return { failed: `status ${r.status}` };
  const blocks = [...r.body.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .flatMap((m) => { try { const j = JSON.parse(m[1]); return Array.isArray(j) ? j : j['@graph'] ?? [j]; } catch { return []; } });
  const p = blocks.find((b) => [].concat(b['@type']).includes('Product'));
  if (!p) return { failed: 'no product data on the page' };
  const crumbs = blocks.find((b) => [].concat(b['@type']).includes('BreadcrumbList'));
  const description = text(p.description);
  const offer = [].concat(p.offers ?? [])[0] ?? {};
  return {
    title: p.name,
    brand: typeof p.brand === 'string' ? p.brand : p.brand?.name ?? null,
    images: [].concat(p.image ?? []).map((i) => (typeof i === 'string' ? i : i?.url)).filter(Boolean),
    description,
    features: featuresOf(description),
    shop_category: crumbs?.itemListElement?.map((e) => e.name ?? e.item?.name).filter(Boolean).slice(-2, -1)[0] ?? null,
    product_code: p.sku ?? p.mpn ?? null,
    in_stock: offer.availability ? /InStock/i.test(offer.availability) : null,
  };
}

const { connect } = await import('../pipeline/lib/db.js');
const { db } = await connect();

const { data: tenant } = await db.from('tenants').select('id').eq('slug', slug).maybeSingle();
if (!tenant) { console.error(`\n  Tenant "${slug}" not found.\n`); process.exit(1); }

if (fixBrands) {
  const { data: written, error: wErr } = await db
    .from('candidates')
    .select('id, title, listing')
    .eq('tenant_id', tenant.id)
    .not('listing', 'is', null);
  if (wErr) { console.error(`\n  Cards not read: ${wErr.message}\n`); process.exit(1); }
  const wrong = written.filter((c) => c.listing?.brand && c.listing?.source_url
    && brandOf(c.listing.brand, c.listing.source_url) === null);
  console.log(`\n  ${wrong.length} listings carry the shop's name as their brand`);
  for (const c of wrong) {
    console.log(`    ${(c.title ?? '').slice(0, 44).padEnd(44)} "${c.listing.brand}"`);
    if (apply) {
      const { error: uErr } = await db.from('candidates').update({ listing: { ...c.listing, brand: null } }).eq('id', c.id);
      if (uErr) console.log(`      not written: ${uErr.message}`);
    }
  }
  console.log(apply ? '\n  Cleared.\n' : '\n  List only. Add --apply to clear them.\n');
  process.exit(0);
}

const { data: cards, error } = await db
  .from('candidates')
  .select('id, title, margin, listing, decisions ( action )')
  .eq('tenant_id', tenant.id)
  .is('listing', null);
if (error) { console.error(`\n  Cards not read: ${error.message}\n`); process.exit(1); }

const decided = (c) => [].concat(c.decisions ?? [])[0]?.action ?? null;
const todo = cards.filter((c) => c.margin?.shelf?.url)
  .filter((c) => (scope === 'all' ? decided(c) !== 'reject' : decided(c) === 'approve'))
  .filter((c) => !match || (c.title ?? '').toLowerCase().includes(match));
const noLink = cards.filter((c) => !c.margin?.shelf?.url && (scope === 'all' || decided(c) === 'approve')).length;

console.log(`\n  ${todo.length} cards to read${noLink ? `, ${noLink} more have no shop link to read from` : ''}\n`);

let done = 0;
for (const c of todo) {
  const url = c.margin.shelf.url;
  let read;
  try {
    read = (await fromShopify(url)) ?? (await fromPage(url));
  } catch (e) {
    read = { failed: e.name === 'TimeoutError' ? 'no answer in 30s' : e.message };
  }

  if (!read.failed) read.brand = brandOf(read.brand, url);
  if (read.failed) {
    console.log(`  --    ${(c.title ?? '').slice(0, 44).padEnd(44)} ${read.failed}`);
  } else {
    const listing = { ...read, summary: null, unit_price: null, source_url: url, read_at: new Date().toISOString() };
    console.log(`  ok    ${(c.title ?? '').slice(0, 44).padEnd(44)} ${listing.images.length} photos, ${listing.description.length} chars`);
    if (apply) {
      // Only an empty listing is filled, so a draft she has already worked from stays as it is.
      const { error: uErr } = await db.from('candidates').update({ listing }).eq('id', c.id).is('listing', null);
      if (uErr) console.log(`        not written: ${uErr.message}`);
      else done += 1;
    }
  }
  await wait(pause);
}

console.log(apply ? `\n  ${done} written.\n` : '\n  List only. Run again with --apply to write.\n');
