// Matching the same product across sources is the hard part of this pipeline.
// eBay, AliExpress and CJ use different identifiers for the same item, and their
// titles differ wildly: marketplace titles are keyword-stuffed, supplier titles
// are terse. So grouping is by token overlap, not by an exact key.
//
// This is still a heuristic and it will get things wrong. Isolated here so it
// can be replaced without touching the runner or the scorer.

const NOISE = new Set([
  'the', 'and', 'for', 'with', 'set', 'kit', 'pack', 'new', 'uk', 'pcs', 'pc',
  'of', 'a', 'in', 'to', 'free', 'hot', 'sale', 'quality', 'premium', 'style',
  'professional', 'portable', 'mini', 'large', 'small', 'size', 'colour',
  'color', 'best', 'top', 'super', 'soft', 'multi',
]);

// Crude singular form so "dogs" and "dog" land in the same bucket.
function stem(word) {
  if (word.endsWith('ies') && word.length > 4) return `${word.slice(0, -3)}y`;
  if (word.endsWith('sses')) return word.slice(0, -2);
  if (word.endsWith('s') && !word.endsWith('ss') && word.length > 3) return word.slice(0, -1);
  return word;
}

export function tokenise(title) {
  if (!title) return new Set();
  return new Set(
    String(title)
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !/^\d+$/.test(w))
      .map(stem)
      .filter((w) => !NOISE.has(w)),
  );
}

// Overlap coefficient rather than Jaccard: a six word supplier title and a
// twenty word marketplace title describing the same product should score high,
// and Jaccard punishes that length difference.
export function similarity(a, b) {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared += 1;
  // One word in common is a coincidence, not a match.
  if (shared < 2) return 0;
  return shared / Math.min(a.size, b.size);
}

const THRESHOLD = 0.6;

export function groupSignals(collected, threshold = THRESHOLD) {
  const groups = [];

  for (const { sourceId, weight, signals } of collected) {
    for (const signal of signals) {
      const tokens = tokenise(signal.title);
      if (!tokens.size && !signal.externalRef) continue;

      let best = null;
      let bestScore = 0;
      for (const g of groups) {
        const score = similarity(tokens, g.tokens);
        if (score > bestScore) {
          bestScore = score;
          best = g;
        }
      }

      let g = bestScore >= threshold ? best : null;

      if (!g) {
        g = {
          tokens,
          title: signal.title ?? signal.externalRef,
          category: null,
          imageUrl: null,
          supplierUrl: null,
          externalRefs: {},
          mergedTitles: [],
          signals: [],
          prices: [],
          landedCosts: [],
        };
        groups.push(g);
      } else {
        for (const t of tokens) g.tokens.add(t);
      }

      if (signal.title && !g.mergedTitles.includes(signal.title)) g.mergedTitles.push(signal.title);
      // Keep the longest title: it usually carries the useful detail.
      if (signal.title && signal.title.length > g.title.length) g.title = signal.title;
      g.category ??= signal.category ?? null;
      g.imageUrl ??= signal.imageUrl ?? null;
      g.supplierUrl ??= signal.supplierUrl ?? null;
      if (signal.externalRef) g.externalRefs[sourceId] = signal.externalRef;

      g.signals.push({
        sourceId,
        source_id: sourceId,
        kind: signal.kind,
        signal: signal.kind,
        value: signal.value,
        weight,
      });

      if (Number.isFinite(signal.price)) g.prices.push(signal.price);
      if (Number.isFinite(signal.landedCost)) g.landedCosts.push(signal.landedCost);
    }
  }

  return groups.map(({ tokens, ...rest }) => ({ ...rest, key: [...tokens].sort().join('-') }));
}

export function median(values) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
