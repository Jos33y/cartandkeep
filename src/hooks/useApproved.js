import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@lib/supabase';
import { readPages } from '@lib/readPages';
import { channelStates } from '@lib/golive';

// Same to-one embed as the candidates read.
function one(decisions) {
  if (Array.isArray(decisions)) return decisions[0] ?? null;
  return decisions ?? null;
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
        listing, draft, ebay, competition,
        store_products ( id, status, slug ),
        sold_30d, avg_sold_price, window_start, window_series,
        recommended_channels,
        batches ( delivered_for ),
        decisions!inner ( action, decided_at, note ),
        candidate_sources (
          id, supplier, supplier_kind, fulfilment, status, url, note,
          unit_cost, moq, price_at_moq, supplier_shipping,
          inbound_freight_per_unit, duty_pct, landed_unit_cost,
          ships_from, transit_days, confirmed, quoted_on, matched_on
        )
      `)
      .eq('tenant_id', tenantId)
      .eq('decisions.action', 'approve'));

    if (error) return setState({ status: 'error', rows: [], error });

    setState({
      status: 'ready',
      // A card stays until every channel it is meant for has started: live on eBay, and on her shop as a draft
      // or on sale. A card on eBay still waiting for the shop stays, with only the shop left to do.
      rows: data.filter((c) => channelStates(c).left.length > 0).map(({ decisions, batches, candidate_sources: sources, ...c }) => ({
        ...c,
        decision: one(decisions),
        delivered_for: batches?.delivered_for ?? null,
        sources: [...(sources ?? [])].sort(
          (a, b) => Number(a.landed_unit_cost ?? 1e9) - Number(b.landed_unit_cost ?? 1e9),
        ),
      })).sort(byListOrder),
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
        .select(`
          id, supplier, supplier_kind, fulfilment, status, url, note,
          unit_cost, moq, price_at_moq, supplier_shipping,
          inbound_freight_per_unit, duty_pct, landed_unit_cost,
          ships_from, transit_days, confirmed, quoted_on, matched_on
        `)
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

  // Her saved draft, back into the page's copy of the card.
  const noteDraft = useCallback((candidateId, draft) => {
    setState((s) => ({ ...s, rows: s.rows.map((r) => (r.id === candidateId ? { ...r, draft } : r)) }));
  }, []);

  // The shop page a function read for the first time, onto the page's copy of the card.
  const noteListing = useCallback((candidateId, listing) => {
    setState((s) => ({ ...s, rows: s.rows.map((r) => (r.id === candidateId && !r.listing ? { ...r, listing } : r)) }));
  }, []);

  // Item details filled in from the check sheet, written onto her draft as the card itself would write them.
  const saveAspects = useCallback(async (candidateId, aspects) => {
    const row = state.rows.find((r) => r.id === candidateId);
    const draft = { ...(row?.draft ?? {}), aspects };
    const { error } = await supabase.from('candidates').update({ draft }).eq('id', candidateId).eq('tenant_id', tenantId);
    if (error) throw new Error(error.message);
    noteDraft(candidateId, draft);
  }, [state.rows, tenantId, noteDraft]);

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

  // eBay's catalogue entry for the card's barcode: its photos can stand in for hers on eBay only.
  const lookupCatalogue = useCallback(
    (candidateId) => invoke('ebay-list', { tenant_id: tenantId, candidate_id: candidateId, lookup: true }),
    [tenantId],
  );

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

      setState((s) => ({
        ...s,
        rows: s.rows.map((r) => (r.id === candidateId ? { ...r, store_products: [data] } : r))
          .filter((r) => channelStates(r).left.length > 0),
      }));
      return data;
    },
    [tenantId],
  );

  return { ...state, month, jobs, reload: load, addSource, list, addToShop, lookupCatalogue, queue, cancel, retry, noteDraft, noteListing, saveAspects };
}
