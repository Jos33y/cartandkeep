/*
 * The Google Shopping feed.
 *
 * Merchant Center is pointed at this URL and fetches it on a schedule, daily.
 * Not the Content API: that needs OAuth, a service account and credentials
 * living in our infrastructure to solve a problem a URL already solves, and a
 * pull feed fails safely. If this function breaks, Merchant Center keeps
 * yesterday's data and the shop is unaffected.
 *
 * Free listings rather than ads. There is no bid and no budget, which is the
 * closest thing a small UK shop has to marketplace distribution without paying
 * marketplace fees.
 *
 * Read from the product data specification rather than remembered. Required
 * outright: id, title, description, link, image_link, availability, price.
 * Required where they apply: brand where the product has one, gtin where the
 * manufacturer assigned one. Shipping is configured once at account level in
 * Merchant Center for UK merchants, so it is deliberately not per product here.
 *
 * There is no CORS block. Google fetches this server to server and a browser
 * has no reason to.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';

const db = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);

const TENANT = Deno.env.get('FEED_TENANT_SLUG') ?? 'cart-and-keep';

const escape = (s: unknown) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/*
 * Control characters out.
 *
 * A description pasted from a supplier's page carries tabs, vertical tabs and
 * the occasional null byte, and an XML parser rejects the whole document over
 * one of them rather than skipping the product. One bad character would take
 * the entire catalogue offline in Merchant Center.
 */
const clean = (s: unknown) => String(s ?? '')
  // deno-lint-ignore no-control-regex
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

/*
 * eBay serves the same image at several sizes and the seed kept whatever the
 * lister uploaded, often 300px. Google wants at least 100 by 100 and ranks
 * larger images better, so the largest variant is requested. Her own uploads
 * are already 1600 and are left alone.
 */
const bestImage = (url: string) => (url.includes('/s-l')
  ? url.replace(/\/s-l\d+\./, '/s-l1600.')
  : url);

const CONDITION: Record<string, string> = {
  new: 'new',
  used: 'used',
  refurbished: 'refurbished',
  new_other: 'new',
  new_with_defects: 'used',
};

Deno.serve(async () => {
  const { data: tenant, error: tErr } = await db
    .from('tenants').select('id, store').eq('slug', TENANT).single();

  if (tErr || !tenant) {
    return new Response('Shop not found', { status: 404 });
  }

  const cfg = (tenant.store as Record<string, any>) ?? {};
  const domain = cfg.domain ?? 'cartandkeep.com';
  const shop = `https://${domain}`;

  const { data: products, error } = await db
    .from('store_products')
    .select(`
      id, slug, title, description, price, image_url, images,
      brand, gtin, mpn, condition, availability, stock, category_path
    `)
    .eq('tenant_id', tenant.id)
    .eq('status', 'live')
    .eq('is_sample', false)
    .order('title');

  if (error) {
    console.error('[feed]', error);
    return new Response('Could not read the catalogue', { status: 500 });
  }

  const items: string[] = [];
  let skipped = 0;

  for (const p of products ?? []) {
    const description = clean(p.description);
    const image = p.image_url ?? (Array.isArray(p.images) ? p.images[0] : null);
    const price = Number(p.price);

    /*
     * Skipped rather than sent incomplete.
     *
     * A product missing a required attribute is disapproved on arrival, and
     * enough disapprovals put the whole account under review. Leaving it out
     * costs one listing; sending it costs the account's standing. The Being
     * found screen names every product this skips and why, so nothing
     * disappears silently.
     */
    if (!description || !image || !(price > 0)) {
      skipped += 1;
      continue;
    }

    /*
     * Availability from the two things that know it.
     *
     * `availability` is what she set and `stock` is what is left, and the
     * checkout already refuses on either. Out of stock is sent rather than the
     * product being withheld, because Google keeps the listing and reinstates
     * it when the value changes, whereas a product that vanishes and returns is
     * a new listing with no history.
     */
    const gone = p.availability === 'out_of_stock'
      || p.availability === 'discontinued'
      || (typeof p.stock === 'number' && p.stock <= 0);

    const fields = [
      `<g:id>${escape(p.id)}</g:id>`,
      // 150 characters is the ceiling. Her feed titles run past it and Google
      // truncates rather than rejects, but a title cut mid word reads badly in
      // a result, so it is cut on a space.
      `<g:title>${escape(cut(clean(p.title), 150))}</g:title>`,
      `<g:description>${escape(cut(description, 5000))}</g:description>`,
      `<g:link>${escape(`${shop}/p/${p.slug}`)}</g:link>`,
      `<g:image_link>${escape(bestImage(image))}</g:image_link>`,
      `<g:availability>${gone ? 'out_of_stock' : 'in_stock'}</g:availability>`,
      `<g:price>${price.toFixed(2)} GBP</g:price>`,
      `<g:condition>${CONDITION[String(p.condition)] ?? 'new'}</g:condition>`,
    ];

    if (p.brand) fields.push(`<g:brand>${escape(clean(p.brand))}</g:brand>`);
    if (p.gtin) fields.push(`<g:gtin>${escape(String(p.gtin).replace(/\D/g, ''))}</g:gtin>`);
    if (p.mpn) fields.push(`<g:mpn>${escape(clean(p.mpn))}</g:mpn>`);

    /*
     * Told outright when there is no identifier.
     *
     * Without this, Google assumes one exists and was omitted, and treats the
     * product as bad data. With it, the product is understood as something with
     * no manufacturer barcode, which a lot of general merchandise genuinely is.
     */
    if (!p.gtin && !p.mpn) {
      fields.push('<g:identifier_exists>no</g:identifier_exists>');
    }

    // eBay's own path, which is the categorisation of that exact item rather
    // than a guess from the title. Google reads it as a hint alongside its own
    // taxonomy.
    if (p.category_path) {
      fields.push(`<g:product_type>${escape(String(p.category_path).split('|').map((s) => s.trim()).join(' > '))}</g:product_type>`);
    }

    items.push(`<item>\n      ${fields.join('\n      ')}\n    </item>`);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${escape(cfg.voice?.tagline ? `Cart &amp; Keep` : 'Cart &amp; Keep')}</title>
    <link>${escape(shop)}</link>
    <description>Everything for the house.</description>
    ${items.join('\n    ')}
  </channel>
</rss>`;

  console.log(`[feed] ${items.length} listed, ${skipped} skipped`);

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      // Fetched once a day, so an hour of cache costs nothing and protects the
      // database from anyone who points a crawler at this.
      'Cache-Control': 'public, max-age=3600',
    },
  });
});

// Cut on a space, so a truncated title does not end mid word.
function cut(text: string, max: number) {
  if (text.length <= max) return text;
  const slice = text.slice(0, max);
  const space = slice.lastIndexOf(' ');
  return (space > max * 0.6 ? slice.slice(0, space) : slice).trim();
}
