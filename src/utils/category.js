// eBay returns the whole tree, "Pet Supplies|Dog Supplies|Beds". Rendering only
// the leaf turned every candidate into "Beds" and threw away the level that
// actually distinguishes them. Separator varies by endpoint, so accept both.
export function segments(path) {
  if (!path) return [];
  return String(path).split(/\s*[|>]\s*/).map((s) => s.trim()).filter(Boolean);
}

export const breadcrumb = (path) => segments(path).join(' → ');

// Longest prefix wins, so a tenant can group coarsely on Pet Supplies or finely
// on Dog Supplies and Cat Supplies without a schema change. Beauty later works
// the same way: Health & Beauty, then Make-up, then Tools.
export function matchBoundary(path, boundaries = []) {
  const parts = segments(path);
  if (!parts.length) return { label: 'Not known', agreed: false, depth: 0 };

  let best = null;

  for (const b of boundaries) {
    const prefix = segments(b.ebay_path_prefix);
    if (!prefix.length || prefix.length > parts.length) continue;
    if (prefix.some((seg, i) => seg.toLowerCase() !== parts[i].toLowerCase())) continue;
    if (!best || prefix.length > best.depth) {
      best = { label: b.label, agreed: b.agreed !== false, depth: prefix.length };
    }
  }

  // Unmapped is surfaced, not silently folded into whatever is nearest. The
  // research finding money outside the agreed scope is hers to rule on.
  if (!best) return { label: parts[1] ?? parts[0], agreed: false, depth: 0 };

  return best;
}
