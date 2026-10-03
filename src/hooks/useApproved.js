import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@lib/supabase';
import { readPages } from '@lib/readPages';
import { channelStates, gtinOf } from '@lib/golive';

// Same to-one embed as the candidates read.
function one(decisions) {
  if (Array.isArray(decisions)) return decisions[0] ?? null;
  return decisions ?? null;
}

// The same product approved more than once: the same barcode, or the same title. The card already started on a
// channel keeps its place, else the strongest; the rest point at it. Research titles, not hers, so two drafts
// written differently are still caught.
// A supplier as the card holds it: what the page loads, what an add or a cost change returns.
const SOURCE_COLUMNS = `
  id, supplier, supplier_kind, fulfilment, status, url, note,
  unit_cost, moq, price_at_moq, supplier_shipping,
  inbound_freight_per_unit, duty_pct, landed_unit_cost,
  ships_from, transit_days, confirmed, quoted_on, matched_on, cost_by
`;
const byLanded = (a, b) => Number(a.landed_unit_cost ?? 1e9) - Number(b.landed_unit_cost ?? 1e9);

const words = (t) => String(t ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
function markDuplicates(rows) {
  const keeper = new Map();
  const keys = (r) => [gtinOf(r) && `g:${gtinOf(r)}`, words(r.title) && `t:${words(r.title)}`].filter(Boolean);
  // Started cards claim their keys first.
  const order = [...rows].sort((a, b) => Number(channelStates(b).started.length > 0) - Number(channelStates(a).started.length > 0));
  const marked = new Map();
  for (const r of order) {
    const hit = keys(r).map((k) => keeper.get(k)).find(Boolean);
    if (hit && hit.id !== r.id) marked.set(r.id, { id: hit.id, title: hit.title });
    else keys(r).forEach((k) => keeper.set(k, r));
  }
  return rows.map((r) => ({ ...r, duplicate_of: marked.get(r.id) ?? null }));
}

// Evidence first, then value. A median-priced row carries the bigger figure
// precisely because nobody has been paid it.
function byListOrder(a, b) {
  const trust = (r) => (r.margin?.list_trusted === true ? 0 : 1);
  const worth = (r) => r.margin?.net ?? r.margin?.max_goods_cost ?? 0;
  return trust(a) - trust(b) || worth(b) - worth(a);
}

// A function's own error message, which supabase-js hides behind a generic one when the status is not 2xx.
async function invoke(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    const said = await error.context?.json?.().catch(() => null);
    throw new Error(said?.error ?? error.message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

// The first of this month, UK time, for counting what went up on eBay this month.
function monthStart(now = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit' })
    .formatToParts(now).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-01`;
}

// Approved is not batch scoped. What she committed to three weeks ago is still
// waiting to be listed, so this reads across every batch.
export function useApproved(tenantId) {
  const [state, setState] = useState({ status: 'loading', rows: [], error: null });
  // Listed on eBay from here this month, against her monthly limit.
  const [month, setMonth] = useState(null);

  // The latest listing job per card: queued, working, done or failed, with eBay's words when it failed.
  const [jobs, setJobs] = useState({});
  const loadJobs = useCallback(async () => {
    if (!tenantId) return {};
    const { data } = await supabase.from('listing_jobs')
      .select('id, candidate_id, state, error, attempts, request, created_at, finished_at')
      .eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(1000);
    const latest = {};
    for (const j of data ?? []) if (!latest[j.candidate_id]) latest[j.candidate_id] = j;
    setJobs(latest);
    return latest;
  }, [tenantId]);
  useEffect(() => { loadJobs(); }, [loadJobs]);

  const countMonth = useCallback(async () => {
    if (!tenantId) return;
    const { count } = await supabase.from('candidates').select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId).gte('ebay->>published_at', monthStart());
    setMonth(count ?? 0);
  }, [tenantId]);
  useEffect(() => { countMonth(); }, [countMonth]);

  const load = useCallback(async () => {
    if (!tenantId) return;
    // The skeleton only on the first read: a reload after a queued card goes live must not close the card she is in.
    setState((s) => (s.status === 'ready' ? s : { ...s, status: 'loading' }));

    // In pages: past 1,000 approved cards a single read would stop short without saying so.
    const { data, error } = await readPages(() => supabase
      .from('candidates')
      .select(`
        id, title, category, external_ref, reference_url, classification,
        image_url, ebay_category_id, ebay_category_path, variation_count,
        score, breakdown, margin, headroom, hold, same_sku_sellers, bulky,
        entry, monthly_headroom, active_listings,
        listing, draft, ebay, competition, photo_checks, supplier_read,
        store_products ( id, status, slug ),
        sold_30d, avg_sold_price, window_start, window_series,
        recommended_channels,
        batches ( delivered_for ),
        decisions!inner ( action, decided_at, note, made_by ),
        candidate_sources (
          id, supplier, supplier_kind, fulfilment, status, url, note,
          unit_cost, moq, price_at_moq, supplier_shipping,
          inbound_freight_per_unit, duty_pct, landed_unit_cost,
          ships_from, transit_days, confirmed, quoted_on, matched_on, cost_by
        )
      `)
      .eq('tenant_id', tenantId)
      .eq('decisions.action', 'approve'));

    if (error) return setState({ status: 'error', rows: [], error });

    setState({
      status: 'ready',
      // A card stays until every channel it is meant for has started: live on eBay, and on her shop as a draft
      // or on sale. A card on eBay still waiting for the shop stays, with only the shop left to do.
      rows: markDuplicates(data.filter((c) => channelStates(c).left.length > 0).map(({ decisions, batches, candidate_sources: sources, ...c }) => ({
        ...c,
        decision: one(decisions),
        delivered_for: batches?.delivered_for ?? null,
        sources: [...(sources ?? [])].sort(
          (a, b) => Number(a.landed_unit_cost ?? 1e9) - Number(b.landed_unit_cost ?? 1e9),
        ),
      })).sort(byListOrder)),
      error: null,
    });
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  // She prices from this page, so a supplier has to be addable here rather than
  // only on the candidate queue.
  const addSource = useCallback(
    async ({ candidateId, tenantId, ...fields }) => {
      const { data, error } = await supabase
        .from('candidate_sources')
        .insert({ candidate_id: candidateId, tenant_id: tenantId, ...fields })
        .select(SOURCE_COLUMNS)
        .single();

      if (error) throw error;

      setState((s) => ({
        ...s,
        rows: s.rows.map((r) => (r.id === candidateId
          ? {
            ...r,
            sources: [...(r.sources ?? []), data].sort(
              (a, b) => Number(a.landed_unit_cost ?? 1e9) - Number(b.landed_unit_cost ?? 1e9),
            ),
          }
          : r)),
      }));
    },
    [],
  );

  // One supplier, new or changed, into the page's copy of its card, cheapest first as the page loads them.
  const putSource = useCallback((candidateId, source) => {
    setState((s) => ({
      ...s,
      rows: s.rows.map((r) => (r.id === candidateId
        ? { ...r, sources: [...(r.sources ?? []).filter((x) => x.id !== source.id), source].sort(byLanded) }
        : r)),
    }));
  }, []);

  // A supplier's cost changed from the card, by her or by taking Amazon's price. Only her own shop's row.
  const updateSource = useCallback(async (candidateId, sourceId, fields) => {
    const { data, error } = await supabase
      .from('candidate_sources')
      .update(fields)
      .eq('id', sourceId)
      .eq('tenant_id', tenantId)
      .select(SOURCE_COLUMNS)
      .single();
    if (error) throw error;
    putSource(candidateId, data);
    return data;
  }, [tenantId, putSource]);

  // Her saved draft, back into the page's copy of the card.
  const noteDraft = useCallback((candidateId, draft) => {
    setState((s) => ({ ...s, rows: s.rows.map((r) => (r.id === candidateId ? { ...r, draft } : r)) }));
  }, []);

  // The shop page a function read for the first time, onto the page's copy of the card.
  const noteListing = useCallback((candidateId, listing) => {
    setState((s) => ({ ...s, rows: s.rows.map((r) => (r.id === candidateId && !r.listing ? { ...r, listing } : r)) }));
  }, []);

  // A change to her draft made from the page rather than the open card (item details from the check sheet, photos
  // found in bulk), merged over what is saved, as the card itself would write it.
  const rowsNow = useRef(state.rows);
  rowsNow.current = state.rows;
  const patchDraft = useCallback(async (candidateId, patch) => {
    const row = rowsNow.current.find((r) => r.id === candidateId);
    const draft = { ...(row?.draft ?? {}), ...patch };
    const { error } = await supabase.from('candidates').update({ draft }).eq('id', candidateId).eq('tenant_id', tenantId);
    if (error) throw new Error(error.message);
    noteDraft(candidateId, draft);
    return draft;
  }, [tenantId, noteDraft]);

  const saveAspects = useCallback((candidateId, aspects) => patchDraft(candidateId, { aspects }), [patchDraft]);

  // The shelf product's own market on eBay: what new listings of it ask now. Read only.
  // The eBay listing that sells what she sources: the one she chose read in full, or Keepr's best match with how
  // sure it is. Nothing is saved by the function; the card puts it in her draft.
  const matchListing = useCallback(async (candidateId, itemId = null) => invoke('ebay-match', {
    tenant_id: tenantId, candidate_id: candidateId, ...(itemId ? { item_id: itemId } : {}),
  }), [tenantId]);

  /*
   * Her Amazon supplier's page read through Apify, for up to 20 cards at once. The reading lands on each card as
   * `supplier_read`; nothing of hers changes here. `url` reads a link she has just added, before it is on the card.
   */
  const readSupplier = useCallback(async (candidateIds, { url = null, again = false } = {}) => {
    const data = await invoke('supplier-read', { tenant_id: tenantId, candidate_ids: candidateIds, ...(url ? { url } : {}), again });
    const reads = data?.reads ?? {};
    if (Object.keys(reads).length) {
      setState((s) => ({ ...s, rows: s.rows.map((r) => (reads[r.id] ? { ...r, supplier_read: reads[r.id] } : r)) }));
    }
    // A supplier whose cost followed Amazon's price in this read, so the card's keep moves with it.
    for (const [candidateId, source] of Object.entries(data?.moved ?? {})) putSource(candidateId, source);
    return { reads, skipped: data?.skipped ?? {} };
  }, [tenantId, putSource]);

  const marketCheck = useCallback(async (candidateId, query = null) => {
    const data = await invoke('ebay-list', { tenant_id: tenantId, candidate_id: candidateId, market: true, ...(query ? { query } : {}) });
    return data.market;
  }, [tenantId]);

  // Title options or a description written from the shop page's facts, for a card that is not open. A conflict
  // (the text and the pack disagree) comes back as { conflict }, never as copy.
  const compose = useCallback(async (candidateId, kind) => {
    const data = await invoke('ebay-compose', { tenant_id: tenantId, candidate_id: candidateId, kind });
    if (data?.read) {
      setState((s) => ({ ...s, rows: s.rows.map((r) => (r.id === candidateId && !r.listing ? { ...r, listing: data.read } : r)) }));
    }
    return data;
  }, [tenantId]);

  // Keepr's photo check: eBay's catalogue for the barcode, and each of the shop's photos looked at. The answer is
  // kept on the card; nothing of hers changes until she, or a bulk action she starts, uses what passed.
  // `wider` looks in other UK shops for the same product even when the first shop's photos were enough.
  // `supplied` is a supplier page sent from her browser (the Send to Cart & Keep button): its photos are checked.
  const checkPhotos = useCallback(async (candidateId, { again = false, wider = false, supplied = null } = {}) => {
    const data = await invoke('photo-check', { tenant_id: tenantId, candidate_id: candidateId, again, wider, ...(supplied ? { supplied } : {}) });
    setState((s) => ({
      ...s,
      rows: s.rows.map((r) => (r.id === candidateId
        ? { ...r, photo_checks: data.photo_checks, ...(data.read ? { listing: data.read } : {}) }
        : r)),
    }));
    return data.photo_checks;
  }, [tenantId]);

  // dry returns what eBay would receive, including the category it suggests
  // from the title, which is the one field nobody can check in advance.
  const list = useCallback(
    async ({ candidateId, dry = false, ...fields }) => {
      const data = await invoke('ebay-list', { tenant_id: tenantId, candidate_id: candidateId, dry, ...fields });
      // Live on eBay: the card keeps its place while another channel is left, and goes once none is.
      if (!dry) {
        setState((s) => ({
          ...s,
          rows: s.rows.map((r) => (r.id === candidateId ? { ...r, ebay: data } : r)).filter((r) => channelStates(r).left.length > 0),
        }));
        setMonth((m) => (m ?? 0) + 1);
      }
      return data;
    },
    [tenantId],
  );

  // Cards to list in the background. Each carries what she chose at the time (price, quantity, category, the
  // catalogue), then the queue is kicked so it starts now rather than on the next minute.
  const queue = useCallback(async (items) => {
    const { error } = await supabase.from('listing_jobs').insert(
      items.map(({ candidateId, request }) => ({ tenant_id: tenantId, candidate_id: candidateId, channel: 'ebay', request })),
    );
    if (error) throw new Error(error.code === '23505' ? 'One of these is already in the queue.' : error.message);
    supabase.functions.invoke('ebay-queue', { body: { tenant_id: tenantId } }).catch(() => {});
    await loadJobs();
  }, [tenantId, loadJobs]);

  // Taken back while still waiting. Once the queue has it, it runs.
  const cancel = useCallback(async (jobId) => {
    const { error } = await supabase.from('listing_jobs').update({ state: 'cancelled' }).eq('id', jobId).eq('state', 'queued');
    if (error) throw new Error(error.message);
    await loadJobs();
  }, [loadJobs]);

  // A refused card, sent again as it was chosen, once she has fixed what eBay said.
  const retry = useCallback((job, request = job.request) => queue([{ candidateId: job.candidate_id, request }]), [queue]);

  // While anything is queued or working, look again every twelve seconds. A card that went live is re-read, so it
  // moves on the page the way a card published by hand does.
  const waiting = Object.values(jobs).some((j) => j.state === 'queued' || j.state === 'working');
  const doneSeen = useRef(new Set());
  useEffect(() => {
    if (!waiting) return undefined;
    const t = setInterval(async () => {
      const latest = await loadJobs();
      const fresh = Object.values(latest).filter((j) => j.state === 'done' && !doneSeen.current.has(j.id));
      if (fresh.length) {
        fresh.forEach((j) => doneSeen.current.add(j.id));
        load();
        countMonth();
      }
    }, 12000);
    return () => clearInterval(t);
  }, [waiting, loadJobs, load, countMonth]);

  // A draft product, never live. The shop is not public yet, and 0036 keeps
  // anything with unconfirmed returns or hazard fields off sale anyway.
  const addToShop = useCallback(
    async ({ candidateId, product }) => {
      const { data, error } = await supabase
        .from('store_products')
        .upsert(
          { tenant_id: tenantId, status: 'draft', source_kind: 'candidate', ...product, candidate_id: candidateId },
          { onConflict: 'tenant_id,slug' },
        )
        .select('id, status, slug')
        .single();

      if (error) throw error;

      // Keepr checks the returns and any label warning as it lands. Not waited on: a draft it has not checked yet
      // says so in Products, with the check a press away.
      invoke('shop-rules', { tenant_id: tenantId, product_ids: [data.id] }).catch(() => null);

      setState((s) => ({
        ...s,
        rows: s.rows.map((r) => (r.id === candidateId ? { ...r, store_products: [data] } : r))
          .filter((r) => channelStates(r).left.length > 0),
      }));
      return data;
    },
    [tenantId],
  );

  return { ...state, month, jobs, reload: load, addSource, updateSource, list, addToShop, queue, cancel, retry, noteDraft, noteListing, saveAspects, patchDraft, checkPhotos, compose, marketCheck, matchListing, readSupplier };
}
