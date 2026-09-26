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
import { displayName, isHidden } from '@utils/categoryNames';

// The top of an eBay category path. eBay has about thirty of these, so a
// generalist catalogue lands in eight to fifteen groups rather than in forty
// leaves, which is what grouping on the leaf gives.
export function topOf(path) {
  if (!path) return null;
  return path.split('|')[0]?.trim() || null;
}

// Her section, or none (Odds and ends). eBay's category is only a hint the agent reads, never a section.
export function sectionOf(product) {
  return product?.section || null;
}

export function leafOf(path) {
  if (!path) return null;
  return path.split('|').pop()?.trim() || null;
}

// The URL for a group. Derived rather than stored, because the groups are
// themselves derived and a stored slug would outlive the group it named.
// The catch-all group's name on the shop. Its key stays 'Everything else', which the portal and the grouping use.
export const LEFTOVER_NAME = 'Odds and ends';

// Her slug, else one from her name. Every address the section used to have stays as an alias that redirects.
export function addressOf(path, names) {
  const row = (names ?? []).find((n) => n.path === path);
  const slug = row?.slug || categorySlug(row?.name || path);
  const legacy = String(path).startsWith('own:') ? [] : [categorySlug(path)];
  const aliases = [...new Set([...(row?.aliases ?? []), ...legacy])].filter((a) => a && a !== slug);
  return { slug, aliases };
}

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

    // Her address from her name; the eBay address stays as an alias that redirects, so a renamed department never breaks a shared link.
    ...addressOf(group.path, names),

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
      name: LEFTOVER_NAME,
      items: tail,
      slug: categorySlug(LEFTOVER_NAME),
      aliases: [categorySlug(label)],
      hidden: false,
    });
  }

  // Two departments whose names give the same address: the later one keeps its eBay address.
  const taken = new Set();
  for (const group of ordered) {
    if (taken.has(group.slug) && group.aliases?.length) {
      group.slug = group.aliases[0];
      group.aliases = [];
    }
    taken.add(group.slug);
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

// Matches an old address too; the page redirects from it to the group's own.
export function findGroup(groups, slug) {
  return groups.find((group) => group.slug === slug)
    ?? groups.find((group) => group.aliases?.includes(slug))
    ?? null;
}

// eBay serves whatever size the seller uploaded. Asking for one size stops a
// grid of mixed sources jumping as images land.
export function imageAt(url, size = 500) {
  if (!url) return null;
  return url.replace(/\/s-l\d+\./, `/s-l${size}.`);
}

// Groups from the database's counts, with the same rules as groupCategories: under the threshold folds into the leftover group, her order first, then biggest.
export function groupsFromCounts(counts, { min = 3, label = 'Everything else', names = [] } = {}) {
  const positionOf = (path) => (names ?? []).find((n) => n.path === path)?.position ?? null;
  const main = [];
  const tail = [];
  for (const c of counts ?? []) {
    if (c.key && c.key !== label && c.count >= min) main.push(c);
    else tail.push(c);
  }

  const groups = main.map((c) => ({
    path: c.key,
    keys: [c.key],
    name: displayName(c.key, names),
    ...addressOf(c.key, names),
    hidden: isHidden(c.key, names),
    count: c.count,
    priceMin: c.priceMin,
    priceMax: c.priceMax,
    images: c.images,
  }));

  // Two groups that read the same to a shopper are one shelf: her own section and an eBay department she renamed to the same words.
  const byName = new Map();
  for (const g of groups) {
    const same = byName.get(g.name.toLowerCase());
    if (!same) { byName.set(g.name.toLowerCase(), g); continue; }
    same.keys.push(...g.keys);
    same.count += g.count;
    same.priceMin = Math.min(same.priceMin, g.priceMin);
    same.priceMax = Math.max(same.priceMax, g.priceMax);
    same.images = [...same.images, ...g.images].slice(0, 3);
    same.aliases = [...new Set([...(same.aliases ?? []), g.slug, ...(g.aliases ?? [])])].filter((a) => a !== same.slug);
    same.hidden = same.hidden && g.hidden;
  }
  groups.length = 0;
  groups.push(...byName.values());

  groups.sort((a, b) => {
    const pa = positionOf(a.path);
    const pb = positionOf(b.path);
    if (pa !== null && pb !== null && pa !== pb) return pa - pb;
    if (pa !== null && pb === null) return -1;
    if (pa === null && pb !== null) return 1;
    return b.count - a.count || a.name.localeCompare(b.name);
  });

  if (tail.length) {
    groups.push({
      path: label,
      keys: tail.map((c) => c.key),
      name: LEFTOVER_NAME,
      slug: categorySlug(LEFTOVER_NAME),
      aliases: [categorySlug(label)],
      hidden: false,
      count: tail.reduce((n, c) => n + c.count, 0),
      priceMin: Math.min(...tail.map((c) => c.priceMin)),
      priceMax: Math.max(...tail.map((c) => c.priceMax)),
      images: tail.flatMap((c) => c.images).slice(0, 3),
    });
  }

  // Different names that still make the same address: the later one falls back to its eBay address, or a numbered one.
  const taken = new Set();
  for (const group of groups) {
    if (taken.has(group.slug)) {
      const free = (group.aliases ?? []).find((a) => !taken.has(a));
      group.slug = free ?? `${group.slug}-${[...taken].filter((t) => t.startsWith(group.slug)).length + 1}`;
      group.aliases = (group.aliases ?? []).filter((a) => a !== group.slug);
    }
    taken.add(group.slug);
  }
  return groups;
}
