/*
 * Her name for a category, or eBay's.
 *
 * A category on this shop is an eBay path like
 * "Home, Furniture & DIY|Storage Solutions|Storage Bags", and the shop groups
 * on its segments. `store_category_names` maps a path to a name she chose, and
 * this is the only thing that reads it.
 *
 * One file, because the department navigation, a category heading, a breadcrumb
 * and the portal screen all have to agree about what a section is called. Four
 * copies of "longest match wins" is three chances for a shop to call the same
 * shelf two different things on two pages.
 */

/*
 * Longest match wins.
 *
 * A row for "Home, Furniture & DIY" renames the whole department. A row for
 * "Home, Furniture & DIY|Storage Solutions" renames one shelf inside it, and
 * takes precedence there. Sorted by path length rather than by segment count,
 * which is the same order for any path that shares a prefix and is cheaper
 * than splitting every candidate.
 */
export function resolveName(path, names) {
  if (!path) return null;

  const hit = (names ?? [])
    .filter((n) => path === n.path || path.startsWith(`${n.path}|`))
    .sort((a, b) => b.path.length - a.path.length)[0];

  return hit ?? null;
}

/*
 * What a customer reads.
 *
 * Falls back to the last segment of the path, which is what the shop shows
 * today. An absent mapping is the current behaviour exactly, which is what
 * makes this safe to ship against a live catalogue.
 */
// Exact match only, so a department's name never spills onto the shelves under it.
export function displayName(path, names) {
  const hers = (names ?? []).find((n) => n.path === path);
  if (hers?.name) return hers.name;

  const segments = String(path ?? '').split('|').filter(Boolean);
  return segments[segments.length - 1] ?? '';
}

/*
 * Whether a section is off the navigation.
 *
 * Hidden is inherited: hiding a department hides the shelves inside it, because
 * a shelf reachable from nowhere but still in the navigation is a section that
 * looks broken rather than withdrawn.
 */
export const isHidden = (path, names) => {
  const segments = String(path ?? '').split('|').filter(Boolean);
  for (let i = segments.length; i > 0; i -= 1) {
    const at = (names ?? []).find((n) => n.path === segments.slice(0, i).join('|'));
    if (at?.hidden) return true;
  }
  return false;
};

/*
 * Her order, then everything else alphabetically.
 *
 * Null position sorts last rather than first, so a shop where she has ordered
 * three departments and left the rest shows those three at the front and the
 * remainder in a predictable order behind them.
 */
export function sortByPosition(items, names) {
  const posOf = (path) => resolveName(path, names)?.position ?? null;

  return [...items].sort((a, b) => {
    const pa = posOf(a.path ?? a);
    const pb = posOf(b.path ?? b);
    if (pa !== null && pb !== null && pa !== pb) return pa - pb;
    if (pa !== null && pb === null) return -1;
    if (pa === null && pb !== null) return 1;
    return displayName(a.path ?? a, names).localeCompare(displayName(b.path ?? b, names));
  });
}

/*
 * The web address.
 *
 * Hers when she has set one, otherwise whatever the shop already generates, so
 * renaming a department does not silently move a URL somebody has shared or
 * Google has indexed. Moving an address is a deliberate second act.
 */
export const slugFor = (path, names, fallback) =>
  resolveName(path, names)?.slug ?? fallback;
