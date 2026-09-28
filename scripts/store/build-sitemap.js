/*
 * Writes public/sitemap.xml.
 *
 * robots.txt has been promising Google a sitemap since Monday and the URL has
 * been returning nothing, which is worse than having no sitemap at all: it
 * tells a crawler the shop is broken rather than small.
 *
 * Run before a deploy. It reads the live catalogue and the blog folder, so it
 * lists what actually exists rather than what the router could theoretically
 * serve.
 *
 * Usage:
 *   node scripts/store/build-sitemap.js
 *   node scripts/store/build-sitemap.js --site=https://cartandkeep.com
 */

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';

import { connect } from '../../pipeline/lib/db.js';

const arg = (name) => {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`));
  return hit === undefined ? undefined : hit.slice(name.length + 3);
};

const SITE = (arg('site') ?? 'https://cartandkeep.com').replace(/\/$/, '');
const OUT = path.join('public', 'sitemap.xml');

// Priority is a hint and search engines mostly ignore it, so these are set by
// what they are rather than argued over: the shop front and the catalogue
// first, policy pages last.
const STATIC = [
  ['/', 'daily', '1.0'],
  ['/shop', 'daily', '0.9'],
  ['/about', 'monthly', '0.7'],
  ['/contact', 'monthly', '0.6'],
  ['/blog', 'weekly', '0.6'],
  ['/legal/delivery', 'monthly', '0.4'],
  ['/legal/returns', 'monthly', '0.4'],
  ['/legal/terms', 'yearly', '0.3'],
  ['/legal/privacy', 'yearly', '0.3'],
  ['/legal/cookies', 'yearly', '0.3'],
  ['/legal/faq', 'monthly', '0.5'],
];

// Anything private, anything personal, anything that would be a thin duplicate
// of a page already listed. A basket in an index is a basket somebody finds in
// a search result.
const EXCLUDED = ['/cart', '/checkout', '/order', '/orders', '/saved', '/search'];

const escape = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

const url = (loc, changefreq, priority, lastmod) => [
  '  <url>',
  `    <loc>${escape(SITE + loc)}</loc>`,
  lastmod ? `    <lastmod>${lastmod}</lastmod>` : null,
  `    <changefreq>${changefreq}</changefreq>`,
  `    <priority>${priority}</priority>`,
  '  </url>',
].filter(Boolean).join('\n');

// Slug and date off the front matter, without pulling in a YAML parser for two
// fields. Matches what src/data/blog.js does at build time.
function posts() {
  const dir = path.join('src', 'content', 'blog');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((file) => {
      const raw = readFileSync(path.join(dir, file), 'utf8');
      const front = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      const read = (key) => front?.[1].match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))?.[1].trim().replace(/^['"]|['"]$/g, '');
      const slug = read('slug') ?? file.replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/\.md$/, '');
      return { slug, date: read('date') ?? null, title: read('title') };
    })
    .filter((p) => p.title);
}

async function main() {
  const { db, E } = await connect();
  const slug = E.VITE_TENANT_SLUG ?? 'cart-and-keep';

  const { data: tenant } = await db.from('tenants').select('id').eq('slug', slug).single();
  if (!tenant) {
    console.error(`No tenant with slug "${slug}".`);
    process.exit(1);
  }

  // Live and not a sample, which is exactly what an anonymous visitor can see.
  // Listing a draft would send a crawler to a page that returns nothing.
  const { data: products, error } = await db
    .from('store_products')
    .select('slug, category_path, updated_at')
    .eq('tenant_id', tenant.id)
    .eq('status', 'live')
    .eq('is_sample', false);

  if (error) {
    console.error('Could not read the catalogue:', error.message);
    process.exit(1);
  }

  // Departments are derived from what is in stock, so a category URL only
  // exists while something is in it.
  // Section addresses exactly as the shop makes them: her name's address when she renamed one, hidden ones left out, small groups folded into Odds and ends.
  const slugify = (v) => String(v).toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const { data: counts, error: countError } = await db.rpc('store_groups', { p_tenant: tenant.id });
  if (countError) {
    console.error('Could not read the sections:', countError.message);
    process.exit(1);
  }
  const { data: names } = await db.from('store_category_names').select('path, name, slug, hidden').eq('tenant_id', tenant.id);
  const departments = new Set();
  let leftover = false;
  for (const g of counts ?? []) {
    const row = (names ?? []).find((n) => n.path === g.group_key);
    if (!g.group_key || g.group_key === 'Everything else' || Number(g.products) < 3) { leftover = true; continue; }
    if (row?.hidden) continue;
    departments.add(row?.slug || slugify(row?.name && row.name !== g.group_key ? row.name : g.group_key));
  }
  if (leftover) departments.add('odds-and-ends');

  const entries = [
    ...STATIC.map(([loc, freq, pri]) => url(loc, freq, pri)),
    ...[...departments].sort().map((d) => url(`/c/${d}`, 'weekly', '0.8')),
    ...(products ?? []).map((p) => url(
      `/p/${p.slug}`,
      'weekly',
      '0.7',
      p.updated_at ? String(p.updated_at).slice(0, 10) : null,
    )),
    ...posts().map((p) => url(`/blog/${p.slug}`, 'monthly', '0.6', p.date)),
  ];

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries,
    '</urlset>',
    '',
  ].join('\n');

  mkdirSync('public', { recursive: true });
  writeFileSync(OUT, xml, 'utf8');

  console.log(`  ${STATIC.length} static`);
  console.log(`  ${departments.size} departments`);
  console.log(`  ${(products ?? []).length} products`);
  console.log(`  ${posts().length} posts`);
  console.log(`\n  ${OUT}  ${entries.length} URLs, ${(xml.length / 1024).toFixed(1)} KB`);

  if ((products ?? []).length === 0) {
    console.log('\n  No live products. Everything is still draft or sample, so the');
    console.log('  sitemap has no catalogue in it and Google will index a shell.');
  }
  console.log(`\n  Excluded on purpose: ${EXCLUDED.join(', ')}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
