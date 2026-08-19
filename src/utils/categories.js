/*
 * Grouping a catalogue into a navigation.
 *
 * This is the only copy. `scripts/enrich-store.js` imports it too, so the
 * grouping the terminal prints is the grouping the shop renders and the two
 * cannot disagree.
 */

// The top of an eBay category path. eBay has about thirty of these, so a
// generalist catalogue lands in eight to fifteen groups rather than in forty
// leaves, which is what grouping on the leaf gives.
export function topOf(path) {
  if (!path) return null;
  return path.split('|')[0]?.trim() || null;
}

export function leafOf(path) {
  if (!path) return null;
  return path.split('|').pop()?.trim() || null;
}

// The URL for a group. Derived rather than stored, because the groups are
// themselves derived and a stored slug would outlive the group it named.
export function categorySlug(name) {
  return String(name)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/*
 * Two failures this avoids.
 *
 * A nav on leaf categories gives seventy eight products about forty entries,
 * most with a single product behind them. A nav that assumes a fixed small
 * number of groups breaks the first time the catalogue changes shape, and this
 * catalogue is generalist and will.
 *
 * So: group on the top of the path, sort by size, and fold anything under the
 * threshold into one group rather than giving one product its own entry. If
 * every group is small the result is a single group, which is the honest
 * answer that there is no useful grouping here yet.
 */
export function groupCategories(products, { min = 3, label = 'Everything else' } = {}) {
  const buckets = new Map();
  for (const product of products) {
    const key = topOf(product.category_path) ?? label;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(product);
  }

  const groups = [];
  const tail = [];
  for (const [name, items] of buckets) {
    if (name !== label && items.length >= min) groups.push({ name, items });
    else tail.push(...items);
  }

  groups.sort((a, b) => b.items.length - a.items.length || a.name.localeCompare(b.name));
  if (tail.length) groups.push({ name: label, items: tail });

  return groups.map((group) => ({ ...group, slug: categorySlug(group.name) }));
}

/*
 * Shelves that are not departments.
 *
 * "What can I get for twenty pounds" is the question a general store gets
 * asked most, and a category nav cannot answer it. These are real routes
 * rather than display-only shelves, so the browse link works and nobody hits
 * a shelf of eight with sixteen more they cannot reach.
 *
 * A band only appears with at least four products in it. Three is not a shelf.
 */
const PRICE_BANDS = [
  { name: 'Under \u00a320', slug: 'under-20', max: 20 },
];

export function priceGroups(products, { min = 4 } = {}) {
  return PRICE_BANDS
    .map(({ name, slug, max }) => ({
      name,
      slug,
      derived: true,
      items: products
        .filter((p) => Number(p.price) < max)
        .sort((a, b) => Number(b.price) - Number(a.price)),
    }))
    .filter((group) => group.items.length >= min);
}

// Departments and price bands together, which is what a category route has to
// resolve against. Departments first, because they are the real taxonomy.
export function allGroups(products, options) {
  return [...groupCategories(products, options), ...priceGroups(products)];
}

export function findGroup(groups, slug) {
  return groups.find((group) => group.slug === slug) ?? null;
}

// eBay serves whatever size the seller uploaded. Asking for one size stops a
// grid of mixed sources jumping as images land.
export function imageAt(url, size = 500) {
  if (!url) return null;
  return url.replace(/\/s-l\d+\./, `/s-l${size}.`);
}
