// A photo at the size Claude needs to judge it, not the size a buyer sees (4 October: photos were most of the bill).
// Claude charges a photo by its pixels, about one token for each 750, so a 1500px Amazon photo costs four times an
// 800px one and tells it nothing more about whether the photo is the product. Amazon, eBay and Shopify all serve a
// smaller copy from the same address with a size in it; any other shop's photo is left as it is.

export const LOOK_PX = 800;

export function forLooking(url: string, px = LOOK_PX): string | null {
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  // Amazon: /images/I/<id>._AC_SL1500_.jpg, or /images/I/<id>.jpg with no size.
  if (/(^|\.)media-amazon\.com$|(^|\.)ssl-images-amazon\.com$/.test(u.hostname) && /\/images\/I\//.test(u.pathname)) {
    const p = u.pathname.replace(/\.(_[^/]*_)\.(jpe?g|png|webp)$/i, '.$2');
    u.pathname = p.replace(/\.(jpe?g|png|webp)$/i, `._SL${px}_.$1`);
    return u.toString();
  }
  // eBay: .../s-l1600.jpg
  if (/(^|\.)ebayimg\.com$/.test(u.hostname) && /\/s-l\d+\./.test(u.pathname)) {
    u.pathname = u.pathname.replace(/\/s-l\d+\./, `/s-l${px >= 800 ? 800 : 500}.`);
    return u.toString();
  }
  // Shopify: ?width=
  if (/cdn\.shopify\.com|\/cdn\/shop\//.test(url)) {
    u.searchParams.set('width', String(px));
    return u.toString();
  }
  return null;
}
