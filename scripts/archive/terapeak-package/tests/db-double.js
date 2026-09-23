// Test double. Records the query chain so the order clause can be asserted.
const DATA = {
  tenants: [{ id: 't1', name: 'Cart and Keep', slug: 'cart-and-keep' }],
  batches: [{ id: 'b1', tenant_id: 't1', slug: 'mobility-2026-08-17' }],
  candidates: Array.from({ length: 1150 }, (_, i) => ({ id: 'c' + i, tenant_id: 't1', external_ref: String(100000 + i) })),
  decisions: [],
  candidate_sources: [{ id: 's1', tenant_id: 't1', candidate_id: 'c1' }],
  candidate_notes: [],
  research_terms: [{ id: 'rt1', tenant_id: 't1', term: 'elderly' }],
  research_windows: [{ id: 'w1', term_id: 'rt1', window: '2026-07' }],
  listings: [], listing_performance: [], tenant_sources: [],
  category_boundaries: [], rate_cards: [{ id: 'r1', code: 'ebay' }],
};
export const CALLS = [];
function builder(table) {
  const state = { table, order: null, from: 0, to: 999, eq: null, inList: null };
  const api = {
    select() { return api; },
    order(col, opts) { state.order = col; state.asc = opts?.ascending; return api; },
    range(a, b) { state.from = a; state.to = b; return api; },
    eq(col, val) { state.eq = [col, val]; return api; },
    in(col, vals) { state.inList = [col, vals]; return api; },
    single() {
      const rows = DATA[table] ?? [];
      const hit = state.eq ? rows.find((r) => r[state.eq[0]] === state.eq[1]) : rows[0];
      return Promise.resolve({ data: hit ?? null, error: hit ? null : { message: 'no rows' } });
    },
    then(resolve) {
      CALLS.push({ ...state });
      if (!DATA[table]) return resolve({ data: null, error: { message: 'relation does not exist' } });
      if (!state.order) return resolve({ data: null, error: { message: 'test double: no order clause' } });
      let rows = DATA[table];
      if (state.eq) rows = rows.filter((r) => r[state.eq[0]] === state.eq[1]);
      if (state.inList) rows = rows.filter((r) => state.inList[1].includes(r[state.inList[0]]));
      rows = [...rows].sort((a, b) => String(a[state.order]).localeCompare(String(b[state.order])));
      return resolve({ data: rows.slice(state.from, state.to + 1), error: null });
    },
  };
  return api;
}
export async function connect() {
  return { db: { from: (t) => builder(t) }, E: { VITE_TENANT_SLUG: 'cart-and-keep' } };
}
