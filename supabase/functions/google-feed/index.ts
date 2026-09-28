import { createClient } from 'jsr:@supabase/supabase-js@2';

const SITE = 'https://cartandkeep.com';
const TENANT = Deno.env.get('TENANT_SLUG') ?? 'cart-and-keep';

const esc = (v: unknown) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

// Descriptions are written as markdown for the product page; Google wants plain text.
const plain = (v: unknown) => String(v ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
  .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  .replace(/[*_`#>]+/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const money = (n: number) => `${n.toFixed(2)} GBP`;

function availabilityOf(availability: string | null, stock: unknown): string | null {
  if (availability === 'discontinued' || availability === 'made_to_order') return null;
  if (availability === 'out_of_stock') return 'out_of_stock';
  if (typeof stock === 'number' && stock <= 0) return 'out_of_stock';
  return 'in_stock';
}

type Row = Record<string, any>;

function item(p: Row, v: Row | null, skipped: string[]): string | null {
  const price = Number(v?.price ?? p.price);
  const availability = availabilityOf(v?.availability ?? p.availability ?? null, v ? v.stock : p.stock);
  const images: string[] = (Array.isArray(p.images) && p.images.length ? p.images : [p.image_url]).filter(Boolean);
  const image = v?.image_url || images[0];
  const title = v ? `${p.title}, ${v.label}` : p.title;

  if (!availability) { skipped.push(`${p.slug}: ${p.availability}`); return null; }
  if (!Number.isFinite(price) || price <= 0) { skipped.push(`${p.slug}: no price`); return null; }
  if (!image) { skipped.push(`${p.slug}: no image`); return null; }

  const gtin = v?.gtin || p.gtin || null;
  const description = plain(p.description) || plain(p.title);
  const lines = [
    `<g:id>${esc(v ? `${p.id}-${v.id}` : p.id)}</g:id>`,
    `<g:title>${esc(String(title).slice(0, 150))}</g:title>`,
    `<g:description>${esc(description.slice(0, 5000))}</g:description>`,
    `<g:link>${esc(`${SITE}/p/${p.slug}`)}</g:link>`,
    `<g:image_link>${esc(image)}</g:image_link>`,
    ...images.filter((i) => i !== image).slice(0, 10).map((i) => `<g:additional_image_link>${esc(i)}</g:additional_image_link>`),
    `<g:availability>${availability}</g:availability>`,
    `<g:price>${money(price)}</g:price>`,
    `<g:condition>${p.condition && !/^new/i.test(p.condition) ? 'used' : 'new'}</g:condition>`,
    p.brand ? `<g:brand>${esc(p.brand)}</g:brand>` : null,
    gtin ? `<g:gtin>${esc(gtin)}</g:gtin>` : null,
    p.mpn ? `<g:mpn>${esc(p.mpn)}</g:mpn>` : null,
    !gtin && !(p.brand && p.mpn) ? '<g:identifier_exists>no</g:identifier_exists>' : null,
    p.section ? `<g:product_type>${esc(p.section)}</g:product_type>` : null,
    v ? `<g:item_group_id>${esc(p.id)}</g:item_group_id>` : null,
  ].filter(Boolean);
  return `<item>\n  ${lines.join('\n  ')}\n</item>`;
}

Deno.serve(async () => {
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data: tenant } = await db.from('tenants').select('id').eq('slug', TENANT).single();
  if (!tenant) return new Response(`No tenant ${TENANT}`, { status: 500 });

  // The same filter an anonymous shopper sees: live and not a sample.
  const { data: products, error } = await db.from('store_products').select('*')
    .eq('tenant_id', tenant.id).eq('status', 'live').eq('is_sample', false);
  if (error) return new Response(error.message, { status: 500 });

  const ids = (products ?? []).map((p) => p.id);
  const { data: variants } = ids.length
    ? await db.from('store_variants').select('*').in('product_id', ids).order('position', { ascending: true })
    : { data: [] };
  const byProduct = new Map<string, Row[]>();
  for (const v of variants ?? []) byProduct.set(v.product_id, [...(byProduct.get(v.product_id) ?? []), v]);

  const skipped: string[] = [];
  const items = (products ?? []).flatMap((p) => {
    const vs = byProduct.get(p.id) ?? [];
    return vs.length ? vs.map((v) => item(p, v, skipped)) : [item(p, null, skipped)];
  }).filter(Boolean);

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">',
    '<channel>',
    '<title>Cart &amp; Keep</title>',
    `<link>${SITE}/</link>`,
    '<description>Everything on the Cart &amp; Keep shop</description>',
    ...items,
    '</channel>',
    '</rss>',
    '',
  ].join('\n');

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=900',
      'X-Feed-Items': String(items.length),
      'X-Feed-Skipped': String(skipped.length),
    },
  });
});
