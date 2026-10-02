import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { SORTS } from '@lib/storeCatalogue';

// Filters live in the address, so Back, refresh and a shared link all reopen the exact view.
// ?q=scale&min=10&max=40&brand=Salter&brand=Draper&stock=1&by=1&sort=price-asc&sub=Health%20%26%20Beauty%20%3E%20Healthcare
export function useBrowseParams() {
  const [params, setParams] = useSearchParams();

  const filters = useMemo(() => {
    const n = (k) => (params.has(k) && params.get(k) !== '' && !Number.isNaN(Number(params.get(k))) ? Number(params.get(k)) : null);
    const sort = params.get('sort');
    return {
      q: params.get('q') ?? '',
      min: n('min'),
      max: n('max'),
      brands: params.getAll('brand'),
      subs: params.getAll('sub'),
      inStock: params.get('stock') === '1',
      dispatchMax: n('by'),
      sort: SORTS.includes(sort) ? sort : (params.get('q') ? 'relevance' : 'featured'),
    };
  }, [params]);

  // Typing and dragging replace the history entry; choosing a filter adds one, so Back undoes a choice, not a keystroke.
  const update = useCallback((patch, { replace = false } = {}) => {
    setParams((current) => {
      const next = new URLSearchParams(current);
      const set = (k, v) => { if (v === null || v === undefined || v === '' || v === false) next.delete(k); else next.set(k, String(v)); };
      if ('q' in patch) set('q', patch.q?.trim() || null);
      if ('min' in patch) set('min', patch.min);
      if ('max' in patch) set('max', patch.max);
      if ('brands' in patch) { next.delete('brand'); (patch.brands ?? []).forEach((b) => next.append('brand', b)); }
      if ('subs' in patch) { next.delete('sub'); (patch.subs ?? []).forEach((x) => next.append('sub', x)); }
      if ('inStock' in patch) set('stock', patch.inStock ? '1' : null);
      if ('dispatchMax' in patch) set('by', patch.dispatchMax);
      if ('sort' in patch) set('sort', patch.sort === 'featured' ? null : patch.sort);
      return next;
    }, { replace });
  }, [setParams]);

  const clear = useCallback(() => setParams(new URLSearchParams(), { replace: false }), [setParams]);

  const active = Boolean(filters.q || filters.min !== null || filters.max !== null || filters.brands.length || filters.subs.length || filters.inStock || filters.dispatchMax !== null);
  return { filters, update, clear, active };
}
