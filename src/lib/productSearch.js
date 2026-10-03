/*
 * Finding a product in the portal's catalogue: by its title, brand, SKU, barcode or eBay item number. Every word
 * typed has to be found somewhere in those, in any order, so "towel egyptian" finds "Bath Towel Egyptian Cotton".
 * Case, accents and punctuation are set aside, so "ck-104" finds the SKU CK104 and "creme" finds "Crème".
 */

// Lower case, accents off, everything but letters and digits a space.
export function fold(text) {
  return String(text ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// The words looked for.
export function wordsOf(query) {
  return fold(query).split(' ').filter(Boolean);
}

// What a product can be found by, folded once. Codes go in both ways, joined and apart, so "CK-104" and "ck104"
// both find it.
export function searchText(p) {
  const codes = [
    ...(p.store_variants ?? []).flatMap((v) => [v.sku, v.gtin]),
    p.sku, p.gtin,
    p.derived_fields?.imported?.listing_id,
    p.slug,
  ].filter(Boolean).map(String);
  const joined = codes.map((c) => c.replace(/[^A-Za-z0-9]+/g, ''));
  return ` ${fold([p.title, p.brand, ...codes, ...joined].filter(Boolean).join(' '))} `;
}

// Every word somewhere in the text. A short number (under four digits) is matched from the start of a word, so "12"
// finds "12 pack" and "120ml" but not every barcode with a 12 in it; a longer one is a code, found anywhere in it.
export function matchesWords(text, words) {
  if (!words.length) return true;
  return words.every((w) => (/^\d{1,3}$/.test(w) ? text.includes(` ${w}`) : text.includes(w)));
}
