import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@lib/supabase';

// From the view, so what is waiting is computed from the timestamps rather than
// from anything in the browser. Messages load per thread on opening.

const LIMIT = 200;

const SELECT = `
  id, subject_kind, channel, status, email, name,
  created_at, last_message_at, last_customer_at, last_reply_at, awaiting,
  product_id, product_title, product_slug, product_image,
  order_id, order_reference,
  basket, basket_lines, basket_total,
  messages, last_body, last_sender
`;

// Read separately rather than joined: a handful of rows against two hundred threads.
const OFFER_SELECT = 'id, thread_id, price, expires_at, lines';

// Separate from the insert, so a Resend outage loses the email and not her words.
async function callNotify(messageId) {
  const { data: session } = await supabase.auth.getSession();
  const token = session?.session?.access_token;
  if (!token) throw new Error('Signed out. Sign in and try again.');

  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notify`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind: 'message', messageId }),
  });

  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(payload?.error ?? `Saved, but the email did not send (${res.status}).`);
  }
}

export function useThreads(tenantId) {
  const [state, setState] = useState({
    status: 'loading', rows: [], truncated: false, error: null,
  });

  // Keyed by thread, so opening a second conversation does not throw away the
  // first and reopening one is instant.
  const [messages, setMessages] = useState({});
  const [replyTime, setReplyTime] = useState(null);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setState((s) => ({ ...s, status: 'loading' }));

    const { data, error } = await supabase
      .from('store_thread_inbox')
      .select(SELECT)
      .eq('tenant_id', tenantId)
      .order('last_message_at', { ascending: false })
      .limit(LIMIT);

    if (error) return setState({ status: 'error', rows: [], truncated: false, error });

    // Sorted here so one round trip serves both "what needs me" and "what happened last".
    const rows = [...(data ?? [])].sort((a, b) => {
      if (a.awaiting !== b.awaiting) return a.awaiting ? -1 : 1;
      return String(b.last_message_at).localeCompare(String(a.last_message_at));
    });

    const { data: live } = await supabase
      .from('store_live_offers')
      .select(OFFER_SELECT)
      .eq('tenant_id', tenantId);

    const byThread = new Map((live ?? []).map((o) => [o.thread_id, o]));

    setState({
      status: 'ready',
      rows: rows.map((r) => ({ ...r, offer: byThread.get(r.id) ?? null })),
      truncated: (data ?? []).length >= LIMIT,
      error: null,
    });
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  // The count comes back with the median so the page can refuse to show one from
  // two conversations.
  useEffect(() => {
    if (!tenantId) return;
    supabase
      .from('store_reply_time')
      .select('answered, median_seconds')
      .eq('tenant_id', tenantId)
      .maybeSingle()
      .then(({ data }) => setReplyTime(data ?? null));
  }, [tenantId, state.rows.length]);

  // What tells her a message landed is the email, so the screen it opens must not
  // be an hour old.
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [load]);

  const loadMessages = useCallback(async (threadId) => {
    const { data, error } = await supabase
      .from('store_messages')
      .select('id, sender, body, author_name, sent_at, send_error, read_at, created_at')
      .eq('thread_id', threadId)
      .order('created_at');

    if (error) throw error;
    setMessages((m) => ({ ...m, [threadId]: data ?? [] }));
    return data ?? [];
  }, []);

  const open = useCallback(async (threadId) => {
    const data = await loadMessages(threadId);

    // Read is not answered. The nav counts what is waiting; this is kept so a later
    // screen can tell "not seen" from "seen and not answered".
    const unread = (data ?? []).filter((x) => x.sender === 'customer' && !x.read_at);
    if (unread.length) {
      await supabase.from('store_messages')
        .update({ read_at: new Date().toISOString() })
        .in('id', unread.map((x) => x.id));
    }
  }, [loadMessages]);

  // A basket prices its own snapshot. A product has none, so one line is built at
  // the quantity she picks, priced from the catalogue rather than the screen.
  const offerLines = useCallback(async (row, qty) => {
    if (Array.isArray(row.basket) && row.basket.length) return row.basket;
    if (!row.product_id) return null;

    const { data: product, error } = await supabase
      .from('store_products')
      .select('id, slug, title, price, image_url')
      .eq('id', row.product_id)
      .single();

    if (error || !product) throw new Error('That product is not readable any more.');

    return [{
      product_id: product.id,
      variant_id: null,
      slug: product.slug,
      title: product.title,
      variant_label: null,
      qty: Math.max(1, Math.floor(Number(qty) || 1)),
      price: Number(product.price),
      image_url: product.image_url ?? null,
    }];
  }, []);

  const reply = useCallback(async ({ threadId, text, offer }) => {
    const trimmed = String(text ?? '').trim();
    if (!trimmed) return;

    const row = state.rows.find((r) => r.id === threadId);
    if (!row) throw new Error('That conversation is not on this page any more.');

    const { data: session } = await supabase.auth.getSession();

    // Before the message, because notify reads whatever offer stands when it runs.
    if (offer) {
      const lines = await offerLines(row, offer.qty);
      if (!lines) throw new Error('There is nothing on this conversation to price.');

      // Required, not tidy: the unique index in 0070 refuses a second live offer.
      const { error: wErr } = await supabase
        .from('store_offers')
        .update({ status: 'withdrawn' })
        .eq('thread_id', threadId)
        .eq('status', 'open');

      if (wErr) throw wErr;

      const { error: oErr } = await supabase.from('store_offers').insert({
        tenant_id: tenantId,
        thread_id: threadId,
        lines,
        price: offer.price,
        expires_at: new Date(Date.now() + offer.days * 86400_000).toISOString(),
        author_id: session?.session?.user?.id ?? null,
      });

      if (oErr) throw oErr;
    }

    const { data: written, error } = await supabase
      .from('store_messages')
      .insert({
        tenant_id: tenantId,
        thread_id: threadId,
        sender: 'shop',
        body: trimmed,
        // author_name stays null while one person answers. The id costs nothing and
        // is what assignment reads when there is a second seat.
        author_id: session?.session?.user?.id ?? null,
      })
      .select('id, sender, body, author_name, sent_at, send_error, read_at, created_at')
      .single();

    if (error) throw error;

    // The words are saved by now; the send is a separate failure with its own message.
    setMessages((m) => ({ ...m, [threadId]: [...(m[threadId] ?? []), written] }));

    try {
      await callNotify(written.id);
    } finally {
      // Refetched, not just reloaded. The row was appended as it was written,
      // with sent_at null, so without this it reads "not emailed yet" forever
      // on an email that went.
      await Promise.all([load(), loadMessages(threadId)]);
    }
  }, [state.rows, tenantId, load, offerLines, loadMessages]);

  // Withdrawn, not deleted. Somebody may quote it back at her.
  const withdrawOffer = useCallback(async (threadId) => {
    const { error } = await supabase
      .from('store_offers')
      .update({ status: 'withdrawn' })
      .eq('thread_id', threadId)
      .eq('status', 'open');
    if (error) throw error;
    await load();
  }, [load]);

  // Closing frees the unique index in 0068, so the same person can start a fresh one.
  const setStatus = useCallback(async (threadId, status) => {
    const { error } = await supabase
      .from('store_threads').update({ status }).eq('id', threadId);
    if (error) throw error;
    await load();
  }, [load]);

  const counts = useMemo(() => ({
    awaiting: state.rows.filter((r) => r.awaiting).length,
    open: state.rows.filter((r) => r.status === 'open').length,
    closed: state.rows.filter((r) => r.status === 'closed').length,
    all: state.rows.length,
  }), [state.rows]);

  return {
    ...state, counts, messages, replyTime,
    reload: load, open, reply, setStatus, withdrawOffer,
  };
}

// A head request against the partial index in 0067, not two hundred rows.
export function useAwaitingCount(tenantId) {
  const [count, setCount] = useState(null);

  useEffect(() => {
    if (!tenantId) return undefined;
    let live = true;

    const read = async () => {
      const { count: n, error } = await supabase
        .from('store_thread_inbox')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('awaiting', true);
      if (live) setCount(error ? null : (n ?? 0));
    };

    read();
    const onVisible = () => { if (document.visibilityState === 'visible') read(); };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      live = false;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [tenantId]);

  return count;
}
