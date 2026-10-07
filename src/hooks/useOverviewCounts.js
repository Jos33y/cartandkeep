import { useEffect, useState } from 'react';
import { supabase } from '@lib/supabase';

/*
 * The Overview's top figures from the database in one quick read (overview_counts and live_listing_counts, 0146), so
 * they never wait on the heavy reads below them. A read that fails is tried again; until a figure arrives the last
 * one this browser saw is shown, and with none, the tile's placeholder. A failed read never shows as 0.
 */
const KEY = (tenantId) => `ck.overview.${tenantId}`;
const TRIES = 3;

const remembered = (tenantId) => {
  try { return JSON.parse(localStorage.getItem(KEY(tenantId)) ?? 'null'); } catch { return null; }
};
const remember = (tenantId, v) => {
  try { localStorage.setItem(KEY(tenantId), JSON.stringify(v)); } catch { /* the figures still show */ }
};

async function read(fn, tenantId) {
  for (let i = 0; i < TRIES; i += 1) {
    const { data, error } = await supabase.rpc(fn, { p_tenant: tenantId });
    if (!error && data) return data;
    if (i < TRIES - 1) await new Promise((r) => setTimeout(r, 800 * (i + 1)));
  }
  return null;
}

export function useOverviewCounts(tenantId) {
  const [counts, setCounts] = useState(() => (tenantId ? remembered(tenantId) : null));
  useEffect(() => {
    if (!tenantId) return undefined;
    let live = true;
    setCounts((c) => c ?? remembered(tenantId));
    (async () => {
      const [own, listings] = await Promise.all([read('overview_counts', tenantId), read('live_listing_counts', tenantId)]);
      if (!live) return;
      setCounts((before) => {
        const next = {
          approved: own?.approved ?? before?.approved ?? null,
          listedHere: own?.listed_here ?? before?.listedHere ?? null,
          onEbay: listings?.ebay ?? before?.onEbay ?? null,
          onShop: listings?.shop ?? before?.onShop ?? null,
          noShop: listings?.no_shop ?? before?.noShop ?? null,
          drafts: listings?.drafts ?? before?.drafts ?? null,
        };
        remember(tenantId, next);
        return next;
      });
    })();
    return () => { live = false; };
  }, [tenantId]);
  return counts ?? { approved: null, listedHere: null, onEbay: null, onShop: null, noShop: null, drafts: null };
}
