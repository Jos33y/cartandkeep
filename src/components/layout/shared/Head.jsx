import { useEffect } from 'react';

/*
 * Per route title, description, canonical and structured data.
 *
 * No helmet library. Three routes need this, the whole job is setting
 * document.title and a handful of meta tags, and a dependency for that is
 * weight on a shopper's first paint to do what twenty lines of effect already
 * does.
 *
 * Everything it sets, it puts back on unmount. A description left behind from
 * a product page while somebody reads the terms is worse than no description,
 * because a crawler reads what is in the DOM at the time.
 *
 * Closes three of the seventeen Section 4 items on its own: page titles across
 * every page, meta descriptions across every page, and the product half of the
 * schema markup line.
 */

const SITE = 'https://cartandkeep.com';

function upsert(selector, create) {
  let el = document.head.querySelector(selector);
  let created = false;
  if (!el) {
    el = create();
    document.head.appendChild(el);
    created = true;
  }
  return { el, created };
}

function meta(name, content, property = false) {
  const key = property ? 'property' : 'name';
  const { el, created } = upsert(`meta[${key}="${name}"]`, () => {
    const m = document.createElement('meta');
    m.setAttribute(key, name);
    return m;
  });
  const previous = el.getAttribute('content');
  el.setAttribute('content', content);
  return () => {
    if (created) el.remove();
    else if (previous !== null) el.setAttribute('content', previous);
  };
}

export function Head({ title, description, path, image, noindex = false, schema = null }) {
  useEffect(() => {
    const undo = [];

    // The suffix lives here rather than at every call site, so no page can
    // forget it and none can print it twice.
    const full = title ? `${title} | Cart & Keep` : 'Cart & Keep';
    const previousTitle = document.title;
    document.title = full;
    undo.push(() => { document.title = previousTitle; });

    if (description) {
      undo.push(meta('description', description));
      undo.push(meta('og:description', description, true));
      undo.push(meta('twitter:description', description));
    }

    undo.push(meta('og:title', full, true));
    undo.push(meta('twitter:title', full));

    if (path) {
      const url = `${SITE}${path}`;
      const { el, created } = upsert('link[rel="canonical"]', () => {
        const l = document.createElement('link');
        l.rel = 'canonical';
        return l;
      });
      const previous = el.getAttribute('href');
      el.setAttribute('href', url);
      undo.push(() => {
        if (created) el.remove();
        else if (previous) el.setAttribute('href', previous);
      });
      undo.push(meta('og:url', url, true));
    }

    if (image) {
      undo.push(meta('og:image', image, true));
      undo.push(meta('twitter:image', image));
    }

    if (noindex) undo.push(meta('robots', 'noindex, follow'));

    // Route graphs go in their own tag, so the organisation and website graph
    // in index.html is never overwritten by a page.
    let script = null;
    if (schema) {
      script = document.createElement('script');
      script.type = 'application/ld+json';
      script.dataset.route = 'true';
      script.textContent = JSON.stringify(schema);
      document.head.appendChild(script);
    }

    return () => {
      undo.reverse().forEach((fn) => fn());
      if (script) script.remove();
    };
  }, [title, description, path, image, noindex, JSON.stringify(schema)]);

  return null;
}

/*
 * Product structured data.
 *
 * Only what is true. A Product without an offer is rejected, and an invented
 * aggregateRating is worse than rejected, so there is no rating here and there
 * will not be one until there are reviews behind it.
 */
export function productSchema(product, { path }) {
  const price = Number(product.price);
  const availability = {
    in_stock: 'https://schema.org/InStock',
    low_stock: 'https://schema.org/LimitedAvailability',
    out_of_stock: 'https://schema.org/OutOfStock',
    made_to_order: 'https://schema.org/PreOrder',
    discontinued: 'https://schema.org/Discontinued',
  }[product.availability] ?? 'https://schema.org/InStock';

  const node = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    url: `${SITE}${path}`,
    image: (product.images?.length ? product.images : [product.image_url]).filter(Boolean),
    offers: {
      '@type': 'Offer',
      priceCurrency: 'GBP',
      price: price.toFixed(2),
      availability,
      url: `${SITE}${path}`,
      itemCondition: product.condition === 'New'
        ? 'https://schema.org/NewCondition'
        : 'https://schema.org/UsedCondition',
      seller: { '@id': `${SITE}/#organization` },
    },
  };

  if (product.brand) node.brand = { '@type': 'Brand', name: product.brand };
  if (product.gtin) node.gtin = product.gtin;
  if (product.mpn) node.mpn = product.mpn;
  if (product.description) node.description = product.description;

  return node;
}

export function breadcrumbSchema(trail) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map(({ name, path }, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name,
      item: `${SITE}${path}`,
    })),
  };
}

// Meta descriptions have to be written, not generated, but 78 products cannot
// wait for that. This produces something specific and true from the fields we
// have, and a written one replaces it the moment it exists.
export function productDescription(product, { leaf, formatPrice }) {
  const brand = product.brand ? `${product.brand} ` : '';
  const what = leaf ? `${brand}${leaf.toLowerCase()}` : `${brand}${product.title}`.trim();
  const price = formatPrice(Number(product.price));
  const post = Number(product.price) >= 40 ? 'Free UK delivery' : 'UK delivery from £3.95';
  return `${what.charAt(0).toUpperCase()}${what.slice(1)}, ${price}. ${post}, 30 day returns, no account needed. ${product.title}`.slice(0, 300);
}
