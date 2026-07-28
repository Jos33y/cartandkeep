import * as ebayBrowse from './ebayBrowse.js';
import * as csvExport from './csvExport.js';
import * as cjDropshipping from './cjDropshipping.js';

// Signal: { externalRef, title, category?, imageUrl?, kind, value, price?, landedCost?, raw? }
// kind: velocity | pricing | depth | demand | supply | seasonality
// value: 0..1, normalised in the adapter so scoring stays source-agnostic

const REGISTRY = new Map();

function register(adapter) {
  if (!adapter.id) throw new Error('adapter missing id');
  if (typeof adapter.fetch !== 'function') throw new Error(`${adapter.id} missing fetch`);
  REGISTRY.set(adapter.id, adapter);
}

register(ebayBrowse);
register(csvExport.zikExport);
register(csvExport.terapeakExport);
register(cjDropshipping);

export function getAdapter(sourceId) {
  return REGISTRY.get(sourceId) ?? null;
}

export function listAdapters() {
  return [...REGISTRY.keys()];
}

// One source failing must not fail the batch. Monday delivery is the commitment.
export async function collect({ tenant, tenantSources, query, onSourceResult }) {
  const results = [];

  await Promise.all(
    tenantSources
      .filter((ts) => ts.enabled)
      .map(async (ts) => {
        const adapter = getAdapter(ts.source_id);
        if (!adapter) {
          await onSourceResult?.({ sourceId: ts.source_id, status: 'missing_adapter' });
          return;
        }
        try {
          const signals = await adapter.fetch({
            tenant,
            config: ts.config ?? {},
            credentials: ts.credential_ref,
            query,
          });
          results.push({ sourceId: ts.source_id, weight: Number(ts.weight), signals });
          await onSourceResult?.({ sourceId: ts.source_id, status: 'ok', count: signals.length });
        } catch (err) {
          await onSourceResult?.({ sourceId: ts.source_id, status: 'error', error: err.message });
        }
      }),
  );

  return results;
}
