import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@lib/supabase';

// Everything live, from three places: what the portal published to eBay, what
// is on the shop, and what the last traffic pull says about each.
export function useListings(tenantId) {
  const [state, setState] = useState({ status: 'loading', items: [], window: null, error: null });

  const load = useCallback(async () => {
    if (!tenantId) return;

    const [cand, shop] = await Promise.all([
      supabase
        .from('candidates')
        .select(`
          id, title, image_url, listing, draft, ebay, margin, entry,
          store_products ( id, status, slug, price )
        `)
        .eq('tenant_id', tenantId)
        .not('ebay', 'is', null),
      supabase
        .from('store_products')
        .select('id, status, slug, price, title, image_url, candidate_id, source_kind, source_ref, created_at, updated_at')
        .eq('tenant_id', tenantId)
        .in('status', ['live', 'draft']),
    ]);

    if (cand.error || shop.error) {
      return setState({ status: 'error', items: [], window: null, error: (cand.error ?? shop.error).message });
    }

    const published = cand.data ?? [];
    const linked = new Set(published.map((c) => c.id));

    const fromPortal = published.map((c) => ({
      key: `c-${c.id}`,
      candidateId: c.id,
      row: c,
      title: c.draft?.title ?? c.listing?.title ?? c.title,
      image: (c.draft?.images ?? c.listing?.images ?? [])[0] ?? c.image_url,
      origin: 'portal',
      ebay: c.ebay,
      listingId: c.ebay?.listing_id ?? null,
      shop: (c.store_products ?? [])[0] ?? null,
      since: c.ebay?.published_at ?? null,
    }));

    // Shop products seeded from her eBay listings are on both channels; the
    // eBay side just was not published from here.
    const fromShop = (shop.data ?? [])
      .filter((s) => !s.candidate_id || !linked.has(s.candidate_id))
      .map((s) => ({
        key: `s-${s.id}`,
        candidateId: null,
        row: null,
        title: s.title,
        image: s.image_url,
        origin: s.source_kind === 'ebay_listing' ? 'existing' : null,
        ebay: null,
        listingId: s.source_kind === 'ebay_listing' ? s.source_ref : null,
        shop: s,
        since: s.created_at,
      }));

    let items = [...fromPortal, ...fromShop];
    let window = null;

    const ids = items.map((i) => i.listingId).filter(Boolean);
    if (ids.length) {
      const { data: latest } = await supabase
        .from('ebay_traffic')
        .select('window_start, window_end')
        .eq('tenant_id', tenantId)
        .order('window_end', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latest) {
        window = latest;
        const { data: rows } = await supabase
          .from('ebay_traffic')
          .select('listing_id, impressions, views, transactions')
          .eq('tenant_id', tenantId)
          .eq('window_start', latest.window_start)
          .eq('window_end', latest.window_end)
          .in('listing_id', ids);

        const byId = new Map((rows ?? []).map((r) => [r.listing_id, r]));
        items = items.map((i) => ({ ...i, traffic: i.listingId ? byId.get(i.listingId) ?? null : null }));
      }
    }

    items.sort((a, b) => new Date(b.since ?? 0) - new Date(a.since ?? 0));
    setState({ status: 'ready', items, window, error: null });
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  // Same product the Approved page creates: a draft, never live, because the
  // shop keeps unconfirmed returns and hazard fields off sale.
  const addToShop = useCallback(async (item, product) => {
    const { data, error } = await supabase
      .from('store_products')
      .upsert(
        {
          tenant_id: tenantId,
          status: 'draft',
          source_kind: 'candidate',
          candidate_id: item.candidateId,
          source_ref: item.candidateId,
          ...product,
        },
        { onConflict: 'tenant_id,slug' },
      )
      .select('id, status, slug, price')
      .single();

    if (error) throw error;
    setState((s) => ({
      ...s,
      items: s.items.map((i) => (i.key === item.key ? { ...i, shop: data } : i)),
    }));
    return data;
  }, [tenantId]);

  // Revises the live listing in place from the portal's copy of the product.
  const updateOnEbay = useCallback(async (item, { price, quantity, parcel }) => {
    const { data, error } = await supabase.functions.invoke('ebay-list', {
      body: {
        tenant_id: tenantId,
        candidate_id: item.candidateId,
        update: true,
        price: Number(price),
        quantity: Number(quantity),
        package: parcel,
      },
    });
    if (error || data?.error) throw new Error(data?.error ?? error.message);

    setState((s) => ({
      ...s,
      items: s.items.map((i) => (i.key === item.key ? { ...i, ebay: data } : i)),
    }));
    return data;
  }, [tenantId]);

  // eBay's own copy of a listing, including edits made outside the portal.
  const readLive = useCallback(async (item) => {
    const { data, error } = await supabase.functions.invoke('ebay-item', {
      body: { tenant_id: tenantId, listing_id: item.listingId },
    });
    if (error || data?.error) throw new Error(data?.error ?? error.message);
    return data;
  }, [tenantId]);

  return { ...state, reload: load, addToShop, updateOnEbay, readLive };
}
