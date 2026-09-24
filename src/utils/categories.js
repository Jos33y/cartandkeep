/*
 * Grouping a catalogue into a navigation.
 *
 * This is the only copy. `scripts/enrich-store.js` imports it too, so the
 * grouping the terminal prints is the grouping the shop renders and the two
 * cannot disagree.
 *
 * Her names are applied here rather than at each call site, for the same
 * reason: a department heading, a breadcrumb and a nav item that each resolve
 * a name separately are three chances to call one shelf two things.
 */
import { displayName, isHidden, slugFor } from '@utils/categoryNames';

// The top of an eBay category path. eBay has about thirty of these, so a
// generalist catalogue lands in eight to fifteen groups rather than in forty
// leaves, which is what grouping on the leaf gives.
export function topOf(path) {
  if (!path) return null;
  return path.split('|')[0]?.trim() || null;
}

// Her section where she set one, the eBay department otherwise.
export function sectionOf(product) {
  return product?.section || topOf(product?.category_path);
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
export function groupCategories(products, { min = 3, label = 'Everything else', names = [] } = {}) {
  const buckets = new Map();
  for (const product of products) {
    const key = sectionOf(product) ?? label;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(product);
  }

  const groups = [];
  const tail = [];
  for (const [path, items] of buckets) {
    if (path !== label && items.length >= min) groups.push({ path, items });
    else tail.push(...items);
  }

  const mapped = groups.map((group) => ({
    ...group,
    // Hers where she has given one, eBay's where she has not.
    name: displayName(group.path, names),

    /*
     * The address stays derived from eBay's name unless she has set one.
     *
     * Deriving it from her name instead would mean renaming a department
     * silently moves a URL somebody has shared and Google has indexed, which
     * turns a copy edit into a broken link. Moving an address is a deliberate
     * second act, which is why `slug` on her row is optional and null by
     * default.
     */
    slug: slugFor(group.path, names, categorySlug(group.path)),

    /*
     * Off the navigation, not gone.
     *
     * The flag travels with the group rather than the group being dropped
     * here, so a category route still resolves for somebody holding the link.
     * Hidden means she has taken it out of the nav, not that the products
     * stopped existing.
     */
    hidden: isHidden(group.path, names),
  }));

  /*
   * One comparator, not two sorts.
   *
   * The first version called sortByPosition and then sorted again, which
   * throws the first ordering away: a comparator returning 0 does not preserve
   * a previous sort across a fresh one.
   *
   * Her order wins where she has given one. Everything else falls back to what
   * the shop did before, which is biggest department first, then alphabetical
   * by the name a customer actually reads rather than by eBay's.
   */
  const positionOf = (path) => {
    const hit = names.find((n) => n.path === path);
    return hit?.position ?? null;
  };

  const ordered = [...mapped].sort((a, b) => {
    const pa = positionOf(a.path);
    const pb = positionOf(b.path);

    if (pa !== null && pb !== null && pa !== pb) return pa - pb;
    if (pa !== null && pb === null) return -1;
    if (pa === null && pb !== null) return 1;

    return b.items.length - a.items.length || a.name.localeCompare(b.name);
  });

  if (tail.length) {
    ordered.push({
      path: label,
      name: label,
      items: tail,
      slug: categorySlug(label),
      hidden: false,
    });
  }

  return ordered;
}

// What belongs in the navigation, which is not the same as what exists. Called
// where a nav is rendered rather than inside the grouping, so a category page
// can still be reached by a link she has given somebody.
export const visibleGroups = (groups) => groups.filter((g) => !g.hidden);

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
